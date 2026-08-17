# Evidência de navegador — discovery e explicação por IA

Data: 2026-08-16  
Escopo: Policy Studio `feat/assistant-domain-rule-discovery`  
Origem oficial: `http://127.0.0.1:4302/catalog`

## O que a prova cobre

O cenário corporativo controlado executa a jornada completa do primeiro slice
read-only:

1. a pessoa descreve uma necessidade de negócio;
2. o cliente inicia um turno no runtime canônico de authoring;
3. o terminal só é aceito com `canApply=false`, `source=searchDomainRules` e
   `praxis-domain-rule-search.v1`;
4. o Studio reconcilia ID, `ruleKey` e versão com a projeção ativa;
5. a pessoa seleciona a identidade exata;
6. um novo turno usa `selectedDomainDecisionRef` para explicar a versão;
7. a explicação só é mostrada quando `inspectDomainDecision` atesta a mesma
   identidade, fingerprints e versão.

O teste também mantém candidatos externos visíveis, porém não selecionáveis. O
browser não fabrica detalhe, scope, capability ou autoridade quando a decisão não
pertence à projeção carregada.

## Gates executados

```text
npm run lint
npm test
npx playwright test e2e/policy-studio-corporate.spec.ts
npm run check:projections
npm run check:local-runtime
```

Resultados:

- TypeScript app/spec: verde;
- 13 arquivos e 71 testes Vitest: verdes;
- 8 cenários Playwright desktop/narrow: verdes;
- axe: zero violações no fluxo novo;
- overflow horizontal: ausente em `1440×1000` e `390×844`;
- `ng serve` compilou o bundle do catálogo na porta oficial `4302`.

O `ng build` de produção não foi aceito como verde local: o binário nativo do
esbuild encerrou com deadlock/sinal `134`. A mesma falha foi reproduzida sem este
patch em um worktree limpo de `origin/main`, portanto não é regressão introduzida
pelo discovery. O CI remoto permanece o gate de build deste corte.

## Limites honestos

- o backend do Playwright é controlado; esta evidência não substitui o smoke HTTP
  com Config/Quickstart publicados;
- a tool busca todo o escopo autorizado, mas o detalhe do Studio ainda depende de
  `projectionPath`;
- não há criação, edição ou publicação por agente neste slice;
- labels/prompts dos candidatos são apresentação; somente a referência
  estruturada participa do próximo turno.
