// Build-only replacement for app/chatgpt-auth.ts in the isolated candidate.
// x-map-owner is stripped at ingress and set only after server session validation.
import { headers } from 'next/headers';
export async function getChatGPTUser() {
  const h = await headers();
  return h.get('x-map-owner') === 'verified-owner'
    ? { userId: 'owner', email: 'owner@independent.invalid', displayName: '소유자', fullName: null }
    : null;
}
