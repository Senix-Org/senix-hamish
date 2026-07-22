'use client';

import Link from 'next/link';
import { LegalSection, TraeLegalPageShell } from './legal-page-shell';

const LAST_MODIFIED = 'July 21, 2026';

const TOC = [
  { id: 'introduction', label: '1. Introduction' },
  { id: 'information-we-collect', label: '2. Information we collect' },
  { id: 'do-not-track', label: '3. Do Not Track' },
  { id: 'childrens-privacy', label: "4. Children's privacy" },
  { id: 'how-we-use', label: '5. How we use your information' },
  { id: 'legal-bases', label: '6. Legal bases' },
  { id: 'how-we-disclose', label: '7. How we disclose and share' },
  { id: 'third-party', label: '8. Third-party websites' },
  { id: 'your-rights', label: '9. Your rights and choices' },
  { id: 'international', label: '10. International jurisdictions' },
  { id: 'security', label: '11. Security' },
  { id: 'data-retention', label: '12. Data retention' },
  { id: 'changes', label: '13. Changes to this policy' },
  { id: 'contact', label: '14. How to contact us' },
] as const;

/**
 * Full Privacy Policy surface: Trae hero backdrop, sticky TOC, and
 * Senix-adapted legal copy (structure inspired by industry peers,
 * facts aligned to how Senix actually operates).
 */
