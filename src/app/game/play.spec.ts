import { autoFill, decodeBoard, encodeBoard, selectCandidate, toggleCandidate } from './play';

describe('play', () => {
  it('toggles a candidate but never empties a cell', () => {
    const b = [0b11, 0b11];
    expect(toggleCandidate(b, 2, 0, 0, 0)).toEqual([0b10, 0b11]);
    expect(toggleCandidate([0b10, 0b11], 2, 0, 0, 0)).toEqual([0b11, 0b11]);
    expect(toggleCandidate([0b10, 0b11], 2, 0, 0, 1)).toBeNull();
  });

  it('selects a candidate', () => {
    expect(selectCandidate([0b111, 0b111, 0b111], 3, 0, 1, 2)).toEqual([0b111, 0b100, 0b111]);
  });

  it('auto-fills singles within a row', () => {
    const b = [0b001, 0b111, 0b110];
    autoFill(b, 1, 3);
    // 0 выбран в столбце 0; 1 и 2 остаются в столбцах 1 и 2
    expect(b).toEqual([0b001, 0b110, 0b110]);
    const h = [0b011, 0b111, 0b011];
    autoFill(h, 1, 3);
    // предмет 2 возможен только в столбце 1
    expect(h).toEqual([0b011, 0b100, 0b011]);
  });

  it('round-trips board encoding', () => {
    const b = [0, 1, 0xff, 0x80];
    expect(decodeBoard(encodeBoard(b))).toEqual(b);
  });
});
