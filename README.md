# Keep it going

A standalone endless miniature coaster game. Solve multiplication products to give the train a momentum boost; every three correct answers adds another cart.

Ride through loops, full-roll corkscrews, banked helices, vertical climbs and occasional three-turn helter-skelter descents. Some hilltops roll upside down before the crest, keeping the train and its cargo pressed against the rail at speed.

Boost carefully: too much speed over an upright hump spills parcels from open wagons and can send the last carriage flying. Airborne objects inherit their motion from the train and fall under gravity. The camera widens to follow them; detached carriages explode into a burst of debris on impact, while parcels bounce. You lose at most one carriage per hump, and the front carriage always stays on the track. Correct answers keep earning replacement carriages, with fresh parcels in new open wagons.

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
