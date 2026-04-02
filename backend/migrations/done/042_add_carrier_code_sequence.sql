-- Migration 042: Add carrier_code_seq sequence for carrier code generation
BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.carrier_code_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Ensure the sequence is owned by the carriers table
ALTER SEQUENCE public.carrier_code_seq OWNED BY public.carriers.id;

COMMIT;
