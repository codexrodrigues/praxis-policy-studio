# Deployment estático homologado no Render

O Policy Studio pode ser publicado separadamente do Quickstart sem versionar a
URL do ambiente. O build continua produzindo o mesmo app Angular e materializa o
`configApiBaseUrl` somente no artefato derivado.

## Configuração do site

- build command: `npm ci && npm run build:static`;
- publish directory: `dist/praxis-policy-studio/browser`;
- environment: `POLICY_STUDIO_CONFIG_API_BASE_URL`, contendo somente a origin
  HTTPS do Quickstart, sem path, query, fragmento ou credenciais;
- rewrite SPA: `/*` para `/index.html`.

A homologação oficial está publicada em
`https://praxis-policy-studio-homolog.onrender.com` (serviço Render
`srv-da0fbqlbedkc73ald6e0`) e aponta para o Quickstart homologado
`https://praxis-enterprise-proof-sandbox-v2.onrender.com`. A URL e o identificador
do serviço são evidência operacional; não são contrato de produto nem endpoint de
produção.

O script falha fechado quando a variável está ausente, malformada ou contém uma
URL que não seja uma origin HTTPS. Ele altera apenas o `app-config.json` dentro de
`dist`; `public/app-config.json` permanece adequado ao proxy local oficial.

## Sessão e segurança

O host Angular envia `withCredentials` apenas para as famílias governadas
`/auth`, `/api` e `/schemas`, inclusive quando a URL é absoluta. Assets,
projeções e destinos externos não recebem o cookie ambiente. O Quickstart deve
publicar a origin exata do site em CORS e no filtro de Origin do Config.

Este deployment é uma superfície de homologação. Ele não substitui IdP/BFF
corporativo, não transforma o login do Quickstart em IAM de produção e não muda
tenant, environment, capabilities, ETag ou segregação de funções no browser.

## Prova publicada de 2026-08-15

O build do PR `#29` passou pelo CI e pelo Render com `npm ci` e
`npm run build:static`. O log confirmou o backend derivado sem persistir a URL no
fonte. No container novo do Quickstart, a origin do Studio apareceu tanto em
`CORS_ALLOWED_ORIGINS` quanto em
`APP_SECURITY_CONFIG_ORIGIN_RESTRICTION_ALLOWED_ORIGINS`; o preflight real
retornou `200`.

Pelo site publicado, uma sessão de author carregou as dez decisões do caso de
referência. Em uma sessão separada de auditor, o backend publicou leitura `200`
e recusou a action operacional com `403`. Nenhuma Definition, workspace,
publicação, snapshot ou autoridade foi alterada durante essa prova.

Uma primeira execução mostrou `condition` ausente porque o seed do Rule Lab
estava desabilitado e, quando ativado, ainda usava um escopo fixo diferente do
principal. O Quickstart PR `#199` removeu esse hardcode: o seed usa agora
`praxis.rule-lab.snapshot.tenant-id/environment` e falha fechado para escopo
vazio. A homologação habilitou explicitamente o seed em `default/prod`; não foi
aberta leitura cross-tenant.

Depois do novo deploy, o author carregou a condição
`request.requestedAmount <= program.maxAmount`, criou um workspace governado e
um cenário `amount-within-limit`, e executou o sandbox. O receipt persistido
registrou `candidate=ALLOW`, `active=TECHNICAL_ERROR` e
`ACTIVE_SNAPSHOT_UNAVAILABLE`. Isso prova o candidate authorado e o fail-closed
da lane ativa sem snapshot; não prova publicação, ativação nem paridade com
Oracle/HADES.

Em 2026-08-17, a matriz Playwright live passou no ambiente publicado com anonymous
e seis personas. Em 2026-08-18, o deploy `dep-da1t7bnqj5pc73d4csf0` publicou o
caso neutro e o deploy backend `dep-da1t4s142hec73f572hg` publicou o seed corrigido
e o Config `rc.127`. Health, artefato estático e recusa anônima foram revalidados;
a nova asserção de catálogo não vazio passou localmente contra o mesmo Neon, mas
não foi repetida no site publicado porque os secrets não foram extraídos do Render.
