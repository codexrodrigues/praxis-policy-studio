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


## Economia de GitHub Actions

O padrão durante desenvolvimento é zero execuções remotas. Valide localmente o escopo alterado; commits, PRs, documentação interna e conclusão de tarefas não são motivos para iniciar Actions. Use os workflows manuais somente no fechamento autorizado de uma versão/publicação ou na prova necessária do host já implantado. Não use `[skip ci]` como mecanismo principal nem desabilite checks/proteções para economizar.

Antes de push, tag ou dispatch, confira os gatilhos reais de `.github/workflows/`. Tags de release publicam artefatos: não criá-las para testar a automação. Diagnostique localmente antes de repetir um job; conserve a evidência da revisão e dos artefatos usados. Monitores operacionais explicitamente mantidos são independentes do CI de commits. Consulte [ACTIONS-RELEASE-POLICY.md](ACTIONS-RELEASE-POLICY.md) para os pontos de entrada e recuperação.
