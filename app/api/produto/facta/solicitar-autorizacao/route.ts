import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'
import type { FactaSolicitarAutorizacaoParams } from '@/lib/facta-client'

/**
 * POST /api/produto/facta/solicitar-autorizacao
 *
 * Solicita autorização de consulta ao trabalhador (Facta envia link por SMS ou WhatsApp).
 * Body: apiId? (opcional), averbador, nome, cpf, celular, tipo_envio ('SMS' | 'WHATSAPP')
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as {
      apiId?: string
      averbador?: string
      nome?: string
      cpf?: string
      celular?: string
      tipo_envio?: 'SMS' | 'WHATSAPP'
    }

    const { apiId, averbador, nome, cpf, celular, tipo_envio } = body

    if (!averbador || !nome || !cpf || !celular || !tipo_envio) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Campos obrigatórios: averbador, nome, cpf, celular, tipo_envio (SMS ou WHATSAPP)',
        },
        { status: 400 },
      )
    }

    if (tipo_envio !== 'SMS' && tipo_envio !== 'WHATSAPP') {
      return NextResponse.json(
        { success: false, error: 'tipo_envio deve ser SMS ou WHATSAPP' },
        { status: 400 },
      )
    }

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
    if (
      !clientInstance ||
      typeof (clientInstance as any).solicitarAutorizacaoConsulta !== 'function'
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'registro Facta não disponível ou método solicitarAutorizacaoConsulta não implementado',
        },
        { status: 500 },
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
        factaApi.baseUrl,
      )
    }

    const params: FactaSolicitarAutorizacaoParams = {
      averbador: String(averbador).trim(),
      nome: String(nome).trim(),
      cpf: String(cpf).trim(),
      celular: String(celular).trim(),
      tipo_envio,
    }

    const result = await (clientInstance as any).solicitarAutorizacaoConsulta(params)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Erro ao solicitar autorização', data: result.data },
        { status: 400 },
      )
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error: any) {
    console.error('[API] Facta solicitar-autorizacao:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao solicitar autorização' },
      { status: 500 },
    )
  }
}
