import { useState } from "react";

const API = import.meta.env.VITE_API || "http://localhost:3001";

export default function App(){
  const [q,setQ] = useState("");
  const [results,setResults] = useState([]);
  const [movie,setMovie] = useState(null);
  const [cast,setCast] = useState({}); // name -> role
  const [full,setFull] = useState([]);
  const [scrapeStatus,setScrapeStatus] = useState(null);
  const [trainStatus,setTrainStatus] = useState(null);
  const [pred,setPred] = useState(null);

  async function search(){
    const r = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`);
    setResults(await r.json());
  }
  async function pick(m){
    setMovie(m);
    const r = await fetch(`${API}/api/credits/${m.id}`);
    const j = await r.json();
    setCast(j.main);
    setFull(j.full);
  }
  function toggle(name, character){
    setCast(prev => {
      const copy = {...prev};
      if (copy[name]) delete copy[name];
      else copy[name] = titleCase(character || name);
      return copy;
    });
  }
  async function scrape(){
    setScrapeStatus("working...");
    const r = await fetch(`${API}/api/scrape`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ movieTitle: movie?.title || "", actorDict: cast })
    });
    setScrapeStatus(JSON.stringify(await r.json(),null,2));
  }
  async function train(){
    setTrainStatus("training...");
    const r = await fetch(`${API}/api/train`, { method: "POST" });
    setTrainStatus(JSON.stringify(await r.json(),null,2));
  }
  async function predict(e){
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("image", file);
    const r = await fetch(`${API}/api/predict`, { method:"POST", body: fd });
    setPred(await r.json());
  }

  return (
    <div style={{maxWidth:900, margin:"40px auto", fontFamily:"system-ui"}}>
      <h1>Movie Face ID</h1>

      <div>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search movie"/>
        <button onClick={search}>Search</button>
      </div>

      {results.length>0 && (
        <ul>
          {results.slice(0,10).map(m=>(
            <li key={m.id}>
              <button onClick={()=>pick(m)}>{m.title} ({(m.release_date||"????").slice(0,4)})</button>
            </li>
          ))}
        </ul>
      )}

      {movie && (
        <>
          <h2>{movie.title}</h2>
          <p>Edit main cast (click to toggle):</p>
          <div style={{display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8}}>
            {full.map(c=>(
              <button key={c.name}
                      onClick={()=>toggle(c.name,c.character)}
                      style={{textAlign:"left",
                              background: cast[c.name] ? "#20af20ff" : "#eee",
                              padding:8, border:"1px solid #ccc"}}>
                {cast[c.name] ? "✅ " : "➕ "}{c.name} — <i>{c.character}</i>
              </button>
            ))}
          </div>

          <h3>Selected:</h3>
          <pre>{JSON.stringify(cast,null,2)}</pre>

          <div style={{marginTop:16}}>
            <button onClick={scrape}>Scrape Faces (SerpAPI)</button>
            <span style={{marginLeft:12}}>{scrapeStatus}</span>
          </div>

          <div style={{marginTop:16}}>
            <button onClick={train}>Train Model</button>
            <span style={{marginLeft:12}}>{trainStatus}</span>
          </div>

          <div style={{marginTop:16}}>
            <input type="file" accept="image/*" onChange={predict}/>
            <pre>{pred && JSON.stringify(pred,null,2)}</pre>
          </div>
        </>
      )}
    </div>
  );
}
function titleCase(s){ return s.replace(/\w\S*/g, t => t[0].toUpperCase()+t.slice(1).toLowerCase()); }
