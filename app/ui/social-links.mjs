import {AUTHOR_SOCIAL_LINKS} from '../src/author-social.mjs';

const icons={
 instagram:[['rect',{x:3,y:3,width:18,height:18,rx:5}],['circle',{cx:12,cy:12,r:4}],['circle',{cx:17.5,cy:6.5,r:.8,fill:'currentColor',stroke:'none'}]],
 facebook:[['path',{d:'M14 22v-8h3l.5-3.5H14V8.2c0-1 .3-1.7 1.8-1.7h1.8V3.3c-.6-.1-1.7-.3-2.8-.3-2.9 0-4.8 1.7-4.8 4.9v2.6H7V14h3v8Z',fill:'currentColor',stroke:'none'}]],
 x:[['path',{d:'M18.9 2H22l-6.8 7.8L23 22h-6.3L12 14.5 5.5 22H2.4l7.3-8.5L1.6 2h6.5l4.5 6.8L18.9 2Zm-1.1 18h1.7L7.1 3.9H5.3Z',fill:'currentColor',stroke:'none'}]],
 tiktok:[['path',{d:'M15.5 3v12.5a5 5 0 1 1-4.5-5v3a2.1 2.1 0 1 0 1.5 2V3Zm0 0c.5 3.1 2.1 4.5 5 4.5v3c-1.9 0-3.5-.6-5-1.7',fill:'currentColor',stroke:'currentColor',strokeWidth:.6}]],
 pinterest:[['circle',{cx:12,cy:12,r:9.5}],['path',{d:'m8 21 2.6-11m-.9 5.2c1.2 1.5 4.4 1.2 5.6-.7 1.5-2.2 1.8-6.8-1.7-7.5-4.7-.9-7 5.4-3.7 6.5'}]],
 linkedin:[['circle',{cx:4.5,cy:4.5,r:1.5,fill:'currentColor',stroke:'none'}],['path',{d:'M3 9h3v12H3Zm6 0h3v1.7c.8-1.4 2-2 3.5-2 3.3 0 4.5 2.1 4.5 5.4V21h-3v-6.2c0-2.2-.6-3.2-2.1-3.2-1.7 0-2.9 1.2-2.9 3.6V21H9Z',fill:'currentColor',stroke:'none'}]],
 spotify:[['circle',{cx:12,cy:12,r:10}],['path',{d:'M6 8.3c4-1.2 8.6-.8 12 1M6.8 12c3.5-1 7.1-.6 10.2.8M7.7 15.5c2.7-.6 5.3-.3 7.8.8'}]],
 whatsapp:[['path',{d:'M20.7 7.1a9.2 9.2 0 0 0-17 7.5L2.4 22l7-1.8a9.2 9.2 0 0 0 11.3-13.1Z'}],['path',{d:'m8 7 2 3-1.2 1.2c.8 1.8 2.1 3.1 4 4l1.2-1.3 3 1.8c-.1 1.8-1.6 2.6-3.2 2-4.3-1.2-7.4-4.4-8-7.3C5.4 8.9 6.3 7.5 8 7Z',fill:'currentColor',stroke:'none'}]],
 telegram:[['path',{d:'m2 10 19-7-4 18-6-5-4 3 1-6Zm6 3L18 6m-7 10 7-10'}]],
};

export function mountSocialLinks(container,open){
 const document=container.ownerDocument;
 for(const link of AUTHOR_SOCIAL_LINKS){
  const anchor=document.createElement('a');
  anchor.href=link.url;anchor.target='_blank';anchor.rel='noopener noreferrer';
  anchor.dataset.social=link.id;anchor.title=link.name;
  anchor.setAttribute('aria-label',link.name);anchor.setAttribute('data-no-translate','');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [name,value] of Object.entries({viewBox:'0 0 24 24',width:24,height:24,fill:'none',stroke:'currentColor','stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(name,String(value));
  for(const [tag,attributes] of icons[link.id]){
   const shape=document.createElementNS('http://www.w3.org/2000/svg',tag);
   for(const [key,value] of Object.entries(attributes))shape.setAttribute(key==='strokeWidth'?'stroke-width':key,String(value));
   svg.append(shape);
  }
  anchor.append(svg);
  const activate=event=>{if(event.type==='auxclick'&&event.button!==1)return;event.preventDefault();open(link.id);};
  anchor.addEventListener('click',activate);anchor.addEventListener('auxclick',activate);
  container.append(anchor);
 }
}
