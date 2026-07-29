import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
});
const page = await context.newPage();

try {
  console.log('Acessando página principal...');
  await page.goto('https://portaldocliente.btp.com.br/sistemas/processos-logisticos/ConsultasLivres/listaatracacaoindex', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(6000);

  const iframe = page.frameLocator('iframe');
  console.log('frames', page.frames().map(f => f.url()));
  const bodyText = await page.locator('body').innerText();
  console.log('BODY_TEXT', bodyText.slice(0, 4000));

  const token = await page.locator('input[name="__RequestVerificationToken"]').getAttribute('value').catch(() => null);
  const hiddenId = await page.locator('#hdnId').getAttribute('value').catch(() => null);
  console.log('TOKEN', !!token, 'HIDDEN_ID', !!hiddenId);

  const url = 'https://novo-tas.btp.com.br/ConsultasLivres/ListaAtracacao';
  const params = new URLSearchParams({
    dias: '4',
    tpPesquisa: '0',
    dtInicial: '',
    dtFinal: '',
    id: hiddenId || '',
    __RequestVerificationToken: token || ''
  });

  const response = await page.request.post(url, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest'
    },
    data: params.toString(),
    timeout: 60000
  });

  console.log('STATUS', response.status());
  console.log('CONTENT_TYPE', response.headers()['content-type']);
  const body = await response.text();
  console.log('BODY_START', body.slice(0, 4000));
} catch (error) {
  console.error(error);
} finally {
  await browser.close();
}
