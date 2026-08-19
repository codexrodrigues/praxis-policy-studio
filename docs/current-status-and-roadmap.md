# Estado e roadmap do Praxis Policy Studio

- Baseline de desenvolvimento validada: Studio `main@2ce1035` mais o corte local
  de integridade corporativa, Config `0.1.0-rc.128` e Quickstart `main@5448625`,
  com transporte, governance V58,
  snapshot v1/v2 e cadeia de folha host-owned no Neon homologado
- Data da auditoria: 2026-08-19
- Escopo: Studio pós-beta.15, Metadata rc.127, Config rc.128, Quickstart rc.43,
  Contracts beta.4, `@praxisui/*` rc.38 e handoff Ergon #300

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
| beta integrada controlada com Quickstart | 92% | contratos, action discovery, catálogo não vazio no Neon e matriz browser multi-persona foram comprovados; falta repetir os E2E no HEAD exato com UI rc.38 e publicar nova tag do Studio |
| versão estável corporativa | 60% | isolamento estrutural, segregação, sessão/catálogo, workspace, sandbox e diálogos críticos foram provados; faltam Neon cross-tenant, gates posteriores, decomposição adicional do workspace e operação sustentada |
| produto maduro multi-cliente com authoring complexo e IA | 34% | RuleSet completo, discovery amplo, impacto, execução explicável e agente governado |

Rubrica das estimativas: `0` ausente, `25` seam/contrato, `50` vertical slice com
testes focais, `75` prova end-to-end controlada e `100` prova corporativa
multi-consumidor.

## Capabilities auditadas

| Capability | % | Aderência | Diagnóstico |
| --- | ---: | --- | --- |
| fronteiras canônicas e neutralidade | 85 | `ja-suportado-mal-nomeado-ou-mal-materializado` | owners corretos; ainda existe normalização Ergon no core |
| catálogo/discovery multi-domínio | 65 | `suportado-parcialmente` | o catálogo canônico paginado materializou sete decisões neutras persistidas no Neon e o assistente descobre identidades governadas no escopo server-owned; o enriquecimento detalhado ainda depende da projeção ativa |
| inspeção e explicação humana/IA | 74 | `suportado-parcialmente` | facts, precedência, expressão e explicação grounded da definição; falta correlação causal com execução |
| editar regra existente | 50 | `suportado-parcialmente` | condição focal carregada e round-trip visual aberto sobre workspace real; parâmetros, outcomes e RuleSet completo não são authorados |
| criar regra nova | 20 | `suportado-parcialmente` | Config possui intake; Studio apenas cria workspace de definição existente |
| cenários, sandbox e Test Run | 90 | `suportado-parcialmente` | cenário e Test Run reais provaram candidate `ALLOW` e active fail-closed sem snapshot; o beta.15 deriva inputs tipados do catálogo canônico de facts e mantém JSON apenas como preview/fallback; baseline independente, retry, asserções e action host-owned existem |
| review/maker-checker | 70 | `suportado-parcialmente` | workspace, ETag, blockers, run submetido e segregação existem; política cobre SUBMIT/PROMOTE, não estágios posteriores |
| publicação/materialização | 58 | `suportado-parcialmente` | readiness e action `PUBLISH` são server-owned; o gate de evidência ainda não alcança publicação |
| snapshot, rollback e staged rollout | 72 | `suportado-parcialmente` | blockers de evidência são server-owned, tipados e explicados pelo Studio; create/cancel/activate rollout e lifecycle de rollout-policy são principal-specific; falta prova multi-persona integrada |
| evidência V58/V60/Ergon | 89 | `suportado-parcialmente` | contrato leve, action dedicada, reserva pré-DML e quatro quadrantes foram provados; a cadeia publicada de folha confirmou snapshots v1/v2 e execução no Neon sem duplicação; faltam adapter Ergon e Oracle/HADES |
| segurança, multitenancy e capabilities | 85 | `suportado-parcialmente` | publicação e rollout não são mais inferidos no browser; seis sujeitos separados passaram pela cadeia HTTP publicada; author abriu o catálogo no site homologado e auditor permaneceu read-only; faltam Neon cross-tenant e matriz visual multi-persona completa |
| UX, i18n e acessibilidade | 50 | `ja-suportado-mal-nomeado-ou-mal-materializado` | Playwright desktop/narrow, teclado e axe cobrem estados corporativos focais; o site homologado prova shell, sessão e catálogo reais; faltam i18n integral, seis personas no browser e decomposição da página |
| testes, release e documentação | 97 | `suportado-parcialmente` | cadeia V61, prova HTTP/PostgreSQL/Neon V60, E2E hermético V62, discovery/explanation desktop+narrow e matriz de segurança multi-persona publicados; o teste agora recusa catálogo vazio, mas essa asserção nova ainda precisa ser repetida no site publicado |
| assistente de decisões | 58 | `suportado-parcialmente` | discovery semântico e explicação usam o runtime horizontal, terminais read-only e evidência atestada; faltam seleção fora da projeção ativa, execução explicada e comandos delegados |

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
  no host publicado; o site estático prova author e auditor, enquanto a suíte
  Playwright live completa continua pendente;
- decompor o workspace em catálogo, inspeção, authoring, testes, review/publicação
  e operação, sob uma facade/store;
- repetir o catálogo canônico de facts e o editor tipado do beta.15 contra o
  Quickstart/Neon publicado; JSON permanece apenas como fallback legado;
- manter E2E desktop/narrow, teclado, axe e regressão visual focal como gate — concluído no V62;
- provar personas author, reviewer, operator e unauthorized.

### P4 — authoring complexo

- criar e editar RuleSet completo: identity, slots, bindings, parâmetros, reason
  codes, dependencies, diagnostics e compilation;
- oferecer representações por intenção — tabela, árvore ou expressão — sem tornar
  JSON bruto a unidade de negócio;
- adicionar diff semântico, where-used e impacto antes da publicação.

### P5 — Policy Assistant

- reutilizar runtime de IA do Config e `@praxisui/ai` — concluído para discovery e explicação;
- discovery read-only por intenção e explicação com evidência sanitizada — concluídos;
- catálogo canônico multi-domínio — implementado no corte beta seguinte; `projectionPath` ficou como enriquecimento opcional;
- materializar facts, labels e evidência do catálogo semântico para eliminar o enriquecimento estático também no authoring;
- depois propor cenários e diffs, criar/editar e submeter pela mesma API humana;
- permitir publicação/operação apenas como comando delegado, com capability,
  confirmação, ETag e revalidação; o agente nunca se autoaprova nem contorna SoD.

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

Permanecem como gaps canônicos: publicar o catálogo de facts para todas as
definições, separar com precisão maturidade técnica, aprovação e autoridade
operacional, e tornar o progresso da explicação assistida observável antes do
timeout terminal.

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
