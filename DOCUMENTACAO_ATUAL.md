# DOCUMENTAÇÃO DO SISTEMA DE GESTÃO DE EVENTOS - UNINASSAU

Esta documentação apresenta a análise detalhada da estrutura atual do sistema e o plano para a implementação das evoluções solicitadas, mantendo a compatibilidade e a integridade de todas as funções existentes.

---

## 1. VISÃO GERAL

O **Sistema de Gestão de Eventos UNINASSAU** é uma plataforma institucional que facilita o gerenciamento de palestras, workshops, seminários e outras atividades promovidas no auditório da instituição. O sistema atende a dois públicos principais:
1. **Público Geral/Alunos**: Visualização da agenda de eventos, realização de inscrições online e check-in presencial rápido através de QR Code gerado no comprovante.
2. **Equipe Administrativa**: Cadastro, edição, controle e encerramento de eventos, acompanhamento em tempo real de inscritos, exportação de relatórios em Excel, validação presencial de presença (check-in via webcam/câmera de smartphone ou manual) e visualização de indicadores.

A aplicação é construída com **React**, **TypeScript**, **Vite** e **TailwindCSS**, integrada ao **Supabase** no backend (banco de dados PostgreSQL e Storage) e utiliza o **Clerk** para autenticação e sessões de usuários administrativos.

---

## 2. ESTRUTURA DO PROJETO

Mapeamento da organização do código-fonte na pasta `src/`:

```
src/
├── assets/                 # Recursos visuais estáticos (imagens, logotipos, CSS global)
│   ├── css/
│   │   └── global.css      # Folha de estilo global e temas da aplicação
│   └── img/
│       └── logo.png        # Logotipo institucional da UNINASSAU
├── components/             # Componentes reutilizáveis compartilhados
│   ├── Footer.tsx          # Rodapé padrão do portal
│   ├── Header.tsx          # Cabeçalho adaptável com controle de autenticação (Clerk)
│   ├── LanguageSelector.tsx# Seletor de idioma (Português, Inglês, Espanhol)
│   └── ui/                 # Componentes genéricos de UI (se houver)
├── hooks/                  # Hooks customizados para gerenciamento de estado e contexto
│   ├── useEvents.ts        # Hook principal de estado global e operações de banco de dados
│   └── useLanguage.ts      # Contexto e hook para suporte multi-idioma (i18n)
├── lib/                    # Inicialização de bibliotecas externas
│   └── supabase.ts         # Configuração e instância do cliente Supabase
├── pages/                  # Páginas principais organizadas por contexto
│   ├── Admin/              # Páginas da Área Administrativa (Restrita)
│   │   ├── Archive.tsx     # Histórico de eventos encerrados (permite reabertura)
│   │   ├── Dashboard.tsx   # Painel principal de controle e estatísticas
│   │   ├── Documentation.tsx # Manual técnico e operacional em HTML com exportação em PDF
│   │   ├── EventDetails.tsx# Detalhes do evento, lista de participantes e check-in manual
│   │   ├── EventForm.tsx   # Formulário unificado de criação e edição de eventos
│   │   └── Login.tsx       # Tela de login administrativo integrado com Clerk
│   └── Public/             # Páginas Públicas (Acesso Geral)
│       ├── Checkin.tsx     # Tela de validação de QR Code via câmera do dispositivo
│       ├── EventList.tsx   # Vitrine pública de eventos ativos
│       ├── EventRegistration.tsx # Página de detalhes do evento e formulário de inscrição
│       └── TutorialPage.tsx# Tutorial visual de como se inscrever e realizar check-in
├── services/               # Camada de serviços e integração de dados
│   ├── auth.ts             # Funções utilitárias relacionadas à autenticação
│   ├── factory.ts          # Instanciação centralizada de serviços (Padrão Factory/Singleton)
│   ├── implementations/
│   │   ├── LocalStorageService.ts  # Mock offline do serviço de eventos
│   │   └── SupabaseEventService.ts # Integração ativa com tabelas do Supabase
│   └── interfaces/
│       └── EventService.ts         # Contratos e tipos dos métodos de serviços de eventos
├── types/                  # Definições de tipos TypeScript da aplicação
│   └── index.ts            # Interfaces para Evento, Inscrito e enum de Escolaridade
└── utils/                  # Funções utilitárias helpers
    └── date.ts             # Funções de formatação e parsing de datas locais
```

