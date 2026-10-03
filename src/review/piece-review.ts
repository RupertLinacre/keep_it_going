import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-600.css';
import '@fontsource/outfit/latin-700.css';
import '@fontsource/dm-sans/latin-400.css';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PieceReviewScene, type ReviewVersion } from './piece-review-view';
import { PIECE_REVIEW, designFor } from './piece-review-data';
import type { DesignOption } from './variants/variant-kit';
import { WORLDS } from '../games/adventure-worlds';
import type { MiniKind } from '../games/mini-track';
import './piece-review.css';

const app=document.querySelector<HTMLDivElement>('#app')!;
const params=new URLSearchParams(location.search);
let index=Math.max(0,PIECE_REVIEW.findIndex(p=>p.kind===(params.get('piece')??'carouselhelix')));
let elapsed=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,cutaway=false,closeup=false;
let mode:'both'|'before'|'after'=innerWidth<760?'after':'both';
const options:DesignOption[]=['a','b','c'];
let option:DesignOption=options.includes(params.get('option') as DesignOption)?params.get('option') as DesignOption:'a';
let reference:ReviewVersion=['original',...options].includes(params.get('compare')??'')?params.get('compare') as ReviewVersion:'original';
const storageKey='keep-going-piece-choices-v2';
let choices:Record<string,string>={};try{
 choices=JSON.parse(localStorage.getItem(storageKey)??localStorage.getItem('keep-going-piece-choices-v1')??'{}');
 if(!choices||typeof choices!=='object'||Array.isArray(choices))choices={};
 for(const key of Object.keys(choices)){if(choices[key]==='after')choices[key]='a';if(choices[key]==='before')choices[key]='original';if(!['original',...options].includes(choices[key]))delete choices[key];}
}catch{}
app.innerHTML=`<header><a href="./index.html"><img src="./images/keep-it-going-logo.png" alt="Keep it going"></a><a class="quiet" href="./tracks.html">Track collection ↗</a></header>
<main><div class="intro"><div><p class="eyebrow">THE SPECIAL-PIECE WORKSHOP</p><h1>Three ways to play.</h1><p>Twelve rides. Thirty-six designs. Explore three different directions for every piece, then choose your favourites.</p></div><div class="branch-note">A is the first proposal.<br>B and C are new alternatives.<br>Your choices stay on this device.</div></div>
<section class="comparison" aria-label="Before and after comparison"><div class="heading"><div><p id="world" class="eyebrow"></p><h2 id="name"></h2></div><div class="arrows"><button id="previous" aria-label="Previous piece">←</button><span id="number"></span><button id="next" aria-label="Next piece">→</button></div></div><p id="idea"></p>
<div class="design-options" aria-label="Design options">${options.map(o=>`<button data-option="${o}"><span class="option-letter">${o.toUpperCase()}</span><span><strong></strong><small></small></span></button>`).join('')}</div>
<div class="toolbar"><div class="segmented" aria-label="Comparison view"><button data-mode="both">Side by side</button><button data-mode="before">Reference</button><button data-mode="after">Selected design</button></div><div class="compare-picker"><label for="reference">Compare with</label><select id="reference"><option value="original">Original game</option><option value="a">Option A</option><option value="b">Option B</option><option value="c">Option C</option></select><button id="close-up" aria-pressed="false">Closer look</button><button id="reset-view">Reset view</button><button id="cutaway" hidden>Inside tunnel</button></div></div>
<div id="stage"><div class="view-label before-label"><span></span><small></small></div><div class="view-label after-label"><span></span><small></small></div><div class="divider"></div><div class="orbit-hint">Drag to orbit · scroll to zoom</div></div>
<div class="playback"><button id="play">Pause</button><button id="replay">↻ Replay</button><input id="timeline" type="range" min="0" max="1000" value="0" aria-label="Preview timeline"><span id="phase">Train approaching</span></div>
<div class="decision"><span id="saved" role="status">Choose this piece’s version</span><div><button data-choice="original">Keep original</button><button id="choose-option">Choose A</button><button data-choice="">Decide later</button></div></div>
<details class="performance"><summary>Performance comparison</summary><p>Both views use the same train, track and camera. Only the selected pair is loaded. Alternatives remain in this workshop until you choose which ones to keep.</p><div id="metrics"></div></details></section>
<section class="collection"><div class="collection-heading"><h2>Explore all twelve</h2><button id="copy">Copy my choices</button></div><div class="world-tabs"><button data-world="all">All worlds</button>${WORLDS.map(w=>`<button data-world="${w.id}">${w.icon} ${w.name}</button>`).join('')}</div><div class="cards">${PIECE_REVIEW.map((p,i)=>{const world=WORLDS.find(w=>w.pieces.includes(p.kind))!;return `<button class="piece-card" data-piece="${p.kind}" data-world-kind="${world.id}"><span class="card-number">${String(i+1).padStart(2,'0')}</span><div><small>${world.icon} ${world.name}</small><strong>${p.title}</strong><span class="choice-badge"></span></div><span class="card-arrow">↗</span></button>`;}).join('')}</div><p id="copy-status" role="status"></p></section></main>`;
const $=<E extends HTMLElement=HTMLElement>(s:string)=>app.querySelector<E>(s)!;
const stage=$('#stage'),renderer=new T.WebGLRenderer({antialias:true});stage.append(renderer.domElement);
renderer.info.autoReset=false;
const camera=new T.OrthographicCamera(-40,40,30,-30,.1,4000);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minZoom=.35;controls.maxZoom=8;
let scenes:PieceReviewScene[]=[];
let bounds=new T.Box3(),duration=10,metrics:{calls:number;triangles:number}[]=[];
let renderSamples:number[]=[];
function fit(){
 if(!scenes.length)return;
 const focused=mode==='both'?scenes[0].attractionBounds.clone().union(scenes[1].attractionBounds):scenes[mode==='before'?0:1].attractionBounds.clone();
 const framing=closeup?focused.expandByScalar(2):bounds;
 const center=framing.getCenter(new T.Vector3()),size=framing.getSize(new T.Vector3());
 const facing=scenes[0].section.kind==='pumpkintunnel'?new T.Vector3(-1,.48,.8):new T.Vector3(-.45,.48,1);
 controls.target.copy(center);camera.position.copy(center).addScaledVector(facing.normalize(),size.length()+140);camera.up.set(0,1,0);camera.lookAt(center);camera.updateMatrixWorld();
 const projected=new T.Box3();for(const x of [framing.min.x,framing.max.x])for(const y of [framing.min.y,framing.max.y])for(const z of [framing.min.z,framing.max.z])projected.expandByPoint(new T.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
 const aspect=stage.clientWidth/(mode==='both'?2:1)/stage.clientHeight;
 const extent=Math.max((projected.max.y-projected.min.y)/2,(projected.max.x-projected.min.x)/2/aspect,8)*1.13;
 camera.left=-extent*aspect;camera.right=extent*aspect;camera.top=extent;camera.bottom=-extent;camera.zoom=1;camera.updateProjectionMatrix();controls.update();
}
function updateChoices(){
 app.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(b=>b.setAttribute('aria-pressed',String((choices[PIECE_REVIEW[index].kind]??'')===b.dataset.choice)));
 $('#choose-option').textContent=`Choose ${option.toUpperCase()}`;$('#choose-option').setAttribute('aria-pressed',String(choices[PIECE_REVIEW[index].kind]===option));
 app.querySelectorAll<HTMLButtonElement>('[data-piece]').forEach(b=>{const choice=choices[b.dataset.piece!];b.setAttribute('aria-pressed',String(b.dataset.piece===PIECE_REVIEW[index].kind));b.querySelector('.choice-badge')!.textContent=choice==='original'?'✓ Keep original':choice?`✓ Option ${choice.toUpperCase()}`:'3 designs · Not chosen yet';});
 const chosen=choices[PIECE_REVIEW[index].kind];$('#saved').textContent=chosen==='original'?'Saved: original game':chosen?`Saved: ${chosen.toUpperCase()} · ${designFor(PIECE_REVIEW[index].kind,chosen as DesignOption).name}`:'Choose this piece’s version';
}
function rebuild(keepTime=false){
 const previousTime=keepTime?elapsed:0;
 scenes.forEach(s=>s.destroy());scenes=[];renderer.renderLists.dispose();
 const piece=PIECE_REVIEW[index],world=WORLDS.find(w=>w.pieces.includes(piece.kind))!;
 for(const version of [reference,option])scenes.push(new PieceReviewScene(piece.kind,version,Number(params.get('km'))||0));
 bounds=scenes[0].bounds.clone().union(scenes[1].bounds);duration=(scenes[0].section.length+12)/24+8;elapsed=0;cutaway=false;metrics=[];
 $('#name').textContent=piece.title;$('#world').textContent=`${world.icon} ${world.name}`;$('#number').textContent=`${index+1} / ${PIECE_REVIEW.length}`;$('#idea').textContent=designFor(piece.kind,option).idea;$('#cutaway').hidden=piece.kind!=='tunnel';$('#cutaway').setAttribute('aria-pressed','false');
 app.querySelectorAll<HTMLButtonElement>('[data-option]').forEach(b=>{const o=b.dataset.option as DesignOption,d=designFor(piece.kind,o);b.querySelector('strong')!.textContent=d.name;b.querySelector('small')!.textContent=o==='a'?'First proposal':'New direction';b.setAttribute('aria-pressed',String(o===option));});
 $('.before-label span').textContent=reference==='original'?'ORIGINAL':`OPTION ${reference.toUpperCase()}`;
 $('.before-label small').textContent=reference==='original'?'Current game':designFor(piece.kind,reference).name;
 $('.after-label span').textContent=`OPTION ${option.toUpperCase()}`;$('.after-label small').textContent=designFor(piece.kind,option).name;
 $<HTMLSelectElement>('#reference').value=reference;
 updateChoices();fit();history.replaceState(null,'',`?piece=${piece.kind}&option=${option}&compare=${reference}${params.has('km')?'&km='+params.get('km'):''}`);
 elapsed=Math.min(previousTime,duration);replayTo(elapsed);
}
function showMode(next:typeof mode){mode=next;stage.dataset.mode=mode;app.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));fit();}
function draw(){
 const width=stage.clientWidth,height=stage.clientHeight;
 const section=scenes[0].section,d=section.start-12+elapsed*24;
 const active=mode==='both'?[0,1]:[mode==='before'?0:1];
 // Keep the hidden half in time too: changing views must not skip an impact
 // or lose the carousel's coasting speed.
 for(const scene of scenes)scene.update(elapsed,d,cutaway);
 renderer.setScissorTest(true);
 for(const i of active){
  const x=mode==='both'?i*width/2:0,w=mode==='both'?width/2:width;
  renderer.setViewport(x,0,w,height);renderer.setScissor(x,0,w,height);renderer.info.reset();renderer.render(scenes[i].scene,camera);
  metrics[i]={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
 }
 renderer.setScissorTest(false);
 $<HTMLInputElement>('#timeline').value=String(Math.min(1000,elapsed/duration*1000));
 $('#phase').textContent=d<section.start?'Train approaching':d<section.end?'Train passing':'Watch it keep moving…';
 $('#play').textContent=playing?'Pause':'Play';
 if(metrics[0]&&metrics[1])$('#metrics').textContent=`${reference==='original'?'Original':reference.toUpperCase()}: ${metrics[0].calls} draws · ${Math.round(metrics[0].triangles/1000)}k triangles. ${option.toUpperCase()}: ${metrics[1].calls} draws · ${Math.round(metrics[1].triangles/1000)}k triangles.`;
}
export function reviewState(){return {kind:PIECE_REVIEW[index].kind,option,reference,elapsed,duration,metrics,frames:renderSamples.slice(-180),memory:{...renderer.info.memory}};}
function replayTo(target:number){for(let t=0;t<target;t+=1/30)for(const scene of scenes)scene.update(t,scene.section.start-12+t*24,cutaway);}
export function reviewAt(time:number){
 playing=false;const target=Math.max(0,Math.min(duration,time));
 // Replay the small fixed actor buffers so a still after a gate also includes
 // its correctly aged burst and a carousel's accumulated coasting motion.
 replayTo(target);
 elapsed=target;draw();return reviewState();
}
export function reviewSelect(kind:MiniKind,design:DesignOption=option,compare:ReviewVersion=reference){const next=PIECE_REVIEW.findIndex(p=>p.kind===kind);if(next>=0){index=next;option=design;reference=compare;rebuild();draw();}return reviewState();}
export function reviewOption(design:DesignOption,compare:ReviewVersion=reference){option=design;reference=compare;rebuild(true);draw();return reviewState();}
app.querySelectorAll<HTMLButtonElement>('[data-piece]').forEach(b=>b.onclick=()=>{index=PIECE_REVIEW.findIndex(p=>p.kind===b.dataset.piece);rebuild();$('.comparison').scrollIntoView({behavior:'smooth',block:'start'});});
app.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.onclick=()=>showMode(b.dataset.mode as typeof mode));
function choose(choice:string){const kind=PIECE_REVIEW[index].kind;if(choice)choices[kind]=choice;else delete choices[kind];try{localStorage.setItem(storageKey,JSON.stringify(choices));}catch{}updateChoices();}
app.querySelectorAll<HTMLButtonElement>('[data-option]').forEach(b=>b.onclick=()=>reviewOption(b.dataset.option as DesignOption));
$<HTMLSelectElement>('#reference').onchange=e=>{reference=(e.target as HTMLSelectElement).value as ReviewVersion;rebuild(true);};
app.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(b=>b.onclick=()=>choose(b.dataset.choice!));
$('#choose-option').onclick=()=>choose(option);
app.querySelectorAll<HTMLButtonElement>('[data-world]').forEach(b=>b.onclick=()=>{app.querySelectorAll<HTMLButtonElement>('[data-world]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));app.querySelectorAll<HTMLButtonElement>('[data-world-kind]').forEach(c=>c.hidden=b.dataset.world!=='all'&&c.dataset.worldKind!==b.dataset.world);});
$('#previous').onclick=()=>{index=(index+11)%12;rebuild();};$('#next').onclick=()=>{index=(index+1)%12;rebuild();};
$('#close-up').onclick=()=>{closeup=!closeup;$('#close-up').setAttribute('aria-pressed',String(closeup));fit();};
$('#reset-view').onclick=()=>{closeup=false;$('#close-up').setAttribute('aria-pressed','false');fit();};$('#play').onclick=()=>playing=!playing;$('#replay').onclick=()=>{elapsed=0;playing=true;};
$('#cutaway').onclick=()=>{cutaway=!cutaway;$('#cutaway').setAttribute('aria-pressed',String(cutaway));};
$<HTMLInputElement>('#timeline').oninput=e=>{playing=false;elapsed=Number((e.target as HTMLInputElement).value)/1000*duration;};
$<HTMLInputElement>('#timeline').onchange=()=>reviewAt(elapsed);
$('#copy').onclick=async()=>{const text='Special-piece choices\n'+PIECE_REVIEW.map(p=>{const c=choices[p.kind];return `${p.title}: ${c==='original'?'keep original':c?`${c.toUpperCase()} — ${designFor(p.kind,c as DesignOption).name}`:'undecided'}`;}).join('\n');try{await navigator.clipboard.writeText(text);$('#copy-status').textContent='Choices copied. Paste them into our chat when you are ready.';}catch{$('#copy-status').textContent=text;}};
rebuild();showMode(mode);
new ResizeObserver(()=>{renderer.setPixelRatio(Math.min(devicePixelRatio,1.5,Math.sqrt(1800000/(stage.clientWidth*stage.clientHeight))));renderer.setSize(stage.clientWidth,stage.clientHeight);fit();}).observe(stage);
let last=0;renderer.setAnimationLoop(now=>{const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;if(document.hidden)return;if(playing){elapsed+=dt;if(elapsed>duration)elapsed=0;}controls.update();const start=performance.now();draw();renderSamples.push(performance.now()-start);if(renderSamples.length>240)renderSamples.shift();});
window.addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);scenes.forEach(s=>s.destroy());controls.dispose();renderer.dispose();},{once:true});
