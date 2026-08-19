import { NextResponse } from 'next/server'
import { getApiManager } from '@/lib/api-manager'

export async function POST(request: Request) {
  try {
    const { cpf, serviceType, apiId, credentials } = await request.json()

    if (!apiId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'API ID é obrigatório' 
        },
        { status: 400 }
      )
    }

    if (!cpf) {
      return NextResponse.json(
        { 
          success: false,
          error: 'CPF é obrigatório' 
        },
        { status: 400 }
      )
    }

    const manager = getApiManager()
    const config = manager.getConfig(apiId)

    if (!config || config.type !== 'nossafintech') {
      return NextResponse.json(
        { 
          success: false,
          error: 'API não encontrada ou não é do tipo Nossa Fintech' 
        },
        { status: 400 }
      )
    }

    const nossaFintechClient = manager.getClient(apiId, true) as any // Force recreate to ensure fresh credentials

    // Se credenciais forem fornecidas na requisição, atualiza o registro
    if (credentials) {
      console.log('[verificar-status-clt] Usando credenciais da requisição, promotId:', credentials.promotId)
      nossaFintechClient.updateCredentials(
        credentials.username || config.username, // CPF/username
        credentials.password || config.password,
        credentials.baseUrl || config.baseUrl,
        credentials.promotId || (config as any).promotId
      )
    } else {
      // Se não houver credenciais na requisição, usa as da config
      console.log('[verificar-status-clt] Usando credenciais da configuração, promotId:', (config as any).promotId)
      nossaFintechClient.updateCredentials(
        config.username,
        config.password,
        config.baseUrl,
        (config as any).promotId
      )
    }
    
    console.log('[verificar-status-clt] Chamando verificarStatusAutorizacao da Nossa Fintech para CPF:', cpf)
    console.log('[verificar-status-clt] Service Type:', serviceType || 'QITECH')

    const response = await nossaFintechClient.verificarStatusAutorizacao(cpf, serviceType || 'QITECH')
    
    console.log('[verificar-status-clt] Resposta da Nossa Fintech:', JSON.stringify(response, null, 2))

    if (response.success) {
      return NextResponse.json({ success: true, data: response.data })
    } else {
      return NextResponse.json({ success: false, error: response.error }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Erro na rota /api/produto/verificar-status-clt:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

