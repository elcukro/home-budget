/**
 * Creates headers for authenticated backend requests.
 *
 * SECURITY: This module centralizes the X-User-ID + X-Internal-Secret pattern
 * to prevent header spoofing attacks. The internal secret proves the request
 * comes from the trusted Next.js server, not a malicious client.
 *
 * Usage:
 *   import { createBackendHeaders } from '@/lib/backend-headers';
 *
 *   const headers = createBackendHeaders(session.user.email);
 *   await fetch(`${API_BASE_URL}/endpoint`, { headers });
 */

export function createBackendHeaders(userEmail: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-User-ID': userEmail,
  };

  // Include internal service secret to validate request origin
  const internalSecret = process.env.INTERNAL_SERVICE_SECRET;
  if (internalSecret) {
    headers['X-Internal-Secret'] = internalSecret;
  }

  return headers;
}

/**
 * Creates headers without Content-Type (for requests without body).
 */
export function createBackendHeadersNoBody(userEmail: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'X-User-ID': userEmail,
  };

  const internalSecret = process.env.INTERNAL_SERVICE_SECRET;
  if (internalSecret) {
    headers['X-Internal-Secret'] = internalSecret;
  }

  return headers;
}
