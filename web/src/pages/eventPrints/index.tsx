/**
 * All event print pages, one export each. Routes wire them
 * individually so each has its own URL (/events/:id/print/<name>)
 * and auto-prints on mount via the shared ManifestPage shell.
 *
 * Print views in this file:
 *   - DoorRoster — alphabetical paper roster with check-in boxes
 *   - RunOfShow — schedule card for the event team
 *   - SponsorSheet — sponsors grouped by tier (emcee script)
 *   - Nametags — Avery 5395 (3x4 in) name + role badges
 *   - TableCards — big folded numbered table tents (1 per page)
 *   - PlaceCards — folded place cards laid out 4-up
 *   - SeatingChart — per-table list with all attendees grouped
 *   - PledgeCards — pre-filled paddle-raise cards (1 per attendee)
 *   - WalkInForm — blank form for capturing walk-ins on paper
 *   - StaffBriefing — printable staff briefing card
 *   - WillCallLabels — Avery 5160 mailing labels for pre-paid attendees
 */

import { EventPrintPage, dollars, byLastName, byTableSeat } from './common.tsx';
import type { PrintAttendee } from './common.tsx';

/* ----------------------------------------------------------------- */
/*  Door check-in roster                                              */
/* ----------------------------------------------------------------- */
export function DoorRoster() {
  return (
    <EventPrintPage
      title="Door check-in roster"
      render={data => {
        const sorted = [...data.attendees].sort(byLastName);
        return (
          <>
            <p style={{ fontSize: '10pt', color: '#444', marginBottom: '12pt' }}>
              Backup roster for the door. Mark the box once you've confirmed the person on the list,
              then sync into the system afterward. Total expected: <strong>{data.attendees.length}</strong>.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
              <thead>
                <tr style={{ borderBottom: '1.5pt solid #1a1a1a' }}>
                  <th style={{ width: '18pt', padding: '4pt' }}></th>
                  <th style={{ textAlign: 'left', padding: '4pt' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '4pt' }}>RSVP</th>
                  <th style={{ textAlign: 'left', padding: '4pt' }}>Table</th>
                  <th style={{ textAlign: 'right', padding: '4pt' }}>Tickets</th>
                  <th style={{ textAlign: 'right', padding: '4pt' }}>Contribution</th>
                  <th style={{ textAlign: 'left', padding: '4pt', width: '90pt' }}>Initials / time</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(a => (
                  <tr key={a.event_attendee_id} style={{ borderBottom: '0.5pt solid #d8d4cc' }}>
                    <td style={{ padding: '5pt 4pt' }}>
                      <span style={{ display: 'inline-block', width: '11pt', height: '11pt', border: '1px solid #555', borderRadius: '2px' }} />
                    </td>
                    <td style={{ padding: '5pt 4pt' }}>
                      <strong>{a.name}</strong>
                      {a.dietary_notes && <span style={{ fontSize: '8pt', color: '#888', marginLeft: '6pt' }}>{a.dietary_notes}</span>}
                    </td>
                    <td style={{ padding: '5pt 4pt' }}>{a.rsvp_status_label ?? '—'}</td>
                    <td style={{ padding: '5pt 4pt' }}>{[a.table_number, a.seat_number].filter(Boolean).join(' / ') || '—'}</td>
                    <td style={{ padding: '5pt 4pt', textAlign: 'right' }}>{a.ticket_count}</td>
                    <td style={{ padding: '5pt 4pt', textAlign: 'right' }}>{dollars(a.amount_contributed)}</td>
                    <td style={{ padding: '5pt 4pt', borderBottom: '0.5pt solid #888' }}></td>
                  </tr>
                ))}
                {/* Six blank rows for walk-ins to write themselves in. */}
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`blank-${i}`} style={{ borderBottom: '0.5pt solid #d8d4cc' }}>
                    <td style={{ padding: '5pt 4pt' }}>
                      <span style={{ display: 'inline-block', width: '11pt', height: '11pt', border: '1px solid #555', borderRadius: '2px' }} />
                    </td>
                    <td colSpan={5} style={{ padding: '5pt 4pt', borderBottom: '0.5pt solid #888' }}></td>
                    <td style={{ padding: '5pt 4pt', borderBottom: '0.5pt solid #888' }}></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        );
      }}
    />
  );
}

