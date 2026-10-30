import { Injectable, computed, inject, signal } from '@angular/core';
import { Elimination } from '../game/board';
import { initialBoard } from '../game/generator';
import { LEVELS } from '../game/levels';
import { Puzzle } from '../game/model';
import {
  autoFill,
  decodeBoard,
  encodeBoard,
  errorCells,
  isWon,
  selectCandidate,
  singleItem,
  toggleCandidate,
} from '../game/play';
import { randomSeed } from '../game/rng';
import { EngineService } from './engine.service';

export type Lang = 'ru' | 'en';

export interface Settings {
  readonly lang: Lang;
  readonly auto: boolean;
}

export interface LevelStats {
  readonly solved: number;
  readonly best: number | null;
  readonly hints: number;
}

export interface Game {
  readonly puzzle: Puzzle;
  readonly board: readonly number[];
  readonly history: readonly string[];
  readonly future: readonly string[];
  readonly marks: readonly boolean[];
  readonly elapsed: number;
  readonly hints: number;
  readonly won: boolean;
}

export type HintView =
  | { readonly kind: 'errors'; readonly cells: readonly number[] }
  | { readonly kind: 'step'; readonly clues: readonly number[]; readonly eliminations: readonly Elimination[] };

interface Saved {
  readonly v: 1;
  readonly level: number;
  readonly games: readonly (SavedGame | null)[];
  readonly ready: readonly (Puzzle | null)[];
  readonly settings: Settings;
  readonly stats: readonly LevelStats[];
}

type SavedGame = Omit<Game, 'board'> & { readonly board: string };

const STORAGE_KEY = 'sherlock:v1';
const HISTORY_LIMIT = 500;
const LEVEL_COUNT = LEVELS.length;

@Injectable({ providedIn: 'root' })
export class GameStore {
  private readonly engine = inject(EngineService);

  readonly level = signal(1);
  readonly games = signal<readonly (Game | null)[]>(new Array(LEVEL_COUNT).fill(null));
  readonly settings = signal<Settings>({ lang: defaultLang(), auto: true });
  readonly stats = signal<readonly LevelStats[]>(
    Array.from({ length: LEVEL_COUNT }, () => ({ solved: 0, best: null, hints: 0 })),
  );
  readonly loading = signal(false);
  readonly paused = signal(false);
  readonly hint = signal<HintView | null>(null);
  /** Время только что завершённой партии стало лучшим. */
  readonly newBest = signal(false);

  readonly game = computed(() => this.games()[this.level() - 1]);
  readonly canUndo = computed(() => !!this.game()?.history.length && !this.game()?.won);
  readonly canRedo = computed(() => !!this.game()?.future.length && !this.game()?.won);

  private ready: (Puzzle | null)[] = new Array(LEVEL_COUNT).fill(null);
  private readonly preparing = new Set<number>();
  private hintRequest = 0;

