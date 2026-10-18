# Procedural Profiles

Turn an exact string into a repeatable recipe and, now, a PNG image.

## What does it do now?

A seed chooses between two colour arrangements with equal probability:

- **Linear:** mark colours progress along a direction across the image.
- **Mixed:** mark colours are sampled independently of position.

All marks are soft: their opacity fades smoothly to zero at the edge. Hard-edged
circles have been removed. Every image is drawn with marks; plain smooth gradients
are not an output option.

Palette generation follows the approved experiment: saturation 65–90% and at least
25 percentage points of brightness difference between endpoint colours. Hue
relationships remain monochromatic or analogous. These rules target more vivid,
contrasting results; they do not guarantee perceived contrast after blending.

The seed chooses 3–5 HSB palette stops with a monochromatic or analogous
relationship. Each has its own saturation and brightness; the renderer interpolates
between surrounding stops, using every selected colour. The hue can come from anywhere on the colour wheel; the mixed mode is
not restricted to the green/turquoise reference.

Equal probability means 50/50 over random choices, not an exact quota in every
batch. The same input always selects the same mode and parameters in this version.

## Run it, step by step

### 1. Open a terminal in this folder

```sh
cd /Users/jathsin/Developer/Graphics/procedural_profiles
```

Requires Node.js 22 or newer. Check your installation with:

```sh
node --version
npm --version
```

Node runs JavaScript outside a browser. npm manages dependencies and the command
shortcuts in package.json. No web server or browser is required.

### 2. Install dependencies on a fresh checkout

```sh
npm ci
```

This workspace already has them installed. You do not need to install them before
every run. `node_modules/` contains external library code: seedrandom for repeatable
randomness and @napi-rs/canvas for drawing/PNG encoding, including its platform
packages. package-lock.json records exact versions. Do not edit node_modules/.

### 3. Inspect parameters without drawing

```sh
npm run recipe -- "object-123"
```

This prints JSON, a readable text description of the chosen parameters. It does
not save anything. Repeat the command to see that the recipe is unchanged, then
change the ID to explore another result. Case and spaces matter.

The `--` passes the input to our script. Quotes keep text with spaces together.
Even `"123"` is a string. Empty strings are accepted; malformed Unicode and
nonstring inputs to the library function are rejected.

To explicitly save just the recipe:

```sh
node scripts/inspect-recipe.js "my-object" > samples/my-object.json
```

The `>` replaces that file if it already exists. Use the direct node command here
so npm's introductory text is not included in your JSON.

### 4. Generate an image

```sh
npm run samples -- "my-object"
```

This writes a 512 × 512 PNG and its matching JSON recipe in `samples/`, then prints
the filename. Open the PNG in your editor or an image viewer.

Filenames contain the mode and input hash, so arbitrary input strings never become
filesystem paths. Repeating the input overwrites the same files. You can supply
several quoted IDs, or generate eight example images with:

```sh
npm run samples
```

These examples use object-0 through object-7. The default set contains both modes.
Reported times include generation and writing files; the first also includes
loading the renderer. These are local observations, not performance guarantees.

### 5. Run checks

```sh
npm test
```

Expect 13 passing tests and zero failures. They cover exact input handling,
repeatability, independent streams, parameter ranges across 1,000 IDs, equal mode
selection boundaries, colour conversion, PNG decoding/dimensions, opaque output,
gradient direction, soft edge falloff, and resource bounds. They do not prove aesthetic quality or
unique identities for every possible input.

## What is in samples/?

- PNG files: rendered images that you can open normally.
- Matching JSON files: parameters used for those images.
- object-123.json: a standalone example recipe, regenerated for version 6.

Samples are generated output, not implementation code. Only the sample script
writes them; the generator itself does not save or cache images.

## How the modules fit together

