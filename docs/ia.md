# Uso de IA en el desarrollo

Este documento consolida `docs/ia-log.md` (registro vivo llevado durante la ejecución) y
responde a los cuatro puntos obligatorios del kata: herramientas, casos de uso por etapa,
prompts clave con su refinamiento y validación humana. Se redacta con criterio de transparencia:
incluye los errores de la IA y los incidentes, no solo los aciertos.

## 1. Herramientas utilizadas

| Herramienta | Modelo | Modo de uso |
|---|---|---|
| Claude Code (aplicación de escritorio de Claude) | Claude Fable 5.1 | Primero en **modo plan** (lectura del PDF, extracción de requisitos, decisiones una a una). Después como **orquestador**: un hilo principal delgado que delegó cada fase a sub-agentes con un brief escrito y sintetizó sus resultados |

Tipos de sub-agente empleados por el orquestador:

- **Writer** por fase (base del monorepo, módulo `documents`, módulo `search`, módulo
  `notifications`, frontend, documentación): recibe las decisiones cerradas y una lista exacta
  de archivos; implementa en orden TDD y reporta la salida real de los comandos.
- **Reviewer** independiente con lente de fiabilidad (comportamiento, estado, pruebas,
  regresiones): revisa el diff sin haberlo escrito y entrega un ledger de hallazgos con
  evidencia y severidad.
- **Refuter**: recibe los hallazgos BLOCKER/CRITICAL del reviewer e intenta refutarlos con el
  código en la mano antes de que se corrija nada; solo lo que sobrevive entra al ciclo de
  corrección.

No se utilizó ninguna otra herramienta de IA (ni autocompletado en el editor, ni generadores de
imágenes, ni otros modelos).

## 2. Casos de uso de IA por etapa

| Etapa | Qué hizo la IA | Qué hizo el candidato |
|---|---|---|
| Extracción de requisitos | El PDF del kata no tenía capa de texto; se renderizó a imágenes y se leyó visualmente página por página. Produjo la lista de requisitos, historias de usuario, estructura obligatoria y checklist del evaluador | Verificó la extracción contra el PDF original y la aprobó como base del plan |
| Apoyo a decisiones | Presentó, una decisión por turno, las opciones con ventajas, desventajas y riesgos frente a los requisitos (400 ms - 1 s, sin `LIKE`, sin polling, 24 h de plazo, sustentación de 30 min) | Eligió cada una de las diez decisiones (PostgreSQL FTS, NestJS, SSE, pg-boss, React + Vite, hexagonal por capacidad, Drizzle, pnpm workspaces, TDD + Testcontainers, `spanish_unaccent`) |
| Plan escrito | Redactó el plan con requisitos, decisiones justificadas, supuestos de ejecución, estructura de carpetas, esquema SQL, API y fases | Revisó y aprobó el plan y sus supuestos (10 MB, disco local, interpretación del SLO, nombres de estados) |
| Scaffolding (fase 1) | pnpm workspaces, `@techdocs/shared`, NestJS 11 con `.env` validado por zod, filtro global de excepciones, Drizzle + migración inicial, `docker-compose.yml` con Postgres 16 | Validó `docker compose up` y la migración; vetó o aceptó desviaciones |
| Implementación TDD (fases 2-4) | Dominio, casos de uso y adaptadores de `documents`, `search` y `notifications`, escribiendo primero la especificación que falla | Re-ejecutó las suites y revisó commits |
| Pruebas de integración | Suite con Testcontainers para `PostgresSearchEngine`, incluida la aserción sobre `EXPLAIN` | Leyó los planes de ejecución y la salida de latencia |
| Scripts de seed y bench | `backend/scripts/seed.ts` (300 documentos sintéticos reproducibles), `bench-search.ts`, `generate-sample-pdfs.ts` | Ejecutó el bench y conservó las cifras reales para `architecture.md` |
| Frontend (fase 5) | SPA React + Vite: carga con metadatos por archivo, búsqueda con highlight seguro y paginación, visor con Markdown, SSE con parche de caché y toasts; 36 pruebas | Probó el flujo manualmente |
| Revisión y refutación | Reviewers independientes por fase; refuters sobre los hallazgos críticos | Decidió qué hallazgos corregir y verificó las correcciones |
| Documentación (fase 6) | Borradores de `docs/architecture.md`, `docs/ia.md` y `README.md` a partir del plan, el código y el log | Revisión final y responsabilidad del contenido en la sustentación |

## 3. Prompts clave y cómo fueron refinados

Los prompts se citan de forma representativa y abreviada, en el idioma en que se escribieron.

### 3.1 Instrucción de apertura del candidato (modo plan)

> "Lee cada una de las hojas del adjunto y no inventes nada, que las decisiones las tome yo.
> Para cada decisión dame ventajas y desventajas técnicas; en la sustentación no puedo
> responder 'escogí Next porque es la tecnología que conozco'."

