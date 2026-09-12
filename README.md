# Keep it going

A miniature coaster game about keeping your momentum. Start with six coaches at 28 m/s. Solve multiplication products to boost; the ride ends when the train stops or misses a water jump.

Ride through loops, corkscrews, banked helices, vertical climbs and occasional three-turn helter-skelter descents. Some hilltops invert before the crest, pressing the train and its cargo into the track at speed.

The lead coach stays attached to the rails except during intentional jumps. Following coaches can lift and settle back down over humps. Excessive speed can whip one or several off, with a stronger effect toward the rear. Retaining wheels make coaches much stickier than loose parcels. Detached objects follow gravity; the camera widens to follow them, carriages explode on impact, and parcels bounce.

Open wagons refill 2.5 seconds after spilling. They begin with two parcels, then return with three, four, and so on, stacked in the wagon. New coaches visibly approach from behind and couple onto the tail. Travelling faster brings them along sooner and closes the gap faster; answering does not instantly add a coach.

Water jumps have a real gap in the rails. Build enough speed to clear the far edge, then land to collect ten bonus points per metre flown. Live airtime distance, a landing bonus and your best jump appear on screen.

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
