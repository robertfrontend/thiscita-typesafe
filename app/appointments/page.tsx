"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { getAppointmentService } from "../lib/appointments";

type Reply = { matches: { serviceId: string; probability: number }[]; date: string | null; time: string | null; replaceServices: boolean; needsService: boolean; needsDate: boolean; needsTime: boolean; source: "typesafe" | "demo"; responseLatencyMs: number };
type ChatMessage = { role: "assistant" | "user"; text: string };
type SessionResult = Reply & { id: number; query: string };
type SpeechRecognitionResultLike = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type SpeechRecognitionInstance = { lang: string; continuous: boolean; interimResults: boolean; onstart: () => void; onend: () => void; onresult: (event: { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }) => void; onerror: (event: { error?: string }) => void; start: () => void; stop: () => void };
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function readableDate(value: string | null) { return value ? new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`)) : "Por definir"; }

export default function AppointmentsPage() {
  const [message, setMessage] = useState(""); const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: "¿Qué necesitas agendar? Puedes decir el negocio, servicio, día y hora." }]);
  const [selected, setSelected] = useState<string[]>([]); const [date, setDate] = useState<string | null>(null); const [time, setTime] = useState<string | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [scheduled, setScheduled] = useState(false); const [listening, setListening] = useState(false); const [liveAnalyzing, setLiveAnalyzing] = useState(false); const [liveSource, setLiveSource] = useState<Reply["source"] | null>(null); const [responseLatency, setResponseLatency] = useState<number | null>(null); const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null); const listeningRef = useRef(false); const finalTranscriptRef = useRef(""); const visibleTranscriptRef = useRef(""); const listeningTimerRef = useRef<number | null>(null); const liveTimerRef = useRef<number | null>(null); const liveAbortRef = useRef<AbortController | null>(null); const lastLiveCallAtRef = useRef(0); const lastAnalyzedTranscriptRef = useRef(""); const selectedRef = useRef<string[]>([]); const dateRef = useRef<string | null>(null); const timeRef = useRef<string | null>(null); const sessionCounterRef = useRef(0);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { dateRef.current = date; }, [date]);
  useEffect(() => { timeRef.current = time; }, [time]);
  useEffect(() => () => { listeningRef.current = false; recognitionRef.current?.stop(); liveAbortRef.current?.abort(); if (listeningTimerRef.current) window.clearTimeout(listeningTimerRef.current); if (liveTimerRef.current) window.clearTimeout(liveTimerRef.current); }, []);

  function applyReply(body: Reply) {
    const matches = body.matches.filter((match) => match.probability >= 0.68).map((match) => match.serviceId);
    const nextSelected = body.replaceServices && matches.length ? matches : [...new Set([...selectedRef.current, ...matches])]; const nextDate = body.date ?? dateRef.current; const nextTime = body.time ?? timeRef.current;
    selectedRef.current = nextSelected; dateRef.current = nextDate; timeRef.current = nextTime;
    setSelected(nextSelected); setDate(nextDate); setTime(nextTime); setLiveSource(body.source); setResponseLatency(body.responseLatencyMs);
    if (matches.length || body.date || body.time) setScheduled(false);
    return { matches, nextSelected, nextDate, nextTime };
  }

  async function analyzeLive(text: string) {
    const transcript = text.trim();
    if (transcript.length < 3 || transcript === lastAnalyzedTranscriptRef.current) return;
    lastAnalyzedTranscriptRef.current = transcript; liveAbortRef.current?.abort();
    const controller = new AbortController(); liveAbortRef.current = controller; setLiveAnalyzing(true);
    try {
      const res = await fetch("/api/interpret-appointment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: transcript, current: { serviceIds: selectedRef.current, date: dateRef.current, time: timeRef.current } }), signal: controller.signal });
      const body = await res.json() as Reply; if (res.ok && !controller.signal.aborted) applyReply(body);
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setLiveSource(null);
    } finally {
      if (liveAbortRef.current === controller) { liveAbortRef.current = null; setLiveAnalyzing(false); }
    }
  }

  function queueLiveAnalysis(text: string) {
    const transcript = text.trim(); if (transcript.length < 3 || transcript === lastAnalyzedTranscriptRef.current) return;
    if (liveTimerRef.current) window.clearTimeout(liveTimerRef.current);
    const elapsed = Date.now() - lastLiveCallAtRef.current; const delay = Math.max(0, 1_500 - elapsed);
    liveTimerRef.current = window.setTimeout(() => { lastLiveCallAtRef.current = Date.now(); void analyzeLive(transcript); }, delay);
  }

  async function send(text: string) {
    if (!text.trim() || loading) return;
    if (liveTimerRef.current) window.clearTimeout(liveTimerRef.current); liveAbortRef.current?.abort();
    setLoading(true); setLiveAnalyzing(false); setError(""); setMessages((previous) => [...previous, { role: "user", text }]); setMessage("");
    try {
      const res = await fetch("/api/interpret-appointment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, current: { serviceIds: selectedRef.current, date: dateRef.current, time: timeRef.current } }) });
      const body = await res.json() as Reply & { error?: string }; if (!res.ok) throw new Error(body.error ?? "No pudimos interpretar el mensaje.");
      const { matches, nextSelected, nextDate, nextTime } = applyReply(body);
      sessionCounterRef.current += 1; setSessionResults((previous) => [...previous, { ...body, id: sessionCounterRef.current, query: text }]);
      const names = matches.map((id) => getAppointmentService(id)?.title).filter(Boolean).join(", ");
      const missing = [nextSelected.length ? "" : "el servicio", nextDate ? "" : "el día", nextTime ? "" : "la hora"].filter(Boolean);
      const reply = `${names ? `${body.replaceServices ? "Cambié a" : "Agregué"}: ${names}. ` : ""}${missing.length ? `Dime ${missing.join(" y ")}.` : `Listo: ${nextSelected.length} servicio${nextSelected.length === 1 ? "" : "s"} para ${readableDate(nextDate)} a las ${nextTime}.`}`;
      setMessages((previous) => [...previous, { role: "assistant", text: reply }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos interpretar el mensaje."); }
    finally { setLoading(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send(message); }
  function schedule() { setScheduled(true); setMessages((previous) => [...previous, { role: "assistant", text: "Cita preparada en modo demostración. Aquí conectaríamos el calendario del negocio para confirmar disponibilidad." }]); }
  function stopListening(sendAfter = true) {
    listeningRef.current = false; setListening(false);
    if (listeningTimerRef.current) window.clearTimeout(listeningTimerRef.current);
    if (liveTimerRef.current) window.clearTimeout(liveTimerRef.current);
    recognitionRef.current?.stop();
    if (sendAfter) window.setTimeout(() => { const spoken = visibleTranscriptRef.current.trim(); if (spoken) void send(spoken); }, 250);
  }
  function speak() {
    if (listening) { stopListening(true); return; }
    const BrowserWindow = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Recognition = BrowserWindow.SpeechRecognition ?? BrowserWindow.webkitSpeechRecognition;
    if (!Recognition) { setError("El reconocimiento de voz no está disponible en este navegador. Puedes escribir tu mensaje."); return; }
    finalTranscriptRef.current = ""; visibleTranscriptRef.current = ""; lastAnalyzedTranscriptRef.current = ""; lastLiveCallAtRef.current = 0; setMessage(""); setError(""); setLiveSource(null); setResponseLatency(null);
    const recognition = new Recognition(); recognition.lang = "es-US"; recognition.continuous = true; recognition.interimResults = true;
    recognition.onstart = () => { listeningRef.current = true; setListening(true); };
    recognition.onresult = (event) => { let interim = ""; for (let index = event.resultIndex; index < event.results.length; index += 1) { const result = event.results[index]; const transcript = result[0]?.transcript ?? ""; if (result.isFinal) finalTranscriptRef.current = `${finalTranscriptRef.current} ${transcript}`.trim(); else interim += transcript; } const visible = `${finalTranscriptRef.current} ${interim}`.trim(); visibleTranscriptRef.current = visible; setMessage(visible); queueLiveAnalysis(visible); };
    recognition.onerror = (event) => { if (event.error !== "no-speech") setError("No pudimos escuchar el mensaje. Intenta otra vez o escribe."); };
    recognition.onend = () => { if (listeningRef.current) window.setTimeout(() => { try { recognition.start(); } catch { listeningRef.current = false; setListening(false); } }, 180); else setListening(false); };
    recognitionRef.current = recognition; recognition.start(); listeningTimerRef.current = window.setTimeout(() => stopListening(true), 60_000);
  }

  return <main className="appointments-page"><header className="masthead"><a className="brand" href="/"><span>OBRA</span><i>β</i></a><span className="demo-tag">Módulo 03 · Agenda</span><a className="proposal-back" href="/">← Inicio</a></header><section className="appointments-hero"><p className="kicker"><span />Agenda conversacional</p><h1>Dilo como lo <em>piensas.</em></h1><p>“Quiero un corte en Luna Studio mañana a las 3.”</p></section><section className="appointments-workspace"><section className="appointment-chat"><div className="chat-log" aria-live="polite">{messages.map((item, index) => <p className={item.role} key={`${item.role}-${index}`}>{item.text}</p>)}{loading && <p className="assistant typing">Buscando opciones…</p>}</div>{listening && <div className={liveAnalyzing ? "voice-status analyzing" : "voice-status"} role="status"><span className="voice-meter" aria-hidden="true"><i /><i /><i /></span><div><strong>{liveAnalyzing ? "Interpretando en vivo…" : "Escuchando en vivo…"}</strong><small>{responseLatency !== null ? `${liveSource === "demo" ? "Demo" : "TypeSafe"} respondió en ${responseLatency} ms` : "Servicio, día y hora se actualizan automáticamente"}</small></div><button type="button" onClick={() => stopListening(true)}>Terminar</button></div>}<form className="chat-compose" onSubmit={submit}><label className="sr-only" htmlFor="appointment-message">Describe tu cita</label><input id="appointment-message" value={message} onChange={(event) => { setMessage(event.target.value); visibleTranscriptRef.current = event.target.value; }} placeholder="Ej. masaje en Northside Wellness el viernes a las 10 am" /><button type="button" className={listening ? "voice-button listening" : "voice-button"} onClick={speak} aria-label={listening ? "Detener escucha" : "Hablar"}>{listening ? "■" : "●"}</button><button type="submit" disabled={loading || listening || !message.trim()}>Enviar</button></form>{error && <p className="error" role="alert">{error}</p>}<small className="appointment-note">Análisis incremental con TypeSafe durante la escucha. No guardamos el audio.</small></section><aside className="appointment-board"><div className="appointment-board-head"><div><p>Tu pre-agenda</p><h2>{selected.length ? `${selected.length} servicio${selected.length === 1 ? "" : "s"}` : "Sin servicios"}</h2></div><span>{scheduled ? "Agendado" : date && time ? "Listo" : listening ? "En vivo" : "En curso"}</span></div>{(loading || liveAnalyzing || responseLatency !== null) && <p className="response-speed"><span>Respuesta {liveSource === "demo" ? "demo" : "TypeSafe"}</span><strong>{loading || liveAnalyzing ? "Midiendo…" : `${responseLatency} ms`}</strong></p>}<div className="appointment-timing"><div><small>Día</small><strong>{readableDate(date)}</strong></div><div><small>Hora</small><strong>{time ?? "Por definir"}</strong></div></div><div className="appointment-list">{selected.map((id) => { const service = getAppointmentService(id); if (!service) return null; return <article key={id}><div><small>{service.business}</small><h3>{service.title}</h3><p>{service.duration} min</p></div><button type="button" onClick={() => { setSelected((items) => items.filter((item) => item !== id)); setScheduled(false); }} aria-label={`Quitar ${service.title}`}>×</button></article>; })}</div>{selected.length > 0 && <p className="appointment-disclaimer">Confirma disponibilidad directamente con cada negocio antes de reservar.</p>}{selected.length > 0 && date && time && <button className="schedule-demo" type="button" onClick={schedule} disabled={scheduled}>{scheduled ? "Cita preparada" : "Agendar (demo)"}</button>}</aside></section>{sessionResults.length > 0 && <section className="session-results" aria-labelledby="session-results-title"><header><div><p>Registro de pruebas</p><h2 id="session-results-title">Resultados de TypeSafe</h2></div><span>{sessionResults.length} turno{sessionResults.length === 1 ? "" : "s"}</span></header><div className="session-result-list">{sessionResults.map((result) => <article key={result.id}><div className="session-result-head"><span>Turno {String(result.id).padStart(2, "0")}</span><strong>{result.responseLatencyMs} ms</strong></div><p className="session-query">“{result.query}”</p><div className="session-answers">{result.matches.length ? result.matches.map((match) => { const service = getAppointmentService(match.serviceId); return <span key={match.serviceId}>{service?.title ?? match.serviceId} <strong>{Math.round(match.probability * 100)}%</strong></span>; }) : <span>Sin servicio detectado</span>}</div><footer><span>{result.replaceServices ? "Reemplazo" : "Selección"}</span><span>{result.date ? readableDate(result.date) : "Sin fecha nueva"}</span><span>{result.time ?? "Sin hora nueva"}</span><span>{result.source === "typesafe" ? "TypeSafe" : "Demo"}</span></footer></article>)}</div></section>}</main>;
}
