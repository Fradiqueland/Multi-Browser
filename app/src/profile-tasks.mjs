import {AsyncLocalStorage} from 'node:async_hooks';
export class ProfileTasks{
 constructor(changed=()=>{}){this.entries=new Map();this.context=new AsyncLocalStorage();this.changed=changed;this.jobs=new Set();}
 has(id){return this.entries.has(id);}
 assertAvailable(id){const owner=this.entries.get(id);if(owner&&owner!==this.context.getStore())throw Error('Aguarde que a operação deste perfil termine.');}
 assertIdle(id){if(this.has(id))throw Error('Aguarde que a operação deste perfil termine.');}
 run(ids,operation){
  const unique=[...new Set(ids)];for(const id of unique)this.assertIdle(id);
  const token={};for(const id of unique)this.entries.set(id,token);
  const job=Promise.resolve().then(()=>this.context.run(token,operation)).finally(()=>{for(const id of unique)if(this.entries.get(id)===token)this.entries.delete(id);this.jobs.delete(job);this.changed();});
  this.jobs.add(job);this.changed();return job;
 }
 settle(){return Promise.allSettled([...this.jobs]);}
}
