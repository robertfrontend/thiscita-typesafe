"use client";

import { useEffect, useState } from "react";

export default function SearchReview() {
  const [queries, setQueries] = useState<string[]>([]);
  useEffect(() => { try { setQueries(JSON.parse(localStorage.getItem("thiscita-unresolved-v1") ?? "[]") as string[]); } catch { setQueries([]); } }, []);
  function clear() { localStorage.removeItem("thiscita-unresolved-v1"); setQueries([]); }
  return <main><section className="results" style={{ marginTop: "80px" }}><div className="results-head"><div><h2>Unresolved searches</h2><p>Stored only in this browser</p></div><button className="language" onClick={clear} type="button">Clear</button></div>{queries.length === 0 ? <div className="empty-result"><strong>No searches to review.</strong></div> : <div className="result-list">{queries.slice().reverse().map((query) => <article className="result-card" key={query}><h3>{query}</h3></article>)}</div>}</section></main>;
}
