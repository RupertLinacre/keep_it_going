import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-600.css';
import '@fontsource/outfit/latin-700.css';
import '@fontsource/outfit/latin-800.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-600.css';
import './style.css';
import { mountGame } from './runner';
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML='<div class="tiny-utility container"><a href="./"><img class="tower-demo-logo" src="./images/keep-it-going-logo.png" alt="Keep it going"></a><button class="tower-retry">Try the tower again ↻</button></div><main id="main-content" class="container"></main>';
const root=app.querySelector<HTMLElement>('main')!;
let destroy:(()=>void)|undefined;
function start(){destroy?.();destroy=mountGame(root,'easy',start,{remixMode:true,towerDemo:true,seed:42,tables:[2,3,4,5,6,7,8,9,10,11,12],menu:()=>location.assign('./')});}
app.querySelector('button')!.addEventListener('click',start);start();
window.addEventListener('pagehide',()=>destroy?.(),{once:true});
