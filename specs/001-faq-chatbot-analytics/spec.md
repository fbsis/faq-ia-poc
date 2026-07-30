# Feature Specification: Chatbot de FAQ e Dashboard Analítico

**Feature Branch**: `não criada (nenhum hook de branch configurado)`

**Created**: 2026-07-30

**Status**: Draft

**Input**: Plataforma web para automatizar respostas a dúvidas recorrentes e oferecer indicadores administrativos sobre as interações.

## Clarifications

### Session 2026-07-30

- Q: Quando um administrador apagar uma pergunta e resposta, o que deve acontecer com esse conteúdo? → A: Desativar e permitir restauração, sem excluir os dados.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar uma dúvida frequente (Priority: P1)

Como usuário, quero conversar em linguagem natural com um assistente que compreende o contexto das
mensagens anteriores e responde com base no conhecimento aprovado, para resolver minha dúvida sem
repetir informações nem depender de atendimento humano.

**Why this priority**: É a proposta de valor central e constitui um MVP utilizável de forma independente.

**Independent Test**: Pode ser testada cadastrando respostas conhecidas, iniciando uma conversa e
enviando perguntas exatas, paráfrases e perguntas de continuação que dependem das mensagens
anteriores, verificando que a resposta permanece natural, correta, fundamentada e registrada.

**Acceptance Scenarios**:

1. **Given** que existe uma resposta cadastrada para a dúvida, **When** o usuário envia uma pergunta equivalente, **Then** o chatbot apresenta a resposta correspondente.
2. **Given** que a pergunta possui redação diferente, mas significado semelhante ao conteúdo cadastrado, **When** o usuário a envia, **Then** o chatbot apresenta a melhor resposta confiável.
3. **Given** que uma consulta foi concluída, **When** o resultado é apresentado, **Then** a pergunta, o resultado, a categoria e a data e hora ficam registrados no histórico.
4. **Given** que o usuário já explicou o assunto em mensagens anteriores, **When** envia uma
   continuação como “e se eu não tiver acesso?”, **Then** o chatbot interpreta a referência usando o
   contexto recente e responde sem exigir que a pergunta completa seja repetida.
5. **Given** que uma FAQ aprovada foi encontrada, **When** o chatbot responde, **Then** apresenta uma
   mensagem natural e direta que não adiciona fatos ausentes da fonte aprovada.
6. **Given** que a resposta aprovada contém formatação Markdown, **When** ela é apresentada, **Then**
   listas, ênfases, links e blocos de código são renderizados de forma legível e segura.

---

### User Story 2 - Tratar pergunta sem resposta (Priority: P2)

Como usuário, quero receber uma orientação clara quando nenhuma resposta confiável for encontrada, para saber que minha dúvida não foi ignorada e como prosseguir.

**Why this priority**: Evita respostas incorretas, preserva a confiança e revela lacunas que precisam ser tratadas.

**Independent Test**: Pode ser testada enviando uma pergunta sem correspondência e verificando a mensagem de fallback e seu registro como não respondida.

**Acceptance Scenarios**:

1. **Given** que não existe uma correspondência suficientemente relevante, **When** o usuário envia a pergunta, **Then** o chatbot informa que não encontrou resposta e sugere reformulação ou o canal de atendimento indicado.
2. **Given** que a pergunta não encontra uma resposta confiável, **When** o chatbot responde,
   **Then** solicita um esclarecimento relacionado à dúvida e oferece um próximo passo útil sem
   inventar uma resposta.
3. **Given** que uma pergunta não foi respondida, **When** a interação é concluída, **Then** ela fica registrada e disponível para análise administrativa.
4. **Given** que ocorre uma falha recuperável, **When** a busca não pode ser concluída, **Then** o usuário recebe mensagem compreensível, mantém o texto digitado e pode tentar novamente.

---

### User Story 3 - Analisar utilização e tendências (Priority: P3)

Como administrador, quero visualizar indicadores das consultas em um período selecionado para identificar tendências, dúvidas recorrentes e lacunas na base de conhecimento.

**Why this priority**: Transforma o histórico das interações em informações acionáveis para atendimento e conteúdo.

**Independent Test**: Pode ser testada com interações conhecidas em diferentes datas, categorias e estados, comparando cada indicador com os resultados esperados.

**Acceptance Scenarios**:

1. **Given** que existem interações no período, **When** o administrador abre o dashboard, **Then** visualiza o total de consultas.
2. **Given** que existem perguntas recorrentes, **When** o administrador consulta o ranking, **Then** visualiza as perguntas mais frequentes e suas quantidades.
3. **Given** que existem perguntas sem resposta, **When** o administrador acessa o indicador correspondente, **Then** visualiza perguntas, frequência e ocorrência mais recente.
4. **Given** que as consultas possuem categorias e datas, **When** o administrador seleciona um período, **Then** visualiza distribuição por categoria e evolução temporal usando o mesmo filtro.
5. **Given** que não existem dados no período, **When** o dashboard é exibido, **Then** apresenta um estado vazio claro, sem totais ou gráficos enganosos.

