# Procedural Profiles

Turn an exact string into a repeatable recipe and a PNG profile image.

## What does it do now?

Recipe version 16 draws every image with the **soft-forms** preset, in the style of
soft abstract product gradients: two or three large colour regions over a smooth
two-hue background. Each region is a huge circle centred outside the image, so its
visible edge is an **evenly rounded arc**. Every region is drawn twice: once very
blurred, and once only slightly blurred but fading out along the arc, so an edge goes
from crisp at one end to smoky at the other.

Colours: three **neighbouring hues** spread over 50–110°. The background blends
vivid tones of the first two (close hues blend without turning grey). The regions
use, in order: a deep tone of the third hue, a **light glow** of the middle hue (a
tinted near-white drawn translucent, so it glows instead of covering), and a vivid
tone of the third hue. Regions are nearly opaque, which keeps their colours pure.

The seed chooses one of two **finishes** with equal probability:

- **Smooth:** the regions as described.
- **Frosted:** the same regions rebuilt from about four thousand small crisp
  bubbles. The regions are painted onto a small hidden map (128 px on the longer
  side), and each bubble takes the map's colour under its centre. Inside a region
  the bubbles merge; along the boundaries they give a frosted-glass edge.

Both finishes end with fine seeded **grain**, which gives a photographic texture.

These choices came from visual experiments reviewed by the user: variant "A2" with a
softer light colour for the regions, and small colour-map bubbles for the frosted
finish. The earlier circles preset was retired in favour of the frosted finish.

Equal probability means 50/50 over random choices, not an exact quota in every
batch. The same input always produces the same recipe and image in this version.

## Run it, step by step

### 1. Open a terminal in this folder

