import { type NextRequest, NextResponse } from "next/server"
import { hubCreditoClient } from "@/lib/hubcredito-client"

/**
 * GET /api/produto/simulacao/[id]
 * 
 * Obtém os dados de uma simulação específica
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: "ID da simulação é obrigatório" },
        { status: 400 }
      )
    }

    const response = await hubCreditoClient.obterSimulacao(id)

    if (!response.success) {
      console.error('Erro ao obter simulação:', response.error)
      return NextResponse.json(
        { 
          success: false,
          error: response.error || "Erro ao obter simulação" 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: response.data,
    })
  } catch (error: any) {
    console.error("Erro ao obter simulação:", error)
    return NextResponse.json(
      { error: error.message || "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

