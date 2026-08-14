# Estado e roadmap do Praxis Policy Studio

- Baseline auditada: `0.1.0-beta.6` (`8275e49`), com beta.7 em validação
- Data da auditoria: 2026-08-14
- Escopo: Studio, Config `0.1.0-rc.112`, Quickstart `v2.0.0-rc.31`,
  `@praxisui/*` `9.0.5-rc.21` e handoff Ergon #300

## Leitura executiva

O produto corporativo completo está estimado em **52%**, com margem de ±5 pontos
percentuais. Essa estimativa mede capabilities comprovadas, não linhas de código.
A beta.6 demonstra um vertical slice relevante, mas ainda não é uma beta
corporativa segura para uso autônomo pelo Ergon.

Marcos diferentes têm distâncias diferentes:

| Marco | Estimativa atual | Significado |
| --- | ---: | --- |
| beta integrada controlada com Quickstart | 76% | jornada supervisionada em ambiente de referência |
| versão estável corporativa | 44% | segurança, actions restantes, E2E, operação e release coerentes |
| produto maduro multi-cliente com authoring complexo e IA | 28–30% | RuleSet completo, discovery, impacto, execução explicável e agente governado |

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
| cenários, sandbox e Test Run | 60 | `suportado-parcialmente` | candidate × active existe; facts ainda são JSON e lane operacional não é remota |
| review/maker-checker | 65 | `suportado-parcialmente` | workspace, ETag, blockers e segregação existem; falta política de evidência por estágio |
| publicação/materialização | 50 | `lacuna-real-de-contrato` | readiness existe; action de publicação não é server-owned de ponta a ponta |
| snapshot, rollback e staged rollout | 55 | `suportado-parcialmente` | actions de snapshots/rollouts existentes; create rollout e rollout-policy ainda inferidos |
| evidência V57/Ergon | 40 | `suportado-parcialmente` | shape persiste; faltam baseline por cenário, idempotência, gate e endpoint operacional |
| segurança, multitenancy e capabilities | 58 | `suportado-parcialmente` | leitura, criação de versão e explicação estão governadas; faltam actions de publicação/rollout e smokes cross-tenant |
| UX, i18n e acessibilidade | 40 | `ja-suportado-mal-nomeado-ou-mal-materializado` | workstation funcional; faltam i18n integral, E2E, axe e decomposição da página |
| testes, release e documentação | 60 | `suportado-parcialmente` | releases coordenados e gates focais verdes; ainda faltam browser/axe e prova multi-persona completa |
| assistente de decisões | 45 | `suportado-parcialmente` | explicação da definição passou pelo fluxo HTTP real com atestação e sem candidate API; busca, execução explicada e comandos delegados ainda faltam |

## Bloqueadores do próximo corte corporativo

1. **Role matrix:** `RULE_DEFINITION_READER` está publicada desde o Config rc.111;
   o rc.112 acrescenta o roteamento semântico focal e a cadeia Quickstart prova
   401/403/201 antes de enfileirar a explicação.
2. **Actions completas:** Definition capabilities já são consumidas pelo client e
   pelo Studio. Publicação, create rollout e lifecycle da
   rollout-policy precisam de actions próprias; uma action nunca autoriza outra.
3. **Evidência governada:** a V57 armazena evidência, porém não oferece baseline
   independente por cenário, idempotência ou política de gate por estágio.
4. **Lane operacional remota:** o executor Quickstart é uma seam interna usada por
   testes; não há endpoint/action/capability para Studio ou adapter Ergon.
5. **Integridade de release:** a lane V57 nasceu no Quickstart `v2.0.0-rc.29`; o
   `v2.0.0-rc.31` incorpora Config rc.112. As tags anteriores permanecem imutáveis.

## Gate de evidência

O gate pertence à governance server-owned da Definition/RuleSet:

- `SUBMIT` pode abrir revisão técnica com evidência `PENDING` quando a política
  permitir; o blocker continua visível;
- `PROMOTE` bloqueia, quando exigido, baseline inelegível, matriz incompleta,
  mutação indevida e cleanup não comprovado;
- `PUBLISH`, snapshot, rollout e `ACTIVATE` bloqueiam enquanto qualquer evidência
  obrigatória estiver inelegível;
- exigir evidência antes de revisão é uma opção de governance, não default da V57
  nem inferência do browser.

Antes de criar `evidenceRequirements`, o owner Config deve inventariar o objeto
`governance` existente. Só a ausência comprovada deve justificar contrato novo.

## Sequência de entrega

### P0 — integridade e release

- manter a role matrix coberta no controller real e no host de referência;
- corrigir a documentação V57 para quatro canários — CREATE/UPDATE × ALLOW/DENY;
- reconciliar README, visão, arquitetura e handoff;
- remover hardcodes Ergon e copy fora do i18n;
- manter releases coordenados entre Config, Quickstart, `@praxisui/*` e Studio,
  sem mover tags anteriores.

### P1 — capabilities e evidência

- publicar o corte de `@praxisui/core` com Definition capabilities e provar o
  consumo integrado no Studio;
- publicar actions para publicação, create rollout e rollout-policy;
- modelar baseline por cenário, idempotência e requirements por estágio no Config;
- usar um Test Run idempotente com quatro results operacionais.

### P2 — lane operacional de referência

- criar endpoint/action host-owned com bindings explícitos;
- medir baseline call count por observer e falhar fechado em cleanup divergente;
- provar `403`, `412`, retry, no-mutation e cleanup em PostgreSQL descartável;
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

Uma próxima beta para o agente Ergon exige P0, Definition/workspace capabilities
coerentes, client V57 público, um Test Run/quatro results e handoff fixado em
commits publicados. Uma versão estável exige também P2/P3, isolamento entre
tenant/environment, recuperação de conflito, auditoria/redaction, SLO e rollback
comprovado. O assistente explicativo já pode ser validado de forma incremental e
continua deliberadamente separado do authoring autônomo.
