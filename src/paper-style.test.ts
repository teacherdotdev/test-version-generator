// A Paper Style's rules, read through the planner's own interface: an Exam
// in, a Layout Plan out. What each preset prints before a number, how it
// letters and lays out answers, where it puts a Word Bank, what room it gives a
// Short Answer position the teacher left alone, and how it spaces questions.

import { describe, expect, test } from 'bun:test'
import {
  buildExportDocument,
  choiceAreaWidth,
  isAnswerKeyHeader,
  pageSizeOf,
  planExport,
  questionIndentOf,
  unmeasured,
  type Measure,
  type PageItem,
  type QuestionItem,
} from './export-plan'
import {
  DEFAULT_COLUMNS,
  workSpaceOf,
  type Arrangement,
  type ColumnSetting,
  type Exam,
  type Question,
} from './exam'
import type { ProseMirrorJSON } from './question-doc'
import {
  ANSWER_BLANK,
  PAPER_STYLES,
  PAPER_STYLE_RULES,
  isPaperStyle,
  type PaperStyle,
} from './paper-style'

const paragraph = (text: string): ProseMirrorJSON => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
})

function choice(id: string, correct = false, text = id): ProseMirrorJSON {
  return { type: 'multipleChoiceChoice', attrs: { correct, id }, content: [paragraph(text)] }
}

function multipleChoice(
  id: string,
  choiceIds: string[],
  correctId = '',
  columns: ColumnSetting = 1,
): Question {
  return {
    id,
    type: 'multiple-choice',
    doc: {
      type: 'doc',
      content: [
        paragraph(`stem ${id}`),
        { type: 'multipleChoice', content: choiceIds.map((cid) => choice(cid, cid === correctId)) },
      ],
    },
    columns,
  }
}

function trueFalse(id: string): Question {
  return {
    id,
    type: 'true-false',
    doc: {
      type: 'doc',
      content: [
        paragraph(`stem ${id}`),
        { type: 'multipleChoice', content: [choice(`${id}-t`, true), choice(`${id}-f`)] },
      ],
    },
    columns: DEFAULT_COLUMNS,
  }
}

function matching(id: string, matches: string[], bankIds: string[]): Question {
  return {
    id,
    type: 'matching',
    doc: {
      type: 'doc',
      content: [
        paragraph(`stem ${id}`),
        {
          type: 'matching',
          content: [
            ...matches.map((answer, index) => ({
              type: 'matchingPrompt',
              attrs: { id: `${id}-p${index + 1}`, answer },
              content: [paragraph(`item ${index + 1}`)],
            })),
            ...bankIds.map((bankId) => ({
              type: 'matchingAnswer',
              attrs: { id: bankId },
              content: [paragraph(bankId)],
            })),
          ],
        },
      ],
    },
    columns: DEFAULT_COLUMNS,
  }
}

function open(id: string): Question {
  return { id, type: 'open', doc: { type: 'doc', content: [paragraph(id)] }, columns: DEFAULT_COLUMNS }
}

/** A Multipart question with a Multiple Choice Part `a` and a Short Answer Part `b`. */
function multipart(id: string): Question {
  return {
    id,
    type: 'multipart',
    columns: DEFAULT_COLUMNS,
    doc: {
      type: 'doc',
      content: [
        paragraph(`passage ${id}`),
        {
          type: 'multipartParts',
          content: [
            {
              type: 'multipartPart',
              attrs: { id: `${id}-a`, columns: 1 },
              content: [
                { type: 'multipartPartStem', content: [paragraph('part a')] },
                { type: 'multipleChoice', content: [choice(`${id}-a1`, true), choice(`${id}-a2`)] },
              ],
            },
            {
              type: 'multipartPart',
              attrs: { id: `${id}-b`, columns: 1 },
              content: [
                { type: 'multipartPartStem', content: [paragraph('part b')] },
                { type: 'suggestedAnswer', content: [paragraph('')] },
              ],
            },
          ],
        },
      ],
    },
  }
}

const ARRANGEMENT: Arrangement = { id: 'v1', letter: 'A', questionOrder: [], choiceOrder: {} }

function examOf(questions: Question[], paperStyle?: PaperStyle, extra: Partial<Exam> = {}): Exam {
  return { title: 'Styles', questions, ...(paperStyle ? { paperStyle } : {}), ...extra }
}

function plan(exam: Exam, measure: Measure = unmeasured) {
  return planExport({ exam, arrangement: ARRANGEMENT, selection: { test: true, answerKey: true }, measure })
}

function testItems(exam: Exam, measure?: Measure): QuestionItem[] {
  return plan(exam, measure).pages
    .filter((page) => !isAnswerKeyHeader(page.header))
    .flatMap((page) => page.items)
    .flatMap((item) => (item.kind === 'question' ? [item] : []))
}

