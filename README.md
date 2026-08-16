# Praxis Policy Studio

Workstation independente da plataforma Praxis para compreender, criar, testar e operar decisões governadas. O ErgonX é o primeiro consumidor; contratos e semântica do produto permanecem neutros em relação ao domínio.

## Estado atual

`PS-001` implementa o shell, `PS-003` adiciona projeções read-only validadas e
o slice executável de `PS-002/PS-004` conecta essas referências ao catálogo,
timeline e lifecycle do Config quando o modo remoto é habilitado. O Studio cria
um change workspace governado, persiste drafts com ETag, mantém cenários de
outcome, executa candidate × active no sandbox do host, registra Test Runs
imutáveis, submete para revisão independente e projeta review/promotion. O
lifecycle também apresenta a autoridade e a elegibilidade do baseline e, quando
o host fornece a prova V58, resume CREATE/UPDATE, mutação ou não mutação, cleanup e
chamadas ao baseline sem expor facts, payloads ou linhas de banco.
Não há composição de snapshot no browser: o Studio publica definições/materializações
e opera versões de snapshot somente pelas ações e pelo ETag fornecidos pelo Config.

O catálogo versiona 14 referências RN-013 e um caso neutro real do Quickstart.
Por padrão, o desenvolvimento local abre o Rule Lab de auxílio extraordinário:
10 slots, 11 bindings e evidências ligadas à suíte golden de 15 casos.
Os manifestos não contêm expressões executáveis nem credenciais. Eles projetam
identidades, composição, schemas de facts e evidências das fontes operacionais;
condição e lifecycle continuam vindo do Config autenticado.

## Requisitos

- Node.js 20.19+ ou 22.12+
- npm 10+

## Executar

```powershell
npm ci
npm start
```

No modo remoto, uma sessão ausente exibe o login explícito do ambiente de desenvolvimento. O formulário chama o endpoint canônico `/auth/login`, recebe apenas o cookie `HttpOnly` do host e descarta os campos após a tentativa; o Policy Studio não persiste senha ou token. Uma sessão reconhecida pode ser encerrada por `/auth/logout`; após a resposta do host, o Studio invalida catálogo, seleção e evidências governadas mantidas em memória antes de voltar ao login.

Abra `http://localhost:4302/catalog`.

Para integrar o primeiro consumidor, consulte o histórico no
[handoff do Ergon beta.7](docs/ergon-handoff-beta7.md) e o corte V58 no
[handoff Ergon beta.8](docs/ergon-handoff-beta8.md).
O caso neutro publicado mais recente e a cadeia atual para a issue #300 estão no
[handoff de folha de 2026-08-16](docs/ergon-handoff-published-payroll-2026-08-16.md).
O complemento operacional corrente está no
[handoff V61](docs/ergon-handoff-v61.md): ele registra a cadeia de discovery
cross-resource consumida pelo Studio e preserva a prova Neon do V60 sem a
confundir com evidência Oracle.
O beta.13 usa a cadeia Contracts beta.4, Config rc.118,
Metadata rc.127, Quickstart rc.39 e `@praxisui/*` rc.27.
O corte acrescenta uma prova de navegador desktop/narrow, teclado e axe com
backend hermético; ela não substitui a prova integrada com Quickstart/Neon e
personas reais.
Na composição de snapshot, o Config devolve blockers governados tipados e o
Studio os apresenta por códigos estáveis em pt-BR/en-US. A UI não interpreta nem
expõe a mensagem técnica do backend como contrato de produto.
O handoff referencia o corpus portátil executável mantido pelo Quickstart, que
exercita riscos de migração sem transformar evidência sintética em prova Oracle.
O percentual auditado, os bloqueadores e a sequência de cortes estão em
[Estado e roadmap](docs/current-status-and-roadmap.md). A fronteira para busca,
explicação e authoring por agente está em
[ADR 0002 — Policy Assistant](docs/adr/0002-policy-assistant-boundary.md).
O [Estado e roadmap](docs/current-status-and-roadmap.md) separa o que já foi provado
do que ainda depende de Neon, Oracle/HADES, UX corporativa ou releases coordenados.

