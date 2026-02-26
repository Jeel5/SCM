-- Migration 010: Sequence-based order and shipment number generation
-- Replaces Math.random() and Date.now() race conditions with atomic sequences

-- Regular order number sequence (ORD-YYYYMMDD-{seq} suffix)
CREATE SEQUENCE IF NOT EXISTS order_number_seq
  START WITH 10000
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- Transfer order number sequence (TRF-{seq})
CREATE SEQUENCE IF NOT EXISTS transfer_order_number_seq
  START WITH 10000
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- Transfer shipment number sequence (SHP-TRF-{seq})
CREATE SEQUENCE IF NOT EXISTS transfer_shipment_number_seq
  START WITH 10000
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;
