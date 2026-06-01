import { chromium, Browser, Page } from 'playwright'

/**
 * Serviço de automação para aceitar termo de autorização C6 Bank automaticamente
 * Usa Playwright para automatizar o processo de aceite do termo
 */

interface AutomacaoResultado {
  success: boolean
  error?: string
  message?: string
}

export class C6BankAutomation {
  private browser: Browser | null = null
  private readonly timeout = 60000 // 60 segundos

  /**
   * Aceita o termo de autorização automaticamente acessando o link
   */
  async aceitarTermoAutomaticamente(linkAutorizacao: string): Promise<AutomacaoResultado> {
    let page: Page | null = null

    try {
      console.log('[C6BankAutomation] Iniciando automação para aceitar termo...')
      console.log('[C6BankAutomation] Link:', linkAutorizacao)

      // Inicia o navegador
      this.browser = await chromium.launch({
        headless: true, // Executa em modo headless (sem interface gráfica)
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })

      // Cria uma nova página
      page = await this.browser.newPage()

      // Configura timeout
      page.setDefaultTimeout(this.timeout)

      // Navega para o link de autorização
      console.log('[C6BankAutomation] Navegando para o link...')
      await page.goto(linkAutorizacao, { waitUntil: 'networkidle' })

      // Aguarda um pouco para a página carregar completamente
      await page.waitForTimeout(2000)

      // Tenta encontrar e clicar no botão de aceitar/concordar
      // Vários seletores possíveis para botões de aceite
      const seletoresAceitar = [
        'button:has-text("Aceitar")',
        'button:has-text("Concordar")',
        'button:has-text("Autorizar")',
        'button:has-text("Confirmar")',
        'button[type="submit"]',
        'input[type="submit"]',
        'button.btn-primary',
        'button.btn-success',
        '.btn-accept',
        '[data-testid="accept-button"]',
        '[data-testid="authorize-button"]',
        'a:has-text("Aceitar")',
        'a:has-text("Concordar")',
        'a:has-text("Autorizar")'
      ]

      let aceito = false
      for (const seletor of seletoresAceitar) {
        try {
          const elemento = await page.locator(seletor).first()
          if (await elemento.isVisible({ timeout: 3000 })) {
            console.log(`[C6BankAutomation] Botão encontrado com seletor: ${seletor}`)
            await elemento.click()
            aceito = true
            break
          }
        } catch (e) {
          // Continua tentando outros seletores
          continue
        }
      }

      if (!aceito) {
        // Tenta encontrar qualquer checkbox de aceite
        const checkboxes = await page.locator('input[type="checkbox"]').all()
        for (const checkbox of checkboxes) {
          try {
            if (await checkbox.isVisible({ timeout: 2000 })) {
              await checkbox.check()
              console.log('[C6BankAutomation] Checkbox marcado')
              
              // Depois de marcar checkbox, procura botão de submit
              await page.waitForTimeout(1000)
              for (const seletor of seletoresAceitar) {
                try {
                  const elemento = await page.locator(seletor).first()
                  if (await elemento.isVisible({ timeout: 2000 })) {
                    await elemento.click()
                    aceito = true
                    break
                  }
                } catch (e) {
                  continue
                }
              }
              break
            }
          } catch (e) {
            continue
          }
        }
      }

      if (!aceito) {
        // Tenta encontrar elementos por texto que contenham palavras-chave
        const textosAceitar = ['aceitar', 'concordar', 'autorizar', 'confirmar', 'prosseguir']
        for (const texto of textosAceitar) {
          try {
            const elemento = await page.locator(`text=/${texto}/i`).first()
            if (await elemento.isVisible({ timeout: 2000 })) {
              await elemento.click()
              aceito = true
              console.log(`[C6BankAutomation] Elemento encontrado por texto: ${texto}`)
              break
            }
          } catch (e) {
            continue
          }
        }
      }

      if (!aceito) {
        // Tenta capturar screenshot para debug
        const screenshot = await page.screenshot({ fullPage: true })
        console.log('[C6BankAutomation] Não foi possível encontrar botão de aceite. Screenshot capturado.')
        
        return {
          success: false,
          error: 'Não foi possível encontrar o botão de aceite automaticamente. O link pode precisar de interação manual.',
          message: 'Tente acessar o link manualmente ou verifique se o formato da página mudou.'
        }
      }

      // Aguarda um pouco após clicar
      await page.waitForTimeout(3000)

      // Verifica se houve redirecionamento ou mensagem de sucesso
      const urlAtual = page.url()
      const pageContent = await page.content()

      // Verifica se há mensagens de sucesso na página
      const mensagensSucesso = [
        'autorizado',
        'sucesso',
        'confirmado',
        'aceito',
        'concluído'
      ]

      let sucessoDetectado = false
      for (const msg of mensagensSucesso) {
        if (pageContent.toLowerCase().includes(msg)) {
          sucessoDetectado = true
          break
        }
      }

      // Se a URL mudou, pode ser que foi redirecionado para página de sucesso
      if (urlAtual !== linkAutorizacao || sucessoDetectado) {
        console.log('[C6BankAutomation] Autorização parece ter sido concluída')
        return {
          success: true,
          message: 'Termo aceito automaticamente com sucesso.'
        }
      }

      // Aguarda mais um pouco e verifica novamente
      await page.waitForTimeout(5000)
      const urlFinal = page.url()
      const contentFinal = await page.content()

      if (urlFinal !== linkAutorizacao || contentFinal.toLowerCase().includes('sucesso') || contentFinal.toLowerCase().includes('autorizado')) {
        return {
          success: true,
          message: 'Termo aceito automaticamente com sucesso.'
        }
      }

      return {
        success: true,
        message: 'Ação de aceite executada. Verifique o status da autorização.'
      }

    } catch (error: any) {
      console.error('[C6BankAutomation] Erro ao aceitar termo automaticamente:', error)
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao tentar aceitar termo automaticamente.'
      }
    } finally {
      // Fecha a página e o navegador
      try {
        if (page) {
          await page.close()
        }
        if (this.browser) {
          await this.browser.close()
          this.browser = null
        }
      } catch (error) {
        console.error('[C6BankAutomation] Erro ao fechar navegador:', error)
      }
    }
  }

  /**
   * Limpa recursos (fecha navegador se ainda estiver aberto)
   */
  async cleanup(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close()
        this.browser = null
      }
    } catch (error) {
      console.error('[C6BankAutomation] Erro ao fazer cleanup:', error)
    }
  }
}
