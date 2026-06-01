import { NextRequest, NextResponse } from 'next/server'
import { extractCredSpotInlineFromBody, resolveCredSpotClient, CREDSPOT_CLIENT_RESOLVE_ERROR } from '@/lib/credspot-resolve-client'

/**
 * POST /api/produto/credspot/bank-accounts
 * CredSpot: POST /bank-accounts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiId, user_uuid, bank_code, branch, account_number, account_type, account_digit } = body
    if (!apiId || !user_uuid || !bank_code || !branch || !account_number || !account_type) {
      return NextResponse.json(
        { success: false, error: 'apiId, user_uuid, bank_code, branch, account_number e account_type são obrigatórios' },
        { status: 400 }
      )
    }
    const client = resolveCredSpotClient(apiId, extractCredSpotInlineFromBody(body as Record<string, unknown>))
    if (!client) {
      return NextResponse.json({ success: false, error: CREDSPOT_CLIENT_RESOLVE_ERROR }, { status: 400 })
    }
    const res = await client.criarContaBancaria({
      user_uuid,
      bank_code: String(bank_code),
      branch: String(branch),
      account_number: String(account_number),
      account_type: String(account_type),
      ...(account_digit != null && account_digit !== '' ? { account_digit: String(account_digit) } : {}),
    })
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error, details: res.data }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: res.data?.data ?? res.data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