function keyItems(exam: Exam): PageItem[] {
  return plan(exam).pages.filter((page) => isAnswerKeyHeader(page.header)).flatMap((page) => page.items)
}

const gridLetters = (item: QuestionItem) =>
  (item.grid?.cells ?? []).flatMap((row) => row.map((cell) => cell?.letter ?? '-'))

const EVERY_TYPE = [
  multipleChoice('mc', ['a', 'b', 'c', 'd'], 'b'),
  trueFalse('tf'),
  matching('mx', ['w2', 'w1'], ['w1', 'w2', 'w3']),
  open('sa'),
  multipart('mp'),
]

describe('Paper Styles', () => {
  test('are three, read by one guard, with Standard the default', () => {
    expect(PAPER_STYLES).toEqual(['standard', 'classic', 'condensed'])
    for (const style of PAPER_STYLES) expect(isPaperStyle(style)).toBe(true)
    expect(isPaperStyle('fancy')).toBe(false)
    expect(isPaperStyle(undefined)).toBe(false)
  })

  test('Standard plans exactly what an Exam with no style plans', () => {
    const before = plan(examOf(EVERY_TYPE))
    expect(plan(examOf(EVERY_TYPE, 'standard'))).toEqual(before)
    expect(before.paperStyle).toBeUndefined()
    expect(buildExportDocument(examOf(EVERY_TYPE, 'standard'), ARRANGEMENT, { test: true, answerKey: false }).paperStyle)
      .toBeUndefined()
  })

  test('a plan names any other style it was laid out in, so a reprint reproduces it', () => {
    for (const style of ['classic', 'condensed'] as const) {
      expect(plan(examOf(EVERY_TYPE, style)).paperStyle).toBe(style)
    }
  })

  test('the Answer Key is the same whatever the test prints', () => {
    const standard = keyItems(examOf(EVERY_TYPE))
    for (const style of PAPER_STYLES) {
      expect(keyItems(examOf(EVERY_TYPE, style)), style).toEqual(standard)
    }
  })
})

describe('Standard', () => {
  test('circles T or F, circles a capital letter, and adds no room', () => {
    const [mc, tf, , sa, mp] = testItems(examOf(EVERY_TYPE))
    expect(mc!.question.marks).toEqual([])
    expect(tf!.question.marks).toEqual(['T', 'F'])
    expect(gridLetters(mc!)).toEqual(['A', 'B', 'C', 'D'])
    expect(sa!.workSpace!.height).toBe(0)
    expect(mp!.parts![1]!.workSpace!.height).toBe(0)
  })
})

describe('Classic', () => {
  const items = () => testItems(examOf(EVERY_TYPE, 'classic'))

  test('puts an answer blank before every objective question’s number', () => {
    const [mc, tf, mx, sa, mp] = items()
    expect(mc!.question.marks).toEqual([ANSWER_BLANK])
    expect(tf!.question.marks).toEqual([ANSWER_BLANK])
    expect(sa!.question.marks).toEqual([])
    expect(mp!.question.marks).toEqual([])
    // A matching set's Items keep their own blanks, as on every style.
    expect(mx!.question.marks).toEqual([])
    // The blank's column is the one an Export Record from before Sections
    // printed it in.
    expect(questionIndentOf(mc!.question)).toBe(98)
    expect(questionIndentOf(tf!.question)).toBe(98)
  })

  test('prints True/False as the statement and its blank, never the T and F to circle', () => {
    const [, tf] = items()
    expect(tf!.grid).toBeNull()
    expect(tf!.question.marks).not.toContain('T')
  })

  test('letters Multiple Choice answers “a.” on the test, in the question’s own columns', () => {
    const exam = examOf([multipleChoice('mc', ['a', 'b', 'c', 'd'], 'b', 2)], 'classic')
    const [mc] = testItems(exam)
    expect(mc!.grid!.columns).toBe(2)
    expect(gridLetters(mc!)).toEqual(['a', 'c', 'b', 'd'])
    // The question keeps the capitals its Answer Key records.
    expect(mc!.question.choices.map((each) => each.letter)).toEqual(['A', 'B', 'C', 'D'])
  })

  test('keeps a Multiple Choice Part’s capitals, so they never read as Part letters', () => {
    const [, , , , mp] = items()
    expect(mp!.parts![0]!.grid!.cells.flat().map((cell) => cell?.letter)).toEqual(['A', 'B'])
  })

  test('lists a matching set’s lettered choices above its Items, however few', () => {
    const [, , mx] = items()
    const set = mx!.matching!
    expect(set.bankGrid).not.toBeNull()
    expect(set.bankGrid!.cells.flat().map((cell) => cell?.letter ?? '-')).toEqual(['a', 'c', 'b', '-'])
    expect(set.bank.map((answer) => answer.letter)).toEqual(['a', 'b', 'c'])
    // Each Item still records the capital its Answer Key prints.
    expect(set.prompts.map((prompt) => prompt.letter)).toEqual(['B', 'A'])
  })

  test('rules answer lines below a Short Answer question or Part the teacher left alone', () => {
    const [, , , sa, mp] = items()
    // Three rows: a short first one under the stem, then two at the pitch.
    const ruled = { height: 24 + 32 + 32, style: 'lines', lines: 3, fill: false, pitch: 32, firstRow: 24 }
    expect(sa!.workSpace).toEqual(ruled)
    expect(mp!.parts![1]!.workSpace).toEqual(ruled)
  })

  test('never overrides a Work Space the teacher set, “None” included', () => {
    const exam = examOf([open('sa'), open('none'), multipart('mp')], 'classic', {
      workSpace: {
        sa: { height: 160, style: 'blank', fill: false },
        none: { height: 0, style: 'blank', fill: false },
        'mp-b': { height: 32, style: 'lines', fill: true },
      },
    })
    const [sa, none, mp] = testItems(exam)
    expect(sa!.workSpace).toMatchObject({ height: 24 + 4 * 32, style: 'blank', lines: 0, fill: false })
    expect(none!.workSpace!.height).toBe(0)
    expect(mp!.parts![1]!.workSpace!.fill).toBe(true)
    // The one reader says the same to the sheet's menus.
    expect(workSpaceOf(exam, 'none').height).toBe(0)
    expect(workSpaceOf(examOf([open('x')], 'classic'), 'x'))
      .toEqual({ height: 96, style: 'lines', fill: false })
  })
})

