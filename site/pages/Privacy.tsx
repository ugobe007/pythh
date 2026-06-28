/**
 * PRIVACY POLICY — Pythh.ai
 */
import LegalDoc, { LegalList, LegalLink, type LegalSection } from "@/components/LegalDoc";

const LAST_UPDATED = "2026-06-08";

const SECTIONS: LegalSection[] = [
  {
    heading: "Who we are",
    body: (
      <p>
        Pythh ("pythh.ai", "we", "us", or "our") operates a venture-signal
        intelligence platform that scores startups and matches them with
        investors. This Privacy Policy explains what information we collect, how
        we use it, and the choices you have. It applies to{" "}
        <LegalLink href="https://pythh.ai">pythh.ai</LegalLink> and related
        services.
      </p>
    ),
  },
  {
    heading: "Information we collect",
    body: (
      <>
        <p>We collect the following categories of information:</p>
        <LegalList items={[
          <><strong className="text-white">Account information</strong> — your name, email address, and profile details, including data shared by an identity provider when you sign in with a third party (e.g. Google or LinkedIn OAuth), such as your name, email, and profile picture.</>,
          <><strong className="text-white">Startup &amp; submission data</strong> — URLs, company details, and other information you submit for analysis, scoring, or matching.</>,
          <><strong className="text-white">Usage data</strong> — pages viewed, features used, searches, and interactions, collected to operate and improve the service.</>,
          <><strong className="text-white">Device &amp; log data</strong> — IP address, browser type, and similar technical data automatically collected when you use the platform.</>,
          <><strong className="text-white">Communications</strong> — messages you send us (e.g. support requests) and newsletter subscription details.</>,
        ]} />
        <p>
          We collect publicly available business information about startups and
          investors from public web sources and news to power our scoring and
          intelligence features.
        </p>
      </>
    ),
  },
  {
    heading: "How we use your information",
    body: (
      <LegalList items={[
        "Provide, maintain, secure, and improve the platform",
        "Score startups and generate investor matches",
        "Authenticate you and manage your account and subscription",
        "Send transactional messages, product updates, and (with your consent) our newsletter",
        "Respond to your requests and provide support",
        "Detect, prevent, and address fraud, abuse, and security issues",
        "Comply with legal obligations",
      ]} />
    ),
  },
  {
    heading: "How we share information",
    body: (
      <>
        <p><strong className="text-white">We do not sell your personal information.</strong> We share information only as described below:</p>
        <LegalList items={[
          <><strong className="text-white">Service providers (processors)</strong> — vendors who help us run the platform, including hosting and database (Supabase, Vercel, Fly.io), AI processing (OpenAI), email delivery (Resend), and payments (Stripe). They may process data only on our behalf.</>,
          <><strong className="text-white">Matching &amp; connections</strong> — where you ask to connect with an investor or startup, we share the information needed to facilitate that introduction.</>,
          <><strong className="text-white">Legal &amp; safety</strong> — when required by law, regulation, legal process, or to protect the rights, property, or safety of Pythh, our users, or others.</>,
          <><strong className="text-white">Business transfers</strong> — in connection with a merger, acquisition, or sale of assets, subject to this Policy.</>,
        ]} />
      </>
    ),
  },
  {
    heading: "Third-party platforms (LinkedIn, Google)",
    body: (
      <p>
        If you connect a third-party account such as LinkedIn or Google, we
        access only the data you authorize through that provider's permission
        flow, and we use it solely to provide the features you request (for
        example, authentication or publishing content you initiate). Our use of
        information received from these APIs adheres to the respective platform's
        developer policies. You can revoke access at any time in your account
        settings with that provider.
      </p>
    ),
  },
  {
    heading: "Cookies and tracking",
    body: (
      <p>
        We use cookies and similar technologies to keep you signed in, remember
        preferences, and understand usage. You can control cookies through your
        browser settings; disabling some cookies may affect functionality.
      </p>
    ),
  },
  {
    heading: "Data retention",
    body: (
      <p>
        We retain personal information for as long as your account is active or
        as needed to provide the service, comply with legal obligations, resolve
        disputes, and enforce our agreements. When no longer needed, we delete or
        anonymize it.
      </p>
    ),
  },
  {
    heading: "Your rights and choices",
    body: (
      <>
        <p>Depending on your location, you may have the right to:</p>
        <LegalList items={[
          "Access, correct, or update your personal information",
          "Request deletion of your personal information",
          "Object to or restrict certain processing",
          "Request a portable copy of your data",
          "Opt out of marketing emails at any time via the unsubscribe link",
          "Withdraw consent where processing is based on consent",
        ]} />
        <p>
          To exercise any of these rights, email{" "}
          <LegalLink href="mailto:privacy@pythh.ai">privacy@pythh.ai</LegalLink>.
          We will respond as required by applicable law.
        </p>
      </>
    ),
  },
  {
    heading: "Data security",
    body: (
      <p>
        We implement administrative, technical, and organizational safeguards
        designed to protect your information. However, no method of transmission
        or storage is completely secure, and we cannot guarantee absolute
        security.
      </p>
    ),
  },
  {
    heading: "International transfers",
    body: (
      <p>
        We are based in the United States and may process and store information in
        the U.S. and other countries. Where required, we use appropriate
        safeguards for cross-border transfers.
      </p>
    ),
  },
  {
    heading: "Children's privacy",
    body: (
      <p>
        Our service is not directed to individuals under 18, and we do not
        knowingly collect personal information from them. If you believe a child
        has provided us information, contact us and we will delete it.
      </p>
    ),
  },
  {
    heading: "Changes to this policy",
    body: (
      <p>
        We may update this Privacy Policy from time to time. We will post the
        revised version here and update the "Last updated" date above. Material
        changes may be communicated via the platform or email.
      </p>
    ),
  },
  {
    heading: "Contact us",
    body: (
      <p>
        Questions about this Policy or your data? Email{" "}
        <LegalLink href="mailto:privacy@pythh.ai">privacy@pythh.ai</LegalLink> or{" "}
        <LegalLink href="mailto:support@pythh.ai">support@pythh.ai</LegalLink>.
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <LegalDoc
      kind="Legal"
      title="Privacy Policy"
      path="/privacy"
      description="How Pythh.ai collects, uses, shares, and protects your information."
      lastUpdated={LAST_UPDATED}
      intro="Your privacy matters. This policy describes how we handle personal information across pythh.ai."
      sections={SECTIONS}
    />
  );
}
