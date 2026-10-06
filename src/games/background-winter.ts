import * as T from "three";
import { WorldModel, WORLD_SHAPES as G } from "./world-models";

export type WinterKind = "lapland" | "winterfair";
export type WinterActor = { kind: "skater"; x: number; y: number; z: number; phase: number; size: number };
export const WINTER_PALETTES = {
  lapland: { snow: "#becded", shade: "#92a7d4", far: "#6d84ba", ridge: "#9caeda", fir: "#28585b", firTop: "#38666b", ice: "#72a7cc", wood: "#846366" },
  winterfair: { snow: "#fff1e1", shade: "#d5e5ec", far: "#b2cce1", ridge: "#c8ddea", fir: "#4d8581", firTop: "#65978e", ice: "#85c6db", wood: "#ac8566" },
} as const;
const GEM = new T.OctahedronGeometry(1);
const DISK = new T.CircleGeometry(1, 12).rotateX(-Math.PI / 2);
const RING = new T.RingGeometry(.97, 1, 24).rotateX(-Math.PI / 2);
const V = (x: number, y: number, z: number) => new T.Vector3(x, y, z);

function shape(vertices: number[], reverse=false) {
  if(reverse)for(let i=0;i<vertices.length;i+=9)for(let axis=0;axis<3;axis++)[vertices[i+3+axis],vertices[i+6+axis]]=[vertices[i+6+axis],vertices[i+3+axis]];
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3)); g.computeVertexNormals(); return g;
}
const ROOF = shape([
  -1,0,-1, 0,1,-1, 0,1,1, -1,0,-1, 0,1,1, -1,0,1,
  0,1,-1, 1,0,-1, 1,0,1, 0,1,-1, 1,0,1, 0,1,1,
  -1,0,1, 0,1,1, 1,0,1, 1,0,-1, 0,1,-1, -1,0,-1,
  -1,0,-1, -1,0,1, 1,0,1, -1,0,-1, 1,0,1, 1,0,-1,
],true);
const STAR = (() => {
  const p: number[] = [];
  for (let i=0;i<10;i++) {
    const a=i*Math.PI/5,b=(i+1)*Math.PI/5,ra=i%2?.43:1,rb=i%2?1:.43;
    p.push(0,0,.06,Math.sin(b)*rb,Math.cos(b)*rb,0,Math.sin(a)*ra,Math.cos(a)*ra,0);
    p.push(0,0,-.06,Math.sin(a)*ra,Math.cos(a)*ra,0,Math.sin(b)*rb,Math.cos(b)*rb,0);
  }
  return shape(p);
})();

/** Faceted snow is solid opaque geometry. Eight-sided banks keep a broad
 * irregular shoreline without transparency, reflections or a second scene. */
export function snowIsland(m: WorldModel, x: number, z: number, width: number, depth: number, kind: WinterKind, phase=0, y=.17) {
  const p: number[] = [], count=10;
  for(let i=0;i<count;i++) {
    const point=(j:number)=>{const a=j*Math.PI*2/count,r=1+.09*Math.sin(a*3+phase);return [Math.cos(a)*r*width,0,Math.sin(a)*r*depth]};
    const a=point(i),b=point(i+1);
    p.push(0,.13,0,...b,...a);
    p.push(...a,...b,b[0],-.22,b[2],...a,b[0],-.22,b[2],a[0],-.22,a[2]);
  }
  const g=shape(p);m.add(g,WINTER_PALETTES[kind].snow,[x,y,z]);g.dispose();
}

function ridge(m: WorldModel,x:number,z:number,w:number,d:number,h:number,kind:WinterKind,phase:number,far=false) {
  const batches: number[][]=[[],[],[]];
  const heights=[0,.5,.77,.6,.92,.7,.38,0];
  const rows=[-1,-.45,0,.45,1],levels=[0,.55,1,.45,0];
  const point=(i:number,row:number)=>[-w+i*w*2/7+w*.025*Math.sin(i+phase)*(1-Math.abs(rows[row])),
    -.12+h*heights[i]*levels[row],d*rows[row]+Math.sin(i*1.7+phase)*d*.09*(1-Math.abs(rows[row]))];
  for(let i=0;i<7;i++) {
    for(let row=0;row<4;row++) {
      const a=point(i,row),b=point(i+1,row),c=point(i,row+1),e=point(i+1,row+1);
      batches[(i+row)%3].push(...a,...c,...e,...a,...e,...b);
    }
  }
  const colors=far?kind==='lapland'?["#839bcb","#91a7d4","#9cafda"]:["#b9b2d0","#cbb8cf","#dfc5d3"]:
    kind==='lapland'?["#a9b9df","#b7c5e7","#a3b5dc"]:["#b4c9df","#cfd8e9","#f0d9d5"];
  batches.forEach((vertices,i)=>{const g=shape(vertices);m.add(g,colors[i],[x,0,z]);g.dispose()});
}

