create table if not exists notification_subscriptions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  template_key text not null,
  source_action text not null,
  status text not null check (status in ('accept', 'reject', 'ban')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, template_key, source_action)
);

create index if not exists idx_notification_subscriptions_user_id on notification_subscriptions(user_id);
create index if not exists idx_notification_subscriptions_template_key on notification_subscriptions(template_key);
