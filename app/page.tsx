"use client";

import { useState } from "react";

const copy = {
  es: { language: "English", status: "Zona de pruebas · Acceso abierto", title: <>Una mesa de trabajo para <em>decidir mejor.</em></>, lede: "Tres utilidades prácticas. Sin cuentas, sin archivos guardados.", tools: [{ title: "Encontrar trámites", description: "Rutas oficiales para servicios de Boston, Massachusetts y gobierno federal.", action: "Abrir buscador", href: "/services", icon: "⌕", className: "service-tool" }, { title: "Revisar propuestas", description: "Control comercial de alcance, precio, fechas y compromisos antes de enviar.", action: "Abrir revisor", href: "/proposals", icon: "↥", className: "proposal-tool" }, { title: "Agenda por conversación", description: "Habla o escribe el servicio, negocio, día y hora que necesitas.", action: "Abrir agenda", href: "/appointments", icon: "◷", className: "appointment-tool" }] },
  en: { language: "Español", status: "Testing zone · Open access", title: <>A workbench to <em>decide better.</em></>, lede: "Three practical tools. No accounts, no files stored.", tools: [{ title: "Find public services", description: "Official routes for Boston, Massachusetts, and federal services.", action: "Open search", href: "/services", icon: "⌕", className: "service-tool" }, { title: "Review proposals", description: "A commercial check for scope, pricing, dates, and commitments before sending.", action: "Open review", href: "/proposals", icon: "↥", className: "proposal-tool" }, { title: "Schedule by chat", description: "Speak or write the service, business, day, and time you need.", action: "Open scheduler", href: "/appointments", icon: "◷", className: "appointment-tool" }] },
} as const;

export default function Home() {
  const [locale, setLocale] = useState<"es" | "en">("es"); const t = copy[locale];
  return <main className="home-page"><button className="home-language" type="button" onClick={() => setLocale(locale === "es" ? "en" : "es")}>{t.language}</button><section className="home-intro"><a className="home-brand" href="/"><span>OBRA</span><i>β</i></a><p className="site-status">{t.status}</p><h1>{t.title}</h1><p>{t.lede}</p></section><section className="tool-cards" aria-label="Available tools">{t.tools.map((tool, index) => <a className={`tool-card ${tool.className}`} href={tool.href} key={tool.href}><span className="tool-index">0{index + 1}</span><span className="tool-icon" aria-hidden="true">{tool.icon}</span><div><h2>{tool.title}</h2><p>{tool.description}</p></div><strong>{tool.action} <b>↗</b></strong></a>)}</section></main>;
}
