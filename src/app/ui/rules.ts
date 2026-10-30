import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { LEVELS } from '../game/levels';
import { Clue as ClueModel, ClueKind, RowSet } from '../game/model';
import { GameStore, Lang } from '../state/game.store';
import { Clue } from './clue';
import { TEXTS, formatTime } from './i18n';
import { Icon } from './icon';

const DEMO_SETS: RowSet[] = [
  { kind: 'emoji', symbols: ['🥒'] },
  { kind: 'emoji', symbols: ['🏠'] },
  { kind: 'emoji', symbols: ['🐱'] },
];
const CUCUMBER = { row: 0, item: 0 };
const HOUSE = { row: 1, item: 0 };
const CAT = { row: 2, item: 0 };

const DEMO_CLUES: ClueModel[] = [
  { kind: 'same', items: [CUCUMBER, HOUSE] },
  { kind: 'notSame', items: [CUCUMBER, HOUSE] },
  { kind: 'next', items: [CUCUMBER, HOUSE] },
  { kind: 'before', items: [CUCUMBER, HOUSE] },
  { kind: 'adjacent', items: [CUCUMBER, HOUSE] },
  { kind: 'notAdjacent', items: [CUCUMBER, HOUSE] },
  { kind: 'sequence', items: [CUCUMBER, CAT, HOUSE] },
  { kind: 'between', items: [CUCUMBER, CAT, HOUSE] },
  { kind: 'notBetween', items: [CUCUMBER, CAT, HOUSE] },
];

@Component({
  selector: 'app-rules',
  imports: [Clue, Icon],
  templateUrl: './rules.html',
  styleUrl: './rules.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rules {
  protected readonly store = inject(GameStore);
  protected readonly t = computed(() => TEXTS[this.store.settings().lang]);
  protected readonly demoSets = DEMO_SETS;
  protected readonly demoClues = DEMO_CLUES;
  protected readonly levels = LEVELS;
  protected readonly langs: Lang[] = ['ru', 'en'];
  protected readonly formatTime = formatTime;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  open(): void {
    this.dialog().nativeElement.showModal();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected text(kind: ClueKind): string {
    return this.t().clueText[kind];
  }

  protected backdrop(e: MouseEvent): void {
    if (e.target === this.dialog().nativeElement) this.close();
  }
}
