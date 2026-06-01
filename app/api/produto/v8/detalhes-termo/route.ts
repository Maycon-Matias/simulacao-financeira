import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'

/** Evita pré-render estática no build (usa nextUrl.searchParams). */
export const dynamic = 'force-dynamic'

/**
 * GET /api/produto/v8/detalhes-termo
 * 
 * Busca detalhes completos de um termo de consentimento pelo ID
 * Isso pode incluir informações como link de consentimento, status, margem, etc.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const consultId = searchParams.get('consultId')

    if (!consultId) {
      return NextResponse.json(
        { success: false, error: 'ID do termo (consultId) é obrigatório' },
        { status: 400 }
      )
    }

    const apiManager = getApiManager()
    
    // Busca a configuração da V8 Digital
    const apis = apiManager.getConfigs()
    const v8Api = apis.find(api => api.type === 'v8digital')
    
    if (!v8Api) {
      return NextResponse.json(
        { success: false, error: 'API V8 Digital não configurada' },
        { status: 404 }
      )
    }

    const client = apiManager.getClientById(v8Api.id)
    
    if (!client || typeof (client as any).buscarDetalhesTermoCLT !== 'function') {
      return NextResponse.json(
        { success: false, error: 'registro V8 Digital não disponível ou método não implementado' },
        { status: 500 }
      )
    }

    console.log('[API] Buscando detalhes do termo:', consultId)
    
    const response = await (client as any).buscarDetalhesTermoCLT(consultId)
    
    if (!response.success) {
      const isRateLimit = response.error?.includes('Limite de') || response.error?.includes('aguarde')
      const isNotFound = response.error?.toLowerCase().includes('não encontrado') ?? false
      const status = isRateLimit ? 429 : isNotFound ? 404 : 500
      const errorMessage = isNotFound
        ? 'Termo não encontrado na listagem (pode estar fora do período consultado ou de outro parceiro).'
        : (response.error || 'Erro ao buscar detalhes do termo')
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          ...(isNotFound && { code: 'TERMO_NAO_ENCONTRADO' }),
        },
        { status }
      )
    }

    console.log('[API] Detalhes do termo obtidos:', JSON.stringify(response.data, null, 2))
    
    return NextResponse.json({
      success: true,
      data: response.data,
    })
  } catch (error: any) {
    console.error('[API] Erro ao buscar detalhes do termo:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Erro interno ao buscar detalhes do termo' 
      },
      { status: 500 }
    )
  }
}
