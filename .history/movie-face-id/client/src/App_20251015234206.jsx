import { useState, useRef, useEffect } from "react";

const API = import.meta.env.VITE_API || "http://localhost:3001";

export default function App() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [movie, setMovie] = useState(null);
  const [cast, setCast] = useState({});        // name -> role
  const [full, setFull] = useState([]);
  const [scrapeStatus, setScrapeStatus] = useState(null);
  const [trainStatus, setTrainStatus] = useState(null);
  const [pred, setPred] = useState(null);       // { ok, results:[{name, box:[x1,y1,x2,y2]}] }
  const [preview, setPreview] = useState(null); // object URL for uploaded image

  async function search() {
    const r = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`);
    setResults(await r.json());
  }

  async function pick(m) {
    setMovie(m);
    const r = await fetch(`${API}/api/credits/${m.id}`);
    const j = await r.json();
    setCast(j.main);
    setFull(j.full);
    setPred(null);
    setPreview(null);
  }

  function toggle(name, character) {
    setCast((prev) => {
      const copy = { ...prev };
      if (copy[name]) delete copy[name];
      else copy[name] = titleCase(character || name);
      return copy;
    });
  }

  async function scrape() {
    setScrapeStatus("working...");
    const r = await fetch(`${API}/api/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieTitle: movie?.title || "", actorDict: cast }),
    });
    setScrapeStatus(JSON.stringify(await r.json(), null, 2));
  }

  async function train() {
    setTrainStatus("training...");
    const r = await fetch(`${API}/api/train`, { method: "POST" });
    setTrainStatus(JSON.stringify(await r.json(), null, 2));
  }

  async function predict(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file)); // show the image
    setPred(null);
    const fd = new FormData();
    fd.append("image", file);
    const r = await fetch(`${API}/api/predict`, { method: "POST", body: fd });
    setPred(await r.json());
  }

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
            {/* Keep raw JSON for debugging if you like */}
            {/* <pre>{pred && JSON.stringify(pred, null, 2)}</pre> */}
          </div>
          {preview && (
  <div style={{ marginTop: 16 }}>
    <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
      <img
        src={preview}
        alt="preview"
        style={{ maxWidth: "100%", display: "block", borderRadius: 6 }}
        onLoad={(e) => {
          const img = e.currentTarget;
          setImgDims({
            w: img.clientWidth,
            h: img.clientHeight,
            nw: img.naturalWidth,
            nh: img.naturalHeight,
          });
        }}
      />

      {pred?.ok && pred.results?.length > 0 && (
        <svg
          width={imgDims.w}
          height={imgDims.h}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
        >
          {pred.results.map((r, i) => {
            const [x1, y1, x2, y2] = r.box;
            // scale from original pixel space -> displayed size
            const sx = imgDims.nw ? imgDims.w / imgDims.nw : 1;
            const sy = imgDims.nh ? imgDims.h / imgDims.nh : 1;
            const x = x1 * sx, y = y1 * sy, w = (x2 - x1) * sx, h = (y2 - y1) * sy;
            const labelY = Math.max(0, y - 22);
            const labelW = Math.max(60, r.name.length * 8);

            return (
              <g key={i}>
                <rect x={x} y={y} width={w} height={h} fill="none" stroke="lime" strokeWidth="3" />
                <rect x={x} y={labelY} width={labelW} height="20" fill="rgba(0,0,0,0.6)" />
                <text x={x + 6} y={labelY + 14} fill="#fff" fontFamily="system-ui" fontSize="12">
                  {r.name}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  </div>
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
      setDims({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        width: img.clientWidth,
        height: img.clientHeight,
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
              <text
                x={x + 6}
                y={labelY + 14}
                fill="#fff"
                fontFamily="system-ui"
                fontSize="12"
              >
                {b.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
