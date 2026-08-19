import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'

/**
 * POST /api/produto/c6bank/consultar-margem-clt
 *
 * Consulta se o registro CLT tem margem no C6 Bank (produto 0001 - MARGEM LIVRE, PRIVADO).
 * Dados mínimos: cpf, nome, data_nascimento. Opcional: codigo_promotora, matricula, renda.
 *
 * Body esperado:
 * {
 *   apiId?: string
 *   cpf: string                // obrigatório
 *   nome: string                // obrigatório - nome completo
 *   data_nascimento: string     // obrigatório - "DD/MM/AAAA" ou "AAAA-MM-DD"
 *   codigo_promotora?: string   // opcional (usa o do username da API se vazio)
 *   matricula?: string          // opcional - se não informar, usa API Consignado Trabalhador (só CPF)
 *   renda?: number | string     // opcional - se não informar, usa API Consignado Trabalhador (só CPF)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      apiId,
      cpf,
      nome,
      data_nascimento,
      codigo_promotora,
      matricula,
      renda
    } = body

    if (!cpf) {
      return NextResponse.json(
        { success: false, error: 'cpf obrigatório' },
        { status: 400 }
      )
    }
    if (!nome || String(nome).trim() === '') {
      return NextResponse.json(
        { success: false, error: 'nome obrigatório' },
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

    const temMatricula = matricula != null && String(matricula).trim() !== ''
    const temRenda = renda !== undefined && renda !== null && renda !== ''
    let matriculaVal: string | null = temMatricula ? String(matricula).trim() : null
    let rendaNum: number | null = null
    if (temRenda) {
      rendaNum = Number(
        typeof renda === 'string'
          ? renda.replace(/\./g, '').replace(',', '.')
          : renda
      )
      if (!Number.isFinite(rendaNum) || rendaNum <= 0) {
        return NextResponse.json(
          { success: false, error: 'renda deve ser maior que zero quando informada' },
          { status: 400 }
        )
      }
    }

    // Aceita "DD/MM/AAAA" ou "AAAA-MM-DD"
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
    const c6Api = apis.find(api => api.type === 'c6bank' && (apiId ? api.id === apiId : true))
    if (!c6Api) {
      return NextResponse.json(
        { success: false, error: 'API C6 Bank não configurada ou id não encontrado' },
        { status: 404 }
      )
    }

    const clientInstance = manager.getClientById(c6Api.id)
    if (!clientInstance) {
      return NextResponse.json(
        { success: false, error: 'registro C6 Bank não disponível' },
        { status: 500 }
      )
    }

    // Atualiza credenciais se necessário
    if (c6Api.username && c6Api.password && typeof (clientInstance as any).updateCredentials === 'function') {
      const authUrl = (c6Api as any).authUrl
      ;(clientInstance as any).updateCredentials(
        c6Api.username,
        c6Api.password,
        c6Api.baseUrl,
        authUrl
      )
    }

    const useConsignadoTrabalhador = !temMatricula || !temRenda

    let result: { success: boolean; data?: any; error?: string }
    let authorizationStatus: string | undefined

    if (useConsignadoTrabalhador && typeof (clientInstance as any).consultarStatusAutorizacao === 'function') {
      const statusRes = await (clientInstance as any).consultarStatusAutorizacao({ cpf: cpfLimpo })
      if (statusRes.success && statusRes.data?.status) {
        authorizationStatus = statusRes.data.status
      }
    }

    if (useConsignadoTrabalhador && typeof (clientInstance as any).gerarOfertaConsignadoTrabalhador === 'function' && authorizationStatus === 'AUTORIZADO') {
      // registro já autorizado: buscar resultado via gerar oferta (retorna margem/oferta)
      result = await (clientInstance as any).gerarOfertaConsignadoTrabalhador({ cpf_cliente: cpfLimpo })
    } else if (useConsignadoTrabalhador && typeof (clientInstance as any).simularConsignadoTrabalhador === 'function') {
      // Sem autorização ou status desconhecido: tenta simulação (pode retornar 422 se não autorizado)
      result = await (clientInstance as any).simularConsignadoTrabalhador({
        cpf: cpfLimpo,
        tipo_simulacao: 'POR_VALOR_MAXIMO'
      })
    } else if (temMatricula && temRenda && typeof (clientInstance as any).simularMargemLivre === 'function') {
      // Com matrícula e renda: simulação Margem Livre (0001 - PRIVADO)
      result = await (clientInstance as any).simularMargemLivre({
        product_type_code: '0001',
        simulation_type: 'POR_VALOR_SOLICITADO',
        formalization_subtype: 'DIGITAL_WEB',
        covenant_group: 'PRIVADO',
        public_agency: '000007',
        request_amount: 1000,
        installment_quantity: 84,
        operation_type: 'NOVA',
        client: {
          tax_identifier: cpfLimpo,
          enrollment: matriculaVal!,
          birth_date: birthDateIso,
          income_amount: rendaNum!
        }
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Sem matrícula e renda é necessário o método simularConsignadoTrabalhador no registro C6.' },
        { status: 500 }
      )
    }

    // Se a simulação/oferta não foi bem-sucedida, retornamos o motivo e detalhes da API C6
    if (!result.success) {
      const detalhes = result.data ?? null
      let motivo = result.error || 'Simulação não aprovada pelo C6 Bank.'
      if (detalhes && typeof detalhes === 'object') {
        const msgApi = (detalhes as any).message ?? (detalhes as any).error
        const erros = (detalhes as any).errors
        if (Array.isArray(erros) && erros.length > 0) {
          motivo = erros.map((e: any) => e.message ?? e.field ?? JSON.stringify(e)).join('; ')
        } else if (msgApi) {
          motivo = msgApi
        }
      }
      return NextResponse.json({
        success: true,
        temMargem: false,
        motivo,
        detalhesErro: detalhes,
        ...(authorizationStatus != null && { authorizationStatus })
      })
    }

    const data = result.data as any
    // Oferta e simulação podem vir com nomes diferentes; normaliza para exibição
    const valorMax = data?.valor_maximo ?? data?.client_amount ?? data?.valor_cliente ?? data?.maximum_loan_amount ?? data?.maximum_value
    const resumoMargem = {
      valor_cliente: valorMax ?? null,
      valor_solicitado: data?.requested_amount ?? data?.valor_solicitado ?? null,
      valor_parcela: data?.installment_amount ?? data?.valor_parcela ?? data?.installment_value ?? null,
      quantidade_parcelas: data?.installment_quantity ?? data?.quantidade_parcelas ?? data?.installments ?? null,
      taxa_juros_mensal: data?.monthly_customer_rate ?? data?.monthly_effective_total_cost_rate ?? null,
      taxa_juros_anual: data?.annual_customer_rate ?? data?.annual_effective_total_cost_rate ?? null
    }

    return NextResponse.json({
      success: true,
      temMargem: true,
      margem: resumoMargem,
      raw: data,
      ...(useConsignadoTrabalhador ? { origem: authorizationStatus === 'AUTORIZADO' ? 'worker-payroll-loan-offers (oferta)' : 'worker-payroll-loan-offers/simulation (POR_VALOR_MAXIMO)' } : {}),
      ...(authorizationStatus != null && { authorizationStatus })
    })
  } catch (error: any) {
    console.error('[API] C6 Bank consultar-margem-clt:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao consultar margem CLT no C6 Bank' },
      { status: 500 }
    )
  }
}