## Configuração

`public/app-config.json` é carregado no início e seleciona uma projeção local
versionada por `projectionPath`. A configuração versionada usa o caso Quickstart,
modo `remote` e URLs same-origin. `npm start` encaminha `/auth`, `/api` e
`/schemas` para o Quickstart oficial em `http://127.0.0.1:8088`; assim actions
Metadata, o `DomainRuleService`
público e a sessão cookie não dependem de transporte cross-origin. Ela não
contém credenciais. O modo `remote` falha fechado quando `configApiBaseUrl` não
é string, consulta definições e timeline por
`/api/praxis/config/domain-rules/**` e usa a sessão autenticada do host. O
browser não envia tenant, ambiente ou authority. Isso é uma restrição do cliente,
não uma garantia de isolamento. Ações de definition, workspace, snapshot e staged
rollout existentes vêm do servidor. `CREATE_NEW_VERSION` é correlacionada à
identidade e versão exatas da definição; o suporte estático do editor não concede
autoridade. Publicação, criação de rollout e lifecycle de rollout-policy usam
actions principal-specific de catálogos server-owned; o browser não reutiliza
uma capability para autorizar outra operação. A política alvo para definitions,
timelines e materializations é
`ROLE_RULE_DEFINITION_READER`; o drift anterior com snapshot reader foi corrigido
no Config e precisa integrar o próximo corte publicado. O Config resolve principal,
tenant e ambiente no servidor. Nenhum token ou segredo deve ser versionado.

O catálogo distingue indisponibilidade de falta de permissão e não transforma
status técnico do Config em homologação de negócio. A projeção governada segue
sendo a fonte das identidades e da ordem exibidas; o Config apenas acrescenta o estado
persistido que tenha a mesma chave canônica.

No perfil `dev`, o Quickstart publica pelo serviço canônico as sete condições
JSON Logic editáveis do caso de referência. O seed é idempotente, permanece em
`draft` e não altera autoridade operacional.

No modo remoto, a inspeção de cada decisão mostra a condição em leitura
simbólica, os facts referenciados, a semântica de `null`, as operações cobertas,
a posição na precedência e as evidências de origem. A comparação entre baseline
e draft é deliberadamente assimétrica: a autoridade de referência declarada
pela projeção permanece explícita, enquanto o Config aparece como draft técnico.
No RN-013 essa referência é o Oracle legado; no Quickstart é o baseline sintético.
Esta superfície não altera autoridade sem um comando governado explícito.

A decisão focal editável abre o Visual Builder oficial em um chunk lazy quando
uma condição detalhada correspondente é devolvida pelo Config. Alterações locais
só se tornam governadas por comando explícito de save e ETag. O Studio mostra um
diff semântico derivado entre definição-base e candidato, sem persistir uma
segunda verdade. Cenários e Test Runs formam o gate de submissão para
revisão/hash/cobertura/outcome do workspace. A V58 acrescenta baseline independente
por cenário, retry idempotente, vínculo imutável do run submetido e política
server-owned opt-in para `SUBMIT` e `PROMOTE`. Publication/snapshot/activation
ainda não reutilizam esse gate por estágio. Criar ou alterar um cenário rotaciona
a revisão do workspace e invalida a evidência anterior; o Studio recarrega o ETag
do owner antes de oferecer os próximos comandos. O editor de cenários permite corrigir
chave, nome, facts, decision esperada, status, output, reason codes e effect intents
usando o ETag canônico do cenário. A alteração rotaciona também a revisão do workspace,
limpa o resultado de sandbox obsoleto e exige um novo Test Run. As asserções são distintas
dos facts de entrada e tornam explícito o contrato que o Test Run precisa comprovar.
Output é JSON opcional; códigos e intenções são listas normalizadas.

