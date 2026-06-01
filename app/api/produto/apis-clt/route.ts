import { NextResponse } from "next/server"
import { getApiManager } from "@/lib/api-manager"

/** Tipos de API que suportam consulta CLT (consultarVinculosCLT ou consulta margem) */
const CLT_API_TYPES = ['nossafintech', 'v8digital', 'facta', 'presencabank', 'c6bank', 'hubcredito'] as const

/**
 * GET /api/produto/apis-clt
 * Retorna a lista de APIs cadastradas que suportam consulta CLT, para exibir um botão por banco.
 */
export async function GET() {
  try {
    const manager = getApiManager()
    const configs = manager.getConfigs()
    const apis = configs
      .filter((c) => c.active && CLT_API_TYPES.includes(c.type as any))
      .map((c) => ({ id: c.id, name: c.name, type: c.type }))

    return NextResponse.json({ success: true, data: apis })
  } catch (error: any) {
    console.error("[apis-clt] Erro ao listar APIs:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao listar APIs" },
      { status: 500 }
    )
  }
}
