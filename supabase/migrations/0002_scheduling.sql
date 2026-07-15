-- Scheduled publishing: pg_cron flips scheduled articles to published and
-- triggers a Vercel rebuild through pg_net.
--
-- Before running, store the deploy hook URL in Vault (one time):
--   select vault.create_secret('<https://api.vercel.com/v1/integrations/deploy/...>', 'vercel_deploy_hook_url');

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function publish_scheduled_articles()
returns void
language plpgsql security definer set search_path = public as $$
declare
  updated_count int;
begin
  update articles
     set status = 'published',
         published_at = coalesce(published_at, publish_at)
   where status = 'scheduled'
     and publish_at <= now();
  get diagnostics updated_count = row_count;

  if updated_count > 0 then
    perform net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'vercel_deploy_hook_url'
      )
    );
  end if;
end $$;

select cron.schedule(
  'publish-scheduled-articles',
  '*/10 * * * *',
  'select publish_scheduled_articles()'
);
