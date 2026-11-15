# Handoff operacional V61 — discovery governado no Rules Studio

- Data: 2026-08-15
- Autoridade corporativa: `LEGACY_AUTHORITATIVE`
- Coordenação: frente de integração corporativa
- Complementa o handoff V60 anterior; não substitui sua evidência em PostgreSQL remoto

## Cadeia publicada

1. Metadata Starter `8.0.0-rc.127` publica a precondition cross-resource de uma
   collection action: recurso alvo e campo que transporta sua identidade;
2. Config Starter `0.1.0-rc.114` publica a identidade canônica
   `praxis.config.domain-rule-change-workspaces`;
3. Quickstart `2.0.0-rc.35` declara que a action operacional é governada pelo ETag
   do change workspace identificado por `workspaceId`;
4. `@praxisui/core` `9.0.5-rc.25` expõe os campos e discovery filtrado por
   `resourceKey`;
5. Rules Studio correlaciona o `operationalResourceKey` publicado pelo host na
   projeção (sem reinterpretar o `resourceKey` do RuleSet na Definition), exige
   exatamente uma action com tags `policy-studio` e `operational-proof`, apresenta
   CREATE/UPDATE por cenário, confirma o risco e executa o protocolo publicado.

O Studio não conhece a URL do Quickstart, não reutiliza uma capability de outra
operação e não inventa tenant, environment ou autorização. Ausência, ambiguidade,
protocolo incompleto ou ETag ausente bloqueiam o comando.

## Cadeia indicada ao agente de integração

O agente da frente corporativa pode usar o mesmo modelo:

1. reconciliar portfólio, intake, inventário e matriz antes dos canários;
2. publicar uma action host-owned no recurso corporativo correto com as mesmas tags
   semânticas, mas com DTO e workflow próprios do host;
3. apontar a precondition ao change workspace canônico e transportar `workspaceId`;
4. resolver facts, target legado, tenant/environment e efeitos somente no host;
5. medir o baseline legado por observer e mantê-lo independente de `active`;
6. executar um Test Run com quatro resultados CREATE/UPDATE × ALLOW/DENY,
   idempotência, before/after, no-mutation, effects, readback e cleanup;
7. manter `LEGACY_AUTHORITATIVE` até homologação explícita.

O agente não deve copiar a URL, os DTOs de benefício extraordinário nem o banco
operacional do Quickstart. O contrato reutilizável é o catálogo de action e o
receipt Config; comandos e transações pertencem ao host consumidor.

## O que este corte prova — e o que não prova

Prova: discovery semântico, capability principal-specific, confirmação explícita,
ETag cross-resource, idempotency key, receipt e atualização da revisão do workspace.

Não prova: paridade com sistema legado, semântica integral de pacotes corporativos,
efeitos reais do host consumidor, isolamento cross-tenant em browser ou homologação produtiva.
Esses gates continuam no ambiente autorizado do host consumidor.
