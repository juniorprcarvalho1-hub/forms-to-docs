create type public.app_role as enum ('admin','user');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null, role app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create policy "Usuario ve seus papeis" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.assinatura (id boolean primary key default true check (id), cliente text not null default 'FACESF', plano text not null default 'mensal', valor numeric not null default 250, status text not null default 'ativa', vencimento date not null default (current_date + 30), observacao text not null default '', updated_at timestamptz not null default now());
grant select, insert, update on public.assinatura to authenticated; grant all on public.assinatura to service_role;
alter table public.assinatura enable row level security;
create policy "Autenticados leem assinatura" on public.assinatura for select to authenticated using (true);
create policy "Admin altera assinatura" on public.assinatura for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "Admin cria assinatura" on public.assinatura for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
insert into public.assinatura default values;

create table public.pagamentos (id uuid primary key default gen_random_uuid(), data date not null default current_date, valor numeric not null default 250, plano text not null default 'mensal', observacao text not null default '', created_at timestamptz not null default now());
grant select, insert, update, delete on public.pagamentos to authenticated; grant all on public.pagamentos to service_role;
alter table public.pagamentos enable row level security;
create policy "Admin gerencia pagamentos" on public.pagamentos for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.ips_bloqueados (id uuid primary key default gen_random_uuid(), ip text not null unique, motivo text not null default '', created_at timestamptz not null default now());
grant select, insert, update, delete on public.ips_bloqueados to authenticated; grant all on public.ips_bloqueados to service_role;
alter table public.ips_bloqueados enable row level security;
create policy "Admin gerencia ips" on public.ips_bloqueados for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email='juniorprcarvalho1@gmail.com';