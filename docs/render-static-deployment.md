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
