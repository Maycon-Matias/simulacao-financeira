import { NextRequest, NextResponse } from 'next/server'
import { extractCredSpotInlineFromBody, resolveCredSpotClient, CREDSPOT_CLIENT_RESOLVE_ERROR } from '@/lib/credspot-resolve-client'
import { aceitarConsentimentoComBrowser } from '@/lib/credspot-consent-browser'
import { birthToIsoDate, normalizeCpfDigits, normalizePhoneDigits } from '@/lib/credspot-entidade-normalize'

/**
 * POST /api/produto/credspot/clt/consent
 * 
 * Gera link de consentimento para consulta CLT na CredSpot
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiId, document, name, mail, phone, birth, skipSms, gender } = body

    if (!apiId) {
      return NextResponse.json(
        {
          success: false,
          error: 'apiId é obrigatório',
        },
        { status: 400 }
      )
    }

    if (!document || !name || !mail || !phone || !birth) {
      return NextResponse.json(
        {
          success: false,
          error: 'document, name, mail, phone e birth são obrigatórios',
        },
        { status: 400 }
      )
    }

    const documentDigits = normalizeCpfDigits(document)
    if (documentDigits.length !== 11) {
      return NextResponse.json(
        {
          success: false,
          error: 'CPF deve ter 11 dígitos (apenas números).',
        },
        { status: 400 }
      )
    }

    const birthIso = birthToIsoDate(birth)
    if (!birthIso) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Data de nascimento inválida. Use YYYY-MM-DD (campo de data) ou DD/MM/AAAA (ex.: 25/02/1985).',
        },
        { status: 400 }
      )
    }

    const phoneDigits = normalizePhoneDigits(phone)
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      return NextResponse.json(
        {
          success: false,
          error: 'Telefone deve ter 10 ou 11 dígitos (DDD + número, apenas números).',
        },
        { status: 400 }
      )
    }

    const inline = extractCredSpotInlineFromBody(body as Record<string, unknown>)
    const credspotClient = resolveCredSpotClient(apiId, inline)

    if (!credspotClient) {
      return NextResponse.json(
        {
          success: false,
          error: CREDSPOT_CLIENT_RESOLVE_ERROR,
        },
        { status: 400 }
      )
    }

    // Primeiro, cria ou verifica se o usuário existe
    // Para CredSpot, precisamos criar o usuário primeiro
    console.log('[CredSpot CLT Consent] Criando usuário com dados:', {
      document: documentDigits,
      name,
      mail,
      phone: phoneDigits,
      birth: birthIso,
    })

    const userPayload: Record<string, unknown> = {
        document: documentDigits,
        name,
        mail,
        phone: phoneDigits,
        birth: birthIso,
    }
    if (gender === 'M' || gender === 'F') {
      userPayload.gender = gender
    }

    const userResponse = await credspotClient.authenticatedRequest('/entidade', {
      method: 'POST',
      body: JSON.stringify(userPayload),
    })

    console.log('[CredSpot CLT Consent] Resposta da criação de usuário:', {
      success: userResponse.success,
      hasData: !!userResponse.data,
      error: userResponse.error,
      dataKeys: userResponse.data ? Object.keys(userResponse.data) : [],
    })

    let userUuid: string | null = null

    const raw: any = userResponse.data
    if (raw?.data?.uuid) {
      userUuid = raw.data.uuid
    } else if (raw?.uuid) {
      userUuid = raw.uuid
    }

    if (userUuid) {
      if (userResponse.success) {
        console.log('[CredSpot CLT Consent] Usuário criado com sucesso. UUID:', userUuid)
      } else {
        console.log('[CredSpot CLT Consent] UUID do usuário obtido da resposta:', userUuid)
      }
    }

    if (!userResponse.success) {
      // Se não tem UUID e não foi sucesso, verifica o tipo de erro
      const errorCode = userResponse.error?.code || (typeof userResponse.error === 'object' ? userResponse.error?.code : null)
      const errorMessage = userResponse.error?.message || (typeof userResponse.error === 'string' ? userResponse.error : '')
      const errorDataStr = userResponse.data 
        ? JSON.stringify(userResponse.data).toLowerCase()
        : ''
      
      console.log('[CredSpot CLT Consent] Verificando tipo de erro:', {
        errorCode,
        errorMessage,
        errorDataStr: errorDataStr.substring(0, 200),
      })
      
      // Verifica se o erro indica que o usuário já existe
      const isUserExistsError = 
        errorCode === 'user_already_exists' ||
        errorMessage.toLowerCase().includes('já existe') ||
        errorMessage.toLowerCase().includes('already exists') ||
        errorDataStr.includes('user_already_exists') ||
        errorDataStr.includes('já existe') ||
        errorDataStr.includes('already exists')
      
      if (isUserExistsError) {
        // Se o usuário já existe mas não temos UUID, continua sem UUID (será gerado no consentimento)
        console.log('[CredSpot CLT Consent] Usuário já existe, mas UUID não encontrado na resposta. Continuando...')
      } else {
        console.error('[CredSpot CLT Consent] Erro ao criar usuário:', {
          error: userResponse.error,
          data: userResponse.data,
        })
        return NextResponse.json(
          {
            success: false,
            error: typeof userResponse.error === 'string' 
              ? userResponse.error 
              : errorMessage || 'Erro ao criar usuário',
            details: userResponse.data,
          },
          { status: 500 }
        )
      }
    }

    // OpenAPI: POST /clt/consent exige `userUuid` (e opcionalmente `skipSms`)
    if (!userUuid) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Não foi possível obter o UUID do usuário após POST /entidade. A CredSpot exige userUuid para gerar o consentimento.',
          details: userResponse.data,
        },
        { status: 400 }
      )
    }

    const consentBody: { userUuid: string; skipSms?: boolean } = { userUuid }
    if (skipSms === true) consentBody.skipSms = true

    console.log('[CredSpot CLT Consent] Gerando link de consentimento com body:', consentBody)

    const consentResponse = await credspotClient.authenticatedRequest('/clt/consent', {
      method: 'POST',
      body: JSON.stringify(consentBody),
    })

    console.log('[CredSpot CLT Consent] Resposta da geração de consentimento:', {
      success: consentResponse.success,
      hasData: !!consentResponse.data,
      error: consentResponse.error,
      dataKeys: consentResponse.data ? Object.keys(consentResponse.data) : [],
    })

    if (!consentResponse.success) {
      console.error('[CredSpot CLT Consent] Erro ao gerar link de consentimento:', {
        error: consentResponse.error,
        data: consentResponse.data,
      })
      return NextResponse.json(
        {
          success: false,
          error: consentResponse.error || 'Erro ao gerar link de consentimento',
          details: consentResponse.data,
        },
        { status: 500 }
      )
    }

    const consentData = consentResponse.data?.data || consentResponse.data
    console.log('[CredSpot CLT Consent] Consentimento gerado com sucesso:', {
      hasRelationshipInquiryUuid: !!consentData?.relationshipInquiryUuid,
      hasConsentLink: !!consentData?.consentLink,
      accepted: consentData?.accepted,
      keys: consentData ? Object.keys(consentData) : [],
    })

    const relationshipInquiryUuid = consentData.relationshipInquiryUuid || consentData.uuid

    let aceitoAutomaticamente = !!consentData?.accepted

    // Sempre tenta aceitar automaticamente após gerar o consentimento
    if (relationshipInquiryUuid) {
      console.log('[CredSpot CLT Consent] Tentando aceitar consentimento automaticamente...')
      
      try {
        let acceptResponse = await credspotClient.aceitarConsentimentoCLT(relationshipInquiryUuid)
        
        if (acceptResponse.success) {
          console.log('[CredSpot CLT Consent] ✅ Consentimento aceito via API')
          aceitoAutomaticamente = true
          const acceptData = acceptResponse.data?.data || acceptResponse.data
          if (acceptData) Object.assign(consentData, acceptData)
        } else {
          const link = consentData.consentLink || consentData.link || consentData.url
          if (link) {
            // 1) Tenta abrir o link no navegador headless (Playwright), marcar checkbox e clicar em Aceitar
            console.log('[CredSpot CLT Consent] Tentando aceitar via navegador headless (abre link, marca termo, clica Aceitar)...')
            const browserResult = await aceitarConsentimentoComBrowser(link)
            if (browserResult.success) {
              console.log('[CredSpot CLT Consent] ✅ Navegador concluiu aceite. Verificando status...')
              await new Promise(r => setTimeout(r, 2000))
              const statusResp = await credspotClient.verificarStatusConsentimentoCLT(relationshipInquiryUuid)
              const statusData = statusResp.data?.data || statusResp.data
              if (statusData?.hasConsent === true || (statusData?.status && /accepted|completed|consented/i.test(String(statusData.status)))) {
                aceitoAutomaticamente = true
                console.log('[CredSpot CLT Consent] ✅ Consentimento confirmado como aceito após verificação')
              }
            }

            // 2) Se o browser não conseguiu ou não confirmou, tenta via fetch (POST no form)
            if (!aceitoAutomaticamente) {
              console.log('[CredSpot CLT Consent] Tentando aceitar via fetch no form...')
              acceptResponse = await credspotClient.aceitarConsentimentoViaLink(link)
              if (acceptResponse.success) {
                console.log('[CredSpot CLT Consent] ✅ POST no form realizado. Verificando status...')
                await new Promise(r => setTimeout(r, 1500))
                const statusResp = await credspotClient.verificarStatusConsentimentoCLT(relationshipInquiryUuid)
                const statusData = statusResp.data?.data || statusResp.data
                if (statusData?.hasConsent === true || (statusData?.status && /accepted|completed|consented/i.test(String(statusData.status)))) {
                  aceitoAutomaticamente = true
                  console.log('[CredSpot CLT Consent] ✅ Consentimento confirmado como aceito após verificação')
                }
              }
            }
          }
        }
      } catch (error: any) {
        console.warn('[CredSpot CLT Consent] Erro ao aceitar automaticamente:', error.message)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...consentData,
        relationshipInquiryUuid: relationshipInquiryUuid,
        consentLink: consentData.consentLink || consentData.link || consentData.url,
        userUuid: userUuid || consentData.userUuid,
        accepted: aceitoAutomaticamente,
      },
    })
  } catch (error: any) {
    console.error('[CredSpot CLT Consent API] Erro capturado:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      error: error,
    })
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao processar consentimento',
        details: process.env.REDACTED === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
