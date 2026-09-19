export type Locale = "es" | "en";

export type LocalizedCopy = {
  title: string;
  summary: string;
  requirements: string[];
  nextAction: string;
};
export type AdaptiveQuestion = {
  id: string;
  prompt: Record<Locale, string>;
  options: {
    value: string;
    label: Record<Locale, string>;
    detail: Record<Locale, string>;
  }[];
};

export type GovernmentService = {
  id: string;
  category: "documents" | "mobility" | "city" | "benefits";
  authority: "City of Boston" | "Massachusetts" | "Federal";
  authorityName: string;
  officialUrl: string;
  lastVerified: string;
  copy: Record<Locale, LocalizedCopy>;
  keywords: string[];
};

const verified = "2026-09-18";
const rmv = "Massachusetts Registry of Motor Vehicles";

export const services: GovernmentService[] = [
  {
    id: "license-renewal",
    category: "mobility",
    authority: "Massachusetts",
    authorityName: rmv,
    officialUrl: "https://www.mass.gov/how-to/renew-your-drivers-license",
    lastVerified: verified,
    keywords: [
      "renew license",
      "license renewal",
      "renew my driver",
      "renovar licencia",
      "renovar mi licencia",
      "licencia vencida",
    ],
    copy: {
      es: {
        title: "Renovar licencia de conducir",
        summary: "Orientación para renovar una licencia de Massachusetts.",
        requirements: [
          "Revisa si puedes renovar en línea, por correo o en una oficina RMV.",
          "Ten a mano tu licencia actual y la información que pida RMV.",
          "Confirma si necesitas una prueba de visión o una visita presencial.",
          "Consulta el costo y las formas de pago antes de empezar.",
        ],
        nextAction:
          "Revisa las opciones de renovación en el sitio oficial de RMV.",
      },
      en: {
        title: "Renew a driver’s license",
        summary: "Guidance for renewing a Massachusetts driver’s license.",
        requirements: [
          "Check whether you can renew online, by mail, or at an RMV office.",
          "Have your current license and requested RMV information ready.",
          "Confirm whether a vision test or in-person visit is required.",
          "Review the fee and payment options before you begin.",
        ],
        nextAction: "Review renewal options on the official RMV website.",
      },
    },
  },
  {
    id: "learner-permit",
    category: "mobility",
    authority: "Massachusetts",
    authorityName: rmv,
    officialUrl:
      "https://www.mass.gov/how-to/apply-for-a-passenger-class-d-learners-permit",
    lastVerified: verified,
    keywords: [
      "learner permit",
      "first license",
      "first driver license",
      "driving permit",
      "get my license",
      "get a license",
      "sacar licencia",
      "sacar mi licencia",
      "obtener licencia",
      "quiero mi licencia",
      "permiso de aprendiz",
      "permiso para conducir",
      "primera licencia",
    ],
    copy: {
      es: {
        title: "Solicitar permiso de aprendiz",
        summary:
          "Primer paso para obtener una licencia Clase D en Massachusetts.",
        requirements: [
          "Completa la solicitud de permiso Clase D de RMV.",
          "Reúne los documentos de identidad, presencia legal y residencia que RMV exige.",
          "Prepárate para el examen de conocimientos.",
          "Consulta los requisitos de cita, foto y pago.",
        ],
        nextAction: "Revisa la lista oficial de documentos y pasos de RMV.",
      },
      en: {
        title: "Apply for a learner’s permit",
        summary:
          "The first step toward a Massachusetts Class D driver’s license.",
        requirements: [
          "Complete the RMV Class D learner’s permit application.",
          "Gather the identity, lawful-presence, and residency documents RMV requires.",
          "Prepare for the knowledge test.",
          "Review appointment, photo, and payment requirements.",
        ],
        nextAction: "Review RMV’s official document list and steps.",
      },
    },
  },
  {
    id: "license-replacement",
    category: "mobility",
    authority: "Massachusetts",
    authorityName: rmv,
    officialUrl: "https://www.mass.gov/how-to/replace-your-drivers-license",
    lastVerified: verified,
    keywords: [
      "replace license",
      "lost license",
      "stolen license",
      "duplicate license",
      "reemplazar licencia",
      "perdi mi licencia",
      "licencia robada",
      "licencia perdida",
    ],
    copy: {
      es: {
        title: "Reemplazar licencia perdida o robada",
        summary: "Obtén un reemplazo de una licencia de Massachusetts.",
        requirements: [
          "Confirma que necesitas un reemplazo y no una renovación.",
          "Ten disponible tu información de licencia si la conoces.",
          "Revisa si RMV permite el trámite en línea o requiere una visita.",
          "Consulta el costo de reemplazo antes de solicitarlo.",
        ],
        nextAction:
          "Inicia con las instrucciones oficiales de reemplazo de RMV.",
      },
      en: {
        title: "Replace a lost or stolen license",
        summary: "Get a replacement for a Massachusetts driver’s license.",
        requirements: [
          "Confirm that you need a replacement rather than a renewal.",
          "Have your license information available if you know it.",
          "Check whether RMV allows an online transaction or requires a visit.",
          "Review the replacement fee before applying.",
        ],
        nextAction: "Start with RMV’s official replacement instructions.",
      },
    },
  },
  {
    id: "real-id-mass-id",
    category: "documents",
    authority: "Massachusetts",
    authorityName: rmv,
    officialUrl: "https://www.mass.gov/info-details/real-id-in-massachusetts",
    lastVerified: verified,
    keywords: [
      "real id",
      "mass id",
      "state id",
      "identificacion real",
      "identificación real",
      "identificacion de massachusetts",
      "mass id",
    ],
    copy: {
      es: {
        title: "Obtener REAL ID o Mass ID",
        summary:
          "Compara y solicita una identificación REAL ID o Mass ID de Massachusetts.",
        requirements: [
          "Decide si necesitas una REAL ID o una identificación estándar.",
          "Reúne los documentos de identidad, presencia legal y residencia indicados por RMV.",
          "Verifica si debes ir a una oficina RMV para presentar documentos.",
          "Consulta las tarifas y los requisitos de foto.",
        ],
        nextAction:
          "Compara REAL ID y licencia/ID estándar en la guía oficial de RMV.",
      },
      en: {
        title: "Get a REAL ID or Mass ID",
        summary: "Compare and apply for a Massachusetts REAL ID or Mass ID.",
        requirements: [
          "Decide whether you need a REAL ID or standard credential.",
          "Gather the identity, lawful-presence, and residency documents RMV lists.",
          "Check whether you must visit an RMV office to present documents.",
          "Review fees and photo requirements.",
        ],
        nextAction:
          "Compare REAL ID and standard credentials in RMV’s official guide.",
      },
    },
  },
  {
    id: "passport-first-time",
    category: "documents",
    authority: "Federal",
    authorityName: "U.S. Department of State",
    officialUrl:
      "https://travel.state.gov/content/travel/en/passports/need-passport/apply-in-person.html",
    lastVerified: verified,
    keywords: [
      "first passport",
      "new passport",
      "apply passport",
      "get a passport",
      "passport for first time",
      "primer pasaporte",
      "nuevo pasaporte",
      "solicitar pasaporte",
      "solicitar un pasaporte",
      "obtener un pasaporte",
    ],
    copy: {
      es: {
        title: "Solicitar un pasaporte por primera vez",
        summary: "Solicitud inicial de pasaporte estadounidense.",
        requirements: [
          "Completa el formulario DS-11, pero no lo firmes hasta que te indiquen hacerlo.",
          "Reúne prueba de ciudadanía estadounidense y una identificación aceptable.",
          "Prepara una foto de pasaporte que cumpla las reglas actuales.",
          "Presenta la solicitud en persona en un centro de aceptación autorizado.",
          "Consulta las tarifas y los tiempos de procesamiento oficiales.",
        ],
        nextAction: "Revisa el proceso federal para solicitar en persona.",
      },
      en: {
        title: "Apply for a first passport",
        summary: "First-time U.S. passport application guidance.",
        requirements: [
          "Complete Form DS-11, but do not sign until instructed.",
          "Gather proof of U.S. citizenship and acceptable identification.",
          "Prepare a passport photo that meets current rules.",
          "Apply in person at an authorized acceptance facility.",
          "Review official fees and processing times.",
        ],
        nextAction: "Review the federal process for applying in person.",
      },
    },
  },
  {
    id: "passport-renewal",
    category: "documents",
    authority: "Federal",
    authorityName: "U.S. Department of State",
    officialUrl:
      "https://travel.state.gov/content/travel/en/passports/have-passport/renew.html",
    lastVerified: verified,
    keywords: [
      "renew passport",
      "passport renewal",
      "expired passport",
      "renovar pasaporte",
      "pasaporte vencido",
      "renovacion de pasaporte",
    ],
    copy: {
      es: {
        title: "Renovar pasaporte",
        summary: "Opciones para renovar un pasaporte estadounidense.",
        requirements: [
          "Revisa si calificas para renovar por correo o en línea, según la información federal actual.",
          "Ten tu pasaporte más reciente y el formulario indicado.",
          "Prepara una foto de pasaporte que cumpla las reglas actuales.",
          "Consulta tarifas, método de envío y tiempos de procesamiento.",
        ],
        nextAction:
          "Verifica tu opción de renovación en el sitio del Departamento de Estado.",
      },
      en: {
        title: "Renew a passport",
        summary: "Options for renewing a U.S. passport.",
        requirements: [
          "Check whether you qualify to renew by mail or online under current federal guidance.",
          "Have your most recent passport and the required form ready.",
          "Prepare a passport photo that meets current rules.",
          "Review fees, mailing method, and processing times.",
        ],
        nextAction:
          "Check your renewal option on the Department of State website.",
      },
    },
  },
  {
    id: "vehicle-registration",
    category: "mobility",
    authority: "Massachusetts",
    authorityName: rmv,
    officialUrl: "https://www.mass.gov/register-and-title-your-vehicle",
    lastVerified: verified,
    keywords: [
      "register vehicle",
      "new registration",
      "car registration",
      "register car",
      "registrar vehiculo",
      "registrar vehículo",
      "registrar auto",
      "registro de vehiculo",
    ],
    copy: {
      es: {
        title: "Registrar un vehículo",
        summary: "Pasos iniciales para registrar un vehículo en Massachusetts.",
        requirements: [
          "Completa la solicitud de registro y título apropiada.",
          "Obtén el comprobante de seguro de Massachusetts que corresponda.",
          "Reúne prueba de propiedad y los documentos de compra aplicables.",
          "Consulta impuestos, tarifas y dónde presentar la solicitud.",
        ],
        nextAction:
          "Revisa el proceso oficial de registro de vehículos de RMV.",
      },
      en: {
        title: "Register a vehicle",
        summary: "Initial steps for registering a vehicle in Massachusetts.",
        requirements: [
          "Complete the appropriate registration and title application.",
          "Get the required Massachusetts insurance proof.",
          "Gather proof of ownership and applicable purchase documents.",
          "Review taxes, fees, and where to submit the application.",
        ],
        nextAction: "Review RMV’s official vehicle-registration process.",
      },
    },
  },
  {
    id: "vehicle-registration-renewal",
    category: "mobility",
    authority: "Massachusetts",
    authorityName: rmv,
    officialUrl: "https://www.mass.gov/how-to/renew-your-vehicle-registration",
    lastVerified: verified,
    keywords: [
      "renew registration",
      "registration renewal",
      "renew car registration",
      "renovar registro",
      "renovar registro del auto",
      "registro vencido",
    ],
    copy: {
      es: {
        title: "Renovar registro de vehículo",
        summary: "Renueva el registro de un vehículo de Massachusetts.",
        requirements: [
          "Ten disponible el número de placa y la información de registro.",
          "Verifica que el seguro esté activo y que no existan bloqueos que impidan renovar.",
          "Revisa si puedes renovar en línea, por correo o en una oficina.",
          "Consulta tarifa y confirmación de renovación.",
        ],
        nextAction:
          "Comprueba las opciones oficiales para renovar tu registro.",
      },
      en: {
        title: "Renew a vehicle registration",
        summary: "Renew a Massachusetts vehicle registration.",
        requirements: [
          "Have your plate number and registration information available.",
          "Verify active insurance and check for any renewal blocks.",
          "Check whether you can renew online, by mail, or at an office.",
          "Review the fee and renewal confirmation.",
        ],
        nextAction:
          "Check the official options for renewing your registration.",
      },
    },
  },
  {
    id: "boston-311",
    category: "city",
    authority: "City of Boston",
    authorityName: "Boston 311",
    officialUrl: "https://www.boston.gov/departments/boston-311",
    lastVerified: verified,
    keywords: [
      "311",
      "pothole",
      "graffiti",
      "streetlight",
      "missed trash",
      "bache",
      "grafiti",
      "luz de calle",
      "basura",
    ],
    copy: {
      es: {
        title: "Reportar un problema no urgente",
        summary: "Envía un reporte a Boston 311.",
        requirements: [
          "Elige la categoría del problema.",
          "Ten lista la ubicación y una descripción breve.",
          "Añade una foto solo si el sitio oficial la solicita.",
        ],
        nextAction: "Inicia un reporte con Boston 311.",
      },
      en: {
        title: "Report a non-emergency issue",
        summary: "Send a report to Boston 311.",
        requirements: [
          "Choose the issue category.",
          "Have the location and a brief description ready.",
          "Add a photo only if the official site requests one.",
        ],
        nextAction: "Start a report with Boston 311.",
      },
    },
  },
  {
    id: "resident-parking",
    category: "city",
    authority: "City of Boston",
    authorityName: "Boston Parking Clerk",
    officialUrl:
      "https://www.boston.gov/departments/parking-clerk/how-get-resident-parking-permit",
    lastVerified: verified,
    keywords: [
      "resident parking",
      "parking permit",
      "parking sticker",
      "permiso de estacionamiento",
      "permiso de parking",
      "sticker de estacionamiento",
    ],
    copy: {
      es: {
        title: "Permiso de estacionamiento residencial",
        summary: "Solicita o actualiza un permiso residencial de Boston.",
        requirements: [
          "Confirma que tu calle pertenece a una zona de estacionamiento residencial.",
          "Revisa que el registro del vehículo tenga tu dirección actual de Boston.",
          "Reúne prueba de residencia aceptada.",
        ],
        nextAction: "Revisa la solicitud oficial de permiso residencial.",
      },
      en: {
        title: "Resident parking permit",
        summary: "Apply for or update a Boston resident parking permit.",
        requirements: [
          "Confirm your street is in a resident-parking area.",
          "Check that vehicle registration shows your current Boston address.",
          "Gather accepted proof of residency.",
        ],
        nextAction: "Review the official resident permit application.",
      },
    },
  },
  {
    id: "birth-certificate",
    category: "documents",
    authority: "City of Boston",
    authorityName: "Boston Registry",
    officialUrl:
      "https://www.boston.gov/departments/registry-birth-death-and-marriage/how-get-birth-certificate",
    lastVerified: verified,
    keywords: [
      "birth certificate",
      "certificate of birth",
      "acta de nacimiento",
      "certificado de nacimiento",
    ],
    copy: {
      es: {
        title: "Solicitar acta de nacimiento",
        summary: "Pide una copia de un acta de nacimiento de Boston.",
        requirements: [
          "Confirma que el nacimiento o la residencia de los padres corresponde a Boston.",
          "Elige pedido en línea, por correo o en persona.",
          "Revisa si el registro tiene restricciones de acceso.",
        ],
        nextAction: "Consulta las opciones oficiales del Registro de Boston.",
      },
      en: {
        title: "Request a birth certificate",
        summary: "Request a copy of a Boston birth certificate.",
        requirements: [
          "Confirm the birth or parents’ residence is connected to Boston.",
          "Choose an online, mail, or in-person order.",
          "Check whether the record has access restrictions.",
        ],
        nextAction: "Review Boston Registry’s official options.",
      },
    },
  },
  {
    id: "marriage-certificate",
    category: "documents",
    authority: "City of Boston",
    authorityName: "Boston Registry",
    officialUrl:
      "https://www.boston.gov/departments/registry/how-get-copy-marriage-certificate",
    lastVerified: verified,
    keywords: [
      "marriage certificate",
      "marriage record",
      "acta de matrimonio",
      "certificado de matrimonio",
    ],
    copy: {
      es: {
        title: "Solicitar certificado de matrimonio",
        summary:
          "Obtén una copia certificada de un matrimonio registrado en Boston.",
        requirements: [
          "Confirma que la licencia se presentó en Boston.",
          "Elige pedido en línea, por correo o en persona.",
          "Revisa restricciones si el registro es restringido.",
        ],
        nextAction: "Consulta las opciones oficiales del Registro de Boston.",
      },
      en: {
        title: "Request a marriage certificate",
        summary: "Get a certified copy of a marriage recorded in Boston.",
        requirements: [
          "Confirm the marriage license was filed in Boston.",
          "Choose an online, mail, or in-person order.",
          "Review restrictions if the record is restricted.",
        ],
        nextAction: "Review Boston Registry’s official options.",
      },
    },
  },
  {
    id: "voter-registration",
    category: "city",
    authority: "Massachusetts",
    authorityName: "Massachusetts Elections Division",
    officialUrl:
      "https://www.sec.state.ma.us/divisions/elections/languages/registering-to-vote.htm",
    lastVerified: verified,
    keywords: [
      "register to vote",
      "voter registration",
      "registro para votar",
      "registrarme para votar",
    ],
    copy: {
      es: {
        title: "Registrarse para votar",
        summary: "Consulta cómo registrarte para votar en Massachusetts.",
        requirements: [
          "Confirma los requisitos de registro.",
          "Revisa la fecha límite aplicable.",
          "Elige el método oficial para registrarte.",
        ],
        nextAction: "Abre la guía oficial de registro electoral.",
      },
      en: {
        title: "Register to vote",
        summary: "Learn how to register to vote in Massachusetts.",
        requirements: [
          "Confirm registration requirements.",
          "Review the applicable deadline.",
          "Choose an official registration method.",
        ],
        nextAction: "Open the official voter-registration guide.",
      },
    },
  },
  {
    id: "masshealth-application",
    category: "benefits",
    authority: "Massachusetts",
    authorityName: "MassHealth",
    officialUrl:
      "https://www.mass.gov/how-to/apply-for-masshealth-coverage-for-individuals-and-families",
    lastVerified: verified,
    keywords: [
      "masshealth",
      "health coverage",
      "health insurance",
      "seguro de salud",
      "cobertura medica",
      "cobertura médica",
    ],
    copy: {
      es: {
        title: "Solicitar cobertura MassHealth",
        summary:
          "Conoce las opciones oficiales para solicitar cobertura médica.",
        requirements: [
          "Revisa qué información pide la solicitud oficial.",
          "Elige un canal de solicitud disponible.",
          "Consulta ayuda de inscripción si la necesitas.",
        ],
        nextAction: "Revisa las opciones oficiales de solicitud MassHealth.",
      },
      en: {
        title: "Apply for MassHealth coverage",
        summary: "Review official ways to apply for health coverage.",
        requirements: [
          "Review the information the official application requests.",
          "Choose an available application channel.",
          "Check enrollment help if you need it.",
        ],
        nextAction: "Review official MassHealth application options.",
      },
    },
  },
];

