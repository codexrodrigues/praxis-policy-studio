# Handoff Ergon — Policy Studio beta.8 / evidência V58

- Estado: candidato; usar somente depois da cadeia de artefatos abaixo estar publicada
- Issue de coordenação: Ergon #300
- Autoridade operacional: `LEGACY_AUTHORITATIVE`; este corte não promove Java nem toca Oracle
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
descartável. Esse teste é estrutural e operacional; não é paridade Oracle nem prova Neon.

## Cadeia de versões

Adotar somente a cadeia completa, sem `SNAPSHOT`:

1. `praxis-config-contracts:0.1.0-beta.4`;
2. `praxis-config-starter:0.1.0-rc.113` no control plane/host de referência;
3. `praxis-api-quickstart:2.0.0-rc.32` como laboratório reproduzível;
4. `@praxisui/core:9.0.5-rc.23` para projetar o run vinculado;
5. `praxis-policy-studio:0.1.0-beta.8`.

Se qualquer artefato ainda não estiver público, interromper a integração e manter a
atividade repository-only. Não importar `praxis-config-starter` no Ergon para obter DTOs.

## Cadeia de trabalho do agente Ergon

### 0. Reconciliar o estado canônico

- reconciliar portfolio, intake, inventory e traceability antes de ligar ERG-08382 ao gate;
- registrar ERG-08382 como slice V58 novo, separado do Phase 15 RN-013a;
- manter explícito quais decisões RN-017 estão deferred;
- não chamar corpus sintético de paridade Oracle.

### 1. Implementar o adapter host-owned

- depender apenas de `praxis-config-contracts:0.1.0-beta.4` para o transporte;
- resolver tenant, ambiente e ator no servidor;
- gerar e persistir `idempotencyKey` e `evaluatedAtUtc` para todo retry do mesmo comando;
- consultar/devolver receipt existente antes de DML, probe ou nova chamada Oracle;
- enviar apenas digests, códigos limitados e flags; nunca SQL, linhas, facts pessoais,
  credenciais, mensagens de exceção ou trace bruto;
- reutilizar o cliente HTTP canônico do Ergon, com timeout, autenticação, correlação e
  tratamento explícito de 401/403/409/412.

### 2. Produzir um Test Run com quatro results

| Cenário | Operação | Resultado candidato | Prova mínima |
| --- | --- | --- | --- |
| create-allow | CREATE | ALLOW | before/after, mutação, effect ledger, cleanup |
| create-deny | CREATE | DENY | no-mutation, cleanup |
| update-allow | UPDATE | ALLOW | identidade preservada, digest alterado, cleanup |
| update-deny | UPDATE | DENY | seed preservado, no-mutation da tentativa, cleanup |

Cada result carrega sua própria decisão Oracle redigida em `baselineResult`; `activeDecision`
continua significando snapshot Praxis ativo e nunca pode ser reutilizada como Oracle. A provenance
do run deve declarar `LEGACY_ORACLE` e só usar `ELIGIBLE` quando a evidência de todos os cenários
estiver completa.

### 3. Provar primeiro sem Oracle

- testes de contrato do mapper e sanitização;
- fake de baseline com contagem observada, inclusive falha;
- retry exato retorna o mesmo run sem repetir DML/probe;
- mesma chave com instante, timezone ou cenários diferentes falha;
- cleanup divergente, mutação divergente e digest inválido falham fechado;
- autorização negativa e isolamento tenant/environment;
- nenhum teste muda a autoridade operacional.

### 4. Executar no ambiente autorizado

Somente o agente com acesso Oracle/HADES executa os quatro canários reais. Para cada um, registrar
before/after, chamada ao baseline, DML/effects, readback, no-mutation quando aplicável e cleanup.
Depois registrar um único Test Run/quatro results no Config e confirmar no Studio que o UUID
vinculado à submissão é o mesmo receipt homologado.

### 5. Expandir com ordem controlada

1. matriz RN-013 de 38 casos DB-backed, separando profundidades de evidência;
2. RN-013 completa com 14 decisões, precedência, nulls, overlaps e create/update;
3. RN-017 conforme o status canônico de cada decisão;
4. agregação/stateful/concurrency somente após protocolo para phantom writers.

## Critérios de aceite

- nenhuma dependência `SNAPSHOT` ou Starter no adapter;
- um run e quatro results após retry;
- candidate, active e legacy continuam lanes independentes;
- author ≠ reviewer e o browser não amplia capability;
- política RN-013 bloqueia promoção quando Oracle não é `ELIGIBLE`, a matriz está incompleta,
  a paridade diverge ou o cleanup não foi comprovado;
- logs e receipts não contêm dados de negócio sensíveis;
- autoridade continua legado até homologação explícita fora do Policy Studio.

## Limites ainda abertos

- o corte local não prova Neon, Oracle ou HADES;
- o executor operacional Quickstart permanece interno e não publica capability/endpoint humano;
- V58 governa `SUBMIT`/`PROMOTE`, não publication/snapshot/activation;
- o laboratório é compatível com a topologia RN-013, mas não replica o Oracle nem a totalidade
  dos casos RN-017/stateful;
- uma race distribuída antes do primeiro receipt ainda exige command claim/idempotência no host
  quando a operação puder produzir efeitos irreversíveis.
