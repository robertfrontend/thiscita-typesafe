"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Intent = "create" | "update" | "cancel" | "list" | "plan" | "unknown";
type Priority = "low" | "medium" | "high";
type Effort = "light" | "medium" | "deep";
type Flexibility = "fixed" | "flexible";
type AgendaEvent = { id: string; title: string; date: string; time: string; duration: number; priority: Priority; effort?: Effort; flexibility?: Flexibility };
type AgendaReply = { intent: Intent; intentProbability: number; intentProbabilities: Record<string, number>; targetEventId: string | null; targetProbability: number; title: string | null; date: string | null; time: string | null; timeAmbiguous: boolean; duration: number | null; priority: Priority | null; priorityProbability: number; needsClarification: boolean; source: "typesafe" | "demo"; responseLatencyMs: number; usage: { input_tokens: number; output_tokens: number } };
type PlannedItem = { id: string; title: string; date: string; time: string | null; duration: number; priority: Priority; effort: Effort; flexibility: Flexibility; confidence: number; conflict: string | null; needsReview: boolean };
type PlanReply = { items: PlannedItem[]; source: "typesafe" | "demo"; responseLatencyMs: number; decisionCount: number; usage: { input_tokens: number; output_tokens: number } };
type ChatMessage = { role: "assistant" | "user"; text: string };
type SessionResult = AgendaReply & { id: number; query: string };
type SpeechRecognitionResultLike = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type SpeechRecognitionInstance = { lang: string; continuous: boolean; interimResults: boolean; onstart: () => void; onend: () => void; onresult: (event: { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }) => void; onerror: (event: { error?: string }) => void; start: () => void; stop: () => void };
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const intentLabel: Record<Intent, string> = { create: "Crear", update: "Cambiar", cancel: "Cancelar", list: "Consultar", plan: "Planificar", unknown: "Aclarar" };
const priorityLabel: Record<Priority, string> = { low: "Baja", medium: "Media", high: "Alta" };
const effortLabel: Record<Effort, string> = { light: "Ligero", medium: "Medio", deep: "Profundo" };
const planTimeOptions = Array.from({ length: 72 }, (_, index) => { const total = 6 * 60 + index * 15; return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; });

function readableDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("es-US", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`)) : "Falta el día";
}

function readableTime(value: string) {
  return new Intl.DateTimeFormat("es-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(`2000-01-01T${value}:00`));
}

function endTime(value: string, duration: number) {
  const total = (toMinutes(value) + duration) % (24 * 60); return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function optionsForTime(value: string | null) {
  return value && !planTimeOptions.includes(value) ? [...planTimeOptions, value].sort() : planTimeOptions;
}

function sortEvents(events: AgendaEvent[]) {
  return [...events].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}

function sortPlanItems(items: PlannedItem[]) {
  return [...items].sort((a, b) => `${a.date}T${a.time ?? "99:99"}`.localeCompare(`${b.date}T${b.time ?? "99:99"}`));
}

function toMinutes(time: string) { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; }

function nextPlanTime(date: string, duration: number, plan: PlannedItem[], savedEvents: AgendaEvent[]) {
  const busy = [...plan.filter((item) => item.date === date && item.time).map((item) => ({ start: toMinutes(item.time as string), end: toMinutes(item.time as string) + item.duration })), ...savedEvents.filter((item) => item.date === date).map((item) => ({ start: toMinutes(item.time), end: toMinutes(item.time) + item.duration }))];
  for (let start = 8 * 60; start + duration <= 20 * 60; start += 15) if (!busy.some((slot) => start < slot.end && start + duration > slot.start)) return `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
  return null;
}

function additionsForPlan(plan: PlanReply, additions: PlannedItem[], requestedDate: string | null, savedEvents: AgendaEvent[]) {
  const prepared: PlannedItem[] = []; const defaultDate = requestedDate ?? plan.items[0]?.date ?? new Date().toISOString().slice(0, 10);
  for (const item of additions) { const date = requestedDate ? item.date : defaultDate; const time = requestedDate ? item.time : nextPlanTime(date, item.duration, [...plan.items, ...prepared], savedEvents); prepared.push({ ...item, id: crypto.randomUUID(), date, time, needsReview: !time }); }
  return prepared;
}

