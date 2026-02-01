create table if not exists extension_connect_codes (
  code text primary key,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists idx_extension_connect_codes_user_id
  on extension_connect_codes(user_id);