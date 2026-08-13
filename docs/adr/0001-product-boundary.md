# ADR 0001 — fronteira do Praxis Policy Studio

- Estado: aceito para o incremento de fundação
- Data: 2026-08-12

## Decisão

O Praxis Policy Studio nasce como deployable Angular independente. Ele consome
pacotes públicos `@praxisui/*`, o control plane do Praxis Config e contratos do
Praxis Rules Engine, mas não redefine nenhum desses owners.

O core do produto permanece neutro em relação ao ErgonX. Conteúdo de domínio é
recebido por projeções read-only baseadas em referências e digests. O ErgonX é
o primeiro consumidor e o Quickstart será o segundo consumidor de prova.

## Limites do incremento atual

`PS-001` contém somente shell, roteamento, configuração, i18n e fixture
hermética. Não há conexão remota, authoring, persistência, publicação,
ativação, execução ou mudança de autoridade.

## Próximas dependências

- `PS-003`: projeção interna mínima, sem nova fonte semântica;
- `CFG-READ-001`: read plane autenticado e escopo server-owned;
- somente depois: adapter e catálogo reais.

## Consequências

- nenhum import por source path ou Maven/npm local;
- nenhum tenant, segredo ou endpoint corporativo fixado no código;
- configuração remota inválida falha fechado;
- ações futuras serão exibidas apenas por capabilities server-owned.

