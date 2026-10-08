# Export testing

## Purpose

The print-reference view is the authoritative presentation of an exam. PDF and
DOCX export must preserve the same semantics and put the same ordered content
on the same pages without reconstructing an exam independently.

This document describes the implemented architecture and its acceptance path.

## Architecture

Publication has one pure preparation boundary and one shared planning pipeline:

```text
Exam Working Copy + Content Selection
                  |
                  v
       Export Record preparation
      selected resolved Layout Plans
                  |
                  v
        Export Document -> Layout Plan
                       /       \
                      v         v
        print-reference view   PDF / DOCX Export Adapters
```

`prepareExport({ examId, exam, arrangement, configuration, history, measure,
createdAt, random })` is the application-level pure seam. It resolves the selected
student-test and/or answer-key Layout Plans from the visible Working Copy and
returns a new immutable Export Record plus the selected artifact. When the
configuration shuffles, it resolves them for each shuffled Version instead —
every Version's test, then every Version's key — drawing from `random`, so a
seeded source reproduces the same Versions and names. Every
successful export is a separate event; fingerprints remain diagnostics only
and never deduplicate records or name output.

Each Export Record is attached to its Exam UUID and retains the captured Exam
name, exact format and Content Selection, question count, required media hashes,
and complete resolved Layout Plans. Historical view and fixed-format re-export
consume only that stored record, or a chosen subset of its Versions. They never consult current Questions, restore an Exam, or invoke the
current layout engine.

The print adapter remains an internal preview/reference path (`ExportPreview`
in `src/exam-page.tsx`). PDF and DOCX are explicit product artifacts. All three
consume the same selected plans in student-test-then-answer-key order.

The browser packages the complete selected PDF or DOCX before atomically
committing the Export Record and verifying required Media Assets. Download
starts only after commit. Browser cancellation after that point cannot roll
history back.

## Acceptance contract

The Export Document is the semantic oracle. The Reference PDF captured from
the clean print-reference preview is the layout oracle. A pinned LibreOffice
installation is the Comparison Engine used to make DOCX pagination observable.

Acceptance requires:

1. **Semantic parity:** exact ordered content, question and choice order,
   formatting intent, links, math, media, tables, whitespace, and answer data.
2. **Structural parity:** exact section hierarchy, grid topology, headers,
   footers, numbering, and explicit keep/break decisions.
3. **Page parity:** exact page count and dimensions, with the same ordered
   content assigned to each page.

Renderer-selected line wrapping, coordinates, fonts, generated identifiers,
package metadata, and raster appearance are not compared. Authored line breaks
remain semantic; explicit page breaks remain structural.

Parity covers the selected plans in order and restarts page numbering per
stream. A shuffled Version's page carries its Version name as page furniture;
an unshuffled page carries no label.

## Shared fingerprint

Plan, print-reference markup, and DOCX reduce to the same readable content-line
vocabulary:

```text
heading:<1-6|title> <inline>
para <inline>
code <inline>
list:<bullet|ordered>:<n> <inline>
rule
table:<rows>x<columns>
cell:<row>,<column>
/table
box
/box
side:<panels>
panel:<index>
/side
space:blank
space:lines:<n>
```

A Blockquote prints boxed, so its border is content: `box` … `/box` wraps its
lines. A Side-by-Side is `side:<n>`, then each Panel as `panel:<i>` followed by
its own lines, then `/side`. Neither can carry a question's opening number, which
takes a `para` line of its own before it, as a table's does. In DOCX both are
tables — a one-cell bordered one and a borderless one-row one that cannot split
— marked with the `Blockquote` and `SideBySide` table styles so they read back
as a box and Panels rather than as tables.

A Short Answer question's Work Space is a `space:` line: blank, or ruled with
the plan's own count of lines. Its height is geometry and is not compared, nor
are the rows it is ruled in — its `pitch`, closer under Condensed, and its
shorter `firstRow` — which every adapter draws from the plan. The
Layout Plan resolves a space that fills its page to its final height, so print,
DOCX and PDF draw the same room; DOCX marks its work-space paragraphs with the
`WorkSpace` and `WorkSpaceLines` paragraph styles so they read back as one.

