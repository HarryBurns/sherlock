import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RowSet } from '../game/model';

/** Оттенки строк: помогают связать символ в подсказке со строкой поля. */
export const ROW_HUES = [205, 30, 145, 275, 350, 55, 180, 315];

export function rowHue(row: number): number {
  return ROW_HUES[row % ROW_HUES.length];
}

@Component({
  selector: 'app-sym',
  template: `{{ symbol() }}`,
  host: {
    class: 'sym',
    '[class.letter]': "set().kind === 'letter'",
    '[style.--hue]': 'hue()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sym {
  readonly set = input.required<RowSet>();
  readonly item = input.required<number>();
  readonly row = input.required<number>();

  protected readonly symbol = computed(() => this.set().symbols[this.item()]);
  protected readonly hue = computed(() => rowHue(this.row()));
}
