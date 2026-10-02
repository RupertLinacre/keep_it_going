import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import { FairgroundLights } from './world-lighting';
import { nightScenery, star } from './world-night';
import { seededRandom } from './mini-rail';

const BASE = new T.Vector3(50, 8, -14);
const CHUNK = 32;
const BULBS = ['#ffc876', '#ed97c6', '#9cdfd4', '#b8a3f5'];

type TowerChunk = { group: T.Group; fill: T.Mesh[]; numerals: T.Texture; numberMaterial: T.Material };

/** A fairground attraction made with the same scenery batches and light shader
 * as Starlight Carnival. Only the base and a moving window of its endless meter
 * exist at once, including the number textures. */
export class StrengthTowerModel {
  readonly group = new T.Group();
  private readonly solid = new T.MeshStandardMaterial({ vertexColors: true, roughness: .92, flatShading: true });
  private readonly lights = new FairgroundLights();
  private readonly progressMaterial = new T.MeshBasicMaterial({ color: '#b7f4dd' });
  private readonly chunks = new Map<number, TowerChunk>();
  private readonly worldEngine = new T.Vector3();
  private readonly start = new T.Vector3();
  private readonly finish = new T.Vector3();

  constructor() {
    this.group.name = 'starlight-strength-tower';
    const court = new WorldModel();
    // Exact scenery from the carnival: prize stalls, candy-floss and lights.
    // The middle is left clear for the climb and both branches of the junction.
    nightScenery(court, 8, -31, 14, seededRandom(8541), 2);
    nightScenery(court, 94, -33, 14, seededRandom(8542), 1);
    nightScenery(court, 24, -53, -44, seededRandom(8543), 0);
    for (const x of [31, 69]) {
      court.add(G.pole, '#68728d', [x, .12, -18], [4.6, .24, 4.6]);
      court.add(G.pole, '#af95a8', [x, .34, -18], [3.8, .22, 3.8]);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        court.add(G.round, BULBS[i % 4], [x + Math.cos(a) * 3.55, .64, -18 + Math.sin(a) * 3.55], [.17, .17, .17], [], true, i * .6);
      }
      // A little striped mallet on a brass stand evokes the arcade game.
      court.add(G.pole, '#dbc096', [x, 2.1, -18], [.17, 3.5, .17], [0, 0, x < 50 ? -.25 : .25]);
      court.add(G.pole, '#c088ad', [x + (x < 50 ? .42 : -.42), 3.84, -18], [.77, 2.5, .77], [0, 0, Math.PI / 2]);
      for (const dx of [-.92, .92]) court.add(G.pole, '#ead1a8', [x + dx + (x < 50 ? .42 : -.42), 3.84, -18], [.8, .12, .8], [0, 0, Math.PI / 2]);
    }
    // A shallow sculpted foundation, behind the rail entrance rather than across it.
    court.add(G.box, '#626683', [50, .27, -18.7], [15.5, .54, 6.2]);
    court.add(G.box, '#c3a3b7', [50, .67, -18.7], [14.3, .26, 5.4]);
    court.add(G.box, '#ecd0a6', [50, .9, -18.7], [13.2, .2, 4.8]);
    court.add(G.box, '#645473', [50, 4.1, -17.1], [10.8, 6.2, 2.8]);
    for (const x of [44.9, 55.1]) {
      court.add(G.pole, '#e1c3a7', [x, 4.2, -15.5], [.27, 6.5, .27]);
      court.add(G.pole, '#a6dbd1', [x, 1.4, -15.5], [.5, .6, .5]);
      court.add(G.pole, '#e1c3a7', [x, 7.3, -15.5], [.5, .28, .5]);
      star(court, x, 4.8, -15.02, .73, '#ffe0a3');
    }
    // Short festoons join the attraction to its two courts without crossing the track.
    for (const side of [-1, 1]) {
      let previous: T.Vector3 | undefined;
      for (let i = 0; i <= 10; i++) {
        const p = new T.Vector3(50 + side * (6 + i * 1.8), 7.4 - Math.sin(i * Math.PI / 10) * 2.3, -20);
        if (previous) court.beam('#a895af', previous, p, .038);
        court.add(G.round, BULBS[i % 4], [p.x, p.y - .2, p.z], [.17, .24, .17], [], true, i * .5);
        previous = p;
      }
    }
    this.group.add(court.finish(this.solid, this.lights));
    this.ensureChunks(0);
  }

  private createChunk(index: number): TowerChunk {
    const bottom = index * CHUNK, y0 = BASE.y + bottom;
    const model = new WorldModel();
    // A recessed centre and delicately ribbed sides make a substantial model,
    // rather than a flat blue sign. The cream edging catches the carnival light.
    model.add(G.box, '#60536f', [50, y0 + CHUNK / 2, -16.55], [10.3, CHUNK, 1.25]);
    model.add(G.box, '#343951', [49.05, y0 + CHUNK / 2, -15.82], [5.75, CHUNK, .3]);
    model.add(G.box, '#796381', [53.03, y0 + CHUNK / 2, -15.8], [2.03, CHUNK, .32]);
    for (const side of [-1, 1]) {
      const x = 50 + side * 5.15;
      model.add(G.pole, '#e3c6a2', [x, y0 + CHUNK / 2, -15.45], [.22, CHUNK, .22]);
      model.add(G.box, '#b49ec4', [x + side * .38, y0 + CHUNK / 2, -16.27], [.32, CHUNK, 1.05]);
      for (let j = 0; j < 8; j++) {
        const y = y0 + j * 4 + 2;
        model.add(G.pole, j % 2 ? '#aadfd1' : '#d7a6c1', [x, y, -15.45], [.29, 2.6, .29]);
        model.add(G.pole, '#ead2ad', [x, y + 1.37, -15.45], [.38, .16, .38]);
        model.add(G.pole, '#ead2ad', [x, y - 1.37, -15.45], [.38, .16, .38]);
      }
      for (let j = 0; j < 16; j++) {
        const y = y0 + j * 2 + 1;
        model.add(G.pole, '#b29cae', [x - side * .53, y, -15.1], [.29, .13, .29], [Math.PI / 2, 0, 0]);
        model.add(G.round, BULBS[(j + index * 2) % 4], [x - side * .53, y, -14.94], [.2, .2, .2], [], true, (bottom + j * 2) * .12);
      }
      // Small marquee stars give each scoring tier a recognisable silhouette.
      for (const at of [8, 24]) {
        const y = y0 + at;
        model.add(G.ring, '#a991b5', [x + side * .74, y, -15.42], [.88, .88, .88]);
        star(model, x + side * .74, y, -15.34, .62, BULBS[(index + at / 8) % 4]);
      }
    }
    // The exact rail gauge and sleeper proportions used by the main ride.
    for (const x of [-.57, .57]) model.add(G.pole, '#70e5df', [50 + x, y0 + CHUNK / 2, -14], [.095, CHUNK, .095], [], true);
    for (let y = 0; y < CHUNK; y += 1.25) {
      model.add(G.box, '#789f9d', [50, y0 + y, -14.1], [1.55, .16, .2]);
      if (Math.floor(y * 4) % 10 === 0) {
        this.start.set(50, y0 + y, -14.2); this.finish.set(50, y0 + y, -15.66);
        model.beam('#8f85a2', this.start, this.finish, .1);
      }
    }
    for (let j = 0; j < 16; j++) {
      const y = y0 + j * 2;
      model.add(G.box, j % 4 === 0 ? '#ffe3b7' : '#b5a2b7', [51.52, y, -15.5], [j % 4 === 0 ? .95 : .4, .085, .06]);
      if (j % 4 === 0) model.add(G.box, '#58475f', [53.1, y + .01, -15.58], [2.32, 1.56, .06]);
    }
    const group = model.finish(this.solid, this.lights);
    const fill: T.Mesh[] = [];
    for (const side of [-1, 1]) {
      const beam = new T.Mesh(new T.BoxGeometry(.09, 1, .11), this.progressMaterial);
      beam.position.set(50 + side * 4.04, y0, -15.43);
      beam.visible = false; group.add(beam); fill.push(beam);
    }
    const { mesh, texture, material } = this.numbers(bottom);
    group.add(mesh); this.group.add(group);
    return { group, fill, numerals: texture, numberMaterial: material };
  }

  /** Four numbers share one canvas, one texture and one draw call per chunk. */
  private numbers(bottom: number) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffe5b8'; ctx.font = '600 76px Outfit, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const positions: number[] = [], uvs: number[] = [];
    for (let i = 0; i < 4; i++) {
      const score = Math.round((bottom + i * 8) * 10);
      // Fit even six-digit scores without spilling out of the numbered panel.
      ctx.fillText(score.toLocaleString('en-GB'), 128, i * 128 + 64, 236);
      const y = BASE.y + bottom + i * 8, x = 53.1, w = 2.16, h = 1.15, z = -15.51;
      positions.push(x-w/2,y-h/2,z, x+w/2,y-h/2,z, x+w/2,y+h/2,z,
        x-w/2,y-h/2,z, x+w/2,y+h/2,z, x-w/2,y+h/2,z);
      const a = 1 - (i + 1) / 4, b = 1 - i / 4;
      uvs.push(0,a, 1,a, 1,b, 0,a, 1,b, 0,b);
    }
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    const material = new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, alphaTest: .025 });
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    return { mesh: new T.Mesh(geometry, material), texture, material };
  }

  private ensureChunks(height: number) {
    const center = Math.max(0, Math.floor(height / CHUNK));
    const wanted = new Set([0]);
    for (let index = Math.max(0, center - 2); index <= center + 2; index++) wanted.add(index);
    for (const [index, chunk] of this.chunks) if (!wanted.has(index)) {
      chunk.group.removeFromParent();
      this.disposeGeometry(chunk.group); chunk.numerals.dispose(); chunk.numberMaterial.dispose();
      this.chunks.delete(index);
    }
    for (const index of wanted) if (!this.chunks.has(index)) this.chunks.set(index, this.createChunk(index));
  }

  update(height: number, peak: number, time: number, engineLocal: T.Vector3) {
    this.ensureChunks(height);
    this.lights.clock.value = time;
    this.group.updateWorldMatrix(true, false);
    this.worldEngine.copy(engineLocal).applyMatrix4(this.group.matrixWorld);
    this.lights.trains.value[0].copy(this.worldEngine);
    for (const [index, chunk] of this.chunks) {
      const lit = T.MathUtils.clamp(peak - index * CHUNK, 0, CHUNK);
      for (const beam of chunk.fill) {
        beam.visible = lit > .02;
        beam.scale.y = Math.max(.01, lit);
        beam.position.y = BASE.y + index * CHUNK + lit / 2;
      }
    }
  }

  private disposeGeometry(group: T.Group) {
    group.traverse(object => { if (object instanceof T.Mesh) object.geometry.dispose(); });
  }

  destroy() {
    this.group.removeFromParent();
    this.disposeGeometry(this.group);
    for (const chunk of this.chunks.values()) { chunk.numerals.dispose(); chunk.numberMaterial.dispose(); }
    this.chunks.clear();
    this.solid.dispose(); this.lights.dispose(); this.progressMaterial.dispose();
    this.group.clear();
  }
}
