import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'

/**
 * POST /api/bancos/facta/consultar
 *
 * Consulta dados do trabalhador (vínculos CLT) na Facta por CPF.
 * Executado apenas no servidor; credenciais não são expostas ao client.
 *
 * Body: { cpf: string }
 * Resposta padronizada: { ok: boolean, banco: "FACTA", data?: any, error?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { cpf } = body as { cpf?: string }

    const cpfLimpo = typeof cpf === 'string' ? cpf.replace(/\D/g, '') : ''
    if (cpfLimpo.length !== 11) {
      return NextResponse.json(
        {
          ok: false,
          banco: 'FACTA',
          error: 'cpf é obrigatório e deve ter 11 dígitos',
        },
        { status: 400 }
      )
    }

    const manager = getApiManager()
    const apis = manager.getConfigs()
    const factaApi = apis.find((api) => api.type === 'facta')

    if (!factaApi) {
      return NextResponse.json(
        {
          ok: false,
          banco: 'FACTA',
          error: 'API Facta não configurada. Configure FACTA_API_BASE_URL, usuário e ******.',
        },
        { status: 404 }
      )
    }

    const clientInstance = manager.getClientById(factaApi.id)
    if (!clientInstance || typeof (clientInstance as any).consultarDadosTrabalhador !== 'function') {
      return NextResponse.json(
        {
          ok: false,
          banco: 'FACTA',
          error: 'registro Facta não disponível',
        },
        { status: 500 }
      )
    }

    if (
      factaApi.username &&
      factaApi.****** &&
      typeof (clientInstance as any).updateCredentials === 'function'
    ) {
      ;(clientInstance as any).updateCredentials(
        factaApi.username,
        factaApi.******,
        factaApi.baseUrl
      )
    }

    const result = await (clientInstance as any).consultarDadosTrabalhador(cpfLimpo)

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          banco: 'FACTA',
          error: result.error || 'Erro ao consultar trabalhador na Facta',
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      ok: true,
      banco: 'FACTA',
      data: result.data,
    })
  } catch (error: any) {
    console.error('[API] bancos/facta/consultar:', error)
    return NextResponse.json(
      {
        ok: false,
        banco: 'FACTA',
        error: error?.message || 'Erro interno ao consultar Facta',
      },
      { status: 500 }
    )
  }
}
