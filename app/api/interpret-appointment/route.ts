import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
import { NextResponse } from "next/server";

type Intent = "create" | "update" | "cancel" | "list" | "plan" | "unknown";
type Priority = "low" | "medium" | "high";
type AgendaEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  priority?: Priority;
};

const intentCriteria = {
  create:
    "Create a new calendar appointment, reminder, meeting, task with a time, or personal event.",
  update:
    "Change the title, date, time, or duration of an existing calendar event.",
  cancel: "Cancel, remove, or delete an existing calendar event.",
  list: "Ask what is scheduled or request to see the agenda without changing it.",
  plan: "Organize, prioritize, or schedule multiple tasks or commitments from one brain dump into a daily plan.",
  unknown:
    "The message is unrelated to managing a personal agenda or is too unclear to act on.",
} as const;

const priorityCriteria = {
  low: "Optional, flexible, recreational, or safe to postpone without a meaningful consequence.",
  medium:
    "A normal appointment, meeting, errand, or commitment. Use this as the default when there is no strong reason for low or high.",
  high: "Urgent, time-sensitive, tied to a deadline, health need, critical obligation, or serious consequence if missed.",
} as const;

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromMessage(message: string) {
  const text = message
    .toLowerCase()
    .replace(/(?:de|por) la (?:mañana|manana)/g, "")
    .replace(/in the morning/g, "");
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const candidates: { index: number; value: string }[] = [];
  for (const match of text.matchAll(
    /\b(hoy|today|mañana|manana|tomorrow|pasado mañana|pasado manana|day after tomorrow)\b/g,
  )) {
    const value = new Date(base);
    if (/pasado|day after/.test(match[1])) value.setDate(value.getDate() + 2);
    else if (!/hoy|today/.test(match[1])) value.setDate(value.getDate() + 1);
    candidates.push({ index: match.index, value: isoDate(value) });
  }
  for (const match of text.matchAll(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g))
    candidates.push({
      index: match.index,
      value: `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`,
    });
  const months: Record<string, number> = {
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto: 7,
    septiembre: 8,
    setiembre: 8,
    octubre: 9,
    noviembre: 10,
    diciembre: 11,
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };
  for (const match of text.matchAll(
    /\b(?:el\s+)?(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)(?:\s+(?:de\s+)?(20\d{2}))?\b/g,
  ))
    if (months[match[2]] !== undefined)
      candidates.push({
        index: match.index,
        value: isoDate(
          new Date(
            Number(match[3] ?? now.getFullYear()),
            months[match[2]],
            Number(match[1]),
          ),
        ),
      });
  const weekdayNumbers: Record<string, number> = {
    domingo: 0,
    sunday: 0,
    lunes: 1,
    monday: 1,
    martes: 2,
    tuesday: 2,
    miércoles: 3,
    miercoles: 3,
    wednesday: 3,
    jueves: 4,
    thursday: 4,
    viernes: 5,
    friday: 5,
    sábado: 6,
    sabado: 6,
    saturday: 6,
  };
  for (const [name, day] of Object.entries(weekdayNumbers))
    for (const match of text.matchAll(new RegExp(`\\b${name}\\b`, "g"))) {
      const value = new Date(base);
      const nextWeek = new RegExp(
        `(?:próximo|proximo|next)\\s+${name}|${name}\\s+(?:de la próxima|de la proxima|next)`,
        "i",
      ).test(text);
      const delta = (day - value.getDay() + 7) % 7 || 7;
      value.setDate(value.getDate() + delta + (nextWeek ? 7 : 0));
      candidates.push({ index: match.index, value: isoDate(value) });
    }
  return candidates.sort((a, b) => b.index - a.index)[0]?.value ?? null;
}

