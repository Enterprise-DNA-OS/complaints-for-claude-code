-- Fictional demo data: two Australian brokers and a New Zealand advice firm.
-- Dates are relative to today, so the demo always has overdue, due and late work. Safe to run twice.

insert into brands (code, name, jurisdiction, licence, scheme_code, scheme_member_no, complaints_contact) values
  ('HHL', 'Harbourline Home Loans', 'AU', 'Australian Credit Licence 500123 (fictional)', 'AFCA', '90001', 'complaints@harbourline.example'),
  ('SIB', 'Southbank Insurance Brokers', 'AU', 'AFSL 400456 (fictional)', 'AFCA', '90002', 'resolve@southbank.example'),
  ('KFA', 'Kowhai Financial Advice', 'NZ', 'FAP licence FSP1234567 (fictional)', 'FSCL', 'FSCL-1199', 'complaints@kowhai.example')
on conflict (code) do nothing;

insert into complainants (code, name, complainant_type, email, phone, postcode, vulnerability) values
  ('P-01', 'Grace Whitfield', 'individual', 'grace@example.com', '0400 111 201', '2095', null),
  ('P-02', 'Tomasi Fifita', 'individual', 'tomasi@example.com', '0400 111 202', '4000', 'English is a second language'),
  ('P-03', 'Rhonda Kemp', 'individual', 'rhonda@example.com', '0400 111 203', '3150', 'Recent job loss'),
  ('P-04', 'Lachlan Doyle', 'individual', 'lachlan@example.com', '0400 111 204', '6000', null),
  ('P-05', 'Mere Tawhiri', 'individual', 'mere@example.com', '021 555 205', '6011', null),
  ('P-06', 'Hamish Grant', 'individual', 'hamish@example.com', '021 555 206', '8014', 'Bereavement'),
  ('P-07', 'Priya Nair', 'individual', 'priya@example.com', '0400 111 207', '2150', null),
  ('P-08', 'Bayside Bakery Pty Ltd', 'small business', 'accounts@bayside.example', '0400 111 208', '3186', null),
  ('P-09', 'Daniel Okoro', 'individual', 'daniel@example.com', '0400 111 209', null, null),
  ('P-10', 'Sophie Lam', 'individual', 'sophie@example.com', '0400 111 210', '2000', null),
  ('P-11', 'Ruth Henare', 'individual', 'ruth@example.com', '021 555 211', '0610', null),
  ('P-12', 'Coastal Joinery Ltd', 'small business', 'office@coastal.example', '0400 111 212', '4217', null)
on conflict (code) do nothing;

insert into systemic_issues (code, title, description, owner, raised_on, status, reported_to, reported_on, root_cause) values
  ('SI-01', 'Broker fee missing from the credit guide', 'Three complaints in six weeks from borrowers who say nobody told them about the broker fee. The current credit guide template has no fee line.', 'Nadia Brooks', current_date - 45, 'open', null, null, null),
  ('SI-02', 'Renewal notices sent to old addresses', 'Policy renewals went to superseded postal addresses after the client file migration.', 'Owen Pike', current_date - 120, 'reported', 'Board risk committee', current_date - 95, 'Address field not mapped in the migration')
on conflict (code) do nothing;

insert into complaints (ref, brand_id, complainant_id, received_on, channel, complaint_type, product, about_representative, representative,
                        summary, owner, status, acknowledged_on, acknowledged_by, delay_notice_on, delay_reason, resolved_on, response_on,
                        written_response_requested, satisfaction_confirmed, scheme_informed, escalated_on, scheme_ref, closed_on, systemic_issue_id)
select v.ref, b.id, p.id, current_date - v.received, v.channel, v.ctype, v.product, v.rep is not null, v.rep,
       v.summary, v.owner, v.status, current_date - v.ack, case when v.ack is not null then v.owner end,
       current_date - v.delay, v.delay_reason, current_date - v.resolved, current_date - v.response,
       v.wants_letter, v.satisfied, v.scheme_informed, current_date - v.escalated, v.scheme_ref, current_date - v.closed,
       (select id from systemic_issues s where s.code = v.systemic)
