# Island Drive

A small, original, mobile-first 3D sandbox built for William. No missions, story, accounts, purchases or external asset services. Drive around a low-poly island, take off from the airport, or sail from the marina.

**Play:** https://william-island-drive.guangquan304.chatgpt.site

The hosted build is private to the owner. Open it in Safari on your phone; landscape is recommended. In Safari, Share → Add to Home Screen provides a standalone app-like window. This is a browser game, not a native iOS app or a GTA port.

## What's playable

- Comet GT sports car, Trailrunner SUV, Nightshift motorcycle, Skylark propeller plane, Dragonfly helicopter and Daybreaker speedboat.
- A procedural island with city streets, buildings, palm-lined coastal road, park, airport/runway, helipad, marina and open sea.
- Walking, swimming, getting in/out nearby vehicles, building collisions, shoreline detection and safe recovery.
- Touch joystick, simultaneous direction/pedal controls, aircraft ascent/descent, speedometer, minimap, vehicle selector and destination fast travel.
- Three camera distances, drag-to-look, engine audio toggle, pause, graphics quality and three lighting presets.
- Self-contained build: Three.js is bundled locally, geometry is procedural, engine sounds are synthesised. Service worker caches assets after the first successful load for best-effort offline reuse. Private-host authentication may still require connectivity.
- GPU WebGL2 rendering by default; a simplified Canvas 2D painter projects the same 3D scene when WebGL is unavailable. Compatibility rendering has less detail and lower performance.

## Controls

| Action                   | Touch                        | Keyboard            |
| ------------------------ | ---------------------------- | ------------------- |
| Steer / walk             | Left joystick                | A/D or left/right   |
| Accelerate / move        | Pedal or joystick up         | W or up             |
| Brake / reverse          | Brake pedal or joystick down | S or down           |
| Aircraft climb / descend | Rise / descend buttons       | Q / Z               |
| Boost / sprint           | BOOST button                 | Shift               |
| Handbrake                | Brake pedal                  | Space               |
| Enter / exit             | Enter / exit button          | E                   |
| Vehicle selector         | Top-right garage button      | V                   |
| Map / fast travel        | Minimap                      | M                   |
| Camera                   | Camera icon; drag the scene  | C; drag; wheel zoom |
| Recover                  | Reset icon                   | R                   |
| Pause                    | Pause icon                   | Escape or P         |

Plane: hold accelerate along the runway, then climb once it gains speed. Releasing climb gives a gentle upward cruise; hold descend to land. Helicopter: climb vertically first, then accelerate and steer. You can only exit aircraft close to the ground. Boats cannot drive across the island. Driving a car into the sea returns it to a safe starting point.

## Develop

Requires Node.js 20+ and npm.

```sh
npm ci
npm run check
npm test
npm run build
python3 -m http.server 8080 --directory dist
```

Open http://localhost:8080. Deploy the generated `dist/` directory to any static HTTPS host. Relative asset URLs support deployment under a repository subdirectory. `.openai/hosting.json` records the private hosted preview identity; the repository's origin remains this GitHub repository.

`src/physics.js` is an engine-independent simulation in metres/seconds, verified with Node's built-in test runner. `world.js` creates deterministic scenery with instanced meshes, `vehicles.js` creates the six vehicle models, `input.js` unifies keyboard/pointer input, and `game.js` connects gameplay and UI. `software-renderer.js` provides optional CPU rendering.

## Scope and validation

This is an arcade prototype, with approximate driving/lift/buoyancy rather than a rigid-body simulator. Buildings are exterior scenery. There are no traffic AI, interiors, damage system, weapons, multiplayer or saved world positions. The island is roughly a kilometre across. Mobile performance depends on device and browser; the low quality preset caps rendering resolution and disables real-time shadows.

Automated checks cover acceleration, steering, braking/reverse, solid collisions, plane takeoff/descent, helicopter hover/landing, boat shoreline restriction, water recovery and frame-delta safety. Cloud browser QA uses compatibility rendering because its WebGL device is disabled; hardware-rendered iPhone performance remains to be checked on a real phone.

Original code and procedural visuals. Three.js retains its bundled MIT license at `dist/vendor/THREE-LICENSE.txt`. This project is not affiliated with Rockstar Games and does not use GTA assets.