describe('Condensed', () => {
  // Every answer is `width` wide on one line, in a cell, at any text size.
  const widths = (width: (choice: { id: string }) => number): Measure => ({
    itemHeight: () => 0,
    choiceWidth: (choice) => width(choice),
  })

  test('adds no blanks, circles T or F, and rules lines where the teacher left a Short Answer alone', () => {
    const [mc, tf, mx, sa, mp] = testItems(examOf(EVERY_TYPE, 'condensed'))
    expect(mc!.question.marks).toEqual([])
    expect(tf!.question.marks).toEqual(['T', 'F'])
    expect(gridLetters(mc!)[0]).toBe('A')
    // Classic's three lines, a quarter-inch apart rather than a third.
    const ruled = { height: 18 + 24 + 24, style: 'lines', lines: 3, fill: false, pitch: 24, firstRow: 18 }
    expect(sa!.workSpace).toEqual(ruled)
    expect(mp!.parts![1]!.workSpace).toEqual(ruled)
    // Matching's blank is where its answer goes, so it stays.
    expect(mx!.matching!.prompts).toHaveLength(2)
  })

  test('keeps every Work Space the teacher set, its rows set closer and its stored height untouched', () => {
    const spaces = {
      sa: { height: 160, style: 'lines', fill: false },
      none: { height: 0, style: 'blank', fill: false },
      blank: { height: 96, style: 'blank', fill: false },
    } as const
    const exam = (style?: PaperStyle) =>
      examOf([open('sa'), open('none'), open('blank')], style, { workSpace: { ...spaces } })
    const [sa, none, blank] = testItems(exam('condensed'))
    expect(sa!.workSpace).toMatchObject({ height: 18 + 4 * 24, lines: 5, pitch: 24, firstRow: 18 })
    expect(none!.workSpace!.height).toBe(0)
    expect(blank!.workSpace).toMatchObject({ height: 18 + 2 * 24, lines: 0 })
    // The same five rows take more room under every other style.
    expect(testItems(exam())[0]!.workSpace).toMatchObject({ height: 24 + 4 * 32, lines: 5 })
    expect(exam('condensed').workSpace).toEqual(spaces)
  })

  test('lays answers across the line, four to a row, when every one fits a quarter of it', () => {
    const exam = examOf([multipleChoice('mc', ['a', 'b', 'c', 'd'])], 'condensed')
    const [mc] = testItems(exam, widths(() => 100))
    expect(mc!.grid!.columns).toBe(4)
    expect(mc!.question.grid!.columns).toBe(4)
    expect(gridLetters(mc!)).toEqual(['A', 'B', 'C', 'D'])
  })

  test('falls back to two across when one answer is too wide for a quarter, and stacks when too wide for half', () => {
    const exam = examOf([multipleChoice('mc', ['a', 'b', 'c', 'd'])], 'condensed')
    expect(testItems(exam, widths(({ id }) => (id === 'c' ? 200 : 60)))[0]!.grid!.columns).toBe(2)
    expect(testItems(exam, widths(({ id }) => (id === 'c' ? 400 : 60)))[0]!.grid!.columns).toBe(1)
  })

  test('never lays answers narrower than the teacher set them', () => {
    const exam = examOf([multipleChoice('mc', ['a', 'b', 'c', 'd'], '', 2)], 'condensed')
    expect(testItems(exam, widths(() => 400))[0]!.grid!.columns).toBe(2)
  })

  test('fits answers to the lane the Exam’s margins and the answers’ indent leave', () => {
    const exam = examOf([multipleChoice('mc', ['a', 'b', 'c', 'd'])], 'condensed')
    // Today's sheet: the content width less the number column and the indent.
    const lane = choiceAreaWidth(pageSizeOf(undefined).contentWidth)
    expect(testItems(exam, widths(() => Math.floor(lane / 4)))[0]!.grid!.columns).toBe(4)
    expect(testItems(exam, widths(() => Math.floor(lane / 4) + 1))[0]!.grid!.columns).toBe(2)
    // Deeper side margins leave a narrower lane, and fewer answers across it.
    const margins = { top: 0.75, right: 1.5, bottom: 0.75, left: 1.5 }
    const narrow = choiceAreaWidth(pageSizeOf(margins).contentWidth)
    expect(narrow).toBeLessThan(lane)
    const deep = examOf(exam.questions, 'condensed', { margins })
    expect(testItems(deep, widths(() => Math.floor(narrow / 4)))[0]!.grid!.columns).toBe(4)
    expect(testItems(deep, widths(() => Math.floor(lane / 4)))[0]!.grid!.columns).toBe(2)
  })

  test('widens a Multiple Choice Part’s answers too, within its narrower lane', () => {
    const exam = examOf([multipart('mp')], 'condensed')
    expect(testItems(exam, widths(() => 100))[0]!.parts![0]!.grid!.columns).toBe(4)
  })

  test('leaves answers as set when nothing can measure them, or one holds more than text', () => {
    const exam = examOf([multipleChoice('mc', ['a', 'b', 'c', 'd'])], 'condensed')
    expect(testItems(exam)[0]!.grid!.columns).toBe(1)
    const pictured: Question = structuredClone(exam.questions[0]!)
    const list = (pictured.doc.content as ProseMirrorJSON[])[1]!
    ;(list.content as ProseMirrorJSON[])[0]!.content = [
      { type: 'image-block', attrs: { src: 'x.png' } },
    ]
    expect(testItems(examOf([pictured], 'condensed'), widths(() => 10))[0]!.grid!.columns).toBe(1)
  })

  test('packs questions closer together, telling the measure which style it measures', () => {
    const seen: (PaperStyle | undefined)[] = []
    const measure: Measure = {
      itemHeight: (_item, layout) => {
        seen.push(layout?.paperStyle)
        return 0
      },
    }
    plan(examOf([open('sa')], 'condensed'), measure)
    expect(seen.every((style) => style === 'condensed')).toBe(true)
    plan(examOf([open('sa')]), measure)
    expect(seen.at(-1)).toBeUndefined()
    expect(PAPER_STYLE_RULES.condensed.questionGap).toBeLessThan(PAPER_STYLE_RULES.standard.questionGap)
  })
})

