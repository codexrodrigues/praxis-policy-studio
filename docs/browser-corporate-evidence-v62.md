# Evidência de navegador corporativa V62

## Escopo comprovado

O Policy Studio executa uma suíte Playwright reproduzível na porta oficial
`4302`, nos viewports desktop `1440×1000` e narrow `390×844`. O backend é
hermético e preserva os contratos públicos observados pelo browser.

A suíte comprova:

- sessão ausente com entrada explícita e skip link alcançável por teclado;
- action operacional descoberta por `/schemas/actions`;
- ausência do comando quando a capability server-owned é negada;
- seleção explícita de `CREATE` e `UPDATE` e confirmação de alto risco;
- conflito `412` apresentado como ETag/lifecycle stale, com orientação de reload;
- ausência de overflow horizontal e zero violações axe no estado auditado.

O proxy de desenvolvimento encaminha `/auth`, `/api` e `/schemas` ao Quickstart
oficial em `http://127.0.0.1:8088`. Sem `/schemas`, a action operacional V61 não
era descobrível no desenvolvimento local, embora o contrato já existisse.

## O que esta prova não afirma

Mocks de navegador não provam autenticação, autorização, isolamento de tenant,
persistência, idempotência, PostgreSQL/Neon nem execução host-owned. Essas
propriedades são cobertas por suites e provas HTTP do Quickstart, mas ainda falta
repetir a jornada combinada `4302 ↔ 8088` com personas author, reviewer, operator
e unauthorized no corte publicado.

Oracle/HADES permanece responsabilidade do adapter Ergon em ambiente autorizado.
Nenhuma evidência sintética ou Neon deve ser apresentada como paridade Oracle.

## Dívida visual observada

O catálogo mantém a decisão selecionada e as ações são operáveis nos dois
viewports, porém o workspace ainda concentra inspeção, cenários, revisão,
publicação, snapshots e evidências numa página longa. A decomposição em regiões
de trabalho com contexto persistente continua P3; não é resolvida por aumentar o
número de cards ou criar uma segunda fonte de estado no frontend.
