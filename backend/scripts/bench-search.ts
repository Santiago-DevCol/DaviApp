/**
 * Fires varied search queries at a running API and reports latency percentiles.
 *
 *   pnpm --filter backend bench:search
 *   pnpm --filter backend bench:search -- --url http://localhost:3000 --requests 200 --concurrency 10
 *
 * Two clocks are reported: the server-side `X-Response-Time` header (handler
 * time) and the client wall clock (adds TCP/HTTP overhead). Uses the global
 * fetch of Node >= 18; no extra dependencies.
 */
import { parseArgs } from 'node:util';

const QUERIES = [
  'grúa',
  'kubernetes',
  'despliegue rollback',
  'índice GIN',
  '"plan de ejecución"',
  'tsvector',
  'certificado TLS',
  'manual de operación',
  'latencia p95',
  'pod autoscaler',
  'webhook',
  'inspección diaria',
  'cable de acero',
  'secretos',
  'procedimiento verificación',
  'helm chart',
  'paginación cursor',
  'tabla de cargas',
  'configuracion',
  'mantenimiento preventivo',
];

interface Sample {
  serverMs: number;
  wallMs: number;
  status: number;
  total: number;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function summarize(label: string, values: number[]): string {
  const fmt = (n: number) => n.toFixed(1).padStart(8);
  return (
    `${label.padEnd(14)} p50=${fmt(percentile(values, 50))}ms  p95=${fmt(percentile(values, 95))}ms  ` +
    `p99=${fmt(percentile(values, 99))}ms  max=${fmt(Math.max(...values))}ms`
  );
}

async function fire(baseUrl: string, index: number): Promise<Sample> {
  const q = QUERIES[index % QUERIES.length];
  const page = 1 + (index % 3);
  const url = `${baseUrl}/search?q=${encodeURIComponent(q)}&page=${page}&pageSize=10`;
  const startedAt = performance.now();
  const response = await fetch(url);
  const body = (await response.json()) as { total?: number };
  const wallMs = performance.now() - startedAt;
  const header = response.headers.get('x-response-time') ?? '';
  return {
    serverMs: Number.parseFloat(header) || Number.NaN,
    wallMs,
    status: response.status,
    total: body.total ?? 0,
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((arg) => arg !== '--'),
    options: {
      url: { type: 'string', default: 'http://localhost:3000' },
      requests: { type: 'string', default: '200' },
      concurrency: { type: 'string', default: '10' },
    },
  });
  const baseUrl = values.url.replace(/\/$/, '');
  const requests = Number.parseInt(values.requests, 10);
  const concurrency = Number.parseInt(values.concurrency, 10);
  if (!(requests > 0) || !(concurrency > 0)) {
    throw new Error('--requests and --concurrency must be positive integers');
  }

  const samples: Sample[] = [];
  let next = 0;
  const startedAt = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < requests) {
        const index = next;
        next += 1;
        samples.push(await fire(baseUrl, index));
      }
    }),
  );
  const elapsedMs = performance.now() - startedAt;

  const ok = samples.filter((sample) => sample.status === 200);
  const failures = samples.length - ok.length;
  console.log(
    `${samples.length} requests, concurrency ${concurrency}, ${QUERIES.length} distinct queries, ` +
      `${(elapsedMs / 1000).toFixed(2)}s wall (${(samples.length / (elapsedMs / 1000)).toFixed(1)} req/s)`,
  );
  console.log(summarize('server (hdr)', ok.map((sample) => sample.serverMs).filter(Number.isFinite)));
  console.log(summarize('client (wall)', ok.map((sample) => sample.wallMs)));
  console.log(
    `non-200 responses: ${failures}; empty results: ${ok.filter((sample) => sample.total === 0).length}`,
  );
  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