O Quickstart V61 publica uma action operacional protegida para executar cenários
`CREATE`/`UPDATE` descartáveis e registrar a evidência V58. O Studio beta.10 a
descobre semanticamente pelo `operationalResourceKey` host-owned da projeção e
pelas tags canônicas. O `resourceKey` da Definition identifica o RuleSet governado
e não é reinterpretado como recurso HTTP do host. O Studio exige uma única action,
seleção explícita de operação e confirmação de alto risco.
URL, método, autorização, idempotência e o `If-Match` cross-resource do workspace
vêm do catálogo Metadata; o browser falha fechado quando o protocolo está ausente
ou ambíguo.

## Validação de navegador

```powershell
npm run e2e
```

A suíte Playwright inicia o Studio na porta oficial `4302`, usa Chromium e valida
desktop `1440×1000` e narrow `390×844`. Ela cobre sessão ausente, capability
negada, confirmação de ação de alto risco, conflito `412`, teclado, ausência de
overflow horizontal e axe. As respostas HTTP são herméticas para tornar o gate
reprodutível no CI; a evidência integrada `4302 ↔ 8088` continua sendo um gate
separado, dependente de Quickstart e Neon configurados.

Workspaces expõem save, scenarios, Test Run, submit, review e promoção somente
quando `GET /workspaces/{id}/capabilities` publica a ação correspondente. Os
blockers estáveis do Config são mostrados junto da área governada. O Config
resolve o principal e exige `ROLE_RULE_DEFINITION_APPROVER` no review, inclusive
author ≠ reviewer. Após aprovação, a promoção cria uma nova definição governada;
ela não publica materializações nem ativa snapshot. A UI não infere review,
promoção ou submissão pelo status; o servidor continua revalidando papel,
segregação, blockers e ETag no comando.

Cada leitura assíncrona do catálogo, timeline, lifecycle, cenários, reviews,
capabilities, snapshots, rollouts, hosts e execução possui geração própria. Uma
resposta anterior para a mesma decisão ou uma decisão já abandonada não pode
substituir evidência mais nova. Perda de sessão/permissão invalida a seleção e
remove o detalhe governado, em vez de manter estado stale sem rótulo.

Para a definição promovida, o Studio materializa o readiness já publicado pelo
Config: cobertura existente, aprovações requeridas, targets previstos, warnings,
ação recomendada e `publicationReadiness`. Essa simulação é estrutural e não
substitui os cenários candidate × active com facts. O comando de publicação só
fica disponível para `ready_to_publish` e pede ao Config que processe as
materializações elegíveis. Composição, duas aprovações de snapshot, publicação do
snapshot e ativação runtime permanecem operações posteriores e separadas. O
cockpit de snapshots consulta o head e o catálogo seguro do Config, distingue o
`headEtag` mutável do `snapshotContentHash` imutável e só oferece `ACTIVATE` ou
`ROLLBACK` quando `availableAction` vier do servidor. Cada comando confirma o
alvo e envia o ETag forte; conflito recarrega a autoridade atual.

No mesmo cockpit, a política de segurança do rollout é uma entidade governada
separada do snapshot: versões imutáveis percorrem `DRAFT → APPROVED → ACTIVE`,
com autor diferente do aprovador e um head/ETag anti-ABA próprio. O Studio usa
exclusivamente o `DomainRuleService` público para criar draft, consultar catálogo
e timeline, aprovar e ativar. A tela ainda deriva esses comandos do lifecycle;
papéis, segregação, ausência de rollouts abertos e concorrência continuam
validados pelo Config. Antes de produção, o catálogo deve publicar as ações
server-owned da política, como já ocorre em snapshots e staged rollout. O editor
não simula readiness de rollout no browser. Essa operação será
materializada quando o control plane publicar discovery governado de rollouts
abertos e suas ações disponíveis para a persona humana.

