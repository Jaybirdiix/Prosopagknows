import { useState, useRef, useEffect } from "react";

const API = import.meta.env.VITE_API || "http://localhost:3001";

export default function App() {
  // variables
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [movie, setMovie] = useState(null);
  const [cast, setCast] = useState({}); // {name : role}
  const [full, setFull] = useState([]);
  const [scrapeStatus, setScrapeStatus] = useState(null);
  const [trainStatus, setTrainStatus] = useState(null);

  // prediction & preview
  const [pred, setPred] = useState(null); // { ok, results:[{name, box:[x1,y1,x2,y2]}] }
  const [preview, setPreview] = useState(null); // object URL for uploaded image
  const [showJson, setShowJson] = useState(false);

  // searches for a given movie and stores a list of results in 'results'
  // (calls python api for actual function)
  async function search() {
    const r = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`);
    setResults(await r.json());
  }

  // sets the chosen movie
  // additionally, clears prediction and preview
  // (calls python api for actual function)
  async function pick(m) {
    setMovie(m);
    const r = await fetch(`${API}/api/credits/${m.id}`);
    const j = await r.json();
    // set the main cast
    setCast(j.main);
    // set the full cast (for togglability)
    setFull(j.full);
    // clear previous prediction & preview (if they existed)
    setPred(null);
    setPreview(null);
  }

  // toggle whether or not this person is a part of the cast
  // also format nicely (titleCase)
  function toggle(name, character) {
    setCast((prev) => {
      const copy = { ...prev };
      if (copy[name]) delete copy[name];
      else copy[name] = titleCase(character || name);
      return copy;
    });
  }

  // Image scrapes !
  // (calls python api for actual function)
  async function scrape() {
    setScrapeStatus("working...");
    const r = await fetch(`${API}/api/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieTitle: movie?.title || "", actorDict: cast }),
    });
    setScrapeStatus(JSON.stringify(await r.json(), null, 2));
  }

  // train model
  async function train() {
    setTrainStatus("training...");
    const r = await fetch(`${API}/api/train`, { method: "POST" });
    setTrainStatus(JSON.stringify(await r.json(), null, 2));
  }

  // make prediction
  async function predict(e) {
    const file = e.target.files[0];
    if (!file) return;

    // show the image immediately
    const url = URL.createObjectURL(file);
    setPreview(url);
    setPred(null);

    // send to backend
    const fd = new FormData();
    fd.append("image", file);
    // make prediction
    const r = await fetch(`${API}/api/predict`, { method: "POST", body: fd });
    const j = await r.json();
    setPred(j);
  }

  // avoid leaking object URLs
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);


// ----------------------------- UI Functions -----------------------------

  function classNames(...xs) {
    return xs.filter(Boolean).join(" ");
  }


// Pretty status pill
function StatusPill({ kind = "idle", children }) {
  const theme = {
  idle: "bg-gray-100 text-gray-700",
  working: "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
  }[kind];
  return (
  <span className={classNames("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", theme)}>
  {children}
  </span>
  );
}


// Minimal spinner
function Spinner({ size = 18, className = "" }) {
  return (
  <svg className={classNames("animate-spin", className)} width={size} height={size} viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
  <path d="M22 12a10 10 0 0 1-10 10" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
  </svg>
  );
}


// Collapsible JSON block
function JsonBlock({ data }) {
const [open, setOpen] = useState(false);
return (
<div className="rounded-xl border border-gray-200 bg-white/60 backdrop-blur p-3">
<button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-sm font-medium text-gray-700">
<span className="inline-block w-5">{open ? "▾" : "▸"}</span> Raw JSON
</button>
{open && (
<pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-gray-950/95 p-3 text-xs text-gray-100">
{JSON.stringify(data, null, 2)}
</pre>
)}
</div>
);
}


