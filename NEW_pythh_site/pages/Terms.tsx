/**
 * TERMS OF SERVICE — Pythh.ai
 */
import LegalDoc, { LegalList, LegalLink, type LegalSection } from "@/components/LegalDoc";

const LAST_UPDATED = "2026-06-08";

const SECTIONS: LegalSection[] = [
  {
    heading: "Acceptance of terms",
    body: (
      <p>
        These Terms of Service ("Terms") govern your access to and use of
        pythh.ai and related services (the "Service") operated by Pythh
        ("we", "us", or "our"). By accessing or using the Service, you agree to
        be bound by these Terms and our{" "}
        <LegalLink href="/privacy">Privacy Policy</LegalLink>. If you do not
        agree, do not use the Service.
      </p>
    ),
  },
  {
    heading: "The service",
    body: (
      <p>
        Pythh provides venture-signal intelligence, including startup scoring and
        investor matching. Scores, matches, and other outputs are informational
        and do not constitute financial, investment, legal, or other professional
        advice. You are solely responsible for your own decisions.
      </p>
    ),
  },
  {
    heading: "Accounts",
    body: (
      <LegalList items={[
        "You must provide accurate information and keep it up to date.",
        "You are responsible for safeguarding your account credentials and for all activity under your account.",
        "You must be at least 18 years old to use the Service.",
        "Notify us promptly of any unauthorized use of your account.",
      ]} />
    ),
  },
  {
    heading: "Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <LegalList items={[
          "Use the Service for any unlawful, harmful, or fraudulent purpose",
          "Scrape, harvest, or reverse-engineer the Service except as permitted by law",
          "Interfere with or disrupt the integrity or performance of the Service",
          "Attempt to gain unauthorized access to any systems or data",
          "Misrepresent your identity or submit false information",
          "Infringe the intellectual property or privacy rights of others",
        ]} />
      </>
    ),
  },
  {
    heading: "Your content",
    body: (
      <p>
        You retain ownership of content you submit. You grant us a worldwide,
        non-exclusive license to use, process, and display that content as needed
        to operate and improve the Service. You represent that you have the rights
        necessary to submit such content.
      </p>
    ),
  },
  {
    heading: "Intellectual property",
    body: (
      <p>
        The Service, including its software, scoring methodology, and content
        (excluding your content), is owned by Pythh and protected by intellectual
        property laws. We grant you a limited, revocable, non-transferable license
        to use the Service in accordance with these Terms.
      </p>
    ),
  },
  {
    heading: "Subscriptions and billing",
    body: (
      <p>
        Paid plans are billed through our payment processor (Stripe) on a
        recurring basis until cancelled. Fees are non-refundable except as
        required by law. You can manage or cancel your subscription from your
        account; cancellation takes effect at the end of the current billing
        period. We may change pricing with reasonable notice.
      </p>
    ),
  },
  {
    heading: "Third-party services",
    body: (
      <p>
        The Service may integrate with third-party platforms (e.g. LinkedIn,
        Google, Stripe). Your use of those services is governed by their terms and
        policies, and we are not responsible for third-party services.
      </p>
    ),
  },
  {
    heading: "Disclaimers",
    body: (
      <p>
        THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF
        ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A
        PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do not warrant that the
        Service will be uninterrupted, error-free, or that scores or matches will
        be accurate or complete.
      </p>
    ),
  },
  {
    heading: "Limitation of liability",
    body: (
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, PYTHH AND ITS AFFILIATES WILL NOT
        BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
        PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR DATA, ARISING FROM YOUR USE OF
        THE SERVICE. OUR TOTAL LIABILITY WILL NOT EXCEED THE GREATER OF THE
        AMOUNTS YOU PAID US IN THE 12 MONTHS BEFORE THE CLAIM OR USD $100.
      </p>
    ),
  },
  {
    heading: "Indemnification",
    body: (
      <p>
        You agree to indemnify and hold harmless Pythh from any claims, damages,
        or expenses arising from your use of the Service, your content, or your
        violation of these Terms.
      </p>
    ),
  },
  {
    heading: "Termination",
    body: (
      <p>
        We may suspend or terminate your access at any time for any violation of
        these Terms or to protect the Service. You may stop using the Service at
        any time. Provisions that by their nature should survive termination will
        survive.
      </p>
    ),
  },
  {
    heading: "Governing law",
    body: (
      <p>
        These Terms are governed by the laws of the United States and the State of
        Delaware, without regard to conflict-of-laws principles. Disputes will be
        resolved in the courts located in Delaware, unless otherwise required by
        applicable law.
      </p>
    ),
  },
  {
    heading: "Changes to these terms",
    body: (
      <p>
        We may update these Terms from time to time. We will post the revised
        version here and update the "Last updated" date. Continued use of the
        Service after changes constitutes acceptance.
      </p>
    ),
  },
  {
    heading: "Contact us",
    body: (
      <p>
        Questions about these Terms? Email{" "}
        <LegalLink href="mailto:support@pythh.ai">support@pythh.ai</LegalLink>.
      </p>
    ),
  },
];

export default function Terms() {
  return (
    <LegalDoc
      kind="Legal"
      title="Terms of Service"
      path="/terms"
      description="The terms governing your use of pythh.ai and related services."
      lastUpdated={LAST_UPDATED}
      intro="Please read these terms carefully. By using pythh.ai you agree to them."
      sections={SECTIONS}
    />
  );
}
