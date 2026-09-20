import {
  choice,
  noul,
  score,
  TypeSafeClient,
  type Questions,
} from "@typesafe-ai/sdk";
import { NextResponse } from "next/server";

type Priority = "low" | "medium" | "high";
type Effort = "light" | "medium" | "deep";
type Flexibility = "fixed" | "flexible";
type PreparationKind = "none" | "documents" | "materials" | "review" | "travel";
type AgendaEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  priority?: Priority;
  flexibility?: Flexibility;
  preparationKind?: PreparationKind;
  preparationMinutes?: number;
  deadline?: string | null;
  dependsOnId?: string | null;
};
type Candidate = {
  id: string;
  source: string;
  title: string;
  date: string;
  parsedTime: { value: string | null; ambiguous: boolean };
  statedDuration: number | null;
  deadline: string | null;
};
type Signals = {
  urgency: number;
  importance: number;
  effort: number;
  flexibility: Flexibility;
  period: "morning" | "afternoon" | "unknown";
  preparationKind: PreparationKind;
  preparationMinutes: number;
  dependsOnId: string | null;
  confidence: number;
};
type PlannedItem = {
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

const priorityRank: Record<Priority, number> = { low: 0, medium: 1, high: 2 };

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function minutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}
function clock(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
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
  const weekdays: Record<string, number> = {
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
  for (const [name, day] of Object.entries(weekdays))
    for (const match of text.matchAll(new RegExp(`\\b${name}\\b`, "g"))) {
      const value = new Date(base);
      const delta = (day - value.getDay() + 7) % 7 || 7;
      value.setDate(value.getDate() + delta);
      candidates.push({ index: match.index, value: isoDate(value) });
    }
  for (const match of text.matchAll(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g))
    candidates.push({
      index: match.index,
      value: `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`,
    });
  return candidates.sort((a, b) => b.index - a.index)[0]?.value ?? null;
}

function deadlineFromMessage(message: string) {
  const marker = message.search(
    /\b(?:antes\s+de(?:l)?|a\s+m[aá]s\s+tardar|fecha\s+l[ií]mite|vence|vencimiento|before|by|deadline|due)\b/i,
  );
  return marker >= 0 ? dateFromMessage(message.slice(marker)) : null;
}

function scheduledDateFromMessage(message: string) {
  const marker = message.search(
    /\b(?:antes\s+de(?:l)?|a\s+m[aá]s\s+tardar|fecha\s+l[ií]mite|vence|vencimiento|before|by|deadline|due)\b/i,
  );
  return dateFromMessage(marker >= 0 ? message.slice(0, marker) : message);
}

function timeFromMessage(message: string) {
  const text = message.toLowerCase();
  if (/\b(mediodía|mediodia|noon)\b/.test(text))
    return { value: "12:00", ambiguous: false };
  if (/\b(medianoche|midnight)\b/.test(text))
    return { value: "00:00", ambiguous: false };
  const periods =
    "a\\.?m\\.?|p\\.?m\\.?|am|pm|de la mañana|de la manana|de la tarde|de la noche|in the morning|in the afternoon|in the evening|at night";
  const matches = [
    ...text.matchAll(
      new RegExp(
        `(?:\\b(?:a las|para las|at|around)\\s+)(\\d{1,2})(?::(\\d{2}))?\\s*(${periods})?|\\b(\\d{1,2}):(\\d{2})\\s*(${periods})?\\b`,
        "g",
      ),
    ),
  ];
  const match = matches.at(-1);
  if (!match) return { value: null, ambiguous: false };
  let hour = Number(match[1] ?? match[4]);
  const minute = Number(match[2] ?? match[5] ?? 0);
  const period = (match[3] ?? match[6] ?? "").replace(/\./g, "");
  if (
    /^(pm|de la tarde|de la noche|in the afternoon|in the evening|at night)$/.test(
      period,
    ) &&
    hour < 12
  )
    hour += 12;
  if (
    /^(am|de la mañana|de la manana|in the morning)$/.test(period) &&
    hour === 12
  )
    hour = 0;
  if (hour > 23 || minute > 59) return { value: null, ambiguous: false };
  return {
    value: clock(hour * 60 + minute),
    ambiguous: !period && hour >= 1 && hour <= 12,
  };
}

function durationFromMessage(message: string) {
  const hours = message
    .toLowerCase()
    .match(/(\d+(?:[.,]\d+)?)\s*(?:horas?|hours?)/);
  if (hours) return Math.round(Number(hours[1].replace(",", ".")) * 60);
  const mins = message
    .toLowerCase()
    .match(/(\d{1,3})\s*(?:minutos?|mins?|minutes?)/);
  return mins ? Number(mins[1]) : null;
}

function taskTitle(text: string) {
  let title = text
    .toLowerCase()
    .replace(
      /^(?:para\s+)?(?:hoy|mañana|manana|tomorrow)?\s*(?:tengo que|debo|necesito|quiero|hay que|planifica(?:r)?|organiza(?:r)?|ordena(?:r)?|agrega(?:r)?|añade|anade|también|tambien|luego|después|despues)\s*/i,
      "",
    );
  title = title
    .replace(
      /\b(?:a las|para las|at|around)\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|am|pm|de la mañana|de la manana|de la tarde|de la noche)?/gi,
      " ",
    )
    .replace(
      /\b(?:antes\s+de(?:l)?|a\s+m[aá]s\s+tardar|fecha\s+l[ií]mite|vence|vencimiento|before|by|deadline|due)\s+(?:hoy|mañana|manana|tomorrow|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday|20\d{2}-\d{1,2}-\d{1,2})\b/gi,
      " ",
    )
    .replace(
      /\b(hoy|mañana|manana|tomorrow|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b/gi,
      " ",
    )
    .replace(
      /\b(?:es\s+)?(?:urgente|importante|opcional|flexible|sin prisa)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(y|e|para)\s+/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : null;
}

function brainDumpText(message: string) {
  return message
    .replace(
      /^\s*(?:organiza|organizar|planifica|planificar|ordena|ordenar)\s+(?:mi\s+)?(?:día|dia|agenda|tareas)?\s*[:,-]?\s*/i,
      "",
    )
    .trim();
}

function fallbackUnpunctuatedParts(text: string) {
  const matches = text.match(
    /(?:cita\s+(?:m[eé]dica|dental)|gimnasio|barber(?:o|ía|ia)|dentista|banco|supermercado|farmacia)(?:\s+(?:hoy|mañana|manana|tomorrow))?/gi,
  );
  return matches && matches.length > 1 ? matches : null;
}

function splitCandidates(
  message: string,
  inferredParts?: string[],
  useFallback = false,
) {
  // Explicit punctuation is handled first. TypeSafe boundary recovery is used only
  // when a brain dump appears to contain multiple tasks without separators.
  const globalDate = scheduledDateFromMessage(message) ?? isoDate(new Date());
  const cleaned = brainDumpText(message);
  const explicitParts = cleaned.split(
    /\s*(?:,|;|\.\s+|\by luego\b|\bluego\b|\btambién\b|\btambien\b|\by\b)\s*/i,
  );
  const parts = (
    inferredParts ??
    (explicitParts.length > 1
      ? explicitParts
      : useFallback
        ? (fallbackUnpunctuatedParts(cleaned) ?? explicitParts)
        : explicitParts)
  )
    .map((part) => part.trim())
    .filter((part) => part.length > 2)
    .slice(0, 8);
  return parts
    .map((source, index) => ({
      id: `task_${index}`,
      source,
      title: taskTitle(source),
      date: scheduledDateFromMessage(source) ?? globalDate,
      parsedTime: timeFromMessage(source),
      statedDuration: durationFromMessage(source),
      deadline: deadlineFromMessage(source),
    }))
    .filter((item): item is Candidate => Boolean(item.title));
}

function partsFromBoundaries(tokens: string[], probabilities: number[]) {
  if (!tokens.length) return [];
  const parts: string[] = [];
  let current = [tokens[0]];
  for (let index = 1; index < tokens.length; index += 1) {
    if ((probabilities[index - 1] ?? 0) >= 0.58) {
      parts.push(current.join(" "));
      current = [tokens[index]];
    } else current.push(tokens[index]);
  }
  parts.push(current.join(" "));
  return parts;
}

function localBoundaryProbability(tokens: string[], index: number) {
  const next = tokens[index]?.toLowerCase().replace(/[.,;:]/g, "");
  const previous = tokens[index - 1]?.toLowerCase().replace(/[.,;:]/g, "");
  if (
    !next ||
    /^(hoy|mañana|manana|tomorrow|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)$/.test(
      next,
    )
  )
    return 0;
  if (
    /^(ir|llamar|buscar|recoger|llevar|hacer|terminar|enviar|revisar|pagar|comprar|entrenar|trabajar|reunirme|visitar|reservar|agendar|go|call|pick|finish|send|review|pay|buy)$/.test(
      next,
    )
  )
    return 0.92;
  if (
    /^(cita|gimnasio|barbero|barbería|barberia|dentista|banco|supermercado|farmacia)$/.test(
      next,
    ) &&
    !/^(a|al|de|del|el|la|mi|con|para)$/.test(previous)
  )
    return 0.88;
  return 0;
}

function heuristicSignals(candidate: Candidate): Signals {
  const text = candidate.source.toLowerCase();
  const urgency = /urgente|vence|hoy|deadline|emergencia/.test(text)
    ? 2
    : /mañana|debo|cita/.test(text)
      ? 1
      : 0;
  const importance =
    /hija|hijo|médic|medic|cliente|propuesta|banco|pago|trabajo/.test(text)
      ? 2
      : /gimnasio|comprar|llamar/.test(text)
        ? 1
        : 0;
  const effort = /terminar|propuesta|informe|estudiar|trabajar/.test(text)
    ? 2
    : /llamar|pagar|comprar/.test(text)
      ? 0
      : 1;
  const preparationKind: PreparationKind =
    /document|formulario|identificaci[oó]n/.test(text)
      ? "documents"
      : /material|equipo|herramienta/.test(text)
        ? "materials"
        : /revis|leer|estudi|propuesta|presentaci[oó]n/.test(text)
          ? "review"
          : /viaj|traslado|manejar|en persona/.test(text)
            ? "travel"
            : "none";
  return {
    urgency,
    importance,
    effort,
    flexibility: candidate.parsedTime.value ? "fixed" : "flexible",
    period: "unknown",
    preparationKind,
    preparationMinutes: preparationKind === "none" ? 0 : 30,
    dependsOnId: null,
    confidence: 0.72,
  };
}

function priorityFromSignals(signals: Signals): Priority {
  // Priority is a transparent application rule over reusable TypeSafe scores.
  // Changing these weights does not require another inference request.
  const value = signals.urgency * 0.55 + signals.importance * 0.45;
  return value >= 1.35 ? "high" : value < 0.65 ? "low" : "medium";
}
function effortFromScore(value: number): Effort {
  return value >= 1.35 ? "deep" : value < 0.65 ? "light" : "medium";
}

function resolveTime(candidate: Candidate, signals: Signals) {
  if (!candidate.parsedTime.value) return { value: null, needsReview: false };
  if (!candidate.parsedTime.ambiguous)
    return { value: candidate.parsedTime.value, needsReview: false };
  const raw = minutes(candidate.parsedTime.value);
  if (signals.period === "afternoon" && raw < 12 * 60)
    return { value: clock(raw + 12 * 60), needsReview: false };
  if (signals.period === "morning")
    return { value: candidate.parsedTime.value, needsReview: false };
  return { value: candidate.parsedTime.value, needsReview: true };
}

function schedule(
  candidates: Candidate[],
  signalMap: Record<string, Signals>,
  events: AgendaEvent[],
) {
  // Scheduling remains deterministic. TypeSafe supplies semantic signals; code owns
  // dependency ordering, deadline enforcement, preparation buffers, and open slots.
  const items = candidates.map((candidate) => {
    const signals = signalMap[candidate.id];
    const effort = effortFromScore(signals.effort);
    const resolved = resolveTime(candidate, signals);
    return {
      candidate,
      signals,
      effort,
      resolved,
      duration:
        candidate.statedDuration ??
        (effort === "deep" ? 90 : effort === "light" ? 30 : 60),
      priority: priorityFromSignals(signals),
    };
  });
  const busy = events.map((event) => ({
    date: event.date,
    start: minutes(event.time) - (event.preparationMinutes ?? 0),
    end: minutes(event.time) + event.duration,
    title: event.title,
  }));
  const planned: PlannedItem[] = [];
  const pending = [...items];
  const ordered: typeof items = [];
  // A small topological pass places prerequisites before their dependents. Invalid
  // cycles fall back to the normal priority order instead of blocking the plan.
  while (pending.length) {
    const ready = pending.filter(
      (item) =>
        !item.signals.dependsOnId ||
        !pending.some(
          (candidate) => candidate.candidate.id === item.signals.dependsOnId,
        ),
    );
    const pool = ready.length ? ready : pending;
    pool.sort(
      (a, b) =>
        Number(Boolean(b.resolved.value)) - Number(Boolean(a.resolved.value)) ||
        Number(Boolean(b.candidate.deadline)) -
          Number(Boolean(a.candidate.deadline)) ||
        (a.candidate.deadline ?? "9999-12-31").localeCompare(
          b.candidate.deadline ?? "9999-12-31",
        ) ||
        priorityRank[b.priority] - priorityRank[a.priority] ||
        b.signals.effort - a.signals.effort,
    );
    const next = pool[0];
    ordered.push(next);
    pending.splice(pending.indexOf(next), 1);
  }
  for (const item of ordered) {
    const { candidate, signals, duration, priority, effort, resolved } = item;
    let time = resolved.value;
    let conflict: string | null = null;
    let date = candidate.date;
    const preparationMinutes = signals.preparationMinutes;
    const dependency = signals.dependsOnId
      ? planned.find((entry) => entry.id === signals.dependsOnId)
      : null;
    if (time) {
      const start = minutes(time);
      conflict =
        busy.find(
          (slot) =>
            slot.date === date &&
            start - preparationMinutes < slot.end &&
            start + duration > slot.start,
        )?.title ?? null;
      if (
        dependency?.time &&
        `${date}T${time}` <
          `${dependency.date}T${clock(minutes(dependency.time) + dependency.duration)}`
      )
        conflict = dependency.title;
    }
    if (!time) {
      const today = isoDate(new Date());
      const now = new Date();
      if (dependency && date < dependency.date) date = dependency.date;
      for (let day = 0; day < 7 && !time; day += 1) {
        if (candidate.deadline && date > candidate.deadline) break;
        const normalStart =
          priority === "high" || effort === "deep"
            ? 8 * 60
            : priority === "medium"
              ? 10 * 60
              : 14 * 60;
        let earliest =
          date === today
            ? Math.max(
                normalStart,
                Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15,
              )
            : normalStart;
        if (dependency?.time && dependency.date === date)
          earliest = Math.max(
            earliest,
            minutes(dependency.time) + dependency.duration,
          );
        earliest = Math.max(earliest, 8 * 60 + preparationMinutes);
        for (let start = earliest; start + duration <= 20 * 60; start += 15) {
          if (
            !busy.some(
              (slot) =>
                slot.date === date &&
                start - preparationMinutes < slot.end &&
                start + duration > slot.start,
            )
          ) {
            time = clock(start);
            break;
          }
        }
        if (!time) {
          const next = new Date(`${date}T12:00:00`);
          next.setDate(next.getDate() + 1);
          date = isoDate(next);
        }
      }
    }
    if (time && !conflict)
      busy.push({
        date,
        start: minutes(time) - preparationMinutes,
        end: minutes(time) + duration,
        title: candidate.title,
      });
    planned.push({
      id: candidate.id,
      title: candidate.title,
      date,
      time,
      duration,
      priority,
      effort,
      flexibility: candidate.parsedTime.value ? "fixed" : signals.flexibility,
      preparationKind: signals.preparationKind,
      preparationMinutes,
      deadline: candidate.deadline,
      dependsOnId: signals.dependsOnId,
      confidence: signals.confidence,
      conflict,
      needsReview:
        resolved.needsReview ||
        !time ||
        Boolean(conflict) ||
        Boolean(candidate.deadline && date > candidate.deadline),
    });
  }
  return planned.sort((a, b) =>
    `${a.date}T${a.time ?? "99:99"}`.localeCompare(
      `${b.date}T${b.time ?? "99:99"}`,
    ),
  );
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const body = (await request.json()) as {
    message?: unknown;
    events?: unknown;
  };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < 4 || message.length > 2000)
    return NextResponse.json(
      { error: "Describe entre 1 y 8 tareas." },
      { status: 400 },
    );
  const events = Array.isArray(body.events)
    ? body.events
        .filter((event): event is AgendaEvent =>
          Boolean(
            event &&
            typeof event === "object" &&
            typeof (event as AgendaEvent).title === "string" &&
            typeof (event as AgendaEvent).date === "string" &&
            typeof (event as AgendaEvent).time === "string",
          ),
        )
        .slice(0, 50)
    : [];
  const client = process.env.TYPESAFE_API_KEY ? new TypeSafeClient() : null;
  let candidates = splitCandidates(message, undefined, !client);
  let boundaryDecisionCount = 0;
  let boundaryUsage = { input_tokens: 0, output_tokens: 0 };

  if (candidates.length < 2 && client) {
    try {
      // Each token gap is an independent yes/no boundary judgment. Local probabilities
      // remain as a safety net for common verbs and appointment phrases.
      const tokens = brainDumpText(message)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 30);
      const boundaryQuestions: Questions = {};
      for (let index = 1; index < tokens.length; index += 1) {
        boundaryQuestions[`gap_${index}`] = noul(
          {
            instructions: `Decide whether a new, distinct schedulable task begins with "${tokens[index]}" at the gap "${tokens[index - 1]} | ${tokens[index]}" in the user's exact text.`,
            fullText: message,
          },
          {
            true: "The right token begins another task or appointment, even when the user omitted commas and conjunctions.",
            false:
              "The right token continues the same task, its name, description, object, date, or time. Keep phrases such as 'cita médica mañana' together.",
          },
        );
      }
      const result = await client.systemOne({
        state: {
          userMessage: message,
          numberedTokens: tokens.map((token, index) => ({
            position: index + 1,
            token,
          })),
          purpose:
            "Recover task boundaries from an unpunctuated personal agenda brain dump.",
        },
        questions: boundaryQuestions,
      });
      const answers = result.answers as unknown as Record<
        string,
        { noul?: number }
      >;
      candidates = splitCandidates(
        message,
        partsFromBoundaries(
          tokens,
          tokens
            .slice(1)
            .map((_, index) =>
              Math.max(
                answers[`gap_${index + 1}`]?.noul ?? 0,
                localBoundaryProbability(tokens, index + 1),
              ),
            ),
        ),
      );
      boundaryDecisionCount = Math.max(0, tokens.length - 1);
      boundaryUsage = result.usage;
    } catch (error) {
      console.error("Agenda boundary recovery failed", error);
      const tokens = brainDumpText(message)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 30);
      candidates = splitCandidates(
        message,
        partsFromBoundaries(
          tokens,
          tokens
            .slice(1)
            .map((_, index) => localBoundaryProbability(tokens, index + 1)),
        ),
      );
    }
  }

  if (candidates.length < 2 && !client) {
    const tokens = brainDumpText(message)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 30);
    candidates = splitCandidates(
      message,
      partsFromBoundaries(
        tokens,
        tokens
          .slice(1)
          .map((_, index) => localBoundaryProbability(tokens, index + 1)),
      ),
      true,
    );
  }

  if (candidates.length < 2)
    return NextResponse.json(
      {
        error:
          "No pude separar las tareas. Prueba: gimnasio, barbero, cita médica mañana.",
      },
      { status: 400 },
    );
  const fallback = () => {
    const signalMap = Object.fromEntries(
      candidates.map((candidate) => [
        candidate.id,
        heuristicSignals(candidate),
      ]),
    );
    return {
      items: schedule(candidates, signalMap, events),
      source: "demo" as const,
      responseLatencyMs: Math.round(performance.now() - startedAt),
      decisionCount: boundaryDecisionCount + candidates.length * 8,
      usage: boundaryUsage,
    };
  };
  if (!client) return NextResponse.json(fallback());
  try {
    const questions: Questions = {};
    // TypeSafe evaluates planning signals, but does not choose a calendar slot or
    // mutate the user's agenda. The scheduler below owns those actions.
    for (const candidate of candidates) {
      const dependencyCriteria = Object.fromEntries([
        [
          "none",
          "This task has no explicit prerequisite among the other task candidates.",
        ],
        ...candidates
          .filter((other) => other.id !== candidate.id)
          .map((other) => [other.id, `${other.title}: ${other.source}`]),
      ]);
      questions[`${candidate.id}_urgency`] = score(
        `How urgent is completing \`${candidate.id}\` on its stated day? Judge time pressure and consequence of delay, not general importance.`,
        [
          "Can safely wait beyond that day.",
          "Should happen that day but a short delay is manageable.",
          "Time-critical, deadline-bound, or serious consequence if delayed.",
        ],
      );
      questions[`${candidate.id}_importance`] = score(
        `How important is \`${candidate.id}\` to the user's responsibilities or goals?`,
        [
          "Optional or recreational with little consequence.",
          "A normal useful commitment.",
          "A major responsibility, health need, work deliverable, or commitment to another person.",
        ],
      );
      questions[`${candidate.id}_effort`] = score(
        `How much focused effort is \`${candidate.id}\` likely to require?`,
        [
          "Quick or light, such as a short call or errand.",
          "Moderate sustained attention.",
          "Deep, demanding, or substantial focused work.",
        ],
      );
      questions[`${candidate.id}_flexibility`] = choice(
        `Can \`${candidate.id}\` move within the day? Respect explicit appointment times.`,
        {
          fixed: "It has a stated time or naturally fixed commitment.",
          flexible: "It can reasonably be placed in an available slot.",
        },
      );
      questions[`${candidate.id}_period`] = choice(
        `If \`${candidate.id}\` states an ambiguous 1–12 hour without AM/PM, is morning or afternoon strongly implied by context?`,
        {
          morning: "Morning is strongly implied.",
          afternoon: "Afternoon or evening is strongly implied.",
          unknown: "The period is not safely inferable.",
        },
      );
      questions[`${candidate.id}_preparation_kind`] = choice(
        `What preparation is directly stated or strongly implied before \`${candidate.id}\`? Choose none rather than inventing preparation.`,
        {
          none: "No meaningful preparation is implied.",
          documents: "Gather forms, identification, records, or documents.",
          materials:
            "Gather equipment, tools, supplies, or physical materials.",
          review: "Read, research, rehearse, or review information.",
          travel: "Allow travel time to reach an in-person commitment.",
        },
      );
      questions[`${candidate.id}_preparation_minutes`] = choice(
        `How much preparation time should be reserved immediately before \`${candidate.id}\`? Choose zero when preparation is not supported by the message.`,
        {
          "0": "No preparation block.",
          "15": "Quick preparation.",
          "30": "Normal preparation.",
          "60": "Substantial preparation.",
        },
      );
      questions[`${candidate.id}_dependency`] = choice(
        `Which other task candidate must be completed before \`${candidate.id}\`? Choose none unless the user's wording makes the dependency explicit.`,
        dependencyCriteria,
      );
    }
    const result = await client.systemOne({
      state: {
        userMessage: message,
        taskCandidates: candidates.map(
          ({ id, source, title, date, parsedTime, deadline }) => ({
            id,
            source,
            title,
            date,
            statedTime: parsedTime.value,
            deadline,
          }),
        ),
        currentAgenda: events,
        currentDate: isoDate(new Date()),
        purpose:
          "Evaluate independent planning signals. Application code builds the schedule and requires user confirmation.",
      },
      questions,
    });
    const answers = result.answers as unknown as Record<
      string,
      { score?: number; choice?: string; confidence?: number }
    >;
    const signalMap: Record<string, Signals> = {};
    for (const candidate of candidates) {
      const urgency = answers[`${candidate.id}_urgency`];
      const importance = answers[`${candidate.id}_importance`];
      const effort = answers[`${candidate.id}_effort`];
      const flexibility = answers[`${candidate.id}_flexibility`];
      const period = answers[`${candidate.id}_period`];
      const preparationKind = answers[`${candidate.id}_preparation_kind`];
      const preparationMinutes = answers[`${candidate.id}_preparation_minutes`];
      const dependency = answers[`${candidate.id}_dependency`];
      const kind = ["documents", "materials", "review", "travel"].includes(
        preparationKind?.choice ?? "",
      )
        ? (preparationKind.choice as PreparationKind)
        : "none";
      signalMap[candidate.id] = {
        urgency: urgency?.score ?? 1,
        importance: importance?.score ?? 1,
        effort: effort?.score ?? 1,
        flexibility: flexibility?.choice === "fixed" ? "fixed" : "flexible",
        period:
          period?.choice === "morning" || period?.choice === "afternoon"
            ? period.choice
            : "unknown",
        preparationKind: kind,
        preparationMinutes:
          kind === "none"
            ? 0
            : Number(preparationMinutes?.choice ?? 0) ||
              (kind === "documents" || kind === "materials" ? 15 : 30),
        dependsOnId:
          dependency?.choice &&
          candidates.some((item) => item.id === dependency.choice)
            ? dependency.choice
            : null,
        confidence: Math.min(
          urgency?.confidence ?? 0,
          importance?.confidence ?? 0,
          effort?.confidence ?? 0,
          flexibility?.confidence ?? 0,
          preparationKind?.confidence ?? 0,
          preparationMinutes?.confidence ?? 0,
          dependency?.confidence ?? 0,
        ),
      };
    }
    return NextResponse.json({
      items: schedule(candidates, signalMap, events),
      source: "typesafe",
      responseLatencyMs: Math.round(performance.now() - startedAt),
      decisionCount: boundaryDecisionCount + candidates.length * 8,
      usage: {
        input_tokens: boundaryUsage.input_tokens + result.usage.input_tokens,
        output_tokens: boundaryUsage.output_tokens + result.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error("Agenda planning failed", error);
    return NextResponse.json(fallback());
  }
}
