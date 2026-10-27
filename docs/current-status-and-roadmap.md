# Estado e roadmap do Praxis Policy Studio

- Baseline de desenvolvimento validada: Studio `main@05903ac` mais o corte local
  de integridade corporativa e adoção direta de `DomainRuleService.getDefinitionParameters`,
  Config `0.1.0-rc.128` e Quickstart `main@5448625`, com transporte, governance V58,
  snapshot v1/v2, bootstrap rollout / guarda `RUNTIME_INCOMPATIBLE` e cadeia de folha host-owned no Neon homologado
- Data da auditoria: 2026-10-27
- Escopo: Studio pós-beta.15, Metadata rc.127, Config rc.128, Quickstart rc.43,
  Contracts beta.4, `@praxisui/*` `10.0.0-rc.36` e handoff Ergon #300

## Leitura executiva

O produto corporativo completo está estimado em **66%**, com margem de ±5 pontos
percentuais. Essa estimativa mede capabilities comprovadas, não linhas de código.
A beta.15 demonstra um vertical slice relevante, materializa no cockpit os
blockers tipados do gate de snapshot e separa explicitamente a identidade do
RuleSet do recurso operacional host-owned usado para action discovery; o corte V63 fecha as actions
principal-specific de publicação e rollout; o corte V61 fecha o discovery
operacional cross-resource e o corte V58 fecha o transporte,
parte dos gates de evidência e a execução idempotente no Neon. O corte publicado
também separa seis identidades de laboratório e prova a matriz positiva/negativa por
login, JWT, cookie, troca de sessão e matchers HTTP reais. O Studio agora também
materializa o logout canônico e invalida o estado governado local ao encerrar a
sessão; não transforma o laboratório em seletor de personas. Ainda não é uma beta corporativa segura para uso autônomo
pelo Ergon.

Marcos diferentes têm distâncias diferentes:

| Marco | Estimativa atual | Significado |
| --- | ---: | --- |
| beta integrada controlada com Quickstart | 96% | contratos, action discovery, catálogo não vazio no Neon, sincronização de projeções (incluindo G4 de folha), suíte unitária (`19/19` arquivos / `146/146` testes), E2E hermético (`23/23` ativos desktop+narrow) e suíte browser live multi-persona (`7/7`) foram comprovados no HEAD atual com `@praxisui/*` `10.0.0-rc.36`; falta publicar nova tag do Studio |
| versão estável corporativa | 60% | isolamento estrutural, segregação, sessão/catálogo, workspace, sandbox e diálogos críticos foram provados; faltam Neon cross-tenant, gates posteriores, decomposição adicional do workspace e operação sustentada |
| produto maduro multi-cliente com authoring complexo e IA | 34% | RuleSet completo, discovery amplo, impacto, execução explicável e agente governado |

Rubrica das estimativas: `0` ausente, `25` seam/contrato, `50` vertical slice com
testes focais, `75` prova end-to-end controlada e `100` prova corporativa
multi-consumidor.

## Capabilities auditadas