---

## 3. BANCO DE DADOS

O banco de dados PostgreSQL hospedado no Supabase possui duas tabelas principais (`events` e `registrations`). O relacionamento entre elas é de **1:N (Um evento para muitos inscritos)**.

### Tabela: `events`
* **Objetivo**: Armazena as informações básicas e configurações de cada evento.
* **Campos**:
  * `id` (`uuid`, PK, padrão: `gen_random_uuid()`): Identificador único do evento.
  * `nome_evento` (`text`, obrigatório): Nome/título do evento.
  * `descricao` (`text`, opcional): Detalhes sobre o evento, conteúdo programático ou palestrantes.
  * `data_evento` (`text` ou `date`, obrigatório): Data de realização do evento (formato local ou ISO).
  * `horario_evento` (`text`, opcional): Horário do evento (ex: `"19:00"`).
  * `local` (`text`, obrigatório): Espaço físico onde ocorrerá o evento (ex: `"Auditório Principal"`).
  * `imagem_url` (`text`, opcional): Link público da imagem promocional armazenada no Storage.
  * `status` (`text`, padrão: `'ativo'`): Situação do evento (`'ativo'` ou `'encerrado'`).
  * `tipo` (`text`, padrão: `'interno'`): Categoria (`'interno'`, `'externo'`, `'mobilidade'` ou `'link_externo'`).
  * `link_externo` (`text`, opcional): Link externo de redirecionamento para eventos do tipo `'link_externo'`.
  * `created_at` (`timestamp with time zone`): Data e hora de criação do registro.

### Tabela: `registrations`
* **Objetivo**: Registra os dados dos participantes inscritos em cada evento acadêmico.
* **Relacionamento**: Chave estrangeira `event_id` aponta para `events.id` (on delete cascade).
* **Campos**:
  * `id` (`uuid`, PK, padrão: `gen_random_uuid()`): Identificador único da inscrição.
  * `event_id` (`uuid`, FK, obrigatório): Referência ao evento correspondente.
  * `nome` (`text`, obrigatório): Nome completo do inscrito.
  * `cpf` (`text`, obrigatório): Documento CPF do inscrito para fins de validação e emissão de certificados.
  * `telefone` (`text`, obrigatório): Telefone de contato do inscrito.
  * `email` (`text`, obrigatório): E-mail do inscrito para envio de comunicações.
  * `escolaridade` (`text`, obrigatório): Nível de instrução selecionado (conforme enum `Escolaridade`).
  * `interesse` (`text`, padrão: `'graduacao'`): Tipo de interesse acadêmico (`'graduacao'`, `'pos'`, `'segunda_graduacao'`).
  * `curso` (`text`, opcional): Curso de interesse acadêmico para acompanhamento comercial.
  * `qr_token` (`text`, obrigatório): Token de alta entropia (gerado via UUID) usado para codificar o QR Code de check-in.
  * `checked_in` (`boolean`, padrão: `false`): Indica se o participante compareceu e teve seu QR Code validado.
  * `checkin_date` (`timestamp with time zone`, opcional): Data e hora exatas da realização do check-in.
  * `data_inscricao` (`timestamp with time zone`, padrão: `now()`): Data de realização da inscrição.
  * `cidade` (`text`, opcional): Cidade de origem.
  * `estado` (`text`, opcional): Estado de origem.
  * `pais` (`text`, opcional): País de origem.

---

## 4. FLUXO ATUAL DO SISTEMA

### A. Página Pública (Vitrine de Eventos)
1. O usuário acessa a raiz (`/`). O sistema busca a lista de todos os eventos no Supabase.
2. O sistema filtra e exibe apenas os eventos com status `'ativo'` (não encerrados) e do tipo diferente de `'link_externo'` (estes são manipulados de forma externa).
3. O usuário pode filtrar a lista de eventos digitando termos de busca ou selecionando opções de período (Hoje, Próximos 7 dias, Próximos 30 dias) e local físico.

