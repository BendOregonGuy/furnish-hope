/**
 * Caseworker-scoped user manual at /agency/help. Much shorter than
 * the staff manual — only documents the flows the agency portal
 * exposes: sign in, dashboard, referrals list, refer-a-household
 * form, and the read-only referral detail page.
 */

import { ManualShell, type TocEntry } from './ManualShell.tsx';
import { ScreenshotSlot } from './ScreenshotSlot.tsx';

const TOC: TocEntry[] = [
  { id: 'overview',    label: 'What this portal is for' },
  { id: 'signin',      label: 'Signing in' },
  { id: 'dashboard',   label: 'Dashboard' },
  { id: 'referrals',   label: 'Your referrals' },
  { id: 'new',         label: 'Refer a household' },
  { id: 'detail',      label: 'Referral status' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
];

export function AgencyHelp() {
  return (
    <ManualShell
      title="Caseworker Portal — User Manual"
      subtitle="A short guide for partner-agency caseworkers using the Furnish Hope referral portal."
      toc={TOC}
    >
      <section id="overview">
        <h2>What this portal is for</h2>
        <p>You're a caseworker at a partner agency. This portal lets you refer households to Furnish Hope and see how each referral is progressing — without going through Furnish Hope staff every time.</p>
        <p>You'll see <strong>only</strong> referrals submitted by your own agency. You won't see other agencies' referrals or any Furnish Hope internal data.</p>
      </section>

      <section id="signin">
        <h2>Signing in</h2>
        <ol>
          <li>Open the portal URL your Furnish Hope contact sent you.</li>
          <li>Enter the email and temporary password they provided.</li>
          <li>You'll be prompted to change your password on first sign-in. Choose something memorable; you can't recover it without admin help.</li>
        </ol>
        <ScreenshotSlot slug="agency-login" description="The portal sign-in page." url="/login" audience="agency" />
      </section>

      <section id="dashboard">
        <h2>Dashboard</h2>
        <p>After signing in, you land on the dashboard. It shows:</p>
        <ul>
          <li>The number of referrals your agency has submitted.</li>
          <li>Recent referral activity — newest first.</li>
          <li>A summary of packing list status across all your referrals.</li>
        </ul>
        <ScreenshotSlot slug="agency-dashboard" description="The caseworker portal dashboard." url="/agency" audience="agency" />
      </section>

      <section id="referrals">
        <h2>Your referrals</h2>
        <p>Click <strong>My referrals</strong> in the sidebar (or the dashboard widget) to see all households your agency has referred. The list is searchable by name.</p>
        <ScreenshotSlot slug="agency-referrals" description="The list of caseworker referrals." url="/agency/referrals" audience="agency" />
      </section>

      <section id="new">
        <h2>Refer a household</h2>
        <p>To refer a new household to Furnish Hope:</p>
        <ol>
          <li>Click <strong>+ Refer a household</strong> on the dashboard or referrals page.</li>
          <li>Fill in head-of-household name, optional email and phone.</li>
          <li>Pick the <strong>household type</strong>.</li>
          <li>Fill in the delivery address.</li>
          <li>Add any notes Furnish Hope should know — accessibility needs, language preference, urgency, anything specific.</li>
          <li>Click <strong>Submit referral</strong>.</li>
        </ol>
        <p>Furnish Hope staff will reach out to coordinate next steps. You'll see updates on the referral's status page (next section).</p>
        <ScreenshotSlot slug="agency-referral-form" description="The Refer-a-household form." url="/agency/referrals/new" audience="agency" />
      </section>

      <section id="detail">
        <h2>Referral status</h2>
        <p>Click any referral from your list to see its status:</p>
        <ul>
          <li>Household info you submitted.</li>
          <li>Furniture packing lists Furnish Hope has opened for this household.</li>
          <li>Each request shows: items requested, items reserved from inventory, scheduled delivery date (if scheduled).</li>
          <li>Your original notes about the household.</li>
        </ul>
        <p>This view is <strong>read-only</strong>. To update information about a household, contact your Furnish Hope coordinator.</p>
        <ScreenshotSlot slug="agency-referral-detail" description="A referral status page showing furniture request status and household info." url="/agency/referrals" audience="agency" />
      </section>

      <section id="troubleshooting">
        <h2>Troubleshooting</h2>
        <h3>"I can't sign in"</h3>
        <p>Make sure you're using the email address Furnish Hope set up your account with — not a personal address. If your password isn't working, your Furnish Hope contact can reset it.</p>
        <h3>"I don't see a referral I just submitted"</h3>
        <p>Refresh the page (Ctrl+R / ⌘+R). If it's still missing, check the URL — sometimes the back button takes you to the wrong agency view.</p>
        <h3>"My referral hasn't progressed in a while"</h3>
        <p>Email your Furnish Hope contact directly. They can tell you whether the household is waiting on inventory, scheduling, or something else.</p>
      </section>

      <hr className="my-8" />
      <p className="text-xs text-ink-faint italic">
        Questions? Email your Furnish Hope coordinator or{' '}
        <a href="mailto:preston@getreality.com" className="text-terracotta hover:text-terracotta-deep">preston@getreality.com</a>.
      </p>
    </ManualShell>
  );
}
