import * as T from 'three';
import type { MiniSection } from '../mini-track';
import { seededRandom } from '../mini-rail';
import type { ChristmasBuilder } from './christmas-builder';
export const SNOW_GLOBE_OPENING=4.8;

/** Surface intersections with the real railway, not decorative pretend doors.
 * Centres include the coach's height; glass is cut away around the whole train. */
export function globePortals(s:MiniSection,center:T.Vector3,radius:number){
 const portals:T.Vector3[]=[],local=new T.Vector3(s.origin.x,0,s.origin.z);
 let previous=s.sample(s.start).position.clone().sub(local),inside=previous.distanceTo(center)<radius;
 for(let d=s.start+.5;d<=s.end+.5;d+=.5){
  const f=s.sample(Math.min(d,s.end)),p=f.position.clone().sub(local),now=p.distanceTo(center)<radius;
  if(now!==inside){
   let low=0,high=1;for(let i=0;i<16;i++){const t=(low+high)/2;if((previous.clone().lerp(p,t).distanceTo(center)<radius)===inside)low=t;else high=t;}
   const point=previous.clone().lerp(p,(low+high)/2).addScaledVector(f.up,.65);
   if(!portals.some(q=>q.distanceTo(point)<4))portals.push(point);
  }
  previous=p;inside=now;
 }
 return portals;
}
const glassVertex=`varying vec3 glassPoint;varying vec3 glassNormal;varying vec3 glassEye;
 #include <fog_pars_vertex>
 void main(){glassPoint=position;glassNormal=normalize(normalMatrix*normal);
  vec4 mvPosition=modelViewMatrix*vec4(position,1.);glassEye=-mvPosition.xyz;
  gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
 }`;
const glassFragment=`uniform float clock;uniform float rear;uniform vec3 centre;uniform float radius;
 uniform float portalRadius;uniform int portalCount;uniform vec3 portals[8];
 varying vec3 glassPoint;varying vec3 glassNormal;varying vec3 glassEye;
 #include <fog_pars_fragment>
 void main(){
  for(int i=0;i<8;i++){if(i>=portalCount)break;if(distance(glassPoint,portals[i])<portalRadius)discard;}
  vec3 N=normalize(glassNormal),V=normalize(glassEye);
  float facing=abs(dot(N,V));float rim=pow(1.-facing,3.);
  vec3 reflected=reflect(-V,N);
  // Broad curved studio reflections and a narrower cool streak. They follow
  // the camera and sphere normals, so the object reads as polished glass.
  float pearl=pow(max(0.,dot(reflected,normalize(vec3(-.55,.72,.52)))),26.);
  float ribbon=pow(max(0.,dot(reflected,normalize(vec3(.75,.22,.6)))),55.);
  float broad=pow(max(0.,dot(reflected,normalize(vec3(-.6,.45,.4)))),5.);
  float streak=exp(-pow((reflected.x+.43)*8.,2.))*smoothstep(-.2,.1,reflected.y)*(1.-smoothstep(.76,1.,reflected.y));
  vec3 localNormal=normalize(glassPoint-centre);
  vec2 grid=vec2(atan(localNormal.z,localNormal.x)*9.,acos(clamp(localNormal.y,-1.,1.))*12.);
  vec2 cell=floor(grid),delta=fract(grid)-.5;
  float seed=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
  float glint=exp(-dot(delta,delta)*380.)*pow(.5+.5*sin(clock*1.1+seed*71.),14.)*step(.88,seed)*step(.1,localNormal.y);
  float amber=exp(-pow((glassPoint.y-centre.y+radius*.32)/(radius*.22),2.));
  vec3 colour=mix(vec3(.27,.58,.86),vec3(.73,.91,1.),rim);
  colour=mix(colour,vec3(1.,.91,.76),clamp(pearl*.95+streak*.7+amber*.14,0.,1.));
  colour+=vec3(.65,.72,.8)*glint+vec3(.3,.4,.48)*ribbon+vec3(.11,.13,.17)*broad;
  float alpha=.018+rim*.46+pearl*.35+ribbon*.24+broad*.045+streak*.25+glint*.4;
  alpha*=mix(1.,.55,rear);
  gl_FragColor=vec4(colour,min(alpha,.72));
  #include <colorspace_fragment>
  #ifdef USE_FOG
   gl_FragColor.a*=1.-smoothstep(fogNear,fogFar,vFogDepth);
  #endif
 }`;

/** Two low-poly glass passes and one fixed snow batch. No render target,
 * environment capture, transmission pass, bloom pipeline or point lights. */
