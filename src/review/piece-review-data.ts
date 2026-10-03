import type { MiniKind } from '../games/mini-track';
import type { DesignOption } from './variants/variant-kit';
export const PIECE_REVIEW: {kind:MiniKind;title:string;idea:string}[]=[
 {kind:'sheepbank',title:'Sheep Shuffle',idea:'A terraced farm and a cheering flower crowd: the sheep have an audience for their escape.'},
 {kind:'pondbridge',title:'Lily Pad Bridge',idea:'A flowering lily pond with a train-powered waterwheel and a tiny sailboat regatta.'},
 {kind:'windmillloop',title:'Windmill Loop',idea:'A storybook flour mill with lattice sails, turning gearwork and little puffs of grain.'},
 {kind:'mountainpass',title:'Mountain Pass',idea:'Snowy alpine rockwork, sparkling crystals and a welcoming chorus of mountain goats.'},
 {kind:'tunnel',title:'Glowstone Tunnel',idea:'Detailed chalet stations and a glowing mountain tunnel, with gondolas that keep travelling.'},
 {kind:'ravinebridge',title:'Waterfall Viaduct',idea:'Layered tumbling water, a working waterwheel and glinting rainbows beside the bridge.'},
 {kind:'lanternrun',title:'Lantern Parade',idea:'A glowing parade of characterful lanterns that bounce awake as the train arrives.'},
 {kind:'midwayloop',title:'Marquee Loop',idea:'A grand carnival loop with a richer light show and a burst of stars as you pass.'},
 {kind:'carouselhelix',title:'Carousel Climb',idea:'A multi-deck carousel with bobbing unicorns. It turns with the train, then gently coasts to a stop.'},
 {kind:'pumpkinhop',title:'Pumpkin Hops',idea:'The train plays a pair of smiling drums at every hilltop, sending up showers of green candy sparks.'},
 {kind:'pumpkintunnel',title:'Pumpkin Portal',idea:'A wonky candy-castle arch frames the pumpkin pile. Wrapped sweets tumble out of the green explosion.'},
 {kind:'witchhat',title:'Witch’s Hat',idea:'A stitched storybook hat, bubbling cauldrons and little cats riding broomsticks around the crown.'},
];

const alternatives:Record<string,{name:string;idea:string}[]>={
 sheepbank:[
  {name:'Bouncy Baa Circus',idea:'A woolly trampoline troupe bounces through star hoops to greet the train, under a tiny big top.'},
  {name:'Woolly Jumper Factory',idea:'A giant knitting loom clacks its needles and rolls out a colourful scarf as the train passes.'}],
 pondbridge:[
  {name:'Frog Pond Orchestra',idea:'A pond-sized musical ensemble conducts a splashy welcome as the train arrives.'},
  {name:'Rubber Duck Wash',idea:'An enormous toy bathtub with a gooseneck tap, dancing rubber ducks and floating foam.'}],
 windmillloop:[
  {name:'Cuckoo Clock Loop',idea:'A clockwork storybook mill with a train-triggered cuckoo, opening doors and swinging pendulum.'},
  {name:'Sunflower Honey Factory',idea:'A giant flower turns in the loop while bees keep a fantastical honey factory busy.'}],
 mountainpass:[
  {name:'Yodel Peak Orchestra',idea:'Giant alphorns, pumping bellows and floating notes make the gorge sing as you pass.'},
  {name:'Snowball Switchback',idea:'A snowy mountain playground with rolling snowballs and a spinning snowflake lift.'}],
 tunnel:[
  {name:'Crystal Dragon Cave',idea:'Travel through a friendly sleeping dragon’s crystal-lined cave and wake its glowing breath.'},
  {name:'Gemstone Mining Works',idea:'A timber mine with a bucket conveyor and busy jewel-sorting machinery.'}],
 ravinebridge:[
  {name:'Rainbow Weatherworks',idea:'A cloud-powered weather factory spins a rainbow turbine beside the viaduct.'},
  {name:'Penguin Plunge',idea:'A sculpted ice cascade becomes a slippery playground for a procession of penguins.'}],
 lanternrun:[
  {name:'Rocket Rally',idea:'Five retro rocket launchpads fire staggered lift-offs and star exhaust as the train arrives.'},
  {name:'Jellyfish Dreamway',idea:'A luminous undersea parade with giant smiling jellyfish, branching coral and rising bubbles.'}],
 midwayloop:[
  {name:'Pinball Parade',idea:'The loop becomes an enormous pinball cabinet with reacting bumpers, flippers and a silver ball.'},
  {name:'Wind-up Wonderland',idea:'An open jewel music box with an organ frame, spinning fairy and rising musical notes.'}],
 carouselhelix:[
  {name:'Twirling Tea Party',idea:'Three china platters of bunny teacups spin with the train, then coast beneath a giant steaming teapot.'},
  {name:'Planet Parade',idea:'An orbital carousel of colourful planets turns with the train and keeps spinning afterward.'}],
 pumpkinhop:[
  {name:'Potion Pop Laboratory',idea:'Each crest fires a bubbling cauldron and sends corks popping into a green potion fountain.'},
  {name:'Ghost Laundry Day',idea:'A team of friendly sheet ghosts leaps from washing tubs as the train races past.'}],
 pumpkintunnel:[
  {name:'Monster Munch',idea:'A huge friendly monster opens its mouth to let the train through, then spits a shower of sweets.'},
  {name:'Haunted Puppet Theatre',idea:'A storybook proscenium opens its curtains and sends dancing skeleton puppets into a bow.'}],
 witchhat:[
  {name:'Potion Rocket Tower',idea:'A stacked potion laboratory bubbles, stirs and launches a witch’s cork rocket inside the spiral.'},
  {name:'Moon Moth Conservatory',idea:'A glowing moonflower tree unfurls inside the spiral, with orbiting moths and fluttering lantern leaves.'}],
};
const originalNames=['Meadow Flower Show','Lily Pad Regatta','Storybook Flour Mill','Alpine Goat Chorus','Glowstone Ropeway','Waterwheel Rainbow','Bunny Lantern Parade','Starlight Marquee','Unicorn Palace','Pumpkin Drumline','Candy Castle Portal','Broomstick Academy'];
export function designFor(kind:MiniKind,option:DesignOption){
 const i=PIECE_REVIEW.findIndex(p=>p.kind===kind),p=PIECE_REVIEW[i];
 return option==='a'?{name:originalNames[i],idea:p.idea}:alternatives[kind][option==='b'?0:1];
}
