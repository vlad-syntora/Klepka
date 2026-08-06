-- Milestones gain an explicit start date so the Gantt view can draw an accurate span
-- (start → due) per milestone instead of inferring the start from the previous milestone's due date.
alter table portal_milestones
  add column if not exists start_date date;
