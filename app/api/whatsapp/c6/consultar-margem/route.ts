import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'
import type { BancoResultado } from '@/lib/whatsapp-banco-resultado'
import { normalizarMargem, statusFromMargem } from '@/lib/whatsapp-banco-resultado'

/**
 * POST /api/whatsapp/c6/consultar-margem
 * Consulta margem CLT no C6 após aceite do termo. Retorna formato padronizado.
 * Body: { cpf, dadosNv: { nome, data_nascimento } }, apiId?: string
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const cpf = String(body.cpf ?? '').replace(/\D/g, '')
    const dadosNv = body.dadosNv || {}
    const apiId = body.apiId

    if (cpf.length !== 11) {
      return NextResponse.json({
        success: false,
        error: 'CPF inválido',
        resultado: null
      }, { status: 400 })
    }

    const nome = String(dadosNv.nome ?? '').trim()
    const dataNascimento = String(dadosNv.data_nascimento ?? dadosNv.data_nascimento_ddmm ?? '').trim()

    if (!nome || !dataNascimento) {
      return NextResponse.json({
        success: false,
        error: 'dadosNv.nome e dadosNv.data_nascimento são obrigatórios',
        resultado: null
      }, { status: 400 })
    }

    let dataNascIso = dataNascimento
    if (dataNascimento.includes('/')) {
      const [d, m, a] = dataNascimento.split('/')
      dataNascIso = `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    const manager = getApiManager()
    const configs = manager.getConfigs()
    const c6Config = apiId
      ? configs.find((c: any) => c.type === 'c6bank' && c.id === apiId)
      : configs.find((c: any) => c.type === 'c6bank' && c.active)
    if (!c6Config) {
      return NextResponse.json({
        success: false,
        error: 'API C6 Bank não configurada',
        resultado: null
      }, { status: 404 })
    }

    const client = manager.getClientById(c6Config.id) as any
    if (!client?.simularConsignadoTrabalhador) {
      return NextResponse.json({
        success: false,
        error: 'registro C6 não disponível ou método não implementado',
        resultado: null
      }, { status: 500 })
    }

    if (c6Config.username && c6Config.****** && typeof client.updateCredentials === 'function') {
      client.updateCredentials(c6Config.username, c6Config.******, c6Config.baseUrl, (c6Config as any).authUrl)
    }

    const result = await client.simularConsignadoTrabalhador({
      cpf,
      tipo_simulacao: 'POR_VALOR_MAXIMO'
    })

    if (!result.success) {
      const motivo = result.error || 'Consulta recusada'
      const resultado: BancoResultado = {
        banco: 'C6',
        margem: 0,
        status: 'REPROVADO',
        motivo,
        raw: result.data as any
      }
      return NextResponse.json({
        success: false,
        error: motivo,
        resultado
      }, { status: 502 })
    }

    const data = result.data as any
    const margem = normalizarMargem(
      data?.valor_maximo ??
      data?.client_amount ??
      data?.valor_cliente ??
      data?.valor_maximo_parcela ??
      data?.available_margin ??
      data?.availableMargin
    )

    const status = statusFromMargem(margem, result.error)

    const resultado: BancoResultado = {
      banco: 'C6',
      margem,
      status,
      raw: data
    }

    return NextResponse.json({
      success: true,
      resultado
    })
  } catch (e: any) {
    console.error('[whatsapp/c6/consultar-margem]', e)
    return NextResponse.json({
      success: false,
      error: e?.message || 'Erro interno',
      resultado: {
        banco: 'C6',
        margem: 0,
        status: 'ERRO' as const,
        motivo: e?.message || 'Erro interno'
      }
    }, { status: 500 })
  }
}