| Capability | % | Aderência | Diagnóstico |
| --- | ---: | --- | --- |
| fronteiras canônicas e neutralidade | 96 | `suportado` | owners corretos; normalização legada de prefixo Ergon removida de `decision-inspection.ts` e expressões JSON Logic formatadas de forma 100% agnóstica a domínio |
| catálogo/discovery multi-domínio | 92 | `suportado-parcialmente` | o catálogo canônico paginado materializou sete decisões neutras persistidas no Neon, o assistente descobre identidades governadas no escopo server-owned e `catalogSummary()` consome canonicamente `/definitions/{id}/facts` e `/definitions/{id}/parameters`, materializando condição, workspace, `parameterCatalog`, `factCatalog`, `reasonCode`, rótulos/descrições localizadas, evidências (`evidenceRefs`/`sourceArtifacts`) e convivendo de forma governada com famílias de regras sem `factCatalog` (`visual_guidance`, `form_rule`, `color_palette`) |
| inspeção e explicação humana/IA | 88 | `suportado-parcialmente` | facts, precedência, expressão, fases observáveis de progresso da IA (`connecting` / `inspecting_evidence` / `synthesizing`), explicação grounded da definição e correlação causal com execução e SLO operacional (`buildExecutionCorrelationSummary`) |
| editar regra existente | 88 | `suportado-parcialmente` | condição focal carregada, representações por intenção (`tree`, `table` com proteção `lossless: false` contra achatamento destrutivo, e `expression`), parâmetros do template governado resolvidos via `/definitions/{id}/parameters` com overlay reativo de workspace (`parameterValues`), validação estrita contra limpeza de campos numéricos obrigatórios e `effect` operacional explícito (`BLOCK`/`ALLOW`) authorados e comparados no `semanticDiff` |
| criar regra nova | 72 | `suportado-parcialmente` | o painel de catálogo do Studio registra novas definições governadas (`DomainRuleService.createDefinition`) com `effect` explícito (`BLOCK`/`ALLOW`) e recarrega o catálogo |
| cenários, sandbox e Test Run | 90 | `suportado-parcialmente` | cenário e Test Run reais provaram candidate `ALLOW` e active fail-closed sem snapshot; o Studio deriva inputs tipados do catálogo canônico de facts (incluindo `array<number>` / `number-array` alinhados no Config) e usa JSON estruturado apenas para preview ou para famílias de decisão sem `factCatalog` declarado; baseline independente, retry, asserções e action host-owned existem |
| review/maker-checker | 88 | `suportado-parcialmente` | workspace, ETag, blockers, run submetido (`submittedTestRunId` + elegibilidade de baseline vinculados até publicação), segregação 4-olhos e execução delegada com confirmação governada (`requestDelegatedGateCommand`) comprovados |
| publicação/materialização | 85 | `suportado-parcialmente` | readiness e action `PUBLISH` são server-owned, com inspeção automática de prontidão no disparo delegado (`PUBLISH_DEFINITION`), recibo de evidência vinculado (`governance-bound-receipt`) e confirmação governada no gate de publicação |
| snapshot, rollback e staged rollout | 97 | `suportado-parcialmente` | composição assistida host-owned de snapshot candidato (`/api/praxis/policy-studio/rule-sets/{ruleSetKey}/candidate`, `/candidate/approvals`, `/candidate/publish` sem expor o grafo executável ao browser), análise reativa pré-publicação de impacto e `where-used` (superfícies operacionais, operações vinculadas, fatos compartilhados entre regras, composição de slots do RuleSet, diagnóstico de lacunas `MISSING_SLOT_FACTS` e alerta de rascunhos irmãos não promovidos), segregação 4-olhos via `authorizedActions` (`PREPARE`/`APPROVE`/`PUBLISH`), tratamento de `409 STALE_RULESET_CANDIDATE`, blockers tipados server-owned, rollback governado de snapshot com `If-Match` Head ETag e confirmação explícita, create/cancel/activate rollout e lifecycle de rollout-policy são principal-specific |
| evidência V58/V60/Ergon | 89 | `suportado-parcialmente` | contrato leve, action dedicada, reserva pré-DML e quatro quadrantes foram provados; a cadeia publicada de folha confirmou snapshots v1/v2 e execução no Neon sem duplicação; faltam adapter Ergon e Oracle/HADES |
| segurança, multitenancy e capabilities | 85 | `suportado-parcialmente` | publicação e rollout não são mais inferidos no browser; seis sujeitos separados passaram pela cadeia HTTP publicada; author abriu o catálogo no site homologado e auditor permaneceu read-only; faltam Neon cross-tenant e matriz visual multi-persona completa |
| UX, i18n e acessibilidade | 88 | `suportado-parcialmente` | decomposição completa do workspace em store/facades/componentes dedicados, i18n bilíngue (`pt-BR` e `en-US`) em toda a workstation/authoring/cockpit e validação Playwright desktop/narrow, teclado e Axe cobrindo fluxos corporativos e `en-US` |
| testes, release e documentação | 97 | `suportado-parcialmente` | cadeia V61, prova HTTP/PostgreSQL/Neon V60, E2E hermético V62, discovery/explanation desktop+narrow e matriz de segurança multi-persona publicados; o teste agora recusa catálogo vazio, mas essa asserção nova ainda precisa ser repetida no site publicado |
| assistente de decisões | 85 | `suportado-parcialmente` | discovery semântico com carregamento sob demanda fora da projeção ativa (`loadDiscoveredCandidate`), explicação com fases de progresso observáveis, sugestões assistidas de cenários e diffs (`buildSuggestedScenarioTemplates` / `buildSuggestedDraftDiffProposals`), correlação causal de execução e comandos delegados com confirmação governada (`requestDelegatedGateCommand`) |

