import type { MiniSection } from '../../games/mini-track';
import type { Material } from 'three';
import type { FairgroundLights } from '../../games/world-lighting';
import type { AlternativeOption } from './variant-kit';
import { createMeadowVariant } from './meadow-variants';
import { createMountainVariant } from './mountain-variants';
import { createCarnivalVariant } from './carnival-variants';
import { createHalloweenVariant } from './halloween-variants';

// This registry is imported only by the workshop. Selecting a favourite later
// can reuse its factory in AdventureScene without loading the other proposals.
export function createVariant(section:MiniSection,option:AlternativeOption,material:Material,lights:FairgroundLights){
 return createMeadowVariant(section,option,material,lights)
  ??createMountainVariant(section,option,material,lights)
  ??createCarnivalVariant(section,option,material,lights)
  ??createHalloweenVariant(section,option,material,lights);
}
