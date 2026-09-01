// Fixture: fast-path-violation — fails fast-path-with-io.
// Function is marked fast but performs I/O (fetch).

/**
 * @adsa:fast
 * The "cache" that isn't — calls fetch on every invocation.
 */
export async function checkRateLimitFast(userId: string): Promise<boolean> {
  const response = await fetch(`/api/rate-limit/${userId}`);
  const data = await response.json();
  return data.allowed;
}
