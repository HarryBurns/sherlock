import { ClueKind } from '../game/model';
import { Lang } from '../state/game.store';

export interface Texts {
  readonly rules: string;
  readonly goal: string;
  readonly controls: string;
  readonly controlItems: readonly string[];
  readonly clues: string;
  readonly clueText: Readonly<Record<ClueKind, string>>;
  readonly cluesNote: string;
  readonly settings: string;
  readonly auto: string;
  readonly autoNote: string;
  readonly stats: string;
  readonly level: string;
  readonly solved: string;
  readonly best: string;
  readonly hints: string;
  readonly undo: string;
  readonly redo: string;
  readonly hint: string;
  readonly newGame: string;
  readonly pause: string;
  readonly next: string;
  readonly close: string;
}

export const TEXTS: Readonly<Record<Lang, Texts>> = {
  ru: {
    rules: 'Правила',
    goal:
      'В каждой строке поля — свой набор предметов, и каждый предмет стоит ровно в одном столбце. ' +
      'В клетке показаны все предметы, которые там ещё возможны. Пользуясь подсказками, оставьте в каждой клетке один — правильный.',
    controls: 'Управление',
    controlItems: [
      'Тап или клик по предмету — убрать его из клетки. Ещё один тап — вернуть.',
      'Долгое нажатие или правый клик — выбрать предмет ответом клетки.',
      'Тап по подсказке — отметить её как использованную.',
      '💡 — показать ошибку или следующий логический шаг. Повторное нажатие применяет шаг.',
      'Ошибки не подсвечиваются, пока не попросите 💡.',
    ],
    clues: 'Подсказки',
    clueText: {
      same: '🥒 и 🏠 в одном столбце',
      notSame: '🥒 и 🏠 в разных столбцах',
      next: '🏠 сразу справа от 🥒',
      before: '🏠 где-то правее 🥒',
      adjacent: '🥒 и 🏠 в соседних столбцах',
      notAdjacent: '🥒 и 🏠 не в соседних столбцах',
      sequence: 'три соседних столбца ровно в этом порядке',
      between: '🥒 левее 🐱, 🐱 левее 🏠 — не обязательно рядом',
      notBetween: '🐱 не стоит между 🥒 и 🏠',
    },
    cluesNote: 'Без стрелки — рядом, со стрелкой — где-то дальше. «Справа» — к правому краю поля.',
    settings: 'Настройки',
    auto: 'Автозаполнение',
    autoNote: 'Выбранный предмет убирается из остальных клеток строки; единственное место предмета выбирается само.',
    stats: 'Статистика',
    level: 'Уровень',
    solved: 'Решено',
    best: 'Лучшее время',
    hints: 'Подсказок 💡',
    undo: 'Отменить',
    redo: 'Повторить',
    hint: 'Подсказка',
    newGame: 'Новая игра',
    pause: 'Пауза',
    next: 'Дальше',
    close: 'Закрыть',
  },
  en: {
    rules: 'Rules',
    goal:
      'Each row of the board holds its own set of items, and every item sits in exactly one column. ' +
      'A cell shows every item still possible there. Use the clues to leave a single, correct item in each cell.',
    controls: 'Controls',
    controlItems: [
      'Tap or click an item to remove it from the cell. Tap again to bring it back.',
      'Long press or right click to choose an item as the cell’s answer.',
      'Tap a clue to mark it as used.',
      '💡 shows a mistake or the next logical step. Press again to apply the step.',
      'Mistakes stay hidden until you ask for 💡.',
    ],
    clues: 'Clues',
    clueText: {
      same: '🥒 and 🏠 are in the same column',
      notSame: '🥒 and 🏠 are in different columns',
      next: '🏠 is right next to 🥒, on its right',
      before: '🏠 is somewhere to the right of 🥒',
      adjacent: '🥒 and 🏠 are in neighbouring columns',
      notAdjacent: '🥒 and 🏠 are not in neighbouring columns',
      sequence: 'three neighbouring columns in exactly this order',
      between: '🥒 is left of 🐱, 🐱 is left of 🏠 — not necessarily adjacent',
      notBetween: '🐱 is not between 🥒 and 🏠',
    },
    cluesNote: 'No arrow means adjacent, an arrow means somewhere further. “Right” is towards the right edge of the board.',
    settings: 'Settings',
    auto: 'Auto-fill',
    autoNote: 'A chosen item is removed from the rest of its row; an item with only one place left is chosen for you.',
    stats: 'Statistics',
    level: 'Level',
    solved: 'Solved',
    best: 'Best time',
    hints: '💡 used',
    undo: 'Undo',
    redo: 'Redo',
    hint: 'Hint',
    newGame: 'New game',
    pause: 'Pause',
    next: 'Next',
    close: 'Close',
  },
};

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
