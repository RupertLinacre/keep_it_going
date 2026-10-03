import type { MiniKind } from '../games/mini-track';
import type { DesignOption } from './variants/variant-kit';
import { SMOKE_DESIGNS } from '../games/train-smoke';
export type ReviewKind = MiniKind | 'smoke';
export const PIECE_REVIEW: {kind:MiniKind;title:string;idea:string}[]=[
 {kind:'sheepbank',title:'Sheep Shuffle',idea:'Flowers perform a travelling stretch-and-bow wave while butterflies rise to escort the train across their storybook farm.'},
 {kind:'pondbridge',title:'Lily Pad Bridge',idea:'Duck captains sail sculpted striped catamarans that rock playfully, with hull-mounted paddles and trailing wakes.'},
 {kind:'windmillloop',title:'Windmill Loop',idea:'Meshing gears drive a conveyor whose cheerful flour sacks squash gently beneath timed packing presses.'},
 {kind:'mountainpass',title:'Mountain Pass',idea:'Backpacking goats tuck their front hooves, kick out their back legs and stretch for a soft landing as the train passes.'},
 {kind:'tunnel',title:'Glowstone Tunnel',idea:'Portal crystals ripple with light and brass bells ring with swinging clappers while gondolas climb the mountain.'},
 {kind:'ravinebridge',title:'Waterfall Viaduct',idea:'Water pours through the flume, sprays from the turning wheel and ripples behind ducks circling their tiny island house.'},
 {kind:'lanternrun',title:'Lantern Parade',idea:'Butterfly-bunny lanterns crouch, spring up and settle into a second bounce, carrying tiny star passengers in their baskets.'},
 {kind:'midwayloop',title:'Marquee Loop',idea:'Smiling cheer stars hop into complete cartwheels while the sun spreads its luminous rays at the loop’s apex.'},
 {kind:'carouselhelix',title:'Carousel Climb',idea:'Feathered unicorns crouch and rear on three palace decks, matching the train around the climb before coasting gently.'},
 {kind:'pumpkinhop',title:'Pumpkin Hops',idea:'A pumpkin marching band trades alternating drum strokes beneath scalloped bandstands, sending larger musical notes above each crest.'},
 {kind:'pumpkintunnel',title:'Pumpkin Portal',idea:'Castle pennants cheer as sweets launch from their circling lollipops in staggered volleys and gently refill after the burst.'},
 {kind:'witchhat',title:'Witch’s Hat',idea:'Broad patchwork panels wrap the glowing school where spectacled broom-riding kittens read fluttering spellbooks.'},
];

/** Keep ride geometry separate from power-ups: smoke never becomes a track kind. */
export const REVIEW_ITEMS: {kind:ReviewKind;title:string;idea:string}[]=[...PIECE_REVIEW,
 {kind:'smoke',title:'Funnel Smoke',idea:'Gentle everyday steam, plus five twenty-second power-up ideas for the moving train.'},
];