### B. Cadastro de Inscrições
1. Ao clicar em "Inscrever-se", o usuário é levado para a rota `/evento/:id`.
2. A tela exibe os detalhes do evento e um formulário em etapas (ou direto) de inscrição.
3. O usuário insere Nome, Telefone, E-mail, CPF, Escolaridade e campos opcionais de interesse de graduação/curso.
4. Após o envio bem-sucedido, o sistema gera no Supabase a inscrição, cria um `qr_token` exclusivo e renderiza um comprovante de inscrição imprimível contendo os dados do evento e um QR Code correspondente.
5. Se for um evento com link externo, a inscrição redireciona diretamente o usuário para o endereço configurado.

### C. Área Administrativa (Autenticação e Painel)
1. Qualquer rota sob `/admin/*` exige autenticação. Caso o usuário não esteja logado, ele é redirecionado para `/admin/login`.
2. A autenticação atual utiliza componentes e hooks do `@clerk/clerk-react` com um projeto configurado pela variável `VITE_CLERK_PUBLISHABLE_KEY`.
3. Ao se autenticar com sucesso, o usuário é direcionado para a página do Painel Administrativo (`/admin`).
4. **Dashboard**: Apresenta indicadores consolidados (total de eventos, participantes, média de inscritos por evento, status de eventos ativos) e um gráfico simples de perfil de interesse com filtro opcional por período.
5. **Agenda de Eventos**: Uma tabela detalhada de todos os eventos ativos onde é possível clicar em "Detalhes" de um evento específico.

### D. Gestão de Eventos
1. **Criar Evento (`/admin/novo`)**: Formulário para preenchimento de nome, descrição, local, data, horário, tipo, link externo e upload da imagem promocional.
2. **Editar Evento (`/admin/evento/:id/editar`)**: Permite alterar dados de um evento pré-existente.
3. **Encerrar e Excluir**: Na tela de detalhes do evento, o administrador pode encerrar as inscrições (mudando o status para `'encerrado'`) ou excluir permanentemente o evento.
4. **Arquivo (`/admin/arquivo`)**: Lista de eventos que foram encerrados. O administrador pode reabrir um evento arquivado a qualquer momento.

### E. Detalhes do Evento e Emissão de Certificados
1. Na tela `/admin/evento/:id`, o administrador visualiza a lista completa de inscritos.
2. É possível realizar busca de participantes por nome ou CPF.
3. É possível exportar os participantes do evento atual em formato Excel (`.xlsx`).
4. O administrador pode emitir certificados individuais de presença para alunos que realizaram o check-in ou baixar um PDF gerado contendo a assinatura.
5. Existe a opção de importar inscritos em lote (Bulk Register) utilizando um arquivo de texto com formato estruturado (Nome;Telefone).

### F. Validação e Check-in (`/checkin`)
1. A tela `/checkin` é pública, porém projetada para a portaria física do auditório. Ela acessa a câmera traseira do dispositivo usando a biblioteca `html5-qrcode` para ler o QR Code do comprovante do aluno.
2. O sistema decodifica o token do QR Code e realiza a chamada de validação no banco de dados.
3. Se o token for válido e o participante ainda não realizou check-in: o status do participante é alterado para `checked_in = true`, registrando a data e hora em `checkin_date`. É exibida uma tela verde com o nome do aluno em letras garrafais e toca-se um sinal sonoro de sucesso.
4. Se o participante já realizou check-in anteriormente, o sistema exibe uma tela amarela de aviso ("Já Utilizado") e reproduz um som de alerta.
5. Caso o token não seja reconhecido, uma tela vermelha de erro é apresentada.
6. **Check-in Manual**: Na página de detalhes do evento no painel administrativo, o administrador pode clicar em um botão de check-in ao lado do nome do participante na tabela para confirmar a presença manualmente sem o QR Code.

---

## 5. PONTOS FORTES

* **Interface Visual e Experiência do Usuário (UX/UI)**: Uso consistente de bordas arredondadas pronunciadas (`rounded-3xl` e `rounded-[2.5rem]`), sombras suaves, animações delicadas de entrada e excelente contraste visual.
* **Arquitetura Desacoplada (Service Pattern)**: O uso de interfaces de serviços (`EventService.ts`) e injeção por Factory (`factory.ts`) facilita a substituição ou mock de implementações sem impactar as páginas.
* **Check-in Dinâmico com QR Code**: O leitor de QR Code integrado roda inteiramente no navegador e conta com feedbacks sonoros e visuais otimizados para controle rápido de fluxo na portaria.
* **Independência de Idioma**: Estrutura robusta de traduções (`useLanguage`) com suporte a múltiplos idiomas.

