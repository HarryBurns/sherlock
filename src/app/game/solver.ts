import {
  Board,
  Elimination,
  applyEliminations,
  hasContradiction,
  isSolved,
  itemDomain,
  lowestBit,
  popcount,
} from './board';
import { Clue, ClueKind, Item, clueHolds } from './model';

/**
 * Приёмы решения, от простых к сложным. Уровень приёма определяет сложность.
 *
 * 1. Одиночки в строке и прямое следствие одной подсказки.
 * 2. Группы в строке: k клеток, где возможны только k предметов (и наоборот).
 * 3. Совместное следствие двух подсказок с общим предметом.
 * 4. От противного: предположение быстро приводит к противоречию.
 */
export enum Tech {
  Basic = 1,
  Subsets = 2,
  CluePairs = 3,
  Contradiction = 4,
}

export interface Step {
  readonly tech: Tech;
  /** Номера подсказок, из которых следует шаг. */
  readonly clues: readonly number[];
  readonly eliminations: readonly Elimination[];
}

export interface SolveResult {
  readonly solved: boolean;
  readonly hardest: number;
  readonly steps: number;
}

interface Group {
  readonly clues: readonly number[];
  readonly items: readonly Item[];
  /** Для каждой подсказки группы — индексы её предметов в items. */
  readonly map: readonly (readonly number[])[];
}

export class Solver {
  private readonly singles: Group[];
  private readonly pairs: Group[];

  constructor(
    private readonly rows: number,
    private readonly cols: number,
    private readonly clues: readonly Clue[],
  ) {
    this.singles = clues.map((_, i) => makeGroup(clues, [i]));
    this.pairs = [];
    for (let i = 0; i < clues.length; i++) {
      for (let j = i + 1; j < clues.length; j++) {
        const g = makeGroup(clues, [i, j]);
        const shared = g.items.length < clues[i].items.length + clues[j].items.length;
        if (shared && g.items.length <= 4) this.pairs.push(g);
      }
    }
  }

  /** Следующий логический шаг не сложнее maxTech или null, если его нет. */
  step(b: Board, maxTech: number): Step | null {
    return (
      this.nakedSingle(b) ??
      this.hiddenSingle(b) ??
      this.groupStep(b, this.singles, Tech.Basic) ??
      (maxTech >= Tech.Subsets ? this.subsets(b) : null) ??
      (maxTech >= Tech.CluePairs ? this.groupStep(b, this.pairs, Tech.CluePairs) : null) ??
      (maxTech >= Tech.Contradiction ? this.contradiction(b) : null)
    );
  }

  /**
   * Решает на месте, изменяя b. Работает проходами: каждый приём применяется
   * сразу везде, а к более сложному переходим, только когда простые исчерпаны.
   */
  solve(b: Board, maxTech: number): SolveResult {
    let hardest = 0;
    let steps = 0;
    for (;;) {
      let tech = 0;
      if (this.basicPass(b)) tech = Tech.Basic;
      else if (maxTech >= Tech.Subsets && this.applyStep(b, this.subsets(b))) tech = Tech.Subsets;
      else if (maxTech >= Tech.CluePairs && this.groupPass(b, this.pairs)) tech = Tech.CluePairs;
      else if (maxTech >= Tech.Contradiction && this.applyStep(b, this.contradiction(b))) tech = Tech.Contradiction;
      if (!tech) break;
      hardest = Math.max(hardest, tech);
      steps++;
      if (hasContradiction(b, this.rows, this.cols)) return { solved: false, hardest, steps };
    }
    return { solved: isSolved(b), hardest, steps };
  }

  private applyStep(b: Board, s: Step | null): boolean {
    if (!s) return false;
    applyEliminations(b, this.cols, s.eliminations);
    return true;
  }

  /** Одиночки и одиночные подсказки до неподвижной точки. */
  private basicPass(b: Board): boolean {
    const { rows, cols } = this;
    let any = false;
    for (;;) {
      let changed = false;
      for (let r = 0; r < rows; r++) {
        const base = r * cols;
        for (let c = 0; c < cols; c++) {
          const m = b[base + c];
          if (m === 0 || m & (m - 1)) continue;
          for (let c2 = 0; c2 < cols; c2++) {
            if (c2 !== c && b[base + c2] & m) {
              b[base + c2] &= ~m;
              changed = true;
            }
          }
        }
        for (let item = 0; item < cols; item++) {
          const dom = itemDomain(b, cols, r, item);
          if (popcount(dom) !== 1) continue;
          const c = lowestBit(dom);
          if (b[base + c] !== 1 << item) {
            b[base + c] = 1 << item;
            changed = true;
          }
        }
      }
      if (this.groupPass(b, this.singles)) changed = true;
      if (!changed) return any;
      if (b.includes(0)) return true;
      any = true;
    }
  }

