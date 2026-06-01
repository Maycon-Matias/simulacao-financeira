import { type NextRequest, NextResponse } from "next/server"
import { hubCreditoClient } from "@/lib/hubcredito-client"

/**
 * POST /api/produto/consultar
 * 
 * Endpoint para consultar propostas na API HubCredito
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cpf } = body

    console.log('Consultando propostas, CPF:', cpf || 'null (todas)')

    // Consulta propostas (cpf é opcional)
    const response = await hubCreditoClient.consultarPropostas(cpf)

    if (!response.success) {
      console.error('Erro ao consultar propostas:', response.error)
      
      // Verifica se é erro de autenticação
      const isAuthError = response.error?.toLowerCase().includes('autentic') || 
                          response.error?.toLowerCase().includes('unauthorized') ||
                          response.error?.toLowerCase().includes('credenciais')
      
      return NextResponse.json(
        { 
          success: false,
          error: response.error || "Erro ao consultar propostas na API HubCredito",
          authError: isAuthError
        },
        { status: isAuthError ? 401 : 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: response.data,
    })
  } catch (error: any) {
    console.error("Erro ao consultar propostas:", error)
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
 * GET /api/produto/consultar
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cpf = searchParams.get('cpf') || undefined

    const response = await hubCreditoClient.consultarPropostas(cpf || undefined)

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || "Erro ao consultar propostas na API HubCredito" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: response.data,
    })
  } catch (error: any) {
    console.error("Erro ao consultar propostas:", error)
    return NextResponse.json(
      { error: error.message || "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

