import { choice, noul, TypeSafeClient } from "@typesafe-ai/sdk";
import { NextResponse } from "next/server";
import { services } from "../../lib/catalog";

const MATCH_THRESHOLD = 0.72;
const CANDIDATE_THRESHOLD = 0.38;
type ServiceId = (typeof services)[number]["id"];
type Match = { serviceId: ServiceId; probability: number };
type Clarification = "passport" | "license" | "vehicle" | null;
type Navigation = {
  matches: Match[];
  primaryServiceId: ServiceId | "none";
  needsClarification: boolean;
  clarification: Clarification;
  urgency: boolean;
  source: "typesafe" | "demo";
  responseLatencyMs: number;
};

function urgentLanguage(message: string) {
  return /\b(hoy|mañana|manana|urgente|vence|viajo|today|tomorrow|urgent|expires|travel)\b/i.test(
    message,
  );
}
function clarificationFor(message: string): Clarification {
  const text = message.toLocaleLowerCase();
  return /pasaporte|passport/.test(text)
    ? "passport"
    : /licencia|license|permiso/.test(text)
      ? "license"
      : /veh[ií]culo|vehicle|registro|registration/.test(text)
        ? "vehicle"
        : null;
}

function makeNavigation(
  rawMatches: Match[],
  source: Navigation["source"],
  startedAt: number,
  message: string,
  urgency = urgentLanguage(message),
  clarification = clarificationFor(message),
): Navigation {
  // Candidate and primary thresholds are intentionally separate: uncertain matches
  // may be shown as suggestions without claiming that one route is definitive.
  const matches = rawMatches
    .filter((match) => match.probability >= CANDIDATE_THRESHOLD)
    .sort((a, b) => b.probability - a.probability);
  const primaryServiceId =
    matches.find((match) => match.probability >= MATCH_THRESHOLD)?.serviceId ??
    "none";
  return {
    matches,
    primaryServiceId,
    needsClarification: primaryServiceId === "none",
    clarification: primaryServiceId === "none" ? clarification : null,
    urgency,
    source,
    responseLatencyMs: Math.round(performance.now() - startedAt),
  };
}

function fallback(message: string, startedAt: number) {
  const text = message.toLocaleLowerCase();
  const rawMatches = services.map((service) => {
    const phraseHits = service.keywords.filter((keyword) =>
      text.includes(keyword),
    ).length;
    return {
      serviceId: service.id,
      probability: phraseHits ? Math.min(0.96, 0.78 + phraseHits * 0.08) : 0,
    };
  });
  return makeNavigation(rawMatches, "demo", startedAt, message);
}

function keywordProbability(
  message: string,
  service: (typeof services)[number],
) {
  const text = message.toLocaleLowerCase();
  const exactHits = service.keywords.filter((keyword) =>
    text.includes(keyword),
  ).length;
  return exactHits ? Math.min(0.96, 0.78 + exactHits * 0.08) : 0;
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const { message } = (await request.json()) as { message?: unknown };
  if (
    typeof message !== "string" ||
    message.trim().length < 4 ||
    message.length > 1200
  )
    return NextResponse.json(
      { error: "Write a request between 4 and 1200 characters." },
      { status: 400 },
    );
  if (!process.env.TYPESAFE_API_KEY)
    return NextResponse.json(fallback(message, startedAt));

  try {
    // One independent Noul per catalog entry allows multi-service requests without
    // forcing all services into a mutually exclusive classification.
    const questions = Object.fromEntries(
      services.map((service) => [
        `service_${service.id}`,
        noul({
          instructions:
            "Determine whether the resident is asking for this exact government service. Answer yes only for this service; do not infer eligibility, documents, fees, or a different service. A request may match more than one service.",
          criteria: {
            service: `${service.copy.en.title} / ${service.copy.es.title}. ${service.copy.en.summary}`,
          },
        }),
      ]),
    );
    const client = new TypeSafeClient();
    const response = await client.systemOne({
      state: {
        residentMessage: message,
        scope:
          "Boston resident navigating a fixed Massachusetts and federal government service catalog",
      },
      questions: {
        ...questions,
        urgency: noul(
          "Does the resident explicitly indicate a near-term deadline or urgent timing? Do not infer urgency from the service alone.",
        ),
        clarification: choice(
          "Which one clarification topic would best disambiguate this request only if it is unclear? Choose none when a route is clear.",
          {
            passport: "Whether the passport request is first-time or renewal.",
            license:
              "Whether the driver credential request is a first application, renewal, or replacement.",
            vehicle:
              "Whether vehicle registration is a first registration or renewal.",
            none: "The request is already clear or another clarification would be needed.",
          },
        ),
      },
    });
    const answers = response.answers as Record<
      string,
      { noul?: number; choice?: string }
    >;
    const matches = services.map((service) => ({
      serviceId: service.id,
      // Exact curated phrasing is a deterministic safety net for a plainly stated route;
      // TypeSafe still supplies the semantic judgment for all natural-language variants.
      probability: Math.max(
        answers[`service_${service.id}`]?.noul ?? 0,
        keywordProbability(message, service),
      ),
    }));
    const candidateClarification = answers.clarification?.choice;
    const clarification =
      candidateClarification === "passport" ||
      candidateClarification === "license" ||
      candidateClarification === "vehicle"
        ? candidateClarification
        : clarificationFor(message);
    return NextResponse.json(
      makeNavigation(
        matches,
        "typesafe",
        startedAt,
        message,
        Math.max(
          answers.urgency?.noul ?? 0,
          urgentLanguage(message) ? 0.9 : 0,
        ) >= 0.72,
        clarification,
      ),
    );
  } catch (error) {
    console.error("TypeSafe service navigation failed", error);
    return NextResponse.json(fallback(message, startedAt));
  }
}
