# Handoff Corporativo — Policy Studio 0.1.0-beta.5

Este corte permite ao agente da migração validar a integração de um host corporativo sem acesso a banco legado
local. O caso neutro do Quickstart reproduz o fluxo de decisões ordenadas,
condições JSON Logic, facts opcionais, cenários, revisão e promoção que será usado
pelos pacotes corporativos, mantendo o núcleo do Studio independente de qualquer produto consumidor.

## Baseline compatível

- Rules Studio `0.1.0-beta.5`, porta oficial `4302`;
- Quickstart com dez slots de catálogo e sete definições governadas no caso Policy,
  porta oficial `8088`;
- `@praxisui/*` `9.0.5-rc.18`, incluindo o client público de workspaces,
  snapshots e Test Runs; o transport operacional V57 para adapters externos ainda
  não está publicado no artefato de contracts;
- `praxis-config-starter` `0.1.0-rc.109`, schema Flyway `V57`;
- banco Config Neon compartilhado como control plane canônico;
- banco operacional Neon separado para evidências runtime.

Não crie schema ou banco próprio do Studio. Definitions, drafts, scenarios, Test
Runs, reviews, snapshots, rollout e observações pertencem aos contratos canônicos
do Config. O browser só projeta essas entidades.

## Prova local sem host corporativo

1. Inicie o Quickstart com os dois datasources PostgreSQL remotos e os segredos locais exigidos.
2. Garanta que as origins permitidas incluam `http://localhost:4302` e
   `http://127.0.0.1:4302`.
3. No Studio, execute `npm ci`, `npm run check:local-runtime` e `npm start`.
4. Abra `http://localhost:4302/catalog` e autentique no host de desenvolvimento.
5. Verifique os dez slots neutros, as sete definições governadas e confirme que
   toda decisão editável carrega condição por leitura de detalhe.
6. Execute cenários candidate × active, persista o draft com ETag, submeta para
   revisão com autor diferente do aprovador e percorra promoção/readiness.

O proxy de desenvolvimento é parte do contrato deste corte: `/auth` e `/api`
são encaminhados para `127.0.0.1:8088`, preservando cookie same-origin.

## Encaixe do host consumidor

O adaptador corporativo deve publicar identidades, facts, precedência e evidências como
projeção derivada. Ele não deve persistir uma segunda definição executável nem
transformar código legado, Java ou telas antigas em fonte canônica do Studio. Condição,
versão e lifecycle vêm do Config; avaliação vem do Rules Engine/host; facts,
efeitos e autoridade transacional permanecem no host consumidor.

O Quickstart mantém um primeiro corpus neutro executável de hazards em artefato portátil próprio. A
autoridade desse corpus é explicitamente `SYNTHETIC_BASELINE`: ele permite
desenvolvimento local, mas não constitui corpus de paridade nem compara candidato
com baseline legado. No host consumidor, cada caso
deve ser ligado ao handoff aprovado da Parte 1 e comparado com a rota legada.

O primeiro baseline corporativo suficientemente fechado é o pacote inicial de regras funcionais de referência, nas operações CREATE e UPDATE da rota canônica do recurso. O gate da fábrica está
`Ready with adjustments`, mantém o legado como autoridade e exige persistência
real. DELETE e decisões de pacotes temporais fora de escopo também não devem ser misturados neste primeiro corte.

A fábrica já possui uma matriz DB-backed de 38 casos para esse pacote: 14 negativas
em CREATE e UPDATE, limites inclusivos de data, semântica de `null` e colisões de
precedência. A profundidade da evidência varia por caso; nem todos registram a
mesma contagem de chamadas, readback e cleanup. Os artefatos continuam sob a
Parte 1 no repositório da fábrica;
copiá-las como identidade de produto para o Quickstart tornaria o caso neutro
dependente do host corporativo. O adaptador deve importá-las futuramente como evidência
legada governada e preservar a proveniência da observação.

O primeiro trabalho do agente de integração é reconciliar portfolio, intake, inventário,
traceability matrix e phase gates. A decisão corporativa já validada em Java de
desenvolvimento em CREATE e UPDATE ainda precisa manter separação histórica quando
descrita no portfolio como `NOT_INTAKEN/NOT_STARTED`, sem mistura com decisões
ainda `NOT_INTAKEN` ou `BLOCKED` (especialmente agregação/concurrency), que permanecem
deferred e não podem ser apresentadas como cobertas pelo laboratório neutro.

A ativação só pode ocorrer depois de paridade registrada, gates de revisão e
snapshot governado. A restrição “UPDATE baseline-only” vale para o escopo histórico
do gate correspondente; a decisão já validada em CREATE e UPDATE permanece
em desenvolvimento sem promoção produtiva.

