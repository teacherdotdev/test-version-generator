// Marks: what answering something is worth (ADR-0042).
//
// Marks are stored only on what a student answers — a Multiple Choice,
// True/False, Short Answer or Matching Question, or a Part or Subpart that
// answers — and everything larger is counted from them here: a Multipart
// question's Marks and an Exam's total are sums, never stored, so they can
// never disagree with their parts.
//
// Unmarked is not zero. Something with no Marks adds nothing to a sum, and a
// sum over nothing marked is no Marks at all rather than 0, so an Exam whose
// Questions nobody has marked shows no total.

import { answeringPartsOf, type Question } from './exam'
import { readMarks, type ProseMirrorJSON } from './question-doc'

export { parseMarksInput, readMarks } from './question-doc'

/** Whether Marks are set on the Question itself, rather than counted from its
 *  Parts: every Question Type but Multipart. */
export function marksOnQuestion(question: Pick<Question, 'type'>): boolean {
  return question.type !== 'multipart'
}

/** The sum of whichever of `values` are Marks; `undefined` when none is. */
export function sumOfMarks(values: readonly (number | undefined)[]): number | undefined {
  let total: number | undefined
  for (const value of values) {
    if (value !== undefined) total = (total ?? 0) + value
  }
  return total
}

/** What a Question is worth: its own Marks, or for a Multipart question the
 *  sum of its answering Parts' and Subparts'. `undefined` when nothing in it
 *  is marked. A Multipart question's own `marks`, should a stored one carry
 *  any, is never read. */
export function marksOfQuestion(question: Question): number | undefined {
  if (!marksOnQuestion(question)) {
    return sumOfMarks(answeringPartsOf(question).map((part) => part.marks))
  }
  return readMarks(question.marks)
}

/** Whether anything in a Question is marked. */
export function isMarked(question: Question): boolean {
  return marksOfQuestion(question) !== undefined
}

/** An Exam's total Marks over its Questions; `undefined` when none of them is
 *  marked, so an Exam nobody has marked shows no total. */
export function totalMarksOf(questions: readonly Question[]): number | undefined {
  return sumOfMarks(questions.map(marksOfQuestion))
}

/** How many of these Questions have no Marks at all. A Multipart question with
 *  even one marked Part counts as marked. */
export function unmarkedCountOf(questions: readonly Question[]): number {
  return questions.filter((question) => !isMarked(question)).length
}

/** Marks written as a count a teacher reads: "1 mark", "24 marks". */
export function marksLabel(marks: number): string {
  return `${marks} ${marks === 1 ? 'mark' : 'marks'}`
}

/** A question with its own Marks set to `marks`, or cleared by `null`. */
export function withQuestionMarks(question: Question, marks: number | null): Question {
  const next: Question = { ...question }
  if (marks === null || !marksOnQuestion(question)) delete next.marks
  else next.marks = marks
  return next
}

/** A Multipart question with the Part or Subpart `partId` given `marks`, or
 *  cleared by `null`. Only a Part or Subpart that answers takes Marks: a Part
 *  holding Subparts, an id the question does not hold, or a question of any
 *  other type comes back unchanged. */
export function withPartMarks(question: Question, partId: string, marks: number | null): Question {
  if (!answeringPartsOf(question).some(({ id }) => id === partId)) return question
  const visit = (node: ProseMirrorJSON): ProseMirrorJSON => {
    const attrs = (node.attrs ?? {}) as Record<string, unknown>
    if (
      (node.type === 'multipartPart' || node.type === 'multipartSubpart')
      && attrs.id === partId
    ) {
      const { marks: _previous, ...rest } = attrs
      void _previous
      return { ...node, attrs: marks === null ? rest : { ...rest, marks } }
    }
    return Array.isArray(node.content)
      ? { ...node, content: (node.content as ProseMirrorJSON[]).map(visit) }
      : node
  }
  return { ...question, doc: visit(question.doc) }
}
