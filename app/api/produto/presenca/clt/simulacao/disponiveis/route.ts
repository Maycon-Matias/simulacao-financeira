import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'

/**
 * POST /api/produto/presenca/clt/simulacao/disponiveis
 *
 * Consulta tabelas disponíveis para simulação CLT (Consignado Privado)
 * Chama POST /v5/operacoes/simulacao/disponiveis
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiId, cpf, registroEmpregaticio, cnpjEmpregador, ...outrosParams } = body

    if (!apiId) {
      return NextResponse.json(
        {
          success: false,
          error: 'apiId é obrigatório',
        },
        { status: 400 }
      )
    }

    if (!cpf) {
      return NextResponse.json(
        {
          success: false,
          error: 'CPF é obrigatório',
        },
        { status: 400 }
      )
    }

    if (!registroEmpregaticio) {
      return NextResponse.json(
        {
          success: false,
          error: 'registroEmpregaticio (matrícula) é obrigatório',
        },
        { status: 400 }
      )
    }

    if (!cnpjEmpregador) {
      return NextResponse.json(
        {
          success: false,
          error: 'cnpjEmpregador (CNPJ do empregador) é obrigatório',
        },
        { status: 400 }
      )
    }

    const manager = getApiManager()
    const client = manager.getClientById(apiId)

    if (!client || (client as any).constructor.name !== 'PresencaBankClient') {
      return NextResponse.json(
        {
          success: false,
          error: 'API Presença Bank não encontrada ou inválida',
        },
        { status: 400 }
      )
    }

    const presencaBankClient = client as any

    const response = await presencaBankClient.consultarTabelasDisponiveisCLT({
      cpf,
      registroEmpregaticio,
      cnpjEmpregador,
      ...outrosParams,
    })

    if (!response.success) {
      return NextResponse.json(
        {
          success: false,
          error: response.error || 'Erro ao consultar tabelas disponíveis',
          details: response.data,
        },
        { status: 500 }
      )
    }

    const data = response.data?.data ?? response.data

    return NextResponse.json({
      success: true,
      data: data ?? {},
    })
  } catch (error: any) {
    console.error('[Presença Bank CLT Simulacao Disponiveis API] Erro:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao consultar tabelas disponíveis',
      },
      { status: 500 }
    )
  }
}
