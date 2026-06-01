import { type NextRequest, NextResponse } from "next/server"
import { getApiManager } from "@/lib/api-manager"

/**
 * POST /api/produto/clt/enviar-proposta
 * 
 * Envia proposta CLT para aprovação
 * Suporta: Nossa Fintech e V8 Digital
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiId, cpf, valorSolicitado, numeroParcelas, ...outrosCampos } = body

    if (!cpf) {
      return NextResponse.json(
        { 
          success: false,
          error: 'CPF é obrigatório' 
        },
        { status: 400 }
      )
    }

    if (!apiId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'apiId é obrigatório' 
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
          error: 'API não encontrada' 
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

    console.log('Enviando proposta CLT para CPF:', cpf, 'API:', config.name)

    let response

    // V8 Digital
    if (config.type === 'v8digital' && 'criarPropostaCLT' in client) {
      if (!valorSolicitado || valorSolicitado <= 0) {
        return NextResponse.json(
          { 
            success: false,
            error: 'valorSolicitado é obrigatório e deve ser maior que zero' 
          },
          { status: 400 }
        )
      }

      const v8Client = client as any
      response = await v8Client.criarPropostaCLT({
        cpf,
        valorSolicitado: Number(valorSolicitado),
        numeroParcelas: Number(numeroParcelas) || 0,
        ...outrosCampos
      })
    }
    // Nossa Fintech - Implementar se necessário
    else if (config.type === 'nossafintech') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Envio de proposta para Nossa Fintech ainda não implementado. Use a API diretamente.' 
        },
        { status: 501 }
      )
    }
    else {
      return NextResponse.json(
        { 
          success: false,
          error: `API ${config.name} não suporta envio de proposta CLT` 
        },
        { status: 400 }
      )
    }

    if (!response.success) {
      console.error('Erro ao enviar proposta CLT:', response.error)
      return NextResponse.json(
        { 
          success: false,
          error: response.error || "Erro ao enviar proposta CLT" 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: response.data,
    })
  } catch (error: any) {
    console.error("Erro ao enviar proposta CLT:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Erro interno do servidor" 
      },
      { status: 500 }
    )
  }
}

