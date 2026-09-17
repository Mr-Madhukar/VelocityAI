import type { Metadata } from "next";
import Link from "next/link";

import { LegalList, LegalPage, LegalSection } from "../_components/legal/legal-page";

export const metadata: Metadata = {
  title: "Account Deletion · VelocityAI",
  description: "How to permanently delete your VelocityAI account and what data is removed.",
};

const CONTACT_EMAIL = "privacy@VelocityAI.in";

export default function AccountDeletionPage() {
  return (
    <LegalPage
      title="Account Deletion"
      updated="July 15, 2026"
      intro={
        <>
          You can permanently delete your VelocityAI account — created on the web at VelocityAI.in or
          through the VelocityAI mobile app — at any time. This page explains how to do it, what data
          is removed, and what happens to content in organizations you share with other people.
        </>
      }
    >
      <LegalSection n={1} heading="Delete your account from the app">
        <p>Deletion is self-service and takes effect immediately:</p>
        <LegalList
          items={[
            <>
              Sign in to your account at{" "}
              <Link href="/" className="text-primary underline-offset-4 hover:underline">
                VelocityAI.in
              </Link>
              .
            </>,
            <>
              Open <strong className="text-foreground/90">Settings</strong> from the sidebar.
            </>,
            <>
              Scroll to the <strong className="text-foreground/90">Danger zone</strong> section and
              click <strong className="text-foreground/90">Delete account</strong>.
            </>,
            <>
              Type your account email to confirm, then click{" "}
              <strong className="text-foreground/90">Delete my account</strong>.
            </>,
          ]}
        />
        <p>
          The same account is used by the VelocityAI mobile app and the web app, so deleting it in
          either place deletes it everywhere.
        </p>
      </LegalSection>

      <LegalSection n={2} heading="What is deleted">
        <p>When you delete your account, we permanently remove from our production systems:</p>
        <LegalList
          items={[
            "Your profile — name, email address, and profile image.",
            "Your sign-in credentials and connected sign-in methods (Google, GitHub, email/password), and all active sessions and device authorizations.",
            "Your GitHub App installation links associated with your user.",
            "Every organization where you are the only member, including all of its projects, connected repositories, feature requests, PRDs, tasks, reviews, conversations, and stored API keys.",
            "Your comments and AI conversations.",
          ]}
        />
      </LegalSection>

      <LegalSection n={3} heading="Shared organizations">
        <p>
          Content created inside an organization belongs to that organization. If you are a member
          of an organization that has other members, the organization and its work products
          (projects, features, PRDs, tasks) are not deleted — your membership is removed and items
          you authored remain with the organization, attributed to another member. If you are the
          only owner of an organization that still has other members, you must transfer ownership
          (or remove those members) before your account can be deleted.
        </p>
      </LegalSection>

      <LegalSection n={4} heading="Retention">
        <p>
          Deleted data is removed from our production systems immediately. Residual copies may
          persist in encrypted backups for up to 30 days before being purged, and we may retain
          limited records where the law requires it (for example, billing and tax records held by
          our payment provider).
        </p>
      </LegalSection>

      <LegalSection n={5} heading="Request deletion by email">
        <p>
          If you can no longer sign in, or you want us to handle the deletion for you, email{" "}
          <Link
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {CONTACT_EMAIL}
          </Link>{" "}
          from the address registered to your account with the subject &quot;Delete my
          account&quot;. We will verify the request and complete the deletion within 30 days.
        </p>
        <p>
          See also our{" "}
          <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
