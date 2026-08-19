import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'

/**
 * POST /api/produto/c6bank/autorizacao/status
 *
 * Consulta status da autorização de consulta de dados CLT no C6 Bank.
 * Manual V29.1 - Seção "Consulta de status da autorização do registro"
 * Body: apiId?, cpf
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      apiId,
      cpf
    } = body

    if (!cpf) {
      return NextResponse.json(
        { success: false, error: 'cpf é obrigatório' },
        { status: 400 }
      )
    }

    const manager = getApiManager()
    const apis = manager.getConfigs()
    const c6Api = apis.find(api => api.type === 'c6bank' && (apiId ? api.id === apiId : true))
    if (!c6Api) {
      return NextResponse.json(
        { success: false, error: 'API C6 Bank não configurada ou id não encontrado' },
        { status: 404 }
      )
    }

    const clientInstance = manager.getClientById(c6Api.id)
    if (!clientInstance || typeof (clientInstance as any).consultarStatusAutorizacao !== 'function') {
      return NextResponse.json(
        { success: false, error: 'registro C6 Bank não disponível ou método consultarStatusAutorizacao não implementado' },
        { status: 500 }
      )
    }

    // Atualiza credenciais se necessário
    if (c6Api.username && c6Api.password && typeof (clientInstance as any).updateCredentials === 'function') {
      const authUrl = (c6Api as any).authUrl
      ;(clientInstance as any).updateCredentials(
        c6Api.username,
        c6Api.password,
        c6Api.baseUrl,
        authUrl
      )
    }

    const result = await (clientInstance as any).consultarStatusAutorizacao({
      cpf: String(cpf).replace(/\D/g, '')
    })

    console.log('[API] C6 Bank consultar-status-autorizacao - Resultado:', JSON.stringify(result, null, 2))

    if (!result.success) {
      console.error('[API] C6 Bank consultar-status-autorizacao - Erro:', result.error, 'Details:', result.data)
      return NextResponse.json(
        { success: false, error: result.error || 'Erro ao consultar status de autorização C6 Bank', details: result.data },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error: any) {
    console.error('[API] C6 Bank consultar-status-autorizacao:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao consultar status de autorização' },
      { status: 500 }
    )
  }
}
