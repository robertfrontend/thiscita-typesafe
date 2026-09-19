import { noul, TypeSafeClient } from "@typesafe-ai/sdk";
import mammoth from "mammoth";
import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

const REVIEW_THRESHOLD = 0.72;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 90_000;
const supportedExtensions = ["pdf", "docx", "txt"];

export const runtime = "nodejs";

const checks = [
  { id: "scope", question: "Does the proposal leave the scope, deliverables, exclusions, or acceptance criteria unclear or missing? Mark yes only when the document itself creates a commercial review point; do not infer missing terms.", keywords: /\b(scope|deliverable|deliverables|acceptance|exclusion|alcance|entregable|entregables|exclusi[oó]n|criterio)\b/i },
  { id: "pricing", question: "Does the proposal contain pricing, discount, billing, or payment terms that are ambiguous or need a commercial review because the condition is unusual or incomplete? Do not judge whether the price is fair.", keywords: /\b(price|pricing|discount|payment|invoice|billing|precio|descuento|pago|factura|cobro)\b/i },
  { id: "timeline", question: "Does the proposal promise a deadline, launch, or timeline without a clear qualification, dependency, or owner? Do not infer a risk from any ordinary date.", keywords: /\b(deadline|launch|timeline|weeks?|days?|fecha|entrega|cronograma|semanas?|d[ií]as?)\b/i },
  { id: "nonStandardCommitment", question: "Does the proposal make an unusual or unbounded commercial commitment, such as a guaranteed outcome, unlimited support, free work, exclusivity, uncapped penalties, or liability? Do not provide legal advice.", keywords: /\b(guarantee|guaranteed|unlimited|free|exclusiv|penalt|liability|garantiz|ilimitad|gratis|exclusiv|penalid|responsabilidad)\b/i },
] as const;

type CheckId = (typeof checks)[number]["id"];
type Finding = { id: CheckId; probability: number; status: "clear" | "review" };

function documentSummary(proposal: string) {
  const blocks = proposal.split(/\n{2,}/).map((block) => block.replace(/\s+/g, " ").trim()).filter((block) => block.length >= 28);
  const candidates = (blocks.length > 1 ? blocks : proposal.split(/(?<=[.!?])\s+/)).map((block, index) => ({ text: block.replace(/\s+/g, " ").trim().slice(0, 240), index })).filter((block) => block.text.length >= 28);
  const terms = /\b(scope|deliverable|price|payment|timeline|launch|support|alcance|entregable|precio|pago|cronograma|entrega|soporte)\b/i;
  const ranked = candidates.map((candidate) => ({ ...candidate, score: (terms.test(candidate.text) ? 3 : 0) + (candidate.index === 0 ? 2 : 0) - candidate.index * 0.01 })).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 3).sort((a, b) => a.index - b.index);
  return ranked.map((candidate) => candidate.text);
}

function toResponse(probabilities: Record<CheckId, number>, source: "typesafe" | "demo", startedAt: number, summary: string[]) {
  const findings: Finding[] = checks.map((check) => {
    const probability = probabilities[check.id];
    return { id: check.id, probability, status: probability >= REVIEW_THRESHOLD ? "review" : "clear" };
  });
  return { findings, summary, overallStatus: findings.some((finding) => finding.status === "review") ? "review" : "ready", source, responseLatencyMs: Math.round(performance.now() - startedAt) };
}

function fallback(proposal: string, startedAt: number) {
  const hasQualifier = /\b(subject to|dependent on|pending|estimated|sujeto a|depende de|estimad[oa]|pendiente)\b/i.test(proposal);
  const probabilities = Object.fromEntries(checks.map((check) => {
    const hit = check.keywords.test(proposal);
    const incomplete = check.id === "scope" && /\b(tbd|to be defined|por definir|a definir)\b/i.test(proposal);
    const promise = check.id === "timeline" && /\b(guarantee|guaranteed|garantiz|must launch|debe estar listo)\b/i.test(proposal);
    const probability = check.id === "timeline" && hit && hasQualifier ? 0.22 : hit && (incomplete || promise) ? 0.88 : hit ? 0.34 : 0.08;
    return [check.id, probability];
  })) as Record<CheckId, number>;
  return toResponse(probabilities, "demo", startedAt, documentSummary(proposal));
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const form = await request.formData();
  const file = form.get("document");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF, DOCX, or TXT proposal." }, { status: 400 });
  if (file.size === 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Choose a document smaller than 25 MB." }, { status: 400 });
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!supportedExtensions.includes(extension)) return NextResponse.json({ error: "Supported formats: PDF, DOCX, and TXT." }, { status: 400 });

  let proposal = "";
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (extension === "txt") proposal = buffer.toString("utf8");
    if (extension === "docx") proposal = (await mammoth.extractRawText({ buffer })).value;
    if (extension === "pdf") {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try { proposal = (await parser.getText()).text; }
      finally { await parser.destroy(); }
    }
  } catch (error) {
    console.error("Proposal document extraction failed", error);
    return NextResponse.json({ error: "We could not read this document. Try a text-based PDF, DOCX, or TXT file." }, { status: 422 });
  }
  if (proposal.trim().length < 40 || proposal.length > MAX_EXTRACTED_CHARACTERS) return NextResponse.json({ error: "The document needs at least 40 readable characters and no more than 90,000." }, { status: 422 });
  if (!process.env.TYPESAFE_API_KEY) return NextResponse.json(fallback(proposal, startedAt));

  try {
    const client = new TypeSafeClient();
    const response = await client.systemOne({
      state: { proposal, purpose: "Commercial proposal pre-send review. This is not legal advice and must not determine contract validity." },
      questions: Object.fromEntries(checks.map((check) => [check.id, noul(check.question)])),
    });
    const answers = response.answers as unknown as Record<CheckId, { noul?: number }>;
    const probabilities = Object.fromEntries(checks.map((check) => [check.id, answers[check.id]?.noul ?? 0])) as Record<CheckId, number>;
    return NextResponse.json(toResponse(probabilities, "typesafe", startedAt, documentSummary(proposal)));
  } catch (error) {
    console.error("TypeSafe proposal analysis failed", error);
    return NextResponse.json(fallback(proposal, startedAt));
  }
}
