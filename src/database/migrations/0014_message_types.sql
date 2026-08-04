-- Two new message categories for richer in-chat communication:
-- 'quotation' (a proposed price/scope, distinct from the formal proposal
-- system) and 'milestone_update' (auto-posted when a milestone changes
-- state). Same ALTER TYPE-in-its-own-transaction reasoning as migration
-- 0013 — safe since nothing uses these values until after this commits.
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'quotation';
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'milestone_update';