// Annotated image with SVG overlay
function AnnotatedImage({ src, boxes }) {
const imgRef = useRef(null);
const [dims, setDims] = useState({ naturalWidth: 0, naturalHeight: 0, width: 0, height: 0 });


useEffect(() => {
const img = imgRef.current;
if (!img) return;
const onLoad = () => {
const rect = img.getBoundingClientRect();
setDims({
naturalWidth: img.naturalWidth,
naturalHeight: img.naturalHeight,
width: rect.width,
height: rect.height,
});
};
if (img.complete) onLoad();
else img.addEventListener("load", onLoad);
const onResize = () => onLoad();
window.addEventListener("resize", onResize);
return () => {
img.removeEventListener("load", onLoad);
window.removeEventListener("resize", onResize);
};
}, [src]);


const sx = dims.naturalWidth ? dims.width / dims.naturalWidth : 1;
const sy = dims.naturalHeight ? dims.height / dims.naturalHeight : 1;

  // actual app
  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Movie Face ID</h1>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search movie"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={search}>Search</button>
      </div>

      {results.length > 0 && (
        <ul>
          {results.slice(0, 10).map((m) => (
            <li key={m.id} style={{ margin: "6px 0" }}>
              <button onClick={() => pick(m)}>
                {m.title} ({(m.release_date || "????").slice(0, 4)})
              </button>
            </li>
          ))}
        </ul>
      )}

      {movie && (
        <>
          <h2 style={{ marginTop: 24 }}>{movie.title}</h2>
          <p>Edit main cast (click to toggle):</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
            {full.map((c) => (
              <button
                key={c.name}
                onClick={() => toggle(c.name, c.character)}
                style={{
                  textAlign: "left",
                  background: cast[c.name] ? "#20af20ff" : "#be1010ff",
                  color: "#fff",
                  padding: 8,
                  border: "1px solid #ccc",
                }}
              >
                {cast[c.name] ? "✅ " : "➕ "}
                {c.name} — <i>{c.character}</i>
              </button>
            ))}
          </div>

          <h3 style={{ marginTop: 16 }}>Selected:</h3>
          <pre style={{ background: "#f6f6f6", padding: 12, overflowX: "auto" }}>
            {JSON.stringify(cast, null, 2)}
          </pre>

          <div style={{ marginTop: 16 }}>
            <button onClick={scrape}>Scrape Faces (SerpAPI)</button>
            <span style={{ marginLeft: 12, whiteSpace: "pre-wrap" }}>{scrapeStatus}</span>
          </div>

          <div style={{ marginTop: 16 }}>
            <button onClick={train}>Train Model</button>
            <span style={{ marginLeft: 12, whiteSpace: "pre-wrap" }}>{trainStatus}</span>
          </div>

          <div style={{ marginTop: 24 }}>
            <input type="file" accept="image/*" onChange={predict} />
            <label style={{ marginLeft: 12 }}>
              <input
                type="checkbox"
                checked={showJson}
                onChange={(e) => setShowJson(e.target.checked)}
              />{" "}
              show JSON
            </label>
          </div>

          {/* Raw JSON debug (optional) */}
          {showJson && pred && (
            <pre style={{ background: "#f6f6f6", padding: 12, overflowX: "auto", marginTop: 12 }}>
              {JSON.stringify(pred, null, 2)}
            </pre>
          )}

          {/* Annotated preview */}
          {preview && pred?.ok && pred.results?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <AnnotatedImage src={preview} boxes={pred.results} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function titleCase(s) {
  return s.replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase());
}

function AnnotatedImage({ src, boxes }) {
  const imgRef = useRef(null);
  const [dims, setDims] = useState({
    naturalWidth: 0,
    naturalHeight: 0,
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const onLoad = () => {
      // use clientWidth/Height (rendered size) and natural size (original pixels)
      setDims({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        width: img.clientWidth || img.getBoundingClientRect().width,
        height: img.clientHeight || img.getBoundingClientRect().height,
      });
    };
    if (img.complete) onLoad();
    else img.addEventListener("load", onLoad);
    return () => img.removeEventListener("load", onLoad);
  }, [src]);

  const sx = dims.naturalWidth ? dims.width / dims.naturalWidth : 1;
  const sy = dims.naturalHeight ? dims.height / dims.naturalHeight : 1;

  return (
    <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
      <img
        ref={imgRef}
        src={src}
        alt="preview"
        style={{ maxWidth: "100%", display: "block", borderRadius: 6 }}
      />

      <svg
        width={dims.width}
        height={dims.height}
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      >
        {boxes.map((b, i) => {
          const [x1, y1, x2, y2] = b.box;
          const x = x1 * sx;
          const y = y1 * sy;
          const w = (x2 - x1) * sx;
          const h = (y2 - y1) * sy;
          const labelY = Math.max(0, y - 22);
          const labelW = Math.max(60, b.name.length * 8);

          return (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill="none" stroke="lime" strokeWidth="3" />
              <rect x={x} y={labelY} width={labelW} height="20" fill="rgba(0,0,0,0.6)" />
              <text x={x + 6} y={labelY + 14} fill="#fff" fontFamily="system-ui" fontSize="12">
                {b.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
