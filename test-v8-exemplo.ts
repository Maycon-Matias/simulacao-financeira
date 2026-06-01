/**
 * Teste de autenticação V8 Digital baseado no exemplo fornecido
 * 
 * Este script testa a autenticação usando o formato exato do exemplo:
 * - Usa audience como parâmetro obrigatório
 * - Formato application/x-www-form-urlencoded
 * - POST para https://auth.v8sistema.com/oauth/token
 */

import axios from "axios"
import qs from "qs"
import "dotenv/config"

const AUTH_URL = "https://auth.v8sistema.com/oauth/token"
const BFF_BASE = "https://bff.v8sistema.com"

type TokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
}

async function getAccessToken(): Promise<string> {
  const username = process.env.REDACTED || process.env.REDACTED || 'poracred61@gmail.com'
  const ****** = process.env.REDACTED || process.env.REDACTED || 'Ponta@2025'
  const client_id = process.env.REDACTED || process.env.REDACTED || 'DHWogdaYmEI8n5bwwxPDzulMISK7dwln'
  const audience = process.env.REDACTED || process.env.REDACTED || ''

  if (!username || !****** || !client_id) {
    throw new Error("Faltam variáveis: V8_USERNAME/V8_API_USERNAME, V8_PASSWORD/V8_API_PASSWORD, V8_CLIENT_ID/V8_API_CLIENT_ID")
  }

  if (!audience || audience.trim() === '') {
    throw new Error("Falta variável OBRIGATÓRIA: V8_AUDIENCE/V8_API_AUDIENCE. Este parâmetro é obrigatório para autenticação na API V8 Digital.")
  }

  const body = qs.stringify({
    grant_type: "******",
    username,
    ******,
    client_id,
    audience,
    scope: "offline_access",
  })

  console.log('📤 Enviando requisição de autenticação...')
  console.log('🔗 URL:', AUTH_URL)
  console.log('👤 Username:', username)
  console.log('🆔 Client ID:', client_id)
  console.log('🎯 Audience:', audience)
  console.log('📋 Body (sem ******):', body.replace(/******=[^&]*/, '******=***'))

  const { data } = await axios.post<TokenResponse>(AUTH_URL, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 30000,
  })

  return data.access_token
}

async function callBff(token: string) {
  // Exemplo de chamada ao BFF - ajustar endpoint conforme documentação
  const url = `${BFF_BASE}/private-consignment/operation`

  console.log('\n📤 Chamando BFF...')
  console.log('🔗 URL:', url)
  console.log('🔑 Token (primeiros 30 caracteres):', token.substring(0, 30) + '...')

  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30000,
  })

  return data
}

(async () => {
  try {
    console.log('='.repeat(60))
    console.log('🚀 Teste de Autenticação V8 Digital')
    console.log('='.repeat(60))
    
    const token = await getAccessToken()
    console.log('\n✅ TOKEN OK:', token.slice(0, 20), "...")
    console.log('✅ Token completo (primeiros 50 caracteres):', token.substring(0, 50) + '...')
    console.log('✅ Tamanho do token:', token.length, 'caracteres')

    // Tenta chamar o BFF (pode falhar se o endpoint não existir, mas o token está OK)
    try {
      const result = await callBff(token)
      console.log('\n✅ BFF OK:', JSON.stringify(result, null, 2))
    } catch (bffError: any) {
      console.log('\n⚠️ BFF chamada falhou (mas token está OK):')
      console.log('   Status:', bffError?.response?.status)
      console.log('   Mensagem:', bffError?.response?.data || bffError.message)
      console.log('   Isso é normal se o endpoint não existir ou precisar de parâmetros adicionais')
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ Autenticação bem-sucedida!')
    console.log('='.repeat(60))
  } catch (err: any) {
    const status = err?.response?.status
    const payload = err?.response?.data
    
    console.error('\n' + '='.repeat(60))
    console.error('❌ ERRO:', status ?? err.message)
    if (payload) {
      console.error('📦 Payload:', JSON.stringify(payload, null, 2))
    }
    if (err.response) {
      console.error('📊 Status:', err.response.status)
      console.error('📋 Headers:', err.response.headers)
    }
    console.error('='.repeat(60))
    
    process.exit(1)
  }
})()
