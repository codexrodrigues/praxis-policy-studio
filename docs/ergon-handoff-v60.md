# Handoff operacional V60 — prova Neon e ledger append-only

- Estado: Quickstart `v2.0.0-rc.34`, correção do PR #191 para o defeito #190
- Data: 2026-08-15
- Autoridade Ergon: `LEGACY_AUTHORITATIVE`
- Complementa, sem reescrever, o [handoff V59](ergon-handoff-v59.md)

## Correção de integridade

A prova operacional não remove mais linhas para restaurar fixtures. Cada cenário executa o mesmo
workflow autoritativo do host dentro de uma transação `rollback-only` do datasource operacional.
Before/after, effects e contagem de baseline são capturados dentro da transação; após o rollback, o
host compara o estado limpo. Assim, triggers, FKs e o ledger de transformação append-only permanecem
ativos e não são contornados por código de laboratório.

Esta mudança é `ja-suportado-mal-nomeado-ou-mal-materializado`: utiliza a fronteira transacional e
o contrato de auditoria já canônicos. Não cria DTO, endpoint, schema ou owner paralelo.

## Prova no Neon existente

A action V60 foi executada com os datasources Config e operacional Neon já configurados. Nenhum
banco ou schema paralelo foi criado.

- Test Run: `6f5354dc-9616-4616-bd54-babdd379258a`;
- primeira execução `200` e replay idêntico `200`, com o mesmo `runId`;
- um run com quatro results: `CREATE/UPDATE × ALLOW/DENY`;
- mutação observada somente nos cenários `ALLOW`;
- cleanup verificado e `baselineCallCount=0` nos quatro resultados;
- matriz negativa: `409` replay divergente, `412` ETag obsoleto, `428` sem `If-Match`, `422`
  cenário incompatível e `403` persona sem autoridade.

A evidência comprova o laboratório Quickstart e sua integração com o Config. Ela não é evidência
Oracle, não homologa a semântica RN-013 e não promove autoridade Java no Ergon.

## Cadeia indicada ao agente Ergon

O agente da issue #300 pode avançar com o trabalho repository-only:

1. reconciliar portfólio, intake, inventário e matriz de rastreabilidade antes de anexar a ERG-08382
   a qualquer gate RN-013a;
2. reutilizar Contracts beta.4 e o protocolo V60, criando uma action host-owned do Ergon — não
   copiando DTOs de benefício extraordinário;
3. resolver facts, comandos, target, tenant/environment e referências no host;
4. medir chamadas Oracle por observer e manter baseline `LEGACY_ORACLE` separado de active;
5. executar cada fixture em uma transação descartável compatível com a política do host; nunca
   apagar ledger imutável para simular cleanup;
6. registrar um Test Run com quatro results CREATE/UPDATE × ALLOW/DENY e preservar idempotência;
7. executar Oracle/HADES apenas na máquina autorizada, com before/after, DML, effects, readback e
   cleanup comprovados; manter `LEGACY_AUTHORITATIVE` até homologação explícita.

## Próxima fronteira do Studio

O Studio beta.8 ainda não consome a action. Antes disso, o Metadata Starter deve representar a
precondition `If-Match` de um workspace externo numa collection action. Essa é uma
`lacuna-real-de-contrato`; URL, header e autorização não devem ser hardcodedados no Angular.

Depois do contrato, o próximo vertical slice é: discovery da action → confirmação de alto risco →
execução → receipt com quatro lanes → blockers atualizados. A prova deve incluir operator e
unauthorized no browser, conflito de ETag, retry e tratamento acessível do `422`.
