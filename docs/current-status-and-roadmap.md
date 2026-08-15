# Estado e roadmap do Praxis Policy Studio

- Baseline publicada: Studio `0.1.0-beta.8` e Quickstart `v2.0.0-rc.33`, com transporte,
  governance V58 e complemento host V59
- Data da auditoria: 2026-08-15
- Escopo: Studio beta.8, Config rc.113, Quickstart rc.33, Contracts beta.4,
  `@praxisui/*` rc.23 e handoff Ergon #300

## Leitura executiva

O produto corporativo completo está estimado em **60%**, com margem de ±5 pontos
percentuais. Essa estimativa mede capabilities comprovadas, não linhas de código.
A beta.8 demonstra um vertical slice relevante; o corte V58 fecha o transporte,
parte dos gates de evidência e a migração idempotente no Neon, mas ainda não é uma beta
corporativa segura para uso autônomo pelo Ergon.

Marcos diferentes têm distâncias diferentes:

| Marco | Estimativa atual | Significado |
| --- | ---: | --- |
| beta integrada controlada com Quickstart | 91% | jornada 4302↔8088, explicação IA e action operacional host-owned existem; faltam consumo UI e browser multi-persona |
| versão estável corporativa | 52% | segurança, actions restantes, E2E e operação corporativa |
| produto maduro multi-cliente com authoring complexo e IA | 32% | RuleSet completo, discovery, impacto, execução explicável e agente governado |

Rubrica das estimativas: `0` ausente, `25` seam/contrato, `50` vertical slice com
testes focais, `75` prova end-to-end controlada e `100` prova corporativa
multi-consumidor.

## Capabilities auditadas

| Capability | % | Aderência | Diagnóstico |
| --- | ---: | --- | --- |
| fronteiras canônicas e neutralidade | 85 | `ja-suportado-mal-nomeado-ou-mal-materializado` | owners corretos; ainda existe normalização Ergon no core |
| catálogo/discovery multi-domínio | 40 | `suportado-parcialmente` | carrega uma projeção configurada; não há registry governado |
| inspeção e explicação humana/IA | 72 | `suportado-parcialmente` | facts, precedência, expressão e explicação grounded da definição; falta correlação causal com execução |
| editar regra existente | 45 | `suportado-parcialmente` | condição focal; parâmetros, outcomes e RuleSet completo não são authorados |
| criar regra nova | 20 | `suportado-parcialmente` | Config possui intake; Studio apenas cria workspace de definição existente |
| cenários, sandbox e Test Run | 78 | `suportado-parcialmente` | candidate × active, baseline independente, retry e action host-owned existem; facts ainda são JSON e o Studio não consome a action |
| review/maker-checker | 70 | `suportado-parcialmente` | workspace, ETag, blockers, run submetido e segregação existem; política cobre SUBMIT/PROMOTE, não estágios posteriores |
| publicação/materialização | 50 | `lacuna-real-de-contrato` | readiness existe; action de publicação não é server-owned de ponta a ponta |
| snapshot, rollback e staged rollout | 55 | `suportado-parcialmente` | actions de snapshots/rollouts existentes; create rollout e rollout-policy ainda inferidos |
| evidência V58/V59/Ergon | 82 | `suportado-parcialmente` | contrato leve, action dedicada, reserva pré-DML, quatro quadrantes HTTP/PostgreSQL, gates e migração Neon existem; faltam adapter Ergon, smoke Neon da action e Oracle/HADES |
| segurança, multitenancy e capabilities | 62 | `suportado-parcialmente` | leitura, criação de versão, explicação e action operacional estão governadas; faltam actions de publicação/rollout, metadata de precondition e smokes cross-tenant |
| UX, i18n e acessibilidade | 40 | `ja-suportado-mal-nomeado-ou-mal-materializado` | workstation funcional; faltam i18n integral, E2E, axe e decomposição da página |
| testes, release e documentação | 80 | `suportado-parcialmente` | cadeia V58 e Quickstart rc.33 publicados; V59 prova HTTP com dois PostgreSQL; faltam axe, Neon da action e prova multi-persona |
| assistente de decisões | 48 | `suportado-parcialmente` | explicação da definição passou pelo browser e fluxo HTTP real com atestação e sem candidate API; busca, execução explicada e comandos delegados ainda faltam |

## Bloqueadores do próximo corte corporativo

1. **Actions completas:** Definition capabilities já são consumidas pelo client e
   pelo Studio. Publicação, create rollout e lifecycle da
   rollout-policy precisam de actions próprias; uma action nunca autoriza outra.
