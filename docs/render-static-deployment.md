# Deployment estático homologado no Render

O Rules Studio pode ser publicado separadamente do Quickstart sem versionar a
URL do ambiente. O build materializa o endpoint padrão e os perfis selecionáveis
em `app-config.json` no diretório de saída Angular.

## Configuração do site

- build command: `npm ci && npm run build:static`;
- publish directory: diretório de saída Angular configurado no build estático (`dist/<app-name>/browser`);
- environment: `RULES_STUDIO_CONFIG_API_BASE_URL`, contendo somente a origin
  HTTPS do Quickstart, sem path, query, fragmento ou credenciais;
- environment opcional: `RULES_STUDIO_ERGON_API_BASE_URL`, contendo somente a origin HTTPS do Ergon, distinta do Quickstart;
- rewrite SPA: `/*` para `/index.html`.

A homologação oficial está publicada em
`https://<studio-homolog-host>.onrender.com` (serviço Render
`srv-da0fbqlbedkc73ald6e0`) e aponta para o Quickstart público canônico
`https://praxis-api-quickstart.onrender.com`. A URL e o identificador
do serviço são evidência operacional; não são contrato de produto nem endpoint de
produção.

O script falha fechado quando a variável está ausente, malformada ou contém uma
URL que não seja uma origin HTTPS. Ele altera apenas o `app-config.json` dentro de
`dist`; `public/app-config.json` permanece adequado ao proxy local oficial.

## Sessão e segurança

O seletor **Host governado** inicia no Quickstart. Com as duas variáveis
configuradas, o build lista Quickstart e Ergon. A seleção de outro host reabre
o catálogo e descarta a seleção, o escopo recebido por deep-link e o token em
memória da sessão anterior. Um link do host pode fornecer `apiBaseUrl` com sua
origin exata e suas coordenadas governadas. O Studio aceita como override
somente as origens implantadas em `hostProfiles`. Um endereço desconhecido
interrompe a abertura do catálogo com `SETUP_UNTRUSTED_HOST`. A abertura sem
`apiBaseUrl` carrega o backend padrão. A projeção estática do Quickstart é restaurada ao
voltar ao perfil padrão.

Para validar o artefato, confira que `configApiBaseUrl` é a origin do
Quickstart e que os itens de `hostProfiles` têm as origens HTTPS configuradas.
Verifique com uma sessão do Ergon que o catálogo PAP, a releitura de um draft
e a consulta de releases chegam ao host selecionado. A publicação, ativação
e reversão dependem dos papéis e dos gates de aprovação e verificação do host.

O Angular limita as requisições governadas ao host ativo. O navegador mantém
o cookie HttpOnly do respectivo host. O Studio recebe `X-XSRF-TOKEN` em
`GET /auth/session` e o vincula à origin e ao tenant em memória. Cada host
deve admitir a origin exata do Studio no CORS com credenciais e no filtro
de Origin do Config, aceitar os cabeçalhos de escopo e CSRF e expor
`X-XSRF-TOKEN` na resposta. Sessões entre sites exigem que a política de
cookies do host e do navegador permita enviar a sessão nesse contexto.

Este deployment é uma superfície de homologação. Ele não substitui IdP/BFF
corporativo, não transforma o login do Quickstart em IAM de produção e não muda
tenant, environment, capabilities, ETag ou segregação de funções no browser.

## Migração para o Quickstart canônico em 2026-08-26

O deploy Render `dep-da7ggr142hec73bo2qr0` materializou
`RULES_STUDIO_CONFIG_API_BASE_URL=https://praxis-api-quickstart.onrender.com`.
O log do build registrou
`POLICY_STUDIO_STATIC_DEPLOYMENT_OK backend=https://praxis-api-quickstart.onrender.com`
e o `app-config.json` publicado confirmou `mode=remote` com essa mesma origin.

Antes da migração, o Quickstart público foi validado com a origin exata do Studio:
catálogo estrutural `200`, headers CORS `Access-Control-Allow-Origin` e
`Access-Control-Expose-Headers: ETag, X-Schema-Hash, X-Data-Version`, preflight de
Config `200` e liveness `UP`. O serviço temporário
`praxis-enterprise-proof-sandbox-v2` deixa de ser dependência do Rules Studio; sua
suspensão continua condicionada à auditoria de todos os demais consumidores
publicados.

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
sistemas legados corporativos.

Em 2026-08-17, a matriz Playwright live passou no ambiente publicado com anonymous
e seis personas. Em 2026-08-18, o deploy `dep-da1t7bnqj5pc73d4csf0` publicou o
caso neutro e o deploy backend `dep-da1t4s142hec73f572hg` publicou o seed corrigido
e o Config `rc.127`. Health, artefato estático e recusa anônima foram revalidados;
a nova asserção de catálogo não vazio passou localmente contra o mesmo Neon, mas
não foi repetida no site publicado porque os secrets não foram extraídos do Render.
