import { scrapePortal } from "./scrapers/sppilots";
import dotenv from "dotenv";

dotenv.config();

export interface BtpShipJson {
  imo: string;
  navio: string;
  movimento: string;
  berco: string;
  horario: string;
  data?: string;
  status: string;

  mv?: string;
  loc1?: string;
  loc2?: string;
  agencia?: string;
  pratico?: string;
}

export interface CacheStore {

  atracados: BtpShipJson[];

  previstas: BtpShipJson[];

  andamento: BtpShipJson[];

  confirmadas: BtpShipJson[];

  encerradas: BtpShipJson[];

  fundeados: BtpShipJson[];

  movimentos: BtpShipJson[];

  lastUpdate: number;

  isMockData: boolean;

}

const CACHE_TTL_MS = 5 * 60 * 1000;

let cacheStore: CacheStore = {

  atracados: [],

  previstas: [],

  andamento: [],

  confirmadas: [],

  encerradas: [],

  fundeados: [],

  movimentos: [],

  lastUpdate: 0,

  isMockData: true

};

const ALLOWED_BTP_BERTHS = [

  "BTP-1",

  "BTP-2",

  "BTP-3",

  "BTP 1",

  "BTP 2",

  "BTP 3"

];

function isBtpBerth(berth?: string): boolean {

  if (!berth) return false;

  const upper = berth.toUpperCase().trim();

  return ALLOWED_BTP_BERTHS.some(b =>

    upper.includes(b.replace(" ", "-")) ||

    upper.includes(b)

  );

}



function mapShip(item: any): BtpShipJson {

  return {

    imo: item.imo,

    navio: item.navio,

    movimento: item.movimento,

    berco: item.loc1 || item.loc2 || "",

    horario: item.passagem,

    data: item.pob,

    status: item.status || "",

    loc1: item.loc1,

    loc2: item.loc2,

    agencia: item.agencia

  };

}
export async function getBtpData(
  forceRefresh = false
): Promise<CacheStore> {

  const now = Date.now();

  if (
    !forceRefresh &&
    cacheStore.lastUpdate > 0 &&
    now - cacheStore.lastUpdate < CACHE_TTL_MS
  ) {
    return cacheStore;
  }

  const user = process.env.SPP_USER || "";
  const pass = process.env.SPP_PASSWORD || "";

  if (user && pass) {

    console.log(
      "[BTP SMARTTOOLS API] Authenticating with SPPilots portal..."
    );

  }

  try {

    const portalData = await scrapePortal();

    console.log("========== PORTAL ==========");
    console.log(portalData);
    console.log("============================");

    const atracados = portalData.atracados
  .filter(item => {
    const loc = (item.loc1 || "").toUpperCase().trim();
    return loc === "BTP-1" || loc === "BTP-2" || loc === "BTP-3";
  })
  .map(mapShip);

    const previstas = portalData.previstas
  .filter(item => {
    const destino = (item.loc2 || "").toUpperCase().trim();

    return (
      destino === "BTP-1" ||
      destino === "BTP-2" ||
      destino === "BTP-3"
    );
  })
  .map(mapShip);


  const saidas = portalData.previstas
  .filter(item => {
    const origem = (item.loc1 || "").toUpperCase().trim();

    return (
      origem === "BTP-1" ||
      origem === "BTP-2" ||
      origem === "BTP-3"
    );
  })
  .map(mapShip);

    const andamento =
      portalData.andamento.map(mapShip);

    const confirmadas =
      portalData.confirmadas.map(mapShip);

    const encerradas =
      portalData.encerradas.map(mapShip);

    const fundeados =
      portalData.fundeados.map(mapShip);

    const movimentos = [

      ...previstas,

      ...andamento,

      ...confirmadas,

      ...saidas,

      ...encerradas

    ];

    cacheStore = {

      atracados,

      previstas,

      andamento,

      confirmadas,

      encerradas,

      fundeados,

      movimentos,

      lastUpdate: Date.now(),

      isMockData: false

    };

    console.log("====================================");

    console.log(
      "Atracados:",
      atracados.length
    );

    console.log(
      "Previstas:",
      previstas.length
    );

    console.log(
      "Andamento:",
      andamento.length
    );

    console.log(
      "Confirmadas:",
      confirmadas.length
    );

    console.log(
      "Encerradas:",
      encerradas.length
    );

    console.log(
      "Fundeados:",
      fundeados.length
    );

    console.log(
      "Movimentos:",
      movimentos.length
    );

    console.log("====================================");

    return cacheStore;

  } catch (err) {

    console.error(
      "[BTP SMARTTOOLS API] Erro:",
      err
    );

    console.log(
      "[BTP SMARTTOOLS API] Usando dados simulados."
    );

    cacheStore = generateBtpData();

    return cacheStore;

  }

}
function generateBtpData(): CacheStore {

  return {

    atracados: [],

    previstas: [],

    andamento: [],

    confirmadas: [],

    encerradas: [],

    fundeados: [],

    movimentos: [],

    lastUpdate: Date.now(),

    isMockData: true

  };

}

export function setCustomBtpData(
  data: Partial<CacheStore>
): CacheStore {

  cacheStore = {

    atracados: data.atracados ?? cacheStore.atracados,

    previstas: data.previstas ?? cacheStore.previstas,

    andamento: data.andamento ?? cacheStore.andamento,

    confirmadas: data.confirmadas ?? cacheStore.confirmadas,

    encerradas: data.encerradas ?? cacheStore.encerradas,

    fundeados: data.fundeados ?? cacheStore.fundeados,

    movimentos: data.movimentos ?? cacheStore.movimentos,

    lastUpdate: Date.now(),

    isMockData: false

  };

  return cacheStore;

}

export function parseSppilotsRawText(
  rawText: string
): Partial<CacheStore> {

  const linhas = rawText
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  const navios: BtpShipJson[] = [];

  for (const linha of linhas) {

    if (!linha)
      continue;

    const partes = linha
      .split(/\t| {2,}/)
      .map(p => p.trim())
      .filter(Boolean);

    if (partes.length < 2)
      continue;

    navios.push({

      imo: partes[0] || "",

      navio: partes[1] || "",

      movimento: "",

      berco: "",

      horario: "",

      data: "",

      status: "",

      loc1: "",

      loc2: "",

      agencia: ""

    });

  }

  return {

    atracados: navios,

    previstas: [],

    andamento: [],

    confirmadas: [],

    encerradas: [],

    fundeados: [],

    movimentos: navios

  };

}

export function getCacheTimeRemainingSeconds(): number {

  if (!cacheStore.lastUpdate)
    return 0;

  const elapsed = Date.now() - cacheStore.lastUpdate;

  return Math.max(
    0,
    Math.floor((CACHE_TTL_MS - elapsed) / 1000)
  );

}