## Bloqueadores do próximo corte corporativo

1. **Actions completas:** concluído no V63 para publicação, create rollout e
   lifecycle de rollout-policy. Config publica ações principal-specific e o Studio
   nunca reutiliza uma action para autorizar outra operação.
2. **Evidência governada:** a V58 oferece baseline independente por cenário,
   idempotência, vínculo do run submetido e política opt-in. O Config rc.119
   revalida o receipt na composição de snapshot e devolve blockers tipados; o
   Studio beta.15 os explica sem interpretar mensagens humanas. A cadeia de sessão,
   catálogo e segregação de papéis passou no browser integrado multi-persona; a
   jornada mutável completa por persona permanece no próximo gate.
3. **Consumo operacional governado:** concluído no V61. Metadata representa o
   `If-Match` cross-resource e Core/Studio descobrem e executam a action sem URL local.
   Desde o beta.12, o Studio também congela `Idempotency-Key` e `evaluatedAtUtc` após falha incerta,
   fechando no browser a mesma garantia de replay já existente no host e no Config.
4. **Prova corporativa:** o comando no Neon cobre `403`, `409`, `412`, `422`, `428`,
   retry sem duplicação, quatro quadrantes e rollback que preserva o audit append-only;
   o browser hermético cobre capability negada, confirmação e `412`. O host publicado prova
   author, dois approvers, publisher, operator e auditor como sujeitos mutuamente exclusivos na
   cadeia HTTP publicada. A prova local no mesmo PostgreSQL também confirma escopo server-owned, replay
   idempotente no escopo do principal e `404` para workspace estrangeiro. A suíte browser integrada
   passou depois com anonymous e as seis personas contra os dois serviços publicados; ainda faltam
   repetição cross-tenant no Neon e Oracle/HADES autorizado.

## Prova publicada multi-persona de 2026-08-15

O Quickstart no Render executou o commit `608584c` com health `200`, build
`2.0.0-rc.40`, schema operacional `20260814.001` e Config `V58`. O datasource
operacional foi confirmado na branch Neon autorizada `enterprise-proof-homolog`;
o Config permaneceu no datasource Neon versionado já existente. Nenhum banco ou
schema paralelo foi criado.

A prova sanitizada confirmou:

- login e sessão reais das seis personas;
- leitura de Definitions por todas elas;
- authoring somente pelo author, review somente pelos dois approvers, publicação
  somente pelo publisher e operação somente pelo operator;
- auditor read-only, com a action operacional negada por `403`;
- Origin e CORS oficiais para `http://localhost:4302` e
  `http://127.0.0.1:4302`, incluindo preflight `200`;
- payloads deliberadamente inválidos nos probes autorizados, evitando criar
  Definition, workspace, publicação, snapshot ou Test Run durante a matriz.

O PR `#29` publicou depois o Studio em
`https://praxis-policy-studio-homolog.onrender.com`. A origin exata passou por
CORS e pelo filtro do Config; uma sessão de author carregou as dez decisões no
browser e uma sessão de auditor preservou leitura `200` com escrita `403`.

O Quickstart PR `#199` alinhou depois o seed ao escopo configurado do Rule Lab. Na
homologação `default/prod`, o author carregou a condição, criou workspace e
cenário e persistiu um Test Run: candidate `ALLOW`, active
`TECHNICAL_ERROR/ACTIVE_SNAPSHOT_UNAVAILABLE`. Isso fecha o sandbox candidate e
prova fail-closed sem snapshot, mas não fecha publicação/ativação.

Em 2026-08-17, a suíte Playwright live completa passou com sete testes contra o
Studio homologado e o Quickstart no commit `375e6c0`: anonymous mais as seis
personas. Cada persona leu o mesmo catálogo com e sem headers adversariais de
tenant/environment, e os resultados permaneceram idênticos porque o escopo é
resolvido no servidor. O corte ainda não repete workspace estrangeiro no Neon e
não constitui paridade Oracle/HADES.

