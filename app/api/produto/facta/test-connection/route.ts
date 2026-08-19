import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'

/**
 * POST /api/produto/facta/test-connection
 *
 * Testa a conexão com a API Facta (gera-token).
 * Executado no servidor para evitar problemas de CORS.
 * Body: apiId (opcional, usa padrão se não fornecido)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { apiId } = body as { apiId?: string }

    const manager = getApiManager()
    const apis = manager.getConfigs()
    const factaApi = apis.find(
      (api) => api.type === 'facta' && (apiId ? api.id === apiId : true),
    )

    if (!factaApi) {
      return NextResponse.json(
        { success: false, error: 'API Facta não configurada ou id não encontrado' },
        { status: 404 },
      )
    }

    const clientInstance = manager.getClientById(factaApi.id)
    if (!clientInstance || typeof (clientInstance as any).testConnection !== 'function') {
      return NextResponse.json(
        {
          success: false,
          error: 'registro Facta não disponível ou método testConnection não implementado',
        },
        { status: 500 },
      )
    }

    // Atualiza credenciais se necessário
    if (
      factaApi.username &&
      factaApi.password &&
      typeof (clientInstance as any).updateCredentials === 'function'
    ) {
      ;(clientInstance as any).updateCredentials(
        factaApi.username,
        factaApi.password,
        factaApi.baseUrl,
      )
    }

    const result = await (clientInstance as any).testConnection()

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Erro ao testar conexão Facta',
          data:
            result.data || ({
              connected: false,
              message: result.error || 'Erro ao testar conexão',
            } as const),
        },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      data:
        result.data ||
        ({
          connected: true,
          message: 'Conexão estabelecida com sucesso',
        } as const),
    })
  } catch (error: any) {
    console.error('[API] Facta test-connection:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro interno ao testar conexão Facta',
        data: {
          connected: false,
          message: error.message || 'Erro interno',
        },
      },
      { status: 500 },
    )
  }
}

