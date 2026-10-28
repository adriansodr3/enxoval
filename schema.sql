-- =====================================================================
-- Nosso Enxoval — esquema do banco
-- Rodar inteiro no Supabase: SQL Editor › New query › colar › Run
-- =====================================================================

-- ---------- Quem pode acessar ----------
-- Só os e-mails desta tabela enxergam e editam os dados.
create table membros (
  email text primary key
);

-- TROQUE pelos e-mails de vocês dois (os mesmos usados no login):
insert into membros (email) values
  ('adriansodre1@gmail.com'),
  ('jessicarabelcirnon@gmail.com');

create or replace function is_membro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membros
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- ---------- Configuração geral (linha única) ----------
create table config (
  id              int primary key default 1 check (id = 1),
  orcamento_total numeric(12,2) not null default 0,
  meta_valor      numeric(12,2) not null default 0,
  meta_inicio     date not null default current_date,
  meta_data       date
);
insert into config (id) values (1);

-- ---------- Cômodos e categorias ----------
create table comodos (
  id        bigint generated always as identity primary key,
  nome      text not null unique,
  orcamento numeric(12,2) not null default 0,
  ordem     int not null default 0
);

create table categorias (
  id   bigint generated always as identity primary key,
  nome text not null unique
);

-- ---------- Itens do enxoval ----------
create table itens (
  id               bigint generated always as identity primary key,
  nome             text not null,
  comodo_id        bigint references comodos(id) on delete set null,
  categoria_id     bigint references categorias(id) on delete set null,
  quantidade       int not null default 1 check (quantidade > 0),
  prioridade       text not null default 'desejavel'
                   check (prioridade in ('essencial','desejavel','superfluo')),
  status           text not null default 'pendente'
                   check (status in ('pendente','cotando','comprado','ganho')),
  -- compra (status = comprado)
  valor_pago       numeric(12,2) check (valor_pago >= 0),   -- valor TOTAL pago
  loja_compra      text,
  data_compra      date,
  forma_pagamento  text check (forma_pagamento in ('avista','parcelado')),
  parcelas         int check (parcelas between 1 and 48),
  primeira_parcela date,                                    -- mês da 1ª parcela
  -- presente (status = ganho)
  ganho_de         text,
  observacao       text,
  created_at       timestamptz not null default now()
);

-- ---------- Cotações (preço UNITÁRIO por loja) ----------
create table cotacoes (
  id            bigint generated always as identity primary key,
  item_id       bigint not null references itens(id) on delete cascade,
  loja          text not null,
  preco         numeric(12,2) not null check (preco >= 0),
  parcelas_max  int not null default 1 check (parcelas_max between 1 and 48),
  link          text,
  created_at    timestamptz not null default now()
);

-- ---------- Aportes (dinheiro guardado para a meta) ----------
create table aportes (
  id         bigint generated always as identity primary key,
  data       date not null default current_date,
  valor      numeric(12,2) not null,
  descricao  text,
  created_at timestamptz not null default now()
);

-- ---------- Segurança (RLS) ----------
alter table membros    enable row level security;
alter table config     enable row level security;
alter table comodos    enable row level security;
alter table categorias enable row level security;
alter table itens      enable row level security;
alter table cotacoes   enable row level security;
alter table aportes    enable row level security;

create policy "membros leem membros" on membros    for select using (is_membro());
create policy "membros: config"      on config     for all using (is_membro()) with check (is_membro());
create policy "membros: comodos"     on comodos    for all using (is_membro()) with check (is_membro());
create policy "membros: categorias"  on categorias for all using (is_membro()) with check (is_membro());
create policy "membros: itens"       on itens      for all using (is_membro()) with check (is_membro());
create policy "membros: cotacoes"    on cotacoes   for all using (is_membro()) with check (is_membro());
create policy "membros: aportes"     on aportes    for all using (is_membro()) with check (is_membro());

-- ---------- Sincronização em tempo real ----------
alter publication supabase_realtime add table config, comodos, categorias, itens, cotacoes, aportes;

-- ---------- Dados iniciais (editáveis no app) ----------
insert into comodos (nome, ordem) values
  ('Cozinha', 1), ('Sala', 2), ('Quarto', 3),
  ('Banheiro', 4), ('Lavanderia', 5), ('Área externa', 6);

insert into categorias (nome) values
  ('Eletrodomésticos'), ('Eletroportáteis'), ('Móveis'), ('Utensílios'),
  ('Cama'), ('Mesa'), ('Banho'), ('Decoração'), ('Limpeza'), ('Eletrônicos');