Em 2026-08-18, o Config `rc.127` corrigiu a busca do catálogo em PostgreSQL e o
Quickstart `482cdf9` passou a materializar, depois da auto-configuração do Config,
o seed idempotente de sete decisões JSON Logic do caso neutro. A prova local
corporativa usou o mesmo Neon `enterprise-proof-homolog` e passou `7/7`, agora
exigindo pelo menos uma decisão governada na lista — um shell vazio não conta mais
como sucesso. Headers adversariais continuaram sem alterar o escopo server-owned.
O Render publicou o backend no deploy `dep-da1t4s142hec73f572hg` e o Studio no
deploy `dep-da1t7bnqj5pc73d4csf0`, ambos `live`; health e recusa anônima `403`
foram repetidos. As credenciais do ambiente não foram extraídas do Render, por
isso a asserção nova de lista não vazia permanece pendente de repetição publicada.

## Gate de evidência

O gate pertence à governance server-owned da Definition/RuleSet:

- `SUBMIT` pode abrir revisão técnica com evidência `PENDING` quando a política
  permitir; o blocker continua visível;
- `PROMOTE` bloqueia, quando exigido, baseline inelegível, matriz incompleta,
  paridade incompleta e cleanup não comprovado;
- a composição de snapshot revalida o receipt revisado e publica blockers
  estáveis; políticas adicionais de `PUBLISH`, rollout e `ACTIVATE` devem
  permanecer server-owned;
- exigir evidência antes de revisão é uma opção de governance, não default da V58
  nem inferência do browser.

O owner Config reutilizou o objeto `governance.testEvidencePolicy` da Definition.
Não existe uma segunda entidade de requirements apenas para o Studio.

## Sequência de entrega

### P0 — integridade e release (concluído para a beta.8)

- Contracts beta.4, Config rc.113, Quickstart rc.32, UI rc.23 e Studio beta.8
  foram publicados sem dependência `SNAPSHOT`;
- o Config aplicou V58 no banco Neon já configurado e, no reinício, confirmou
  schema atual sem reaplicação; nenhum banco ou schema paralelo foi criado;
- o host respondeu health e o Studio em 4302 autenticou no Quickstart em 8088,
  leu 10 decisões, lifecycle, snapshot ativo e alinhamento agregado do host;
- a explicação assistida terminou no browser com versão/fingerprints atestados,
  redaction e recusa explícita de inferir evidência ausente;
- tags anteriores permaneceram imutáveis.

Continuam fora desse gate a jornada visual multi-persona `4302 ↔ 8088`, axe e uma
prova Oracle/HADES. Elas pertencem aos próximos marcos,
não devem ser inferidas da migração de banco.

### P1 — capabilities e evidência

- manter as actions principal-specific de publicação, create rollout e rollout-policy como gate — concluído no V63;
- estender a política de evidência ao publication/snapshot/activation somente
  depois que esses estágios vincularem o receipt revisado;
- exigir a reserva idempotente pré-DML já provada no Quickstart em todo novo adapter host-owned,
  além do replay por receipt já persistido.

### P2 — lane operacional de referência

- endpoint/action host-owned, bindings explícitos, capability dedicada, verificação integral
  `candidate × active` e reserva idempotente pré-DML — validados no Quickstart rc.34/V60;
- `If-Match` cross-resource no contrato canônico e consumo por discovery no Studio — concluídos no V61;
- integrar o observer do baseline ao adapter Ergon real;
- `403`, `409`, `412`, `422`, `428`, retry, no-mutation e cleanup estão cobertos localmente;
  o isolamento de workspace entre dois tenants no mesmo PostgreSQL/schema também está coberto,
  sem confiar em `X-Tenant-ID`/`X-Env`; faltam repetição no Neon e browser multi-persona;
- execução pelo endpoint no Neon e retry sem duplicação — comprovados em um Test Run
  com quatro resultados; a migração V58 e seu restart idempotente usam o banco existente.

### P3 — hardening do Studio

- manter a matriz HTTP real de seis personas como gate do Quickstart — concluído
  no host publicado e validado pela suíte Playwright live multi-persona (`7/7`)
  contra Quickstart + Neon;
