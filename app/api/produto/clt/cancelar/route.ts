import { type NextRequest, NextResponse } from "next/server"
import { hubCreditoClient } from "@/lib/hubcredito-client"

/**
 * DELETE /api/produto/clt/cancelar
 * 
 * Cancela uma proposta CLT
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const propostaId = searchParams.get('propostaId')

    if (!propostaId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Parâmetro propostaId é obrigatório' 
        },
        { status: 400 }
      )
    }

    console.log('Cancelando proposta CLT ID:', propostaId)

    const response = await hubCreditoClient.cancelarPropostaCLT(propostaId)

    if (!response.success) {
      console.error('Erro ao cancelar proposta CLT:', response.error)
      return NextResponse.json(
        { 
          success: false,
          error: response.error || "Erro ao cancelar proposta CLT na API HubCredito" 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: response.data,
    })
  } catch (error: any) {
    console.error("Erro ao cancelar proposta CLT:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Erro interno do servidor" 
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/produto/clt/cancelar
 * 
 * Alternativa via POST com body
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { propostaId } = body

    if (!propostaId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Campo propostaId é obrigatório' 
        },
        { status: 400 }
      )
    }

    console.log('Cancelando proposta CLT ID:', propostaId)

    const response = await hubCreditoClient.cancelarPropostaCLT(propostaId)

    if (!response.success) {
      console.error('Erro ao cancelar proposta CLT:', response.error)
      return NextResponse.json(
        { 
          success: false,
          error: response.error || "Erro ao cancelar proposta CLT na API HubCredito" 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: response.data,
    })
  } catch (error: any) {
    console.error("Erro ao cancelar proposta CLT:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Erro interno do servidor" 
      },
      { status: 500 }
    )
  }
}

