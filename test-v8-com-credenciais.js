/**
 * Teste de autenticação V8 Digital com as credenciais fornecidas
 */

const AUTH_URL = 'https://auth.v8sistema.com/oauth/token'

// Credenciais fornecidas
const credentials = {
  username: 'poracred61@gmail.com',
  ******: 'Ponta@2025',
  clientId: 'DHWdgAymE8n5bwwxPDzulMlSK7dwln',
  audience: 'https://bff.v8sistema.com',
}

async function testarAutenticacao() {
  console.log('='.repeat(60))
  console.log('🚀 Teste de Autenticação V8 Digital')
  console.log('='.repeat(60))
  console.log('🔗 Endpoint:', AUTH_URL)
  console.log('👤 Username:', credentials.username)
  console.log('🆔 Client ID:', credentials.clientId)
  console.log('🎯 Audience:', credentials.audience)
  console.log('')

  try {
    // Cria o body no formato application/x-www-form-urlencoded
    const formData = new URLSearchParams()
    formData.append('grant_type', '******')
    formData.append('username', credentials.username)
    formData.append('******', credentials.******)
    formData.append('client_id', credentials.clientId)
    formData.append('audience', credentials.audience)
    formData.append('scope', 'offline_access')

    const body = formData.toString()
    console.log('📋 Body (sem ******):', body.replace(/******=[^&]*/, '******=***'))
    console.log('')

    console.log('📤 Enviando requisição...')
    const response = await fetch(AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body,
    })

    const responseText = await response.text()
    let responseData

    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { raw: responseText }
    }

    console.log('📥 Status:', response.status, response.statusText)
    console.log('📦 Resposta:', JSON.stringify(responseData, null, 2))
    console.log('')

    if (response.ok && responseData.access_token) {
      console.log('='.repeat(60))
      console.log('✅ SUCESSO! Token obtido!')
      console.log('='.repeat(60))
      console.log('🔑 Token (primeiros 50 caracteres):', responseData.access_token.substring(0, 50) + '...')
      console.log('🔑 Token completo:', responseData.access_token)
      console.log('📊 Token Type:', responseData.token_type || 'Bearer')
      console.log('⏰ Expires In:', responseData.expires_in || 'N/A', 'segundos')
      if (responseData.refresh_token) {
        console.log('🔄 Refresh Token:', responseData.refresh_token.substring(0, 30) + '...')
      }
      console.log('')
      console.log('✅ Autenticação funcionando corretamente!')
      return { success: true, token: responseData.access_token, data: responseData }
    } else {
      console.log('='.repeat(60))
      console.log('❌ FALHOU')
      console.log('='.repeat(60))
      console.log('Erro:', responseData.error || responseData.error_description || 'Desconhecido')
      if (responseData.error_description) {
        console.log('Descrição:', responseData.error_description)
      }
      return { success: false, status: response.status, data: responseData }
    }
  } catch (error) {
    console.error('='.repeat(60))
    console.error('❌ ERRO:', error.message)
    console.error('='.repeat(60))
    return { success: false, error: error.message }
  }
}

// Executa o teste
testarAutenticacao()
  .then(result => {
    if (result.success) {
      console.log('\n✅ Teste concluído com sucesso!')
      process.exit(0)
    } else {
      console.log('\n❌ Teste falhou')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('\n❌ Erro inesperado:', error)
    process.exit(1)
  })
