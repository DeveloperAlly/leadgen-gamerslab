/**
 * GamersLab Outreach Send — n8n Workflow SDK source.
 *
 * Live in n8n: id YEgPZ0eATTSAb9pa · webhook https://n8n-j39n.sliplane.app/webhook/gamerslab-send
 * (set that URL as the N8N_SEND_WEBHOOK_URL Edge Function secret, then re-deploy `outreach`).
 *
 * Fired by POST /outreach/:id/approve. Fetches the approved draft, asks the
 * email-access-token broker for a Gmail access token (so n8n never touches the refresh
 * token or crypto key), sends as the connected inbox, and stamps sent_at + the Gmail
 * thread/message id on the publisher row. Design: how/email_send_pipeline_DRAFT.md §6a.
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
      query: 'SELECT COALESCE(approved_subject, draft_subject) AS subj, COALESCE(approved_body, draft_body) AS body_text, contact_email FROM publishers WHERE id = $1',
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

export default workflow('gamerslab-send', 'GamersLab Outreach Send')
  .add(sendWebhook)
  .to(getDraft)
  .to(getToken)
  .to(buildRaw)
  .to(gmailSend)
  .to(markSent);
