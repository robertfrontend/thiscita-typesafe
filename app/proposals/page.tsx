"use client";

import { useState } from "react";

type Locale = "es" | "en";
type FindingId = "scope" | "pricing" | "timeline" | "nonStandardCommitment";
type Analysis = { findings: { id: FindingId; probability: number; status: "clear" | "review" }[]; summary: string[]; overallStatus: "ready" | "review"; source: "typesafe" | "demo"; responseLatencyMs: number };

const copy = {
  es: {
    back: "Inicio", badge: "Revisor de propuestas", title: <>Revisa antes de <em>enviar.</em></>, lede: "Un control comercial rápido para propuestas de servicios.", label: "Sube la propuesta", formats: "PDF, DOCX o TXT · Máximo 25 MB", choose: "Elegir documento", change: "Cambiar documento", analyzing: "Analizando documento…", autoReady: "El análisis comienza al subirlo.", complete: "Análisis listo", private: "El archivo se usa solo para este análisis. No lo guardamos.", result: "Control comercial", summary: "Resumen del documento", summaryNote: "Extractos del texto cargado", ready: "Lista para una revisión final", review: "Revisar antes de enviar", clear: "Claro", needsReview: "Revisar", legal: "No es asesoría legal ni determina la validez de un contrato.", live: "TypeSafe", demo: "Modo demo", error: "No se pudo analizar el documento.", checks: {
      scope: ["Alcance", "Confirma entregables, exclusiones y criterios de aceptación."],
      pricing: ["Precio y pago", "Confirma precio, calendario de cobro, descuentos y condiciones de pago."],
      timeline: ["Fechas", "Confirma fechas, dependencias y responsables."],
      nonStandardCommitment: ["Compromisos", "Pide aprobación antes de incluir garantías, soporte ilimitado, exclusividad o compromisos sin límite."],
    },
  },
  en: {
    back: "Home", badge: "Proposal review", title: <>Review before you <em>send.</em></>, lede: "A quick commercial check for service proposals.", label: "Upload the proposal", formats: "PDF, DOCX, or TXT · 25 MB maximum", choose: "Choose document", change: "Change document", analyzing: "Analyzing document…", autoReady: "Analysis starts when you upload it.", complete: "Analysis ready", private: "The file is used only for this analysis. We do not save it.", result: "Commercial check", summary: "Document summary", summaryNote: "Extracts from the uploaded text", ready: "Ready for a final review", review: "Review before sending", clear: "Clear", needsReview: "Review", legal: "This is not legal advice and does not determine contract validity.", live: "TypeSafe", demo: "Demo mode", error: "We could not analyze the document.", checks: {
      scope: ["Scope", "Confirm deliverables, exclusions, and acceptance criteria."],
      pricing: ["Pricing & payment", "Confirm price, billing schedule, discounts, and payment terms."],
      timeline: ["Timeline", "Confirm dates, dependencies, and owners."],
      nonStandardCommitment: ["Commitments", "Get approval before including guarantees, unlimited support, exclusivity, or uncapped commitments."],
    },
  },
} as const;

export default function ProposalsPage() {
  const [locale, setLocale] = useState<Locale>("es");
  const [document, setDocument] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const t = copy[locale];

  async function analyze(file: File) {
    setLoading(true); setError("");
    try {
      const form = new FormData(); form.append("document", file);
      const response = await fetch("/api/analyze-proposal", { method: "POST", body: form });
      const body = await response.json() as Analysis & { error?: string };
      if (!response.ok) throw new Error(body.error ?? t.error);
      setAnalysis(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
    finally { setLoading(false); }
  }

  return <main className="proposal-page"><header className="masthead"><a className="brand" href="/"><span>OBRA</span><i>β</i></a><span className="demo-tag">Módulo 02 · {t.badge}</span><a className="proposal-back" href="/">← {t.back}</a><button className="language" type="button" onClick={() => setLocale(locale === "es" ? "en" : "es")}>{locale === "es" ? "English" : "Español"}</button></header>
    <section className="proposal-hero"><p className="kicker"><span />{t.badge}</p><h1>{t.title}</h1><p>{t.lede}</p></section>
    <section className="proposal-workspace"><section className="proposal-editor"><div className="proposal-editor-head"><label htmlFor="proposal-document">{t.label}</label><span>{t.formats}</span></div><label className="document-drop" htmlFor="proposal-document"><input id="proposal-document" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => { const file = event.target.files?.[0] ?? null; setDocument(file); setAnalysis(null); if (file) void analyze(file); }} /><span className="document-icon" aria-hidden="true">↥</span><strong>{document ? document.name : t.choose}</strong><small>{document ? `${Math.ceil(document.size / 1024)} KB · ${t.change}` : t.formats}</small></label><div className="proposal-actions"><small>{t.private}</small><strong className="auto-status">{loading ? t.analyzing : analysis ? t.complete : t.autoReady}</strong></div>{error && <p className="error" role="alert">{error}</p>}</section>
      <aside className="proposal-results" aria-live="polite"><div className="proposal-results-head"><div><p>{t.result}</p><h2>{analysis ? (analysis.overallStatus === "review" ? t.review : t.ready) : t.ready}</h2></div>{analysis && <span className={analysis.source === "typesafe" ? "source live" : "source"}>{analysis.source === "typesafe" ? t.live : t.demo} · {analysis.responseLatencyMs} ms</span>}</div>{analysis && <section className="document-summary"><strong>{t.summary}</strong><small>{t.summaryNote}</small><ul>{analysis.summary.map((item) => <li key={item}>{item}</li>)}</ul></section>}<div className="proposal-checks">{(["scope", "pricing", "timeline", "nonStandardCommitment"] as FindingId[]).map((id) => { const finding = analysis?.findings.find((item) => item.id === id); const reviewing = finding?.status === "review"; const item = t.checks[id]; return <article className={reviewing ? "proposal-check review" : "proposal-check"} key={id}><div><span className="check-dot" aria-hidden="true" /> <strong>{item[0]}</strong></div><span>{reviewing ? t.needsReview : t.clear}</span>{reviewing && <p>{item[1]}</p>}</article>; })}</div><p className="proposal-legal">{t.legal}</p></aside></section>
  </main>;
}
