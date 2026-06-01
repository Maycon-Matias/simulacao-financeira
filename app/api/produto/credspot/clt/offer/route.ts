import { NextRequest, NextResponse } from 'next/server'
import { extractCredSpotInlineFromBody, resolveCredSpotClient, CREDSPOT_CLIENT_RESOLVE_ERROR } from '@/lib/credspot-resolve-client'

/**
 * POST /api/produto/credspot/clt/offer
 *
 * CredSpot OpenAPI: POST /clt/offer com `userUuid`, `balanceInquiryUuid`
 * e opcionalmente installments, disbursementValue, withInsurance, selectedTable.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      apiId,
      userUuid,
      balanceInquiryUuid,
      installments,
      disbursementValue,
      withInsurance,
      selectedTable,
    } = body

    if (!apiId) {
      return NextResponse.json(
        {
          success: false,
          error: 'apiId é obrigatório',
        },
        { status: 400 }
      )
    }

    if (!userUuid || !balanceInquiryUuid) {
      return NextResponse.json(
        {
          success: false,
          error:
            'userUuid e balanceInquiryUuid são obrigatórios (retorno de POST /clt/margin ou webhook margin.completed).',
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

    const offerBody: Record<string, unknown> = {
      userUuid,
      balanceInquiryUuid,
    }

    if (installments != null) offerBody.installments = Number(installments)
    if (disbursementValue != null) offerBody.disbursementValue = Number(disbursementValue)
    if (withInsurance !== undefined) offerBody.withInsurance = Boolean(withInsurance)
    if (selectedTable) offerBody.selectedTable = String(selectedTable)

    const offerResponse = await credspotClient.authenticatedRequest('/clt/offer', {
      method: 'POST',
      body: JSON.stringify(offerBody),
    })

    if (!offerResponse.success) {
      return NextResponse.json(
        {
          success: false,
          error: offerResponse.error || 'Erro ao simular ofertas',
          details: offerResponse.data,
        },
        { status: 500 }
      )
    }

    const offerData = offerResponse.data?.data || offerResponse.data
    const offers = offerData?.offers || offerData?.data || []
    const simulationUuid = offerData?.uuid

    return NextResponse.json({
      success: true,
      data: {
        offers,
        simulationUuid,
        selectedOptionUuid: simulationUuid,
        contractUuid: offerData?.contractUuid,
        ...offerData,
      },
    })
  } catch (error: any) {
    console.error('[CredSpot CLT Offer API] Erro:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao simular ofertas',
      },
      { status: 500 }
    )
  }
}