O Studio deliberadamente não monta o candidato de composição com as decisões
da projeção. Essa operação exige o RuleSet completo, os IDs de origem, contrato
do host e duas aprovações distintas. O Quickstart agora materializa esse candidato
no compositor Java do host usando exatamente as sete definições aprovadas do caso;
o script não reconstrói condições e o browser não recebe o grafo executável. O
Quickstart mantém readiness local no Actuator e publica heartbeat redigido no
Config. O Studio consome apenas o agregado server-derived de hosts alinhados,
com snapshot em drift, runtime incompatível, indisponíveis ou com heartbeat vencido.

## Gates

```powershell
npm test
npm run check:projections
npm run build
```

Para atualizar a projeção RN-013 a partir de um checkout governado da migração:

```powershell
npm run generate:ergonx-projection -- D:\caminho\para\Techne-ErgonX-migracao
npm run check:projections
```

O gerador falha se materializador e host não tiverem exatamente as mesmas 14
identidades na mesma ordem. IDs das definições Config permanecem explicitamente
`NOT_RESOLVED_IN_VERSIONED_EVIDENCE`; o Studio não os infere.

Para sincronizar o caso neutro a partir do Quickstart irmão:

```powershell
npm run sync:quickstart-projection
npm run check:projections
```

A projeção Quickstart é derivada e tem gatilho explícito de remoção: ela deixa
de existir quando Config/Metadata fornecerem discovery governado equivalente.
Consulte `docs/rfc/0001-quickstart-reference-case.md`.

O shell inicia pela cadeia publicada de folha
`human-resources.payroll.reactive-determinations`. Esse caso prova integração
Config/host/Neon, snapshots v1/v2 e execução create/update. O corpus de auxílio
extraordinário permanece disponível como caso de amplitude de regras, mas não é
tratado como evidência de publicação nem como paridade Oracle do Ergon.

## Policy Assistant

O Studio não possui motor LLM próprio. Providers, resolução semântica de
intenção, conversas, streaming, clarificação, identidade e registry de tools
são reutilizados do Praxis Config e de `@praxisui/ai`.

O primeiro slice read-only já explica a definição selecionada. O browser envia
somente `selectedDomainDecisionRef` com ID, rule key e versão. Em corporate mode,
o Config exige `RULE_DEFINITION_READER` antes de enfileirar o turno, relê a
definição no escopo do principal, aplica `governance.aiUsage` e devolve uma
projeção sanitizada. O Studio só apresenta a resposta quando a evidência terminal
vem de `inspectDomainDecision`, confirma exatamente a mesma versão, inclui os
fingerprints e declara `canApply=false`; uma resposta divergente, incompleta ou
aplicável é rejeitada. Facts runtime, tenant, atores, rationale e payloads
materializados não são enviados ao provider nem exibidos nessa superfície.

Busca/discovery, proposição de cenários e diff vêm nos próximos incrementos.
Create, edit, test, submit e, depois, publish/rollout poderão ser executados por
um agente delegado somente pelas mesmas actions, capabilities, ETag,
confirmação, evidência e segregação de funções usadas por pessoas. Não haverá
autoaprovação nem API privilegiada de IA.

## Execução observada

No modo governado, o cockpit do snapshot ativo consome o resumo redigido publicado pelo Config por
meio do cliente oficial `DomainRuleService`. O Studio apresenta volume por outcome, hosts distintos
e janela de observação; não recebe facts, identidade individual dos hosts nem observações unitárias.
Loading, ausência de observações, sessão expirada, permissão limitada e falha recuperável são estados
visuais distintos.

O mesmo cockpit consulta o resumo de alinhamento do head ativo. O browser não
enumera hosts nem recebe hostname, IP, actorRef ou payload runtime; loading,
ausência, sessão expirada, permissão limitada e retry também são estados distintos.

Na prova operacional, uma tentativa conserva `Idempotency-Key` e `evaluatedAtUtc`
depois de falha incerta. O par só é rotacionado após receipt confirmado, mudança
de workspace ou alteração da matriz cenário/operação; assim, retry do browser não
repete DML quando a resposta se perde depois do commit.