/* ----------------------------------------------------------------- */
/*  Run of show                                                       */
/* ----------------------------------------------------------------- */
export function RunOfShow() {
  return (
    <EventPrintPage
      title="Run of show"
      render={data => {
        const e = data.event;
        return e.run_of_show ? (
          <pre style={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '11pt',
            lineHeight: 1.5,
          }}>{e.run_of_show}</pre>
        ) : (
          <p style={{ fontStyle: 'italic', color: '#888' }}>
            No run-of-show has been written for this event. Fill in the "Run of show" field on the event edit page.
          </p>
        );
      }}
    />
  );
}

/* ----------------------------------------------------------------- */
/*  Sponsor recognition sheet                                         */
/* ----------------------------------------------------------------- */
export function SponsorSheet() {
  return (
    <EventPrintPage
      title="Sponsor recognition"
      render={data => {
        if (!data.sponsors?.length) {
          return <p style={{ fontStyle: 'italic', color: '#888' }}>No sponsors recorded for this event.</p>;
        }
        const grouped: Record<string, typeof data.sponsors> = {};
        const order: string[] = [];
        for (const s of data.sponsors) {
          if (!grouped[s.sponsor_level_label]) { grouped[s.sponsor_level_label] = []; order.push(s.sponsor_level_label); }
          grouped[s.sponsor_level_label].push(s);
        }
        return (
          <>
            <p style={{ fontSize: '10pt', color: '#444', marginBottom: '16pt' }}>
              For inclusion in the event program, emcee script, and on-screen sponsor recognition.
              Total committed: <strong>{dollars(data.sponsors.reduce((s, x) => s + Number(x.amount_pledged ?? 0), 0))}</strong>.
            </p>
            {order.map(lvl => (
              <div key={lvl} style={{ marginBottom: '14pt', breakInside: 'avoid' }}>
                <div style={{
                  fontFamily: 'Spectral, Georgia, serif',
                  fontSize: '15pt',
                  borderBottom: '1.5pt solid #1a1a1a',
                  paddingBottom: '3pt',
                  marginBottom: '6pt',
                }}>{lvl}</div>
                <ul style={{ margin: 0, paddingLeft: '18pt', fontSize: '11pt' }}>
                  {grouped[lvl].map(s => (
                    <li key={s.event_sponsor_id} style={{ marginBottom: '3pt' }}>
                      <strong>{s.corporate_name ?? s.contact_name}</strong>
                      {s.amount_pledged != null && <span style={{ color: '#666' }}> · {dollars(s.amount_pledged)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        );
      }}
    />
  );
}

/* ----------------------------------------------------------------- */
/*  Nametags — Avery 5395 (3" x 4", 6 per sheet, 2x3 grid)            */
/* ----------------------------------------------------------------- */
export function Nametags() {
  return (
    <EventPrintPage
      title="Name badges"
      render={data => {
        const sorted = [...data.attendees].sort(byLastName);
        return (
          <>
            <p className="manifest-screen-only" style={{ fontSize: '10pt', color: '#666', marginBottom: '8pt' }}>
              Designed for Avery 5395 / 8395 sheets (3"×4", 6 per page).
              Load in your printer with the badge side up, no scaling.
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0,
              fontSize: '10pt',
            }}>
              {sorted.map(a => (
                <div key={a.event_attendee_id} style={{
                  width: '3.5in',
                  height: '2.5in',
                  border: '0.25pt dashed #ccc',
                  padding: '14pt',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  breakInside: 'avoid',
                }}>
                  <div style={{ fontSize: '8pt', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {data.event.event_name}
                  </div>
                  <div style={{ fontFamily: 'Spectral, Georgia, serif', fontSize: '22pt', textAlign: 'center', fontWeight: 500 }}>
                    {firstWord(a.name)}
                  </div>
                  <div style={{ fontSize: '10pt', color: '#444', textAlign: 'center' }}>
                    {a.name}
                  </div>
                  <div style={{ fontSize: '9pt', color: '#888', textAlign: 'center' }}>
                    {a.table_number ? `Table ${a.table_number}` : ' '}
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      }}
    />
  );
}

function firstWord(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

/* ----------------------------------------------------------------- */
/*  Table cards — one big numbered tent per page                      */
/* ----------------------------------------------------------------- */
export function TableCards() {
  return (
    <EventPrintPage
      title="Table cards"
      render={data => {
        const numbers = Array.from(new Set(data.attendees.map(a => a.table_number).filter(Boolean) as string[]))
          .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
        if (numbers.length === 0) {
          return <p style={{ fontStyle: 'italic', color: '#888' }}>No table assignments yet. Add table numbers to attendees on the event edit page.</p>;
        }
        return (
          <>
            <p className="manifest-screen-only" style={{ fontSize: '10pt', color: '#666', marginBottom: '8pt' }}>
              Print on cardstock. Each page is one folded tent — the number prints twice so both sides face the room.
            </p>
            {numbers.map(n => (
              <div key={n} style={{
                pageBreakAfter: 'always',
                breakAfter: 'page',
                width: '100%',
                height: '9.5in',
                display: 'flex',
                flexDirection: 'column',
              }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1pt dashed #888' }}>
                  <span style={{ fontFamily: 'Spectral, Georgia, serif', fontSize: '180pt', fontWeight: 500, transform: 'rotate(180deg)', lineHeight: 1 }}>{n}</span>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'Spectral, Georgia, serif', fontSize: '180pt', fontWeight: 500, lineHeight: 1 }}>{n}</span>
                </div>
              </div>
            ))}
          </>
        );
      }}
    />
  );
}

/* ----------------------------------------------------------------- */
/*  Place cards — folded, 4-up                                        */
/* ----------------------------------------------------------------- */
export function PlaceCards() {
  return (
    <EventPrintPage
      title="Place cards"
      render={data => {
        const sorted = [...data.attendees].sort(byTableSeat);
        return (
          <>
            <p className="manifest-screen-only" style={{ fontSize: '10pt', color: '#666', marginBottom: '8pt' }}>
              Print on cardstock, cut along dashed lines, fold once.
              Each card shows the guest name + table number.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              {sorted.map(a => (
                <div key={a.event_attendee_id} style={{
                  width: '3.5in',
                  height: '2.5in',
                  border: '0.25pt dashed #ccc',
                  padding: '18pt',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  textAlign: 'center',
                  breakInside: 'avoid',
                }}>
                  <div style={{ fontFamily: 'Spectral, Georgia, serif', fontSize: '20pt', fontWeight: 500 }}>{a.name}</div>
                  {a.table_number && (
                    <div style={{ fontSize: '10pt', color: '#666', marginTop: '8pt' }}>
                      Table {a.table_number}{a.seat_number ? ` · Seat ${a.seat_number}` : ''}
                    </div>
                  )}
                  {a.dietary_notes && (
                    <div style={{ fontSize: '8pt', color: '#999', marginTop: '4pt', fontStyle: 'italic' }}>
                      {a.dietary_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        );
      }}
    />
  );
}

/* ----------------------------------------------------------------- */
/*  Seating chart — list per table                                    */
/* ----------------------------------------------------------------- */
export function SeatingChart() {
  return (
    <EventPrintPage
      title="Seating chart"
      render={data => {
        const grouped: Record<string, PrintAttendee[]> = {};
        const unseated: PrintAttendee[] = [];
        for (const a of data.attendees) {
          if (!a.table_number) { unseated.push(a); continue; }
          if (!grouped[a.table_number]) grouped[a.table_number] = [];
          grouped[a.table_number].push(a);
        }
        const tables = Object.keys(grouped).sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
        return (
          <>
            <p style={{ fontSize: '10pt', color: '#444', marginBottom: '12pt' }}>
              Use this for the host stand, AV team, and the photographer. Pin a copy backstage.
            </p>
            <div style={{ columnCount: 2, columnGap: '24pt' }}>
              {tables.map(t => (
                <div key={t} style={{ marginBottom: '14pt', breakInside: 'avoid' }}>
                  <div style={{ fontFamily: 'Spectral, Georgia, serif', fontSize: '14pt', fontWeight: 500, borderBottom: '1pt solid #1a1a1a', paddingBottom: '2pt', marginBottom: '4pt' }}>
                    Table {t} <span style={{ fontSize: '9pt', color: '#888', fontWeight: 400 }}>({grouped[t].length} seated)</span>
                  </div>
                  <ol style={{ margin: 0, paddingLeft: '18pt', fontSize: '10pt' }}>
                    {grouped[t].sort(byTableSeat).map(a => (
                      <li key={a.event_attendee_id} style={{ marginBottom: '2pt' }}>
                        {a.name}{a.seat_number ? <span style={{ color: '#888' }}> · seat {a.seat_number}</span> : null}
                        {a.dietary_notes ? <span style={{ color: '#999', fontSize: '8pt' }}> · {a.dietary_notes}</span> : null}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
              {unseated.length > 0 && (
                <div style={{ marginBottom: '14pt', breakInside: 'avoid' }}>
                  <div style={{ fontFamily: 'Spectral, Georgia, serif', fontSize: '14pt', fontWeight: 500, borderBottom: '1pt solid #888', paddingBottom: '2pt', marginBottom: '4pt', color: '#666' }}>
                    Unassigned ({unseated.length})
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18pt', fontSize: '10pt' }}>
                    {unseated.sort(byLastName).map(a => (
                      <li key={a.event_attendee_id}>{a.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        );
      }}
    />
  );
}

/* ----------------------------------------------------------------- */
/*  Pledge cards — one per attendee, paddle-raise style               */
/* ----------------------------------------------------------------- */
export function PledgeCards() {
  return (
    <EventPrintPage
      title="Pledge cards"
      render={data => {
        const sorted = [...data.attendees].sort(byLastName);
        const levels = [25, 100, 500, 1000, 5000];
        return (
          <>
            <p className="manifest-screen-only" style={{ fontSize: '10pt', color: '#666', marginBottom: '8pt' }}>
              One card per attendee. Cut along dashed lines and place at each seat.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              {sorted.map(a => (
                <div key={a.event_attendee_id} style={{
                  width: '3.5in',
                  height: '4in',
                  border: '0.25pt dashed #ccc',
                  padding: '14pt',
                  breakInside: 'avoid',
                  fontSize: '9pt',
                }}>
                  <div style={{ fontSize: '8pt', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3pt' }}>
                    Pledge — {data.event.event_name}
                  </div>
                  <div style={{ fontFamily: 'Spectral, Georgia, serif', fontSize: '14pt', fontWeight: 500, marginBottom: '6pt' }}>{a.name}</div>
                  {a.table_number && <div style={{ fontSize: '8pt', color: '#666' }}>Table {a.table_number}</div>}
                  <div style={{ marginTop: '10pt', marginBottom: '4pt', fontWeight: 500 }}>I pledge:</div>
                  {levels.map(lv => (
                    <div key={lv} style={{ display: 'flex', alignItems: 'center', gap: '6pt', marginBottom: '2pt' }}>
                      <span style={{ display: 'inline-block', width: '10pt', height: '10pt', border: '1px solid #555', borderRadius: '2px' }} />
                      <span>${lv.toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6pt', marginTop: '4pt' }}>
                    <span style={{ display: 'inline-block', width: '10pt', height: '10pt', border: '1px solid #555', borderRadius: '2px' }} />
                    <span>Other: $______________</span>
                  </div>
                  <div style={{ marginTop: '8pt', borderBottom: '1px solid #888', height: '14pt' }} />
                  <div style={{ fontSize: '7pt', color: '#888' }}>Signature</div>
                </div>
              ))}
            </div>
          </>
        );
      }}
    />
  );
}

/* ----------------------------------------------------------------- */
/*  Walk-in registration paper form (blank)                           */
/* ----------------------------------------------------------------- */
export function WalkInForm() {
  return (
    <EventPrintPage
      title="Walk-in registration"
      render={() => (
        <>
          <p style={{ fontSize: '10pt', color: '#444', marginBottom: '14pt' }}>
            Blank form for capturing walk-ins on paper when the iPad is busy.
            Enter into the system after the event.
          </p>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ border: '0.5pt solid #888', padding: '8pt', marginBottom: '8pt', breakInside: 'avoid' }}>
              <div style={{ fontSize: '8pt', color: '#888', marginBottom: '6pt' }}>Walk-in #{i + 1}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8pt', fontSize: '9pt' }}>
                <FieldLine label="First name" />
                <FieldLine label="Last name" />
                <FieldLine label="Email" />
                <FieldLine label="Mobile phone" />
                <FieldLine label="Tickets" />
                <FieldLine label="Contribution $" />
              </div>
              <div style={{ marginTop: '4pt' }}>
                <FieldLine label="Notes / dietary" wide />
              </div>
            </div>
          ))}
        </>
      )}
    />
  );
}

function FieldLine({ label, wide = false }: { label: string; wide?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: wide ? '90pt 1fr' : '70pt 1fr', gap: '4pt', alignItems: 'end' }}>
      <span style={{ fontSize: '8pt', color: '#666' }}>{label}</span>
      <span style={{ borderBottom: '0.5pt solid #888', minHeight: '14pt' }} />
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Staff briefing card                                               */
/* ----------------------------------------------------------------- */
export function StaffBriefing() {
  return (
    <EventPrintPage
      title="Staff briefing"
      render={data => {
        const e = data.event;
        return (
          <>
            <div style={{ marginBottom: '14pt', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12pt', fontSize: '10pt' }}>
              <div>
                <div style={{ fontSize: '8pt', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Manager</div>
                <div>{e.manager_name ?? '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '8pt', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Capacity</div>
                <div>{data.attendees.length}{e.max_attendees != null ? ` / ${e.max_attendees}` : ''}</div>
              </div>
              <div>
                <div style={{ fontSize: '8pt', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Host</div>
                <div>{e.host_corporate_name ?? e.host_contact_name ?? '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '8pt', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Venue</div>
                <div>{[e.address, e.city, e.state].filter(Boolean).join(', ') || '—'}</div>
              </div>
            </div>
            {e.staff_briefing ? (
              <pre style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '10pt',
                lineHeight: 1.5,
              }}>{e.staff_briefing}</pre>
            ) : (
              <p style={{ fontStyle: 'italic', color: '#888' }}>
                No staff briefing has been written. Fill in the "Staff briefing" field on the event edit page
                (emergency contacts, vendor phones, evacuation plan, etc.).
              </p>
            )}
          </>
        );
      }}
    />
  );
}

/* ----------------------------------------------------------------- */
/*  Will-call envelope labels — Avery 5160 (1" × 2-5/8", 30 per page) */
/* ----------------------------------------------------------------- */
export function WillCallLabels() {
  return (
    <EventPrintPage
      title="Will-call labels"
      render={data => {
        // Only pre-paid attendees (anything with amount_contributed
        // > 0). Walk-ins don't get advance labels.
        const paid = data.attendees
          .filter(a => Number(a.amount_contributed ?? 0) > 0)
          .sort(byLastName);
        return (
          <>
            <p className="manifest-screen-only" style={{ fontSize: '10pt', color: '#666', marginBottom: '8pt' }}>
              Avery 5160 mailing labels (1"×2-5/8", 30 per sheet, 3 columns × 10 rows). Pre-paid attendees only.
            </p>
            {paid.length === 0 ? (
              <p style={{ fontStyle: 'italic', color: '#888' }}>No pre-paid attendees yet.</p>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 2.625in)',
                gridAutoRows: '1in',
                gap: 0,
              }}>
                {paid.map(a => (
                  <div key={a.event_attendee_id} style={{
                    border: '0.25pt dashed #ddd',
                    padding: '8pt',
                    fontSize: '9pt',
                    breakInside: 'avoid',
                    overflow: 'hidden',
                  }}>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    {a.table_number && <div style={{ fontSize: '8pt', color: '#666' }}>Table {a.table_number}{a.seat_number ? ` · Seat ${a.seat_number}` : ''}</div>}
                    <div style={{ fontSize: '8pt', color: '#666' }}>Paid {dollars(a.amount_contributed)} · {a.ticket_count} ticket{a.ticket_count === 1 ? '' : 's'}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        );
      }}
    />
  );
}
