import { Board, createBoard } from './board';
import { LEVELS, LevelConfig } from './levels';
import { Clue, ClueKind, Item, Puzzle, RowSet } from './model';
import { Rng, createRng, randInt, shuffle } from './rng';
import { Solver, Tech } from './solver';
import { EMOJI_SETS, LETTER_WORDS } from './symbols';

const MAX_ATTEMPTS = 8;
const MAX_CLUES = 400;

/** Создаёт головоломку уровня 1..5. Одинаковые level и seed дают одинаковый результат. */
export function generate(level: number, seed: number): Puzzle {
  const cfg = LEVELS[level - 1];
  const rng = createRng(seed);
  const { rows, cols } = cfg;

  const solution = Array.from({ length: rows }, () => shuffle(rng, range(cols)));
  const rowSets = pickRowSets(rng, rows, cols);

  let best: { clues: Clue[]; givens: { row: number; col: number }[]; hardest: number } | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const givens = shuffle(
      rng,
      range(rows * cols).map((i) => ({ row: Math.floor(i / cols), col: i % cols })),
    ).slice(0, cfg.givens);
    const clues = buildClues(rng, cfg, solution, givens);
    const hardest = new Solver(rows, cols, clues).solve(initialBoard(cfg, solution, givens), cfg.maxTech).hardest;
    if (!best || hardest > best.hardest) best = { clues, givens, hardest };
    if (hardest >= cfg.minTech) break;
  }

  return {
    level,
    seed,
    rows,
    cols,
    rowSets,
    solution,
    clues: shuffle(rng, best!.clues),
    givens: best!.givens,
  };
}

export function initialBoard(
  cfg: { rows: number; cols: number },
  solution: readonly (readonly number[])[],
  givens: readonly { row: number; col: number }[],
): Board {
  const b = createBoard(cfg.rows, cfg.cols);
  for (const g of givens) b[g.row * cfg.cols + g.col] = 1 << solution[g.row][g.col];
  return b;
}

function buildClues(
  rng: Rng,
  cfg: LevelConfig,
  solution: readonly (readonly number[])[],
  givens: readonly { row: number; col: number }[],
): Clue[] {
  const { rows, cols, maxTech } = cfg;
  const buildTech = Math.min(maxTech, Tech.CluePairs);
  const start = initialBoard(cfg, solution, givens);
  const keys = new Set<string>();
  const clues: Clue[] = [];
  const add = () => {
    for (;;) {
      const c = randomClue(rng, cfg, solution);
      const key = clueKey(c);
      if (keys.has(key)) continue;
      keys.add(key);
      clues.push(c);
      return;
    }
  };

  // Добавляем подсказки, пока решатель не дойдёт до конца. Состояние переиспользуется:
  // все исключения корректны и остаются верными при любом расширении набора.
  const b = start.slice();
  while (clues.length < MAX_CLUES) {
    add();
    if (new Solver(rows, cols, clues).solve(b, buildTech).solved) break;
  }

  // Убираем всё, без чего можно обойтись. Сначала дешёвым решателем, затем полным:
  // проверка полным решателем дорогая, а лишних подсказок к этому моменту уже мало.
  let kept = clues;
  for (const tech of new Set([buildTech, maxTech])) {
    for (const clue of shuffle(rng, kept)) {
      const without = kept.filter((c) => c !== clue);
      if (new Solver(rows, cols, without).solve(start.slice(), tech).solved) kept = without;
    }
  }

  clues.length = 0;
  clues.push(...kept);
  for (let i = 0; i < cfg.extraClues; i++) add();
  return clues;
}

function randomClue(rng: Rng, cfg: LevelConfig, solution: readonly (readonly number[])[]): Clue {
  const { rows, cols } = cfg;
  const kinds = Object.entries(cfg.kinds) as [ClueKind, number][];
  const total = kinds.reduce((s, [, w]) => s + w, 0);
  const at = (row: number, col: number): Item => ({ row, item: solution[row][col] });
  const anyRow = () => randInt(rng, rows);
  const twoRows = () => {
    const a = randInt(rng, rows);
    return [a, (a + 1 + randInt(rng, rows - 1)) % rows];
  };
  const maybeSwap = (items: Item[]) => (rng() < 0.5 ? items : items.reverse());

  for (;;) {
    let roll = rng() * total;
    const kind = kinds.find(([, w]) => (roll -= w) < 0)?.[0] ?? kinds[0][0];
    let items: Item[];
    switch (kind) {
      case 'same': {
        const [r1, r2] = twoRows();
        const c = randInt(rng, cols);
        items = [at(r1, c), at(r2, c)];
        break;
      }
      case 'notSame': {
        const [r1, r2] = twoRows();
        const c1 = randInt(rng, cols);
        const c2 = (c1 + 1 + randInt(rng, cols - 1)) % cols;
        items = [at(r1, c1), at(r2, c2)];
        break;
      }
      case 'adjacent': {
        const c = randInt(rng, cols - 1);
        items = maybeSwap([at(anyRow(), c), at(anyRow(), c + 1)]);
        break;
      }
      case 'notAdjacent': {
        const c1 = randInt(rng, cols);
        const c2 = randInt(rng, cols);
        if (Math.abs(c1 - c2) < 2) continue;
        items = [at(anyRow(), c1), at(anyRow(), c2)];
        break;
      }
      case 'before': {
        const [c1, c2] = sortedCols(rng, cols, 2);
        items = [at(anyRow(), c1), at(anyRow(), c2)];
        break;
      }
      case 'next': {
        const c = randInt(rng, cols - 1);
        items = [at(anyRow(), c), at(anyRow(), c + 1)];
        break;
      }
      case 'sequence': {
        const c = randInt(rng, cols - 2);
        items = [at(anyRow(), c), at(anyRow(), c + 1), at(anyRow(), c + 2)];
        break;
      }
      case 'between': {
        const [c1, c2, c3] = sortedCols(rng, cols, 3);
        items = [at(anyRow(), c1), at(anyRow(), c2), at(anyRow(), c3)];
        break;
      }
      case 'notBetween': {
        const [lo, hi] = sortedCols(rng, cols, 2);
        if (hi - lo < 2) continue;
        const outside = range(cols).filter((c) => c <= lo || c >= hi);
        const mid = outside[randInt(rng, outside.length)];
        const ends = maybeSwap([at(anyRow(), lo), at(anyRow(), hi)]);
        items = [ends[0], at(anyRow(), mid), ends[1]];
        break;
      }
    }
    const distinct = new Set(items.map((it) => `${it.row}:${it.item}`)).size === items.length;
    if (distinct) return { kind, items };
  }
}

function pickRowSets(rng: Rng, rows: number, cols: number): RowSet[] {
  const sets: RowSet[] = [];
  const word = LETTER_WORDS[cols];
  if (word) sets.push({ kind: 'letter', symbols: [...word] });
  for (const set of shuffle(rng, EMOJI_SETS)) {
    if (sets.length === rows) break;
    sets.push({ kind: 'emoji', symbols: shuffle(rng, set).slice(0, cols) });
  }
  return shuffle(rng, sets);
}

function sortedCols(rng: Rng, cols: number, n: number): number[] {
  return shuffle(rng, range(cols))
    .slice(0, n)
    .sort((a, b) => a - b);
}

function clueKey(c: Clue): string {
  return `${c.kind}|${c.items.map((it) => `${it.row}:${it.item}`).join(',')}`;
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}
