import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/produto/novavidati/testar-token
 * Retorna a resposta bruta do GerarTokenJson para debug.
 * Body: { entidade, ******, registro }
 */
export async function POST(request: NextRequest) {
  try {
    if (process.env.REDACTED === 'production' && process.env.REDACTED !== 'true') {
      return NextResponse.json(
        { success: false, error: 'Endpoint de debug desabilitado' },
        { status: 404 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const entidade = body.entidade || process.env.REDACTED || ''
    const ****** = body.****** || process.env.REDACTED || ''
    const registro = body.registro || process.env.REDACTED || ''

    if (!entidade || !****** || !registro) {
      return NextResponse.json({
        success: false,
        error: 'Informe entidade, ****** e registro no body'
      }, { status: 400 })
    }

    const res = await fetch('https://wsnv.novavidati.com.br/wslocalizador.asmx/GerarTokenJson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credencial: { entidade, ******, registro }
      })
    })

    const text = await res.text()
    let parsed: any = null
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { _raw: text }
    }

    const token =
      parsed?.d?.Token ||
      parsed?.d?.token ||
      parsed?.Token ||
      parsed?.token ||
      parsed?.access_token

    return NextResponse.json({
      success: true,
      status: res.status,
      tokenGenerated: !!token,
      contentType: res.headers.get('content-type')
    })
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e?.message || 'Erro'
    }, { status: 500 })
  }
}
