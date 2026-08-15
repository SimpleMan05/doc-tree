-- Freedom Tree schema — run in Supabase SQL editor

create table if not exists leaves (
  id text primary key,                 -- short human-shareable ID e.g. "F7X9K2"
  text text not null,
  theme text not null,                 -- sacrifice | hope | unity | dreams | gratitude | courage
  color text not null,                 -- saffron | white | green
  position_x float not null,
  position_y float not null,
  position_z float not null,
  ip_hash text not null,
  created_at timestamptz default now()
);

create index if not exists idx_leaves_ip_hash on leaves (ip_hash);
create index if not exists idx_leaves_created_at on leaves (created_at);

-- Enforce one leaf per IP per 24h at the DB level too (defense in depth,
-- the app also checks this before insert)
create or replace function check_ip_rate_limit()
returns trigger as $$
begin
  if exists (
    select 1 from leaves
    where ip_hash = new.ip_hash
      and created_at > now() - interval '24 hours'
  ) then
    raise exception 'RATE_LIMIT: one leaf per device per day';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ip_rate_limit on leaves;
create trigger trg_ip_rate_limit
  before insert on leaves
  for each row execute function check_ip_rate_limit();

-- Public read access (leaves are meant to be visible on the tree)
alter table leaves enable row level security;
create policy "leaves are publicly readable"
  on leaves for select
  using (true);
-- Inserts only via service role (server), so no insert policy for anon.
