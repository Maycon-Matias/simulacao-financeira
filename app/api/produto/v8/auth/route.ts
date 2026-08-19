import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * POST /api/produto/v8/auth
 * 
 * Endpoint para autenticação OAuth da API V8 Digital
 * Executa no servidor para evitar problemas de CORS
 * 
 * IMPORTANTE: O endpoint https://auth.v8sistema.com/oauth/token
 * APENAS aceita requisições HTTP POST (não aceita GET)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, clientId, authUrl, clientSecret, audience, scope } = body

    if (!username || !password || !clientId || !authUrl) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Username, password, clientId e authUrl são obrigatórios' 
        },
        { status: 400 }
      )
    }

    // OAuth 2.0 password Grant
    // IMPORTANTE: audience é OBRIGATÓRIO para a API V8 Digital
    if (!audience) {
      return NextResponse.json(
        { 
          success: false,
          error: 'O parâmetro audience é obrigatório para autenticação na API V8 Digital' 
        },
        { status: 400 }
      )
    }

    const formData = new URLSearchParams()
    formData.append('grant_type', 'password')
    formData.append('username', username)
    formData.append('password', password)
    formData.append('client_id', clientId)
    formData.append('audience', audience) // OBRIGATÓRIO
    
    // Parâmetros opcionais
    if (clientSecret) {
      formData.append('client_secret', clientSecret)
    }
    if (scope) {
      formData.append('scope', scope)
    } else {
      // Scope padrão conforme documentação V8 Digital
      formData.append('scope', 'offline_access')
    }

    const bodyString = formData.toString()
    
    console.log('[v8/auth] Fazendo login OAuth na API:', authUrl)

    // Tenta primeiro com o formato padrão
    let response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: bodyString,
    })

    // Se retornar 401, tenta com Basic Auth no header (algumas APIs OAuth usam isso)
    if (response.status === 401) {
      console.log('[v8/auth] 401 recebido, tentando com Basic Auth no header')
      // Usa Buffer do Node.js (disponível no servidor Next.js)
      const basicAuth = typeof Buffer !== 'undefined' 
        ? Buffer.from(`${clientId}:`).toString('base64')
        : btoa(`${clientId}:`)
      
      const formDataBasic = new URLSearchParams()
      formDataBasic.append('grant_type', 'password')
      formDataBasic.append('username', username)
      formDataBasic.append('password', password)
      formDataBasic.append('audience', audience) // OBRIGATÓRIO
      
      // Adiciona parâmetros opcionais
      if (scope) {
        formDataBasic.append('scope', scope)
      } else {
        formDataBasic.append('scope', 'offline_access')
      }
      // Não inclui client_id no body quando usa Basic Auth (vai no header)
      
      response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Authorization': `Basic ${basicAuth}`,
        },
        body: formDataBasic.toString(),
      })
    }

    console.log('[v8/auth] Resposta do login - Status:', response.status, response.statusText)

    if (!response.ok) {
      let errorData: any
      let responseText = ''
      try {
        responseText = await response.text()
        console.error('[v8/auth] Erro no login - Resposta completa (texto):', responseText)
        console.error('[v8/auth] Tamanho da resposta:', responseText.length)
        try {
          errorData = JSON.parse(responseText)
          console.error('[v8/auth] Erro no login - Resposta parseada:', JSON.stringify(errorData, null, 2))
        } catch (parseError) {
          console.error('[v8/auth] Não foi possível fazer parse JSON da resposta')
          errorData = { message: responseText || response.statusText }
        }
      } catch (error) {
        console.error('[v8/auth] Erro ao ler resposta:', error)
        errorData = { message: response.statusText }
      }
      
      console.error('[v8/auth] Erro no login V8 Digital - Status:', response.status)
      console.error('[v8/auth] Erro no login V8 Digital - Dados:', errorData)
      
      // Retorna mensagem de erro mais detalhada
      const errorMessage = errorData.error_description || 
                          errorData.error || 
                          errorData.message || 
                          `Erro ${response.status}: ${response.statusText}`
      
      return NextResponse.json(
        { 
          success: false,
          error: errorMessage,
          details: response.status === 401 ? 
            'Verifique se as credenciais (username, password, client_id) estão corretas. A API V8 Digital pode requerer client_secret adicional ou usar um formato de autenticação diferente.' :
            undefined,
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[v8/auth] Resposta do login (sem token):', { ...data, access_token: data.access_token ? '***' : undefined })

    // OAuth retorna access_token
    const token = data.access_token || data.token || data.accessToken
    if (!token) {
      console.error('[v8/auth] Token não encontrado na resposta:', data)
      return NextResponse.json(
        { 
          success: false,
          error: 'Token de acesso não encontrado na resposta da API',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        access_token: token,
        token_type: data.token_type || 'Bearer',
        expires_in: data.expires_in || 3600,
      },
    })
  } catch (error: any) {
    console.error('[v8/auth] Erro ao fazer login:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Erro ao fazer login na API V8 Digital',
      },
      { status: 500 }
    )
  }
}
