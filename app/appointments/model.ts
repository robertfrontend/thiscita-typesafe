import type {
  AgendaEvent,
  AgendaReply,
  Effort,
  Intent,
  PlannedItem,
  PlanReply,
  PreparationKind,
  Priority,
} from "./types";

export const intentLabel: Record<Intent, string> = {
  create: "Crear",
  update: "Cambiar",
  cancel: "Cancelar",
  list: "Consultar",
  plan: "Planificar",
  unknown: "Aclarar",
};

export const priorityLabel: Record<Priority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export const effortLabel: Record<Effort, string> = {
  light: "Ligero",
  medium: "Medio",
  deep: "Profundo",
};

export const preparationLabel: Record<PreparationKind, string> = {
  none: "Sin preparación",
  documents: "Preparar documentos",
  materials: "Preparar materiales",
  review: "Revisar información",
  travel: "Tiempo de traslado",
};

const planTimeOptions = Array.from({ length: 72 }, (_, index) => {
  const total = 6 * 60 + index * 15;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
});

export function readableDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("es-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(new Date(`${value}T12:00:00`))
    : "Falta el día";
}

export function readableTime(value: string) {
  return new Intl.DateTimeFormat("es-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(`2000-01-01T${value}:00`));
}

export function toMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function endTime(value: string, duration: number) {
  const total = (toMinutes(value) + duration) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function optionsForTime(value: string | null) {
  return value && !planTimeOptions.includes(value)
    ? [...planTimeOptions, value].sort()
    : planTimeOptions;
}

export function sortEvents(events: AgendaEvent[]) {
  return [...events].sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
  );
}

export function sortPlanItems(items: PlannedItem[]) {
  return [...items].sort((a, b) =>
    `${a.date}T${a.time ?? "99:99"}`.localeCompare(
      `${b.date}T${b.time ?? "99:99"}`,
    ),
  );
}

export function nextPlanTime(
  date: string,
  duration: number,
  plan: PlannedItem[],
  savedEvents: AgendaEvent[],
  preparationMinutes = 0,
) {
  // Proposed and saved events share the same busy-slot list, preventing a new task
  // from colliding with either committed events or other items in the current draft.
  const busy = [
    ...plan
      .filter((item) => item.date === date && item.time)
      .map((item) => ({
        start: toMinutes(item.time as string) - item.preparationMinutes,
        end: toMinutes(item.time as string) + item.duration,
      })),
    ...savedEvents
      .filter((item) => item.date === date)
      .map((item) => ({
        start: toMinutes(item.time) - (item.preparationMinutes ?? 0),
        end: toMinutes(item.time) + item.duration,
      })),
  ];

  for (
    let start = 8 * 60 + preparationMinutes;
    start + duration <= 20 * 60;
    start += 15
  ) {
    const overlaps = busy.some(
      (slot) =>
        start - preparationMinutes < slot.end && start + duration > slot.start,
    );
    if (!overlaps) {
      return `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
    }
  }

  return null;
}

export function additionsForPlan(
  plan: PlanReply,
  additions: PlannedItem[],
  requestedDate: string | null,
  savedEvents: AgendaEvent[],
) {
  // Added tasks receive fresh IDs and are rescheduled against the evolving draft.
  // Nothing reaches localStorage until the user confirms the complete plan.
  const prepared: PlannedItem[] = [];
  const idMap = new Map(
    additions.map((item) => [item.id, crypto.randomUUID()]),
  );
  const defaultDate =
    requestedDate ??
    plan.items[0]?.date ??
    new Date().toISOString().slice(0, 10);

  for (const item of additions) {
    const date = requestedDate ? item.date : defaultDate;
    const time = requestedDate
      ? item.time
      : nextPlanTime(
          date,
          item.duration,
          [...plan.items, ...prepared],
          savedEvents,
          item.preparationMinutes,
        );
    prepared.push({
      ...item,
      id: idMap.get(item.id) as string,
      dependsOnId: item.dependsOnId
        ? (idMap.get(item.dependsOnId) ?? item.dependsOnId)
        : null,
      date,
      time,
      needsReview: !time,
    });
  }

  return prepared;
}

export function calendarUrl(event: AgendaEvent) {
  // Calendar export is a prefilled URL only; this application never writes directly
  // to the user's Google Calendar account.
  const start = new Date(`${event.date}T${event.time}:00`);
  const end = new Date(start.getTime() + event.duration * 60_000);
  const stamp = (value: Date) =>
    `${value.getFullYear()}${String(value.getMonth() + 1).padStart(2, "0")}${String(value.getDate()).padStart(2, "0")}T${String(value.getHours()).padStart(2, "0")}${String(value.getMinutes()).padStart(2, "0")}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: [
      "Creado desde OBRA · Agenda personal",
      event.preparationMinutes
        ? `${preparationLabel[event.preparationKind ?? "none"]}: ${event.preparationMinutes} min antes`
        : "",
      event.deadline ? `Fecha límite: ${readableDate(event.deadline)}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function eventFromReply(
  reply: AgendaReply,
  events: AgendaEvent[],
): AgendaEvent | null {
  if (reply.intent === "create" && reply.title && reply.date && reply.time) {
    return {
      id: "draft",
      title: reply.title,
      date: reply.date,
      time: reply.time,
      duration: reply.duration ?? 60,
      priority: reply.priority ?? "medium",
      flexibility: reply.time ? "fixed" : "flexible",
      preparationKind: reply.preparationKind,
      preparationMinutes: reply.preparationMinutes,
      deadline: reply.deadline,
      dependsOnId: reply.dependsOnId,
    };
  }

  if (reply.intent === "update" && reply.targetEventId) {
    const target = events.find((event) => event.id === reply.targetEventId);
    if (target) {
      return {
        ...target,
        date: reply.date ?? target.date,
        time: reply.time ?? target.time,
        duration: reply.duration ?? target.duration,
        priority: reply.priority ?? target.priority,
        preparationKind:
          reply.preparationKind === "none"
            ? target.preparationKind
            : reply.preparationKind,
        preparationMinutes:
          reply.preparationMinutes || target.preparationMinutes || 0,
        deadline: reply.deadline ?? target.deadline ?? null,
        dependsOnId: reply.dependsOnId ?? target.dependsOnId ?? null,
      };
    }
  }

  if (reply.intent === "cancel" && reply.targetEventId) {
    return events.find((event) => event.id === reply.targetEventId) ?? null;
  }

  return null;
}

export type ReplanMove = {
  id: string;
  title: string;
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
};

function overlaps(left: AgendaEvent, right: AgendaEvent) {
  if (left.date !== right.date) return false;
  const leftStart = toMinutes(left.time) - (left.preparationMinutes ?? 0);
  const rightStart = toMinutes(right.time) - (right.preparationMinutes ?? 0);
  return (
    leftStart < toMinutes(right.time) + right.duration &&
    toMinutes(left.time) + left.duration > rightStart
  );
}

function nextDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Reflows only flexible events. The edited event and all fixed commitments remain
 * locked, so semantic judgments never mutate the calendar on their own.
 */
export function replanAgenda(
  currentEvents: AgendaEvent[],
  changedEvent: AgendaEvent,
) {
  const originalById = new Map(currentEvents.map((event) => [event.id, event]));
  const remaining = currentEvents.filter(
    (event) => event.id !== changedEvent.id,
  );
  const locked = [
    changedEvent,
    ...remaining.filter((event) => event.flexibility !== "flexible"),
  ];
  const flexible = remaining
    .filter((event) => event.flexibility === "flexible")
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const placed = [...locked];
  const unresolved: AgendaEvent[] = locked.filter(
    (event) => event.id !== changedEvent.id && overlaps(changedEvent, event),
  );

  for (const event of flexible) {
    if (!placed.some((other) => overlaps(event, other))) {
      placed.push(event);
      continue;
    }

    let date = event.date;
    let replacement: AgendaEvent | null = null;
    // Search the same day first, then up to a week, never past an explicit deadline.
    for (let day = 0; day < 7 && !replacement; day += 1) {
      if (event.deadline && date > event.deadline) break;
      for (
        let start = 8 * 60 + (event.preparationMinutes ?? 0);
        start + event.duration <= 20 * 60;
        start += 15
      ) {
        const candidate = {
          ...event,
          date,
          time: `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`,
        };
        const dependency = candidate.dependsOnId
          ? placed.find((item) => item.id === candidate.dependsOnId)
          : null;
        const dependencyMet =
          !dependency ||
          `${candidate.date}T${candidate.time}` >=
            `${dependency.date}T${endTime(dependency.time, dependency.duration)}`;
        if (
          dependencyMet &&
          !placed.some((other) => overlaps(candidate, other))
        ) {
          replacement = candidate;
          break;
        }
      }
      date = nextDate(date);
    }
    if (replacement) placed.push(replacement);
    else {
      unresolved.push(event);
      placed.push(event);
    }
  }

  const moves: ReplanMove[] = placed.flatMap((event) => {
    const original = originalById.get(event.id);
    return event.id !== changedEvent.id &&
      original &&
      (original.date !== event.date || original.time !== event.time)
      ? [
          {
            id: event.id,
            title: event.title,
            fromDate: original.date,
            fromTime: original.time,
            toDate: event.date,
            toTime: event.time,
          },
        ]
      : [];
  });

  return { events: sortEvents(placed), moves, unresolved };
}

export function replanDraftItems(
  items: PlannedItem[],
  changedId: string,
  savedEvents: AgendaEvent[],
) {
  const editableEvents: AgendaEvent[] = items.flatMap((item) =>
    item.time
      ? [
          {
            ...item,
            time: item.time,
          },
        ]
      : [],
  );
  const changed = editableEvents.find((event) => event.id === changedId);
  if (!changed) return items;
  const savedAsLocked = savedEvents.map((event) => ({
    ...event,
    flexibility: "fixed" as const,
  }));
  const result = replanAgenda([...savedAsLocked, ...editableEvents], changed);
  const byId = new Map(result.events.map((event) => [event.id, event]));
  const unresolvedIds = new Set(result.unresolved.map((event) => event.id));
  const draftIds = new Set(items.map((item) => item.id));
  if (result.unresolved.some((event) => !draftIds.has(event.id)))
    unresolvedIds.add(changedId);
  return sortPlanItems(
    items.map((item) => {
      const replanned = byId.get(item.id);
      return replanned
        ? {
            ...item,
            date: replanned.date,
            time: replanned.time,
            conflict: unresolvedIds.has(item.id)
              ? "otro compromiso fijo"
              : null,
            needsReview: unresolvedIds.has(item.id),
          }
        : item;
    }),
  );
}
