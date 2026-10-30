/// <reference lib="webworker" />

import { EngineRequest, handleRequest } from './worker-api';

addEventListener('message', ({ data }: MessageEvent<EngineRequest>) => {
  postMessage(handleRequest(data));
});
