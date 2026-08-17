# Visão do produto e casos de uso

## 1. Resumo executivo

Regras de negócio importantes costumam ficar distribuídas em código Java,
packages de banco, fórmulas, parâmetros, documentação, customizações e
conhecimento de especialistas. Isso torna difícil responder perguntas simples:

- qual decisão está em vigor;
- por que uma operação foi negada;
- quais dados a decisão usa;
- o que muda se uma condição for alterada;
- quem pode propor, revisar, publicar ou reverter a mudança;
- qual versão foi executada e qual evidência sustenta seu significado.

O Praxis Policy Studio existe para tornar esse ciclo compreensível e operável.
Ele é a camada de experiência da plataforma de decisões: apresenta contratos
governados, orienta a criação de novas versões e, por meio das APIs canônicas,
acompanha o lifecycle sem assumir responsabilidades do control plane ou do
runtime.

## 2. Problema que o produto resolve

Sem uma estação de trabalho comum, cada sistema tende a criar telas próprias,
editores ad hoc e processos manuais para regras. Os principais custos são:

1. **Baixa visibilidade:** não existe um catálogo único que conecte significado,
   expressão, facts, reason codes, dependências e evidências.
2. **Mudança arriscada:** editar uma regra frequentemente exige deploy ou alteração
   direta em banco, sem comparação clara e rollback governado.
3. **Autoridade ambígua:** uma regra pode existir em mais de uma tecnologia sem
   ficar claro qual delas decide de fato.
4. **Validação tardia:** problemas de sintaxe, tipos, `null`, precedência ou
   disponibilidade de facts aparecem somente durante integração.
5. **Baixa reutilização:** cada produto reconstrói catálogo, editor, timeline,
   permissões e auditoria.
6. **Migração lenta:** equipes gastam tempo reconstruindo contexto em vez de
   transformar uma decisão já descoberta e testada.

## 3. Objetivos do projeto

### 3.1 Objetivos funcionais

- oferecer um catálogo pesquisável por domínio, RuleSet, decisão e reason code;
- explicar cada decisão em linguagem de negócio e em representação técnica;
- mostrar facts, tipos, origem, `null`, precedência, operações e evidências;
- permitir criar uma nova versão draft sem alterar a versão anterior;
- validar estrutura, tipos e compatibilidade antes de qualquer publicação;
- comparar baseline, draft e versões publicadas;
- simular decisões com facts controlados e diagnósticos determinísticos;
- apoiar revisão, publicação, ativação e rollback por capabilities do servidor;
- mostrar qual snapshot está ativo e qual versão respondeu a uma execução;
- manter uma timeline auditável de mudanças e transições.

### 3.2 Objetivos de plataforma

- funcionar para múltiplos produtos sem hardcodes de ErgonX;
- reutilizar `@praxisui/*` e contratos públicos Praxis;
- manter uma única fonte canônica para cada responsabilidade;
- permitir que pacotes de domínio sejam adicionados por projeções verificáveis;
- operar em modo hermético para desenvolvimento e em modo remoto para integração;
- tornar estados incompletos explícitos, sem inferência otimista no cliente;
- reduzir o tempo de transformar uma decisão descoberta em um draft testável;
- produzir evidência reproduzível por equipes que não acessam o sistema legado.

### 3.3 Objetivos de experiência

- ser compreensível por analistas, desenvolvedores, revisores e operadores;
- apresentar primeiro significado e impacto, deixando detalhes técnicos sob
  demanda;
- explicar por que uma ação está indisponível;
- diferenciar claramente draft, publicado, ativo, histórico e não homologado;
- oferecer comparação visual e diagnósticos que evitem leitura manual de JSON;
- preservar acessibilidade, responsividade e internacionalização.

## 4. Não objetivos e limites

O Policy Studio não deve:

- executar regras no browser como autoridade operacional;
- persistir regras em armazenamento próprio;
- substituir o Praxis Config como owner de versões, ETag e lifecycle;
- substituir o Praxis Rules Engine como compilador e avaliador;
- buscar facts diretamente no banco do consumidor;
- realizar efeitos, transações ou autorização em nome do host;
- declarar significado de negócio como homologado apenas porque um checker passou;
- transformar projeções de apresentação em segunda fonte semântica;
- esconder falta de permissão, evidência ou conectividade usando dados fictícios;
- permitir que uma pessoa ou agente contorne autorização, confirmação, ETag,
  evidência obrigatória ou segregação de funções.

## 5. Personas

