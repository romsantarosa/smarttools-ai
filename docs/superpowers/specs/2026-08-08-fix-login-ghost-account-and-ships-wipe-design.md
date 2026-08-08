# Corrigir criação silenciosa de conta no login e apagamento acidental de navios

Data: 2026-08-08

## Contexto

O usuário relatou dois sintomas usados no dia a dia do BTP SmartTools AI:
"bugs de login, criar senha" e, depois de investigação, "dado sumindo no
mesmo navegador" (não é sobre sincronizar entre aparelhos diferentes — o
dado desaparece no mesmo Chrome/perfil de sempre). A pergunta original do
usuário era se valeria migrar de Firebase para Supabase para resolver isso.

Investigação no código (não em suposição) encontrou dois bugs concretos,
independentes de qual backend está sendo usado — nenhum dos dois é causado
por limitação do Firebase, e trocar de provedor não os corrigiria sozinho:

1. **`loginWithFirebase` cria conta nova silenciosamente quando o login
   falha** (`src/services/authService.ts`, dentro do `catch` que trata
   `auth/user-not-found` e `auth/invalid-credential`). O SDK atual do
   Firebase Auth retorna `auth/invalid-credential` tanto para "usuário não
   existe" quanto para "senha errada" (mudança deliberada do Firebase para
   evitar enumeração de contas). O código atual não distingue os dois casos
   e, na dúvida, cria uma conta nova com o e-mail/senha digitados. Resultado
   pratico: um typo de senha no login não mostra erro - loga o usuário numa
   conta "fantasma" vazia, dando a impressão de que todos os dados sumiram.
2. **Heurística de "limpeza de dados mock legado" pode apagar navios reais**
   (`src/context/AppContext.tsx`, leitura inicial do estado `ships`). Na
   primeira vez que o app carrega em um navegador/perfil sem a flag
   `btp_smart_tools_v2_shipsLegacyMockMigrationDone` setada, se a lista de
   navios salva localmente tiver 80+ itens, pelo menos 2 nomes batendo com
   uma lista fixa de 4 navios de exemplo antigos (ex.: `MAERSK LETICIA`) e
   50+ IDs no formato `ship-...`, o código assume que é lixo de dados mock
   antigos e apaga a lista (`return []`). Navios cadastrados de verdade
   também recebem ID `ship-${Date.now()}` (`AppContext.tsx`, `addShip`), e
   nomes de navio se repetem naturalmente na operação real - então uma
   frota real grande pode disparar essa heurística por coincidência, uma
   vez por navegador/perfil onde a flag ainda não rodou (troca de
   navegador, modo anônimo, perfil novo, limpeza de cache).

Confirmado com o usuário: os dois bugs valem a pena corrigir já,
independente de qualquer decisão futura sobre trocar de backend - a decisão
Firebase vs. Supabase continua em aberto e não faz parte deste spec.

## Objetivo

1. Login com e-mail/senha errado nunca mais cria conta nova - só mostra a
   mensagem de erro já existente (`getFirebaseErrorMessage`).
2. A leitura inicial da lista de navios do `localStorage` nunca mais apaga
   dados automaticamente por uma heurística de "parece mock antigo".

## Fora de escopo

- Não decide nem prepara migração Firebase → Supabase (fica para uma
  conversa/spec separada, depois que o usuário terminar os testes que
  confirmam se esses dois bugs explicam o que ele viu).
- Não mexe em `firestore.rules`, em nenhuma Cloud Function, nem em nenhuma
  outra coleção do Firestore.
- Não adiciona um fluxo novo de "conta não encontrada, deseja criar?" no
  login - a aba "Cadastrar Usuário" já existente em `Login.tsx` continua
  sendo o único caminho para criar conta, sem mudança nela.
- Não reescreve a arquitetura de persistência (localStorage vs. Firestore)
  descrita no `CLAUDE.md` - fora do escopo deste conserto pontual.