describe('Hidden Answers under a Paper Style', () => {
  // Five answers, the first correct, with the third hidden (ADR-0038).
  const question = multipleChoice('mc', ['a', 'b', 'c', 'd', 'e'], 'a')
  const hiding: Arrangement = { ...ARRANGEMENT, hiddenAnswers: { mc: ['c'] } }
  const items = (exam: Exam, arrangement: Arrangement, measure: Measure = unmeasured) =>
    planExport({ exam, arrangement, selection: { test: true, answerKey: false }, measure }).pages
      .flatMap((page) => page.items)
      .flatMap((item) => (item.kind === 'question' ? [item] : []))

  test('letters only the answers shown, in the style’s case, while the key keeps capitals', () => {
    const [mc] = items(examOf([question], 'classic'), hiding)
    expect(gridLetters(mc!)).toEqual(['a', 'b', 'c', 'd'])
    expect(mc!.grid!.cells.flat().map((cell) => cell?.id)).toEqual(['a', 'b', 'd', 'e'])
    expect(mc!.question.choices.map(({ letter }) => letter)).toEqual(['A', 'B', 'C', 'D'])
  })

  test('Condensed fits only the answers shown across the line', () => {
    // The hidden answer alone is too wide for even half the lane.
    const measure: Measure = {
      itemHeight: () => 0,
      choiceWidth: (choice) => (choice.id === 'c' ? 10_000 : 100),
    }
    expect(items(examOf([question], 'condensed'), ARRANGEMENT, measure)[0]!.grid!.columns).toBe(1)
    const [mc] = items(examOf([question], 'condensed'), hiding, measure)
    expect(mc!.grid!.columns).toBe(4)
    expect(gridLetters(mc!).filter((letter) => letter !== '-')).toEqual(['A', 'B', 'C', 'D'])
  })
})
