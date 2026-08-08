# BTP SmartTools AI — Contexto do Projeto

Este arquivo é lido automaticamente pelo Claude Code no início de cada sessão
neste projeto. Resume decisões, padrões e problemas conhecidos que já foram
trabalhados em sessões anteriores, para não precisar redescobrir tudo do zero.

## O que é este projeto

Software de operações portuárias para a BTP (Brasil Terminal Portuário), no
Porto de Santos. Stack: React + Vite + TypeScript no front-end, Node.js +
Express no back-end, Firebase/Firestore para dados e autenticação, Google
Gemini API para OCR/visão computacional, Playwright para scraping de portais
externos, deploy no Railway (conectado ao GitHub, branch `main`,
`romsantarosa/smarttools-ai`, deploy automático a cada push).

Três subsistemas principais:
1. **Split Analyzer** — lê PDFs de plano de estiva (Split) e extrai dados
   operacionais (descarga/embarque, contêineres por bay, deck/hold).
2. **Atracação/Programação BTP** — mostra navios atracados nos 3 berços do
   terminal (BTP 1/2/3), via scraping do portal da BTP + portal de Praticagem
   (SPPilots).
3. **Autenticação/perfis** — Firebase Auth com dois papéis: `Supervisor` e
   `Operador`.

## Regra de negócio importante

**O terminal tem exatamente 3 berços (BTP 1, BTP 2, BTP 3).** Qualquer tela
que mostre "navios atracados" nunca deve mostrar mais que 3 ao mesmo tempo —
se mostrar mais, é sinal de bug na classificação de status (ver seção
"Atracação" abaixo).

## Split Analyzer — arquitetura e padrões aprendidos na marra

### Arquivos principais
- `pdfService.ts` — extração de texto nativo do PDF, decide quando disparar
  OCR (não basta olhar tamanho de texto — títulos longos com corpo em imagem
  passavam no critério antigo; hoje considera densidade de grupos numéricos).
  `extractFirstPageForBayProfile()` renderiza **só a página 1** (nunca o PDF
  inteiro) e devolve, junto da imagem, os itens de texto nativo já
  convertidos para o mesmo espaço de coordenadas em pixels da imagem
  renderizada — é o que permite ao `splitBayReaderService.ts` achar
  DS-DECK/LD-DECK/DS-HOLD/LD-HOLD por posição (x/y) sem gastar chamada de IA.
- `geminiService.ts` — todas as chamadas à API do Gemini. Ver padrões abaixo.
  Funções específicas do fluxo novo: `detectShipProfileBoundingBox`
  (localização aproximada da região do perfil do navio, só usada quando
  faltam âncoras de texto nativo), `extractBaySplitReadings` (lê os números
  célula a célula de DS-DECK/LD-DECK/DS-HOLD/LD-HOLD) e `extractBayTotalRow`
  (lê a linha de totais oficiais quando ela não existe como texto nativo).
  Seguem os mesmos padrões de retry/temperature/schema descritos abaixo.
- `splitBayReaderService.ts` — pipeline **novo e determinístico** para ler o
  perfil longitudinal do navio (DS-DECK/LD-DECK/DS-HOLD/LD-HOLD). Prefere
  âncoras de texto nativo (`detectRegionFromTextAnchors`, zero custo de IA,
  100% determinístico); só usa visão computacional quando o texto nativo não
  existe. A IA nunca soma nem calcula nada — só lê números célula por célula;
  toda associação número→bay e soma é feita em código.
- `splitIntelligenceService.ts` — pipeline **legado**. Deixou de ser o fluxo
  padrão da tela: hoje só fica visível atrás do botão "Modo Legado (análise
  multi-página / IA — somente inspeção)" em `PlanejamentoSplit.tsx`, com o
  cache antigo em `localStorage` (`btp_split_by_berth_v1`) preservado só para
  esse modo de inspeção. **Ainda não foi removido/consolidado de verdade** —
  o código dos dois pipelines continua coexistindo (ver Pendências).
