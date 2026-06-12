/**
 * Public volunteer agreement + liability release. Opens in a new
 * tab from the volunteer-signup form's checkbox. No login required.
 * Browser-printable (Ctrl/Cmd-P) for anyone who wants a paper copy
 * before signing.
 *
 * Important: this is a reasonable boilerplate document only. The
 * nonprofit MUST have their own legal counsel review and approve
 * this language before relying on it. A red banner up top makes
 * that explicit.
 */

import { useQuery } from '@tanstack/react-query';

interface OrgInfo { org_name: string; has_logo: boolean; logo_updated_at: string | null }

export function VolunteerAgreement() {
  const { data: org } = useQuery<OrgInfo>({
    queryKey: ['org-info-public'],
    queryFn: () => fetch('/api/org-info').then(r => r.ok ? r.json() : { org_name: 'Furnish Hope' }),
    retry: false,
  });

  const orgName = org?.org_name ?? 'Furnish Hope';
  const logoUrl = org?.has_logo && org?.logo_updated_at
    ? `/api/org-info/logo?v=${encodeURIComponent(org.logo_updated_at)}`
    : null;

  return (
    <div className="min-h-screen bg-cream py-10 px-4">
      <style>{`
        @page { size: Letter; margin: 0.75in; }
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .agreement-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      <div className="max-w-3xl mx-auto">

        {/* Screen-only header — disclaimer + print button. */}
        <div className="no-print mb-6 bg-terracotta-soft border-l-4 border-terracotta-deep p-4 rounded">
          <div className="text-sm text-terracotta-deep font-medium mb-1">
            ⚠ Template — review with legal counsel before adopting
          </div>
          <div className="text-xs text-ink-soft">
            This document is a reasonable nonprofit-volunteer template intended as a starting point.
            {' '}{orgName} should have their own attorney review and adapt this language for their
            jurisdiction, insurance coverage, and program specifics before relying on it.
          </div>
        </div>

        <div className="no-print mb-4 flex justify-end gap-2">
          <button onClick={() => window.print()} className="btn-primary text-sm">
            🖨 Print / Save as PDF
          </button>
          <button onClick={() => window.close()} className="btn-ghost text-sm">
            Close
          </button>
        </div>

        <article
          className="agreement-sheet bg-paper border border-hairline rounded-lg p-10 shadow-sm font-sans text-ink leading-relaxed"
          style={{ fontSize: '12pt' }}
        >

          {/* Letterhead */}
          <header className="border-b-2 border-ink pb-4 mb-6 flex items-center gap-4">
            {logoUrl && <img src={logoUrl} alt="" style={{ height: '54pt', width: 'auto' }} />}
            <div>
              <div className="font-display text-2xl font-medium">{orgName}</div>
              <div className="text-sm text-ink-soft">Volunteer Agreement and Liability Release</div>
            </div>
          </header>

          <p className="mb-5">
            This Volunteer Agreement (the &ldquo;Agreement&rdquo;) is entered into between{' '}
            <strong>{orgName}</strong> (the &ldquo;Organization&rdquo;) and the individual whose
            name appears on the volunteer application and signature lines below (the
            &ldquo;Volunteer&rdquo;). By submitting the volunteer application and agreeing to the
            terms of this document, the Volunteer acknowledges that they have read, understood,
            and agreed to be bound by all sections that follow.
          </p>

          <Section n="1" title="Volunteer Service">
            <p>
              The Volunteer agrees to perform services for the Organization on a strictly voluntary
              basis. Services may include but are not limited to: picking up donated furniture and
              household items; delivering furniture to recipient households; sorting, organizing,
              and inventorying items in the Organization&rsquo;s warehouse; assisting at events and
              fundraisers; providing administrative or office support; and other tasks reasonably
              related to the Organization&rsquo;s charitable mission.
            </p>
            <p>
              The specific activities, schedule, and location of volunteer service will be
              coordinated by the Organization. The Volunteer is free to decline any specific
              assignment for any reason.
            </p>
          </Section>

          <Section n="2" title="No Employment Relationship">
            <p>
              The Volunteer expressly understands and agrees that they are <em>not</em> an
              employee, contractor, agent, or partner of the Organization. The Volunteer will not
              receive wages, salary, benefits, workers&rsquo; compensation, or any other form of
              compensation for their services. The Organization is under no obligation to provide
              the Volunteer with health insurance, disability insurance, retirement benefits, or
              any other benefit typically associated with employment.
            </p>
            <p>
              Either party may terminate the volunteer relationship at any time, for any reason or
              no reason, with or without notice. This Agreement does not create a contract for
              continued service.
            </p>
          </Section>

          <Section n="3" title="Confidentiality">
            <p>
              In the course of volunteer service the Volunteer may come into contact with sensitive
              information about donors, recipient households (&ldquo;Clients&rdquo;), staff, other
              volunteers, and the Organization itself. This includes but is not limited to names,
              addresses, contact information, family composition, financial information, and
              circumstances of need. The Volunteer agrees to hold all such information in strict
              confidence and to not disclose it to any person outside the Organization without
              prior written authorization from the Organization&rsquo;s leadership.
            </p>
            <p>
              The Volunteer further agrees not to photograph, video record, post on social media,
              or otherwise publicly share images, locations, or details of donors or recipient
              households without explicit written consent from both the Organization and the
              individuals depicted.
            </p>
            <p>
              This confidentiality obligation continues indefinitely, beyond the termination of
              the volunteer relationship.
            </p>
          </Section>

          <Section n="4" title="Code of Conduct">
            <p>
              While performing volunteer service, the Volunteer agrees to:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Treat all donors, recipients, staff, volunteers, and members of the public with respect, courtesy, and dignity.</li>
              <li>Comply with all applicable laws, traffic regulations, and the Organization&rsquo;s policies and procedures.</li>
              <li>Refrain from harassment, discrimination, or hostile conduct of any kind, whether based on race, color, religion, sex, gender identity, sexual orientation, national origin, age, disability, or any other protected characteristic.</li>
              <li>Avoid the use of alcohol, illegal drugs, or impairing substances before or during volunteer service.</li>
              <li>Not solicit donations, business, religious commitments, or political support from donors, recipients, or other volunteers during volunteer service.</li>
              <li>Promptly report any incident, accident, injury, or concern to Organization leadership.</li>
            </ul>
            <p>
              The Organization reserves the right to terminate the volunteer relationship
              immediately for any violation of this Code of Conduct.
            </p>
          </Section>

          <Section n="5" title="Assumption of Risk">
            <p>
              The Volunteer understands that volunteer service for the Organization may involve
              physical activity and inherent risks, including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Lifting, moving, and carrying heavy or awkward furniture and household items.</li>
              <li>Climbing stairs; navigating narrow doorways, hallways, and other tight spaces.</li>
              <li>Operating, riding in, or loading and unloading motor vehicles and trailers.</li>
              <li>Working at heights (ladders, truck beds, loading docks).</li>
              <li>Exposure to dust, allergens, mold, pet dander, and other airborne irritants.</li>
              <li>Working in homes and locations whose conditions cannot be fully known in advance.</li>
              <li>Risks associated with weather, traffic, and incidental contact with the public.</li>
            </ul>
            <p>
              The Volunteer represents that they are physically able to perform the activities they
              have agreed to and will inform the Organization of any limitation, injury, or medical
              condition that may affect their ability to volunteer safely. The Volunteer voluntarily
              and knowingly assumes all risks of bodily injury, illness, property damage, and other
              loss arising from their volunteer service, whether or not such risks are foreseeable.
            </p>
          </Section>

          <Section n="6" title="Release and Waiver of Liability">
            <p>
              In consideration of being permitted to volunteer with the Organization, the
              Volunteer, on behalf of themselves and their heirs, executors, administrators, and
              assigns, hereby <strong>releases, waives, discharges, and covenants not to sue</strong>
              {' '}the Organization, its board members, officers, employees, agents, volunteers,
              and representatives (collectively, the &ldquo;Released Parties&rdquo;) from any and
              all claims, demands, actions, causes of action, costs, expenses, and damages of any
              kind, whether known or unknown, that the Volunteer may have or may hereafter accrue,
              arising out of or relating to the Volunteer&rsquo;s service with the Organization,
              including without limitation injury, illness, disability, or death, and any loss of
              or damage to personal property, even if caused by the ordinary negligence of the
              Released Parties.
            </p>
            <p>
              This release does <em>not</em> apply to claims arising from the gross negligence,
              willful misconduct, or intentionally wrongful conduct of any Released Party.
            </p>
          </Section>

          <Section n="7" title="Indemnification">
            <p>
              The Volunteer agrees to <strong>indemnify and hold harmless</strong> the Released
              Parties from any and all claims, suits, damages, losses, costs, and expenses
              (including reasonable attorneys&rsquo; fees) brought by any third party arising out
              of or relating to the Volunteer&rsquo;s acts or omissions during volunteer service,
              except to the extent caused by the gross negligence or willful misconduct of the
              Released Parties.
            </p>
          </Section>

          <Section n="8" title="Driving and Vehicles">
            <p>
              If the Volunteer will operate a motor vehicle (their own or the Organization&rsquo;s)
              in connection with volunteer service, the Volunteer represents and warrants that they
              hold a valid driver&rsquo;s license in good standing and, when operating their own
              vehicle, maintain at least the minimum motor-vehicle liability insurance required by
              the state in which they reside. The Volunteer understands that their personal auto
              insurance, not the Organization&rsquo;s, is the primary coverage for any incident
              involving their personal vehicle. The Volunteer agrees to drive safely and lawfully
              at all times and to immediately report any accident or moving violation to the
              Organization.
            </p>
          </Section>

          <Section n="9" title="Medical Authorization">
            <p>
              In the event of an injury, illness, or other medical emergency during volunteer
              service in which the Volunteer is unable to give consent, the Volunteer authorizes
              the Organization to summon emergency medical services, transport the Volunteer to a
              medical facility, and consent on the Volunteer&rsquo;s behalf to such emergency
              medical treatment as licensed medical personnel deem necessary. The Volunteer
              acknowledges that they are financially responsible for the costs of any such medical
              care.
            </p>
          </Section>

          <Section n="10" title="Photographs and Media">
            <p>
              The Volunteer grants the Organization permission to photograph, video record, and
              otherwise capture the Volunteer&rsquo;s likeness during volunteer service, and to
              use such images in the Organization&rsquo;s publications, fundraising materials,
              website, social media, and other communications, without further notice,
              compensation, or right of approval. The Volunteer may opt out of media use at any
              time by notifying the Organization in writing.
            </p>
          </Section>

          <Section n="11" title="Background Check (when applicable)">
            <p>
              For certain volunteer roles (including but not limited to roles involving driving,
              entering recipient households, handling money, or working with minors), the
              Organization may request that the Volunteer authorize and complete a criminal
              background check. The Volunteer agrees to cooperate with any such reasonable
              request as a condition of serving in those roles.
            </p>
          </Section>

          <Section n="12" title="Term and Termination">
            <p>
              This Agreement begins on the date the Volunteer submits the volunteer application
              and continues until terminated by either party. Either the Volunteer or the
              Organization may terminate this Agreement at any time, for any reason or no reason,
              with or without notice. The obligations of confidentiality (Section 3), release
              (Section 6), and indemnification (Section 7) survive any termination of this
              Agreement.
            </p>
          </Section>

          <Section n="13" title="General Provisions">
            <p>
              This Agreement is the entire agreement between the Volunteer and the Organization
              regarding the Volunteer&rsquo;s service and supersedes any prior agreements or
              understandings, whether written or oral. This Agreement may be amended only in
              writing, signed by an authorized representative of the Organization. If any
              provision of this Agreement is found by a court to be invalid or unenforceable, the
              remaining provisions will continue in full force and effect. This Agreement is
              governed by the laws of the state in which the Organization is located, without
              regard to conflict-of-law principles.
            </p>
          </Section>

          <hr className="my-6 border-hairline" />

          <Section n="14" title="Acknowledgement and Signature">
            <p>
              The Volunteer acknowledges that they have read this Agreement, understand all of its
              terms, and have had the opportunity to ask questions and seek independent legal
              counsel. The Volunteer enters into this Agreement freely and voluntarily.
            </p>
            <p>
              By checking the box labeled <em>&ldquo;I agree to the volunteer agreement and
              liability release&rdquo;</em> on the volunteer application form and submitting
              that form, the Volunteer adopts this acknowledgement as their electronic
              signature, with the same legal effect as a handwritten signature.
            </p>

            {/* Print-only signature block */}
            <div className="hidden print:block mt-8">
              <div style={{ marginTop: '36pt' }}>
                <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '6pt', width: '60%' }}>
                  <div style={{ fontSize: '9pt', color: '#666' }}>Volunteer signature</div>
                </div>
              </div>
              <div style={{ marginTop: '24pt', display: 'flex', gap: '36pt' }}>
                <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '6pt', width: '45%' }}>
                  <div style={{ fontSize: '9pt', color: '#666' }}>Printed name</div>
                </div>
                <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '6pt', width: '30%' }}>
                  <div style={{ fontSize: '9pt', color: '#666' }}>Date</div>
                </div>
              </div>
              <div style={{ marginTop: '24pt', borderTop: '1px solid #1a1a1a', paddingTop: '6pt', width: '60%' }}>
                <div style={{ fontSize: '9pt', color: '#666' }}>Parent/Guardian signature (if Volunteer is under 18)</div>
              </div>
            </div>
          </Section>

          <div className="text-[10px] text-ink-faint mt-8 pt-4 border-t border-hairline">
            Document version: 1.0 · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </article>
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5" style={{ pageBreakInside: 'avoid' }}>
      <h2 className="font-display font-medium text-base mb-2 text-ink" style={{ fontSize: '13pt' }}>
        {n}. {title}
      </h2>
      <div className="text-sm text-ink space-y-3" style={{ fontSize: '11pt' }}>
        {children}
      </div>
    </section>
  );
}
