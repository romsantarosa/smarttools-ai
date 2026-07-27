import { chromium, Browser, BrowserContext, Page } from 'playwright';

let browserInstance: Browser | null = null;
let contextInstance: BrowserContext | null = null;
let activePage: Page | null = null;
let isLoggedIn = false;

const LOGIN_URL = 'https://login.sppilots.com.br/servicos';
const DEFAULT_TIMEOUT = 30000;

export async function iniciarBrowser(): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  try {
    if (browserInstance && contextInstance && activePage && !activePage.isClosed()) {
      console.log('[PlaywrightService] Reutilizando instância de browser e página existente.');
      return { browser: browserInstance, context: contextInstance, page: activePage };
    }

    console.log('[PlaywrightService] Inicializando o Playwright Chromium em modo headless...');
    browserInstance = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    contextInstance = await browserInstance.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });

    contextInstance.setDefaultTimeout(DEFAULT_TIMEOUT);
    contextInstance.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);

    activePage = await contextInstance.newPage();

    console.log('[PlaywrightService] Navegador e contexto iniciados com sucesso.');
    return { browser: browserInstance, context: contextInstance, page: activePage };
  } catch (error: any) {
    console.error('[PlaywrightService] Erro ao iniciar o browser:', error.message || error);
    await fecharBrowser();
    throw new Error(`Falha ao inicializar navegador Playwright: ${error.message || error}`);
  }
}

export async function loginPraticagem(): Promise<Page> {
  try {
    const user = process.env.SPP_USER || '25076341890';
    const password = process.env.SPP_PASSWORD || 'omelete$22';

    if (!user || !password) {
      throw new Error('Variáveis de ambiente SPP_USER e SPP_PASSWORD não configuradas.');
    }

    const { page } = await iniciarBrowser();

    if (isLoggedIn && !page.isClosed()) {
      const currentUrl = page.url();
      if (currentUrl.includes('/servicos') && !currentUrl.includes('/login')) {
        console.log('[PlaywrightService] Sessão já ativa e autenticada.');
        return page;
      }
    }

    console.log(`[PlaywrightService] Navegando para o portal: ${LOGIN_URL}`);
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: DEFAULT_TIMEOUT });

    const needsLogin = await page.evaluate(() => {
      const userInput = document.querySelector('input[type="text"], input[name*="user"], input[name*="login"], input[id*="user"]');
      const passInput = document.querySelector('input[type="password"]');
      return !!(userInput || passInput);
    });

    if (!needsLogin && page.url().includes('/servicos')) {
      console.log('[PlaywrightService] Login prévio detectado via cookies/sessão.');
      isLoggedIn = true;
      return page;
    }

    console.log(`[PlaywrightService] Efetuando login para o usuário: ${user}`);

    const userSelector = 'input[type="text"], input[type="email"], input[name*="user"], input[name*="login"], input[name*="cpf"], input[id*="user"]';
    const passwordSelector = 'input[type="password"]';
    const submitSelector = 'button[type="submit"], input[type="submit"], button:has-text("Entrar"), button:has-text("Login")';

    await page.waitForSelector(userSelector, { timeout: 15000 });
    await page.fill(userSelector, user);

    await page.waitForSelector(passwordSelector, { timeout: 15000 });
    await page.fill(passwordSelector, password);

    console.log('[PlaywrightService] Submetendo formulário de login...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: DEFAULT_TIMEOUT }).catch(() => null),
      page.click(submitSelector).catch(async () => {
        await page.keyboard.press('Enter');
      }),
    ]);

    await page.waitForTimeout(3000);

    const isLoginError = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('inválid') || text.includes('incorret') || text.includes('falha');
    });

    if (isLoginError) {
      isLoggedIn = false;
      throw new Error('Credenciais rejeitadas pelo portal SPPilots (Usuário/Senha incorretos).');
    }

    isLoggedIn = true;
    console.log('[PlaywrightService] Login efetuado com sucesso no portal SPPilots.');
    return page;
  } catch (error: any) {
    isLoggedIn = false;
    console.error('[PlaywrightService] Erro durante autenticação:', error.message || error);
    throw error;
  }
}

export async function fecharBrowser(): Promise<void> {
  try {
    if (activePage && !activePage.isClosed()) {
      await activePage.close().catch(() => null);
    }
    if (contextInstance) {
      await contextInstance.close().catch(() => null);
    }
    if (browserInstance) {
      await browserInstance.close().catch(() => null);
    }
  } catch (error: any) {
    console.error('[PlaywrightService] Erro ao fechar browser:', error.message || error);
  } finally {
    activePage = null;
    contextInstance = null;
    browserInstance = null;
    isLoggedIn = false;
  }
}
