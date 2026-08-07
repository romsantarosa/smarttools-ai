# Bercos fixos e "proximo navio" na tela Atracacao/Saida

Data: 2026-08-07

## Contexto

A pagina `src/pages/AtracacaoSaida.tsx` hoje lista os navios atracados como
uma grade dinamica: um card por navio com status `Atracado`, quantidade
variavel (0 a N cards, dependendo de quantos navios o Portal BTP reportar
como atracados naquele momento).

O terminal tem exatamente 3 bercos fixos (BTP 1, BTP 2, BTP 3 - regra de
negocio ja documentada em `CLAUDE.md`). A tela nao comunica isso hoje: se
houver, por exemplo, so 1 navio atracado, a grade mostra 1 card so, sem
deixar claro que os outros 2 bercos estao livres.

## Objetivo

1. Tornar a secao de navios atracados sempre fixa em 3 cards, um por berco
   (BTP 1 / BTP 2 / BTP 3), na ordem. Berco sem navio atracado mostra um
   card de estado "Livre" em vez de simplesmente nao aparecer.
2. Adicionar uma nova secao abaixo, "Proximo Navio", tambem com 3 cards
   fixos (um por berco), mostrando o proximo navio ja designado para
   aquele berco especifico (com base no campo `pontoAtracacao`/`berco` do
   registro do Portal BTP), mesmo que o berco esteja ocupado no momento.
   Berco sem nenhum proximo navio conhecido mostra um card de estado
   "Nenhum navio previsto".

## Fora de escopo

- Nao altera o scraping (`btpScheduleService.ts`) nem os campos retornados
  pelo Portal BTP - usa exclusivamente dados ja disponiveis hoje
  (`etb`, `pontoAtracacao`/`berco`, status).
- Nao mexe na pagina `ProgramacaoBtp.tsx` nem no card de Dashboard -
  mudanca restrita a `AtracacaoSaida.tsx` e ao novo helper compartilhado.
- Nao adiciona fallback de ETA quando ETB estiver ausente (decisao
  explicita, ver "Decisoes e trade-offs").

## Design

### 1. Camada de dados - `getBerthSlots()` em `btpPortalData.ts`

Novo helper exportado, ao lado dos demais helpers de status
(`getPortalStatusLabel`, `getDisplayBerco`, etc.) ja existentes nesse
arquivo:

```ts
const BTP_BERTHS = ['BTP 1', 'BTP 2', 'BTP 3'] as const;

export interface BerthSlot {
  berco: string; // 'BTP 1' | 'BTP 2' | 'BTP 3'
  atracado: BtpScheduleRecord | null;   // navio atracado agora nesse berco, ou null
  proximo: BtpScheduleRecord | null;    // proximo navio designado, ou null
}

export function getBerthSlots(records: BtpScheduleRecord[]): BerthSlot[] {
  return BTP_BERTHS.map((berco) => {
    const forThisBerth = records.filter((r) => getDisplayBerco(r) === berco);

    const atracado = forThisBerth.find((r) => getPortalStatusLabel(r) === 'Atracado') || null;

    const proximo = forThisBerth
      .filter((r) => {
        const status = getPortalStatusLabel(r);
        return (status === 'Previsto' || status === 'Na Barra') && Boolean(parsePortalDateTime(r.etb));
      })
      .sort((a, b) => parsePortalDateTime(a.etb)!.getTime() - parsePortalDateTime(b.etb)!.getTime())[0] || null;

    return { berco, atracado, proximo };
  });
}
```

Reaproveita `getDisplayBerco`, `getPortalStatusLabel` e `parsePortalDateTime`
- ja existentes e ja usados pela propria `AtracacaoSaida.tsx` hoje. Nenhuma
regra nova de classificacao de status e criada.

