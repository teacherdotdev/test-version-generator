// The height a Work Space handle's drag shows on the sheet before the Exam's
// own plan draws it.
//
// A drag previews locally and commits once, on release (see `WorkSpaceHandle`
// in `exam-page.tsx`). The commit changes the Exam at once, but the sheet
// repaginates later — after a font or picture check, or a pause in editing —
// so for a while the plan still draws the space at its old height. Dropping
// the preview on release showed exactly that for a frame: the space snapped
// back to where the drag began, then out to where it ended. So a released drag
// keeps its height over the plan it was drawn on, and gives way as soon as the
// sheet draws a plan of its own: the repaginated one, with the stored height.

import type { PlannedWorkSpace } from './export-plan'

export type WorkSpacePreview = {
  /** The height on the page the drag is showing. */
  height: number
  /** `null` while the pointer is down. Once released and committed, the
   *  planned space it was released over: it shows only while that plan does. */
  over: PlannedWorkSpace | null
}

export function draggingPreview(height: number): WorkSpacePreview {
  return { height, over: null }
}

/** The preview once the pointer is up: kept over the plan it was released on
 *  when the release stored a height, and otherwise gone. */
export function releasedPreview(
  preview: WorkSpacePreview | null,
  committed: boolean,
  planned: PlannedWorkSpace,
): WorkSpacePreview | null {
  return preview && committed ? { height: preview.height, over: planned } : null
}

/** The height to draw over `planned`, or `null` to draw the plan's own. */
export function shownPreviewHeight(
  preview: WorkSpacePreview | null,
  planned: PlannedWorkSpace,
): number | null {
  if (!preview) return null
  return preview.over === null || preview.over === planned ? preview.height : null
}