export function winterTerrain(m:WorldModel,x:number,back:number,r:()=>number,kind:WinterKind) {
  const phase=r()*6.28;
  // Faceted mountain faces carry the landscape, with sky visible between and
  // above their peaks. Keep their front slope behind the cabin clearing.
  ridge(m,x+5,back-16,31,8,5+r()*3,kind,phase,true);
  ridge(m,x-5,back-14,25,3,.45+r()*.45,kind,phase+1);
  return phase;
}

export function snowyFir(m:WorldModel,x:number,z:number,h:number,kind:WinterKind,decorated=false) {
  const c=WINTER_PALETTES[kind];
  m.add(G.box,c.wood,[x,h*.2,z],[.22,h*.4,.22]);
  for(let i=0;i<3;i++) {
    const y=h*(.34+i*.23),height=h*(.49-i*.07),radius=h*(.29-i*.065);
    m.add(G.cone,i===2?c.firTop:c.fir,[x,y,z],[radius,height,radius]);
    // A smaller upper section lies on the same cone surface, not a floating cap.
    m.add(G.cone,c.snow,[x,y+height*.25+.015,z],[radius*.53,height*.52,radius*.53]);
  }
  if(decorated) {
    m.add(STAR,"#fff0b9",[x,h*1.05,z],[.65,.65,.65],[],true);
    m.softGlow([x,h*1.05,z],"#ffbd65",1.65,.6);
    m.softGlow([x,.4,z],"#ffb566",4,.26,true);
    for(let i=0;i<8;i++){
      const a=i*2.4,y=h*(.23+i*.08),radius=h*(.25-i*.02),p=[x+Math.cos(a)*radius,y,z+Math.sin(a)*radius];
      m.add(GEM,i%3?"#ffe3a2":"#e6a59a",p,[.15,.17,.15],[],true);
      m.softGlow(p,"#ffbf69",.7,.55);
    }
  }
}

function grove(m:WorldModel,x:number,z:number,kind:WinterKind,r:()=>number,count=3) {
  for(let i=0;i<count;i++){const a=i*2.4,rad=1.4+r()*2.2;snowyFir(m,x+Math.cos(a)*rad,z+Math.sin(a)*rad*.6,3.8+r()*3.5,kind)}
}
export function winterLamp(m:WorldModel,x:number,z:number,kind:WinterKind,tall=3.6) {
  const c=WINTER_PALETTES[kind];
  m.add(G.box,c.wood,[x,tall*.5,z],[.12,tall,.12]);
  m.add(G.box,c.snow,[x,.18,z],[.65,.18,.65]);
  if(kind==="lapland") {
    m.add(G.box,"#ffe0a1",[x,tall,z],[.5,.65,.5],[],true);
    for(const dx of [-.27,.27])for(const dz of [-.27,.27])m.add(G.box,"#8c7270",[x+dx,tall,z+dz],[.055,.7,.055]);
    m.add(G.cone,c.wood,[x,tall+.49,z],[.5,.3,.5]);
    m.add(G.box,c.wood,[x,tall-.38,z],[.7,.1,.7]);
  }else m.add(GEM,"#ffe2ab",[x,tall,z],[.35,.5,.35],[],true);
  m.softGlow([x,tall,z+.06],"#ffad45",kind==="lapland"?2.8:1.7,kind==="lapland"?.85:.5);
  m.softGlow([x,.405,z],"#ffc176",4.7,kind==="lapland"?.60:.3,true);
}

export function gift(m:WorldModel,x:number,y:number,z:number,color:string,size=.7) {
  m.add(G.box,color,[x,y+size*.5,z],[size,size,size]);
  m.add(G.box,"#edce8b",[x,y+size*.5,z],[size*1.04,size*1.04,size*.12]);
  m.add(G.box,"#edce8b",[x,y+size+.025,z],[size*.13,.06,size*1.04]);
  for(const dx of [-.12,.12])m.add(GEM,"#f5daa4",[x+dx*size,y+size+.12*size,z],[.17*size,.12*size,.09*size]);
}

