# Handoff Corporativo — caso neutro publicado de folha

- Data: 2026-08-16
- Autoridade corporativa: `LEGACY_AUTHORITATIVE`
- Coordenação: frente de integração corporativa
- Caso de referência: `human-resources.payroll.reactive-determinations`

## O que foi comprovado nesta máquina

O Quickstart publicado no Render executou a cadeia de folha contra o Neon homologado
`enterprise-proof-homolog`. O Config `0.1.0-rc.122` resolveu o escopo do snapshot a
partir do principal server-side; o browser e o provisionador não ampliaram tenant ou
environment por headers.

A execução publicada [31969989003](https://github.com/codexrodrigues/praxis-api-quickstart/actions/runs/31969989003)
confirmou:

- ruleset `human-resources.payroll.reactive-determinations` com duas decisões ordenadas;
- snapshots v1 e v2 já persistidos, head verificável e provisionamento idempotente;
- três casos positivos e dois negativos governados;
- as duas decisões Config aplicadas na mesma cadeia host-owned;
- create/update revalidados pelo host, sem transformar metadata de formulário em regra;
- nenhuma duplicação de snapshot no retry.

Essa prova cobre Quickstart, Config, Render e PostgreSQL remoto. Ela não executa
paridade em banco legado e não equivale à validação de pacotes corporativos privados.

## O que o Rules Studio passa a materializar

O caso padrão deixa de ser apenas o corpus sintético de auxílio extraordinário e
passa a abrir a cadeia publicada de folha. A projeção é derivada no Quickstart e
validada contra o RuleSet host-owned; o Studio somente sincroniza:

- identidade do ruleset e das duas decisões;
- ordem e dependência `net-salary -> payment-date`;
- facts tipados e bindings;
- operações create/update e determinations;
- referências e digests das fontes;
- limite explícito `LEGACY_PARITY = NOT_CLAIMED`.

IDs Config, conditions executáveis, snapshots e capabilities continuam sendo lidos
dos owners canônicos. A projeção não se torna API nem fonte de autoridade.

## Cadeia indicada ao agente de integração

1. Reconciliar portfolio, intake, inventário e matriz da frente corporativa antes de anexar
   novas regras ao gate.
2. Projetar o RuleSet corporativo completo com ordem, dependências, slots e bindings; não
   copiar o ruleset de folha nem seu recurso operacional.
3. Publicar uma action host-owned no recurso corporativo correto, descoberta por metadata,
   com capability específica, confirmação, ETag cross-resource e idempotência.
4. Resolver facts, tenant, environment, baseline legado, transação e efeitos somente no
   host consumidor.
5. Medir o baseline por observer e manter `baseline`, `candidate` e `active` como lanes
   independentes.
6. Executar primeiro testes repository-only com fakes: CREATE/UPDATE x ALLOW/DENY,
   retry, no-mutation, cleanup, `403`, `409`, `412`, `422` e `428`.
7. No ambiente autorizado, repetir os quatro canários com before/after, DML, effects,
   readback e cleanup; só então registrar o Test Run governado no Config.
8. Expandir para a matriz DB-backed de referência, depois o conjunto principal de decisões e pacotes estendidos por
   status canônico. Stateful/concurrency fica por último.

## Critério para declarar compatibilidade corporativa

O laboratório é um exemplo maduro de integração de plataforma, mas não substitui a
evidência do cliente. Um host consumidor só pode declarar uma regra compatível quando:

- a condição authorada/publicada é a mesma selecionada pelo snapshot executado;
- precedência, nulls, create/update e reason codes coincidem com o baseline legado elegível;
- mutação, effects, readback e cleanup estão comprovados;
- o Test Run possui receipt idempotente e proveniência de baseline legado elegível;
- maker-checker, isolamento e autoridade legada permanecem preservados.

Até esses gates, o Policy Studio pode explicar, editar, testar e governar candidatos,
mas não autoriza promoção de autoridade no host consumidor.