- Não faz nada retroativo: navios que já foram apagados por esse bug antes
  desta correção não são recuperados por este trabalho (não há como
  recuperar dado apagado do `localStorage`).

## Design

### 1. `src/services/authService.ts` - `loginWithFirebase`

Remove o bloco `if (err?.code === 'auth/user-not-found' || err?.code ===
'auth/invalid-credential')` inteiro (incluindo a criação automática de
conta e o `createErr` aninhado dentro dele). O `catch` passa a só tratar
`auth/operation-not-allowed` (fallback de modo local, mantido como está) e,
para qualquer outro código de erro - incluindo `user-not-found`,
`invalid-credential`, `wrong-password` -, relança o erro (`throw err`) sem
criar nada. Quem chama `loginWithFirebase` (`AppContext.tsx` →
`loginWithEmail`) já propaga esse erro para `Login.tsx`, que já usa
`getFirebaseErrorMessage(err)` para mostrar a mensagem traduzida - nenhuma
mudança necessária nesses dois arquivos.

`registerWithFirebase` não muda - continua sendo o único fluxo que cria
conta nova, chamado só a partir da aba "Cadastrar Usuário".

### 2. `src/context/AppContext.tsx` - leitura inicial de `ships`

Remove a função `isLegacyMockShipsData`, a constante `LEGACY_MOCK_SHIP_NAMES`
e a constante `SHIPS_MIGRATION_FLAG_KEY` (nenhuma das três é usada em
nenhum outro lugar do arquivo). O inicializador de `ships` volta a ser
simétrico aos outros campos (`tools`, `shifts`, etc.): lê o que estiver
salvo em `localStorage`, faz `JSON.parse`, e usa `INITIAL_SHIPS` só se não
houver nada salvo ou o parse falhar - sem nenhuma checagem de "parece
mock antigo".

Não é necessário nenhum código de migração para quem já tem a flag `1`
setada - essa flag simplesmente para de ser lida ou escrita; o valor antigo
dela no `localStorage` do usuário fica órfão e inofensivo (não é limpo
ativamente, para não arriscar tocar em mais `localStorage` do que o
necessário para este conserto).

### 3. Testes

Sem suíte automatizada cobrindo `authService.ts` ou `AppContext.tsx` hoje.
Verificação manual, no dev server:

- Login com senha errada numa conta existente → mostra "E-mail ou senha
  incorretos", não loga em nenhuma conta nova (confirmar olhando
  `auth.currentUser` antes/depois, ou o Firebase Console).
- Login com e-mail que nunca existiu → mesma mensagem de erro, nenhuma
  conta nova criada.
- Cadastro pela aba "Cadastrar Usuário" continua funcionando normalmente.
- Com uma lista de navios salva localmente que bateria com a heurística
  antiga (80+ itens, nomes repetidos, IDs `ship-...`), recarregar a página
  não apaga a lista.
- `tsc --noEmit` sem novos erros nos dois arquivos tocados.

## Decisões e trade-offs

- **Não tentar diferenciar "senha errada" de "conta não existe" no
  login**: o próprio Firebase Auth já não permite mais essa distinção via
  código de erro (`auth/invalid-credential` cobre os dois, de propósito,
  para não vazar quais e-mails têm conta). Tentar adivinhar por outro meio
  seria gambiarra por cima de uma decisão de segurança do próprio Firebase.
  A mensagem genérica "E-mail ou senha incorretos" já é o padrão esperado
  desse tipo de erro.
- **Remover a heurística em vez de só apertar os critérios**: dava para
  deixar a "limpeza" mais rígida (ex.: exigir todos os 4 nomes, não só 2).
  Optado por remover de vez porque a migração que ela existia para fazer já
  deveria ter rodado, uma vez, em qualquer instalação real de antes de
  agora - manter qualquer versão dessa heurística é manter uma mina
  aterrada esperando outra coincidência de dado real, só que mais rara.
- **Não recupera dado já perdido**: fora do alcance de uma correção de
  código - mencionado aqui só para não criar expectativa errada.
