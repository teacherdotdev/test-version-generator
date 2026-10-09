import {
  QUESTION_BANK_FORMAT,
  QUESTION_BANK_FORMAT_VERSION,
  type QuestionBankRecord,
  type QuestionBankRecordQuestion,
  type SemanticDocument,
  type SemanticNode,
} from '../question-bank-export'
import { mediaDimensions } from '../question-bank-import'
import { mediaFilePath } from '../package-zip'
import { readPoints } from '../question-doc'
import { blocksText, isBlank, plainBlocks, textRun } from './rich-text'
import { excerpt } from './text'
import type { Blocks, ForeignChoice, ForeignImage, ForeignQuestion, ImportIssue, ParseResult } from './types'

/**
 * Every format's questions become one Question Bank Record here, so a kind
 * Test Parrot has no Question Type for is converted the same way whatever
 * file it came from, and the teacher is told the same thing:
 *
 * - Multiple Answer (“select all that apply”) with one correct choice is
 *   Multiple Choice; with several it comes in as Multiple Choice with none
 *   marked, because a Test Parrot question has one correct answer — the
 *   teacher is told which were;
 * - an essay is Short Answer, with its model answer as the Suggested Answer;
 * - fill in the blank, numeric and ordering are Short Answer, with the
 *   accepted answers, the value, or the order as the Suggested Answer.
 *
 * Whatever it becomes, a question keeps the points its source gives it as
 * its Points when they are a positive whole number; a fractional or zero
 * value is dropped, since Points are positive whole numbers (ADR-0042).
 */

export type ConvertOptions = {
  /** Redraw a picture in a form a Media Asset can hold (PNG), such as a GIF.
   *  Without one, only PNG, JPEG and WebP pictures come in. */
  convertImage?: (image: ForeignImage) => Promise<ForeignImage | null>
  bankName: string
}

export type ConvertedRecord = {
  record: QuestionBankRecord
  /** Each Media Asset's bytes, by the path its `file` names. */
  files: Map<string, Uint8Array>
  issues: ImportIssue[]
  imported: number
}

const document = (content: Blocks): SemanticDocument => ({
  type: 'document',
  content: content.length ? content : [{ type: 'paragraph' }],
})

const where = (question: ForeignQuestion, index: number) => {
  const number = question.number ?? index + 1
  return question.line ? `Question ${number} (line ${question.line})` : `Question ${number}`
}

const letter = (index: number) => String.fromCharCode(97 + (index % 26))

export async function toRecord(result: ParseResult, options: ConvertOptions): Promise<ConvertedRecord> {
  const issues: ImportIssue[] = [...result.issues]
  const questions: QuestionBankRecordQuestion[] = []
  result.questions.forEach((question, index) => {
    const id = `q${questions.length + 1}`
    const place = where(question, index)
    const report = (severity: ImportIssue['severity'], code: string, message: string) =>
      issues.push({
        severity,
        code,
        message: `${place}: ${message}`,
        ...(question.line ? { line: question.line } : {}),
        excerpt: excerpt(blocksText(question.stem)),
      })
    const converted = convertQuestion(question, id, report)
    if (converted) questions.push(converted)
  })

  const files = new Map<string, Uint8Array>()
  const media = await resolveMedia(questions, result.images ?? new Map(), options, issues, files)
  return {
    files,
    record: {
      format: QUESTION_BANK_FORMAT,
      formatVersion: QUESTION_BANK_FORMAT_VERSION,
      generator: { name: 'Test Parrot import', version: '1' },
      requiredFeatures: [],
      bank: {
        name: result.name?.trim() || options.bankName,
        ...(result.description?.trim() ? { description: result.description.trim() } : {}),
        questions,
      },
      media,
    },
    issues,
    imported: questions.length,
  }
}

type Report = (severity: ImportIssue['severity'], code: string, message: string) => void

