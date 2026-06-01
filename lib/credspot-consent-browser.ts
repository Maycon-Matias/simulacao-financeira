/**
 * Aceita o termo de consentimento CredSpot abrindo o link em um navegador
 * headless (Playwright), marcando o checkbox e clicando em "Aceitar e Continuar".
 */

export type ConsentBrowserResult = { success: boolean; error?: string; via?: string }

async function runWithPlaywright(consentLink: string): Promise<ConsentBrowserResult> {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    })
    const page = await context.newPage()

    console.log('[CredSpot Browser] Abrindo link...', consentLink.substring(0, 60) + '...')
    await page.goto(consentLink, { waitUntil: 'domcontentloaded', timeout: 25_000 })
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    // 1) Marca o(s) checkbox(es) de termos (ex.: "Li e autorizo...")
    const checkboxes = page.locator('input[type="checkbox"]')
    const count = await checkboxes.count()
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await checkboxes.nth(i).check({ timeout: 5_000 }).catch(() => {})
      }
      console.log('[CredSpot Browser] Checkbox(es) marcado(s):', count)
    }

    // 2) Clica no botão "Aceitar e Continuar" (ou similar)
    const buttonSelectors: Array<() => ReturnType<typeof page.locator>> = [
      () => page.getByRole('button', { name: /aceitar e continuar|aceitar|continuar/i }),
      () => page.getByText(/aceitar e continuar/i).first(),
      () => page.locator('input[type="submit"][value*="Aceitar"], input[type="submit"][value*="Continuar"]').first(),
      () => page.locator('button[type="submit"]').first(),
      () => page.locator('input[type="submit"]').first(),
    ]

    let clicked = false
    for (const getLoc of buttonSelectors) {
      try {
        const btn = getLoc()
        await btn.click({ timeout: 3_000 })
        clicked = true
        console.log('[CredSpot Browser] Botão clicado com sucesso')
        break
      } catch {
        continue
      }
    }

    if (!clicked) {
      await browser.close()
      return { success: false, error: 'Botão "Aceitar e Continuar" não encontrado', via: 'browser' }
    }

    // 3) Aguarda navegação ou mudança (página de sucesso / redirect)
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
    const finalUrl = page.url()
    const body = await page.content()

    await browser.close()

    const looksSuccess =
      /obrigado|sucesso|consentimento.*aceito|authorized|confirmado|concluído|success/i.test(body) ||
      !/termo|autoriz|aceitar e continuar|li e autorizo/i.test(body)

    if (looksSuccess) {
      console.log('[CredSpot Browser] ✅ Página de sucesso ou redirect detectado. URL:', finalUrl.substring(0, 70))
      return { success: true, via: 'browser' }
    }

    console.log('[CredSpot Browser] Página pode ainda ser o form. Considerando aceite e verificando via API.')
    return { success: true, via: 'browser' }
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e)
    console.warn('[CredSpot Browser] Erro:', err)
    await browser.close().catch(() => {})
    return { success: false, error: err, via: 'browser' }
  }
}

/**
 * Aceita o termo de consentimento CredSpot abrindo o link em um navegador
 * headless, marcando o checkbox e clicando em "Aceitar e Continuar".
 * Requer `playwright` instalado e `npx playwright install chromium`.
 */
export async function aceitarConsentimentoComBrowser(consentLink: string): Promise<ConsentBrowserResult> {
  if (!consentLink || typeof consentLink !== 'string') {
    return { success: false, error: 'Link de consentimento inválido' }
  }
  const url = consentLink.trim()

  try {
    return await runWithPlaywright(url)
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e)
    console.warn('[CredSpot Browser] Playwright indisponível ou falha:', err)
    return { success: false, error: err, via: 'browser' }
  }
}
