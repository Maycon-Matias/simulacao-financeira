import { NextRequest, NextResponse } from 'next/server'
import { C6BankAutomation } from '@/lib/c6bank-automation'

/**
 * POST /api/produto/c6bank/autorizacao/aceitar-automatico
 *
 * Aceita o termo de autorização automaticamente usando automação de browser
 * Body: link
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { link } = body

    if (!link) {
      return NextResponse.json(
        { success: false, error: 'link é obrigatório' },
        { status: 400 }
      )
    }

    console.log('[API] C6 Bank aceitar-automatico - Iniciando automação para link:', link)

    const automation = new C6BankAutomation()
    
    try {
      const resultado = await automation.aceitarTermoAutomaticamente(link)
      
      console.log('[API] C6 Bank aceitar-automatico - Resultado:', JSON.stringify(resultado, null, 2))

      if (!resultado.success) {
        return NextResponse.json(
          { 
            success: false, 
            error: resultado.error || 'Erro ao aceitar termo automaticamente',
            message: resultado.message
          },
          { status: 400 }
        )
      }

      return NextResponse.json({ 
        success: true, 
        message: resultado.message || 'Termo aceito automaticamente com sucesso.'
      })
    } finally {
      // Limpa recursos
      await automation.cleanup()
    }
  } catch (error: any) {
    console.error('[API] C6 Bank aceitar-automatico:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao aceitar termo automaticamente' },
      { status: 500 }
    )
  }
}
