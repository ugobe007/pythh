begin;

create table if not exists public.pythh_fundraising_evidence_reviews (
  id bigserial primary key,
  outcome_id integer not null references public.pythh_fundraising_outcomes(id) on delete cascade,
  reviewer_user_id integer not null references public.pythh_users(id) on delete restrict,
  decision text not null check (decision in ('verified','rejected')),
  review_note text,
  created_at timestamptz not null default now(),
  constraint uq_pythh_fundraising_evidence_review unique (outcome_id)
);

create index if not exists idx_pythh_evidence_reviews_created on public.pythh_fundraising_evidence_reviews(created_at desc);
alter table public.pythh_fundraising_evidence_reviews enable row level security;
revoke all on public.pythh_fundraising_evidence_reviews from anon, authenticated;
revoke all on sequence public.pythh_fundraising_evidence_reviews_id_seq from anon, authenticated;

commit;
