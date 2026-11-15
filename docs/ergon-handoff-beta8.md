# Handoff Corporativo — Policy Studio beta.8 / evidência V58

> Este documento preserva o corte publicado beta.8/rc.32. A action host-owned posterior e os
> limites atuais estão no complemento V59 anterior.

- Estado: publicado; apto para a fase repository-only da frente de integração corporativa
- Escopo de coordenação: frente de integração corporativa
- Autoridade operacional: `LEGACY_AUTHORITATIVE`; este corte não promove Java nem toca banco legado
- Data: 2026-08-14

## O que o corte V58 fecha

O transporte de Test Run deixa de pertencer ao Starter e passa ao artefato leve
`praxis-config-contracts`. Cada comando possui chave idempotente, relógio congelado,
lane candidate, lane active, baseline independente por cenário e evidência operacional
redigida. O Config persiste um receipt imutável, vincula o run aceito ao workspace
submetido e avalia política server-owned opt-in em `SUBMIT` e `PROMOTE`.

O laboratório Quickstart executa os quatro quadrantes CREATE/UPDATE × ALLOW/DENY no
workflow real do caso neutro, mede chamadas ao baseline por observer, falha fechado em
mutação/cleanup divergentes e persiste um Test Run com quatro results em PostgreSQL real
descartável. Esse teste é estrutural e operacional; não é paridade de legado.

O Config aplicou a migração V58 no banco Neon já configurado para o Quickstart e,
após reinício, confirmou o schema atual sem reaplicar a migration. Nenhum banco ou
schema paralelo foi criado. Essa é prova de persistência/migração, não prova de Test
Run operacional remoto, porque o executor do Quickstart ainda não publica endpoint.
O Studio também foi validado em `4302 ↔ 8088`: sessão local, catálogo neutro com
10 decisões, lifecycle, snapshot ativo, alinhamento agregado do host e explicação
assistida terminal. A explicação permaneceu consultiva e recusou inferir dados que
o envelope sanitizado não atestava. Essa prova usou uma persona administrativa;
não substitui a matriz maker-checker/unauthorized.

## Cadeia de versões

Adotar somente a cadeia completa, sem `SNAPSHOT`:

1. `praxis-config-contracts:0.1.0-beta.4`;
2. `praxis-config-starter:0.1.0-rc.113` no control plane/host de referência;
3. `praxis-api-quickstart:2.0.0-rc.32` como laboratório reproduzível;
4. `@praxisui/core:9.0.5-rc.23` para projetar o run vinculado;
5. `praxis-policy-studio:0.1.0-beta.8`.

A cadeia acima está publicada. Fixar essas versões exatas ou seus commits de release;
não reutilizar tags anteriores. Não importar `praxis-config-starter` no host corporativo para
obter DTOs.

## Cadeia de trabalho do agente de integração

### 0. Reconciliar o estado canônico

- reconciliar portfolio, intake, inventory e traceability antes de ligar decisões piloto aos gates de entrega;
- manter separação histórica das fatias V58 em relação a fases anteriores do portfólio;
- manter explícito quais decisões complementares estão deferred;
- não chamar corpus sintético de paridade legada.

### 1. Implementar o adapter host-owned

- depender apenas de `praxis-config-contracts:0.1.0-beta.4` para o transporte;
- resolver tenant, ambiente e ator no servidor;
- gerar e persistir `idempotencyKey` e `evaluatedAtUtc` para todo retry do mesmo comando;
- consultar/devolver receipt existente antes de DML, probe ou nova chamada ao baseline legado;
- enviar apenas digests, códigos limitados e flags; nunca SQL, linhas, facts pessoais,
  credenciais, mensagens de exceção ou trace bruto;
- reutilizar o cliente HTTP canônico do host consumidor, com timeout, autenticação, correlação e
  tratamento explícito de 401/403/409/412.

### 2. Produzir um Test Run com quatro results

| Cenário | Operação | Resultado candidato | Prova mínima |
| --- | --- | --- | --- |
| create-allow | CREATE | ALLOW | before/after, mutação, effect ledger, cleanup |
| create-deny | CREATE | DENY | no-mutation, cleanup |
| update-allow | UPDATE | ALLOW | identidade preservada, digest alterado, cleanup |
| update-deny | UPDATE | DENY | seed preservado, no-mutation da tentativa, cleanup |

Cada result carrega sua própria decisão de baseline redigida em `baselineResult`; `activeDecision`
continua significando snapshot Praxis ativo e nunca pode ser reutilizada como baseline legado. A provenance
do run deve declarar a autoridade do baseline e só usar `ELIGIBLE` quando a evidência de todos os cenários
estiver completa.

### 3. Provar primeiro sem baseline legado

- testes de contrato do mapper e sanitização;
- fake de baseline com contagem observada, inclusive falha;
- retry exato retorna o mesmo run sem repetir DML/probe;
- mesma chave com instante, timezone ou cenários diferentes falha;
- cleanup divergente, mutação divergente e digest inválido falham fechado;
- autorização negativa e isolamento tenant/environment;
- nenhum teste muda a autoridade operacional.

### 4. Executar no ambiente autorizado

Somente o agente com acesso ao ambiente legado autorizado executa os quatro canários reais. Para cada um, registrar
before/after, chamada ao baseline, DML/effects, readback, no-mutation quando aplicável e cleanup.
Depois registrar um único Test Run/quatro results no Config e confirmar no Studio que o UUID
vinculado à submissão é o mesmo receipt homologado.

### 5. Expandir com ordem controlada

1. matriz de referência de 38 casos DB-backed, separando profundidades de evidência;
2. pacote completo com 14 decisões, precedência, nulls, overlaps e create/update;
3. decisões estendidas/temporais conforme o status canônico de cada decisão;
4. agregação/stateful/concurrency somente após protocolo para phantom writers.

## Critérios de aceite

- nenhuma dependência `SNAPSHOT` ou Starter no adapter;
- um run e quatro results após retry;
- candidate, active e legacy continuam lanes independentes;
- author ≠ reviewer e o browser não amplia capability;
- política do pacote bloqueia promoção quando o baseline não é `ELIGIBLE`, a matriz está incompleta,
  a paridade diverge ou o cleanup não foi comprovado;
- logs e receipts não contêm dados de negócio sensíveis;
- autoridade continua legado até homologação explícita fora do Policy Studio.

## Limites ainda abertos

- o corte prova a migration/restart V58 em banco remoto, mas não um Test Run operacional
  remoto nesse banco nem paridade no ambiente legado;
- o executor operacional Quickstart permanece interno e não publica capability/endpoint humano;
- V58 governa `SUBMIT`/`PROMOTE`, não publication/snapshot/activation;
- o laboratório é compatível com a topologia de referência, mas não replica o banco legado nem a totalidade
  dos casos estendidos/stateful;
- uma race distribuída antes do primeiro receipt ainda exige command claim/idempotência no host
  quando a operação puder produzir efeitos irreversíveis.
