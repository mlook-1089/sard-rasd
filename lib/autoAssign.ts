/**
 * Smart student → committee assignment.
 * Greedy scoring that respects hard caps and prefers:
 *   - low current load (students + hizbs)
 *   - diversity: fewer students from the same circle already present
 *   - level balance: fewer students of the same level already present
 *   - progress toward min floors
 *
 * Pure function — no DB access. Caller passes current state; caller applies the result.
 */

export type StudentInput = {
  id: number;
  name: string;
  circleId: number | null;
  circleName: string | null;
  level: string | null;
  hizbCount: number;                 // number of assigned hizbs (from studentHizbs)
  currentCommitteeId: number | null; // null if not yet assigned
};

export type CommitteeInput = {
  id: number;
  name: string;
  maxStudents: number | null;
  minStudents: number | null;
  maxHizbs: number | null;
  minHizbs: number | null;
  maxPerCircle: number | null;  // hard cap on students from any single circle
};

export type Options = {
  /** If true, strip existing committee assignments from all candidates before re-distributing. */
  includeActive: boolean;
  /** Tunable weights (defaults are sensible). */
  weights?: {
    diversity?: number;     // bonus when the student's circle is under-represented
    level?: number;         // bonus when the student's level is under-represented
    load?: number;          // penalty proportional to current student load
    hizbs?: number;         // penalty proportional to current hizbs load
    minFloor?: number;      // bonus when committee is below min (students or hizbs)
  };
};

export type AssignmentRow = {
  studentId: number;
  studentName: string;
  fromCommitteeId: number | null;
  toCommitteeId: number | null;      // null = unassignable (all caps exceeded)
  toCommitteeName: string | null;
  reason: string;                     // Arabic human-readable explanation
};

export type Plan = {
  rows: AssignmentRow[];
  summary: {
    assigned: number;
    moved: number;        // changed committee
    kept: number;         // same committee (only relevant in includeActive mode)
    unassignable: number;
  };
  committeesAfter: Array<{
    id: number;
    name: string;
    studentsBefore: number;
    studentsAfter: number;
    hizbsBefore: number;
    hizbsAfter: number;
    maxStudents: number | null;
    maxHizbs: number | null;
  }>;
};

const DEFAULTS = {
  diversity: 3,
  level: 2,
  load: 1,
  hizbs: 0.3,
  minFloor: 2
};

