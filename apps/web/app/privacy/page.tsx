import type { Metadata } from "next";
import Link from "next/link";

import { LegalList, LegalPage, LegalSection } from "../_components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy · VelocityAI",
  description: "How VelocityAI collects, uses, and protects your data.",
};

const CONTACT_EMAIL = "privacy@VelocityAI.in";

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="July 1, 2026"
      intro={
        <>
          This Privacy Policy explains how VelocityAI (&quot;VelocityAI&quot;, &quot;we&quot;, &quot;us&quot;, or
          &quot;our&quot;) collects, uses, discloses, and safeguards your information when you use our
          website and product delivery platform at VelocityAI.in (the &quot;Service&quot;). By using the
          Service, you agree to the practices described here.
        </>
      }
    >
      <LegalSection n={1} heading="Information we collect">
        <p>We collect the following categories of information:</p>
        <LegalList
          items={[
            <>
              <strong className="text-foreground/90">Account information</strong> — your name, email
              address, and profile image, provided directly or through a third-party sign-in
              provider (Google or GitHub).
            </>,
            <>
              <strong className="text-foreground/90">Content you create</strong> — feature requests,
              clarification conversations, PRDs, tasks, comments, organization and team details, and
              any other material you submit to the Service.
            </>,
            <>
              <strong className="text-foreground/90">GitHub data</strong> — when you connect a
              repository through our GitHub App, we access repository metadata, pull requests,
              branches, commit references, and diffs needed to run AI reviews. We request only the
              permissions required to operate these features.
            </>,
            <>
              <strong className="text-foreground/90">Billing information</strong> — subscription and
              payment records processed by our payment provider. We do not store full card numbers on
              our servers.
            </>,
            <>
              <strong className="text-foreground/90">Usage and device data</strong> — log data, IP
              address, browser type, and interactions with the Service, collected to keep the Service
              secure and reliable.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection n={2} heading="How we use your information">
        <LegalList
          items={[
            "Provide, operate, and maintain the Service, including generating PRDs, tasks, and AI code reviews.",
            "Authenticate you and secure your account and organization.",
            "Process transactions and manage subscriptions.",
            "Send transactional messages such as invitations, notifications, and shared documents.",
            "Monitor usage, prevent abuse, and improve the Service.",
            "Comply with legal obligations and enforce our Terms of Service.",
          ]}
        />
      </LegalSection>

      <LegalSection n={3} heading="AI processing">
        <p>
          Core features of the Service use artificial intelligence. To generate PRDs, break work into
          tasks, and review pull requests, we send relevant content — such as your feature
          descriptions, clarification answers, and repository diffs — to our AI provider (OpenAI) for
          processing. This data is used to produce your requested output. We do not use your private
          content to train our own models, and our AI provider processes it under its applicable data
          processing terms.
        </p>
      </LegalSection>

      <LegalSection n={4} heading="Third-party services and subprocessors">
        <p>
          We rely on trusted third parties to deliver the Service. These providers process data on
          our behalf under their respective terms:
        </p>
        <LegalList
          items={[
            <><strong className="text-foreground/90">GitHub</strong> — repository access and pull request review.</>,
            <><strong className="text-foreground/90">OpenAI</strong> — AI generation and review.</>,
            <><strong className="text-foreground/90">Resend</strong> — transactional email delivery.</>,
            <><strong className="text-foreground/90">Razorpay</strong> — subscription billing and payment processing.</>,
            <><strong className="text-foreground/90">Pusher</strong> — real-time updates within your workspace.</>,
            <><strong className="text-foreground/90">Cloud hosting and database providers</strong> — infrastructure that stores and serves the Service.</>,
          ]}
        />
      </LegalSection>

      <LegalSection n={5} heading="How we share information">
        <p>
          We do not sell your personal information. We share information only: with the subprocessors
          listed above to operate the Service; with other members of your organization, who can see
          content created within that organization; when required by law or to respond to valid legal
          requests; and in connection with a merger, acquisition, or sale of assets, subject to this
          Policy.
        </p>
      </LegalSection>

      <LegalSection n={6} heading="Data retention">
        <p>
          We retain your information for as long as your account or organization is active, or as
          needed to provide the Service. When you delete content, your account, or your organization,
          the associated records are removed from our production systems, subject to reasonable backup
          retention and any legal obligations that require us to keep certain data.
        </p>
      </LegalSection>

      <LegalSection n={7} heading="Security">
        <p>
          We use administrative, technical, and organizational measures designed to protect your
          information, including encryption in transit, scoped access controls, and least-privilege
          integration permissions. No method of transmission or storage is completely secure, so we
          cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection n={8} heading="Your rights">
        <p>
          Depending on your location, you may have the right to access, correct, export, or delete
          your personal information, and to object to or restrict certain processing. You can update
          much of your information from your profile and settings, or contact us to exercise these
          rights. We will respond consistent with applicable law, including the GDPR and CCPA where
          they apply.
        </p>
        <p>
          You can permanently delete your account and its data at any time from Settings inside the
          app. See our{" "}
          <Link href="/account-deletion" className="text-primary underline-offset-4 hover:underline">
            Account Deletion
          </Link>{" "}
          page for the exact steps and what is removed.
        </p>
      </LegalSection>

      <LegalSection n={9} heading="International data transfers">
        <p>
          Your information may be processed in countries other than your own, including where our
          providers operate. Where required, we use appropriate safeguards for such transfers.
        </p>
      </LegalSection>

      <LegalSection n={10} heading="Children's privacy">
        <p>
          The Service is not intended for individuals under 16, and we do not knowingly collect
          personal information from children. If you believe a child has provided us information,
          contact us so we can delete it.
        </p>
      </LegalSection>

      <LegalSection n={11} heading="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we will revise the &quot;Last
          updated&quot; date above and, where appropriate, provide additional notice. Your continued use
          of the Service after changes take effect constitutes acceptance of the updated Policy.
        </p>
      </LegalSection>

      <LegalSection n={12} heading="Contact us">
        <p>
          If you have questions about this Privacy Policy or our data practices, contact us at{" "}
          <Link href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline-offset-4 hover:underline">
            {CONTACT_EMAIL}
          </Link>
          . See also our{" "}
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
