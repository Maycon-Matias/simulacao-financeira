import { NextRequest, NextResponse } from 'next/server'
import { NovaVidaTiNvCheckClient } from '@/lib/novavidati-nvcheck-client'
import { getCachedConsulta, saveConsulta } from '@/lib/nvcheck-cache'

/**
 * POST /api/produto/novavidati/consultar
 * Consulta dados do registro (CPF ou CNPJ) via NVCheck - Nova Vida TI.
 *
 * Body: { documento: string }  (CPF 11 dígitos ou CNPJ 14 dígitos)
 *
 * Credenciais via env: NOVVIDATI_USUARIO, NOVVIDATI_SENHA, NOVVIDATI_CLIENTE
 * Ou via body: entidade, ******, registro (para override)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const documento = body.documento?.toString()?.replace(/\D/g, '') ?? ''
    const entidade = body.entidade || process.env.REDACTED || ''
    const ****** = body.****** || process.env.REDACTED || ''
    const registro = body.registro || process.env.REDACTED || ''

    if (!entidade || !****** || !registro) {
      return NextResponse.json({
        success: false,
        error: 'Credenciais não configuradas. Informe entidade, ****** e registro no corpo da requisição ou configure NOVVIDATI_* no .env.local'
      }, { status: 500 })
    }

    if (!documento) {
      return NextResponse.json({ success: false, error: 'documento (CPF ou CNPJ) obrigatório' }, { status: 400 })
    }

    if (documento.length !== 11 && documento.length !== 14) {
      return NextResponse.json({ success: false, error: 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos' }, { status: 400 })
    }

    const tipoDocumento = documento.length === 11 ? 'CPF' as const : 'CNPJ' as const

    // 1) Tenta buscar no cache local para evitar nova chamada à API externa
    const cached = await getCachedConsulta(documento)
    if (cached && cached.data) {
      return NextResponse.json({
        success: true,
        data: cached.data,
        documento: tipoDocumento,
        fromCache: true,
        cachedAt: cached.savedAt,
      })
    }

    const credenciais = entidade && ****** && registro
      ? { entidade, ******, registro }
      : undefined

    const client = new NovaVidaTiNvCheckClient(credenciais)
    const result = await client.consultar(documento)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Falha na consulta NVCheck' },
        { status: 502 }
      )
    }

    // 2) Salva o resultado da consulta no cache local
    await saveConsulta(documento, tipoDocumento, result.data)

    return NextResponse.json({
      success: true,
      data: result.data,
      documento: tipoDocumento,
    })
  } catch (e: any) {
    console.error('[API] Nova Vida TI NVCheck:', e)
    return NextResponse.json(
      { success: false, error: e?.message || 'Erro interno' },
      { status: 500 }
    )
  }
}
