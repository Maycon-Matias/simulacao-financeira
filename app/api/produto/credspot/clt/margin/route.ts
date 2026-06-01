import { NextRequest, NextResponse } from 'next/server'
import { extractCredSpotInlineFromBody, resolveCredSpotClient, CREDSPOT_CLIENT_RESOLVE_ERROR } from '@/lib/credspot-resolve-client'

/**
 * POST /api/produto/credspot/clt/margin
 *
 * CredSpot OpenAPI: POST /clt/margin com `userUuid` + `eligibilityUuid`
 * (uuid do contrato elegível retornado em consent-status ou webhook consent.completed).
 * Compatibilidade: aceita `contractUuid` como alias de `eligibilityUuid`.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiId, userUuid, eligibilityUuid, contractUuid } = body

    if (!apiId) {
      return NextResponse.json(
        {
          success: false,
          error: 'apiId é obrigatório',
        },
        { status: 400 }
      )
    }

    const el = eligibilityUuid || contractUuid
    if (!userUuid || !el) {
      return NextResponse.json(
        {
          success: false,
          error:
            'userUuid e eligibilityUuid são obrigatórios (conforme documentação CredSpot). eligibilityUuid é o uuid do contrato elegível; contractUuid é aceito como alias.',
        },
        { status: 400 }
      )
    }

    const inline = extractCredSpotInlineFromBody(body as Record<string, unknown>)
    const credspotClient = resolveCredSpotClient(apiId, inline)

    if (!credspotClient) {
      return NextResponse.json(
        {
          success: false,
          error: CREDSPOT_CLIENT_RESOLVE_ERROR,
        },
        { status: 400 }
      )
    }

    const marginResponse = await credspotClient.authenticatedRequest('/clt/margin', {
      method: 'POST',
      body: JSON.stringify({
        userUuid,
        eligibilityUuid: el,
      }),
    })

    if (!marginResponse.success) {
      return NextResponse.json(
        {
          success: false,
          error: marginResponse.error || 'Erro ao consultar margem',
          details: marginResponse.data,
        },
        { status: 500 }
      )
    }

    const raw = marginResponse.data?.data ?? marginResponse.data
    const inner = raw?.data ?? raw
    const cached = raw?.cached_data ?? inner?.cached_data

    const balanceInquiryUuid =
      inner?.balanceInquiryUuid ??
      raw?.balanceInquiryUuid ??
      cached?.uuid ??
      null

    const marginValue =
      cached?.available_margin_value ??
      inner?.available_margin_value ??
      raw?.available_margin_value ??
      raw?.margin ??
      0

    return NextResponse.json({
      success: true,
      data: {
        ...raw,
        balanceInquiryUuid,
        margin: marginValue,
        availableMargin: marginValue,
        eligibilityUuid: el,
        userUuid,
      },
    })
  } catch (error: any) {
    console.error('[CredSpot CLT Margin API] Erro:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao consultar margem',
      },
      { status: 500 }
    )
  }
}
