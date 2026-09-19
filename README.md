# OBRA

Zona de pruebas para experimentar con decisiones tipadas de IA usando [TypeSafe](https://typesafe.ai/).

OBRA reúne tres herramientas bilingües:

- **Buscador de servicios públicos:** encuentra rutas oficiales de Boston, Massachusetts y el gobierno federal.
- **Revisor de propuestas:** analiza documentos PDF, DOCX y TXT antes de enviar una propuesta comercial.
- **Agenda personal:** convierte texto o voz en eventos, organiza planes diarios y permite modificarlos conversando.

> Proyecto experimental. No ofrece asesoría legal, no determina elegibilidad para servicios públicos y no agenda citas reales automáticamente.

## Cómo funciona TypeSafe

La aplicación mantiene separadas la interpretación y la ejecución:

1. TypeSafe clasifica intenciones, relevancia, prioridad, esfuerzo o posibles riesgos.
2. El código aplica reglas deterministas para fechas, horarios, conflictos y umbrales.
3. El usuario revisa el resultado antes de guardar cualquier cambio.

TypeSafe no genera requisitos gubernamentales. Esa información vive en un catálogo curado con enlaces oficiales y fecha de verificación.

## Funcionalidades

### Servicios públicos

- Búsqueda natural en español e inglés.
- Coincidencias múltiples con probabilidades.
- Estados conservadores para solicitudes ambiguas.
- Fuentes oficiales, autoridad responsable y fecha de verificación.
- Catálogo de trámites municipales, estatales y federales.

### Propuestas comerciales

- Carga y análisis automático de PDF, DOCX y TXT.
- Archivos de hasta 25 MB y 90,000 caracteres extraídos.
- Resumen breve del contenido.
- Revisión de alcance, precios, fechas y compromisos no estándar.
- El documento se procesa en memoria y no se persiste por la aplicación.

### Agenda personal

- Entrada por texto o reconocimiento de voz del navegador.
- Interpretación en vivo mientras el usuario habla.
- Creación, modificación y eliminación de eventos.
- Planes de varias tareas con prioridad baja, media o alta.
- Edición conversacional del plan antes de guardarlo.
- Detección de horarios ambiguos, duración y conflictos.
- Enlaces prellenados para Google Calendar.
- Persistencia local mediante `localStorage`.

## Tecnologías

- Next.js 15 y React 19
- TypeScript
- Tailwind CSS 4
- TypeSafe JavaScript SDK
- `pdf-parse` y `mammoth` para extracción de documentos
- Web Speech API para entrada de voz

## Ejecutar localmente

Requisitos: Node.js 20 LTS o 22 LTS y una clave de TypeSafe.

```bash
npm install
cp .env.example .env.local
```

Agrega la clave únicamente en `.env.local`:

```bash
TYPESAFE_API_KEY=tu_clave
```

Después inicia el entorno de desarrollo:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

Si no existe `TYPESAFE_API_KEY`, las rutas usan un modo demo determinista para que la interfaz siga siendo explorable.

## Scripts

```bash
npm run dev      # Desarrollo
npm run build    # Build de producción y comprobación de tipos
npm run start    # Ejecutar el build
npm run lint     # ESLint
npm run format   # Formatear el repositorio con Prettier
npm run format:check # Verificar el formato sin modificar archivos
```

## Rutas principales

| Ruta            | Descripción                              |
| --------------- | ---------------------------------------- |
| `/`             | Landing bilingüe                         |
| `/services`     | Buscador de servicios públicos           |
| `/proposals`    | Revisor de propuestas comerciales        |
| `/appointments` | Agenda personal por texto y voz          |
| `/admin`        | Revisión local de búsquedas no resueltas |

Las integraciones con TypeSafe viven en rutas de servidor dentro de `app/api`. La clave nunca se envía al navegador.

## Estructura

```text
app/
├── api/                  # Integraciones server-side y fallbacks
├── appointments/         # Agenda conversacional
├── components/           # UI compartida
├── lib/                  # Catálogos y tipos del dominio
├── proposals/            # Análisis de documentos
├── services/             # Buscador público
├── globals.css           # Tema Tailwind y patrones globales
└── page.tsx              # Landing
```

## Privacidad y seguridad

- La clave de TypeSafe se utiliza solo en el servidor.
- `.env.local` está excluido de Git.
- La agenda se guarda únicamente en el navegador del usuario.
- Los documentos no se escriben en disco ni se almacenan en una base de datos.
- No hay cuentas, pagos, formularios oficiales ni reservas reales.

No incluyas información sensible en una demo pública. Antes de desplegar en producción, añade límites de tráfico, monitoreo, política de retención y controles específicos para tu infraestructura.

## Estado del proyecto

OBRA es un prototipo activo. Los catálogos y umbrales deben revisarse periódicamente y validarse con casos reales antes de usarse en un flujo de producción.
