# Keep it going

A miniature coaster game about keeping your momentum. Start with six coaches rolling gently over the top of a 22-metre hill at 2 m/s (about 7 km/h), then gather speed down the first drop. Solve multiplication products to boost; the ride ends when the train stops or misses a water jump.

Ride through loops, corkscrews, banked helices, vertical climbs and occasional three-turn helter-skelter descents. Some hilltops invert before the crest, pressing the train and its cargo into the track at speed.

The lead coach stays attached to the rails except during intentional jumps. Fast crests, including the tops of vertical climbs, can lift the following coaches into the air. They inherit their motion and fall under gravity, while articulated drawbars keep the chain tethered to the engine. Damped pivots and rail contact let them settle back into line. Only the tail coupling can break, and at most one coach detaches per hill, even if a replacement joins before the train clears it. Retaining wheels make coaches much stickier than loose parcels. Parcels inherit almost the same speed as their wagon, with only a small amount of rotational motion; strong air resistance slows their flight and tumbling. The camera follows detached objects, carriages explode on impact, and parcels bounce.

Open wagons refill 2.5 seconds after spilling. They begin with two parcels, then return with three and finally four, stacked in two layers. Every later refill stays at the four-parcel limit. On desktop, a cargo counter and refill countdown show what's aboard. New coaches visibly approach from behind, match the train's speed, and couple onto the tail. Travelling faster brings them along sooner and closes the gap faster; answering does not instantly add a coach. Couplings turn amber as tension builds, and the camera returns to the ride once loose cargo has landed and impact flashes have faded.

Water jumps have a real gap in the rails. An approaching-jump preview accounts for hills and drag to tell you whether you can coast across or need another boost. Clear the far edge and land to collect ten bonus points per metre flown. Live airtime distance, a landing bonus and new jump records appear on desktop.

On desktop, type an answer and press **Enter** to boost; **C** changes the view and **P** pauses. Phones and tablets use a large three-column touch keypad with delete and submit keys. The mobile layout fits the viewport in portrait and landscape, showing only the coaster, question and keypad during play. Brief answer feedback appears beside the question; stats, track labels, physics messages and the camera control are hidden. The header contains just the logo on all devices.

On desktop, the live score shows your current answer streak. You can type the next answer immediately after a boost, even during its short submission cooldown. If coasting would stop the train within the next few seconds, a momentum warning prompts another answer; slow downhill travel doesn't trigger it. Distance and jump records are saved separately for each difficulty. At the end, a ride card shows your score and a replay button, with detailed ride statistics on desktop and a brief pause to see the splash before the card appears.

The header logo was created with the built-in imagegen tool. Its asset and generation prompt are in `public/images/`.

## Run locally

Requires Node.js 22.12 or newer (Node 24 LTS recommended).

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

## GitHub Pages

The Vite build uses relative asset paths, so it works from a repository subdirectory. The workflow in `.github/workflows/pages.yml` tests, builds, and deploys the site whenever `main` is pushed, or when run manually.

In the GitHub repository settings, choose **GitHub Actions** as the Pages source. No repository-name configuration is required.
