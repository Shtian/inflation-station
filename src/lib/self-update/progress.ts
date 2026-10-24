// Mirrors the `run_step <key>` calls in update.sh, in run order.
// progress.test.ts fails if the two drift apart.
export const DEPLOY_STEPS = [
  { key: "install", label: "Installerer avhengigheter", expectedMs: 30_000 },
  {
    key: "backup",
    label: "Tar sikkerhetskopi av databasen",
    expectedMs: 2_000,
  },
  { key: "migrate", label: "Kjører migreringer", expectedMs: 5_000 },
  { key: "build", label: "Bygger", expectedMs: 90_000 },
  { key: "assemble", label: "Setter sammen versjonen", expectedMs: 1_000 },
  { key: "restart", label: "Starter på nytt", expectedMs: 5_000 },
] as const;

export type DeployStepKey = (typeof DEPLOY_STEPS)[number]["key"];

export type StepMark = { step: string; at: number };

export type StepDurations = Partial<Record<DeployStepKey, number>>;

/** `index` is 1-based; 0 means no step has started yet (the pull). */
export type SelfUpdateProgress = {
  label: string;
  index: number;
  total: number;
  percent: number;
};

const END_MARK = "end";
// A step that runs long holds just short of its share instead of overshooting.
const MAX_STEP_SHARE = 0.95;

function stepPosition(key: string) {
  return DEPLOY_STEPS.findIndex((step) => step.key === key);
}

/** Parses the `<step> <epoch_ms>` lines update.sh appends per step. */
export function parseStepMarks(text: string): StepMark[] {
  return text.split("\n").flatMap((line) => {
    const [step, at, ...rest] = line.trim().split(/\s+/);
    const ms = Number(at);
    return step && at && rest.length === 0 && Number.isFinite(ms)
      ? [{ step, at: ms }]
      : [];
  });
}

/** Each step lasts until the next mark; a step without one has no duration. */
export function stepDurations(marks: StepMark[]): StepDurations {
  const durations: StepDurations = {};
  marks.forEach((mark, i) => {
    const next = marks[i + 1];
    const position = stepPosition(mark.step);
    if (next && position !== -1) {
      durations[DEPLOY_STEPS[position].key] = next.at - mark.at;
    }
  });
  return durations;
}

export function estimateProgress(
  marks: StepMark[],
  previousDurations: StepDurations,
  nowMs: number,
): SelfUpdateProgress {
  const total = DEPLOY_STEPS.length;
  const expected = DEPLOY_STEPS.map(
    (step) => previousDurations[step.key] ?? step.expectedMs,
  );
  const totalMs = expected.reduce((sum, ms) => sum + ms, 0);

  const current = marks.findLast((mark) => stepPosition(mark.step) !== -1);
  if (!current) {
    return { label: "Henter endringer", index: 0, total, percent: 0 };
  }

  const position = stepPosition(current.step);
  const step = { label: DEPLOY_STEPS[position].label, index: position + 1 };
  if (marks.some((mark) => mark.step === END_MARK)) {
    return { ...step, total, percent: 100 };
  }

  // Steps before the current one count as done, including skipped ones.
  const completedMs = expected
    .slice(0, position)
    .reduce((sum, ms) => sum + ms, 0);
  const currentMs = Math.min(
    Math.max(nowMs - current.at, 0),
    MAX_STEP_SHARE * expected[position],
  );
  // Whole-second clocks can record every previous step as 0 ms.
  const percent =
    totalMs > 0 ? Math.floor((100 * (completedMs + currentMs)) / totalMs) : 0;
  return { ...step, total, percent };
}
