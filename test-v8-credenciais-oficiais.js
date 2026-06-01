/**
 * Teste de autenticação V8 Digital com credenciais oficiais
 * Conforme instruções fornecidas pela V8 Digital
 */

const AUTH_URL = 'https://auth.v8sistema.com/oauth/token'

// Credenciais oficiais fornecidas pela V8 Digital
const credentials = {
  username: 'poracred61@hotmail.com',
  ******: 'F1Dfm!wmzDv*',
  clientId: 'DHWogdaYmEI8n5bwwxPDzulMlSK7dwIn',
  audience: 'https://bff.v8sistema.com',
  scope: 'offline_access', // Scope padrão - verificar documentação se necessário
}

async function testarAutenticacao() {
  console.log('='.repeat(70))
  console.log('🚀 Teste de Autenticação V8 Digital - Credenciais Oficiais')
  console.log('='.repeat(70))
  console.log('🔗 Endpoint:', AUTH_URL)
  console.log('👤 Username:', credentials.username)
  console.log('🆔 Client ID:', credentials.clientId)
  console.log('🎯 Audience:', credentials.audience)
  console.log('📋 Scope:', credentials.scope)
  console.log('')

  try {
    // Cria o body no formato application/x-www-form-urlencoded
    const formData = new URLSearchParams()
    formData.append('grant_type', '******')
    formData.append('username', credentials.username)
    formData.append('******', credentials.******)
    formData.append('client_id', credentials.clientId)
    formData.append('audience', credentials.audience)
    formData.append('scope', credentials.scope)

    const body = formData.toString()
    console.log('📋 Body (sem ******):', body.replace(/******=[^&]*/, '******=***'))
    console.log('')

    console.log('📤 Enviando requisição POST...')
    const startTime = Date.now()
    
    const response = await fetch(AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body,
    })

    const endTime = Date.now()
    const responseTime = endTime - startTime

    const responseText = await response.text()
    let responseData

    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { raw: responseText }
    }

    console.log('⏱️  Tempo de resposta:', responseTime, 'ms')
    console.log('📥 Status:', response.status, response.statusText)
    console.log('📦 Resposta:', JSON.stringify(responseData, null, 2))
    console.log('')

    if (response.ok && responseData.access_token) {
      console.log('='.repeat(70))
      console.log('✅ SUCESSO! Autenticação realizada com sucesso!')
      console.log('='.repeat(70))
      console.log('🔑 Token Type:', responseData.token_type || 'Bearer')
      console.log('🔑 Access Token (primeiros 50 caracteres):', responseData.access_token.substring(0, 50) + '...')
      console.log('🔑 Access Token completo:', responseData.access_token)
      console.log('⏰ Expires In:', responseData.expires_in || 'N/A', 'segundos')
      if (responseData.refresh_token) {
        console.log('🔄 Refresh Token:', responseData.refresh_token.substring(0, 30) + '...')
      }
      if (responseData.scope) {
        console.log('📋 Scope retornado:', responseData.scope)
      }
      console.log('')
      console.log('✅ Sistema pronto para usar a API V8 Digital!')
      return { success: true, token: responseData.access_token, data: responseData }
    } else {
      console.log('='.repeat(70))
      console.log('❌ FALHOU - Erro na autenticação')
      console.log('='.repeat(70))
      console.log('Erro:', responseData.error || 'Desconhecido')
      if (responseData.error_description) {
        console.log('Descrição:', responseData.error_description)
      }
      if (responseData.error_uri) {
        console.log('URI de erro:', responseData.error_uri)
      }
      console.log('')
      console.log('💡 Verifique:')
      console.log('   - Se as credenciais estão corretas')
      console.log('   - Se o client_id está autorizado')
      console.log('   - Se o scope está correto (verificar documentação)')
      console.log('   - Se a conta está ativa')
      return { success: false, status: response.status, data: responseData }
    }
  } catch (error) {
    console.error('='.repeat(70))
    console.error('❌ ERRO:', error.message)
    console.error('='.repeat(70))
    if (error.stack) {
      console.error('Stack:', error.stack)
    }
    return { success: false, error: error.message }
  }
}

// Executa o teste
testarAutenticacao()
  .then(result => {
    console.log('')
    if (result.success) {
      console.log('✅ Teste concluído com sucesso!')
      console.log('📝 Próximos passos:')
      console.log('   1. As credenciais foram atualizadas no código')
      console.log('   2. O sistema está pronto para usar a API V8 Digital')
      console.log('   3. Teste consulta CLT e criação de termo de consentimento')
      process.exit(0)
    } else {
      console.log('❌ Teste falhou')
      console.log('📝 Verifique as credenciais e a documentação em docs.v8sistema.com')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('\n❌ Erro inesperado:', error)
    process.exit(1)
  })
