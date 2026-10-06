import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-600.css';
import '@fontsource/outfit/latin-700.css';
import '@fontsource/outfit/latin-800.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-600.css';
import './style.css';
import { mountGame } from './runner';
import { WORLDS } from './games/adventure-worlds';
import type { PreviewPiece } from './games/mini-track';
import { christmasEnabled } from './games/christmas-season';

const query=new URLSearchParams(location.search),christmas=christmasEnabled();
const world=WORLDS.find(w=>w.id===query.get('world')&&(christmas||w.start<4200))?.id;
const courses=[['','Full ride'],['loop','Loop test'],['noninvertingloop','Twisting loop'],['corkscrew','Corkscrew test'],['tunnel','Tunnel test']];
const piece=courses.find(([id])=>id===query.get('piece'))?.[0] as PreviewPiece|undefined;
const home='./'+(query.get('christmas')==='1'?'?christmas=1':'');
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<div class="tiny-utility container"><a href="${home}"><img class="tower-demo-logo" src="./images/keep-it-going-logo.png" alt="Keep it going"></a><select class="camera-course-picker" aria-label="Camera test course">${courses.map(([id,label])=>`<option value="${id}" ${id===(piece??'')?'selected':''}>${label}</option>`).join('')}</select><button class="tower-retry">Ride again ↻</button></div><main id="main-content" class="container"></main>`;
const root=app.querySelector<HTMLElement>('main')!;
let destroy:(()=>void)|undefined;
function start(){
  destroy?.();destroy=mountGame(root,'easy',start,{remixMode:true,firstPersonDemo:true,previewPiece:piece||undefined,seed:42,startWorld:world,christmas:christmasEnabled(),tables:[2,3,4,5,6,7,8,9,10,11,12],menu:()=>location.assign(home)});
}
app.querySelector('select')!.addEventListener('change',event=>{const url=new URL(location.href),piece=(event.target as HTMLSelectElement).value;if(piece)url.searchParams.set('piece',piece);else url.searchParams.delete('piece');location.assign(url.href);});
app.querySelector('button')!.addEventListener('click',start);start();
window.addEventListener('pagehide',()=>destroy?.(),{once:true});
