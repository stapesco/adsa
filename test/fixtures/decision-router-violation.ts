// Fixture: decision-router-violation — fails decision-router.
// Function marked fast, has an if/else where the consequent contains I/O.

/**
 * @adsa:fast
 * The implicit fast/slow split — the if-branch does I/O but it's still
 * marked as fast because the author thinks "verify" means fast.
 */
export async function verifyTokenFast(token: string, refresh: boolean) {
  const claims = jwt.decode(token);
  if (refresh) {
    // This branch is the slow path hiding inside the fast one.
    return await db.sessions.findUnique({ where: { token } });
  }
  return claims;
}
