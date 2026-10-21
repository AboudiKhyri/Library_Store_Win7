/**
 * Safe no-op: stationery store products do not expire.
 */
export async function sweepExpiredBatchesForTenant(): Promise<number> {
  return 0
}