function convertQuestion(question: ForeignQuestion, id: string, report: Report): QuestionBankRecordQuestion | null {
  const topics = question.topics?.filter((topic) => topic.trim()).map((topic) => topic.trim())
  const points = readPoints(question.points)
  const base = {
    id,
    stem: document(question.stem),
    ...(topics?.length ? { topics: [...new Set(topics)] } : {}),
    ...(points ? { points } : {}),
  }
  if (question.kind !== 'matching' && isBlank(question.stem)) {
    report('error', 'empty-stem', 'it has no question text, so it was left out.')
    return null
  }
  const choicesOf = (choices: ForeignChoice[], correct: (choice: ForeignChoice) => boolean) =>
    choices.map((choice, index) => ({
      id: `${id}-c${index + 1}`,
      content: document(choice.content),
      correct: correct(choice),
    }))
  const shortAnswer = (suggested?: Blocks): QuestionBankRecordQuestion => ({
    ...base,
    type: 'short-answer',
    ...(suggested && !isBlank(suggested) ? { suggestedAnswer: document(suggested) } : {}),
  })

  switch (question.kind) {
    case 'multiple-choice':
    case 'multiple-answer': {
      const choices = question.choices.filter((choice) => !isBlank(choice.content))
      if (choices.length < 2) {
        report('error', 'too-few-choices', `a multiple choice question needs at least two answers, and this one has ${choices.length}, so it was left out.`)
        return null
      }
      const correct = choices.filter((choice) => choice.correct)
      if (correct.length === 0) {
        report('warning', 'no-correct-answer', 'no answer is marked correct. Mark one after importing.')
        return { ...base, type: 'multiple-choice', choices: choicesOf(choices, () => false) }
      }
      if (correct.length === 1) {
        return { ...base, type: 'multiple-choice', choices: choicesOf(choices, (choice) => choice.correct) }
      }
      const letters = choices.flatMap((choice, index) => (choice.correct ? [letter(index)] : []))
      report(
        'warning',
        'multiple-answer',
        `it has ${correct.length} correct answers (${letters.join(', ')}). A Test Parrot question has one, so it came in with none marked: mark one, or reword it.`,
      )
      return { ...base, type: 'multiple-choice', choices: choicesOf(choices, () => false) }
    }
    case 'true-false': {
      if (question.answer === null) report('warning', 'no-correct-answer', 'it does not say whether it is true or false. Mark one after importing.')
      return {
        ...base,
        type: 'true-false',
        choices: [
          { id: `${id}-c1`, content: document(plainBlocks('True')), correct: question.answer === true },
          { id: `${id}-c2`, content: document(plainBlocks('False')), correct: question.answer === false },
        ],
      }
    }
    case 'matching': {
      const items = question.pairs.filter((pair) => pair.left && !isBlank(pair.left))
      const answers: { id: string; content: SemanticDocument; key: string }[] = []
      const answerFor = (right: Blocks) => {
        const key = JSON.stringify(right)
        let found = answers.find((answer) => answer.key === key)
        if (!found) {
          found = { id: `${id}-a${answers.length + 1}`, content: document(right), key }
          answers.push(found)
        }
        return found.id
      }
      const prompts = items.map((pair, index) => ({
        id: `${id}-p${index + 1}`,
        content: document(pair.left!),
        ...(pair.right && !isBlank(pair.right) ? { answer: answerFor(pair.right) } : {}),
      }))
      for (const pair of question.pairs) {
        if ((!pair.left || isBlank(pair.left)) && pair.right && !isBlank(pair.right)) answerFor(pair.right)
      }
      if (prompts.length === 0) {
        report('error', 'no-matching-items', 'a matching question needs at least one item to match, so it was left out.')
        return null
      }
      if (answers.length < 2) {
        report('error', 'too-few-matches', 'a matching question needs at least two answers to choose from, so it was left out.')
        return null
      }
      const unmatched = prompts.filter((prompt) => !prompt.answer).length
      if (unmatched) report('warning', 'unmatched-item', `${unmatched === 1 ? 'one item has' : `${unmatched} items have`} no match. Match ${unmatched === 1 ? 'it' : 'them'} after importing.`)
      return {
        ...base,
        type: 'matching',
        prompts,
        wordBank: answers.map(({ id: answerId, content }) => ({ id: answerId, content })),
      }
    }
    case 'short-answer':
      return shortAnswer(question.suggestedAnswer)
    case 'fill-in-blank': {
      const accepted = question.accepted.map((answer) => answer.trim()).filter(Boolean)
      if (!accepted.length) report('warning', 'no-accepted-answer', 'it gives no accepted answer.')
      return shortAnswer(accepted.length ? plainBlocks(accepted.join(' / ')) : undefined)
    }
    case 'fill-in-blanks': {
      const lines = question.blanks
        .filter((blank) => blank.accepted.some((answer) => answer.trim()))
        .map((blank) => `${blank.name}: ${blank.accepted.map((answer) => answer.trim()).filter(Boolean).join(' / ')}`)
      return shortAnswer(lines.length ? plainBlocks(lines.join('\n')) : undefined)
    }
    case 'numeric': {
      const answers = question.answers
        .filter((answer) => answer.value.trim())
        .map((answer) => (answer.tolerance && Number(answer.tolerance) !== 0 ? `${answer.value} (± ${answer.tolerance})` : answer.value))
      if (!answers.length) report('warning', 'no-accepted-answer', 'it gives no numeric answer.')
      return shortAnswer(answers.length ? plainBlocks(answers.join(' / ')) : undefined)
    }
    case 'ordering': {
      report('warning', 'ordering', 'Test Parrot has no ordering questions, so it came in as Short Answer with the correct order as its suggested answer.')
      const items = question.items.filter((item) => !isBlank(item))
      return shortAnswer(items.length
        ? [{ type: 'ordered-list', content: items.map((item) => ({ type: 'list-item', content: item })) }]
        : undefined)
    }
  }
}

