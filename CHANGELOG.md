# CHANGELOG

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [2.0.0] — 2026-06-29

### ✨ Adicionado

- **Sorteador Inteligente** (`/admin/sorteios`): nova tela com animação de roleta, exibição do vencedor (nome, e-mail, telefone, CPF), histórico de sorteios e opção de sortear entre todos ou apenas novos inscritos
- **Controle de Acesso de Usuários** (`/admin/usuarios`): nova tela exclusiva para ADMIN para criar, editar, ativar/inativar e excluir colaboradores do sistema
- **Botões de navegação no Dashboard**: acesso rápido a Sorteios (todos), Controle de Usuários (apenas ADMIN)
- **Indicadores V2 no Painel**: Eventos Ativos, Eventos Futuros, Arquivados, Inscritos no Mês, Total de Participantes, Média por Evento
- **Exibição do usuário logado**: nome e perfil exibidos no cabeçalho do painel
- **Suporte a eventos de múltiplos dias**: campos `Data Final` e `Hora Final` opcionais no formulário de cadastro
- **Tabela `admin_users`** no Supabase: gerencia colaboradores com perfil e status
- **Tabela `draw_history`** no Supabase: registra histórico de sorteios por evento
- **Coluna `proprietario_id`** na tabela `events`: rastreia o criador do evento
- **Colunas `data_final` e `horario_final`** na tabela `events`

### 🔄 Modificado

- **Autenticação Clerk**: migrado para novo projeto com e-mail e senha (sem OTP obrigatório)
- **`Dashboard.tsx`**: filtra eventos por perfil — COMERCIAL vê apenas seus eventos
- **`EventDetails.tsx`**: bloqueia acesso de COMERCIAL a eventos de outros colaboradores
- **`EventForm.tsx`**: salva `proprietarioId` ao criar novo evento; aceita `adminProfile` para rastrear o criador
- **`App.tsx`**: registradas novas rotas protegidas `/admin/sorteios` e `/admin/usuarios` com lazy loading e verificação de permissão
- **`useEvents.ts`**: adicionada sincronização automática com `admin_users`, logout de inativos, e exposição de métodos `getAdminUsers`, `createAdminUser`, `updateAdminUser`, `deleteAdminUser`, `getDrawHistory`, `saveDraw`
- **`SupabaseEventService.ts`**: implementados todos os novos métodos de banco de dados

### 🐛 Corrigido

- Importação de `useLanguage` desnecessária removida do `App.tsx`
- Compatibilidade de props mantida entre wrappers e componentes de página

---

## [1.0.0] — Versão Anterior

- Sistema de gestão de eventos com cadastro público e administração
- Inscrição por formulário (interno, externo, mobilidade, link externo)
- Check-in via QR Code
- Importação em massa via planilha XLSX
- Arquivo de eventos encerrados
- Documentação interna

---

*Mantido pela equipe de TI — Auditório UNINASSAU Boa Viagem*
