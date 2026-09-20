export type Intent =
  "create" | "update" | "cancel" | "list" | "plan" | "unknown";
export type Priority = "low" | "medium" | "high";
export type Effort = "light" | "medium" | "deep";
export type Flexibility = "fixed" | "flexible";
export type PreparationKind =
  "none" | "documents" | "materials" | "review" | "travel";

export type AgendaEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  priority: Priority;
  effort?: Effort;
  flexibility?: Flexibility;
  preparationKind?: PreparationKind;
  preparationMinutes?: number;
  deadline?: string | null;
  dependsOnId?: string | null;
};

export type AgendaReply = {
  intent: Intent;
  intentProbability: number;
  intentProbabilities: Record<string, number>;
  targetEventId: string | null;
  targetProbability: number;
  title: string | null;
  date: string | null;
  time: string | null;
  timeAmbiguous: boolean;
  duration: number | null;
  priority: Priority | null;
  priorityProbability: number;
  preparationKind: PreparationKind;
  preparationMinutes: number;
  deadline: string | null;
  dependsOnId: string | null;
  needsClarification: boolean;
  source: "typesafe" | "demo";
  responseLatencyMs: number;
  usage: { input_tokens: number; output_tokens: number };
};

export type PlannedItem = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  duration: number;
  priority: Priority;
  effort: Effort;
  flexibility: Flexibility;
  preparationKind: PreparationKind;
  preparationMinutes: number;
  deadline: string | null;
  dependsOnId: string | null;
  confidence: number;
  conflict: string | null;
  needsReview: boolean;
};

export type PlanReply = {
  items: PlannedItem[];
  source: "typesafe" | "demo";
  responseLatencyMs: number;
  decisionCount: number;
  usage: { input_tokens: number; output_tokens: number };
};

export type ChatMessage = { role: "assistant" | "user"; text: string };
export type SessionResult = AgendaReply & { id: number; query: string };

export type SpeechRecognitionResultLike = ArrayLike<{ transcript: string }> & {
  isFinal: boolean;
};

export type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: () => void;
  onend: () => void;
  onresult: (event: {
    resultIndex: number;
    results: ArrayLike<SpeechRecognitionResultLike>;
  }) => void;
  onerror: (event: { error?: string }) => void;
  start: () => void;
  stop: () => void;
};

export type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
