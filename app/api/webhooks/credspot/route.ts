import { NextRequest, NextResponse } from 'next/server'
import { verifyCredSpotSvixSignature } from '@/lib/credspot-webhook-svix'

/**
 * POST /api/webhooks/credspot
 * Recebe webhooks da CredSpot (Svix). Configure a URL pública + POST /webhooks/endpoints na CredSpot.
 *
 * Segurança: defina `CREDSPOT_WEBHOOK_SIGNING_SECRET` (valor `whsec_...` do endpoint) para validar assinatura.
 * `CREDSPOT_WEBHOOK_SKIP_VERIFY=true` desliga a verificação (apenas ambientes controlados).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  const forceSkip = process.env.REDACTED === 'true'
  const secret = (process.env.REDACTED || '').trim()

  if (!forceSkip && secret) {
    const ok = verifyCredSpotSvixSignature(
      rawBody,
      request.headers.get('svix-id'),
      request.headers.get('svix-timestamp'),
      request.headers.get('svix-signature'),
      secret
    )
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Assinatura inválida' }, { status: 401 })
    }
  } else if (!forceSkip && !secret) {
    console.warn(
      '[CredSpot Webhook] CREDSPOT_WEBHOOK_SIGNING_SECRET não configurado — payload aceito sem verificação HMAC'
    )
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    payload = { raw: rawBody }
  }

  console.log('[CredSpot Webhook In]', JSON.stringify(payload).slice(0, 2000))

  return NextResponse.json({ success: true, received: true })
}
