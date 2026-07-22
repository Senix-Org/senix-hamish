'use client';

import Link from 'next/link';
import { LegalSection, TraeLegalPageShell } from './legal-page-shell';

const LAST_MODIFIED = 'July 21, 2026';

const TOC = [
  { id: 'agreement', label: 'Agreement' },
  { id: 'definitions', label: '1. Definitions' },
  { id: 'provision', label: '2. Provision of services' },
  { id: 'accounts', label: '3. Customer accounts' },
  { id: 'obligations', label: '4. Customer obligations' },
  { id: 'term', label: '5. Term and termination' },
  { id: 'ip', label: '6. Intellectual property' },
  { id: 'confidential', label: '7. Confidentiality' },
  { id: 'fees', label: '8. Fees' },
  { id: 'warranty', label: '9. Limited warranty' },
  { id: 'indemnification', label: '10. Indemnification' },
  { id: 'liability', label: '11. Limitation of liability' },
  { id: 'marketing', label: '12. Marketing' },
  { id: 'miscellaneous', label: '13. Miscellaneous' },
] as const;

/**
 * Terms of Service surface. Layout matches Privacy; copy follows a
 * standard SaaS ToS structure adapted to Senix (GitHub App, Whop
 * billing, LLM review pipeline).
 */
export function TraeTermsOfServicePage(): React.ReactElement {
  return (
    <TraeLegalPageShell
      titleLead="Terms of"
      titleAccent="Service"
      description="The agreement that governs your access to and use of Senix, whether as a guest or a registered user."
      lastModified={LAST_MODIFIED}
      toc={TOC}
      tocAriaLabel="Terms of Service sections"
    >
      <LegalSection id="agreement" title="Terms of Service">
        <p>
          This Agreement is a contract entered into by and between You
          (&quot;you&quot; or &quot;Customer&quot;) and Senix (&quot;Senix,&quot; &quot;We,&quot; or
          &quot;us&quot;) and our affiliates, to the extent expressly stated. These terms and
          conditions (together with our{' '}
          <Link href="/privacy">Privacy Policy</Link>, these &quot;Terms of Service&quot; or
          &quot;Terms&quot; or &quot;Agreement&quot;) govern your access to and use of the Services
          offered by Senix, whether as a guest or registered user.
        </p>
        <p>
          Please read these Terms of Service carefully before you start to use or access our
          Services. By using our Services, you accept and agree to be bound by and abide by
          these Terms. If you are entering into these Terms on behalf of an entity, such as
          the company you work for, you represent that you have authority to bind such entity
          and you agree that &quot;you&quot; as used in these Terms includes both you individually
          and the entity you represent. If you are not eligible or do not agree to these Terms
          of Service, then you do not have permission to use the Service and you must not
          access or use our Services.
        </p>
        <p>
          <strong>ARBITRATION NOTICE.</strong> Except where prohibited by applicable law, you
          agree that disputes arising under these Terms will be resolved by binding, individual
          arbitration, and BY ACCEPTING THESE TERMS, YOU AND SENIX ARE EACH WAIVING THE RIGHT
          TO A TRIAL BY JURY OR TO PARTICIPATE IN ANY CLASS ACTION OR REPRESENTATIVE
          PROCEEDING.
        </p>
      </LegalSection>

      <LegalSection id="definitions" title="1. Definitions">
        <p>
          <strong>1.1 &quot;Affiliate&quot;</strong> means any entity that directly or indirectly
          controls, is controlled by, or is under common control with Customer.
          &quot;Control,&quot; for purposes of this definition, means direct or indirect ownership
          or control of more than 50% of the voting interests of the subject entity.
        </p>
        <p>
          <strong>1.2 &quot;App&quot;</strong> means our web application and dashboard known as
          Senix, available at{' '}
          <a href="https://senix.dev">https://senix.dev</a>.
        </p>
        <p>
          <strong>1.3 &quot;Customer Data&quot;</strong> means any folders, data, text, and any
          other works of authorship or other works, including source code, pull request diffs,
          and metadata submitted or otherwise transmitted by Customer to the Services.
        </p>
        <p>
          <strong>1.4 &quot;Feedback&quot;</strong> means any changes requested or suggestions,
          improvements, or modifications made by Customer or its Users to the Services,
          Senix&apos;s Confidential Information, or any embodiments thereof.
        </p>
        <p>
          <strong>1.5 &quot;Intellectual Property Rights&quot;</strong> means all patents,
          registered designs, unregistered designs, design rights, utility models, semiconductor
          topography rights, database rights, copyright and other similar statutory rights,
          trade mark, service mark, and any know how relating to algorithms, drawings, tests,
          reports and procedures, models, manuals, formulae, methods, processes and the like
          (including applications for any of the preceding rights) or any other intellectual or
          industrial property rights of whatever nature in each case in any part of the world
          and whether or not registered or registerable, for the full period and all extensions
          and renewals where applicable.
        </p>
        <p>
          <strong>1.6 &quot;Order Form&quot;</strong> means an ordering document submitted in
          person or online entered into by the Parties or submitted online or via a third-party
          marketplace (including Whop checkout), specifying, among other things, the applicable
          plan, usage limits, the initial Term, and such other terms as agreed by the Parties.
        </p>
        <p>
          <strong>1.7 &quot;Output&quot;</strong> means any feedback, behavioral summary, risk
          tags, focus-file suggestions, or other analysis generated via the Services in response
          to Customer&apos;s inputs.
        </p>
        <p>
          <strong>1.8 &quot;Services&quot;</strong> means Senix&apos;s proprietary AI-driven pull
          request review tool that analyzes code changes and provides behavioral summaries, risk
          tags, and related insights, and includes the Website, App, GitHub App, playground, MCP
          integration, and any related software, application, content, functionality, and
          services.
        </p>
        <p>
          <strong>1.9 &quot;Users&quot;</strong> means employees or contractors that Customer
          authorizes to use the Services.
        </p>
      </LegalSection>

      <LegalSection id="provision" title="2. Provision of services and support">
        <p>
          <strong>2.1 Grant.</strong> Subject to the terms and conditions of this Agreement,
          Senix grants to Customer a worldwide, non-exclusive, non-sublicensable, and
          non-transferable right to access and use the Services during the Term and to permit
          Users to use such Services solely for Customer&apos;s internal business purposes. Senix
          reserves the right to modify the Services from time to time in its sole discretion,
          provided that Senix will notify Customer via the Services or the published
          documentation if the modifications materially diminish the functionality of the
          Services.
        </p>
        <p>
          <strong>2.2 No Other Rights.</strong> The license granted to Customer is expressly set
          forth above. No other rights or licenses are granted by Senix, whether by implication,
          estoppel, or otherwise. All rights not expressly granted herein are reserved by Senix.
        </p>
        <p>
          <strong>2.3 No Support.</strong> Senix is under no obligation to provide support for
          the Services. In instances where we may offer support, the support will be subject to
          published policies and, if applicable, fees as agreed upon by the Parties in an Order
          Form.
        </p>
        <p>
          <strong>2.4 Beta Products and Free Trials.</strong> Certain services (including the
          Services), features, or functionality may be made available in exchange for no fees by
          Senix (a &quot;Free Trial&quot; or Free plan) or may be designated as &quot;Beta,&quot;
          &quot;Early Access,&quot; &quot;Preview,&quot; or similar (collectively with Free Trials,
          &quot;Beta Products&quot;). Senix reserves the right to modify or terminate any Beta
          Products at any time and without notice. Notwithstanding any other section of this
          Agreement, all Beta Products are provided for evaluation purposes only, &quot;as
          is&quot; and without any representations, warranties, indemnifications, support, or
          SLAs, and Senix&apos;s liability with respect to Free Trials and Free plan usage shall
          be limited to an aggregate amount of $1,000. Beta Products may never be made generally
          available, and participation in a beta program does not guarantee continued access or
          future pricing. Customer is solely responsible for determining whether Beta Products
          are appropriate for its use case, including with respect to any Customer Data that may
          be provided to Beta Products.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="3. Customer accounts; third-party accounts">
        <p>
          <strong>3.1 Customer Accounts.</strong> To use the Services, Customer will have to
          register for a Senix Customer Account (&quot;Account&quot;), typically by signing in
          with GitHub. Customer is responsible for maintaining the security and confidentiality
          of its Account information and agrees that Customer is solely responsible for all
          losses incurred due to someone else using its Account as a result of Customer failing
          to keep its Account information secure and confidential. Customer may enable or disable
          analysis per repository from Account settings.
        </p>
        <p>
          <strong>3.2 Third-Party Accounts.</strong> In order to register an Account, Customer
          will be required to connect to the Services via its pre-existing account with GitHub.
          In addition, the Services may include features or functionality for Customer to connect
          to its pre-existing accounts with other third-party providers (each, a &quot;Third-Party
          Account&quot;). By connecting a Third-Party Account to the Services, Customer authorizes
          Senix to access Customer&apos;s Third-Party Account in order to provide the Services.
          Customer controls the scope of the authority granted to Senix to the extent permitted by
          the Third-Party Account (for example, selecting which repositories the GitHub App may
          access). Senix does not license or endorse and has no liability or obligation of any
          kind related to any Third-Party Accounts used by Customer, and Senix does not have any
          responsibility for or liability with respect to Customer&apos;s ability to utilize a
          Third-Party Account. Customer&apos;s use of the Third-Party Account is governed solely
          by its agreement with the applicable Third-Party Account provider (&quot;Third-Party
          Terms&quot;). Customer represents and warrants that it has all necessary rights,
          consents, authorizations, and permissions to grant Senix access to its Third-Party
          Accounts as described in this Agreement without any breach by Customer of any
          Third-Party Terms and without subjecting Senix to any payment obligations, usage
          limitations, or other liabilities.
        </p>
        <p>
          <strong>3.3 AI.</strong> Senix&apos;s Services use artificial intelligence, powered via
          API integration by DeepSeek and, as configured, Anthropic, Gemini, Groq, or other
          third-party AI model providers with whom Senix may partner (each, a &quot;Third-Party AI
          Model Provider&quot;). Customer&apos;s proprietary code remains confidential with Senix.
          While pull request diff content is shared with Third-Party AI Model Providers to
          generate Output, Senix configures providers so Customer review content is not retained
          for training where the provider offers that control. Neither Senix nor its Third-Party
          AI Model Providers use Customer&apos;s code to train any AI models under Senix&apos;s
          configuration. Senix does not persist Customer&apos;s raw source files; it persists
          structural-diff metadata and generated summaries as described in the{' '}
          <Link href="/privacy">Privacy Policy</Link>. Senix is not responsible for the accuracy,
          completeness, availability, timeliness, validity, copyright compliance, legality,
          decency, quality, security, or any other aspect of any output or content provided or
          made available by any third party, provided that Senix will use commercially reasonable
          efforts to monitor third-party outputs provided to Customers as part of the Services by
          third parties.
        </p>
      </LegalSection>

      <LegalSection id="obligations" title="4. Customer obligations">
        <p>
          <strong>4.1 Responsibilities.</strong> Customer agrees to use the Services only in
          accordance with this Agreement and in compliance with all applicable laws, rules, and
          regulations, including all applicable export control, sanctions, and anti-boycott laws
          of any relevant jurisdiction. Customer represents that neither it nor any of its Users
          is prohibited from receiving or using the Services under such laws. Customer shall be
          responsible for Users&apos; use of the Services and any breach by a User of the terms of
          this Agreement shall be deemed to be a breach by Customer. Customer will promptly notify
          Senix if at any time it becomes aware of unauthorized or illegal use of the Services by
          any party.
        </p>
        <p>
          <strong>4.2 Limitations.</strong> Customer and its Users shall not and shall not permit
          or assist any other party to: (i) use the Services in violation of any applicable law,
          including the EU Artificial Intelligence Act, as may be amended, regulation, or export
          control requirement or to infringe, misappropriate, or violate the rights (including
          Intellectual Property Rights) of any third party, or for any purpose other than as
          expressly permitted under this Agreement; (ii) decompile, disassemble, reverse engineer
          or otherwise attempt to derive the source code, underlying ideas, techniques, structure
          or algorithms of the Services; (iii) copy, modify, translate, create derivative works
          of, distribute, rent, lease, sell, sublicense or otherwise transfer or make available
          the Services or any portion thereof; (iv) disclose the results of any benchmarking of
          the Services, or use the Services to develop competing products or services without
          Senix&apos;s prior written consent; (v) attempt to circumvent or disable any security or
          access controls of the Services, or use the Services in any manner that disrupts,
          damages, or impairs Senix&apos;s systems or the use of the Services by others; or (vi)
          use any automated system or software (including robots, spiders, or scripts) to extract
          data or content from the Services, or introduce any harmful, fraudulent, deceptive,
          threatening, harassing, defamatory, libelous, obscene, or otherwise objectionable or
          unlawful content or any viruses, malware, or other harmful code by any means; (vii) use
          the Services: (a) to deploy subliminal techniques beyond a person&apos;s consciousness or
          purposefully use manipulative or deceptive techniques that materially distort
          people&apos;s behavior by impairing their ability to make informed decisions; (b) to
          exploit any of the vulnerabilities of a natural person or a specific group of persons
          due to their age, disability or a specific social or economic situation; (c) to infer
          emotions of individuals in the areas of workplace and educational institutions; (d) to
          create or expand facial recognition databases through the untargeted scraping of facial
          images from the internet or CCTV footage; or (e) to categorize individual natural
          persons based on their biometric data to deduce or infer their race, political opinions,
          trade union membership, religious or philosophical beliefs, sex life, or sexual
          orientation; or (viii) transmit or upload any Customer Data that is (a) sensitive data
          as defined under the General Data Protection Regulation (GDPR) or applicable laws (for
          example, data relating to race, religion, politics, health, genetics, or sexual
          orientation); (b) personal, medical, or other protected health information; (c)
          financial information, including but not limited to credit and debit card information;
          (d) social security numbers or other government identifiers; (e) controlled unclassified
          information, covered defense information, or other government data; or (f) protected
          data about minors (such as data protected by the Children&apos;s Online Privacy
          Protection Act).
        </p>
      </LegalSection>

      <LegalSection id="term" title="5. Term and termination">
        <p>
          <strong>5.1 Term.</strong> Subject to earlier termination as expressly provided for in
          this Agreement, the initial Term of this Agreement shall be for the Term specified in
          the Order Form or selected plan, or in the event of multiple Order Forms, until the Term
          of all Order Forms has expired. Each paid subscription and this Agreement shall
          automatically renew after the initial Term and any renewal Term for a renewal Term equal
          to the expiring Term, unless either party provides to the other prior notice that it will
          not renew in accordance with the cancellation process for the applicable billing
          provider (including Whop) or at least forty-five (45) days prior written notice where no
          such process applies.
        </p>
        <p>
          <strong>5.2 Termination for Cause.</strong> Either party may terminate this Agreement or
          an Order Form for cause: (i) if the other Party is in material breach under this
          Agreement and fails to cure such breach within thirty (30) days of receipt of written
          notice of such material breach; or (ii) immediately if the other Party becomes the
          subject of a petition in bankruptcy or any other proceeding relating to insolvency,
          receivership, liquidation or assignment for the benefit of creditors. Upon any
          termination for cause by Customer, Senix shall refund to Customer any prepaid, unused
          fees applicable to the remaining portion of the Term following the effective date of
          termination, subject to the refund policies of any third-party payment provider.
        </p>
        <p>
          <strong>5.3 Termination or Suspension by Senix.</strong> Senix may suspend or terminate
          permission and access to the Account or Services: (i) if required to avoid harm to Senix
          or any third party, including for Customer&apos;s fraudulent or illegal activities; (ii)
          upon 30 days&apos; prior written notice, upon Customer&apos;s failure to pay any fees
          when due; and (iii) upon the request of law enforcement or government agencies. If
          possible, Senix will notify Customer of such suspension or termination as early as
          commercially reasonable.
        </p>
        <p>
          <strong>5.4 Effect of Termination.</strong> Upon expiration or earlier termination of
          this Agreement, Customer shall immediately discontinue use of the Services and all
          rights and obligations will immediately terminate, except that any terms or conditions
          that by their nature should survive such termination will survive, including Sections
          3 through 13. No expiration or termination will affect Customer&apos;s obligation to pay
          all fees due, whether invoiced or not, before such expiration or termination, or entitle
          Customer to any refund, with the exception of termination for cause by Customer as
          expressly set forth in Section 5.2 above. Customer is solely responsible for retaining
          copies of any Customer Data uploaded to the Services, as upon termination of
          Customer&apos;s Account, Customer will lose access rights to any Customer Data uploaded
          to the Services. If the Agreement has been terminated for cause by Senix, Customer is
          prohibited from creating a new account on the Services using a different name, email
          address, or other forms of account verification.
        </p>
      </LegalSection>

      <LegalSection id="ip" title="6. Intellectual property rights">
        <p>
          <strong>6.1 Senix IP Rights.</strong> Senix alone, and where applicable its licensors,
          retain all Intellectual Property Rights relating to the Services and the Senix
          Confidential Information and any suggestions, ideas, enhancement requests related
          thereto, as well as any Feedback which is hereby assigned to Senix.
        </p>
        <p>
          <strong>6.2 Customer IP Rights.</strong> Customer shall retain all right, title, and
          interest in and to Customer Data, which for clarity is Customer Confidential
          Information. Senix is not obligated to back up Customer Data, and it may be deleted
          without notice. Senix will use Customer Data to generate Output. Subject to
          Customer&apos;s compliance with this Agreement, including but not limited to paying all
          fees when due, Senix hereby assigns to Customer all of its rights, title and interest
          (if any) in and to the Output. The Services may provide the same or similar Output to
          others, and Senix&apos;s assignment to Customer in the preceding sentence does not apply
          to any outputs resulting from other users&apos; use of the Services. The Services may
          collect and aggregate data derived from the operation of the Services (&quot;Aggregated
          Data&quot;); provided that Aggregated Data shall not identify Customer, Customer Data,
          or Customer Confidential Information. Customer agrees that Senix may use Aggregated Data
          and Output to (a) provide, maintain, protect and improve the Services or operate its
          business; (b) comply with applicable law; and (c) enforce this Agreement.
        </p>
      </LegalSection>

      <LegalSection id="confidential" title="7. Confidential information and data protection">
        <p>
          <strong>7.1 Definition.</strong> Customer or Senix (&quot;Disclosing Party&quot;) may
          disclose or make available to the other Party (&quot;Receiving Party&quot;), information
          about Disclosing Party or Disclosing Party&apos;s Affiliates&apos; business affairs,
          products, confidential intellectual property, trade secrets, financial information,
          third-party confidential information, and other sensitive or proprietary information,
          whether in written, electronic, or any other form or media, that is identified as
          confidential at the time of disclosure or should be reasonably known by Receiving Party
          to be confidential or proprietary due to the nature of the information disclosed and the
          circumstances surrounding the disclosure (&quot;Confidential Information&quot;).
          Senix&apos;s software, applications, scripts, code, plug-ins and technology incorporated
          in the Services, the design and layout of the Senix user interface, all pricing
          information relating to the Services, and the terms and conditions of this Agreement
          (including all Order Forms) shall be deemed the Confidential Information of Senix
          without any marking or further designation. Customer&apos;s proprietary code, Customer
          Data and Output shall be deemed the Confidential Information of Customer. Confidential
          Information does not include information that: (a) is or becomes publicly known through
          no fault of the Receiving Party, its service providers, or service integration
          providers, or their representatives; (b) is already rightfully known to the Receiving
          Party at the time of disclosure; (c) is rightfully obtained and on a non-confidential
          basis from a third party without breach of any confidentiality obligation; or (d) is
          independently developed by or on behalf of the Receiving Party without access to or use
          of any Confidential Information of the Disclosing Party.
        </p>
        <p>
          <strong>7.2 Use.</strong> The Receiving Party will use Confidential Information of the
          Disclosing Party only in the performance of this Agreement. The Receiving Party shall
          maintain in confidence all Confidential Information and shall not disclose Confidential
          Information to any person or entity, except to the employees, agents, or subcontractors
          who have a legitimate need to know to perform their obligations hereunder and who are
          required to protect the Confidential Information in a manner no less stringent than
          required under this Agreement. Notwithstanding the foregoing, the Receiving Party, its
          service providers, or service integration providers, or their representatives may be
          required to disclose the Disclosing Party&apos;s Confidential Information (a) to comply
          with the order of a court or other governmental body, or as otherwise necessary to
          comply with applicable law, only after providing notice to the Disclosing Party (if
          reasonably possible) and giving the Disclosing Party a reasonable opportunity to respond
          to such order; or (b) to establish Receiving Party&apos;s rights under this Agreement,
          including to make required court filings.
        </p>
        <p>
          <strong>7.3 Return or Destruction.</strong> Promptly after Disclosing Party&apos;s
          request, Receiving Party agrees to return or destroy the Disclosing Party&apos;s
          Confidential Information; provided, however, that Receiving Party shall be entitled to
          retain copies of Confidential Information solely to the extent necessary for purposes of
          such party&apos;s ordinary course records retention and backup policies and procedures,
          or to comply with applicable law, provided that such Confidential Information is treated
          as such for so long as it is retained. Each party acknowledges the irreparable harm that
          improper disclosure of Confidential Information may cause; therefore, the injured party
          will be entitled to seek immediate injunctive and other equitable relief, in addition to
          all other remedies, for any violation or threatened violation of this Section or Section
          4.2 &quot;Limitations.&quot;
        </p>
        <p>
          <strong>7.4</strong> Use of the Services may involve the transmission of personal
          information which is governed by the Privacy Policy, made available at{' '}
          <Link href="/privacy">https://senix.dev/privacy</Link>. Senix maintains technical and
          organizational measures designed to protect the confidentiality, integrity,
          availability, and security of the Services and Customer Data, as more fully described in
          the Privacy Policy. The Privacy Policy is hereby incorporated into and shall be fully
          governed by this Agreement.
        </p>
      </LegalSection>

      <LegalSection id="fees" title="8. Fees">
        <p>
          <strong>8.1 Payments.</strong> Customer agrees to pay Senix the applicable fees set
          forth in all Order Forms, plan selections, and subsequent invoices. Fees are based on
          the applicable plan tier selected by Customer (including Free, Starter, Team, and Pro,
          as offered from time to time) and the associated repository and token or usage limits,
          as well as any applicable usage billing rates incurred during the applicable billing
          period as reflected in Customer&apos;s Account. Paid plans are processed through Whop or
          another Authorized Service Provider. If Customer&apos;s payment plan includes an ongoing
          subscription that is automatically renewed periodically, Customer hereby authorizes
          Senix and its payment providers to bill Customer&apos;s payment instrument in advance on
          such periodic basis in accordance with the terms of the applicable Order Form until the
          expiration or termination of the applicable Order Form, and Customer further agrees to
          pay any and all charges so incurred. Senix may update fees from time to time, provided
          that any changes will take effect at the start of the next applicable billing cycle, and
          Senix will provide Customer with reasonable prior notice of any increase. Continued use
          of the Services after the new fees take effect constitutes acceptance of the updated
          pricing.
        </p>
        <p>
          <strong>8.2 Taxes.</strong> Taxes payable by Customer may be calculated based on the
          billing information provided at the time of purchase. Customer will pay all applicable
          Taxes, excluding only those based on Senix&apos;s income. If Customer is compelled to
          make a deduction or set-off for any such Taxes, Customer will pay Senix such additional
          amounts as necessary to ensure receipt by Senix of the full amount Senix would have
          received but for the deduction. Any applicable direct pay permits or valid tax-exempt
          certificates must be provided to Senix prior to the execution of this Agreement. If
          Senix or its payment provider is required to collect and remit Taxes on Customer&apos;s
          behalf, Customer will be invoiced for such Taxes and will pay them in accordance with
          Section 8.1.
        </p>
      </LegalSection>

      <LegalSection id="warranty" title="9. Limited warranty; disclaimer">
        <p>
          <strong>9.1 Limited Warranty.</strong> Senix warrants for the benefit of Customer only
          that the Services will perform materially in accordance with Senix&apos;s published
          documentation under normal use and circumstances in accordance with this Agreement (the
          &quot;Services Warranty&quot;) for a period of thirty (30) days after the Services are
          first made available to Customer (&quot;Warranty Period&quot;). If any non-conformity
          covered by the Services Warranty occurs, Customer will provide Senix with sufficient
          detail to allow Senix to reproduce the non-conformity, and, if the non-conformity is
          verified by Senix, Senix will, at its sole option, either (a) correct such
          non-conformity in the Services, at no cost to Customer and within a reasonable time, by
          issuing corrected instructions, a restriction, or a bypass, or (b) accept Customer&apos;s
          return of the Services and refund any fees previously paid by Customer for Services for
          the period after the nonconformity was identified, at which time this Agreement and all
          Order Forms will immediately terminate. The foregoing sentence sets forth Customer&apos;s
          sole and exclusive remedy for Senix&apos;s breach of the warranty described in this
          Section 9.1. Senix is not responsible for any non-conformity not reported during the
          Warranty Period or any non-conformity caused by modification, misuse of, or damage to
          the Services not done or approved by Senix.
        </p>
        <p>
          <strong>9.2 DISCLAIMERS.</strong> EXCEPT AS EXPRESSLY STATED IN SECTION 9.1, SENIX
          PROVIDES THE SERVICES &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; AND MAKES NO
          REPRESENTATIONS OR WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY,
          INCLUDING ANY WARRANTIES OF TITLE, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          AND NON-INFRINGEMENT. SENIX DOES NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED,
          ERROR-FREE, OR FREE OF HARMFUL COMPONENTS, OR THAT ANY DATA, CONTENT, OR RESULTS
          OBTAINED FROM THE SERVICES WILL BE ACCURATE OR RELIABLE OR THAT THE SERVICES OR ANY
          OUTPUT WILL MEET CUSTOMER&apos;S REQUIREMENTS OR ACHIEVE ANY PARTICULAR RESULT. CUSTOMER
          USES THE SERVICES AT ITS OWN RISK. THE SERVICES MAY USE ARTIFICIAL INTELLIGENCE OR
          MACHINE LEARNING AND ARE SUBJECT TO UNEXPECTED OUTPUTS AND RESULTS, INCLUDING RESULTS
          THAT ARE INCOMPLETE, INACCURATE, OR UNEXPECTED. SENIX IS NOT LIABLE FOR ANY ERRORS,
          OMISSIONS, OR OFFENSIVE MATERIAL IN OUTPUT. TO THE FULLEST EXTENT PERMITTED BY LAW,
          SENIX DISCLAIMS ALL WARRANTIES NOT EXPRESSLY SET OUT IN SECTION 9.1 OF THIS AGREEMENT.
        </p>
      </LegalSection>

      <LegalSection id="indemnification" title="10. Indemnification">
        <p>
          <strong>10.1 By Customer.</strong> Customer agrees to indemnify and hold Senix, its
          suppliers, licensors and partners, and the officers, directors, employees, agents and
          representatives of each of them harmless, including costs, liabilities and legal fees,
          from any claim or demand made by any third party (a &quot;Claim&quot;) due to or arising
          out of (i) a claim of infringement or misappropriation of any Intellectual Property Right
          by Customer, or any third party using Customer&apos;s Account, or (ii) Customer Data.
        </p>
        <p>
          <strong>10.2 By Senix.</strong> Senix agrees to indemnify, defend, and hold Customer and
          its officers, directors, employees, agents and representatives harmless, including costs,
          liabilities and legal fees, from any Claim made by any third party against Customer
          alleging that the Services infringe or misappropriate any patent, copyright, or trade
          secret of such third party. Senix shall have no indemnification obligation for
          infringement claims arising from the combination of the Services with any services,
          hardware, data or business processes not provided by Senix or use of the Services by
          Customer other than in accordance with the Agreement. If the Services are held or likely
          to be held infringing, Senix shall have the option, at its expense, to (i) replace or
          modify the Services as appropriate, (ii) obtain a license for Customer to continue using
          the Services, (iii) replace the Services with a functionally equivalent product or
          service; or (iv) terminate this Agreement and refund any prepaid, unused fees applicable
          to the remaining portion of the Term. This Section 10.2 states Senix&apos;s entire
          liability and Customer&apos;s exclusive remedy for any claim of intellectual property
          infringement.
        </p>
        <p>
          <strong>10.3 Indemnification Process.</strong> Promptly upon receiving notice of a Claim,
          the Party seeking to be indemnified shall (a) give the indemnifying Party prompt written
          notice of the Claim; (b) give the indemnifying Party sole control of the defense and
          settlement of the Claim; and (c) provide the indemnifying Party, at the indemnifying
          Party&apos;s cost, all reasonable assistance in the defense or settlement of such Claim.
          The Party seeking to be indemnified shall have the right to participate in such defense
          with counsel of its own choosing and at its own expense.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="11. Limitation of liability">
        <p>
          <strong>11.1 WAIVER OF CONSEQUENTIAL DAMAGES.</strong> EXCEPT FOR CUSTOMER&apos;S BREACH
          OF SECTION 4 (CUSTOMER OBLIGATIONS) OR EITHER PARTY&apos;S BREACH OF SECTION 7
          (CONFIDENTIAL INFORMATION AND DATA PROTECTION), TO THE FULLEST EXTENT PERMITTED BY LAW,
          IN NO EVENT WILL EITHER PARTY BE LIABLE FOR ANY INDIRECT, SPECIAL, INCIDENTAL,
          EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES, ARISING OUT OF OR RELATING TO THIS
          AGREEMENT, INCLUDING THE SERVICES, OUTPUT, AND CONFIDENTIAL INFORMATION PROVIDED
          HEREUNDER, REGARDLESS OF THE FORM OF ACTION WHETHER IN CONTRACT, TORT (INCLUDING
          NEGLIGENCE) OR OTHERWISE, EVEN IF A PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH
          DAMAGES.
        </p>
        <p>
          <strong>11.2 LIMITATION OF LIABILITY.</strong> TO THE FULLEST EXTENT PERMITTED BY LAW,
          IN NO EVENT WILL SENIX&apos;S TOTAL LIABILITY TO CUSTOMER FOR ALL DAMAGES, LOSSES OR
          CAUSES OF ACTION ARISING OUT OF OR RELATING TO THE USE OF OR INABILITY TO USE ANY
          PORTION OF THE SERVICES OR OTHERWISE UNDER THIS AGREEMENT, WHETHER IN CONTRACT, TORT,
          OR OTHERWISE EXCEED THE AMOUNT CUSTOMER HAS PAID SENIX IN THE LAST TWELVE (12) MONTH
          PERIOD IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE LIABILITY.
        </p>
        <p>
          <strong>11.3 Acknowledgement.</strong> The parties agree that the disclaimers,
          exclusions, and limitations of liability set forth in this Agreement are an essential
          basis of the bargain between them and will apply even if any limited remedy fails of its
          essential purpose.
        </p>
      </LegalSection>

      <LegalSection id="marketing" title="12. Marketing">
        <p>
          Senix may use Customer&apos;s name and logo on Senix&apos;s website and in sales
          presentations, and Customer may use Senix&apos;s name and logo on its website, in each
          case for the sole purpose of identifying Customer as a customer of Senix. If applicable,
          in accordance with the Order Form, Customer may agree to participate in a case study
          with prior written consent of both parties.
        </p>
      </LegalSection>

      <LegalSection id="miscellaneous" title="13. Miscellaneous">
        <p>
          The relationship of the Parties established by this Agreement is that of independent
          contractors and is non-exclusive. There are no third-party beneficiaries to this
          Agreement. This Agreement is governed by the laws of the State of California, without
          reference to conflict of laws rules, and the federal, state, and local courts in San
          Francisco, California have exclusive jurisdiction over all actions arising hereunder.
          Any notice permitted or required to be given to a Party under this Agreement shall be
          sent to the address for such Party specified in any Order Forms or online submissions by
          Customer, including by email to{' '}
          <a href="mailto:legal@senix.dev">legal@senix.dev</a>, and such address may be changed
          by giving written notice to the other Party. If any part of this Agreement is held
          invalid or unenforceable, it will be revised as necessary to make it valid and
          enforceable, or, if not capable of being so revised, will be deemed severed from this
          Agreement, and the remainder of this Agreement will survive unaffected. Neither Party
          shall assign this Agreement or any of its rights or obligations under this Agreement
          without the other Party&apos;s prior written consent, and any such attempted assignment
          will be void and of no effect, provided, however, that either Party may assign this
          Agreement and all of its rights and obligations hereunder without the prior consent of
          the other Party to an Affiliate or in the event of a merger or acquisition. Subject to
          the foregoing restrictions, this Agreement is binding upon and will inure to the benefit
          of the successors, heirs, and permitted assigns of the parties. Each Party represents
          and warrants to the other Party that it has all requisite corporate power and authority
          to enter into and perform its obligations under this Agreement and that the individual
          executing this Agreement on behalf of such Party is authorized to do so. This Agreement
          is the entire agreement between the parties and supersedes all prior agreements and
          understandings concerning the subject matter hereof and may not be amended or modified
          except by a writing signed by both parties. Notwithstanding the foregoing, no force or
          effect shall be given to any different or additional terms contained in any purchase
          order or other vendor form issued by Customer, even if signed by Senix after the date
          hereof. In case of any conflict between this Agreement and the Privacy Policy, the
          Privacy Policy will govern with respect to personal information. No failure or delay by
          either Party in exercising any right, power, or remedy under this Agreement shall
          operate as a waiver of any such right, power or remedy.
        </p>
      </LegalSection>
    </TraeLegalPageShell>
  );
}
