create table if not exists users (
  id text primary key,
  role text not null check (role in ('cat', 'owner')),
  display_name text not null,
  openid text unique,
  openid_bound boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists menu_items (
  id text primary key,
  category_id text not null,
  category text not null,
  name text not null,
  description text not null,
  cat_reason text not null,
  tags text[] not null default '{}',
  recommended_meal_times text[] not null default '{}',
  recommended_moods text[] not null default '{}',
  estimated_minutes integer not null check (estimated_minutes > 0),
  cooking_minutes integer not null check (cooking_minutes > 0),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id text primary key,
  cat_user_id text not null references users(id),
  owner_user_id text not null references users(id),
  meal_time text not null check (meal_time in ('lunch', 'dinner', 'late_night')),
  mood text not null check (mood in ('hungry', 'hot', 'meat', 'sweet', 'tired', 'owner_pick')),
  status text not null check (status in ('submitted', 'replacement_requested', 'accepted', 'cooking', 'completed', 'cancelled')),
  note text not null default '',
  unread_by_cat boolean not null default false,
  unread_by_owner boolean not null default false,
  last_actor_role text check (last_actor_role in ('cat', 'owner')),
  notification_summary jsonb not null default '{"hasWarning": false, "latestWarning": null}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  menu_item_id text not null references menu_items(id),
  name text not null,
  quantity integer not null check (quantity > 0),
  note text not null default '',
  replacement_for_item_id text,
  created_at timestamptz not null default now()
);

create table if not exists wish_items (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  name text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists order_events (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  type text not null check (type in ('submitted', 'replacement_requested', 'replacement_confirmed', 'replacement_rejected', 'accepted', 'cooking', 'completed', 'cancelled')),
  actor_role text not null check (actor_role in ('cat', 'owner')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists replacement_requests (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  status text not null check (status in ('pending', 'confirmed', 'rejected')),
  cat_note text not null default '',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists replacement_items (
  id text primary key,
  replacement_request_id text not null references replacement_requests(id) on delete cascade,
  original_item_id text not null,
  original_item_name text not null,
  replacement_menu_item_id text,
  replacement_menu_item_name text not null default '',
  replacement_wish_name text not null default '',
  reason text not null default ''
);

create table if not exists notification_logs (
  id text primary key,
  order_id text references orders(id) on delete cascade,
  template_key text not null,
  recipient_user_id text not null references users(id),
  status text not null check (status in ('sent', 'skipped_not_authorized', 'failed')),
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_menu_items_hidden on menu_items(hidden);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_cat_user_id on orders(cat_user_id);
create index if not exists idx_orders_owner_user_id on orders(owner_user_id);
create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_wish_items_order_id on wish_items(order_id);
create index if not exists idx_order_events_order_id on order_events(order_id);
create index if not exists idx_replacement_requests_order_id on replacement_requests(order_id);
create index if not exists idx_notification_logs_order_id on notification_logs(order_id);