from (values
  ('C-1001','HHL','P-01',34,'phone','standard','Credit - Home loans',null::text,'Says the broker fee was never disclosed before settlement.','Nadia Brooks','open',33,null::int,null::text,null::int,null::int,false,false,false,null::int,null::text,null::int,'SI-01'),
  ('C-1002','HHL','P-07',26,'email','standard','Credit - Home loans',null,'Loan approval took eleven weeks and the rate lock expired.','Nadia Brooks','open',25,null,null,null,null,false,false,false,null,null,null,null),
  ('C-1003','HHL','P-03',24,'phone','hardship','Credit - Home loans',null,'Hardship request after job loss; says the lender was not told for two weeks.','Owen Pike','open',23,5,'Waiting on the lender''s hardship decision letter.',null,null,false,false,true,null,null,null,null),
  ('C-1004','SIB','P-10',4,'website','standard','General insurance - Home contents',null,'Claim lodged through the broker not passed to the insurer.','Owen Pike','open',null,null,null,null,null,false,false,false,null,null,null,null),
  ('C-1005','KFA','P-05',35,'email','standard','Investments - KiwiSaver',null,'Moved to a growth fund without understanding the risk.','Aroha Tane','open',34,null,null,null,null,false,false,false,null,null,null,null),
  ('C-1006','KFA','P-06',70,'letter','standard','Life insurance - Income protection',null,'Policy lapsed during bereavement leave after a missed premium reminder.','Aroha Tane','open',69,38,'Waiting on the insurer''s reinstatement review.',null,null,false,false,true,null,null,null,null),
  ('C-1007','SIB','P-04',20,'phone','standard','General insurance - Motor',null,'Certificate of currency not received.','Owen Pike','closed',20,null,null,18,null,false,true,false,null,null,18,null),
  ('C-1008','HHL','P-09',40,'phone','standard','Credit - Home loans',null,'Broker fee charged without being disclosed.','Nadia Brooks','closed',39,null,null,29,null,false,true,false,null,null,29,'SI-01'),
  ('C-1009','HHL','P-02',19,'phone','default notice','Credit - Personal loans',null,'Default notice issued while a hardship arrangement was being negotiated.','Nadia Brooks','resolved',18,null,null,2,null,false,false,false,null,null,null,null),
  ('C-1010','SIB','P-08',60,'email','standard','General insurance - Business pack',null,'Business interruption cover left off the renewal.','Owen Pike','closed',59,null,null,40,38,false,false,true,null,null,38,null),
  ('C-1011','SIB','P-12',55,'email','standard','General insurance - Business pack',null,'Renewal notice sent to the old address; policy lapsed.','Owen Pike','closed',54,null,null,30,28,false,false,false,null,null,28,'SI-02'),
  ('C-1012','HHL','P-09',90,'email','standard','Credit - Home loans',null,'Fee refund requested for an undisclosed broker fee.','Nadia Brooks','closed',89,null,null,70,68,false,false,true,null,null,68,'SI-01'),
  ('C-1013','SIB','P-10',150,'email','standard','General insurance - Home building','Coastline Insurance Services (authorised representative)','Storm claim declined; says the broker advised the wrong sum insured.','Owen Pike','closed',149,null,null,125,125,false,false,true,100,'AFCA 26-001234',100,null),
  ('C-1014','HHL','P-07',12,'phone','standard','Credit - Home loans','Jordan Mills (credit representative)','Representative did not return calls for three weeks.','Nadia Brooks','open',11,null,null,null,null,true,false,false,null,null,null,null),
  ('C-1015','KFA','P-11',8,'phone','standard','Investments - KiwiSaver',null,'Withdrawal for first home delayed.','Aroha Tane','open',7,null,null,null,null,false,false,false,null,null,null,null)
) as v(ref, brand, who, received, channel, ctype, product, rep, summary, owner, status, ack, delay, delay_reason, resolved, response,
       wants_letter, satisfied, scheme_informed, escalated, scheme_ref, closed, systemic)
