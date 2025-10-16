import express from "express";
import axios from "axios";
import multer from "multer";
import FormData from "form-data";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// keys gotten from .env
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const SERPAPI_KEY  = process.env.SERPAPI_KEY;
const ML_BASE      = process.env.ML_BASE || "http://127.0.0.1:8000";

// --- search movies through TMDB ---
app.get("/api/search", async (req,res) => {
  const q = req.query.q || "";
  if (!q) return res.json({results: []});
  const r = await axios.get("https://api.themoviedb.org/3/search/movie", {
    params: { api_key: TMDB_API_KEY, query: q }
  });
  res.json(r.data.results || []);
});

// --- get selected cast and full cast from the movie ---
app.get("/api/credits/:movieId", async (req,res) => {
  const movieId = req.params.movieId;
  const r = await axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`, {
    params: { api_key: TMDB_API_KEY }
  });
  const cast = (r.data?.cast || []).sort((a,b) => (a.order ?? 999) - (b.order ?? 999));

  // originally written in python
  // chooses which cast members are relevant enough to train on
  const total = cast.length, always = 5;
  const cutoff5  = always;
  const cutoff12 = Math.max(Math.floor(total * 0.10), cutoff5);
  const cutoff30 = Math.max(Math.floor(total * 0.30), cutoff12);
  const cutoff60 = Math.max(Math.floor(total * 0.60), cutoff30);

  const main = [];
  for (let i = 0; i < Math.min(cutoff60, cast.length); i++) {
    const c = cast[i];
    const name = c.name;
    const character = (c.character || "").toLowerCase();
    const popularity = c.popularity || 0;

    if (character.includes("uncredited")) continue;
    if (character.includes("voice") || character.includes("the ring")) continue;
    if (character.length <= 1 || character.includes("#")) continue;

    if (i < cutoff5) { main.push({ name, character }); continue; }
    if (i < cutoff12) { if (popularity >= 2.0) main.push({ name, character }); continue; }
    if (i < cutoff30) { if (popularity >= 2.2) main.push({ name, character }); continue; }
    if (i < cutoff60) { if (popularity >= 2.5) main.push({ name, character }); continue; }
  }

  // return both the selected cast (main) and the full sorted cast for editing
  res.json({
    main: Object.fromEntries(main.map(m => [m.name, titleCase(m.character)])),
    full: cast.map(c => ({
      name: c.name,
      character: c.character || "",
      order: c.order ?? 999,
      popularity: c.popularity ?? 0
    }))
  });
});

function titleCase(s){ return s.replace(/\w\S*/g, t => t[0].toUpperCase() + t.slice(1).toLowerCase()); }

// --- scrape images with SerpAPI image search ---
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.post("/api/scrape", async (req,res) => {
  // body: { movieTitle, actorDict } where actorDict = { "Actor Name": "Role", ... }
  const { movieTitle, actorDict } = req.body || {};
  if (!actorDict) return res.status(400).json({error:"actorDict required"});
  const baseFaces = path.join(__dirname, "..", "ml_service", "faces");
  fs.mkdirSync(baseFaces, { recursive: true });

  const results = {};
  for (const [actor, role] of Object.entries(actorDict)) {
    // I've found this query to be the most successful / accurate
    const q = `${actor} ${role} ${movieTitle} face`;
    const dir = path.join(baseFaces, role);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    try {
        // Query SerpAPI for image results
        const r = await axios.get("https://serpapi.com/search.json", {
            params: { q, tbm: "isch", api_key: SERPAPI_KEY }
        });

        // 2) take up to 40 images and download each one
        const imgs = (r.data?.images_results || []).slice(0, 40);
        let idx = 1;
        for (const im of imgs) {
            const url = im.original || im.thumbnail;
            if (!url) continue;

            // per-image failure is swallowed so the loop keeps going
            const resp = await axios.get(url, { responseType: "arraybuffer" }).catch(() => null);
            if (!resp) continue;

            const fp = path.join(dir, `${idx++}.jpg`);
            fs.writeFileSync(fp, resp.data);
        }

        // 3) record success for this role
        results[role] = { downloaded: idx - 1 };
        } catch (e) {
        // if SerpAPI call (or anything in the try) throws, we don’t crash the whole request:
        // we just record the error for this role and continue to the next actor/role
        results[role] = { error: e.message };
        }

  }
  res.json({ ok: true, results });
});

// --- Train model (delegate to Python ML service) ---
app.post("/api/train", async (_req,res) => {
  const r = await axios.post(`${ML_BASE}/train`, {}); // uses faces/ folder on python side
  res.json(r.data);
});

// --- Predict: upload an image, forward to ML service, return boxes + names ---
const upload = multer({ dest: path.join(__dirname, "uploads") });
app.post("/api/predict", upload.single("image"), async (req,res) => {
  const form = new FormData();
  form.append("image", fs.createReadStream(req.file.path), req.file.originalname);
  const r = await axios.post(`${ML_BASE}/predict`, form, {
    headers: form.getHeaders()
  });
  res.json(r.data);
  // Cleanup if you want: fs.unlinkSync(req.file.path);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`server listening http://localhost:${PORT}`));
