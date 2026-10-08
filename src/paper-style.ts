// What an Exam's Paper Style says about how its questions print.
//
// A Paper Style is one test-wide preset, chosen from the Format menu like
// the heading and text sizes (ADR-0025), and never set per question or per
// Question Type (ADR-0041). It decides what prints before a question's number,
// how answers are lettered and laid out, how a matching set's Word Bank sits,
// what room a Short Answer position leaves when the teacher has set none, and
// how far apart questions stand. The Export Document reads these rules once,
// so print, PDF, DOCX, the Export Preview and the exam sheet all draw the same
// thing; nothing here is read by an adapter.
//
// `'standard'` is the sheet as it printed before Paper Styles existed, so an
// Exam that never chose one prints exactly as it always did.

import type { WorkSpace } from './exam'

export type PaperStyle = 'standard' | 'classic' | 'condensed'

export const PAPER_STYLES: readonly PaperStyle[] = [
  'standard',
  'classic',
  'condensed',
]

export const DEFAULT_PAPER_STYLE: PaperStyle = 'standard'

/** Whether a stored value is a Paper Style this build can print. The single
 *  guard, so storage and import agree on what a readable record is. */
export function isPaperStyle(value: unknown): value is PaperStyle {
  return PAPER_STYLES.includes(value as PaperStyle)
}

/** How each Paper Style is named, and said in a line, in the Format menu. */
export const PAPER_STYLE_LABELS: Record<PaperStyle, { label: string; description: string }> = {
  standard: {
    label: 'Standard',
    description: 'Circle the letter or T/F; no blanks before numbers.',
  },
  classic: {
    label: 'Classic',
    description: 'A blank before each objective number; ruled lines for written answers.',
  },
  condensed: {
    label: 'Condensed',
    description: 'Saves paper: tighter spacing, answers across where they fit, closer-ruled lines.',
  },
}

/** The answer blank a student writes a letter, or T or F, on, printed before a
 *  question's number. The same seven underscores an Export Record made before
 *  Sections were stored printed there (ADR-0029), so such a record reprints
 *  through the same path. */
export const ANSWER_BLANK = '_______'

/** How a style letters answers on the test. The Answer Key keeps its capitals
 *  whatever the test prints: it is the teacher's reference, as a common test
 *  generator's own key reads "ANS: A" beside a test lettered "a.". */
export type Lettering = 'upper' | 'lower'

/** Where a Matching position's Word Bank goes when it takes a layout — when
 *  the question arrives on the Exam, or the Exam takes this style: beside its
 *  Items wherever it fits and above them otherwise (`'fit'`), or above them
 *  (`'above'`). A teacher may then move any one; the style sets them all
 *  again only when the Exam changes style (`wordBankLayoutFor`). */
export type BankPlacement = 'fit' | 'above'

export type PaperStyleRules = {
  /** What prints before a True/False question's number. */
  trueFalseMarks: readonly string[]
  /** What prints before a Multiple Choice question's number. */
  multipleChoiceMarks: readonly string[]
  /** How a Multiple Choice question's answers, and a Word Bank, are lettered.
   *  A Multiple Choice Part keeps its capitals, so its answers never read as
   *  the Part letters `a.`, `b.` beside them. */
  lettering: Lettering
  /** Whether a Multiple Choice question's or Part's answers widen past the
   *  columns the teacher set, to as many as hold each answer on one line.
   *  Never narrower than the teacher's own setting. */
  answersAcross: boolean
  bankPlacement: BankPlacement
  /** The room a Short Answer question or Part leaves when the teacher has set
   *  none on this Exam. An explicit Work Space — "None" included — always
   *  wins; `null` leaves no room, as every Exam did before. */
  defaultWorkSpace: WorkSpace | null
  /** The space below each question, in CSS pixels: `.exam-question`'s bottom
   *  margin in styles.css, which `export-typography.test.ts` holds to it. */
  questionGap: number
  /** How far apart a Work Space's rows lie on the page, in CSS pixels. Every
   *  Work Space keeps its count of rows under every style; a smaller pitch
   *  only sets them closer, and never rewrites a stored height. */
  workSpacePitch: number
}

/** The letters a True/False question's student circles, in the order they print. */
export const TRUE_FALSE_MARKS: readonly string[] = ['T', 'F']

/** The question gap every style but Condensed keeps: the sheet's own. */
export const STANDARD_QUESTION_GAP = 26

/** The Work Space pitch every style but Condensed keeps: `WORK_SPACE_LINE_PITCH`,
 *  a third of an inch. */
const STANDARD_WORK_SPACE_PITCH = 32

export const PAPER_STYLE_RULES: Record<PaperStyle, PaperStyleRules> = {
  // The sheet as ADR-0029 left it: T and F to circle, a letter circled on its
  // answer, no blanks, and no room a teacher did not ask for.
  standard: {
    trueFalseMarks: TRUE_FALSE_MARKS,
    multipleChoiceMarks: [],
    lettering: 'upper',
    answersAcross: false,
    bankPlacement: 'fit',
    defaultWorkSpace: null,
    questionGap: STANDARD_QUESTION_GAP,
    workSpacePitch: STANDARD_WORK_SPACE_PITCH,
  },
  // Modeled on what common test generators print by default: an answer blank
  // before every objective question's number, True/False written on that
  // blank rather than offered as choices, matching choices lettered a–z above
  // the numbered Items, and answer lines below open-ended questions.
  classic: {
    trueFalseMarks: [ANSWER_BLANK],
    multipleChoiceMarks: [ANSWER_BLANK],
    lettering: 'lower',
    answersAcross: false,
    bankPlacement: 'above',
    defaultWorkSpace: { height: 96, style: 'lines', fill: false },
    questionGap: STANDARD_QUESTION_GAP,
    workSpacePitch: STANDARD_WORK_SPACE_PITCH,
  },
  // Paper first: nothing added before a number, questions closer together,
  // answers laid across the line wherever they fit, and room to write kept
  // but ruled closer — three lines where none were set, a quarter-inch apart,
  // the college-ruled spacing.
  condensed: {
    trueFalseMarks: TRUE_FALSE_MARKS,
    multipleChoiceMarks: [],
    lettering: 'upper',
    answersAcross: true,
    bankPlacement: 'fit',
    defaultWorkSpace: { height: 96, style: 'lines', fill: false },
    questionGap: 12,
    workSpacePitch: 24,
  },
}

/** The rules an Exam prints by; absent means Standard. So does a name this
 *  build no longer knows, such as one a recorded Layout Plan kept from before
 *  a style was renamed: its page keeps what the plan resolved, and only the
 *  question gap falls back to the sheet's own. */
export function paperStyleRules(style: PaperStyle | undefined): PaperStyleRules {
  return PAPER_STYLE_RULES[isPaperStyle(style) ? style : DEFAULT_PAPER_STYLE]
}
