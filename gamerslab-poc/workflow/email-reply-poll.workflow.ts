/**
 * GamersLab Reply Poll — n8n Workflow SDK source.
 *
 * Live in n8n: id LAPjN0jbvV9GAetX (schedule: every 15 min).
 *
 * Detects replies to sent outreach. Asks the email-access-token broker for a Gmail access
 * token, selects `message` rows that are 'sent' with a thread id and no reply yet, reads
 * each Gmail thread, and when a message From someone other than the connected inbox
 * appears, dual-writes replied_at + status='replied' to BOTH the `message` row and the
 * `publishers` row (the board reads publishers; rings the UI bell). Bound to the message
 * entity per how/pipeline_messaging_ab_sequencing_DRAFT.md §4.
 *
 * Credential the n8n instance needs: a Header Auth credential "GamersLab API Bearer"
 * (Name: Authorization, Value: Bearer <API_BEARER>) bound to the Get Access Token node.
 */

import { workflow, node, trigger, newCredential, expr, splitInBatches, nextBatch, ifElse } from '@n8n/workflow-sdk';

const schedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every 15 min',
    parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 15 }] } },
  },
});

const getToken = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Access Token',
    parameters: {
      method: 'POST',
      url: 'https://ccmwksmgoisijvyovgko.supabase.co/functions/v1/email-access-token',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
    },
    credentials: { httpHeaderAuth: newCredential('GamersLab API Bearer') },
  },
});

const awaiting = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Awaiting Reply',
    parameters: {
      resource: 'database',
      operation: 'executeQuery',
      query: "SELECT id, publisher_id, thread_id AS outreach_thread_id FROM public.message WHERE status='sent' AND thread_id IS NOT NULL AND replied_at IS NULL LIMIT 50",
    },
    credentials: { postgres: newCredential('Postgres account GamersLab Lead Gen') },
  },
});

const loop = splitInBatches({ version: 3, config: { name: 'Reply Loop', parameters: { batchSize: 1 } } });
const done = node({ type: 'n8n-nodes-base.noOp', version: 1, config: { name: 'Done', parameters: {} } });

const getThread = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Thread',
    parameters: {
      method: 'GET',
      url: expr('https://gmail.googleapis.com/gmail/v1/users/me/threads/{{ $json.outreach_thread_id }}?format=metadata&metadataHeaders=From'),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'Authorization', value: expr('Bearer {{ $("Get Access Token").first().json.access_token }}') }] },
    },
  },
});

const detectReply = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Detect Reply',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: "const me = ($('Get Access Token').first().json.from_email || '').toLowerCase();\nconst msgs = $json.messages || [];\nlet replied = false;\nfor (const m of msgs) {\n  const headers = (m.payload && m.payload.headers) || [];\n  const fromH = headers.find(h => (h.name || '').toLowerCase() === 'from');\n  const fromVal = fromH ? (fromH.value || '').toLowerCase() : '';\n  if (fromVal && me && fromVal.indexOf(me) === -1) { replied = true; break; }\n}\nconst id = $('Reply Loop').item.json.id;\nconst publisher_id = $('Reply Loop').item.json.publisher_id;\nreturn { id, publisher_id, replied };",
    },
  },
});

const ifReplied = ifElse({
  version: 2.2,
  config: {
    name: 'Replied?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.replied }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: '' }],
        combinator: 'and',
      },
    },
  },
});

// Primary: stamp the message row.
const markReplied = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Mark Replied',
    parameters: {
      resource: 'database',
      operation: 'executeQuery',
      query: "UPDATE public.message SET status='replied', replied_at=NOW() WHERE id=$1",
      options: { queryReplacement: expr('{{ $json.id }}') },
    },
    credentials: { postgres: newCredential('Postgres account GamersLab Lead Gen') },
  },
});

// Dual-write: mirror to publishers so the board's Replied column populates.
const markPublisherReplied = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Mark Publisher Replied',
    parameters: {
      resource: 'database',
      operation: 'executeQuery',
      query: "UPDATE public.publishers SET pipeline_status='replied', replied_at=NOW() WHERE id=$1",
      options: { queryReplacement: expr('{{ $json.publisher_id }}') },
    },
    credentials: { postgres: newCredential('Postgres account GamersLab Lead Gen') },
  },
});

export default workflow('gamerslab-reply-poll', 'GamersLab Reply Poll')
  .add(schedule)
  .to(getToken)
  .to(awaiting)
  .to(loop
    .onDone(done)
    .onEachBatch(getThread.to(detectReply.to(ifReplied
      .onTrue(markReplied.to(markPublisherReplied.to(nextBatch(loop))))
      .onFalse(nextBatch(loop))))));
