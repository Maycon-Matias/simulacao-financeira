import { NextRequest, NextResponse } from 'next/server'
import {
  extractCredSpotInlineFromBody,
  extractCredSpotInlineFromSearchParams,
  resolveCredSpotClient,
  CREDSPOT_CLIENT_RESOLVE_ERROR,
  type CredSpotInlineCredentials,
} from '@/lib/credspot-resolve-client'

async function runConsentStatus(
  apiId: string,
  relationshipInquiryUuid: string,
  inline?: CredSpotInlineCredentials
) {
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

  console.log('[CredSpot CLT Consent Status] Verificando status para:', {
    relationshipInquiryUuid,
    apiId,
  })

  const endpoint = `/clt/consent-status?inquiryUuid=${encodeURIComponent(relationshipInquiryUuid)}`
  console.log('[CredSpot CLT Consent Status] Endpoint completo:', endpoint)

  const statusResponse = await credspotClient.authenticatedRequest(endpoint)

  console.log('[CredSpot CLT Consent Status] Resposta da API:', {
    success: statusResponse.success,
    hasData: !!statusResponse.data,
    error: statusResponse.error,
    dataKeys: statusResponse.data ? Object.keys(statusResponse.data) : [],
    fullError: JSON.stringify(statusResponse.error, null, 2),
    fullData: JSON.stringify(statusResponse.data, null, 2),
  })

  if (!statusResponse.success) {
    const errorDetails = statusResponse.error?.details || statusResponse.data?.error?.details
    console.error('[CredSpot CLT Consent Status] Erro na resposta:', {
      error: statusResponse.error,
      errorCode: statusResponse.error?.code,
      errorMessage: statusResponse.error?.message,
      errorDetails: errorDetails,
      errorDetailsString: errorDetails ? JSON.stringify(errorDetails, null, 2) : undefined,
      data: statusResponse.data,
      fullError: JSON.stringify(statusResponse.error, null, 2),
      fullData: JSON.stringify(statusResponse.data, null, 2),
    })
    return NextResponse.json(
      {
        success: false,
        error:
          typeof statusResponse.error === 'string'
            ? statusResponse.error
            : statusResponse.error?.message || 'Erro ao verificar status do consentimento',
        details: statusResponse.data,
      },
      { status: 500 }
    )
  }

  const statusData = statusResponse.data?.data || statusResponse.data

  console.log('[CredSpot CLT Consent Status] Dados processados:', {
    hasStatusData: !!statusData,
    status: statusData?.status || statusData?.consentStatus,
    hasContracts: !!(statusData?.contracts || statusData?.data),
    keys: statusData ? Object.keys(statusData) : [],
  })

  return NextResponse.json({
    success: true,
    data: {
      status: statusData.status || statusData.consentStatus || 'pending',
      relationshipInquiryUuid: statusData.relationshipInquiryUuid || relationshipInquiryUuid,
      contracts: statusData.contracts || statusData.data || [],
      ...statusData,
    },
  })
}

/**
 * GET /api/produto/credspot/clt/consent-status?apiId=&relationshipInquiryUuid=
 * Opcional: credspotCredentials como JSON stringificado (pode estourar limite de URL).
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const relationshipInquiryUuid = searchParams.get('relationshipInquiryUuid')
    const apiId = searchParams.get('apiId')

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

    const inline = extractCredSpotInlineFromSearchParams(searchParams)

    return await runConsentStatus(apiId, relationshipInquiryUuid, inline)
  } catch (error: any) {
    console.error('[CredSpot CLT Consent Status API] Erro capturado:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      error: error,
    })
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao verificar status do consentimento',
        details: process.env.REDACTED === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/produto/credspot/clt/consent-status
 * Preferido: envia credspotCredentials no corpo (evita limite de URL e localStorage-only).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const relationshipInquiryUuid = String(body.relationshipInquiryUuid ?? '')
    const apiId = String(body.apiId ?? '')

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

    const inline = extractCredSpotInlineFromBody(body)
    return await runConsentStatus(apiId, relationshipInquiryUuid, inline)
  } catch (error: any) {
    console.error('[CredSpot CLT Consent Status API] Erro capturado:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      error: error,
    })
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao verificar status do consentimento',
        details: process.env.REDACTED === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
