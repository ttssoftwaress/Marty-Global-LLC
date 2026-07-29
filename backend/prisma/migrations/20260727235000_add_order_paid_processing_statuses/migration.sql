-- Two new stages between APPROVED and COMPLETED. Added in pipeline order with
-- BEFORE 'COMPLETED' so the enum's own ordering matches the flow staff work in,
-- rather than appending them after the terminal state.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PAID' BEFORE 'COMPLETED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PROCESSING' BEFORE 'COMPLETED';