```sh
cd /Users/jathsin/Developer/graphics/procedural_profiles
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

Filenames contain the finish and input hash, so arbitrary input strings never become
filesystem paths. Repeating the input overwrites the same files. You can supply
several quoted IDs, or generate eight example images with:

```sh
npm run samples
```

These examples use object-0 through object-7. The default set contains both finishes.
Reported times include generation and writing files; the first also includes
loading the renderer. These are local observations, not performance guarantees.

### 5. Run checks

```sh
npm test
```

Expect 14 passing tests and zero failures. They cover exact input handling,
repeatability, independent streams, parameter ranges across 1,000 IDs, colour
conversion, PNG decoding/dimensions, opaque output, rounded arc edges, relative blur,
grain, frosted bubble colours, and rejection of invalid or retired parameters. They
do not prove aesthetic quality or unique identities for every possible input.

## What is in samples/?

- PNG files: rendered images that you can open normally.
- Matching JSON files: parameters used for those images.
- object-123.json: a standalone example recipe, regenerated for version 16.
- soft-forms-review/: contact sheets and experiments from the design reviews.

Samples are generated output, not implementation code. Only the sample script
writes them; the generator itself does not save or cache images. Filenames stay
the same when samples are regenerated, so an open image viewer may show a cached
old version: reopen the file to see the new one.

## How the modules fit together

| File | Responsibility |
| --- | --- |
| pipeline.js | generateRecipe(input) returns parameters; generateImage(input, options) asynchronously returns PNG bytes. |
| src/input-randomness.js | Hash the exact string using SHA-256 and create seeded random streams. |
| src/math/distributions.js | Range, integer, weighted-choice, and probability helpers. |
| src/math/colour.js | Convert HSB to RGB. Also interpolation and luma helpers, currently unused by the generator. |
| src/recipe.js | Choose the palette, regions and finish. |
| src/presets/soft-forms.js | Draw the regions, the frosted bubbles and the grain. Texture lives inside this preset. |
| src/presets/index.js | Select the drawing implementation. |
| src/renderer.js | Create the in-memory Canvas and encode PNG bytes. |
| scripts/inspect-recipe.js | Print a recipe from a terminal argument. |
| scripts/generate-samples.js | Save images and recipes for inspection. |
| test/ | Automated recipe and rendering checks. |

Canvas is the in-memory drawing surface. Skia, through @napi-rs/canvas, draws the
pixels; PNG encoding stores them without lossy compression. The image function
accepts optional width and height, each an integer from 1 to 2048 (default 512).
That limit bounds a single surface's memory; consumers still control concurrency.
A 512 × 512 image takes about 80 ms locally with the smooth finish and about 60 ms
with the frosted finish, whose blurs run on the small map (observations, not
guarantees).

## Reading the recipe

- `version: 16`: soft forms only, with a smooth or frosted finish.
- `seed`: hash of the original input string.
- `colour.hues`: the three neighbouring hues, in degrees.
- `colour.stops`: the background's two vivid HSB colours (S/B in percentages).
- `preset.type`: always soft-forms. `angleDegrees`: the background's direction;
  0° goes left to right, 90° top to bottom.
- `variation.grain`: grain strength in 0–255 channel units (peak to peak).
- `texture.type`: always soft-arcs.
- `texture.forms`: every region is listed explicitly: `directionDegrees` (where its
  circle's centre lies), `radius` and `edge` (how far the arc's nearest point is from
  the image centre), both as fractions of the smaller dimension, `colour` (exact
  HSB), `opacity`, `softBlur` and `crispBlur` (the two passes' blur radii), and
  `crispFadeSide`/`crispFadeEnd` (which way along the arc the crisp edge fades and
  where it vanishes).
- `texture.finish`: smooth or frosted. `texture.bubbles` (frosted only): bubble
  `count` and `minRadius`/`maxRadius` as fractions of the smaller dimension.
- `variation.noise: null`: coherent noise is not used yet.
- `elements: []`: no additional decorative figures.

## Initial artistic parameters (editable experiments)

These ranges live in SOFT_FORM_RULES and SOFT_FORM_COLOUR_RULES in src/recipe.js.

| Parameter | Range |
| --- | --- |
| Number of regions | 2–3 |
| Circle radius | 1.2–3 × the smaller image dimension |
| Arc's distance from the centre | −30% to +30% of the smaller dimension |
| Opacity | 85–100% (light glow: 60% of that) |
| Soft pass blur | 8–15% of the smaller dimension |
| Crisp pass blur | 1–3%, fading out 40–80% of the way along the arc |
| Grain | ±7 per channel, the same for R, G and B (no colour speckles) |
| Frosted bubbles | 3,200–4,800, radius 1–3% of the smaller dimension |

Palette (SOFT_FORM_COLOUR_RULES), hue span 50–110°:

| Tone | Saturation | Brightness | Used by |
| --- | --- | --- | --- |
| Vivid | 55–85% | 90–100% | background (hues 1–2), third region (hue 3) |
| Deep | 70–90% | 68–82% | first region (hue 3) |
| Light | 8–20% | 97–100% | second region (hue 2), translucent |

Blur, radii and bubble sizes are relative to the image, so a 64 px avatar looks like
a scaled-down 512 px image. Grain is per pixel, so it is finer relative to larger
images. The background is drawn by Canvas, which blends in RGB; for nearby hues this
is close to blending in HSB. Smaller bubbles make the frosted finish converge on the
smooth one; larger bubbles make the frosted edges coarser.

## Repeatability and deferred work

The renderer accepts version 16 recipes. Regenerate older JSON from its input.
Repeatability is checked in the same runtime/renderer environment, not guaranteed
pixel-for-pixel across platforms or dependency upgrades. Different seeds can still
produce similar images, especially with similar hues. Consumers own caching and
storage policies.

Noisejs is accepted but remains uninstalled until needed. Other presets, Gaussian
sampling, decorative elements, JPEG export, and post-processing remain deferred.
See CLAUDE.md for the roadmap and AGENTS.md for collaboration principles.

## History

- Version 9: soft-edged circles, squares, rectangles and triangles; vivid
  monochromatic or analogous palettes (commit e43257c).
- Version 10: added a minimum perceived-lightness gap between palette endpoints
  (commit 7a5a518). It raised palette contrast, but images stayed flat because most
  pixels showed the background colour.
- Version 11: replaced both with Hobbs-style pastel hue-only palettes and crisp
  circles, after the user compared the samples with Hobbs's reference images.
- Version 12: adds the soft-forms preset, chosen with equal probability; the
  gradient preset is unchanged, but existing inputs may now select soft forms.
- Version 13: soft forms get their own deep/mid/light palette, measured from the
  references, instead of the pastel hue-only palette.
- Version 14: soft forms combine hues by analogous, complementary,
  split-complementary or triadic relationships; the base stays in the dominant hue.
- Version 15: soft forms become two or three arc-edged colour regions in three
  neighbouring hues, with crisp-to-smoky edges, a translucent light glow and grain.
- Version 16: the circles preset is retired; soft forms gain a frosted finish built
  from small bubbles coloured by a hidden map of the regions, with the same grain.
