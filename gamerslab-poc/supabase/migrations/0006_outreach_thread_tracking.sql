-- Reply tracking — store the Gmail thread + message id of a sent outreach so the n8n
-- Reply-poll workflow can detect when the publisher replies (a message in the thread
-- whose From is not our own address). Design: how/email_send_pipeline_DRAFT.md §6b.

ALTER TABLE public.publishers ADD COLUMN IF NOT EXISTS outreach_thread_id  TEXT; -- Gmail threadId of the sent message
ALTER TABLE public.publishers ADD COLUMN IF NOT EXISTS outreach_message_id TEXT; -- Gmail message id of the sent message

-- Reply-poll selects on this: sent, has a thread, not yet replied.
CREATE INDEX IF NOT EXISTS idx_publishers_awaiting_reply
  ON public.publishers (pipeline_status)
  WHERE pipeline_status = 'sent' AND replied_at IS NULL;
