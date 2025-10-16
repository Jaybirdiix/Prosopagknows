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

  // lightweight style tokens (centered + responsive)
  const styles = {
    page: {
      minHeight: "100vh",
      width: "100%",                     // fill full width
      backgroundColor: "#ffffff",        // solid base so “transparent” never shows dark
      backgroundImage:
        "radial-gradient(70% 120% at 0% 0%, #eef2ff 0%, transparent 60%), radial-gradient(70% 120% at 100% 0%, #ecfeff 0%, transparent 60%), linear-gradient(180deg, #ffffff, #f8fafc)",
      backgroundRepeat: "no-repeat",
      overflowX: "hidden",               // avoids 1px horizontal scroll artifacts
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 16px",
      fontFamily: "system-ui",
      color: "#0f172a",
    },
    card: {
      width: "clamp(340px, 88vw, 1200px)",  // responsive width
      background: "#ffffff",
      borderRadius: 16,
      border: "1px solid #e5e7eb",
      boxShadow: "0 20px 45px rgba(2,6,23,0.08)",
      padding: 24,
      margin: "0 auto",
    },
    heading: {
      margin: "0 0 16px",
      fontSize: 28,
      fontWeight: 800,
      letterSpacing: "-0.02em",
      textAlign: "center",
      backgroundImage: "linear-gradient(90deg,#0ea5e9,#10b981)",
      WebkitBackgroundClip: "text",
      color: "transparent",
    },
    sub: { textAlign: "center", color: "#64748b", marginTop: -6, marginBottom: 16, fontSize: 13 },
    row: { display: "flex", gap: 8, alignItems: "center" },
    input: {
      flex: 1,
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #cbd5e1",
      outline: "none",
    },
    btnPrimary: {
      background: "#10b981",
      color: "#fff",
      border: "1px solid #059669",
      padding: "9px 12px",
      borderRadius: 10,
      cursor: "pointer",
      fontWeight: 600,
    },
    btn: {
      background: "#fff",
      color: "#0f172a",
      border: "1px solid #cbd5e1",
      padding: "8px 10px",
      borderRadius: 10,
      cursor: "pointer",
    },
    list: {
      marginTop: 10,
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      overflow: "hidden",
      background: "#fff",
    },
    listItem: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 12px",
      borderBottom: "1px solid #f1f5f9",
    },
    // responsive grid: auto-fills columns based on space
    gridResponsive: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
      gap: 10,
    },
    chipRow: { display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0 8px" },
    chip: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: "#e8f7ee",
      color: "#065f46",
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      border: "1px solid #b7ebce",
    },
    drop: {
      border: "2px dashed #cbd5e1",
      borderRadius: 12,
      padding: "22px 16px",
      textAlign: "center",
      background: "#ffffff",
      cursor: "pointer",
    },
    sectionCard: {
      border: "1px solid #e5e7eb",
      borderRadius: 14,
      padding: 14,
      background: "#ffffff",
      boxShadow: "0 6px 16px rgba(2,6,23,0.04)",
      marginTop: 12,
    },
    pill: (kind) => {
      const map = {
        idle: { bg: "#f1f5f9", fg: "#334155" },
        working: { bg: "#e7f0ff", fg: "#0b5fff" },
        done: { bg: "#e6f7ec", fg: "#0a7d2d" },
        error: { bg: "#ffe8e6", fg: "#c02626" },
      };
      const { bg, fg } = map[kind] || map.idle;
      return {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: bg,
        color: fg,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        border: "1px solid rgba(0,0,0,0.06)",
      };
    },
  };

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
    if (lower.startsWith("error")) return <span style={styles.pill("error")}>{String(s)}</span>;
    if (lower.includes("working") || lower.includes("training")) return <span style={styles.pill("working")}>Working…</span>;
    if (lower.startsWith("{") || lower.startsWith("[")) return <span style={styles.pill("done")}>Done</span>;
    return <span style={styles.pill("idle")}>{String(s)}</span>;
  }

  function onDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const fakeEvent = { target: { files: [file] } };
    predict(fakeEvent);
  }
  function onDragOver(e) { e.preventDefault(); }

  const filteredFull = castFilter
    ? full.filter((c) => `${c.name} ${c.character}`.toLowerCase().includes(castFilter.toLowerCase()))
    : full;
  const selectedCount = Object.keys(cast).length;

  // actual app
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.heading}>🎬 Movie <span style={{ color: "#10b981", WebkitTextFillColor: "initial" }}>Face ID</span></h1>
        <div style={styles.sub}>Search a movie, choose cast, scrape faces, train, and test on a screenshot.</div>

        <div style={{ ...styles.row, marginTop: 6 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Search movie"
            style={styles.input}
          />
          <button onClick={search} disabled={isSearching} style={styles.btnPrimary}>
            {isSearching ? "Searching…" : "Search"}
          </button>
        </div>

        {results.length > 0 && (
          <div style={styles.list}>
            {results.slice(0, 10).map((m, i) => (
              <div key={m.id} style={{ ...styles.listItem, borderBottom: i === results.slice(0,10).length - 1 ? "none" : styles.listItem.borderBottom }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{m.title}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{(m.release_date || "????").slice(0, 4)}</div>
                </div>
                <button onClick={() => pick(m)} style={styles.btn}>Select</button>
              </div>
            ))}
          </div>
        )}

        {movie && (
          <>
            <h2 style={{ marginTop: 24, marginBottom: 4, fontSize: 18, fontWeight: 700 }}>{movie.title}</h2>
            <p style={{ color: "#475569", marginTop: 0 }}>Edit main cast (click to toggle):</p>

            <div style={{ ...styles.row, margin: "8px 0" }}>
              <input
                value={castFilter}
                onChange={(e) => setCastFilter(e.target.value)}
                placeholder="Filter by name or character"
                style={{ ...styles.input }}
              />
              <button onClick={resetRecommended} style={styles.btn}>Reset</button>
              <button onClick={selectAll} style={styles.btn}>Select all</button>
              <button onClick={clearAll} style={styles.btn}>Clear all</button>
            </div>

            <div style={{ marginBottom: 8, fontSize: 12, color: "#64748b" }}>
              Selected: <b>{selectedCount}</b>
            </div>

            <div style={styles.gridResponsive}>
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
                      border: selected ? "1px solid #84e1a7" : "1px solid #e5e7eb",
                      borderRadius: 12,
                      boxShadow: selected ? "inset 0 0 0 1px #b7ebce" : "0 1px 2px rgba(2,6,23,0.03)",
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
              <div style={styles.chipRow}>
                {Object.entries(cast).map(([name, role]) => (
                  <span key={name} style={styles.chip}>
                    {name} <span style={{ color: "#6b7280" }}>·</span> <i>{role}</i>
                    <button onClick={() => toggle(name, role)} title="Remove" style={{ marginLeft: 2 }}>×</button>
                  </span>
                ))}
              </div>
            )}

            <div style={styles.sectionCard}>
              <pre style={{ background: "#f8fafc", padding: 12, overflowX: "auto", borderRadius: 10, border: "1px solid #e5e7eb" }}>
                {JSON.stringify(cast, null, 2)}
              </pre>
            </div>

            <div style={{ ...styles.sectionCard }}>
              <div style={{ ...styles.row, justifyContent: "space-between" }}>
                <div style={{ fontWeight: 600 }}>Scrape Faces (SerpAPI)</div>
                <button onClick={scrape} disabled={!selectedCount} style={styles.btnPrimary}>Run</button>
              </div>
              <div style={{ marginTop: 8 }}>{renderStatusPill(scrapeStatus)}</div>
              {typeof scrapeStatus === "string" && (scrapeStatus.startsWith("{") || scrapeStatus.startsWith("[")) && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, color: "#475569" }}>show response</summary>
                  <pre style={{ background: "#f8fafc", padding: 12, overflowX: "auto", borderRadius: 10, border: "1px solid #e5e7eb" }}>
                    {scrapeStatus}
                  </pre>
                </details>
              )}
            </div>

            <div style={{ ...styles.sectionCard }}>
              <div style={{ ...styles.row, justifyContent: "space-between" }}>
                <div style={{ fontWeight: 600 }}>Train Model</div>
                <button onClick={train} style={{ ...styles.btnPrimary, background: "#6366f1", borderColor: "#4f46e5" }}>Run</button>
              </div>
              <div style={{ marginTop: 8 }}>{renderStatusPill(trainStatus)}</div>
              {typeof trainStatus === "string" && (trainStatus.startsWith("{") || trainStatus.startsWith("[")) && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, color: "#475569" }}>show response</summary>
                  <pre style={{ background: "#f8fafc", padding: 12, overflowX: "auto", borderRadius: 10, border: "1px solid #e5e7eb" }}>
                    {trainStatus}
                  </pre>
                </details>
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onClick={() => fileInputRef.current?.click()}
                style={styles.drop}
                title="Drop an image here or click to choose"
              >
                <div style={{ fontSize: 36, lineHeight: "36px" }}>🖼️</div>
                <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
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
              <pre style={{ background: "#f8fafc", padding: 12, overflowX: "auto", marginTop: 12, borderRadius: 10, border: "1px solid #e5e7eb" }}>
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
    const update = () => {
      const rect = img.getBoundingClientRect();
      setDims({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        width: rect.width,
        height: rect.height,
      });
    };
    if (img.complete) update();
    else img.addEventListener("load", update);
    const onResize = () => update();
    window.addEventListener("resize", onResize);
    return () => {
      img.removeEventListener("load", update);
      window.removeEventListener("resize", onResize);
    };
  }, [src]);

  const sx = dims.naturalWidth ? dims.width / dims.naturalWidth : 1;
  const sy = dims.naturalHeight ? dims.height / dims.naturalHeight : 1;

  return (
    <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
      <img
        ref={imgRef}
        src={src}
        alt="preview"
        style={{ maxWidth: "100%", display: "block", borderRadius: 12, boxShadow: "0 8px 24px rgba(2,6,23,0.08)" }}
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
