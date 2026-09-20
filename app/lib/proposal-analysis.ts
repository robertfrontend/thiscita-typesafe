import type {
  EvidenceCandidate,
  EvidenceCandidates,
  FindingStatus,
  ProposalAnalysis,
  ProposalChange,
  ProposalChangeType,
  ProposalDimensionId,
} from "../proposals/types";
import { proposalDimensionIds } from "../proposals/types";

export const REVIEW_THRESHOLD = 0.68;
export const COVERAGE_THRESHOLD = 0.68;
export const MAX_ANALYSIS_CHARACTERS = 16_000;

export const proposalDimensions: Record<
  ProposalDimensionId,
  {
    weight: number;
    required: boolean;
    coverageQuestion: string | null;
    riskQuestion: string;
    evidenceQuestion: string;
    keywords: RegExp;
  }
> = {
  scope: {
    weight: 0.3,
    required: true,
    coverageQuestion:
      "Does `proposal` contain concrete scope information such as services, deliverables, work boundaries, exclusions, or acceptance criteria? Answer no when scope is absent or only described in vague promotional language.",
    riskQuestion:
      "Does the scope information in `proposal` contain ambiguity, undefined deliverables, conflicting boundaries, missing acceptance criteria, or another commercial issue that needs human review? Judge only the scope that is present.",
    evidenceQuestion:
      "Select the candidate containing the strongest direct evidence about scope, deliverables, exclusions, or acceptance criteria.",
    keywords:
      /\b(scope|service|services|deliverable|deliverables|acceptance|exclusion|work|alcance|servicio|servicios|entregable|entregables|exclusi[oó]n|trabajo|criterio)\b/i,
  },
  pricing: {
    weight: 0.3,
    required: true,
    coverageQuestion:
      "Does `proposal` state concrete commercial pricing or payment information, such as a price, rate, fee, deposit, billing schedule, invoice timing, or payment terms? Answer no when all pricing and payment information is absent.",
    riskQuestion:
      "Does the pricing or payment information in `proposal` contain ambiguity, an incomplete condition, a conflicting amount, or an unusual term that needs human review? Do not judge whether the price is fair.",
    evidenceQuestion:
      "Select the candidate containing the strongest direct evidence about price, fees, billing, or payment terms.",
    keywords:
      /(?:\$|€|£|\b(?:usd|eur|price|pricing|rate|fee|deposit|payment|invoice|billing|precio|tarifa|dep[oó]sito|pago|factura|cobro)\b)/i,
  },
  timeline: {
    weight: 0.25,
    required: true,
    coverageQuestion:
      "Does `proposal` contain at least one explicit schedule term: a calendar date, deadline, duration, milestone, delivery window, or project phase with timing? Answer no when timing is entirely absent. Words such as delivery or launch without an actual date, duration, or time window do not count.",
    riskQuestion:
      "Does the schedule information in `proposal` contain an unclear or unconditional deadline, conflicting dates, a missing dependency for a promised date, or another timing issue that needs human review? Do not infer a problem merely because a normal date exists.",
    evidenceQuestion:
      "Select the candidate containing the strongest direct evidence about dates, duration, milestones, deadlines, or delivery windows.",
    keywords:
      /(?:\b(?:deadline|timeline|milestone|weeks?|months?|days?|fecha|cronograma|hito|semanas?|mes(?:es)?|d[ií]as?|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b)/i,
  },
  nonStandardCommitment: {
    weight: 0.15,
    required: false,
    coverageQuestion: null,
    riskQuestion:
      "Does the proposal make an unusual or unbounded commercial commitment, such as a guaranteed outcome, unlimited support, free work, exclusivity, uncapped penalties, or liability? Do not provide legal advice.",
    evidenceQuestion:
      "Select the candidate containing the strongest direct evidence of an unusual or unbounded commercial commitment. Choose none when no such commitment appears.",
    keywords:
      /\b(guarantee|guaranteed|unlimited|free|exclusiv|penalt|liability|garantiz|ilimitad|gratis|exclusiv|penalid|responsabilidad)\b/i,
  },
};

const commercialSignals = new RegExp(
  proposalDimensionIds
    .map((id) => proposalDimensions[id].keywords.source)
    .join("|"),
  "i",
);

function exactSegments(proposal: string) {
  return proposal
    .replace(/\r\n/g, "\n")
    .split(/\n+|(?<=[.!?;])\s+/)
    .flatMap((segment) =>
      segment.length > 520
        ? (segment.match(/[\s\S]{1,520}(?:\s|$)/g) ?? [segment])
        : [segment],
    )
    .map((text) => text.trim())
    .filter((text) => text.length >= 20);
}

function edgeMatches(matches: string[], limit: number) {
  if (matches.length <= limit) return matches;
  const firstCount = Math.ceil(limit / 2);
  return [
    ...matches.slice(0, firstCount),
    ...matches.slice(-(limit - firstCount)),
  ];
}

export function createEvidenceCandidates(proposal: string): EvidenceCandidates {
  const segments = exactSegments(proposal);
  const general = edgeMatches(
    segments.filter((segment) => commercialSignals.test(segment)),
    4,
  );

  return Object.fromEntries(
    proposalDimensionIds.map((id) => {
      const direct = edgeMatches(
        segments.filter((segment) =>
          proposalDimensions[id].keywords.test(segment),
        ),
        6,
      );
      const selected = [
        ...new Set([...direct, ...general, ...segments.slice(0, 2)]),
      ].slice(0, 8);
      return [
        id,
        selected.map((text, index) => ({ id: `${id}_${index}`, text })),
      ];
    }),
  ) as EvidenceCandidates;
}

export function analysisExcerpt(
  proposal: string,
  candidates = createEvidenceCandidates(proposal),
) {
  const normalized = proposal
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (normalized.length <= MAX_ANALYSIS_CHARACTERS) return normalized;

  const segments = exactSegments(proposal);
  const evidence = new Set(
    proposalDimensionIds.flatMap((id) =>
      candidates[id].map((candidate) => candidate.text),
    ),
  );
  const selected = [
    ...segments.slice(0, 3),
    ...segments.filter((segment) => evidence.has(segment)),
    ...segments.slice(-2),
  ];
  let length = 0;
  const excerpts: string[] = [];
  for (const excerpt of new Set(selected)) {
    const remaining = MAX_ANALYSIS_CHARACTERS - length;
    if (remaining <= 0) break;
    excerpts.push(excerpt.slice(0, remaining));
    length += excerpt.length + 2;
  }
  return excerpts.join("\n\n");
}

export function documentSummary(proposal: string) {
  const candidates = exactSegments(proposal)
    .map((text, index) => ({
      text: text.replace(/\s+/g, " ").slice(0, 240),
      index,
      score: (commercialSignals.test(text) ? 3 : 0) + (index === 0 ? 2 : 0),
    }))
    .filter(({ text }) => text.length >= 28)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .sort((a, b) => a.index - b.index);
  return candidates.map(({ text }) => text);
}

export function findingStatus(
  riskProbability: number,
  coverageProbability: number | null,
): FindingStatus {
  if (coverageProbability !== null && coverageProbability < COVERAGE_THRESHOLD)
    return "missing";
  return riskProbability >= REVIEW_THRESHOLD ? "review" : "clear";
}

export function findingScore(
  status: FindingStatus,
  riskProbability: number,
  coverageProbability: number | null,
) {
  const raw = Math.round(
    100 *
      (coverageProbability === null
        ? 1 - riskProbability
        : coverageProbability * (1 - riskProbability)),
  );
  if (status === "missing") return Math.min(raw, 49);
  if (status === "review") return Math.min(raw, 69);
  return Math.max(raw, 70);
}

function evidenceFor(
  id: ProposalDimensionId,
  status: FindingStatus,
  selectedId: string | undefined,
  candidates: EvidenceCandidate[],
) {
  if (status === "missing") return null;
  const selected = candidates.find((candidate) => candidate.id === selectedId);
  if (selected) return { candidateId: selected.id, text: selected.text };
  if (!proposalDimensions[id].required && status === "clear") return null;
  const fallback = candidates.find((candidate) =>
    proposalDimensions[id].keywords.test(candidate.text),
  );
  return fallback ? { candidateId: fallback.id, text: fallback.text } : null;
}

export function buildProposalAnalysis(args: {
  fileName: string;
  proposal: string;
  riskProbabilities: Record<ProposalDimensionId, number>;
  coverageProbabilities: Record<ProposalDimensionId, number | null>;
  selectedEvidence: Partial<Record<ProposalDimensionId, string>>;
  candidates: EvidenceCandidates;
}): ProposalAnalysis {
  const findings = proposalDimensionIds.map((id) => {
    const riskProbability = args.riskProbabilities[id];
    const coverageProbability = args.coverageProbabilities[id];
    const status = findingStatus(riskProbability, coverageProbability);
    return {
      id,
      riskProbability,
      coverageProbability,
      status,
      score: findingScore(status, riskProbability, coverageProbability),
      evidence: evidenceFor(
        id,
        status,
        args.selectedEvidence[id],
        args.candidates[id],
      ),
    };
  });
  const readinessScore = Math.round(
    findings.reduce(
      (total, finding) =>
        total + finding.score * proposalDimensions[finding.id].weight,
      0,
    ),
  );
  return {
    fileName: args.fileName,
    findings,
    summary: documentSummary(args.proposal),
    overallStatus: findings.some((finding) => finding.status !== "clear")
      ? "review"
      : "ready",
    readinessScore,
  };
}

export function fallbackAnalysis(
  proposal: string,
  fileName: string,
): ProposalAnalysis {
  const hasQualifier =
    /\b(subject to|dependent on|pending|estimated|sujeto a|depende de|estimad[oa]|pendiente)\b/i.test(
      proposal,
    );
  const riskProbabilities = Object.fromEntries(
    proposalDimensionIds.map((id) => {
      const hit = proposalDimensions[id].keywords.test(proposal);
      const incomplete =
        id === "scope" &&
        /\b(tbd|to be defined|por definir|a definir)\b/i.test(proposal);
      const promise =
        id === "timeline" &&
        /\b(guarantee|guaranteed|garantiz|must launch|debe estar listo)\b/i.test(
          proposal,
        );
      const unclearPricing =
        id === "pricing" &&
        /\b(tbd|to be agreed|to be defined|por acordar|por definir|a definir)\b/i.test(
          proposal,
        );
      const nonStandard = id === "nonStandardCommitment" && hit;
      const risk = incomplete || promise || unclearPricing || nonStandard;
      const probability =
        id === "timeline" && hit && hasQualifier
          ? 0.22
          : hit && risk
            ? 0.88
            : hit
              ? 0.34
              : 0.08;
      return [id, probability];
    }),
  ) as Record<ProposalDimensionId, number>;
  const coverageProbabilities = Object.fromEntries(
    proposalDimensionIds.map((id) => [
      id,
      proposalDimensions[id].required
        ? proposalDimensions[id].keywords.test(proposal)
          ? 0.92
          : 0.04
        : null,
    ]),
  ) as Record<ProposalDimensionId, number | null>;
  const candidates = createEvidenceCandidates(proposal);
  const selectedEvidence = Object.fromEntries(
    proposalDimensionIds.map((id) => [
      id,
      candidates[id].find((candidate) =>
        proposalDimensions[id].keywords.test(candidate.text),
      )?.id,
    ]),
  );
  return buildProposalAnalysis({
    fileName,
    proposal,
    riskProbabilities,
    coverageProbabilities,
    selectedEvidence,
    candidates,
  });
}

function normalizedEvidence(
  analysis: ProposalAnalysis,
  id: ProposalDimensionId,
) {
  return (
    analysis.findings.find((finding) => finding.id === id)?.evidence?.text ?? ""
  )
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function fallbackChanges(
  baseline: ProposalAnalysis,
  revision: ProposalAnalysis,
): ProposalChange[] {
  return proposalDimensionIds.map((id) => {
    const before = baseline.findings.find((finding) => finding.id === id)!;
    const after = revision.findings.find((finding) => finding.id === id)!;
    let type: ProposalChangeType = "modified";
    if (before.status === "missing" && after.status !== "missing")
      type = "added";
    else if (before.status !== "missing" && after.status === "missing")
      type = "removed";
    else if (
      before.status === after.status &&
      normalizedEvidence(baseline, id) === normalizedEvidence(revision, id)
    )
      type = "unchanged";
    return { id, type, confidence: 0.76 };
  });
}
