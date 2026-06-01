import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'

/**
 * POST /api/produto/presenca/clt/consent
 * 
 * Cria termo de consentimento para consulta CLT na Presença Bank
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiId, cpf, nome, telefone, email, dataNascimento, ...outrosParams } = body

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

    console.log('[Presença Bank CLT Consent] Criando termo de consentimento com dados:', {
      cpf: cpf.replace(/\D/g, ''),
      nome,
      telefone: telefone ? telefone.replace(/\D/g, '') : undefined,
      email,
      dataNascimento,
    })

    const consentResponse = await presencaBankClient.criarTermoConsentimentoCLT({
      cpf,
      nome,
      telefone,
      email,
      dataNascimento,
      ...outrosParams,
    })

    console.log('[Presença Bank CLT Consent] Resposta da criação de termo:', {
      success: consentResponse.success,
      hasData: !!consentResponse.data,
      error: consentResponse.error,
      dataKeys: consentResponse.data ? Object.keys(consentResponse.data) : [],
    })

    if (!consentResponse.success) {
      console.error('[Presença Bank CLT Consent] Erro ao criar termo de consentimento:', {
        error: consentResponse.error,
        data: consentResponse.data,
      })
      return NextResponse.json(
        {
          success: false,
          error: consentResponse.error || 'Erro ao criar termo de consentimento',
          details: consentResponse.data,
        },
        { status: 500 }
      )
    }

    const consentData = consentResponse.data?.data || consentResponse.data

    return NextResponse.json({
      success: true,
      data: {
        ...consentData,
        operacaoId: consentData.id || consentData.operacaoId || consentData.operacao_id,
        cpf: cpf.replace(/\D/g, ''),
      },
    })
  } catch (error: any) {
    console.error('[Presença Bank CLT Consent API] Erro capturado:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      error: error,
    })
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao processar termo de consentimento',
        details: process.env.REDACTED === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
