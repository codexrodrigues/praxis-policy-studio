# RFC 0001 — caso neutro de referência no Quickstart

- Estado: aceito para implementação incremental
- Data: 2026-08-13
- Classe: arquitetural e transversal

## Problema

O ErgonX RN-013 é o primeiro consumidor real, mas não pode ser o único ambiente
de evolução do Policy Studio. O checkout local não possui o Oracle nem toda a
infraestrutura do cliente. Uma fixture simplificada também não prova composição,
precedência, `null`, outcomes, shadow, ativação atômica ou efeitos.

## Decisão

O caso neutro de referência será o Rule Lab de auxílio extraordinário do
`praxis-api-quickstart`, identificado por:

- domínio `workforce-benefits`;
- bounded context `extraordinary-assistance`;
- ruleset `extraordinary-grant-eligibility`;
- operação `evaluate-extraordinary-grant`.

Ele possui 10 slots e 11 bindings: guards protegidos, decisões JSON Logic,
composição produto/cliente `RESTRICT_ONLY`, política substituível, parâmetro,
transformação Java pura, pós-decisão de orçamento e plano de efeitos. A suíte
golden cobre os cinco outcomes, compilação inválida, reload, shadow, comando e
redação de observabilidade.

O Quickstart versiona uma projeção **derivada de evidência** em
`src/test/resources/policy-studio`. Um teste compara essa projeção à factory
real e verifica os hashes das fontes. O Studio apenas sincroniza a projeção;
ela não se torna fonte semântica, endpoint ou contrato público.

## Inventário de aderência

| Necessidade | Classificação | Owner e decisão |
| --- | --- | --- |
| Identidade, slots, bindings, ordem, facts e executores | `ja-suportado-so-ux` | Rules Engine + host Quickstart; projetar no Studio |
| Golden cases, cinco outcomes, shadow, reload e efeitos | `ja-suportado-so-ux` | Quickstart; tornar navegável no Studio |
| Lifecycle, approvals, snapshots, ETag, activate e rollback | `ja-suportado-so-ux` | Config; integrar, não recriar |
| “Simulação” atual do Config | `ja-suportado-mal-nomeado-ou-mal-materializado` | readiness estrutural, não avaliação com facts |
| Vocabulário e proveniência de facts | `suportado-parcialmente` | Metadata/host; a projeção é uma ponte de evidência |
| Draft persistido e concorrente | `ja-suportado-so-ux` | Config mantém change workspace, base hash/ETag e ações server-owned |
| Scenario e Test Run governados | `ja-suportado-so-ux` | Config persiste; sandbox host-owned avalia sem efeitos |
| Sandbox candidate versus active | `ja-suportado-mal-nomeado-ou-mal-materializado` | já executa as duas lanes; não deve ser confundido com readiness estrutural nem oracle legado |
| Proveniência de baseline e prova CREATE/UPDATE | `suportado-parcialmente` | Config V58 persiste lane independente, receipt idempotente e gates opt-in; Quickstart prova os quatro quadrantes localmente, mas adapter Ergon/Neon/Oracle ainda são externos |
| Decision execution log redigido | `suportado-parcialmente` | observações e resumos existem; faltam completar prova corporativa, retenção, redaction e isolamento sob carga |

## Remoção da ponte

A projeção derivada e o script de sincronização devem ser removidos quando o
Config e o Metadata oferecerem discovery autenticado equivalente para
identidade, composição, schemas de facts, evidências e capabilities. Não haverá
uma API paralela de projeções do Policy Studio.

## Estado dos gates

1. O caso Quickstart carrega sem identidade Ergon no shell.
2. Versão e condição detalhada são resolvidas pelo control plane.
3. Candidate é persistido em change workspace com ETag.
4. Cenários tipados executam candidate versus active no sandbox do host e geram Test Run imutável.
5. Submissão, review maker-checker, promoção e publicação obedecem gates server-side.
6. O cockpit consome head/versões e oferece activate/rollback apenas por `availableAction` e ETag forte.

O compositor host-owned e o provisionador maker-checker agora derivam o RuleSet
das sete definições aprovadas e preservam bindings fixos/Java. Ainda faltam repetir
a prova HTTP completa para registrar o novo snapshot/digest, o teste live de
rollback com principal operador e o isolamento cross-tenant/cross-environment.
Nenhum desses gates deve ser contornado pelo login de desenvolvimento.

Scenario e Test Run já possuem owner canônico no Config. O JSON da projeção
continua derivado e não deve ser promovido a contrato paralelo.

## Corte de integração 2026-08-13

O `DomainRuleService` público de `@praxisui/core` já cobre lista, timeline,
readiness, materializações e snapshots. Como o endpoint de lista inclui
`condition`, o Quickstart agora semeia pelo serviço canônico as sete definitions
JSON Logic editáveis, idempotentemente e sempre como `draft`; o browser não
reconstrói condições a partir da factory.

O deploy standalone consome o client oficial por proxy same-origin local. DTOs
e URLs privadas de domain rules foram removidos. O catálogo seleciona a maior
versão retornada e permanece em rota lazy, evitando promover o barrel pesado de
`@praxisui/core` ao bundle inicial.

Definitions, timelines e materializations agora exigem
`RULE_DEFINITION_READER`; structural simulation exige `RULE_DEFINITION_AUTHOR`.
Todos usam tenant/environment resolvidos do principal. CORS e `Origin`
continuam sendo controles complementares, nunca autorização.

## Próximas lacunas canônicas

Draft concorrente e Scenario/Test Run já pertencem ao Config e o sandbox pertence
ao host. O Quickstart já entrega o RuleSet completo ao fluxo de composição sem
reconstrução no browser. Observações redigidas de execução e o resumo canônico de
saúde/drift já são publicados pelo Config e consumidos pelo cliente oficial. O
Quickstart envia heartbeat fora da avaliação; o Actuator permanece evidência
local e não virou API privada do Studio. A próxima lacuna operacional é declarar
compatibilidade das coordenadas do engine/host e provar múltiplos consumidores
reais sob carga e falha parcial.