O corte inicial já executa 14 casos neutros com create/update como rótulos de
contexto,
limites inclusivos, imediatamente acima/abaixo, `null` explícito, fact ausente,
`NOT_APPLICABLE` e sobreposição de falhas com precedência determinística. O
modo de operação ainda não é enviado ao engine/host e, portanto, não prova
diferença de persistência, readback, DML, ETag ou cleanup entre CREATE e UPDATE. O
agente do host deve adaptar a evidência específica de trigger/rotina/engine legada, erro
legado, side effects e ausência de mutação em shadow para o Test Run V57. O Config
aceita referência/digest sanitizados, before/after, mutação ou não mutação,
cleanup, ledger de efeito e contagem de chamadas ao baseline. A V57 atual valida
e persiste esse shape, mas ainda aceita baseline `PENDING` e
`cleanupVerified=false`; portanto evidência ausente **não** mantém
automaticamente o resultado `INCONCLUSIVE` nem bloqueia promotion/publication.
Esse gate precisa ser governado por estágio no Config.

As três lanes de comparação são distintas e não podem ser renomeadas uma como a
outra:

1. candidato × snapshot ativo;
2. candidato × evidência legada registrada;
3. candidato × resultado esperado do cenário neutro.

O sandbox do Studio materializa a primeira e a terceira. O Config V57 é o owner
canônico da proveniência sanitizada, mas o baseline está no nível do run e cada
result expõe candidate × active; ainda não há lane legada independente por
cenário. O adapter host-owned corporativo precisa produzir essa prova depois que o
Config publicar o transport V57, idempotência e baseline por result. O Studio não
deve fabricar uma segunda API nem chamar o snapshot ativo de “baseline legado”.

## Limite conhecido deste corte

O Quickstart `main` que contém a lane V57 está dezenas de commits à frente do tag
`v2.0.0-rc.27`, embora o POM ainda declare essa versão. O agente deve fixar o
commit indicado no handoff operacional ou aguardar um novo release; o tag rc.27
sozinho não disponibiliza o laboratório descrito.

Não existe ainda endpoint/action/capability para invocar remotamente o executor
operacional do Quickstart. O agente de integração pode implementar interfaces, observers,
sanitização e testes fake em modo repository-only, mas deve aguardar o contrato
público antes de implementar o recorder HTTP final. A matriz canônica é um Test
Run idempotente com quatro results: CREATE/UPDATE × ALLOW/DENY.

A persistência operacional de observações depende da migração
`V20260813_001__rule_execution_observation_outbox.sql` no Neon operacional.
Ela deve ser aplicada somente pela identidade proprietária de migração. Até isso
acontecer, catálogo, authoring, cenários e lifecycle podem ser testados; a prova
durável de telemetria runtime permanece bloqueada.

## Integridade e governança da beta.5

- respostas assíncronas são invalidadas por recurso e por recarga, inclusive
  quando duas requisições atingem o mesmo workspace;
- troca de decisão limpa sandbox, readiness e resultado de publicação anteriores;
- perda de sessão ou permissão invalida catálogo e detalhe governado;
- save, cenário, Test Run, submit, review e promoção só aparecem e executam quando
  o Config os publica em `availableActions`; blockers também são server-owned;
- o client usado é `DomainRuleService` de `@praxisui/core`, sem DTO ou endpoint
  paralelo no Studio.

A prova local de 13 de agosto de 2026 executou `4302 → 8088 → Neon`, confirmou
schema `V56`, 40 versões de definição, três workspaces, capabilities `200` para
publisher e dois reviewers e `403` sem sessão. O workspace inspecionado estava
`PROMOTED`, por isso as três personas receberam somente `VIEW`; isso prova a
projeção de autorização, não todo o lifecycle mutante.

## Assistente LLM

O assistente reutilizará o runtime de IA do Config e `@praxisui/ai`; não haverá um
segundo motor no Studio. A primeira entrega será busca e explicação read-only com
versão, authority, facts, precedência, Test Runs, evidência e incerteza. Depois,
ele poderá propor e executar create/edit/test/submit e, futuramente, publish ou
operação como agente delegado.

Esses comandos usarão exatamente as mesmas tools, capabilities, confirmação,
ETag, blockers e auditoria da UI humana. O agente não escreve JSON Logic
arbitrário no banco, não se autoaprova, não combina papéis incompatíveis e não
contorna segregação de funções. Consulte
[ADR 0002 — Policy Assistant](adr/0002-policy-assistant-boundary.md).
