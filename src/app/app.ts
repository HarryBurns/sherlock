import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { LEVELS } from './game/levels';
import { VERTICAL_KINDS } from './game/model';
import { GameStore } from './state/game.store';
import { Board, CellAction } from './ui/board';
import { Clue } from './ui/clue';
import { TEXTS, formatTime } from './ui/i18n';
import { Icon } from './ui/icon';
import { Rules } from './ui/rules';

const CONFIRM_MS = 2500;

@Component({
  selector: 'app-root',
  imports: [Board, Clue, Icon, Rules],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    '(document:keydown)': 'keydown($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly store = inject(GameStore);
  protected readonly t = computed(() => TEXTS[this.store.settings().lang]);
  protected readonly levels = LEVELS.map((_, i) => i + 1);
  protected readonly game = this.store.game;
  protected readonly time = computed(() => formatTime(this.game()?.elapsed ?? 0));
  protected readonly formatTime = formatTime;

  protected readonly clueGroups = computed(() => {
    const clues = this.game()?.puzzle.clues ?? [];
    const all = clues.map((clue, index) => ({ clue, index }));
    return {
      horizontal: all.filter((c) => !VERTICAL_KINDS.has(c.clue.kind)),
      vertical: all.filter((c) => VERTICAL_KINDS.has(c.clue.kind)),
    };
  });

  protected readonly activeClues = computed(() => {
    const h = this.store.hint();
    return new Set(h?.kind === 'step' ? h.clues : []);
  });

  /** Новая игра сбрасывает партию, поэтому требует второго нажатия. */
  protected readonly confirming = signal(false);
  private confirmTimer = 0;

  private readonly rules = viewChild.required(Rules);

  protected toggle(a: CellAction): void {
    this.store.toggle(a.row, a.col, a.item);
  }

  protected select(a: CellAction): void {
    this.store.select(a.row, a.col, a.item);
  }

  protected newGame(): void {
    const g = this.game();
    const untouched = !g || g.won || (!g.history.length && !g.future.length);
    if (untouched || this.confirming()) {
      this.confirming.set(false);
      clearTimeout(this.confirmTimer);
      void this.store.newGame();
      return;
    }
    this.confirming.set(true);
    this.confirmTimer = window.setTimeout(() => this.confirming.set(false), CONFIRM_MS);
  }

  protected openRules(): void {
    this.rules().open();
  }

  protected keydown(e: KeyboardEvent): void {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.store.undo();
    } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
      e.preventDefault();
      this.store.redo();
    }
  }
}
