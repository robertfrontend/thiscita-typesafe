export type AppointmentService = { id: string; businessId: string; business: string; title: string; duration: number; keywords: string[] };

export const appointmentServices: AppointmentService[] = [
  { id: "luna-haircut", businessId: "luna", business: "Luna Studio", title: "Corte de cabello", duration: 45, keywords: ["corte", "cabello", "pelo", "haircut", "hair"] },
  { id: "luna-color", businessId: "luna", business: "Luna Studio", title: "Color y balayage", duration: 120, keywords: ["color", "balayage", "tinte", "mechas"] },
  { id: "luna-manicure", businessId: "luna", business: "Luna Studio", title: "Manicure", duration: 60, keywords: ["manicure", "uñas", "unas", "nails"] },
  { id: "north-physio", businessId: "north", business: "Northside Wellness", title: "Evaluación de fisioterapia", duration: 60, keywords: ["fisioterapia", "fisio", "dolor", "physio", "therapy"] },
  { id: "north-massage", businessId: "north", business: "Northside Wellness", title: "Masaje terapéutico", duration: 60, keywords: ["masaje", "massage", "terapéutico", "terapeutico"] },
  { id: "north-nutrition", businessId: "north", business: "Northside Wellness", title: "Consulta de nutrición", duration: 45, keywords: ["nutrición", "nutricion", "nutrition", "dieta"] },
  { id: "atlas-tax", businessId: "atlas", business: "Atlas Advisors", title: "Consulta de impuestos", duration: 45, keywords: ["impuestos", "taxes", "tax", "declaración", "declaracion"] },
  { id: "atlas-business", businessId: "atlas", business: "Atlas Advisors", title: "Asesoría para negocios", duration: 60, keywords: ["negocio", "empresa", "business", "asesoría", "asesoria"] },
  { id: "atlas-financial", businessId: "atlas", business: "Atlas Advisors", title: "Plan financiero", duration: 60, keywords: ["financiero", "financial", "inversión", "inversion"] },
  { id: "casa-cleaning", businessId: "casa", business: "Casa Clara", title: "Limpieza residencial", duration: 120, keywords: ["limpieza", "cleaning", "casa", "hogar"] },
  { id: "casa-deep", businessId: "casa", business: "Casa Clara", title: "Limpieza profunda", duration: 180, keywords: ["profunda", "deep cleaning", "limpieza profunda"] },
  { id: "casa-move", businessId: "casa", business: "Casa Clara", title: "Limpieza de mudanza", duration: 180, keywords: ["mudanza", "move", "mudarse"] },
];

export function getAppointmentService(id: string) { return appointmentServices.find((service) => service.id === id); }
