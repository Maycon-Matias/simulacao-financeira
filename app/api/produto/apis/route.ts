import { type NextRequest, NextResponse } from "next/server"
import { getApiManager } from "@/lib/api-manager"

/** Evita pré-render estática no build (usa request.url / searchParams). */
export const dynamic = "force-dynamic"

/**
 * GET /api/produto/apis
 * Lista todas as APIs configuradas
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const apiId = searchParams.get('apiId')

    const manager = getApiManager()
    
    if (apiId) {
      // Retorna configuração específica (sem password)
      const config = manager.getConfig(apiId)
      if (!config) {
        return NextResponse.json(
          { success: false, error: 'API não encontrada' },
          { status: 404 }
        )
      }
      
      return NextResponse.json({
        success: true,
        config: {
          ...config,
          password: undefined, // Não retorna password
          hasPassword: !!config.password
        }
      })
    }

    // Retorna todas as APIs (sem senhas)
    const configs = manager.getConfigs().map(config => ({
      ...config,
      password: undefined,
      hasPassword: !!config.password
    }))

    return NextResponse.json({
      success: true,
      configs,
      defaultApiId: manager.getDefaultApiId()
    })
  } catch (error: any) {
    console.error("Erro ao listar APIs:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

