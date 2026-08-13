# AGENTS.md — Praxis Policy Studio

## Escopo

Aplica-se a todo o repositório.

## Fronteiras canônicas

- O Studio é experience plane; não possui lifecycle, snapshot, ETag ou autoridade.
- `praxis-config-starter` é o control plane.
- `praxis-rules-engine` possui compilação e avaliação determinística.
- O host consumidor possui facts, autorização, transação e efeitos.
- Projeções de domínio são read-only, baseadas em refs/digests e não copiam semântica.

## Regras

- consumir somente pacotes públicos `@praxisui/*`;
- não introduzir hardcodes Ergon no core;
- não inferir capability, ator, versão, ETag ou escopo no browser;
- toda copy de chrome deve existir em `pt-BR` e `en-US`;
- nenhum segredo, tenant ou credencial pode ser versionado;
- estados de erro, readonly e permission-limited são parte do contrato de UX.

## Gates mínimos

```powershell
npm run lint
npm test
npm run build
```

Mudança visual relevante também exige inspeção desktop e narrow na porta oficial
`4302`.

