import { Board } from './board';
import { generate } from './generator';
import { Clue, Puzzle } from './model';
import { Solver, Step, Tech } from './solver';

export type EngineRequest =
  | { readonly id: number; readonly type: 'generate'; readonly level: number; readonly seed: number }
  | {
      readonly id: number;
      readonly type: 'step';
      readonly rows: number;
      readonly cols: number;
      readonly clues: readonly Clue[];
      readonly board: readonly number[];
    };

export interface EngineResponse {
  readonly id: number;
  readonly result: Puzzle | Step | null;
}

export function handleRequest(req: EngineRequest): EngineResponse {
  switch (req.type) {
    case 'generate':
      return { id: req.id, result: generate(req.level, req.seed) };
    case 'step': {
      const board: Board = Uint8Array.from(req.board);
      return { id: req.id, result: new Solver(req.rows, req.cols, req.clues).step(board, Tech.Contradiction) };
    }
  }
}