An Answer Key line's Marks are text after its answer, ` [n]`, before any
Question Metadata, and the paper's total shares the key heading's line, so it
reads `heading:1 Answer Section Total: 9 marks`. Print, PDF and DOCX each set
the total against the right margin; where it stands is geometry and is not
compared. No current Question Style prints Marks on the test, so a test line
never carries them.

Inline content uses plain text, marked spans, links, math source, stable image
ordinals, and authored-break markers. Fingerprints are adapter diagnostics only:
they compare semantic and structural output and never identify, name, reuse, or
deduplicate Export Records.

The implementations are:

- `src/pdf-export.ts` — the dedicated local PDF Export Adapter.
- `src/export-fingerprint.ts` — Export Document and Layout Plan fingerprints.
- `src/print-fingerprint.ts` — the print-reference adapter's real markup.
- `src/docx-fingerprint.ts` — a generated DOCX package.
- `src/export-preparation.ts` — immutable event preparation and historical replay.

## Test layers

### Standard tests

`bun test` is dependency-free and covers:

- `src/export-preparation.test.ts` — selected-plan retention, stream order,
  distinct repeated events, exact historical replay, validation, filenames,
  shuffled Versions (distinctness, what moves, names), and partial reprints.
- `src/export-plan.test.ts` — semantic derivation, numbering, grids, geometry,
  packing, splitting, furniture, streams, and breaks.
- `src/question-style.test.ts` — each Question Style's rules through the
  plan: what prints before a number, answer and Word Bank letters and layout,
  the Work Space a style supplies and what overrides it, the question gap
  handed to `Measure`, and an Answer Key that never changes with the style.
- `src/word-bank-layout.test.ts` — where a matching set's Word Bank prints:
  the layout a position takes when it arrives or the style changes (beside
  its Items wherever its widest answer fits, at every text size, margin and
  under Condensed, above them otherwise, above under Classic), and that the
  plan then prints the stored layout without measuring where it goes.
- `src/import-preview.test.ts` — the plan the import review previews, Work
  Space and the lines a Question Style rules included.
- `src/export-parity.test.ts` — each fixture through the plan, print-reference,
  and DOCX fingerprints, including deliberate degradation checks.
- `src/docx-export.test.ts` — DOCX packaging, page sections, friendly names,
  answer keys, links, media bytes, lists, strict unresolved-media rejection,
  and two drawing invariants over every fixture: no paragraph's hanging indent
  starts it left of its container, and every table's grid columns are its
  cells' widths.
- `src/pdf-export.test.ts` — PDF pages, metadata, links, media, embedded fonts,
  unsupported-character rejection, overflow rejection, every matching
  prompt and Word Bank answer on its planned page, equations drawn as outlines
  with school notation as their searchable text, a Blockquote's black border,
  and a Side-by-Side's pictures beside
  one another, centred in their Panels.
- `src/export-typography.test.ts` — one type scale and one body spacing —
  line height, paragraph gap, list-item gap (`src/export-typography.ts`) — and
  the Multiple Choice answer indent, held against print's stylesheet, the DOCX
  document defaults, heading styles and body paragraphs, the DOCX identity
  line's tab stops, and the PDF's drawn sizes and line pitch.
  Parity ignores size by design, so this is where a DOCX that falls back to
  Word's own 10pt defaults fails.
- `src/pdf-math.test.ts` — the PDF's typeset equations: stacked fractions,
  bars over repeating decimals, stretched glyphs cut to their box, and the
  SVG path data they are drawn from.
- `src/doc-view.test.ts` — authored whitespace in the read-only view.

The Playwright suite covers the browser workflow and real IndexedDB behavior:
default Content Selection, clean preview, repeated event recording,
focus and Cmd/Ctrl+P, first-publication persistent storage, atomic publication,
quota and transaction failures, required-media failure, no phantom download,
and an unchanged Working Copy.

