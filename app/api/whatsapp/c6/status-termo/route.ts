import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'

/**
 * POST /api/whatsapp/c6/status-termo
 * Verifica se o termo de autorização C6 foi aceito pelo registro.
 * Body: { cpf }, apiId?: string
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const cpf = String(body.cpf ?? '').replace(/\D/g, '')
    const apiId = body.apiId

    if (cpf.length !== 11) {
      return NextResponse.json({
        success: false,
        error: 'CPF inválido',
        status: null
      }, { status: 400 })
    }

    const manager = getApiManager()
    const configs = manager.getConfigs()
    const c6Config = apiId
      ? configs.find((c: any) => c.type === 'c6bank' && c.id === apiId)
      : configs.find((c: any) => c.type === 'c6bank' && c.active)
    if (!c6Config) {
      return NextResponse.json({
        success: false,
        error: 'API C6 Bank não configurada',
        status: null
      }, { status: 404 })
    }

    const client = manager.getClientById(c6Config.id) as any
    if (!client?.cltAuthorizationStatus) {
      return NextResponse.json({
        success: false,
        error: 'registro C6 não disponível',
        status: null
      }, { status: 500 })
    }

    if (c6Config.username && c6Config.****** && typeof client.updateCredentials === 'function') {
      client.updateCredentials(c6Config.username, c6Config.******, c6Config.baseUrl, (c6Config as any).authUrl)
    }

    const result = await client.cltAuthorizationStatus({ cpf })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Falha ao consultar status',
        status: null
      }, { status: 502 })
    }

    const status = result.data?.status ?? null
    const observacao = result.data?.observacao ?? null

    return NextResponse.json({
      success: true,
      status,
      observacao,
      aceito: String(status || '').toUpperCase() === 'AUTHORIZED' || String(status || '').toUpperCase() === 'ACEITO'
    })
  } catch (e: any) {
    console.error('[whatsapp/c6/status-termo]', e)
    return NextResponse.json({
      success: false,
      error: e?.message || 'Erro interno',
      status: null
    }, { status: 500 })
  }
}
