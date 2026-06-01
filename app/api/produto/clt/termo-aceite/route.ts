import { type NextRequest, NextResponse } from "next/server"
import { hubCreditoClient } from "@/lib/hubcredito-client"

/**
 * POST /api/produto/clt/termo-aceite
 * 
 * Gera ou verifica termo de aceite CLT
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lojaId, nome, cpf, email, telefone, dataNascimento, sexo } = body

    if (!lojaId || !nome || !cpf || !email || !telefone || !dataNascimento || !sexo) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Todos os campos são obrigatórios: lojaId, nome, cpf, email, telefone, dataNascimento, sexo' 
        },
        { status: 400 }
      )
    }

    console.log('Gerando termo de aceite CLT para CPF:', cpf)

    const response = await hubCreditoClient.gerarTermoAceiteCLT({
      lojaId,
      nome,
      cpf,
      email,
      telefone,
      dataNascimento,
      sexo,
    })

    if (!response.success) {
      console.error('Erro ao gerar termo de aceite:', response.error)
      return NextResponse.json(
        { 
          success: false,
          error: response.error || "Erro ao gerar termo de aceite na API HubCredito" 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: response.data,
    })
  } catch (error: any) {
    console.error("Erro ao gerar termo de aceite:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Erro interno do servidor" 
      },
      { status: 500 }
    )
  }
}

