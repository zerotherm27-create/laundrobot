import { useEffect } from 'react';

const UPDATED = 'April 28, 2026';

export default function PrivacyPolicy() {
  useEffect(() => { document.title = 'Privacy Policy — LaundroBot'; }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      {/* Nav */}
      <header style={{ borderBottom: '1px solid #EBEBEB', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/logo.png" alt="LaundroBot" style={{ width: 30, height: 30, borderRadius: 7, objectFit: 'contain' }} />
          <span style={{ fontWeight: 800, fontSize: 16, color: '#0D1117' }}>LaundroBot</span>
        </a>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0D1117', marginBottom: 6 }}>Privacy Policy</h1>
        <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 40 }}>Last updated: {UPDATED}</p>

        <Section title="1. Overview">
          <p>LaundroBot ("we", "our", "us") operates a Software-as-a-Service (SaaS) platform that helps laundry businesses in the Philippines manage orders, communicate with customers via Facebook Messenger and Instagram, and accept payments online.</p>
          <p>This Privacy Policy explains how we collect, use, store, and protect personal information in compliance with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong> and the regulations of the National Privacy Commission (NPC) of the Philippines.</p>
        </Section>

        <Section title="2. Information We Collect">
          <p><strong>From laundry shop owners (Tenants):</strong></p>
          <ul>
            <li>Name and business name</li>
            <li>Email address and password (hashed)</li>
            <li>Facebook Page access token (for Messenger integration)</li>
            <li>Xendit API keys (for payment processing — stored encrypted)</li>
            <li>Business address and delivery zones</li>
          </ul>
          <p><strong>From end customers (via Tenants' booking forms and Messenger):</strong></p>
          <ul>
            <li>Full name and contact number</li>
            <li>Delivery address</li>
            <li>Order details (items, quantities, special notes)</li>
            <li>Payment status (not card numbers — payments are processed directly by Xendit)</li>
            <li>Facebook User ID and display name (when booking through Messenger)</li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Information">
          <ul>
            <li>To provide and operate the LaundroBot platform</li>
            <li>To send order notifications and updates via Facebook Messenger, SMS, or email</li>
            <li>To generate payment links and invoices through Xendit</li>
            <li>To power the AI chatbot that responds to customer inquiries (queries are processed by Google Gemini)</li>
            <li>To troubleshoot issues and improve the platform</li>
          </ul>
          <p>We do not sell or rent your personal information to third parties.</p>
        </Section>

        <Section title="4. Third-Party Services">
          <p>LaundroBot uses the following third-party processors that may handle personal data:</p>
          <ul>
            <li><strong>Meta (Facebook/Instagram)</strong> — Messenger platform for customer communication</li>
            <li><strong>Google (Gemini API)</strong> — AI responses to customer queries; messages may be processed on Google servers</li>
            <li><strong>Xendit</strong> — Payment processing; customer payment data is subject to Xendit's Privacy Policy</li>
            <li><strong>Resend</strong> — Transactional email delivery</li>
            <li><strong>Railway / Supabase</strong> — Cloud hosting and database (servers located outside the Philippines)</li>
            <li><strong>Vercel</strong> — Frontend hosting</li>
          </ul>
        </Section>

        <Section title="5. Data Retention">
          <p>Order records are retained for a minimum of 3 years for business record-keeping purposes. Customer data is retained as long as your account is active. You may request deletion of your data by contacting us at the address below.</p>
          <p>Tenant accounts that are closed will have their data anonymized or deleted within 30 days of account termination, except where retention is required by law.</p>
        </Section>

        <Section title="6. Data Security">
          <p>We implement industry-standard security measures including:</p>
          <ul>
            <li>HTTPS encryption for all data in transit</li>
            <li>Bcrypt hashing for passwords</li>
            <li>Encryption of sensitive credentials (API keys, page tokens)</li>
            <li>Role-based access controls</li>
          </ul>
          <p>No system is 100% secure. In the event of a data breach, we will notify affected parties and the NPC as required by law.</p>
        </Section>

        <Section title="7. Your Rights">
          <p>Under the Data Privacy Act of 2012, you have the right to:</p>
          <ul>
            <li><strong>Access</strong> — request a copy of your personal data we hold</li>
            <li><strong>Rectification</strong> — correct inaccurate data</li>
            <li><strong>Erasure</strong> — request deletion of your data (subject to legal retention requirements)</li>
            <li><strong>Object</strong> — object to processing of your data for direct marketing</li>
            <li><strong>Data Portability</strong> — receive your data in a machine-readable format</li>
          </ul>
          <p>To exercise these rights, contact us at the address below. We will respond within 15 business days.</p>
        </Section>

        <Section title="8. Cookies">
          <p>The LaundroBot web application uses browser localStorage to maintain your login session. We do not use third-party tracking cookies or advertising pixels.</p>
        </Section>

        <Section title="9. Children's Privacy">
          <p>LaundroBot is not directed to persons under 18 years of age. We do not knowingly collect personal information from minors.</p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>We may update this Privacy Policy from time to time. We will notify active Tenants of material changes via email. Continued use of the platform after changes constitutes acceptance of the updated policy.</p>
        </Section>

        <Section title="11. Contact Us">
          <p>For privacy concerns, data requests, or complaints, contact:</p>
          <p>
            <strong>LaundroBot</strong><br />
            Philippines<br />
            Email: <a href="mailto:privacy@laundrobot.com" style={{ color: '#38a9c2' }}>privacy@laundrobot.com</a>
          </p>
          <p>You may also file a complaint with the <strong>National Privacy Commission</strong> at <a href="https://www.privacy.gov.ph" target="_blank" rel="noopener noreferrer" style={{ color: '#38a9c2' }}>www.privacy.gov.ph</a>.</p>
        </Section>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #EBEBEB' }}>
          <a href="/" style={{ color: '#38a9c2', textDecoration: 'none', fontSize: 14 }}>← Back to home</a>
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
