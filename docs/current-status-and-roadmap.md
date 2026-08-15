# Estado e roadmap do Praxis Policy Studio

- Baseline publicada: `0.1.0-beta.7` (`ebea1eb`), com beta.8/V58 em validação local
- Data da auditoria: 2026-08-14
- Escopo: Studio beta.8 candidato, Config rc.113 candidato, Quickstart rc.32
  candidato, Contracts beta.4 candidato, `@praxisui/*` rc.23 candidato e handoff Ergon #300

## Leitura executiva

O produto corporativo completo está estimado em **56%**, com margem de ±5 pontos
percentuais. Essa estimativa mede capabilities comprovadas, não linhas de código.
A beta.7 demonstra um vertical slice relevante; o corte V58 fecha o transporte
e parte dos gates de evidência, mas ainda não é uma beta
corporativa segura para uso autônomo pelo Ergon.

Marcos diferentes têm distâncias diferentes:

| Marco | Estimativa atual | Significado |
| --- | ---: | --- |
| beta integrada controlada com Quickstart | 82% | jornada supervisionada em ambiente de referência; falta Neon/browser multi-persona |
| versão estável corporativa | 49% | segurança, actions restantes, E2E, operação e release coerentes |
| produto maduro multi-cliente com authoring complexo e IA | 31% | RuleSet completo, discovery, impacto, execução explicável e agente governado |

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
| cenários, sandbox e Test Run | 72 | `suportado-parcialmente` | candidate × active, baseline independente e retry idempotente existem; facts ainda são JSON e lane operacional não é remota |
| review/maker-checker | 70 | `suportado-parcialmente` | workspace, ETag, blockers, run submetido e segregação existem; política cobre SUBMIT/PROMOTE, não estágios posteriores |
| publicação/materialização | 50 | `lacuna-real-de-contrato` | readiness existe; action de publicação não é server-owned de ponta a ponta |
| snapshot, rollback e staged rollout | 55 | `suportado-parcialmente` | actions de snapshots/rollouts existentes; create rollout e rollout-policy ainda inferidos |
| evidência V58/Ergon | 65 | `suportado-parcialmente` | contrato leve, baseline por cenário, idempotência, quatro quadrantes locais e gates existem; faltam adapter Ergon, Neon/Oracle e endpoint operacional |
| segurança, multitenancy e capabilities | 58 | `suportado-parcialmente` | leitura, criação de versão e explicação estão governadas; faltam actions de publicação/rollout e smokes cross-tenant |
| UX, i18n e acessibilidade | 40 | `ja-suportado-mal-nomeado-ou-mal-materializado` | workstation funcional; faltam i18n integral, E2E, axe e decomposição da página |
| testes, release e documentação | 66 | `suportado-parcialmente` | gates focais, 505 testes Quickstart e docs V58; faltam releases finais, browser/axe, Neon e prova multi-persona |
| assistente de decisões | 45 | `suportado-parcialmente` | explicação da definição passou pelo fluxo HTTP real com atestação e sem candidate API; busca, execução explicada e comandos delegados ainda faltam |

## Bloqueadores do próximo corte corporativo

1. **Role matrix:** `RULE_DEFINITION_READER` está publicada desde o Config rc.111;
   o rc.112 acrescenta o roteamento semântico focal e a cadeia Quickstart prova
   401/403/201 antes de enfileirar a explicação.
2. **Actions completas:** Definition capabilities já são consumidas pelo client e
   pelo Studio. Publicação, create rollout e lifecycle da
   rollout-policy precisam de actions próprias; uma action nunca autoriza outra.
3. **Evidência governada:** a V58 oferece baseline independente por cenário,
   idempotência, vínculo do run submetido e política opt-in para `SUBMIT`/`PROMOTE`.
   Estágios posteriores ainda não vinculam/revalidam esse receipt.
4. **Lane operacional remota:** o executor Quickstart é uma seam interna usada por
   testes; não há endpoint/action/capability para Studio ou adapter Ergon.
5. **Integridade de release:** Contracts beta.4, Config rc.113, Quickstart rc.32,
   UI rc.23 e Studio beta.8 precisam ser publicados nessa ordem. Tags anteriores
   permanecem imutáveis e não contêm o corte V58.

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

### P0 — integridade e release

- publicar, em ordem, Contracts beta.4, Config rc.113, Quickstart rc.32, UI rc.23
  e Studio beta.8; nenhuma dependência `SNAPSHOT` entra no release;
- executar prova integrada `4302 ↔ 8088` com author/reviewer/unauthorized e retry;
- executar o mesmo schema V58 numa branch Neon efêmera;
- remover hardcodes Ergon e copy fora do i18n;
- manter tags anteriores imutáveis.

### P1 — capabilities e evidência

- publicar actions para publicação, create rollout e rollout-policy;
- estender a política de evidência ao publication/snapshot/activation somente
  depois que esses estágios vincularem o receipt revisado;
- adicionar idempotência distribuída/claim antes de execução em hosts com DML,
  além do replay por receipt já persistido.

### P2 — lane operacional de referência

- criar endpoint/action host-owned com bindings explícitos e capability dedicada;
- integrar o observer do baseline ao adapter Ergon real;
- provar `403`, `412`, retry concorrente, no-mutation e cleanup;
- repetir em branch/schema Neon efêmero, sem usar create-drop ou limpeza ampla.

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

Uma próxima beta para o agente Ergon exige a cadeia V58 publicada, client leve
beta.4, um Test Run/quatro results e handoff beta.8 fixado em commits publicados.
Uma versão estável exige também P2/P3, isolamento entre
tenant/environment, recuperação de conflito, auditoria/redaction, SLO e rollback
comprovado. O assistente explicativo já pode ser validado de forma incremental e
continua deliberadamente separado do authoring autônomo.
