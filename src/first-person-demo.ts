import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-600.css';
import '@fontsource/outfit/latin-700.css';
import '@fontsource/outfit/latin-800.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-600.css';
import './style.css';
import { mountGame } from './runner';
import { WORLDS } from './games/adventure-worlds';
import { christmasEnabled } from './games/christmas-season';

const query=new URLSearchParams(location.search),christmas=christmasEnabled();
const world=WORLDS.find(w=>w.id===query.get('world')&&(christmas||w.start<4200))?.id;
const home='./'+(query.get('christmas')==='1'?'?christmas=1':'');
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<div class="tiny-utility container"><a href="${home}"><img class="tower-demo-logo" src="./images/keep-it-going-logo.png" alt="Keep it going"></a><span class="front-seat-label">Train chase · 20 seconds</span><button class="tower-retry">Ride again ↻</button></div><main id="main-content" class="container"></main>`;
const root=app.querySelector<HTMLElement>('main')!;
let destroy:(()=>void)|undefined;
function start(){
  destroy?.();destroy=mountGame(root,'easy',start,{remixMode:true,firstPersonDemo:true,seed:42,startWorld:world,christmas:christmasEnabled(),tables:[2,3,4,5,6,7,8,9,10,11,12],menu:()=>location.assign(home)});
}
app.querySelector('button')!.addEventListener('click',start);start();
window.addEventListener('pagehide',()=>destroy?.(),{once:true});
