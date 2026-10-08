import { describe, expect, test } from 'bun:test'
import Ajv2020 from 'ajv/dist/2020'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import publicExamSchema from '../public/formats/exam/0.1.0/schema.json'
import applicationExamSchema from './exam-record-0.1.0.schema.json'
import publicExamSchema020 from '../public/formats/exam/0.2.0/schema.json'
import applicationExamSchema020 from './exam-record-0.2.0.schema.json'
import publicExamSchema030 from '../public/formats/exam/0.3.0/schema.json'
import applicationExamSchema030 from './exam-record-0.3.0.schema.json'
import publicExamSchema040 from '../public/formats/exam/0.4.0/schema.json'
import applicationExamSchema040 from './exam-record-0.4.0.schema.json'
import publicPackageSchema from '../public/formats/package/0.1.0/schema.json'
import applicationPackageSchema from './test-parrot-package-0.1.0.schema.json'
import publicQuestionBankSchema from '../public/formats/question-bank/0.3.0/schema.json'
import { QuestionBankImportError } from './question-bank-import'
import {
  EXAM_FORMAT_VERSION,
  PACKAGE_FORMAT_VERSION,
  inspectImportRecord,
} from './package-import'

const formats = join(import.meta.dir, '..', 'public', 'formats')
// Packages still carry, and Test Parrot still reads, Exam Record 0.1.0; its
// contract stays pinned while Test Parrot writes the current version.
const examRoot = join(formats, 'exam', '0.1.0')
const examRoot020 = join(formats, 'exam', '0.2.0')
const examRoot030 = join(formats, 'exam', '0.3.0')
const currentExamRoot = join(formats, 'exam', EXAM_FORMAT_VERSION)
const packageRoot = join(formats, 'package', PACKAGE_FORMAT_VERSION)

async function filesIn(directory: string): Promise<string[]> {
  return (await readdir(directory)).filter((name) => name.endsWith('.json')).sort()
}

const read = async (directory: string, name: string) =>
  JSON.parse(await Bun.file(join(directory, name)).text()) as Record<string, unknown>

const strict = () => new Ajv2020({ allErrors: true, strict: true })

describe('public Exam Record 0.1.0 contract', () => {
  test('the published schema is the one the application reads', async () => {
    expect(publicExamSchema.$id).toBe('https://testparrot.com/formats/exam/0.1.0/schema.json')
    expect(applicationExamSchema).toEqual(publicExamSchema)
    expect(
      await Bun.file(join(import.meta.dir, '..', 'public', 'exam-record-0.1.0.schema.json')).json(),
    ).toEqual(publicExamSchema)
  })

  test('canonical examples validate independently against the published schema', async () => {
    const validate = strict().compile(publicExamSchema)
    const names = await filesIn(join(examRoot, 'examples'))
    expect(names).toEqual(['minimal.json', 'unit-test.json'])
    for (const name of names) {
      expect(validate(await read(join(examRoot, 'examples'), name)), `${name}: ${JSON.stringify(validate.errors)}`).toBe(true)
    }
  })
})

describe('public Exam Record 0.2.0 contract', () => {
  test('the published schema is the one the application reads', async () => {
    expect(publicExamSchema020.$id).toBe('https://testparrot.com/formats/exam/0.2.0/schema.json')
    expect(applicationExamSchema020).toEqual(publicExamSchema020)
    expect(
      await Bun.file(join(import.meta.dir, '..', 'public', 'exam-record-0.2.0.schema.json')).json(),
    ).toEqual(publicExamSchema020)
  })

  test('canonical examples validate independently against the published schema', async () => {
    const validate = strict().compile(publicExamSchema020)
    const names = await filesIn(join(examRoot020, 'examples'))
    expect(names).toEqual(['minimal.json', 'section-headings.json'])
    for (const name of names) {
      expect(validate(await read(join(examRoot020, 'examples'), name)), `${name}: ${JSON.stringify(validate.errors)}`).toBe(true)
    }
  })

  test('section wording names only Question Sections, with string parts', () => {
    const validate = strict().compile(publicExamSchema020)
    const exam = (sectionHeadings: unknown) => ({
      format: 'test-parrot/exam', formatVersion: '0.2.0', name: 'Quiz', positions: [], sectionHeadings,
    })
    expect(validate(exam({ 'short-answer': { title: '' } }))).toBe(true)
    expect(validate(exam({ open: { title: 'Essays' } }))).toBe(false)
    expect(validate(exam({ matching: { title: 3 } }))).toBe(false)
    expect(validate(exam({ matching: { colour: 'red' } }))).toBe(false)
    expect(validate({ ...exam(undefined), sectionHeadings: undefined, headingSize: 'huge' })).toBe(false)
  })
})

