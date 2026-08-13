# Praxis Policy Studio

Workstation independente da plataforma Praxis para compreender, criar, testar e operar decisões governadas. O ErgonX é o primeiro consumidor; contratos e semântica do produto permanecem neutros em relação ao domínio.

## Estado atual

`PS-001` implementa o shell e `PS-003` adiciona projeções read-only validadas.
Não há publicação, ativação, persistência, mudança de autoridade ou conexão
com ambientes do ErgonX.

O catálogo carrega 14 referências RN-013 geradas a partir do materializador
Config e do contrato Java, mais uma fixture contratual neutra do Quickstart.
O manifesto não contém expressões, facts reais, credenciais ou lifecycle.

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
npm run check:projections
npm run build
```

Para atualizar a projeção RN-013 a partir de um checkout governado da migração:

```powershell
npm run generate:ergonx-projection -- D:\caminho\para\Techne-ErgonX-migracao
npm run check:projections
```

O gerador falha se materializador e host não tiverem exatamente as mesmas 14
identidades na mesma ordem. IDs das definições Config permanecem explicitamente
`NOT_RESOLVED_IN_VERSIONED_EVIDENCE`; o Studio não os infere.
