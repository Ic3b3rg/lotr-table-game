import { parentPort, workerData } from 'node:worker_threads';
import { GenerationJobSchema } from '../shared/generated-map';
import { parseGeneratorPack } from './pack';
import { digest } from './hash';
import { runGenerationAttempt } from './pipeline';
import { verifyPendingReplay } from './replay';
const job = GenerationJobSchema.parse(workerData.job),
  pack = parseGeneratorPack(workerData.pack);
if (digest(pack) !== job.packFingerprint || digest(job.context) !== job.contextFingerprint)
  throw new Error('Input worker incoerente.');
if(workerData.verifyPending!==false) verifyPendingReplay(pack,job);
parentPort!.postMessage(runGenerationAttempt(pack, job.context, job));