export function winterCabin(m:WorldModel,x:number,z:number,kind:WinterKind,size=1) {
  const c=WINTER_PALETTES[kind],s=size;
  snowIsland(m,x,z+1,4.6*s,3.4*s,kind,2);
  m.add(G.box,c.wood,[x,.34*s,z],[5.6*s,.45*s,4.1*s]);
  m.add(G.box,kind==="lapland"?"#ad686a":"#dc9a88",[x,1.75*s,z],[5.2*s,2.6*s,3.8*s]);
  // Four timber courses and two corner strips read as a cabin without log meshes.
  for(let i=0;i<4;i++)m.add(G.box,kind==="lapland"?"#865558":"#c28879",[x,(.7+i*.62)*s,z+1.91*s],[5.2*s,.08*s,.04*s]);
  m.add(ROOF,c.snow,[x,3.06*s,z],[3.02*s,1.6*s,2.3*s]);
  m.add(G.box,"#a86a6c",[x+1.5*s,4.5*s,z-.55*s],[.62*s,1.9*s,.6*s]);
  m.add(G.box,c.snow,[x+1.5*s,5.49*s,z-.55*s],[.83*s,.16*s,.8*s]);
  m.add(G.box,"#775357",[x,1.3*s,z+1.96*s],[.84*s,1.8*s,.09*s]);
  m.add(GEM,"#dfbf89",[x+.25*s,1.3*s,z+2.03*s],[.045*s,.045*s,.045*s]);
  m.add(G.box,c.wood,[x,.3*s,z+2.35*s],[1.4*s,.3*s,.8*s]);
  for(const dx of [-1.62,1.62]) {
    m.add(G.box,"#76555c",[x+dx*s,1.88*s,z+1.94*s],[1.2*s,1.3*s,.09*s]);
    m.add(G.box,"#fff1b0",[x+dx*s,1.88*s,z+2*s],[.92*s,1.03*s,.055*s],[],true);
    for(const d of [[.045,1.07],[.96,.045]])m.add(G.box,"#bda18b",[x+dx*s,1.88*s,z+2.04*s],[d[0]*s,d[1]*s,.035*s]);
    m.softGlow([x+dx*s,1.88*s,z+2.12*s],"#ffaf50",2.6*s,.85);
    m.softGlow([x+dx*s,.405,z+3.1*s],"#ffc382",4.3*s,.58,true);
  }
  // A side window is visible in the existing angled camera.
  m.add(G.box,"#fff0ae",[x+2.62*s,1.8*s,z+.4*s],[.05*s,1*s,.9*s],[],true);
  m.softGlow([x+2.73*s,1.8*s,z+.4*s],"#ffaf50",2.4*s,.75);
  m.softGlow([x+3.2*s,.405,z+.4*s],"#ffc382",3.7*s,.5,true);
  for(const dx of [-1.1,.4])gift(m,x+dx*s,.35*s,z+2.55*s,dx<0?"#db9798":"#81b8bb",.55*s);
}

function fence(m:WorldModel,x:number,z:number,kind:WinterKind,w=9) {
  const c=WINTER_PALETTES[kind];
  for(let i=0;i<3;i++) {
    const px=x-w*.5+i*w*.5;m.add(G.box,c.wood,[px,.85,z],[.17,1.5,.17]);
    m.add(GEM,c.snow,[px,1.62,z],[.19,.15,.19]);
    if(i)for(const y of [.7,1.25])m.add(G.box,c.wood,[px-w*.25,y,z],[w*.5,.1,.1]);
  }
}

function festoon(m:WorldModel,x:number,z:number,kind:WinterKind,width=10,stars=false) {
  const c=WINTER_PALETTES[kind];
  for(const dx of [-width*.5,width*.5])winterLamp(m,x+dx,z,kind,3.7);
  let prev:T.Vector3|undefined;
  for(let i=0;i<=6;i++) {
    const t=i/6,p=V(x-width/2+t*width,3.6-Math.sin(t*Math.PI)*.65,z);
    if(prev)m.beam(c.wood,prev,p,.035);
    m.add(stars?STAR:GEM,i%3?"#ffe0a0":"#f0b0a2",[p.x,p.y-.25,z],[stars?.25:.12,stars?.25:.15,.12],[],true);
    m.softGlow([p.x,p.y-.25,z+.08],"#ffd084",stars?.9:.6,stars?.65:.42);
    if(!stars&&i<6) {
      const flag=shape([-.3,0,0,0,-.65,0,.3,0,0,.3,0,0,0,-.65,0,-.3,0,0]);
      m.add(flag,i%2?"#da9387":"#68b1b4",[p.x+.7,p.y-.1,z]);flag.dispose();
    }
    prev=p;
  }
}

