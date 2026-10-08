---
status: accepted
---

# Give what a student answers Marks, owned by the Question

Teachers assembling papers from past exams need each question's worth on the paper and in the mark scheme, a total that follows as they add and remove questions, and the ability to change a worth. Test Parrot had no notion of worth at all; every Question File importer dropped the points its source carried.

**Marks** are an optional whole number on whatever a student answers: a Multiple Choice, True/False or Short Answer Question, a whole Matching set, or a Part or Subpart that answers (ADR-0043). A Multipart question's Marks, and an Exam's total, are always the sum of their parts and are never stored, so they cannot disagree with them. Something with no Marks is unmarked rather than worth nothing: it adds nothing to a total, and an Exam shows a total only when some of its Questions have Marks. An Exam whose Questions are only partly marked says how many have none; it is not blocked from export.

- **Marks belong to the Question, not the Exam position.** A past paper's marks come with the question and the mark scheme is written against them, so the same Question is worth the same on every Exam. Per-position Marks, like Work Space, were considered and left out until someone needs one Question worth different amounts on two Exams; a position override can be added later without changing what a Question stores. Editing Marks inline on the exam sheet edits the Question, which saves immediately like any other bank edit.
- **A Matching set is marked as a whole.** Its Items share one Word Bank and are never Questions of their own (ADR-0021), and the papers it serves give such a task one total.
- **Where Marks print belongs to the Paper Style** (ADR-0044): Marks are always kept and always counted, and a style decides whether `[2]`, a question total or a paper total appears. The Answer Key prints each entry's or Part line's Marks and the paper total whenever there are Marks, under every style.

## Records

Question Bank Record `0.9.0` adds `marks` to a question and to a Part or Subpart that answers. Adding a member an earlier consumer would drop is a minor version; Test Parrot writes `0.9.0` and reads every earlier version as unmarked. The conversion instructions (`public/extract.md`) teach an assistant to turn a bracketed `[n]` into `marks` and never to leave it in a stem. The Question File importers keep the points their formats carry as Marks wherever a whole number of points belongs to a whole question: QTI item points, Moodle `defaultgrade`, Respondus `Points:` lines, Brightspace's points column. A fractional or zero point value is dropped, as before, since Marks are positive whole numbers.
