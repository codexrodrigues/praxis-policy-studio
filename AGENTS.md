# AGENTS.md — Praxis Policy Studio

## Escopo

Aplica-se a todo o repositório.

## Fronteiras canônicas

- O Studio é experience plane; não possui lifecycle, snapshot, ETag ou autoridade.
- `praxis-config-starter` é o control plane.
- **Separação Ortogonal na Praxis Decision Platform (`BUSINESS` vs. `AUTHORIZATION`):**
  - O `praxis-policy-studio` atua como o **Praxis Decision Studio** unificado sobre o control plane `/api/praxis/config/domain-rules/**`, separando claramente duas experiências distintas:
    - **Regras de Negócio (`decisionKind = BUSINESS`):** invariantes transacionais, elegibilidade e validações em JSON Logic executadas pelo `praxis-rules-engine`.
    - **Políticas de Acesso, Mascaramento e Privacidade (`decisionKind = AUTHORIZATION`, `ruleType = "authorization_policy"`):** políticas RBAC/ABAC/LGPD compiladas em unidades Rego (`targetLayer = "policy_engine"`, `targetArtifactType = "opa-policy"`) e executadas por `praxis-authz-starter` / `praxis-authz-enforcement-core` / `praxis-authz-opa`.
- `praxis-rules-engine` possui compilação e avaliação determinística de regras de negócio (`decisionKind = BUSINESS`).
- O host consumidor possui facts, autorização, transação e efeitos.
- Projeções de domínio são read-only, baseadas em refs/digests e não copiam semântica.
- **Convergência Multi-Host (`praxis-api-quickstart` `:8088` e hosts corporativos) e DAG de 5 Estágios (`DecisionStage`):**
  - `npm start` encaminha para o Quickstart (`proxy.conf.json` $\rightarrow$ `http://127.0.0.1:8088`), além de suportar perfis de proxy dedicados para hosts corporativos na barra superior e resolução fail-closed de `?apiBaseUrl=...`;
  - O componente `<pax-rule-decision-plan-dag>` materializa os 5 estágios canônicos de `DecisionStage` (`PROTECTED_GUARD`, `DOMAIN_DECISION`, `POST_DECISION`, `TRANSFORMATION_INTENT`, `EFFECT_INTENT`), políticas de slot (`FORBIDDEN`, `PARAMETERIZABLE`, `RESTRICT_ONLY`, `EXTEND_ONLY`, `REPLACEABLE`), linhagem PL/SQL (`legacyOccurrence`), navegação ontológica 1-hop (`availableRoots` / `conceptRoots`) e trace visual de divergência (`sandboxRun` / `latestTestRun`);
  - Slots `OverridePolicy.FORBIDDEN` ou `executorKind = JAVA` são projetados no DAG em modo somente-leitura (`authoringSupported = false` / `CATALOG_IDENTITY_ONLY`) para garantir visibilidade completa de guards estruturais sem expor edição indevida;
  - Deep-links `/catalog?resourceKey=...&ruleSetKey=...&slotKey=...&bindingKey=...&decisionKey=...` resolvem diretamente o slot solicitado e abrem automaticamente o painel de detalhe em viewports estreitas (`hasExplicitDeepLink()`).

## Regras

- consumir somente pacotes públicos `@praxisui/*`;
- não introduzir hardcodes de clientes ou hosts específicos no core;
- não inferir capability, ator, versão, ETag ou escopo no browser;
- toda copy de chrome deve existir em `pt-BR` e `en-US`;
- nenhum segredo, tenant ou credencial pode ser versionado;
- estados de erro, readonly e permission-limited são parte do contrato de UX.

## Gates mínimos

```powershell
npm run lint
npm test
npm run build
npm run e2e
```

Mudança visual relevante também exige inspeção desktop e narrow na porta oficial
`4302`.


## Economia de GitHub Actions

O padrão durante desenvolvimento é zero execuções remotas. Valide localmente o escopo alterado; commits, PRs, documentação interna e conclusão de tarefas não são motivos para iniciar Actions. Use os workflows manuais somente no fechamento autorizado de uma versão/publicação ou na prova necessária do host já implantado. Não use `[skip ci]` como mecanismo principal nem desabilite checks/proteções para economizar.

Antes de push, tag ou dispatch, confira os gatilhos reais de `.github/workflows/`. Tags de release publicam artefatos: não criá-las para testar a automação. Diagnostique localmente antes de repetir um job; conserve a evidência da revisão e dos artefatos usados. Monitores operacionais explicitamente mantidos são independentes do CI de commits. Consulte [ACTIONS-RELEASE-POLICY.md](ACTIONS-RELEASE-POLICY.md) para os pontos de entrada e recuperação.
