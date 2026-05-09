const FALLBACK_USER_ID = "00000000-0000-0000-0000-000000000001";

export function getDefaultUserId(): string {
  const configured = process.env.KAIROS_DEFAULT_USER_ID?.trim();
  return configured || FALLBACK_USER_ID;
}
