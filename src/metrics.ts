// In-memory counters for MKB-016 — no external metrics system exists in this project
// (no HTTP server, single polling process), so this is deliberately just numbers kept
// in memory and surfaced through /health, not exported anywhere else. They reset on
// every restart, which is fine: they answer "is something wrong right now", not "give
// me a historical dashboard".

interface Counters {
  handlerErrors: number;
  rateFallbacks: number;
  idempotentGuardHits: number;
}

const counters: Counters = {
  handlerErrors: 0,
  rateFallbacks: 0,
  idempotentGuardHits: 0,
};

export function recordHandlerError(): void {
  counters.handlerErrors += 1;
}

export function recordRateFallback(): void {
  counters.rateFallbacks += 1;
}

/** A repeat callback/update was caught by an idempotency guard (undo/delete already done, flow:save with no pending flow, reminder already recording, ...). */
export function recordIdempotentGuardHit(): void {
  counters.idempotentGuardHits += 1;
}

export function getCounters(): Readonly<Counters> {
  return { ...counters };
}

const processStartedAt = new Date();

export function getUptimeMs(): number {
  return Date.now() - processStartedAt.getTime();
}
