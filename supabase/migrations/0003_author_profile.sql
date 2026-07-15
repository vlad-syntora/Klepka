-- Author profile: job position and short bio shown on article pages.

alter table authors
  add column title text,
  add column bio text;