describe('public Exam Record 0.3.0 contract', () => {
  test('the published schema is the one the application reads', async () => {
    expect(publicExamSchema030.$id).toBe('https://testparrot.com/formats/exam/0.3.0/schema.json')
    expect(applicationExamSchema030).toEqual(publicExamSchema030)
    expect(
      await Bun.file(join(import.meta.dir, '..', 'public', 'exam-record-0.3.0.schema.json')).json(),
    ).toEqual(publicExamSchema030)
  })

  test('canonical examples validate independently against the published schema', async () => {
    const validate = strict().compile(publicExamSchema030)
    const names = await filesIn(join(examRoot030, 'examples'))
    expect(names).toEqual(['minimal.json', 'sections.json'])
    for (const name of names) {
      expect(validate(await read(join(examRoot030, 'examples'), name)), `${name}: ${JSON.stringify(validate.errors)}`).toBe(true)
    }
  })

  test('a Section has no type and carries its heading and directions in full', () => {
    const validate = strict().compile(publicExamSchema030)
    const exam = (sections: unknown, positions: unknown[] = []) => ({
      format: 'test-parrot/exam', formatVersion: '0.3.0', name: 'Quiz', sections, positions,
    })
    expect(validate(exam([]))).toBe(true)
    expect(validate(exam([{ title: '', instructions: '' }, { title: 'Essays', instructions: 'Write.' }]))).toBe(true)
    expect(validate(exam([{ title: 'No directions' }]))).toBe(false)
    expect(validate(exam([{ instructions: 'No heading' }]))).toBe(false)
    expect(validate(exam([{ type: 'matching', title: 'Typed', instructions: '' }]))).toBe(false)
    expect(validate(exam([{ title: 3, instructions: '' }]))).toBe(false)
    expect(validate(exam([{ title: 'x'.repeat(501), instructions: '' }]))).toBe(false)
    expect(validate(exam([{ title: '', instructions: 'x'.repeat(2001) }]))).toBe(false)
    expect(validate(exam(undefined))).toBe(false)
  })

  test('every position names its Section by index', () => {
    const validate = strict().compile(publicExamSchema030)
    const exam = (position: Record<string, unknown>) => ({
      format: 'test-parrot/exam',
      formatVersion: '0.3.0',
      name: 'Quiz',
      sections: [{ title: 'Multiple Choice', instructions: '' }],
      positions: [{ question: { bank: 'b', question: 'q1' }, ...position }],
    })
    expect(validate(exam({ section: 0 }))).toBe(true)
    expect(validate(exam({}))).toBe(false)
    expect(validate(exam({ section: -1 }))).toBe(false)
    expect(validate(exam({ section: 0.5 }))).toBe(false)
    expect(validate(exam({ section: '0' }))).toBe(false)
  })

  test('the example with Sections imports as its Sections', async () => {
    const example = await read(join(examRoot030, 'examples'), 'sections.json')
    const testParrotPackage = await read(join(packageRoot, 'examples'), 'bank-and-exam.json')
    // Beside the bank-and-exam example's bank, under that bank's package id.
    const exam = JSON.parse(JSON.stringify(example).replaceAll('"bank":"bank"', '"bank":"cells"'))
    const proposal = await inspectImportRecord(
      new TextEncoder().encode(JSON.stringify({ ...testParrotPackage, exams: [exam] })),
    )
    expect(proposal.exams[0]!.sections).toEqual([
      { title: 'Warm-up', instructions: 'Circle the best answer.' },
      { title: 'Short Answer', instructions: '' },
      { title: 'Challenge', instructions: 'Answer each question. Read carefully.' },
      { title: 'Extra Credit', instructions: 'Optional.' },
    ])
    // Warm-up and Challenge each hold Questions of two types.
    expect(proposal.exams[0]!.positions.map(({ question, section }) => `${section}:${question.question}`))
      .toEqual(['0:q1', '0:q3', '1:q5', '2:q2', '2:q4'])
  })
})

