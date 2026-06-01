import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'

/**
 * POST /api/produto/presenca/clt/margin
 * 
 * Consulta margem disponível para CLT na Presença Bank
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiId, cpf, matricula, cnpj } = body

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

    if (!matricula) {
      return NextResponse.json(
        {
          success: false,
          error: 'Matrícula é obrigatória',
        },
        { status: 400 }
      )
    }

    if (!cnpj || cnpj.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'CNPJ é obrigatório' },
        { status: 400 }
      )
    }

    const cnpjLimpo = cnpj.replace(/\D/g, '')
    if (cnpjLimpo.length < 14) {
      return NextResponse.json(
        {
          success: false,
          error: `CNPJ inválido: deve ter pelo menos 14 dígitos (recebido: ${cnpjLimpo.length} dígitos)`,
        },
        { status: 400 }
      )
    }
    if (cnpjLimpo === '00000000000000') {
      return NextResponse.json(
        { success: false, error: 'CNPJ inválido: valor não pode ser apenas zeros. Use o CNPJ real do empregador do vínculo.' },
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

    const marginResponse = await presencaBankClient.consultarMargemCLT({
      cpf,
      matricula,
      cnpj
    })

    if (!marginResponse.success) {
      const data = marginResponse.data as any
      let errorMsg =
        marginResponse.error ||
        (typeof data?.message === 'string' ? data.message : null) ||
        (Array.isArray(data?.errors) && data.errors[0] ? String(data.errors[0]) : null) ||
        (typeof data?.error === 'string' ? data.error : null) ||
        'Erro ao consultar margem'
      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
          details: marginResponse.data,
          rateLimit: (marginResponse as any).rateLimit || false,
        },
        { status: (marginResponse as any).rateLimit ? 429 : 500 }
      )
    }

    const marginData = marginResponse.data?.data || marginResponse.data

    return NextResponse.json({
      success: true,
      data: {
        margem: marginData.valorMargemDisponivel ?? marginData.margem ?? marginData.margin ?? marginData.availableMargin ?? marginData.available_margin ?? 0,
        cpf: cpf.replace(/\D/g, ''),
        status: marginData.status || 'processing',
        ...marginData,
      },
    })
  } catch (error: any) {
    console.error('[Presença Bank CLT Margin API] Erro:', error)
    const errorMsg =
      error?.message ||
      (typeof error === 'string' ? error : null) ||
      error?.toString?.() ||
      'Erro ao consultar margem'
    return NextResponse.json(
      {
        success: false,
        error: String(errorMsg).trim() || 'Erro ao consultar margem',
      },
      { status: 500 }
    )
  }
}
