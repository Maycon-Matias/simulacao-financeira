import { type NextRequest, NextResponse } from "next/server"
import { getApiManager } from "@/lib/api-manager"

/**
 * POST /api/produto/autorizar-clt
 * 
 * Endpoint para autorizar CLT na API Nossa Fintech
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cpf, nomeCompleto, telefone, serviceType, apiId, credentials } = body

    if (!cpf || cpf.trim() === '') {
      return NextResponse.json(
        { 
          success: false,
          error: 'CPF é obrigatório' 
        },
        { status: 400 }
      )
    }

    if (!nomeCompleto || nomeCompleto.trim() === '') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Nome completo é obrigatório' 
        },
        { status: 400 }
      )
    }

    if (!telefone || telefone.trim() === '') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Telefone é obrigatório' 
        },
        { status: 400 }
      )
    }

    if (!apiId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'API ID é obrigatório' 
        },
        { status: 400 }
      )
    }

    const manager = getApiManager()
    const config = manager.getConfig(apiId)
    
    if (!config) {
      return NextResponse.json(
        { 
          success: false,
          error: 'API não encontrada ou não configurada' 
        },
        { status: 400 }
      )
    }

    // Se credentials foram fornecidas (do registro), atualiza temporariamente
    if (credentials && config.type === 'nossafintech' && credentials.promotId) {
      (config as any).promotId = credentials.promotId
      if (credentials.username) config.username = credentials.username
      if (credentials.password) config.password = credentials.password
      if (credentials.baseUrl) config.baseUrl = credentials.baseUrl
      console.log('[autorizar-clt] Usando credenciais da requisição, promotId:', credentials.promotId)
    }

    let client = manager.getClientById(apiId)
    
    // Se credentials foram fornecidas e é Nossa Fintech, força atualização do registro
    if (credentials && config.type === 'nossafintech' && client) {
      const nossaFintechClient = client as any
      if (nossaFintechClient.updateCredentials) {
        console.log('[autorizar-clt] Atualizando credenciais do registro com promotId da requisição:', credentials.promotId)
        nossaFintechClient.updateCredentials(
          credentials.username || config.username,
          credentials.password || config.password,
          credentials.baseUrl || config.baseUrl,
          credentials.promotId
        )
      }
    }
    
    if (!client) {
      return NextResponse.json(
        { 
          success: false,
          error: 'registro da API não encontrado. Verifique se a API está ativa e configurada corretamente.' 
        },
        { status: 400 }
      )
    }

    let response

    try {
      // Verifica o tipo e chama o método apropriado
      if (config?.type === 'nossafintech' && 'autorizarCLT' in client) {
        const nossaFintechClient = client as any
        console.log('[autorizar-clt] Chamando autorizarCLT da Nossa Fintech para CPF:', cpf)
        console.log('[autorizar-clt] Nome:', nomeCompleto)
        console.log('[autorizar-clt] Telefone:', telefone)
        console.log('[autorizar-clt] Service Type:', serviceType || 'QITECH')
        
        response = await nossaFintechClient.autorizarCLT(
          cpf,
          nomeCompleto,
          telefone,
          serviceType || 'QITECH'
        )
        console.log('[autorizar-clt] Resposta da Nossa Fintech:', JSON.stringify(response, null, 2))
      } else {
        return NextResponse.json(
          { 
            success: false,
            error: 'API não suporta autorização CLT' 
          },
          { status: 400 }
        )
      }
    } catch (apiError: any) {
      console.error('[autorizar-clt] Erro ao chamar método da API:', apiError)
      console.error('[autorizar-clt] Stack trace:', apiError.stack)
      return NextResponse.json(
        { 
          success: false,
          error: `Erro ao chamar API: ${apiError.message || 'Erro desconhecido'}` 
        },
        { status: 500 }
      )
    }

    if (!response) {
      console.error('[autorizar-clt] Resposta vazia da API')
      return NextResponse.json(
        { 
          success: false,
          error: 'Resposta vazia da API' 
        },
        { status: 500 }
      )
    }

    // Retorna a resposta da API
    // Conforme documentação: https://nossa-fintech-doc.spixiiservices.com.br/docs/nossa-fintech-clt/criacao-autorizacao
    // Quando já existe autorização ativa, a API retorna success: true com data.status: "AUTHORIZED"
    if (response.success) {
      // Extrai o status da resposta (pode estar em data.status ou data.data.status)
      const status = response.data?.status || response.data?.data?.status
      const message = response.message || response.data?.message || 'Autorização processada com sucesso'
      
      // Obtém o promot_id usado (da config ou do client)
      const promotId = (config as any).promotId || (client as any)?.promotId
      
      // Se já está autorizado, informa explicitamente
      if (status === 'AUTHORIZED' || status === 'AUTORIZADO') {
        return NextResponse.json({
          success: true,
          data: {
            status: 'AUTHORIZED',
            authorization_link: response.data?.authorization_link || response.data?.data?.authorization_link || null,
            promotId: promotId // Inclui o promot_id usado
          },
          message: message.includes('já existe') ? message : 'Já existe uma autorização ativa para este CPF'
        })
      }
      
      // Autorização criada (pode estar PENDING aguardando confirmação via SMS)
      return NextResponse.json({
        success: true,
        data: {
          ...response.data,
          promotId: promotId // Inclui o promot_id usado
        },
        message: message
      })
    } else {
      // Se a resposta indica que já existe autorização, trata como sucesso
      if (response.error && (response.error.includes('já existe') || response.error.includes('ativa')) && response.error.includes('autorização')) {
        return NextResponse.json({
          success: true,
          data: { status: 'AUTHORIZED' },
          message: 'Já existe uma autorização ativa para este CPF'
        })
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: response.error || 'Erro ao criar autorização' 
        },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('[autorizar-clt] Erro geral:', error)
    return NextResponse.json(
      { 
        success: false,
        error: `Erro ao processar requisição: ${error.message || 'Erro desconhecido'}` 
      },
      { status: 500 }
    )
  }
}

