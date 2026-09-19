import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
import { NextResponse } from "next/server";
import { getService } from "../../lib/catalog";

function textFromHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 18000);
}

export async function POST(request: Request) {
  const { serviceId } = (await request.json()) as { serviceId?: unknown };
  if (typeof serviceId !== "string") return NextResponse.json({ error: "A serviceId is required." }, { status: 400 });
  const service = getService(serviceId);
  if (!service) return NextResponse.json({ error: "Unknown service." }, { status: 404 });
  if (!process.env.TYPESAFE_API_KEY) return NextResponse.json({ status: "review-needed", reason: "TypeSafe is not configured." }, { status: 503 });
  try {
    const sourceResponse = await fetch(service.officialUrl, { headers: { "User-Agent": "thiscita-catalog-review/1.0" } });
    const sourceText = textFromHtml(await sourceResponse.text());
    const client = new TypeSafeClient();
    const review = await client.systemOne({
      state: { officialSource: sourceText, curated: service.copy.en },
      questions: { alignment: choice("Does the curated title, summary, requirements, and next action stay within what the official source supports? Do not assess legal eligibility.", { verified: "The source supports the curated guidance.", "needs-review": "The source is missing, unclear, stale, or does not support one or more curated claims." }) },
    });
    return NextResponse.json({ serviceId, sourceUrl: service.officialUrl, status: review.answers.alignment.choice, confidence: review.answers.alignment.confidence });
  } catch {
    return NextResponse.json({ serviceId, status: "review-needed", reason: "The official source could not be checked." }, { status: 502 });
  }
}
