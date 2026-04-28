import { useEffect } from 'react';

const UPDATED = 'April 28, 2026';

export default function TermsOfService() {
  useEffect(() => { document.title = 'Terms of Service — LaundroBot'; }, []);

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
        <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0D1117', marginBottom: 6 }}>Terms of Service</h1>
        <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 40 }}>Last updated: {UPDATED}</p>

        <Section title="1. Acceptance of Terms">
          <p>By registering for or using LaundroBot ("the Service"), you ("Tenant" or "you") agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
          <p>LaundroBot is operated in the Philippines and these Terms are governed by Philippine law.</p>
        </Section>

        <Section title="2. Description of Service">
          <p>LaundroBot provides a multi-tenant SaaS platform for laundry businesses, including:</p>
          <ul>
            <li>Order management and tracking</li>
            <li>Customer booking via web form and Facebook Messenger / Instagram DM</li>
            <li>AI-powered chatbot for customer inquiries</li>
            <li>Online payment collection via Xendit</li>
            <li>Automated customer notifications</li>
          </ul>
          <p>The Service is provided "as is" and features may change over time. We will give reasonable notice of material changes.</p>
        </Section>

        <Section title="3. Subscription and Payment">
          <p>LaundroBot is offered on monthly or annual subscription plans. Pricing is displayed on the pricing page and may change with 30 days' written notice to active subscribers.</p>
          <ul>
            <li>Subscriptions renew automatically unless cancelled before the renewal date</li>
            <li>Fees are billed in Philippine Pesos (₱)</li>
            <li>We do not offer refunds for partial billing periods</li>
            <li>Non-payment may result in suspension or termination of access</li>
          </ul>
        </Section>

        <Section title="4. Tenant Responsibilities">
          <p>As a Tenant, you are responsible for:</p>
          <ul>
            <li>Maintaining the confidentiality of your account credentials</li>
            <li>Complying with Meta's Platform Policies when using the Messenger / Instagram integration</li>
            <li>Complying with the Data Privacy Act of 2012 (RA 10173) as a personal information controller for your customers' data</li>
            <li>Ensuring your Xendit account is properly configured and compliant with Xendit's merchant terms</li>
            <li>Providing accurate information to your customers</li>
            <li>Not using the Service for any unlawful purpose</li>
          </ul>
        </Section>

        <Section title="5. Prohibited Uses">
          <p>You may not use LaundroBot to:</p>
          <ul>
            <li>Send spam or unsolicited bulk messages</li>
            <li>Harass, threaten, or deceive customers</li>
            <li>Violate any applicable Philippine law or regulation</li>
            <li>Attempt to reverse-engineer, copy, or resell the platform</li>
            <li>Share your account credentials with unauthorized parties</li>
          </ul>
          <p>We reserve the right to suspend accounts that violate these prohibitions without refund.</p>
        </Section>

        <Section title="6. Data and Privacy">
          <p>Your use of the Service is also governed by our <a href="/privacy" style={{ color: '#38a9c2' }}>Privacy Policy</a>. As a Tenant, you act as the data controller for your customers' personal information. You are responsible for obtaining appropriate consent from your customers for data collection and processing.</p>
        </Section>

        <Section title="7. Uptime and Support">
          <p>We aim for high availability but do not guarantee 100% uptime. Planned maintenance will be communicated in advance where possible. We are not liable for losses resulting from service downtime, including missed orders or delayed payments.</p>
          <p>Support is provided via email and messaging channels during Philippine business hours.</p>
        </Section>

        <Section title="8. Third-Party Integrations">
          <p>The Service integrates with third-party platforms including Meta (Facebook/Instagram), Xendit, Google (Gemini), and Resend. We are not responsible for outages, policy changes, or decisions made by these third parties that affect your use of the Service. In particular:</p>
          <ul>
            <li>Meta may reject or revoke your app's permissions at any time</li>
            <li>Xendit may suspend your payment processing for compliance reasons</li>
            <li>AI responses from Google Gemini are automated and may occasionally be inaccurate</li>
          </ul>
        </Section>

        <Section title="9. Limitation of Liability">
          <p>To the maximum extent permitted by law, LaundroBot's total liability to you for any claim arising from use of the Service is limited to the amount you paid us in the 3 months preceding the claim.</p>
          <p>We are not liable for indirect, incidental, or consequential damages, including lost revenue or customer disputes.</p>
        </Section>

        <Section title="10. Intellectual Property">
          <p>LaundroBot retains all intellectual property rights in the platform, including its software, design, and branding. You retain ownership of your business data (orders, customer records, services). We do not claim ownership of your data.</p>
        </Section>

        <Section title="11. Termination">
          <p>You may cancel your subscription at any time from your account settings. We may terminate your account for violation of these Terms. Upon termination, you may request an export of your data within 30 days.</p>
        </Section>

        <Section title="12. Changes to These Terms">
          <p>We may update these Terms from time to time. Material changes will be notified via email at least 14 days in advance. Continued use after the effective date constitutes acceptance.</p>
        </Section>

        <Section title="13. Governing Law">
          <p>These Terms are governed by the laws of the Republic of the Philippines. Any disputes shall be resolved in the appropriate courts of the Philippines.</p>
        </Section>

        <Section title="14. Contact">
          <p>
            <strong>LaundroBot</strong><br />
            Philippines<br />
            Email: <a href="mailto:hello@laundrobot.com" style={{ color: '#38a9c2' }}>hello@laundrobot.com</a>
          </p>
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
