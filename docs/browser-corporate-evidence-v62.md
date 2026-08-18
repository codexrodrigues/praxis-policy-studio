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
persistência, idempotência, PostgreSQL/Neon nem execução host-owned. A suíte live
abaixo fecha autenticação e segregação de responsabilidades no browser publicado;
persistência, idempotência e execução host-owned continuam pertencendo às suites
e provas HTTP/PostgreSQL do Quickstart.

Oracle/HADES permanece responsabilidade do adapter Ergon em ambiente autorizado.
Nenhuma evidência sintética ou Neon deve ser apresentada como paridade Oracle.

## Suíte live multi-persona comprovada

O Studio mantém uma suíte isolada em
`e2e/policy-studio-multipersona.live.spec.ts`. Ela não usa os mocks V62 e não é
executada pelo `npm run e2e` comum. Por padrão ela usa o Quickstart local na porta
oficial `8088`; para repetir a prova publicada, informe também as duas URLs:

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
POLICY_STUDIO_LIVE_STUDIO_URL=https://praxis-policy-studio-homolog.onrender.com \
POLICY_STUDIO_LIVE_BACKEND_URL=https://praxis-api-quickstart.onrender.com \
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
o gate. Para cada persona, a suíte repete a leitura com `X-Tenant-ID` e `X-Env`
adversariais e exige resultado idêntico à leitura sem esses headers. Isso prova que
o browser não substitui o escopo server-owned. A garantia persistente
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

Em 2026-08-17, os sete testes passaram contra o Studio e o Quickstart publicados:
anonymous, author, approver A, approver B, publisher, operator e auditor. Antes da
execução foi corrigido um drift operacional: a origem homologada não estava mais
nas allowlists `CORS_ALLOWED_ORIGINS` e
`APP_SECURITY_CONFIG_ORIGIN_RESTRICTION_ALLOWED_ORIGINS` do serviço. As listas
foram corrigidas e o mesmo commit `375e6c0` foi redeployado; nenhuma regra,
snapshot ou dado de negócio foi criado por essa correção. O gate está comprovado
para autenticação, leitura, segregação de responsabilidades e escopo server-owned;
ele ainda não substitui uma jornada mutável completa por persona.

O Quickstart PR `#199` corrigiu depois o seed que gravava em escopo fixo. Com o
seed explicitamente habilitado no escopo server-owned `default/prod`, o mesmo
site carregou a condição, criou workspace e cenário governados e persistiu um
Test Run. O candidate retornou `ALLOW`; a lane active retornou
`TECHNICAL_ERROR/ACTIVE_SNAPSHOT_UNAVAILABLE`, pois nenhum snapshot foi
publicado. Esse resultado é a evidência correta de authoring/sandbox controlado,
não um falso `MATCH` nem autorização para publicar.

## Revalidação do catálogo neutro em 2026-08-18

O Config `0.1.0-rc.127` removeu a incompatibilidade PostgreSQL da consulta
paginada e o Quickstart PR `#219` corrigiu a ordem de materialização do seed: a
configuração do host não depende mais de um `@ConditionalOnBean` avaliado antes
da auto-configuração do Config. Sete Definitions JSON Logic foram persistidas no
Neon `enterprise-proof-homolog` sem criar banco ou schema paralelo.

A suíte live passou `7/7` localmente em corporate mode contra esse Neon e passou a
exigir `.decision-list .decision-row > 0` para todas as personas autenticadas.
Também repetiu igualdade com headers adversariais, responsabilidades positivas e
negativas e anonimato fail-closed. O limite de bulk actions foi isolado nessa
execução para que `429` não mascarasse a asserção de autorização `403`; autenticação,
roles e Origin permaneceram habilitados.

O backend `482cdf9` foi publicado no Render como
`dep-da1t4s142hec73f572hg` e o Studio `b8231bc` como
`dep-da1t7bnqj5pc73d4csf0`. Os dois deploys ficaram `live`; o health publicado
retornou `UP`, o artefato estático apontou para a projeção neutra
`quickstart-benefit-eligibility.v1.json` e o catálogo anônimo retornou `403`.
Esta revalidação não extraiu secrets do Render. Portanto, preserva como evidência
anterior a matriz publicada de 2026-08-17, mas não afirma que a nova asserção de
lista não vazia já foi repetida no browser publicado.

## Dívida visual observada

O catálogo mantém a decisão selecionada e as ações são operáveis nos dois
viewports, porém o workspace ainda concentra inspeção, cenários, revisão,
publicação, snapshots e evidências numa página longa. A decomposição em regiões
de trabalho com contexto persistente continua P3; não é resolvida por aumentar o
número de cards ou criar uma segunda fonte de estado no frontend.