- `splitPersistenceService.ts` — persistência do fluxo **novo**. Cada SPLIT
  confirmado vira um registro independente em `localStorage`
  (`btp_split_records_v1`) — nunca sobrescreve outro berço/registro. Cada
  registro guarda o hash SHA-256 (`computeFileSha256`, Web Crypto) do arquivo
  PDF original (não do texto extraído), usado por `findRecordByFileHash` para
  detectar reimportação do mesmo arquivo.
- `PlanejamentoSplit.tsx` — página principal. O fluxo padrão agora é o
  "Novo SPLIT" (via `splitBayReaderService.ts` + `splitPersistenceService.ts`):
  analisa só a página 1 → usuário revisa/edita a tabela de bays (total
  oficial e DS-DECK/LD-DECK/DS-HOLD/LD-HOLD ficam editáveis, com destaque
  visual para campos não confirmados automaticamente ou com
  `compositionMismatch`) → "CONFIRMAR ANÁLISE" trava os campos → escolhe o
  berço (BTP 1/2/3) → "SALVAR SPLIT" grava o registro. O painel
  "Painel Operacional - Berços" no topo mostra sempre o registro mais
  recente de cada um dos 3 berços; a seção "SPLITS SALVOS" abaixo lista o
  histórico completo, filtrável por berço. Ao reimportar um PDF já
  analisado antes (mesmo hash), a tela oferece "ABRIR ANÁLISE SALVA" (reusa
  o resultado gravado, sem gastar chamada de IA) ou "ANALISAR NOVAMENTE"
  (força nova leitura). O modo legado antigo (cache `btp_split_by_berth_v1`)
  fica escondido atrás do toggle "Modo Legado", só para inspeção.

### Padrões de chamada à API Gemini (aprendidos por tentativa e erro extensivo)

- **Modelo:** `gemini-3.6-flash` (constante `GEMINI_MODEL` no topo de
  `geminiService.ts`). Já trocamos de `gemini-2.0-flash` uma vez por
  descontinuação — centralizar o nome do modelo evita ter que caçar em vários
  lugares de novo.
- **`temperature`:** nunca usar `0` exato em schemas com muitos campos
  numéricos — causa loop de repetição degenerada (ex.: a IA escreve
  `1517151715171517...` em vez de `1517` e para). Usar `0.1`–`0.2`.
- **`maxOutputTokens`:** dar folga generosa. O modelo suporta até 65.536
  tokens de saída, e "thinking tokens" (raciocínio interno) consomem do MESMO
  orçamento — schemas com muitos itens (ex.: leitura de ~30 bays × 4 áreas)
  podem estourar mesmo com 8192. Preferir valores como 16384–32768 para
  chamadas com resposta grande.
- **`responseSchema`:** usar schema JSON estrito em vez de só descrever o
  formato no texto do prompt — reduz (não elimina) erros de sintaxe.
- **Ler TODOS os `parts` da resposta**, não só `parts[0]` — a resposta pode
  vir dividida em mais de um part; ler só o primeiro corta a resposta.
- **Checar `finishReason`** — se vier diferente de `'STOP'`, tratar como
  falha (geração interrompida, ex. `MAX_TOKENS`), não tentar parsear.
