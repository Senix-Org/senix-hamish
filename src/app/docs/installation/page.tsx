import type { Metadata } from 'next';
import {
  DocCallout,
  DocH2,
  DocH3,
  DocNextLink,
  DocOL,
  DocP,
  DocPageHeader,
  DocSteps,
  DocStep,
  DocTable,
  InlineCode,
} from '@features/shared/components/docs/doc-elements';
import { getAppBaseUrl } from '@features/shared/mcp-config';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Installing the GitHub App',
  description: 'Step-by-step guide to installing the Senix GitHub App.',
  path: '/docs/installation',
});

export default function InstallationPage(): React.ReactElement {
  return (
    <>
      <DocPageHeader
        title="Installing the GitHub App"
        lead={
          <>
            The GitHub App is the fastest way to get Senix running. Once installed, every pull
            request in your selected repositories gets reviewed automatically.
          </>
        }
      />

      <DocH2>Step-by-step</DocH2>
      <DocSteps>
        <DocStep step={1} title="Sign in to Senix">
          Go to{' '}
          <InlineCode>{getAppBaseUrl().replace(/^https?:\/\//, '')}</InlineCode> and sign in
          with your GitHub account.
        </DocStep>
        <DocStep step={2} title="Install the app">
          Click <strong className="text-primary">Install GitHub App</strong> from your
          dashboard.
        </DocStep>
        <DocStep step={3} title="Choose account">
          Select your personal account or an organization.
        </DocStep>
        <DocStep step={4} title="Select repositories">
          Choose all repositories or a specific subset.
        </DocStep>
        <DocStep step={5} title="Authorize permissions">
          Approve the requested permissions. Senix never writes to your code.
        </DocStep>
        <DocStep step={6} title="Done">
          You&apos;ll land on a confirmation page and be redirected back to your dashboard.
        </DocStep>
      </DocSteps>

      <DocCallout variant="info" title="Organization installs">
        Organization installs require admin permission. If you are not an owner, GitHub
        routes the install through an approval flow.
      </DocCallout>

      <DocH2>Required permissions</DocH2>
      <DocP>
        Senix asks for the minimum scopes needed to read diffs and post a review comment. It
        never writes to your code, opens PRs, or approves changes.
      </DocP>
      <DocTable
        head={['Permission', 'Why Senix needs it']}
        rows={[
          [
            <InlineCode key="c">read: code &amp; metadata</InlineCode>,
            'To understand what files changed in PRs',
          ],
          [
            <InlineCode key="p">read &amp; write: pull requests</InlineCode>,
            'To post and update the review comment',
          ],
        ]}
      />

      <DocH2>Revoking access</DocH2>
      <DocH3>Uninstall the GitHub App</DocH3>
      <DocOL>
        <li>
          Go to <InlineCode>github.com/settings/installations</InlineCode>, or the
          organization equivalent under your org settings.
        </li>
        <li>
          Find <strong className="text-primary">Senix-bot</strong> in the list.
        </li>
        <li>
          Click <strong className="text-primary">Configure</strong>, then{' '}
          <strong className="text-primary">Uninstall</strong>.
        </li>
      </DocOL>
      <DocP>
        Uninstalling pauses all analysis immediately. Your history is soft-deleted, so
        reinstalling later restores it.
      </DocP>

      <DocNextLink
        href="/docs/how-it-works"
        label="How Senix analyzes pull requests"
        description="The pipeline, structural diffs, and supported languages."
      />
    </>
  );
}
