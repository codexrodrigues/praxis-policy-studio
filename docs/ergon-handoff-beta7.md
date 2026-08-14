# Handoff Ergon — Policy Studio 0.1.0-beta.7

Este corte complementa a issue executiva
[`Techne-ErgonX-migracao#300`](https://github.com/codexrodrigues/Techne-ErgonX-migracao/issues/300).
Ele não substitui o gate Oracle/HADES e não promove autoridade do legado.

## Artefatos coordenados

- Policy Studio `0.1.0-beta.7`;
- Praxis Config `0.1.0-rc.112`;
- `@praxisui/*` `9.0.5-rc.21`;
- Quickstart `v2.0.0-rc.31`, que preserva o laboratório V57 e incorpora a
  explicação governada do Config rc.112.

## O que o agente Ergon já pode executar

1. Reconciliar o estado da ERG-08382 entre portfólio, intake, inventário e matriz,
   sem reclassificá-la como continuação do gate RN-013a.
2. Implementar adapters host-owned para probe, baseline-call observer,
   sanitização/digests e recorder, inicialmente com baseline fake.
3. Preparar quatro cenários CREATE/UPDATE × ALLOW/DENY como um Test Run com quatro
   results, mantendo `LEGACY_AUTHORITATIVE`.
4. Enviar ao Studio somente refs/digests e, para explicação, a referência exata da
   definição. O Config relê a regra; o browser não envia Oracle rows nem facts
   runtime ao provider.

## O que ainda bloqueia aceite operacional

- baseline legado independente por cenário no contrato V57;
- idempotência do POST de Test Run;
- política server-owned que torne cleanup, no-mutation e matriz operacional gates
  de promoção/publicação quando exigidos;
- client/transport V57 canônico no artefato leve consumido pelo Ergon;
- quatro canários reais no computador com Oracle/HADES, incluindo before/after,
  DML/effects/readback e cleanup.

O laboratório Quickstart é compatível em alto grau com a lógica pura da
ERG-08382 e com a topologia estrutural da RN-013. Ele continua sendo apenas médio
para RN-017 duração/extensão, médio-baixo para vizinhança transacional e baixo
para agregação/concurrency/phantom writers. Não deve ser chamado de paridade
Oracle.
