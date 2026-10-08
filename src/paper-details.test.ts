// Paper Details (ADR-0045): what the teacher wrote, read and stored through
// one guard and one normal form, so storage, import and the dialog agree.

import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_CANDIDATE_FIELDS,
  DEFAULT_INSTRUCTIONS,
  candidateFieldsOf,
  instructionsOf,
  isPaperDetails,
  normalizedPaperDetails,
  samePaperDetails,
} from './paper-details'

describe('Paper Details', () => {
  test('are read only in the shape this build can print', () => {
    expect(isPaperDetails({})).toBe(true)
    expect(isPaperDetails({ subject: 'Physics', instructions: ['Answer all.'], candidateFields: ['name'] })).toBe(true)
    expect(isPaperDetails({ subject: 3 })).toBe(false)
    expect(isPaperDetails({ candidateFields: ['seat'] })).toBe(false)
    expect(isPaperDetails({ instructions: 'Answer all.' })).toBe(false)
    expect(isPaperDetails({ total: 40 })).toBe(false)
    expect(isPaperDetails(['subject'])).toBe(false)
    expect(isPaperDetails(null)).toBe(false)
  })

  test('store only what the teacher wrote, trimmed, and nothing when all are blank', () => {
    expect(normalizedPaperDetails({ subject: '  Physics ', duration: ' ', paperCode: '' })).toEqual({ subject: 'Physics' })
    expect(normalizedPaperDetails({ subject: ' ', duration: '' })).toBeUndefined()
    expect(normalizedPaperDetails(undefined)).toBeUndefined()
    // Blank instruction lines go; candidate fields keep their printed order, once each.
    expect(normalizedPaperDetails({
      instructions: [' Answer all. ', '', 'Use ink.'],
      candidateFields: ['date', 'name', 'date'],
    })).toEqual({ instructions: ['Answer all.', 'Use ink.'], candidateFields: ['name', 'date'] })
  })

  test('tell an empty list, which asks for none, from an absent one, which takes the style’s own', () => {
    expect(normalizedPaperDetails({ instructions: [], candidateFields: [] })).toEqual({ instructions: [], candidateFields: [] })
    expect(instructionsOf(undefined)).toEqual(DEFAULT_INSTRUCTIONS)
    expect(instructionsOf({ instructions: [] })).toEqual([])
    expect(candidateFieldsOf({})).toEqual(DEFAULT_CANDIDATE_FIELDS)
    expect(candidateFieldsOf({ candidateFields: ['centre-number'] })).toEqual(['centre-number'])
  })

  test('compare as they print, absent and blank alike', () => {
    expect(samePaperDetails(undefined, { subject: ' ' })).toBe(true)
    expect(samePaperDetails({ subject: 'Physics' }, { subject: 'Physics ' })).toBe(true)
    expect(samePaperDetails({ subject: 'Physics' }, { subject: 'Chemistry' })).toBe(false)
    expect(samePaperDetails(undefined, { instructions: [] })).toBe(false)
  })
})
