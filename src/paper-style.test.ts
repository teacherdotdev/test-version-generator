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
  test('are four, read by one guard, with Standard the default', () => {
    expect(PAPER_STYLES).toEqual(['standard', 'classic', 'condensed', 'exam-board'])
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

describe('Exam Board', () => {
  /** A Multipart question with Points: Part (a) answers, worth 2; Part (b) holds
   *  Subparts (i), worth 3, and (ii), unpointed. */
  function multipartWithPoints(id: string): Question {
    const subpart = (subpartId: string, points?: number) => ({
      type: 'multipartSubpart',
      attrs: { id: subpartId, columns: 1, ...(points !== undefined ? { points } : {}) },
      content: [
        { type: 'multipartPartStem', content: [paragraph(`subpart ${subpartId}`)] },
        { type: 'suggestedAnswer', content: [paragraph('')] },
      ],
    })
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
                attrs: { id: `${id}-a`, columns: 1, points: 2 },
                content: [
                  { type: 'multipartPartStem', content: [paragraph('part a')] },
                  { type: 'suggestedAnswer', content: [paragraph('')] },
                ],
              },
              {
                type: 'multipartPart',
                attrs: { id: `${id}-b`, columns: 1 },
                content: [
                  { type: 'multipartPartStem', content: [paragraph('part b')] },
                  { type: 'multipartSubparts', content: [subpart(`${id}-b-i`, 3), subpart(`${id}-b-ii`)] },
                ],
              },
            ],
          },
        ],
      },
    }
  }
  const worth = (question: Question, points: number): Question => ({ ...question, points })
  const WITH_POINTS = [
    worth(multipleChoice('mc', ['a', 'b', 'c', 'd'], 'b'), 1),
    trueFalse('tf'),
    worth(matching('mx', ['w2', 'w1'], ['w1', 'w2', 'w3']), 2),
    worth(open('sa'), 4),
    multipartWithPoints('mp'),
  ]
  const testPages = (exam: Exam, measure?: Measure) =>
    plan(exam, measure).pages.filter((page) => page.stream === 'test')

  test('prints on A4, the test and its Answer Key alike', () => {
    const planned = plan(examOf(EVERY_TYPE, 'exam-board'))
    expect(planned.pageSize).toMatchObject({ width: 794, height: 1123, paper: 'a4' })
    expect(planned.pageSize.contentWidth).toBe(794 - 2 * 72)
    // Every other style keeps US Letter, and says nothing of paper.
    for (const style of ['standard', 'classic', 'condensed'] as const) {
      expect(plan(examOf(EVERY_TYPE, style)).pageSize).toEqual(pageSizeOf(undefined))
    }
  })

  test('labels questions 1, Parts (a), Subparts (i) and answers A, while the key keeps its own', () => {
    const [mc, tf, mx, , mp] = testItems(examOf(WITH_POINTS, 'exam-board'))
    expect(mc!.question.printedNumber).toBe('1')
    expect(tf!.question.printedNumber).toBe('2')
    expect(mc!.grid!.cells.flat().map((cell) => cell?.printed)).toEqual(['A', 'B', 'C', 'D'])
    // A matching set's numbers print on its Items, its bank lettered as answers are.
    expect(mx!.question.printedNumber).toBeUndefined()
    expect(mx!.matching!.prompts.map((prompt) => prompt.printed)).toEqual(['3', '4'])
    expect(mx!.matching!.bank.map((answer) => answer.printed)).toEqual(['A', 'B', 'C'])
    expect(mp!.parts!.map((part) => part.printed)).toEqual(['(a)', '(b)'])
    expect(mp!.parts![1]!.subparts.map((subpart) => subpart.printed)).toEqual(['(i)', '(ii)'])
    expect(keyItems(examOf(WITH_POINTS, 'exam-board'))).toEqual(keyItems(examOf(WITH_POINTS)))
    // Every other style prints `1.`, `a.`, `i.` and `A.` as it always did.
    for (const style of ['standard', 'classic', 'condensed'] as const) {
      const [standardMc, , , , standardMp] = testItems(examOf(WITH_POINTS, style))
      expect(standardMc!.question.printedNumber).toBeUndefined()
      expect(standardMc!.grid!.cells.flat().every((cell) => cell?.printed === undefined)).toBe(true)
      expect(standardMp!.parts!.every((part) => part.printed === undefined)).toBe(true)
    }
  })

  test('rules three dotted lines where the teacher left a Short Answer alone, and dots theirs', () => {
    const exam = examOf([open('sa'), open('mine')], 'exam-board', {
      workSpace: { mine: { height: 64, style: 'lines', fill: false } },
    })
    const [sa, mine] = testItems(exam)
    expect(sa!.workSpace).toMatchObject({ style: 'lines', lines: 3, ruling: 'dotted' })
    expect(mine!.workSpace).toMatchObject({ style: 'lines', lines: 2, ruling: 'dotted' })
    expect(testItems(examOf([open('sa')], 'classic'))[0]!.workSpace).not.toHaveProperty('ruling')
  })

  test('prints each answer’s [n] after it, and a Multipart question’s total after the question', () => {
    const [mc, tf, mx, sa, mp] = testItems(examOf(WITH_POINTS, 'exam-board'))
    expect(mc!.closingPoints).toEqual(['[1]'])
    // Unpointed prints nothing.
    expect(tf!.closingPoints).toBeUndefined()
    // A Matching set takes its Points as a whole.
    expect(mx!.closingPoints).toEqual(['[2]'])
    expect(sa!.closingPoints).toEqual(['[4]'])
    expect(mp!.closingPoints).toEqual(['[Total: 5]'])
    expect(mp!.parts![0]!.pointsAfter).toBe('[2]')
    // A Part that holds Subparts has no Points of its own; its Subparts do.
    expect(mp!.parts![1]!.pointsAfter).toBeUndefined()
    expect(mp!.parts![1]!.subparts.map((subpart) => subpart.pointsAfter)).toEqual(['[3]', undefined])
    // No other style prints Points on the test.
    for (const style of ['standard', 'classic', 'condensed'] as const) {
      const items = testItems(examOf(WITH_POINTS, style))
      expect(items.every((item) => item.closingPoints === undefined)).toBe(true)
      expect(items[4]!.parts!.every((part) => part.pointsAfter === undefined)).toBe(true)
    }
  })

  test('prints a question’s closing Points only on the piece that ends it', () => {
    const long: Question = {
      id: 'long',
      type: 'open',
      columns: DEFAULT_COLUMNS,
      points: 5,
      doc: { type: 'doc', content: [paragraph('one'), paragraph('two'), paragraph('three')] },
    }
    // Each stem block is a page of its own.
    const measure: Measure = {
      itemHeight: (item) => (item.kind === 'question' ? item.stem.length * 800 : 0),
    }
    const pieces = testItems(examOf([long], 'exam-board'), measure)
    expect(pieces.length).toBeGreaterThan(1)
    expect(pieces.slice(0, -1).every((piece) => piece.closingPoints === undefined)).toBe(true)
    expect(pieces.at(-1)!.closingPoints).toEqual(['[5]'])
  })

  test('measures the Points it prints, so they move a question that no longer fits', () => {
    // Two questions that fill an A4 page exactly, until each prints its [n].
    const box = 1123 - 2 * 72 - 42 - 36
    const measure = (withPoints: boolean): Measure => ({
      itemHeight: (item) =>
        item.kind === 'question' ? box / 2 + (withPoints ? (item.closingPoints?.length ?? 0) * 20 : 0) : 0,
    })
    const exam = examOf([worth(open('one'), 1), worth(open('two'), 1)], 'exam-board', {
      workSpace: { one: { height: 0, style: 'blank', fill: false }, two: { height: 0, style: 'blank', fill: false } },
    })
    const where = (withPoints: boolean) =>
      testPages(exam, measure(withPoints)).map((page) =>
        page.items.flatMap((item) => (item.kind === 'question' ? [item.question.id] : [])))
    expect(where(false)).toEqual([[], ['one', 'two']])
    expect(where(true)).toEqual([[], ['one'], ['two']])
  })

  test('opens the test with a Cover Page of its own, from the Paper Details, and never the key', () => {
    const exam = examOf(WITH_POINTS, 'exam-board', {
      title: 'Forces',
      paperDetails: { subject: 'Physics', duration: '50 minutes', paperCode: 'PHY-3' },
    })
    const [cover, ...rest] = testPages(exam)
    expect(cover!.header).toBe('cover')
    expect(cover!.items).toEqual([
      expect.objectContaining({
        kind: 'cover',
        title: 'Forces',
        subject: 'Physics',
        duration: '50 minutes',
        candidateFields: ['Name', 'Class', 'Candidate number'],
        total: 'The total mark for this paper is 12.',
      }),
    ])
    // The candidate fields are on the cover, so later pages carry no Name line.
    expect(rest.every((page) => page.header === 'later' && page.furniture.identityLine === '')).toBe(true)
    expect(rest.every((page) => page.furniture.title === null)).toBe(true)
    expect(plan(exam).pages.filter((page) => page.stream === 'answer-key')
      .every((page) => page.items.every((item) => item.kind !== 'cover'))).toBe(true)
  })

  test('prints nothing for a Paper Detail the teacher left blank, and none where they asked for none', () => {
    const cover = (exam: Exam) => plan(exam).pages[0]!.items[0]
    const blank = cover(examOf(EVERY_TYPE, 'exam-board'))
    expect(blank).not.toHaveProperty('subject')
    expect(blank).not.toHaveProperty('duration')
    // Nothing has Points, so no total.
    expect(blank).not.toHaveProperty('total')
    expect(blank).toMatchObject({ candidateFields: ['Name', 'Class', 'Candidate number'] })
    const none = cover(examOf(EVERY_TYPE, 'exam-board', { paperDetails: { instructions: [], candidateFields: [] } }))
    expect(none).toMatchObject({ candidateFields: [], instructions: null })
    const own = cover(examOf(EVERY_TYPE, 'exam-board', {
      paperDetails: { instructions: ['Use black ink.'], candidateFields: ['centre-number', 'name'] },
    }))
    expect(own).toMatchObject({
      candidateFields: ['Name', 'Centre number'],
      instructions: { type: 'bullet_list', content: [expect.objectContaining({ type: 'list_item' })] },
    })
  })

  test('numbers pages at the top, prints the paper code at the foot, and “Turn over” wherever the test goes on', () => {
    const exam = examOf(WITH_POINTS, 'exam-board', { paperDetails: { paperCode: 'PHY-3' } })
    const measure: Measure = { itemHeight: (item) => (item.kind === 'question' ? 700 : 0) }
    const pages = testPages(exam, measure)
    expect(pages.length).toBe(6)
    expect(pages.map((page) => page.furniture.pageNumberAt)).toEqual(['none', 'top', 'top', 'top', 'top', 'top'])
    expect(pages.every((page) => page.furniture.footLeft === 'PHY-3')).toBe(true)
    expect(pages.map((page) => page.furniture.footRight)).toEqual([
      'Turn over', 'Turn over', 'Turn over', 'Turn over', 'Turn over', undefined,
    ])
    // The key keeps the sheet's own furniture.
    const key = plan(exam, measure).pages.filter((page) => page.stream === 'answer-key')
    expect(key.every((page) => page.furniture.pageNumberAt === undefined && page.furniture.footRight === undefined))
      .toBe(true)
    // No other style prints running furniture.
    expect(plan(examOf(WITH_POINTS, 'classic'), measure).pages.every((page) =>
      page.furniture.pageNumberAt === undefined && page.furniture.footLeft === undefined)).toBe(true)
  })

  test('a Section total is a placement any style may take, printed after the Section’s last question', () => {
    const rules = PAPER_STYLE_RULES['exam-board']
    const before = rules.points
    rules.points = { ...before, sectionTotal: 'Section total: {n}' }
    try {
      const exam = examOf([worth(open('one'), 2), worth(open('two'), 3), open('three')], 'exam-board', {
        sections: [
          { id: 's1', title: 'First', instructions: '' },
          { id: 's2', title: 'Second', instructions: '' },
        ],
        sectionOf: { one: 's1', two: 's1', three: 's2' },
      })
      const [one, two, three] = testItems(exam)
      expect(one!.closingPoints).toEqual(['[2]'])
      expect(two!.closingPoints).toEqual(['[3]', 'Section total: 5'])
      // A Section with nothing worth Points prints no total.
      expect(three!.closingPoints).toBeUndefined()
    } finally {
      rules.points = before
    }
  })
})
