-- Ensure organization code sequence exists and is aligned with existing org codes.

CREATE SEQUENCE IF NOT EXISTS public.org_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

SELECT setval(
  'public.org_code_seq',
  GREATEST(
    (SELECT COALESCE(MAX((regexp_match(code, '^ORG-[0-9]{2}-([0-9]+)$'))[1]::int), 0) FROM public.organizations),
    (SELECT COALESCE(last_value, 0) FROM public.org_code_seq)
  ),
  true
);
