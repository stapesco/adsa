// Fixture: async-no-log-violation — fails async-no-log.
// Async function with >5 body lines and no {adsa_path: ...} log line.

export async function ingestPayload(payload: Payload): Promise<Result> {
  const validated = await validate(payload);
  const enriched = await enrich(validated);
  const persisted = await persist(enriched);
  const notified = await notify(persisted);
  return notified;
}
