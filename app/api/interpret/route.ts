import { noul, TypeSafeClient } from "@typesafe-ai/sdk";
import { NextResponse } from "next/server";
import { services } from "../../lib/catalog";

const MATCH_THRESHOLD = 0.72;
const CANDIDATE_THRESHOLD = 0.38;
type ServiceId = (typeof services)[number]["id"];
type Match = { serviceId: ServiceId; probability: number };
type Navigation = { matches: Match[]; primaryServiceId: ServiceId | "none"; needsClarification: boolean; source: "typesafe" | "demo"; responseLatencyMs: number };

function makeNavigation(rawMatches: Match[], source: Navigation["source"], startedAt: number): Navigation {
  const matches = rawMatches.filter((match) => match.probability >= CANDIDATE_THRESHOLD).sort((a, b) => b.probability - a.probability);
  const primaryServiceId = matches.find((match) => match.probability >= MATCH_THRESHOLD)?.serviceId ?? "none";
  return { matches, primaryServiceId, needsClarification: primaryServiceId === "none", source, responseLatencyMs: Math.round(performance.now() - startedAt) };
}

function fallback(message: string, startedAt: number) {
  const text = message.toLocaleLowerCase();
  const rawMatches = services.map((service) => {
    const phraseHits = service.keywords.filter((keyword) => text.includes(keyword)).length;
    return { serviceId: service.id, probability: phraseHits ? Math.min(0.96, 0.78 + phraseHits * 0.08) : 0 };
  });
  return makeNavigation(rawMatches, "demo", startedAt);
}

function keywordProbability(message: string, service: (typeof services)[number]) {
  const text = message.toLocaleLowerCase();
  const exactHits = service.keywords.filter((keyword) => text.includes(keyword)).length;
  return exactHits ? Math.min(0.96, 0.78 + exactHits * 0.08) : 0;
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const { message } = (await request.json()) as { message?: unknown };
  if (typeof message !== "string" || message.trim().length < 4 || message.length > 1200) return NextResponse.json({ error: "Write a request between 4 and 1200 characters." }, { status: 400 });
  if (!process.env.TYPESAFE_API_KEY) return NextResponse.json(fallback(message, startedAt));

  try {
    const questions = Object.fromEntries(services.map((service) => [
      `service_${service.id}`,
      noul({
        instructions: "Determine whether the resident is asking for this exact government service. Answer yes only for this service; do not infer eligibility, documents, fees, or a different service. A request may match more than one service.",
        criteria: { service: `${service.copy.en.title} / ${service.copy.es.title}. ${service.copy.en.summary}` },
      }),
    ]));
    const client = new TypeSafeClient();
    const response = await client.systemOne({ state: { residentMessage: message, scope: "Boston resident navigating a fixed Massachusetts and federal government service catalog" }, questions });
    const answers = response.answers as Record<string, { noul?: number }>;
    const matches = services.map((service) => ({
      serviceId: service.id,
      // Exact curated phrasing is a deterministic safety net for a plainly stated route;
      // TypeSafe still supplies the semantic judgment for all natural-language variants.
      probability: Math.max(answers[`service_${service.id}`]?.noul ?? 0, keywordProbability(message, service)),
    }));
    return NextResponse.json(makeNavigation(matches, "typesafe", startedAt));
  } catch (error) {
    console.error("TypeSafe service navigation failed", error);
    return NextResponse.json(fallback(message, startedAt));
  }
}
