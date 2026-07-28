import { chromium, Page } from "playwright";
import dotenv from "dotenv";

dotenv.config();

export interface MovimentoPortal {
  imo: string;
  navio: string;
  movimento: string;
  loc1: string;
  loc2: string;
  pob: string;
  passagem: string;
  calado: string;
  agencia: string;
  style: string;
}

export interface PortalData {
  atracados: MovimentoPortal[];
  previstas: MovimentoPortal[];
  andamento: MovimentoPortal[];
  confirmadas: MovimentoPortal[];
  encerradas: MovimentoPortal[];
  fundeados: MovimentoPortal[];
}

async function login(page: Page) {
  console.log("Autenticando na Praticagem...");

  await page.goto("https://login.sppilots.com.br/servicos", {
    waitUntil: "networkidle",
  });

  await page.fill(
    'input[name="usuario"]',
    process.env.SPP_USER || ""
  );

  await page.fill(
    'input[name="senha"]',
    process.env.SPP_PASSWORD || ""
  );

  await page
    .locator('button[type="submit"], input[type="submit"]')
    .first()
    .click();

  await page.waitForSelector("#movimentos", {
    timeout: 30000,
  });

  console.log("✅ Login realizado");
}

async function lerTabela(
  page: Page,
  selector: string
): Promise<MovimentoPortal[]> {

  const tabela = page.locator(selector);

  if (await tabela.count() === 0) {
    return [];
  }

  const rows = tabela.locator("tbody tr");

  const total = await rows.count();

  console.log(`${selector} -> ${total} registros`);

  const lista: MovimentoPortal[] = [];

  for (let i = 0; i < total; i++) {

  const row = rows.nth(i);

  const cols = (
    await row.locator("td").allTextContents()
  ).map(t => t.trim());

  // Tabela de atracados
  if (selector.includes("#atracados")) {

    if (cols.length < 3)
      continue;

    lista.push({

      imo: cols[0],
      navio: cols[1],

      // O berço vem na terceira coluna
      loc1: cols[2].toUpperCase(),

      loc2: "",
      movimento: "",
      pob: "",
      passagem: "",
      calado: "",
      agencia: "",
      style: ""

    });


    continue
  }

  

  // Tabela de manobras
  if (cols.length < 8)
    continue;

  lista.push({

    imo: cols[0],
    navio: cols[1],
    movimento: (cols[2] || "").toUpperCase(),
    loc1: (cols[3] || "").toUpperCase(),
    loc2: (cols[4] || "").toUpperCase(),
    pob: cols[5] || "",
    passagem: cols[6] || "",
    calado: cols[7] || "",
    agencia: cols[8] || "",
    style: (await row.getAttribute("style")) || ""

  });

}
return lista;
}

function somenteBTP(lista: MovimentoPortal[]) {

  console.log("TOTAL LIDOS:", lista.length);

  lista.forEach(item => {
    console.log(
      item.navio,
      "| LOC1 =", item.loc1,
      "| LOC2 =", item.loc2
    );
  });

  return lista;

}

export async function scrapePortal(): Promise<PortalData> {

  const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox"
  ]
});

  try {

    const page = await browser.newPage();

    await login(page);

    // ============================
    // NAVIOS ATRACADOS
    // ============================

    const atracados = somenteBTP(
      await lerTabela(
        page,
        "#atracados table"
      )
    );

    // ============================
    // MANOBRAS
    // ============================

    const tabela = page.locator("#manobras table");

    await tabela.waitFor();

    const rows = tabela.locator("tbody tr");

    const andamento: MovimentoPortal[] = [];
    const confirmadas: MovimentoPortal[] = [];
    const encerradas: MovimentoPortal[] = [];
    const previstas: MovimentoPortal[] = [];

    const total = await rows.count();

    console.log(`Manobras encontradas: ${total}`);

    for (let i = 0; i < total; i++) {

      const row = rows.nth(i);

const cols = (
  await row.locator("td").allTextContents()
).map(c => c.trim());


      const item: MovimentoPortal = {

  imo: cols[0] || "",
  navio: cols[1] || "",
  movimento: (cols[2] || "").toUpperCase(),
  loc1: (cols[3] || "").toUpperCase(),
  loc2: (cols[4] || "").toUpperCase(),

  agencia: cols[5] || "",
  passagem: cols[6] || "",
  pob: "",
  calado: "",
  style: (await row.getAttribute("style")) || ""

};

console.log(item);

console.log("====================");
console.log("COLUNAS:", cols);
console.log("LOC1:", item.loc1);
console.log("LOC2:", item.loc2);
console.log("====================");
      // Apenas operações da BTP

      if (
        !item.loc1.includes("BTP") &&
        !item.loc2.includes("BTP")
      ) {
        continue;
      }

      const style = item.style.toLowerCase();

      console.log(
        item.navio,
        style
      );

      // ========================
      // CLASSIFICAÇÃO POR COR
      // ========================

      if (style.includes("#ff4a4a")) {

        andamento.push(item);

        continue;

      }

      if (style.includes("#b7b7ff")) {

        confirmadas.push(item);

        continue;

      }

      if (style.includes("#8fd19e")) {

        encerradas.push(item);

        continue;

      }

      // Sem cor = prevista

      previstas.push(item);

    }

    // ============================
    // FUNDEADOS
    // ============================

    const fundeados = [...previstas].filter(item =>
      item.loc1.includes("FUNDEADO") ||
      item.loc1.includes("FUNDEADOURO") ||
      item.loc1.includes("BARRA")
    );

    console.log("===============================");
    console.log("ATRACADOS :", atracados.length);
    console.log("PREVISTAS :", previstas.length);
    console.log("ANDAMENTO :", andamento.length);
    console.log("CONFIRMADAS:", confirmadas.length);
    console.log("ENCERRADAS :", encerradas.length);
    console.log("FUNDEADOS :", fundeados.length);
    console.log("===============================");

    return {

      atracados,
      previstas,
      andamento,
      confirmadas,
      encerradas,
      fundeados

    };

  } catch (err) {

    console.error(err);

    throw err;

  } finally {

    await browser.close();

  }

}