import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-3 border-b border-zinc-800 pb-2">{title}</h2>
      <div className="space-y-3 text-zinc-400 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src="/logo.png" alt="RedForge" className="w-7 h-7 object-contain" />
              <span className="font-bold text-white text-sm">RedForge</span>
            </div>
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400 text-sm">Terms of Service</span>
          <Link href="/" className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
          <p className="text-zinc-500 text-sm">Last updated: April 3, 2026 · Effective immediately</p>
        </div>

        <div className="prose-sm max-w-none">
          <Section title="1. Acceptance of Terms">
            <p>By accessing or using RedForge ("Service"), operated by RedForge, Inc. ("Company", "we", "us"), you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree, you must not use this Service.</p>
            <p>We reserve the right to modify these Terms at any time. Continued use of the Service after modifications constitutes acceptance of the updated Terms.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>RedForge is an AI-powered penetration testing platform that performs automated security scanning, vulnerability detection, and attack simulation against systems you own or are authorized to test. The Service uses artificial intelligence to identify security weaknesses and generate remediation recommendations.</p>
            <p>RedForge is intended for <strong className="text-white">authorized security testing only</strong>. You may not use the Service against systems you do not own or for which you do not have explicit written permission to test.</p>
          </Section>

          <Section title="3. Authorized Use & Acceptable Use Policy">
            <p>You agree that you will only use the RedForge Service to test systems and networks you own or have been granted explicit written authorization to test. Unauthorized scanning of third-party systems is strictly prohibited and may violate applicable computer fraud and cybercrime laws.</p>
            <p>Prohibited activities include but are not limited to:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-2">
              <li>Scanning or attacking systems without proper authorization</li>
              <li>Using RedForge for offensive operations against production systems belonging to others</li>
              <li>Attempting to bypass or circumvent RedForge's security controls</li>
              <li>Reselling or redistributing scan results without authorization</li>
              <li>Using the Service to violate any applicable law or regulation</li>
            </ul>
            <p>Violation of this policy may result in immediate termination of your account without refund and may be reported to law enforcement.</p>
          </Section>

          <Section title="4. Account Registration & Security">
            <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your credentials and for all activities that occur under your account.</p>
            <p>You must notify RedForge immediately at security@redforge.io if you suspect any unauthorized access to your account.</p>
          </Section>

          <Section title="5. Subscription Plans & Billing">
            <p>RedForge offers a FREE plan with a 14-day trial period and paid PRO and ENTERPRISE plans. Subscription fees are billed in advance on a monthly or annual basis.</p>
            <p>All payments are processed securely through Stripe. RedForge does not store your payment card information. Subscriptions automatically renew unless cancelled at least 24 hours before the renewal date.</p>
            <p>Refunds are available within 7 days of initial purchase if the Service did not perform as described. Contact billing@redforge.io for refund requests.</p>
          </Section>

          <Section title="6. Free Trial">
            <p>New accounts receive a 14-day free trial with access to all PRO features. No credit card is required for the trial. At the end of the trial period, your account will revert to the FREE plan with limited functionality unless you upgrade to a paid plan.</p>
          </Section>

          <Section title="7. Intellectual Property">
            <p>RedForge and all associated technology, algorithms, AI models, and user interfaces are the exclusive property of RedForge, Inc. The Service is protected by copyright, trade secret, and other intellectual property laws.</p>
            <p>Scan reports and findings generated by RedForge for your systems remain your property. You grant RedForge a license to use anonymized, aggregated data to improve the Service.</p>
          </Section>

          <Section title="8. Limitation of Liability">
            <p>The Service is provided "as is" without warranty of any kind. RedForge does not warrant that the Service will identify all vulnerabilities in your systems or that scan results will be error-free.</p>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, REDFORGE, INC. SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR YOUR USE OF THE SERVICE.</p>
          </Section>

          <Section title="9. Indemnification">
            <p>You agree to indemnify and hold harmless RedForge, Inc., its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including reasonable legal fees) arising out of your use of the Service, your violation of these Terms, or your violation of any rights of a third party.</p>
          </Section>

          <Section title="10. Termination">
            <p>Either party may terminate the agreement at any time. Upon termination, your right to use the Service will immediately cease. RedForge reserves the right to suspend or terminate accounts that violate these Terms without prior notice.</p>
          </Section>

          <Section title="11. Governing Law">
            <p>These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Any disputes shall be resolved in the courts of Delaware.</p>
          </Section>

          <Section title="12. Contact">
            <p>For questions about these Terms, contact us at <a href="mailto:legal@redforge.io" className="text-red-400 hover:underline">legal@redforge.io</a> or write to:</p>
            <p className="font-mono text-xs bg-zinc-900 p-3 rounded-md text-zinc-300">RedForge, Inc.<br />Legal Department<br />legal@redforge.io</p>
          </Section>
        </div>
      </div>
    </div>
  );
}
