import { type NextRequest, NextResponse } from "next/server"
import { getApiManager } from "@/lib/api-manager"

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * POST /api/produto/v8/consultar-clt-autorizado
 *
 * Fluxo igual ao do sistema WhatsApp: cria termo, autoriza automaticamente e retorna margem.
 * Usado pela tela "Consultar CLT nos bancos" para que o termo V8 seja aceito automaticamente.
 *
 * Body: { apiId?, cpf, nome, email, telefone, birthDate, gender }
 * - birthDate: YYYY-MM-DD
 * - gender: 'male' | 'female'
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    let { apiId, cpf, nome, email, telefone, birthDate, gender } = body

    const cpfLimpo = String(cpf ?? "").replace(/\D/g, "").padStart(11, "0")
    if (cpfLimpo.length !== 11) {
      return NextResponse.json(
        { success: false, error: "CPF é obrigatório e deve ter 11 dígitos" },
        { status: 400 }
      )
    }
    nome = String(nome ?? "").trim()
    if (!nome) {
      return NextResponse.json(
        { success: false, error: "Nome é obrigatório" },
        { status: 400 }
      )
    }
    email = String(email ?? "").trim()
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email é obrigatório" },
        { status: 400 }
      )
    }
    birthDate = String(birthDate ?? "").trim()
    if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      return NextResponse.json(
        { success: false, error: "Data de nascimento (birthDate) é obrigatória no formato YYYY-MM-DD" },
        { status: 400 }
      )
    }
    if (gender !== "male" && gender !== "female") {
      gender = "male"
    }

    let telefoneProcessado = String(telefone ?? "").replace(/\D/g, "")
    if (telefoneProcessado.startsWith("55") && telefoneProcessado.length > 10) {
      telefoneProcessado = telefoneProcessado.substring(2)
    }
    if (telefoneProcessado.length < 10) {
      return NextResponse.json(
        { success: false, error: "Telefone é obrigatório (DDD + número, mínimo 10 dígitos)" },
        { status: 400 }
      )
    }
    const areaCode = telefoneProcessado.substring(0, 2)
    let phoneNumber = telefoneProcessado.substring(2)
    if (phoneNumber.length === 8) {
      phoneNumber = `9${phoneNumber}`
    } else if (phoneNumber.length > 9) {
      phoneNumber = phoneNumber.slice(-9)
    }
    const telefoneFormatado = `${areaCode}${phoneNumber}`

    const manager = getApiManager()
    const apis = manager.getConfigs()
    const v8Api = apiId
      ? apis.find((c) => c.type === "v8digital" && c.id === apiId)
      : apis.find((c) => c.type === "v8digital" && c.active !== false)
    if (!v8Api) {
      return NextResponse.json(
        { success: false, error: "API V8 Digital não configurada" },
        { status: 404 }
      )
    }
    const apiIdToUse = v8Api.id

    const client = manager.getClientById(apiIdToUse) as any
    if (!client) {
      return NextResponse.json(
        { success: false, error: "registro V8 Digital não disponível" },
        { status: 500 }
      )
    }
    if (v8Api.username && v8Api.****** && typeof client.updateCredentials === "function") {
      client.updateCredentials(v8Api.username, v8Api.******, v8Api.baseUrl)
    }

    if (typeof client.criarTermoConsentimentoCLT !== "function") {
      return NextResponse.json(
        { success: false, error: "Método criarTermoConsentimentoCLT não disponível" },
        { status: 500 }
      )
    }

    // 1. Criar termo
    const criarRes = await client.criarTermoConsentimentoCLT({
      cpf: cpfLimpo,
      nome,
      telefone: telefoneFormatado,
      email,
      birthDate,
      gender,
    })
    if (!criarRes.success) {
      return NextResponse.json(
        { success: false, error: criarRes.error || "Erro ao criar termo de consentimento" },
        { status: 400 }
      )
    }

    const criarData = criarRes.data as Record<string, unknown> | undefined
    const consultId =
      criarData?.id ??
      criarData?.consultId ??
      (criarData?.consult_id as string) ??
      (criarData?.data as Record<string, unknown> | undefined)?.id
    if (!consultId) {
      return NextResponse.json(
        { success: false, error: "Termo criado mas ID não retornado" },
        { status: 502 }
      )
    }

    await delay(1000)

    // 2. Autorizar termo (retentativas)
    if (typeof client.autorizarTermoConsentimentoCLT !== "function") {
      return NextResponse.json(
        { success: false, error: "Método autorizarTermoConsentimentoCLT não disponível" },
        { status: 500 }
      )
    }

    const maxAutorizarTentativas = 4
    const delayEntreTentativas = 2000
    let autorizarRes: { success: boolean; error?: string; data?: any } = { success: false }

    for (let t = 1; t <= maxAutorizarTentativas; t++) {
      autorizarRes = await client.autorizarTermoConsentimentoCLT(String(consultId))
      if (autorizarRes.success) break
      const errMsg = String(autorizarRes.error || "")
      if (/já\s*(foi\s*)?aprovada|already\s*approved/i.test(errMsg)) break
      if (t < maxAutorizarTentativas) await delay(delayEntreTentativas)
    }

    const dataInner = autorizarRes.data?.data ?? autorizarRes.data
    if (
      autorizarRes.success &&
      dataInner &&
      ((dataInner as Record<string, unknown>).margin ||
        (dataInner as Record<string, unknown>).availableMargin ||
        (dataInner as Record<string, unknown>).availableMarginValue ||
        (dataInner as Record<string, unknown>).vinculos ||
        (dataInner as Record<string, unknown>).employment)
    ) {
      let simulacaoDisponivel: boolean | null = null
      const statusInner = String((dataInner as Record<string, unknown>).status ?? (dataInner as Record<string, unknown>).consultStatus ?? "")
      if (statusInner.toUpperCase() === "REJECTED") {
        simulacaoDisponivel = false
      } else if (typeof client.consultarTaxasSimulacaoCLT === "function") {
        try {
          const taxasRes = await client.consultarTaxasSimulacaoCLT()
          if (taxasRes.success && taxasRes.data != null) {
            const td = taxasRes.data?.data ?? taxasRes.data
            const arr = Array.isArray(td)
              ? td
              : td && Array.isArray((td as any).configs)
                ? (td as any).configs
                : td && Array.isArray((td as any).itens)
                  ? (td as any).itens
                  : null
            simulacaoDisponivel = Array.isArray(arr) && arr.length > 0
          } else {
            simulacaoDisponivel = false
          }
        } catch {
          simulacaoDisponivel = false
        }
      }
      const dataInnerObj = dataInner as Record<string, unknown>
      const descriptionInner =
        dataInnerObj.description ?? (dataInnerObj.data as Record<string, unknown> | undefined)?.description

      // Normaliza valor de margem para campos availableMarginValue / availableMargin,
      // facilitando a exibição na tela (NVCheck, etc.).
      const marginInner = (dataInnerObj.margin ||
        (dataInnerObj.data as Record<string, unknown> | undefined)?.margin) as
        | Record<string, unknown>
        | undefined
      const dataObjInner = dataInnerObj.data as Record<string, unknown> | undefined
      const availableMarginValueInner =
        (dataInnerObj.availableMarginValue ??
          (dataInnerObj as any).available_margin_value ??
          dataInnerObj.availableMargin ??
          (dataInnerObj as any).available_margin) ??
        marginInner?.available ??
        marginInner?.value ??
        dataObjInner?.availableMarginValue ??
        (dataObjInner as any)?.available_margin_value ??
        dataObjInner?.availableMargin ??
        null

      return NextResponse.json({
        success: true,
        data: {
          ...(typeof dataInner === "object" && dataInner !== null ? dataInner : {}),
          ...(simulacaoDisponivel !== null && { simulacaoDisponivel }),
          ...(descriptionInner != null && { description: descriptionInner }),
          ...(availableMarginValueInner !== null && {
            availableMarginValue: availableMarginValueInner,
            availableMargin: availableMarginValueInner,
          }),
        },
      })
    }

    await delay(5000)

    // 3. Detalhes do termo
    if (typeof client.buscarDetalhesTermoCLT !== "function") {
      return NextResponse.json({
        success: true,
        data: criarData ?? { id: consultId },
      })
    }

    let detalhesRes = await client.buscarDetalhesTermoCLT(String(consultId))
    if (!detalhesRes.success) {
      return NextResponse.json({
        success: true,
        data: criarData ?? { id: consultId, availableMarginValue: null },
      })
    }

    let termo = (detalhesRes.data ?? {}) as Record<string, unknown>
    let status = String(termo.status ?? termo.consultStatus ?? "UNKNOWN")

    let tentativasConsent = 0
    const maxTentativasConsent = 3
    while (status.toUpperCase() === "WAITING_CONSENT" && tentativasConsent < maxTentativasConsent) {
      tentativasConsent++
      await client.autorizarTermoConsentimentoCLT(String(consultId))
      await delay(tentativasConsent === 1 ? 5000 : 6000)
      const reDetalhes = await client.buscarDetalhesTermoCLT(String(consultId))
      if (reDetalhes.success && reDetalhes.data) {
        const termoAtualizado = reDetalhes.data as Record<string, unknown>
        status = String(termoAtualizado.status ?? termoAtualizado.consultStatus ?? status)
        termo = { ...termo, ...termoAtualizado }
      }
    }

    const marginObj = termo.margin as Record<string, unknown> | undefined
    const dataObj = termo.data as Record<string, unknown> | undefined
    const availableMarginValue =
      (termo.availableMarginValue ?? termo.available_margin_value) ??
      marginObj?.available ??
      marginObj?.value ??
      termo.availableMargin ??
      termo.available_margin ??
      dataObj?.availableMarginValue ??
      null

    let simulacaoDisponivel: boolean | null = null
    if (status.toUpperCase() === "REJECTED") {
      simulacaoDisponivel = false
    } else if (typeof client.consultarTaxasSimulacaoCLT === "function") {
      try {
        const taxasRes = await client.consultarTaxasSimulacaoCLT()
        if (taxasRes.success && taxasRes.data != null) {
          const td = taxasRes.data?.data ?? taxasRes.data
          const arr = Array.isArray(td)
            ? td
            : td && Array.isArray((td as any).configs)
              ? (td as any).configs
              : td && Array.isArray((td as any).itens)
                ? (td as any).itens
                : null
          simulacaoDisponivel = Array.isArray(arr) && arr.length > 0
        } else {
          simulacaoDisponivel = false
        }
      } catch {
        simulacaoDisponivel = false
      }
    }

    const description = termo.description ?? (termo.data as Record<string, unknown> | undefined)?.description

    return NextResponse.json({
      success: true,
      data: {
        ...termo,
        id: termo.id ?? consultId,
        consultId,
        status,
        availableMarginValue,
        availableMargin: availableMarginValue,
        data: termo.data ?? termo,
        ...(simulacaoDisponivel !== null && { simulacaoDisponivel }),
        ...(description != null && { description }),
      },
    });
  } catch (e: any) {
    console.error("[v8/consultar-clt-autorizado] Erro:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Erro ao consultar V8 com autorização automática" },
      { status: 500 }
    );
  }
}
