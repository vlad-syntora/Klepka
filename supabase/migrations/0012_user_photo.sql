-- 0012_user_photo.sql — optional headshot URL per user, shown in the client's "Your Klepka team"
-- widget. Set on the user by an admin (external URL); no storage bucket involved.

alter table portal_users add column if not exists photo_url text;
