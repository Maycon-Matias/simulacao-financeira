import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'

/**
 * POST /api/produto/c6bank/simular-margem-livre
 *
 * Simula Margem Livre ou Aumento Margem Livre (product_type_code 0007) no C6 Bank.
 * Body: apiId?, product_type_code? (default 0007), simulation_type, client, request_amount | installment_amount, installment_quantity, ...
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      apiId,
      product_type_code = '0007',
      simulation_type,
      formalization_subtype = 'DIGITAL_WEB',
      covenant_group = 'INSS',
      public_agency = '000001',
      request_amount,
      installment_amount,
      installment_quantity,
      client,
      operation_type = 'NOVA'
    } = body

    if (!simulation_type || !['POR_VALOR_SOLICITADO', 'POR_VALOR_PARCELA'].includes(simulation_type)) {
      return NextResponse.json(
        { success: false, error: 'simulation_type obrigatório: POR_VALOR_SOLICITADO ou POR_VALOR_PARCELA' },
        { status: 400 }
      )
    }
    if (!client?.tax_identifier || !client?.enrollment || !client?.birth_date || client?.income_amount == null) {
      return NextResponse.json(
        { success: false, error: 'client obrigatório com: tax_identifier, enrollment, birth_date, income_amount' },
        { status: 400 }
      )
    }
    if (!installment_quantity || installment_quantity < 1) {
      return NextResponse.json(
        { success: false, error: 'installment_quantity obrigatório e >= 1' },
        { status: 400 }
      )
    }
    if (simulation_type === 'POR_VALOR_SOLICITADO' && (request_amount == null || request_amount <= 0)) {
      return NextResponse.json(
        { success: false, error: 'Para POR_VALOR_SOLICITADO informe request_amount > 0' },
        { status: 400 }
      )
    }
    if (simulation_type === 'POR_VALOR_PARCELA' && (installment_amount == null || installment_amount <= 0)) {
      return NextResponse.json(
        { success: false, error: 'Para POR_VALOR_PARCELA informe installment_amount > 0' },
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
    if (!clientInstance || typeof (clientInstance as any).simularMargemLivre !== 'function') {
      return NextResponse.json(
        { success: false, error: 'registro C6 Bank não disponível ou método simularMargemLivre não implementado' },
        { status: 500 }
      )
    }

    const result = await (clientInstance as any).simularMargemLivre({
      product_type_code: product_type_code === '0001' ? '0001' : '0007',
      simulation_type,
      formalization_subtype,
      covenant_group,
      public_agency,
      request_amount: simulation_type === 'POR_VALOR_SOLICITADO' ? request_amount : undefined,
      installment_amount: simulation_type === 'POR_VALOR_PARCELA' ? installment_amount : undefined,
      installment_quantity,
      operation_type,
      client: {
        tax_identifier: String(client.tax_identifier).replace(/\D/g, ''),
        enrollment: String(client.enrollment),
        birth_date: client.birth_date,
        income_amount: Number(client.income_amount)
      }
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Erro ao simular Margem Livre C6 Bank', details: result.data },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error: any) {
    console.error('[API] C6 Bank simular-margem-livre:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao simular Margem Livre' },
      { status: 500 }
    )
  }
}
