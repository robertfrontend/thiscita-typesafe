import {
  calendarUrl,
  effortLabel,
  endTime,
  intentLabel,
  optionsForTime,
  priorityLabel,
  readableDate,
  readableTime,
} from "./model";
import type {
  AgendaEvent,
  AgendaReply,
  ChatMessage,
  PlannedItem,
  PlanReply,
  Priority,
  SessionResult,
} from "./types";

export function VoiceMeter() {
  return (
    <span className="voice-meter" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function ChatHistory({
  messages,
  loading,
}: {
  messages: ChatMessage[];
  loading: boolean;
}) {
  return (
    <div className="chat-log" aria-live="polite">
      {messages.map((item, index) => (
        <p className={item.role} key={`${item.role}-${index}`}>
          {item.text}
        </p>
      ))}
      {loading && <p className="assistant typing">Interpretando…</p>}
    </div>
  );
}

type DraftPanelProps = {
  draft: AgendaReply;
  pending: AgendaReply | null;
  live: boolean;
  preview: AgendaEvent | null;
  conflicts: AgendaEvent[];
  onDismiss: () => void;
  onConfirm: () => void;
  onPriorityChange: (priority: Priority) => void;
};

export function DraftPanel({
  draft,
  pending,
  live,
  preview,
  conflicts,
  onDismiss,
  onConfirm,
  onPriorityChange,
}: DraftPanelProps) {
  return (
    <section
      className={`agenda-draft ${draft.needsClarification ? "incomplete" : ""}`}
      aria-live="polite"
    >
      <header>
        <span>{live ? "Borrador en vivo" : "Esperando confirmación"}</span>
        <strong>
          {intentLabel[draft.intent]} ·{" "}
          {Math.round(draft.intentProbability * 100)}%
        </strong>
      </header>
      {preview ? (
        <div>
          <div>
            <small>Evento</small>
            <b>{preview.title}</b>
          </div>
          <div>
            <small>Día</small>
            <b>{readableDate(preview.date)}</b>
          </div>
          <div>
            <small>Hora</small>
            <b>
              {readableTime(preview.time)}
              {draft.timeAmbiguous ? " · ¿mañana o tarde?" : ""}
            </b>
          </div>
          <div>
            <small>Prioridad</small>
            {pending && !live && pending.intent !== "cancel" ? (
              <select
                value={preview.priority}
                onChange={(event) =>
                  onPriorityChange(event.target.value as Priority)
                }
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            ) : (
              <b className={`priority-${preview.priority}`}>
                {priorityLabel[preview.priority]}
              </b>
            )}
          </div>
        </div>
      ) : (
        <p>Faltan datos para preparar el cambio.</p>
      )}
      {conflicts.length > 0 && (
        <p className="agenda-conflict">
          Coincide con: {conflicts.map((event) => event.title).join(", ")}
        </p>
      )}
      {pending && !live && (
        <footer>
          <button type="button" className="draft-dismiss" onClick={onDismiss}>
            Descartar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending.needsClarification}
          >
            {pending.intent === "cancel"
              ? "Confirmar eliminación"
              : conflicts.length
                ? "Guardar de todos modos"
                : "Confirmar"}
          </button>
        </footer>
      )}
    </section>
  );
}

type DayPlanProps = {
  plan: PlanReply;
  onChange: (id: string, changes: Partial<PlannedItem>) => void;
  onDismiss: () => void;
  onConfirm: () => void;
};

export function DayPlan({
  plan,
  onChange,
  onDismiss,
  onConfirm,
}: DayPlanProps) {
  return (
    <section className="day-plan" aria-live="polite">
      <header>
        <div>
          <span>Plan propuesto</span>
          <strong>
            {plan.items.length} tareas · {plan.decisionCount} decisiones
          </strong>
          <small>Continúa hablando para editarlo</small>
        </div>
        <time>{plan.responseLatencyMs} ms</time>
      </header>
      <div className="day-plan-list">
        {plan.items.map((item, index) => (
          <article
            className={item.needsReview ? "needs-review" : ""}
            key={item.id}
          >
            <span className="plan-order">
              {String(index + 1).padStart(2, "0")}
            </span>
            <label className="plan-time">
              <span>Hora</span>
              <select
                aria-label={`Hora de ${item.title}`}
                value={item.time ?? ""}
                onChange={(event) =>
                  onChange(item.id, {
                    time: event.target.value || null,
                    needsReview: false,
                    conflict: null,
                  })
                }
              >
                <option value="">Elegir</option>
                {optionsForTime(item.time).map((time) => (
                  <option value={time} key={time}>
                    {readableTime(time)}
                  </option>
                ))}
              </select>
              {item.time && (
                <small>
                  hasta {readableTime(endTime(item.time, item.duration))}
                </small>
              )}
            </label>
            <div>
              <h3>{item.title}</h3>
              <p>
                {readableDate(item.date)} · {item.duration} min ·{" "}
                {effortLabel[item.effort]}
              </p>
            </div>
            <select
              aria-label={`Prioridad de ${item.title}`}
              value={item.priority}
              onChange={(event) =>
                onChange(item.id, { priority: event.target.value as Priority })
              }
            >
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
            </select>
            {item.conflict && (
              <p className="plan-warning">Coincide con {item.conflict}</p>
            )}
            {item.needsReview && !item.conflict && (
              <p className="plan-warning">Revisa la hora</p>
            )}
          </article>
        ))}
      </div>
      <footer>
        <span>
          {plan.source === "typesafe"
            ? `${plan.usage.input_tokens} tokens TypeSafe`
            : "Modo demo"}
        </span>
        <div>
          <button type="button" className="draft-dismiss" onClick={onDismiss}>
            Descartar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={plan.items.some((item) => !item.time)}
          >
            Guardar plan
          </button>
        </div>
      </footer>
    </section>
  );
}

export function ListeningStatus({
  analyzing,
  draft,
  onStop,
}: {
  analyzing: boolean;
  draft: AgendaReply | null;
  onStop: () => void;
}) {
  return (
    <div className="voice-status" role="status">
      <VoiceMeter />
      <div>
        <strong>{analyzing ? "Interpretando en vivo…" : "Escuchando…"}</strong>
        <small>
          {draft
            ? `${draft.source === "typesafe" ? "TypeSafe" : "Demo"} · ${draft.responseLatencyMs} ms`
            : "Habla con naturalidad · hasta 60 segundos"}
        </small>
      </div>
      <button type="button" onClick={onStop}>
        Terminar
      </button>
    </div>
  );
}

type AgendaListProps = {
  events: AgendaEvent[];
  storageReady: boolean;
  onPriorityChange: (id: string, priority: Priority) => void;
  onDelete: (id: string) => void;
};

export function AgendaList({
  events,
  storageReady,
  onPriorityChange,
  onDelete,
}: AgendaListProps) {
  return (
    <aside className="personal-agenda-list">
      <header>
        <div>
          <p>Mi lista</p>
          <h2>
            {events.length} evento{events.length === 1 ? "" : "s"}
          </h2>
        </div>
        <span>{storageReady ? "Local" : "Cargando"}</span>
      </header>
      {events.length ? (
        <div className="personal-events">
          {events.map((event) => (
            <article key={event.id}>
              <time dateTime={`${event.date}T${event.time}`}>
                <b>{readableTime(event.time)}</b>
                <span>{readableDate(event.date)}</span>
              </time>
              <div>
                <h3>{event.title}</h3>
                <p>{event.duration} minutos</p>
              </div>
              <div className="event-actions">
                <select
                  aria-label={`Prioridad de ${event.title}`}
                  value={event.priority}
                  onChange={(change) =>
                    onPriorityChange(event.id, change.target.value as Priority)
                  }
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
                <a href={calendarUrl(event)} target="_blank" rel="noreferrer">
                  Google Calendar
                </a>
                <button
                  type="button"
                  onClick={() => onDelete(event.id)}
                  aria-label={`Eliminar ${event.title}`}
                >
                  ×
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="agenda-empty">
          <span>◷</span>
          <p>Habla o escribe para crear tu primera cita.</p>
        </div>
      )}
    </aside>
  );
}

export function SessionResults({ sessions }: { sessions: SessionResult[] }) {
  if (!sessions.length) return null;
  return (
    <section
      className="agenda-session-results"
      aria-labelledby="agenda-results-title"
    >
      <header>
        <div>
          <p>Registro de decisiones</p>
          <h2 id="agenda-results-title">Respuestas de TypeSafe</h2>
        </div>
        <span>
          {sessions.length} turno{sessions.length === 1 ? "" : "s"}
        </span>
      </header>
      <div>
        {sessions.map((session) => (
          <article key={session.id}>
            <span>Turno {String(session.id).padStart(2, "0")}</span>
            <p>“{session.query}”</p>
            <strong>
              {intentLabel[session.intent]}{" "}
              {Math.round(session.intentProbability * 100)}%
              {session.priority ? ` · ${priorityLabel[session.priority]}` : ""}
            </strong>
            <time>{session.responseLatencyMs} ms</time>
            <small>
              {session.source === "typesafe"
                ? `${session.usage.input_tokens} tokens`
                : "modo demo"}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}
