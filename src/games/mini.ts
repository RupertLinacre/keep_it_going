import { drawAdventureFallback } from "./adventure-fallback";
import { adventureAt } from "./adventure-worlds";
import { AdventureHud } from "./adventure-hud";
import { drawTailwindSail, sailDeployment } from "./tailwind-sails";
import { RaceSpacing } from "./mini-world";
import { HeightTrack, HEIGHT_PER_ANSWER } from "./height-track";
import { heightGuide, skyLiftBoostEnergy } from "./height-guide";
import { RidePowerups, POWERUPS } from "./ride-powerups";
import { weatherPoint } from "./powerup-weather";
import { PowerupHud } from "./powerup-hud";
import type { RiderRole } from "../multiplayer/identity";
import { rideResistance } from "../difficulty";
import { BaseGame } from "./base";
import { MiniTrack } from "./mini-track";
import { MiniPhysics } from "./mini-physics";
import { MiniView } from "./mini-view";
import { MINI_CARGO_ZOOM_OUT, MINI_MAX_ZOOM_OUT } from "./mini-camera";
import { tiltPoint } from "./mini-tilt";
import { MiniReadouts } from "./mini-readouts";
import { approachingStall, jumpApproach, type JumpApproach } from "./mini-guide";
import { MiniCarriages } from "./mini-carriages";
import { numberPad } from "./input";
import { multiplication } from "../math";
import { questionSequence } from "../questions";
import type { OpponentGhost } from "../multiplayer/ghost";
import { drawRaceFallback } from "../multiplayer/fallback";
import { gradient, line, roundRect, circle } from "../draw";
import { bestRide, record, recordRide } from "../storage";
import {
  isParcelWagon, parcelPresentation, MINI_STARTING_CARTS,
} from "./mini-config";
import type { Host } from "../types";
import { Vector3 } from "three";

