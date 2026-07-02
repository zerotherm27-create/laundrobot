const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// ── Regression: IG sends must target the PAGE messages endpoint ──────────────
// LaundroBot uses the "Instagram API with Facebook login" flavor: the page
// access token sends IG DMs via POST graph.facebook.com/{PAGE_ID}/messages
// (recipient = IGSID). Posting to /{IG_USER_ID}/messages with a page token
// returns "(#3) Application does not have the capability to make this API
// call" — that endpoint shape belongs to the Instagram-login API
// (graph.instagram.com + IG user token), which this app does not use.
// This bug made every IG bot reply fail and was misdiagnosed for weeks as
// "blocked by App Review". Proven 2026-07-02 by probing both endpoints with
// the live page token: ig-user endpoint → #3, page endpoint → #100
// (recipient-level error only, endpoint + permission fine).

const igSrc = fs.readFileSync(path.join(__dirname, 'instagram.js'), 'utf8');
const webhookSrc = fs.readFileSync(path.join(__dirname, '..', 'webhooks', 'messenger.js'), 'utf8');

test('instagram.js builds the send URL from the page id, never the IG user id', () => {
  assert.match(igSrc, /graph\.facebook\.com\/v\d+\.\d+\/\$\{pageId\}\/messages/, 'URL must be /{pageId}/messages');
  assert.doesNotMatch(igSrc, /\$\{igUserId\}\/messages/, 'must not post to /{igUserId}/messages (fails with error #3)');
});

test('the webhook passes fb_page_id (not ig_user_id) to the instagram senders', () => {
  const igSendsBlock = webhookSrc.split("channel === 'instagram'")[0] + webhookSrc.split("channel === 'instagram'")[1].split('return {')[1];
  assert.match(webhookSrc, /makeSends\(channel, token, tenant\.fb_page_id\)/, 'instagram makeSends must receive tenant.fb_page_id');
  assert.doesNotMatch(webhookSrc, /makeSends\(channel, token, tenant\.ig_user_id\)/, 'ig_user_id must not be used for the send endpoint');
});
