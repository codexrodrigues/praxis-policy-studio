# Handoff Corporativo — Policy Studio 0.1.0-beta.7

Este corte complementa o fluxo executivo de migração de regras corporativas.
Ele não substitui o gate em ambiente legado autorizado e não promove autoridade do legado.

## Artefatos coordenados

- Policy Studio `0.1.0-beta.7`;
- Praxis Config `0.1.0-rc.112`;
- `@praxisui/*` `9.0.5-rc.21`;
- Quickstart `v2.0.0-rc.31`, que preserva o laboratório V57 e incorpora a
  explicação governada do Config rc.112.

## O que o agente de integração já pode executar

1. Reconciliar o estado da regra piloto entre portfólio, intake, inventário e matriz,
   mantendo a separação histórica entre frentes.
2. Implementar adapters host-owned para probe, baseline-call observer,
   sanitização/digests e recorder, inicialmente com baseline fake.
3. Preparar quatro cenários CREATE/UPDATE × ALLOW/DENY como um Test Run com quatro
   results, mantendo `LEGACY_AUTHORITATIVE`.
4. Enviar ao Studio somente refs/digests e, para explicação, a referência exata da
   definição. O Config relê a regra; o browser não envia linhas brutas do legado nem facts
   runtime ao provider.

## O que ainda bloqueia aceite operacional

- baseline legado independente por cenário no contrato V57;
- idempotência do POST de Test Run;
- política server-owned que torne cleanup, no-mutation e matriz operacional gates
  de promoção/publicação quando exigidos;
- client/transport V57 canônico no artefato leve consumido pelo host corporativo;
- quatro canários reais no ambiente legado autorizado, incluindo before/after,
  DML/effects/readback e cleanup.

O laboratório Quickstart é compatível em alto grau com a lógica pura da
decisão piloto e com a topologia estrutural do pacote de referência. Ele continua sendo apenas médio
para regras de duração/extensão, médio-baixo para vizinhança transacional e baixo
para agregação/concurrency/phantom writers. Não deve ser chamado de paridade
com sistema legado.
