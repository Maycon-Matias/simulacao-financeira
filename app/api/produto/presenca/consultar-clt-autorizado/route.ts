import { type NextRequest, NextResponse } from "next/server"
import { getApiManager } from "@/lib/api-manager"
import { extrairVinculos, extrairMatriculaECnpj, normalizarTelefonePresenca } from "@/lib/utils"

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Pausa entre etapas para reduzir 429 (rate limit) na API Presença */
const DELAY_APOS_ASSINATURA_MS = 2000
const DELAY_APOS_VINCULOS_MS = 2500

/**
 * POST /api/produto/presenca/consultar-clt-autorizado
 *
 * Fluxo Presença Bank: tenta obter autorização (quando PRESENCA_AUTORIZACAO_PATH está configurado)
 * e em seguida consulta vínculos CLT. A API Presença pode retornar
 * "é necessario uma autorização válida" quando o endpoint de autorização não é chamado antes.
 *
 * Body: { apiId?, cpf, nome?, email?, telefone?, birthDate?, gender? }
 * - birthDate: YYYY-MM-DD
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    let { apiId, cpf, nome, email, telefone, birthDate } = body

    const cpfLimpo = String(cpf ?? "").replace(/\D/g, "").padStart(11, "0")
    if (cpfLimpo.length !== 11) {
      return NextResponse.json(
        { success: false, error: "CPF é obrigatório e deve ter 11 dígitos" },
        { status: 400 }
      )
    }

    const manager = getApiManager()
    const apis = manager.getConfigs()
    const presencaApi = apiId
      ? apis.find((c) => c.type === "presencabank" && c.id === apiId)
      : apis.find((c) => c.type === "presencabank" && c.active !== false)

    if (!presencaApi) {
      return NextResponse.json(
        { success: false, error: "API Presença Bank não configurada" },
        { status: 404 }
      )
    }

    const client = getApiManager().getClientById(presencaApi.id) as any
    if (!client || typeof client.consultarVinculosCLT !== "function") {
      return NextResponse.json(
        { success: false, error: "registro Presença Bank não disponível" },
        { status: 500 }
      )
    }

    if (client.updateCredentials && presencaApi.username && presencaApi.password) {
      client.updateCredentials(presencaApi.username, presencaApi.password, presencaApi.baseUrl)
    }

    let autorizacaoId: string | undefined
    let linkAutorizacao: string | undefined
    if (typeof client.solicitarAutorizacaoConsulta === "function") {
      const telefoneNormalizado = telefone != null ? normalizarTelefonePresenca(String(telefone)) : null
      const authRes = await client.solicitarAutorizacaoConsulta(cpfLimpo, {
        nome: nome ? String(nome).trim() : undefined,
        email: email ? String(email).trim() : undefined,
        telefone: telefoneNormalizado ?? undefined,
        dataNascimento: birthDate ? String(birthDate).trim() : undefined,
      })
      if (authRes.success && authRes.data) {
        const d = authRes.data as Record<string, unknown>
        autorizacaoId =
          (d.id as string) ??
          (d.autorizacaoId as string) ??
          (d.idAutorizacao as string) ??
          (d.data as any)?.id ??
          (d.data as any)?.autorizacaoId
        linkAutorizacao =
          typeof d.url === "string"
            ? d.url
            : typeof d.link === "string"
              ? d.link
              : typeof (d as any).autorizacaoUrl === "string"
                ? (d as any).autorizacaoUrl
                : typeof (d as any).termoUrl === "string"
                  ? (d as any).termoUrl
                  : typeof (d as any).redirectUrl === "string"
                    ? (d as any).redirectUrl
                    : typeof (d as any).data?.url === "string"
                      ? (d as any).data.url
                      : typeof (d as any).data?.link === "string"
                        ? (d as any).data.link
                        : undefined
        if (linkAutorizacao) {
          console.log("[presenca/consultar-clt-autorizado] Link de autorização recebido da API Presença")
        }
        if (autorizacaoId) {
          console.log("[presenca/consultar-clt-autorizado] Autorização obtida, id:", autorizacaoId)
          const skipAssinatura = process.env.REDACTED === "true" || process.env.REDACTED === "1"
          if (skipAssinatura) {
            console.log("[presenca/consultar-clt-autorizado] PRESENCA_SKIP_TERMO_ASSINATURA ativo, pulando PUT de assinatura")
          } else if (typeof client.assinarTermoAutorizacao === "function") {
            const signRes = await client.assinarTermoAutorizacao(autorizacaoId)
            if (!signRes.success) {
              console.warn("[presenca/consultar-clt-autorizado] Assinatura do termo falhou:", signRes.error, "- tentando consultar vínculos mesmo assim")
            } else {
              console.log("[presenca/consultar-clt-autorizado] Termo assinado com sucesso")
            }
            await delay(DELAY_APOS_ASSINATURA_MS)
          }
        }
      } else if (authRes.error?.includes("não configurado")) {
        console.log("[presenca/consultar-clt-autorizado] PRESENCA_AUTORIZACAO_PATH não definido, consultando só com CPF e dados opcionais")
      }
    }

    const opts: Record<string, string | undefined> = {}
    if (autorizacaoId) opts.autorizacaoId = autorizacaoId
    if (nome) opts.nome = String(nome).trim()
    if (birthDate) opts.dataNascimento = String(birthDate).trim()

    const isRateLimit = (r: { error?: string; rateLimit?: boolean }) =>
      r.rateLimit === true || /rate limit|try again later/i.test(String(r.error ?? ""))

    const isRetryableMargem = (r: { error?: string; data?: any; rateLimit?: boolean }) => {
      if (r.rateLimit === true) return true
      const msg = String(r.error ?? "").toLowerCase()
      if (/rate limit|try again later/i.test(msg)) return true
      const dataMsg = r.data && typeof (r.data as any).message === "string" ? String((r.data as any).message).toLowerCase() : ""
      if (/tente novamente|try again/i.test(dataMsg)) return true
      return false
    }

    const backoffMs = [2000, 5000, 10000]
    let response = await client.consultarVinculosCLT(cpfLimpo, Object.keys(opts).length ? opts : undefined)
    for (let i = 0; i < backoffMs.length && !response.success && isRateLimit(response as any); i++) {
      await new Promise((r) => setTimeout(r, backoffMs[i]))
      response = await client.consultarVinculosCLT(cpfLimpo, Object.keys(opts).length ? opts : undefined)
    }

    if (!response.success) {
      const isRateLimitVinc = isRateLimit(response as any)
      if (isRateLimitVinc) {
        console.log("[presenca/consultar-clt-autorizado] Vínculos: rate limit após retries; aguarde e tente novamente.")
      }
      const msg =
        isRateLimitVinc
          ? "Muitas consultas no momento (limite da API). Aguarde alguns minutos e tente novamente."
          : (response.error || "Erro ao consultar vínculos Presença")
      const isAuthRequired = !isRateLimitVinc && /autorização válida|autorizacao valida/i.test(String(response.error ?? ""))
      return NextResponse.json(
        {
          success: false,
          error: isAuthRequired
            ? "A API Presença exige uma autorização válida antes da consulta. Configure PRESENCA_AUTORIZACAO_PATH com o endpoint de solicitação de autorização fornecido pela Presença Bank, ou utilize o fluxo de autorização no canal indicado por eles."
            : msg,
          details: response.data,
          ...(linkAutorizacao && { linkAutorizacao }),
        },
        { status: 400 }
      )
    }

    const vinculos = extrairVinculos(response.data)
    await delay(DELAY_APOS_VINCULOS_MS)
    let margemAtivo: number | null = null
    let elegivel = false
    let erroMargem: string | null = null
    let simulacaoDisponivel: boolean | null = null
    let tabelasResumo: { total: number; maxParcelas?: number; maxParcela?: number } | null = null

    const vinculoElegivel = vinculos.length > 0
      ? vinculos.find((v: any) => v.elegivel === true || v.elegível === true) ?? null
      : null

    if (vinculoElegivel && typeof client.consultarMargemCLT === "function") {
      const { matricula, cnpj } = extrairMatriculaECnpj(vinculoElegivel, cpfLimpo)
      const cnpjDigitos = String(cnpj ?? "").replace(/\D/g, "")
      const cnpjValido = cnpjDigitos.length >= 14 && cnpjDigitos !== "00000000000000"
      const matriculaValida = matricula != null && String(matricula).trim().length > 0

      if (matriculaValida && cnpjValido) {
        const marginParams = { cpf: cpfLimpo, matricula: String(matricula).trim(), cnpj: cnpjDigitos }
        let marginRes = await client.consultarMargemCLT(marginParams)
        for (let i = 0; i < backoffMs.length && !marginRes.success && isRetryableMargem(marginRes as any); i++) {
          await new Promise((r) => setTimeout(r, backoffMs[i]))
          marginRes = await client.consultarMargemCLT(marginParams)
        }
        if (marginRes.success && marginRes.data != null) {
          const md = marginRes.data?.data ?? marginRes.data
          const valor =
            md?.valorMargemDisponivel ??
            md?.margem ??
            md?.margin ??
            md?.availableMargin ??
            md?.available_margin ??
            null
          if (valor != null && valor !== "") {
            margemAtivo = Number(valor)
            elegivel = margemAtivo >= 100
          }
        } else if (!marginRes.success) {
          const data = marginRes.data as Record<string, unknown> | undefined
          const msgBruta =
            (marginRes.error as string) ||
            (typeof data?.message === "string" ? data.message : null) ||
            (Array.isArray(data?.errors) && data.errors[0] ? String(data.errors[0]) : null) ||
            (typeof data?.error === "string" ? data.error : null) ||
            ""
          if (isRetryableMargem(marginRes as any)) {
            erroMargem = "Muitas consultas no momento. Aguarde alguns minutos e clique em Atualizar status."
          } else {
            erroMargem = msgBruta || "Erro ao consultar margem no vínculo ativo."
          }
        }
        if (typeof client.consultarTabelasDisponiveisCLT === "function") {
          try {
            const tabelasRes = await client.consultarTabelasDisponiveisCLT({
              cpf: cpfLimpo,
              registroEmpregaticio: String(matricula).trim(),
              cnpjEmpregador: cnpjDigitos,
            })
            if (tabelasRes.success && tabelasRes.data != null) {
              const td = tabelasRes.data?.data ?? tabelasRes.data
              const arr = Array.isArray(td)
                ? td
                : td && Array.isArray((td as any).itens)
                  ? (td as any).itens
                  : td && Array.isArray((td as any).tabelas)
                    ? (td as any).tabelas
                    : td && Array.isArray((td as any).disponiveis)
                      ? (td as any).disponiveis
                      : td && Array.isArray((td as any).operacoes)
                        ? (td as any).operacoes
                        : td && typeof td === "object"
                          ? (Object.values(td).find((v) => Array.isArray(v) && v.length > 0) as any[]) ?? null
                          : null

              if (Array.isArray(arr)) {
                // Há lista de tabelas (pode estar vazia)
                const total = arr.length
                const maxParcelas =
                  arr.reduce((max, t) => {
                    const n =
                      Number(
                        t.numeroParcelas ??
                          t.qtdParcelas ??
                          t.parcelas ??
                          t.prazo
                      ) || 0
                    return n > max ? n : max
                  }, 0) || undefined
                const maxParcela =
                  arr.reduce((max, t) => {
                    const v =
                      Number(
                        t.valorParcelaMaxima ??
                          t.parcelaMaxima ??
                          t.valorParcela ??
                          t.valorParcelaLimite
                      ) || 0
                    return v > max ? v : max
                  }, 0) || undefined

                tabelasResumo = { total, maxParcelas, maxParcela }
                simulacaoDisponivel = total > 0
              } else {
                // Estrutura desconhecida: não afirmamos nada sobre disponibilidade
                simulacaoDisponivel = null
              }
            } else {
              // Sucesso sem data clara → desconhecido; fracasso explícito → não disponível.
              simulacaoDisponivel = tabelasRes.success ? null : false
            }
          } catch {
            // Erro técnico ao consultar tabelas: deixa como desconhecido
            simulacaoDisponivel = null
          }
        }
      }
    } else if (vinculos.length > 0 && !vinculoElegivel) {
      erroMargem = "registro sem vínculo elegível."
    }

    return NextResponse.json({
      success: true,
      data: {
        cpf: cpfLimpo,
        vinculos,
        raw: response.data,
        ...(linkAutorizacao && { linkAutorizacao }),
        margemAtivo,
        elegivel,
        ...(simulacaoDisponivel !== null && { simulacaoDisponivel }),
        ...(erroMargem && { erroMargem }),
        ...(tabelasResumo && { tabelasResumo }),
      },
    })
  } catch (e: any) {
    console.error("[presenca/consultar-clt-autorizado] Erro:", e)
    return NextResponse.json(
      { success: false, error: e?.message || "Erro ao consultar Presença com fluxo de autorização" },
      { status: 500 }
    )
  }
}
