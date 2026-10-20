# World map art-style mockups (prompt pack)

**Purpose:** give Steven four art-style directions for the world map screen, each shown in
three exploration states, so a style can be picked before any map art is commissioned or
any renderer is built.

**Model:** `image_generate` → gpt-image-2-medium (ChatGPT Image 2.0), `aspect_ratio: landscape`.

**Scope note:** art style only. Lore accuracy is deliberately secondary — but the geography
block below is taken from the real world so the four styles are comparable and so the fog
states match what `src/sim/world/reveal.ts` actually does.

## Geography block (verbatim in every prompt)

Derived from `WORLD` in `src/content/world.ts` (80×60, Haven at 16,38) and the five
`world_regions` rows.

> Fantasy world map of a frontier territory, seen from directly above with gentle oblique
> relief, wide landscape. Geography, fixed in every image: a small frontier town sits in open
> home fields at the lower-left third of the map, with three dirt roads radiating out from it.
> North-centre, a vast dark silt-black inland lake. Along the whole eastern edge, an impassable
> snow-capped mountain wall. North-west, dense old pine forest. North-east, burned-over scorched
> frontier with blackened stumps. South-east, low green farmland and a river delta meeting a
> coastline. South-west, dry scrub hills and gravel barrows. A river runs from the eastern
> mountains through the lake and south-west past the town to the sea.

## POI block (verbatim in every prompt)

> Points of interest are marked with clear, readable map icons: the town itself, plus markers
> for dungeon entrances, ruins, bandit camps, a lumber camp, a mine, a magical node and a
> fortified outpost.

## Universal constraints

> No text, no lettering, no words, no numbers, no legend, no UI panels, no frame or border.

(Place names are a UI overlay in the real screen, and generated lettering comes out garbled.)

## The four styles

| # | Style | Fog-of-war treatment |
|---|---|---|
| A | Realistic — satellite/relief, AAA strategy campaign map | volumetric grey cloud and mist |
| B | Hand-drawn cartographer's map on parchment | blank undrawn parchment; strokes stop mid-line |
| C | Very cartoony — bold outlines, candy palette | chunky storybook clouds |
| D | Embroidered tapestry map, wool on linen | raw unwoven linen with loose thread ends |

Style D is the creative/exploratory slot: the land is *stitched in* as the guild learns it,
so progress reads as a tapestry being woven.

## Round 2 — styles built from Steven's reference images (2026-10-20)

Steven supplied five reference images, kept at `map-mockups/refs/`. Each round-2 prompt passes
its reference via `reference_image_urls` and borrows the *rendering technique* only.

| # | Style | Reference | Fog-of-war treatment |
|---|---|---|---|
| E | Tolkien / Middle-earth ink-on-parchment atlas | `ref-e-middleearth.jpg` | undrawn parchment; ink stops mid-stroke |
| F | Laser-cut cork relief on dark panel, amber LED under-lighting | `ref-f-cork.jpg` | bare unlit panel — land is *built and lit* as you explore |
| G | Torn adventurer's chart, teal watercolour sea | `ref-g-treasure.jpg` | the sheet is missing; the map is recovered in fragments |
| H | Illustrated atlas, satellite-like terrain | `ref-h-atlas.jpg` | opaque cloud deck |
| I | Painted collector map, ribbon banners | `ref-i-painted.jpg` | painted cloud banks |

### ⚠ Two traps found in round 2

1. **A reference image overrides `aspect_ratio`.** G came back square and H came back portrait
   because their references were. Fix: add an explicit `CRITICAL FRAMING` paragraph demanding a
   wide landscape rectangle, and re-check `pixel_size` in the tool result — not just the
   `aspect_ratio` you asked for.
2. **A reference image's TEXT gets copied, including its language and title.** H reproduced the
   Aredia reference's Spanish labels and its literal `AREDIA` title. Fix: state that only the
   rendering technique is borrowed, forbid copying any text/title/language from the reference,
   and supply the exact English place names to use.

### ⚠ Reversal: gpt-image-2 renders legible text

Round 1 banned all lettering on the assumption it would come out garbled. That was wrong —
round 2 produced clean, correctly spelled English place names (`GREYFORD`, `Lake Ashenmere`,
`Thornwood Reach`). Allow hand-lettered names in any style whose identity depends on them, and
supply the names explicitly so they match our lore.

## The three states

| State | Revealed | POIs | Notes |
|---|---|---|---|
| 1 Start | a small pocket around the town, ~1/10 of the map | 3 | matches `SIGHT.base = 3` around Haven |
| 2 Mid | ~half, ragged fingers along roads and river | 10–12 | lake's south shore known, north shore not |
| 3 Late | all | ~20 | includes the lich's black fortress, far north-east |

## Generation order (matters)

Generate **state 3 (full map) first** for each style, then produce states 1 and 2 as
image-to-image edits of that full map with the fog treatment applied. This keeps the
geography identical across the three states of a style, which is the whole point of
showing three states.

## Filenames

`output/art/map-mockups/map-<a-i>-<style>-<1start|2mid|3late>.png` — 9 styles x 3 states = 27 images.
References: `output/art/map-mockups/refs/ref-<e-i>-<style>.jpg` (committed; the generated maps are gitignored).
