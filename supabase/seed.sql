-- Development seed data: one author and three articles (published/published/draft).

insert into authors (id, full_name, avatar_url, title, bio) values
  (
    '11111111-1111-4111-8111-111111111111',
    'Sergii Romashov',
    null,
    'Co-Founder & Salesforce Architect',
    'Salesforce architect with 10+ years of CRM consulting experience, helping revenue teams build scalable Salesforce systems.'
  );

insert into articles (title, slug, excerpt, body, author_id, tags, hidden_keywords, status, published_at) values
(
  'Getting Started with Salesforce Flows',
  'getting-started-with-salesforce-flows',
  'A practical introduction to Salesforce Flow Builder: when to use flows, core building blocks, and common pitfalls to avoid.',
  '{
    "type": "doc",
    "content": [
      {"type": "paragraph", "content": [{"type": "text", "text": "Salesforce Flow is the most powerful declarative automation tool on the platform. This guide walks you through the essentials."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Why Flows Matter"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "With Workflow Rules and Process Builder retired, "}, {"type": "text", "marks": [{"type": "bold"}], "text": "Flow is the single automation tool"}, {"type": "text", "text": " going forward."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Core Building Blocks"}]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Elements"}]},
      {"type": "bulletList", "content": [
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Assignment — set variable values"}]}]},
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Decision — branch the logic"}]}]},
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Loop — iterate over collections"}]}]}
      ]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Flow Types"}]},
      {"type": "table", "content": [
        {"type": "tableRow", "content": [
          {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Type"}]}]},
          {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Trigger"}]}]}
        ]},
        {"type": "tableRow", "content": [
          {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Record-Triggered"}]}]},
          {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Create / update / delete"}]}]}
        ]},
        {"type": "tableRow", "content": [
          {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Screen Flow"}]}]},
          {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "User interaction"}]}]}
        ]}
      ]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Common Pitfalls"}]},
      {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "italic"}], "text": "Avoid DML inside loops"}, {"type": "text", "text": " — always collect records and commit once."}]}
    ]
  }'::jsonb,
  '11111111-1111-4111-8111-111111111111',
  array['salesforce', 'flows', 'automation'],
  array['process builder', 'workflow rules'],
  'published',
  now() - interval '7 days'
),
(
  'CRM Data Hygiene Checklist',
  'crm-data-hygiene-checklist',
  'Duplicate records, stale leads and empty fields quietly kill CRM adoption. Use this checklist to keep your org clean.',
  '{
    "type": "doc",
    "content": [
      {"type": "paragraph", "content": [{"type": "text", "text": "Bad data is the number one reason sales teams stop trusting their CRM."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Deduplication"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Enable duplicate rules on Leads, Contacts and Accounts before importing anything."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Field Completeness"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Track completeness of the ten fields your reports actually rely on."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Ownership Review"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Reassign records of deactivated users quarterly."}]}
    ]
  }'::jsonb,
  '11111111-1111-4111-8111-111111111111',
  array['crm', 'data quality'],
  array['dedupe', 'duplicates', 'data cleaning'],
  'published',
  now() - interval '2 days'
),
(
  'Draft: Salesforce Release Notes Highlights',
  'salesforce-release-notes-highlights',
  'Our take on the most impactful changes in the latest Salesforce release.',
  '{
    "type": "doc",
    "content": [
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Work in Progress"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "This draft should never be visible to anonymous visitors."}]}
    ]
  }'::jsonb,
  '11111111-1111-4111-8111-111111111111',
  array['salesforce', 'release'],
  array['spring release'],
  'draft',
  null
);