---

### User Story 4 - Manter a base de conhecimento (Priority: P4)

Como administrador, quero cadastrar, editar, categorizar, ativar e desativar perguntas e respostas para manter o conteúdo correto e atualizado.

**Why this priority**: Sustenta a operação após a carga inicial de conteúdo e permite corrigir respostas sem intervenção técnica.

**Independent Test**: Pode ser testada criando uma entrada, consultando-a no chatbot, alterando sua resposta e desativando-a.

**Acceptance Scenarios**:

1. **Given** que pergunta, resposta e categoria são válidas, **When** o administrador salva a entrada, **Then** ela passa a estar disponível para novas consultas.
2. **Given** que uma entrada é editada, **When** a alteração é publicada, **Then** novas consultas usam o conteúdo atualizado sem alterar o histórico anterior.
3. **Given** que uma entrada é desativada, **When** uma consulta relacionada ocorre, **Then** ela não é usada como resposta.
4. **Given** que os dados são inválidos ou incompletos, **When** o administrador tenta publicar, **Then** os problemas são indicados e nenhum conteúdo incompleto fica disponível.
5. **Given** que uma entrada foi desativada, **When** o administrador a restaura, **Then** ela volta
   ao fluxo de publicação sem perder conteúdo, vínculos ou histórico.
6. **Given** que o administrador solicita apagar uma entrada, **When** confirma a ação, **Then** o
   sistema realiza uma desativação reversível e não exclui fisicamente a pergunta ou resposta.

---

### User Story 5 - Resolver perguntas sem resposta (Priority: P4)

Como administrador, quero organizar as perguntas não respondidas, responder uma pendência e incorporá-la à base de conhecimento para melhorar respostas futuras.

**Why this priority**: Fecha o ciclo de melhoria contínua entre análise do uso e manutenção do conteúdo.

**Independent Test**: Pode ser testada gerando perguntas não respondidas repetidas, respondendo a pendência administrativa e consultando-a novamente no chatbot.

**Acceptance Scenarios**:

1. **Given** que existem perguntas não respondidas, **When** o administrador abre a fila, **Then** visualiza pendências agrupadas com frequência, primeira e última ocorrência e estado de tratamento.
2. **Given** que uma pendência está aberta, **When** o administrador fornece pergunta canônica, resposta e categoria válidas, **Then** a resposta é persistida na base e a pendência só é marcada como resolvida quando estiver disponível para novas consultas.
3. **Given** que uma tentativa de resolução falha, **When** a resposta não pode ser publicada integralmente, **Then** a pendência permanece disponível para nova tentativa.
4. **Given** que uma pendência não deve virar FAQ, **When** o administrador a descarta com justificativa, **Then** ela sai da fila aberta sem apagar as ocorrências.
5. **Given** que uma decisão precisa ser revista, **When** o administrador reabre a pendência, **Then** ela retorna à fila e preserva o histórico das decisões.

### Edge Cases

- Perguntas vazias, compostas apenas por espaços ou acima do limite aceito são rejeitadas com orientação clara.
- Maiúsculas, acentuação, pontuação e pequenos erros de digitação não impedem a identificação de perguntas equivalentes.
- Quando duas respostas possuem relevância muito próxima, o chatbot não combina conteúdos incompatíveis nem afirma uma resposta incerta.
- Instruções presentes em mensagens anteriores ou no texto de uma FAQ não podem substituir as
  regras do assistente nem autorizar conteúdo fora da base aprovada.
- Conversas longas utilizam somente uma janela recente e limitada; referências cujo contexto saiu
  dessa janela recebem pedido de esclarecimento em vez de uma suposição.
- Entradas inativas ou incompletas nunca são apresentadas como solução.
- Consultas sem categoria são agrupadas como “Sem categoria” e permanecem nos totais.
- Alterações na base não modificam retroativamente o conteúdo registrado em interações anteriores.
- A ação administrativa de apagar uma entrada é sempre reversível e preserva seus vínculos e
  referências históricas.
