import { NextRequest, NextResponse } from "next/server"
import { getApiManager } from "@/lib/api-manager"

type Body = {
  apiId?: string
  cpf: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<Body>
    const cpf = String(body.cpf ?? "").replace(/\D/g, "")

    if (cpf.length !== 11) {
      return NextResponse.json({ success: false, error: "cpf deve ter 11 dígitos" }, { status: 400 })
    }

    const manager = getApiManager()
    const apis = manager.getConfigs()
    const c6Api = apis.find((api) => api.type === "c6bank" && (body.apiId ? api.id === body.apiId : true))
    if (!c6Api) {
      return NextResponse.json({ success: false, error: "API C6 Bank não configurada" }, { status: 404 })
    }

    const client = manager.getClientById(c6Api.id) as any
    if (!client) {
      return NextResponse.json({ success: false, error: "registro C6 Bank não disponível" }, { status: 500 })
    }

    if (c6Api.username && c6Api.password && typeof client.updateCredentials === "function") {
      client.updateCredentials(c6Api.username, c6Api.password, c6Api.baseUrl, (c6Api as any).authUrl)
    }

    if (typeof client.cltGetOffer !== "function") {
      return NextResponse.json({ success: false, error: "Método cltGetOffer não implementado no client C6." }, { status: 500 })
    }

    const result = await client.cltGetOffer({ cpf_cliente: cpf })

    if (!result.success) {
      return NextResponse.json({
        success: true,
        temMargem: false,
        motivo: result.error || "Oferta não disponível / registro sem margem",
        raw: result.data ?? null,
      })
    }

    const data = result.data ?? {}

    const margem = {
      valor_cliente: data?.valor_cliente ?? data?.client_amount ?? data?.net_amount ?? null,
      valor_solicitado: data?.requested_amount ?? null,
      valor_parcela: data?.valor_parcela ?? data?.installment_amount ?? null,
      quantidade_parcelas: data?.quantidade_parcelas ?? data?.installment_quantity ?? null,
      taxa_juros_mensal: data?.taxa_mensal ?? data?.monthly_customer_rate ?? data?.monthly_effective_total_cost_rate ?? null,
      taxa_juros_anual: data?.taxa_anual ?? data?.annual_customer_rate ?? data?.annual_effective_total_cost_rate ?? null,
    }

    return NextResponse.json({
      success: true,
      temMargem: true,
      margem,
      raw: data,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Erro interno" }, { status: 500 })
  }
}
