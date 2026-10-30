import { generate, initialBoard } from './generator';
import { LEVELS } from './levels';
import { Puzzle, clueHolds } from './model';
import { Solver } from './solver';

function positions(p: Puzzle): number[][] {
  // pos[row][item] = столбец
  return p.solution.map((row) => {
    const pos = new Array<number>(row.length);
    row.forEach((item, col) => (pos[item] = col));
    return pos;
  });
}

/** Полный перебор: сколько решений у головоломки (до limit). */
function countSolutions(p: Puzzle, limit = 2): number {
  const perms = permutations(p.cols);
  const pos: number[][] = [];
  let found = 0;
  const rec = (r: number) => {
    if (found >= limit) return;
    if (r === p.rows) {
      found++;
      return;
    }
    for (const perm of perms) {
      if (p.givens.some((g) => g.row === r && perm[g.col] !== p.solution[r][g.col])) continue;
      const inv = new Array<number>(p.cols);
      perm.forEach((item, col) => (inv[item] = col));
      pos[r] = inv;
      const ok = p.clues.every(
        (c) => c.items.some((it) => it.row > r) || clueHolds(c.kind, c.items.map((it) => pos[it.row][it.item])),
      );
      if (ok) rec(r + 1);
    }
  };
  rec(0);
  return found;
}

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  return permutations(n - 1).flatMap((p) =>
    Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)]),
  );
}

describe('generate', () => {
  for (let level = 1; level <= LEVELS.length; level++) {
    it(`level ${level}: clues are true and the solver reaches the solution`, () => {
      const cfg = LEVELS[level - 1];
      for (let seed = 1; seed <= (level === 5 ? 1 : 3); seed++) {
        const t = performance.now();
        const p = generate(level, seed);
        const ms = performance.now() - t;
        const pos = positions(p);
        for (const c of p.clues) {
          expect(clueHolds(c.kind, c.items.map((it) => pos[it.row][it.item]))).toBe(true);
        }
        const b = initialBoard(p, p.solution, p.givens);
        const res = new Solver(p.rows, p.cols, p.clues).solve(b, cfg.maxTech);
        expect(res.solved).toBe(true);
        for (let r = 0; r < p.rows; r++) {
          for (let c = 0; c < p.cols; c++) expect(b[r * p.cols + c]).toBe(1 << p.solution[r][c]);
        }
        console.log(`level ${level} seed ${seed}: ${p.clues.length} clues, hardest ${res.hardest}, ${ms.toFixed(0)} ms`);
      }
    }, 120_000);
  }

  it('is deterministic for a seed', () => {
    expect(generate(3, 42)).toEqual(generate(3, 42));
  });

  it('level 1 puzzles have exactly one solution (brute force)', () => {
    for (let seed = 1; seed <= 10; seed++) expect(countSolutions(generate(1, seed))).toBe(1);
  });

  it('level 1 rows include the letter word', () => {
    const p = generate(1, 7);
    expect(p.rowSets.some((s) => s.kind === 'letter' && s.symbols.join('') === 'CASE')).toBe(true);
  });
});
