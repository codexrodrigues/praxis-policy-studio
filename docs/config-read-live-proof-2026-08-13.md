# Prova live de leitura do Config — 2026-08-13

## Escopo

Prova local e somente leitura do `praxis-policy-studio` contra o
`praxis-api-quickstart` no commit `96e85f789b7cf585841f1f4f1355640b991307b3`,
consumindo `praxis-config-starter:0.1.0-rc.103` da coordenada pública.

Nenhuma definição foi criada ou alterada, nenhuma regra foi publicada e nenhuma
autoridade de execução foi promovida.

## Resultado observado

| Verificação | Resultado |
| --- | --- |
| Quickstart health | `UP` |
| Leitura anônima de definições | `403 Forbidden` |
| Login de desenvolvimento | `204 No Content` |
| Leitura autenticada de definições | `200 OK` |
| Definições remotas existentes | `11` |
| Leitura autenticada de timeline | `200 OK`, `1` evento para a definição amostrada |
| Decisões na projeção RN-013 | `14` |
| Correspondências exatas por `decisionKey`/`ruleKey` | `0` |

O estado visual anônimo também foi verificado no navegador: a aplicação exibiu
`Config governado`, `Somente leitura` e a mensagem de permissão limitada, sem
degradar silenciosamente para a fixture.

## Interpretação

O transporte protegido e o tratamento de acesso negado estão funcionais. O
bloqueio atual é de conteúdo: o Config de desenvolvimento ainda não contém as
14 definições RN-013 com suas identidades canônicas. Por isso, o Policy Studio
não pode apresentar status nem timeline dessas decisões sem criar uma fonte
paralela ou inventar correspondências.

## Baseline posterior confirmada

O gate seguinte foi concluído pela fábrica e revalidado de forma idempotente:
`created=0`, `reused=14`, `matched=14` e timelines `14/14`. Permanecem
`publications=0`, `materializations=0`, `snapshots=0` e `oracleTouched=false`.

O Studio agora usa o modo remoto como configuração padrão da POC e oferece para
a decisão focal um workspace lazy de edição exclusivamente local, com schemas
de facts governados, validação, comparação antes/draft e restauração. O perfil
do navegador usado na inspeção atual não tinha sessão do Quickstart e provou o
estado `permission-limited`; a inspeção visual autenticada do novo editor ainda
é um gate pendente. Não foi criado bypass de autenticação.
