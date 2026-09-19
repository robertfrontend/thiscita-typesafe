"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Kicker,
  languageButton,
  Masthead,
  sourceBadge,
} from "../components/ui";

type Locale = "es" | "en";
type FindingId = "scope" | "pricing" | "timeline" | "nonStandardCommitment";
type FindingStatus = "clear" | "missing" | "review";
type Analysis = {
  findings: {
    id: FindingId;
    probability: number;
    coverageProbability: number | null;
    status: FindingStatus;
  }[];
  summary: string[];
  overallStatus: "ready" | "review";
  source: "typesafe" | "demo";
  responseLatencyMs: number;
};

import { copy } from "./content";

export default function ProposalsPage() {
  const [locale, setLocale] = useState<Locale>("es");
  const [document, setDocument] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const activeRequest = useRef<AbortController | null>(null);
  const requestNumber = useRef(0);
  const t = copy[locale];

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function analyze(file: File) {
    activeRequest.current?.abort();
    const controller = new AbortController();
    const currentRequest = ++requestNumber.current;
    activeRequest.current = controller;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("document", file);
      const response = await fetch("/api/analyze-proposal", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const body = (await response.json()) as Analysis & { error?: string };
      if (!response.ok) throw new Error(body.error ?? t.error);
      if (currentRequest === requestNumber.current) setAnalysis(body);
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
      <section className="mx-auto mt-[clamp(62px,10vh,104px)] mb-9 max-w-[830px] text-center max-md:mt-[54px] max-md:mb-[26px] max-md:text-left">
        <Kicker>{t.badge}</Kicker>
        <h1 className="m-0 text-[clamp(48px,7.4vw,86px)] leading-[.98] font-semibold tracking-[-.085em] [&_em]:not-italic [&_em]:text-accent">
          {t.title}
        </h1>
        <p className="mx-auto mt-4 max-w-[545px] text-base text-[#4d5553] max-md:mx-0">
          {t.lede}
        </p>
      </section>
      <section className="mx-auto grid max-w-[1120px] grid-cols-[minmax(0,1.18fr)_minmax(320px,.82fr)] overflow-hidden border-2 border-ink bg-white shadow-safety max-md:grid-cols-1 max-md:shadow-safety-sm">
        <section className="grid border-r-2 border-ink bg-[#f6f4ef] p-[27px] max-md:border-r-0 max-md:border-b-2 max-md:p-5">
          <div className="flex items-center justify-between gap-3.5">
            <label
              className="font-mono text-sm font-bold uppercase"
              htmlFor="proposal-document"
            >
              {t.label}
            </label>
            <span className="font-mono text-[11px] text-[#585f5b]">
              {t.formats}
            </span>
          </div>
          <label
            className="my-3.5 grid min-h-[360px] cursor-pointer place-content-center place-items-center border-2 border-dashed border-ink bg-[#eeece6] p-5 text-center text-[#526c78] hover:bg-[#ffe5d0] max-md:min-h-[260px]"
            htmlFor="proposal-document"
          >
            <input
              className="sr-only"
              id="proposal-document"
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onClick={(event) => {
                event.currentTarget.value = "";
              }}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setDocument(file);
                setAnalysis(null);
                if (file) void analyze(file);
              }}
            />
            <span
              className="mb-[13px] grid size-12 place-items-center border-2 border-ink bg-safety text-[28px] text-ink"
              aria-hidden="true"
            >
              ↥
            </span>
            <strong className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm">
              {document ? document.name : t.choose}
            </strong>
            <small className="mt-[7px] text-[11px] text-[#788985]">
              {document
                ? `${Math.ceil(document.size / 1024)} KB · ${t.change}`
                : t.formats}
            </small>
          </label>
          <div className="flex items-center justify-between gap-3.5">
            <small className="max-w-[270px] text-[11px] leading-[1.35] text-[#71817f]">
              {t.private}
            </small>
            <strong className="text-right font-mono text-[10px] uppercase">
              {loading ? t.analyzing : analysis ? t.complete : t.autoReady}
            </strong>
          </div>
          {error && (
            <p className="mt-2.5 text-xs text-[#a14d44]" role="alert">
              {error}
            </p>
          )}
        </section>
        <aside className="bg-[#deddd7] p-[27px] max-md:p-5" aria-live="polite">
          <div className="mb-[22px] flex items-start justify-between gap-3.5">
            <div>
              <p className="mb-1 font-mono text-[11px] font-bold text-[#585f5b]">
                {t.result}
              </p>
              <h2 className="max-w-[190px] text-[26px] leading-[1.05] tracking-[-.045em] max-md:max-w-none">
                {analysis
                  ? analysis.overallStatus === "review"
                    ? t.review
                    : t.ready
                  : t.waiting}
              </h2>
            </div>
            {analysis && (
              <span
                className={`${sourceBadge} ${analysis.source === "typesafe" ? "bg-safety" : "bg-[#d6d5cf]"}`}
              >
                {analysis.source === "typesafe" ? t.live : t.demo} ·{" "}
                {analysis.responseLatencyMs} ms
              </span>
            )}
          </div>
          {analysis && (
            <section className="mb-4 grid gap-1 border border-ink bg-[#f5f2eb] p-[13px]">
              <strong className="font-mono text-xs">{t.summary}</strong>
              <small className="text-[10px] text-[#71817f]">
                {t.summaryNote}
              </small>
              <ul className="mt-1 grid list-disc gap-1.5 pl-4 text-[11px] leading-[1.4] text-[#526963]">
                {analysis.summary.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}
          <div className="grid gap-[9px]">
            {(
              [
                "scope",
                "pricing",
                "timeline",
                "nonStandardCommitment",
              ] as FindingId[]
            ).map((id) => {
              const finding = analysis?.findings.find((item) => item.id === id);
              const status = finding?.status ?? "standby";
              const statusStyle = {
                standby: {
                  card: "bg-[#e8e7e2] text-[#626762]",
                  dot: "bg-[#92958f]",
                  label: t.standby,
                },
                clear: {
                  card: "bg-[#dce9df] text-[#28543b]",
                  dot: "bg-[#3f7657]",
                  label: t.clear,
                },
                missing: {
                  card: "bg-[#f5e6ae] text-[#694f0c]",
                  dot: "bg-[#b67b00]",
                  label: t.missing,
                },
                review: {
                  card: "bg-[#ffe0cd] text-[#71381f]",
                  dot: "bg-accent",
                  label: t.needsReview,
                },
              }[status];
              const needsAttention =
                status === "review" || status === "missing";
              const item = t.checks[id];
              return (
                <article
                  className={`grid grid-cols-[1fr_auto] gap-[7px] border border-ink p-[13px] ${statusStyle.card}`}
                  key={id}
                >
                  <div className="flex items-center gap-[7px]">
                    <span
                      className={`size-2 ${statusStyle.dot}`}
                      aria-hidden="true"
                    />
                    <strong className="text-[13px]">{item[0]}</strong>
                  </div>
                  <span className="font-mono text-[11px] font-bold">
                    {statusStyle.label}
                  </span>
                  {needsAttention && (
                    <p className="col-span-full mt-px ml-[15px] text-xs leading-[1.4] text-current">
                      {item[1]}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
          <p className="mt-[19px] font-mono text-[11px] leading-[1.45] text-[#565d59]">
            {t.legal}
          </p>
        </aside>
      </section>
    </main>
  );
}
