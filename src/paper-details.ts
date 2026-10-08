// Paper Details: facts about one Exam that its Paper Style may print (ADR-0045).
//
// A subject line, a duration, a paper code, an instructions list and which
// candidate fields to ask for — the teacher's own words for this Exam, stored
// on it beside its Page Header and edited from the Format menu. A style that
// prints a Cover Page fills it from these, and prints nothing for one the
// teacher left blank. The paper's total is never a Paper Detail: it is counted
// from the Marks (`marks.ts`).
//
// Only what the teacher wrote is stored, as `page-header.ts` stores its lines:
// an Exam whose details are all blank stores nothing. Two members are lists,
// and for those absent and empty differ: absent takes the style's own (the
// Exam Board style's default instructions and candidate fields), while an
// empty list is the teacher asking for none.

/** A box on the Cover Page a candidate fills in. */
export type CandidateField = 'name' | 'class' | 'candidate-number' | 'centre-number' | 'date'

/** Every candidate field a teacher may ask for, in the order they print. */
export const CANDIDATE_FIELDS: readonly CandidateField[] = [
  'name',
  'class',
  'candidate-number',
  'centre-number',
  'date',
]

/** How each candidate field is labelled beside its box. */
export const CANDIDATE_FIELD_LABELS: Record<CandidateField, string> = {
  name: 'Name',
  class: 'Class',
  'candidate-number': 'Candidate number',
  'centre-number': 'Centre number',
  date: 'Date',
}

export type PaperDetails = {
  /** The subject line under the title, such as "Biology: Paper 2". */
  subject?: string
  /** How long the paper takes, as the teacher writes it: "1 hour 15 minutes". */
  duration?: string
  /** A short code identifying the paper, printed at each test page's foot. */
  paperCode?: string
  /** The instructions the Cover Page lists, in order. Absent takes the
   *  style's own; empty lists none. */
  instructions?: string[]
  /** Which candidate fields the Cover Page asks for. Absent takes the style's
   *  own; empty asks for none. */
  candidateFields?: CandidateField[]
}

const TEXT_DETAILS = ['subject', 'duration', 'paperCode'] as const

/** The instructions an Exam Board style Cover Page lists when the teacher has
 *  written none — Test Parrot's own words, written for it and taken from no
 *  exam board's paper (ADR-0044). */
export const DEFAULT_INSTRUCTIONS: readonly string[] = [
  'Answer every question.',
  'Write each answer in the space below its question.',
  'The marks for each answer are shown in brackets [ ] at the right-hand margin.',
]

/** The candidate fields an Exam Board style Cover Page asks for when the
 *  teacher has chosen none. */
export const DEFAULT_CANDIDATE_FIELDS: readonly CandidateField[] = ['name', 'class', 'candidate-number']

export function isCandidateField(value: unknown): value is CandidateField {
  return CANDIDATE_FIELDS.includes(value as CandidateField)
}

/** Whether a stored value is Paper Details this build can print — the single
 *  guard storage and import share. */
export function isPaperDetails(value: unknown): value is PaperDetails {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const details = value as Record<string, unknown>
  const known = new Set<string>([...TEXT_DETAILS, 'instructions', 'candidateFields'])
  return (
    Object.keys(details).every((key) => known.has(key))
    && TEXT_DETAILS.every((key) => details[key] === undefined || typeof details[key] === 'string')
    && (details.instructions === undefined
      || (Array.isArray(details.instructions) && details.instructions.every((line) => typeof line === 'string')))
    && (details.candidateFields === undefined
      || (Array.isArray(details.candidateFields) && details.candidateFields.every(isCandidateField)))
  )
}

/**
 * Paper Details as they are stored: each text trimmed and left out when
 * blank, blank instruction lines dropped, candidate fields in their printed
 * order without repeats — and `undefined` when nothing is left, so an Exam
 * whose details are all blank stores nothing.
 */
export function normalizedPaperDetails(details: PaperDetails | undefined): PaperDetails | undefined {
  if (!details) return undefined
  const next: PaperDetails = {}
  for (const key of TEXT_DETAILS) {
    const text = details[key]?.trim()
    if (text) next[key] = text
  }
  if (details.instructions !== undefined) {
    next.instructions = details.instructions.map((line) => line.trim()).filter(Boolean)
  }
  if (details.candidateFields !== undefined) {
    next.candidateFields = CANDIDATE_FIELDS.filter((field) => details.candidateFields!.includes(field))
  }
  return Object.keys(next).length > 0 ? next : undefined
}

/** Whether two Exams have the same Paper Details. Absent and blank agree. */
export function samePaperDetails(left: PaperDetails | undefined, right: PaperDetails | undefined): boolean {
  return JSON.stringify(normalizedPaperDetails(left) ?? {}) === JSON.stringify(normalizedPaperDetails(right) ?? {})
}

/** The instructions a Cover Page lists: the teacher's, or the style's own. */
export function instructionsOf(details: PaperDetails | undefined): readonly string[] {
  return details?.instructions ?? DEFAULT_INSTRUCTIONS
}

/** The candidate fields a Cover Page asks for: the teacher's, or the style's own. */
export function candidateFieldsOf(details: PaperDetails | undefined): readonly CandidateField[] {
  return details?.candidateFields ?? DEFAULT_CANDIDATE_FIELDS
}
