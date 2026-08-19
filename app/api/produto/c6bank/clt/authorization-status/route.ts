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

    if (typeof client.cltAuthorizationStatus !== "function") {
      return NextResponse.json({ success: false, error: "Método cltAuthorizationStatus não implementado no client C6." }, { status: 500 })
    }

    const result = await client.cltAuthorizationStatus({ cpf })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || "Falha ao consultar status", raw: result.data ?? null }, { status: 502 })
    }

    const status = result.data?.status ?? result.data?.situacao ?? null

    return NextResponse.json({
      success: true,
      status,
      autorizado: String(status).toUpperCase() === "AUTORIZADO",
      raw: result.data ?? null,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Erro interno" }, { status: 500 })
  }
}
