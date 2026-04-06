import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-3 border-b border-zinc-800 pb-2">{title}</h2>
      <div className="space-y-3 text-zinc-400 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src="/logo.png" alt="RedForge" className="w-7 h-7 object-contain" />
              <span className="font-bold text-white text-sm">RedForge</span>
            </div>
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400 text-sm">Privacy Policy</span>
          <Link href="/" className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-zinc-500 text-sm">Last updated: April 3, 2026 · We take your privacy seriously.</p>
        </div>

        <div className="prose-sm max-w-none">
          <Section title="1. Information We Collect">
            <p>We collect information you provide directly when you create an account, use our Service, or contact us:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-2">
              <li><strong className="text-zinc-300">Account data:</strong> Name, email address, password (hashed), workspace name</li>
              <li><strong className="text-zinc-300">Billing data:</strong> Payment information processed by Stripe (we do not store card numbers)</li>
              <li><strong className="text-zinc-300">Scan data:</strong> Target URLs, scan configurations, and results from security tests you initiate</li>
              <li><strong className="text-zinc-300">Usage data:</strong> Feature usage, session data, API key activity</li>
              <li><strong className="text-zinc-300">Technical data:</strong> IP address, browser type, device info, access logs</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use collected information to:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-2">
              <li>Provide, maintain, and improve the RedForge Service</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send transactional emails (welcome, trial expiry, billing receipts)</li>
              <li>Respond to support requests and communications</li>
              <li>Monitor for security incidents and prevent fraud</li>
              <li>Comply with legal obligations</li>
              <li>Improve our AI models using anonymized, aggregated data only</li>
            </ul>
            <p>We do not sell your personal data to third parties. We do not use your scan findings data to train AI models without your explicit consent.</p>
          </Section>

          <Section title="3. Data Sharing & Third Parties">
            <p>We may share your data with trusted service providers who assist in operating our Service:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-2">
              <li><strong className="text-zinc-300">Stripe</strong> — payment processing</li>
              <li><strong className="text-zinc-300">NVIDIA NIM / AI Providers</strong> — AI vulnerability analysis (scan data only, anonymized where possible)</li>
              <li><strong className="text-zinc-300">Resend</strong> — transactional email delivery</li>
              <li><strong className="text-zinc-300">Infrastructure providers</strong> — cloud hosting and database services</li>
            </ul>
            <p>All third-party providers are contractually bound to protect your data and may only use it to provide services to RedForge.</p>
          </Section>

          <Section title="4. Data Security">
            <p>We implement industry-standard security measures to protect your data:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-2">
              <li>All data in transit is encrypted using TLS 1.3</li>
              <li>Passwords are hashed using bcrypt with a cost factor of 12</li>
              <li>Database data is encrypted at rest</li>
              <li>Access to production systems is restricted and logged</li>
              <li>Regular security audits are conducted</li>
            </ul>
            <p>Despite these measures, no method of transmission or storage is 100% secure. You use the Service at your own risk.</p>
          </Section>

          <Section title="5. Data Retention">
            <p>We retain your data for as long as your account is active or as needed to provide the Service. Upon account deletion, we will delete or anonymize your personal data within 30 days, except where retention is required by law.</p>
            <p>Scan logs and findings are retained for 90 days after account deletion unless you request earlier deletion.</p>
          </Section>

          <Section title="6. Your Rights (GDPR / CCPA)">
            <p>Depending on your location, you may have the following rights regarding your personal data:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-2">
              <li><strong className="text-zinc-300">Access:</strong> Request a copy of your personal data</li>
              <li><strong className="text-zinc-300">Rectification:</strong> Correct inaccurate personal data</li>
              <li><strong className="text-zinc-300">Erasure:</strong> Request deletion of your personal data</li>
              <li><strong className="text-zinc-300">Portability:</strong> Receive your data in a machine-readable format</li>
              <li><strong className="text-zinc-300">Objection:</strong> Object to certain processing activities</li>
              <li><strong className="text-zinc-300">Opt-out:</strong> California residents may opt out of sale of personal information (we do not sell data)</li>
            </ul>
            <p>To exercise these rights, email us at <a href="mailto:privacy@redforge.io" className="text-red-400 hover:underline">privacy@redforge.io</a>. We will respond within 30 days.</p>
          </Section>

          <Section title="7. Cookies">
            <p>We use essential cookies for session management (authentication). We do not use advertising or tracking cookies. You can control cookies through your browser settings, but disabling session cookies will prevent you from using the Service.</p>
          </Section>

          <Section title="8. Children's Privacy">
            <p>The Service is not directed to individuals under 16 years of age. We do not knowingly collect personal information from children. If you become aware that a child has provided us with personal information, please contact us.</p>
          </Section>

          <Section title="9. International Transfers">
            <p>Your data may be transferred to and processed in the United States or other countries where our service providers operate. Where required, we implement Standard Contractual Clauses or other appropriate safeguards for international data transfers.</p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by email or by displaying a prominent notice in the application. Your continued use of the Service after changes are posted constitutes your acceptance.</p>
          </Section>

          <Section title="11. Contact Us">
            <p>For privacy questions or to exercise your rights, contact our Privacy team:</p>
            <p className="font-mono text-xs bg-zinc-900 p-3 rounded-md text-zinc-300">
              RedForge, Inc.<br />
              Privacy Officer<br />
              <a href="mailto:privacy@redforge.io" className="text-red-400">privacy@redforge.io</a>
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
