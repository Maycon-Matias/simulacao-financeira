import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'
import { getAppBaseUrl } from '@/lib/app-base-url'

/**
 * POST /api/produto/clt/consultar-margem-c6-via-v8
 *
 * Orquestração:
 * 1) Consulta vínculos/margem CLT na V8 (via termo/listagem)
 * 2) Extrai matrícula + renda
 * 3) Chama /api/produto/c6bank/consultar-margem-clt
 *
 * Body esperado:
 * {
 *   cpf: string                 // obrigatório
 *   data_nascimento: string     // obrigatório - "DD/MM/AAAA" ou "AAAA-MM-DD"
 *   apiV8Id?: string            // opcional - se não informado, usa primeira V8 ativa
 *   apiC6Id?: string            // opcional - se não informado, usa primeira C6 ativa
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    let {
      cpf,
      data_nascimento,
      apiV8Id,
      apiC6Id
    } = body

    if (!cpf) {
      return NextResponse.json(
        { success: false, error: 'cpf obrigatório' },
        { status: 400 }
      )
    }
    if (!data_nascimento) {
      return NextResponse.json(
        { success: false, error: 'data_nascimento obrigatória' },
        { status: 400 }
      )
    }

    const cpfLimpo = String(cpf).replace(/\D/g, '')
    if (cpfLimpo.length !== 11) {
      return NextResponse.json(
        { success: false, error: 'cpf deve ter 11 dígitos' },
        { status: 400 }
      )
    }

    // Normaliza data de nascimento
    let birthDateIso = String(data_nascimento).trim()
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(birthDateIso)) {
      const [dia, mes, ano] = birthDateIso.split('/')
      birthDateIso = `${ano}-${mes}-${dia}`
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateIso)) {
      return NextResponse.json(
        { success: false, error: 'data_nascimento deve estar no formato DD/MM/AAAA ou AAAA-MM-DD' },
        { status: 400 }
      )
    }

    const manager = getApiManager()
    const apis = manager.getConfigs()

    // Seleciona API V8
    let v8Api = apis.find(api => api.type === 'v8digital' && (apiV8Id ? api.id === apiV8Id : api.active !== false))
    if (!v8Api) {
      return NextResponse.json(
        { success: false, error: 'API V8 Digital não configurada ou id não encontrado' },
        { status: 404 }
      )
    }
    apiV8Id = v8Api.id

    // Seleciona API C6
    let c6Api = apis.find(api => api.type === 'c6bank' && (apiC6Id ? api.id === apiC6Id : api.active !== false))
    if (!c6Api) {
      return NextResponse.json(
        { success: false, error: 'API C6 Bank não configurada ou id não encontrado' },
        { status: 404 }
      )
    }
    apiC6Id = c6Api.id

    // ===== 1) Consulta V8 para obter matrícula + renda =====
    const v8ClientInstance = manager.getClientById(apiV8Id)
    if (!v8ClientInstance || typeof (v8ClientInstance as any).consultarVinculosCLT !== 'function') {
      return NextResponse.json(
        { success: false, error: 'registro V8 Digital não disponível ou método consultarVinculosCLT não implementado' },
        { status: 500 }
      )
    }

    // Atualiza credenciais V8 se necessário
    if ((v8Api as any).username && (v8Api as any).****** && typeof (v8ClientInstance as any).updateCredentials === 'function') {
      const authUrl = (v8Api as any).authUrl
      const clientId = (v8Api as any).clientId
      const clientSecret = (v8Api as any).clientSecret
      const audience = (v8Api as any).audience
      ;(v8ClientInstance as any).updateCredentials(
        (v8Api as any).username,
        (v8Api as any).******,
        (v8Api as any).baseUrl,
        authUrl,
        clientId,
        clientSecret,
        audience
      )
    }

    console.log('[CLT] Consultando vínculos CLT na V8 para CPF:', cpfLimpo)
    const v8Result = await (v8ClientInstance as any).consultarVinculosCLT(cpfLimpo)

    if (!v8Result.success) {
      return NextResponse.json(
        {
          success: true,
          temMargem: false,
          origem: 'v8',
          motivo: v8Result.error || 'Não foi possível consultar vínculos CLT na V8 Digital.',
          detalhesV8: v8Result.data ?? null
        },
        { status: 200 }
      )
    }

    const termos = v8Result.data?.data || v8Result.data || []

    if (!Array.isArray(termos) || termos.length === 0) {
      return NextResponse.json(
        {
          success: true,
          temMargem: false,
          origem: 'v8',
          motivo: 'Nenhum vínculo CLT encontrado na V8 Digital para este CPF.',
          detalhesV8: v8Result.data ?? null
        },
        { status: 200 }
      )
    }

    // Escolhe o melhor vínculo: primeiro termo com dados de margem/renda
    let melhorTermo: any = null
    for (const termo of termos) {
      if (termo) {
        melhorTermo = termo
        break
      }
    }

    if (!melhorTermo) {
      return NextResponse.json(
        {
          success: true,
          temMargem: false,
          origem: 'v8',
          motivo: 'Nenhum vínculo útil encontrado na V8 Digital.',
          detalhesV8: v8Result.data ?? null
        },
        { status: 200 }
      )
    }

    // Tenta extrair matrícula e renda dos campos mais comuns da V8
    const matriculaEncontrada =
      melhorTermo.enrollment ||
      melhorTermo.matricula ||
      melhorTermo.employeeEnrollment ||
      melhorTermo.employee_number ||
      melhorTermo?.borrower?.enrollment ||
      null

    const rendaEncontrada =
      melhorTermo.income_amount ||
      melhorTermo.renda ||
      melhorTermo.salary ||
      melhorTermo?.borrower?.income ||
      null

    if (!matriculaEncontrada || !rendaEncontrada) {
      return NextResponse.json(
        {
          success: true,
          temMargem: false,
          origem: 'v8',
          motivo: 'Vínculo encontrado na V8, mas não foi possível identificar matrícula e renda de forma automática.',
          detalhesV8: melhorTermo
        },
        { status: 200 }
      )
    }

    console.log('[CLT] Vínculo selecionado da V8:', {
      matricula: matriculaEncontrada,
      renda: rendaEncontrada
    })

    // ===== 2) Chama C6 para consulta de margem CLT =====
    const c6Body = {
      apiId: apiC6Id,
      cpf: cpfLimpo,
      matricula: String(matriculaEncontrada),
      data_nascimento: birthDateIso,
      renda: Number(rendaEncontrada)
    }

    console.log('[CLT] Chamando C6 consultar-margem-clt com body:', c6Body)

    const baseUrl = getAppBaseUrl()
    const c6Url = `${baseUrl}/api/produto/c6bank/consultar-margem-clt`
    const c6Response = await fetch(c6Url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c6Body)
    })

    const c6Data = await c6Response.json().catch(() => ({}))

    if (!c6Data.success) {
      return NextResponse.json(
        {
          success: true,
          temMargem: false,
          origem: 'c6',
          motivo: c6Data.error || 'Erro ao consultar margem no C6 Bank.',
          detalhesC6: c6Data,
          origemDados: {
            apiV8Id,
            apiC6Id,
            matricula: matriculaEncontrada,
            renda: rendaEncontrada
          }
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        temMargem: c6Data.temMargem === true,
        margem: c6Data.margem ?? null,
        rawC6: c6Data,
        origemDados: {
          apiV8Id,
          apiC6Id,
          matricula: matriculaEncontrada,
          renda: rendaEncontrada,
          termoV8: melhorTermo
        }
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[API] clt/consultar-margem-c6-via-v8:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao consultar margem CLT via V8 → C6' },
      { status: 500 }
    )
  }
}

