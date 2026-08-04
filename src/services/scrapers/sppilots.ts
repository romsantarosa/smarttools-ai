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
console.log("SCRAPER INICIOU");
  const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox"
  ]
});
console.log("CHROMIUM ABRIU");

  try {

    const page = await browser.newPage();

    console.log("PAGINA CRIADA");

    await login(page);
    
    console.log("LOGIN OK");

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
    // MANOBRAS PREVISTAS (schedule sem status ao vivo)
    // ============================

    const tabelaPrevistas = page.locator("#manobras table");

    await tabelaPrevistas.waitFor();

    const previstasRows = tabelaPrevistas.locator("tbody tr");

    const previstas: MovimentoPortal[] = [];

    const totalPrevistas = await previstasRows.count();

    console.log(`Manobras previstas encontradas: ${totalPrevistas}`);

    for (let i = 0; i < totalPrevistas; i++) {

      const row = previstasRows.nth(i);

      const cols = (
        await row.locator("td").allTextContents()
      ).map(c => c.trim());

      if (cols.length < 2) continue;

      previstas.push({

        imo: cols[0] || "",
        navio: cols[1] || "",
        movimento: (cols[2] || "").toUpperCase(),
        loc1: (cols[3] || "").toUpperCase(),
        loc2: (cols[4] || "").toUpperCase(),
        agencia: cols[5] || "",
        passagem: "",
        pob: "",
        calado: "",
        style: ""

      });

    }

    // ============================
    // MOVIMENTOS DE NAVIOS (tabela com status ao vivo, colorida)
    // ============================
    // Esta é a ÚNICA tabela do portal que traz o status colorido em tempo real
    // (manobra em andamento / confirmada pela praticagem / encerrada). A antiga
    // tabela "#manobras" (Manobras Previstas) nunca tem cor, por isso a
    // classificação por cor não podia ser feita ali.

    const tabelaMovimentos = page.locator("#movimentos table");

    await tabelaMovimentos.waitFor();

    const movimentosRows = tabelaMovimentos.locator("tbody tr");

    const andamento: MovimentoPortal[] = [];
    const confirmadas: MovimentoPortal[] = [];
    const encerradas: MovimentoPortal[] = [];

    const totalMovimentos = await movimentosRows.count();

    console.log(`Movimentos encontrados: ${totalMovimentos}`);

    for (let i = 0; i < totalMovimentos; i++) {

      const row = movimentosRows.nth(i);

      const cols = (
        await row.locator("td").allTextContents()
      ).map(c => c.trim());

      if (cols.length < 8) continue;

      const item: MovimentoPortal = {

        imo: cols[0] || "",
        navio: cols[1] || "",
        movimento: (cols[2] || "").toUpperCase(),
        loc1: (cols[3] || "").toUpperCase(),
        loc2: (cols[4] || "").toUpperCase(),
        pob: cols[5] || "",
        passagem: cols[6] || "",
        calado: cols[7] || "",
        agencia: cols[8] || "",
        style: (await row.getAttribute("style")) || ""

      };

      // Apenas operações da BTP

      if (
        !item.loc1.includes("BTP") &&
        !item.loc2.includes("BTP")
      ) {
        continue;
      }

      const style = item.style.toLowerCase().replace(/\s+/g, "");

      // ========================
      // CLASSIFICAÇÃO POR COR (confirmada via inspeção do portal real)
      // ========================
      // #00bfff (ciano)  -> Manobra em Andamento
      // #b7b7ff (lilás)  -> Manobra confirmada pela Praticagem
      // #ff4a4a (vermelho) -> Manobra Encerrada

      if (style.includes("#00bfff")) {

        andamento.push(item);

        continue;

      }

      if (style.includes("#b7b7ff")) {

        confirmadas.push(item);

        continue;

      }

      if (style.includes("#ff4a4a")) {

        encerradas.push(item);

        continue;

      }

    }

    // ============================
    // FUNDEADOS (navios na barra aguardando prático/berço)
    // ============================
    // A tabela "#fundeados" só traz IMO, navio e data/hora de fundeio - sem
    // berço. Por isso cruzamos pelo IMO com as manobras previstas para saber
    // se o destino é a BTP.

    const destinoBtpPorImo = new Map<string, string>();
    for (const item of previstas) {
      if (item.loc1.includes("BTP")) {
        destinoBtpPorImo.set(item.imo, item.loc1);
      } else if (item.loc2.includes("BTP")) {
        destinoBtpPorImo.set(item.imo, item.loc2);
      }
    }

    const tabelaFundeados = page.locator("#fundeados table");

    await tabelaFundeados.waitFor();

    const fundeadosRows = tabelaFundeados.locator("tbody tr");

    const fundeados: MovimentoPortal[] = [];

    const totalFundeados = await fundeadosRows.count();

    console.log(`Fundeados encontrados: ${totalFundeados}`);

    for (let i = 0; i < totalFundeados; i++) {

      const row = fundeadosRows.nth(i);

      const cols = (
        await row.locator("td").allTextContents()
      ).map(c => c.trim());

      if (cols.length < 3) continue;

      const imo = cols[0] || "";
      const bercoDestino = destinoBtpPorImo.get(imo);

      if (!bercoDestino) continue;

      fundeados.push({

        imo,
        navio: cols[1] || "",
        movimento: "",
        loc1: bercoDestino,
        loc2: "",
        pob: cols[2] || "",
        passagem: "",
        calado: "",
        agencia: "",
        style: ""

      });

    }

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