2. **Evidência governada:** a V58 oferece baseline independente por cenário,
   idempotência, vínculo do run submetido e política opt-in para `SUBMIT`/`PROMOTE`.
   Estágios posteriores ainda não vinculam/revalidam esse receipt.
3. **Consumo operacional governado:** a action Quickstart V59 existe, mas o Studio
   ainda não a consome. A metadata de collection action não representa o
   `If-Match` cross-resource do workspace; isso deve ser corrigido no owner antes da UI.
4. **Prova corporativa:** o comando local cobre `403`, `409`, `412`, `428`, retry e
   isolamento da referência por tenant/environment; ainda faltam browser multi-persona,
   smoke cross-tenant/Neon, `422` visual e Oracle/HADES autorizado.

## Gate de evidência

O gate pertence à governance server-owned da Definition/RuleSet:

- `SUBMIT` pode abrir revisão técnica com evidência `PENDING` quando a política
  permitir; o blocker continua visível;
- `PROMOTE` bloqueia, quando exigido, baseline inelegível, matriz incompleta,
  paridade incompleta e cleanup não comprovado;
- `PUBLISH`, snapshot, rollout e `ACTIVATE` ainda não reutilizam esse gate V58;
  essa extensão deve permanecer server-owned e vinculada ao receipt revisado;
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

Continuam fora desse gate a jornada visual multi-persona `4302 ↔ 8088`, axe, o consumo
da action operacional no Studio e uma prova Oracle/HADES. Elas pertencem aos próximos marcos,
não devem ser inferidas da migração de banco.

### P1 — capabilities e evidência

- publicar actions para publicação, create rollout e rollout-policy;
- estender a política de evidência ao publication/snapshot/activation somente
  depois que esses estágios vincularem o receipt revisado;
- exigir a reserva idempotente pré-DML já provada no Quickstart em todo novo adapter host-owned,
  além do replay por receipt já persistido.

### P2 — lane operacional de referência

- endpoint/action host-owned, bindings explícitos, capability dedicada, verificação integral
  `candidate × active` e reserva idempotente pré-DML — publicados no Quickstart rc.33/V59;
- representar `If-Match` cross-resource no contrato canônico e só então consumir no Studio;
- integrar o observer do baseline ao adapter Ergon real;
- `403`, `409`, `412`, `422`, `428`, retry, no-mutation e cleanup estão cobertos localmente;
  faltam cross-tenant e browser multi-persona;
- persistir a execução pelo endpoint no Neon e provar retry sem duplicação; a
  migração V58 e seu restart idempotente já foram comprovados no banco existente.

### P3 — hardening do Studio

- decompor o workspace em catálogo, inspeção, authoring, testes, review/publicação
  e operação, sob uma facade/store;
- substituir Facts JSON por editor derivado do fact schema;
- executar E2E desktop/narrow, teclado, axe e regressão visual focal;
- provar personas author, reviewer, operator e unauthorized.

### P4 — authoring complexo

- criar e editar RuleSet completo: identity, slots, bindings, parâmetros, reason
  codes, dependencies, diagnostics e compilation;
- oferecer representações por intenção — tabela, árvore ou expressão — sem tornar
  JSON bruto a unidade de negócio;
- adicionar diff semântico, where-used e impacto antes da publicação.

### P5 — Policy Assistant

- reutilizar runtime de IA do Config e `@praxisui/ai` — concluído para explicação;
- explicação read-only com evidência sanitizada — concluída; busca/discovery permanece pendente;
- depois propor cenários e diffs, criar/editar e submeter pela mesma API humana;
- permitir publicação/operação apenas como comando delegado, com capability,
  confirmação, ETag e revalidação; o agente nunca se autoaprova nem contorna SoD.

## Gatilhos de release

O agente Ergon pode iniciar a fase repository-only usando a cadeia V58 publicada e
o contrato da action V59 como referência de host, junto do client leve beta.4,
do exemplo de um Test Run/quatro results e deste handoff.
Canários Oracle/HADES continuam condicionados ao ambiente autorizado e à lane
operacional remota ou a um adapter host-owned equivalente.
Uma versão estável exige também P2/P3, isolamento entre
tenant/environment, recuperação de conflito, auditoria/redaction, SLO e rollback
comprovado. O assistente explicativo já pode ser validado de forma incremental e
continua deliberadamente separado do authoring autônomo.
