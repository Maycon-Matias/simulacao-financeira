import { NextRequest, NextResponse } from 'next/server'
import { NovaVidaTiNvCheckClient } from '@/lib/novavidati-nvcheck-client'
import { getNovaVidaCache, setNovaVidaCache } from '@/lib/novavidati-cache'
import { normalizarDadosNv, type DadosClienteNv } from '@/lib/whatsapp-nv-normalize'

/**
 * POST /api/whatsapp/consulta-inicial
 * Consulta inicial para fluxo WhatsApp: dado o CPF, retorna dados do registro via Nova Vida (NVCheck).
 * Usa cache por CPF para evitar consultas repetidas (custo). Cache TTL 24h.
 *
 * Body: { cpf: string, forcar_consulta?: boolean }
 * Credenciais: env NOVVIDATI_* ou body entidade, password, registro
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const cpfRaw = body.cpf?.toString() ?? ''
    const cpf = cpfRaw.replace(/\D/g, '')
    const forcarConsulta = Boolean(body.forcar_consulta)

    if (cpf.length !== 11) {
      return NextResponse.json({
        success: false,
        error: 'CPF deve ter 11 dígitos',
        mensagemParaUsuario: 'CPF inválido. Informe apenas os 11 dígitos.'
      }, { status: 400 })
    }

    const entidade = body.entidade || process.env.REDACTED || ''
    const password = body.password || process.env.REDACTED || ''
    const registro = body.registro || process.env.REDACTED || ''

    if (!entidade || !password || !registro) {
      return NextResponse.json({
        success: false,
        error: 'Credenciais Nova Vida não configuradas',
        mensagemParaUsuario: 'Configuração temporariamente indisponível. Tente mais tarde.'
      }, { status: 500 })
    }

    let consulta: Record<string, any> | null = null
    let fromCache = false

    if (!forcarConsulta) {
      const cached = await getNovaVidaCache(cpf)
      if (cached?.data) {
        consulta = (cached.data as any)?.CONSULTA ?? (cached.data as any) ?? null
        if (consulta) fromCache = true
      }
    }

    if (!consulta) {
      const credenciais = { entidade, password, registro }
      const client = new NovaVidaTiNvCheckClient(credenciais)
      const result = await client.consultar(cpf)
      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error || 'Falha na consulta',
          mensagemParaUsuario: 'Não foi possível consultar os dados no momento. Tente novamente em instantes.'
        }, { status: 502 })
      }
      const data = result.data
      consulta = data?.CONSULTA ?? data ?? {}
      if (consulta && typeof consulta === 'object') {
        await setNovaVidaCache(cpf, { CONSULTA: consulta })
      }
    }

    const dados = normalizarDadosNv(cpf, consulta ?? {})
    if (!dados) {
      return NextResponse.json({
        success: false,
        error: 'Dados insuficientes na resposta Nova Vida (nome não encontrado)',
        mensagemParaUsuario: 'Não foi possível identificar seus dados. Verifique o CPF ou tente mais tarde.'
      }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      fromCache,
      dados: dados as DadosClienteNv,
      mensagemParaUsuario: null
    })
  } catch (e: any) {
    console.error('[API whatsapp/consulta-inicial]', e)
    return NextResponse.json({
      success: false,
      error: e?.message || 'Erro interno',
      mensagemParaUsuario: 'Ocorreu um erro. Por favor, tente novamente em instantes.'
    }, { status: 500 })
  }
}
