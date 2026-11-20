# Living Island 1.1 — open-source upgrades

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

NPC behavior is intentionally simple. Cross traffic at unsignalled junctions is approximate, NPC cars cannot be stolen, the police car does not start a pursuit, and the game still uses arcade physics. Setting traffic to light/off is available on slower devices.
