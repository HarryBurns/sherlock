import { ClueKind } from './model';
import { Tech } from './solver';

export interface LevelConfig {
  readonly rows: number;
  readonly cols: number;
  /** Самый сложный приём, который разрешён решателю. */
  readonly maxTech: Tech;
  /** Генератор старается, чтобы без этого приёма было не обойтись. */
  readonly minTech: Tech;
  /** Сколько клеток открыто с начала. */
  readonly givens: number;
  /** Сколько лишних подсказок добавить после минимизации. */
  readonly extraClues: number;
  /** Относительная частота типов подсказок. */
  readonly kinds: Partial<Record<ClueKind, number>>;
}

export const LEVELS: readonly LevelConfig[] = [
  {
    rows: 4,
    cols: 4,
    maxTech: Tech.Basic,
    minTech: Tech.Basic,
    givens: 2,
    extraClues: 2,
    kinds: { same: 3, notSame: 1, adjacent: 2, next: 2 },
  },
  {
    rows: 5,
    cols: 5,
    maxTech: Tech.Basic,
    minTech: Tech.Basic,
    givens: 1,
    extraClues: 1,
    kinds: { same: 3, notSame: 1, adjacent: 2, next: 2, before: 2, sequence: 1 },
  },
  {
    rows: 6,
    cols: 6,
    maxTech: Tech.Subsets,
    minTech: Tech.Subsets,
    givens: 0,
    extraClues: 1,
    kinds: { same: 2, notSame: 2, adjacent: 2, notAdjacent: 1, before: 2, next: 2, sequence: 1, between: 1, notBetween: 1 },
  },
  {
    rows: 6,
    cols: 6,
    maxTech: Tech.CluePairs,
    minTech: Tech.CluePairs,
    givens: 0,
    extraClues: 0,
    kinds: { same: 1, notSame: 3, adjacent: 2, notAdjacent: 2, before: 2, next: 1, sequence: 1, between: 2, notBetween: 2 },
  },
  {
    rows: 8,
    cols: 8,
    maxTech: Tech.Contradiction,
    minTech: Tech.CluePairs,
    givens: 0,
    extraClues: 0,
    kinds: { same: 2, notSame: 3, adjacent: 2, notAdjacent: 2, before: 2, next: 1, sequence: 1, between: 2, notBetween: 2 },
  },
];
