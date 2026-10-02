import * as T from 'three';
import { StrengthTowerMotion } from './strength-tower-motion';

const gold = '#ffc84f', mint = '#75ead2', pink = '#ff7998';
/** Self-contained bonus attraction; shares its controller between the ride and demo. */
export class StrengthTower {
  readonly motion: StrengthTowerMotion;
  private root = document.createElement('div');
  private renderer = new T.WebGLRenderer({antialias:true, alpha:false});
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(42, 1, .1, 600);
  private coaches: T.Group[] = [];
  private lights: T.Mesh[] = [];
  private flakes: {mesh:T.Mesh; velocity:T.Vector3}[] = [];
  private builtHeight = 110;
  private sparkHeight = 0;
  private sparks: {mesh:T.Mesh; velocity:T.Vector3; life:number}[] = [];
  private switchRail = new T.Group();
  private best = 0;
  private saved = false;
  private width = 0;
  private height = 0;
  private status: HTMLElement;
  private score: HTMLElement;
  private record: HTMLElement;
  private celebration: HTMLElement;
  private approach: T.CatmullRomCurve3;
  private exit: T.CatmullRomCurve3;
  private cameraTarget = new T.Vector3();
  constructor(stage: HTMLElement, speed=26, coachCount=6) {
    this.motion = new StrengthTowerMotion(speed);
    try { this.best = Number(localStorage.getItem('keep-going-tower-best')) || 0; } catch { /* Storage is optional. */ }
    this.root.className='strength-tower';
    this.root.innerHTML='<div class="tower-heading"><small>FOUR WORLDS · ONE BIG FINISH</small><h2>Sky striker!</h2><p data-tower-status>Here comes the big climb…</p></div><div class="tower-meter"><small>HEIGHT SCORE</small><strong data-tower-score>0</strong><span data-tower-record></span></div><div class="tower-celebration" hidden><small>WHAT A RIDE!</small><strong></strong><span></span></div><div class="tower-foot">Correct answers power the climb ↑</div>';
    this.status=this.root.querySelector('[data-tower-status]')!;
    this.score=this.root.querySelector('[data-tower-score]')!;
    this.record=this.root.querySelector('[data-tower-record]')!;
    this.celebration=this.root.querySelector('.tower-celebration')!;
    this.record.textContent=`BEST ${this.best.toLocaleString()}`;
    this.root.prepend(this.renderer.domElement);stage.append(this.root);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.scene.background=new T.Color('#162b49');
    this.scene.fog=new T.Fog('#162b49',180,380);
    this.scene.add(new T.HemisphereLight('#d1efff','#586b88',2.5));
    const sun=new T.DirectionalLight('#fff2cb',3);sun.position.set(-30,100,80);this.scene.add(sun);
    const mesh=(geometry:T.BufferGeometry,color:string,parent:T.Object3D=this.scene)=>{const m=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.6,metalness:.15}));parent.add(m);return m;};
    const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string,parent:T.Object3D=this.scene)=>{const m=mesh(new T.BoxGeometry(w,h,d),color,parent);m.position.set(x,y,z);return m;};
    const ground=mesh(new T.CylinderGeometry(75,78,3,64),'#334d65');ground.position.y=-3;
    // Tall striped arcade cabinet, deliberately behind the rails.
    box(0,62,-3.7,17,124,4,'#344771');
    box(0,62,-1.5,12.8,121,.5,'#14243c');
    for(const x of [-8.3,8.3])box(x,62,-.7,.8,125,1,gold);
    for(let i=0;i<=22;i++) {
      const y=8+i*5;
      for(const x of [-7.1,7.1]){
        const lamp=mesh(new T.SphereGeometry(.5,8,6),'#53617b');lamp.position.set(x,y,0);this.lights.push(lamp);
      }
      box(3.9,y,-.95,i%2===0?2.4:1.1,.17,.2,'#8496b0');
      if(i%2===0)this.label(String(i*50),5.4,y,1,4.6,1.8);
    }
    this.label('KEEP CLIMBING!',-16,50,0,14,3);
    if(this.best>0){const y=8+Math.min(this.best/10,110);box(-4.5,y,1,4,.25,1,pink);this.label('BEST',-7,y+1.8,1,5,1.8);}
    // A real bell and a hammer make the fairground reference legible.
    box(-14,3,10,1.5,12,1.5,'#ce9062').rotation.z=-.45;
    const hammer=box(-16.5,8,10,8,4,4,pink);hammer.rotation.z=-.45;
    this.label('GO!',-16,12,10,7,3);
    this.approach=new T.CatmullRomCurve3([new T.Vector3(-36,14,30),new T.Vector3(-26,6,23),new T.Vector3(-10,1,14),new T.Vector3(0,2,7),new T.Vector3(0,8,0)]);
    this.exit=new T.CatmullRomCurve3([new T.Vector3(0,8,0),new T.Vector3(1,2,8),new T.Vector3(12,1,18),new T.Vector3(29,4,17),new T.Vector3(44,5,12)]);
    const vertical=new T.LineCurve3(new T.Vector3(0,8,0),new T.Vector3(0,118,0));
    for(const curve of [this.approach,this.exit,vertical]){
      for(const offset of [-1.1,1.1]){
        const points=curve.getPoints(100).map(p=>p.add(new T.Vector3(offset,0,0)));
        mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),100,.18,6,false),mint);
      }
      const count=Math.ceil(curve.getLength()/1.8);
      for(let i=0;i<=count;i++){const p=curve.getPointAt(i/count);box(p.x,p.y,p.z,2.9,.18,.25,'#dac688');}
    }
    this.scene.add(this.switchRail);this.switchRail.position.set(0,3,6);
    box(0,0,0,.5,.3,6,gold,this.switchRail);
    this.label('SWITCH →',11,3,22,10,2);
    // Roofs face the camera on the vertical: car-local up becomes world +Z.
    for(let i=0;i<Math.min(10,Math.max(5,coachCount));i++){
      const car=new T.Group();this.scene.add(car);this.coaches.push(car);
      box(0,.45,0,1.85,.75,2.35,i%2?mint:'#ffd36d',car);
      box(0,1.05,0,1.55,.55,1.65,i%2?'#478e88':'#e3a243',car);
      box(0,1.4,0,1.85,.2,1.9,i===0?pink:i%2?'#a3fff0':'#fff1a8',car);
      box(0,.1,-1.4,.35,.25,.7,'#334660',car);
      if(i===0){const chimney=mesh(new T.CylinderGeometry(.32,.23,.65,10),gold,car);chimney.position.set(0,1.8,.55);const rim=mesh(new T.TorusGeometry(.32,.07,6,12),gold,car);rim.rotation.x=Math.PI/2;rim.position.set(0,2.13,.55);}
      else for(const x of [-.42,.42])box(x,1.52,0,.45,.04,1.25,'#c0e9e4',car);
      for(const x of [-1,1])for(const z of [-.8,.8]){const wheel=mesh(new T.CylinderGeometry(.32,.32,.2,10),'#223249',car);wheel.rotation.z=Math.PI/2;wheel.position.set(x,0,z);}
      for(const x of [-.4,.4]){const eye=mesh(new T.SphereGeometry(.18,8,6),'#fff',car);eye.position.set(x,.65,1.2);const pupil=mesh(new T.SphereGeometry(.085,8,6),'#243148',car);pupil.position.set(x,.65,1.35);}
    }
    const geometry=new T.PlaneGeometry(.6,1.3);
    const materials=[gold,mint,pink,'#b79aff'].map(color=>new T.MeshBasicMaterial({color,side:T.DoubleSide}));
    for(let i=0;i<110;i++){const flake=new T.Mesh(geometry,materials[i%4]);flake.visible=false;this.scene.add(flake);this.flakes.push({mesh:flake,velocity:new T.Vector3()});}
    for(let i=0;i<35;i++){const star=mesh(new T.SphereGeometry(.2,5,4),'#a7cee9');star.position.set(Math.sin(i*23)*100,20+(i*17)%130,-20-Math.cos(i*3)*20);}
    const sparkGeometry=new T.SphereGeometry(.18,5,4);
    for(let i=0;i<96;i++){const m=new T.Mesh(sparkGeometry,new T.MeshBasicMaterial({color:i%2?gold:mint}));m.visible=false;this.scene.add(m);this.sparks.push({mesh:m,velocity:new T.Vector3(),life:0});}
    this.camera.position.set(55,42,110);this.cameraTarget.set(0,22,0);
  }
  private label(text:string,x:number,y:number,z:number,w:number,h:number) {
    const canvas=document.createElement('canvas');canvas.width=text.length<6?192:512;canvas.height=96;
    const c=canvas.getContext('2d')!;c.fillStyle='#ffeab1';c.font='bold 58px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,canvas.width/2,48);
    const sprite=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(canvas),depthTest:true}));sprite.position.set(x,y,z);sprite.scale.set(w,h,1);this.scene.add(sprite);
  }
  private extend() {
    const from=this.builtHeight,to=from+50;
    const add=(geometry:T.BufferGeometry,color:string,x:number,y:number,z:number)=>{const m=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.6}));m.position.set(x,y,z);this.scene.add(m);return m;};
    add(new T.BoxGeometry(17,50,4),'#344771',0,8+from+25,-3.7);
    add(new T.BoxGeometry(12.8,50,.5),'#14243c',0,8+from+25,-1.5);
    for(const x of [-8.3,8.3])add(new T.BoxGeometry(.8,50,1),gold,x,8+from+25,-.7);
    for(const x of [-1.1,1.1])add(new T.CylinderGeometry(.18,.18,50,6),mint,x,8+from+25,0);
    for(let h=from+2;h<=to;h+=2)add(new T.BoxGeometry(2.9,.18,.25),'#dac688',0,8+h,0);
    for(let h=from+5;h<=to;h+=5){
      for(const x of [-7.1,7.1])this.lights.push(add(new T.SphereGeometry(.5,8,6),'#53617b',x,8+h,0));
      add(new T.BoxGeometry(2,.17,.2),'#8496b0',3.9,8+h,-.95);
      if(h%10===0)this.label(String(h*10),5.4,8+h,1,4.6,1.8);
    }
    this.builtHeight=to;
  }
  update(dt:number) {
    this.motion.update(dt);const m=this.motion;
    if(m.phase==='celebrate'&&!this.saved){
      this.saved=true;const isBest=m.score>this.best;
      this.celebration.hidden=false;this.celebration.querySelector('small')!.textContent=isBest?'NEW PERSONAL BEST!':'WHAT A CLIMB!';
      this.celebration.querySelector('strong')!.textContent=m.score.toLocaleString();
      this.celebration.querySelector('span')!.textContent=`${m.peak.toFixed(1)} metres · Turning around!`;
      try {if(isBest)localStorage.setItem('keep-going-tower-best',String(m.score));}catch{/* Optional persistence. */}
      for(const f of this.flakes){f.mesh.visible=true;f.mesh.position.set((Math.random()-.5)*12,8+m.peak,5);f.velocity.set((Math.random()-.5)*30,10+Math.random()*20,Math.random()*15);}
    }
    if(m.phase==='descend')this.celebration.hidden=true;
    this.score.textContent=m.score.toLocaleString();
    this.status.textContent={approach:'Ready… how high can you go?',climb:'Keep answering. Keep climbing!',celebrate:'You did that!',descend:'Wheee! Answers save an exit boost.',exit:'Switching tracks… next adventure!',done:'Off we go!'}[m.phase];
    this.root.querySelector('.tower-foot')!.textContent=['descend','celebrate','exit'].includes(m.phase)?`Exit boost saved: +${m.banked} m/s`:'Correct answers power the climb ↑';
    this.switchRail.rotation.y=T.MathUtils.damp(this.switchRail.rotation.y,m.phase==='descend'||m.phase==='exit'?-.75:0,4,dt);
    while(m.height+55>this.builtHeight)this.extend();
    if(m.phase==='climb'&&m.height>=this.sparkHeight+10){
      this.sparkHeight=Math.floor(m.height/10)*10;
      let n=0;for(const spark of this.sparks)if(spark.life<=0&&n<24){
        const side=n%2?1:-1;spark.life=.8+Math.random()*.7;spark.mesh.visible=true;
        spark.mesh.position.set(side*8,8+m.height,2);spark.velocity.set(side*(4+Math.random()*12),5+Math.random()*11,Math.random()*4);n++;
      }
    }
    for(const spark of this.sparks)if(spark.life>0){spark.life-=dt;spark.velocity.y-=13*dt;spark.mesh.position.addScaledVector(spark.velocity,dt);spark.mesh.scale.setScalar(Math.min(1,spark.life*3));spark.mesh.visible=spark.life>0;}

    for(let i=0;i<this.lights.length;i++){
      const material=this.lights[i].material as T.MeshStandardMaterial;
      const lit=Math.floor(i/2)*5<=m.peak;
      material.color.set(lit?(i%4<2?gold:mint):'#53617b');material.emissive.copy(material.color);material.emissiveIntensity=lit?1.3:0;
    }
    const total=this.approach.getLength(),up=new T.Vector3(0,1,0);
    for(let i=0;i<this.coaches.length;i++){
      const car=this.coaches[i],offset=i*2.8,trainLength=(this.coaches.length-1)*2.8;
      const descending=m.phase==='descend';
      const railHeight=m.height-(descending?trainLength-offset:offset);let point:T.Vector3,tangent:T.Vector3;
      if(m.phase==='exit'||m.phase==='done'||(descending&&railHeight<0)){
        // Reverse travel means the last carriage leads down and out of the junction.
        const pathDistance=descending?-railHeight:m.progress*(this.exit.getLength()+28)+trainLength-offset;
        const t=T.MathUtils.clamp(pathDistance/this.exit.getLength(),0,1);point=this.exit.getPointAt(t);tangent=this.exit.getTangentAt(t);point.addScaledVector(tangent,Math.max(0,pathDistance-this.exit.getLength()));
      } else if(m.phase==='approach'||railHeight<0){
        const t=T.MathUtils.clamp((m.phase==='approach'?m.progress:1)+(m.phase==='approach'?-offset:m.height-offset)/total,0,1);point=this.approach.getPointAt(t);tangent=this.approach.getTangentAt(t);
      }else{point=new T.Vector3(0,8+railHeight,0);tangent=new T.Vector3(0,descending?-1:1,0);}
      const right=new T.Vector3(descending?1:-1,0,0);if(Math.abs(tangent.y)<.98)right.crossVectors(up,tangent).normalize();
      const roof=new T.Vector3().crossVectors(tangent,right).normalize();
      car.position.copy(point).addScaledVector(roof,.35);car.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,roof,tangent));
      if(m.phase==='celebrate'){
        const t=T.MathUtils.smoothstep(m.time,.6,2.5),angle=t*Math.PI;
        const turn=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),angle);
        const pivot=new T.Vector3(0,8+m.height-trainLength/2,.35);
        car.position.sub(pivot).applyQuaternion(turn).add(pivot);car.quaternion.premultiply(turn);
      }
    }
    for(const f of this.flakes)if(f.mesh.visible){f.velocity.y-=12*dt;f.mesh.position.addScaledVector(f.velocity,dt);f.mesh.rotation.x+=dt*3;f.mesh.rotation.z+=dt*2;if(f.mesh.position.y<0)f.mesh.visible=false;}
    const climbing=!['approach','exit','done'].includes(m.phase);
    const targetY=climbing?Math.max(25,8+m.height-4):18;
    const desired=new T.Vector3(climbing?0:48,targetY+(climbing?3:20),climbing?62:110);
    this.camera.position.lerp(desired,1-Math.exp(-dt*2));this.cameraTarget.lerp(new T.Vector3(0,targetY,0),1-Math.exp(-dt*2));this.camera.lookAt(this.cameraTarget);
    const width=this.root.clientWidth,height=this.root.clientHeight;
    if(width&&height){const aspect=width/height;this.camera.aspect=aspect;this.camera.fov=aspect<.8?52:42;this.camera.updateProjectionMatrix();if(width!==this.width||height!==this.height){this.width=width;this.height=height;this.renderer.setSize(width,height,false);}this.renderer.render(this.scene,this.camera);}
  }
  destroy(){this.root.remove();const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();this.scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Sprite){if(o instanceof T.Mesh)geometries.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:[o.material])materials.add(material);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>{if('map' in m)(m.map as T.Texture|null)?.dispose();m.dispose();});this.renderer.dispose();}
}