- **Reparo de JSON malformado como rede de segurança**: tentar `JSON.parse`
  direto; se falhar, tentar extrair o maior bloco `{...}`, remover cercas de
  markdown (` ```json `) e vírgulas penduradas antes de desistir.
- **Retry automático (3 tentativas, backoff 1.5s × tentativa)**: chamadas do
  Gemini falham de forma intermitente (503 de sobrecarga, JSON truncado,
  resposta vazia) e a MESMA imagem costuma funcionar na tentativa seguinte
  sem nenhuma mudança de código. Padrão usado em todo o arquivo: função
  `xyzOnce()` privada com a lógica real + função pública `xyz()` que tenta até
  3x. Ao adicionar uma nova chamada de IA, sempre seguir esse padrão — já
  aconteceu de uma função ficar sem retry por descuido e isso ser a causa de
  bugs "aleatórios" difíceis de reproduzir.
- **Trava de sanidade em números**: rejeitar valores absurdamente grandes
  (ex. ≥ 1.000.000 ou ≥ 500 dependendo do contexto) como proteção extra
  contra o loop de repetição, mesmo com o fix de temperature aplicado.
- **Tarefas de localização aproximada (ex. achar a região do perfil do navio
  na página) devem usar imagem em resolução REDUZIDA**, não a imagem em alta
  resolução usada para leitura fina de números — imagem grande demais nessa
  etapa mais atrapalha (mais lenta, sem ganho de precisão) do que ajuda.
- **Se o prompt instrui a IA a "sempre retornar a melhor estimativa mesmo com
  confiança baixa", o código que consome a resposta não pode depois filtrar
  por um limiar de confiança arbitrário** — isso já aconteceu em
  `splitBayReaderService.ts` (`detectShipProfileBoundingBox`): o comentário
  no código dizia "só cai pra página inteira se a IA não identificou NENHUMA
  região", mas a condição real também exigia `confidence >= 0.15`,
  contradizendo o próprio comentário e descartando recortes aproximados
  (sempre melhores que mandar a página inteira) só por causa de confiança
  mal calibrada. Corrigido para usar qualquer `box` não-nulo.

### Conhecimento de domínio sobre os PDFs de Split

- A página 1 do Split costuma ser majoritariamente **imagem rasterizada**
  (QC Plan, perfil do navio, caixa Discharging/Loading) mesmo quando o
  título/cabeçalho é texto nativo selecionável. Isso varia entre documentos
  — alguns Splits têm essas regiões como texto nativo de verdade. Em
  documentos 100% rasterizados (nenhum texto nativo além do título), o
  fluxo novo (`splitBayReaderService.ts`) cai direto no fallback de visão
  computacional — é esperado, não é bug.
- **Logo abaixo da linha de números de bay do perfil do navio (a região
  "boa", com a silhueta do navio), existe uma SEGUNDA tabela quase colada
  com os MESMOS rótulos DS-DECK/DS-HOLD/LD-DECK/LD-HOLD** — é uma tabela de
  atribuição de guindaste/turno, com células cinza em hachura X e números
  pequenos, sem a silhueta do navio ao lado. Confirmado presente em vários
  documentos reais de operadores diferentes (BREMERHAVEN EXPRESS, MAERSK
  LETICIA) — é padrão do formato, não coincidência de um documento só.
  **Só descrever a armadilha em texto no prompt de localização
  (`detectShipProfileBoundingBoxOnce`) NÃO é suficiente** — confirmado
  reproduzindo em dois documentos diferentes que o recorte devolvido
  continuava incluindo a tabela inteira mesmo com a instrução explícita
  ("NÃO inclua..."), e a IA chegava a ler os números pequenos de sequência
  dessa tabela como se fossem quantidade real de contêiner (contaminando
  DS-DECK/DS-HOLD com valores errados). A correção definitiva foi
  **programática, não só de prompt**: depois do recorte inicial, quando a
  região não veio das âncoras de texto (`regionSource !== 'text-anchors'`),
  `analyzeSplitFromFile` roda uma segunda checagem dedicada
  (`detectDecoyGridBoundary` em `geminiService.ts`) perguntando SÓ "essa
  tabela de guindaste apareceu aqui, e em que altura ela começa" — uma
  pergunta de identificação positiva isolada, bem mais confiável que uma
  instrução negativa dentro de um prompt de localização maior — e o CÓDIGO
  recorta a imagem nessa fronteira antes de mandar pra leitura. Lição geral:
  **quando uma instrução negativa dentro de um prompt maior falhar de forma
  repetível, isolar em uma segunda chamada dedicada de identificação
  positiva tende a resolver onde o prompt-engineering sozinho não resolveu.**
- **Quando não há âncoras de texto nativo (`bayOrderHint` vazio), as leituras
  de composição (`extractBaySplitReadings`) e de totais oficiais
  (`extractBayTotalRow`) NUNCA podem rodar em paralelo cada uma adivinhando
  sozinha a lista de bays** — bug real já confirmado: como bays sem carga
  (total 0) podem ser puladas por uma chamada e não pela outra, os
  `columnIndex` das duas leituras saem de sincronia, e como `buildBayRows`
  junta os resultados só por posição, isso cola o total oficial na bay
  ERRADA (confirmado comparando com a soma "ALL" impressa no próprio
  documento — o app fechava em 1720, o documento mostrava 1658, e totais
  individuais como o da bay 50 apareciam colados em outra bay). Corrigido em
  `analyzeSplitFromFile` (`splitBayReaderService.ts`): quando falta
  `bayOrderHint`, as chamadas agora rodam em SEQUÊNCIA — primeiro
  `extractBaySplitReadings`, depois usa o `bayLabelsDetected` dela como hint
  (agora com linguagem "use EXATAMENTE essas colunas, não pule/reordene") da
  chamada de totais, garantindo que as duas usem a mesma indexação. Só
  paraleliza quando já existe um `bayOrderHint` confiável vindo de âncoras de
  texto (mesmo hint pras duas chamadas, sem risco de desalinhamento).
- **"C" dentro de uma célula do perfil do navio (DS-DECK/LD-DECK/DS-HOLD/
  LD-HOLD) significa "Completo"** (a sequência de trabalho já terminou) —
  **não** significa célula vazia nem quantidade zero.
- Pequenos números (1, 2, 3, 4, 5...) na parte inferior de cada bay são a
  **ordem das etapas de trabalho**, não quantidade de contêiner.
- **Células "twin" (dois números lado a lado DENTRO da mesma célula, ex.:
  "14 | 14", "24 | 24", "8 | 8") representam dois contêineres de 20' dividindo
  o mesmo slot da bay (twin-lock)** — a quantidade real da célula é a SOMA dos
  dois números, não um dos dois isolado. Confirmado visualmente na linha
  LD-HOLD de um documento real (BREMERHAVEN EXPRESS). O prompt de
  `extractBaySplitReadingsOnce` (`geminiService.ts`) pedia só "leia o número
  da célula" (singular) — sem instrução explícita pra somar os dois lados do
  twin, a IA provavelmente lia só um lado, o que é mais uma causa (além do
  bug de desalinhamento de `columnIndex` acima) da composição
  (DS-DECK+LD-DECK+DS-HOLD+LD-HOLD) sair sistematicamente menor que o total
  oficial. Prompt já ajustado para somar os dois lados do twin; ainda não
  confirmado em produção (chave do Gemini no `.env` está inválida/placeholder
  no momento — não deu pra testar contra a API real).
- Tabelas de alerta (carga sensível, reefers, embarque de flat vazio,
  excessos, descarga direta — geralmente páginas 4-5) cobrem **só os
  contêineres com alguma flag especial**, não o navio inteiro — não usar como
  fonte de contagem total por bay.
- Mapas de bay coloridos (páginas 2-3, grade de quadradinhos por bay):
  verde = descarga, amarelo = outro porto, azul = reefer, X = embarque.
  Ler a cor de cada célula individualmente (não por "blob" de pixels
  conectados — células vizinhas da mesma cor se fundem e erram a contagem)
  exige detectar as linhas da grade primeiro e amostrar a cor no centro de
  cada célula. **Isso foi explorado mas nunca totalmente implementado/
  integrado** — ver seção "Pendências" abaixo.
- O "Total oficial" de cada bay (linha de caixas brancas acima do DS-DECK) é
  a fonte de verdade — nunca deve ser recalculado a partir da soma de
  DS-DECK+LD-DECK+DS-HOLD+LD-HOLD. Quando a composição lida por visão não
  bate com o total oficial, marcar como "precisa de confirmação" e manter o
  total oficial como referência — nunca deixar a composição sobrescrever o
  total.

## Atracação / Programação BTP

- `btpScheduleService.ts` — faz scraping do portal da BTP via interceptação
  do jTable JSON (Playwright). Sempre marca `status: 'Previsto'` — a
  classificação real de status acontece em outro lugar (ver abaixo).
- `btpPortalData.ts` — `getPortalStatusLabel()` decide o status real
  ("Atracado"/"Desatracado"/"Na Barra"/"Previsto"). Prioriza confirmação REAL
  de atracação (`dataatracacao`/`horaatracacao`) sobre estimativa de ETB.
  Tem uma trava de segurança: se a saída prevista (`etd`) já passou há mais
  de 12h sem dado de saída real registrado, considera o navio desatracado —
  isso evita que falhas silenciosas no enriquecimento via RAP
  (`fetchRapDetailsMap`, que pode falhar sem erro visível) façam navios que
  já saíram ficarem acumulando como "Atracado" pra sempre (bug real que já
  aconteceu: chegou a mostrar 10 navios atracados com só 3 berços reais).
- `AtracacaoSaida.tsx` — cuidado com o campo de "saída prevista": o campo
  certo é `etd`/`saidaPrevista` (previsão), não `datasaida`/`horasaida`
  (saída REAL, só populada depois que o navio já saiu — por isso fica sempre
  vazio pra navio ainda atracado). Esse bug de campo trocado já apareceu
  duplicado em `toOperationalShipSnapshot` (`btpPortalData.ts`) também —
  vale checar se surgir de novo em outro componente.
- `server.ts` — rota `/api/btp-schedule` enriquece cada navio com status de
  praticagem do portal SPPilots (`buildPilotageStatusMap`,
  `normalizeShipName`, ambos em `btpService.ts`). Envolto em try/catch
  próprio — se o portal de praticagem falhar, a programação BTP principal
  continua retornando normal, só sem os campos extras de praticagem.

## Segurança (Firebase/Firestore)

- `firestore.rules` — **já foi corrigido de um estado totalmente aberto**
  (`allow read, write: if true`, qualquer pessoa na internet podia ler/
  escrever) para exigir autenticação e bloquear auto-promoção de `role` no
  documento de usuário (criação sempre força `'Operador'`; atualização não
  permite mudar `role`). Se algum dia essa regra voltar a aparecer aberta,
  **não é normal** — investigar antes de aceitar.
- `authService.ts` — contas novas (email/senha, Google, Facebook) sempre
  nascem como `'Operador'`, nunca confiam em `role` vindo do cliente. Contas
  existentes usam o `role` real salvo no Firestore. **Não existe hoje painel
  de admin pra promover alguém a Supervisor** — só editando direto no
  Console do Firebase. Se pedirem essa funcionalidade, é trabalho novo, não
  bug a corrigir.
- `.env` continha segredos reais (Gemini API key, usuário/senha do SPPilots)
  que passaram por um zip compartilhado numa sessão de análise — foi
  recomendada a rotação dessas credenciais. Confirmar se isso já foi feito.

## Pendências conhecidas (não são bugs, são trabalho futuro)

1. Consolidar `splitIntelligenceService.ts` (legado) e
   `splitBayReaderService.ts` (novo) de verdade — o fluxo novo já é o padrão
   da tela e o legado já foi escondido atrás do toggle "Modo Legado"
   (só inspeção), mas o código dos dois pipelines (e os dois caches de
   `localStorage`, `btp_split_by_berth_v1` e `btp_split_records_v1`) ainda
   coexistem sem terem sido removidos/unificados.
2. Classificação de cor por célula nos mapas de bay (páginas 2-3 do Split) —
   conceito validado com dados reais, mas nunca implementado como função de
   produção.
3. Painel de administração para promover usuários a Supervisor.
4. Precisão da leitura de DS-DECK/LD-DECK/DS-HOLD/LD-HOLD ainda imperfeita em
   navios com perfil muito denso (muitas colunas de bay) — ativamente sendo
   ajustada (prompt, resolução de recorte, threshold de confiança do
   bounding-box).
