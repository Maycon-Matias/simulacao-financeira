import { NextRequest, NextResponse } from 'next/server'
import { extractCredSpotInlineFromBody, resolveCredSpotClient, CREDSPOT_CLIENT_RESOLVE_ERROR } from '@/lib/credspot-resolve-client'

/**
 * PUT /api/produto/credspot/clt/contract/[contractUuid]/payment
 * CredSpot: PUT /clt/contract/{uuid}/payment
 */
export async function PUT(
  request: NextRequest,
  context: { params: { contractUuid: string } }
) {
  try {
    const { contractUuid } = context.params
    const body = await request.json()
    const { apiId, userUuid, disbursementDate, bankAccountUuid, disbursementBankAccounts, reason } = body

    if (!apiId) {
      return NextResponse.json({ success: false, error: 'apiId é obrigatório' }, { status: 400 })
    }
    if (!userUuid || !disbursementDate) {
      return NextResponse.json(
        { success: false, error: 'userUuid e disbursementDate são obrigatórios' },
        { status: 400 }
      )
    }

    const credspotClient = resolveCredSpotClient(apiId, extractCredSpotInlineFromBody(body as Record<string, unknown>))
    if (!credspotClient) {
      return NextResponse.json({ success: false, error: CREDSPOT_CLIENT_RESOLVE_ERROR }, { status: 400 })
    }
    const payload: Record<string, unknown> = { userUuid, disbursementDate }
    if (bankAccountUuid) payload.bankAccountUuid = bankAccountUuid
    if (disbursementBankAccounts) payload.disbursementBankAccounts = disbursementBankAccounts
    if (reason) payload.reason = reason

    const res = await credspotClient.authenticatedRequest(`/clt/contract/${contractUuid}/payment`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })

    if (!res.success) {
      return NextResponse.json(
        { success: false, error: res.error || 'Erro ao reapresentar pagamento', details: res.data },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: res.data?.data ?? res.data })
  } catch (error: any) {
    console.error('[CredSpot CLT Contract payment PUT]', error)
    return NextResponse.json({ success: false, error: error.message || 'Erro' }, { status: 500 })
  }
}
