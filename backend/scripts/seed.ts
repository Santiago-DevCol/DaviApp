/**
 * Seeds synthetic technical documents for demos and search latency measurements.
 *
 *   pnpm --filter backend db:seed                      # 300 documents, appended
 *   pnpm --filter backend db:seed -- --count 1000      # custom amount
 *   pnpm --filter backend db:seed -- --reset           # TRUNCATE documents first
 *
 * Rows are inserted straight through Drizzle as INDEXED (the generated
 * `search_vector` column indexes them on insert) and the matching `.md`/`.txt`
 * file is written to STORAGE_DIR so the viewer works for seeded documents too.
 * `--reset` only truncates the table; files left in STORAGE_DIR are harmless.
 * Content is generated from a seeded PRNG, so repeated runs are reproducible.
 */
import { DocumentStatus } from '@techdocs/shared';
import { count, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { createDatabase, createPool, runMigrations } from '../src/shared/database/database.provider';
import { documents, NewDocumentRow } from '../src/shared/database/schema';

interface Topic {
  category: string;
  tags: string[];
  titles: { es: string[]; en: string[] };
  terms: { es: string[]; en: string[] };
}

const TOPICS: Topic[] = [
  {
    category: 'APIs',
    tags: ['rest', 'openapi', 'http', 'integración'],
    titles: {
      es: ['Guía de diseño de APIs REST', 'Versionado de endpoints públicos', 'Convenciones de errores HTTP'],
      en: ['REST API design guidelines', 'Pagination and filtering contract', 'Webhook delivery semantics'],
    },
    terms: {
      es: ['el endpoint de búsqueda', 'la autenticación OAuth2', 'el rate limiting', 'la idempotencia', 'la paginación por cursor', 'el esquema OpenAPI', 'los códigos de estado HTTP', 'los webhooks de notificación', 'la latencia p95', 'la cabecera ETag'],
      en: ['the search endpoint', 'OAuth2 client credentials', 'rate limiting', 'idempotency keys', 'cursor pagination', 'the OpenAPI schema', 'HTTP status codes', 'webhook retries', 'p95 latency', 'ETag caching'],
    },
  },
  {
    category: 'Deployment',
    tags: ['ci-cd', 'docker', 'release', 'rollback'],
    titles: {
      es: ['Procedimiento de despliegue continuo', 'Estrategia de rollback en producción', 'Checklist de publicación de versión'],
      en: ['Blue-green deployment runbook', 'Release checklist for production', 'Container image hardening'],
    },
    terms: {
      es: ['el pipeline de CI', 'la imagen Docker', 'el despliegue blue-green', 'el rollback automático', 'las variables de entorno', 'el registro de contenedores', 'la ventana de mantenimiento', 'los health checks', 'el versionado semántico', 'la firma de artefactos'],
      en: ['the CI pipeline', 'the Docker image', 'blue-green deployment', 'automatic rollback', 'environment variables', 'the container registry', 'the maintenance window', 'readiness probes', 'semantic versioning', 'artifact signing'],
    },
  },
  {
    category: 'Kubernetes',
    tags: ['k8s', 'helm', 'ingress', 'autoscaling'],
    titles: {
      es: ['Operación de clústeres Kubernetes', 'Guía de Helm charts internos', 'Diagnóstico de pods en CrashLoopBackOff'],
      en: ['Kubernetes resource limits playbook', 'Ingress and TLS termination guide', 'Horizontal pod autoscaling notes'],
    },
    terms: {
      es: ['el namespace de producción', 'los límites de CPU y memoria', 'el Horizontal Pod Autoscaler', 'el Ingress controller', 'los ConfigMaps y Secrets', 'el chart de Helm', 'las sondas de liveness', 'el PersistentVolumeClaim', 'la política de red', 'el ciclo de vida del pod'],
      en: ['the production namespace', 'CPU and memory limits', 'the Horizontal Pod Autoscaler', 'the Ingress controller', 'ConfigMaps and Secrets', 'the Helm chart', 'liveness probes', 'the PersistentVolumeClaim', 'network policies', 'the pod lifecycle'],
    },
  },
  {
    category: 'PostgreSQL',
    tags: ['sql', 'índices', 'fts', 'rendimiento'],
    titles: {
      es: ['Búsqueda de texto completo en PostgreSQL', 'Mantenimiento de índices GIN', 'Plan de respaldo y recuperación'],
      en: ['PostgreSQL full-text search tuning', 'VACUUM and bloat monitoring', 'Connection pooling guidelines'],
    },
    terms: {
      es: ['el índice GIN', 'la columna tsvector', 'la configuración spanish_unaccent', 'el plan de ejecución', 'el autovacuum', 'las columnas generadas', 'el pool de conexiones', 'la replicación en streaming', 'el WAL', 'la función ts_rank'],
      en: ['the GIN index', 'the tsvector column', 'the text search configuration', 'the query plan', 'autovacuum', 'generated columns', 'the connection pool', 'streaming replication', 'the write-ahead log', 'ts_rank weighting'],
    },
  },
  {
    category: 'Security',
    tags: ['owasp', 'tls', 'secretos', 'auditoría'],
    titles: {
      es: ['Política de gestión de secretos', 'Revisión de seguridad OWASP', 'Rotación de certificados TLS'],
      en: ['Secrets management policy', 'Threat model for file uploads', 'TLS certificate rotation runbook'],
    },
    terms: {
      es: ['la rotación de credenciales', 'el cifrado en reposo', 'la validación de entrada', 'el principio de mínimo privilegio', 'los registros de auditoría', 'el certificado TLS', 'la inyección SQL', 'el escaneo de dependencias', 'la autenticación multifactor', 'el límite de tamaño de archivo'],
      en: ['credential rotation', 'encryption at rest', 'input validation', 'least privilege', 'audit logs', 'the TLS certificate', 'SQL injection', 'dependency scanning', 'multi-factor authentication', 'the upload size limit'],
    },
  },
  {
    category: 'Grúas y equipos',
    tags: ['grúa', 'izaje', 'mantenimiento', 'seguridad industrial'],
    titles: {
      es: ['Manual de operación de grúa torre', 'Plan de mantenimiento preventivo de grúas móviles', 'Inspección de eslingas y accesorios de izaje'],
      en: ['Mobile crane daily inspection manual', 'Load chart interpretation guide', 'Overhead crane maintenance schedule'],
    },
    terms: {
      es: ['la tabla de cargas', 'el gancho de izaje', 'el cable de acero', 'el limitador de momento', 'los estabilizadores', 'la pluma telescópica', 'el radio de trabajo', 'la inspección diaria', 'el freno del mecanismo de elevación', 'el operador certificado'],
      en: ['the load chart', 'the hoist hook', 'the wire rope', 'the load moment indicator', 'the outriggers', 'the telescopic boom', 'the working radius', 'the daily inspection', 'the hoist brake', 'the certified operator'],
    },
  },
  {
    category: 'Manuals',
    tags: ['manual', 'operación', 'procedimiento'],
    titles: {
      es: ['Manual de usuario del portal de documentación', 'Procedimiento operativo estándar de carga de archivos', 'Manual de instalación del agente de monitoreo'],
      en: ['Operator manual for the indexing service', 'Installation manual for the monitoring agent', 'Troubleshooting manual for background jobs'],
    },
    terms: {
      es: ['el panel de control', 'la cola de trabajos', 'el estado PROCESSING', 'la notificación en tiempo real', 'el archivo PDF', 'el formulario de carga', 'el registro de errores', 'la sección de ayuda', 'el reinicio del servicio', 'la copia de seguridad'],
      en: ['the control panel', 'the job queue', 'the PROCESSING state', 'real-time notifications', 'the PDF file', 'the upload form', 'the error log', 'the help section', 'the service restart', 'the backup copy'],
    },
  },
  {
    category: 'Specifications',
    tags: ['especificación', 'requisitos', 'arquitectura'],
    titles: {
      es: ['Especificación funcional del buscador', 'Requisitos no funcionales de latencia', 'Especificación de la arquitectura hexagonal'],
      en: ['Functional specification of the search service', 'Non-functional requirements: latency and throughput', 'Event streaming specification'],
    },
    terms: {
      es: ['el requisito RF-01', 'el caso de uso de carga', 'la capa de dominio', 'el puerto de persistencia', 'el adaptador HTTP', 'el evento de dominio', 'el tiempo de respuesta máximo', 'la cobertura de pruebas', 'el diagrama de secuencia', 'el criterio de aceptación'],
      en: ['requirement RF-01', 'the upload use case', 'the domain layer', 'the persistence port', 'the HTTP adapter', 'the domain event', 'the maximum response time', 'test coverage', 'the sequence diagram', 'the acceptance criteria'],
    },
  },
];

const SENTENCES = {
  es: [
    'Antes de modificar {a}, revise {b} y registre el cambio en la bitácora.',
    'Esta sección describe cómo interactúa {a} con {b} en el entorno de producción.',
    'Si {a} presenta una anomalía, detenga la operación y verifique {b} de inmediato.',
    'El equipo responsable debe documentar {a} y mantener actualizada la configuración de {b}.',
    'Se recomienda medir {a} semanalmente para detectar desviaciones en {b}.',
    'En caso de duda sobre {a}, consulte la especificación vigente y el procedimiento asociado a {b}.',
    'La verificación de {a} forma parte de la lista de comprobación previa al arranque.',
    'Nunca omita {b}: es el control principal que protege {a}.',
  ],
  en: [
    'Before changing {a}, review {b} and record the change in the operations log.',
    'This section explains how {a} interacts with {b} in production.',
    'If {a} behaves unexpectedly, stop the operation and inspect {b} immediately.',
    'The owning team must document {a} and keep the configuration of {b} up to date.',
    'Measure {a} weekly to detect drift in {b} early.',
    'When in doubt about {a}, consult the current specification and the procedure covering {b}.',
    'Checking {a} is part of the pre-start checklist.',
    'Never skip {b}: it is the primary safeguard around {a}.',
  ],
};

const AUTHORS = [
  'Ana Torres', 'Luis Fernández', 'María Gómez', 'Carlos Pérez', 'Lucía Martín',
  'John Smith', 'Emily Clark', 'Diego Ramírez', 'Sofía Herrera', 'Michael Brown',
];

const SECTION_TITLES = {
  es: ['Alcance', 'Requisitos previos', 'Procedimiento', 'Verificación', 'Riesgos', 'Mantenimiento', 'Referencias'],
  en: ['Scope', 'Prerequisites', 'Procedure', 'Verification', 'Risks', 'Maintenance', 'References'],
};

type Lang = 'es' | 'en';

/** Small deterministic PRNG (mulberry32) so seeded data is reproducible. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function between(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function buildSentence(random: () => number, lang: Lang, terms: string[]): string {
  const a = pick(random, terms);
  let b = pick(random, terms);
  while (b === a) b = pick(random, terms);
  return pick(random, SENTENCES[lang]).replace('{a}', a).replace('{b}', b);
}

function buildBody(random: () => number, lang: Lang, topic: Topic, format: 'md' | 'txt', targetWords: number): string {
  const parts: string[] = [];
  let words = 0;
  let section = 0;
  while (words < targetWords) {
    const heading = SECTION_TITLES[lang][section % SECTION_TITLES[lang].length];
    parts.push(format === 'md' ? `## ${section + 1}. ${heading}` : `${section + 1}. ${heading.toUpperCase()}`);
    const paragraphs = between(random, 1, 3);
    for (let p = 0; p < paragraphs && words < targetWords; p += 1) {
      const sentences = Array.from({ length: between(random, 4, 7) }, () =>
        buildSentence(random, lang, topic.terms[lang]),
      );
      const paragraph = sentences.join(' ');
      words += paragraph.split(/\s+/).length;
      parts.push(paragraph);
    }
    section += 1;
  }
  return parts.join('\n\n');
}

interface SyntheticDocument {
  row: NewDocumentRow;
  fileContent: string;
}

function buildDocument(random: () => number, index: number): SyntheticDocument {
  const topic = pick(random, TOPICS);
  const lang: Lang = random() < 0.6 ? 'es' : 'en';
  const format: 'md' | 'txt' = random() < 0.6 ? 'md' : 'txt';
  const title = `${pick(random, topic.titles[lang])} (${index + 1})`;
  const version = `${between(random, 1, 4)}.${between(random, 0, 9)}.${between(random, 0, 20)}`;
  const body = buildBody(random, lang, topic, format, between(random, 300, 1400));
  const fileContent = format === 'md' ? `# ${title}\n\n${body}\n` : `${title}\n${'='.repeat(title.length)}\n\n${body}\n`;
  const id = randomUUID();
  const createdAt = new Date(Date.now() - between(random, 0, 365) * 86_400_000);
  const extraTag = pick(random, ['v' + version.split('.')[0], lang === 'es' ? 'español' : 'english', 'interno']);

  return {
    fileContent,
    row: {
      id,
      title,
      author: pick(random, AUTHORS),
      category: topic.category,
      tags: [...topic.tags.slice(0, between(random, 1, topic.tags.length)), extraTag],
      version,
      fileName: `${slugify(title)}.${format}`,
      format,
      storageKey: `${id}.${format}`,
      sizeBytes: Buffer.byteLength(fileContent, 'utf8'),
      status: DocumentStatus.INDEXED,
      errorMessage: null,
      content: fileContent,
      createdAt,
      updatedAt: createdAt,
    },
  };
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function loadEnv(): void {
  const envPath = path.resolve(__dirname, '../.env');
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

async function main(): Promise<void> {
  loadEnv();
  const { values } = parseArgs({
    // pnpm forwards the `--` separator literally (`db:seed -- --count 300`); drop it.
    args: process.argv.slice(2).filter((arg) => arg !== '--'),
    options: {
      count: { type: 'string', default: '300' },
      reset: { type: 'boolean', default: false },
      seed: { type: 'string', default: '42' },
    },
  });
  const total = Number.parseInt(values.count, 10);
  if (!Number.isInteger(total) || total <= 0) {
    throw new Error(`--count must be a positive integer, received "${values.count}"`);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required (set it in backend/.env or the environment)');
  }
  const storageDir = path.resolve(process.env.STORAGE_DIR ?? './storage');
  await mkdir(storageDir, { recursive: true });

  const pool = createPool(connectionString);
  const db = createDatabase(pool);
  try {
    await runMigrations(db);

    if (values.reset) {
      await db.execute(sql`TRUNCATE TABLE documents`);
      console.log('Truncated documents');
    }

    const random = createRandom(Number.parseInt(values.seed, 10) || 42);
    const batchSize = 50;
    const startedAt = Date.now();
    for (let offset = 0; offset < total; offset += batchSize) {
      const batch = Array.from({ length: Math.min(batchSize, total - offset) }, (_, i) =>
        buildDocument(random, offset + i),
      );
      await Promise.all(
        batch.map((doc) => writeFile(path.join(storageDir, doc.row.storageKey), doc.fileContent, 'utf8')),
      );
      await db.insert(documents).values(batch.map((doc) => doc.row));
      console.log(`Inserted ${Math.min(offset + batchSize, total)}/${total}`);
    }

    const [{ rows }] = await db.select({ rows: count() }).from(documents);
    console.log(
      `Seeded ${total} documents in ${Date.now() - startedAt}ms; documents table now has ${rows} rows (files under ${storageDir})`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