export function getService(id: string) {
  return services.find((service) => service.id === id);
}

// These questions shape presentation only. They never decide eligibility or alter the official route.
export const adaptiveQuestions: Partial<
  Record<GovernmentService["id"], AdaptiveQuestion>
> = {
  "license-renewal": {
    id: "license-age",
    prompt: {
      es: "¿Tu licencia venció hace más de dos años?",
      en: "Has your license been expired for more than two years?",
    },
    options: [
      {
        value: "yes",
        label: { es: "Sí", en: "Yes" },
        detail: {
          es: "La guía de RMV indica que una licencia vencida por más de dos años puede requerir exámenes. Confírmalo en la fuente oficial.",
          en: "RMV guidance says a license expired for more than two years may require tests. Confirm this in the official source.",
        },
      },
      {
        value: "no",
        label: { es: "No o no estoy seguro", en: "No or I’m not sure" },
        detail: {
          es: "Continúa con las opciones de renovación y confirma los requisitos vigentes de RMV.",
          en: "Continue with the renewal options and confirm current RMV requirements.",
        },
      },
    ],
  },
  "learner-permit": {
    id: "permit-history",
    prompt: {
      es: "¿Es tu primer permiso de aprendiz de Massachusetts?",
      en: "Is this your first Massachusetts learner’s permit?",
    },
    options: [
      {
        value: "yes",
        label: { es: "Sí", en: "Yes" },
        detail: {
          es: "Usa la lista de documentos del permiso Clase D antes de iniciar la solicitud.",
          en: "Use the Class D permit document checklist before starting the application.",
        },
      },
      {
        value: "no",
        label: { es: "No o no estoy seguro", en: "No or I’m not sure" },
        detail: {
          es: "Revisa la fuente oficial para confirmar si esta es la ruta correcta para tu situación.",
          en: "Review the official source to confirm this is the right route for your situation.",
        },
      },
    ],
  },
  "license-replacement": {
    id: "replacement-reason",
    prompt: {
      es: "¿Tu licencia fue perdida o robada?",
      en: "Was your license lost or stolen?",
    },
    options: [
      {
        value: "yes",
        label: { es: "Sí", en: "Yes" },
        detail: {
          es: "La ruta de reemplazo corresponde a este caso; revisa el método disponible en RMV.",
          en: "The replacement route fits this case; check the available RMV method.",
        },
      },
      {
        value: "no",
        label: { es: "No", en: "No" },
        detail: {
          es: "Puede que necesites otra ruta. Comprueba renovación, cambio de información u orientación de RMV.",
          en: "You may need a different route. Check renewal, information changes, or RMV guidance.",
        },
      },
    ],
  },
  "real-id-mass-id": {
    id: "real-id-use",
    prompt: {
      es: "¿Quieres usar esta credencial para vuelos domésticos?",
      en: "Do you want to use this credential for domestic flights?",
    },
    options: [
      {
        value: "yes",
        label: { es: "Sí", en: "Yes" },
        detail: {
          es: "Consulta REAL ID y los documentos que RMV pide para una visita presencial.",
          en: "Review REAL ID and the documents RMV requires for an in-person visit.",
        },
      },
      {
        value: "no",
        label: { es: "No o no estoy seguro", en: "No or I’m not sure" },
        detail: {
          es: "Compara REAL ID con una credencial estándar en la guía oficial antes de elegir.",
          en: "Compare REAL ID and a standard credential in the official guide before choosing.",
        },
      },
    ],
  },
  "passport-first-time": {
    id: "passport-before",
    prompt: {
      es: "¿Has tenido antes un pasaporte estadounidense?",
      en: "Have you had a U.S. passport before?",
    },
    options: [
      {
        value: "no",
        label: { es: "No", en: "No" },
        detail: {
          es: "Esta ruta de primera solicitud puede ser relevante. Revisa el proceso DS-11 oficial.",
          en: "This first-time route may be relevant. Review the official DS-11 process.",
        },
      },
      {
        value: "yes",
        label: { es: "Sí o no estoy seguro", en: "Yes or I’m not sure" },
        detail: {
          es: "Podrías necesitar renovación u otra ruta; confirma las condiciones en el sitio federal.",
          en: "You may need renewal or another route; confirm the conditions on the federal site.",
        },
      },
    ],
  },
  "passport-renewal": {
    id: "passport-possession",
    prompt: {
      es: "¿Tienes tu pasaporte estadounidense más reciente?",
      en: "Do you have your most recent U.S. passport?",
    },
    options: [
      {
        value: "yes",
        label: { es: "Sí", en: "Yes" },
        detail: {
          es: "Revisa las condiciones de renovación y el método disponible en el sitio federal.",
          en: "Review renewal conditions and the available method on the federal website.",
        },
      },
      {
        value: "no",
        label: { es: "No o no estoy seguro", en: "No or I’m not sure" },
        detail: {
          es: "La renovación podría no aplicar. La fuente federal explica las rutas disponibles.",
          en: "Renewal may not apply. The federal source explains the available routes.",
        },
      },
    ],
  },
  "vehicle-registration": {
    id: "vehicle-source",
    prompt: {
      es: "¿Compraste el vehículo a un concesionario?",
      en: "Did you buy the vehicle from a dealer?",
    },
    options: [
      {
        value: "dealer",
        label: { es: "Sí", en: "Yes" },
        detail: {
          es: "Busca la ruta oficial para vehículos comprados a un concesionario.",
          en: "Look for the official route for vehicles bought from a dealer.",
        },
      },
      {
        value: "private",
        label: { es: "No o no estoy seguro", en: "No or I’m not sure" },
        detail: {
          es: "Revisa la ruta oficial para compras a particulares y los documentos de título requeridos.",
          en: "Review the official route for private purchases and required title documents.",
        },
      },
    ],
  },
  "vehicle-registration-renewal": {
    id: "registration-status",
    prompt: {
      es: "¿El registro y el seguro del vehículo siguen activos?",
      en: "Are the vehicle registration and insurance still active?",
    },
    options: [
      {
        value: "yes",
        label: { es: "Sí", en: "Yes" },
        detail: {
          es: "Revisa los canales de renovación disponibles y confirma que no existan bloqueos.",
          en: "Review available renewal channels and confirm there are no blocks.",
        },
      },
      {
        value: "no",
        label: { es: "No o no estoy seguro", en: "No or I’m not sure" },
        detail: {
          es: "Primero consulta el sitio de RMV para conocer bloqueos o requisitos que puedan aplicar.",
          en: "First consult the RMV site for any blocks or requirements that may apply.",
        },
      },
    ],
  },
};
