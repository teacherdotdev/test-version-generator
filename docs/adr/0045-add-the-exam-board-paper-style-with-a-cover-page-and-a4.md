---
status: accepted
---

# Add the Exam Board Paper Style, with a Cover Page and A4

Teachers preparing students for international exam boards' papers want their own tests to look like them: a cover page with the paper's details and total, `1 (a) (i)` labels, dotted lines to write on, each answer's marks in brackets at the right margin, each question's total beneath it, and A4 paper.

**Exam Board** is a fourth Paper Style (ADR-0044). Its rules:

| | Exam Board |
| --- | --- |
| Paper | A4, with the Exam's margins |
| Labels | `1`, `(a)`, `(i)`; Multiple Choice answers `A`–`D` |
| Ruled Work Space | dotted, the lines running to the right margin |
| Marks | `[n]` at the right margin after each marked answer; `[Total: n]` after each marked Multipart question |
| Cover Page | the title, the Paper Details, candidate boxes, the instructions, and "The total mark for this paper is n." |
| Running furniture | the page number centred at the top; the paper code at the foot, with "Turn over" on every page the test continues past |

Mark placements are independent rules any style may take — after each answer, a question's total, a Section's total, the paper's total on the cover — each with its wording as a small template, so a style for another paper can take only the ones it uses. Standard, Classic and Condensed take none, and print exactly as before.

**Paper Details** are facts about one Exam that its Paper Style may print: a subject line, a duration, a paper code, an instructions list and which candidate fields to ask for. They are the teacher's, stored on the Exam beside its Page Header, and edited from the Format menu. The paper's total is never a Paper Detail: it is counted from the Marks. A style that prints a Cover Page fills it from the Paper Details and prints nothing for one the teacher left blank; Exam Board supplies its own default instructions, written for Test Parrot.

**Paper size is a Paper Style rule.** The Layout Plan carried US Letter as its one page size; it now carries the size its style names, US Letter for every style but Exam Board. A4 paginates, prints and exports through the same Layout Plan, so export parity covers it as it covers Letter.

The Cover Page is planned as its own first page of the test and is never part of the Answer Key. Exam Record `0.4.0` carries the Paper Details.
