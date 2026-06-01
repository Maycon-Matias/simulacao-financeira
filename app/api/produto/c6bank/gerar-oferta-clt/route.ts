import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'

/**
 * POST /api/produto/c6bank/gerar-oferta-clt
 *
 * Gera oferta de Consignado Trabalhador (CLT) no C6 Bank.
 * Manual V29.1 - Seção "Geração de oferta - Consignado Trabalhador"
 * Body: apiId?, cpf_cliente, cpf_representante_legal?
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      apiId,
      cpf_cliente,
      cpf_representante_legal
    } = body

    if (!cpf_cliente) {
      return NextResponse.json(
        { success: false, error: 'cpf_cliente obrigatório' },
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
    if (!clientInstance || typeof (clientInstance as any).gerarOfertaConsignadoTrabalhador !== 'function') {
      return NextResponse.json(
        { success: false, error: 'registro C6 Bank não disponível ou método gerarOfertaConsignadoTrabalhador não implementado' },
        { status: 500 }
      )
    }

    // Atualiza credenciais se necessário
    if (c6Api.username && c6Api.****** && typeof (clientInstance as any).updateCredentials === 'function') {
      const authUrl = (c6Api as any).authUrl
      ;(clientInstance as any).updateCredentials(
        c6Api.username,
        c6Api.******,
        c6Api.baseUrl,
        authUrl
      )
    }

    const result = await (clientInstance as any).gerarOfertaConsignadoTrabalhador({
      cpf_cliente: String(cpf_cliente).replace(/\D/g, ''),
      cpf_representante_legal: cpf_representante_legal ? String(cpf_representante_legal).replace(/\D/g, '') : undefined
    })

    console.log('[API] C6 Bank gerar-oferta-clt - Resultado:', JSON.stringify(result, null, 2))

    if (!result.success) {
      console.error('[API] C6 Bank gerar-oferta-clt - Erro:', result.error, 'Details:', result.data)
      
      // Se o erro indica que precisa de autorização, retorna status específico
      if (result.data && (result.data as any).requiresAuthorization) {
        return NextResponse.json(
          { 
            success: false, 
            error: result.error || 'Autorização necessária para gerar oferta',
            requiresAuthorization: true,
            authorizationStatus: (result.data as any).authorizationStatus,
            message: (result.data as any).message,
            details: result.data 
          },
          { status: 403 }
        )
      }
      
      return NextResponse.json(
        { success: false, error: result.error || 'Erro ao gerar oferta Consignado Trabalhador C6 Bank', details: result.data },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error: any) {
    console.error('[API] C6 Bank gerar-oferta-clt:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao gerar oferta Consignado Trabalhador' },
      { status: 500 }
    )
  }
}