---

## 6. PONTOS DE MELHORIA

* **Falta de Controle de Perfis Administrativos**: Atualmente, qualquer usuário autenticado pelo Clerk é considerado Administrador e possui acesso ilimitado a todos os eventos e dados. Falta a distinção entre `ADMIN` e `COMERCIAL`.
* **Falta de Registro de Responsável/Criador**: Os eventos na tabela `events` não possuem uma coluna indicando qual usuário administrativo criou o evento, dificultando o isolamento de eventos exigido pelo perfil `COMERCIAL`.
* **Lógica Simples de Sorteio**: O sistema atual não possui um módulo completo de sorteios com animação, histórico de ganhadores e inteligência de filtragem para novos participantes.
* **Limitação de Datas de Evento**: A estrutura atual suporta apenas uma única string simples de data e horário, dificultando o cadastro e a exibição clara de eventos de múltiplos dias (Data Inicial e Data Final).

---

## 7. PLANO DE IMPLEMENTAÇÃO DA EVOLUÇÃO (V2)

Abaixo está o cronograma lógico e seguro para evoluir o sistema sem interromper as funcionalidades atuais em produção.

### ETAPA 1: Novo Banco de Dados e Segurança de Dados (Migrations Supabase)
1. **Migração do Banco de Dados**: Criar um script SQL para atualizar o banco sem perda de dados:
   * **Nova Tabela de Usuários Administrativos** `admin_users`:
     * `id` (`text`, PK) - Mapeado diretamente ao ID do usuário no Clerk.
     * `nome` (`text`, obrigatório)
     * `email` (`text`, obrigatório, único)
     * `perfil` (`text`, obrigatório) - Valores permitidos: `'ADMIN'` ou `'COMERCIAL'`.
     * `status` (`text`, obrigatório, padrão: `'ativo'`) - Valores: `'ativo'` ou `'inativo'`.
     * `created_at` (`timestamp with time zone`, padrão: `now()`).
   * **Alteração na Tabela `events`**:
     * Adicionar coluna `proprietario_id` (`text`, FK referenciando `admin_users.id` ou apenas `text` para flexibilidade com Clerk).
     * Adicionar colunas: `data_final` (`text` ou `date`), `horario_final` (`text`).
   * **Nova Tabela de Sorteios** `draw_history`:
     * `id` (`uuid`, PK, padrão: `gen_random_uuid()`)
     * `event_id` (`uuid`, FK referenciando `events.id`, onDelete cascade)
     * `registration_id` (`uuid`, FK referenciando `registrations.id`, onDelete cascade)
     * `responsavel_id` (`text` ou FK referenciando `admin_users.id`) - Quem realizou o sorteio.
     * `total_inscritos` (`integer`) - Qtd. de inscritos no momento do sorteio.
     * `novos_inscritos` (`integer`) - Qtd. de novos inscritos identificados.
     * `data_sorteio` (`timestamp with time zone`, padrão: `now()`).

### ETAPA 2: Configuração e Substituição do Provedor de Autenticação (Clerk V2)
1. **Obtenção das Credenciais**: Interromper o processo para solicitar ao desenvolvedor as credenciais do novo projeto Clerk:
   * `VITE_CLERK_PUBLISHABLE_KEY` (Chave pública do novo projeto)
   * Clerk Secret Key (para integrações no backend ou criação de usuários, se necessário)
   * Redirecionamentos URL configurados no painel do Clerk (Sign In, Sign Up, After Sign In/Up).
2. **Substituição da Inicialização**: Atualizar o `ClerkProvider` em `src/main.tsx` e as rotas protegidas em `src/App.tsx`.
3. **Restrição de Login**: Desativar no painel do Clerk recursos de 2FA, OTP por dispositivo ou MFA, permitindo login exclusivo por **E-mail** e **Senha**. E-mail deve ser usado apenas para recuperação ("Esqueci minha senha").

