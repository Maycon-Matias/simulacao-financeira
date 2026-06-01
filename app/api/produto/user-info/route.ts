import { NextResponse } from "next/server"
import { hubCreditoClient } from "@/lib/hubcredito-client"

export const dynamic = "force-dynamic"

/**
 * GET /api/produto/entidade-info
 * 
 * Retorna informações do usuário logado
 */
export async function GET() {
  try {
    // Força login se necessário
    const loginResult = await hubCreditoClient.testConnection()
    
    if (!loginResult.success) {
      return NextResponse.json(
        { error: loginResult.data?.message || "Não foi possível autenticar" },
        { status: 401 }
      )
    }

    const userInfo = hubCreditoClient.getUserInfo()
    const primeiraLoja = hubCreditoClient.getFirstActiveLoja()
    const todasLojas = userInfo?.lojasAtivas || []

    return NextResponse.json({
      success: true,
      userInfo,
      primeiraLoja,
      todasLojas,
    })
  } catch (error: any) {
    console.error("Erro ao obter informações do usuário:", error)
    return NextResponse.json(
      { error: error.message || "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

