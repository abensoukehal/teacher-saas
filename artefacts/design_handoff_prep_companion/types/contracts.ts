// Backend data contracts for the prep companion. Fixtures in ../data/ conform to these.
// Aligned with teacher-fe/src/lib/exam.ts where shapes already ship.

export type Stream = "شعبة الرياضيات" | "تقني رياضي" | "علوم تجريبية" | "تسيير واقتصاد" | "آداب وفلسفة" | "لغات أجنبية";

// ——— programme (J1) — ministry text VERBATIM, provenance always ———
export interface Programme {
  stream: Stream;
  level: "3AS";
  source: { authority: string; title: string; file?: string }; // provenance, shown on artifacts
  totals: { weeks: number; hours: number };                    // gate: hours === weeklyHours × 27
  units: ProgrammeUnit[];
  weeks: ProgrammeWeek[];                                      // THE SPINE — one row per week
}
export interface ProgrammeUnit { id: string; name: string; weeks: number; hours: number; } // weeks may be fractional (أسبوع ونصف)
export interface ProgrammeWeek {
  week: number; unitId: string;
  competencies: string[] | null;    // nullable: two documents carry none (absent ≠ empty)
  contents: ContentItem[];          // each content item can carry a course (J8)
  guidance: string[];               // السير المنهجي — verbatim; BINDING on courses & generation
  hours: number;
  emphasis: ("normal" | "red" | "unknown")[]; // red text is semantic; REQUIRED, never defaulted
}
export interface ContentItem { id: string; text: string; courseId?: string; }

// ——— teacher + classes (J2) — progress belongs to a CLASS ———
export interface Teacher { id: string; email: string; school?: string; classes: ClassRef[]; }
export interface ClassRef { id: string; name: string; stream: Stream; }
export interface Progress {
  classId: string; schoolYear: string;
  programmeVersion: string;         // ministry revision must never silently re-point a class
  markedWeek: number;               // 0 = not started. THE TRUTH for all scope derivation.
  entries: { week: number; status: "planned" | "done" | "skipped"; note?: string; completedAt?: string }[];
}

// ——— reference calendar (J6) — teacher-made, NEVER authoritative ———
export interface SchoolYearCalendar {
  schoolYear: string; source: "teacher-made";
  expectedWeekNow: number | null;   // null ⇒ hide the pacing marker entirely
  assessmentWindows: { label: string; aroundWeek: number }[];
  holidays: { label: string; weeks: number }[];
}

// ——— generation ———
export type Scope =
  | { kind: "course"; contentId: string }
  | { kind: "week"; week: number }
  | { kind: "unit"; unitId: string }
  | { kind: "recent"; fromWeek: number; toWeek: number }
  | { kind: "toDate" };             // weeks 1..markedWeek — untaught material EXCLUDED, always
export type Format = "series" | "devoir" | "exam" | "remediation";

// ——— subject (matches teacher-fe/src/lib/exam.ts) ———
export type ExerciseStatus = "pending" | "ready" | "failed";
export interface Exercise {
  id: string; label: string; points: number; difficulty?: string; topics?: string[];
  statement: string;                // LaTeX in $…$, rendered by KaTeX — never shown as source
  status?: ExerciseStatus;          // ABSENT MEANS READY (legacy exams) — whitelist, never passthrough
  rev?: number;                     // bumps on refine/restore; drives correction staleness
}
export interface ExamSubject {
  id: string; title: string;
  meta: { stream?: string; level?: string; format?: string; durationMinutes?: number; totalPoints: number; topic?: string; assumptions?: string[] };
  scope: Scope; classId: string;
  exercises: Exercise[];
}

// ——— correction ———
export interface CorrectionItem {
  exerciseId: string; baseRev: number; // stale ⇔ baseRev !== exercise.rev
  answer: string;                      // worked answer, LaTeX in $…$
  scale: { part: string; points: number }[]; // sums to exercise.points; EMPTY for point-less formats
  status?: ExerciseStatus;
}

// ——— versions (J7) ———
export interface VersionSet { subjectId: string; versions: { key: "a" | "b" | "c"; label: string; exercises: Pick<Exercise, "id" | "label" | "points" | "statement">[]; status?: ExerciseStatus }[]; }

// ——— library ———
export interface LibraryItem { id: string; title: string; kind: "exam" | "series" | "course" | "correction"; unit: string; classId: string; createdAt: string; }
