import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Valida assinatura Svix (CredSpot documenta headers svix-id, svix-timestamp, svix-signature).
 * Secret no formato `whsec_...` (retorno de GET /webhooks/endpoints/{id}/secret) ou bytes em base64 após o prefixo.
 */
export function verifyCredSpotSvixSignature(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
  signingSecret: string
): boolean {
  if (!svixId || !svixTimestamp || !svixSignature || !signingSecret) return false

  let key: Buffer
  if (signingSecret.startsWith('whsec_')) {
    key = Buffer.from(signingSecret.slice('whsec_'.length), 'base64')
  } else {
    key = Buffer.from(signingSecret, 'utf8')
  }

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`
  const expectedB64 = createHmac('sha256', key).update(signedContent).digest('base64')

  const candidates = svixSignature.trim().split(/\s+/)
  for (const part of candidates) {
    const comma = part.indexOf(',')
    if (comma === -1) continue
    const version = part.slice(0, comma)
    const sig = part.slice(comma + 1)
    if (version !== 'v1' || !sig) continue
    try {
      const a = Buffer.from(sig, 'base64')
      const b = Buffer.from(expectedB64, 'base64')
      if (a.length === b.length && timingSafeEqual(a, b)) return true
    } catch {
      /* ignore */
    }
  }
  return false
}
