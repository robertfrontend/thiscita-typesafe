"use client";

import { useEffect, useState } from "react";

export default function SearchReview() {
  const [queries, setQueries] = useState<string[]>([]);
  useEffect(() => {
    try {
      setQueries(
        JSON.parse(
          localStorage.getItem("thiscita-unresolved-v1") ?? "[]",
        ) as string[],
      );
    } catch {
      setQueries([]);
    }
  }, []);
  function clear() {
    localStorage.removeItem("thiscita-unresolved-v1");
    setQueries([]);
  }
  return (
    <main className="technical-grid min-h-screen px-5 py-20">
      <section className="mx-auto max-w-[930px]">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h1 className="text-[27px] tracking-[-.04em]">
              Unresolved searches
            </h1>
            <p className="mt-1 text-xs text-slate">
              Stored only in this browser
            </p>
          </div>
          <button
            className="border border-ink bg-paper px-2.5 py-[7px] font-mono text-[10px]"
            onClick={clear}
            type="button"
          >
            Clear
          </button>
        </div>
        {queries.length === 0 ? (
          <div className="border-2 border-dashed border-ink bg-[#f6f4ef] p-[26px] text-center">
            <strong>No searches to review.</strong>
          </div>
        ) : (
          <div className="grid gap-3">
            {queries
              .slice()
              .reverse()
              .map((query) => (
                <article
                  className="border-2 border-ink bg-[#f6f4ef] p-5"
                  key={query}
                >
                  <h2 className="text-xl tracking-[-.035em]">{query}</h2>
                </article>
              ))}
          </div>
        )}
      </section>
    </main>
  );
}
