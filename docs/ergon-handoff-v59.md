# Handoff operacional V59 — complemento ao Policy Studio beta.8

- Estado: publicado no Quickstart `v2.0.0-rc.33` (PR #189, merge `52616aac`, release `9e027e83`);
  não altera a versão da UI beta.8
- Data: 2026-08-15
- Autoridade Ergon: `LEGACY_AUTHORITATIVE`

## O que mudou

O Quickstart deixou de expor a prova operacional apenas como seam interna. O host publica a action:

```http
POST /api/human-resources/extraordinary-benefit-requests/actions/run-policy-studio-operational-test
```

O caller envia somente workspace, ids de cenários governados, modos explícitos `CREATE`/`UPDATE`,
instante congelado e timezone. Facts autoritativos, comandos, DML, referências descartáveis,
digests e cleanup permanecem host-owned.

A action exige `ROLE_RULE_OPERATIONAL_TEST_OPERATOR`, confirmação de alto risco,
`Idempotency-Key` e `If-Match` forte. Antes de DML, o host reserva o comando completo no ledger
operacional. A referência descartável inclui tenant/environment server-owned no digest. Candidate
e active precisam satisfazer decision, output, reason codes e effect intents do cenário antes de
qualquer mutação.

## Evidência local

- HTTP real com security chain;
- datasource operacional e Config em dois PostgreSQL descartáveis;
- um Test Run com quatro results: CREATE/UPDATE × ALLOW/DENY;
- mutação somente em ALLOW, no-mutation em DENY e cleanup verificado;
- replay devolve o mesmo receipt; mudança de modo com a mesma chave retorna `409`;
- `403`, `412`, `422` e `428` separados;
- nenhum payload de negócio sensível atravessa a fronteira do Test Run.

Isso prova compatibilidade operacional do laboratório Quickstart. Não prova Neon, Oracle/HADES ou
paridade RN-013.

## Cadeia para o agente Ergon

O trabalho repository-only da issue #300 continua válido. O adapter Ergon deve adotar a mesma
fronteira:

1. resolver tenant/environment/ator no servidor;
2. reservar o comando completo antes de Oracle ou DML;
3. selecionar cenários governados e mapear explicitamente CREATE/UPDATE;
4. medir chamadas ao Oracle por observer, sem aceitar contador do caller;
5. capturar before/after/effects/readback e limpar somente fixtures possuídas;
6. registrar um único receipt V58 com baseline `LEGACY_ORACLE` independente de active;
7. manter autoridade legada até homologação explícita.

O Ergon não deve copiar o endpoint de benefício extraordinário nem seus DTOs de domínio. Ele deve
reutilizar `praxis-config-contracts:0.1.0-beta.4` e implementar sua própria action host-owned com o
mesmo protocolo de segurança, idempotência e evidência.

## Limites para o Studio

O Studio beta.8 ainda não chama a action V59. A metadata canônica atual proíbe precondition
`IF_MATCH` em collection action, mas este comando referencia o ETag de um workspace do Config.
Portanto, o próximo passo correto é modelar a precondition cross-resource no owner Metadata Starter
e consumi-la por discovery/capability. Hardcodar URL/header no Angular criaria uma segunda fonte de
governança.

Também permanecem pendentes:

- smoke da action contra o Neon já configurado;
- browser com operator e unauthorized;
- isolamento cross-tenant/environment;
- quatro canários Oracle/HADES e expansão para a matriz RN-013;
- extensão do gate V58 para publication/snapshot/activation.
