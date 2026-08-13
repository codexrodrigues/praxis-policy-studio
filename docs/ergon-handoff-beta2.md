# Handoff Ergon — Policy Studio 0.1.0-beta.2

Este corte permite ao agente da migração validar a integração do Ergon sem Oracle
local. O caso neutro do Quickstart reproduz o fluxo de decisões ordenadas,
condições JSON Logic, facts opcionais, cenários, revisão e promoção que será usado
pela RN-013, mantendo o núcleo do Studio independente do produto Ergon.

## Baseline compatível

- Policy Studio `0.1.0-beta.2`, porta oficial `4302`;
- Quickstart com o caso Policy de sete decisões, porta oficial `8088`;
- `praxis-config-starter` `9.0.5-rc.107`, schema Flyway `V55`;
- banco Config Neon compartilhado como control plane canônico;
- banco operacional Neon separado para evidências runtime.

Não crie schema ou banco próprio do Studio. Definitions, drafts, scenarios, Test
Runs, reviews, snapshots, rollout e observações pertencem aos contratos canônicos
do Config. O browser só projeta essas entidades.

## Prova local sem Ergon

1. Inicie o Quickstart com os dois datasources Neon e os segredos locais exigidos.
2. Garanta que as origins permitidas incluam `http://localhost:4302` e
   `http://127.0.0.1:4302`.
3. No Studio, execute `npm ci`, `npm run check:local-runtime` e `npm start`.
4. Abra `http://localhost:4302/catalog` e autentique no host de desenvolvimento.
5. Verifique as sete decisões neutras e confirme que cada uma possui condição.
6. Execute cenários candidate × active, persista o draft com ETag, submeta para
   revisão com autor diferente do aprovador e percorra promoção/readiness.

O proxy de desenvolvimento é parte do contrato deste corte: `/auth` e `/api`
são encaminhados para `127.0.0.1:8088`, preservando cookie same-origin.

## Encaixe do Ergon

O adaptador Ergon deve publicar identidades, facts, precedência e evidências como
projeção derivada. Ele não deve persistir uma segunda definição executável nem
transformar PL/SQL, Java ou telas legadas em fonte canônica do Studio. Condição,
versão e lifecycle vêm do Config; avaliação vem do Rules Engine/host; facts,
efeitos e autoridade transacional permanecem no host Ergon.

O primeiro corpus de paridade deve cobrir `null`, limites de data e quantidade,
overlap/gap, first denial, create/update e comparação candidate × oracle legado.
A ativação só pode ocorrer depois de paridade registrada, gates de revisão e
snapshot governado.

## Limite conhecido deste corte

A persistência operacional de observações depende da migração
`V20260813_01__create_rule_execution_observation_outbox.sql` no Neon operacional.
Ela deve ser aplicada somente pela identidade proprietária de migração. Até isso
acontecer, catálogo, authoring, cenários e lifecycle podem ser testados; a prova
durável de telemetria runtime permanece bloqueada.

## Assistente LLM

O assistente poderá explicar e propor decisões usando catálogo semântico,
evidências e tools governadas. Ele não escreve JSON Logic arbitrário no banco,
não aprova a própria proposta e não publica ou ativa snapshots. Toda proposta
deve gerar diff semântico, diagnósticos, cenários afetados e comando explícito
submetido ao mesmo ETag, autorização e segregação de funções da UI humana.
