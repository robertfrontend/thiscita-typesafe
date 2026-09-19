export const copy = {
  es: {
    language: "English",
    status: "Zona de pruebas · Acceso abierto",
    title: (
      <>
        Una mesa de trabajo para <em>decidir mejor.</em>
      </>
    ),
    lede: "Tres utilidades prácticas. Sin cuentas, sin archivos guardados.",
    tools: [
      {
        title: "Encontrar trámites",
        description:
          "Rutas oficiales para servicios de Boston, Massachusetts y gobierno federal.",
        action: "Abrir buscador",
        href: "/services",
        icon: "⌕",
        className: "service-tool",
      },
      {
        title: "Revisar propuestas",
        description:
          "Control comercial de alcance, precio, fechas y compromisos antes de enviar.",
        action: "Abrir revisor",
        href: "/proposals",
        icon: "↥",
        className: "proposal-tool",
      },
      {
        title: "Mi agenda personal",
        description:
          "Habla para crear, cambiar o cancelar eventos en tu propia lista.",
        action: "Abrir agenda",
        href: "/appointments",
        icon: "◷",
        className: "appointment-tool",
      },
    ],
  },
  en: {
    language: "Español",
    status: "Testing zone · Open access",
    title: (
      <>
        A workbench to <em>decide better.</em>
      </>
    ),
    lede: "Three practical tools. No accounts, no files stored.",
    tools: [
      {
        title: "Find public services",
        description:
          "Official routes for Boston, Massachusetts, and federal services.",
        action: "Open search",
        href: "/services",
        icon: "⌕",
        className: "service-tool",
      },
      {
        title: "Review proposals",
        description:
          "A commercial check for scope, pricing, dates, and commitments before sending.",
        action: "Open review",
        href: "/proposals",
        icon: "↥",
        className: "proposal-tool",
      },
      {
        title: "My personal agenda",
        description:
          "Speak to create, change, or cancel events in your own list.",
        action: "Open agenda",
        href: "/appointments",
        icon: "◷",
        className: "appointment-tool",
      },
    ],
  },
} as const;
