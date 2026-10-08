import { describe, expect, test } from 'bun:test'
import { Schema } from '@milkdown/kit/prose/model'
import { EditorState } from '@milkdown/kit/prose/state'
import { answeringPartsOf, DEFAULT_COLUMNS, duplicateQuestion, partsOf, type Question } from './exam'
import { cleanDocument, type ProseMirrorJSON } from './question-doc'
import {
  isMarked,
  marksLabel,
  marksOfQuestion,
  parseMarksInput,
  readMarks,
  totalMarksOf,
  unmarkedCountOf,
  withPartMarks,
  withQuestionMarks,
} from './marks'
import { addSubparts, deleteSubpart, setPartMarks } from './multipart'
import { buildExportDocument, type AnswerKeyEntryItem } from './export-plan'
import { FIXTURES } from './export-fixtures'

// Marks on what a student answers (ADR-0042), with invented questions.

function paragraph(text: string): ProseMirrorJSON {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

const mc = (...ids: string[]): ProseMirrorJSON => ({
  type: 'multipleChoice',
  content: ids.map((id, index) => ({
    type: 'multipleChoiceChoice',
    attrs: { id, correct: index === 0 },
    content: [paragraph(id)],
  })),
})
const sa = (): ProseMirrorJSON => ({ type: 'suggestedAnswer', content: [{ type: 'paragraph' }] })

function answering(
  type: 'multipartPart' | 'multipartSubpart',
  id: string,
  answer: ProseMirrorJSON,
  marks?: number,
): ProseMirrorJSON {
  return {
    type,
    attrs: { id, columns: 2, ...(marks === undefined ? {} : { marks }) },
    content: [{ type: 'multipartPartStem', content: [paragraph(`stem ${id}`)] }, answer],
  }
}

function holding(id: string, subparts: ProseMirrorJSON[], marks?: number): ProseMirrorJSON {
  return {
    type: 'multipartPart',
    attrs: { id, columns: 2, ...(marks === undefined ? {} : { marks }) },
    content: [
      { type: 'multipartPartStem', content: [paragraph(`lead-in ${id}`)] },
      { type: 'multipartSubparts', content: subparts },
    ],
  }
}

function multipart(id: string, parts: ProseMirrorJSON[]): Question {
  return {
    id,
    type: 'multipart',
    columns: DEFAULT_COLUMNS,
    doc: { type: 'doc', content: [paragraph('A map of a river.'), { type: 'multipartParts', content: parts }] },
  }
}

function single(id: string, type: Question['type'], marks?: number): Question {
  return {
    id,
    type,
    columns: DEFAULT_COLUMNS,
    doc: { type: 'doc', content: [paragraph(id)] },
    ...(marks === undefined ? {} : { marks }),
  }
}

/** Part a answers for 2; Part b leads in to Subparts worth 1 and 3, and one unmarked. */
const river = () =>
  multipart('r', [
    answering('multipartPart', 'a', mc('a1', 'a2'), 2),
    holding('b', [
      answering('multipartSubpart', 'b-i', sa(), 1),
      answering('multipartSubpart', 'b-ii', sa(), 3),
      answering('multipartSubpart', 'b-iii', sa()),
    ]),
  ])

describe('reading Marks', () => {
  test('are a positive whole number, and anything else is unmarked', () => {
    expect(readMarks(3)).toBe(3)
    for (const value of [0, -1, 1.5, '2', null, undefined, Number.NaN, Infinity]) {
      expect(readMarks(value)).toBeUndefined()
    }
  })

  test('a typed field reads a whole number, clears on empty, and changes nothing otherwise', () => {
    expect(parseMarksInput(' 4 ')).toBe(4)
    expect(parseMarksInput('')).toBeNull()
    expect(parseMarksInput('  ')).toBeNull()
    for (const text of ['0', '-2', '1.5', 'two', '3a', '1e2']) {
      expect(parseMarksInput(text)).toBeUndefined()
    }
  })

  test('are counted in words', () => {
    expect(marksLabel(1)).toBe('1 mark')
    expect(marksLabel(24)).toBe('24 marks')
  })
})

describe('what a Question is worth', () => {
  test('a Multiple Choice, True/False, Short Answer or Matching question is worth its own Marks', () => {
    for (const type of ['multiple-choice', 'true-false', 'open', 'matching'] as const) {
      expect(marksOfQuestion(single('q', type, 2))).toBe(2)
      expect(marksOfQuestion(single('q', type))).toBeUndefined()
    }
  })

  test('a stored value that is not Marks reads as unmarked', () => {
    expect(marksOfQuestion({ ...single('q', 'open'), marks: 0 })).toBeUndefined()
    expect(marksOfQuestion({ ...single('q', 'open'), marks: 2.5 })).toBeUndefined()
  })

  test('a Multipart question is worth the sum of its answering Parts and Subparts', () => {
    expect(answeringPartsOf(river()).map(({ id, marks }) => [id, marks])).toEqual([
      ['a', 2], ['b-i', 1], ['b-ii', 3], ['b-iii', undefined],
    ])
    expect(marksOfQuestion(river())).toBe(6)
  })

  test('a Part holding Subparts never adds Marks of its own, and nor does the question', () => {
    const question = multipart('r', [holding('b', [answering('multipartSubpart', 'b-i', sa(), 1)], 5)])
    expect(partsOf(question)[0]!.marks).toBeUndefined()
    expect(marksOfQuestion({ ...question, marks: 9 })).toBe(1)
  })

  test('a Multipart question with nothing marked is unmarked, not worth nothing', () => {
    const question = multipart('r', [answering('multipartPart', 'a', sa())])
    expect(marksOfQuestion(question)).toBeUndefined()
    expect(isMarked(question)).toBe(false)
  })
})

describe('an Exam’s total', () => {
  test('sums what is marked and counts what is not', () => {
    const questions = [single('a', 'multiple-choice', 1), single('b', 'open'), river(), single('c', 'matching', 4)]
    expect(totalMarksOf(questions)).toBe(11)
    expect(unmarkedCountOf(questions)).toBe(1)
  })

  test('is absent when nothing is marked', () => {
    const questions = [single('a', 'multiple-choice'), single('b', 'open')]
    expect(totalMarksOf(questions)).toBeUndefined()
    expect(unmarkedCountOf(questions)).toBe(2)
    expect(totalMarksOf([])).toBeUndefined()
  })
})

describe('changing Marks', () => {
  test('a question’s own Marks are set and cleared, and never on a Multipart question', () => {
    expect(withQuestionMarks(single('q', 'open'), 3).marks).toBe(3)
    expect('marks' in withQuestionMarks(single('q', 'open', 3), null)).toBe(false)
    expect('marks' in withQuestionMarks(river(), 3)).toBe(false)
  })

  test('a Part’s or Subpart’s Marks are set on its node, and a lead-in takes none', () => {
    const set = withPartMarks(river(), 'b-iii', 5)
    expect(marksOfQuestion(set)).toBe(11)
    const cleared = withPartMarks(set, 'a', null)
    expect(answeringPartsOf(cleared).map(({ marks }) => marks)).toEqual([undefined, 1, 3, 5])
    expect(withPartMarks(river(), 'b', 4)).toEqual(river())
    expect(withPartMarks(river(), 'nowhere', 4)).toEqual(river())
  })

  test('a duplicate keeps every Mark', () => {
    expect(marksOfQuestion(duplicateQuestion(river()))).toBe(6)
    expect(duplicateQuestion(single('q', 'open', 2)).marks).toBe(2)
  })
})

describe('Marks in a stored document', () => {
  test('survive cleaning on a Part or Subpart that answers', () => {
    expect(cleanDocument(river().doc)).toEqual(river().doc)
  })

  test('an unmarked Part keeps no `marks` at all, and a lead-in loses any it carried', () => {
    const editorShaped = multipart('r', [
      { ...answering('multipartPart', 'a', sa()), attrs: { id: 'a', columns: 2, marks: null } },
      holding('b', [answering('multipartSubpart', 'b-i', sa(), 1)], 4),
    ])
    const cleaned = cleanDocument(editorShaped.doc)
    const parts = (cleaned.content as ProseMirrorJSON[])[1]!.content as ProseMirrorJSON[]
    expect(parts[0]!.attrs).toEqual({ id: 'a', columns: 2 })
    expect(parts[1]!.attrs).toEqual({ id: 'b', columns: 2 })
  })
})

describe('Marks in the Part editor', () => {
  const schema = new Schema({
    nodes: {
      doc: { content: 'multipartParts' },
      text: { group: 'inline' },
      paragraph: { group: 'block', content: 'inline*' },
      multipleChoiceChoice: {
        content: 'paragraph block*',
        attrs: { correct: { default: false }, id: { default: '' } },
      },
      multipleChoice: { content: 'multipleChoiceChoice+' },
      suggestedAnswer: { content: 'block+' },
      multipartPartStem: { content: 'block+' },
      multipartPart: {
        content: 'multipartPartStem (multipleChoice | suggestedAnswer | multipartSubparts)',
        attrs: { id: { default: '' }, columns: { default: 2 }, marks: { default: null } },
      },
      multipartSubpart: {
        content: 'multipartPartStem (multipleChoice | suggestedAnswer)',
        attrs: { id: { default: '' }, columns: { default: 2 }, marks: { default: null } },
      },
      multipartSubparts: { content: 'multipartSubpart+' },
      multipartParts: { content: 'multipartPart*' },
    },
  })

  function editorWith(part: ProseMirrorJSON) {
    let state = EditorState.create({
      schema,
      doc: schema.nodeFromJSON({ type: 'doc', content: [{ type: 'multipartParts', content: [part] }] }),
    })
    const view = {
      get state() { return state },
      dispatch(transaction: Parameters<typeof state.apply>[0]) { state = state.apply(transaction) },
    }
    const part0 = () => view.state.doc.nodeAt(1)!
    const subpartAt = () => 1 + 1 + part0().firstChild!.nodeSize + 1
    return { view, part: part0, subpartAt }
  }

  test('a Part’s Marks are set, cleared, and never set on a lead-in', () => {
    const { view, part } = editorWith(answering('multipartPart', 'p', sa()))
    expect(setPartMarks(view, 1, 3)).toBe(true)
    expect(part().attrs.marks).toBe(3)
    expect(setPartMarks(view, 1, 3)).toBe(false)
    expect(setPartMarks(view, 1, null)).toBe(true)
    expect(part().attrs.marks).toBeNull()
    const lead = editorWith(holding('p', [answering('multipartSubpart', 's', sa())]))
    expect(setPartMarks(lead.view, 1, 2)).toBe(false)
    expect(setPartMarks(lead.view, lead.subpartAt(), 2)).toBe(true)
    expect(lead.part().lastChild!.firstChild!.attrs.marks).toBe(2)
  })

  test('Add Subparts moves a Part’s Marks into Subpart (i), and removing it moves them back', () => {
    const { view, part, subpartAt } = editorWith(answering('multipartPart', 'p', mc('x', 'y'), 4))
    addSubparts(view, 1)
    expect(part().attrs.marks).toBeNull()
    expect(part().lastChild!.firstChild!.attrs).toEqual({ id: 'p', columns: 2, marks: 4 })
    deleteSubpart(view, subpartAt())
    expect(part().attrs).toEqual({ id: 'p', columns: 2, marks: 4 })
  })
})

describe('Marks in the Export Document', () => {
  const marked = FIXTURES.find((fixture) => fixture.name === 'a marked paper')!
  const exportDocument = () =>
    buildExportDocument(marked.exam, marked.arrangement, { test: true, answerKey: true })
  const planned = () =>
    exportDocument().test.flatMap((item) => (item.kind === 'question' ? [item.question] : []))

  test('plan each question’s worth, and each Part’s and Subpart’s, as data', () => {
    expect(planned().map((question) => question.totalMarks)).toEqual([1, undefined, 2, 6])
    const [a, b] = planned()[3]!.parts!
    expect(a!.marks).toBe(1)
    expect(b!.marks).toBeUndefined()
    expect(b!.subparts.map((subpart) => subpart.marks)).toEqual([2, 3])
  })

  test('the key carries the paper’s total and each marked line’s Marks', () => {
    const key = exportDocument().answerKey
    expect(key[0]).toEqual({ kind: 'answer-key-heading', totalMarks: 9 })
    const entries = key.filter((item): item is AnswerKeyEntryItem => item.kind === 'answer-key-entry')
    expect(entries.map((entry) => [entry.number, entry.marks])).toEqual([
      [1, 1], [2, undefined], [3, 2], [4, undefined], [5, undefined],
    ])
    expect(entries.at(-1)!.parts!.map((line) => [line.letter, line.marks])).toEqual([
      ['a', 1], ['b (i)', 2], ['b (ii)', 3],
    ])
  })

  test('an unmarked paper plans exactly as before: no total and no Marks anywhere', () => {
    const unmarked = FIXTURES.find((fixture) => fixture.name === 'a multipart whose part holds subparts')!
    const document = buildExportDocument(unmarked.exam, unmarked.arrangement, { test: true, answerKey: true })
    expect(document.answerKey[0]).toEqual({ kind: 'answer-key-heading' })
    expect(JSON.stringify(document)).not.toMatch(/"(total)?[mM]arks":\d/)
  })
})
