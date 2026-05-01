insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do nothing;
