import { NextRequest, NextResponse } from 'next/server'
import { extractCredSpotInlineFromBody, resolveCredSpotClient, CREDSPOT_CLIENT_RESOLVE_ERROR } from '@/lib/credspot-resolve-client'

/**
 * POST /api/produto/credspot/clt/contract
 * CredSpot: POST /clt/contract — userUuid, selectedOptionUuid, bankAccountUuid
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiId, userUuid, selectedOptionUuid, bankAccountUuid } = body

    if (!apiId) {
      return NextResponse.json({ success: false, error: 'apiId é obrigatório' }, { status: 400 })
    }
    if (!userUuid || !selectedOptionUuid || !bankAccountUuid) {
      return NextResponse.json(
        {
          success: false,
          error: 'userUuid, selectedOptionUuid e bankAccountUuid são obrigatórios',
        },
        { status: 400 }
      )
    }

    const inline = extractCredSpotInlineFromBody(body as Record<string, unknown>)
    const credspotClient = resolveCredSpotClient(apiId, inline)
    if (!credspotClient) {
      return NextResponse.json({ success: false, error: CREDSPOT_CLIENT_RESOLVE_ERROR }, { status: 400 })
    }
    const res = await credspotClient.authenticatedRequest('/clt/contract', {
      method: 'POST',
      body: JSON.stringify({ userUuid, selectedOptionUuid, bankAccountUuid }),
    })

    if (!res.success) {
      return NextResponse.json(
        { success: false, error: res.error || 'Erro ao criar contrato', details: res.data },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: res.data?.data ?? res.data })
  } catch (error: any) {
    console.error('[CredSpot CLT Contract POST]', error)
    return NextResponse.json({ success: false, error: error.message || 'Erro' }, { status: 500 })
  }
}