function sled(m:WorldModel,x:number,z:number,kind:WinterKind) {
  const c=WINTER_PALETTES[kind];
  for(const dz of [-.65,.65]){m.add(G.box,"#80646a",[x,.31,z+dz],[3,.11,.11]);m.add(G.box,"#80646a",[x+1.42,.47,z+dz],[.13,.55,.13],[0,0,.5]);}
  m.add(G.box,c.wood,[x,.65,z],[2.6,.18,1.45]);
  gift(m,x-.45,.76,z,"#89b6bb",.9);gift(m,x+.5,.76,z,"#d89591",.7);
}

function snowman(m:WorldModel,x:number,z:number,kind:WinterKind) {
  const c=WINTER_PALETTES[kind];
  m.add(G.rock,c.snow,[x,.78,z],[.86,.75,.77]);m.add(G.rock,c.snow,[x,1.6,z],[.58,.55,.58]);
  m.add(G.pole,"#c78089",[x,1.19,z],[.61,.13,.61]);m.add(G.box,"#c78089",[x+.34,.99,z+.53],[.23,.5,.06],[0,0,-.15]);
  m.add(G.pole,"#65788e",[x,2.16,z],[.46,.13,.46]);m.add(G.pole,"#65788e",[x,2.39,z],[.3,.4,.3]);
  for(const dx of [-.18,.18])m.add(GEM,"#435269",[x+dx,1.76,z+.52],[.065,.075,.045]);
  m.add(G.cone,"#eda973",[x,1.56,z+.7],[.11,.38,.11],[Math.PI/2,0,0]);
  for(const side of [-1,1])m.beam(c.wood,V(x+side*.5,1.1,z),V(x+side*1.25,1.7,z),.055);
}

function reindeer(m:WorldModel,x:number,z:number) {
  const antler=(a:T.Vector3,b:T.Vector3,w:number)=>{const d=b.clone().sub(a),rotation=new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(V(0,1,0),d.clone().normalize()));m.add(G.box,"#866b62",a.clone().add(b).multiplyScalar(.5).toArray(),[w,d.length(),w],[rotation.x,rotation.y,rotation.z]);};
  m.add(G.rock,"#b68d78",[x,1.1,z],[.85,.53,.39]);
  m.add(G.rock,"#b68d78",[x+.77,1.55,z],[.27,.54,.27]);m.add(G.rock,"#c29a80",[x+.94,1.96,z],[.38,.3,.27]);
  for(const dx of [-.52,.48])for(const dz of [-.23,.23])m.add(G.box,"#927265",[x+dx,.51,z+dz],[.12,1,.12]);
  for(const dz of [-.19,.19]) {
    antler(V(x+.79,2.1,z+dz),V(x+.61,2.75,z+dz*2),.1);
    antler(V(x+.68,2.46,z+dz*1.5),V(x+.95,2.65,z+dz*2),.075);
    m.add(GEM,"#ffffff",[x+1.12,2.01,z+dz*1.45],[.045,.05,.045]);
  }
  m.add(GEM,"#d68985",[x+1.25,1.86,z],[.12,.1,.14]);
}

function frozenPond(m:WorldModel,x:number,z:number,kind:WinterKind,width:number,depth:number,phase:number) {
  snowIsland(m,x,z,width+1.1,depth+.9,kind,phase);
  m.add(DISK,WINTER_PALETTES[kind].ice,[x,.34,z],[width,1,depth],[0,phase*.08,0]);
  // A few opaque facets/crack lines imply ice without reflection passes.
  for(let i=0;i<4;i++){const a=phase+i*1.3;m.add(G.box,kind==="lapland"?"#95b6db":"#bbdfeb",[x+Math.cos(a)*width*.5,.355,z+Math.sin(a)*depth*.4],[width*.47,.018,.045],[0,a,0]);}
}