export class Mini extends BaseGame {
  readonly track: MiniTrack;
  readonly physics: MiniPhysics;
  readonly carriages: MiniCarriages;
  view?: MiniView;
  a = 3;
  b = 4;
  answer = "";
  private answerFeedback = "";
  private acceptedAnswer?: { a: number; b: number; answer: string; until: number };
  private answerFeedbackUntil = 0;
  lock = 0;
  flash = 0;
  close = false;
  lastImpulse = 0;
  bestStreak = 0;
  longestTrain = MINI_STARTING_CARTS;
  readonly personalBest;
  private stalling = false;
  private guideAt = 0;
  private hudAt = 0;
  private parcelCueAt = 0;
  private recordedAt = 0;
  private jumpBonusUntil = 0;
  private jumpWasRecord = false;
  private approach?: JumpApproach;
  private readouts?: MiniReadouts;
  private readoutsAt = 0;
  private readonly compactHud = typeof window !== "undefined" ? window.matchMedia("(max-width: 800px), (hover: none) and (pointer: coarse)") : undefined;
  private nextQuestion?: () => [number, number];
  opponent?: OpponentGhost;
  riderRole: RiderRole = "host";
  readonly raceSpacing = new RaceSpacing();
  readonly multiplayer: boolean;
  readonly heightMode: boolean;
  readonly remixMode: boolean;
  readonly powerups?: RidePowerups;
  private adventureHud?: AdventureHud;
  private powerHud?: PowerupHud;
  private answerWasLift = false;
  readonly recordId: "mini" | "height" | "remix";
  private pendingLifts = 0;
  constructor(host: Host, seed?: number, options: { tables?: number[]; questionSeed?: number; multiplayer?: boolean; riderRole?: RiderRole; heightMode?: boolean; remixMode?: boolean } = {}) {
    super(host);
    this.heightMode = !!options.heightMode && !options.multiplayer;
    this.remixMode = !!options.remixMode;
    this.recordId = this.remixMode ? "remix" : this.heightMode ? "height" : "mini";
    this.riderRole = options.riderRole ?? "host";
    this.multiplayer = !!options.multiplayer;
    this.personalBest = bestRide(host.difficulty, this.recordId);
    if (options.tables) this.nextQuestion = questionSequence(options.tables, options.questionSeed ?? Math.floor(Math.random() * 0xffffffff));
    this.track = this.heightMode || (this.remixMode && !this.multiplayer)
      ? new HeightTrack(seed, { generative: this.remixMode }) : new MiniTrack(seed, { generative: this.remixMode });
    this.physics = new MiniPhysics(this.track, rideResistance(host.difficulty));
    this.carriages = new MiniCarriages(this.track, this.physics.options.gravity);
    this.carriages.sample = distance => this.physics.sample(distance);
    if (this.remixMode) this.powerups = new RidePowerups(this.track.seed, host.difficulty, this.multiplayer);
    this.next();
    this.hud();
    try {
      this.setup();
      if (options.multiplayer && this.view) { this.view.multiplayer = true; this.view.riderRole = this.riderRole; }
    } catch (error) {
      console.warn("WebGL unavailable; using the miniature side view.", error);
    }
  }
  setup() {
    if (this.remixMode) this.adventureHud = new AdventureHud(this.host.stage);
    if (!this.heightMode && !this.remixMode) this.readouts = new MiniReadouts(this.host.stage);
    if (this.remixMode && !this.multiplayer) this.powerHud = new PowerupHud(this.host.stage);
    this.view = new MiniView(this.host.stage, this.track, { multiplayer: this.multiplayer, role: this.riderRole, spacing: this.raceSpacing });
  }
  get travelled() {
    return this.physics.distance - this.physics.options.initialDistance;
  }
  get cartCount() {
    return this.carriages.coaches.length;
  }
  get liftingAnswers() { return this.heightMode || this.powerups?.active === "lift"; }
  next() {
    [this.a, this.b] = this.nextQuestion?.() ?? multiplication(this.host.difficulty);
    this.answer = "";
    this.panel();
  }
  panel() {
    const shown = this.acceptedAnswer ?? this;
    const feedback = this.answerFeedback === "incorrect" ? "Try again" : this.answerFeedback === "correct"
      ? this.answerWasLift ? `↑ +${HEIGHT_PER_ANSWER} m ${this.pendingLifts ? "saved for landing" : this.lastImpulse > 0 ? "track lift + boost" : "track lift"}` : "Correct!" : "";
    this.host.panel(`
      <div class="prompt" data-feedback="${this.answerFeedback}">
        <h2>${shown.a} × ${shown.b} = <span class="answer-display" role="status">${shown.answer || "?"}</span></h2>
        <p class="answer-feedback" role="status">${feedback}</p>
        ${this.liftingAnswers ? '<p class="height-guide">Answer early to raise your track</p>' : ''}
        <p class="keyboard-hint">${this.liftingAnswers ? this.remixMode ? "Answers raise this section; struggling climbs also get a boost." : "Correct answers raise this section. Gravity supplies the speed." : "Type the correct answer to boost automatically"}</p>
      </div><div class="coaster-controls">${numberPad()}<button class="camera-switch" data-action="camera"><span>${this.close ? "Close side view" : "Miniature side view"}</span><kbd>C</kbd></button></div>`);
  }
  hud() {
    const bestJump = Math.max(this.personalBest.jump, this.physics.bestJump);
    this.approach = this.ended || this.heightMode || this.remixMode ? undefined : jumpApproach(this.track, this.physics);
    if (this.powerups) this.powerHud?.render(this.powerups, this.physics.distance);
    if (this.track instanceof HeightTrack && this.liftingAnswers) {
      const guide = this.host.stage.parentElement?.querySelector(".height-guide");
      if (guide) guide.textContent = this.ended ? "The ride stopped. Earn height earlier next time." : heightGuide(this.track, this.physics);
    }
    if (this.ended) this.stalling = false;
    else if (this.elapsed >= this.guideAt) {
      this.stalling = approachingStall(this.physics);
      this.guideAt = this.elapsed + 0.25;
    }
    this.host.stage.parentElement?.classList.toggle("needs-boost", this.stalling);
    const stats = [
      { label: "SPEED", value: `${(this.physics.velocity * 3.6).toFixed(0)} km/h` },
      { label: "DISTANCE", value: `${Math.floor(this.travelled)} m` },
      { label: "YOUR TRAIN", value: `${this.cartCount} ${this.cartCount === 1 ? "coach" : "coaches"}` },
      this.track instanceof HeightTrack
        ? { label: "TRACK RAISED", value: `+${this.track.elevation(this.physics.distance).toFixed(0)} m` }
        : { label: "BEST JUMP", value: bestJump ? `${bestJump.toFixed(1)} m` : "—" },
    ];
    this.host.stats(this.remixMode ? stats.slice(0, 2) : stats);
  }
  action(value: string) {
    if (this.ended) return;
    if (value === "camera") {
      this.close = !this.close;
      this.panel();
      return;
    }
    if (value === "clear") {
      this.answer = "";
      this.acceptedAnswer = undefined;
      this.answerFeedback = "";
      this.panel();
      return;
    }
    if (value === "submit" && this.lock > 0) return;
    // Let fast typists move on early without dropping their next digit.
    if (/^digit:\d$/.test(value) || value === "back") this.acceptedAnswer = undefined;
    if (/^digit:\d$/.test(value) && this.answer.length < 3) {
      this.answer += value.slice(6);
      this.answerFeedback = "";
    }
    if (value === "back") {
      this.answer = this.answer.slice(0, -1);
      this.answerFeedback = "";
    }
    // A complete correct entry is its own submission, including corrections
    // made with Backspace. Partial answers remain editable and aren't mistakes.
    const edited = /^digit:\d$/.test(value) || value === "back";
    if (this.answer && (value === "submit" || (edited && Number(this.answer) === this.a * this.b))) {
      this.answerFeedbackUntil = this.elapsed + 0.8;
      if (Number(this.answer) === this.a * this.b) {
        this.answerFeedback = "correct";
        this.answerWasLift = this.liftingAnswers;
        if (this.track instanceof HeightTrack && this.liftingAnswers) {
          const rescue = this.remixMode ? skyLiftBoostEnergy(this.track, this.physics) : 0;
          if (this.physics.flight) this.pendingLifts++;
          else this.track.raise(this.physics.distance);
          this.lastImpulse = rescue ? this.physics.impulse(this.physics.options.mass * (Math.sqrt(this.physics.velocity**2 + 2*rescue)-this.physics.velocity)) : 0;
        } else this.lastImpulse = this.physics.impulse();
        this.flash = 0.5;
        this.good(
          this.liftingAnswers ? `↑ +${HEIGHT_PER_ANSWER} m of track height` : `${this.a} × ${this.b} = ${this.a * this.b}. Big forward boost!`,
        );
        this.bestStreak = Math.max(this.bestStreak, this.combo);
        this.guideAt = 0;
        this.lock = 0.18;
        // Boost now, but briefly show the complete equation before revealing
        // the next question. This is presentation only, not an input lock.
        this.acceptedAnswer = { a: this.a, b: this.b, answer: this.answer, until: this.elapsed + 0.35 };
        this.next();
      } else {
        this.answerFeedback = "incorrect";
        this.bad(
          `Try ${this.a} equal groups of ${this.b}. Keep going!`,
        );
        this.answer = "";
        this.lock = 0.2;
      }
    }
    this.panel();
    this.hud();
  }
  key(key: string) {
    if (/^\d$/.test(key)) this.action(`digit:${key}`);
    if (key === "Enter") this.action("submit");
    if (key === "Escape") this.action("clear");
    if (key === "Backspace") this.action("back");
    if (key.toLowerCase() === "c") this.action("camera");
  }
  private endRide(water: boolean) {
    this.powerups?.finish(this.physics, this.carriages);
    this.hud();
    if (water) this.carriages.splash(this.physics.sample(this.physics.distance));
    this.host.sound("bad");
    record(this.recordId, this.host.difficulty, this.score);
    recordRide(this.host.difficulty, this.travelled, this.physics.bestJump, this.recordId);
    const stopped = this.heightMode ? "The train ran out of momentum. Raise your track before the next climb." : water ? "Splash! Build more speed before the water jump." : "The train stopped. A well-timed answer gives it another push.";
    const journey = this.remixMode ? adventureAt(this.track.sectionAt(this.physics.distance).start) : undefined;
    const explored = journey ? journey.lap ? ` All four worlds explored! Adventure ${journey.lap+1} reached.` : ` You reached ${journey.world.name}!` : "";
    this.finish(false, stopped + explored, {
      distance: this.travelled, bestDistance: Math.max(this.personalBest.distance, this.travelled),
      bestJump: this.physics.bestJump, longestTrain: this.longestTrain, peakSpeed: this.physics.peakSpeed,
      bestStreak: this.bestStreak, newDistanceRecord: this.travelled > this.personalBest.distance,
      newScoreRecord: this.score > this.personalBest.score,
    });
  }
  update(dt: number) {
    this.step(dt);
    if (this.acceptedAnswer && this.elapsed >= this.acceptedAnswer.until) {
      this.acceptedAnswer = undefined;
      this.panel();
    }
    if (this.answerFeedback && this.elapsed >= this.answerFeedbackUntil) {
      this.answerFeedback = "";
      this.panel();
    }
    this.lock -= dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.ended) {
      this.carriages.update(dt, this.physics.distance, 0, false);
      return;
    }
    this.track.ensure(this.physics.distance + this.physics.velocity * dt,
      this.multiplayer ? Math.max(600, this.physics.velocity * 14) : 230);
    if (this.powerups?.update(dt, this.track, this.physics, this.carriages)) {
      this.panel(); this.guideAt = 0;
      const active = this.powerups.active;
      this.host.feedback(active ? `${POWERUPS[active].name} · ${POWERUPS[active].description}` : "Power-up complete · normal boosts restored");
      this.host.sound(active ? "beat" : "good");
    }
    if (this.track instanceof HeightTrack) {
      // A free-flying train cannot be lifted by its rails. Save those answers
      // until it lands, and keep the landing geometry still during the flight.
      if (!this.physics.flight) {
        while (this.pendingLifts > 0) { this.track.raise(this.physics.distance); this.pendingLifts--; }
        this.track.advance(dt);
      }
    }
    let shed = false;
    const previousSpills = this.carriages.spilled;
    const previousImpacts = this.carriages.impacts;
    const previousFloods = this.carriages.floodEntries;
    const previousArrivals = this.carriages.arrived;
    const previousJumps = this.physics.jumps;
    const previousBestJump = this.physics.bestJump;
    this.physics.update(dt, (step) => {
      shed = this.carriages.update(step, this.physics.distance, this.physics.velocity) || shed;
      this.longestTrain = Math.max(this.longestTrain, this.cartCount);
      if (this.physics.crashed || this.physics.held) {
        this.endRide(this.physics.crashed);
        return false;
      }
    });
    if (this.ended) return;
    if (this.physics.jumps > previousJumps) {
      const distance = this.physics.lastJumpDistance;
      const bonus = Math.round(distance * 10);
      this.score += bonus;
      this.jumpBonusUntil = this.elapsed + 4;
      this.jumpWasRecord = distance > Math.max(previousBestJump, this.personalBest.jump) + 0.05;
      record(this.recordId, this.host.difficulty, this.score);
      recordRide(this.host.difficulty, this.travelled, this.physics.bestJump, this.recordId);
      this.host.feedback(`${distance.toFixed(1)} m jump! +${bonus} bonus points`);
      this.host.sound("win");
    } else if (this.carriages.floodEntries > previousFloods) {
      this.host.feedback("Splash zone! Keep answering to push through the water.");
      this.host.sound("jump");
    } else if (shed) {
      this.host.feedback("The tail coupling snapped! One coach broke away.", false);
      this.host.sound("bad");
    } else if (this.carriages.arrived > previousArrivals) {
      this.host.feedback(`A coach caught up! ${this.cartCount} coaches aboard.`);
      this.host.sound("jump");
    } else if (this.carriages.spilled > previousSpills && this.elapsed >= this.parcelCueAt) {
      this.host.feedback("Parcels away! Fresh cargo is on its way.");
      this.parcelCueAt = this.elapsed + 1.2;
    }
    if (this.carriages.impacts > previousImpacts) this.host.sound("bad");
    if (this.elapsed >= this.hudAt) {
      this.hud();
      this.hudAt = this.elapsed + 0.1;
    }
    if (this.elapsed >= this.recordedAt + 10) {
      record(this.recordId, this.host.difficulty, this.score);
      recordRide(this.host.difficulty, this.travelled, this.physics.bestJump, this.recordId);
      this.recordedAt = this.elapsed;
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    this.adventureHud?.render(this.track,this.physics.distance,this.elapsed);
    if (this.view) {
      ctx.clearRect(0, 0, 1100, 570);
      this.view.render(
        this.physics.renderDistance,
        this.physics.velocity,
        this.flash,
        this.close,
        this.cartCount,
        this.carriages,
        this.elapsed,
        this.physics.renderAlpha,
        this.opponent?.sample(),
        this.powerups,
      );
    } else if (this.opponent) drawRaceFallback(this, ctx);
    else this.fallback(ctx);
    if (!this.heightMode && !this.remixMode && !this.compactHud?.matches && this.elapsed >= this.readoutsAt) {
      this.readoutsAt = this.elapsed + 0.1;
      const reloading = this.carriages.coaches.filter(coach => coach.refill > 0);
      this.readouts?.render({
        held: this.ended,
        incoming: !!this.carriages.incoming,
        jump: this.physics.flight && !this.ended
          ? { distance: this.physics.flight.position.x - this.physics.flight.startX, landed: false, record: false }
          : this.elapsed < this.jumpBonusUntil ? { distance: this.physics.lastJumpDistance, landed: true, record: this.jumpWasRecord } : undefined,
        correct: this.correct,
        score: this.score,
        streak: this.combo,
        personalBest: this.personalBest.distance,
        distance: this.travelled,
        stalling: this.stalling,
        approach: this.approach,
        cargo: this.carriages.coaches.reduce((sum, coach) => sum + coach.cargo, 0),
        refillIn: reloading.length ? Math.min(...reloading.map(coach => coach.refill)) : undefined,
        stress: Math.max(0, ...this.carriages.coaches.map(coach => coach.stress)),
        feature: this.track.sectionAt(this.physics.distance).kind,
        turns: this.track.sectionAt(this.physics.distance).turns,
        boost: this.flash > 0 ? Math.round(this.lastImpulse * 3.6) : null,
      });
    }
    this.drawParticles(ctx);
  }
  private fallback(ctx: CanvasRenderingContext2D) {
    const power = this.powerups?.active, theme = power ? POWERUPS[power] : undefined;
    const world=this.remixMode?adventureAt(this.track.sectionAt(this.physics.distance).start).world:undefined;
    gradient(ctx, world?.sky ?? theme?.sky ?? "#e1eee4", world?.ground ?? "#f5efd9");
    const frame = this.physics.sample(this.physics.distance);
    const baseScale = this.close ? 28 : 19;
    let scale = baseScale;
    let centerX = frame.position.x + 200 / scale;
    let centerY = Math.max(0, frame.position.y - 10) + 65 / scale;
    const normalX = centerX, normalY = centerY;
    const tilt = this.powerups?.tilt ?? 0, pivot = new Vector3(normalX, normalY, 0);
    const subjects = [
      frame.position,
      ...this.carriages.poses(this.physics.distance).slice(0, MINI_STARTING_CARTS).filter(p => (p.frame.airborne || this.track instanceof HeightTrack) && p.coach !== this.carriages.incoming).map(p => p.frame.position),
    ].map(p => tiltPoint(p, pivot, tilt));
    for (const p of this.carriages.cameraSubjects(frame.position)) {
      const point = tiltPoint(p, pivot, tilt);
      // As in the 3D view, optional debris cannot spend the train's zoom budget.
      point.x = Math.max(normalX - 500/baseScale*MINI_CARGO_ZOOM_OUT + 3, Math.min(normalX + 500/baseScale*MINI_CARGO_ZOOM_OUT - 3, point.x));
      point.y = Math.max(normalY - 195/baseScale*MINI_CARGO_ZOOM_OUT + 3, Math.min(normalY + 195/baseScale*MINI_CARGO_ZOOM_OUT - 3, point.y));
      subjects.push(point);
    }
    if (subjects.length) {
      const left = Math.min(centerX - 500 / scale, ...subjects.map(p => p.x - 3));
      const right = Math.max(centerX + 500 / scale, ...subjects.map(p => p.x + 3));
      const bottom = Math.min(centerY - 195 / scale, ...subjects.map(p => p.y - 3));
      const top = Math.max(centerY + 195 / scale, ...subjects.map(p => p.y + 3));
      scale = Math.max(baseScale / MINI_MAX_ZOOM_OUT, Math.min(scale, 1000 / (right - left), 390 / (top - bottom)));
      const panX = 500 / scale - 500 / baseScale, panY = 195 / scale - 195 / baseScale;
      centerX = Math.max(normalX - panX, Math.min(normalX + panX, (left + right) / 2));
      centerY = Math.max(normalY - panY, Math.min(normalY + panY, (bottom + top) / 2));
    }
    const project = (x: number, y: number): [number, number] => [
      550 + (x - centerX) * scale,
      300 - (y - centerY) * scale,
    ];
    if (theme && power !== "tilt") {
      ctx.save(); ctx.globalAlpha = .4;
      for (let i = 0; i < 120; i++) {
        const p = weatherPoint(i, this.track.seed, power!, this.elapsed, frame.position);
        line(ctx, [project(p.x,p.y),project(p.x+p.dx,p.y+p.dy)], theme.color, 2);
      }
      ctx.restore();
    }
    ctx.save();
    const [pivotX, pivotY] = project(normalX, normalY);
    ctx.translate(pivotX, pivotY); ctx.rotate(tilt); ctx.translate(-pivotX, -pivotY);
    // A visible board edge in the side view gives the same downhill reference
    // as the 3D landscape, and rotates together with rails and scenery.
    const [boardX, boardY] = project(centerX - 1600/scale, 0);
    ctx.fillStyle = world?.earth ?? "#cfae8c"; ctx.fillRect(boardX, boardY, 3200, 16);
    ctx.fillStyle = world?.ground ?? "#d5e3c3"; ctx.fillRect(boardX, boardY - 5, 3200, 5);
    ctx.fillStyle = "#f7efdb"; ctx.fillRect(boardX, boardY, 3200, 2);
    if(this.remixMode)drawAdventureFallback(ctx,this.track,this.physics.distance,this.elapsed,p=>project(p.x,p.y),scale,0,this.carriages.gravity);
    if (this.powerups?.gate) {
      const gate = this.powerups.gate, f = this.track.sample(gate.distance), info = POWERUPS[gate.kind];
      const [x,y] = project(f.position.x, f.position.y+2.4);
      ctx.save(); ctx.strokeStyle = info.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x,y,2.5*scale,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle = info.color; ctx.font = "bold 28px Arial"; ctx.textAlign = "center"; ctx.fillText(info.icon,x,y-2.5*scale-8); ctx.restore();
    }
    for (const section of this.track.sections) {
      if (section.kind === "jump") {
        const [x, y] = project(section.origin.x + section.width * 0.2, 0.4);
        roundRect(ctx, x, y, section.width * 0.44 * scale, 18, 4, "#58b9c9");
      }
      if (section.kind === "splash") {
        const [x, y] = project(section.origin.x + section.width * .14, section.waterLevel);
        roundRect(ctx, x - 4, y - 2, section.width * .72 * scale + 8, .65*scale, 7, "#d7c7a3");
        roundRect(ctx, x, y, section.width * .72 * scale, .52*scale, 5, "#55bccc");
        for (let i = 0; i < 14; i++) line(ctx, [[x + i * section.width*.05*scale, y + 3], [x + (i * section.width*.05 + 1.5)*scale, y + 3]], "#c5f4f1", 2);
      }
      let points: [number, number][] = [];
      const drawRail = () => { if (points.length > 1) { line(ctx, points, world?.rail ?? theme?.color ?? "#78a296", 8); line(ctx, points, "#f3d68f", 3); } points = []; };
      for (let i = 0; i < section.frames.length; i += 3) {
        if (!section.hasRail(section.start + section.distances[i])) { drawRail(); continue; }
        const f = section.frames[i]; points.push(project(f.position.x, f.position.y));
      }
      drawRail();
    }
    for (const link of this.carriages.links(this.physics.distance))
      line(ctx, [project(link.start.x, link.start.y), project(link.end.x, link.end.y)], link.stress > 0.75 ? "#e67657" : link.stress > 0.4 ? "#efb750" : "#56786f", Math.max(2, scale * 0.16));
    const palette = ["#d7e99b", "#e9a8a7", "#9fbddd", "#c6b0e5", "#eec987"];
    for (const { coach, frame: cart } of this.carriages.poses(this.physics.distance).reverse()) {
      const index = coach.id;
      const [x, y] = project(cart.position.x, cart.position.y);
      if (x < -50 || x > 1150) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.atan2(cart.tangent.y, cart.tangent.x));
      ctx.scale(scale / baseScale, scale / baseScale);
      roundRect(
        ctx,
        -18,
        isParcelWagon(index) ? -14 : -25,
        36,
        isParcelWagon(index) ? 11 : 22,
        4,
        palette[index % palette.length],
        "#779486",
      );
      for (const [i, parcel] of parcelPresentation(coach.cargo, coach.cargoAge, this.remixMode ? 8 : undefined).entries()) {
        if (parcel.scale <= 0) continue;
        const x = parcel.z > 0 ? 2 : -15, y = -27 - (parcel.y - 1) * 20;
        ctx.save(); ctx.translate(x + 6.5, y + 6.5); ctx.scale(parcel.scale, parcel.scale);
        roundRect(ctx, -6.5, -6.5, 13, 13, 1, (coach.dynamite ?? 0) & (1 << i) ? "#d44739" : "#c89560");
        roundRect(ctx, -1.5, -6.5, 3, 13, 0, "#f9e8b9");
        ctx.restore();
      }
      drawTailwindSail(ctx, sailDeployment(this.powerups), this.elapsed, index, palette[index % palette.length]);
      circle(ctx, -10, 0, 4, "#738779");
      circle(ctx, 10, 0, 4, "#738779");
      ctx.restore();
    }
    for (const cart of this.carriages.flights) {
      const [x, y] = project(cart.position.x, cart.position.y);
      const direction = new Vector3(0, 0, -1).applyQuaternion(cart.rotation);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.atan2(direction.y, direction.x));
      ctx.scale(scale / baseScale, scale / baseScale);
      roundRect(ctx, -18, -25, 36, 22, 4, palette[cart.colorIndex % palette.length], "#779486");
      circle(ctx, -10, 0, 4, "#738779");
      circle(ctx, 10, 0, 4, "#738779");
      ctx.restore();
    }
    for (const parcel of this.carriages.parcels) {
      const [x, y] = project(parcel.position.x, parcel.position.y);
      const size = scale * 0.68;
      ctx.save(); ctx.translate(x, y); ctx.rotate(parcel.age * 2);
      roundRect(ctx, -size / 2, -size / 2, size, size, 1, parcel.dynamite ? "#d44739" : "#c89560");
      roundRect(ctx, -size / 10, -size / 2, size / 5, size, 0, "#f9e8b9");
      ctx.restore();
    }
    for (const explosion of this.carriages.explosions) {
      if (explosion.flood && explosion.age < 1.1) {
        const [x, y] = project(explosion.position.x, explosion.position.y);
        const rise = Math.sin(Math.PI * explosion.age/1.1) * explosion.flood.strength;
        ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = "#bdeef3";
        for (const side of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + side*2*scale, y - rise*10*scale, x + side*6*scale, y);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
      if (explosion.age < 0.3 && !explosion.water) {
        const [x, y] = project(explosion.position.x, explosion.position.y);
        circle(ctx, x, y, 2.2 * scale * (1 - explosion.age / 0.3), "#ffe6a6");
      }
      for (const [i, particle] of explosion.particles.entries()) {
        const [x, y] = project(particle.position.x, particle.position.y);
        const size = particle.size * 2 * scale * (1 - explosion.age / 2);
        roundRect(ctx, x - size / 2, y - size / 2, size, size, 1,
          explosion.water ? "#58b9c9" : i % 3 ? palette[explosion.colorIndex % palette.length] : "#ffa451");
      }
    }
    ctx.restore();
  }
  destroy() {
    record(this.recordId, this.host.difficulty, this.score);
    recordRide(this.host.difficulty, this.travelled, this.physics.bestJump, this.recordId);
    this.powerHud?.destroy();
    this.adventureHud?.destroy();
    this.readouts?.destroy();
    this.view?.destroy();
  }
}