function calendarUrl(event: AgendaEvent) {
  const start = new Date(`${event.date}T${event.time}:00`); const end = new Date(start.getTime() + event.duration * 60_000);
  const stamp = (value: Date) => `${value.getFullYear()}${String(value.getMonth() + 1).padStart(2, "0")}${String(value.getDate()).padStart(2, "0")}T${String(value.getHours()).padStart(2, "0")}${String(value.getMinutes()).padStart(2, "0")}00`;
  const params = new URLSearchParams({ action: "TEMPLATE", text: event.title, dates: `${stamp(start)}/${stamp(end)}`, details: "Creado desde OBRA · Agenda personal", ctz: Intl.DateTimeFormat().resolvedOptions().timeZone });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function eventFromReply(reply: AgendaReply, events: AgendaEvent[]) {
  if (reply.intent === "create" && reply.title && reply.date && reply.time) return { id: "draft", title: reply.title, date: reply.date, time: reply.time, duration: reply.duration ?? 60, priority: reply.priority ?? "medium" };
  if (reply.intent === "update" && reply.targetEventId) { const target = events.find((event) => event.id === reply.targetEventId); if (target) return { ...target, date: reply.date ?? target.date, time: reply.time ?? target.time, duration: reply.duration ?? target.duration, priority: reply.priority ?? target.priority }; }
  if (reply.intent === "cancel" && reply.targetEventId) return events.find((event) => event.id === reply.targetEventId) ?? null;
  return null;
}

export default function AppointmentsPage() {
  const [events, setEvents] = useState<AgendaEvent[]>([]); const [storageReady, setStorageReady] = useState(false); const [message, setMessage] = useState(""); const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: "Cuéntame todo lo que tienes que hacer. Puedo organizar varias tareas de una vez." }]);
  const [pending, setPending] = useState<AgendaReply | null>(null); const [pendingPlan, setPendingPlan] = useState<PlanReply | null>(null); const [liveDraft, setLiveDraft] = useState<AgendaReply | null>(null); const [sessions, setSessions] = useState<SessionResult[]>([]); const [loading, setLoading] = useState(false); const [listening, setListening] = useState(false); const [liveAnalyzing, setLiveAnalyzing] = useState(false); const [error, setError] = useState("");
  const eventsRef = useRef<AgendaEvent[]>([]); const pendingRef = useRef<AgendaReply | null>(null); const recognitionRef = useRef<SpeechRecognitionInstance | null>(null); const listeningRef = useRef(false); const finalTranscriptRef = useRef(""); const visibleTranscriptRef = useRef(""); const listeningTimerRef = useRef<number | null>(null); const liveTimerRef = useRef<number | null>(null); const liveAbortRef = useRef<AbortController | null>(null); const lastLiveCallAtRef = useRef(0); const lastAnalyzedTranscriptRef = useRef(""); const sessionCounterRef = useRef(0);

  useEffect(() => { try { const saved = localStorage.getItem("obra-personal-agenda"); if (saved) setEvents(sortEvents((JSON.parse(saved) as AgendaEvent[]).map((event) => ({ ...event, priority: event.priority ?? "medium" })))); } catch { localStorage.removeItem("obra-personal-agenda"); } setStorageReady(true); }, []);
  useEffect(() => { eventsRef.current = events; if (storageReady) localStorage.setItem("obra-personal-agenda", JSON.stringify(events)); }, [events, storageReady]);
  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => () => { listeningRef.current = false; recognitionRef.current?.stop(); liveAbortRef.current?.abort(); if (listeningTimerRef.current) window.clearTimeout(listeningTimerRef.current); if (liveTimerRef.current) window.clearTimeout(liveTimerRef.current); }, []);

  function mergeConversation(reply: AgendaReply) {
    const previous = pendingRef.current; if (!previous || previous.intent !== "create" || (reply.intent !== "create" && !(reply.intent === "update" && !reply.targetEventId))) return reply;
    const merged = { ...reply, intent: "create" as const, title: reply.title ?? previous.title, date: reply.date ?? previous.date, time: reply.time ?? previous.time, duration: reply.duration ?? previous.duration, priority: reply.priority ?? previous.priority, targetEventId: null };
    return { ...merged, needsClarification: !merged.title || !merged.date || !merged.time || merged.timeAmbiguous };
  }

  async function requestInterpretation(text: string, signal?: AbortSignal, contextEvents = eventsRef.current, merge = true) {
    const response = await fetch("/api/interpret-appointment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, events: contextEvents }), signal });
    const body = await response.json() as AgendaReply & { error?: string }; if (!response.ok) throw new Error(body.error ?? "No pudimos interpretar el mensaje."); return merge ? mergeConversation(body) : body;
  }

  async function requestPlan(text: string, contextEvents = eventsRef.current) {
    const response = await fetch("/api/plan-agenda", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, events: contextEvents }) }); const body = await response.json() as PlanReply & { error?: string }; if (!response.ok) throw new Error(body.error ?? "No pudimos preparar el plan."); return body;
  }

  function planEvents(plan: PlanReply) {
    return plan.items.filter((item): item is PlannedItem & { time: string } => Boolean(item.time)).map((item) => ({ id: item.id, title: item.title, date: item.date, time: item.time, duration: item.duration, priority: item.priority }));
  }

  function recordSession(reply: AgendaReply, query: string) {
    sessionCounterRef.current += 1; setSessions((items) => [...items, { ...reply, id: sessionCounterRef.current, query }]);
  }

  async function editCurrentPlan(query: string, plan: PlanReply) {
    const context = planEvents(plan); const reply = await requestInterpretation(query, undefined, context, false); recordSession(reply, query); setLiveDraft(null);
    if (reply.intent === "plan") {
      const additions = await requestPlan(query, [...eventsRef.current, ...context]); const newItems = additionsForPlan(plan, additions.items, reply.date, eventsRef.current); setPendingPlan({ ...plan, items: sortPlanItems([...plan.items, ...newItems]), responseLatencyMs: reply.responseLatencyMs + additions.responseLatencyMs, decisionCount: plan.decisionCount + additions.decisionCount, usage: { input_tokens: plan.usage.input_tokens + additions.usage.input_tokens, output_tokens: plan.usage.output_tokens + additions.usage.output_tokens } }); setMessages((items) => [...items, { role: "assistant", text: `Agregué ${newItems.length} tareas al plan.` }]); return;
    }
    if (reply.intent === "cancel" && reply.targetEventId) {
      const target = plan.items.find((item) => item.id === reply.targetEventId); setPendingPlan({ ...plan, items: plan.items.filter((item) => item.id !== reply.targetEventId) }); setMessages((items) => [...items, { role: "assistant", text: `Quité “${target?.title ?? "la tarea"}” del plan.` }]); return;
    }
    if (reply.intent === "update" && reply.targetEventId) {
      const target = plan.items.find((item) => item.id === reply.targetEventId); if (reply.timeAmbiguous) { setMessages((items) => [...items, { role: "assistant", text: `¿${readableTime(reply.time ?? "00:00")} es de la mañana o de la tarde?` }]); return; }
      setPendingPlan({ ...plan, items: sortPlanItems(plan.items.map((item) => item.id === reply.targetEventId ? { ...item, date: reply.date ?? item.date, time: reply.time ?? item.time, duration: reply.duration ?? item.duration, priority: reply.priority ?? item.priority, needsReview: false, conflict: null } : item)) }); setMessages((items) => [...items, { role: "assistant", text: `Actualicé “${target?.title ?? "la tarea"}” en el plan.` }]); return;
    }
    if (reply.intent === "create" && reply.title) {
      if (reply.timeAmbiguous) { setMessages((items) => [...items, { role: "assistant", text: `¿${readableTime(reply.time ?? "00:00")} es de la mañana o de la tarde?` }]); return; }
      if (/[,;]|\s+y\s+/i.test(query)) {
        try { const additions = await requestPlan(query, [...eventsRef.current, ...context]); if (additions.items.length > 1) { const newItems = additionsForPlan(plan, additions.items, reply.date, eventsRef.current); setPendingPlan({ ...plan, items: sortPlanItems([...plan.items, ...newItems]), responseLatencyMs: reply.responseLatencyMs + additions.responseLatencyMs, decisionCount: plan.decisionCount + additions.decisionCount, usage: { input_tokens: plan.usage.input_tokens + additions.usage.input_tokens, output_tokens: plan.usage.output_tokens + additions.usage.output_tokens } }); setMessages((items) => [...items, { role: "assistant", text: `Agregué ${newItems.length} tareas al plan.` }]); return; } } catch { /* Continue as one task when the phrase is not a list. */ }
      }
      const date = reply.date ?? plan.items[0]?.date ?? new Date().toISOString().slice(0, 10); const duration = reply.duration ?? 60; const time = reply.time ?? nextPlanTime(date, duration, plan.items, eventsRef.current); const added: PlannedItem = { id: crypto.randomUUID(), title: reply.title, date, time, duration, priority: reply.priority ?? "medium", effort: "medium", flexibility: reply.time ? "fixed" : "flexible", confidence: reply.intentProbability, conflict: null, needsReview: !time }; setPendingPlan({ ...plan, items: sortPlanItems([...plan.items, added]) }); setMessages((items) => [...items, { role: "assistant", text: `Agregué “${added.title}” al plan.` }]); return;
    }
    if (reply.intent === "list") { setMessages((items) => [...items, { role: "assistant", text: `El plan tiene ${plan.items.length} tareas.` }]); return; }
    setMessages((items) => [...items, { role: "assistant", text: "No pude aplicar ese cambio. Dime qué tarea quieres agregar, mover o eliminar." }]);
  }

  async function analyzeLive(text: string) {
    const transcript = text.trim(); if (transcript.length < 3 || transcript === lastAnalyzedTranscriptRef.current) return; lastAnalyzedTranscriptRef.current = transcript; liveAbortRef.current?.abort(); const controller = new AbortController(); liveAbortRef.current = controller; setLiveAnalyzing(true);
    try { const reply = pendingPlan ? await requestInterpretation(transcript, controller.signal, planEvents(pendingPlan), false) : await requestInterpretation(transcript, controller.signal); if (!controller.signal.aborted) setLiveDraft(reply); }
    catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError("La interpretación en vivo se interrumpió. Puedes seguir hablando."); }
    finally { if (liveAbortRef.current === controller) { liveAbortRef.current = null; setLiveAnalyzing(false); } }
  }

  function queueLiveAnalysis(text: string) {
    const transcript = text.trim(); if (transcript.length < 3 || transcript === lastAnalyzedTranscriptRef.current) return; if (liveTimerRef.current) window.clearTimeout(liveTimerRef.current); const elapsed = Date.now() - lastLiveCallAtRef.current; const delay = Math.max(0, 1_500 - elapsed); liveTimerRef.current = window.setTimeout(() => { lastLiveCallAtRef.current = Date.now(); void analyzeLive(transcript); }, delay);
  }

  function responseText(reply: AgendaReply) {
    if (reply.intent === "list") return eventsRef.current.length ? `Tienes ${eventsRef.current.length} evento${eventsRef.current.length === 1 ? "" : "s"} en tu agenda.` : "Tu agenda está vacía.";
    if (reply.intent === "plan") return "Detecté varias tareas. Estoy preparando el mejor orden para tu día.";
    if (reply.needsClarification) { if (reply.timeAmbiguous) return `¿${readableTime(reply.time ?? "00:00")} es de la mañana o de la tarde?`; if (reply.intent === "create") return `Tengo ${reply.title ?? "el evento"}. Dime ${[reply.date ? "" : "el día", reply.time ? "" : "la hora"].filter(Boolean).join(" y ") || "qué quieres ajustar"}.`; if (reply.intent === "update" || reply.intent === "cancel") return "¿Cuál evento de tu agenda quieres modificar?"; return "Dime si quieres crear, cambiar, cancelar o consultar una cita."; }
    return `${intentLabel[reply.intent]}: revisa el borrador y confirma el cambio.`;
  }

  async function send(text: string) {
    const query = text.trim(); if (!query || loading) return; if (liveTimerRef.current) window.clearTimeout(liveTimerRef.current); liveAbortRef.current?.abort(); setLoading(true); setLiveAnalyzing(false); setError(""); setMessages((items) => [...items, { role: "user", text: query }]); setMessage("");
    try { if (pendingPlan) { await editCurrentPlan(query, pendingPlan); return; } const reply = await requestInterpretation(query); recordSession(reply, query); setLiveDraft(null); if (reply.intent === "plan") { const plan = await requestPlan(query); setPendingPlan(plan); setPending(null); pendingRef.current = null; setMessages((items) => [...items, { role: "assistant", text: `Organicé ${plan.items.length} tareas según prioridad, esfuerzo y disponibilidad.` }]); } else { setPendingPlan(null); if (reply.intent === "list") { setPending(null); pendingRef.current = null; } else { setPending(reply); pendingRef.current = reply; } setMessages((items) => [...items, { role: "assistant", text: responseText(reply) }]); } }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos interpretar el mensaje."); }
    finally { setLoading(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send(message); }

  function confirmPending() {
    if (!pending || pending.needsClarification) return; const preview = eventFromReply(pending, eventsRef.current); if (!preview) return;
    if (pending.intent === "create") { const created = { ...preview, id: crypto.randomUUID() }; setEvents((items) => sortEvents([...items, created])); setMessages((items) => [...items, { role: "assistant", text: `Guardé “${created.title}” en tu lista.` }]); }
    if (pending.intent === "update" && pending.targetEventId) { setEvents((items) => sortEvents(items.map((event) => event.id === pending.targetEventId ? preview : event))); setMessages((items) => [...items, { role: "assistant", text: `Actualicé “${preview.title}”.` }]); }
    if (pending.intent === "cancel" && pending.targetEventId) { setEvents((items) => items.filter((event) => event.id !== pending.targetEventId)); setMessages((items) => [...items, { role: "assistant", text: `Eliminé “${preview.title}” de tu agenda.` }]); }
    setPending(null); pendingRef.current = null;
  }

  function changePendingPriority(priority: Priority) {
    setPending((current) => { if (!current) return current; const updated = { ...current, priority, priorityProbability: 1 }; pendingRef.current = updated; return updated; });
  }

  function changePlanItem(id: string, changes: Partial<PlannedItem>) { setPendingPlan((plan) => plan ? { ...plan, items: plan.items.map((item) => item.id === id ? { ...item, ...changes } : item) } : plan); }

  function confirmPlan() {
    if (!pendingPlan || pendingPlan.items.some((item) => !item.time)) return; const created = pendingPlan.items.map((item) => ({ id: crypto.randomUUID(), title: item.title, date: item.date, time: item.time as string, duration: item.duration, priority: item.priority, effort: item.effort, flexibility: item.flexibility })); setEvents((items) => sortEvents([...items, ...created])); setMessages((items) => [...items, { role: "assistant", text: `Guardé ${created.length} tareas en tu agenda.` }]); setPendingPlan(null);
  }

  function stopListening(sendAfter = true) {
    listeningRef.current = false; setListening(false); if (listeningTimerRef.current) window.clearTimeout(listeningTimerRef.current); if (liveTimerRef.current) window.clearTimeout(liveTimerRef.current); recognitionRef.current?.stop(); if (sendAfter) window.setTimeout(() => { const spoken = visibleTranscriptRef.current.trim(); if (spoken) void send(spoken); }, 250);
  }

  function speak() {
    if (listening) { stopListening(true); return; } const BrowserWindow = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }; const Recognition = BrowserWindow.SpeechRecognition ?? BrowserWindow.webkitSpeechRecognition; if (!Recognition) { setError("Este navegador no permite reconocimiento de voz. Puedes escribir."); return; }
    finalTranscriptRef.current = ""; visibleTranscriptRef.current = ""; lastAnalyzedTranscriptRef.current = ""; lastLiveCallAtRef.current = 0; setMessage(""); setError(""); setLiveDraft(null); const recognition = new Recognition(); recognition.lang = "es-US"; recognition.continuous = true; recognition.interimResults = true;
    recognition.onstart = () => { listeningRef.current = true; setListening(true); };
    recognition.onresult = (event) => { let interim = ""; for (let index = event.resultIndex; index < event.results.length; index += 1) { const result = event.results[index]; const transcript = result[0]?.transcript ?? ""; if (result.isFinal) finalTranscriptRef.current = `${finalTranscriptRef.current} ${transcript}`.trim(); else interim += transcript; } const visible = `${finalTranscriptRef.current} ${interim}`.trim(); visibleTranscriptRef.current = visible; setMessage(visible); queueLiveAnalysis(visible); };
    recognition.onerror = (event) => { if (event.error !== "no-speech") setError("No pudimos escuchar. Intenta otra vez o escribe."); };
    recognition.onend = () => { if (listeningRef.current) window.setTimeout(() => { try { recognition.start(); } catch { listeningRef.current = false; setListening(false); } }, 180); else setListening(false); };
    recognitionRef.current = recognition; recognition.start(); listeningTimerRef.current = window.setTimeout(() => stopListening(true), 60_000);
  }

  const activeDraft = liveDraft ?? pending; const preview = activeDraft ? eventFromReply(activeDraft, pendingPlan ? planEvents(pendingPlan) : events) : null;
  const conflicts = useMemo(() => { if (!preview || activeDraft?.intent === "cancel") return []; const start = toMinutes(preview.time); const end = start + preview.duration; return events.filter((event) => event.id !== activeDraft?.targetEventId && event.date === preview.date && start < toMinutes(event.time) + event.duration && end > toMinutes(event.time)); }, [activeDraft, events, preview]);

  return <main className="personal-agenda-page">
    <header className="masthead"><a className="brand" href="/"><span>OBRA</span><i>β</i></a><span className="demo-tag">Módulo 03 · Agenda personal</span><a className="proposal-back" href="/">← Inicio</a></header>
    <section className="personal-agenda-hero"><p className="kicker"><span />Planificador personal</p><h1>Vacía tu mente. Ordena tu día.</h1><p>“Mañana debo terminar la propuesta, llamar al banco, buscar a mi hija a las 4 y entrenar.”</p></section>
    <section className="personal-agenda-workspace">
      <section className="agenda-conversation">
        <div className="chat-log" aria-live="polite">{messages.map((item, index) => <p className={item.role} key={`${item.role}-${index}`}>{item.text}</p>)}{loading && <p className="assistant typing">Interpretando…</p>}</div>
        {activeDraft?.intent === "plan" && !pendingPlan && <section className="plan-detected" aria-live="polite"><span className="voice-meter" aria-hidden="true"><i /><i /><i /></span><div><strong>Varias tareas detectadas</strong><p>Termina el mensaje para construir el plan completo.</p></div></section>}
        {activeDraft && activeDraft.intent !== "plan" && <section className={`agenda-draft ${activeDraft.needsClarification ? "incomplete" : ""}`} aria-live="polite"><header><span>{liveDraft ? "Borrador en vivo" : "Esperando confirmación"}</span><strong>{intentLabel[activeDraft.intent]} · {Math.round(activeDraft.intentProbability * 100)}%</strong></header>{preview ? <div><div><small>Evento</small><b>{preview.title}</b></div><div><small>Día</small><b>{readableDate(preview.date)}</b></div><div><small>Hora</small><b>{readableTime(preview.time)}{activeDraft.timeAmbiguous ? " · ¿mañana o tarde?" : ""}</b></div><div><small>Prioridad</small>{pending && !liveDraft && pending.intent !== "cancel" ? <select value={preview.priority} onChange={(event) => changePendingPriority(event.target.value as Priority)}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select> : <b className={`priority-${preview.priority}`}>{priorityLabel[preview.priority]}</b>}</div></div> : <p>Faltan datos para preparar el cambio.</p>}{conflicts.length > 0 && <p className="agenda-conflict">Coincide con: {conflicts.map((event) => event.title).join(", ")}</p>}{pending && !liveDraft && <footer><button type="button" className="draft-dismiss" onClick={() => setPending(null)}>Descartar</button><button type="button" onClick={confirmPending} disabled={pending.needsClarification}>{pending.intent === "cancel" ? "Confirmar eliminación" : conflicts.length ? "Guardar de todos modos" : "Confirmar"}</button></footer>}</section>}
        {pendingPlan && <section className="day-plan" aria-live="polite"><header><div><span>Plan propuesto</span><strong>{pendingPlan.items.length} tareas · {pendingPlan.decisionCount} decisiones</strong><small>Continúa hablando para editarlo</small></div><time>{pendingPlan.responseLatencyMs} ms</time></header><div className="day-plan-list">{pendingPlan.items.map((item, index) => <article className={item.needsReview ? "needs-review" : ""} key={item.id}><span className="plan-order">{String(index + 1).padStart(2, "0")}</span><label className="plan-time"><span>Hora</span><select aria-label={`Hora de ${item.title}`} value={item.time ?? ""} onChange={(event) => changePlanItem(item.id, { time: event.target.value || null, needsReview: false, conflict: null })}><option value="">Elegir</option>{optionsForTime(item.time).map((time) => <option value={time} key={time}>{readableTime(time)}</option>)}</select>{item.time && <small>hasta {readableTime(endTime(item.time, item.duration))}</small>}</label><div><h3>{item.title}</h3><p>{readableDate(item.date)} · {item.duration} min · {effortLabel[item.effort]}</p></div><select aria-label={`Prioridad de ${item.title}`} value={item.priority} onChange={(event) => changePlanItem(item.id, { priority: event.target.value as Priority })}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select>{item.conflict && <p className="plan-warning">Coincide con {item.conflict}</p>}{item.needsReview && !item.conflict && <p className="plan-warning">Revisa la hora</p>}</article>)}</div><footer><span>{pendingPlan.source === "typesafe" ? `${pendingPlan.usage.input_tokens} tokens TypeSafe` : "Modo demo"}</span><div><button type="button" className="draft-dismiss" onClick={() => setPendingPlan(null)}>Descartar</button><button type="button" onClick={confirmPlan} disabled={pendingPlan.items.some((item) => !item.time)}>Guardar plan</button></div></footer></section>}
        {listening && <div className="voice-status" role="status"><span className="voice-meter" aria-hidden="true"><i /><i /><i /></span><div><strong>{liveAnalyzing ? "Interpretando en vivo…" : "Escuchando…"}</strong><small>{liveDraft ? `${liveDraft.source === "typesafe" ? "TypeSafe" : "Demo"} · ${liveDraft.responseLatencyMs} ms` : "Habla con naturalidad · hasta 60 segundos"}</small></div><button type="button" onClick={() => stopListening(true)}>Terminar</button></div>}
        <form className="chat-compose" onSubmit={submit}><label className="sr-only" htmlFor="agenda-message">Gestiona tu agenda</label><input id="agenda-message" value={message} onChange={(event) => { setMessage(event.target.value); visibleTranscriptRef.current = event.target.value; }} placeholder="Ej. mañana: propuesta, banco, buscar a mi hija a las 4 y gimnasio" /><button type="button" className={listening ? "voice-button listening" : "voice-button"} onClick={speak} aria-label={listening ? "Detener escucha" : "Hablar"}>{listening ? "■" : "●"}</button><button type="submit" disabled={loading || listening || !message.trim()}>Enviar</button></form>
        {error && <p className="error" role="alert">{error}</p>}<small className="appointment-note">Tu lista se guarda solo en este navegador. Confirmas antes de cada cambio.</small>
      </section>
      <aside className="personal-agenda-list"><header><div><p>Mi lista</p><h2>{events.length} evento{events.length === 1 ? "" : "s"}</h2></div><span>{storageReady ? "Local" : "Cargando"}</span></header>{events.length ? <div className="personal-events">{events.map((event) => <article key={event.id}><time dateTime={`${event.date}T${event.time}`}><b>{readableTime(event.time)}</b><span>{readableDate(event.date)}</span></time><div><h3>{event.title}</h3><p>{event.duration} minutos</p></div><div className="event-actions"><select aria-label={`Prioridad de ${event.title}`} value={event.priority} onChange={(change) => setEvents((items) => items.map((item) => item.id === event.id ? { ...item, priority: change.target.value as Priority } : item))}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select><a href={calendarUrl(event)} target="_blank" rel="noreferrer">Google Calendar</a><button type="button" onClick={() => setEvents((items) => items.filter((item) => item.id !== event.id))} aria-label={`Eliminar ${event.title}`}>×</button></div></article>)}</div> : <div className="agenda-empty"><span>◷</span><p>Habla o escribe para crear tu primera cita.</p></div>}</aside>
    </section>
    {sessions.length > 0 && <section className="agenda-session-results" aria-labelledby="agenda-results-title"><header><div><p>Registro de decisiones</p><h2 id="agenda-results-title">Respuestas de TypeSafe</h2></div><span>{sessions.length} turno{sessions.length === 1 ? "" : "s"}</span></header><div>{sessions.map((session) => <article key={session.id}><span>Turno {String(session.id).padStart(2, "0")}</span><p>“{session.query}”</p><strong>{intentLabel[session.intent]} {Math.round(session.intentProbability * 100)}%{session.priority ? ` · ${priorityLabel[session.priority]}` : ""}</strong><time>{session.responseLatencyMs} ms</time><small>{session.source === "typesafe" ? `${session.usage.input_tokens} tokens` : "modo demo"}</small></article>)}</div></section>}
  </main>;
}
