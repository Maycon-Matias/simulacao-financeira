import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'

/**
 * POST /api/produto/c6bank/test-connection
 *
 * Testa a conexão com a API C6 Bank (obtém token de autenticação).
 * Executado no servidor para evitar problemas de CORS.
 * Body: apiId (opcional, usa padrão se não fornecido)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { apiId } = body

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
    if (!clientInstance || typeof (clientInstance as any).testConnection !== 'function') {
      return NextResponse.json(
        { success: false, error: 'registro C6 Bank não disponível ou método testConnection não implementado' },
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

    const result = await (clientInstance as any).testConnection()

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Erro ao testar conexão C6 Bank',
          data: result.data || { connected: false, message: result.error || 'Erro ao testar conexão' }
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data || { connected: true, message: 'Conexão estabelecida com sucesso' }
    })
  } catch (error: any) {
    console.error('[API] C6 Bank test-connection:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro interno ao testar conexão C6 Bank',
        data: { connected: false, message: error.message || 'Erro interno' }
      },
      { status: 500 }
    )
  }
}
