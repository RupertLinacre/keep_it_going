import type { MiniKind } from '../games/mini-track';
import type { DesignOption } from './variants/variant-kit';
export const PIECE_REVIEW: {kind:MiniKind;title:string;idea:string}[]=[
 {kind:'sheepbank',title:'Sheep Shuffle',idea:'A terraced farm and waving flower faces cheer on the sheep as they scamper away from the train.'},
 {kind:'pondbridge',title:'Lily Pad Bridge',idea:'Duck captains steer a tiny regatta through the flowering pond, leaving wakes behind their boats.'},
 {kind:'windmillloop',title:'Windmill Loop',idea:'Lattice sails drive meshing gears and a moving flour-bag conveyor beneath the storybook mill.'},
 {kind:'mountainpass',title:'Mountain Pass',idea:'A sharper snowy gorge with grounded rock spurs and goats that turn and bow to greet the train.'},
 {kind:'tunnel',title:'Glowstone Tunnel',idea:'Crystal-covered mountain shoulders, chalet stations and portal bells that swing as the train passes.'},
 {kind:'ravinebridge',title:'Waterfall Viaduct',idea:'Water tumbles across three rock terraces into a mill flume and a turning bucket wheel.'},
 {kind:'lanternrun',title:'Lantern Parade',idea:'Butterfly-bunny lanterns bow and puff up over broad rainbow gates when the train arrives.'},
 {kind:'midwayloop',title:'Marquee Loop',idea:'A smiling carnival sun, crown-topped towers and six star shields wake up around the loop.'},
 {kind:'carouselhelix',title:'Carousel Climb',idea:'Three scalloped palace decks carry larger unicorns that rear to greet the train, then coast gently.'},
 {kind:'pumpkinhop',title:'Pumpkin Hops',idea:'A pumpkin marching band plays from little fan-shaped bandstands as the train crosses each crest.'},
 {kind:'pumpkintunnel',title:'Pumpkin Portal',idea:'Biscuit turrets, candy-cane sentries and circling sweets frame a pumpkin-smashing candy castle.'},
 {kind:'witchhat',title:'Witch’s Hat',idea:'A glowing witch school with arched windows and ribbon-wearing kittens leaving sparkling broom trails.'},
];

const alternatives:Record<string,{name:string;idea:string}[]>={
 sheepbank:[
  {name:'Bouncy Baa Circus',idea:'Trampoline beds dip under woolly feet, then spring the sheep up through circus star hoops.'},
  {name:'Woolly Scarf Factory',idea:'A giant loom weaves stitched fabric with a travelling shuttle and rolls the scarf onto a reel.'}],
 pondbridge:[
  {name:'Frog Pond Orchestra',idea:'A frog conductor leads a brass player and a percussionist whose mallets tap a colourful xylophone.'},
  {name:'Rubber Duck Wash',idea:'Giant rubber ducks flap their wings in a foamy toy bathtub beneath a gooseneck tap.'}],
 windmillloop:[
  {name:'Cuckoo Clock Loop',idea:'A shaped wooden clock opens its doors before a cuckoo pops out, while its hands and pendulum keep time.'},
  {name:'Sunflower Honey Factory',idea:'Bees flap around a giant sunflower while an indexed line of jars stops beneath a honey-filling spout.'}],
 mountainpass:[
  {name:'Yodel Peak Orchestra',idea:'Alphorns, keyboards and compressing bellows make a faceted mountain gorge sing as the train passes.'},
  {name:'Snowball Switchback',idea:'A glacier playground launches rolling snowballs down a supported chute and carries them back up.'}],
 tunnel:[
  {name:'Crystal Dragon Cave',idea:'A curled, armoured dragon flexes its scalloped wings as the train passes through its crystal-lined mouth.'},
  {name:'Gemstone Mining Works',idea:'An ore conveyor tips its buckets into a chute between jagged rocks, timber galleries and roofed workshops.'}],
 ravinebridge:[
  {name:'Rainbow Weatherworks',idea:'A smiling sun spins its rays above rain-catching tanks and connected pipes in a cloud-powered factory.'},
  {name:'Penguin Plunge',idea:'Penguins belly-slide through a snow arch across a sculpted glacier, then ride upright on the return circuit.'}],
 lanternrun:[
  {name:'Rocket Rally',idea:'Orbit gates and countdown lamps cue five retro rockets, each with a staged flame-and-star launch.'},
  {name:'Jellyfish Dreamway',idea:'Pearl clams open below smiling jellyfish as tiny fish circle through their luminous bubble parade.'}],
 midwayloop:[
  {name:'Pinball Parade',idea:'The train drives a silver pinball past comic bumper bursts and flippers above a chunky control console.'},
  {name:'Wind-up Wonderland',idea:'A train-played keyboard, organ pipes and opening theatre curtains frame a spinning music-box fairy.'}],
 carouselhelix:[
  {name:'Twirling Tea Party',idea:'Iced colonnades surround three decks of bunny teacups while a giant teapot tips to pour and the decks coast.'},
  {name:'Planet Parade',idea:'Saucer pavilions spin beneath a friendly Saturn while larger alien ships lift off to greet each passing tier.'}],
 pumpkinhop:[
  {name:'Potion Pop Laboratory',idea:'A connected copper laboratory builds pressure, sweeps its gauges and pops staggered corks at every crest.'},
  {name:'Ghost Laundry Day',idea:'Spinning washing machines launch sheet ghosts up to a pegged clothesline, where they hang out to dry.'}],
 pumpkintunnel:[
  {name:'Monster Munch',idea:'A huge friendly monster opens its mouth, waves its paws and gives a candy burp after the train passes.'},
  {name:'Haunted Puppet Theatre',idea:'A lit puppet stage opens its curtains while three marionettes wave their arms and kick their golden shoes.'}],
 witchhat:[
  {name:'Potion Rocket Tower',idea:'Pressure gauges and copper pipes wind through stacked potion vats, powering a cork rocket and bubbly exhaust.'},
  {name:'Moon Moth Conservatory',idea:'Three moonflower crowns open in sequence inside a brass greenhouse as patterned moths beat their wings.'}],
};
const originalNames=['Meadow Flower Show','Lily Pad Regatta','Storybook Flour Mill','Alpine Goat Chorus','Glowstone Ropeway','Waterwheel Rainbow','Bunny Lantern Parade','Starlight Marquee','Unicorn Palace','Pumpkin Drumline','Candy Castle Portal','Broomstick Academy'];
export function designFor(kind:MiniKind,option:DesignOption){
 const i=PIECE_REVIEW.findIndex(p=>p.kind===kind),p=PIECE_REVIEW[i];
 return option==='a'?{name:originalNames[i],idea:p.idea}:alternatives[kind][option==='b'?0:1];
}
