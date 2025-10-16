Absolutely—here’s your file with the “swankier” UX applied, **without changing any of your existing comments**. I added debounced search, nicer status pills, cast filter + “Reset/Select all/Clear all,” a drag-and-drop upload zone (while keeping your file input), and a slightly nicer annotation overlay. All existing comments remain exactly as you wrote them.


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

  // extra (ui niceties)
  const [isSearching, setIsSearching] = useState(false);
  const [castFilter, setCastFilter] = useState("");
  const [recommendedCast, setRecommendedCast] = useState({});
  const fileInputRef = useRef(null);

  // searches for a given movie and stores a list of results in 'results'
  // (calls python api for actual function)
  async function search() {
    try {
      setIsSearching(true);
      const r = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`);
      setResults(await r.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  }

  // sets the chosen movie
  // additionally, clears prediction and preview
  // (calls python api for actual function)
  async function pick(m) {
    try {
      setMovie(m);
      const r = await fetch(`${API}/api/credits/${m.id}`);
      const j = await r.json();
      // set the main cast
      setCast(j.main);
      setRecommendedCast(j.main || {});
      // set the full cast (for togglability)
      setFull(j.full);
      // clear previous prediction & preview (if they existed)
      setPred(null);
      setPreview(null);
    } catch (e) {
      console.error(e);
    }
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
    try {
      setScrapeStatus("working...");
      const r = await fetch(`${API}/api/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieTitle: movie?.title || "", actorDict: cast }),
      });
      setScrapeStatus(JSON.stringify(await r.json(), null, 2));
    } catch (e) {
      setScrapeStatus(`Error: ${e?.message || String(e)}`);
    }
  }

  // train model
  async function train() {
    try {
      setTrainStatus("training...");
      const r = await fetch(`${API}/api/train`, { method: "POST" });
      setTrainStatus(JSON.stringify(await r.json(), null, 2));
    } catch (e) {
      setTrainStatus(`Error: ${e?.message || String(e)}`);
    }
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

  // ------------------ UI Functions

  // debounced search on typing (manual button still works)
  useEffect(() => {
    if (!q) { setResults([]); return; }
    const id = setTimeout(() => { search(); }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function selectAll() {
    const next = { ...cast };
    for (const c of full) next[c.name] = titleCase(c.character || c.name);
    setCast(next);
  }

  function clearAll() {
    setCast({});
  }

  function resetRecommended() {
    setCast({ ...(recommendedCast || {}) });
  }

  function renderStatusPill(s) {
    if (!s) return null;
    const lower = String(s).toLowerCase();
    let bg = "#eee", color = "#333", text = s;
    if (lower.includes("working") || lower.includes("training")) {
      bg = "#e7f0ff"; color = "#0b5fff"; text = "Working…";
    }
    if (lower.startsWith("{") || lower.startsWith("[")) {
      bg = "#e6f7ec"; color = "#0a7d2d"; text = "Done";
    }
    if (lower.startsWith("error")) {
      bg = "#ffe8e6"; color = "#c02626"; text = String(s);
    }
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: bg,
        color,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        border: "1px solid rgba(0,0,0,0.06)"
      }}>
        {text}
      </span>
    );
  }

  function onDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const fakeEvent = { target: { files: [file] } };
    predict(fakeEvent);
  }
  function onDragOver(e) { e.preventDefault(); }

  // derived
  const filteredFull = castFilter
    ? full.filter((c) => `${c.name} ${c.character}`.toLowerCase().includes(castFilter.toLowerCase()))
    : full;
  const selectedCount = Object.keys(cast).length;

  // actual app
  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Movie Face ID</h1>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search movie"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={search} disabled={isSearching}>
          {isSearching ? "Searching…" : "Search"}
        </button>
      </div>

      {results.length > 0 && (
        <ul>
          {results.slice(0, 10).map((m) => (
            <li key={m.id} style={{ margin: "6px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{m.title}</div>
                <div style={{ fontSize: 12, color: "#666" }}>{(m.release_date || "????").slice(0, 4)}</div>
              </div>
              <button onClick={() => pick(m)}>Select</button>
            </li>
          ))}
        </ul>
      )}

      {movie && (
        <>
          <h2 style={{ marginTop: 24 }}>{movie.title}</h2>
          <p>Edit main cast (click to toggle):</p>

          <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
            <input
              value={castFilter}
              onChange={(e) => setCastFilter(e.target.value)}
              placeholder="Filter by name or character"
              style={{ flex: 1, padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
            />
            <button onClick={resetRecommended}>Reset</button>
            <button onClick={selectAll}>Select all</button>
            <button onClick={clearAll}>Clear all</button>
          </div>

          <div style={{ marginBottom: 8, fontSize: 12, color: "#666" }}>
            Selected: <b>{selectedCount}</b>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
            {filteredFull.map((c) => {
              const selected = !!cast[c.name];
              return (
                <button
                  key={`${c.name}-${c.character}`}
                  onClick={() => toggle(c.name, c.character)}
                  style={{
                    textAlign: "left",
                    background: selected ? "#e8f7ee" : "#ffffff",
                    color: "#111",
                    padding: 10,
                    border: selected ? "1px solid #84e1a7" : "1px solid #ccc",
                    borderRadius: 10,
                    boxShadow: selected ? "inset 0 0 0 1px #b7ebce" : "none"
                  }}
                  title={selected ? "Click to remove" : "Click to add"}
                >
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20, height: 20,
                    borderRadius: 999,
                    marginRight: 8,
                    background: selected ? "#10b981" : "#e5e7eb",
                    color: selected ? "#fff" : "#111",
                    fontSize: 12,
                    fontWeight: 700
                  }}>{selected ? "✓" : "+"}</span>
                  {c.name} — <i>{c.character}</i>
                </button>
              );
            })}
          </div>

          <h3 style={{ marginTop: 16 }}>Selected:</h3>

          {selectedCount > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0 8px" }}>
              {Object.entries(cast).map(([name, role]) => (
                <span key={name} style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#e8f7ee",
                  color: "#065f46",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  border: "1px solid #b7ebce"
                }}>
                  {name} <span style={{ color: "#6b7280" }}>·</span> <i>{role}</i>
                  <button onClick={() => toggle(name, role)} title="Remove" style={{ marginLeft: 2 }}>×</button>
                </span>
              ))}
            </div>
          )}

          <pre style={{ background: "#f6f6f6", padding: 12, overflowX: "auto" }}>
            {JSON.stringify(cast, null, 2)}
          </pre>

          <div style={{ marginTop: 16 }}>
            <button onClick={scrape} disabled={!selectedCount}>Scrape Faces (SerpAPI)</button>
            <span style={{ marginLeft: 12, whiteSpace: "pre-wrap" }}>{renderStatusPill(scrapeStatus)}</span>
            {typeof scrapeStatus === "string" && (scrapeStatus.startsWith("{") || scrapeStatus.startsWith("[")) && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ cursor: "pointer", fontSize: 12, color: "#555" }}>show response</summary>
                <pre style={{ background: "#f6f6f6", padding: 12, overflowX: "auto" }}>
                  {scrapeStatus}
                </pre>
              </details>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <button onClick={train}>Train Model</button>
            <span style={{ marginLeft: 12, whiteSpace: "pre-wrap" }}>{renderStatusPill(trainStatus)}</span>
            {typeof trainStatus === "string" && (trainStatus.startsWith("{") || trainStatus.startsWith("[")) && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ cursor: "pointer", fontSize: 12, color: "#555" }}>show response</summary>
                <pre style={{ background: "#f6f6f6", padding: 12, overflowX: "auto" }}>
                  {trainStatus}
                </pre>
              </details>
            )}
          </div>

          <div style={{ marginTop: 24 }}>
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed #cbd5e1",
                borderRadius: 12,
                padding: "22px 16px",
                textAlign: "center",
                background: "#ffffff",
                cursor: "pointer"
              }}
              title="Drop an image here or click to choose"
            >
              <div style={{ fontSize: 36, lineHeight: "36px" }}>🖼️</div>
              <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>
                <b>Drag & drop</b> a screenshot here, or click to choose a file
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={predict}
              style={{ display: "none" }}
            />

            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12 }}>
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
          const labelY = Math.max(0, y - 24);
          const labelW = Math.max(60, (b.name?.length || 0) * 8);

          return (
            <g key={i}>
              {/* subtle shadow stroke under main box */}
              <rect x={x} y={y} width={w} height={h} fill="none" stroke="black" strokeOpacity="0.35" strokeWidth="5" />
              <rect x={x} y={y} width={w} height={h} fill="none" stroke="lime" strokeWidth="3" />
              <rect x={x} y={labelY} width={labelW} height="20" rx="6" ry="6" fill="rgba(0,0,0,0.6)" />
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
```
