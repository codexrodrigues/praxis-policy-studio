# Estado e roadmap do Praxis Policy Studio

- Baseline validada: candidato Studio `0.1.0-beta.14` e Quickstart `v2.0.0-rc.40`,
  com transporte, governance V58 e prova host-owned em dois datasources Neon
- Data da auditoria: 2026-08-15
- Escopo: Studio beta.14, Metadata rc.127, Config rc.118, Quickstart rc.40,
  Contracts beta.4, `@praxisui/*` rc.27 e handoff Ergon #300

## Leitura executiva

O produto corporativo completo está estimado em **65%**, com margem de ±5 pontos
percentuais. Essa estimativa mede capabilities comprovadas, não linhas de código.
A beta.14 demonstra um vertical slice relevante, materializa no cockpit os
blockers tipados do gate de snapshot e separa explicitamente a identidade do
RuleSet do recurso operacional host-owned usado para action discovery; o corte V63 fecha as actions
principal-specific de publicação e rollout; o corte V61 fecha o discovery
operacional cross-resource e o corte V58 fecha o transporte,
parte dos gates de evidência e a execução idempotente no Neon, mas ainda não é uma beta
corporativa segura para uso autônomo pelo Ergon.

Marcos diferentes têm distâncias diferentes:

| Marco | Estimativa atual | Significado |
| --- | ---: | --- |
| beta integrada controlada com Quickstart | 98% | contratos, proxy e action discovery foram comprovados em 4302↔8088 + Neon; falta a matriz multi-persona no corte publicado |
| versão estável corporativa | 56% | segurança cross-tenant, gates posteriores, E2E integrado e operação corporativa |
| produto maduro multi-cliente com authoring complexo e IA | 34% | RuleSet completo, discovery amplo, impacto, execução explicável e agente governado |

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
| cenários, sandbox e Test Run | 84 | `suportado-parcialmente` | candidate × active, baseline independente, retry e action host-owned consumida por discovery existem; facts ainda são JSON |
| review/maker-checker | 70 | `suportado-parcialmente` | workspace, ETag, blockers, run submetido e segregação existem; política cobre SUBMIT/PROMOTE, não estágios posteriores |
| publicação/materialização | 58 | `suportado-parcialmente` | readiness e action `PUBLISH` são server-owned; o gate de evidência ainda não alcança publicação |
| snapshot, rollback e staged rollout | 72 | `suportado-parcialmente` | blockers de evidência são server-owned, tipados e explicados pelo Studio; create/cancel/activate rollout e lifecycle de rollout-policy são principal-specific; falta prova multi-persona integrada |
| evidência V58/V60/Ergon | 86 | `suportado-parcialmente` | contrato leve, action dedicada, reserva pré-DML e quatro quadrantes foram provados em dois datasources Neon preservando o ledger append-only; faltam adapter Ergon e Oracle/HADES |
| segurança, multitenancy e capabilities | 74 | `suportado-parcialmente` | publicação e rollout não são mais inferidos no browser; faltam smokes cross-tenant e prova multi-persona integrada |
| UX, i18n e acessibilidade | 48 | `ja-suportado-mal-nomeado-ou-mal-materializado` | Playwright desktop/narrow, teclado e axe cobrem estados corporativos focais; faltam i18n integral, personas reais e decomposição da página |
| testes, release e documentação | 91 | `suportado-parcialmente` | cadeia V61, prova HTTP/PostgreSQL/Neon V60 e E2E hermético V62; falta prova browser multi-persona integrada |
| assistente de decisões | 48 | `suportado-parcialmente` | explicação da definição passou pelo browser e fluxo HTTP real com atestação e sem candidate API; busca, execução explicada e comandos delegados ainda faltam |

## Bloqueadores do próximo corte corporativo

1. **Actions completas:** concluído no V63 para publicação, create rollout e
   lifecycle de rollout-policy. Config publica ações principal-specific e o Studio
   nunca reutiliza uma action para autorizar outra operação.
2. **Evidência governada:** a V58 oferece baseline independente por cenário,
   idempotência, vínculo do run submetido e política opt-in. O Config rc.118
   revalida o receipt na composição de snapshot e devolve blockers tipados; o
   Studio beta.13 os explica sem interpretar mensagens humanas. Ainda falta
   provar essa cadeia no browser integrado multi-persona.
3. **Consumo operacional governado:** concluído no V61. Metadata representa o
   `If-Match` cross-resource e Core/Studio descobrem e executam a action sem URL local.
   Desde o beta.12, o Studio também congela `Idempotency-Key` e `evaluatedAtUtc` após falha incerta,
   fechando no browser a mesma garantia de replay já existente no host e no Config.
4. **Prova corporativa:** o comando no Neon cobre `403`, `409`, `412`, `422`, `428`,
   retry sem duplicação, quatro quadrantes e rollback que preserva o audit append-only;
   o browser hermético cobre capability negada, confirmação e `412`; ainda faltam
   browser multi-persona integrado, isolamento cross-tenant e Oracle/HADES autorizado.

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
  faltam cross-tenant e browser multi-persona;
- execução pelo endpoint no Neon e retry sem duplicação — comprovados em um Test Run
  com quatro resultados; a migração V58 e seu restart idempotente usam o banco existente.

### P3 — hardening do Studio

- decompor o workspace em catálogo, inspeção, authoring, testes, review/publicação
  e operação, sob uma facade/store;
- substituir Facts JSON por editor derivado do fact schema;
- manter E2E desktop/narrow, teclado, axe e regressão visual focal como gate — concluído no V62;
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
o contrato da action V60 como referência de host, junto do client leve beta.4,
do exemplo de um Test Run/quatro results e deste handoff.
Canários Oracle/HADES continuam condicionados ao ambiente autorizado e à lane
operacional remota ou a um adapter host-owned equivalente.
Uma versão estável exige também P2/P3, isolamento entre
tenant/environment, recuperação de conflito, auditoria/redaction, SLO e rollback
comprovado. O assistente explicativo já pode ser validado de forma incremental e
continua deliberadamente separado do authoring autônomo.