export function TraePrivacyPolicyPage(): React.ReactElement {
  return (
    <TraeLegalPageShell
      titleLead="Privacy"
      titleAccent="Policy"
      description="How Senix collects, uses, and protects your information when you use senix.dev and our GitHub App."
      lastModified={LAST_MODIFIED}
      toc={TOC}
      tocAriaLabel="Privacy policy sections"
    >
              <LegalSection id="introduction" title="1. Introduction">
                <p>
                  Senix (&quot;Senix,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;)
                  respects your privacy and is committed to protecting it through our
                  compliance with this Privacy Policy (&quot;Policy&quot;). A core element of
                  our mission is to protect your personal information and to be transparent
                  about the data we collect about you, how it is used, and with whom it is
                  shared.
                </p>
                <p>
                  This Policy describes our practices for collecting, using, maintaining,
                  protecting, and disclosing your information through{' '}
                  <a href="https://senix.dev">https://senix.dev</a> (our &quot;Website&quot;),
                  our applications (our &quot;Apps&quot;), and our products, services,
                  technology platforms, and related applications (collectively, the
                  &quot;Service(s)&quot;).
                </p>
                <p>
                  Please read this Policy carefully to understand our policies and practices
                  regarding your information and how we will treat it. If you do not agree
                  with our terms, your choice is not to use our Services. By accessing or
                  using our Services, you agree to this Privacy Policy. This Policy may
                  change from time to time (see{' '}
                  <a href="#changes">Changes to this Policy</a>). Your continued access to
                  our Services after we make changes is deemed to be acceptance of those
                  changes, so please check the Last Modified date at the top of this Policy
                  to ensure that you are viewing the most current version.
                </p>
              </LegalSection>

              <LegalSection
                id="information-we-collect"
                title="2. Information we collect about you and how we collect it"
              >
                <p>
                  We collect only the minimum amount of information needed to provide you
                  with our Services. For example, we collect basic account information when
                  you sign in with GitHub. You will not be able to use the full Services
                  without registering for an account. Other types of information we collect
                  relate to how you use our Website or Apps, which helps us improve our
                  Services.
                </p>

                <h3>Information you provide to us or received by us on your behalf</h3>
                <ul>
                  <li>
                    <strong>Personal Information.</strong> When you register an account, we
                    collect information that identifies you as a specific individual and can
                    be used to contact or identify you (&quot;Personal Information&quot;).
                    Examples include your name, email address, and GitHub username, as
                    provided through GitHub OAuth via Supabase Auth.
                  </li>
                  <li>
                    <strong>Payment Information.</strong> We may process payment information
                    necessary to purchase or otherwise use paid plans. We do not collect or
                    store your card details ourselves. Payment Information is collected and
                    stored by our Authorized Service Providers (see{' '}
                    <a href="#how-we-disclose">How we disclose and share your information</a>
                    ). By submitting Payment Information, you consent to our providing it to
                    those providers as reasonably necessary to support and process your
                    transactions, as well as your card issuer and banking institution.
                  </li>
                  <li>
                    <strong>User Contributions.</strong> You may interact with parts of our
                    Website or with us through third-party platforms, such as submitting
                    feedback or support tickets. Your feedback or posts may be transmitted to
                    us or to third parties (collectively, &quot;User Contributions&quot;).
                    User Contributions are shared at your own risk. We cannot control the
                    actions of other users or third-party platforms with whom you choose to
                    share User Contributions, and we do not guarantee that they will not be
                    viewed by unauthorized persons. Use caution when posting personal
                    information online.
                  </li>
                  <li>
                    <strong>Pull request and analysis data.</strong> To perform code review,
                    we process PR metadata (title, author, file counts), structural-diff
                    metadata (added, modified, and removed symbols with file names and line
                    ranges), and the generated analysis result (summary, risk level, risk
                    flags, and focus files). We do not persist your raw source files. Diff
                    content is sent to an LLM provider for a single analysis request and is
                    not retained by Senix for model training.
                  </li>
                </ul>
                <p>
                  When you provide us with information in connection with a particular
                  activity, sign up for our Services, or provide contact information
                  (including your email address), you agree that such action establishes a
                  business relationship with us. You expressly consent to receiving
                  communications from Senix through the information you provided. For more
                  on controlling communication preferences, see{' '}
                  <a href="#your-rights">Your rights and choices regarding your information</a>
                  .
                </p>

                <h3>Information collected automatically</h3>
                <p>
                  As you navigate and interact with our Website, we and our third-party
                  service providers (including analytics and infrastructure providers) may
                  automatically collect certain information whenever you access or interact
                  with the Service.
                </p>
                <ul>
                  <li>
                    <strong>Usage Information.</strong> Details of your visits, including
                    which links you clicked, content response times, location data, logs, and
                    similar communication data and statistics about your interactions.
                  </li>
                  <li>
                    <strong>Device Information.</strong> Information about your computer and
                    internet connection, including your Internet Protocol address, operating
                    system, and browser type.
                  </li>
                  <li>
                    <strong>Non-Identifying Information.</strong> We may collect
                    non-identifying or non-personal information when you use our Website,
                    such as time zone, publicly available data, and general information
                    regarding your use of the Service.
                  </li>
                </ul>
                <p>
                  We may combine automatically collected log information with other
                  information we collect about you to improve the services we offer, our
                  analytics, and site functionality.
                </p>

                <h3>Cookies and other automatic data collection technologies</h3>
                <p>
                  Senix and its partners may use cookies or similar technologies that store
                  certain information on your device and allow us to analyze trends,
                  administer the Website, and understand how the Service is used. These may
                  include:
                </p>
                <ul>
                  <li>
                    <strong>Cookies.</strong> A cookie is a small data file transferred to
                    your device for record-keeping. We use session cookies (which expire when
                    your browser session ends) and may use persistent cookies where needed
                    for authentication and product functionality. You can control cookies at
                    the browser level. Disabling cookies may limit certain features of the
                    Service.
                  </li>
                  <li>
                    <strong>Web beacons and embedded scripts.</strong> We and our operational
                    partners may use limited tracking tags or embedded scripts to understand
                    how the Service is used, measure reliability, and improve features. These
                    technologies are not used to sell your personal information.
                  </li>
                </ul>

                <h3>Information received from third parties</h3>
                <p>
                  We may receive information about you from third parties. For example, our
                  partners and service providers may collect statistical data relating to
                  Website activity for security and fraud detection.
                </p>
                <p>
                  You may choose that certain third parties share information with us, for
                  example when you access the Services through Single Sign-On with GitHub.
                </p>
                <ul>
                  <li>
                    <strong>GitHub details.</strong> We may collect data necessary to enable
                    your Senix account to interface with your GitHub account, such as your
                    GitHub user id, username, organization or installation id, and role
                    context, along with installation-scoped tokens required for the GitHub
                    App. We integrate with GitHub&apos;s API and OAuth. We do not have access
                    to your GitHub password.
                  </li>
                </ul>
              </LegalSection>

              <LegalSection id="do-not-track" title="3. Do Not Track signal">
                <p>
                  Do Not Track (DNT) is a privacy preference that users can set in some web
                  browsers to opt out of tracking by websites and online services. We do not
                  track users across third-party sites for advertising, and we do not allow
                  third parties to track the personal information of our users on our Website
                  for that purpose.
                </p>
              </LegalSection>

              <LegalSection id="childrens-privacy" title="4. Children's privacy">
                <p>
                  The Services are intended for general audiences and users 13 and older. We
                  do not knowingly collect Personal Information from anyone younger than age
                  13. If you believe we have collected such information, please contact us
                  using the details in <a href="#contact">How to contact us</a> and we will
                  take steps to delete it.
                </p>
              </LegalSection>

              <LegalSection id="how-we-use" title="5. How we use your information">
                <p>
                  We may use information that we collect about you or that you provide to us,
                  including any personal information:
                </p>
                <ul>
                  <li>To provide you with an Account.</li>
                  <li>
                    To perform pull request analysis, post behavioral summaries and risk
                    tags, and enhance your development workflow.
                  </li>
                  <li>To deliver, provide, and process payment for the Services.</li>
                  <li>To improve our Services.</li>
                  <li>To address your inquiries and feedback.</li>
                  <li>
                    To tailor content we display to you and offers we may present to you, both
                    on the Service and elsewhere online.
                  </li>
                  <li>
                    To communicate with you, and to promote products, services, offers, and
                    events offered by Senix.
                  </li>
                  <li>To comply with legal requirements and assist law enforcement.</li>
                  <li>
                    To stop any activity we may consider to be, or to pose a risk of being,
                    illegal, fraudulent, unethical, or legally actionable.
                  </li>
                  <li>To identify Senix users and authenticate access.</li>
                  <li>
                    For the purposes disclosed at the time you provide your information, and
                    as otherwise permitted with your consent.
                  </li>
                </ul>
              </LegalSection>

              <LegalSection id="legal-bases" title="6. Legal bases">
                <p>
                  To process your information as described above, we rely on the following
                  legal bases where applicable:
                </p>
                <ul>
                  <li>
                    <strong>Contractual necessity.</strong> To provide you with the Senix
                    Service and perform the contract that you have with us.
                  </li>
                  <li>
                    <strong>Legitimate interests.</strong> It is in our legitimate interests
                    to improve and analyze our Service, promote our products, prevent
                    fraudulent transactions, maintain security of our Services, and provide
                    functionality.
                  </li>
                  <li>
                    <strong>Consent.</strong> Where we have indicated we will ask for consent
                    within this Privacy Policy, you may withdraw your consent at any time by
                    contacting us. See <a href="#contact">How to contact us</a>.
                  </li>
                </ul>
              </LegalSection>

              <LegalSection
                id="how-we-disclose"
                title="7. How we disclose and share your information"
              >
                <p>
                  We do not sell personal information to third parties. We share information
                  we receive about you as follows:
                </p>

                <h3>With our service providers</h3>
                <p>
                  We employ third-party companies to provide Services on our behalf, to
                  perform Service-related operations (for example, maintenance, database
                  management, analytics, server hosting, fraud detection, and improvement of
                  Senix features), or to assist us in analyzing how our Service is used.
                  These third parties may have access to your Personal Information only to
                  perform these tasks on our behalf. Examples include:
                </p>
                <ul>
                  <li>
                    <strong>Whop</strong> for checkout and subscription billing. Payment card
                    details are handled by Whop, not stored by Senix.
                  </li>
                  <li>
                    <strong>Supabase</strong> for authentication, database storage, and
                    row-level security isolation of account data.
                  </li>
                  <li>
                    <strong>Cloudflare</strong> for hosting and edge delivery of the Website
                    and APIs.
                  </li>
                  <li>
                    <strong>Upstash</strong> for optional queue and caching infrastructure.
                  </li>
                </ul>

                <h3>For our service integrations</h3>
                <p>
                  We allow Service integrations so the product can function. For example, we
                  integrate with:
                </p>
                <ul>
                  <li>
                    <strong>GitHub</strong> for repository access, webhooks, and pull request
                    comments. GitHub&apos;s privacy policy is available on github.com.
                  </li>
                  <li>
                    <strong>LLM providers</strong> (currently DeepSeek as the primary
                    provider, with Anthropic, Gemini, and Groq supported) to generate analysis
                    from pull request diffs. Diff content is sent for a single request to
                    produce your review. Senix does not use that content to train, refine, or
                    otherwise influence our own models. We configure providers so customer
                    review content is not retained for training where the provider offers that
                    control. Your Personal Information and review payloads are processed in
                    accordance with each provider&apos;s privacy policy and our configuration.
                  </li>
                </ul>

                <h3>For corporate transactions</h3>
                <p>
                  Senix may share information, including Personal Information, with any
                  current or future subsidiaries or affiliates, primarily for business and
                  operational purposes, in connection with a merger, acquisition,
                  reorganization, or sale of assets (including as part of due diligence with
                  any potential acquiring entity), or in the event of bankruptcy.
                </p>

                <h3>If required by law</h3>
                <p>
                  Senix will disclose information about you to government or law enforcement
                  officials or private parties as we, in our sole discretion, believe
                  necessary or appropriate to respond to claims and legal process (including
                  subpoenas), or at the request of governmental authorities or other third
                  parties conducting an investigation where we determine disclosure is
                  necessary to (a) protect the property and rights of Senix or a third party,
                  (b) protect the safety of the public or any person, or (c) prevent or stop
                  activity we may consider to be, or pose a risk of being, illegal,
                  fraudulent, unethical, or legally actionable.
                </p>

                <h3>With your consent</h3>
                <p>
                  You may submit Personal Information through a form on the Website or
                  through product feedback and consent to receive communication from us based
                  on that information.
                </p>
              </LegalSection>

              <LegalSection id="third-party" title="8. Third-party websites and links">
                <p>
                  Our Services may contain links and features to other websites or online
                  platforms operated by third parties. We do not control such other online
                  platforms and are not responsible for their content, their privacy
                  policies, or their use of your information.
                </p>
              </LegalSection>

              <LegalSection
                id="your-rights"
                title="9. Your rights and choices regarding your information"
              >
                <p>You have several ways to exercise control over your information:</p>
                <ul>
                  <li>
                    <strong>Account settings.</strong> You may access, update, or delete
                    certain personal information by using your Account settings in the
                    dashboard, including enabling or disabling analysis per repository and
                    managing installations.
                  </li>
                  <li>
                    <strong>Contact us.</strong> You may contact us to access, update, or
                    delete your personal information using the methods in{' '}
                    <a href="#contact">How to contact us</a>.
                  </li>
                  <li>
                    <strong>Email.</strong> You may opt out of receiving marketing emails by
                    following the opt-out instructions in those emails. We reserve the right
                    to send you certain communications relating to your account or use of the
                    Service (for example, administrative and service announcements). Those
                    transactional messages may be unaffected if you opt out of marketing
                    communications.
                  </li>
                </ul>

                <h3>European residents</h3>
                <p>
                  Under the General Data Protection Regulation (GDPR), Senix may be
                  considered a data controller to the extent that we process personal
                  information directly from European residents. To the extent that Senix is a
                  data controller, European residents may access, correct, update, or delete
                  their personal information; object to our processing; ask us to restrict
                  processing; or request portability of their personal information by using
                  account settings or contacting us as described below.
                </p>
                <p>
                  Upon request, Senix will provide you with information about whether we hold
                  any of your personal information. You are responsible for maintaining the
                  accuracy of the information you submit to us. If you submit a request to
                  access personal information you have submitted, we will respond within 30
                  days or as otherwise required by law.
                </p>
                <p>
                  We will use commercially reasonable efforts to honor deletion requests.
                  Certain residual information may persist even if you close your account.
                  Rights may be limited if fulfilling your request would reveal personal
                  information about another person, or if you ask us to delete information we
                  are required by law to keep or have compelling legitimate interests in
                  keeping (such as for fraud prevention). Personal Information may remain in
                  archives, and information you update or delete, or information within a
                  closed account, may persist internally for administrative purposes to the
                  extent permitted by law. It is not always possible to completely remove
                  information from our databases. If your information is deleted, your
                  account may become deactivated, and you will no longer be able to use the
                  Services.
                </p>
                <p>
                  Our Services require a minimum amount of Personal Information to function.
                  European residents who do not provide Personal Information (for example, by
                  not creating an account) may not be able to access full functionality.
                </p>

                <h3>California residents</h3>
                <p>
                  If you are a California resident, the California Consumer Privacy Act
                  (CCPA) may provide additional privacy rights with respect to our
                  collection, use, and disclosure of your Personal Information. To the extent
                  Senix is a covered business under the CCPA, you may contact us regarding:
                </p>
                <ul>
                  <li>
                    The right to know what Personal Information we have collected and how we
                    have used and disclosed it in the 12-month period preceding your request.
                    See <a href="#information-we-collect">Information we collect</a>,{' '}
                    <a href="#how-we-use">How we use your information</a>, and{' '}
                    <a href="#how-we-disclose">How we disclose and share your information</a>.
                  </li>
                  <li>The right to request deletion of your Personal Information.</li>
                  <li>
                    The right to be free from discrimination related to the exercise of any
                    of your privacy rights.
                  </li>
                  <li>
                    The right to opt out of the sale of your personal information, and to
                    request information about whether we have sold your personal information
                    in the past 12 months. Senix does not sell personal information, nor do
                    we share personal information with third parties for marketing purposes,
                    and we have not done so in the last year.
                  </li>
                </ul>
                <p>
                  To exercise these rights, contact us as described in{' '}
                  <a href="#contact">How to contact us</a>. We may require you to verify your
                  credentials by matching your email address or other account information
                  before you can submit a request. If you authorize another person to act as
                  your agent, unless you provide the agent with power of attorney under the
                  California Probate Code, we will ask the agent to provide written and
                  signed authorization, confirm with you that you provided it, and verify
                  your identity.
                </p>
              </LegalSection>

              <LegalSection id="international" title="10. International jurisdictions">
                <p>
                  Our servers and service providers may be located in the United States and
                  other regions. If you are accessing the Services from another country,
                  please be advised that you may be transferring your personal information to
                  such geographic areas, and you consent to that transfer, processing, and
                  storage in accordance with this Privacy Policy. You also agree to abide by
                  applicable US federal, state, and local laws concerning your use of the
                  Services and your agreements with us. Persons accessing our Services from
                  any jurisdiction with laws governing the Internet, including the
                  collection, use, or disclosure of personal information, different from
                  those mentioned above may only use the Services in a manner lawful in their
                  jurisdiction. If your use of the Services is unlawful in your jurisdiction,
                  you may not use our Services.
                </p>
              </LegalSection>

              <LegalSection id="security" title="11. Security">
                <p>
                  We use physical, technical, and organizational measures designed to protect
                  your information against unauthorized access, theft, and loss. Traffic is
                  encrypted in transit. GitHub webhooks are signature-verified on every
                  delivery. Supabase row-level security keeps each account isolated to its
                  own installations and reviews. We restrict access to personal information to
                  those who need it to service your account or perform their job functions.
                </p>
                <p>
                  Although we take precautions intended to help protect information that we
                  process, no system or electronic data transmission is completely secure.
                  Any transmission of your personal data is at your own risk, and we expect
                  that you will use appropriate security measures to protect your personal
                  information. You are responsible for maintaining the security of your
                  account. We may suspend your use of all or part of the Services if we
                  suspect or detect any breach of security. You understand and agree that we
                  may deliver electronic notifications about breaches of security to the
                  email address on record for your account.
                </p>
              </LegalSection>

              <LegalSection id="data-retention" title="12. Data retention, storage, and usage">
                <p>
                  Unless you request that we delete certain information (see{' '}
                  <a href="#your-rights">Your rights and choices</a>), we will retain your
                  personal information for the period necessary to fulfill the purposes
                  outlined in this Privacy Policy unless a longer retention period is
                  required or permitted by law. Criteria used to determine retention periods
                  include:
                </p>
                <ul>
                  <li>
                    The length of time we have an ongoing relationship with you and provide
                    services to you (for example, for as long as you have an account with us
                    or keep using the Website).
                  </li>
                  <li>
                    Whether there is a legal obligation to which we are subject (for example,
                    laws that require us to keep records of transactions for a certain
                    period).
                  </li>
                  <li>
                    Whether retention is advisable considering our legal position (such as
                    for statutes of limitations, litigation, or regulatory investigations).
                  </li>
                </ul>

                <h3>Code and analysis storage</h3>
                <p>
                  Senix analyzes pull request diffs on demand. We persist structural-diff
                  metadata and the generated summary for your dashboard and comment history.
                  We do not persist your raw source files. You can enable or disable analysis
                  per repository from your settings, and revoke GitHub App access at any time
                  from GitHub or your Senix dashboard.
                </p>
              </LegalSection>

              <LegalSection id="changes" title="13. Changes to this Policy">
                <p>
                  Senix may update this Privacy Policy at any time, and any changes will be
                  effective upon posting. If there are material changes to the way we treat
                  your Personal Information, we will update the Last Modified date at the top
                  of this Policy. We may also notify you by email, in our discretion.
                </p>
              </LegalSection>

              <LegalSection id="contact" title="14. How to contact Senix">
                <p>
                  If you have questions about this Privacy Policy or want to exercise your
                  privacy rights, contact us through the Feedback control in your Senix
                  dashboard, or write to us at{' '}
                  <a href="mailto:privacy@senix.dev">privacy@senix.dev</a>.
                </p>
                <p>
                  For product documentation related to data handling, see the{' '}
                  <Link href="/docs/faq">FAQ</Link> and{' '}
                  <Link href="/docs/configuration">configuration</Link> docs.
                </p>
              </LegalSection>
    </TraeLegalPageShell>
  );
}
