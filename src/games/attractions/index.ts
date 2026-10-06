import { createSledMountain } from './sled-mountain';
import { createChristmasPiece } from './christmas-pieces';
import type * as T from 'three';
import type { MiniSection } from '../mini-track';
import type { FairgroundLights } from '../world-lighting';
import { createHoneyFactory } from './honey-factory';
import { createPancakeMill } from './pancake-mill';
import { createPenguinPlunge } from './penguin-plunge';
import { createBigTopJuggle } from './big-top-juggle';
import { createSpiderSilkSpindle } from './spider-silk-spindle';

export function createAdditionalAttraction(section: MiniSection, material: T.Material, lights: FairgroundLights) {
  const christmas=createChristmasPiece(section,material,lights);if(christmas)return christmas;
  switch (section.kind) {
    case 'sledswitchbacks': return createSledMountain(section, material, lights);
    case 'honeyfactory': return createHoneyFactory(section, material, lights);
    case 'pancakemill': return createPancakeMill(section, material, lights);
    case 'penguinplunge': return createPenguinPlunge(section, material, lights);
    case 'bigtopjuggle': return createBigTopJuggle(section, material, lights);
    case 'silkspindle': return createSpiderSilkSpindle(section, material, lights);
  }
}
