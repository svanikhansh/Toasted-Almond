import { DEFAULT_SPLITS } from '../domain/palette'
import { addDays, atMinute, dayKey } from '../domain/dates'
import type { Item, Split, WorkBlock } from '../domain/types'
import type { Repo } from './repo'

const uid = () => crypto.randomUUID()

/** Build seed splits, items, and blocks relative to the given day. */
export function buildSeed(now: number = Date.now()) {
  const today = dayKey(now)
  const at = (offsetDays: number, hour: number, minute = 0) =>
    atMinute(addDays(today, offsetDays), hour * 60 + minute)

  const splits: Split[] = DEFAULT_SPLITS.map((s, i) => ({
    id: `split-${i}`,
    name: s.name,
    color: s.color,
    order: i,
    archived: false,
  }))
  const [homework, tests, projects, tournaments, club] = splits.map((s) => s.id)
  const stamp = { createdAt: now, updatedAt: now, completedOccurrences: [] as string[] }
  const base = (fields: Partial<Item>): Item =>
    ({
      id: uid(),
      notes: '',
      priority: 0,
      subtasks: [],
      completed: false,
      ...stamp,
      ...fields,
    }) as Item

  const items: Item[] = [
    base({
      id: 'item-chem-lab',
      splitId: homework,
      title: 'Chem lab report: titration results',
      notes: 'Include error analysis and the two trial curves.',
      priority: 2,
      dueAt: at(0, 17),
      kind: 'homework',
      className: 'Chemistry 201',
      estimateMin: 90,
    } as Partial<Item>),
    base({
      id: 'item-essay',
      splitId: homework,
      title: 'Lit essay draft (1,200 words)',
      priority: 1,
      dueAt: at(-1, 23, 59),
      kind: 'homework',
      className: 'English 112',
      estimateMin: 120,
    } as Partial<Item>),
    base({
      id: 'item-problem-set',
      splitId: homework,
      title: 'Problem set 7, sections 4 to 6',
      dueAt: at(2, 9),
      kind: 'homework',
      className: 'Calculus II',
      estimateMin: 60,
    } as Partial<Item>),
    base({
      id: 'item-stats-reading',
      splitId: homework,
      title: 'Read chapter 9 (regression)',
      dueAt: at(4, 12),
      kind: 'homework',
      className: 'Statistics',
      estimateMin: 45,
    } as Partial<Item>),
    base({
      id: 'item-chem-test',
      splitId: tests,
      title: 'Chem midterm',
      notes: 'Bring calculator and the periodic table handout.',
      priority: 3,
      startsAt: at(3, 10),
      endsAt: at(3, 11, 30),
      kind: 'test',
      topics: ['Stoichiometry', 'Gas laws', 'Equilibrium'],
    } as Partial<Item>),
    base({
      id: 'item-capstone',
      splitId: projects,
      title: 'Capstone prototype',
      notes: 'Milestones track the full build.',
      priority: 2,
      dueAt: at(9, 17),
      kind: 'project',
      milestones: [
        {
          id: 'm1',
          title: 'Research and requirements',
          done: true,
          subtasks: [{ id: 's1', title: 'Interview two users', done: true }],
        },
        {
          id: 'm2',
          title: 'Working prototype',
          done: false,
          subtasks: [
            { id: 's2', title: 'Core screens', done: true },
            { id: 's3', title: 'Data layer', done: false },
            { id: 's4', title: 'Usability test', done: false },
          ],
        },
      ],
    } as Partial<Item>),
    base({
      id: 'item-debate',
      splitId: tournaments,
      title: 'Regional debate tournament',
      priority: 2,
      startsAt: at(12, 8),
      endsAt: at(14, 18),
      kind: 'tournament',
      startDate: addDays(today, 12),
      endDate: addDays(today, 14),
      location: 'Riverside Convention Center',
      packing: [
        { id: 'p1', title: 'Case files printed', done: false },
        { id: 'p2', title: 'Name badges', done: false },
      ],
      rounds: [{ id: 'r1', label: 'Round 1', notes: '' }],
    } as Partial<Item>),
    base({
      id: 'item-robotics',
      splitId: club,
      title: 'Robotics club meeting',
      notes: 'Bring laptops for the sensor calibration session.',
      startsAt: at(0, 18, 0),
      endsAt: at(0, 19, 30),
      recurrence: { freq: 'weekly', interval: 1, byWeekday: [new Date(now).getDay()] },
      kind: 'club',
      meetingTodos: {},
    } as Partial<Item>),
  ]

  const blocks: WorkBlock[] = [
    {
      id: uid(),
      itemId: 'item-essay',
      start: at(0, 9, 0),
      end: at(0, 10, 30),
    },
    {
      id: uid(),
      itemId: 'item-problem-set',
      start: at(0, 13, 0),
      end: at(0, 14, 0),
    },
    {
      id: uid(),
      itemId: 'item-chem-test',
      start: at(1, 15, 0),
      end: at(1, 16, 0),
    },
  ]

  return { splits, items, blocks }
}

/** Seed once per database. Users who clear their data are not reseeded. */
export async function seedIfEmpty(repo: Repo, now: number = Date.now()): Promise<boolean> {
  if (await repo.getMeta('seeded')) return false
  const seed = buildSeed(now)
  await repo.importSnapshot(seed)
  await repo.setMeta('seeded', true)
  return true
}
