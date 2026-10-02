import '@fontsource/outfit/latin-700.css';
import '@fontsource/outfit/latin-800.css';
import './style.css';
import { StrengthTower } from './games/strength-tower';
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML='<main class="tower-demo"><header><img src="./images/keep-it-going-logo.png" alt="Keep it going"><a href="./">Back to game</a><button id="retry">Try again ↻</button></header><div class="game-stage"></div><div class="tower-demo-panel"><h2 id="question"></h2><input id="answer" inputmode="numeric" autocomplete="off" aria-label="Answer"><strong id="solved">0 answers</strong></div><p class="tower-demo-note">Tower playground · Answer to climb higher. On the way down, answers save an exit boost.</p></main>';
const stage=app.querySelector<HTMLElement>('.game-stage')!,input=app.querySelector<HTMLInputElement>('#answer')!;
let tower=new StrengthTower(stage),a=0,b=0,solved=0,acceptTimer:ReturnType<typeof setTimeout>|undefined;
function question(){a=2+Math.floor(Math.random()*8);b=2+Math.floor(Math.random()*8);app.querySelector('#question')!.textContent=`${a} × ${b} =`;input.value='';input.style.borderColor='';}
question();
input.addEventListener('input',()=>{if(Number(input.value)!==a*b||!input.value)return;tower.motion.answer();solved++;app.querySelector('#solved')!.textContent=`${solved} answers`;input.style.borderColor='#46bd90';input.disabled=true;acceptTimer=setTimeout(()=>{question();input.disabled=false;input.focus({preventScroll:true});},220);});
app.querySelector('#retry')!.addEventListener('click',()=>{clearTimeout(acceptTimer);tower.destroy();tower=new StrengthTower(stage);solved=0;input.disabled=false;app.querySelector('#solved')!.textContent='0 answers';question();input.focus({preventScroll:true});});
input.addEventListener('keydown',e=>{if(e.key==='Escape')input.value='';});
let last=performance.now();function frame(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;if(!document.hidden)tower.update(dt);requestAnimationFrame(frame);}requestAnimationFrame(frame);
if(matchMedia('(pointer:fine)').matches)input.focus();
window.addEventListener('pagehide',()=>tower.destroy(),{once:true});