- decompor o workspace em catálogo, inspeção, authoring, testes, review/publicação
  e operação, sob uma facade/store — concluído com `CatalogSelectionStore`,
  `WorkspaceAuthoringFacade`, `ScenarioSandboxFacade`, `SnapshotExecutionFacade` e
  `catalog-presentation.ts`, mantendo `CatalogWorkspaceComponent` como coordenador
  de view/template e delegando `getDefinitionParameters` diretamente ao
  `DomainRuleService` de `@praxisui/core` (`10.0.0-rc.36`) e candidatos de snapshot
  com fallback tipado enquanto aguarda publicação do próximo RC de `@praxisui/core`;
- validar o catálogo canônico de facts (`/definitions/{id}/facts`) e o editor tipado contra o
  Quickstart/Neon publicado, mantendo JSON estruturado para preview ou famílias sem `factCatalog` declarado — concluído;
- manter E2E desktop/narrow, teclado, axe e regressão visual focal como gate — concluído no V62;
- provar personas author, reviewer, operator e unauthorized, além de recuperação assistida de conflito (`409` / `412` / `428`) via `reloadGovernedEvidence()` — concluído para a bateria E2E multi-persona da jornada 4-olhos (`author` -> `reviewer` -> `publisher`/`operator`) e ressincronização de revisão/ETag em `e2e/policy-studio-corporate.spec.ts`.

### P4 — authoring complexo

- criar e editar RuleSet completo: identity, slots, bindings, parâmetros, reason
  codes, dependencies, diagnostics e compilation — concluído para o mapa estrutural e diagnóstico pré-compilação do RuleSet (`RuleSetStructuralDiagnostic`, `reasonCodes`, `parameterNames`, `hostContractVersions`, `operationalEffect`, precedência de slots e validação de composição assistida) no `SnapshotCockpitComponent`;
- oferecer representações por intenção — tabela, árvore ou expressão — sem tornar
  JSON bruto a unidade de negócio — concluído em `LocalDraftWorkspaceComponent` (`tree` / Árvore visual, `table` / Tabela de decisão com `extractDecisionTableProjection` + `compileDecisionTableProjection`, e `expression` / Expressão de domínio com `formatDecisionExpression`);
- adicionar diff semântico, where-used e impacto antes da publicação — concluído para `semanticDiff` de condições/parâmetros/efeitos operacionais e para o painel reativo de impacto e `where-used` de RuleSet (`buildRuleSetImpactSummary`) no `SnapshotCockpitComponent`.

### P5 — Policy Assistant

- reutilizar runtime de IA do Config e `@praxisui/ai` — concluído para discovery e explicação;
- discovery read-only por intenção e explicação com evidência sanitizada — concluídos, incluindo resolução e carregamento sob demanda (`loadDiscoveredCandidate`) de candidatos descobertos fora da projeção inicial sem aceitar versões obsoletas (`isStaleCandidate`);
- catálogo canônico multi-domínio — implementado no corte beta seguinte; `projectionPath` ficou como enriquecimento opcional;
- materializar facts, labels e evidência do catálogo semântico via endpoints canônicos (`/definitions/{id}/facts` e `/definitions/{id}/parameters`) sem fallbacks locais de extração — concluído em `ProjectionCatalogService.catalogSummary()` e `ProjectionCatalogService.parameterCatalog()`;
- depois propor cenários e diffs, criar/editar e submeter pela mesma API humana — concluído para sugestões assistidas de cenários de teste tipados (`ALLOW` / `DENY` com `expectedReasonCodes`) em `buildSuggestedScenarioTemplates` e para propostas assistidas de diff de condição e parâmetros (`buildSuggestedDraftDiffProposals` e `[data-testid="assisted-diff-proposals"]`);
- permitir publicação/operação apenas como comando delegado, com capability,
  confirmação, ETag e revalidação; o agente nunca se autoaprova nem contorna SoD — concluído para a matriz auditável de gates de governança, SoD (4-olhos), recibo de evidência vinculado (`governance-bound-receipt`), precondições ETag (`buildGovernanceGateSummary` em `catalog-presentation.ts`), correlação causal de execução/SLO (`buildExecutionCorrelationSummary`) e execução delegada com confirmação governada explícita (`requestDelegatedGateCommand` em `CatalogWorkspaceComponent`).

## Gatilhos de release

