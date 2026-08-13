# Praxis Policy Studio

O Praxis Policy Studio é a estação de trabalho da plataforma Praxis para
compreender, comparar e evoluir decisões de negócio governadas. Ele transforma
regras que normalmente ficam dispersas entre código, banco, documentação e
configuração em uma experiência rastreável para pessoas técnicas e de negócio.

O ErgonX é o primeiro consumidor e fornece o primeiro pacote de domínio real,
mas não é uma dependência arquitetural do produto. O core do Studio deve
continuar reutilizável por qualquer solução que publique os contratos Praxis de
decisão, Config e projeção de domínio.

## Comece por aqui

| Se você quer... | Leia |
| --- | --- |
| entender por que o produto existe e quais problemas deve resolver | [Visão do produto e casos de uso](docs/product-vision-and-use-cases.md) |
| entender owners, contratos, fluxos e limites de segurança | [Arquitetura e guia de continuidade](docs/architecture-and-continuation-guide.md) |
| preparar a máquina e contribuir sem acesso ao Ergon | [Guia de contribuição](CONTRIBUTING.md) |
| conhecer a decisão arquitetural de fundação | [ADR 0001 — fronteira do produto](docs/adr/0001-product-boundary.md) |
| conferir a primeira prova de integração protegida | [Prova de leitura do Config](docs/config-read-live-proof-2026-08-13.md) |

## O que já funciona

- shell Angular independente, responsivo e bilíngue (`pt-BR` e `en-US`);
- catálogo e busca das 14 decisões do RuleSet RN-013;
- projeções de domínio validadas por identidade, ordem, facts, evidências e
  fronteira de autoridade;
- leitura autenticada das definições, capabilities e timeline no Praxis Config;
- estados explícitos de login necessário, acesso limitado, erro e somente leitura;
- inspeção de condição, facts, semântica de `null`, precedência, operações,
  origem e evidências;
- edição focal pelo Visual Builder oficial;
- comparação entre a definição carregada e o draft;
- criação de uma nova versão imutável em estado `draft`, somente quando o
  servidor retorna a capability `CREATE_NEW_VERSION`.

Criar um draft **não** publica, materializa, cria snapshot, ativa a regra, altera
o Oracle nem transfere autoridade de execução. A baseline RN-013 continua
`KEEP_DB_BACKED / LEGACY_AUTHORITATIVE`.

## O que ainda não funciona

- seleção dinâmica de vários pacotes de domínio na interface;
- edição genérica de todas as decisões e tipos de regra;
- validação semântica humana ou homologação de negócio;
- simulação contra facts do host consumidor;
- revisão e aprovação de mudanças;
- publicação, materialização, ativação, rollback e comparação de snapshots;
- operação corporativa completa, incluindo políticas de segregação, retenção,
  auditoria e observabilidade.

Esses itens são roadmap, não capacidades implícitas. O Studio nunca deve simular
no browser uma autorização ou um estado que pertença ao servidor.

## Executar sem Ergon

Requisitos:

- Node.js 20.19+ ou 22.12+;
- npm 10+.

Instale e valide:

```powershell
npm ci
npm run lint
npm test
npm run check:projections
npm run build
```

Para navegar sem Quickstart, Oracle, VPN ou credenciais do Ergon, altere
temporariamente `public/app-config.json` para:

```json
{
  "mode": "fixture",
  "configApiBaseUrl": null,
  "locale": "pt-BR"
}
```

Depois execute:

```powershell
npm start
```

Abra `http://localhost:4302/catalog`. O catálogo usa a projeção RN-013
versionada no próprio repositório e não acessa o banco legado. Antes de criar um
commit, restaure `public/app-config.json`, pois a configuração versionada da POC
permanece no modo remoto oficial.

## Executar integrado ao Config

A configuração versionada aponta para `http://localhost:8088`. Nesse modo o
Studio usa a sessão `HttpOnly` do host de referência e chama as superfícies
protegidas de `/api/praxis/config/domain-rules/**`. O browser não envia nem
infere tenant, ambiente, authority ou capability; o servidor resolve o escopo.

Uma sessão ausente exibe o login explícito de desenvolvimento. O formulário
chama `/auth/login`, recebe apenas o cookie do host e descarta usuário e senha
após a tentativa. Nenhuma credencial deve ser versionada.

## Projeções de domínio

Uma projeção é um read model verificável para apresentação. Ela referencia
identidades, ordem, facts, fontes e limites de evidência já governados; não copia
expressões executáveis nem se torna uma nova fonte de verdade.

As projeções versionadas atuais são:

- `ergonx-rn013.v1.json`: primeiro pacote real, exibido pelo catálogo atual;
- `quickstart-benefit-eligibility.v1.json`: fixture neutra que prova o contrato
  de projeção e prepara o segundo consumidor; ainda não é selecionável na UI.

Para conferir ambas:

```powershell
npm run check:projections
```

Para regenerar a projeção RN-013 a partir de um checkout governado da migração:

```powershell
npm run generate:ergonx-projection -- D:\caminho\para\Techne-ErgonX-migracao
npm run check:projections
```

Essa regeneração é opcional para trabalhar no core do Studio. Ela só é necessária
quando as fontes governadas do domínio ErgonX mudarem.

## Princípio central

O Studio explica e propõe mudanças; o Config governa versões e lifecycle; o
Rules Engine compila e avalia; o host fornece facts, autorização, transação e
efeitos. Nenhuma evolução pode misturar esses papéis por conveniência local.