  private groupPass(b: Board, groups: readonly Group[]): boolean {
    let changed = false;
    for (const g of groups) {
      const elims = this.groupEliminations(b, g);
      if (elims.length) {
        applyEliminations(b, this.cols, elims);
        changed = true;
      }
    }
    return changed;
  }

  /** Приводит ли предположение «в клетке (r, c) предмет item» к противоречию. */
  private refutes(b: Board, r: number, c: number, item: number): boolean {
    const trial = b.slice();
    trial[r * this.cols + c] = 1 << item;
    this.basicPass(trial);
    return hasContradiction(trial, this.rows, this.cols);
  }

  private nakedSingle(b: Board): Step | null {
    const { rows, cols } = this;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const m = b[r * cols + c];
        if (popcount(m) !== 1) continue;
        const item = lowestBit(m);
        const elims: Elimination[] = [];
        for (let c2 = 0; c2 < cols; c2++) {
          if (c2 !== c && b[r * cols + c2] & m) elims.push({ row: r, col: c2, item });
        }
        if (elims.length) return { tech: Tech.Basic, clues: [], eliminations: elims };
      }
    }
    return null;
  }

  private hiddenSingle(b: Board): Step | null {
    const { rows, cols } = this;
    for (let r = 0; r < rows; r++) {
      for (let item = 0; item < cols; item++) {
        const dom = itemDomain(b, cols, r, item);
        if (popcount(dom) !== 1) continue;
        const c = lowestBit(dom);
        const others = b[r * cols + c] & ~(1 << item);
        if (others) return { tech: Tech.Basic, clues: [], eliminations: cellElims(r, c, others) };
      }
    }
    return null;
  }

  private subsets(b: Board): Step | null {
    const { rows, cols } = this;
    const all = (1 << cols) - 1;
    for (let r = 0; r < rows; r++) {
      for (let set = 1; set < all; set++) {
        const k = popcount(set);
        if (k < 2 || k > cols - 2) continue;
        // set — столбцы: если в них возможны только k предметов, этих предметов нет в других столбцах.
        let union = 0;
        for (let c = 0; c < cols; c++) if (set & (1 << c)) union |= b[r * cols + c];
        if (popcount(union) === k) {
          const elims: Elimination[] = [];
          for (let c = 0; c < cols; c++) {
            if (set & (1 << c)) continue;
            const hit = b[r * cols + c] & union;
            if (hit) elims.push(...cellElims(r, c, hit));
          }
          if (elims.length) return { tech: Tech.Subsets, clues: [], eliminations: elims };
        }
        // set — предметы: если они умещаются в k столбцов, другим предметам там места нет.
        let cells = 0;
        for (let i = 0; i < cols; i++) if (set & (1 << i)) cells |= itemDomain(b, cols, r, i);
        if (popcount(cells) === k) {
          const elims: Elimination[] = [];
          for (let c = 0; c < cols; c++) {
            if (!(cells & (1 << c))) continue;
            const hit = b[r * cols + c] & ~set;
            if (hit) elims.push(...cellElims(r, c, hit));
          }
          if (elims.length) return { tech: Tech.Subsets, clues: [], eliminations: elims };
        }
      }
    }
    return null;
  }

  private groupStep(b: Board, groups: readonly Group[], tech: Tech): Step | null {
    for (const g of groups) {
      const elims = this.groupEliminations(b, g);
      if (elims.length) return { tech, clues: g.clues, eliminations: elims };
    }
    return null;
  }

  /** Убирает позиции предметов группы, для которых нет совместного расклада. */
  private groupEliminations(b: Board, g: Group): Elimination[] {
    const { cols } = this;
    const n = g.items.length;
    const doms = g.items.map((it) => itemDomain(b, cols, it.row, it.item));
    if (g.clues.length === 1) {
      return toEliminations(g.items, doms, clueSupport(this.clues[g.clues[0]], doms, cols));
    }
    const support = new Array<number>(n).fill(0);
    const pos = new Array<number>(n).fill(0);
    const kinds = g.clues.map((ci) => this.clues[ci].kind);
    const args = g.map.map((m) => m.map(() => 0));

    const rec = (k: number): void => {
      if (k === n) {
        for (let ci = 0; ci < kinds.length; ci++) {
          const m = g.map[ci];
          for (let j = 0; j < m.length; j++) args[ci][j] = pos[m[j]];
          if (!clueHolds(kinds[ci], args[ci])) return;
        }
        for (let j = 0; j < n; j++) support[j] |= 1 << pos[j];
        return;
      }
      let d = doms[k];
      while (d) {
        const c = lowestBit(d);
        d &= d - 1;
        let clash = false;
        for (let j = 0; j < k; j++) {
          if (pos[j] === c && g.items[j].row === g.items[k].row) {
            clash = true;
            break;
          }
        }
        if (clash) continue;
        pos[k] = c;
        rec(k + 1);
      }
    };
    rec(0);

    return toEliminations(g.items, doms, support);
  }

  private contradiction(b: Board): Step | null {
    const { rows, cols } = this;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const m = b[r * cols + c];
        if (popcount(m) < 2) continue;
        let rest = m;
        while (rest) {
          const item = lowestBit(rest);
          rest &= rest - 1;
          if (this.refutes(b, r, c, item)) {
            return { tech: Tech.Contradiction, clues: [], eliminations: [{ row: r, col: c, item }] };
          }
        }
      }
    }
    return null;
  }
}

