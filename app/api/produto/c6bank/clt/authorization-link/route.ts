import { NextRequest, NextResponse } from "next/server"
import { getApiManager } from "@/lib/api-manager"

type Body = {
  apiId?: string
  cpf: string
  nome: string
  data_nascimento: string // "DD/MM/AAAA" ou "AAAA-MM-DD"
  telefone?: string // opcional
}

function toIsoDate(dateStr: string): string {
  const s = String(dateStr).trim()
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split("/")
    return `${yyyy}-${mm}-${dd}`
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("data_nascimento inválida. Use DD/MM/AAAA ou AAAA-MM-DD")
  return s
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<Body>
    const cpf = String(body.cpf ?? "").replace(/\D/g, "")
    const nome = String(body.nome ?? "").trim()
    const dataNascimentoRaw = String(body.data_nascimento ?? "").trim()
    if (!dataNascimentoRaw) {
      return NextResponse.json({ success: false, error: "data_nascimento obrigatória" }, { status: 400 })
    }
    const dataNascimentoIso = toIsoDate(dataNascimentoRaw)
    const telefone = body.telefone ? String(body.telefone).replace(/\D/g, "") : undefined

    if (cpf.length !== 11) {
      return NextResponse.json({ success: false, error: "cpf deve ter 11 dígitos" }, { status: 400 })
    }
    if (!nome) {
      return NextResponse.json({ success: false, error: "nome obrigatório" }, { status: 400 })
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

    if (typeof client.cltGenerateAuthorizationLink !== "function") {
      return NextResponse.json({ success: false, error: "Método cltGenerateAuthorizationLink não implementado no client C6." }, { status: 500 })
    }

    const result = await client.cltGenerateAuthorizationLink({
      cpf,
      nome,
      data_nascimento: dataNascimentoIso,
      telefone,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || "Falha ao gerar link de autorização", raw: result.data ?? null }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      link: result.data?.link ?? result.data?.url ?? null,
      expiracao: result.data?.data_expiracao ?? result.data?.expire_at ?? null,
      raw: result.data ?? null,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Erro interno" }, { status: 500 })
  }
}
