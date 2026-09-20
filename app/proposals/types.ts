export const proposalDimensionIds = [
  "scope",
  "pricing",
  "timeline",
  "nonStandardCommitment",
] as const;

export type ProposalDimensionId = (typeof proposalDimensionIds)[number];
export type FindingStatus = "clear" | "missing" | "review";
export type ProposalChangeType =
  "unchanged" | "added" | "removed" | "modified" | "unclear";
export type ProposalSource = "typesafe" | "demo";

export type ProposalEvidence = {
  candidateId: string;
  text: string;
};

export type ProposalFinding = {
  id: ProposalDimensionId;
  riskProbability: number;
  coverageProbability: number | null;
  status: FindingStatus;
  score: number;
  evidence: ProposalEvidence | null;
};

export type ProposalAnalysis = {
  fileName: string;
  findings: ProposalFinding[];
  summary: string[];
  overallStatus: "ready" | "review";
  readinessScore: number;
};

export type ProposalChange = {
  id: ProposalDimensionId;
  type: ProposalChangeType;
  confidence: number;
};

export type ProposalUsage = {
  input_tokens: number;
  output_tokens: number;
};

type ProposalResponseMeta = {
  source: ProposalSource;
  responseLatencyMs: number;
  usage: ProposalUsage;
};

export type SingleProposalResponse = ProposalResponseMeta & {
  mode: "single";
  analysis: ProposalAnalysis;
};

export type ComparisonProposalResponse = ProposalResponseMeta & {
  mode: "comparison";
  baseline: ProposalAnalysis;
  revision: ProposalAnalysis;
  changes: ProposalChange[];
  readinessDelta: number;
};

export type ProposalResponse =
  SingleProposalResponse | ComparisonProposalResponse;

export type EvidenceCandidate = {
  id: string;
  text: string;
};

export type EvidenceCandidates = Record<
  ProposalDimensionId,
  EvidenceCandidate[]
>;
