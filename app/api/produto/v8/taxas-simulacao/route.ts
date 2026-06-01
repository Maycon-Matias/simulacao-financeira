import { type NextRequest, NextResponse } from "next/server"
import { getApiManager } from "@/lib/api-manager"

/** Evita pré-render estática no build (usa request.url). */
export const dynamic = "force-dynamic"

function normalizarConfigsV8(payload: any): any[] {
  const candidatos = [
    payload?.configs,
    payload?.data?.configs,
    payload?.data,
    payload?.tables,
    payload?.tabelas,
    payload,
  ]

  const lista = candidatos.find((item) => Array.isArray(item))
  if (!Array.isArray(lista)) return []

  return lista.map((item: any) => ({
    ...item,
    id: item?.id ?? item?.config_id ?? item?.configId ?? item?.tableId ?? "",
  }))
}

/**
 * GET /api/produto/v8/taxas-simulacao
 * 
 * Consulta taxas disponíveis para simulação CLT na API V8 Digital
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const apiId = searchParams.get('apiId')

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

    if (!('consultarTaxasSimulacaoCLT' in client)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Método consultarTaxasSimulacaoCLT não disponível no registro V8 Digital' 
        },
        { status: 400 }
      )
    }

    const v8Client = client as any
    
    console.log('[v8/taxas-simulacao] Consultando taxas disponíveis')
    
    const response = await v8Client.consultarTaxasSimulacaoCLT()

    if (!response.success) {
      return NextResponse.json(
        { 
          success: false,
          error: response.error || 'Erro ao consultar taxas de simulação' 
        },
        { status: 500 }
      )
    }

    const configs = normalizarConfigsV8(response.data)

    return NextResponse.json({
      success: true,
      data: {
        ...(response.data && typeof response.data === "object" ? response.data : {}),
        configs,
      },
    })
  } catch (error: any) {
    console.error('[v8/taxas-simulacao] Erro:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Erro ao consultar taxas de simulação'
      },
      { status: 500 }
    )
  }
}
