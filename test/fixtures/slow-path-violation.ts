// Fixture: slow-path-violation — fails slow-path-no-log.
// Function is marked slow (via name suffix and JSDoc) but does NOT emit
// the {adsa_path: "slow"} log line.

/**
 * @adsa:slow
 * Should have a log line at the top, but doesn't.
 */
export async function resolvePermissionsSlow(userId: string) {
  const result = await db.query(`SELECT * FROM perms WHERE user_id = $1`, [userId]);
  return result.rows;
}