| File | Responsibility |
| --- | --- |
| pipeline.js | generateRecipe(input) returns parameters; generateImage(input, options) asynchronously returns PNG bytes. |
| src/input-randomness.js | Hash the exact string using SHA-256 and create seeded random streams. |
| src/math/distributions.js | Range, integer, weighted-choice, and probability helpers. |
| src/math/colour.js | Convert HSB to RGB and interpolate between colours. |
| src/recipe.js | Choose the mode and its compatible colour/texture settings. |
| src/presets/gradient.js | Draw marks with linear or mixed colour placement. Texture lives inside this preset. |
| src/presets/index.js | Select the drawing implementation. |
| src/renderer.js | Create the in-memory Canvas and encode PNG bytes. |
| scripts/inspect-recipe.js | Print a recipe from a terminal argument. |
| scripts/generate-samples.js | Save images and recipes for inspection. |
| test/ | Automated recipe and rendering checks. |

Canvas is the in-memory drawing surface. Skia, through @napi-rs/canvas, draws the
pixels; PNG encoding stores them without lossy compression. The image function
accepts optional width and height, each an integer from 1 to 2048 (default 512).
That limit bounds a single surface's memory; consumers still control concurrency.

## Reading the recipe

- `version: 6`: soft marks only, variable mark scale/count, and 3–5 palette stops.
- `seed`: hash of the original input string.
- `colour.stops`: 3–5 HSB palette colours; hue is in degrees, S/B in percentages.
- `preset.kind`: linear or mixed.
- `angleDegrees`: linear only; 0° goes left to right, 90° top to bottom.
- `texture.type`: always soft-marks.
- `variation.noise: null`: coherent noise is not used yet.
- `elements: []`: no additional decorative figures.

Soft marks belong to the preset's texture; they are not decorative elements.
Mixed colours sample the palette independently of position; linear colours use
the mark centre projected onto the chosen gradient direction.

## Initial artistic parameters (editable experiments)

The relationship choices are equally weighted. Monochromatic endpoints share a
hue; analogous endpoints differ by 20–45° in either direction.

Both arrangements use saturation 65–90%. Start brightness is sampled from 35–60%;
end brightness is sampled from start brightness + 25 up to 95%. Upper bounds
are excluded. These ranges live in COLOUR_RULES and apply to the palette endpoints,
not necessarily to the final blended pixels.

The internal name `linear` means a directional colour arrangement of marks, never
a plain gradient fill. Each mark samples its position along that direction with
a seeded offset of up to ±0.15 of the palette range, clamped to [0, 1]. This keeps
local variation while preserving the broad transition. Mixed mode samples the
whole palette range independently of position. Directional colour jitter has its
own random stream, so changing it does not move the marks.

The seed chooses one of two initial scale ranges with equal weights:

| Scale | Mark count | Radius as fraction of smaller image dimension |
| --- | --- | --- |
| Medium | 350–650 | 2.5–7% |
| Broad | 100–220 | 6–16% |

Counts are seeded integers; radii vary per mark. Fewer broad marks compensate for
the larger area they cover. These are editable experimental ranges, not a speed
guarantee: large marks still touch more pixels.

Each mark uses a radial gradient fading from opacity 1 at its centre to 0 at its
edge, approximating 1 − (3t² − 2t³) with nine opacity stops. Centres can lie slightly
outside the image; a uniform palette midpoint colour fills uncovered areas.

Palette stops have evenly spaced positions. Analogous hues progress across the
existing 20–45° span; monochromatic palettes keep one hue. Interior stops have
independently sampled saturation and brightness within the endpoint bounds. This
adds genuine palette controls without unrestricted unrelated colour combinations.

Colour interpolation follows the shorter hue arc. Each mark gets one interpolated
HSB colour, converted to RGB. No full-image smooth gradient, blur, or filter is applied.

## Repeatability and deferred work

The renderer accepts version 6 recipes. Regenerate older JSON from its input.
Version 6 changes palette and texture parameters, so existing inputs produce new
images. Samples are regenerated using the same filenames. The random-stream derivation
namespace remains stable, while a separate drawing-v2 stream supplies circle
placement/colour. More drawing samples do not alter the recipe.

Repeatability is checked in the same runtime/renderer environment, not guaranteed
pixel-for-pixel across platforms or dependency upgrades. Different seeds can still
produce similar images. Consumers own caching and storage policies.

Noisejs is accepted but remains uninstalled until needed. Other presets, Gaussian
sampling, decorative elements, JPEG export, and post-processing remain deferred.
See PROJECT.md for the roadmap and AGENTS.md for collaboration principles.
