import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'
import { extrairVinculos } from '@/lib/utils'

/**
 * POST /api/produto/presenca/clt/vinculos
 * 
 * Consulta vínculos empregatícios para CLT na Presença Bank
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiId, cpf } = body

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

    const vinculosResponse = await presencaBankClient.consultarVinculosCLT(cpf)

    if (!vinculosResponse.success) {
      const erroBruto = String(vinculosResponse.error || '').trim()
      let mensagemAmigavel = erroBruto || 'Erro ao consultar vínculos'

      // Caso comum: Presença devolve 400 genérico para CPF sem vínculo/dados não aceitos.
      // Para o operador, o que importa é entender que não há vínculo CLT (logo, sem margem).
      if (erroBruto === 'Erro ao fazer login na API Banco Presença' || erroBruto.toLowerCase().includes('login')) {
        // Mantém mensagem de login como erro técnico
        mensagemAmigavel = erroBruto
      } else if (erroBruto === 'Erro na requisição: 400 Bad Request' || erroBruto.includes('400 Bad Request')) {
        mensagemAmigavel = 'CPF sem vínculo CLT ativo na Presença Bank ou dados não aceitos pela API. Trate como registro sem margem disponível.'
      }

      return NextResponse.json(
        {
          success: false,
          error: mensagemAmigavel,
          details: vinculosResponse.data,
          rateLimit: (vinculosResponse as any).rateLimit || false, // Propaga flag rateLimit
        },
        { status: (vinculosResponse as any).rateLimit ? 429 : 500 }
      )
    }

    const vinculos = extrairVinculos(vinculosResponse.data)

    return NextResponse.json({
      success: true,
      data: {
        cpf: cpf.replace(/\D/g, ''),
        vinculos,
      },
    })
  } catch (error: any) {
    console.error('[Presença Bank CLT Vínculos API] Erro:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao consultar vínculos',
      },
      { status: 500 }
    )
  }
}
