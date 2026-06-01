import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'

/**
 * POST /api/produto/presenca/clt/simular
 * 
 * Simula crédito CLT na Presença Bank
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      apiId,
      cpf,
      operacaoId,
      valorSolicitado,
      numeroParcelas,
      valorParcela,
      matricula,
      cnpj,
      registroEmpregaticio,
      cnpjEmpregador,
      ...outrosParams
    } = body

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

    const simulacaoResponse = await presencaBankClient.simularCreditoCLT({
      cpf,
      operacaoId,
      valorSolicitado,
      numeroParcelas,
      valorParcela,
      matricula,
      cnpj,
      registroEmpregaticio,
      cnpjEmpregador,
      ...outrosParams,
    })

    if (!simulacaoResponse.success) {
      return NextResponse.json(
        {
          success: false,
          error: simulacaoResponse.error || 'Erro ao simular crédito',
          details: simulacaoResponse.data,
        },
        { status: 500 }
      )
    }

    const simulacaoData = simulacaoResponse.data?.data || simulacaoResponse.data

    return NextResponse.json({
      success: true,
      data: {
        simulacoes: simulacaoData.simulacoes || simulacaoData.ofertas || simulacaoData.offers || simulacaoData.data || [],
        operacaoId: simulacaoData.operacaoId || simulacaoData.id || operacaoId,
        cpf: cpf.replace(/\D/g, ''),
        ...simulacaoData,
      },
    })
  } catch (error: any) {
    console.error('[Presença Bank CLT Simular API] Erro:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao simular crédito',
      },
      { status: 500 }
    )
  }
}
