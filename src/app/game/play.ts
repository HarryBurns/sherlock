import { lowestBit, popcount } from './board';
import { Puzzle } from './model';

/** Ходы игрока над полем-массивом масок. Функции не меняют вход и возвращают новое поле. */

/** Убрать кандидата или вернуть убранного. null — ход невозможен (клетка опустела бы). */
export function toggleCandidate(board: readonly number[], cols: number, row: number, col: number, item: number): number[] | null {
  const i = row * cols + col;
  const bit = 1 << item;
  if (board[i] === bit) return null;
  const next = board.slice();
  next[i] ^= bit;
  return next;
}

/** Выбрать кандидата ответом клетки. */
export function selectCandidate(board: readonly number[], cols: number, row: number, col: number, item: number): number[] | null {
  const i = row * cols + col;
  const bit = 1 << item;
  if (!(board[i] & bit) || board[i] === bit) return null;
  const next = board.slice();
  next[i] = bit;
  return next;
}

/**
 * Автозаполнение внутри строк: выбранный предмет убирается из соседних клеток,
 * а предмет, возможный только в одной клетке строки, выбирается. Изменяет board.
 */
export function autoFill(board: number[], rows: number, cols: number): void {
  for (let changed = true; changed; ) {
    changed = false;
    for (let r = 0; r < rows; r++) {
      const base = r * cols;
      for (let c = 0; c < cols; c++) {
        const m = board[base + c];
        if (popcount(m) !== 1) continue;
        for (let c2 = 0; c2 < cols; c2++) {
          const j = base + c2;
          if (c2 !== c && board[j] & m && board[j] !== m) {
            board[j] &= ~m;
            changed = true;
          }
        }
      }
      for (let item = 0; item < cols; item++) {
        const bit = 1 << item;
        let only = -1;
        let count = 0;
        for (let c = 0; c < cols; c++) {
          if (board[base + c] & bit) {
            only = c;
            count++;
          }
        }
        if (count === 1 && board[base + only] !== bit) {
          board[base + only] = bit;
          changed = true;
        }
      }
    }
  }
}

export function isWon(board: readonly number[], p: Puzzle): boolean {
  return board.every((m, i) => m === 1 << p.solution[Math.floor(i / p.cols)][i % p.cols]);
}

/** Клетки, где игрок убрал правильный предмет. */
export function errorCells(board: readonly number[], p: Puzzle): number[] {
  const out: number[] = [];
  board.forEach((m, i) => {
    if (!(m & (1 << p.solution[Math.floor(i / p.cols)][i % p.cols]))) out.push(i);
  });
  return out;
}

export function singleItem(mask: number): number {
  return popcount(mask) === 1 ? lowestBit(mask) : -1;
}

export function encodeBoard(board: readonly number[]): string {
  return board.map((m) => m.toString(16).padStart(2, '0')).join('');
}

export function decodeBoard(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 2) out.push(parseInt(s.slice(i, i + 2), 16));
  return out;
}