function makeGroup(clues: readonly Clue[], ids: number[]): Group {
  const items: Item[] = [];
  const map = ids.map((ci) =>
    clues[ci].items.map((it) => {
      let idx = items.findIndex((x) => x.row === it.row && x.item === it.item);
      if (idx < 0) idx = items.push(it) - 1;
      return idx;
    }),
  );
  return { clues: ids, items, map };
}

function cellElims(row: number, col: number, mask: number): Elimination[] {
  const out: Elimination[] = [];
  while (mask) {
    out.push({ row, col, item: lowestBit(mask) });
    mask &= mask - 1;
  }
  return out;
}

function toEliminations(items: readonly Item[], doms: readonly number[], support: readonly number[]): Elimination[] {
  const elims: Elimination[] = [];
  for (let j = 0; j < items.length; j++) {
    let lost = doms[j] & ~support[j];
    while (lost) {
      elims.push({ row: items[j].row, col: lowestBit(lost), item: items[j].item });
      lost &= lost - 1;
    }
  }
  return elims;
}

const tables = new Map<string, Uint8Array>();

/**
 * Таблица совместимости для подсказки: для двух предметов table[p] — маска
 * столбцов второго при первом в p; для трёх table[p0 * cols + p1] — маска третьего.
 */
function compatTable(kind: ClueKind, arity: number, cols: number): Uint8Array {
  const key = `${kind}:${arity}:${cols}`;
  let t = tables.get(key);
  if (!t) {
    t = new Uint8Array(arity === 2 ? cols : cols * cols);
    for (let i = 0; i < t.length; i++) {
      const prefix = arity === 2 ? [i] : [Math.floor(i / cols), i % cols];
      for (let q = 0; q < cols; q++) if (clueHolds(kind, [...prefix, q])) t[i] |= 1 << q;
    }
    tables.set(key, t);
  }
  return t;
}

/** Для каждого предмета подсказки — маска столбцов, где у него есть совместный расклад. */
function clueSupport(clue: Clue, doms: readonly number[], cols: number): number[] {
  const [a, b, c] = clue.items;
  const t = compatTable(clue.kind, clue.items.length, cols);
  if (!c) {
    let s0 = 0;
    let s1 = 0;
    let d0 = doms[0];
    while (d0) {
      const p = lowestBit(d0);
      d0 &= d0 - 1;
      const m = doms[1] & t[p] & (a.row === b.row ? ~(1 << p) : 0xff);
      if (m) {
        s0 |= 1 << p;
        s1 |= m;
      }
    }
    return [s0, s1];
  }
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  let d0 = doms[0];
  while (d0) {
    const p0 = lowestBit(d0);
    d0 &= d0 - 1;
    let d1 = doms[1] & (a.row === b.row ? ~(1 << p0) : 0xff);
    while (d1) {
      const p1 = lowestBit(d1);
      d1 &= d1 - 1;
      let m = doms[2] & t[p0 * cols + p1];
      if (a.row === c.row) m &= ~(1 << p0);
      if (b.row === c.row) m &= ~(1 << p1);
      if (m) {
        s0 |= 1 << p0;
        s1 |= 1 << p1;
        s2 |= m;
      }
    }
  }
  return [s0, s1, s2];
}