| Persona | Necessidade principal | O que o Studio oferece |
| --- | --- | --- |
| Analista de negócio | compreender e revisar comportamento | significado, exemplos, comparação e evidências |
| Engenheiro de migração | transformar regra legada em contrato governado | catálogo, facts, precedência, drafts e validação |
| Desenvolvedor do produto | integrar regra ao fluxo real | contratos, snapshot, diagnósticos e referências do host |
| Revisor técnico | detectar drift e risco | diff, validações, provenance e limites de evidência |
| Owner de produto/domínio | homologar significado e impacto | pacote de revisão e histórico, sem aprovação automática |
| Operador | publicar, ativar, observar e reverter | ações server-owned, estado ativo e timeline |
| Auditor | reconstruir o que ocorreu | versões imutáveis, eventos, digests e correlação |
| Agente delegado | explicar, propor e executar ações autorizadas | as mesmas tools, capabilities, ETag, blockers e auditoria da pessoa |
| Desenvolvedor da plataforma | ampliar capacidades reutilizáveis | core neutro, fixtures e contratos independentes do ErgonX |

## 6. Casos de uso prioritários

Cada caso de uso indica o resultado esperado do produto completo. A coluna
"Situação" distingue o que já está implementado do que permanece no roadmap.

| ID | Caso de uso | Resultado esperado | Situação |
| --- | --- | --- | --- |
| UC-01 | Descobrir decisões | localizar domínio, RuleSet, decisão, reason code e estado | parcial: discovery semântico encontra identidades autorizadas, mas o detalhe selecionável ainda depende da projeção ativa |
| UC-02 | Inspecionar significado | ver descrição, facts, `null`, operações, ordem e evidências | parcial: inspeção estrutural, sem causalidade runtime |
| UC-03 | Ver autoridade | distinguir legado, Java, draft e runtime ativo | parcial: authority projetada, snapshots e resumos runtime |
| UC-04 | Comparar versões | entender diferenças entre baseline, draft e versão publicada | parcial: baseline versus draft |
| UC-05 | Criar draft | salvar mudança concorrente sem ativar | parcial: change workspace focal com ETag |
| UC-06 | Validar regra | verificar sintaxe, tipos, facts, contrato e invariantes | parcial: editor e projeção |
| UC-07 | Simular decisão | executar casos positivos, negativos, fronteira, `null` e colisão | parcial: candidate × active, Test Run e asserções de output/reasons/effects; facts ainda em JSON |
| UC-08 | Revisar mudança | produzir pacote de revisão com diff, testes e impactos | parcial: submit/review/promotion; impacto transitivo ausente |
| UC-09 | Publicar versão | transicionar por lifecycle governado e segregação de papéis | parcial: readiness/publicação; action de publish incompleta |
| UC-10 | Ativar e reverter | trocar snapshot atomicamente e restaurar last-known-good | parcial: snapshot/rollback e staged rollout; actions incompletas |
| UC-11 | Explicar execução | correlacionar resultado, versão, facts redigidos e reason code | parcial: resumo agregado; falta explicação causal por decisão |
| UC-12 | Administrar portfólio | acompanhar cobertura, risco, dívida e progresso de RuleSets | planejado |
| UC-13 | Integrar novo produto | adicionar pacote por contratos públicos, sem fork do Studio | parcial: catálogo multi-domínio navega qualquer definição autorizada; authoring rico ainda requer grounding/facts materializados ou projeção de enriquecimento |
| UC-14 | Trabalhar sem legado | evoluir UI/core com projeções e fixtures versionadas | implementado |
| UC-15 | Explicar com IA | responder com grounding, versão, authority, evidência e incerteza | parcial: discovery e explicação da definição são read-only e atestados; falta causalidade da execução |
| UC-16 | Operar por agente | criar, editar, testar, submeter e operar por delegação governada | planejado; deve usar a mesma API e SoD da pessoa |

## 7. Cenários detalhados

### UC-02 — compreender uma decisão antes de alterá-la

**Ator:** analista, desenvolvedor ou revisor.

**Entrada:** uma decisão canônica, por exemplo
`regra-frequencia.quantidade-maxima.coerente-com-minima`.

**Fluxo esperado:**

1. o catálogo resolve a decisão dentro de um domínio e RuleSet;
2. a projeção fornece identidade, ordem, facts e referências de evidência;
3. o Config acrescenta a definição e seu estado persistido;
4. o Studio apresenta condição, semântica de `null`, operações e autoridade;
5. divergências de identidade, fact ou digest falham explicitamente.

**Critério de sucesso:** uma pessoa que não conhece o banco legado consegue
explicar o propósito, os dados usados, a posição na precedência e os limites da
evidência sem ler código PL/SQL.

### UC-05 — propor uma alteração sem deploy

**Ator:** usuário com capability `CREATE_NEW_VERSION`.

**Fluxo esperado:**

