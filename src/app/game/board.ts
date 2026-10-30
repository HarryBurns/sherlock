/**
 * Состояние кандидатов: board[row * cols + col] — битовая маска предметов,
 * которые ещё возможны в клетке. Столбцов не больше 8, поэтому хватает байта.
 */
export type Board = Uint8Array;

export interface Elimination {
  readonly row: number;
  readonly col: number;
  readonly item: number;
}

export function popcount(m: number): number {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

export function lowestBit(m: number): number {
  return 31 - Math.clz32(m & -m);
}

export function createBoard(rows: number, cols: number): Board {
  return new Uint8Array(rows * cols).fill((1 << cols) - 1);
}

/** Маска столбцов, где предмет ещё возможен. */
export function itemDomain(b: Board, cols: number, row: number, item: number): number {
  const bit = 1 << item;
  let dom = 0;
  for (let c = 0; c < cols; c++) {
    if (b[row * cols + c] & bit) dom |= 1 << c;
  }
  return dom;
}

export function isSolved(b: Board): boolean {
  return b.every((m) => m !== 0 && (m & (m - 1)) === 0);
}

export function hasContradiction(b: Board, rows: number, cols: number): boolean {
  for (let r = 0; r < rows; r++) {
    let seen = 0;
    for (let c = 0; c < cols; c++) {
      const m = b[r * cols + c];
      if (m === 0) return true;
      seen |= m;
    }
    if (seen !== (1 << cols) - 1) return true;
  }
  return false;
}

export function applyEliminations(b: Board, cols: number, elims: readonly Elimination[]): void {
  for (const e of elims) b[e.row * cols + e.col] &= ~(1 << e.item);
}
