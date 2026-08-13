# Praxis Policy Studio

Workstation independente da plataforma Praxis para compreender, criar, testar e operar decisões governadas. O ErgonX é o primeiro consumidor; contratos e semântica do produto permanecem neutros em relação ao domínio.

## Estado atual

`PS-001` implementa somente o shell e uma fixture hermética read-only. Não há publicação, ativação, persistência, mudança de autoridade ou conexão com ambientes do ErgonX.

## Requisitos

- Node.js 20.19+ ou 22.12+
- npm 10+

## Executar

```powershell
npm ci
npm start
```

Abra `http://localhost:4302/catalog`.

## Configuração

`public/app-config.json` é carregado no início. O modo `fixture` não exige endpoint. O modo `remote` falha fechado quando `configApiBaseUrl` não é informado. Nenhum tenant, token ou segredo deve ser versionado.

## Gates

```powershell
npm test
npm run build
```

