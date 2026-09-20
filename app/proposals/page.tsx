"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Kicker, languageButton, Masthead } from "../components/ui";
import { ReviewResults, UploadSlot } from "./components";
import { copy } from "./content";
import type { ProposalResponse } from "./types";

type Locale = "es" | "en";

export default function ProposalsPage() {
  const [locale, setLocale] = useState<Locale>("es");
  const [baselineFile, setBaselineFile] = useState<File | null>(null);
  const [revisionFile, setRevisionFile] = useState<File | null>(null);
  const [response, setResponse] = useState<ProposalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Only the latest pair of files may update the screen. Selecting either document
  // aborts the previous upload and its in-flight TypeSafe analysis.
  const activeRequest = useRef<AbortController | null>(null);
  const requestNumber = useRef(0);
  const t = copy[locale];

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function analyze(original: File, revision: File | null) {
    activeRequest.current?.abort();
    const controller = new AbortController();
    const currentRequest = ++requestNumber.current;
    activeRequest.current = controller;
    setLoading(true);
    setError("");
    setResponse(null);
    try {
      const form = new FormData();
      form.append("document", original);
      if (revision) form.append("comparisonDocument", revision);
      const apiResponse = await fetch("/api/analyze-proposal", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const body = (await apiResponse.json()) as ProposalResponse & {
        error?: string;
      };
      if (!apiResponse.ok) throw new Error(body.error ?? t.error);
      if (currentRequest === requestNumber.current) setResponse(body);
    } catch (cause) {
      if (
        currentRequest === requestNumber.current &&
        !(cause instanceof DOMException && cause.name === "AbortError")
      )
        setError(cause instanceof Error ? cause.message : t.error);
    } finally {
      if (currentRequest === requestNumber.current) {
        setLoading(false);
        activeRequest.current = null;
      }
    }
  }

  function selectBaseline(file: File) {
    setBaselineFile(file);
    void analyze(file, revisionFile);
  }

  function selectRevision(file: File) {
    if (!baselineFile) return;
    setRevisionFile(file);
    void analyze(baselineFile, file);
  }

  function removeRevision() {
    setRevisionFile(null);
    if (baselineFile) void analyze(baselineFile, null);
  }

  return (
    <main className="technical-grid min-h-screen px-[5vw] pb-[76px] max-md:px-5 max-md:pb-[38px]">
      <Masthead module={`Módulo 02 · ${t.badge}`}>
        <Link
          className="ml-auto font-mono text-[11px] text-ink underline max-md:text-xs"
          href="/"
        >
          ← {t.back}
        </Link>
        <button
          className={`${languageButton} order-2 ml-3`}
          type="button"
          onClick={() => setLocale(locale === "es" ? "en" : "es")}
        >
          {locale === "es" ? "English" : "Español"}
        </button>
      </Masthead>

      <section className="mx-auto mt-[clamp(62px,10vh,104px)] mb-9 max-w-[880px] text-center max-md:mt-[54px] max-md:mb-[26px] max-md:text-left">
        <Kicker>{t.badge}</Kicker>
        <h1 className="m-0 text-[clamp(48px,7.4vw,86px)] leading-[.98] font-semibold tracking-[-.085em] [&_em]:not-italic [&_em]:text-accent">
          {t.title}
        </h1>
        <p className="mx-auto mt-4 max-w-[590px] text-base text-[#4d5553] max-md:mx-0">
          {t.lede}
        </p>
      </section>

      <section className="mx-auto max-w-[1120px] border-2 border-ink bg-[#d8d7d1] p-4 shadow-safety max-md:shadow-safety-sm">
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <UploadSlot
            id="proposal-document"
            label={t.originalLabel}
            hint={t.originalHint}
            file={baselineFile}
            t={t}
            onSelect={selectBaseline}
          />
          <UploadSlot
            id="proposal-revision"
            label={t.revisionLabel}
            hint={t.revisionHint}
            file={revisionFile}
            disabled={!baselineFile}
            t={t}
            onSelect={selectRevision}
            onRemove={revisionFile ? removeRevision : undefined}
          />
        </div>
        <footer className="mt-3 flex items-center justify-between gap-4 border-t border-ink pt-3 max-sm:items-start">
          <small className="max-w-[520px] text-[11px] leading-[1.4] text-[#59615e]">
            {t.private}
          </small>
          <strong className="text-right font-mono text-[10px] uppercase">
            {loading ? t.analyzing : response ? t.complete : t.originalHint}
          </strong>
        </footer>
        {error && (
          <p
            className="mt-3 border-l-4 border-[#a14d44] bg-[#f2d8d2] p-2.5 text-xs text-[#7b302a]"
            role="alert"
          >
            {error}
          </p>
        )}
      </section>

      <ReviewResults response={response} loading={loading} t={t} />
    </main>
  );
}