- Perguntas repetidas equivalentes incrementam uma pendência compartilhada sem apagar as ocorrências individuais.
- Ações administrativas concorrentes não criam respostas duplicadas para a mesma pendência.
- Falhas de indicadores ou consultas oferecem nova tentativa e não exibem dados parciais como completos.
- Datas são agrupadas no fuso horário definido para a organização.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir o envio de perguntas textuais em uma interface de conversa.
- **FR-002**: O sistema MUST validar perguntas e explicar como corrigir conteúdo vazio ou fora dos limites aceitos.
- **FR-003**: O sistema MUST buscar respostas considerando perguntas semanticamente semelhantes, e não somente textos idênticos.
- **FR-004**: O sistema MUST apresentar somente respostas aprovadas de entradas ativas quando houver correspondência confiável.
- **FR-005**: O sistema MUST evitar afirmar uma resposta quando não houver correspondência suficientemente relevante.
- **FR-006**: O sistema MUST apresentar fallback compreensível e opções de próximo passo quando não encontrar resposta.
- **FR-007**: O sistema MUST registrar pergunta, resultado, resposta apresentada quando houver, categoria, data e hora e estado de cada interação.
- **FR-008**: O sistema MUST distinguir interações respondidas, não respondidas, ambíguas e interrompidas por erro.
- **FR-009**: O sistema MUST preservar uma representação imutável do resultado originalmente apresentado.
- **FR-010**: O sistema MUST restringir dashboard, base de conhecimento, pendências e histórico detalhado a administradores autorizados.
- **FR-011**: Administradores MUST poder cadastrar, consultar, editar, ativar, desativar e restaurar
  entradas da base.
- **FR-012**: Toda entrada publicada MUST conter pergunta, resposta e categoria válidas.
- **FR-013**: O dashboard MUST exibir o total de consultas para um intervalo selecionado.
- **FR-014**: O dashboard MUST exibir as perguntas ou intenções mais frequentes e suas quantidades.
- **FR-015**: O dashboard MUST exibir perguntas sem resposta, frequência e ocorrência mais recente.
- **FR-016**: O dashboard MUST exibir distribuição por categoria, incluindo consultas não categorizadas.
- **FR-017**: O dashboard MUST exibir a evolução do volume de consultas ao longo do tempo.
- **FR-018**: O filtro de período MUST ser aplicado consistentemente a todos os indicadores e gráficos.
- **FR-019**: O dashboard MUST diferenciar estados de carregamento, vazio e erro.
- **FR-020**: Totais, agrupamentos, gráficos e detalhes do mesmo período MUST ser consistentes entre si.
- **FR-021**: O sistema MUST persistir perguntas não respondidas e vinculá-las a pendências administrativas agrupadas de forma determinística.
- **FR-022**: Administradores MUST poder filtrar pendências por estado, frequência, categoria quando disponível e período.
- **FR-023**: Administradores MUST poder consultar ocorrências e histórico de decisões de cada pendência.
- **FR-024**: Administradores MUST poder resolver uma pendência fornecendo pergunta, resposta, categoria e formulações equivalentes opcionais.
- **FR-025**: A resolução MUST criar ou atualizar uma entrada disponível para novas consultas e vinculá-la à pendência.
- **FR-026**: Uma pendência MUST ser marcada como resolvida somente após sua resposta estar pronta para uso.
- **FR-027**: Administradores MUST poder descartar com justificativa e reabrir pendências.
- **FR-028**: O sistema MUST manter histórico auditável de resoluções, descartes, reaberturas e administradores responsáveis.
- **FR-029**: O sistema MUST impedir que repetição ou concorrência em ações administrativas produza entradas duplicadas.
- **FR-030**: Resolver uma pendência MUST preservar o estado e o conteúdo das interações históricas originais.
- **FR-031**: O sistema MUST apresentar erros acionáveis e permitir repetição segura de operações recuperáveis.
- **FR-032**: O sistema MUST proteger conteúdo administrativo e interações contra acesso não autorizado.
- **FR-033**: O sistema MUST manter uma janela limitada das mensagens recentes para compreender
  perguntas de continuação e referências ao contexto da conversa atual.
- **FR-034**: O sistema MUST transformar perguntas dependentes de contexto em consultas
  independentes antes de buscar conhecimento, sem alterar a intenção do usuário.
- **FR-035**: Quando houver uma correspondência confiável, o sistema MUST produzir uma resposta
  conversacional fundamentada exclusivamente no conteúdo da entrada aprovada e MUST preservar a
  ligação com essa fonte.
- **FR-036**: Se a interpretação conversacional ou a geração da resposta falhar, o sistema MUST
  retornar de forma segura o conteúdo aprovado encontrado ou o fallback, sem inventar informação.
- **FR-037**: O sistema MUST executar recuperação híbrida, combinando correspondência exata e por
  aliases, busca semântica e busca lexical tolerante a flexões e pequenos erros de digitação.
- **FR-038**: Quando nenhuma fonte for confiável, o sistema MUST produzir um pedido de
  esclarecimento contextual, declarar explicitamente que não sabe a resposta e não afirmar fatos
  ausentes da base de conhecimento.
- **FR-039**: Mensagens do assistente MUST renderizar Markdown comum de forma segura, sem executar
  HTML bruto ou scripts fornecidos pelo conteúdo.
