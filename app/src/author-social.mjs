export const AUTHOR_SOCIAL_LINKS=Object.freeze([
 {id:'instagram',name:'Instagram',url:'https://antoniofradique.net/instagram'},
 {id:'facebook',name:'Facebook',url:'https://antoniofradique.net/facebook'},
 {id:'x',name:'X',url:'https://antoniofradique.net/twitterx'},
 {id:'tiktok',name:'TikTok',url:'https://antoniofradique.net/TikTok'},
 {id:'pinterest',name:'Pinterest',url:'https://antoniofradique.net/pinterest'},
 {id:'linkedin',name:'LinkedIn',url:'https://antoniofradique.net/linkedin'},
 {id:'spotify',name:'Spotify',url:'https://antoniofradique.net/Spotify'},
 {id:'whatsapp',name:'WhatsApp',url:'https://antoniofradique.net/whatsapp'},
 {id:'telegram',name:'Telegram',url:'https://antoniofradique.net/telegram'},
].map(Object.freeze));

export function authorSocialURL(id){
 const link=AUTHOR_SOCIAL_LINKS.find(link=>link.id===id);
 if(!link)throw Error('Unknown social network.');
 return link.url;
}
