import { type NextRequest, NextResponse } from "next/server"
import { getApiManager } from "@/lib/api-manager"

/**
 * GET /api/produto/clt/listar-tabelas
 * 
 * Lista tabelas de rebates disponíveis para simulação CLT na Nossa Fintech
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const apiId = searchParams.get('apiId')

    if (!apiId) {
      return NextResponse.json(
        { success: false, error: 'apiId Ã© obrigatÃ³rio' },
        { status: 400 }
      )
    }

    const manager = getApiManager()
    const config = manager.getConfig(apiId)

    if (!config || config.type !== 'nossafintech') {
      return NextResponse.json(
        { 
          success: false,
          error: 'API não encontrada ou não é do tipo Nossa Fintech' 
        },
        { status: 400 }
      )
    }

    const client = manager.getClientById(apiId)
    
    if (!client) {
      return NextResponse.json(
        { 
          success: false,
          error: 'registro da API não encontrado' 
        },
        { status: 400 }
      )
    }

    // Verifica se o registro tem o método listarTabelasCLT
    if (!('listarTabelasCLT' in client)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'API não suporta listagem de tabelas CLT' 
        },
        { status: 400 }
      )
    }

    const nossaFintechClient = client as any
    const response = await nossaFintechClient.listarTabelasCLT()

    if (!response.success) {
      return NextResponse.json(
        { 
          success: false,
          error: response.error || 'Erro ao listar tabelas CLT' 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: response.data,
    })
  } catch (error: any) {
    console.error("Erro ao listar tabelas CLT:", error)
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
 * POST /api/produto/clt/listar-tabelas
 * 
 * Alternativa via POST
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiId } = body

    const manager = getApiManager()
    const config = apiId ? manager.getConfig(apiId) : null

    if (!config || config.type !== 'nossafintech') {
      return NextResponse.json(
        { 
          success: false,
          error: 'API não encontrada ou não é do tipo Nossa Fintech' 
        },
        { status: 400 }
      )
    }

    const client = manager.getClientById(apiId)
    
    if (!client) {
      return NextResponse.json(
        { 
          success: false,
          error: 'registro da API não encontrado' 
        },
        { status: 400 }
      )
    }

    if (!('listarTabelasCLT' in client)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'API não suporta listagem de tabelas CLT' 
        },
        { status: 400 }
      )
    }

    const nossaFintechClient = client as any
    const response = await nossaFintechClient.listarTabelasCLT()

    if (!response.success) {
      return NextResponse.json(
        { 
          success: false,
          error: response.error || 'Erro ao listar tabelas CLT' 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: response.data,
    })
  } catch (error: any) {
    console.error("Erro ao listar tabelas CLT:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Erro interno do servidor" 
      },
      { status: 500 }
    )
  }
}