// 0.4.0 adds a position's `hiddenAnswers` (ADR-0038), a Matching position's
// `wordBankLayout` and `wordBankLayoutSet` (ADR-0041, ADR-0044), and the
// Exam's `margins` (ADR-0039) and `paperStyle` (ADR-0041, ADR-0044), to
// 0.3.0, and nothing else of its own.
describe('public Exam Record 0.4.0 contract', () => {
  test('is the version Test Parrot writes', () => {
    expect(EXAM_FORMAT_VERSION).toBe('0.4.0')
  })

  test('the published schema is the one the application reads', async () => {
    expect(publicExamSchema040.$id).toBe('https://testparrot.com/formats/exam/0.4.0/schema.json')
    expect(applicationExamSchema040).toEqual(publicExamSchema040)
    expect(
      await Bun.file(join(import.meta.dir, '..', 'public', 'exam-record-0.4.0.schema.json')).json(),
    ).toEqual(publicExamSchema040)
  })

  test('adds only optional margins, paperStyle, paperDetails and a position’s hiddenAnswers, wordBankLayout and wordBankLayoutSet to 0.3.0', () => {
    const { margins, paperStyle, paperDetails, ...rest } = publicExamSchema040.properties
    expect(margins).toBeDefined()
    expect(paperStyle).toBeDefined()
    expect(paperDetails).toBeDefined()
    expect({ ...rest, formatVersion: undefined }).toEqual({ ...publicExamSchema030.properties, formatVersion: undefined })
    expect(publicExamSchema040.required).toEqual(publicExamSchema030.required)
    const { hiddenAnswers, wordBankLayout, wordBankLayoutSet, ...position } = publicExamSchema040.$defs.position.properties
    expect(hiddenAnswers).toBeDefined()
    expect(wordBankLayout).toBeDefined()
    expect(wordBankLayoutSet).toEqual(expect.objectContaining({ type: 'boolean' }))
    expect(position).toEqual(publicExamSchema030.$defs.position.properties)
    expect(publicExamSchema040.$defs.position.required).toEqual(publicExamSchema030.$defs.position.required)
  })

  test('canonical examples validate independently against the published schema', async () => {
    const validate = strict().compile(publicExamSchema040)
    const names = await filesIn(join(currentExamRoot, 'examples'))
    expect(names).toEqual(['hidden-answers.json', 'margins.json', 'minimal.json', 'paper-details.json', 'paper-style.json', 'sections.json'])
    for (const name of names) {
      expect(validate(await read(join(currentExamRoot, 'examples'), name)), `${name}: ${JSON.stringify(validate.errors)}`).toBe(true)
    }
  })

  test('margins state every side, in inches, between half an inch and an inch and a half', () => {
    const validate = strict().compile(publicExamSchema040)
    const exam = (margins: unknown) => ({
      format: 'test-parrot/exam', formatVersion: '0.4.0', name: 'Quiz', sections: [], positions: [], margins,
    })
    expect(validate(exam({ top: 1, right: 1, bottom: 1, left: 1 }))).toBe(true)
    expect(validate(exam({ top: 0.5, right: 1.5, bottom: 0.75, left: 1.05 }))).toBe(true)
    expect(validate(exam({ top: 1, right: 1, bottom: 1 }))).toBe(false)
    expect(validate(exam({ top: 0.25, right: 1, bottom: 1, left: 1 }))).toBe(false)
    expect(validate(exam({ top: 2, right: 1, bottom: 1, left: 1 }))).toBe(false)
    expect(validate(exam({ top: '1', right: 1, bottom: 1, left: 1 }))).toBe(false)
    expect(validate(exam({ top: 1, right: 1, bottom: 1, left: 1, gutter: 1 }))).toBe(false)
  })

  test('the example with margins imports with them, and a record without keeps today’s', async () => {
    const testParrotPackage = await read(join(packageRoot, 'examples'), 'bank-and-exam.json')
    const proposalOf = async (name: string) => {
      const example = await read(join(currentExamRoot, 'examples'), name)
      const exam = JSON.parse(JSON.stringify(example).replaceAll('"bank":"bank"', '"bank":"cells"'))
      return inspectImportRecord(
        new TextEncoder().encode(JSON.stringify({ ...testParrotPackage, exams: [exam] })),
      )
    }
    const withMargins = await proposalOf('margins.json')
    expect(withMargins.exams[0]!.formatVersion).toBe('0.4.0')
    expect(withMargins.exams[0]!.margins).toEqual({ top: 1, right: 0.6, bottom: 1, left: 1.25 })
    expect(withMargins.exams[0]!.sections).toHaveLength(4)
    const without = await proposalOf('minimal.json')
    expect(without.exams[0]!).not.toHaveProperty('margins')
    expect(without.exams[0]!).not.toHaveProperty('paperStyle')
    expect(without.exams[0]!.positions.every((position) => position.hiddenAnswers === undefined)).toBe(true)
  })

  test('a Paper Style is one of four, for the whole Exam', () => {
    const validate = strict().compile(publicExamSchema040)
    const exam = (paperStyle: unknown) => ({
      format: 'test-parrot/exam', formatVersion: '0.4.0', name: 'Quiz', sections: [], positions: [], paperStyle,
    })
    for (const style of ['standard', 'classic', 'condensed', 'exam-board']) {
      expect(validate(exam(style)), style).toBe(true)
    }
    expect(validate(exam('Classic'))).toBe(false)
    expect(validate(exam('worksheet'))).toBe(false)
    expect(validate(exam(2))).toBe(false)
    expect(validate({
      format: 'test-parrot/exam', formatVersion: '0.4.0', name: 'Quiz', sections: [], positions: [],
    })).toBe(true)
  })

  test('the example with a Paper Style imports with it, and with its Work Space of none', async () => {
    const example = await read(join(currentExamRoot, 'examples'), 'paper-style.json')
    const testParrotPackage = await read(join(packageRoot, 'examples'), 'bank-and-exam.json')
    const exam = JSON.parse(JSON.stringify(example).replaceAll('"bank":"bank"', '"bank":"cells"'))
    const proposal = await inspectImportRecord(
      new TextEncoder().encode(JSON.stringify({ ...testParrotPackage, exams: [exam] })),
    )
    expect(proposal.exams[0]!.paperStyle).toBe('classic')
    expect(proposal.exams[0]!.formatVersion).toBe('0.4.0')
    expect(proposal.exams[0]!.positions.at(-1)!.workSpace).toEqual({ height: 0, style: 'blank', fill: false })
  })

  test('Paper Details are text, a list of instructions and known candidate fields, each once', () => {
    const validate = strict().compile(publicExamSchema040)
    const exam = (paperDetails: unknown) => ({
      format: 'test-parrot/exam', formatVersion: '0.4.0', name: 'Quiz', sections: [], positions: [], paperDetails,
    })
    expect(validate(exam({}))).toBe(true)
    expect(validate(exam({ subject: 'Physics', duration: '1 hour', paperCode: 'P1' }))).toBe(true)
    expect(validate(exam({ instructions: [], candidateFields: [] }))).toBe(true)
    expect(validate(exam({ candidateFields: ['name', 'candidate-number', 'centre-number'] }))).toBe(true)
    expect(validate(exam({ candidateFields: ['name', 'name'] }))).toBe(false)
    expect(validate(exam({ candidateFields: ['seat'] }))).toBe(false)
    expect(validate(exam({ instructions: 'Answer all.' }))).toBe(false)
    // The paper's total is counted from the Points, never written.
    expect(validate(exam({ total: 40 }))).toBe(false)
  })

  test('the example with Paper Details imports with them, and a record without has none', async () => {
    const testParrotPackage = await read(join(packageRoot, 'examples'), 'bank-and-exam.json')
    const proposalOf = async (name: string) => {
      const example = await read(join(currentExamRoot, 'examples'), name)
      const exam = JSON.parse(JSON.stringify(example).replaceAll('"bank":"bank"', '"bank":"cells"'))
      return inspectImportRecord(
        new TextEncoder().encode(JSON.stringify({ ...testParrotPackage, exams: [exam] })),
      )
    }
    const withDetails = await proposalOf('paper-details.json')
    expect(withDetails.exams[0]!.paperStyle).toBe('exam-board')
    expect(withDetails.exams[0]!.paperDetails).toEqual({
      subject: 'Biology: Paper 2',
      duration: '45 minutes',
      paperCode: 'BIO-2-NOV',
      instructions: ['Answer every question.', 'Use a pencil only for diagrams.'],
      candidateFields: ['name', 'class', 'date'],
    })
    expect((await proposalOf('minimal.json')).exams[0]!).not.toHaveProperty('paperDetails')
  })

  test('a position hides some of its answers, each once', () => {
    const validate = strict().compile(publicExamSchema040)
    const exam = (hiddenAnswers: unknown) => ({
      format: 'test-parrot/exam',
      formatVersion: '0.4.0',
      name: 'Quiz',
      sections: [{ title: 'Multiple Choice', instructions: '' }],
      positions: [{ question: { bank: 'b', question: 'q1' }, section: 0, hiddenAnswers }],
    })
    expect(validate(exam(['q1-c2']))).toBe(true)
    expect(validate(exam([]))).toBe(false)
    expect(validate(exam(['q1-c2', 'q1-c2']))).toBe(false)
    expect(validate(exam([''])) ).toBe(false)
  })

  test('a Matching position may set its Word Bank beside or above its Items, and no other position may', async () => {
    const validate = strict().compile(publicExamSchema040)
    const exam = (question: string, wordBankLayout: unknown) => ({
      format: 'test-parrot/exam',
      formatVersion: '0.4.0',
      name: 'Quiz',
      sections: [{ title: 'Matching', instructions: '' }],
      positions: [{ question: { bank: 'cells', question }, section: 0, wordBankLayout }],
    })
    expect(validate(exam('q4', 'beside'))).toBe(true)
    expect(validate(exam('q4', 'above'))).toBe(true)
    // There is no Auto: a position's layout is always one of the two.
    expect(validate(exam('q4', 'auto'))).toBe(false)
    expect(validate(exam('q4', 'left'))).toBe(false)

    const testParrotPackage = await read(join(packageRoot, 'examples'), 'bank-and-exam.json')
    const inspect = (record: unknown) => inspectImportRecord(
      new TextEncoder().encode(JSON.stringify({ ...testParrotPackage, exams: [record] })),
    )
    const proposal = await inspect(exam('q4', 'beside'))
    expect(proposal.exams[0]!.positions[0]!.wordBankLayout).toBe('beside')
    await expect(inspect(exam('q1', 'above'))).rejects.toThrow('only a Matching Question has')
  })

  test('the example that hides an answer imports hiding it', async () => {
    const example = await read(join(currentExamRoot, 'examples'), 'hidden-answers.json')
    const testParrotPackage = await read(join(packageRoot, 'examples'), 'bank-and-exam.json')
    const exam = JSON.parse(JSON.stringify(example).replaceAll('"bank":"bank"', '"bank":"cells"'))
    const proposal = await inspectImportRecord(
      new TextEncoder().encode(JSON.stringify({ ...testParrotPackage, exams: [exam] })),
    )
    expect(proposal.exams[0]!.positions[0]).toMatchObject({
      answerOrder: ['q1-c3', 'q1-c1', 'q1-c4', 'q1-c2'],
      hiddenAnswers: ['q1-c3'],
    })
  })
})