function dock(m:WorldModel,x:number,z:number,kind:WinterKind) {
  const c=WINTER_PALETTES[kind];
  for(let i=0;i<5;i++)m.add(G.box,c.wood,[x,.55,z-1.7+i*.85],[4.8,.25,.8]);
  for(const dx of [-2.2,2.2])for(const dz of [-1.6,1.6]){m.add(G.box,c.wood,[x+dx,.75,z+dz],[.2,1.4,.2]);m.add(GEM,c.snow,[x+dx,1.48,z+dz],[.24,.17,.24]);}
  gift(m,x+.8,.69,z-.6,"#dfa29a",.65);
}

function booth(m:WorldModel,x:number,z:number,color:string,kind:WinterKind) {
  const c=WINTER_PALETTES[kind];
  m.add(G.box,c.wood,[x,.3,z],[4.8,.36,3.3]);m.add(G.box,c.wood,[x,1.2,z+.9],[4.4,1.5,.45]);
  m.add(G.box,"#d8bc91",[x,2,z+1.1],[4.65,.16,1.05]);m.add(G.box,c.wood,[x,1.92,z-1.1],[4.4,3,.14]);
  for(const dx of [-2,2])m.add(G.box,c.wood,[x+dx,2.2,z+.9],[.13,3.6,.13]);
  for(let i=0;i<6;i++) {
    const cx=x-1.88+i*.75;
    for(const side of [-1,1])m.add(G.box,i%2?"#fff1de":color,[cx,4.1,z+side*.78],[.745,.13,1.72],[side*.28,0,0]);
    m.add(G.box,i%2?"#fff1de":color,[cx,3.77,z+1.59],[.745,.3,.075]);
    m.add(GEM,"#ffe0a4",[cx,3.55,z+1.65],[.09,.12,.09],[],true);
  }
  m.softGlow([x,3.3,z+1.8],"#ffc385",3,.3);
  m.softGlow([x,.405,z+2.4],"#ffc591",3.6,.35,true);
  for(let i=0;i<3;i++) {
    const cx=x-1.15+i*1.1;m.add(G.pole,i%2?"#86bcc0":"#e3a499",[cx,2.25,z+.98],[.22,.42,.22]);
    m.add(GEM,"#fff4df",[cx,2.55,z+.98],[.23,.22,.23]);
  }
}

export function penguinModel() {
  const m=new WorldModel();
  m.add(G.rock,"#53657c",[0,.7,0],[.47,.64,.39]);m.add(G.rock,"#53657c",[0,1.33,.05],[.37,.35,.32]);
  m.add(G.rock,"#fff3e1",[0,.7,.26],[.34,.49,.17]);m.add(G.rock,"#fff3e1",[0,1.33,.27],[.29,.23,.09]);
  for(const dx of [-.17,.17]) {
    m.add(GEM,"#3a4657",[dx,1.44,.35],[.065,.075,.045]);m.add(G.box,"#e6b373",[dx,.13,.18],[.21,.11,.38]);
    m.add(G.rock,"#53657c",[Math.sign(dx)*.52,.82,0],[.34,.11,.18],[0,0,Math.sign(dx)*.22]);
  }
  m.add(GEM,"#e9b16e",[0,1.22,.45],[.13,.1,.18]);
  m.add(G.pole,"#db9094",[0,1.03,0],[.4,.14,.36]);m.add(G.box,"#db9094",[.21,.79,.4],[.17,.43,.065],[0,0,-.2]);
  return m;
}

/** A village, woodland brook or reindeer clearing, with one warm focal group
 * per bay. Everything stays clear of the rail/race corridor. */
export function laplandScenery(m:WorldModel,x:number,back:number,front:number,r:()=>number,variant=0) {
  const kind="lapland",phase=winterTerrain(m,x,back,r,kind),z=back+2;
  // Low snow shoulders soften the open clearing without raising cabin floors.
  m.add(G.rock,"#aebde5",[x-8,.12,front+3],[5,.65,2.2]);
  m.add(G.rock,"#bcc8e9",[x+10,.1,front+15],[4,.5,2]);
  grove(m,x-10,back-4,kind,r,variant===2?2:3);grove(m,x+10,back-7,kind,r,2);
  if(variant===0) {
    winterCabin(m,x-4,z,kind,1.05);winterCabin(m,x+6,back-9,kind,.73);
    fence(m,x-4,z+4,kind,9);winterLamp(m,x+1,z+3,kind);
    snowIsland(m,x+3,front+7,9,5,kind,phase);snowyFir(m,x+3,front+7,6.4,kind,true);
    sled(m,x-3,front+9,kind);winterLamp(m,x+7,front+7,kind);grove(m,x-10,front+9,kind,r,2);
  }else if(variant===1) {
    winterCabin(m,x+4,z-2,kind,.92);grove(m,x-7,z,kind,r,3);
    frozenPond(m,x,front+10,kind,10,5.5,phase);dock(m,x+7,front+9,kind);winterLamp(m,x+9,front+10,kind);
    snowman(m,x-10,front+7,kind);snowyFir(m,x+12,front+6,5,kind);
  }else {
    winterCabin(m,x-5,z,kind,.95);festoon(m,x,z+4,kind,14,true);
    snowIsland(m,x,front+8,9,4.5,kind,phase);reindeer(m,x-2,front+8);reindeer(m,x+2,front+9);fence(m,x,front+12,kind,12);
    grove(m,x-10,front+7,kind,r,2);sled(m,x+9,front+8,kind);
  }
}

