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

## Suíte live multi-persona preparada

O candidato seguinte adiciona uma suíte isolada em
`e2e/policy-studio-multipersona.live.spec.ts`. Ela não usa os mocks V62 e não é
executada pelo `npm run e2e` comum. Com o Quickstart real ouvindo na porta oficial
`8088`, execute:

```bash
POLICY_STUDIO_LIVE_AUTHOR_USERNAME=... \
POLICY_STUDIO_LIVE_AUTHOR_PASSWORD=... \
POLICY_STUDIO_LIVE_APPROVER_A_USERNAME=... \
POLICY_STUDIO_LIVE_APPROVER_A_PASSWORD=... \
POLICY_STUDIO_LIVE_APPROVER_B_USERNAME=... \
POLICY_STUDIO_LIVE_APPROVER_B_PASSWORD=... \
POLICY_STUDIO_LIVE_PUBLISHER_USERNAME=... \
POLICY_STUDIO_LIVE_PUBLISHER_PASSWORD=... \
POLICY_STUDIO_LIVE_OPERATOR_USERNAME=... \
POLICY_STUDIO_LIVE_OPERATOR_PASSWORD=... \
POLICY_STUDIO_LIVE_AUDITOR_USERNAME=... \
POLICY_STUDIO_LIVE_AUDITOR_PASSWORD=... \
npm run e2e:live:multipersona
```

A suíte abre o Studio pela porta `4302`, prova primeiro o browser sem sessão, cria
uma sessão real para cada um dos seis sujeitos, carrega o catálogo governado e
cruza um matcher HTTP permitido. Em seguida usa
comandos intencionalmente incompletos sobre chaves inexistentes para provar `403`
nas responsabilidades das outras personas sem materializar uma regra ou mover o
head. Uma resposta funcional `400`, `404`, `409`, `412`, `422` ou `428` no probe
permitido significa que a autorização foi atravessada; ela não é apresentada como
sucesso do caso de negócio. `5xx`, `401`, `403`, redirect ou status inesperado falham
o gate. Todas as chamadas também enviam `X-Tenant-ID` e `X-Env` adversariais e
verificam que esses valores não são projetados pelo catálogo. A garantia persistente
de que o escopo vem do principal — inclusive `404` para workspace estrangeiro —
permanece no teste PostgreSQL do Quickstart; o browser não se torna owner dessa regra.

TypeScript, os testes unitários, os checkers e o CI do PR `#27` passaram. A cadeia
de backend correspondente também foi comprovada no Quickstart publicado, commit
`608584c`, contra o Neon autorizado: seis logins, reads, responsabilidades
positivas, negativas `403`, auditor read-only e Origin/CORS para a porta oficial
`4302`. O datasource operacional foi confirmado como a branch
`enterprise-proof-homolog`; o Config continuou no datasource Neon versionado já
existente.

A homologação estática posterior foi publicada em
`https://praxis-policy-studio-homolog.onrender.com` pelo PR `#29`. O site abriu a
rota SPA diretamente, criou uma sessão real de author e carregou as dez decisões
do Quickstart publicado. CORS, filtro de Origin, auditor read-only `200` e recusa
operacional `403` foram repetidos no container que serve essa origin.

Essa é uma prova browser integrada de sessão e catálogo para a persona author,
com segregação do auditor comprovada pela mesma cadeia publicada. A execução
automatizada dos sete testes Playwright com as seis personas ainda não é
reivindicada. O gate multi-persona só muda de “preparado” para “comprovado” quando
a suíte inteira rodar contra o site e o host publicados. A condição governada da
decisão focal também chegou ausente; por isso esta prova não é apresentada como
authoring completo.

## Dívida visual observada

O catálogo mantém a decisão selecionada e as ações são operáveis nos dois
viewports, porém o workspace ainda concentra inspeção, cenários, revisão,
publicação, snapshots e evidências numa página longa. A decomposição em regiões
de trabalho com contexto persistente continua P3; não é resolvida por aumentar o
número de cards ou criar uma segunda fonte de estado no frontend.
