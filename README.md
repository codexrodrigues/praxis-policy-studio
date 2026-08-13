# Praxis Policy Studio

Workstation independente da plataforma Praxis para compreender, criar, testar e operar decisões governadas. O ErgonX é o primeiro consumidor; contratos e semântica do produto permanecem neutros em relação ao domínio.

## Estado atual

`PS-001` implementa o shell, `PS-003` adiciona projeções read-only validadas e
o primeiro slice de `PS-002/PS-004` conecta essas referências ao catálogo e à
timeline segura do Config quando o modo remoto é habilitado. Não há publicação,
ativação, persistência ou mudança de autoridade.

O catálogo carrega 14 referências RN-013 geradas a partir do materializador
Config e do contrato Java, mais uma fixture contratual neutra do Quickstart.
O manifesto não contém expressões executáveis nem credenciais. Ele projeta os
schemas dos facts a partir de `FACT_PROVIDER_EVIDENCE` verificado e das
anotações deliberadas do DTO Java; condição e lifecycle continuam vindo do
Config autenticado.

## Requisitos

- Node.js 20.19+ ou 22.12+
- npm 10+

## Executar

```powershell
npm ci
npm start
```

No modo remoto, uma sessão ausente exibe o login explícito do ambiente de desenvolvimento. O formulário chama o endpoint canônico `/auth/login`, recebe apenas o cookie `HttpOnly` do host e descarta os campos após a tentativa; o Policy Studio não persiste senha ou token.

Abra `http://localhost:4302/catalog`.

## Configuração

`public/app-config.json` é carregado no início. A configuração versionada desta
POC usa o modo `remote` e o endpoint local oficial
`http://127.0.0.1:8088`. Ela não contém credenciais. O modo `remote` falha
fechado quando `configApiBaseUrl` não é informado, consulta definições e timeline por
`/api/praxis/config/domain-rules/**` e usa a sessão autenticada do host. O
browser não envia nem infere tenant, ambiente, authority ou capability; esse
escopo é resolvido pelo servidor. Nenhum token ou segredo deve ser versionado.

O catálogo distingue indisponibilidade de falta de permissão e não transforma
status técnico do Config em homologação de negócio. A projeção governada segue
sendo a fonte das 14 identidades e da ordem; o Config apenas acrescenta o estado
persistido que tenha a mesma chave canônica.

No modo remoto, a inspeção de cada decisão mostra a condição em leitura
simbólica, os facts referenciados, a semântica de `null`, as operações cobertas,
a posição na precedência e as evidências de origem. A comparação entre baseline
e draft é deliberadamente assimétrica: o Oracle legado continua indicado como
autoridade operacional, enquanto o Config aparece apenas como draft técnico.
Esta superfície não oferece edição, publicação ou ativação.

A decisão focal editável abre o Visual Builder oficial em um chunk lazy. O
workspace altera somente memória local, mostra validações e permite restaurar a
condição carregada. Ele deliberadamente não possui comando HTTP de gravação,
publicação, materialização, snapshot ou ativação.

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
