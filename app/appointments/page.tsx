"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Kicker, Masthead } from "../components/ui";
import {
  AgendaList,
  ChatHistory,
  DayPlan,
  DraftPanel,
  ListeningStatus,
  SessionResults,
  VoiceMeter,
} from "./components";
import type {
  AgendaEvent,
  AgendaReply,
  ChatMessage,
  PlannedItem,
  PlanReply,
  Priority,
  SessionResult,
  SpeechRecognitionConstructor,
  SpeechRecognitionInstance,
} from "./types";

import {
  additionsForPlan,
  eventFromReply,
  intentLabel,
  nextPlanTime,
  readableTime,
  replanAgenda,
  replanDraftItems,
  sortEvents,
  sortPlanItems,
  toMinutes,
} from "./model";

export default function AppointmentsPage() {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Cuéntame todo lo que tienes que hacer. Puedo organizar varias tareas de una vez.",
    },
  ]);
  const [pending, setPending] = useState<AgendaReply | null>(null);
  const [pendingPlan, setPendingPlan] = useState<PlanReply | null>(null);
  const [liveDraft, setLiveDraft] = useState<AgendaReply | null>(null);
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [liveAnalyzing, setLiveAnalyzing] = useState(false);
  const [error, setError] = useState("");
  // Refs expose current state to speech-recognition callbacks without recreating the
  // browser recognition session after every render.
  const eventsRef = useRef<AgendaEvent[]>([]);
  const pendingRef = useRef<AgendaReply | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const listeningRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const visibleTranscriptRef = useRef("");
  const listeningTimerRef = useRef<number | null>(null);
  const liveTimerRef = useRef<number | null>(null);
  const liveAbortRef = useRef<AbortController | null>(null);
  const lastLiveCallAtRef = useRef(0);
  const lastAnalyzedTranscriptRef = useRef("");
  const sessionCounterRef = useRef(0);

  useEffect(() => {
    // Agenda data is browser-local. Invalid or outdated storage is discarded instead
    // of preventing the application from loading.
    try {
      const saved = localStorage.getItem("obra-personal-agenda");
      if (saved)
        setEvents(
          sortEvents(
            (JSON.parse(saved) as AgendaEvent[]).map((event) => ({
              ...event,
              priority: event.priority ?? "medium",
              flexibility: event.flexibility ?? "fixed",
              preparationKind: event.preparationKind ?? "none",
              preparationMinutes: event.preparationMinutes ?? 0,
              deadline: event.deadline ?? null,
              dependsOnId: event.dependsOnId ?? null,
            })),
          ),
        );
    } catch {
      localStorage.removeItem("obra-personal-agenda");
    }
    setStorageReady(true);
  }, []);
  useEffect(() => {
    eventsRef.current = events;
    if (storageReady)
      localStorage.setItem("obra-personal-agenda", JSON.stringify(events));
  }, [events, storageReady]);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(
    () => () => {
      listeningRef.current = false;
      recognitionRef.current?.stop();
      liveAbortRef.current?.abort();
      if (listeningTimerRef.current)
        window.clearTimeout(listeningTimerRef.current);
      if (liveTimerRef.current) window.clearTimeout(liveTimerRef.current);
    },
    [],
  );

  function mergeConversation(reply: AgendaReply) {
    // Follow-up phrases such as "tomorrow at three" complete the current draft while
    // preserving fields already understood in the previous turn.
    const previous = pendingRef.current;
    if (
      !previous ||
      previous.intent !== "create" ||
      (reply.intent !== "create" &&
        !(reply.intent === "update" && !reply.targetEventId))
    )
      return reply;
    const merged = {
      ...reply,
      intent: "create" as const,
      title: reply.title ?? previous.title,
      date: reply.date ?? previous.date,
      time: reply.time ?? previous.time,
      duration: reply.duration ?? previous.duration,
      priority: reply.priority ?? previous.priority,
      preparationKind:
        reply.preparationKind === "none"
          ? previous.preparationKind
          : reply.preparationKind,
      preparationMinutes:
        reply.preparationMinutes || previous.preparationMinutes,
      deadline: reply.deadline ?? previous.deadline,
      dependsOnId: reply.dependsOnId ?? previous.dependsOnId,
      targetEventId: null,
    };
    return {
      ...merged,
      needsClarification:
        !merged.title || !merged.date || !merged.time || merged.timeAmbiguous,
    };
  }

  async function requestInterpretation(
    text: string,
    signal?: AbortSignal,
    contextEvents = eventsRef.current,
    merge = true,
  ) {
    const response = await fetch("/api/interpret-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, events: contextEvents }),
      signal,
    });
    const body = (await response.json()) as AgendaReply & { error?: string };
    if (!response.ok)
      throw new Error(body.error ?? "No pudimos interpretar el mensaje.");
    return merge ? mergeConversation(body) : body;
  }

  async function requestPlan(text: string, contextEvents = eventsRef.current) {
    const response = await fetch("/api/plan-agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, events: contextEvents }),
    });
    const body = (await response.json()) as PlanReply & { error?: string };
    if (!response.ok)
      throw new Error(body.error ?? "No pudimos preparar el plan.");
    return body;
  }

  function planEvents(plan: PlanReply) {
    return plan.items
      .filter((item): item is PlannedItem & { time: string } =>
        Boolean(item.time),
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        date: item.date,
        time: item.time,
        duration: item.duration,
        priority: item.priority,
        effort: item.effort,
        flexibility: item.flexibility,
        preparationKind: item.preparationKind,
        preparationMinutes: item.preparationMinutes,
        deadline: item.deadline,
        dependsOnId: item.dependsOnId,
      }));
  }

  function recordSession(reply: AgendaReply, query: string) {
    sessionCounterRef.current += 1;
    setSessions((items) => [
      ...items,
      { ...reply, id: sessionCounterRef.current, query },
    ]);
  }

  async function editCurrentPlan(query: string, plan: PlanReply) {
    // While a plan is open, the same conversation becomes an editor. Commands can add,
    // move, reprioritize, or remove draft tasks before any event is persisted.
    const context = planEvents(plan);
    const reply = await requestInterpretation(query, undefined, context, false);
    recordSession(reply, query);
    setLiveDraft(null);
    if (reply.intent === "plan") {
      const additions = await requestPlan(query, [
        ...eventsRef.current,
        ...context,
      ]);
      const newItems = additionsForPlan(
        plan,
        additions.items,
        reply.date,
        eventsRef.current,
      );
      setPendingPlan({
        ...plan,
        items: sortPlanItems([...plan.items, ...newItems]),
        responseLatencyMs:
          reply.responseLatencyMs + additions.responseLatencyMs,
        decisionCount: plan.decisionCount + additions.decisionCount,
        usage: {
          input_tokens: plan.usage.input_tokens + additions.usage.input_tokens,
          output_tokens:
            plan.usage.output_tokens + additions.usage.output_tokens,
        },
      });
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          text: `Agregué ${newItems.length} tareas al plan.`,
        },
      ]);
      return;
    }
    if (reply.intent === "cancel" && reply.targetEventId) {
      const target = plan.items.find((item) => item.id === reply.targetEventId);
      setPendingPlan({
        ...plan,
        items: plan.items.filter((item) => item.id !== reply.targetEventId),
      });
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          text: `Quité “${target?.title ?? "la tarea"}” del plan.`,
        },
      ]);
      return;
    }
    if (reply.intent === "update" && reply.targetEventId) {
      const target = plan.items.find((item) => item.id === reply.targetEventId);
      if (reply.timeAmbiguous) {
        setMessages((items) => [
          ...items,
          {
            role: "assistant",
            text: `¿${readableTime(reply.time ?? "00:00")} es de la mañana o de la tarde?`,
          },
        ]);
        return;
      }
      setPendingPlan({
        ...plan,
        items: sortPlanItems(
          plan.items.map((item) =>
            item.id === reply.targetEventId
              ? {
                  ...item,
                  date: reply.date ?? item.date,
                  time: reply.time ?? item.time,
                  duration: reply.duration ?? item.duration,
                  priority: reply.priority ?? item.priority,
                  needsReview: false,
                  conflict: null,
                }
              : item,
          ),
        ),
      });
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          text: `Actualicé “${target?.title ?? "la tarea"}” en el plan.`,
        },
      ]);
      return;
    }
    if (reply.intent === "create" && reply.title) {
      if (reply.timeAmbiguous) {
        setMessages((items) => [
          ...items,
          {
            role: "assistant",
            text: `¿${readableTime(reply.time ?? "00:00")} es de la mañana o de la tarde?`,
          },
        ]);
        return;
      }
      if (/[,;]|\s+y\s+/i.test(query)) {
        try {
          const additions = await requestPlan(query, [
            ...eventsRef.current,
            ...context,
          ]);
          if (additions.items.length > 1) {
            const newItems = additionsForPlan(
              plan,
              additions.items,
              reply.date,
              eventsRef.current,
            );
            setPendingPlan({
              ...plan,
              items: sortPlanItems([...plan.items, ...newItems]),
              responseLatencyMs:
                reply.responseLatencyMs + additions.responseLatencyMs,
              decisionCount: plan.decisionCount + additions.decisionCount,
              usage: {
                input_tokens:
                  plan.usage.input_tokens + additions.usage.input_tokens,
                output_tokens:
                  plan.usage.output_tokens + additions.usage.output_tokens,
              },
            });
            setMessages((items) => [
              ...items,
              {
                role: "assistant",
                text: `Agregué ${newItems.length} tareas al plan.`,
              },
            ]);
            return;
          }
        } catch {
          /* Continue as one task when the phrase is not a list. */
        }
      }
      const date =
        reply.date ??
        plan.items[0]?.date ??
        new Date().toISOString().slice(0, 10);
      const duration = reply.duration ?? 60;
      const time =
        reply.time ??
        nextPlanTime(date, duration, plan.items, eventsRef.current);
      const added: PlannedItem = {
        id: crypto.randomUUID(),
        title: reply.title,
        date,
        time,
        duration,
        priority: reply.priority ?? "medium",
        effort: "medium",
        flexibility: reply.time ? "fixed" : "flexible",
        preparationKind: reply.preparationKind,
        preparationMinutes: reply.preparationMinutes,
        deadline: reply.deadline,
        dependsOnId: reply.dependsOnId,
        confidence: reply.intentProbability,
        conflict: null,
        needsReview: !time,
      };
      setPendingPlan({ ...plan, items: sortPlanItems([...plan.items, added]) });
      setMessages((items) => [
        ...items,
        { role: "assistant", text: `Agregué “${added.title}” al plan.` },
      ]);
      return;
    }
    if (reply.intent === "list") {
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          text: `El plan tiene ${plan.items.length} tareas.`,
        },
      ]);
      return;
    }
    setMessages((items) => [
      ...items,
      {
        role: "assistant",
        text: "No pude aplicar ese cambio. Dime qué tarea quieres agregar, mover o eliminar.",
      },
    ]);
  }

  async function analyzeLive(text: string) {
    const transcript = text.trim();
    if (
      transcript.length < 3 ||
      transcript === lastAnalyzedTranscriptRef.current
    )
      return;
    lastAnalyzedTranscriptRef.current = transcript;
    // Partial transcripts become stale quickly. Cancel the previous interpretation so
    // only the newest spoken phrase can update the live preview.
    liveAbortRef.current?.abort();
    const controller = new AbortController();
    liveAbortRef.current = controller;
    setLiveAnalyzing(true);
    try {
      const reply = pendingPlan
        ? await requestInterpretation(
            transcript,
            controller.signal,
            planEvents(pendingPlan),
            false,
          )
        : await requestInterpretation(transcript, controller.signal);
      if (!controller.signal.aborted) setLiveDraft(reply);
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError"))
        setError(
          "La interpretación en vivo se interrumpió. Puedes seguir hablando.",
        );
    } finally {
      if (liveAbortRef.current === controller) {
        liveAbortRef.current = null;
        setLiveAnalyzing(false);
      }
    }
  }

  function queueLiveAnalysis(text: string) {
    const transcript = text.trim();
    if (
      transcript.length < 3 ||
      transcript === lastAnalyzedTranscriptRef.current
    )
      return;
    if (liveTimerRef.current) window.clearTimeout(liveTimerRef.current);
    // Throttle continuous speech to avoid one API request per recognition event while
    // still updating the preview during a longer utterance.
    const elapsed = Date.now() - lastLiveCallAtRef.current;
    const delay = Math.max(0, 1_500 - elapsed);
    liveTimerRef.current = window.setTimeout(() => {
      lastLiveCallAtRef.current = Date.now();
      void analyzeLive(transcript);
    }, delay);
  }

  function responseText(reply: AgendaReply) {
    if (reply.intent === "list")
      return eventsRef.current.length
        ? `Tienes ${eventsRef.current.length} evento${eventsRef.current.length === 1 ? "" : "s"} en tu agenda.`
        : "Tu agenda está vacía.";
    if (reply.intent === "plan")
      return "Detecté varias tareas. Estoy preparando el mejor orden para tu día.";
    if (reply.needsClarification) {
      if (reply.timeAmbiguous)
        return `¿${readableTime(reply.time ?? "00:00")} es de la mañana o de la tarde?`;
      if (reply.intent === "create")
        return `Tengo ${reply.title ?? "el evento"}. Dime ${[reply.date ? "" : "el día", reply.time ? "" : "la hora"].filter(Boolean).join(" y ") || "qué quieres ajustar"}.`;
      if (reply.intent === "update" || reply.intent === "cancel")
        return "¿Cuál evento de tu agenda quieres modificar?";
      return "Dime si quieres crear, cambiar, cancelar o consultar una cita.";
    }
    return `${intentLabel[reply.intent]}: revisa el borrador y confirma el cambio.`;
  }

  async function send(text: string) {
    const query = text.trim();
    if (!query || loading) return;
    if (liveTimerRef.current) window.clearTimeout(liveTimerRef.current);
    liveAbortRef.current?.abort();
    setLoading(true);
    setLiveAnalyzing(false);
    setError("");
    setMessages((items) => [...items, { role: "user", text: query }]);
    setMessage("");
    try {
      if (pendingPlan) {
        await editCurrentPlan(query, pendingPlan);
        return;
      }
      const reply = await requestInterpretation(query);
      recordSession(reply, query);
      setLiveDraft(null);
      if (reply.intent === "plan") {
        const plan = await requestPlan(query);
        setPendingPlan(plan);
        setPending(null);
        pendingRef.current = null;
        setMessages((items) => [
          ...items,
          {
            role: "assistant",
            text: `Organicé ${plan.items.length} tareas según prioridad, esfuerzo y disponibilidad.`,
          },
        ]);
      } else {
        setPendingPlan(null);
        if (reply.intent === "list") {
          setPending(null);
          pendingRef.current = null;
        } else {
          setPending(reply);
          pendingRef.current = reply;
        }
        setMessages((items) => [
          ...items,
          { role: "assistant", text: responseText(reply) },
        ]);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos interpretar el mensaje.",
      );
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(message);
  }

  function confirmPending() {
    if (!pending || pending.needsClarification) return;
    const preview = eventFromReply(pending, eventsRef.current);
    if (!preview) return;
    if (pending.intent === "create") {
      const created = { ...preview, id: crypto.randomUUID() };
      const replanned = replanAgenda(eventsRef.current, {
        ...created,
        id: "draft",
      });
      setEvents(
        sortEvents(
          replanned.events.map((event) =>
            event.id === "draft" ? created : event,
          ),
        ),
      );
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          text: `Guardé “${created.title}”${replanned.moves.length ? ` y reorganicé ${replanned.moves.length} tarea${replanned.moves.length === 1 ? "" : "s"}` : ""}.`,
        },
      ]);
    }
    if (pending.intent === "update" && pending.targetEventId) {
      const replanned = replanAgenda(eventsRef.current, preview);
      setEvents(replanned.events);
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          text: `Actualicé “${preview.title}”${replanned.moves.length ? ` y reorganicé ${replanned.moves.length} tarea${replanned.moves.length === 1 ? "" : "s"}` : ""}.`,
        },
      ]);
    }
    if (pending.intent === "cancel" && pending.targetEventId) {
      setEvents((items) =>
        items.filter((event) => event.id !== pending.targetEventId),
      );
      setMessages((items) => [
        ...items,
        { role: "assistant", text: `Eliminé “${preview.title}” de tu agenda.` },
      ]);
    }
    setPending(null);
    pendingRef.current = null;
  }

  function changePendingPriority(priority: Priority) {
    setPending((current) => {
      if (!current) return current;
      const updated = { ...current, priority, priorityProbability: 1 };
      pendingRef.current = updated;
      return updated;
    });
  }

  function changePlanItem(id: string, changes: Partial<PlannedItem>) {
    setPendingPlan((plan) =>
      plan
        ? {
            ...plan,
            items: replanDraftItems(
              plan.items.map((item) =>
                item.id === id ? { ...item, ...changes } : item,
              ),
              id,
              eventsRef.current,
            ),
          }
        : plan,
    );
  }

  function confirmPlan() {
    if (!pendingPlan || pendingPlan.items.some((item) => !item.time)) return;
    const idMap = new Map(
      pendingPlan.items.map((item) => [item.id, crypto.randomUUID()]),
    );
    const created = pendingPlan.items.map((item) => ({
      id: idMap.get(item.id) as string,
      title: item.title,
      date: item.date,
      time: item.time as string,
      duration: item.duration,
      priority: item.priority,
      effort: item.effort,
      flexibility: item.flexibility,
      preparationKind: item.preparationKind,
      preparationMinutes: item.preparationMinutes,
      deadline: item.deadline,
      dependsOnId: item.dependsOnId
        ? (idMap.get(item.dependsOnId) ?? item.dependsOnId)
        : null,
    }));
    setEvents((items) => sortEvents([...items, ...created]));
    setMessages((items) => [
      ...items,
      {
        role: "assistant",
        text: `Guardé ${created.length} tareas en tu agenda.`,
      },
    ]);
    setPendingPlan(null);
  }

  function stopListening(sendAfter = true) {
    listeningRef.current = false;
    setListening(false);
    if (listeningTimerRef.current)
      window.clearTimeout(listeningTimerRef.current);
    if (liveTimerRef.current) window.clearTimeout(liveTimerRef.current);
    recognitionRef.current?.stop();
    if (sendAfter)
      window.setTimeout(() => {
        const spoken = visibleTranscriptRef.current.trim();
        if (spoken) void send(spoken);
      }, 250);
  }

  function speak() {
    if (listening) {
      stopListening(true);
      return;
    }
    const BrowserWindow = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition =
      BrowserWindow.SpeechRecognition ?? BrowserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError(
        "Este navegador no permite reconocimiento de voz. Puedes escribir.",
      );
      return;
    }
    finalTranscriptRef.current = "";
    visibleTranscriptRef.current = "";
    lastAnalyzedTranscriptRef.current = "";
    lastLiveCallAtRef.current = 0;
    setMessage("");
    setError("");
    setLiveDraft(null);
    const recognition = new Recognition();
    recognition.lang = "es-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => {
      listeningRef.current = true;
      setListening(true);
    };
    recognition.onresult = (event) => {
      let interim = "";
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal)
          finalTranscriptRef.current =
            `${finalTranscriptRef.current} ${transcript}`.trim();
        else interim += transcript;
      }
      const visible = `${finalTranscriptRef.current} ${interim}`.trim();
      visibleTranscriptRef.current = visible;
      setMessage(visible);
      queueLiveAnalysis(visible);
    };
    recognition.onerror = (event) => {
      if (event.error !== "no-speech")
        setError("No pudimos escuchar. Intenta otra vez o escribe.");
    };
    recognition.onend = () => {
      if (listeningRef.current)
        window.setTimeout(() => {
          try {
            recognition.start();
          } catch {
            listeningRef.current = false;
            setListening(false);
          }
        }, 180);
      else setListening(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
    listeningTimerRef.current = window.setTimeout(
      () => stopListening(true),
      60_000,
    );
  }

  const activeDraft = liveDraft ?? pending;
  const preview = activeDraft
    ? eventFromReply(
        activeDraft,
        pendingPlan ? planEvents(pendingPlan) : events,
      )
    : null;
  const conflicts = useMemo(() => {
    if (!preview || activeDraft?.intent === "cancel") return [];
    const start = toMinutes(preview.time);
    const end = start + preview.duration;
    return events.filter(
      (event) =>
        event.id !== activeDraft?.targetEventId &&
        event.date === preview.date &&
        start < toMinutes(event.time) + event.duration &&
        end > toMinutes(event.time),
    );
  }, [activeDraft, events, preview]);
  const replanPreview = useMemo(
    () =>
      preview && activeDraft?.intent !== "cancel"
        ? replanAgenda(events, preview)
        : null,
    [activeDraft?.intent, events, preview],
  );

  return (
    <main className="personal-agenda-page">
      <Masthead module="Módulo 03 · Agenda personal">
        <Link
          className="ml-auto font-mono text-[11px] text-ink underline"
          href="/"
        >
          ← Inicio
        </Link>
      </Masthead>

      <section className="personal-agenda-hero">
        <Kicker>Planificador personal</Kicker>
        <h1>Vacía tu mente. Ordena tu día.</h1>
        <p>
          “Mañana debo terminar la propuesta, llamar al banco, buscar a mi hija
          a las 4 y entrenar.”
        </p>
      </section>

      <section className="personal-agenda-workspace">
        <section className="agenda-conversation">
          <ChatHistory messages={messages} loading={loading} />

          {activeDraft?.intent === "plan" && !pendingPlan && (
            <section className="plan-detected" aria-live="polite">
              <VoiceMeter />
              <div>
                <strong>Varias tareas detectadas</strong>
                <p>Termina el mensaje para construir el plan completo.</p>
              </div>
            </section>
          )}

          {activeDraft && activeDraft.intent !== "plan" && (
            <DraftPanel
              draft={activeDraft}
              pending={pending}
              live={Boolean(liveDraft)}
              preview={preview}
              conflicts={conflicts.filter(
                (event) =>
                  !replanPreview?.moves.some((move) => move.id === event.id),
              )}
              replanMoves={replanPreview?.moves ?? []}
              onDismiss={() => setPending(null)}
              onConfirm={confirmPending}
              onPriorityChange={changePendingPriority}
            />
          )}

          {pendingPlan && (
            <DayPlan
              plan={pendingPlan}
              onChange={changePlanItem}
              onDismiss={() => setPendingPlan(null)}
              onConfirm={confirmPlan}
            />
          )}

          {listening && (
            <ListeningStatus
              analyzing={liveAnalyzing}
              draft={liveDraft}
              onStop={() => stopListening(true)}
            />
          )}

          <form className="chat-compose" onSubmit={submit}>
            <label className="sr-only" htmlFor="agenda-message">
              Gestiona tu agenda
            </label>
            <input
              id="agenda-message"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                visibleTranscriptRef.current = event.target.value;
              }}
              placeholder="Ej. mañana: propuesta, banco, buscar a mi hija a las 4 y gimnasio"
            />
            <button
              type="button"
              className={listening ? "voice-button listening" : "voice-button"}
              onClick={speak}
              aria-label={listening ? "Detener escucha" : "Hablar"}
            >
              {listening ? "■" : "●"}
            </button>
            <button
              type="submit"
              disabled={loading || listening || !message.trim()}
            >
              Enviar
            </button>
          </form>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <small className="appointment-note">
            Tu lista se guarda solo en este navegador. Confirmas antes de cada
            cambio.
          </small>
        </section>

        <AgendaList
          events={events}
          storageReady={storageReady}
          onPriorityChange={(id, priority) =>
            setEvents((items) =>
              items.map((item) =>
                item.id === id ? { ...item, priority } : item,
              ),
            )
          }
          onDelete={(id) =>
            setEvents((items) => items.filter((item) => item.id !== id))
          }
        />
      </section>

      <SessionResults sessions={sessions} />
    </main>
  );
}
