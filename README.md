# Keep it going

A miniature coaster game about keeping your momentum. Start with six coaches at 28 m/s. Solve multiplication products to boost; the ride ends when the train stops or misses a water jump.

Ride through loops, corkscrews, banked helices, vertical climbs and occasional three-turn helter-skelter descents. Some hilltops invert before the crest, pressing the train and its cargo into the track at speed.

The lead coach stays attached to the rails except during intentional jumps. Following coaches share forces through damped suspension and visible couplings. They can lift over a hump while their drawbars keep them connected. Sustained tension can break a joint, releasing a rear section whose coaches remain coupled as they fall. The engine stays pinned to the rails, with a reinforced tow point. Retaining wheels make coaches much stickier than loose parcels. Parcels inherit almost the same speed as their wagon, with only a small amount of rotational motion; strong air resistance slows their flight and tumbling. The camera follows detached objects, carriages explode on impact, and parcels bounce.

Open wagons refill 2.5 seconds after spilling. They begin with two parcels, then return with three, four, and so on, settling into growing stacks. A cargo counter and refill countdown show what's aboard. New coaches visibly approach from behind, match the train's speed, and couple onto the tail. Travelling faster brings them along sooner and closes the gap faster; answering does not instantly add a coach. Couplings turn amber as tension builds, and the camera returns to the ride once loose cargo has landed and impact flashes have faded.

Water jumps have a real gap in the rails. An approaching-jump preview accounts for hills and drag to tell you whether you can coast across or need another boost. Clear the far edge and land to collect ten bonus points per metre flown. Live airtime distance, a landing bonus and new jump records appear on screen.

On desktop, type an answer and press **Enter** to boost; **C** changes the view and **P** pauses. Phones and tablets have a touch keypad.

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
