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

O Quickstart mantém o primeiro corpus portátil executável em
`src/test/resources/policy-studio/ergon-portable-parity-corpus.v1.json`, com a
especificação em `docs/POLICY-STUDIO-ERGON-PORTABLE-PARITY-CORPUS.md`. A
autoridade desse corpus é explicitamente `SYNTHETIC_BASELINE`: ele permite
desenvolvimento local, mas não afirma paridade com Oracle. No Ergon, cada caso
deve ser ligado ao handoff aprovado da Parte 1 e comparado com a rota legada.

O primeiro baseline Ergon suficientemente fechado é a RN-013 Parte 1 da tela
`ERGadm00036 — Regras de frequência`, nas operações CREATE e UPDATE da rota
`/api/administracao-pessoal/regras-frequencia`. O gate da fábrica está
`Ready with adjustments`, mantém o legado como autoridade e exige persistência
real. DELETE não pertence à RN-013; a ERG-08393 e o gap de intervalo da RN-017
também não devem ser misturados neste primeiro corte.

A fábrica já possui 38 observações Oracle sanitizáveis para essa RN: 14 negativas
em CREATE e UPDATE, limites inclusivos de data, semântica de `null` e colisões de
precedência. Elas continuam sob os artefatos da Parte 1 no repositório da fábrica;
copiá-las como identidade de produto para o Quickstart tornaria o caso neutro
dependente do Ergon. O adaptador deve importá-las futuramente como evidência
legada governada e preservar a proveniência da observação.

A ativação só pode ocorrer depois de paridade registrada, gates de revisão e
snapshot governado. O preflight hoje prova apenas CREATE em desenvolvimento;
UPDATE permanece baseline-only e não autoriza promoção produtiva.

O corte inicial já executa 14 casos neutros com create/update como contextos,
limites inclusivos, imediatamente acima/abaixo, `null` explícito, fact ausente,
`NOT_APPLICABLE` e sobreposição de falhas com precedência determinística. O
agente Ergon deve acrescentar a evidência específica de trigger/package/HADES,
erro legado, side effects e ausência de mutação em shadow; qualquer evidência
ausente mantém o resultado `INCONCLUSIVE`.

As três lanes de comparação são distintas e não podem ser renomeadas uma como a
outra:

1. candidato × snapshot ativo;
2. candidato × evidência legada registrada;
3. candidato × resultado esperado do cenário neutro.

O Studio já materializa a primeira e a terceira. A segunda é uma
`lacuna-real-de-contrato`: o Config ainda precisa ser desenhado como owner da
proveniência, request/response redigidos, status HTTP, before/after, efeitos e
prova de não mutação. Até esse contrato existir, o Studio não deve fabricar uma
segunda API ou chamar o snapshot ativo de “Oracle legado”.

## Limite conhecido deste corte

A persistência operacional de observações depende da migração
`V20260813_001__rule_execution_observation_outbox.sql` no Neon operacional.
Ela deve ser aplicada somente pela identidade proprietária de migração. Até isso
acontecer, catálogo, authoring, cenários e lifecycle podem ser testados; a prova
durável de telemetria runtime permanece bloqueada.

## Assistente LLM

O assistente poderá explicar e propor decisões usando catálogo semântico,
evidências e tools governadas. Ele não escreve JSON Logic arbitrário no banco,
não aprova a própria proposta e não publica ou ativa snapshots. Toda proposta
deve gerar diff semântico, diagnósticos, cenários afetados e comando explícito
submetido ao mesmo ETag, autorização e segregação de funções da UI humana.