O agente Ergon pode iniciar a fase repository-only usando a cadeia V58 publicada e
o contrato da action V60 como referência de host, junto do client leve beta.4,
do exemplo de um Test Run/quatro results e deste handoff.
Canários Oracle/HADES continuam condicionados ao ambiente autorizado e à lane
operacional remota ou a um adapter host-owned equivalente.
Uma versão estável exige também P2/P3, repetição do isolamento entre
tenant/environment no Neon, recuperação de conflito, auditoria/redaction, SLO e rollback
comprovado. O assistente explicativo já pode ser validado de forma incremental e
continua deliberadamente separado do authoring autônomo.

## Corte UX de navegação e linguagem — 2026-08-18

O corte posterior à beta.15 substitui a página técnica longa por modos de trabalho
exclusivos: `Entender`, `Regra`, `Testar`, `Operar` e `Histórico`. Cada comando
materializa somente o painel necessário e move o foco dentro da workstation sem
alterar a URL, recarregar `app-config.json`, invalidar a seleção, recriar o
workspace ou fechar o editor. Ao trocar de modo, o draft governado permanece em
memória; ao trocar de decisão, a interface volta deliberadamente para `Entender`.
A regressão é coberta no E2E desktop/narrow junto do round-trip de edição,
cenário tipado, sandbox e ETag, e por teste unitário dedicado à preservação do
draft entre modos.

O mesmo corte:

- explicita quando a decisão aberta ficou fora do filtro local;
- prioriza visualmente `Criar rascunho`/`Editar regra` e mantém a explicação por
  IA como ação consultiva;
- mantém feedback de comandos junto à navegação de tarefas, para que salvar ou
  falhar não produza uma mensagem oculta em outro modo;
- substitui a afirmação ampla “evidência técnica verificada” por “estrutura
  técnica disponível”;
- apresenta `FAIL_CLOSED` em linguagem humana e move operações, contrato do host
  e valor canônico para detalhes técnicos;
- falha de forma explícita quando a condição usa dados que o catálogo de facts
  não publicou, sem fabricar um schema no frontend.

A navegação corrigida revelou dois botões contextuais sem nome acessível no
`@praxisui/visual-builder`. A correção pertence ao owner da biblioteca e foi
validada pelo teste focal do editor e pelo Axe do Policy Studio em desktop e
narrow. O manifesto AI e o registry não mudam: não houve alteração de API,
configuração, JSON Logic ou operação authorable.

A separação explícita entre maturidade técnica, estágio de aprovação em 4-olhos e
autoridade operacional em runtime (`buildDecisionMaturityPosture` e
`[data-testid="decision-maturity-posture"]`), a auditoria de sensibilidade e
redaction do catálogo de fatos (`[data-testid="fact-redaction-summary"]`) e a
observabilidade de fases intermediárias do progresso da explicação assistida antes
do timeout terminal (`DecisionExplanationProgressPhase` e
`[data-testid="ai-explanation-progress-phase"]`) foram concluídas no Studio.
Definições pertencentes a famílias de regras de UI (`visual_guidance`, `form_rule`,
`color_palette`) ou rascunhos recém-criados sem `factCatalog` retornam `facts: []`
em `/definitions/{id}/facts` e são projetadas como `CATALOG_IDENTITY_ONLY` para
authoring visual de condição, enquanto decisões da projeção governada exigem
catálogo de fatos completo (`CONFIG_FACT_CATALOG_INCOMPLETE` fail-closed).

### Fluxo narrow e hierarquia de identidade

O corte seguinte materializa o narrow como fluxo `catálogo → decisão`, em vez de
empilhar uma lista rolável e toda a workstation na mesma página. A seleção abre a
decisão em uma superfície dedicada; `Voltar ao catálogo` preserva a identidade,
o workspace e o draft governado. A decisão aberta possui seu próprio heading
principal e devolve foco ao filtro ao retornar.

Código da decisão e chave canônica deixaram de competir com o nome empresarial
na lista e no cabeçalho. Eles continuam disponíveis em `Ver valores técnicos` e
no nome acessível da linha. Esta é uma correção `ja-suportado-so-ux`; nenhum DTO,
endpoint ou contrato público foi criado. A ausência de catálogo de facts segue
classificada como `suportado-parcialmente` e falha fechada até a fonte governada
publicar os dados necessários.
