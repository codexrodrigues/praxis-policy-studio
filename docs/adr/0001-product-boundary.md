# ADR 0001 — fronteira do Praxis Rules Studio

- Estado: aceito para o incremento de fundação
- Data: 2026-08-12

## Decisão

O Praxis Rules Studio nasce como deployable Angular independente (plano de experiência do **Praxis Decision Studio**). Ele consome pacotes públicos `@praxisui/*`, o control plane do Praxis Config (`praxis-config-starter`) e contratos de decisão da plataforma (`praxis-rules-engine` para `decisionKind = BUSINESS` e `praxis-authz-contracts` para `decisionKind = AUTHORIZATION`), mas não redefine nenhum desses owners nem mistura `DecisionBinding` (regras de negócio em JSON Logic) com `RuntimeEnforcementBinding` (políticas de acesso, escopo de dados e mascaramento em OPA/Rego).

O core do produto permanece neutro em relação ao ErgonX. Conteúdo de domínio é
recebido por projeções read-only baseadas em referências e digests. O ErgonX é
o primeiro consumidor e o Rule Lab do Quickstart é o caso neutro de prova local.

## Limites do incremento atual

Este ADR registra a fronteira decidida no incremento de fundação. Desde então,
o produto passou a possuir leitura remota autenticada, inspeção, authoring focal
e change workspaces governados. Capacidades posteriores também projetam cenários,
review/promotion, readiness/publicação, snapshots, rollback e staged rollout.
Elas respeitam a fronteira porque cada comando é solicitado ao owner canônico; o
Studio não executa regras, compõe snapshots no browser nem muda autoridade por
conta própria. Algumas actions ainda precisam ser completadas no Config antes de
uso corporativo.

`PS-003` materializa apenas o read model interno por referências, digests e
limites de evidência. O manifesto gerado não se torna fonte semântica e falha
fechado em cardinalidade, ordem ou autoridade divergentes.

## Dependências originalmente identificadas

- `PS-003`: projeção interna mínima, sem nova fonte semântica — concluída;
- `CFG-READ-001`: read plane autenticado e escopo server-owned — concluído para
  a superfície consumida pelo catálogo;
- adapter e catálogo reais — concluídos para o primeiro slice RN-013.

O estado corrente, as limitações e o roadmap não são mantidos neste ADR
histórico. Consulte a [arquitetura e o guia de continuidade](../architecture-and-continuation-guide.md).

## Consequências

- nenhum import por source path ou Maven/npm local;
- nenhum tenant, segredo ou endpoint corporativo fixado no código;
- configuração remota inválida falha fechado;
- ações são exibidas apenas por capabilities server-owned; lacunas conhecidas de
  Definition create, publicação, create rollout e rollout-policy permanecem
  blockers explícitos, não autorização implícita.
