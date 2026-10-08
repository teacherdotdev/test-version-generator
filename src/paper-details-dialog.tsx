// The Exam's Paper Details, edited from the Format menu (ADR-0045).
//
// A dialog rather than a panel like the margins': these are words, typed and
// then kept, so the whole edit is one Save — one undo step — and Cancel leaves
// the Exam as it was. Every field is optional, and a blank one prints nothing.
// The instructions and the candidate fields start from the Paper Style's own
// until the teacher writes their own; "Use the style's own" goes back to them.

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CANDIDATE_FIELDS,
  CANDIDATE_FIELD_LABELS,
  candidateFieldsOf,
  instructionsOf,
  type CandidateField,
  type PaperDetails,
} from './paper-details'

type Draft = {
  subject: string
  duration: string
  paperCode: string
  /** One instruction a line, or `null` for the style's own. */
  instructions: string | null
  /** The fields asked for, or `null` for the style's own. */
  candidateFields: CandidateField[] | null
}

function draftOf(details: PaperDetails | undefined): Draft {
  return {
    subject: details?.subject ?? '',
    duration: details?.duration ?? '',
    paperCode: details?.paperCode ?? '',
    instructions: details?.instructions ? details.instructions.join('\n') : null,
    candidateFields: details?.candidateFields ? [...details.candidateFields] : null,
  }
}

/** The draft as the details it asks for; blank ones are left out on save. */
function paperDetailsOf(draft: Draft): PaperDetails {
  return {
    subject: draft.subject,
    duration: draft.duration,
    paperCode: draft.paperCode,
    ...(draft.instructions !== null ? { instructions: draft.instructions.split('\n') } : {}),
    ...(draft.candidateFields !== null ? { candidateFields: draft.candidateFields } : {}),
  }
}

export function PaperDetailsDialog({
  details,
  coverPage,
  disabled,
  onSave,
  onClose,
}: {
  details: PaperDetails | undefined
  /** Whether the Exam's Paper Style prints a Cover Page, where most of these print. */
  coverPage: boolean
  disabled: boolean
  onSave: (details: PaperDetails) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(() => draftOf(details))
  const titleId = useId()
  const first = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    first.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      requestAnimationFrame(() => { if (previous?.isConnected) previous.focus() })
    }
  }, [onClose])

  const fields = draft.candidateFields ?? [...candidateFieldsOf(undefined)]
  const toggleField = (field: CandidateField) => {
    const next = fields.includes(field) ? fields.filter((each) => each !== field) : [...fields, field]
    setDraft({ ...draft, candidateFields: CANDIDATE_FIELDS.filter((each) => next.includes(each)) })
  }

  return createPortal(
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="question-bank-details-dialog paper-details-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>Paper details</h2>
        <p>
          {coverPage
            ? 'The Cover Page prints these, and the paper code prints at the foot of each page. A blank detail prints nothing.'
            : 'This Exam’s Paper Style prints no Cover Page. Choose Exam Board under Format › Paper style to print these.'}
        </p>
        <label>Subject line
          <input
            ref={first}
            value={draft.subject}
            disabled={disabled}
            placeholder="Biology: Paper 2"
            onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
          />
        </label>
        <label>Duration
          <input
            value={draft.duration}
            disabled={disabled}
            placeholder="1 hour 15 minutes"
            onChange={(event) => setDraft({ ...draft, duration: event.target.value })}
          />
        </label>
        <label>Paper code
          <input
            value={draft.paperCode}
            disabled={disabled}
            onChange={(event) => setDraft({ ...draft, paperCode: event.target.value })}
          />
        </label>
        <label>Instructions, one a line
          <textarea
            value={draft.instructions ?? instructionsOf(undefined).join('\n')}
            disabled={disabled}
            onChange={(event) => setDraft({ ...draft, instructions: event.target.value })}
          />
        </label>
        {draft.instructions !== null && (
          <button
            type="button"
            className="secondary-button paper-details-reset"
            disabled={disabled}
            onClick={() => setDraft({ ...draft, instructions: null })}
          >
            Use the style’s own instructions
          </button>
        )}
        <fieldset className="paper-details-fields" disabled={disabled}>
          <legend>Candidate fields</legend>
          {CANDIDATE_FIELDS.map((field) => (
            <label key={field}>
              <input type="checkbox" checked={fields.includes(field)} onChange={() => toggleField(field)} />
              {CANDIDATE_FIELD_LABELS[field]}
            </label>
          ))}
        </fieldset>
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="primary-button"
            disabled={disabled}
            onClick={() => {
              onSave(paperDetailsOf(draft))
              onClose()
            }}
          >
            Save details
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
