import { chromium } from "playwright";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
  });

  const page = await browser.newPage();

  await page.goto("https://login.sppilots.com.br/servicos", {
    waitUntil: "networkidle",
  });

  console.log("Preenchendo login...");

  await page.fill('input[name="usuario"]', process.env.SPP_USER!);
  await page.fill('input[name="senha"]', process.env.SPP_PASSWORD!);

  await page.locator('button[type="submit"], input[type="submit"]').first().click();

  await page.waitForSelector("#movimentos", {
    timeout: 30000,
  });

  console.log("✅ Login realizado!");

  // Aguarda a tabela carregar
  await page.waitForSelector("table.table");

  const rows = page.locator("table.table tbody tr");
  const total = await rows.count();

  console.log(`Encontradas ${total} linhas\n`);

  for (let i = 0; i < total; i++) {
    const cols = await rows.nth(i).locator("td").allTextContents();

    if (cols.length === 0) continue;

    const loc1 = cols[3]?.trim();
const loc2 = cols[4]?.trim();

if (
    loc1.includes("BTP") ||
    loc2.includes("BTP")
) {
    console.log("🚢 BTP:", cols);
}
  }

  await page.waitForTimeout(5000);

  await browser.close();
}

main().catch(console.error);