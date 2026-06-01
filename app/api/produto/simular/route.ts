import { type NextRequest, NextResponse } from "next/server"
import { hubCreditoClient } from "@/lib/hubcredito-client"

/**
 * POST /api/produto/simular
 * 
 * Endpoint para simular na API HubCredito
 * 
 * Body esperado:
 * {
 *   usuarioId: string (obrigatório)
 *   lojaId: number (obrigatório)
 *   cpfs: string[] (obrigatório - array de CPFs)
 *   callbackUrl?: string (opcional)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { usuarioId, lojaId, cpfs, callbackUrl } = body

    // Validação
    if (!usuarioId || !lojaId || !cpfs || !Array.isArray(cpfs) || cpfs.length === 0) {
      return NextResponse.json(
        { error: "Parâmetros obrigatórios: usuarioId, lojaId e cpfs (array)" },
        { status: 400 }
      )
    }

    const response = await hubCreditoClient.cadastrarSimulacao({
      usuarioId,
      lojaId,
      cpfs,
      callbackUrl,
    })

    if (!response.success) {
      console.error('Erro ao cadastrar simulação:', response.error)
      return NextResponse.json(
        { 
          success: false,
          error: response.error || "Erro ao cadastrar simulação na API HubCredito" 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: response.data,
    })
  } catch (error: any) {
    console.error("Erro ao simular:", error)
    return NextResponse.json(
      { error: error.message || "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

