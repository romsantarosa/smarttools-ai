import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto('https://example.com');

  console.log('Página carregada com sucesso!');

  await page.waitForTimeout(3000);

  await browser.close();
}

main();