import { chromium } from 'playwright';

const portalUrl = 'https://portaldocliente.btp.com.br/sistemas/processos-logisticos/ConsultasLivres/listaatracacaoindex';
const listActionUrl = 'https://novo-tas.btp.com.br/ConsultasLivres/ListaAtracacao';
const iframeUrl = 'https://novo-tas.btp.com.br/ConsultasLivres/listaatracacaoindex?accessToken=undefined&authenticationType=undefined';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' });
  const page = await context.newPage();
  page.on('requestfailed', req => console.log('requestfailed', req.method(), req.url(), req.failure()?.errorText));
  page.on('response', async res => {
    if (res.url().includes('ListaAtracacao') || res.url().includes('listaatracacaoindex')) {
      console.log('RESPONSE', res.status(), res.url(), res.headers()['content-type']);
    }
  });
  try {
    console.log('Acessando portal...');
    await page.goto(portalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    console.log('title=', await page.title());
    console.log('iframe urls=', await page.$$eval('iframe', els => els.map(el => el.src)));
    const bodyText = await page.locator('body').innerText();
    console.log('body snippet=', bodyText.slice(0, 400));
    const token = await page.locator('input[name="__RequestVerificationToken"]').getAttribute('value').catch(() => null);
    const hiddenId = await page.locator('#hdnId').getAttribute('value').catch(() => null);
    console.log('token=', !!token, 'hiddenId=', !!hiddenId);
    
    const forms = await page.locator('form').count();
    console.log('forms=', forms);
    const allText = await page.locator('body').textContent();
    console.log('contains ListaAtracacao=', allText?.includes('ListaAtracacao'));

    const postData = new URLSearchParams({
      dias: '4',
      tpPesquisa: '0',
      dtInicial: '',
      dtFinal: '',
      id: hiddenId || '',
      __RequestVerificationToken: token || '',
    });
    const resp = await page.request.post(listActionUrl, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://portaldocliente.btp.com.br',
        'Referer': portalUrl,
      },
      data: postData.toString(),
      timeout: 60000,
    });
    const body = await resp.text();
    console.log('post status', resp.status());
    console.log('content-type', resp.headers()['content-type']);
    console.log('body start', body.slice(0, 2000));

    const iframePage = await context.newPage();
    console.log('Acessando iframe página...');
    await iframePage.goto(iframeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await iframePage.waitForTimeout(5000);
    const iframeBody = await iframePage.locator('body').innerText();
    console.log('iframe title=', await iframePage.title());
    console.log('iframe body snippet=', iframeBody.slice(0, 500));
    console.log('iframe scripts count=', await iframePage.locator('script').count());
    const scriptTexts = await iframePage.locator('script').allTextContents();
    console.log('scripts sample=', scriptTexts.slice(0, 3).join('\n---\n').slice(0, 2000));

  } catch (err) { console.error(err); }
  finally { await browser.close(); }
})();
