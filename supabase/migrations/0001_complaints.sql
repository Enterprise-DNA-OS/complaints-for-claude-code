-- Complaints for Claude Code: the complaints register and its internal dispute resolution (IDR) clock.
-- Runs on PostgreSQL 15+ and on embedded PGlite. No extensions.
-- The rules (timeframes, schemes) are rows, not code: /customise changes them with a new migration.

create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Dispute resolution schemes a complainant can go to once IDR is done or out of time.
create table edr_schemes (
  code text primary key,
  name text not null,
  jurisdiction text not null check (jurisdiction in ('AU','NZ')),
  phone text not null,
  email text not null,
  website text not null,
  postal text,
  refer_within text not null,
  source text not null
);

-- How long a firm has to respond, by jurisdiction and complaint type.
-- always_written: RG 271.75 types that get a written response even when closed inside five business days.
-- basis 'calendar' counts every day; 'business' skips weekends and the holidays table.
create table idr_timeframes (
  jurisdiction text not null check (jurisdiction in ('AU','NZ')),
  complaint_type text not null,
  days int not null check (days > 0),
  basis text not null check (basis in ('calendar','business')),
  checkpoint_days int check (checkpoint_days > 0),
  always_written boolean not null default false,
  rule text not null,
  source text not null,
  primary key (jurisdiction, complaint_type)
);

create table holidays (
  day date primary key,
  name text not null
);

