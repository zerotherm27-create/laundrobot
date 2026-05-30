import { useEffect } from 'react';

const UPDATED = 'May 30, 2026';

export default function DataDeletion() {
  useEffect(() => { document.title = 'Data Deletion Policy — LaundroBot'; }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid #EBEBEB', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/logo.png" alt="LaundroBot" style={{ width: 30, height: 30, borderRadius: 7, objectFit: 'contain' }} />
          <span style={{ fontWeight: 800, fontSize: 16, color: '#0D1117' }}>LaundroBot</span>
        </a>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0D1117', marginBottom: 6 }}>Data Deletion Policy</h1>
        <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 40 }}>Last updated: {UPDATED}</p>

        <Section title="1. Overview">
          <p>LaundroBot is a product of <strong>Rinselab Inc.</strong>, a Philippine company engaged in laundry services, parcel delivery, and software-as-a-service (SaaS) products. We respect your right to have your personal data deleted from our systems. This policy explains how you can request data deletion, what data we delete, what we are required to retain, and the timeline for processing your request.</p>
          <p>This policy applies to all users of the LaundroBot platform, including laundry shop owners (Tenants) and their end customers, in compliance with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>.</p>
        </Section>

        <Section title="2. What You Can Request for Deletion">
          <p><strong>As a Tenant (shop owner account):</strong></p>
          <ul>
            <li>Your personal profile information (name, email)</li>
            <li>Your business configuration (shop name, services, delivery zones)</li>
            <li>Your connected integrations (Facebook Page token, Xendit API keys)</li>
            <li>Historical order and customer records associated with your account</li>
            <li>Staff accounts created under your tenant</li>
          </ul>
          <p><strong>As an end customer of a laundry shop using LaundroBot:</strong></p>
          <ul>
            <li>Your name, contact number, and delivery address stored in the shop's customer records</li>
            <li>Your booking history for that shop</li>
            <li>Your Facebook profile data (name, PSID) collected via Messenger integration</li>
          </ul>
        </Section>

        <Section title="3. How to Submit a Deletion Request">
          <p>You may submit a data deletion request through any of the following methods:</p>
          <ol>
            <li><strong>Email:</strong> Send a request to <a href="mailto:privacy@laundrobot.com" style={{ color: '#38a9c2' }}>privacy@laundrobot.com</a> with the subject line "Data Deletion Request." Include your name, email address, and a description of the data you want deleted.</li>
            <li><strong>In-app (Tenants):</strong> Go to <strong>Settings → Account → Delete Account</strong>. This initiates an automatic deletion of your tenant account and all associated data.</li>
            <li><strong>Facebook / Meta:</strong> If you connected to LaundroBot through Facebook Messenger, you may also request deletion via the Facebook Data Deletion Callback at the URL below:
              <br /><code style={{ display: 'inline-block', marginTop: 8, background: '#F8F8F6', padding: '4px 10px', borderRadius: 6, fontSize: 13, color: '#0D1117' }}>https://laundrobot.app/data-deletion</code>
              <br /><span style={{ fontSize: 13, color: '#6B7280' }}>This endpoint serves as the Meta-required Data Deletion Request URL registered with our Facebook App.</span>
            </li>
          </ol>
        </Section>

        <Section title="4. What We Delete and What We Retain">
          <p>Upon receiving a valid deletion request, we will delete or anonymize the following:</p>
          <ul>
            <li>Personal identifiers (name, email, phone number, Facebook PSID)</li>
            <li>Delivery addresses</li>
            <li>Business credentials and API keys</li>
            <li>Chat logs and AI conversation history</li>
          </ul>
          <p>We are required by Philippine law to retain the following for a minimum of <strong>3 years</strong>, even after a deletion request:</p>
          <ul>
            <li>Transaction records (order amounts, payment status) for tax and accounting purposes — these records will be anonymized (customer identifiers removed)</li>
            <li>Any data required by a legal hold or regulatory investigation</li>
          </ul>
        </Section>

        <Section title="5. Timeline">
          <p>We will process deletion requests within <strong>15 business days</strong> of verification. We may contact you to verify your identity before processing the request. We will send a confirmation email once deletion is complete.</p>
        </Section>

        <Section title="6. Meta / Facebook Data Deletion Callback">
          <p>If you used our service through a Facebook Messenger integration, Meta (Facebook) may send a signed data deletion request on your behalf when you remove the app from your Facebook account. Our platform honors these callbacks automatically.</p>
          <p>When a callback is received:</p>
          <ul>
            <li>We delete the Facebook User ID (PSID) and display name from our records</li>
            <li>We anonymize associated order records while retaining aggregate transaction data</li>
            <li>You will receive a confirmation URL you can use to verify the deletion was processed</li>
          </ul>
          <p>Meta-required deletion request URL: <code style={{ background: '#F8F8F6', padding: '2px 8px', borderRadius: 4, fontSize: 13 }}>https://laundrobot.app/api/facebook/data-deletion</code></p>
        </Section>

        <Section title="7. Contact Us">
          <p>For data deletion requests or questions about this policy, contact:</p>
          <p>
            <strong>Rinselab Inc.</strong><br />
            Operating LaundroBot<br />
            Philippines<br />
            Email: <a href="mailto:privacy@laundrobot.com" style={{ color: '#38a9c2' }}>privacy@laundrobot.com</a>
          </p>
          <p>You may also file a complaint with the <strong>National Privacy Commission</strong> at <a href="https://www.privacy.gov.ph" target="_blank" rel="noopener noreferrer" style={{ color: '#38a9c2' }}>www.privacy.gov.ph</a>.</p>
        </Section>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #EBEBEB', display: 'flex', gap: 24 }}>
          <a href="/" style={{ color: '#38a9c2', textDecoration: 'none', fontSize: 14 }}>← Back to home</a>
          <a href="/privacy" style={{ color: '#38a9c2', textDecoration: 'none', fontSize: 14 }}>Privacy Policy</a>
          <a href="/terms" style={{ color: '#38a9c2', textDecoration: 'none', fontSize: 14 }}>Terms of Service</a>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0D1117', marginBottom: 12 }}>{title}</h2>
      <div style={{ color: '#374151', fontSize: 15, lineHeight: 1.7 }}>
        {children}
      </div>
    </section>
  );
}
