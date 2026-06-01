import { NextRequest, NextResponse } from 'next/server'
import { extractCredSpotInlineFromSearchParams, resolveCredSpotClient, CREDSPOT_CLIENT_RESOLVE_ERROR } from '@/lib/credspot-resolve-client'

/**
 * GET /api/produto/credspot/contracts?apiId=...&status=&user_uuid=&limit=&offset=
 * CredSpot: GET /contracts
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

    const status = sp.get('status') || undefined
    const user_uuid = sp.get('user_uuid') || undefined
    const limit = sp.get('limit') ? parseInt(sp.get('limit')!, 10) : undefined
    const offset = sp.get('offset') ? parseInt(sp.get('offset')!, 10) : undefined

    const res = await client.listarContratosCLT({ status, user_uuid, limit, offset })
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error, details: res.data }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: res.data?.data ?? res.data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