-- A brand is the name the complaint is about. One licence can hold several brands.
create table brands (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  jurisdiction text not null check (jurisdiction in ('AU','NZ')),
  licence text not null,
  scheme_code text not null references edr_schemes(code),
  scheme_member_no text,
  complaints_contact text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table complainants (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  complainant_type text not null default 'individual'
    check (complainant_type in ('individual','small business','other organisation','representative')),
  email text,
  phone text,
  postcode text,
  vulnerability text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table systemic_issues (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null,
  owner text not null,
  raised_on date not null default current_date,
  status text not null default 'open' check (status in ('open','reported','closed')),
  reported_to text,
  reported_on date,
  root_cause text,
  closed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'reported' or (reported_to is not null and reported_on is not null))
);

create table complaints (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                       -- the unique identifier ASIC sees every period
  brand_id uuid not null references brands(id),
  complainant_id uuid not null references complainants(id),
  received_on date not null,
  channel text not null check (channel in ('phone','email','letter','in person','website','social media','other')),
  complaint_type text not null default 'standard',
  product text not null,
  about_representative boolean not null default false,
  representative text,
  summary text not null,
  owner text not null,
  status text not null default 'open' check (status in ('open','resolved','closed')),
  acknowledged_on date,
  acknowledged_by text,
  delay_notice_on date,
  delay_reason text,
  resolved_on date,
  response_on date,                               -- written IDR response (or final response in NZ)
  written_response_requested boolean not null default false,
  satisfaction_confirmed boolean not null default false,
  scheme_informed boolean not null default false, -- the response or notice named the scheme and how to reach it
  escalated_on date,
  scheme_ref text,
  closed_on date,
  systemic_issue_id uuid references systemic_issues(id),
  source text not null default 'manual' check (source in ('manual','import')),
  source_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (about_representative = (representative is not null)),
  check (resolved_on is null or resolved_on >= received_on),
  check (acknowledged_on is null or acknowledged_on >= received_on),
  check (status = 'open' or resolved_on is not null),
  check (status <> 'closed' or closed_on is not null)
);
create index complaints_brand_idx on complaints(brand_id);
create index complaints_status_idx on complaints(status);

-- Up to three issues and three outcomes per complaint, as the IDR data dictionary allows.
create table complaint_issues (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references complaints(id),
  issue text not null,
  unique (complaint_id, issue)
);
create table complaint_outcomes (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references complaints(id),
  outcome text not null,
  remedy_cents bigint check (remedy_cents >= 0),
  unique (complaint_id, outcome)
);

-- Every call, email and letter, so the response is written from the record.
create table contacts (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references complaints(id),
  on_date date not null default current_date,
  direction text not null check (direction in ('in','out')),
  method text not null check (method in ('phone','email','letter','in person','sms','other')),
  note text not null,
  by_whom text not null,
  created_at timestamptz not null default now()
);

-- ASIC IDR data reporting: two six-month periods a year.
create table reporting_periods (
  code text primary key,
  starts_on date not null,
  ends_on date not null,
  due_on date not null,
  submitted_on date,
  submission_ref text,
  submitted_by text,
  check (ends_on > starts_on and due_on > ends_on)
);

create table activity (
  id bigint generated always as identity primary key,
  entity_id text not null,
  action text not null,
  actor text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create trigger brands_touch before update on brands for each row execute function touch_updated_at();
create trigger complainants_touch before update on complainants for each row execute function touch_updated_at();
create trigger systemic_touch before update on systemic_issues for each row execute function touch_updated_at();
create trigger complaints_touch before update on complaints for each row execute function touch_updated_at();

-- The nth business day after a date, skipping weekends and recorded holidays.
create function add_business_days(start_on date, n int) returns date language sql stable as $$
  select d::date from generate_series(start_on + 1, start_on + n * 2 + 30, interval '1 day') d
  where extract(isodow from d) < 6 and not exists (select 1 from holidays h where h.day = d::date)
  order by d offset greatest(n, 1) - 1 limit 1
$$;

-- Business days from one date to another (0 when the same day).
create function business_days_between(from_on date, to_on date) returns int language sql stable as $$
  select count(*)::int from generate_series(from_on + 1, to_on, interval '1 day') d
  where extract(isodow from d) < 6 and not exists (select 1 from holidays h where h.day = d::date)
$$;

insert into edr_schemes (code, name, jurisdiction, phone, email, website, postal, refer_within, source) values
  ('AFCA', 'Australian Financial Complaints Authority', 'AU', '1800 931 678', 'info@afca.org.au', 'www.afca.org.au', 'GPO Box 3, Melbourne VIC 3001',
   'Generally within 2 years of the IDR response; check the AFCA Rules for the time limit that applies.', 'https://www.afca.org.au/make-a-complaint'),
  ('FSCL', 'Financial Services Complaints Limited', 'NZ', '0800 347 257', 'complaints@fscl.org.nz', 'www.fscl.org.nz', null,
   'Within 2 months of being told the complaint is deadlocked.', 'https://fscl.org.nz/complaints/how-make-complaint');

insert into idr_timeframes (jurisdiction, complaint_type, days, basis, checkpoint_days, rule, source) values
  ('AU','standard',            30, 'calendar', null, 'RG 271 Table 2: IDR response within 30 calendar days', 'https://asic.gov.au/regulatory-resources/find-a-document/regulatory-guides/rg-271-internal-dispute-resolution/'),
  ('AU','superannuation',      45, 'calendar', null, 'RG 271 Table 2: superannuation trustee complaints within 45 calendar days', 'https://asic.gov.au/regulatory-resources/find-a-document/regulatory-guides/rg-271-internal-dispute-resolution/'),
  ('AU','traditional trustee', 45, 'calendar', null, 'RG 271 Table 2: traditional trustee complaints within 45 calendar days', 'https://asic.gov.au/regulatory-resources/find-a-document/regulatory-guides/rg-271-internal-dispute-resolution/'),
  ('AU','default notice',      21, 'calendar', null, 'RG 271 Table 2: complaints about a default notice within 21 calendar days', 'https://asic.gov.au/regulatory-resources/find-a-document/regulatory-guides/rg-271-internal-dispute-resolution/'),
  ('AU','hardship',            21, 'calendar', null, 'RG 271 Table 2: hardship notice complaints within 21 calendar days', 'https://asic.gov.au/regulatory-resources/find-a-document/regulatory-guides/rg-271-internal-dispute-resolution/'),
  ('AU','postponement',        21, 'calendar', null, 'RG 271 Table 2: requests to postpone enforcement within 21 calendar days', 'https://asic.gov.au/regulatory-resources/find-a-document/regulatory-guides/rg-271-internal-dispute-resolution/'),
  ('AU','insurance claim declined', 30, 'calendar', null, 'RG 271 Table 2: IDR response within 30 calendar days; RG 271.75 written response always', 'https://asic.gov.au/regulatory-resources/find-a-document/regulatory-guides/rg-271-internal-dispute-resolution/'),
  ('AU','insurance claim value',    30, 'calendar', null, 'RG 271 Table 2: IDR response within 30 calendar days; RG 271.75 written response always', 'https://asic.gov.au/regulatory-resources/find-a-document/regulatory-guides/rg-271-internal-dispute-resolution/'),
  ('NZ','standard',            40, 'business', 20,   'FSCL Terms of Reference: deadlock after 20 working days without a written reason to extend, and after 40 working days in any case', 'https://fscl.org.nz/wp-content/uploads/2021/09/FSCL-Terms-of-Reference-1-January-2019.pdf');

update idr_timeframes set always_written = true
where jurisdiction = 'AU' and complaint_type in ('hardship','superannuation','insurance claim declined','insurance claim value');

-- Views the commands and dashboards share.

create view complaint_register as
select c.id, c.ref, b.code as brand, b.jurisdiction, b.scheme_code as scheme, p.code as complainant_code, p.name as complainant,
       p.complainant_type, p.postcode, p.vulnerability, c.received_on, c.channel, c.complaint_type, c.product,
       c.about_representative, c.representative, c.summary, c.owner, c.status, c.acknowledged_on, c.delay_notice_on, c.delay_reason,
       c.resolved_on, c.response_on, c.written_response_requested, c.satisfaction_confirmed, c.scheme_informed,
       c.escalated_on, c.scheme_ref, c.closed_on, s.code as systemic_issue, c.source,
       (select string_agg(i.issue, '; ' order by i.issue) from complaint_issues i where i.complaint_id = c.id) as issues,
       (select string_agg(o.outcome, '; ' order by o.outcome) from complaint_outcomes o where o.complaint_id = c.id) as outcomes,
       (select sum(o.remedy_cents) from complaint_outcomes o where o.complaint_id = c.id)::bigint as remedy_cents,
       case when b.jurisdiction = 'AU' then 'AUD' else 'NZD' end as currency
from complaints c
join brands b on b.id = c.brand_id
join complainants p on p.id = c.complainant_id
left join systemic_issues s on s.id = c.systemic_issue_id;

create view complaint_deadlines as
select r.id, r.ref, r.brand, r.jurisdiction, r.scheme, r.complainant, r.complaint_type, r.owner, r.status, r.received_on,
       r.acknowledged_on, r.delay_notice_on, r.resolved_on, r.response_on,
       add_business_days(r.received_on, 1) as acknowledge_by,
       case when t.basis = 'calendar' then r.received_on + t.days else add_business_days(r.received_on, t.days) end as respond_by,
       case when t.checkpoint_days is not null then add_business_days(r.received_on, t.checkpoint_days) end as checkpoint_on,
       add_business_days(r.received_on, 5) as five_day_close_by,
       t.days, t.basis, t.rule
from complaint_register r
left join idr_timeframes t on t.jurisdiction = r.jurisdiction and t.complaint_type = r.complaint_type;

create view open_complaints as
select d.ref, d.brand, d.complainant, d.complaint_type, d.owner, d.received_on, d.respond_by,
       (d.respond_by - current_date) as days_left, d.delay_notice_on, d.acknowledged_on, d.checkpoint_on, d.rule
from complaint_deadlines d where d.status = 'open';

-- One row per thing a person must do, worst first.
create view attention_queue as
select * from (
  select 1 as rank, 'response overdue, no delay notice' as item, ref, brand, owner,
         complainant || ': due ' || respond_by || ' (' || rule || ')' as detail, respond_by as due_on
  from complaint_deadlines where status = 'open' and respond_by < current_date and delay_notice_on is null
  union all
  select 2, 'type not in the timeframe table', ref, brand, owner, complainant || ': ' || complaint_type || ' has no ' || jurisdiction || ' timeframe', received_on
  from complaint_deadlines where status = 'open' and respond_by is null
  union all
  select 3, 'not acknowledged', ref, brand, owner, complainant || ': received ' || received_on, acknowledge_by
  from complaint_deadlines where status = 'open' and acknowledged_on is null and acknowledge_by <= current_date
  union all
  select 4, 'NZ extension notice needed', ref, brand, owner, complainant || ': 20 working days on ' || checkpoint_on || ', no written reason sent', checkpoint_on
  from complaint_deadlines where status = 'open' and checkpoint_on < current_date and delay_notice_on is null and respond_by >= current_date
  union all
  select 5, 'response due in 7 days', ref, brand, owner, complainant || ': due ' || respond_by, respond_by
  from complaint_deadlines where status = 'open' and respond_by between current_date and current_date + 7
  union all
  select 6, 'response late, notice sent', ref, brand, owner, complainant || ': due ' || respond_by || ', delay notice ' || delay_notice_on, respond_by
  from complaint_deadlines where status = 'open' and respond_by < current_date and delay_notice_on is not null
  union all
  select 7, 'resolved, response not sent', ref, brand, owner, complainant || ': resolved ' || resolved_on || ', send the written response or confirm the five day exception', resolved_on
  from complaint_deadlines where status = 'resolved' and response_on is null
  union all
  select 8, 'systemic issue not reported', code, '', owner, title || ': raised ' || raised_on, raised_on + 30
  from systemic_issues where status = 'open' and raised_on + 30 < current_date
  union all
  select 9, 'IDR report not lodged', code, '', '', 'period ' || starts_on || ' to ' || ends_on || ', due ' || due_on, due_on
  from reporting_periods where submitted_on is null and ends_on < current_date
) q;

-- Record checks against docs/compliance.md. Each row cites the rule.
create view compliance_findings as
select * from (
  select 'IDR-TIMEFRAME' as rule, 'breach' as severity, ref, brand,
         'Open past ' || respond_by || ' with no delay notice. ' || rule as finding
  from complaint_deadlines where status = 'open' and respond_by < current_date and delay_notice_on is null
  union all
  select 'IDR-TIMEFRAME', 'breach', ref, brand, 'Response sent ' || response_on || ', after ' || respond_by || ' with no delay notice. ' || rule
  from complaint_deadlines where response_on > respond_by and (delay_notice_on is null or delay_notice_on > respond_by)
  union all
  select 'IDR-DELAY-NOTICE', 'breach', ref, brand, 'Delay notice sent ' || delay_notice_on || ', after the deadline ' || respond_by || '. RG 271.66: the notice goes before the timeframe ends.'
  from complaint_deadlines where delay_notice_on > respond_by
  union all
  select 'ACKNOWLEDGE', 'warning', ref, brand, coalesce('Acknowledged ' || acknowledged_on::text, 'Not acknowledged') || ', expected by ' || acknowledge_by || '. RG 271.51: within 24 hours or one business day.'
  from complaint_deadlines where (acknowledged_on is null and acknowledge_by < current_date) or acknowledged_on > acknowledge_by
  union all
  select 'FIVE-DAY-EXCEPTION', 'breach', r.ref, r.brand,
         'Closed with no written response, but ' ||
         case when r.written_response_requested then 'the complainant asked for one'
              when t.always_written then r.complaint_type || ' complaints always get one (RG 271.75)'
              when not r.satisfaction_confirmed then 'satisfaction was never confirmed'
              else 'it was resolved after ' || d.five_day_close_by end || '. RG 271.71 to 271.75.'
  from complaint_register r join complaint_deadlines d on d.id = r.id
  left join idr_timeframes t on t.jurisdiction = r.jurisdiction and t.complaint_type = r.complaint_type
  where r.jurisdiction = 'AU' and r.status = 'closed' and r.source = 'manual' and r.response_on is null
    and (r.written_response_requested or coalesce(t.always_written, false) or not r.satisfaction_confirmed or r.resolved_on > d.five_day_close_by)
  union all
  select 'SCHEME-INFORMED', 'breach', ref, brand, 'Response or delay notice on file without the ' || scheme || ' details. ' ||
         case when scheme = 'AFCA' then 'RG 271.53 and 271.66: the IDR response and any delay notice tell the complainant about AFCA and give its contact details.'
              else 'FSCL Terms of Reference: the complainant is told about FSCL and its contact details.' end
  from complaint_register where source = 'manual' and (response_on is not null or delay_notice_on is not null) and not scheme_informed
  union all
  select 'NZ-EXTENSION', 'breach', ref, brand, 'Past 20 working days (' || checkpoint_on || ') with no written reason to extend. FSCL Terms of Reference.'
  from complaint_deadlines where jurisdiction = 'NZ' and status = 'open' and checkpoint_on < current_date and delay_notice_on is null
  union all
  select 'IDR-DATA', 'warning', ref, brand, 'Closed with ' ||
         concat_ws(', ', case when issues is null then 'no issue' end, case when outcomes is null then 'no outcome' end,
                   case when outcomes ilike '%monetary%' and coalesce(remedy_cents, 0) = 0 then 'a monetary outcome with no amount' end,
                   case when postcode is null then 'no postcode' end) || '. ASIC IDR data reporting.'
  from complaint_register where status = 'closed' and (issues is null or outcomes is null or postcode is null or (outcomes ilike '%monetary%' and coalesce(remedy_cents, 0) = 0))
  union all
  select 'SYSTEMIC', 'warning', code, '', title || ' open since ' || raised_on || ', not reported to the board or owner named in your policy. RG 271 systemic issues.'
  from systemic_issues where status = 'open' and raised_on + 30 < current_date
  union all
  select 'IDR-REPORT', case when due_on < current_date then 'breach' else 'warning' end, code, '',
         'Period ' || starts_on || ' to ' || ends_on || ' not lodged, due ' || due_on || '. ASIC IDR data reporting.'
  from reporting_periods where submitted_on is null and ends_on < current_date
) f;

create view systemic_register as
select s.code, s.title, s.owner, s.status, s.raised_on, s.reported_to, s.reported_on, s.root_cause,
       count(c.id)::int as complaints, count(c.id) filter (where c.status = 'open')::int as open_complaints,
       coalesce(sum(o.remedy_cents), 0)::bigint as remedy_cents
from systemic_issues s
left join complaints c on c.systemic_issue_id = s.id
left join complaint_outcomes o on o.complaint_id = c.id
group by s.id;

-- Rows for one ASIC period: received in the period, or open at any point in it.
create view idr_period_rows as
select p.code as period, r.*,
       case when r.closed_on is not null then r.closed_on - r.received_on end as days_to_close
from reporting_periods p
join complaint_register r on r.received_on <= p.ends_on and (r.closed_on is null or r.closed_on >= p.starts_on);

alter table edr_schemes enable row level security;
alter table idr_timeframes enable row level security;
alter table holidays enable row level security;
alter table brands enable row level security;
alter table complainants enable row level security;
alter table systemic_issues enable row level security;
alter table complaints enable row level security;
alter table complaint_issues enable row level security;
alter table complaint_outcomes enable row level security;
alter table contacts enable row level security;
alter table reporting_periods enable row level security;
alter table activity enable row level security;
