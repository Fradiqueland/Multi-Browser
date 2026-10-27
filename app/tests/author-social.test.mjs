import test from 'node:test';
import assert from 'node:assert/strict';
import {AUTHOR_SOCIAL_LINKS,authorSocialURL} from '../src/author-social.mjs';
import {mountSocialLinks} from '../ui/social-links.mjs';

test('Author social destinations preserve the nine requested URLs exactly',()=>{
 assert.deepEqual(AUTHOR_SOCIAL_LINKS.map(link=>[link.name,link.url]),[
  ['Instagram','https://antoniofradique.net/instagram'],['Facebook','https://antoniofradique.net/facebook'],
  ['X','https://antoniofradique.net/twitterx'],['TikTok','https://antoniofradique.net/TikTok'],
  ['Pinterest','https://antoniofradique.net/pinterest'],['LinkedIn','https://antoniofradique.net/linkedin'],
  ['Spotify','https://antoniofradique.net/Spotify'],['WhatsApp','https://antoniofradique.net/whatsapp'],
  ['Telegram','https://antoniofradique.net/telegram'],
 ]);
 for(const link of AUTHOR_SOCIAL_LINKS)assert.equal(authorSocialURL(link.id),link.url);
 for(const id of ['https://example.org','javascript:alert(1)','__proto__','constructor','Instagram',null,undefined,{},1])assert.throws(()=>authorSocialURL(id),/Unknown social network/);
 assert.ok(Object.isFrozen(AUTHOR_SOCIAL_LINKS)&&AUTHOR_SOCIAL_LINKS.every(Object.isFrozen));
});

test('Every menu icon is accessible and activates only its fixed identifier',()=>{
 const activated=[];
 const document={createElement:tag=>element(tag),createElementNS:(_namespace,tag)=>element(tag)};
 function element(tag){return {tag,ownerDocument:document,children:[],dataset:{},attributes:{},events:{},append(child){this.children.push(child)},setAttribute(name,value){this.attributes[name]=value},addEventListener(name,callback){this.events[name]=callback}};}
 const root=element('div');mountSocialLinks(root,id=>activated.push(id));
 assert.equal(root.children.length,9);
 for(const [index,anchor] of root.children.entries()){
  const link=AUTHOR_SOCIAL_LINKS[index];assert.equal(anchor.href,link.url);assert.equal(anchor.attributes['aria-label'],link.name);assert.equal(anchor.title,link.name);
  assert.equal(anchor.target,'_blank');assert.equal(anchor.rel,'noopener noreferrer');assert.equal(anchor.children[0].tag,'svg');assert.ok(anchor.children[0].children.length>0);
  let cancelled=false;anchor.events.click({type:'click',preventDefault(){cancelled=true}});assert.ok(cancelled);assert.equal(activated.at(-1),link.id);
  const before=activated.length;anchor.events.auxclick({type:'auxclick',button:2});assert.equal(activated.length,before);
  anchor.events.auxclick({type:'auxclick',button:1,preventDefault(){}});assert.equal(activated.at(-1),link.id);
 }
 assert.equal(activated.length,18);
});
