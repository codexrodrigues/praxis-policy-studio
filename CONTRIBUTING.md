# Contribuindo com o Praxis Policy Studio

Este guia é destinado a pessoas e agentes que precisam analisar, corrigir ou
ampliar o projeto sem depender de conhecimento prévio do ErgonX.

## 1. Leitura obrigatória

1. [README.md](README.md)
2. [Visão do produto e casos de uso](docs/product-vision-and-use-cases.md)
3. [Arquitetura e guia de continuidade](docs/architecture-and-continuation-guide.md)
4. [AGENTS.md](AGENTS.md), quando o trabalho for realizado por um agente

## 2. Preparação

```powershell
git clone https://github.com/codexrodrigues/praxis-policy-studio.git
cd praxis-policy-studio
npm ci
npm run lint
npm test
npm run check:projections
npm run build
```

Esses comandos não exigem Ergon, Oracle ou VPN. O build não deve depender de
pacotes npm locais, symlinks ou arquivos fora do repositório.

## 3. Escolha do modo

### Fixture

Use para desenvolvimento autônomo. Configure localmente:

```json
{
  "mode": "fixture",
  "configApiBaseUrl": null,
  "locale": "pt-BR"
}
```

O modo fixture não prova autenticação, autorização, persistência nem lifecycle.

### Remote

Use para integrar com um host que exponha o Praxis Config. A configuração padrão
da POC é:

```json
{
  "mode": "remote",
  "configApiBaseUrl": "http://localhost:8088",
  "locale": "pt-BR"
}
```

Credenciais são fornecidas por canal seguro e nunca entram em código, docs,
fixtures, logs ou commits.

## 4. Regras de contribuição

- preserve as fronteiras descritas no `AGENTS.md`;
- mantenha o core neutro em relação ao consumidor;
- use apenas APIs públicas de `@praxisui/*`;
- não crie aliases ou contratos paralelos para contornar o owner correto;
- não inferir capability, tenant, ambiente, ator, versão ou ETag no browser;
- escreva toda copy de chrome em `pt-BR` e `en-US`;
- diferencie claramente capacidade implementada, prova executada e roadmap;
- acompanhe comportamento novo com teste reproduzível sem infraestrutura privada;
- não altere projeção gerada manualmente quando a fonte governada estiver
  disponível; regenere e revise o diff.

## 5. Estrutura do repositório

| Caminho | Responsabilidade |
| --- | --- |
| `src/app/core` | contratos, config, sessão, integração e lógica sem UI de domínio |
| `src/app/features/catalog` | catálogo, inspeção e coordenação da experiência |
| `src/app/features/authoring` | adaptação do editor oficial para drafts |
| `public/projections` | read models versionados de consumidores |
| `tools` | geração e validação determinística de projeções |
| `docs/adr` | decisões arquiteturais aceitas |
| `docs` | visão, evidências, arquitetura e continuidade |

## 6. Fluxo de mudança

1. classifique a mudança (`local-pequena`, `transversal`, `arquitetural`,
   `contrato-publico` ou `docs-apenas`);
2. identifique o owner canônico;
3. para mudança transversal, arquitetural ou pública, escreva mapa de impacto;
4. implemente o menor slice vertical verificável;
5. rode os gates proporcionais ao risco;
6. revise artefatos derivados e documentação;
7. registre limitações e próximo passo sem transformar roadmap em conclusão.

## 7. Gates

Baseline técnica:

```powershell
npm run lint
npm test
npm run check:projections
npm run build
```

Para mudança visual, execute também inspeção desktop e narrow na porta `4302`.
Para integração, registre endpoint, status HTTP, capability observada e efeito
persistido, sem expor dados sensíveis.

## 8. Critérios de aceite de uma contribuição

- o job do usuário está explícito;
- o owner correto foi preservado;
- não há hardcode ou dependência privada no core;
- erros e falta de permissão são visíveis;
- o teste falha antes e passa depois da correção, quando aplicável;
- execução hermética continua disponível;
- documentação e código descrevem a mesma capacidade;
- qualquer afirmação sobre Ergon está apoiada pela projeção/evidência versionada
  ou marcada como não verificada;
- nenhum commit contém segredo ou arquivo local de ambiente.

## 9. Como pedir continuidade a outro agente

Uma solicitação útil contém somente contexto verificável:

```text
Objetivo: <resultado observável>.
Base: <repositório, branch e commit>.
Owner afetado: <Studio, Config, Engine, host ou domínio>.
Artefatos relevantes: <arquivos e contratos>.
Gate esperado: <comandos e comportamento>.
Limites: não publicar, não ativar, não alterar autoridade, quando aplicável.
```

O agente deve conseguir iniciar em `fixture` e separar claramente o que depende
de integração remota. Nunca presuma que ele tenha acesso ao Ergon.