  constructor() {
    this.load();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        // Таймер сам не тикает, пока вкладка скрыта (см. tick), — ставить паузу не нужно.
        if (document.visibilityState === 'hidden') this.save();
      });
      window.addEventListener('pagehide', () => this.save());
      setInterval(() => this.tick(), 1000);
    }
    if (!this.game()) void this.newGame();
    this.prepare(this.level());
  }

  // --- партии ---------------------------------------------------------------

  setLevel(level: number): void {
    if (level === this.level()) return;
    this.level.set(level);
    this.hint.set(null);
    this.paused.set(false);
    this.newBest.set(false);
    if (!this.game()) void this.newGame();
    this.prepare(level);
    this.save();
  }

  async newGame(): Promise<void> {
    const level = this.level();
    this.hint.set(null);
    this.paused.set(false);
    this.newBest.set(false);
    let puzzle = this.ready[level - 1];
    this.ready[level - 1] = null;
    if (!puzzle) {
      this.loading.set(true);
      puzzle = await this.engine.generate(level, randomSeed());
      this.loading.set(false);
    }
    const board = Array.from(initialBoard(puzzle, puzzle.solution, puzzle.givens));
    if (this.settings().auto) autoFill(board, puzzle.rows, puzzle.cols);
    this.setGame(level, {
      puzzle,
      board,
      history: [],
      future: [],
      marks: puzzle.clues.map(() => false),
      elapsed: 0,
      hints: 0,
      won: false,
    });
    this.prepare(level);
  }

  /** Заранее готовит следующую головоломку уровня в фоне. */
  private prepare(level: number): void {
    if (this.ready[level - 1] || this.preparing.has(level)) return;
    this.preparing.add(level);
    void this.engine.generate(level, randomSeed()).then((p) => {
      this.preparing.delete(level);
      this.ready[level - 1] = p;
      this.save();
    });
  }

  // --- ходы -----------------------------------------------------------------

  toggle(row: number, col: number, item: number): void {
    this.move((b, cols) => toggleCandidate(b, cols, row, col, item));
  }

  select(row: number, col: number, item: number): void {
    this.move((b, cols) => selectCandidate(b, cols, row, col, item));
  }

  /**
   * Снимает выбор с клетки: возвращает ей кандидатов, что были до выбора, а предмет —
   * в клетки строки, откуда он ушёл. Открытые с начала клетки не снимаются.
   */
  unselect(row: number, col: number): void {
    const g = this.game();
    if (!g || g.puzzle.givens.some((x) => x.row === row && x.col === col)) return;
    const cols = g.puzzle.cols;
    const i = row * cols + col;
    const bit = g.board[i];
    if (singleItem(bit) < 0) return;
    let prev: number[] | null = null;
    for (let h = g.history.length - 1; h >= 0 && !prev; h--) {
      const b = decodeBoard(g.history[h]);
      if (singleItem(b[i]) < 0) prev = b;
    }
    if (!prev) return;
    const before = prev;
    this.move((board) => {
      const next = board.slice();
      next[i] = before[i] | bit;
      for (let c = 0; c < cols; c++) {
        const j = row * cols + c;
        if (c !== col && before[j] & bit) next[j] |= bit;
      }
      return next;
    });
  }

  undo(): void {
    const g = this.game();
    if (!g || g.won || !g.history.length) return;
    this.hint.set(null);
    this.update({
      ...g,
      board: decodeBoard(g.history[g.history.length - 1]),
      history: g.history.slice(0, -1),
      future: [...g.future, encodeBoard(g.board)],
    });
  }

  redo(): void {
    const g = this.game();
    if (!g || g.won || !g.future.length) return;
    this.hint.set(null);
    this.update({
      ...g,
      board: decodeBoard(g.future[g.future.length - 1]),
      history: [...g.history, encodeBoard(g.board)],
      future: g.future.slice(0, -1),
    });
  }

  toggleMark(index: number): void {
    const g = this.game();
    if (!g || g.won) return;
    this.update({ ...g, marks: g.marks.map((m, i) => (i === index ? !m : m)) });
  }

  /** Первое нажатие показывает ошибку или следующий шаг, второе применяет шаг. */
  async requestHint(): Promise<void> {
    const g = this.game();
    if (!g || g.won || this.paused()) return;
    const shown = this.hint();
    if (shown?.kind === 'step') {
      this.move((b, cols) => {
        const next = b.slice();
        for (const e of shown.eliminations) next[e.row * cols + e.col] &= ~(1 << e.item);
        return next;
      });
      return;
    }
    if (shown) return;
    const errors = errorCells(g.board, g.puzzle);
    if (errors.length) {
      this.hint.set({ kind: 'errors', cells: errors });
      this.update({ ...g, hints: g.hints + 1 });
      return;
    }
    const request = ++this.hintRequest;
    const step = await this.engine.step(g.puzzle, g.board);
    if (request !== this.hintRequest || this.game() !== g || !step) return;
    this.hint.set({ kind: 'step', clues: step.clues, eliminations: step.eliminations });
    this.update({ ...g, hints: g.hints + 1 });
  }

  togglePause(): void {
    if (this.game()?.won) return;
    this.paused.update((p) => !p);
  }

  // --- настройки ------------------------------------------------------------

  setLang(lang: Lang): void {
    this.settings.update((s) => ({ ...s, lang }));
    this.save();
  }

  setAuto(auto: boolean): void {
    this.settings.update((s) => ({ ...s, auto }));
    this.save();
  }

  // --- внутреннее -----------------------------------------------------------

  private move(fn: (board: readonly number[], cols: number) => number[] | null): void {
    const g = this.game();
    if (!g || g.won || this.paused()) return;
    const next = fn(g.board, g.puzzle.cols);
    if (!next) return;
    if (this.settings().auto) autoFill(next, g.puzzle.rows, g.puzzle.cols);
    if (next.every((m, i) => m === g.board[i])) return;
    this.hintRequest++;
    this.hint.set(null);
    const history = [...g.history, encodeBoard(g.board)].slice(-HISTORY_LIMIT);
    const won = isWon(next, g.puzzle);
    this.update({ ...g, board: next, history, future: [], won });
    if (won) this.recordWin(g.elapsed, g.hints);
  }

  private recordWin(elapsed: number, hints: number): void {
    const i = this.level() - 1;
    const s = this.stats()[i];
    const best = s.best === null || elapsed < s.best;
    this.newBest.set(best);
    this.stats.update((all) =>
      all.map((x, j) => (j === i ? { solved: x.solved + 1, best: best ? elapsed : x.best, hints: x.hints + hints } : x)),
    );
    this.save();
  }

  private isRunning(): boolean {
    const g = this.game();
    return !!g && !g.won && !this.paused() && !this.loading();
  }

  private tick(): void {
    if (!this.isRunning() || document.visibilityState !== 'visible') return;
    const g = this.game()!;
    this.games.update((all) => all.map((x, i) => (i === this.level() - 1 ? { ...g, elapsed: g.elapsed + 1000 } : x)));
    if ((g.elapsed / 1000) % 5 === 0) this.save();
  }

  private update(g: Game): void {
    this.setGame(this.level(), g);
  }

  private setGame(level: number, g: Game): void {
    this.games.update((all) => all.map((x, i) => (i === level - 1 ? g : x)));
    this.save();
  }

  private save(): void {
    const data: Saved = {
      v: 1,
      level: this.level(),
      games: this.games().map((g) => (g ? { ...g, board: encodeBoard(g.board) } : null)),
      ready: this.ready,
      settings: this.settings(),
      stats: this.stats(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Хранилище недоступно или переполнено — играем без сохранения.
    }
  }

  private load(): void {
    let data: Saved | null = null;
    try {
      data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    } catch {
      data = null;
    }
    if (!data || data.v !== 1) return;
    this.level.set(clampLevel(data.level));
    this.games.set(fit(data.games, null).map((g) => (g ? { ...g, board: decodeBoard(g.board) } : null)));
    this.ready = fit(data.ready, null);
    this.settings.set({ ...this.settings(), ...data.settings });
    this.stats.set(fit(data.stats, { solved: 0, best: null, hints: 0 }));
  }
}

function fit<T>(arr: readonly T[] | undefined, fill: T): T[] {
  return Array.from({ length: LEVEL_COUNT }, (_, i) => arr?.[i] ?? fill);
}

function clampLevel(level: number): number {
  return Math.min(LEVEL_COUNT, Math.max(1, Math.round(level) || 1));
}

function defaultLang(): Lang {
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}
