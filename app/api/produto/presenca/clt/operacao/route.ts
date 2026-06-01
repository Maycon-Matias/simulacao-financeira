import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'

/**
 * GET /api/produto/presenca/clt/operacao - Consulta operação CLT por ID
 * POST /api/produto/presenca/clt/operacao - Cria operação CLT (Consignado Privado)
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const apiId = searchParams.get('apiId')
    const operacaoId = searchParams.get('operacaoId') || searchParams.get('id')

    if (!apiId) {
      return NextResponse.json(
        {
          success: false,
          error: 'apiId é obrigatório',
        },
        { status: 400 }
      )
    }

    if (!operacaoId) {
      return NextResponse.json(
        {
          success: false,
          error: 'operacaoId é obrigatório',
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

    const operacaoResponse = await presencaBankClient.consultarOperacaoCLT(operacaoId)

    if (!operacaoResponse.success) {
      return NextResponse.json(
        {
          success: false,
          error: operacaoResponse.error || 'Erro ao consultar operação',
          details: operacaoResponse.data,
        },
        { status: 500 }
      )
    }

    const operacaoData = operacaoResponse.data?.data || operacaoResponse.data

    return NextResponse.json({
      success: true,
      data: {
        ...operacaoData,
        operacaoId: operacaoData.id || operacaoData.operacaoId || operacaoId,
      },
    })
  } catch (error: any) {
    console.error('[Presença Bank CLT Operação API] Erro:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao consultar operação',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiId, cpf, registroEmpregaticio, cnpjEmpregador, tipo, ...outrosParams } = body

    if (!apiId) {
      return NextResponse.json(
        { success: false, error: 'apiId é obrigatório' },
        { status: 400 }
      )
    }
    if (!cpf) {
      return NextResponse.json(
        { success: false, error: 'CPF é obrigatório' },
        { status: 400 }
      )
    }
    if (!registroEmpregaticio) {
      return NextResponse.json(
        { success: false, error: 'registroEmpregaticio (matrícula) é obrigatório' },
        { status: 400 }
      )
    }
    if (!cnpjEmpregador) {
      return NextResponse.json(
        { success: false, error: 'cnpjEmpregador (CNPJ do empregador) é obrigatório' },
        { status: 400 }
      )
    }

    const manager = getApiManager()
    const client = manager.getClientById(apiId)

    if (!client || (client as any).constructor.name !== 'PresencaBankClient') {
      return NextResponse.json(
        { success: false, error: 'API Presença Bank não encontrada ou inválida' },
        { status: 400 }
      )
    }

    const presencaBankClient = client as any
    const response = await presencaBankClient.criarOperacaoCLT({
      cpf,
      registroEmpregaticio,
      cnpjEmpregador,
      tipo,
      ...outrosParams,
    })

    if (!response.success) {
      return NextResponse.json(
        {
          success: false,
          error: response.error || 'Erro ao criar operação',
          details: response.data,
        },
        { status: 500 }
      )
    }

    const data = response.data?.data ?? response.data
    return NextResponse.json({
      success: true,
      data: {
        operacaoId: data?.id ?? data?.operacaoId,
        ...data,
      },
    })
  } catch (error: any) {
    console.error('[Presença Bank CLT Operação API POST] Erro:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao criar operação',
      },
      { status: 500 }
    )
  }
}
