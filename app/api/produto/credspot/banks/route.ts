import { NextRequest, NextResponse } from 'next/server'
import { extractCredSpotInlineFromSearchParams, resolveCredSpotClient, CREDSPOT_CLIENT_RESOLVE_ERROR } from '@/lib/credspot-resolve-client'

/**
 * GET /api/produto/credspot/banks?apiId=...
 * CredSpot: GET /banks
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
    const res = await client.listarBancos()
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error, details: res.data }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: res.data?.data ?? res.data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
