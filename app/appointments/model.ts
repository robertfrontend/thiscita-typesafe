import type {
  AgendaEvent,
  AgendaReply,
  Effort,
  Intent,
  PlannedItem,
  PlanReply,
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
) {
  // Proposed and saved events share the same busy-slot list, preventing a new task
  // from colliding with either committed events or other items in the current draft.
  const busy = [
    ...plan
      .filter((item) => item.date === date && item.time)
      .map((item) => ({
        start: toMinutes(item.time as string),
        end: toMinutes(item.time as string) + item.duration,
      })),
    ...savedEvents
      .filter((item) => item.date === date)
      .map((item) => ({
        start: toMinutes(item.time),
        end: toMinutes(item.time) + item.duration,
      })),
  ];

  for (let start = 8 * 60; start + duration <= 20 * 60; start += 15) {
    const overlaps = busy.some(
      (slot) => start < slot.end && start + duration > slot.start,
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
        );
    prepared.push({
      ...item,
      id: crypto.randomUUID(),
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
    details: "Creado desde OBRA · Agenda personal",
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function eventFromReply(reply: AgendaReply, events: AgendaEvent[]) {
  if (reply.intent === "create" && reply.title && reply.date && reply.time) {
    return {
      id: "draft",
      title: reply.title,
      date: reply.date,
      time: reply.time,
      duration: reply.duration ?? 60,
      priority: reply.priority ?? "medium",
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
      };
    }
  }

  if (reply.intent === "cancel" && reply.targetEventId) {
    return events.find((event) => event.id === reply.targetEventId) ?? null;
  }

  return null;
}
