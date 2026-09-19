export const copy = {
  es: {
    back: "Inicio",
    badge: "Revisor de propuestas",
    title: (
      <>
        Revisa antes de <em>enviar.</em>
      </>
    ),
    lede: "Un control comercial rápido para propuestas de servicios.",
    label: "Sube la propuesta",
    formats: "PDF, DOCX o TXT · Máximo 25 MB",
    choose: "Elegir documento",
    change: "Cambiar documento",
    analyzing: "Analizando documento…",
    autoReady: "El análisis comienza al subirlo.",
    complete: "Análisis listo",
    private: "El archivo se usa solo para este análisis. No lo guardamos.",
    result: "Control comercial",
    waiting: "Esperando un documento",
    summary: "Resumen del documento",
    summaryNote: "Extractos del texto cargado",
    ready: "Lista para una revisión final",
    review: "Revisar antes de enviar",
    clear: "Claro",
    standby: "En espera",
    missing: "Falta información",
    needsReview: "Revisar",
    legal: "No es asesoría legal ni determina la validez de un contrato.",
    live: "TypeSafe",
    demo: "Modo demo",
    error: "No se pudo analizar el documento.",
    checks: {
      scope: [
        "Alcance",
        "Confirma entregables, exclusiones y criterios de aceptación.",
      ],
      pricing: [
        "Precio y pago",
        "Confirma precio, calendario de cobro, descuentos y condiciones de pago.",
      ],
      timeline: ["Fechas", "Confirma fechas, dependencias y responsables."],
      nonStandardCommitment: [
        "Compromisos",
        "Pide aprobación antes de incluir garantías, soporte ilimitado, exclusividad o compromisos sin límite.",
      ],
    },
  },
  en: {
    back: "Home",
    badge: "Proposal review",
    title: (
      <>
        Review before you <em>send.</em>
      </>
    ),
    lede: "A quick commercial check for service proposals.",
    label: "Upload the proposal",
    formats: "PDF, DOCX, or TXT · 25 MB maximum",
    choose: "Choose document",
    change: "Change document",
    analyzing: "Analyzing document…",
    autoReady: "Analysis starts when you upload it.",
    complete: "Analysis ready",
    private: "The file is used only for this analysis. We do not save it.",
    result: "Commercial check",
    waiting: "Waiting for a document",
    summary: "Document summary",
    summaryNote: "Extracts from the uploaded text",
    ready: "Ready for a final review",
    review: "Review before sending",
    clear: "Clear",
    standby: "Standby",
    missing: "Missing information",
    needsReview: "Review",
    legal: "This is not legal advice and does not determine contract validity.",
    live: "TypeSafe",
    demo: "Demo mode",
    error: "We could not analyze the document.",
    checks: {
      scope: [
        "Scope",
        "Confirm deliverables, exclusions, and acceptance criteria.",
      ],
      pricing: [
        "Pricing & payment",
        "Confirm price, billing schedule, discounts, and payment terms.",
      ],
      timeline: ["Timeline", "Confirm dates, dependencies, and owners."],
      nonStandardCommitment: [
        "Commitments",
        "Get approval before including guarantees, unlimited support, exclusivity, or uncapped commitments.",
      ],
    },
  },
} as const;