describe('public Test Parrot Package 0.1.0 contract', () => {
  test('the published schema is the one the application reads', async () => {
    expect(publicPackageSchema.$id).toBe('https://testparrot.com/formats/package/0.1.0/schema.json')
    expect(applicationPackageSchema).toEqual(publicPackageSchema)
    expect(
      await Bun.file(join(import.meta.dir, '..', 'public', 'test-parrot-package-0.1.0.schema.json')).json(),
    ).toEqual(publicPackageSchema)
  })

  test('canonical examples validate against every published schema they embed', async () => {
    const validatePackage = strict().compile(publicPackageSchema)
    const validateExam: Record<string, ReturnType<ReturnType<typeof strict>['compile']>> = {
      '0.1.0': strict().compile(publicExamSchema),
      '0.3.0': strict().compile(publicExamSchema030),
    }
    const validateBank = new Ajv2020({ allErrors: true, strict: false }).compile(publicQuestionBankSchema)
    const names = await filesIn(join(packageRoot, 'examples'))
    expect(names).toEqual([
      'bank-and-exam.json', 'bank-only.json', 'printed-test.json', 'several-banks.json', 'two-versions.json',
    ])
    for (const name of names) {
      const testParrotPackage = await read(join(packageRoot, 'examples'), name)
      expect(validatePackage(testParrotPackage), `${name}: ${JSON.stringify(validatePackage.errors)}`).toBe(true)
      for (const { record } of testParrotPackage.questionBanks as { record: unknown }[]) {
        expect(validateBank(record), `${name}: ${JSON.stringify(validateBank.errors)}`).toBe(true)
      }
      for (const exam of testParrotPackage.exams as { formatVersion: string }[]) {
        const validate = validateExam[exam.formatVersion]!
        expect(validate(exam), `${name}: ${JSON.stringify(validate.errors)}`).toBe(true)
      }
    }
  })

  test('the Exam Record example is the Exam its package example carries', async () => {
    const testParrotPackage = await read(join(packageRoot, 'examples'), 'bank-and-exam.json')
    expect((testParrotPackage.exams as unknown[])[0]).toEqual(await read(join(examRoot, 'examples'), 'unit-test.json'))
  })

  test('canonical examples pass Test Parrot inspection with their documented dependencies', async () => {
    const inspect = async (name: string) =>
      inspectImportRecord(await Bun.file(join(packageRoot, 'examples', name)).bytes())

    const bankAndExam = await inspect('bank-and-exam.json')
    expect(bankAndExam.banks.map(({ id, exams }) => ({ id, exams }))).toEqual([{ id: 'cells', exams: ['exam-1'] }])
    expect(bankAndExam.exams[0]!.positions.map(({ question }) => question.question)).toEqual(['q2', 'q1', 'q3', 'q4', 'q5'])

    // A printed test keeps its own Sections and its printed order, whatever its
    // Question Types, as the instructions ask an assistant to record them.
    const printed = (await inspect('printed-test.json')).exams[0]!
    expect(printed.sections).toEqual([
      { title: 'Part A: Warm-up', instructions: 'Circle the best answer.' },
      { title: 'Part B: Matching (8 points)', instructions: '' },
      { title: 'Part C', instructions: 'Answer each question. Show your thinking.' },
    ])
    expect(printed.positions.map(({ question, section }) => `${section}:${question.question}`))
      .toEqual(['0:q3', '0:q1', '1:q4', '2:q5', '2:q2'])

    expect((await inspect('bank-only.json')).exams).toEqual([])
    expect((await inspect('two-versions.json')).banks[0]!.exams).toEqual(['exam-1', 'exam-2'])

    const several = await inspect('several-banks.json')
    expect(several.exams[0]!.banks).toEqual(['forces', 'cells'])
    // Sections follow Test Parrot's order, whatever order the source used.
    expect(several.exams[0]!.positions.map(({ question }) => `${question.bank}/${question.question}`)).toEqual([
      'cells/q1', 'forces/q1', 'forces/q2', 'cells/q5',
    ])
  })

  test('invalid counterexamples are rejected with their documented application errors', async () => {
    const invalidRoot = join(packageRoot, 'invalid')
    const manifest = await read(invalidRoot, 'manifest.json') as Record<string, string>
    expect(Object.keys(manifest).sort()).toEqual(
      (await filesIn(invalidRoot)).filter((name) => name !== 'manifest.json'),
    )
    for (const [name, code] of Object.entries(manifest)) {
      try {
        await inspectImportRecord(await Bun.file(join(invalidRoot, name)).bytes())
        throw new Error(`${name} unexpectedly conformed`)
      } catch (error) {
        expect(error, name).toBeInstanceOf(QuestionBankImportError)
        expect((error as QuestionBankImportError).code, name).toBe(code)
      }
    }
  })
})
