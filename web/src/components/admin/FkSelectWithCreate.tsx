/**
 * FkSelect plus a "+ New" affordance that opens a quick-create modal.
 *
 * Two exports:
 *   FkSelectWithCreate — the dropdown + button itself
 *   FkCreateField — wraps it in a label/required/error chrome so it drops
 *                   into existing forms next to <Field> components.
 *
 * The modal body is passed in by the caller as a render-prop, so each FK
 * type owns its own form. After save the modal calls onCreated(id, label),
 * which selects the new row in the dropdown and closes the modal.
 *
 * Goal: let users add a missing prerequisite (Donor, Address, Vehicle, …)
 * without navigating away from the form they're filling out. Preserves the
 * outer form's state — it's just a React modal on top of the page.
 */

import { useCallback, useState } from 'react';
import { FkSelect } from './FkSelect.tsx';

export interface QuickCreateContext {
  /** Call when the entity is created. The modal will close and the FK
   *  dropdown will switch to the new value automatically. */
  onCreated: (id: number, label: string) => void;
  /** Call to close the modal without creating anything. */
  onCancel: () => void;
}

export function FkSelectWithCreate({
  fkTable,
  value,
  initialLabel,
  required,
  onChange,
  allowClear = true,
  newButtonLabel = '+ New',
  renderModal,
}: {
  fkTable: string;
  value: number | null;
  initialLabel?: string;
  required?: boolean;
  onChange: (id: number | null) => void;
  allowClear?: boolean;
  /** Label on the affordance. Defaults to "+ New" — override for entity-
   *  specific text like "+ New donor". */
  newButtonLabel?: string;
  /** Renders the modal body. Receives a context object with the callbacks
   *  to invoke when saving (passes id+label up) or cancelling. */
  renderModal: (ctx: QuickCreateContext) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // We also track the label of any just-created row so the FkSelect can
  // display it immediately, without having to refetch. Once the user
  // changes the selection again, the FkSelect's own label tracking takes
  // over and this becomes irrelevant.
  const [optimisticLabel, setOptimisticLabel] = useState<string | undefined>(undefined);

  const handleCreated = useCallback((id: number, label: string) => {
    setOptimisticLabel(label);
    onChange(id);
    setOpen(false);
  }, [onChange]);

  return (
    <div className="flex gap-2 items-stretch">
      <div className="flex-1 min-w-0">
        <FkSelect
          fkTable={fkTable}
          value={value}
          initialLabel={optimisticLabel ?? initialLabel}
          required={required}
          onChange={onChange}
          allowClear={allowClear}
        />
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 text-xs border border-hairline-strong rounded-md hover:border-terracotta hover:text-terracotta text-ink-soft whitespace-nowrap flex-shrink-0"
        title="Add a new entry without leaving this form"
      >
        {newButtonLabel}
      </button>

      {open && (
        <QuickCreateModal onClose={() => setOpen(false)}>
          {renderModal({ onCreated: handleCreated, onCancel: () => setOpen(false) })}
        </QuickCreateModal>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Modal shell                                                       */
/* ----------------------------------------------------------------- */

/**
 * Generic modal shell — backdrop, centered card, escape-to-close,
 * click-outside-to-close. The body content (header + form + footer) is
 * the children. Width caps at ~640px so it stays focused even on wide
 * monitors.
 *
 * Exported as `QuickCreateOverlay` for pages that want to launch the
 * same quick-create modals outside of an FkSelectWithCreate (e.g.
 * the Donors list's "+ New donor" button).
 */
export function QuickCreateOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return <QuickCreateModal onClose={onClose}>{children}</QuickCreateModal>;
}

function QuickCreateModal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  // Escape to close.
  useEscapeKey(onClose);

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] flex items-start justify-center pt-16 pb-10 overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-paper rounded-lg shadow-2xl border border-hairline w-[640px] max-w-[calc(100vw-32px)]"
      >
        {children}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  FkCreateField — labelled form-field wrapper                       */
/* ----------------------------------------------------------------- */

/**
 * Same look as the generic <Field> component (label + asterisk + error
 * + helpText) but renders an FkSelectWithCreate. Forms use this in place
 * of <Field> for any FK that should have a "+ New" affordance.
 */
export function FkCreateField({
  label,
  required,
  helpText,
  error,
  fkTable,
  value,
  initialLabel,
  onChange,
  newButtonLabel,
  renderModal,
}: {
  label: string;
  required?: boolean;
  helpText?: string;
  error?: string | null;
  fkTable: string;
  value: number | null;
  initialLabel?: string;
  onChange: (id: number | null) => void;
  newButtonLabel?: string;
  renderModal: (ctx: QuickCreateContext) => React.ReactNode;
}) {
  const hasError = !!error;
  return (
    <div>
      <label className="field-label flex items-center gap-1">
        {label}
        {required && <span className="text-terracotta" title="Required">*</span>}
      </label>
      <div className={hasError ? 'admin-field-error' : ''}>
        <FkSelectWithCreate
          fkTable={fkTable}
          value={value}
          initialLabel={initialLabel}
          required={required}
          onChange={onChange}
          newButtonLabel={newButtonLabel}
          renderModal={renderModal}
        />
      </div>
      {hasError && <div className="text-[11px] text-terracotta-deep mt-1 font-medium">{error}</div>}
      {!hasError && helpText && <div className="text-[11px] text-ink-faint mt-1">{helpText}</div>}
    </div>
  );
}

import { useEffect } from 'react';
function useEscapeKey(handler: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handler();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handler]);
}
