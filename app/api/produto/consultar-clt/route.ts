import { type NextRequest, NextResponse } from "next/server"
import { getApiManager } from "@/lib/api-manager"

function sanitizeHubRouteError(apiType: string | undefined, message: string): string {
  if (apiType !== 'hubcredito') return message
  const text = String(message || '')
  const lower = text.toLowerCase()
  if (text.includes('AADSTS501051') || lower.includes('is not assigned to a role for the application')) {
    return 'Usuário sem permissão na aplicação da Hub Crédito (AADSTS501051). Solicite à Hub o vínculo de role para este login no app de integração.'
  }
  return message
}

/**
 * POST /api/produto/consultar-clt
 * 
 * Endpoint para consultar vínculos de trabalho CLT
 * Suporta: Nossa Fintech e V8 Digital
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cpfTrabalhador, apiId, credentials, cnpjEmpregador, serviceType, telefone, autorizacaoId, idAutorizacao } = body
    // credentials: opcional para sobrescrever do registro
    // cnpjEmpregador: CNPJ da organizacao (obrigatório para Nossa Fintech)
    // serviceType: Código da bancarizadora (obrigatório para Nossa Fintech)
    // telefone: Telefone/Celular (opcional, será usado padrão se não fornecido)

    if (!cpfTrabalhador || cpfTrabalhador.trim() === '') {
      return NextResponse.json(
        { 
          success: false,
          error: 'CPF do trabalhador é obrigatório' 
        },
        { status: 400 }
      )
    }

    const manager = getApiManager()

    // Se não especificar apiId, consulta todas as APIs ativas (exceto C6, que exige nome e data de nascimento)
    if (!apiId) {
      console.log('Consultando vínculos CLT em todas as APIs, CPF:', cpfTrabalhador)
      
      const configs = manager.getConfigs().filter(c => c.active && c.type !== 'c6bank')
      const resultados: any[] = []

      // Consulta todas as APIs em paralelo
      const promessas = configs.map(async (config) => {
        try {
          // Verifica se a configuração tem credenciais
          if (!config.username || !config.password) {
            return {
              apiId: config.id,
              apiName: config.name,
              apiType: config.type,
              success: false,
              error: `Credenciais não configuradas para ${config.name}. Configure as variáveis de ambiente ou atualize a configuração da API.`
            }
          }

          let client = manager.getClientById(config.id)
          if (!client) {
            // Se não encontrou o registro, cria um novo com a configuração atualizada
            const updatedConfig = manager.getConfig(config.id)
            if (updatedConfig && updatedConfig.username && updatedConfig.password) {
              client = manager.getClientById(config.id) || manager.getClient()
              // Força atualização das credenciais
              if ('updateCredentials' in client) {
                (client as any).updateCredentials(updatedConfig.username, updatedConfig.password, updatedConfig.baseUrl)
              }
            } else {
              return {
                apiId: config.id,
                apiName: config.name,
                apiType: config.type,
                success: false,
                error: `Credenciais não encontradas para ${config.name}`
              }
            }
          }

          let response
          
          // Nossa Fintech tem método consultarVinculosCLT
          if (config.type === 'nossafintech' && 'consultarVinculosCLT' in client) {
            const nossaFintechClient = client as any
            // Nossa Fintech requer cnpjEmpregador e serviceType
            response = await nossaFintechClient.consultarVinculosCLT(
              cpfTrabalhador,
              cnpjEmpregador,
              serviceType || 'QITECH'
            )
          }
          // V8 Digital tem método consultarVinculosCLT
          else if (config.type === 'v8digital' && 'consultarVinculosCLT' in client) {
            const v8Client = client as any
            response = await v8Client.consultarVinculosCLT(cpfTrabalhador)
          }
          // Facta: token via GET gera-token (Basic Auth), depois consulta vínculos
          else if (config.type === 'facta' && 'consultarVinculosCLT' in client) {
            const factaClient = client as any
            response = await factaClient.consultarVinculosCLT(cpfTrabalhador)
          }
          // Presença Bank: consultar vínculos CLT por CPF (opcional: autorizacaoId/idAutorizacao quando API exige "autorização válida")
          else if (config.type === 'presencabank' && 'consultarVinculosCLT' in client) {
            const presencaClient = client as any
            const presencaOpts = (autorizacaoId != null || idAutorizacao != null) ? { autorizacaoId, idAutorizacao } : undefined
            response = await presencaClient.consultarVinculosCLT(cpfTrabalhador, presencaOpts)
          }
          // Hub Crédito: consulta vínculos CLT por CPF
          else if (config.type === 'hubcredito' && 'consultarVinculosCLT' in client) {
            const hubClient = client as any
            response = await hubClient.consultarVinculosCLT(cpfTrabalhador)
          } else {
            return {
              apiId: config.id,
              apiName: config.name,
              apiType: config.type,
              success: false,
              error: `API ${config.name} não suporta consulta de vínculos CLT`
            }
          }

          // Se a resposta indica sucesso mas tem erros (HubCredito), trata como erro
          if (response.success && response.data) {
            // HubCredito pode retornar success: true mas com hasError: true ou errors
            if (response.data.hasError === true || 
                (response.data.errors && Array.isArray(response.data.errors) && response.data.errors.length > 0)) {
              const errorMessage = response.data.errors && Array.isArray(response.data.errors)
                ? response.data.errors.join(', ')
                : response.data.message || 'Erro na resposta da API'
              return {
                apiId: config.id,
                apiName: config.name,
                apiType: config.type,
                success: false,
                data: response.data,
                error: errorMessage
              }
            }
          }
          
          return {
            apiId: config.id,
            apiName: config.name,
            apiType: config.type,
            success: response.success || false,
                data: response.data,
                error: response.error,
                requiresAuthorization:
                  config.type === 'facta' &&
                  typeof response.error === 'string' &&
                  response.error.toLowerCase().includes('solicita-autorizacao-consulta'),
          }
        } catch (error: any) {
          return {
            apiId: config.id,
            apiName: config.name,
            apiType: config.type,
            success: false,
            error: error.message || 'Erro ao consultar API'
          }
        }
      })

      const resultadosMultiplas = await Promise.allSettled(promessas)
      
      resultadosMultiplas.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          resultados.push(result.value)
        } else {
          const config = configs[index]
          resultados.push({
            apiId: config.id,
            apiName: config.name,
            apiType: config.type,
            success: false,
            error: result.reason?.message || 'Erro ao executar consulta'
          })
        }
      })

      return NextResponse.json({
        success: true,
        data: resultados,
        consultouMultiplas: true
      })
    }

    // Consulta apenas a API especificada
    console.log('Consultando vínculos CLT, CPF:', cpfTrabalhador, 'API:', apiId)

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
      console.log('[consultar-clt] Usando credenciais da requisição, promotId:', credentials.promotId)
    }

    // Log para debug - especialmente para Nossa Fintech
    if (config.type === 'nossafintech') {
      console.log('[consultar-clt] Config Nossa Fintech encontrada:', {
        id: config.id,
        name: config.name,
        baseUrl: config.baseUrl,
        username: config.username,
        hasPassword: !!config.password,
        promotId: (config as any).promotId,
        promotIdType: typeof (config as any).promotId
      })
    }

    let client = manager.getClientById(apiId)
    
    // Se credentials foram fornecidas e é Nossa Fintech, força atualização do registro
    if (credentials && config.type === 'nossafintech' && client) {
      const nossaFintechClient = client as any
      if (nossaFintechClient.updateCredentials) {
        console.log('[consultar-clt] Atualizando credenciais do registro com promotId da requisição:', credentials.promotId)
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
      if (config?.type === 'nossafintech' && 'consultarVinculosCLT' in client) {
        const nossaFintechClient = client as any
        console.log('[consultar-clt] Chamando consultarVinculosCLT da Nossa Fintech para CPF:', cpfTrabalhador)
        console.log('[consultar-clt] CNPJ Empregador:', cnpjEmpregador || 'NÃO FORNECIDO')
        console.log('[consultar-clt] Service Type:', serviceType || 'NÃO FORNECIDO')
        console.log('[consultar-clt] Telefone:', telefone || 'NÃO FORNECIDO (usando padrão)')
        response = await nossaFintechClient.consultarVinculosCLT(
          cpfTrabalhador,
          cnpjEmpregador,
          serviceType || 'QITECH',
          telefone
        )
        console.log('[consultar-clt] Resposta da Nossa Fintech:', JSON.stringify(response, null, 2))
      } else if (config?.type === 'v8digital' && 'consultarVinculosCLT' in client) {
        const v8Client = client as any
        console.log('[consultar-clt] Chamando consultarVinculosCLT do V8 Digital para CPF:', cpfTrabalhador)
        response = await v8Client.consultarVinculosCLT(cpfTrabalhador)
        console.log('[consultar-clt] Resposta do V8 Digital:', JSON.stringify(response, null, 2))
      } else if (config?.type === 'facta' && 'consultarVinculosCLT' in client) {
        const factaClient = client as any
        console.log('[consultar-clt] Chamando consultarVinculosCLT da Facta para CPF:', cpfTrabalhador)
        response = await factaClient.consultarVinculosCLT(cpfTrabalhador)
        console.log('[consultar-clt] Resposta da Facta:', JSON.stringify(response, null, 2))
      } else if (config?.type === 'presencabank' && 'consultarVinculosCLT' in client) {
        const presencaClient = client as any
        const presencaOpts = (autorizacaoId != null || idAutorizacao != null) ? { autorizacaoId, idAutorizacao } : undefined
        console.log('[consultar-clt] Chamando consultarVinculosCLT da Presença Bank para CPF:', cpfTrabalhador, presencaOpts ? 'com autorização' : '')
        response = await presencaClient.consultarVinculosCLT(cpfTrabalhador, presencaOpts)
        console.log('[consultar-clt] Resposta da Presença Bank:', JSON.stringify(response, null, 2))
      } else if (config?.type === 'hubcredito' && 'consultarVinculosCLT' in client) {
        const hubClient = client as any
        console.log('[consultar-clt] Chamando consultarVinculosCLT da Hub Crédito para CPF:', cpfTrabalhador)
        response = await hubClient.consultarVinculosCLT(cpfTrabalhador)
        console.log('[consultar-clt] Resposta da Hub Crédito:', JSON.stringify(response, null, 2))
      } else {
        return NextResponse.json(
          { 
            success: false,
            error: 'API não suporta consulta de vínculos CLT' 
          },
          { status: 400 }
        )
      }
    } catch (apiError: any) {
      console.error('[consultar-clt] Erro ao chamar método da API:', apiError)
      console.error('[consultar-clt] Stack trace:', apiError.stack)
      return NextResponse.json(
        { 
          success: false,
          error: `Erro ao chamar API: ${apiError.message || 'Erro desconhecido'}` 
        },
        { status: 500 }
      )
    }

    if (!response) {
      console.error('[consultar-clt] Resposta vazia da API')
      return NextResponse.json(
        { 
          success: false,
          error: 'Resposta vazia da API' 
        },
        { status: 500 }
      )
    }

    if (!response.success) {
      const errorMessage = sanitizeHubRouteError(config?.type, response.error || "Erro ao consultar vínculos CLT")
      const msgLower = String(errorMessage).toLowerCase()

      const requiresAuthorization =
        config?.type === 'facta' &&
        typeof errorMessage === 'string' &&
        msgLower.includes('solicita-autorizacao-consulta')

      // Erros de "fila de autorização" na Facta são tratados como erro de política/regra de negócio,
      // não como falha técnica (não derruba a tela com 500).
      const isPolicyError =
        config?.type === 'facta' &&
        typeof errorMessage === 'string' &&
        (msgLower.includes('fila de autorização') || msgLower.includes('fila de autorizacao'))

      console.error('[consultar-clt] Erro na resposta da API:', errorMessage)
      return NextResponse.json(
        { 
          success: false,
          error: errorMessage,
          requiresAuthorization,
          isPolicyError,
          apiType: config?.type,
        },
        { status: isPolicyError ? 200 : requiresAuthorization ? 400 : 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: response.data,
      consultouMultiplas: false,
      apiName: config?.name || 'API Padrão'
    })
  } catch (error: any) {
    console.error("[consultar-clt] Erro não tratado ao consultar vínculos CLT:", error)
    console.error("[consultar-clt] Stack trace completo:", error?.stack)
    console.error("[consultar-clt] Tipo do erro:", typeof error)
    console.error("[consultar-clt] Propriedades do erro:", error ? Object.keys(error) : 'erro é null/undefined')
    
    return NextResponse.json(
      { 
        success: false,
        error: error?.message || error?.toString() || "Erro interno do servidor" 
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/produto/consultar-clt
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cpfTrabalhador = searchParams.get('cpfTrabalhador')

    if (!cpfTrabalhador) {
      return NextResponse.json(
        { 
          success: false,
          error: 'CPF do trabalhador é obrigatório (parâmetro: cpfTrabalhador)' 
        },
        { status: 400 }
      )
    }

    const apiId = searchParams.get('apiId')
    const manager = getApiManager()
    const client = apiId ? manager.getClientById(apiId) : manager.getClient()
    
    if (!client) {
      return NextResponse.json(
        { 
          success: false,
          error: 'API não encontrada ou não configurada' 
        },
        { status: 400 }
      )
    }

    if (!('consultarVinculosCLT' in client)) {
      return NextResponse.json(
        {
          success: false,
          error: 'API nÃ£o suporta consulta de vÃ­nculos CLT',
        },
        { status: 400 }
      )
    }

    const response = await (client as any).consultarVinculosCLT(cpfTrabalhador)

    if (!response.success) {
      return NextResponse.json(
        { 
          success: false,
          error: response.error || "Erro ao consultar vínculos CLT na API HubCredito" 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: response.data,
    })
  } catch (error: any) {
    console.error("Erro ao consultar vínculos CLT:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Erro interno do servidor" 
      },
      { status: 500 }
    )
  }
}

