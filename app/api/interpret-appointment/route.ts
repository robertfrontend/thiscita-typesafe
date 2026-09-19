import { noul, TypeSafeClient } from "@typesafe-ai/sdk";
import { NextResponse } from "next/server";
import { appointmentServices } from "../../lib/appointments";

const MATCH_THRESHOLD = 0.68;
const CANDIDATE_THRESHOLD = 0.42;
type ServiceId = (typeof appointmentServices)[number]["id"];
type CurrentAppointment = { serviceIds: ServiceId[]; date: string | null; time: string | null };

const correctionPattern = /\b(cambia(?:r|lo|la)?|cambio|mejor|en vez de|en lugar de|prefiero|actually|instead|change|replace)\b/i;

function dateFromMessage(message: string) {
  const text = message.toLowerCase();
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const candidates: { index: number; value: string }[] = [];
  for (const match of text.matchAll(/\b(hoy|today|mañana|manana|tomorrow)\b/g)) {
    const value = new Date(base); if (!/hoy|today/.test(match[1])) value.setDate(value.getDate() + 1);
    candidates.push({ index: match.index, value: value.toISOString().slice(0, 10) });
  }
  for (const match of text.matchAll(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g)) candidates.push({ index: match.index, value: `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` });
  const months: Record<string, number> = { enero:0, febrero:1, marzo:2, abril:3, mayo:4, junio:5, julio:6, agosto:7, septiembre:8, setiembre:8, octubre:9, noviembre:10, diciembre:11, january:0, february:1, march:2, april:3, may:4, june:5, july:6, august:7, september:8, october:9, november:10, december:11 };
  for (const match of text.matchAll(/\b(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)(?:\s+(?:de\s+)?(20\d{2}))?\b/g)) {
    if (months[match[2]] !== undefined) candidates.push({ index: match.index, value: new Date(Number(match[3] ?? now.getFullYear()), months[match[2]], Number(match[1])).toISOString().slice(0, 10) });
  }
  const weekdayNumbers: Record<string, number> = { domingo:0, sunday:0, lunes:1, monday:1, martes:2, tuesday:2, miércoles:3, miercoles:3, wednesday:3, jueves:4, thursday:4, viernes:5, friday:5, sábado:6, sabado:6, saturday:6 };
  Object.entries(weekdayNumbers).forEach(([name, day]) => {
    for (const match of text.matchAll(new RegExp(`\\b${name}\\b`, "g"))) {
      const value = new Date(base); const delta = (day - value.getDay() + 7) % 7 || 7; value.setDate(value.getDate() + delta);
      candidates.push({ index: match.index, value: value.toISOString().slice(0, 10) });
    }
  });
  return candidates.sort((a, b) => b.index - a.index)[0]?.value ?? null;
}

function timeFromMessage(message: string) {
  const matches = [...message.toLowerCase().matchAll(/(?:\b(?:a las|para las|at|around)\s+)(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|am|pm)?|\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/g)];
  const match = matches.at(-1); if (!match) return null;
  let hour = Number(match[1] ?? match[4]); const minute = Number(match[2] ?? match[5] ?? 0); const period = match[3] ?? match[6];
  if (period?.startsWith("p") && hour < 12) hour += 12;
  if (period?.startsWith("a") && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function response(matches: { serviceId: ServiceId; probability: number }[], message: string, source: "typesafe" | "demo", startedAt: number, current: CurrentAppointment, replaceServices: boolean) {
  let selected = matches.filter((match) => match.probability >= CANDIDATE_THRESHOLD).sort((a, b) => b.probability - a.probability);
  if (replaceServices) { const replacements = selected.filter((match) => !current.serviceIds.includes(match.serviceId)); if (replacements.length) selected = replacements; }
  const date = dateFromMessage(message); const time = timeFromMessage(message);
  return { matches: selected, date, time, replaceServices, needsService: !selected.some((match) => match.probability >= MATCH_THRESHOLD) && !current.serviceIds.length, needsDate: !date && !current.date, needsTime: !time && !current.time, source, responseLatencyMs: Math.round(performance.now() - startedAt) };
}

function fallback(message: string, startedAt: number, current: CurrentAppointment) {
  const text = message.toLowerCase();
  return response(appointmentServices.map((service) => ({ serviceId: service.id, probability: service.keywords.some((keyword) => text.includes(keyword)) ? 0.88 : 0 })), message, "demo", startedAt, current, correctionPattern.test(message));
}

export async function POST(request: Request) {
  const startedAt = performance.now(); const { message, current: rawCurrent } = await request.json() as { message?: unknown; current?: Partial<CurrentAppointment> };
  if (typeof message !== "string" || message.trim().length < 2 || message.length > 1000) return NextResponse.json({ error: "Write a message between 2 and 1000 characters." }, { status: 400 });
  const validIds = new Set<ServiceId>(appointmentServices.map((service) => service.id));
  const current: CurrentAppointment = { serviceIds: Array.isArray(rawCurrent?.serviceIds) ? rawCurrent.serviceIds.filter((id): id is ServiceId => typeof id === "string" && validIds.has(id as ServiceId)) : [], date: typeof rawCurrent?.date === "string" ? rawCurrent.date : null, time: typeof rawCurrent?.time === "string" ? rawCurrent.time : null };
  if (!process.env.TYPESAFE_API_KEY) return NextResponse.json(fallback(message, startedAt, current));
  try {
    const questions = Object.fromEntries([...appointmentServices.map((service) => [`service_${service.id}`, noul({ instructions: "Determine whether the customer's latest stated preference is to schedule this exact service. If they correct themselves, judge the final preference. A request may match more than one service only when the customer explicitly wants both. Do not infer a service solely from a date, time, or business name.", criteria: { business: service.business, service: service.title, synonyms: service.keywords } })]), ["replace_services", noul({ instructions: "Determine whether the customer is correcting or replacing a previously selected appointment service with a different service. Answer no when they are only changing the day or time, or explicitly adding another service.", criteria: { yes: "The selected service should be replaced", no: "Keep existing services or add another" } })]]);
    const currentServices = current.serviceIds.map((id) => { const service = appointmentServices.find((item) => item.id === id); return service ? `${service.business}: ${service.title}` : id; });
    const client = new TypeSafeClient(); const result = await client.systemOne({ state: { customerMessage: message, currentAppointment: { services: currentServices, date: current.date, time: current.time }, purpose: "Update a conversational appointment from the customer's latest instruction. Dates and times are parsed by application code." }, questions });
    const answers = result.answers as unknown as Record<string, { noul?: number }>;
    const replaceServices = (answers.replace_services?.noul ?? 0) >= 0.65 || correctionPattern.test(message);
    return NextResponse.json(response(appointmentServices.map((service) => ({ serviceId: service.id, probability: Math.max(answers[`service_${service.id}`]?.noul ?? 0, service.keywords.some((keyword) => message.toLowerCase().includes(keyword)) ? 0.88 : 0) })), message, "typesafe", startedAt, current, replaceServices));
  } catch (error) { console.error("Appointment interpretation failed", error); return NextResponse.json(fallback(message, startedAt, current)); }
}
