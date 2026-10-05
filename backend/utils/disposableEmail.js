// Throwaway-inbox domains: stop people restarting the free trial with an address they'll never read.
// Not exhaustive — the email confirmation is the real guard; this just removes the obvious ones.
const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com',
  '10minutemail.com', '10minutemail.net', 'temp-mail.org', 'tempmail.com', 'tempmail.net', 'tempmailo.com',
  'yopmail.com', 'yopmail.net', 'trashmail.com', 'throwawaymail.com', 'getnada.com', 'nada.email',
  'dispostable.com', 'maildrop.cc', 'fakeinbox.com', 'mintemail.com', 'mohmal.com', 'emailondeck.com',
  'moakt.com', 'spambox.us', 'mailnesia.com', 'mytemp.email', 'burnermail.io', 'discard.email',
  'inboxkitten.com', 'tempinbox.com', 'mail.tm', 'tmpmail.org', 'tmpmail.net', 'fakemail.net',
]);

function isDisposableEmail(email) {
  const at = String(email || '').lastIndexOf('@');
  if (at === -1) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return DISPOSABLE.has(domain);
}

module.exports = { isDisposableEmail };
