import type { MiniKind } from '../games/mini-track';
import type { DesignOption } from './variants/variant-kit';
export const PIECE_REVIEW: {kind:MiniKind;title:string;idea:string}[]=[
 {kind:'sheepbank',title:'Sheep Shuffle',idea:'Flower performers stretch, bow and wave their leaves while the sheep scamper around a terraced storybook farm.'},
 {kind:'pondbridge',title:'Lily Pad Bridge',idea:'Duck captains paddle larger boats past a covered jetty, with turning wheels, lifebuoys and trailing wakes.'},
 {kind:'windmillloop',title:'Windmill Loop',idea:'Lattice sails power meshing gears and a flour-bag conveyor, where little packing presses tap each passing bag.'},
 {kind:'mountainpass',title:'Mountain Pass',idea:'Backpacked hiking goats crouch, leap and land with a smaller skip above a sharp snowy gorge.'},
 {kind:'tunnel',title:'Glowstone Tunnel',idea:'Crystal mountain shoulders frame braced chalet bell towers with cable-driven clockwork signals.'},
 {kind:'ravinebridge',title:'Waterfall Viaduct',idea:'A bucketed waterwheel drives a duck pond below three waterfall terraces and a tiny island duck house.'},
 {kind:'lanternrun',title:'Lantern Parade',idea:'Butterfly-bunny lanterns bow over rainbow gates and flutter their hinged wings faster as the train passes.'},
 {kind:'midwayloop',title:'Marquee Loop',idea:'A smiling sun spreads and spins its luminous rays as the train reaches the loop’s apex, among cheering star shields.'},
 {kind:'carouselhelix',title:'Carousel Climb',idea:'Twelve unicorns gallop on three palace decks, matching the train around the climb before coasting gently.'},
 {kind:'pumpkinhop',title:'Pumpkin Hops',idea:'A pumpkin marching band strikes its drums in little fan-shaped bandstands, bouncing musical notes above each crest.'},
 {kind:'pumpkintunnel',title:'Pumpkin Portal',idea:'Candy-cane sentries guard biscuit turrets whose pennants cheer as pumpkins and sweets burst through the castle arch.'},
 {kind:'witchhat',title:'Witch’s Hat',idea:'Spectacled broom-riding kittens read fluttering spellbooks around a glowing school with tiny dormer balconies.'},
];

const alternatives:Record<string,{name:string;idea:string}[]>={
 sheepbank:[
  {name:'Bouncy Baa Circus',idea:'Ringmaster sheep perform controlled somersaults while trampoline centres flex inside firmly anchored rims.'},
  {name:'Woolly Scarf Factory',idea:'Yarn feeds a giant loom with a travelling shuttle, a turning scarf reel and scarf-wearing sheep beside the finished tassels.'}],
 pondbridge:[
  {name:'Frog Pond Orchestra',idea:'A frog conductor leads brass and xylophone players whose throats puff as their performances begin.'},
  {name:'Rubber Duck Wash',idea:'Giant rubber ducks quack with hinged lower beaks and flap their wings in a foamy toy bathtub.'}],
 windmillloop:[
  {name:'Cuckoo Clock Loop',idea:'Carved clock doors open before a feathered cuckoo hops out to chirp from its landing shelf, above moving hands and chains.'},
  {name:'Sunflower Honey Factory',idea:'Satchel-carrying courier bees visit a pulsing sunflower while jars stop beneath a honey-filling spout.'}],
 mountainpass:[
  {name:'Yodel Peak Orchestra',idea:'Dressed marmot organists tap the keys beside pumping bellows and alphorns in a faceted mountain gorge.'},
  {name:'Snowball Switchback',idea:'A striped starting gate releases rolling snowballs into a supported glacier chute and return lift.'}],
 tunnel:[
  {name:'Crystal Dragon Cave',idea:'A rosy-cheeked dragon wakes and blinks as the train enters its crystal-lined mouth, breathing curling crystal puffs.'},
  {name:'Gemstone Mining Works',idea:'Open mining buckets load gems from a ground hopper, carry them uphill and tip them into a sorting chute before returning empty.'}],
 ravinebridge:[
  {name:'Rainbow Weatherworks',idea:'Mechanical pressure gauges react beside rain-catching tanks, connected pipes and a smiling sun with spinning rays.'},
  {name:'Penguin Plunge',idea:'Penguins flap their flippers, belly-slide around a snowy S-bend and kick up icy spray before riding back upright.'}],
 lanternrun:[
  {name:'Rocket Rally',idea:'Countdown lamps cue retro rockets as hinged gantry arms open before ignition and close again after each landing.'},
  {name:'Jellyfish Dreamway',idea:'Pearl tentacles curl below smiling jellyfish while clams open and tiny fish circle through a luminous parade.'}],
 midwayloop:[
  {name:'Pinball Parade',idea:'The train sends a silver pinball into each whiskered cat bumper, setting off comic impact bursts and flippers.'},
  {name:'Wind-up Wonderland',idea:'A pinned winding cylinder turns with the music-box key beneath organ pipes, a train-played keyboard and a dancing fairy.'}],
 carouselhelix:[
  {name:'Twirling Tea Party',idea:'Three iced decks of bunny teacups coast beneath a teapot that tips and pours from its spout.'},
  {name:'Planet Parade',idea:'Smiling ringed planets turn independently above saucer pavilions, with alien ships, comet trails and brightening exhaust.'}],
 pumpkinhop:[
  {name:'Potion Pop Laboratory',idea:'Side-mounted bellows pump pressure through copper pipes, sweep the gauges and pop staggered corks at every crest.'},
  {name:'Ghost Laundry Day',idea:'Washing-machine doors swing open before sheet ghosts launch from the drum and float up to dry on the clothesline.'}],
 pumpkintunnel:[
  {name:'Monster Munch',idea:'A huge friendly monster follows the train with its eyes, opens its mouth, waves its paws and gives a candy burp.'},
  {name:'Haunted Puppet Theatre',idea:'Marionettes tap-dance on supported stages, with control strings attached to their waving arms and kicking golden shoes.'}],
 witchhat:[
  {name:'Potion Rocket Tower',idea:'Stacked potion vats charge a shaking cork rocket in a launch collar, then send it skyward on a bubbly plume.'},
  {name:'Moon Moth Conservatory',idea:'Moonflowers open one after another and linger in bloom while patterned moths swoop in to visit them inside a brass greenhouse.'}],
};
const originalNames=['Meadow Flower Show','Lily Pad Regatta','Storybook Flour Mill','Alpine Goat Chorus','Glowstone Ropeway','Waterwheel Rainbow','Bunny Lantern Parade','Starlight Marquee','Unicorn Palace','Pumpkin Drumline','Candy Castle Portal','Broomstick Academy'];
export function designFor(kind:MiniKind,option:DesignOption){
 const i=PIECE_REVIEW.findIndex(p=>p.kind===kind),p=PIECE_REVIEW[i];
 return option==='a'?{name:originalNames[i],idea:p.idea}:alternatives[kind][option==='b'?0:1];
}
