import test from 'node:test';
import assert from 'node:assert/strict';
import {ProfileTasks} from '../src/profile-tasks.mjs';
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('Reserva e imediata, impede sobreposicao e permite perfis independentes',async()=>{
 const tasks=new ProfileTasks(),hold=gate();const first=tasks.run(['a','b'],()=>hold.promise);assert.equal(tasks.has('a'),true);assert.throws(()=>tasks.run(['b','c'],async()=>{}));assert.equal(tasks.has('c'),false);await tasks.run(['c'],async()=>{});hold.resolve();await first;assert.equal(tasks.entries.size,0);
});
test('Apenas o contexto proprietario pode continuar a operacao reservada',async()=>{
 const tasks=new ProfileTasks(),hold=gate();let entered;const ready=new Promise(r=>entered=r);const job=tasks.run(['a'],async()=>{tasks.assertAvailable('a');await Promise.resolve();tasks.assertAvailable('a');entered();await hold.promise;});await ready;assert.throws(()=>tasks.assertAvailable('a'));assert.throws(()=>tasks.assertIdle('a'));hold.resolve();await job;tasks.assertAvailable('a');
});
test('Falhas sincronas e assincronas libertam todas as reservas',async()=>{
 const tasks=new ProfileTasks();for(const operation of [()=>{throw Error('sync');},async()=>{throw Error('async');}]){await assert.rejects(tasks.run(['a','b'],operation));assert.equal(tasks.entries.size,0);assert.equal(tasks.jobs.size,0);}await tasks.run(['a'],async()=>{});
});
test('Encerramento aguarda sucesso e falha de todas as operacoes pendentes',async()=>{
 const tasks=new ProfileTasks(),a=gate(),b=gate();const first=tasks.run(['a'],()=>a.promise),second=tasks.run(['b'],async()=>{await b.promise;throw Error('fixture');});const rejection=second.catch(()=>{});let settled=false;const all=tasks.settle().then(results=>{settled=true;return results;});a.resolve();await first;assert.equal(settled,false);b.resolve();await rejection;const results=await all;assert.deepEqual(results.map(r=>r.status),['fulfilled','rejected']);assert.equal(tasks.entries.size,0);
});
