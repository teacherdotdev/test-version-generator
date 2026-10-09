import { describe, expect, test } from 'bun:test'
import type { PlannedWorkSpace } from './export-plan'
import { draggingPreview, releasedPreview, shownPreviewHeight } from './work-space-preview'

// Dragging a Work Space's handle on the sheet shows the height it is dragged
// to before the Exam stores it. A release stores it, and the sheet shows the
// stored height once it has repaginated, a moment later. Until then the drag's
// height must stay: dropping it on release drew the space at its old height
// for a frame, then at its new one, which flickered.

const planned = (height: number): PlannedWorkSpace => ({
  height,
  style: 'lines',
  lines: Math.round(height / 32),
  fill: false,
  pitch: 32,
  firstRow: 24,
})

describe('a Work Space drag on the sheet', () => {
  test('shows the height it is dragged to, whatever the plan draws', () => {
    const before = planned(88)
    const preview = draggingPreview(120)
    expect(shownPreviewHeight(preview, before)).toBe(120)
    expect(shownPreviewHeight(preview, planned(88))).toBe(120)
  })

  test('released and stored, it keeps its height until the sheet is repaginated', () => {
    const before = planned(88)
    const released = releasedPreview(draggingPreview(120), true, before)

    // The Exam has stored 120, but the sheet still draws the plan it had.
    expect(shownPreviewHeight(released, before)).toBe(120)

    // The repaginated sheet draws the stored height itself.
    expect(shownPreviewHeight(released, planned(120))).toBeNull()
  })

  test('released with nothing to store, it shows what the plan draws at once', () => {
    const before = planned(88)
    expect(releasedPreview(draggingPreview(88), false, before)).toBeNull()
    expect(releasedPreview(null, true, before)).toBeNull()
  })

  test('shows nothing when there is no drag', () => {
    expect(shownPreviewHeight(null, planned(88))).toBeNull()
  })
})
