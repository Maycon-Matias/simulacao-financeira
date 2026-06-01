import { NextRequest, NextResponse } from 'next/server'
import { extractCredSpotInlineFromBody, extractCredSpotInlineFromSearchParams, resolveCredSpotClient, CREDSPOT_CLIENT_RESOLVE_ERROR } from '@/lib/credspot-resolve-client'

/**
 * GET/POST /api/produto/credspot/webhooks/endpoints
 * CredSpot: GET|POST /webhooks/endpoints
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const apiId = sp.get('apiId')
    if (!apiId) {
      return NextResponse.json({ success: false, error: 'apiId é obrigatório' }, { status: 400 })
    }
    const client = resolveCredSpotClient(apiId, extractCredSpotInlineFromSearchParams(sp))
    if (!client) {
      return NextResponse.json({ success: false, error: CREDSPOT_CLIENT_RESOLVE_ERROR }, { status: 400 })
    }
    const res = await client.listarWebhookEndpoints()
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error, details: res.data }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: res.data?.data ?? res.data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiId, url, description } = body
    if (!apiId || !url) {
      return NextResponse.json({ success: false, error: 'apiId e url são obrigatórios' }, { status: 400 })
    }
    const client = resolveCredSpotClient(apiId, extractCredSpotInlineFromBody(body as Record<string, unknown>))
    if (!client) {
      return NextResponse.json({ success: false, error: CREDSPOT_CLIENT_RESOLVE_ERROR }, { status: 400 })
    }
    const res = await client.cadastrarWebhookEndpoint(url, description)
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error, details: res.data }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: res.data?.data ?? res.data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
