import { NextRequest, NextResponse } from "next/server"
import { FactaOfflineClient } from "@/lib/facta-offline-client"

/**
 * POST /api/produto/facta/offline/consultar
 *
 * Consulta a BASE OFFLINE da FACTA para um CPF (sem necessidade de autorização do registro),
 * usando o manual "Consulta Dados CLT - OFFLINE".
 *
 * Body: { cpf: string } (obrigatório, 11 dígitos)
 *
 * Respostas:
 * - 400: CPF inválido ou erro de negócio/API Facta (ex.: CPF não encontrado, API retornou erro).
 * - 503: Serviço indisponível (credenciais/URL Facta Offline não configuradas ou falha ao obter token).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { cpf?: string }
    const cpf = String(body.cpf || "").replace(/\D/g, "").padStart(11, "0")

    if (!cpf || cpf.length !== 11) {
      return NextResponse.json(
        { success: false, error: "CPF é obrigatório e deve ter 11 dígitos" },
        { status: 400 },
      )
    }

    const client = new FactaOfflineClient()
    const result = await client.consultarBaseOffline(cpf)

    if (!result.success) {
      const errorMsg = result.error || "Erro ao consultar base offline Facta"
      const body = { success: false, error: errorMsg, data: result.data }
      // Erro de configuração (credenciais/URL não configuradas) → 503 para não confundir com payload inválido
      const isConfigError =
        /não configurad|credenciais|BASE_URL|gera-token|FACTA_OFFLINE/i.test(errorMsg) ||
        /timeout ao obter token/i.test(errorMsg)
      const status = isConfigError ? 503 : 400
      return NextResponse.json(body, { status })
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error: any) {
    console.error("[API] Facta offline consultar:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Erro interno ao consultar base offline Facta" },
      { status: 500 },
    )
  }
}

