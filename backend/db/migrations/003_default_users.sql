insert into users (id, role, display_name, openid, openid_bound)
values
  ('usr_cat', 'cat', '咪', 'dev-cat-openid', true),
  ('usr_owner', 'owner', '主人', 'dev-owner-openid', true)
on conflict (id) do update set
  role = excluded.role,
  display_name = excluded.display_name,
  updated_at = now();