function timeFromMessage(message: string) {
  const text = message.toLowerCase();
  if (/\b(mediodía|mediodia|noon)\b/.test(text))
    return { value: "12:00", ambiguous: false };
  if (/\b(medianoche|midnight)\b/.test(text))
    return { value: "00:00", ambiguous: false };
  const periodPattern =
    "a\\.?m\\.?|p\\.?m\\.?|am|pm|de la mañana|de la manana|de la tarde|de la noche|in the morning|in the afternoon|in the evening|at night";
  const matches = [
    ...text.matchAll(
      new RegExp(
        `(?:\\b(?:a las|para las|at|around)\\s+)(\\d{1,2})(?::(\\d{2}))?\\s*(${periodPattern})?|\\b(\\d{1,2}):(\\d{2})\\s*(${periodPattern})?\\b`,
        "g",
      ),
    ),
  ];
  const match = matches.at(-1);
  if (!match) return { value: null, ambiguous: false };
  let hour = Number(match[1] ?? match[4]);
  const minute = Number(match[2] ?? match[5] ?? 0);
  const period = (match[3] ?? match[6] ?? "").replace(/\./g, "");
  const isAfternoon =
    /^(pm|p m|de la tarde|de la noche|in the afternoon|in the evening|at night)$/.test(
      period,
    );
  const isMorning = /^(am|a m|de la mañana|de la manana|in the morning)$/.test(
    period,
  );
  if (isAfternoon && hour < 12) hour += 12;
  if (isMorning && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return { value: null, ambiguous: false };
  return {
    value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    ambiguous: !period && hour >= 1 && hour <= 12,
  };
}

function durationFromMessage(message: string) {
  const text = message.toLowerCase();
  const hours = text.match(
    /(?:por|durante|duration)?\s*(\d+(?:[.,]\d+)?)\s*(?:horas?|hours?)/,
  );
  if (hours) return Math.round(Number(hours[1].replace(",", ".")) * 60);
  const minutes = text.match(
    /(?:por|durante|duration)?\s*(\d{1,3})\s*(?:minutos?|mins?|minutes?)/,
  );
  return minutes ? Number(minutes[1]) : null;
}

function titleFromMessage(message: string) {
  let title = message.toLowerCase();
  title = title.replace(
    /\b(agenda(?:r)?|agrega(?:r)?|añade|anade|crea(?:r)?|pon(?:er)?|programa(?:r)?|quiero|necesito|recordarme|recuérdame|recuerdame|schedule|add|create|book)\b/gi,
    " ",
  );
  title = title.replace(
    /\b(una?\s+)?(cita|evento|reunión|reunion|recordatorio|appointment|event|meeting)\s+(?:para|con|de)?\b/gi,
    " ",
  );
  title = title.replace(
    /\b(?:a las|para las|at|around)\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|am|pm|de la mañana|de la manana|de la tarde|de la noche|in the morning|in the afternoon|in the evening|at night)?/gi,
    " ",
  );
  title = title.replace(
    /\b(hoy|today|mañana|manana|tomorrow|pasado mañana|pasado manana|day after tomorrow)\b/gi,
    " ",
  );
  title = title.replace(
    /\b(?:el\s+)?\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(?:de\s+)?20\d{2})?\b/gi,
    " ",
  );
  title = title.replace(
    /\b(?:próximo|proximo|next|este|this)?\s*(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    " ",
  );
  title = title
    .replace(/\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/gi, " ")
    .replace(
      /\b(?:por|durante)\s+\d+(?:[.,]\d+)?\s*(?:horas?|hours?|minutos?|mins?|minutes?)\b/gi,
      " ",
    );
  title = title
    .replace(
      /[,;]?\s*\b(?:es\s+)?(?:urgente|importante|opcional|flexible|sin prisa|urgent|important|optional|no rush)\b/gi,
      " ",
    )
    .replace(
      /\b(?:con\s+)?prioridad\s+(?:baja|media|mediana|alta|low|medium|high)\b/gi,
      " ",
    );
  title = title
    .replace(/\b(en|mi|calendario|calendar)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(para|con|de)\s+/i, "")
    .replace(/\s+(el|la|los|las|para|a)$/i, "")
    .trim();
  if (!title) return null;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function fallbackIntent(message: string): Intent {
  if (
    /\b(cancela|cancelar|elimina|eliminar|borra|borrar|quita|cancel|delete|remove)\b/i.test(
      message,
    )
  )
    return "cancel";
  if (
    /\b(cambia|cambiar|mueve|mover|actualiza|actualizar|pospón|pospon|change|move|update|reschedule)\b/i.test(
      message,
    )
  )
    return "update";
  if (
    /\b(organiza|organizar|planifica|planificar|ordena|ordenar|organize|plan my|prioritize)\b/i.test(
      message,
    ) ||
    message.split(/[,;]|\s+y\s+/i).filter((part) => part.trim().length > 3)
      .length >= 3
  )
    return "plan";
  if (
    /\b(qué tengo|que tengo|mi agenda|mis citas|muéstrame|muestrame|lista|show|list|what.*scheduled)\b/i.test(
      message,
    )
  )
    return "list";
  if (
    dateFromMessage(message) ||
    timeFromMessage(message).value ||
    /\b(agenda|agrega|añade|anade|crea|pon|programa|cita|reunión|reunion|recordatorio|schedule|add|book)\b/i.test(
      message,
    )
  )
    return "create";
  return "unknown";
}

function fallbackTarget(message: string, events: AgendaEvent[]) {
  const words = message
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 2);
  const ranked = events
    .map((event) => ({
      id: event.id,
      score: words.filter((word) => event.title.toLowerCase().includes(word))
        .length,
    }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.score ? ranked[0].id : null;
}

function fallbackPriority(message: string, intent: Intent): Priority | null {
  const explicit = message
    .toLowerCase()
    .match(/\b(?:prioridad\s+)?(baja|media|mediana|alta|low|medium|high)\b/);
  if (explicit)
    return /alta|high/.test(explicit[1])
      ? "high"
      : /baja|low/.test(explicit[1])
        ? "low"
        : "medium";
  if (intent !== "create") return null;
  if (
    /\b(urgente|emergencia|vence|vencimiento|deadline|critical|importante)\b/i.test(
      message,
    )
  )
    return "high";
  if (
    /\b(opcional|cuando pueda|sin prisa|flexible|optional|no rush)\b/i.test(
      message,
    )
  )
    return "low";
  return "medium";
}

function makeResponse(
  message: string,
  events: AgendaEvent[],
  intent: Intent,
  intentProbability: number,
  targetEventId: string | null,
  targetProbability: number,
  priority: Priority | null,
  priorityProbability: number,
  source: "typesafe" | "demo",
  startedAt: number,
  probabilities: Record<string, number>,
  usage?: { input_tokens: number; output_tokens: number },
) {
  const date = dateFromMessage(message);
  const parsedTime = timeFromMessage(message);
  const time = parsedTime.value;
  const statedDuration = durationFromMessage(message);
  const duration =
    intent === "create" ? (statedDuration ?? 60) : statedDuration;
  const title = intent === "create" ? titleFromMessage(message) : null;
  const target = events.find((event) => event.id === targetEventId) ?? null;
  const needsClarification =
    intent === "unknown" ||
    intentProbability < 0.55 ||
    (intent === "create" &&
      (!title || !date || !time || parsedTime.ambiguous)) ||
    (intent === "update" && parsedTime.ambiguous) ||
    ((intent === "update" || intent === "cancel") && !target);
  return {
    intent,
    intentProbability,
    intentProbabilities: probabilities,
    targetEventId: target?.id ?? null,
    targetProbability,
    title,
    date,
    time,
    timeAmbiguous: parsedTime.ambiguous,
    duration,
    priority,
    priorityProbability,
    needsClarification,
    source,
    responseLatencyMs: Math.round(performance.now() - startedAt),
    usage: usage ?? { input_tokens: 0, output_tokens: 0 },
  };
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const body = (await request.json()) as {
    message?: unknown;
    events?: unknown;
  };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < 2 || message.length > 1000)
    return NextResponse.json(
      { error: "Escribe un mensaje entre 2 y 1000 caracteres." },
      { status: 400 },
    );
  const events = Array.isArray(body.events)
    ? body.events
        .filter((event): event is AgendaEvent =>
          Boolean(
            event &&
            typeof event === "object" &&
            typeof (event as AgendaEvent).id === "string" &&
            typeof (event as AgendaEvent).title === "string" &&
            typeof (event as AgendaEvent).date === "string" &&
            typeof (event as AgendaEvent).time === "string" &&
            typeof (event as AgendaEvent).duration === "number",
          ),
        )
        .slice(0, 50)
    : [];
  const fallback = () => {
    const intent = fallbackIntent(message);
    const target = fallbackTarget(message, events);
    const priority = fallbackPriority(message, intent);
    return makeResponse(
      message,
      events,
      intent,
      intent === "unknown" ? 0.35 : 0.86,
      target,
      target ? 0.78 : 0,
      priority,
      priority ? 0.78 : 0,
      "demo",
      startedAt,
      Object.fromEntries(
        Object.keys(intentCriteria).map((key) => [
          key,
          key === intent ? 0.86 : 0.035,
        ]),
      ),
    );
  };
  if (!process.env.TYPESAFE_API_KEY) return NextResponse.json(fallback());
  try {
    const targetCriteria: Record<string, string> = {
      none: "No existing event is the target of this instruction.",
    };
    for (const event of events)
      targetCriteria[`event_${event.id}`] =
        `${event.title}, scheduled ${event.date} at ${event.time}.`;
    if (events.length === 0)
      targetCriteria.new_event =
        "The message refers to a new event, not an existing one.";
    const questions = {
      intent: choice(
        "What single action should a personal calendar assistant take from the user's latest instruction? Choose unknown rather than inventing an action.",
        intentCriteria,
      ),
      target: choice(
        "Which existing calendar event is the user asking to change or cancel? Choose none when listing or creating, when no event matches, or when the message does not identify one.",
        targetCriteria,
      ),
      inferredPriority: choice(
        "If the user is creating a new event, what practical priority should it have based on urgency and consequence? Default ordinary appointments to medium.",
        priorityCriteria,
      ),
      priorityChange: choice(
        "Is the user explicitly changing an existing event's priority? Choose keep unless the message directly requests low, medium, or high priority.",
        { keep: "No explicit priority change.", ...priorityCriteria },
      ),
    };
    const client = new TypeSafeClient();
    const result = await client.systemOne({
      state: {
        userMessage: message,
        currentAgenda: events.map(
          ({ id, title, date, time, duration, priority }) => ({
            id,
            title,
            date,
            time,
            duration,
            priority: priority ?? "medium",
          }),
        ),
        currentDate: isoDate(new Date()),
        purpose:
          "Safely route a personal agenda command. Application code parses dates and times and requires confirmation before mutation.",
      },
      questions,
    });
    const intent = result.answers.intent.choice as Intent;
    const targetChoice = result.answers.target.choice;
    const targetEventId = targetChoice.startsWith("event_")
      ? targetChoice.slice(6)
      : null;
    const priorityChoice =
      intent === "create"
        ? result.answers.inferredPriority.choice
        : intent === "update" && result.answers.priorityChange.choice !== "keep"
          ? result.answers.priorityChange.choice
          : null;
    const priority = priorityChoice as Priority | null;
    const priorityProbability = priority
      ? intent === "create"
        ? result.answers.inferredPriority.probabilities[priority]
        : result.answers.priorityChange.probabilities[priority]
      : 0;
    return NextResponse.json(
      makeResponse(
        message,
        events,
        intent,
        result.answers.intent.probabilities[intent],
        targetEventId,
        result.answers.target.probabilities[targetChoice],
        priority,
        priorityProbability,
        "typesafe",
        startedAt,
        result.answers.intent.probabilities as Record<string, number>,
        result.usage,
      ),
    );
  } catch (error) {
    console.error("Personal agenda interpretation failed", error);
    return NextResponse.json(fallback());
  }
}