1. o servidor fornece a definição mais recente e as ações permitidas;
2. o usuário abre o editor oficial;
3. o Studio preserva guardas e semântica não editadas pelo usuário;
4. validações locais impedem documento estruturalmente inválido;
5. a comparação mostra condição original e draft;
6. salvar cria a próxima versão em estado `draft`;
7. nenhuma publicação, ativação ou mudança no host ocorre.

**Critério de sucesso:** a versão anterior permanece imutável, a nova versão é
rastreável e a ausência da capability mantém o workspace somente leitura.

### UC-07 — provar uma alteração antes de publicar

**Ator:** engenheiro de regra e revisor.

**Fluxo alvo:**

1. selecionar uma versão draft;
2. fornecer ou escolher um conjunto redigido de facts;
3. executar no runtime determinístico compatível;
4. comparar baseline e draft com os mesmos facts;
5. exibir outcome, reason code, propostas de transformação e diagnóstico;
6. executar matriz de exemplos e fronteiras do pacote semântico;
7. anexar o resultado ao pacote de revisão.

**Critério de sucesso:** a simulação é reproduzível, identifica a versão do
engine e nunca é confundida com execução real do host.

### UC-10 — ativar com rollback seguro

**Ator:** papel operacional autorizado, separado de quem propôs a mudança.

**Fluxo alvo:**

1. confirmar que a versão publicada possui materialização válida;
2. criar snapshot imutável;
3. alterar o head ativo de forma atômica;
4. o host lê, valida e mantém last-known-good;
5. telemetria confirma adoção pelos consumidores;
6. rollback restaura um snapshot anterior sem recompilar o produto.

**Critério de sucesso:** uma falha de leitura ou validação não apaga o último
snapshot válido, e toda transição aparece na timeline.

### UC-13 — adicionar um segundo consumidor

**Ator:** equipe de outro produto.

**Fluxo alvo:**

1. o produto publica definições no Config e uma projeção governada;
2. o checker valida identidade, ordem, facts, fontes e autoridade;
3. o Studio descobre o pacote sem código específico do consumidor;
4. labels e links de domínio ficam na projeção, não no core;
5. capabilities determinam as ações disponíveis.

**Critério de sucesso:** nenhum import privado, fork, credencial ou `if` pelo nome
do produto é necessário no core do Studio.

## 8. Requisitos transversais

### Integridade

- identidades canônicas não admitem aliases silenciosos;
- versões persistidas são imutáveis;
- ordem e precedência são explícitas;
- missing e `null` preservam a semântica do contrato;
- toda projeção possui referências e digests verificáveis;
- falhas não degradam silenciosamente para fixture.

### Segurança e privacidade

- autenticação e autorização pertencem ao servidor;
- browser não inventa tenant, ambiente, ator ou capability;
- facts sensíveis devem ser redigidos antes de logs e evidências;
- nenhum segredo pode entrar no repositório ou na projeção;
- simulação, publicação e ativação exigem contratos separados.

### Operação corporativa

- ações críticas devem ser atômicas, observáveis e reversíveis;
- quem propõe não deve aprovar ou publicar a própria mudança quando a política
  corporativa exigir segregação;
- retenção, expiração e redaction são políticas do control plane;
- indisponibilidade do Config não autoriza o browser a assumir estado;
- controles produtivos bloqueiam promoção, não descoberta ou criação de draft
  em ambiente de desenvolvimento.

## 9. Métricas de sucesso

O produto deve ser medido pela redução de risco e tempo, não pela quantidade de
telas ou abstrações criadas:

- tempo entre decisão catalogada e primeiro draft válido;
- percentual de decisões com facts, `null`, reason code e evidência completos;
- quantidade de drifts detectados antes da integração;
- percentual de mudanças com simulação reproduzível;
- tempo para localizar e reverter uma versão;
- número de consumidores integrados sem customização do core;
- redução de editores e processos ad hoc nos produtos consumidores;
- taxa de ações bloqueadas corretamente por capability ausente.

## 10. Definition of Done por incremento

Uma fase não deve usar como gate itens que pertencem a fases posteriores.

| Incremento | Definition of Done mínima |
| --- | --- |
| Catálogo | projeção válida, leitura, busca, estados de erro e nenhuma inferência de authority |
| Inspeção | significado, facts, `null`, ordem, operações, evidências e limites visíveis |
| Draft | capability server-owned, validação, diff, nova versão imutável e nenhuma ativação |
| Simulação | execução hermética reproduzível, versão do engine e diagnóstico estruturado |
| Revisão | pacote completo, pareceres e blockers explícitos |
| Publicação | transição autorizada, ETag, timeline e artefato materializado |
| Ativação | snapshot imutável, head atômico, last-known-good, observação e rollback |
| Produção | segurança, SLO, auditoria, retenção, redaction e operação aprovados |
