import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'

/**
 * POST /api/produto/v8/autorizar-termo
 * 
 * Autoriza um termo de consentimento CLT na V8 Digital
 * 
 * Body:
 * - apiId: ID da API configurada (opcional; se omitido, usa a primeira API V8 ativa)
 * - consultId: ID do termo de consentimento a ser autorizado
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    let { apiId, consultId } = body

    if (!consultId) {
      return NextResponse.json(
        { success: false, error: 'consultId é obrigatório' },
        { status: 400 }
      )
    }

    const apiManager = getApiManager()
    // Se apiId não foi enviado (ex.: chamada do sistema WhatsApp sem config), usa a primeira V8 ativa
    if (!apiId || typeof apiId !== 'string' || !apiId.trim()) {
      const apis = apiManager.getConfigs()
      const v8Api = apis.find((c: { type?: string; active?: boolean }) => c.type === 'v8digital' && c.active !== false)
      if (v8Api) {
        apiId = v8Api.id
        console.log('[v8/autorizar-termo] apiId não informado, usando primeira V8 ativa:', apiId)
      }
    }

    if (!apiId) {
      return NextResponse.json(
        { success: false, error: 'apiId é obrigatório ou configure uma API V8 Digital' },
        { status: 400 }
      )
    }

    const config = apiManager.getConfig(apiId)

    if (!config) {
      return NextResponse.json(
        { success: false, error: `API com ID "${apiId}" não encontrada` },
        { status: 404 }
      )
    }

    if (config.type !== 'v8digital') {
      return NextResponse.json(
        { success: false, error: 'Esta rota é apenas para APIs V8 Digital' },
        { status: 400 }
      )
    }

    const client = apiManager.getClientById(apiId)
    if (!client || !('autorizarTermoConsentimentoCLT' in client)) {
      return NextResponse.json(
        { success: false, error: 'registro V8 Digital não configurado corretamente' },
        { status: 500 }
      )
    }

    const v8Client = client as any
    console.log('[v8/autorizar-termo] Autorizando termo:', consultId)

    const response = await v8Client.autorizarTermoConsentimentoCLT(consultId)

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error || 'Erro ao autorizar termo de consentimento' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: response.data,
    })
  } catch (error: any) {
    console.error('[v8/autorizar-termo] Erro:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao autorizar termo de consentimento' },
      { status: 500 }
    )
  }
}
