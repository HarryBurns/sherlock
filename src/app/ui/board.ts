import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Puzzle } from '../game/model';
import { singleItem } from '../game/play';
import { HintView } from '../state/game.store';
import { Sym, rowHue } from './sym';

export interface CellAction {
  readonly row: number;
  readonly col: number;
  readonly item: number;
}

const LONG_PRESS_MS = 420;
const MOVE_TOLERANCE_PX = 10;

@Component({
  selector: 'app-board',
  imports: [Sym],
  templateUrl: './board.html',
  styleUrl: './board.scss',
  host: {
    '[style.--cols]': 'puzzle().cols',
    '[style.--grid]': 'grid()',
    '(contextmenu)': '$event.preventDefault()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Board {
  readonly puzzle = input.required<Puzzle>();
  readonly board = input.required<readonly number[]>();
  readonly hint = input<HintView | null>(null);

  readonly toggle = output<CellAction>();
  readonly select = output<CellAction>();
  /** Снять выбор с решённой клетки. */
  readonly unselect = output<CellAction>();

  protected readonly rows = computed(() => range(this.puzzle().rows));
  protected readonly cols = computed(() => range(this.puzzle().cols));
  /** Сетка кандидатов внутри клетки: 2×2 для 4, 3×2 для 5–6, 3×3 для 8. */
  protected readonly grid = computed(() => (this.puzzle().cols <= 4 ? 2 : 3));

  protected readonly errors = computed(() => {
    const h = this.hint();
    return new Set(h?.kind === 'errors' ? h.cells : []);
  });

  protected readonly targets = computed(() => {
    const h = this.hint();
    const cols = this.puzzle().cols;
    return new Set(h?.kind === 'step' ? h.eliminations.map((e) => (e.row * cols + e.col) * 8 + e.item) : []);
  });

  protected readonly hue = rowHue;
  protected readonly single = singleItem;

  private press: {
    action: CellAction;
    solved: boolean;
    x: number;
    y: number;
    timer: number;
    done: boolean;
  } | null = null;

  protected has(mask: number, item: number): boolean {
    return (mask & (1 << item)) !== 0;
  }

  protected isTarget(row: number, col: number, item: number): boolean {
    return this.targets().has((row * this.puzzle().cols + col) * 8 + item);
  }

  /**
   * Правый клик или долгое нажатие выбирает кандидата, а на решённой клетке — снимает выбор.
   * Короткое нажатие убирает или возвращает кандидата; на решённой клетке ничего не делает.
   */
  protected down(e: PointerEvent, action: CellAction, solved = false): void {
    this.cancel();
    const long = () => (solved ? this.unselect : this.select).emit(action);
    if (e.button === 2) {
      long();
      return;
    }
    if (e.button !== 0) return;
    const timer = window.setTimeout(() => {
      if (!this.press) return;
      this.press.done = true;
      navigator.vibrate?.(15);
      long();
    }, LONG_PRESS_MS);
    this.press = { action, solved, x: e.clientX, y: e.clientY, timer, done: false };
  }

  protected move(e: PointerEvent): void {
    if (!this.press) return;
    if (Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > MOVE_TOLERANCE_PX) this.cancel();
  }

  protected up(): void {
    const p = this.press;
    if (!p) return;
    clearTimeout(p.timer);
    this.press = null;
    if (!p.done && !p.solved) this.toggle.emit(p.action);
  }

  protected cancel(): void {
    if (this.press) clearTimeout(this.press.timer);
    this.press = null;
  }
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}