Coloca o helper em `btpPortalData.ts` (e nao inline na pagina) porque essa
regra de negocio ("sempre 3 bercos fixos") e a mesma ja documentada em
`CLAUDE.md` como critica - fica junto das demais funcoes que ja encapsulam
regras de status/berco, disponibilizando reuso futuro (ex.: Dashboard) sem
custo extra hoje.

### 2. Layout da pagina - `AtracacaoSaida.tsx`

A grade unica atual (`atracados.map(...)`) e substituida por duas grades
fixas, ambas derivadas de `getBerthSlots(records)`:

**Linha 1 - "Navios Atracados"** (substitui a grade atual)
- Sempre 3 cards, um por berco, na ordem BTP 1 / BTP 2 / BTP 3.
- `slot.atracado` preenchido: mesmo card de hoje (navio, armador, berco,
  viagem, atracacao, inicio operacao, saida prevista, badge "ATRACADO").
- `slot.atracado` nulo: card de estado "Livre" - visual distinto (cor
  neutra/esmaecida, icone de ancora, texto "Berco livre"), sem os campos de
  data que nao fazem sentido nesse estado.

**Linha 2 - "Proximo Navio"** (nova secao, abaixo da linha 1)
- Sempre 3 cards, um por berco, mesma ordem.
- `slot.proximo` preenchido: navio, armador, badge de status
  (Previsto/Na Barra) e ETB formatado.
- `slot.proximo` nulo: card de estado "Nenhum navio previsto".

Layout de grade passa de `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`
(dinamico) para `grid-cols-1 md:grid-cols-3` fixo em ambas as linhas, ja
que a quantidade agora e sempre 3.

Os cards de estatistica no topo ("Navios atracados: X", "Bercos ocupados:
Y") continuam funcionando, agora computados a partir de
`slots.filter(s => s.atracado).length` em vez do array `atracados` antigo.

### 3. Estados de erro/vazio

- Loading/erro de nivel de pagina (falha ao buscar `/api/btp-schedule`)
  continua exatamente como hoje - bloqueia as duas linhas igualmente, sem
  tratamento de erro por linha.
- "Livre" e "Nenhum navio previsto" NAO sao erros - sao estados validos e
  esperados, com estilo neutro/esmaecido, nunca com estilo de aviso/erro.

### 4. Testes

Nao ha suite de testes automatizados cobrindo essa pagina hoje (confirmado
- sem arquivos `.test.`/`.spec.` para `AtracacaoSaida` ou `btpPortalData`).
Verificacao sera manual: rodar o dev server, confirmar que as duas linhas
sempre renderizam 3 slots, que um berco sem navio atracado mostra "Livre" e
que um berco sem ETB de proximo navio mostra "Nenhum navio previsto".

## Decisoes e trade-offs

- **ETB sem fallback para ETA**: um navio "Previsto"/"Na Barra" so aparece
  no card de "proximo navio" se tiver ETB preenchido. Decisao explicita do
  usuario. Risco conhecido: se, na pratica, muitos registros do Portal BTP
  tiverem so ETA preenchido (sem ETB) nessa fase, o berco vai aparecer como
  "Nenhum navio previsto" com mais frequencia do que o esperado. Se isso
  acontecer em producao, vale revisitar essa regra.
- **"Proximo navio" independe do berco estar ocupado**: mesmo com um navio
  atracado no BTP 2 agora, o card de "proximo" do BTP 2 mostra o proximo
  navio ja designado pra la, se houver - util para planejamento, nao
  so para bercos livres.
- Se dois registros aparecerem simultaneamente como `Atracado` no mesmo
  berco (inconsistencia de dados do portal), `getBerthSlots` pega o
  primeiro encontrado - comportamento pre-existente do bug de dados, nao
  algo que este recurso precisa resolver.
- Navio Previsto/Na Barra sem berco identificavel (`getDisplayBerco`
  retorna `'-'`) fica de fora de todos os 3 slots de "proximo navio" -
  nao ha onde encaixa-lo com seguranca sem arriscar mostrar informacao
  errada. Comportamento intencional, nao um bug a corrigir depois.
