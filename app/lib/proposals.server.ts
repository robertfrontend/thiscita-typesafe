import "server-only";

import { choice, noul, TypeSafeClient } from "@typesafe-ai/sdk";
import type { Questions } from "@typesafe-ai/sdk";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import {
  analysisExcerpt,
  buildProposalAnalysis,
  createEvidenceCandidates,
  fallbackAnalysis,
  fallbackChanges,
  proposalDimensions,
} from "./proposal-analysis";
import type {
  ComparisonProposalResponse,
  EvidenceCandidates,
  ProposalAnalysis,
  ProposalChange,
  ProposalChangeType,
  ProposalDimensionId,
  ProposalResponse,
  SingleProposalResponse,
} from "../proposals/types";
import { proposalDimensionIds } from "../proposals/types";

export const MAX_PROPOSAL_FILE_SIZE = 25 * 1024 * 1024;
export const MAX_PROPOSAL_CHARACTERS = 90_000;

const supportedExtensions = ["pdf", "docx", "txt"];

type ExtractedProposal = {
  fileName: string;
  text: string;
};

type PreparedProposal = ExtractedProposal & {
  excerpt: string;
  candidates: EvidenceCandidates;
};

type GenericAnswer = {
  noul?: number;
  choice?: string;
  confidence?: number;
};

export class ProposalDocumentError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function validateFile(file: File, label: string) {
  if (file.size === 0 || file.size > MAX_PROPOSAL_FILE_SIZE)
    throw new ProposalDocumentError(
      `${label} must be smaller than 25 MB.`,
      400,
    );
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!supportedExtensions.includes(extension))
    throw new ProposalDocumentError(
      `${label} must be a PDF, DOCX, or TXT document.`,
      400,
    );
  return extension;
}

export async function extractProposalFile(
  file: File,
  label: string,
): Promise<ExtractedProposal> {
  const extension = validateFile(file, label);
  let text = "";
  try {
    // Extraction happens in memory. Uploaded documents are never written to disk.
    const buffer = Buffer.from(await file.arrayBuffer());
    if (extension === "txt") text = buffer.toString("utf8");
    if (extension === "docx")
      text = (await mammoth.extractRawText({ buffer })).value;
    if (extension === "pdf") {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        text = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    }
  } catch (error) {
    console.error("Proposal document extraction failed", error);
    throw new ProposalDocumentError(
      `${label} could not be read. Try a text-based PDF, DOCX, or TXT file.`,
      422,
    );
  }
  const trimmed = text.trim();
  if (trimmed.length < 40 || trimmed.length > MAX_PROPOSAL_CHARACTERS)
    throw new ProposalDocumentError(
      `${label} needs between 40 and 90,000 readable characters.`,
      422,
    );
  return { fileName: file.name, text: trimmed };
}

function prepareProposal(proposal: ExtractedProposal): PreparedProposal {
  const candidates = createEvidenceCandidates(proposal.text);
  return {
    ...proposal,
    candidates,
    excerpt: analysisExcerpt(proposal.text, candidates),
  };
}

function evidenceCriteria(candidates: EvidenceCandidates[ProposalDimensionId]) {
  return Object.fromEntries([
    ["none", "No candidate contains direct evidence for this dimension."],
    ...candidates.map((candidate) => [
      candidate.id,
      `The candidate with id ${candidate.id} in the document's evidenceCandidates state.`,
    ]),
  ]);
}

function analysisQuestions(
  prefix: "baseline" | "revision",
  candidates: EvidenceCandidates,
) {
  const questions: Questions = {};
  for (const id of proposalDimensionIds) {
    const dimension = proposalDimensions[id];
    const proposalPath = `\`${prefix}.proposal\``;
    questions[`${prefix}_${id}Risk`] = noul(
      dimension.riskQuestion.replaceAll("`proposal`", proposalPath),
    );
    if (dimension.coverageQuestion)
      questions[`${prefix}_${id}Coverage`] = noul(
        dimension.coverageQuestion.replaceAll("`proposal`", proposalPath),
      );
    questions[`${prefix}_${id}Evidence`] = choice(
      `${dimension.evidenceQuestion} Read the exact candidate texts in \`${prefix}.evidenceCandidates.${id}\`. Return none when no candidate directly supports the finding; never invent or paraphrase evidence.`,
      evidenceCriteria(candidates[id]),
    );
  }
  return questions;
}

const changeCriteria = {
  unchanged: "The material terms for this dimension are equivalent.",
  added:
    "Meaningful information for this dimension is absent in the baseline and present in the revision.",
  removed:
    "Meaningful information for this dimension is present in the baseline and absent in the revision.",
  modified:
    "Both versions cover this dimension, but one or more material terms changed.",
  unclear: "The available text is insufficient to classify the change safely.",
};

function comparisonQuestions() {
  return Object.fromEntries(
    proposalDimensionIds.map((id) => [
      `change_${id}`,
      choice(
        `Compare only the ${id} terms in \`baseline.proposal\` and \`revision.proposal\`. Classify the material change between these two versions. Do not treat wording-only edits as modified.`,
        changeCriteria,
      ),
    ]),
  ) as Questions;
}

