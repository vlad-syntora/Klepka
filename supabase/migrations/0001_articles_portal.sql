-- Articles portal: authors, articles, comments, RLS, search RPC, storage bucket.

create table authors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  body jsonb not null default '{"type":"doc","content":[]}',
  cover_url text,
  author_id uuid references authors(id) on delete set null,
  tags text[] not null default '{}',
  hidden_keywords text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft','scheduled','published','archived')),
  publish_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index articles_status_published_at_idx on articles (status, published_at desc);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger articles_set_updated_at
  before update on articles
  for each row execute function set_updated_at();

create table comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  author_email text not null check (char_length(author_email) <= 255),
  body text not null check (char_length(body) between 1 and 5000),
  is_hidden boolean not null default false,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index comments_article_created_idx on comments (article_id, created_at desc);
create index comments_ip_created_idx on comments (ip_hash, created_at desc);

-- RLS
alter table authors enable row level security;
alter table articles enable row level security;
alter table comments enable row level security;

create policy "anon read authors" on authors
  for select to anon, authenticated using (true);
create policy "admin write authors" on authors
  for all to authenticated using (true) with check (true);

create policy "anon read published articles" on articles
  for select to anon using (status = 'published');
create policy "admin full articles" on articles
  for all to authenticated using (true) with check (true);

create policy "anon read visible comments" on comments
  for select to anon using (
    is_hidden = false
    and exists (select 1 from articles a where a.id = article_id and a.status = 'published')
  );
create policy "admin full comments" on comments
  for all to authenticated using (true) with check (true);
-- No anon INSERT policy on comments: inserts go through the service role in api/comments.

-- Column-level privacy for anon: hidden_keywords and commenter emails must not be readable.
-- Postgres column privileges only work as grants, so revoke the table-level SELECT first.
revoke select on articles from anon;
grant select (id, title, slug, excerpt, body, cover_url, author_id, tags, status, published_at, created_at, updated_at)
  on articles to anon;

revoke select on comments from anon;
grant select (id, article_id, author_name, body, created_at) on comments to anon;

-- Search across title, public tags and hidden keywords; returns safe columns of published articles only.
create or replace function search_articles(q text)
returns table (
  id uuid,
  title text,
  slug text,
  excerpt text,
  cover_url text,
  author_id uuid,
  tags text[],
  published_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select a.id, a.title, a.slug, a.excerpt, a.cover_url, a.author_id, a.tags, a.published_at
  from articles a
  where a.status = 'published'
    and (
      a.title ilike '%' || q || '%'
      or array_to_string(a.tags || a.hidden_keywords, ' ') ilike '%' || q || '%'
    )
  order by a.published_at desc;
$$;

grant execute on function search_articles(text) to anon, authenticated;

-- Storage: single public bucket for covers, inline images and author avatars.
insert into storage.buckets (id, name, public) values ('article-media', 'article-media', true);

create policy "admin upload article media" on storage.objects
  for insert to authenticated with check (bucket_id = 'article-media');
create policy "admin update article media" on storage.objects
  for update to authenticated using (bucket_id = 'article-media');
create policy "admin delete article media" on storage.objects
  for delete to authenticated using (bucket_id = 'article-media');