### ETAPA 3: Módulo de Controle de Acesso (Gerenciamento de Usuários)
1. **Módulo Administrativo**: Desenvolver uma nova página `/admin/usuarios` visível apenas para perfis `ADMIN`.
2. **Interface**: Tabela responsiva exibindo Nome, E-mail, Perfil (Admin/Comercial), Status (Ativo/Inativo), Data de Criação e Ações.
3. **Funcionalidades**:
   * Cadastrar novo usuário (integrado com Clerk via API ou gerido localmente com espelhamento).
   * Editar nome, perfil e status do usuário.
   * Ativar/Desativar usuário (usuários inativos são bloqueados no login e não acessam nenhuma página do painel administrativo).
   * Redefinir senha de usuários.
   * Barra de busca e filtros de perfil/status.

### ETAPA 4: Implementação de Permissões e Propriedade de Eventos
1. **Associação de Evento**: Ao criar um evento no formulário `EventForm.tsx`, associar o ID do usuário Clerk logado como proprietário do evento (`proprietario_id`).
2. **Isolamento de Visibilidade comercial**:
   * O perfil `ADMIN` visualiza todos os eventos, inscritos e métricas do sistema.
   * O perfil `COMERCIAL` visualiza a lista geral de eventos na área administrativa, mas ao acessar os detalhes (`/admin/evento/:id`) ou realizar sorteios, a visualização de inscritos/sorteios é restrita **apenas** aos eventos onde ele é o `proprietario_id`.
   * Caso tente forçar acesso via URL a um evento de outro proprietário, a aplicação interceptará e exibirá uma tela/mensagem amigável de "Permissão Insuficiente".
3. **Backend/API Security**: Atualizar a classe `SupabaseEventService` para validar se o usuário solicitante possui perfil administrativo compatível com a operação.

### ETAPA 5: Novo Módulo de Sorteios ("Sorteador Inteligente")
1. **Nova Página Administrativa (`/admin/sorteios`)**: Link acessível no menu lateral/superior para usuários autenticados.
2. **Fluxo do Sorteador**:
   1. O usuário escolhe o Evento (se for `COMERCIAL`, apenas os eventos criados por ele aparecem na lista).
   2. O sistema exibe o total de inscritos atuais e o total de novos inscritos (alunos que se inscreveram após o último sorteio realizado para aquele evento).
   3. **Opção de Escopo**: Usuário escolhe via radio buttons: `( ) Sortear entre todos` ou `( ) Sortear apenas novos inscritos`.
   4. Ao clicar no botão grande **"SORTEAR"**: roda-se uma animação interativa com efeito de roleta ou contagem regressiva.
   5. Apresentação em destaque do vencedor: Nome, E-mail, Telefone e Número de Inscrição.
   6. Botão de "Sortear Novamente".
3. **Histórico de Sorteios**: Uma aba ou painel inferior mostrando a lista de sorteios anteriores com dados de Evento, Vencedor, Responsável, Data/Hora e contagens.

### ETAPA 6: Atualização do Cadastro de Eventos (Multi-datas)
1. **Campos do Formulário**: Adicionar no `EventForm.tsx` campos de Data Final e Horário Final.
2. **Validação**: Garantir que a Data Final seja maior ou igual à Data Inicial.
3. **Renderização Visual**: Modificar a exibição na vitrine de eventos pública e no painel admin para mostrar:
   * "20/06/2026 a 30/06/2026" (se for multi-dia) ou "20/06/2026" (se for único dia).
   * "Das 10:00 às 14:00".

### ETAPA 7: Atualização do Dashboard Administrativo
1. **Novos Indicadores**:
   * Quantidade total de eventos.
   * Eventos ativos / Eventos encerrados / Eventos futuros.
   * Total de inscritos e Inscritos no mês corrente.
   * Usuários cadastrados (Administradores/Comerciais).
   * Quantidade de sorteios realizados no sistema.
   * Lista visual dos últimos eventos e últimos usuários administrativos cadastrados.

### ETAPA 8: Validação, Testes e Documentação Final
1. Executar testes de caminhos felizes e de borda (dispositivos móveis e desktop).
2. Escrever a documentação final `ATUALIZACAO_V2.md` e o histórico de alterações no `CHANGELOG.md`.

---

Documento elaborado e pronto para prosseguimento do desenvolvimento sob as instruções e aprovação do desenvolvedor.