export function createSnowGlobeEffects(v:ChristmasBuilder,s:MiniSection,c:T.Vector3,baseRadius:number,desiredTop:number){
 const radius=baseRadius+5.6,floor=1.3,top=Math.max(desiredTop,radius*1.6+floor),center=new T.Vector3(c.x,top-radius,c.z);
 const cap=Math.acos(T.MathUtils.clamp((floor-center.y)/radius,-1,1));
 const geometry=new T.SphereGeometry(radius,64,40,0,Math.PI*2,0,cap).translate(center.x,center.y,center.z);
 const portals=globePortals(s,center,radius),clock={value:0},agitation={value:0},spin={value:0};
 if(portals.length>8)throw new Error('Snow globe route needs more than eight portals');
 for(const rear of [true,false]){
  const material=new T.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,side:rear?T.BackSide:T.FrontSide,
   fog:true,toneMapped:false,uniforms:{...T.UniformsUtils.clone(T.UniformsLib.fog),clock,rear:{value:Number(rear)},centre:{value:center},radius:{value:radius},portalRadius:{value:SNOW_GLOBE_OPENING},portalCount:{value:portals.length},portals:{value:[...portals,...Array.from({length:8-portals.length},()=>new T.Vector3(1e5,1e5,1e5))]}},vertexShader:glassVertex,fragmentShader:glassFragment});
  const pane=v.effect(geometry,material);pane.name=rear?'snowglobe-glass-rear':'snowglobe-glass-front';pane.renderOrder=rear?1:3;
 }
 // Stable seeds and shader motion replace CPU-updated flakes. Hundreds of
 // softly lit crystals are still just one material batch / 1,920 vertices.
 const count=320,positions:number[]=[],corners:number[]=[],seeds:number[]=[],random=seededRandom(7171^Math.round(s.width*100));
 for(let i=0;i<count;i++){
  const particle=[random(),random(),random(),random()];
  for(const [x,y]of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]){
   positions.push(0,0,0);corners.push(x,y);seeds.push(...particle);
  }
 }
 const snowGeometry=new T.BufferGeometry();snowGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));snowGeometry.setAttribute('corner',new T.Float32BufferAttribute(corners,2));snowGeometry.setAttribute('seed',new T.Float32BufferAttribute(seeds,4));
 const snowMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,fog:true,toneMapped:false,
  uniforms:{...T.UniformsUtils.clone(T.UniformsLib.fog),clock,agitation,spin,centre:{value:center},radius:{value:radius},bottom:{value:floor},ceiling:{value:top}},
  vertexShader:`attribute vec2 corner;attribute vec4 seed;uniform float clock;uniform float agitation;uniform float spin;
   uniform vec3 centre;uniform float radius;uniform float bottom;uniform float ceiling;
   varying vec2 snowUv;varying float twinkle;varying float crystal;varying float hue;
   #include <fog_pars_vertex>
   void main(){
    float progress=fract(seed.y-clock*(.025+seed.w*.018));
    float y=mix(bottom+1.,ceiling-2.,progress);
    float r=radius*sqrt(max(.01,1.-pow((y-centre.y)/radius,2.)))*(.12+.76*sqrt(seed.z));
    float a=seed.x*6.283185+clock*(.06+seed.z*.045)+spin*(.5+seed.w);
    vec3 p=vec3(centre.x+cos(a)*r,y,centre.z+sin(a)*r);
    vec4 mvPosition=modelViewMatrix*vec4(p,1.);
    twinkle=pow(.5+.5*sin(clock*(1.1+seed.z)+seed.x*83.),12.);
    crystal=step(.79,seed.w);hue=seed.z;
    float size=mix(.18,.57,seed.w)*(1.+twinkle*.35+agitation*.12);
    snowUv=corner;mvPosition.xy+=corner*size;
    gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
   }`,
  fragmentShader:`varying vec2 snowUv;varying float twinkle;varying float crystal;varying float hue;
   #include <fog_pars_fragment>
   void main(){
    float r=length(snowUv);if(r>1.)discard;
    float angle=atan(snowUv.y,snowUv.x);
    float core=exp(-r*r*90.);float halo=exp(-r*r*7.)*.17;
    float rays=pow(abs(cos(angle*3.)),22.)*(1.-smoothstep(.25,.9,r))*.48;
    float branches=pow(abs(cos(angle*3.+r*5.)),26.)*exp(-pow((r-.48)*8.,2.))*.2;
    float light=core+halo+(rays+branches)*crystal;
    vec3 tint=mix(vec3(.64,.83,1.),vec3(1.,.89,.69),step(.85,hue));
    gl_FragColor=vec4(tint*(1.+twinkle*.7),light*(.7+twinkle*1.25));
    #include <colorspace_fragment>
    #ifdef USE_FOG
     gl_FragColor.a*=1.-smoothstep(fogNear,fogFar,vFogDepth);
    #endif
   }`});
 const snow=v.effect(snowGeometry,snowMaterial);snow.name='snowglobe-lit-snow';snow.frustumCulled=false;snow.renderOrder=2;
 let lastTime=0;
 return{center,radius,top,portals,clock,agitation,spin,update(time:number,shake:number,reduced:boolean){
  const dt=T.MathUtils.clamp(time-lastTime,0,.1);
  if(reduced||time<lastTime){agitation.value=0;spin.value=0;}
  else{agitation.value+=(shake-agitation.value)*(1-Math.exp(-dt*2));spin.value+=agitation.value*dt*.65;}
  clock.value=reduced?0:time;lastTime=time;
 }};
}
