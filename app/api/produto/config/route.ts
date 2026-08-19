import { type NextRequest, NextResponse } from "next/server"
import { hubCreditoClient } from "@/lib/hubcredito-client"

/**
 * GET /api/produto/config
 * 
 * Retorna a configuração atual da API (sem expor credenciais sensíveis)
 */
export async function GET() {
  try {
    const baseUrl = process.env.REDACTED || ''
    const hasUsername = !!process.env.REDACTED
    const hasPassword = !!process.env.REDACTED

    return NextResponse.json({
      success: true,
      config: {
        baseUrl,
        hasUsername,
        hasPassword,
        configured: !!baseUrl && hasUsername && hasPassword,
      },
    })
  } catch (error: any) {
    console.error("Erro ao obter configuração:", error)
    return NextResponse.json(
      { error: error.message || "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/produto/config/test
 * 
 * Testa a conexão com a API HubCredito (faz login)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    // Atualiza credenciais temporariamente se fornecidas
    if (username || password) {
      hubCreditoClient.updateCredentials(
        username || process.env.REDACTED,
        password || process.env.REDACTED
      )
    }

    const testResult = await hubCreditoClient.testConnection()

    return NextResponse.json(testResult)
  } catch (error: any) {
    console.error("Erro ao testar conexão:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro ao testar conexão com a API",
        data: {
          connected: false,
          message: "Erro ao testar conexão",
        },
      },
      { status: 500 }
    )
  }
}

