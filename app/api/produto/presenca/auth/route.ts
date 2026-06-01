import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * POST /api/produto/presenca/auth
 * 
 * Endpoint para autenticação da API Presença Bank
 * Executa no servidor para evitar problemas de CORS
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, ******, baseUrl } = body

    if (!username || !******) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Username e ****** são obrigatórios' 
        },
        { status: 400 }
      )
    }

    const url = baseUrl || process.env.REDACTED || 'https://presenca-bank-api.azurewebsites.net'
    const loginUrl = `${url.replace(/\/$/, '')}/login`

    console.log('[presenca/auth] Fazendo login na API:', loginUrl)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          login: username,
          ******: ******,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      console.log('[presenca/auth] Resposta do login - Status:', response.status, response.statusText)

      if (!response.ok) {
        let errorData: any
        let responseText = ''
        try {
          responseText = await response.text()
          console.error('[presenca/auth] Erro no login - Resposta completa (texto):', responseText)
          try {
            errorData = JSON.parse(responseText)
            console.error('[presenca/auth] Erro no login - Resposta parseada:', JSON.stringify(errorData, null, 2))
          } catch (parseError) {
            console.error('[presenca/auth] Não foi possível fazer parse JSON da resposta')
            errorData = { message: responseText || response.statusText }
          }
        } catch (error) {
          console.error('[presenca/auth] Erro ao ler resposta:', error)
          errorData = { message: response.statusText }
        }
        
        const errorMessage = errorData.error_description || 
                            errorData.error || 
                            errorData.message || 
                            `Erro ${response.status}: ${response.statusText}`
        
        return NextResponse.json(
          { 
            success: false,
            error: errorMessage,
            details: response.status === 401 ? 
              'Verifique se as credenciais (username, ******) estão corretas.' :
              undefined,
          },
          { status: response.status }
        )
      }

      const data = await response.json()
      console.log('[presenca/auth] Resposta do login (sem token):', { ...data, token: data.token ? '***' : undefined, accessToken: data.accessToken ? '***' : undefined })

      // A API pode retornar o token em diferentes campos
      const token = data.token || data.accessToken
      if (!token) {
        console.error('[presenca/auth] Token não encontrado na resposta:', data)
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
          token_type: 'Bearer',
          expires_in: data.expiresIn || 3600,
          expiration: data.expiration,
        },
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { 
            success: false,
            error: 'Timeout ao fazer login na API Presença Bank',
          },
          { status: 504 }
        )
      }
      throw fetchError
    }
  } catch (error: any) {
    console.error('[presenca/auth] Erro ao fazer login:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Erro ao fazer login na API Presença Bank',
      },
      { status: 500 }
    )
  }
}