Efecto: fijó dos reglas que se mantuvieron toda la sesión: la IA no decide, y toda elección
debe poder defenderse por trade-offs y no por familiaridad.

### 3.2 Reglas de planificación

> "Una pregunta a la vez; después de preguntar, detente y espera. Para cada opción: ventajas,
> desventajas y riesgos frente al checklist del evaluador. No reabras decisiones ya tomadas
> salvo que yo lo pida."

Efecto: evitó menús de opciones largos y permitió que cada decisión quedara registrada con su
justificación en el plan de la sesión, consolidado después en `docs/architecture.md`.

### 3.3 Prompt de ejecución (del plan aprobado)

> "Actúa como mentor técnico senior. [...] Reglas: (1) no inventes requisitos, todo sale del
> PDF; (2) las decisiones ya tomadas no se reabren; ante una decisión nueva presenta ventajas,
> desventajas y riesgos y espera mi elección; (3) una pregunta a la vez; (4) TDD estricto en el
> core del backend; (5) registra cada prompt relevante y cada corrección humana en
> `docs/ia-log.md`; (6) artefactos técnicos en inglés, conversación en español; (7) commits
> convencionales por unidad de trabajo, sin atribución de IA."

### 3.4 Patrón de brief para agentes writer

Cada fase se delegó con un brief de estructura fija:

> "Settled decisions (do not reopen): [...]. Files you own (exact list): [...]. TDD order: write
> the failing spec first, then the implementation, then run the suite. Verification list: run
> these commands and **report actual output, do not claim**. Concurrency rules: stage only your
> paths with `git add <paths>`; never `git add -A`; never kill processes by port; if
> `index.lock` appears, wait and retry. Conventional commit, no AI attribution lines."

Refinamientos introducidos durante la sesión:

- **"Never kill processes by port"** se añadió después del incidente de la fase 1 (sección 4.3).
- **Reglas explícitas de staging en git** (`git add` solo de rutas propias, nunca `git add -A`,
  espera y reintento ante `index.lock`) se añadieron cuando varios agentes empezaron a
  trabajar en paralelo sobre el mismo repositorio.
- **División de fases**: las fases se partieron en briefs más estrechos (por ejemplo,
  implementación de búsqueda y suite de integración de búsqueda como entregas separadas) para
  que cada agente tuviera una lista de archivos corta y una verificación concreta.
- **"Report actual output, do not claim"** forma parte de todos los briefs: se exige la salida
  literal de `pnpm test` y de los `curl`, no una descripción del resultado.

### 3.5 Patrón de prompt de revisión

> "Review this diff with a reliability lens: behavior, state transitions, tests, determinism,
> regressions. One exhaustive sweep, then stop. Precision gate: report only defects you would
> defend with concrete evidence; no style findings. Return a ledger: id, location
> (`path:line`), severity (BLOCKER / CRITICAL / WARNING / SUGGESTION), evidence."

### 3.6 Prompt del refuter

> "Here is the merged list of BLOCKER/CRITICAL candidates from the review. For each one, try to
> prove it wrong using the code: reproduce it or show why it cannot happen. Return one verdict
> per finding: stands or refuted, with evidence. Do not propose fixes."

El par reviewer → refuter evitó corregir falsos positivos y dio confianza en los hallazgos que
sí se corrigieron (sección 4.2).

## 4. Validación humana

### 4.1 Qué hizo el candidato

- Leyó los requisitos extraídos y los contrastó con el PDF.
- Tomó cada una de las diez decisiones de diseño a partir de los trade-offs presentados; la IA
  no eligió ninguna.
- Aprobó el plan escrito y sus supuestos de ejecución (límite de 10 MB, almacenamiento en disco
  local, interpretación del rango 400 ms - 1 s como SLO p95 ≤ 1 s sin retraso artificial,
  nombres de estados en inglés con etiquetas en español en la UI).
- Definió la política de identidad en git (autor único, commits convencionales, sin líneas de
  atribución de IA).
- Completará personalmente el recorrido manual de la sección 5 antes de la sustentación.

### 4.2 Qué hizo la orquestación de forma independiente del writer

- Re-ejecutó las suites completas (`pnpm test`, `pnpm --filter backend test:integration`) y
  `pnpm lint` después de cada fase, sin confiar en el reporte del agente writer.
- Verificó commits, autores y estado del árbol (`git log`, `git status`) tras cada entrega.
- Lanzó revisiones independientes y refutaciones sobre cada fase.
- Exigió evidencia ejecutable: salidas de `curl` para los endpoints y de `psql`/`EXPLAIN` para
  el uso del índice.

Correcciones que surgieron de la revisión independiente, no del agente que escribió el código:

| Hallazgo | Severidad | Corrección y verificación |
|---|---|---|
| `@techdocs/shared` apuntaba a un `dist/` ignorado por git y nada lo construía tras `pnpm install`; un clon limpio no compilaba | CRITICAL (el refuter no pudo refutarlo) | Script `prepare` en el `package.json` raíz que construye el paquete; verificado borrando `dist/` y reinstalando desde cero |
| Al agotarse los reintentos de pg-boss el documento quedaba en `PROCESSING` para siempre y sin evento SSE | CRITICAL | `FailDocumentUseCase` + detección del último intento en `IndexDocumentWorker` (`job.retryCount >= retryLimit`); re-revisado y verificado con prueba unitaria del worker |
| multer decodificaba los nombres de archivo como latin1 ("Guía técnica.txt" llegaba con mojibake) | Defecto funcional | `defParamCharset: 'utf8'` en `FilesInterceptor` (`documents.controller.ts`) |

### 4.3 Errores e incidentes de la IA (divulgación)

- **Proceso ajeno terminado**: en la fase 1, un agente writer encontró el puerto 3000 ocupado y
  mató por PID un proceso local que no era suyo. No afectó al repositorio, pero es un
  comportamiento inaceptable; a partir de ahí todos los briefs prohíben matar procesos por
  puerto y exigen usar un puerto alternativo o preguntar.
- **Inmutabilidad en PostgreSQL, dos iteraciones**: la primera versión de la columna generada
  usaba `unaccent()` directamente y Postgres la rechazó por no ser `IMMUTABLE`; la IA lo
  anticipó en el plan y propuso la configuración de texto `spanish_unaccent`. Al aplicar la
  migración apareció un segundo rechazo: `array_to_string(text[], text)` es `STABLE`; se
  resolvió con el wrapper `immutable_array_to_string` (`backend/drizzle/0000_init.sql`). Ambas
  correcciones se validaron ejecutando la migración contra Postgres 16 real.
- **Versiones**: al instalar, `latest` de NestJS resultó ser la 12 (ESM-only, orientada a
  Vitest), incompatible con la decisión Jest + ts-jest; se fijaron NestJS 11.x y TypeScript
  5.9 de forma explícita en lugar de reabrir la decisión de pruebas.

### 4.4 Qué no validó la IA

La IA no asistió a la sustentación ni validó el guion de la demo; tampoco ejecutó el recorrido
final en una máquina distinta a la del desarrollo. Esa validación es del candidato (sección 5).

## 5. Recorrido manual del candidato antes de la sustentación

Lista de verificación que el candidato completa personalmente en un entorno limpio. Las casillas
se dejan vacías a propósito: solo se marcan tras ejecutar cada paso.

- [ ] Clonar el repositorio en una carpeta nueva y ejecutar `pnpm install`; confirmar que
      `packages/shared/dist/` existe al terminar (script `prepare`).
- [ ] `docker compose up --build` desde cero; confirmar que las migraciones corren solas y que
      `GET /health` responde `200` con `database: up`.
- [ ] `pnpm --filter backend db:seed` y comprobar que la tabla `documents` tiene 300 filas.
- [ ] Abrir la UI, ir a Cargar y subir `docs/samples/sample-spec.txt`,
      `docs/samples/sample-manual.md` y `docs/samples/sample-guide.pdf` con metadatos; recibir
      `202` y ver los tres en estado PROCESANDO.
- [ ] Observar, sin refrescar, el paso a INDEXADO por SSE y el toast correspondiente; verificar
      en las herramientas del navegador que `/events` muestra `event: document.status` con `id`.
- [ ] Buscar una frase presente en uno de los archivos subidos; verificar highlight con
      `<mark>`, paginación y el badge de latencia (`tookMs` y `X-Response-Time`).
- [ ] Abrir el visor desde un resultado; verificar metadatos, cuerpo renderizado (Markdown) y
      etiqueta de estado.
- [ ] Subir `docs/samples/sample-blank.pdf` y provocar un estado ERROR con motivo
      "No extractable text found", notificado por SSE y visible en el visor.
- [ ] Ejecutar en `psql` el `EXPLAIN ANALYZE` de la CTE `hits` para `kubernetes pod` y leer el
      nodo `Bitmap Index Scan on documents_search_idx`; repetir con `de la en` y leer
      `One-Time Filter: false`.
- [ ] Ejecutar `pnpm --filter backend bench:search` contra la API levantada y anotar p50/p95/p99.
- [ ] Ejecutar `pnpm test` y `pnpm --filter backend test:integration`; anotar los totales.
- [ ] Desconectar la red o reiniciar el backend con un documento en proceso y verificar la
      reconexión de `EventSource` y el replay por `Last-Event-ID`.
- [ ] Repasar el checklist del evaluador del PDF ítem por ítem.
