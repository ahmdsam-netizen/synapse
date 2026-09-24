import { Link } from 'react-router-dom';

export default function TermsAndConditionsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 border-b border-gray-200 pb-6">
        <Link
          to="/"
          className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700 mb-4"
        >
          &larr; Back to Synapse
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Terms and Conditions</h1>
        <p className="mt-2 text-sm text-gray-500">Effective Date: September 22, 2026</p>
      </div>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">1. Agreement to Terms</h2>
          <p>
            By registering an account or accessing the Synapse platform, you agree to be bound by these Terms and 
            Conditions and all applicable laws and regulations. If you do not agree with any of these terms, you are 
            prohibited from using or accessing this service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">2. Eligibility and Institutional Affiliation</h2>
          <p>
            Synapse is designed exclusively for verified students, researchers, and faculty members belonging to 
            accredited educational institutions. Registration requires a verified institutional email address. 
            Accounts registered using fraudulent credentials, disposable emails, or unauthorized domains will be 
            terminated immediately without prior notice.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">3. User Accounts and Security</h2>
          <p>
            You are responsible for safeguarding your login credentials and maintaining the confidentiality of your account. 
            You agree to notify Synapse administrators immediately if you suspect any unauthorized access or security breach. 
            Synapse cannot and will not be liable for losses or damages resulting from failure to safeguard your credentials.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">4. Acceptable Use and Community Standards</h2>
          <p>
            Users must conduct themselves professionally and collegially. The following activities are strictly prohibited:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Posting deceptive project requirements, fraudulent competition listings, or counterfeit skill qualifications.</li>
            <li>Harassing, discriminating against, or defaming other students or project groups.</li>
            <li>Using automated crawlers, scrapers, or bot scripts to harvest user data or contact details.</li>
            <li>Attempting to bypass authentication, probe platform security boundaries, or inject malicious payloads.</li>
            <li>Distributing commercial advertising, spam, affiliate promotions, or unrelated marketing material.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">5. Project Collaboration and Intellectual Property</h2>
          <p>
            Synapse facilitates introductions and collaboration between peers. We do not claim ownership of the project code, 
            designs, research papers, or intellectual property developed by users. Ownership agreements between teammates 
            remain solely the responsibility of the participating members.
          </p>
          <p>
            By publishing project descriptions, recruitment postings, and work samples on Synapse, you grant the platform 
            a non-exclusive license to index, display, and search that content solely to deliver platform functionality.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">6. Platform Moderation and Termination</h2>
          <p>
            Group administrators retain discretion to review and decide upon join requests for their groups. Synapse 
            administrators reserve the right to suspend or remove any posting, group, or user account found in violation 
            of these Terms or deemed detrimental to the safety of the student community.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">7. Disclaimer of Warranties</h2>
          <p>
            The platform is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. While we strive for high reliability 
            and continuous service, Synapse makes no warranties, expressed or implied, regarding system uptime, uninterrupted 
            operation, or the suitability of collaboration partners found through the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">8. Limitation of Liability</h2>
          <p>
            In no event shall Synapse or its maintainers be liable for any direct, indirect, incidental, or consequential damages 
            arising from your use of or inability to use the platform or any disputes arising among collaborating students.
          </p>
        </section>

        <section className="space-y-3 border-t border-gray-200 pt-6">
          <h2 className="text-xl font-semibold text-gray-900">9. Contact and Inquiries</h2>
          <p>
            Questions regarding these Terms and Conditions should be directed to:
          </p>
          <p className="font-medium text-gray-900">
            Legal &amp; Compliance Team: <span className="text-primary-600">legal@synapseplatform.edu</span>
          </p>
        </section>
      </div>
    </div>
  );
}
