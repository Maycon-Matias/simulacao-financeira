import { NextRequest, NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'
import type { BancoResultado } from '@/lib/whatsapp-banco-resultado'
import { normalizarMargem, statusFromMargem } from '@/lib/whatsapp-banco-resultado'

/**
 * POST /api/whatsapp/v8/consultar-margem
 * Wrapper para o fluxo WhatsApp: cria termo V8, autoriza e retorna margem em formato padronizado.
 * Body: { cpf, dadosNv: { nome, data_nascimento, sexo, email, telefone } }, apiId?: string
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
    const dataNascimento = String(dadosNv.data_nascimento ?? '').trim()
    const sexo = dadosNv.sexo === 'female' ? 'female' : 'male'
    const email = String(dadosNv.email ?? '').trim() || `registro.${cpf}@poracred.com.br`
    const telefone = String(dadosNv.telefone ?? '').replace(/\D/g, '') || '11999999999'

    if (!nome || !dataNascimento) {
      return NextResponse.json({
        success: false,
        error: 'dadosNv.nome e dadosNv.data_nascimento são obrigatórios',
        resultado: null
      }, { status: 400 })
    }

    const manager = getApiManager()
    const configs = manager.getConfigs()
    const v8Config = apiId
      ? configs.find((c: any) => c.type === 'v8digital' && c.id === apiId)
      : configs.find((c: any) => c.type === 'v8digital' && c.active)
    if (!v8Config) {
      return NextResponse.json({
        success: false,
        error: 'API V8 Digital não configurada',
        resultado: null
      }, { status: 404 })
    }

    const client = manager.getClientById(v8Config.id) as any
    if (!client?.criarTermoConsentimentoCLT) {
      return NextResponse.json({
        success: false,
        error: 'registro V8 não disponível',
        resultado: null
      }, { status: 500 })
    }

    const birthDate = dataNascimento.includes('/')
      ? dataNascimento.split('/').reverse().join('-')
      : dataNascimento

    const criarRes = await client.criarTermoConsentimentoCLT({
      cpf,
      nome,
      telefone,
      email,
      birthDate,
      gender: sexo
    })

    if (!criarRes.success) {
      const motivo = criarRes.error || 'Erro ao criar termo'
      const resultado: BancoResultado = {
        banco: 'V8',
        margem: 0,
        status: 'ERRO',
        motivo,
        raw: criarRes as any
      }
      return NextResponse.json({
        success: false,
        error: motivo,
        resultado
      }, { status: 502 })
    }

    const consultId =
      criarRes.data?.id ??
      criarRes.data?.consultId ??
      criarRes.data?.consult_id ??
      criarRes.data?.data?.id

    if (!consultId) {
      return NextResponse.json({
        success: false,
        error: 'ID do termo não retornado pela V8',
        resultado: { banco: 'V8', margem: 0, status: 'ERRO', motivo: 'Resposta inválida' }
      }, { status: 502 })
    }

    await new Promise((r) => setTimeout(r, 1000))

    const authRes = await client.autorizarTermoConsentimentoCLT(consultId)
    if (!authRes.success) {
      console.warn('[whatsapp/v8/consultar-margem] Autorização falhou, tentando obter detalhes mesmo assim:', authRes.error)
    }

    await new Promise((r) => setTimeout(r, 5000))

    const detalhesRes = await client.buscarDetalhesTermoCLT(consultId)
    const termo = detalhesRes.success ? detalhesRes.data : null

    const margem = normalizarMargem(
      termo?.availableMarginValue ??
      termo?.available_margin_value ??
      termo?.margin?.available ??
      termo?.margin?.value ??
      termo?.availableMargin ??
      termo?.available_margin
    )

    const rejectionReason =
      termo?.rejectionReason ??
      termo?.rejection_reason ??
      termo?.message ??
      (termo?.status === 'REJECTED' ? 'Consulta recusada' : undefined)

    const status = statusFromMargem(margem, rejectionReason)

    const resultado: BancoResultado = {
      banco: 'V8',
      margem,
      status,
      motivo: rejectionReason,
      raw: termo ?? undefined
    }

    return NextResponse.json({
      success: true,
      resultado
    })
  } catch (e: any) {
    console.error('[whatsapp/v8/consultar-margem]', e)
    return NextResponse.json({
      success: false,
      error: e?.message || 'Erro interno',
      resultado: {
        banco: 'V8',
        margem: 0,
        status: 'ERRO' as const,
        motivo: e?.message || 'Erro interno'
      }
    }, { status: 500 })
  }
}
