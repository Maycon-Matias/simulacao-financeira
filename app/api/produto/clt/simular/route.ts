import { type NextRequest, NextResponse } from "next/server"
import { getApiManager } from "@/lib/api-manager"

/**
 * POST /api/produto/clt/simular
 * 
 * Simula propostas CLT em múltiplas APIs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      cpf, 
      lojaId, 
      idCotacao, 
      numeroParcelas, 
      valor, 
      matricula, 
      codigoInscricaoEmpregador, 
      numeroInscricaoEmpregador, 
      apiId,
      // Novos campos para Nossa Fintech
      marginKey,
      simulationType,
      employerDocument,
      requestedAmount,
      serviceType,
      codTabela
    } = body

    // Valida CPF sempre obrigatório
    if (!cpf) {
      return NextResponse.json(
        { 
          success: false,
          error: 'CPF é obrigatório' 
        },
        { status: 400 }
      )
    }

    // Obtém configuração da API para determinar quais campos usar
    const manager = getApiManager()
    const config = apiId ? manager.getConfig(apiId) : null

    // Valida campos específicos conforme o tipo de API
    if (apiId && config) {
      if (config.type === 'v8digital') {
        // V8 Digital só precisa de CPF (valor e parcelas são opcionais)
        // Não precisa validar outros campos
      } else if (config.type === 'nossafintech') {
        // Nossa Fintech precisa dos novos campos conforme documentação oficial
        if (!marginKey || !simulationType || !employerDocument || !requestedAmount || !serviceType || !codTabela) {
          return NextResponse.json(
            { 
              success: false,
              error: 'Para Nossa Fintech, são obrigatórios: marginKey, simulationType, employerDocument, requestedAmount, serviceType, codTabela' 
            },
            { status: 400 }
          )
        }
      }
    } else if (!apiId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'apiId é obrigatório' 
        },
        { status: 400 }
      )
    } else if (apiId && !config) {
      return NextResponse.json(
        { 
          success: false,
          error: 'API não encontrada' 
        },
        { status: 400 }
      )
    }

    // Prepara parâmetros conforme o tipo de API
    const paramsSimulacao: any = {
      cpf: String(cpf).replace(/\D/g, '').padStart(11, '0'), // Remove formatação do CPF e garante 11 dígitos
    }

    // Adiciona campos conforme o tipo de API
    if (config?.type === 'v8digital') {
      // V8 Digital só precisa de CPF, valor e parcelas (opcionais)
      if (valor !== undefined) paramsSimulacao.valorSolicitado = Number(valor)
      if (numeroParcelas !== undefined) paramsSimulacao.numeroParcelas = Number(numeroParcelas)
    } else if (config?.type === 'nossafintech') {
      // Nossa Fintech usa os novos campos conforme documentação oficial
      paramsSimulacao.marginKey = marginKey
      paramsSimulacao.simulationType = simulationType
      paramsSimulacao.employerDocument = employerDocument.replace(/\D/g, '').padStart(14, '0')
      paramsSimulacao.requestedAmount = Number(requestedAmount)
      paramsSimulacao.serviceType = serviceType
      paramsSimulacao.codTabela = codTabela
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: `API ${config?.name || 'desconhecida'} não suportada. Use Nossa Fintech ou V8 Digital.` 
        },
        { status: 400 }
      )
    }

    console.log('Simulando CLT com parâmetros:', JSON.stringify(paramsSimulacao, null, 2))
    console.log('Tipo de API:', config?.type)

    // apiId é obrigatório
    if (!apiId || !config) {
      return NextResponse.json(
        { 
          success: false,
          error: 'API não encontrada ou não configurada' 
        },
        { status: 400 }
      )
    }

    const client = manager.getClientById(apiId)
    
    if (!client) {
      return NextResponse.json(
        { 
          success: false,
          error: 'registro da API não encontrado' 
        },
        { status: 400 }
      )
    }

    let response

    // Verifica o tipo e chama o método apropriado
    if (config.type === 'v8digital' && 'simularCreditoCLT' in client) {
      const v8Client = client as any
      
      // V8 Digital requer consultId e configId
      const { consultId, configId } = body
      
      if (!consultId) {
        return NextResponse.json(
          { 
            success: false,
            error: 'consultId é obrigatório para V8 Digital. Crie o termo de consentimento primeiro.' 
          },
          { status: 400 }
        )
      }
      
      if (!configId) {
        return NextResponse.json(
          { 
            success: false,
            error: 'configId é obrigatório para V8 Digital. Consulte as taxas disponíveis primeiro.' 
          },
          { status: 400 }
        )
      }
      
      // IMPORTANTE: number_of_installments é obrigatório na API V8 Digital
      // Se não informado, envia 0 (usa valor máximo disponível)
      const numeroParcelasFinal = numeroParcelas ? Number(numeroParcelas) : 0
      
      console.log('[clt/simular] V8 Digital - Parâmetros:', {
        consultId,
        configId,
        valorSolicitado: valor ? Number(valor) : undefined,
        numeroParcelas: numeroParcelasFinal,
        valorParcela: body.valorParcela ? Number(body.valorParcela) : undefined,
      })
      
      const valorParcela = body.valorParcela ? Number(body.valorParcela) : undefined
      
      response = await v8Client.simularCreditoCLT({
        consultId,
        configId,
        valorSolicitado: valor ? Number(valor) : undefined,
        numeroParcelas: numeroParcelasFinal,
        valorParcela: valorParcela,
      })
    } else if (config.type === 'nossafintech' && 'simularCLT' in client) {
      const nossaFintechClient = client as any
      console.log('[clt/simular] Chamando simularCLT da Nossa Fintech')
      
      response = await nossaFintechClient.simularCLT({
        marginKey: paramsSimulacao.marginKey,
        simulationType: paramsSimulacao.simulationType,
        employerDocument: paramsSimulacao.employerDocument,
        requestedAmount: paramsSimulacao.requestedAmount,
        serviceType: paramsSimulacao.serviceType,
        codTabela: paramsSimulacao.codTabela
      })
      console.log('[clt/simular] Resposta da Nossa Fintech:', JSON.stringify(response, null, 2))
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: `API ${config.name} não suporta simulação CLT ou tipo não reconhecido` 
        },
        { status: 400 }
      )
    }

    if (!response.success) {
      console.error('Erro ao simular CLT:', response.error)
      
      const errorMessage = response.error || "Erro ao simular proposta CLT"
      const isPolicyError = errorMessage.toLowerCase().includes('política') || 
                           errorMessage.toLowerCase().includes('não existem simulações') ||
                           errorMessage.toLowerCase().includes('não se enquadra')
      
      return NextResponse.json(
        { 
          success: false,
          error: errorMessage,
          isPolicyError: isPolicyError,
        },
        { status: isPolicyError ? 200 : 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: response.data,
      consultouMultiplas: false
    })
  } catch (error: any) {
    console.error("Erro ao simular CLT:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Erro interno do servidor" 
      },
      { status: 500 }
    )
  }
}