const alternatives:Record<string,{name:string;idea:string}[]>={
 sheepbank:[
  {name:'Bouncy Baa Circus',idea:'Ringmaster sheep squash, stretch and somersault from flexing trampolines while their stars applaud.'},
  {name:'Woolly Scarf Factory',idea:'A woolly-faced loom weaves colourful scarves while scarf-wearing sheep bow to show off their outfits.'}],
 pondbridge:[
  {name:'Frog Pond Orchestra',idea:'Frogs puff their croaking throats while the conductor waves a wand held firmly in its moving hand.'},
  {name:'Rubber Duck Wash',idea:'A wave of ducks dips, quacks and flaps in turn as bubbles float up from their giant bathtub.'}],
 windmillloop:[
  {name:'Cuckoo Clock Loop',idea:'A mouse rides the cheese pendulum while the cuckoo cocks its head, flaps and chirps from the opening clock.'},
  {name:'Sunflower Honey Factory',idea:'Satchel-carrying bees make smooth delivery circuits between a sunflower and beehives while honey jars fill below.'}],
 mountainpass:[
  {name:'Yodel Peak Orchestra',idea:'Marmots play giant mountain organs: paws tap keys, bellows pump and brass pipe valves pop open in sequence.'},
  {name:'Snowball Switchback',idea:'Snowballs race past a ringing finish bell while mittened snowmen cheer beside their glacier circuit.'}],
 tunnel:[
  {name:'Crystal Dragon Cave',idea:'A sleepy dragon puffs its cheeks, then sneezes crystal bubbles with a head recoil and a big wing stretch.'},
  {name:'Gemstone Mining Works',idea:'Buckets lift and tip colourful gems into a sorting house whose toothed machinery turns with the conveyor.'}],
 ravinebridge:[
  {name:'Rainbow Weatherworks',idea:'Rain fills the tanks, pressure gauges rise, candy-striped windsocks inflate and the smiling sun turbine spins.'},
  {name:'Penguin Plunge',idea:'Penguins glide through tall ice hoops, tuck onto their bellies and smoothly stand for the uphill return conveyor.'}],
 lanternrun:[
  {name:'Rocket Rally',idea:'Countdown gantries release banking retro rockets whose flames and star exhaust follow their moving nozzles.'},
  {name:'Jellyfish Dreamway',idea:'Smiling jellyfish breathe and contract their bells while clams open to raise pearls beside curling tentacles and tiny fish.'}],
 midwayloop:[
  {name:'Pinball Parade',idea:'A rolling mouse pinball races between kitten bumpers that recoil and tilt on impact, among comic bursts and flippers.'},
  {name:'Wind-up Wonderland',idea:'A fairy with a layered tutu pirouettes and takes a closing bow above the train-played keyboard and winding cylinder.'}],
 carouselhelix:[
  {name:'Twirling Tea Party',idea:'Bunny teacups toast in sequence on three iced decks while a tilting teapot pours into a waiting cup beside its passenger.'},
  {name:'Planet Parade',idea:'Footed alien saucers lift and bank in ripples around three decks, beneath smiling planets and circling comet trails.'}],
 pumpkinhop:[
  {name:'Potion Pop Laboratory',idea:'Bellows build pressure and pop frog-shaped stoppers into complete somersaults before they land upright in their bottles.'},
  {name:'Ghost Laundry Day',idea:'Washer doors open before sheet ghosts float up to dry, their attached cloth skirts billowing and fluttering on the clothesline.'}],
 pumpkintunnel:[
  {name:'Monster Munch',idea:'A friendly monster follows the train with its eyes, trades playful winks and waves its paws before a candy burp.'},
  {name:'Haunted Puppet Theatre',idea:'Tasselled curtains gather aside as three marionettes take turns tap-dancing, with strings attached to their moving arms and shoes.'}],
 witchhat:[
  {name:'Potion Rocket Tower',idea:'Three stirring vats charge in sequence before a cork rocket spins skyward, returns to its collar and gives a settling bounce.'},
  {name:'Moon Moth Conservatory',idea:'Smiling moonflowers bloom in sequence and release pollen sparkles as patterned moths swoop in and slow their wings to visit.'}],
};
const originalNames=['Meadow Flower Show','Lily Pad Regatta','Storybook Flour Mill','Alpine Goat Chorus','Glowstone Ropeway','Waterwheel Rainbow','Bunny Lantern Parade','Starlight Marquee','Unicorn Palace','Pumpkin Drumline','Candy Castle Portal','Broomstick Academy'];
const extras:Record<string,{name:string;idea:string}[]>={
 sheepbank:[
  {name:'Seesaw Apple Orchard',idea:'Sheep rock giant harvest seesaws, sending apples into waiting baskets as the train passes each crest.'},
  {name:'Woolly Balloon Post',idea:'Sheep airships carry knitted baskets, spinning propellers and parcel hoists that deliver gifts in a travelling wave.'}],
 pondbridge:[
  {name:'Turtle Picnic Ferries',idea:'Smiling turtles paddle duck picnic parties along the water, banking beneath striped parasols.'},
  {name:'Watering Can Waltz',idea:'Giant watering cans tip in sequence, pouring into lily bowls whose flowers rise and unfold.'}],
 windmillloop:[
  {name:'Giant Dandelion Wishes',idea:'A fluffy dandelion opens its crown and releases parachute seeds carrying tiny mouse passengers towards flowerpots.'},
  {name:'Pancake Mill',idea:'A chef-hat kitchen flips pancakes from tilting pans onto waiting plates while its cook waves oversized spatulas.'}],
 mountainpass:[
  {name:'Cloud Laundry Ridge',idea:'Alpine wringers squeeze cloud pillows beneath a mountain washing line of waving mittens.'},
  {name:'Yeti Snow-Cone Summit',idea:'A happy yeti works a giant mountain snow-cone machine, scooping icy treats for the passing train.'}],
 tunnel:[
  {name:'Sleepy Snail Tunnel',idea:'The train enters a giant spiral shell while a friendly snail raises its feelers and peeks out to greet it.'},
  {name:'Alpine Accordion Tunnel',idea:'A chalet-sized accordion squeezes its bellows and plays its keys as the train passes through the middle.'}],
 ravinebridge:[
  {name:'Otter Teeter Dam',idea:'Two enormous otters balance on a working timber seesaw over their mountain dam.'},
  {name:'Stork Sock Fishing',idea:'Long-legged storks bend their fishing rods to reel surprising striped socks from the ravine.'}],
 lanternrun:[
  {name:'Popcorn Pop Parade',idea:'Striped kettles open their lids before popcorn pals tumble upward and settle back into their pots.'},
  {name:'Dragon Kite Parade',idea:'Smiling dragon kites ripple their jointed tails and open their wings above train-powered winding reels.'}],
 midwayloop:[
  {name:'Big Top Juggle Loop',idea:'Balancing seals toss star balls through a juggling cascade beneath a scalloped circus arch.'},
  {name:'Gumball Giggle Factory',idea:'A giant gumball globe turns its candy scoops and dispenses bright sweets into a waiting bowl.'}],
 carouselhelix:[
  {name:'Octopus Oompah Palace',idea:'Crab gondolas spin on three seashell decks beneath a crowned octopus whose tentacles cheer the passing train.'},
  {name:'Honeybee Cake Carousel',idea:'Bee gondolas circle three honeycomb decks as flowers open in sequence beneath a wobbling honey-dipper crown.'}],
 pumpkinhop:[
  {name:'Skeleton Xylophone',idea:'Three friendly skeletons play rainbow bone keys with alternating mallets, sending golden notes dancing above the humps.'},
  {name:'Spider Spring Fair',idea:'Party-hat spiders bounce on web trampolines beside each crest, tucking their jointed legs as stars spin around them.'}],
 pumpkintunnel:[
  {name:'Bookworm Library',idea:'A spectacled bookworm peeks over giant storybooks while the train turns their illustrated pages overhead.'},
  {name:'Ticklish Fossil',idea:'The train tickles a friendly dinosaur skeleton, making its jaw giggle and its long tail wag above the rib tunnel.'}],
 witchhat:[
  {name:'Boo Hotel',idea:'Crooked guest rooms open their shutters to wave hello while a little lift carries a ghost between the floors.'},
  {name:'Spider Silk Spindle',idea:'A giant spider plucks a three-tier silk loom, sending bright beads along the webs as weaving shuttles slide beneath it.'}],
};
export function designFor(kind:ReviewKind,option:DesignOption){
 if(kind==='smoke'){
  const design=SMOKE_DESIGNS.find(d=>d.id===option)!;
  return {name:design.name,idea:design.description};
 }
 const i=PIECE_REVIEW.findIndex(p=>p.kind===kind),p=PIECE_REVIEW[i];
 return option==='a'?{name:originalNames[i],idea:p.idea}:option==='d'||option==='e'?extras[kind][option==='d'?0:1]:alternatives[kind][option==='b'?0:1];
}
