# ADR 0001 — fronteira do Praxis Policy Studio

- Estado: aceito para o incremento de fundação
- Data: 2026-08-12

## Decisão

O Praxis Policy Studio nasce como deployable Angular independente. Ele consome
pacotes públicos `@praxisui/*`, o control plane do Praxis Config e contratos do
Praxis Rules Engine, mas não redefine nenhum desses owners.

O core do produto permanece neutro em relação ao ErgonX. Conteúdo de domínio é
recebido por projeções read-only baseadas em referências e digests. O ErgonX é
o primeiro consumidor e o Rule Lab do Quickstart é o caso neutro de prova local.

## Limites do incremento atual

Este ADR registra a fronteira decidida no incremento de fundação. Desde então,
o produto passou a possuir leitura remota autenticada, inspeção, authoring focal
e criação governada de nova versão `draft`. Essas capacidades posteriores
respeitam a fronteira: não há publicação, ativação, execução pelo Studio ou
mudança de autoridade.

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
- ações futuras serão exibidas apenas por capabilities server-owned.
