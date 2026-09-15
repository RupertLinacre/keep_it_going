import { adventureAt, WORLDS } from "./adventure-worlds";
import type { MiniTrack } from "./mini-track";

export class AdventureHud {
  readonly element = document.createElement("div");
  private announcement = document.createElement("div");
  private stage = -1;
  private entered = 0;
  constructor(host: HTMLElement) {
    this.element.className = "world-hud";
    this.element.innerHTML = '<span class="world-symbol" aria-hidden="true"></span><span class="world-name"></span><span class="world-stops" aria-hidden="true">'+WORLDS.map(()=>'<i></i>').join('')+'</span>';
    this.announcement.className = "world-welcome";
    this.announcement.setAttribute("role", "status");
    host.append(this.element, this.announcement);
  }
  render(track: MiniTrack, distance: number, time: number) {
    const {world,index,stage,lap}=adventureAt(Math.max(0,track.sectionAt(distance).start));
    if(stage!==this.stage) {
      this.stage=stage;this.entered=time;
      this.element.querySelector('.world-symbol')!.textContent=world.icon;
      this.element.querySelector('.world-name')!.textContent=world.name;
      this.element.setAttribute("aria-label", `World ${index+1}: ${world.name}, adventure ${lap+1}`);
      this.element.querySelectorAll('i').forEach((dot,i)=>dot.classList.toggle('visited',i<=index));
      this.announcement.innerHTML=`<small>${lap ? `ADVENTURE ${lap+1} · ` : ''}WORLD ${index+1} OF 4</small><strong>${world.name}</strong><span>${world.invitation}</span>`;
    }
    this.announcement.style.opacity=String(Math.max(0,Math.min(1,(3.8-(time-this.entered))*2)));
    this.announcement.style.visibility=time-this.entered<3.8?'visible':'hidden';
    this.element.dataset.world=world.id;
  }
  destroy() {this.element.remove();this.announcement.remove();}
}
