# 🚀 ATUALIZAÇÃO V2 — Sistema de Gestão de Eventos

> **Data:** Junho/2026  
> **Versão:** 2.0.0  
> **Status:** Produção

---

## 📋 Resumo das Mudanças

A versão 2.0 traz um conjunto de evoluções significativas ao sistema, mantendo total compatibilidade com as funcionalidades existentes. As principais áreas de melhoria foram: **autenticação**, **controle de permissões por perfil**, **módulo de sorteios** e **indicadores no painel administrativo**.

---

## 🔐 1. Autenticação — Novo Projeto Clerk

As credenciais do Clerk foram substituídas por um novo projeto configurado para usar apenas **e-mail e senha** (sem OTP/MFA obrigatório). O arquivo `.env` foi atualizado com as novas chaves:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

---

## 👥 2. Controle de Permissões (ADMIN vs COMERCIAL)

### Perfis Disponíveis

| Perfil      | Acesso                                                                 |
|-------------|------------------------------------------------------------------------|
| `ADMIN`     | Visualiza todos os eventos, todos os inscritos, gerencia usuários      |
| `COMERCIAL` | Visualiza apenas seus próprios eventos e seus respectivos inscritos    |

### Sincronização de Login

Ao fazer login pelo Clerk, o sistema:
1. Busca o usuário pelo e-mail na tabela `admin_users` do Supabase
2. Atualiza o `id` Clerk no banco de dados
3. Se o usuário estiver **inativo**, o logout é feito automaticamente
4. Se for o **primeiro login no sistema**, o usuário é registrado como `ADMIN` (bootstrap)

### Restrições Aplicadas

- **`EventDetails.tsx`**: Usuários `COMERCIAL` que acessem um evento que não é deles verão uma tela de "Permissão Insuficiente"
- **`Dashboard.tsx`**: Usuários `COMERCIAL` veem apenas seus próprios eventos na agenda e nos indicadores
- **`/admin/usuarios`**: Rota bloqueada para `COMERCIAL` — apenas `ADMIN` tem acesso

---

## 👤 3. Controle de Acesso de Usuários (`/admin/usuarios`)

Nova tela administrativa disponível apenas para o perfil **ADMIN**:

- **Listagem** de todos os colaboradores cadastrados no sistema
- **Criação** de novos usuários (nome, e-mail, perfil, status)
- **Edição** de usuários existentes
- **Ativação/Inativação** de colaboradores
- **Exclusão** com confirmação

Acessado pelo botão **"Usuários"** no painel administrativo (visível apenas para ADMIN).

---

## 🎰 4. Sorteador Inteligente (`/admin/sorteios`)

Nova tela de sorteios disponível para todos os usuários logados:

### Funcionalidades

- **Seleção de Evento**: Lista os eventos disponíveis (COMERCIAL vê apenas os seus)
- **Escopo do Sorteio**:
  - `Sortear entre todos` — todos os inscritos no evento
  - `Sortear apenas novos inscritos` — participantes cadastrados **após** o último sorteio realizado para aquele evento
- **Animação de Sorteio**: Roleta com animação CSS progressiva (acelera e desacelera)
- **Exibição do Vencedor**: Nome completo, e-mail, telefone e CPF
- **Registro Automático**: O resultado é salvo na tabela `draw_history` do Supabase com dados de quem sorteou, total de inscritos e quantidade de novos inscritos
- **Histórico de Sorteios**: Painel lateral exibindo os últimos sorteados por evento

---

## 📅 5. Eventos de Múltiplos Dias

O formulário de cadastro de eventos foi atualizado para suportar períodos:

- **Data Inicial** (obrigatória — mantida)
- **Data Final** (opcional)
- **Hora Inicial** (obrigatória — mantida)
- **Hora Final** (opcional)

Os campos são opcionais para manter compatibilidade com eventos de um único dia.

---

## 📊 6. Painel Administrativo — Indicadores V2

O painel foi reestruturado com 6 novos indicadores:

| Indicador          | Descrição                                              |
|--------------------|--------------------------------------------------------|
| Eventos Ativos     | Eventos não encerrados                                 |
| Eventos Futuros    | Eventos com data ≥ hoje e não encerrados               |
| Arquivados         | Eventos encerrados                                     |
| Inscritos no Mês   | Participantes registrados no mês/ano atual             |
| Total Participantes| Soma de inscritos (filtrado por período se aplicável)  |
| Média por Evento   | Média de inscritos por evento no período               |

Além disso, o painel agora exibe o **nome e o perfil do usuário logado** no cabeçalho.

---

## 🗄️ 7. Banco de Dados — Novas Tabelas e Colunas

### Tabelas Criadas

```sql
-- Usuários administrativos
CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,          -- Clerk User ID
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  perfil TEXT NOT NULL,         -- 'ADMIN' | 'COMERCIAL'
  status TEXT NOT NULL,         -- 'ativo' | 'inativo'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de sorteios
CREATE TABLE draw_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES registrations(id),
  responsavel_id TEXT REFERENCES admin_users(id),
  total_inscritos INTEGER,
  novos_inscritos INTEGER,
  data_sorteio TIMESTAMPTZ DEFAULT NOW()
);
```

### Colunas Adicionadas em `events`

```sql
ALTER TABLE events ADD COLUMN proprietario_id TEXT REFERENCES admin_users(id);
ALTER TABLE events ADD COLUMN data_final TEXT;
ALTER TABLE events ADD COLUMN horario_final TEXT;
```

---

## 📁 Arquivos Criados/Modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `.env` | Editado | Novas credenciais Clerk |
| `src/types/index.ts` | Editado | Novas interfaces `AdminUser`, `DrawHistory`, campos em `Evento` |
| `src/services/interfaces/EventService.ts` | Editado | Declarações de métodos V2 |
| `src/services/implementations/SupabaseEventService.ts` | Editado | Implementação real dos novos métodos |
| `src/services/implementations/LocalStorageService.ts` | Editado | Mock para compatibilidade |
| `src/hooks/useEvents.ts` | Editado | Sincronização de perfil, novas actions |
| `src/App.tsx` | Editado | Rotas `/admin/sorteios` e `/admin/usuarios` |
| `src/pages/Admin/Dashboard.tsx` | Editado | Indicadores V2, filtro por perfil, botões novos |
| `src/pages/Admin/EventForm.tsx` | Editado | Campos data/hora final, `proprietarioId` |
| `src/pages/Admin/EventDetails.tsx` | Editado | Verificação de permissão por perfil |
| `src/pages/Admin/AccessControl.tsx` | **Novo** | Gestão de usuários administrativos |
| `src/pages/Admin/Draws.tsx` | **Novo** | Sorteador inteligente com animação e histórico |