### Out-of-band comparison

`bun run test:exports` is the single heavyweight entry point. It:

1. Verifies LibreOffice, Poppler, and Playwright Chromium prerequisites.
2. Records tool versions, platform, locale, and paper size.
3. Seeds the real application, including content-addressed Media Assets.
4. Drives the real export dialog with both Content Selection streams.
5. Captures the clean print-reference preview as the Reference PDF.
6. Downloads the dedicated PDF and compares its normalized pages directly.
7. Downloads the real DOCX through the publication workflow.
8. Re-exports the media-rich composite from stored history and verifies its
   normalized DOCX structure is unchanged.
9. Compares structural fingerprints and normalized per-page PDF manifests.

PDF normalization keeps page boundaries, dimensions, and word order while
discarding coordinates and renderer-selected line grouping. Ruled blanks and
typeset math are excluded from word comparison and asserted structurally in the
fast suite.

### Invocation policy

The heavyweight comparison is not part of `bun test`, `bun run test:e2e`, or
CI. Run it when a change affects the Export Document, Layout Plan, either Export
Adapter, pagination, print styling, media rendering, or supported document-node
rendering.

### Prerequisites

| Tool                | Command                | Role                          |
| ------------------- | ---------------------- | ----------------------------- |
| LibreOffice         | `soffice`              | DOCX to PDF Comparison Engine |
| Poppler             | `pdftotext`, `pdfinfo` | normalized PDF manifests      |
| Playwright Chromium | —                      | Reference PDF capture         |

`LANG`, `LC_ALL`, and `TZ` are pinned to `C`/`UTC`; the PDF uses US Letter with
zero outer margin because the Layout Plan owns the page padding. An Exam's own
Page Margins (ADR-0039) are part of the plan's `pageSize`, and the parity
fingerprints compare every side.

## Fixtures and failure artifacts

`src/export-fixtures.ts` holds one synthetic fixture per supported block, mark,
link, break, list, table, image, math, Question Type, and column setting, plus
pagination boundaries and a realistic media-rich composite. Generated binary
files are never test truth.

A failed heavyweight comparison keeps diagnostic material under
`export-artifacts/<fixture>/`: source fixture, normalized plans and adapter
fingerprints, DOCX, Reference and converted PDFs, manifests, reports, and an
environment record. Successful comparisons remove disposable converter state.

## Known limits

- Office Math stores the authored LaTeX source in a native equation object; it
  does not translate LaTeX into fully structured OMML.
- The PDF adapter draws each equation from MathJax's typesetting of it
  (`src/pdf-math.ts`) — glyph outlines, fraction bars, radicals and rules —
  where print typesets with KaTeX. Both set TeX's own fonts and metrics at
  KaTeX's 1.21em, so they agree closely but are not the same engine. A line
  holding a tall equation grows to fit it. Over each drawn equation the PDF
  writes it again invisibly, on the line — a fraction as `(2x + 1)⁄(x − 3)` —
  so it can be searched and copied; an equation MathJax cannot typeset is
  drawn written that way instead.
- The PDF word comparison cannot adjudicate ruled blanks or typeset math; both
  remain covered structurally.
- Export History is browser-local. Persistent-storage permission strengthens
  local durability but is not an archival guarantee.

## Adding a supported document node

Add support in all five mappings — `doc-view.tsx`, `docx-export.ts`,
`pdf-export.ts`, `export-fingerprint.ts`, and `print-fingerprint.ts` — and add
the smallest fixture to `src/export-fixtures.ts`. The PDF has no fingerprint of
its own, so a node the PDF adapter skips passes parity; give it a text
assertion in `src/pdf-export.test.ts`, as matching sets have. The parity suite asserts complete coverage
of `SUPPORTED_NODES`, `SUPPORTED_MARKS`, Question Types, column settings, and
page-header variants.
