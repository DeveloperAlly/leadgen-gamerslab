/**
 * GamersLab Outreach Send — n8n Workflow SDK source.
 *
 * Live in n8n: id YEgPZ0eATTSAb9pa · webhook https://n8n-j39n.sliplane.app/webhook/gamerslab-send
 * (set that URL as the N8N_SEND_WEBHOOK_URL Edge Function secret, then re-deploy `outreach`).
 *
 * Fired by POST /outreach/:id/approve ({ publisher_id }). Resolves the step-1 `message`
 * row for that publisher, asks the email-access-token broker for a Gmail access token (so
 * n8n never touches the refresh token or crypto key), sends as the connected inbox, and
 * dual-writes sent_at + thread/message id to BOTH the `message` row and the `publishers`
 * row (the board still reads publishers during the dual-write window). Bound to the
 * message entity per how/pipeline_messaging_ab_sequencing_DRAFT.md §4. When approve is
 * switched to fire { message_id } (A/B), key Get Draft on m.id instead of m.publisher_id.
 *
 * Credential the n8n instance needs: a Header Auth credential "GamersLab API Bearer"
 * (Name: Authorization, Value: Bearer <API_BEARER>) bound to the Get Access Token node.
 */

import { workflow, node, trigger, newCredential, expr } from '@n8n/workflow-sdk';

const sendWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Send Webhook',
    parameters: {
      httpMethod: 'POST',
      path: 'gamerslab-send',
      responseMode: 'onReceived',
      options: { responseCode: { values: { responseCode: 200 } } },
    },
  },
});

const getDraft = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Get Draft',
    parameters: {
      resource: 'database',
      operation: 'executeQuery',
      query: "SELECT m.id AS message_id, COALESCE(m.subject, '') AS subj, COALESCE(m.body, '') AS body_text, p.contact_email FROM public.message m JOIN public.publishers p ON p.id = m.publisher_id WHERE m.publisher_id = $1 AND m.step = 1 ORDER BY (m.variant = 'A') DESC, m.created_at ASC LIMIT 1",
      options: { queryReplacement: expr('{{ $json.body.publisher_id }}') },
    },
    credentials: { postgres: newCredential('Postgres account GamersLab Lead Gen') },
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

const buildRaw = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Raw',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: "const from = $('Get Access Token').first().json.from_email;\nconst to = $('Get Draft').first().json.contact_email;\nconst subject = $('Get Draft').first().json.subj || 'Hello';\nconst body = $('Get Draft').first().json.body_text || '';\nconst subjEnc = /[^\\x00-\\x7F]/.test(subject) ? '=?UTF-8?B?' + Buffer.from(subject, 'utf8').toString('base64') + '?=' : subject;\nconst mime = `From: ${from}\\r\\nTo: ${to}\\r\\nSubject: ${subjEnc}\\r\\nMIME-Version: 1.0\\r\\nContent-Type: text/plain; charset=UTF-8\\r\\nContent-Transfer-Encoding: 8bit\\r\\n\\r\\n${body}`;\nconst raw = Buffer.from(mime, 'utf8').toString('base64').replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');\nreturn { raw, to };",
    },
  },
});

const gmailSend = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Gmail Send',
    parameters: {
      method: 'POST',
      url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'Authorization', value: expr('Bearer {{ $("Get Access Token").first().json.access_token }}') }] },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'keypair',
      bodyParameters: { parameters: [{ name: 'raw', value: expr('{{ $json.raw }}') }] },
    },
  },
});

// Dual-write: mirror to publishers so the board (which reads publishers) keeps working.
const markSent = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Mark Sent',
    parameters: {
      resource: 'database',
      operation: 'executeQuery',
      query: "UPDATE publishers SET pipeline_status='sent', sent_at=NOW(), outreach_thread_id=$1, outreach_message_id=$2 WHERE id=$3",
      options: { queryReplacement: expr('{{ $(\'Gmail Send\').first().json.threadId }},{{ $(\'Gmail Send\').first().json.id }},{{ $(\'Send Webhook\').first().json.body.publisher_id }}') },
    },
    credentials: { postgres: newCredential('Postgres account GamersLab Lead Gen') },
  },
});

// Primary: stamp the message row that was actually sent.
const markMessageSent = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Mark Message Sent',
    parameters: {
      resource: 'database',
      operation: 'executeQuery',
      query: "UPDATE public.message SET status='sent', sent_at=NOW(), thread_id=$1, message_id=$2 WHERE id=$3",
      options: { queryReplacement: expr('{{ $(\'Gmail Send\').first().json.threadId }},{{ $(\'Gmail Send\').first().json.id }},{{ $(\'Get Draft\').first().json.message_id }}') },
    },
    credentials: { postgres: newCredential('Postgres account GamersLab Lead Gen') },
  },
});

export default workflow('gamerslab-send', 'GamersLab Outreach Send')
  .add(sendWebhook)
  .to(getDraft)
  .to(getToken)
  .to(buildRaw)
  .to(gmailSend)
  .to(markSent)
  .to(markMessageSent);
