import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Clue as ClueModel, RowSet, VERTICAL_KINDS } from '../game/model';
import { Icon } from './icon';
import { Sym } from './sym';

/** Одна подсказка. Без стрелки — рядом, со стрелкой — где-то дальше. */
@Component({
  selector: 'app-clue',
  imports: [Icon, Sym],
  template: `
    @for (x of parts(); track $index) {
      @if (x.type === 'sym') {
        <app-sym [set]="x.set" [item]="x.item" [row]="x.row" [class.crossed]="x.crossed" />
      } @else {
        <app-icon class="op" [class.cross]="x.icon === 'cross'" [name]="x.icon" />
      }
    }
  `,
  styleUrl: './clue.scss',
  host: {
    class: 'clue',
    '[class.vertical]': 'vertical()',
    '[class.joined]': 'joined()',
    '[class.marked]': 'marked()',
    '[class.active]': 'active()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Clue {
  readonly clue = input.required<ClueModel>();
  readonly sets = input.required<readonly RowSet[]>();
  readonly marked = input(false);
  readonly active = input(false);

  protected readonly vertical = computed(() => VERTICAL_KINDS.has(this.clue().kind));
  protected readonly joined = computed(() => ['same', 'next', 'sequence'].includes(this.clue().kind));

  protected readonly parts = computed<Part[]>(() => {
    const items = this.clue().items;
    const sym = (i: number, crossed = false): Part => ({
      type: 'sym',
      set: this.sets()[items[i].row],
      item: items[i].item,
      row: items[i].row,
      crossed,
    });
    const op = (icon: string): Part => ({ type: 'op', icon });
    switch (this.clue().kind) {
      case 'same':
      case 'next':
        return [sym(0), sym(1)];
      case 'sequence':
        return [sym(0), sym(1), sym(2)];
      case 'notSame':
        return [sym(0), op('cross'), sym(1)];
      case 'before':
        return [sym(0), op('right'), sym(1)];
      case 'adjacent':
        return [sym(0), op('both'), sym(1)];
      case 'notAdjacent':
        return [sym(0), op('notBoth'), sym(1)];
      case 'between':
        return [sym(0), op('right'), sym(1), op('right'), sym(2)];
      case 'notBetween':
        return [sym(0), sym(1, true), sym(2)];
    }
  });
}

type Part =
  | { type: 'sym'; set: RowSet; item: number; row: number; crossed: boolean }
  | { type: 'op'; icon: string };
