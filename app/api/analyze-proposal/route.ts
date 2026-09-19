import { noul, TypeSafeClient } from "@typesafe-ai/sdk";
import mammoth from "mammoth";
import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

const REVIEW_THRESHOLD = 0.68;
const COVERAGE_THRESHOLD = 0.68;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 90_000;
const supportedExtensions = ["pdf", "docx", "txt"];

export const runtime = "nodejs";

const checks = [
  {
    id: "scope",
    coverageQuestion:
      "Does `proposal` contain concrete scope information such as services, deliverables, work boundaries, exclusions, or acceptance criteria? Answer no when scope is absent or only described in vague promotional language.",
    riskQuestion:
      "Does the scope information in `proposal` contain ambiguity, undefined deliverables, conflicting boundaries, missing acceptance criteria, or another commercial issue that needs human review? Judge only the scope that is present.",
    coverageKeywords:
      /\b(scope|deliverable|deliverables|acceptance|exclusion|alcance|entregable|entregables|exclusi[oó]n|criterio)\b/i,
  },
  {
    id: "pricing",
    coverageQuestion:
      "Does `proposal` state concrete commercial pricing or payment information, such as a price, rate, fee, deposit, billing schedule, invoice timing, or payment terms? Answer no when all pricing and payment information is absent.",
    riskQuestion:
      "Does the pricing or payment information in `proposal` contain ambiguity, an incomplete condition, a conflicting amount, or an unusual term that needs human review? Do not judge whether the price is fair.",
    coverageKeywords:
      /(?:\$|€|£|\b(?:usd|eur|price|pricing|rate|fee|deposit|payment|invoice|billing|precio|tarifa|dep[oó]sito|pago|factura|cobro)\b)/i,
  },
  {
    id: "timeline",
    coverageQuestion:
      "Does `proposal` contain at least one explicit schedule term: a calendar date, deadline, duration, milestone, delivery window, or project phase with timing? Answer no when timing is entirely absent. Words such as delivery or launch without an actual date, duration, or time window do not count.",
    riskQuestion:
      "Does the schedule information in `proposal` contain an unclear or unconditional deadline, conflicting dates, a missing dependency for a promised date, or another timing issue that needs human review? Do not infer a problem merely because a normal date exists.",
    coverageKeywords:
      /(?:\b(?:deadline|timeline|weeks?|months?|days?|fecha|cronograma|semanas?|mes(?:es)?|d[ií]as?|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b)/i,
  },
  {
    id: "nonStandardCommitment",
    coverageQuestion: null,
    riskQuestion:
      "Does the proposal make an unusual or unbounded commercial commitment, such as a guaranteed outcome, unlimited support, free work, exclusivity, uncapped penalties, or liability? Do not provide legal advice.",
    coverageKeywords:
      /\b(guarantee|guaranteed|unlimited|free|exclusiv|penalt|liability|garantiz|ilimitad|gratis|exclusiv|penalid|responsabilidad)\b/i,
  },
] as const;

type CheckId = (typeof checks)[number]["id"];
type Finding = {
  id: CheckId;
  probability: number;
  coverageProbability: number | null;
  status: "clear" | "missing" | "review";
};

function documentSummary(proposal: string) {
  const blocks = proposal
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter((block) => block.length >= 28);
  const candidates = (
    blocks.length > 1 ? blocks : proposal.split(/(?<=[.!?])\s+/)
  )
    .map((block, index) => ({
      text: block.replace(/\s+/g, " ").trim().slice(0, 240),
      index,
    }))
    .filter((block) => block.text.length >= 28);
  const terms =
    /\b(scope|deliverable|price|payment|timeline|launch|support|alcance|entregable|precio|pago|cronograma|entrega|soporte)\b/i;
  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      score:
        (terms.test(candidate.text) ? 3 : 0) +
        (candidate.index === 0 ? 2 : 0) -
        candidate.index * 0.01,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .sort((a, b) => a.index - b.index);
  return ranked.map((candidate) => candidate.text);
}

function toResponse(
  riskProbabilities: Record<CheckId, number>,
  coverageProbabilities: Record<CheckId, number | null>,
  source: "typesafe" | "demo",
  startedAt: number,
  summary: string[],
) {
  const findings: Finding[] = checks.map((check) => {
    const probability = riskProbabilities[check.id];
    const coverageProbability = coverageProbabilities[check.id];
    const status =
      coverageProbability !== null && coverageProbability < COVERAGE_THRESHOLD
        ? "missing"
        : probability >= REVIEW_THRESHOLD
          ? "review"
          : "clear";
    return {
      id: check.id,
      probability,
      coverageProbability,
      status,
    };
  });
  return {
    findings,
    summary,
    overallStatus: findings.some((finding) => finding.status !== "clear")
      ? "review"
      : "ready",
    source,
    responseLatencyMs: Math.round(performance.now() - startedAt),
  };
}

function fallback(proposal: string, startedAt: number) {
  const hasQualifier =
    /\b(subject to|dependent on|pending|estimated|sujeto a|depende de|estimad[oa]|pendiente)\b/i.test(
      proposal,
    );
  const riskProbabilities = Object.fromEntries(
    checks.map((check) => {
      const hit = check.coverageKeywords.test(proposal);
      const incomplete =
        check.id === "scope" &&
        /\b(tbd|to be defined|por definir|a definir)\b/i.test(proposal);
      const promise =
        check.id === "timeline" &&
        /\b(guarantee|guaranteed|garantiz|must launch|debe estar listo)\b/i.test(
          proposal,
        );
      const unclearPricing =
        check.id === "pricing" &&
        /\b(tbd|to be agreed|to be defined|por acordar|por definir|a definir)\b/i.test(
          proposal,
        );
      const nonStandardCommitment = check.id === "nonStandardCommitment" && hit;
      const needsReview =
        incomplete || promise || unclearPricing || nonStandardCommitment;
      const probability =
        check.id === "timeline" && hit && hasQualifier
          ? 0.22
          : hit && needsReview
            ? 0.88
            : hit
              ? 0.34
              : 0.08;
      return [check.id, probability];
    }),
  ) as Record<CheckId, number>;
  const coverageProbabilities = Object.fromEntries(
    checks.map((check) => [
      check.id,
      check.coverageQuestion === null
        ? null
        : check.coverageKeywords.test(proposal)
          ? 0.92
          : 0.04,
    ]),
  ) as Record<CheckId, number | null>;
  return toResponse(
    riskProbabilities,
    coverageProbabilities,
    "demo",
    startedAt,
    documentSummary(proposal),
  );
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const form = await request.formData();
  const file = form.get("document");
  if (!(file instanceof File))
    return NextResponse.json(
      { error: "Choose a PDF, DOCX, or TXT proposal." },
      { status: 400 },
    );
  if (file.size === 0 || file.size > MAX_FILE_SIZE)
    return NextResponse.json(
      { error: "Choose a document smaller than 25 MB." },
      { status: 400 },
    );
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!supportedExtensions.includes(extension))
    return NextResponse.json(
      { error: "Supported formats: PDF, DOCX, and TXT." },
      { status: 400 },
    );

  let proposal = "";
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (extension === "txt") proposal = buffer.toString("utf8");
    if (extension === "docx")
      proposal = (await mammoth.extractRawText({ buffer })).value;
    if (extension === "pdf") {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        proposal = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    }
  } catch (error) {
    console.error("Proposal document extraction failed", error);
    return NextResponse.json(
      {
        error:
          "We could not read this document. Try a text-based PDF, DOCX, or TXT file.",
      },
      { status: 422 },
    );
  }
  if (proposal.trim().length < 40 || proposal.length > MAX_EXTRACTED_CHARACTERS)
    return NextResponse.json(
      {
        error:
          "The document needs at least 40 readable characters and no more than 90,000.",
      },
      { status: 422 },
    );
  if (!process.env.TYPESAFE_API_KEY)
    return NextResponse.json(fallback(proposal, startedAt));

  try {
    const client = new TypeSafeClient();
    const response = await client.systemOne({
      state: {
        proposal,
        purpose:
          "Commercial proposal pre-send review. This is not legal advice and must not determine contract validity.",
      },
      questions: Object.fromEntries(
        checks.flatMap((check) => {
          const questions: [string, ReturnType<typeof noul>][] = [
            [`${check.id}Risk`, noul(check.riskQuestion)],
          ];
          if (check.coverageQuestion)
            questions.push([
              `${check.id}Coverage`,
              noul(check.coverageQuestion),
            ]);
          return questions;
        }),
      ),
    });
    const answers = response.answers as unknown as Record<
      string,
      { noul?: number }
    >;
    const riskProbabilities = Object.fromEntries(
      checks.map((check) => [check.id, answers[`${check.id}Risk`]?.noul ?? 0]),
    ) as Record<CheckId, number>;
    const coverageProbabilities = Object.fromEntries(
      checks.map((check) => [
        check.id,
        check.coverageQuestion === null
          ? null
          : (answers[`${check.id}Coverage`]?.noul ?? 0),
      ]),
    ) as Record<CheckId, number | null>;
    return NextResponse.json(
      toResponse(
        riskProbabilities,
        coverageProbabilities,
        "typesafe",
        startedAt,
        documentSummary(proposal),
      ),
    );
  } catch (error) {
    console.error("TypeSafe proposal analysis failed", error);
    return NextResponse.json(fallback(proposal, startedAt));
  }
}