join brands b on b.code = v.brand
join complainants p on p.code = v.who
on conflict (ref) do nothing;

insert into complaint_issues (complaint_id, issue)
select c.id, v.issue from (values
  ('C-1001','Disclosure'), ('C-1001','Fees and charges'), ('C-1002','Delay in handling'), ('C-1003','Financial hardship'),
  ('C-1004','Claim handling'), ('C-1005','Inappropriate advice'), ('C-1006','Policy lapse'), ('C-1007','Service quality'),
  ('C-1008','Disclosure'), ('C-1009','Default notice'), ('C-1010','Incorrect advice'), ('C-1011','Policy lapse'),
  ('C-1012','Fees and charges'), ('C-1013','Claim declined'), ('C-1013','Incorrect advice'), ('C-1014','Service quality'), ('C-1015','Delay in handling')
) as v(ref, issue) join complaints c on c.ref = v.ref
on conflict (complaint_id, issue) do nothing;

insert into complaint_outcomes (complaint_id, outcome, remedy_cents)
select c.id, v.outcome, v.cents from (values
  ('C-1007','Explanation provided', null::bigint), ('C-1008','Apology', null), ('C-1010','Monetary remedy', 185000),
  ('C-1010','Apology', null), ('C-1011','Policy reinstated', null), ('C-1012','Monetary remedy', null), ('C-1013','Complaint escalated to AFCA', null),
  ('C-1009','Hardship arrangement', null)
) as v(ref, outcome, cents) join complaints c on c.ref = v.ref
on conflict (complaint_id, outcome) do nothing;

insert into contacts (id, complaint_id, on_date, direction, method, note, by_whom)
select v.id::uuid, c.id, current_date - v.age, v.dir, v.method, v.note, v.who from (values
  ('a0000000-0000-0000-0000-000000000001','C-1001',34,'in','phone','Called upset about the fee on the settlement statement.','Nadia Brooks'),
  ('a0000000-0000-0000-0000-000000000002','C-1001',33,'out','email','Acknowledged; asked for the settlement statement.','Nadia Brooks'),
  ('a0000000-0000-0000-0000-000000000003','C-1001',20,'in','email','Sent the settlement statement. Asks for the fee back.','Nadia Brooks'),
  ('a0000000-0000-0000-0000-000000000004','C-1003',23,'out','phone','Acknowledged. Passed hardship request to the lender the same day.','Owen Pike'),
  ('a0000000-0000-0000-0000-000000000005','C-1003',5,'out','letter','Delay notice sent with AFCA details.','Owen Pike'),
  ('a0000000-0000-0000-0000-000000000006','C-1005',34,'out','email','Acknowledged. Requested the statement of advice from the file.','Aroha Tane'),
  ('a0000000-0000-0000-0000-000000000007','C-1009',2,'out','phone','Lender withdrew the default notice and set a three month arrangement.','Nadia Brooks'),
  ('a0000000-0000-0000-0000-000000000008','C-1014',11,'out','phone','Acknowledged. Client wants the outcome in writing.','Nadia Brooks')
) as v(id, ref, age, dir, method, note, who) join complaints c on c.ref = v.ref
on conflict (id) do nothing;

-- The ASIC periods around today: the last one lodged, the current one open.
insert into reporting_periods (code, starts_on, ends_on, due_on, submitted_on, submission_ref, submitted_by)
select to_char(p.s, 'YYYY') || case when extract(month from p.s) = 1 then '-H1' else '-H2' end, p.s::date,
       (p.s + interval '6 months' - interval '1 day')::date, (p.s + interval '8 months' - interval '1 day')::date,
       case when p.lodged then least((p.s + interval '7 months' + interval '20 days')::date, current_date) end,
       case when p.lodged then 'ASIC portal receipt (demo)' end,
       case when p.lodged then 'Nadia Brooks' end
from (select date_trunc('year', current_date) + case when extract(month from current_date) > 6 then interval '6 months' else interval '0 months' end as cur) x,
     lateral (values (x.cur - interval '6 months', true), (x.cur, false)) as p(s, lodged)
on conflict (code) do nothing;
