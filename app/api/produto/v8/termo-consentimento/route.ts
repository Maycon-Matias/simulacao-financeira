import { type NextRequest, NextResponse } from "next/server"
import { getApiManager } from "@/lib/api-manager"

/**
 * POST /api/produto/v8/termo-consentimento
 * 
 * Endpoint para criar termo de consentimento CLT na API V8 Digital
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cpf, nome, telefone, email, birthDate, gender, apiId } = body

    if (!cpf || cpf.trim() === '') {
      return NextResponse.json(
        { 
          success: false,
          error: 'CPF é obrigatório' 
        },
        { status: 400 }
      )
    }

    if (!nome || nome.trim() === '') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Nome completo é obrigatório' 
        },
        { status: 400 }
      )
    }

    if (!email || email.trim() === '') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Email é obrigatório' 
        },
        { status: 400 }
      )
    }

    if (!telefone || telefone.trim() === '') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Telefone é obrigatório' 
        },
        { status: 400 }
      )
    }

    if (!birthDate || birthDate.trim() === '') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Data de nascimento (birthDate) é obrigatória no formato YYYY-MM-DD' 
        },
        { status: 400 }
      )
    }

    if (!gender || (gender !== 'male' && gender !== 'female')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Gênero é obrigatório e deve ser "male" ou "female"' 
        },
        { status: 400 }
      )
    }

    const manager = getApiManager()
    const config = apiId ? manager.getConfig(apiId) : manager.getConfigs().find(c => c.active && c.type === 'v8digital')
    
    if (!config) {
      return NextResponse.json(
        { 
          success: false,
          error: 'API V8 Digital não encontrada ou não configurada' 
        },
        { status: 400 }
      )
    }

    if (config.type !== 'v8digital') {
      return NextResponse.json(
        { 
          success: false,
          error: 'API selecionada não é V8 Digital' 
        },
        { status: 400 }
      )
    }

    const client = manager.getClientById(config.id)
    
    if (!client) {
      return NextResponse.json(
        { 
          success: false,
          error: 'registro da API não encontrado' 
        },
        { status: 400 }
      )
    }

    if (!('criarTermoConsentimentoCLT' in client)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Método criarTermoConsentimentoCLT não disponível no registro V8 Digital' 
        },
        { status: 400 }
      )
    }

    const v8Client = client as any
    
    console.log('[v8/termo-consentimento] Criando termo de consentimento para CPF:', cpf)
    
    const response = await v8Client.criarTermoConsentimentoCLT({
      cpf,
      nome,
      telefone,
      email,
      birthDate,
      gender,
    })

    if (!response.success) {
      return NextResponse.json(
        { 
          success: false,
          error: response.error || 'Erro ao criar termo de consentimento' 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: response.data,
    })
  } catch (error: any) {
    console.error('[v8/termo-consentimento] Erro:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Erro ao criar termo de consentimento' 
      },
      { status: 500 }
    )
  }
}
