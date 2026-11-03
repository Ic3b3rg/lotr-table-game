import { GenerationJobSchema } from '../shared/generated-map';
import { runGenerationAttempt } from './pipeline';
import { digest } from './hash';
import { invariant } from './validate';
import type { GeneratorPack } from './pack';

/** A persisted clean input is verified from genesis, never trusted as a checkpoint. */
export function verifyPendingReplay(pack:GeneratorPack,value:unknown):true {
  const job=GenerationJobSchema.parse(value);
  invariant(job.packFingerprint===digest(pack) && job.contextFingerprint===digest(job.context),'Pacchetto/contesto della ripresa incoerente.');
  invariant(job.attempt===job.attempts.length && job.seed===((job.requestedSeed+job.attempt)|0),'Confine ripresa incoerente.');
  let incoming=pack.template.selection.incoming;
  const attempts:typeof job.attempts=[];
  for(let index=0;index<job.attempt;index++) {
    const result=runGenerationAttempt(pack,job.context,{requestedSeed:job.requestedSeed,seed:(job.requestedSeed+index)|0,attempt:index,incoming,attempts});
    invariant(result.status==='failed'&&result.retry,'Replay del retry non fallito come registrato.');
    invariant(digest(result.record)===digest(job.attempts[index]),'Evidenza retry alterata.');
    incoming=result.incoming;attempts.push(result.record);
  }
  invariant(digest(incoming)===digest(job.incoming),'Input pulito della ripresa alterato.');
  return true;
}
