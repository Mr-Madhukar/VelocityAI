import type { Metadata } from "next";
import Link from "next/link";

import { LegalList, LegalPage, LegalSection } from "../_components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service · VelocityAI",
  description: "The terms that govern your use of VelocityAI.",
};

const CONTACT_EMAIL = "legal@VelocityAI.in";

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="July 1, 2026"
      intro={
        <>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of VelocityAI
          (&quot;VelocityAI&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) and the website and
          product delivery platform at VelocityAI.in (the &quot;Service&quot;). By accessing or using the
          Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
        </>
      }
    >
      <LegalSection n={1} heading="Eligibility and accounts">
        <p>
          You must be at least 16 years old and able to form a binding contract to use the Service.
          You are responsible for the activity under your account, for keeping your credentials
          secure, and for ensuring the information you provide is accurate. You may access the Service
          through Google or GitHub sign-in, subject to those providers&apos; terms.
        </p>
      </LegalSection>

      <LegalSection n={2} heading="The Service">
        <p>
          VelocityAI helps teams turn feature ideas into reviewed, approved, and shipped software by
          generating product requirements documents (PRDs), breaking work into tasks, and running
          AI-assisted reviews of pull requests connected through GitHub. We may add, change, or remove
          features at any time.
        </p>
      </LegalSection>

      <LegalSection n={3} heading="Acceptable use">
        <p>You agree not to:</p>
        <LegalList
          items={[
            "Use the Service to violate any law or infringe the rights of others.",
            "Upload malicious code or attempt to disrupt, probe, or gain unauthorized access to the Service or its infrastructure.",
            "Reverse engineer, resell, or misuse the Service or its AI outputs in ways that breach these Terms.",
            "Access data or repositories you are not authorized to access, or connect repositories without appropriate permission.",
            "Abuse AI or usage credits, or circumvent plan limits and rate limits.",
          ]}
        />
      </LegalSection>

      <LegalSection n={4} heading="GitHub and third-party integrations">
        <p>
          When you connect a GitHub repository, you authorize us to access the data necessary to
          provide reviews and related features. Your use of GitHub and other integrated services
          remains subject to their own terms, and you are responsible for having the rights to connect
          any repository or account you link.
        </p>
      </LegalSection>

      <LegalSection n={5} heading="AI-generated content">
        <p>
          The Service produces AI-generated output, including PRDs, tasks, estimates, and code review
          findings. This output may be inaccurate, incomplete, or unsuitable for your purpose. It is
          provided as assistance only and does not replace human judgment. You are responsible for
          reviewing and validating any output before relying on it, including before approving,
          merging, or shipping software.
        </p>
      </LegalSection>

      <LegalSection n={6} heading="Your content and intellectual property">
        <p>
          You retain ownership of the content you submit to the Service (&quot;Your Content&quot;). You
          grant us a limited, non-exclusive license to host, process, and display Your Content solely
          to operate and improve the Service for you and your organization, including sending it to
          our subprocessors as described in our Privacy Policy. We and our licensors retain all rights
          in the Service itself, including its software, design, and trademarks.
        </p>
      </LegalSection>

      <LegalSection n={7} heading="Plans, billing, and payments">
        <LegalList
          items={[
            "Paid plans are billed in advance on a recurring basis through our payment provider until cancelled.",
            "Plan limits, including AI review credits and repository limits, apply as described at the time of purchase.",
            "Except where required by law, fees are non-refundable, and cancellation stops future renewals rather than refunding the current period.",
            "We may change pricing with reasonable notice; changes apply to subsequent billing periods.",
          ]}
        />
      </LegalSection>

      <LegalSection n={8} heading="Termination">
        <p>
          You may stop using the Service and delete your account or organization at any time. We may
          suspend or terminate your access if you breach these Terms or use the Service in a way that
          risks harm to us, other users, or third parties. Upon termination, your right to use the
          Service ends, and we may delete your content in accordance with our Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection n={9} heading="Disclaimers">
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of
          any kind, whether express or implied, including warranties of merchantability, fitness for a
          particular purpose, non-infringement, and any warranty regarding the accuracy or reliability
          of AI-generated output. We do not warrant that the Service will be uninterrupted, secure, or
          error-free.
        </p>
      </LegalSection>

      <LegalSection n={10} heading="Limitation of liability">
        <p>
          To the maximum extent permitted by law, VelocityAI and its suppliers will not be liable for any
          indirect, incidental, special, consequential, or punitive damages, or for any loss of
          profits, data, or goodwill, arising from or related to your use of the Service. Our total
          liability for any claim relating to the Service will not exceed the amount you paid us for
          the Service in the twelve months preceding the claim.
        </p>
      </LegalSection>

      <LegalSection n={11} heading="Indemnification">
        <p>
          You agree to indemnify and hold VelocityAI harmless from any claims, damages, liabilities, and
          expenses arising out of your Content, your use of the Service, or your breach of these
          Terms.
        </p>
      </LegalSection>

      <LegalSection n={12} heading="Governing law">
        <p>
          These Terms are governed by the laws of India, without regard to conflict-of-law principles.
          You agree to the exclusive jurisdiction of the courts located in India for any dispute that
          is not subject to arbitration or other agreed resolution.
        </p>
      </LegalSection>

      <LegalSection n={13} heading="Changes to these Terms">
        <p>
          We may update these Terms from time to time. When we do, we will revise the &quot;Last
          updated&quot; date above and, where appropriate, provide additional notice. Your continued use
          of the Service after changes take effect constitutes acceptance of the updated Terms.
        </p>
      </LegalSection>

      <LegalSection n={14} heading="Contact us">
        <p>
          Questions about these Terms? Contact us at{" "}
          <Link href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline-offset-4 hover:underline">
            {CONTACT_EMAIL}
          </Link>
          . See also our{" "}
          <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