function analysisFromAnswers(
  proposal: PreparedProposal,
  prefix: "baseline" | "revision",
  answers: Record<string, GenericAnswer>,
): ProposalAnalysis {
  const riskProbabilities = Object.fromEntries(
    proposalDimensionIds.map((id) => [
      id,
      answers[`${prefix}_${id}Risk`]?.noul ?? 0,
    ]),
  ) as Record<ProposalDimensionId, number>;
  const coverageProbabilities = Object.fromEntries(
    proposalDimensionIds.map((id) => [
      id,
      proposalDimensions[id].required
        ? (answers[`${prefix}_${id}Coverage`]?.noul ?? 0)
        : null,
    ]),
  ) as Record<ProposalDimensionId, number | null>;
  const selectedEvidence = Object.fromEntries(
    proposalDimensionIds.map((id) => [
      id,
      answers[`${prefix}_${id}Evidence`]?.choice,
    ]),
  );
  return buildProposalAnalysis({
    fileName: proposal.fileName,
    proposal: proposal.text,
    riskProbabilities,
    coverageProbabilities,
    selectedEvidence,
    candidates: proposal.candidates,
  });
}

function changesFromAnswers(answers: Record<string, GenericAnswer>) {
  return proposalDimensionIds.map((id): ProposalChange => {
    const answer = answers[`change_${id}`];
    const selected = answer?.choice;
    const type: ProposalChangeType =
      selected === "unchanged" ||
      selected === "added" ||
      selected === "removed" ||
      selected === "modified" ||
      selected === "unclear"
        ? selected
        : "unclear";
    return { id, type, confidence: answer?.confidence ?? 0 };
  });
}

function demoResponse(
  baseline: PreparedProposal,
  revision: PreparedProposal | null,
  startedAt: number,
): ProposalResponse {
  const baselineAnalysis = fallbackAnalysis(baseline.text, baseline.fileName);
  const meta = {
    source: "demo" as const,
    responseLatencyMs: Math.round(performance.now() - startedAt),
    usage: { input_tokens: 0, output_tokens: 0 },
  };
  if (!revision)
    return {
      mode: "single",
      analysis: baselineAnalysis,
      ...meta,
    } satisfies SingleProposalResponse;
  const revisionAnalysis = fallbackAnalysis(revision.text, revision.fileName);
  return {
    mode: "comparison",
    baseline: baselineAnalysis,
    revision: revisionAnalysis,
    changes: fallbackChanges(baselineAnalysis, revisionAnalysis),
    readinessDelta:
      revisionAnalysis.readinessScore - baselineAnalysis.readinessScore,
    ...meta,
  } satisfies ComparisonProposalResponse;
}

export async function analyzeProposalDocuments(args: {
  baseline: ExtractedProposal;
  revision: ExtractedProposal | null;
  signal: AbortSignal;
  startedAt: number;
}): Promise<ProposalResponse> {
  const baseline = prepareProposal(args.baseline);
  const revision = args.revision ? prepareProposal(args.revision) : null;
  if (!process.env.TYPESAFE_API_KEY)
    return demoResponse(baseline, revision, args.startedAt);

  try {
    const questions: Questions = {
      ...analysisQuestions("baseline", baseline.candidates),
      ...(revision
        ? {
            ...analysisQuestions("revision", revision.candidates),
            ...comparisonQuestions(),
          }
        : {}),
    };
    const client = new TypeSafeClient();
    // Independent judgments share one request so comparison does not introduce a
    // sequence of network round trips.
    const result = await client.systemOne(
      {
        state: {
          baseline: {
            fileName: baseline.fileName,
            proposal: baseline.excerpt,
            evidenceCandidates: baseline.candidates,
            fullDocumentCharacterCount: baseline.text.length,
          },
          revision: revision
            ? {
                fileName: revision.fileName,
                proposal: revision.excerpt,
                evidenceCandidates: revision.candidates,
                fullDocumentCharacterCount: revision.text.length,
              }
            : null,
          purpose:
            "Commercial proposal pre-send review and version comparison. Evidence must be copied from the supplied candidates. This is not legal advice.",
        },
        questions,
      },
      { signal: args.signal },
    );
    const answers = result.answers as Record<string, GenericAnswer>;
    const baselineAnalysis = analysisFromAnswers(baseline, "baseline", answers);
    const meta = {
      source: "typesafe" as const,
      responseLatencyMs: Math.round(performance.now() - args.startedAt),
      usage: result.usage,
    };
    if (!revision)
      return {
        mode: "single",
        analysis: baselineAnalysis,
        ...meta,
      } satisfies SingleProposalResponse;
    const revisionAnalysis = analysisFromAnswers(revision, "revision", answers);
    return {
      mode: "comparison",
      baseline: baselineAnalysis,
      revision: revisionAnalysis,
      changes: changesFromAnswers(answers),
      readinessDelta:
        revisionAnalysis.readinessScore - baselineAnalysis.readinessScore,
      ...meta,
    } satisfies ComparisonProposalResponse;
  } catch (error) {
    if (args.signal.aborted) throw error;
    console.error("TypeSafe proposal analysis failed", error);
    return demoResponse(baseline, revision, args.startedAt);
  }
}
