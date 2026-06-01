import { NextRequest, NextResponse } from 'next/server'
import { extractCredSpotInlineFromBody, resolveCredSpotClient, CREDSPOT_CLIENT_RESOLVE_ERROR } from '@/lib/credspot-resolve-client'

/**
 * POST /api/produto/credspot/clt/consent/accept
 * 
 * Aceita/autoriza o consentimento CLT automaticamente na CredSpot
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiId, relationshipInquiryUuid } = body

    if (!apiId) {
      return NextResponse.json(
        {
          success: false,
          error: 'apiId é obrigatório',
        },
        { status: 400 }
      )
    }

    if (!relationshipInquiryUuid) {
      return NextResponse.json(
        {
          success: false,
          error: 'relationshipInquiryUuid é obrigatório',
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

    console.log('[CredSpot CLT Consent Accept] Aceitando consentimento:', {
      relationshipInquiryUuid,
      apiId,
    })

    const acceptResponse = await credspotClient.aceitarConsentimentoCLT(relationshipInquiryUuid)

    console.log('[CredSpot CLT Consent Accept] Resposta:', {
      success: acceptResponse.success,
      error: acceptResponse.error,
      hasData: !!acceptResponse.data,
    })

    if (!acceptResponse.success) {
      return NextResponse.json(
        {
          success: false,
          error: typeof acceptResponse.error === 'string' 
            ? acceptResponse.error 
            : acceptResponse.error?.message || 'Erro ao aceitar consentimento',
          details: acceptResponse.data,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: acceptResponse.data?.data || acceptResponse.data,
    })
  } catch (error: any) {
    console.error('[CredSpot CLT Consent Accept API] Erro:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao processar aceitação do consentimento',
      },
      { status: 500 }
    )
  }
}