- **FR-040**: Após duas respostas anteriores sem conteúdo confiável na conversa atual, uma nova
  tentativa sem resposta MUST deixar de solicitar esclarecimentos e MUST informar deterministicamente
  que a informação não está na base e que uma pessoa da equipe entrará em contato para explicá-la.
- **FR-041**: O sistema MUST tratar artigos definidos neutros antes de possessivos como variação
  equivalente na normalização da busca, de modo que perguntas como “como redefino a minha senha”
  encontrem exatamente a FAQ “como redefino minha senha” e retornem sua resposta aprovada.
- **FR-042**: A ação de apagar uma pergunta e resposta MUST ser implementada como desativação
  reversível, MUST permitir restauração por administrador e MUST preservar os dados, vínculos e
  referências históricas da entrada.

### Key Entities

- **Entrada de conhecimento**: Pergunta conhecida, formulações equivalentes, resposta, categoria e estado de disponibilidade.
- **Categoria**: Classificação usada para organizar conteúdo e analisar consultas.
- **Interação**: Consulta individual com pergunta, resultado, resposta apresentada, categoria, estado e data e hora.
- **Conversa**: Sequência anônima e limitada de mensagens do usuário e do assistente usada para
  interpretar continuações durante a sessão.
- **Pendência de resposta**: Agrupamento de ocorrências equivalentes sem resposta, com estado, frequência, datas e eventual resolução.
- **Decisão de pendência**: Registro auditável de resolução, descarte ou reabertura realizada por administrador.
- **Administrador**: Pessoa autorizada a acessar indicadores, pendências e manutenção da base.
- **Período analítico**: Intervalo aplicado uniformemente aos indicadores e gráficos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Pelo menos 95% das consultas respondidas apresentam resultado em até 2 segundos em condições normais.
- **SC-002**: Pelo menos 90% das perguntas com resposta cadastrada recebem a entrada correta como resultado principal em um conjunto representativo de validação.
- **SC-003**: 100% das perguntas sem correspondência adequada recebem fallback explícito, sem resposta inventada ou não relacionada.
- **SC-004**: 100% das consultas concluídas aparecem nos indicadores administrativos em até 1 minuto.
- **SC-005**: Totais e agrupamentos do dashboard apresentam 100% de concordância com um conjunto conhecido de interações do mesmo período.
- **SC-006**: Administradores identificam as dez principais dúvidas e as pendências de um período em até 2 minutos.
- **SC-007**: Pelo menos 90% dos participantes de um teste de usabilidade enviam uma pergunta e compreendem o resultado na primeira tentativa, sem auxílio.
- **SC-008**: O dashboard apresenta indicadores de um período de até 12 meses em até 3 segundos para 95% dos acessos normais.
- **SC-009**: A solução sustenta pelo menos 100 sessões simultâneas sem ultrapassar os tempos definidos para a experiência.
- **SC-010**: Nenhum usuário não autorizado acessa dashboard, pendências, manutenção da base ou registros detalhados durante os testes de segurança.
- **SC-011**: 100% das consultas não respondidas persistidas aparecem em uma pendência em até 1 minuto.
- **SC-012**: Um administrador localiza e responde uma pendência em até 3 minutos, sem recadastrar a pergunta em outra tela.
- **SC-013**: 100% das resoluções concluídas ficam disponíveis para perguntas futuras sem modificar interações históricas.
- **SC-014**: Tentativas repetidas ou concorrentes de resolver a mesma pendência criam no máximo uma nova entrada.
- **SC-015**: Pelo menos 90% das perguntas de continuação do conjunto conversacional de validação
  recuperam a mesma entrada correta que sua versão independente.
- **SC-016**: 100% das respostas conversacionais avaliadas permanecem semanticamente suportadas
  pela entrada aprovada vinculada, sem acrescentar instruções ou fatos externos.

## Assumptions

- A primeira versão atende uma única organização e usa seu fuso horário configurado.
- O chatbot é público e não exige identificação pessoal; administradores precisam de autenticação.
- O contexto conversacional é curto, anônimo e descartável; não é uma memória pessoal nem um perfil
  permanente do usuário.
- A organização fornece a base inicial, categorias e canal alternativo de atendimento.
- O período padrão do dashboard é de 30 dias e pode ser alterado.
- O agrupamento inicial de pendências utiliza normalização determinística; mesclagem semântica manual ou automática fica fora do escopo inicial.
- A retenção das interações seguirá a política da organização e princípios de necessidade e minimização.
- A resolução melhora consultas futuras; usuários anônimos anteriores não recebem notificações retroativas.
- Exportação de relatórios, atendimento humano dentro da plataforma, múltiplas organizações, suporte multilíngue e contas individuais de usuários ficam fora do escopo inicial.
- As restrições tecnológicas e de entrega fornecidas pelo solicitante serão detalhadas no planejamento, sem alterar os resultados funcionais desta especificação.
