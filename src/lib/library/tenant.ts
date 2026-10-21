/**
 * LIBRARY_STORE — Tenant Resolution (Offline Store)
 */

export async function getActiveActivation(): Promise<null> {
  return null
}

export async function requireTenantId(): Promise<string> {
  return 'default'
}

export async function requireProvisioning(): Promise<{ tenantId: string }> {
  return { tenantId: 'default' }
}
