# Praxis Policy Studio

Workstation da Praxis Platform para compreender, criar, simular, testar e aprovar decisões governadas sobre o control plane Praxis Config. [Praxis Platform](https://praxisui.dev/) · [Praxis Config](https://github.com/codexrodrigues/praxis-config-starter)

## Regras de negócio e políticas de autorização

**Regras de negócio (`decisionKind = BUSINESS`).** A experiência disponível no
Studio usa `/catalog` para trabalhar com validações, cálculos e elegibilidade.
As regras de um `RuleSet` são compostas em `PublishedRuleSnapshot` e executadas
pelo Rules Engine. [Praxis Rules Engine](https://github.com/codexrodrigues/praxis-rules-engine)

**Acesso e proteção de dados (`decisionKind = AUTHORIZATION`).** O contrato da
plataforma usa `ruleType = "authorization_policy"` e
`definition.schemaVersion = "praxis.authorization-policy/v1"` para acesso,
escopo de dados, uso e escrita de campos, mascaramento e obrigações. A
materialização `policy_engine` / `opa-policy` é consumida pelo Praxis Authz e
pelo OPA. No catálogo remoto autenticado, **Revisar rascunho de acesso (ACCESS)**
recebe uma requisição de criação preparada para o host. O revisor confere pontos
`EXACT`, digests declarados, modos, contribuições ACCESS, códigos de razão,
condições e governança antes de salvar como `draft`. O Studio envia o documento
ao Config e compara a releitura por ID com a candidata enviada. O mesmo ID
permite reabrir a definição. **Consultar pontos de decisão do host** consulta o
PAP da sessão atual. Selecione o serviço, o ponto e o modo para consultar os
caminhos, tipos, cardinalidade e presença dos fatos. A referência EXACT inclui
o digest do descritor fornecido pelo host. O texto da candidata é preservado
durante a consulta. A admissão do runtime ocorre na publicação.
[Praxis Authz Starter](https://github.com/codexrodrigues/praxis-authz-starter) · [Praxis Authz OPA](https://github.com/codexrodrigues/praxis-authz-opa)

No mesmo catálogo, **Operar release de acesso (OPA)** lista as definições ACCESS
aprovadas com alvo exato em modo TARGET. Selecione a versão pelo ID e publique
o release. O host verifica a aprovação independente, o vínculo ao serviço e a
política de tenant. Para ativar ou reverter, confirme o ID do release. Outra
sessão autorizada pode consultar esse ID e retomar uma operação pendente. A
revisão esperada vem do pacote publicado. A revisão observada, a instância OPA
e os digests vêm da última confirmação persistida pelo servidor.

Os contratos e a semântica do produto permanecem neutros em relação ao domínio e ao host consumidor.

Para disponibilizar um host corporativo adicional no seletor do mesmo Studio que serve o Quickstart, configure a origem HTTPS correspondente no build estático. [Configuração e validação do site](docs/render-static-deployment.md)

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
Não há síntese local de `RuleSet` no browser: o Studio cria definições governadas,
edita condições, parâmetros tipados (`/definitions/{id}/parameters`) e efeito operacional
explícito (`BLOCK`/`ALLOW`), publica definições/materializações e opera o fluxo
assistido de candidato de composição (`/api/praxis/rules-studio/rule-sets/{ruleSetKey}/candidate`,
`/candidate/approvals`, `/candidate/publish`) e versões de snapshot somente pelas
ações (`authorizedActions`), segregação de funções (4-olhos) e ETag forte fornecidos
pelo host e pelo Config.

O catálogo versiona projeções corporativas de referência e o caso neutro real do Quickstart.
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
npm start        # Proxy para praxis-api-quickstart (http://127.0.0.1:8088)
```

No modo remoto, uma sessão ausente exibe o card centralizado de autenticação do ambiente de desenvolvimento (com supressão de chamadas protegidas enquanto não autenticado e ocultação do inspetor direito até o login). O formulário chama o endpoint canônico `/auth/login`, recebe apenas o cookie `HttpOnly` do host e descarta os campos após a tentativa; o Rules Studio não persiste senha ou token. Uma sessão reconhecida pode ser encerrada por `/auth/logout`; após a resposta do host, o Studio invalida catálogo, seleção e evidências governadas mantidas em memória antes de voltar ao login.

Abra `http://localhost:4302/catalog` (ou navegue por deep-link contextual a partir da UI do host consumidor: `/catalog?ruleSetKey=...&slotKey=...&decisionKey=...`, que resolve diretamente o slot solicitado e abre o detalhe automaticamente mesmo em viewports estreitos).

### Shell multi-módulo e jornada da interface

O Studio organiza a experiência sobre um shell lazy persistente ([STUDIO_SHELL_ROUTES](src/app/shell/studio-shell.routes.ts)) dividido em quatro rotas modulares:

- `/overview`: mapa executivo do portfólio governado (KPIs acelerados pelo resumo server-side `/definitions/catalog/summary` quando suportado pelo Config, distribuição por domínios/tipos, filtro de trabalho pendente e atualização explícita contra o servidor).
- `/catalog`: workstation focal com explorador redimensionável (`256–440px`, seletor rápido de área e painel `Filtros`, progresso e avisos não-destrutivos de carga parcial/truncada), canvas central de cinco tarefas (`Entender`, `Regra`, `Testar`, `Operar`, `Histórico`) e inspetor lateral recolhível (`Propriedades`, `Assistente IA`, `Técnico`).
- `/reviews`: fila 4-olhos dedicada para acompanhar rascunhos em elaboração, submissões em revisão, aprovações e rejeições de regras de negócio (`BUSINESS`), além de bloco segregado sob demanda para políticas de autorização (`AUTHORIZATION`) pendentes com atalho para `/access`.
- `/access`: trilha ortogonal separada para políticas de autorização e privacidade OPA (`decisionKind = AUTHORIZATION`), com descoberta paginada/buscável por status (`browseAccessCatalog`), acessível diretamente pela barra lateral ou pelo contexto pontual de uma regra de negócio (`accessBridgeContext`).

Invariantes de navegação, teclado e segurança no shell:

- **Barra lateral e atalhos:** a barra lateral expansível (`208px` ↔ `60px`, faixa compacta em viewports estreitas) responde a `Ctrl/Cmd+B`; `Ctrl/Cmd+K` abre a paleta de comandos global (capaz inclusive de trocar de regra ao vivo dentro de `/catalog`); `Shift+D` alterna a lente `Negócio | </> Técnico`; `[` e `]` recolhem/abrem o explorador e o inspetor quando o módulo ativo os habilita.
- **Proteção de trabalho local (`canDeactivate`):** sair de `/catalog` para outro módulo com rascunho ou cenário alterado localmente solicita confirmação explícita antes de descartar o estado das facades de autoria.
- **Higiene de URL entre módulos:** parâmetros de ambiente/host (`tenantId`, `organizationId`, `environment`, `apiBaseUrl`) são preservados entre rotas, enquanto parâmetros contextuais de deep-link (`resourceKey`, `ruleSetKey`, `slotKey`, `bindingKey`, `decisionKey`, `operationKey`) são consumidos na entrada inicial e descartados em navegações intencionais por sidebar, `/overview`, `/reviews` ou `Ctrl+K`.
- **Linguagem de negócio e títulos dinâmicos:** `Route.data.titleKey` via `StudioTitleStrategy` e os catálogos `pt-BR`/`en-US` mantêm títulos, códigos, status e fallback fail-closed coerentes em ambos os idiomas.

A decisão selecionada é organizada pelas tarefas `Entender`, `Regra`, `Testar`,
`Operar` e `Histórico`. Cada tarefa abre apenas a superfície de trabalho
correspondente, preservando a decisão, o workspace e alterações locais enquanto
o operador alterna entre compreender, editar e testar. A interface usa linguagem
de negócio na superfície principal e mantém IDs, status brutos e referências do
Config em detalhes técnicos. `Testar` permanece sempre navegável: quando ainda
não existe workspace governado para a regra aberta, a aba exibe uma orientação
clara com atalho para abrir o rascunho seguro (ou informa explicitamente quando o
escopo/regra é somente leitura), sem confundir ausência de workspace com erro de sessão.
Em viewports estreitos, catálogo e decisão deixam de competir pelo mesmo espaço:
o operador seleciona uma decisão, trabalha em uma página dedicada e retorna ao
catálogo sem perder seleção, workspace ou draft. Códigos e chaves canônicas ficam
nos detalhes técnicos, embora continuem disponíveis para tecnologias assistivas.
A suíte de navegador comprova em desktop e narrow que a navegação interna não
recarrega a aplicação, o editor permanece aberto, um cenário tipado pode ser criado
e o sandbox devolve a comparação candidate × active sem overflow ou violações
Axe no corpus hermético.
O mesmo fluxo altera visualmente o limite governado de `3000` para `2750`, salva
o draft por `PUT` com `If-Match`, recebe a nova revisão e continua a jornada sem
perder o workspace. Outcomes, operações e estados continuam canônicos no
transporte e recebem rótulos humanos somente na apresentação.

A ordem de avaliação pertence ao conjunto de decisões declarado pela projeção e
nunca ao tamanho do catálogo filtrado ou paginado. Por isso, precedência não é
apresentada como indicador solto na visão geral. Quando voltar a ser materializada,
deve informar o conjunto, o efeito de curto-circuito e o denominador canônico.

Para integrar hosts corporativos consumidores, utilize a cadeia canônica V58/V61
de discovery cross-resource via Metadata e Config, preservando as provas de
runtime em banco remoto sem as confundir com evidência de paridade em sistema legado.
A baseline auditada em 19/08/2026 usava Contracts beta.4, Config rc.128,
Metadata rc.127, Quickstart rc.43 e `@praxisui/*` rc.38. Essas coordenadas são
históricas e não descrevem as dependências atuais da UI. O código posterior à
tag beta.15 continua sem uma nova tag do Studio; beta.15 não deve ser usado
como nome do corte corrente.

O lockfile fixa os sete pacotes diretos `@praxisui/*` em `10.0.0-rc.58` e
resolve `@praxisui/dialog` na mesma versão. Esse conjunto publicado fornece o
contrato que o Studio usa para consultar snapshots por operação, retirar heads
e preparar, aprovar e publicar candidatos a snapshots. Execute `npm ci` para
reproduzir a árvore do Studio.

A adoção G2 foi validada em `f427d705` com a
[publicação rc.36](https://github.com/codexrodrigues/praxis-ui-angular/actions/runs/39609796030/attempts/2).
Essa evidência histórica cobre o cockpit com histórico incompatível, publicação
sem seleção de head e bootstrap por rollout. A prova integrada dos contratos
com Config e host é um gate separado.

O Studio consome o catálogo canônico de facts por definição (`/definitions/{id}/facts`) e deriva
inputs tipados de cenário, mantendo o editor JSON estruturado apenas para
preview ou para famílias de decisão sem catálogo de facts declarado.
Na composição de snapshot, o Config devolve blockers governados tipados e o
Studio os apresenta por códigos estáveis em pt-BR/en-US. A UI não interpreta nem
expõe a mensagem técnica do backend como contrato de produto.
O handoff referencia o corpus portátil executável mantido pelo Quickstart, que
exercita riscos de migração sem transformar evidência sintética em prova de sistema legado.
O percentual auditado, os bloqueadores e a sequência de cortes estão em
[Estado e roadmap](docs/current-status-and-roadmap.md). A fronteira para busca,
explicação e authoring por agente está em
[ADR 0002 — Policy Assistant](docs/adr/0002-policy-assistant-boundary.md).
A prova controlada desktop/narrow da jornada discovery → seleção → explicação está
em [Evidência de navegador do Policy Assistant](docs/browser-ai-discovery-evidence-2026-08-16.md).
O [Estado e roadmap](docs/current-status-and-roadmap.md) separa o que já foi provado
do que ainda depende de banco remoto homologado, ambiente legado autorizado, UX corporativa ou releases coordenados.

## Configuração

`public/app-config.json` é carregado no início. Em modo remoto, o catálogo governado
do Config define quais decisões podem ser navegadas; `projectionPath` é opcional e
apenas enriquece decisões conhecidas com facts, autoridade e evidência versionada.
A configuração versionada usa o caso Quickstart como enriquecimento inicial,
modo `remote` e URLs same-origin. `npm start` encaminha `/auth`, `/api` e
`/schemas` para o Quickstart oficial em `http://127.0.0.1:8088`; assim actions
Metadata, o `DomainRuleService`
público e a sessão cookie não dependem de transporte cross-origin. Ela não
contém credenciais. O modo `remote` falha fechado quando `configApiBaseUrl` não
é string, consulta o catálogo, detalhes exatos e timeline por
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
no Config rc.128. O Config resolve principal,
tenant e ambiente no servidor. Nenhum token ou segredo deve ser versionado.

O catálogo distingue indisponibilidade de falta de permissão e não transforma
status técnico do Config em homologação de negócio. A projeção governada segue
sendo a fonte das identidades e da ordem exibidas; o Config apenas acrescenta o estado
persistido que tenha a mesma chave canônica.

Operações críticas de snapshot e rollout usam um diálogo contextual próprio,
com alvo e consequência visíveis antes do comando. O diálogo não concede
capability: ao confirmar, o Studio revalida o estado local publicado pelo
servidor e o backend continua revalidando principal, ETag e lifecycle. Blockers
Alterações locais de regra e cenário usam a mesma superfície contextual antes
de trocar de decisão, fechar, restaurar ou voltar ao catálogo narrow. Cancelar
preserva o trabalho e o foco da tarefa; confirmar executa a continuação capturada
e descarta efetivamente o estado local. Apenas o fechamento da aba usa o aviso
nativo obrigatório do navegador.

Blockers
de workspace e resultados de sandbox são componentes de apresentação isolados.
O editor de facts de cenário também é um componente único reutilizado na criação
e na correção: ele projeta os descritores governados como controles tipados e
emite alterações de valor/null, enquanto parsing, payload canônico, persistência,
ETag e capabilities permanecem no orquestrador. Essa fronteira reduz duplicação
sem promover um contrato local concorrente ao Config ou ao Core.
O catálogo de cenários segue a mesma regra: renderiza lista, edição e seleção do
modo operacional e emite comandos de UI tipados. Ele não injeta serviços nem
infere permissões; o workspace continua responsável por validar capability,
normalizar o payload, aplicar ETag e invalidar evidência anterior.
O formulário de criação também é uma superfície isolada: coleta valores humanos,
facts tipados e asserções e entrega uma solicitação local ao orquestrador. O form
só é limpo depois do receipt de sucesso; falhas de validação, autenticação,
concorrência ou rede preservam integralmente a entrada do usuário.
Feedback de criação/edição de cenário e feedback de sandbox possuem estados
separados e são renderizados junto da tarefa correspondente. Eles continuam
compartilhando a exclusão mútua de comandos governados, mas uma mensagem de teste
não sobrescreve mais um erro de cenário, nem é exibida fora de contexto.

No perfil `dev`, o Quickstart publica pelo serviço canônico as sete condições
JSON Logic editáveis do caso de referência. O seed é idempotente, permanece em
`draft` e não altera autoridade operacional.

No modo remoto, a área “Como esta decisão funciona” mostra a condição em leitura
simbólica, os dados referenciados, a semântica de `null`, as operações cobertas e
as evidências de origem. A comparação entre baseline
e draft é deliberadamente assimétrica: a autoridade de referência declarada
pela projeção permanece explícita, enquanto o Config aparece como draft técnico.
Em fluxos corporativos com legado essa referência é o baseline autorizado do host; no Quickstart é o baseline sintético.
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
Output é JSON opcional; códigos e intenções são listas normalizadas. Apenas cenários
`ACTIVE` compõem uma execução; cenários `DISABLED` preservam histórico sem contaminar o gate.

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
overflow horizontal e axe. A suíte de convergência multi-host valida
em desktop e narrow a resolução de deep-link (`?ruleSetKey=...&slotKey=...&decisionKey=...`), renderização
do DAG (`<pax-rule-decision-plan-dag>`) com guards `FORBIDDEN` em postura somente-leitura, linhagem de origem, navegação
ontológica 1-hop entre `RuleSet`s, simulação no sandbox com
trace visual de divergência, prova operacional host-driven (`run-rules-studio-operational-test`)
e composição/publicação de snapshot candidato. As respostas HTTP são herméticas
para tornar o gate reprodutível no CI; a evidência integrada `4302 ↔ 8088`
(`e2e:live:multipersona`) continua sendo um gate separado com os hosts ativos.

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

O Studio deliberadamente não monta o grafo executável do `RuleSet` no navegador.
Essa operação exige o RuleSet completo, os IDs de origem, contrato do host e duas
aprovações distintas (`RULE_COMPOSITION_APPROVER`) segregadas do publicador
(`RULE_SNAPSHOT_PUBLISHER`). O Quickstart materializa esse candidato no compositor
Java do host (`/api/praxis/rules-studio/rule-sets/{ruleSetKey}/candidate`) usando
as definições governadas elegíveis e a definição promovida opcional; o browser
consome apenas o resumo sanitizado do candidato (`compositionDigest`,
`implementationCatalogDigest`, `currentHeadEtag`, `sources` e `authorizedActions`),
trata `409 STALE_RULESET_CANDIDATE` invalidando candidatos obsoletos e nunca recebe
o grafo executável. O Quickstart mantém readiness local no Actuator e publica
heartbeat redigido no Config. O Studio consome apenas o agregado server-derived
de hosts alinhados, com snapshot em drift, runtime incompatível, indisponíveis ou
com heartbeat vencido.

## Gates

```powershell
npm test
npm run check:projections
npm run build
```

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
Config/host/PostgreSQL, snapshots v1/v2 e execução create/update. O corpus de auxílio
extraordinário permanece disponível como caso de amplitude de regras, mas não é
tratado como evidência de publicação nem como paridade com sistema legado corporativo.

## Policy Assistant

O Studio não possui motor LLM próprio. Providers, resolução semântica de
intenção, conversas, streaming, clarificação, identidade e registry de tools
são reutilizados do Praxis Config e de `@praxisui/ai`.

O primeiro slice read-only já descobre decisões por intenção de negócio e explica
a definição selecionada. Na descoberta, o browser envia somente o pedido em
linguagem natural e o locale; o LLM escolhe semanticamente a tool
`searchDomainRules`, e o Config devolve apenas identidades seguras no escopo e na
autoridade resolvidos pelo servidor. O Studio rejeita terminais aplicáveis ou sem
o envelope `praxis-domain-rule-search.v1`. Candidatos válidos descobertos fora da
projeção inicial podem ser resolvidos e carregados sob demanda (`loadDiscoveredCandidate`)
a partir do catálogo canônico do Config, enquanto versões obsoletas em relação ao
catálogo carregado permanecem bloqueadas (`isStaleCandidate`).

Na explicação, o browser envia
somente `selectedDomainDecisionRef` com ID, rule key e versão, expondo fases
observáveis de progresso (`connecting`, `inspecting_evidence`, `synthesizing`). Em corporate mode,
o Config exige `RULE_DEFINITION_READER` antes de enfileirar o turno, relê a
definição no escopo do principal, aplica `governance.aiUsage` e devolve uma
projeção sanitizada. O Studio só apresenta a resposta quando a evidência terminal
vem de `inspectDomainDecision`, confirma exatamente a mesma versão, inclui os
fingerprints e declara `canApply=false`; uma resposta divergente, incompleta ou
aplicável é rejeitada. Facts runtime, tenant, atores, rationale e payloads
materializados não são enviados ao provider nem exibidos nessa superfície.

O `main` posterior ao beta.15 consome o catálogo canônico de facts e parâmetros por definição publicado pelo
Config através de `@praxisui/core`. O authoring oferece representações por intenção (`tree` / Árvore visual,
`table` / Tabela de decisão e `expression` / Expressão de domínio), propostas assistidas de diff de fronteira
(`buildSuggestedDraftDiffProposals`), sugestões assistidas de cenários tipados (`ALLOW` / `DENY` com `expectedReasonCodes`
em `buildSuggestedScenarioTemplates`), postura separada de maturidade técnica, estágio de aprovação e autoridade
operacional (`buildDecisionMaturityPosture`) e auditoria de sensibilidade/redaction de fatos.
No modo `Operar`, o Studio projeta a matriz de gates de governança, SoD (4-olhos), recibo de evidência
vinculado (`governance-bound-receipt`) e ETag (`buildGovernanceGateSummary`), a correlação causal com execução
e postura de SLO operacional (`buildExecutionCorrelationSummary`), a análise pré-publicação de impacto e `where-used`
do RuleSet (`buildRuleSetImpactSummary`) e a execução delegada de comandos (`SUBMIT`, `PROMOTE`, `PUBLISH_DEFINITION`)
mediante confirmação humana governada explícita (`requestDelegatedGateCommand`). Não há
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

## Política de CI e publicação

Validação local durante desenvolvimento; Actions apenas no fechamento necessário de versões. Consulte [ACTIONS-RELEASE-POLICY.md](ACTIONS-RELEASE-POLICY.md) para gatilhos, gates e recuperação.

### Seleção de operação de snapshots (candidato G3)

O cockpit seleciona a operação declarada na projeção. Uma única operação pode ser determinada sem ambiguidade; múltiplos perfis exigem escolha explícita antes das leituras. Trocar a operação limpa heads, versões, status, rollouts, composição e confirmação pendente e invalida respostas antigas. A ausência de escolha não aparece como ausência comprovada de head.

A preparação pelo endpoint neutro continua indisponível para famílias com mais de uma operação até o gate canônico de publisher por operação. Consultas e operações de versões existentes continuam separadas dessa capacidade; o browser não fabrica autoridade. O corte requer o novo Core e sua coorte de pacotes; a prova isolada usa tarball identificado, sem substituir o aceite de release público nem G4 visual/operacional.