export function computeAssignments(
  allStudents: StudentInput[],
  committees: CommitteeInput[],
  options: Options
): Plan {
  const w = { ...DEFAULTS, ...(options.weights ?? {}) };

  // Build live state per committee. If includeActive, start empty; otherwise start with current active members.
  type State = {
    id: number;
    name: string;
    maxStudents: number | null;
    minStudents: number | null;
    maxHizbs: number | null;
    minHizbs: number | null;
    maxPerCircle: number | null;
    students: number;
    hizbs: number;
    circleCounts: Map<number, number>;   // circleId -> count
    levelCounts: Map<string, number>;    // level -> count
    // snapshot "before" for the summary
    studentsBefore: number;
    hizbsBefore: number;
  };

  const state = new Map<number, State>();
  for (const c of committees) {
    state.set(c.id, {
      id: c.id, name: c.name,
      maxStudents: c.maxStudents, minStudents: c.minStudents,
      maxHizbs: c.maxHizbs, minHizbs: c.minHizbs,
      maxPerCircle: c.maxPerCircle,
      students: 0, hizbs: 0,
      circleCounts: new Map(), levelCounts: new Map(),
      studentsBefore: 0, hizbsBefore: 0
    });
  }

  // Candidates = who are we going to (re)assign?
  const candidates: StudentInput[] = [];
  for (const s of allStudents) {
    if (options.includeActive) {
      // all students currently assigned OR waiting are candidates.
      // everything gets re-distributed.
      candidates.push(s);
    } else {
      // only students not currently in a committee
      if (s.currentCommitteeId == null) candidates.push(s);
      else {
        // pre-populate their current committee's state so caps consider them
        const st = state.get(s.currentCommitteeId);
        if (st) {
          st.students += 1;
          st.hizbs += s.hizbCount;
          if (s.circleId != null) st.circleCounts.set(s.circleId, (st.circleCounts.get(s.circleId) || 0) + 1);
          if (s.level) st.levelCounts.set(s.level, (st.levelCounts.get(s.level) || 0) + 1);
        }
      }
    }
  }
  // snapshot before
  for (const st of state.values()) {
    st.studentsBefore = st.students;
    st.hizbsBefore = st.hizbs;
  }

  // Order candidates: heavier (more hizbs) first → helps fit them before the caps fill up.
  // Within equal hizb counts, students of under-represented levels come first (gentle shuffle by id as tiebreak).
  const ordered = [...candidates].sort((a, b) => {
    if (b.hizbCount !== a.hizbCount) return b.hizbCount - a.hizbCount;
    return a.id - b.id;
  });

  const rows: AssignmentRow[] = [];

  function scoreCommittee(st: State, s: StudentInput): { score: number; reason: string } | null {
    // Hard caps
    if (st.maxStudents != null && st.students + 1 > st.maxStudents) return null;
    if (st.maxHizbs != null && st.hizbs + s.hizbCount > st.maxHizbs) return null;
    // Diversity hard cap: no circle may exceed maxPerCircle in this committee
    if (st.maxPerCircle != null && s.circleId != null) {
      const curSameCircle = st.circleCounts.get(s.circleId) || 0;
      if (curSameCircle + 1 > st.maxPerCircle) return null;
    }

    // Load penalties (lower is better → lower penalty)
    const studentLoad = w.load * st.students;
    const hizbLoad = w.hizbs * st.hizbs;

    // Diversity bonus (fewer same-circle members = higher bonus)
    const sameCircle = s.circleId != null ? (st.circleCounts.get(s.circleId) || 0) : 0;
    const diversityBonus = w.diversity * (1 / (1 + sameCircle));

    // Level balance (fewer same-level = higher bonus)
    const sameLevel = s.level ? (st.levelCounts.get(s.level) || 0) : 0;
    const levelBonus = w.level * (1 / (1 + sameLevel));

    // Min floor bonus (committees below their min should fill first)
    let floorBonus = 0;
    const reasons: string[] = [];
    if (st.minStudents != null && st.students < st.minStudents) {
      floorBonus += w.minFloor * (st.minStudents - st.students);
      reasons.push('أقل من الحد الأدنى للطلاب');
    }
    if (st.minHizbs != null && st.hizbs < st.minHizbs) {
      floorBonus += w.minFloor * Math.min(3, (st.minHizbs - st.hizbs) / 5);
      reasons.push('أقل من الحد الأدنى للأحزاب');
    }

    const score = diversityBonus + levelBonus + floorBonus - studentLoad - hizbLoad;

    if (sameCircle === 0) reasons.push('حلقة غير ممثلة');
    else if (sameCircle === 1) reasons.push('حلقة قليلة التمثيل');
    if (sameLevel === 0 && s.level) reasons.push('مستوى غير ممثل');
    if (st.students === 0) reasons.push('لجنة فارغة');
    else if (st.maxStudents != null && st.students < st.maxStudents / 2) reasons.push('حمل منخفض');

    return { score, reason: reasons.length ? reasons.slice(0, 2).join(' + ') : 'موازنة عامة' };
  }

  for (const s of ordered) {
    let best: { stId: number; score: number; reason: string } | null = null;
    for (const st of state.values()) {
      const sc = scoreCommittee(st, s);
      if (sc == null) continue;
      if (!best || sc.score > best.score) {
        best = { stId: st.id, score: sc.score, reason: sc.reason };
      }
    }

    if (best == null) {
      rows.push({
        studentId: s.id,
        studentName: s.name,
        fromCommitteeId: s.currentCommitteeId,
        toCommitteeId: null,
        toCommitteeName: null,
        reason: 'كل اللجان تجاوزت حدودها القصوى'
      });
      continue;
    }

    const toSt = state.get(best.stId)!;
    rows.push({
      studentId: s.id,
      studentName: s.name,
      fromCommitteeId: s.currentCommitteeId,
      toCommitteeId: toSt.id,
      toCommitteeName: toSt.name,
      reason: best.reason
    });

    // Update state
    toSt.students += 1;
    toSt.hizbs += s.hizbCount;
    if (s.circleId != null) toSt.circleCounts.set(s.circleId, (toSt.circleCounts.get(s.circleId) || 0) + 1);
    if (s.level) toSt.levelCounts.set(s.level, (toSt.levelCounts.get(s.level) || 0) + 1);
  }

  const summary = {
    assigned: rows.filter((r) => r.toCommitteeId != null).length,
    moved: rows.filter((r) => r.toCommitteeId != null && r.fromCommitteeId !== r.toCommitteeId).length,
    kept: rows.filter((r) => r.toCommitteeId != null && r.fromCommitteeId === r.toCommitteeId).length,
    unassignable: rows.filter((r) => r.toCommitteeId == null).length
  };

  const committeesAfter = Array.from(state.values()).map((st) => ({
    id: st.id,
    name: st.name,
    studentsBefore: st.studentsBefore,
    studentsAfter: st.students,
    hizbsBefore: st.hizbsBefore,
    hizbsAfter: st.hizbs,
    maxStudents: st.maxStudents,
    maxHizbs: st.maxHizbs
  }));

  return { rows, summary, committeesAfter };
}