/** Pictures by key → Media Assets, the key in every image node replaced by
 *  its content address. A picture that cannot be read is removed from the
 *  question and reported. */
async function resolveMedia(
  questions: QuestionBankRecordQuestion[],
  images: Map<string, ForeignImage>,
  options: ConvertOptions,
  issues: ImportIssue[],
  files: Map<string, Uint8Array>,
): Promise<QuestionBankRecord['media']> {
  const used = new Set<string>()
  const visit = (node: SemanticNode) => {
    if ((node.type === 'block-image' || node.type === 'inline-image') && node.asset) used.add(node.asset)
    node.content?.forEach(visit)
  }
  const documents = questions.flatMap((question) => [
    question.stem,
    ...(question.choices ?? []).map((choice) => choice.content),
    ...(question.prompts ?? []).map((prompt) => prompt.content),
    ...(question.wordBank ?? []).map((answer) => answer.content),
    ...(question.suggestedAnswer ? [question.suggestedAnswer] : []),
  ])
  documents.forEach((doc) => doc.content.forEach(visit))
  if (!used.size) return []

  const assets = new Map<string, QuestionBankRecord['media'][number] | null>()
  const byId = new Map<string, QuestionBankRecord['media'][number]>()
  for (const key of used) {
    let image = images.get(key) ?? null
    if (image && !['image/png', 'image/jpeg', 'image/webp'].includes(image.mimeType)) {
      image = options.convertImage ? await options.convertImage(image).catch(() => null) : null
    }
    const mimeType = image?.mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | undefined
    const size = image && mimeType ? mediaDimensions(mimeType, image.bytes) : null
    if (!image || !mimeType || !size) {
      assets.set(key, null)
      continue
    }
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', image.bytes.slice().buffer))
    const id = `sha256:${Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
    const asset = { id, mimeType, width: size.width, height: size.height, file: mediaFilePath(id, mimeType) }
    files.set(asset.file, image.bytes)
    assets.set(key, asset)
    byId.set(id, asset)
  }

  let dropped = 0
  const rewrite = (nodes: SemanticNode[]): SemanticNode[] =>
    nodes.flatMap((node) => {
      if ((node.type === 'block-image' || node.type === 'inline-image') && node.asset) {
        const asset = assets.get(node.asset)
        if (!asset) {
          dropped += 1
          return node.alt ? [textRun(`[Picture: ${node.alt}]`)] : []
        }
        return [{ ...node, asset: asset.id }]
      }
      return node.content ? [{ ...node, content: rewrite(node.content) }] : [node]
    })
  for (const doc of documents) {
    // A block image left out of a document leaves a text run where a block
    // belongs; wrap it back in a paragraph.
    doc.content = rewrite(doc.content).map((node) => (node.type === 'text' ? { type: 'paragraph', content: [node] } : node))
    if (!doc.content.length) doc.content = [{ type: 'paragraph' }]
  }
  if (dropped) {
    issues.push({
      severity: 'warning',
      code: 'picture-unreadable',
      message: `${dropped === 1 ? 'One picture' : `${dropped} pictures`} could not be read and ${dropped === 1 ? 'was' : 'were'} left out. Add ${dropped === 1 ? 'it' : 'them'} after importing.`,
    })
  }
  return [...byId.values()]
}
