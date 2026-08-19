import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'

/**
 * POST /api/whatsapp/c6/gerar-termo
 * Gera link de autorização (termo) C6 para o registro. Usa dados da consulta Nova Vida.
 * Body: { cpf, dadosNv: { nome, data_nascimento, telefone? } }, apiId?: string
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
        link: null,
        termoId: null
      }, { status: 400 })
    }

    const nome = String(dadosNv.nome ?? '').trim()
    const dataNascimento = String(dadosNv.data_nascimento ?? dadosNv.data_nascimento_ddmm ?? '').trim()
    const telefone = dadosNv.telefone ? String(dadosNv.telefone).replace(/\D/g, '') : undefined

    if (!nome || !dataNascimento) {
      return NextResponse.json({
        success: false,
        error: 'dadosNv.nome e dadosNv.data_nascimento são obrigatórios',
        link: null,
        termoId: null
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
        link: null,
        termoId: null
      }, { status: 404 })
    }

    const client = manager.getClientById(c6Config.id) as any
    if (!client?.cltGenerateAuthorizationLink) {
      return NextResponse.json({
        success: false,
        error: 'registro C6 não disponível',
        link: null,
        termoId: null
      }, { status: 500 })
    }

    if (c6Config.username && c6Config.password && typeof client.updateCredentials === 'function') {
      client.updateCredentials(c6Config.username, c6Config.password, c6Config.baseUrl, (c6Config as any).authUrl)
    }

    const result = await client.cltGenerateAuthorizationLink({
      cpf,
      nome,
      data_nascimento: dataNascIso,
      telefone: telefone ? { codigo_area: telefone.slice(0, 2), numero: telefone.slice(2) } : undefined
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Falha ao gerar link de autorização',
        link: null,
        termoId: null
      }, { status: 502 })
    }

    const link = result.data?.link ?? result.data?.url ?? null
    const expiracao = result.data?.data_expiracao ?? result.data?.expire_at ?? null

    return NextResponse.json({
      success: true,
      link,
      expiracao,
      termoId: cpf,
      raw: result.data ?? null
    })
  } catch (e: any) {
    console.error('[whatsapp/c6/gerar-termo]', e)
    return NextResponse.json({
      success: false,
      error: e?.message || 'Erro interno',
      link: null,
      termoId: null
    }, { status: 500 })
  }
}