/** Ice and small snow peninsulas carry the winter fair. Penguin skating uses
 * one shared instance batch; stalls, lights and shoreline remain static. */
export function winterFairScenery(m:WorldModel,place:(actor:WinterActor)=>void,x:number,back:number,front:number,r:()=>number,variant=0) {
  const kind="winterfair",phase=winterTerrain(m,x,back,r,kind);
  snowIsland(m,x,back+1,15,8,kind,phase);grove(m,x+10,back-4,kind,r,2);
  booth(m,x-5,back+2,variant%2?"#74b6bb":"#df9a8f",kind);
  if(variant!==1)booth(m,x+3,back+1,variant%2?"#df9a8f":"#74b6bb",kind);
  festoon(m,x,back+7,kind,20);
  // The lake lies in front of the rail, not in the gap between race lanes.
  // A dozen broad, irregular colour facets imply solid ice. These are opaque
  // and have no reflection framebuffer, scrolling texture or fragment noise.
  for(let i=0;i<12;i++) {
    const point=(j:number)=>{const a=j*Math.PI/6,rad=1+.06*Math.sin(a*3+phase);return [Math.cos(a)*15*rad,0,Math.sin(a)*9*rad];};
    const g=shape([0,0,0,...point(i+1),...point(i)]);
    m.add(g,["#a2d4e4","#aedbea","#99cede"][i%3],[x,.105,front+11]);g.dispose();
  }
  for(let i=0;i<3;i++)m.add(G.box,"#c6e5ec",[x-6+i*6,.13,front+11+(i%2)*3],[7,.018,.045],[0,.3+i*.7,0]);
  if(variant===0) {
    snowIsland(m,x+9,front+10,5,4,kind,phase);dock(m,x+9,front+10,kind);winterLamp(m,x+11,front+12,kind);snowyFir(m,x+7,front+8,4.2,kind);
    snowIsland(m,x-11,front+6,3.5,2.2,kind,phase);snowman(m,x-11,front+6,kind);
  }else if(variant===1) {
    for(const dx of [-10,10]){snowIsland(m,x+dx,front+12,4.2,3,kind,phase+dx);snowyFir(m,x+dx,front+12,4.6,kind);}
    dock(m,x-4,back+9,kind);winterLamp(m,x-7,back+8,kind);
  }else {
    snowIsland(m,x-10,front+9,4.7,3.7,kind,phase);dock(m,x-10,front+9,kind);winterLamp(m,x-12,front+10,kind);
    snowIsland(m,x+10,front+11,4.2,3,kind,phase);snowyFir(m,x+10,front+11,4.5,kind);snowman(m,x+12,front+12,kind);
  }
  // Two planks, a back and four legs give the shoreline a place to sit.
  if(variant!==1) {
    const bx=x+4,bz=back+5;
    for(const dx of [-1.1,1.1])for(const dz of [-.45,.45])m.add(G.box,"#a0836d",[bx+dx,.48,bz+dz],[.12,.8,.12]);
    m.add(G.box,"#d4b28e",[bx,.94,bz],[2.8,.17,1.2]);m.add(G.box,"#d4b28e",[bx,1.42,bz-.5],[2.8,.65,.14]);
  }
  for(let i=0;i<3;i++) {
    const px=x+(variant===0?-5+i*2.8:variant===2?-2+i*2.5:-3+i*3),pz=front+9+(i%2)*3;
    m.add(RING,"#d3edf0",[px,.147,pz],[2.2,1,1.4],[0,i*.8,0]);
    place({kind:"skater",x:px,y:.17,z:pz,phase:phase+i*2.4,size:.9+r()*.2});
  }
}
