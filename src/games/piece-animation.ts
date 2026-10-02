import type { Group, Material } from 'three';
import type { MiniSection } from './mini-track';
import type { FairgroundLights } from './world-lighting';

/** Bounded, section-local animation. Positions use the same coordinates as
 * the world's static formation; AdventureScene owns rider mirroring and lift. */
export interface PieceAnimation {
  readonly group: Group;
  update(time: number, distance: number, reduced: boolean): void;
  dispose(): void;
}
export type PieceAnimationFactory = (section: MiniSection, material: Material, lights: FairgroundLights) => PieceAnimation | undefined;
