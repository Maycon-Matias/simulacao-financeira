import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Rota de API para autenticação CredSpot
 * Evita problemas de CORS fazendo a requisição do servidor
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId, clientSecret, authUrl, audience } = body

    if (!clientId || !clientSecret || !authUrl || !audience) {
      return NextResponse.json(
        {
          success: false,
          error: 'clientId, clientSecret, authUrl e audience são obrigatórios',
        },
        { status: 400 }
      )
    }

    console.log('[CredSpot Auth API] Autenticando...')
    console.log('[CredSpot Auth API] Auth URL:', authUrl)
    console.log('[CredSpot Auth API] Audience:', audience)

    const payload = {
      client_id: clientId,
      client_secret: clientSecret,
      audience: audience,
      grant_type: 'client_credentials',
    }

    console.log('[CredSpot Auth API] Payload (sem secret):', {
      ...payload,
      client_secret: '***'
    })

    // Tenta primeiro com JSON
    let response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    // Se retornar 403 ou 400, tenta com form-urlencoded (muitas APIs OAuth usam isso)
    if (response.status === 403 || response.status === 400) {
      console.log('[CredSpot Auth API] 403/400 recebido, tentando com application/x-www-form-urlencoded')
      
      const formData = new URLSearchParams()
      formData.append('client_id', clientId)
      formData.append('client_secret', clientSecret)
      formData.append('audience', audience)
      formData.append('grant_type', 'client_credentials')
      
      response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: formData.toString(),
      })
      
      console.log('[CredSpot Auth API] Segunda tentativa - Status:', response.status, response.statusText)
    }

    console.log('[CredSpot Auth API] Resposta - Status:', response.status, response.statusText)

    if (!response.ok) {
      let errorText = ''
      let errorData: any = null
      
      try {
        errorText = await response.text()
        console.error('[CredSpot Auth API] Erro na autenticação - Resposta (texto):', errorText)
        
        try {
          errorData = JSON.parse(errorText)
          console.error('[CredSpot Auth API] Erro na autenticação - Resposta (JSON):', JSON.stringify(errorData, null, 2))
        } catch (parseError) {
          console.error('[CredSpot Auth API] Não foi possível fazer parse JSON da resposta de erro')
        }
      } catch (readError) {
        console.error('[CredSpot Auth API] Erro ao ler resposta:', readError)
      }

      let errorMessage = errorData?.error_description || 
                        errorData?.error || 
                        errorData?.message ||
                        `Erro ao autenticar: ${response.status} ${response.statusText}`

      // Mensagem mais clara para erro de audience não habilitado
      if (errorMessage.includes('Service not enabled within domain') || 
          errorMessage.includes('service not enabled') ||
          errorMessage.toLowerCase().includes('domain')) {
        errorMessage = `O domínio/audience "${audience}" não está habilitado para este Client ID na CredSpot. ` +
                      `Verifique as configurações no painel da CredSpot e habilite o domínio necessário, ` +
                      `ou ajuste o campo "Audience" nas configurações da API. ` +
                      `Erro original: ${errorMessage}`
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          audienceUsed: audience, // Informa qual audience foi usado
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (!data.access_token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token de acesso não retornado na resposta',
        },
        { status: 500 }
      )
    }

    console.log('[CredSpot Auth API] ✅ Autenticação bem-sucedida')

    return NextResponse.json({
      success: true,
      data: {
        access_token: data.access_token,
        expires_in: data.expires_in || 3600,
        token_type: data.token_type || 'Bearer',
      },
    })
  } catch (error: any) {
    console.error('[CredSpot Auth API] Erro:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao processar autenticação',
      },
      { status: 500 }
    )
  }
}
