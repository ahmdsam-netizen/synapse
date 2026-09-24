import { Link } from 'react-router-dom';

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 border-b border-gray-200 pb-6">
        <Link
          to="/"
          className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700 mb-4"
        >
          &larr; Back to Synapse
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Effective Date: September 22, 2026</p>
      </div>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">1. Overview</h2>
          <p>
            Synapse provides a recommendation-based connection platform tailored for verified university and college students. 
            This Privacy Policy explains how we collect, store, process, and protect your information when you access or use 
            our application, APIs, and associated services.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">2. Information We Collect</h2>
          <p>
            We collect only the information necessary to facilitate project matchmaking, verified student collaboration, 
            and platform security:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-gray-900">Academic Account Credentials:</strong> Full name, institutional email address 
              ending in approved college domains, academic branch/major, and graduation year.
            </li>
            <li>
              <strong className="text-gray-900">Profile Information:</strong> Verified technical skills, proficiency levels, 
              collaboration interests, portfolio work items, repository links, and optional profile avatar URLs.
            </li>
            <li>
              <strong className="text-gray-900">Collaboration Activity:</strong> Project postings created, membership in project groups, 
              join requests sent and received, and verified connection edges established between students.
            </li>
            <li>
              <strong className="text-gray-900">System Logs and Security Metrics:</strong> IP addresses, browser user agent strings, 
              authentication timestamps, and error logs collected strictly for security auditability and uptime diagnostics.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">3. How Information Is Used</h2>
          <p>Your information is used strictly for operational purposes:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>To compute skill-based and interest-based similarity vectors for project and teammate recommendations.</li>
            <li>To display verified student profiles to peers within the authenticated network.</li>
            <li>To manage group invitations, application reviews, and role permissions.</li>
            <li>To enforce institutional eligibility and protect users from unauthorized access or impersonation.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">4. Data Sharing and Third Parties</h2>
          <p>
            We do not sell, rent, or monetize your personal data. Data is shared only under the following limited conditions:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-gray-900">With Other Authenticated Students:</strong> Profile details (name, college, branch, 
              skills, interests, work items) are visible to authenticated peers on the platform to enable discovery.
            </li>
            <li>
              <strong className="text-gray-900">Infrastructure Providers:</strong> Hosted database, caching, and server compute 
              providers operating under strict data processing agreements.
            </li>
            <li>
              <strong className="text-gray-900">Legal Compliance:</strong> When required by enforceable court order, regulatory mandate, 
              or applicable law.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">5. Data Retention and Security</h2>
          <p>
            User passwords are encrypted using salted bcrypt hashing. Sensitive session tokens are transmitted over TLS and 
            stored with strict domain boundaries. We retain account information for as long as your account remains active.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">6. Your Rights and Data Controls</h2>
          <p>
            You have full control over your personal data on Synapse:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>You can view, edit, or remove skills, interests, and portfolio work items at any time through your Profile page.</li>
            <li>You can leave groups, withdraw pending join requests, or disconnect from peers.</li>
            <li>You may request complete account deletion and data erasure by contacting our administration team.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">7. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy periodically to reflect improvements in our architecture or regulatory updates. 
            Any substantial changes will be accompanied by an updated effective date at the top of this document.
          </p>
        </section>

        <section className="space-y-3 border-t border-gray-200 pt-6">
          <h2 className="text-xl font-semibold text-gray-900">8. Contact Information</h2>
          <p>
            For privacy inquiries, account data deletion, or compliance verification, contact:
          </p>
          <p className="font-medium text-gray-900">
            Privacy Operations: <span className="text-primary-600">privacy@synapseplatform.edu</span>
          </p>
        </section>
      </div>
    </div>
  );
}
