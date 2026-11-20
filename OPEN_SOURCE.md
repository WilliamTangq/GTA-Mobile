# Living Island — open-source integration and optimization notes

This release integrates upstream software and assets directly. Game-specific traffic rules, touch controls, drift simulation, mesh conversion, lighting integration and effects are original code in this repository.

| Project                                            | Version / source                                                                                                                           | License | Actual integration                                                                                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [YUKA](https://github.com/Mugen87/yuka)            | npm `yuka@0.7.8`, pinned in the lockfile                                                                                                   | MIT     | `EntityManager`, `Vehicle`, `Path`, `FollowPathBehavior` and `Vector3` run the NPC cars and pedestrians. The build copies the ESM bundle and its license locally.                                                          |
| [Kenney Car Kit](https://kenney.nl/assets/car-kit) | CC0 GLB distribution from [Hidencod/tge-assets](https://github.com/Hidencod/tge-assets), commit `f6b23734fe53679bb5b7c7b740739328f6f5231d` | CC0-1.0 | Sedan sports, luxury SUV, taxi, police and delivery models become five indexed, vertex-coloured local meshes with separate wheel pivots. Full provenance and SHA-256 hashes are in `public/assets/kenney/PROVENANCE.json`. |
| [Three.js](https://github.com/mrdoob/three.js)     | npm `three@0.181.2`, retained from v1.0                                                                                                    | MIT     | Renderer, cameras, instanced scenery, mesh geometry and effects.                                                                                                                                                           |

## Rebuild the models

The converted JSON assets are committed, so ordinary `npm ci && npm run build` does not download or convert anything. They have no external texture or model requests at runtime.

To reproduce the conversion, obtain the pinned asset checkout above and run:

```sh
python -m pip install numpy Pillow
python scripts/convert-kenney.py /path/to/tge-assets
```

The converter checks the source revision, handles indexed GLB geometry, applies node transforms, samples the embedded colour palette and retains body/wheel separation. Positions/normals are quantized; colours remain sRGB in JSON and are converted to linear colour on loading. The software renderer also supports the new vertex-coloured models.

The upstream CC0 notice is retained at `public/assets/kenney/LICENSE.txt`. YUKA and Three.js licenses are copied to `dist/vendor/` by the build. Kenney credit is included voluntarily.

## What changed

- Nine selectable vehicles, including a taxi, police car and cargo van. Cars gain visible front-wheel steering, spinning wheels, brake lamps and a flashing police light bar.
- Lightweight NPC traffic: default 8 cars and 6 people; busy mode 16 cars and 12 people. NPC cars follow the road grid, slow for vehicles/player ahead and observe nine signal-controlled junctions. Disabled NPCs stop updating and their collision boxes are disabled. NPCs outside the view distance are not drawn.
- Touch/keyboard handbrake, visible tyre slip, grip recovery, off-road slowdown, small body weight-transfer motions, pooled tyre marks and smoke, and pooled boat foam trails. Pools have fixed upper bounds and effects freeze when gameplay is paused.
- The original aircraft, helicopter and boat gameplay is retained. No story missions or mandatory objectives are added.

## Considered, not integrated

[cannon-es](https://github.com/pmndrs/cannon-es) offers full rigid-body and raycast-vehicle physics. It is useful for a later terrain/suspension overhaul, but is not a dependency of this release: replacing the current flat-world car simulation would also require retuning collisions and the aircraft/boat interfaces.

[Sketchbook](https://github.com/swift502/Sketchbook) demonstrates third-person characters, cars, airplanes and helicopters. The upstream repository is archived. This release does not transplant its engine or game assets; the current mobile implementation remains in place.

## Verification and limits

17 Node tests cover previous vehicle behavior plus drift/grip recovery, road/shore detection, disabled collisions, nonconflicting signals, two-minute YUKA road-loop stability, obstacle slowing, density switching and model indices/hashes/wheel pivots. Syntax checks include every JS module. Browser QA uses the Canvas compatibility renderer because the cloud browser disables WebGL. Actual iPhone WebGL frame rate remains unverified.

NPC behavior is intentionally simple. Cross traffic at unsignalled junctions is approximate, The game uses arcade physics; the original release had no commandeering or pursuit. See the 1.3 changes below. Setting traffic to light/off is available on slower devices.

## 1.2 — mobile handling and session optimization

The upstream libraries and CC0 models above are retained. This iteration adds original game code for camera-relative walking and jumping, steering/pedal separation, joystick dead zones, pointer-cancel cleanup, pinch/elevation gestures, driving camera recentering, validated local session restore and recent safe-position recovery. Road vehicles restore stopped; an airborne plane retains its airspeed.

Default auto quality uses a smoothed frame interval, a bounded resolution range and a cooldown before increasing resolution again. Explicit low/high modes are retained. This optimization does not promise a specific iPhone frame rate. Pause stops scene redraws, including water/rotor animation, until a setting or viewport changes. Empty particle pools are hidden and NPC avoidance no longer constructs a temporary target array for every vehicle on every physics step.

35 automated tests pass, including regression checks for accidental braking, jump repetition, diagonal walking speed, camera-relative direction, swimming depth, invalid saves, stationary road-vehicle restore, airborne-plane restore, unavailable storage, nearby recovery and adaptive-resolution cooldowns. Real-device iPhone GPU performance and two-finger touch feel remain to be confirmed.

## 1.3 — free interactions

Original project code adds NPC vehicle takeover, cooldown-limited wanted heat, road-routed police pursuit, search/escape/interception and pedestrian flee reactions. No new assets or dependencies. Taken vehicles reuse the owned slot for the same type; normal session saving therefore captures their position. NPC populations and wanted state restart on reload. Pursuers remain an arcade approximation without rigid-body responses, off-road search, aircraft or boat units. Seven additional checks bring the total to 42, including a two-minute pursuit road/land check.

## 1.4 — visual presentation

All new surface/sky/contact-shadow textures, environment cubemap imagery, street dressing and character geometry are original procedural project code in `src/visuals.js`, `src/world.js`, `src/vehicles.js` and `src/asset-vehicles.js`. No additional third-party assets or libraries are introduced. The pinned Kenney conversion inputs and hashes are unchanged. Reflections use Three.js PMREM on generated cubemap faces and are rebuilt only for lighting changes. Browser verification uses the limited Canvas renderer; WebGL texture/normal/reflection output and phone frame rate remain unverified on actual hardware.

## 1.5 — input and handling

Original simulation/input/camera code adds progressive road throttle, speed-sensitive grip limits, a standstill brake-to-reverse delay, reliable stationary handbraking, thumb-relative stick origins and segment/AABB follow-camera occlusion. Existing Three.js clearcoat shading is used for car paint; no new library, model or texture sources. Ten focused regression cases increase the suite to 52 tests. Mobile viewport QA covers layout and basic mouse/pointer interactions; real iPhone multitouch and GPU performance remain unverified.
