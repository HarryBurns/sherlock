/** Предмет: строка поля и номер предмета в этой строке. */
export interface Item {
  readonly row: number;
  readonly item: number;
}

/**
 * Типы подсказок. Позиции — номера столбцов, «справа» = больший номер.
 *
 * - same:        A над B — в одном столбце
 * - notSame:     A над B с ✕ — в разных столбцах
 * - adjacent:    A ↔ B — соседние столбцы, порядок любой
 * - notAdjacent: A ↮ B — расстояние между столбцами не равно 1
 * - before:      A → B — B где-то правее A
 * - next:        A B — B сразу справа от A
 * - sequence:    A B C — три соседних столбца ровно в этом порядке
 * - between:     A → B → C — A левее B, B левее C, не обязательно рядом
 * - notBetween:  A ✕B C — B не стоит строго между A и C
 */
export type ClueKind =
  | 'same'
  | 'notSame'
  | 'adjacent'
  | 'notAdjacent'
  | 'before'
  | 'next'
  | 'sequence'
  | 'between'
  | 'notBetween';

export interface Clue {
  readonly kind: ClueKind;
  readonly items: readonly Item[];
}

export const VERTICAL_KINDS: ReadonlySet<ClueKind> = new Set(['same', 'notSame']);

export interface RowSet {
  readonly kind: 'emoji' | 'letter';
  readonly symbols: readonly string[];
}

export interface Puzzle {
  readonly level: number;
  readonly seed: number;
  readonly rows: number;
  readonly cols: number;
  readonly rowSets: readonly RowSet[];
  /** solution[row][col] — номер предмета в этой клетке. */
  readonly solution: readonly (readonly number[])[];
  readonly clues: readonly Clue[];
  /** Клетки, открытые с самого начала. */
  readonly givens: readonly { readonly row: number; readonly col: number }[];
}

/** Выполняется ли подсказка при данных столбцах её предметов. */
export function clueHolds(kind: ClueKind, p: readonly number[]): boolean {
  switch (kind) {
    case 'same':
      return p[0] === p[1];
    case 'notSame':
      return p[0] !== p[1];
    case 'adjacent':
      return Math.abs(p[0] - p[1]) === 1;
    case 'notAdjacent':
      return Math.abs(p[0] - p[1]) !== 1;
    case 'before':
      return p[0] < p[1];
    case 'next':
      return p[1] === p[0] + 1;
    case 'sequence':
      return p[1] === p[0] + 1 && p[2] === p[1] + 1;
    case 'between':
      return p[0] < p[1] && p[1] < p[2];
    case 'notBetween':
      return !(Math.min(p[0], p[2]) < p[1] && p[1] < Math.max(p[0], p[2]));
  }
}
