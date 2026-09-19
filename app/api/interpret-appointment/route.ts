import { noul, TypeSafeClient } from "@typesafe-ai/sdk";
import { NextResponse } from "next/server";
import { appointmentServices } from "../../lib/appointments";

const MATCH_THRESHOLD = 0.68;
const CANDIDATE_THRESHOLD = 0.42;
type ServiceId = (typeof appointmentServices)[number]["id"];

function dateFromMessage(message: string) {
  const text = message.toLowerCase();
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/\b(hoy|today)\b/.test(text)) return base.toISOString().slice(0, 10);
  if (/\b(mañana|manana|tomorrow)\b/.test(text)) { base.setDate(base.getDate() + 1); return base.toISOString().slice(0, 10); }
  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const months: Record<string, number> = { enero:0, febrero:1, marzo:2, abril:3, mayo:4, junio:5, julio:6, agosto:7, septiembre:8, setiembre:8, octubre:9, noviembre:10, diciembre:11, january:0, february:1, march:2, april:3, may:4, june:5, july:6, august:7, september:8, october:9, november:10, december:11 };
  const named = text.match(/\b(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)(?:\s+(?:de\s+)?(20\d{2}))?\b/);
  if (named && months[named[2]] !== undefined) return new Date(Number(named[3] ?? now.getFullYear()), months[named[2]], Number(named[1])).toISOString().slice(0, 10);
  const weekdays = ["domingo", "lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado"];
  const englishWeekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const target = weekdays.findIndex((day) => new RegExp(`\\b${day}\\b`).test(text));
  const english = englishWeekdays.findIndex((day) => new RegExp(`\\b${day}\\b`).test(text));
  const day = target >= 0 ? target : english;
  if (day >= 0) { const delta = (day - base.getDay() + 7) % 7 || 7; base.setDate(base.getDate() + delta); return base.toISOString().slice(0, 10); }
  return null;
}

function timeFromMessage(message: string) {
  const match = message.toLowerCase().match(/(?:\b(?:a las|para las|at|around)\s+)(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|am|pm)?|\b(\d{1,2}):(\d{2})\s*(am|pm)\b/);
  if (!match) return null;
  let hour = Number(match[1] ?? match[4]); const minute = Number(match[2] ?? match[5] ?? 0); const period = match[3] ?? match[6];
  if (period?.startsWith("p") && hour < 12) hour += 12;
  if (period?.startsWith("a") && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function response(matches: { serviceId: ServiceId; probability: number }[], message: string, source: "typesafe" | "demo", startedAt: number) {
  const selected = matches.filter((match) => match.probability >= CANDIDATE_THRESHOLD).sort((a, b) => b.probability - a.probability);
  const date = dateFromMessage(message); const time = timeFromMessage(message);
  return { matches: selected, date, time, needsService: !selected.some((match) => match.probability >= MATCH_THRESHOLD), needsDate: !date, needsTime: !time, source, responseLatencyMs: Math.round(performance.now() - startedAt) };
}

function fallback(message: string, startedAt: number) {
  const text = message.toLowerCase();
  return response(appointmentServices.map((service) => ({ serviceId: service.id, probability: service.keywords.some((keyword) => text.includes(keyword)) ? 0.88 : 0 })), message, "demo", startedAt);
}

export async function POST(request: Request) {
  const startedAt = performance.now(); const { message } = await request.json() as { message?: unknown };
  if (typeof message !== "string" || message.trim().length < 2 || message.length > 1000) return NextResponse.json({ error: "Write a message between 2 and 1000 characters." }, { status: 400 });
  if (!process.env.TYPESAFE_API_KEY) return NextResponse.json(fallback(message, startedAt));
  try {
    const questions = Object.fromEntries(appointmentServices.map((service) => [`service_${service.id}`, noul({ instructions: "Determine whether the customer wants to schedule this exact service. A request may match more than one service. Do not infer a service solely from a date, time, or business name.", criteria: { business: service.business, service: service.title, synonyms: service.keywords } })]));
    const client = new TypeSafeClient(); const result = await client.systemOne({ state: { customerMessage: message, purpose: "Select relevant services from a fixed appointment catalog. Dates and times are parsed by application code." }, questions });
    const answers = result.answers as unknown as Record<string, { noul?: number }>;
    return NextResponse.json(response(appointmentServices.map((service) => ({ serviceId: service.id, probability: Math.max(answers[`service_${service.id}`]?.noul ?? 0, service.keywords.some((keyword) => message.toLowerCase().includes(keyword)) ? 0.88 : 0) })), message, "typesafe", startedAt));
  } catch (error) { console.error("Appointment interpretation failed", error); return NextResponse.json(fallback(message, startedAt)); }
}
