import { Injectable } from '@angular/core';
import { Puzzle } from '../game/model';
import { Step } from '../game/solver';
import { EngineRequest, EngineResponse, handleRequest } from '../game/worker-api';

type Payload = EngineRequest extends infer R ? (R extends EngineRequest ? Omit<R, 'id'> : never) : never;

/**
 * Тяжёлые вычисления в фоне. Генерация и подсказки — в разных потоках,
 * чтобы подсказка не ждала, пока готовится следующая головоломка.
 */
@Injectable({ providedIn: 'root' })
export class EngineService {
  private readonly generator = new EngineWorker();
  private readonly helper = new EngineWorker();

  generate(level: number, seed: number): Promise<Puzzle> {
    return this.generator.call({ type: 'generate', level, seed }) as Promise<Puzzle>;
  }

  step(p: Puzzle, board: readonly number[]): Promise<Step | null> {
    return this.helper.call({ type: 'step', rows: p.rows, cols: p.cols, clues: p.clues, board }) as Promise<Step | null>;
  }
}

class EngineWorker {
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, (r: EngineResponse['result']) => void>();

  constructor() {
    if (typeof Worker === 'undefined') return;
    this.worker = new Worker(new URL('../game/game.worker', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }: MessageEvent<EngineResponse>) => {
      this.pending.get(data.id)?.(data.result);
      this.pending.delete(data.id);
    };
  }

  call(payload: Payload): Promise<EngineResponse['result']> {
    const req = { ...payload, id: this.nextId++ } as EngineRequest;
    if (!this.worker) return Promise.resolve(handleRequest(req).result);
    return new Promise((resolve) => {
      this.pending.set(req.id, resolve);
      this.worker!.postMessage(req);
    });
  }
}
