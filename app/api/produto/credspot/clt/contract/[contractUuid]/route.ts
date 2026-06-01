import { NextRequest, NextResponse } from 'next/server'
import { extractCredSpotInlineFromBody, resolveCredSpotClient, CREDSPOT_CLIENT_RESOLVE_ERROR } from '@/lib/credspot-resolve-client'

/**
 * DELETE /api/produto/credspot/clt/contract/[contractUuid]
 * CredSpot: DELETE /clt/contract/{uuid} — body { userUuid }
 */
export async function DELETE(
  request: NextRequest,
  context: { params: { contractUuid: string } }
) {
  try {
    const { contractUuid } = context.params
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const apiId = body.apiId as string | undefined
    const userUuid = body.userUuid as string | undefined

    if (!apiId) {
      return NextResponse.json({ success: false, error: 'apiId é obrigatório no body' }, { status: 400 })
    }
    if (!userUuid) {
      return NextResponse.json({ success: false, error: 'userUuid é obrigatório no body' }, { status: 400 })
    }

    const credspotClient = resolveCredSpotClient(apiId, extractCredSpotInlineFromBody(body))
    if (!credspotClient) {
      return NextResponse.json({ success: false, error: CREDSPOT_CLIENT_RESOLVE_ERROR }, { status: 400 })
    }
    const res = await credspotClient.authenticatedRequest(`/clt/contract/${contractUuid}`, {
      method: 'DELETE',
      body: JSON.stringify({ userUuid }),
    })

    if (!res.success) {
      return NextResponse.json(
        { success: false, error: res.error || 'Erro ao cancelar contrato', details: res.data },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: res.data?.data ?? res.data })
  } catch (error: any) {
    console.error('[CredSpot CLT Contract DELETE]', error)
    return NextResponse.json({ success: false, error: error.message || 'Erro' }, { status: 500 })
  }
}
