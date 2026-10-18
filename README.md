# Procedural Profiles

Turn an exact string into a repeatable recipe and a PNG profile image.

## What does it do now?

Recipe version 15 chooses between two presets with equal probability.

### Gradient preset (Hobbs-style circles)

The gradient preset follows the first examples in Tyler Hobbs's
[Working with Color in Generative Art](https://www.tylerxhobbs.com/words/working-with-color-in-generative-art):
about a thousand crisp, opaque circles whose colours differ **only in hue**. Saturation
and brightness are fixed within each image at a calm pastel level. The circles have
hard edges, yet the image reads as soft because neighbouring colours are close.

A seed chooses between two colour arrangements with equal probability:

- **Linear:** the hue progresses along a direction across the image, with a small
  random offset per circle so the transition is uneven rather than perfect.
- **Mixed:** each circle picks a random hue from the palette's range.

### Soft-forms preset

Two or three large colour regions over a smooth two-hue background, in the style of
soft abstract product gradients. Each region is a huge circle centred outside the
image, so its visible edge is an **evenly rounded arc**. Every region is drawn twice:
once very blurred, and once only slightly blurred but fading out along the arc, so an
edge goes from crisp at one end to smoky at the other. Fine seeded **grain** on top
gives a photographic texture.

Colours: three **neighbouring hues** spread over 50–110°. The background blends
vivid tones of the first two (close hues blend without turning grey). The regions
use, in order: a deep tone of the third hue, a **light glow** of the middle hue (a
tinted near-white drawn translucent, so it glows instead of covering), and a vivid
tone of the third hue. Regions are nearly opaque, which keeps their colours pure.

This version was chosen by the user from visual experiments (variant "A2" with a
softer light colour), after rejecting straight bands, wedges, colour-harmony accents
and translucent light-and-shadow overlays.

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

Expect 15 passing tests and zero failures. They cover exact input handling,
repeatability, independent streams, parameter ranges across 1,000 IDs, equal mode
selection boundaries, colour conversion, PNG decoding/dimensions, opaque output,
gradient direction, crisp circle edges, relative soft-form blur, and resource bounds. They do not prove
aesthetic quality or unique identities for every possible input.

## What is in samples/?

- PNG files: rendered images that you can open normally.
- Matching JSON files: parameters used for those images.
- object-123.json: a standalone example recipe, regenerated for version 15.

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
| src/math/colour.js | Convert HSB to RGB, interpolate colours, and estimate perceived lightness (luma). |
| src/recipe.js | Choose the mode and its compatible colour/texture settings. |
| src/presets/gradient.js | Draw circles with linear or mixed colour placement. Texture lives inside this preset. |
| src/presets/soft-forms.js | Draw blurred arc-edged colour regions and grain over a base gradient. |
| src/presets/index.js | Select the drawing implementation. |
| src/renderer.js | Create the in-memory Canvas and encode PNG bytes. |
| scripts/inspect-recipe.js | Print a recipe from a terminal argument. |
| scripts/generate-samples.js | Save images and recipes for inspection. |
| test/ | Automated recipe and rendering checks. |

Canvas is the in-memory drawing surface. Skia, through @napi-rs/canvas, draws the
pixels; PNG encoding stores them without lossy compression. The image function
accepts optional width and height, each an integer from 1 to 2048 (default 512).
That limit bounds a single surface's memory; consumers still control concurrency.
A 512 × 512 image takes about 13 ms locally with the gradient preset and about
80 ms with soft forms, because each blur and the grain are extra passes
(observations, not guarantees).

## Reading the recipe

- `version: 15`: soft forms become arc-edged colour regions with grain.
- `seed`: hash of the original input string.
- `colour.stops`: HSB colours; hue is in degrees, S/B in percentages. Gradient:
  two stops sharing saturation and brightness. Soft forms: the background's two
  vivid stops.
- `colour.hues`: soft forms only; the three neighbouring hues.
- `preset.type`: gradient or soft-forms.
- `preset.kind`: gradient only; linear or mixed.
- `angleDegrees`: main direction; 0° goes left to right, 90° top to bottom
  (gradient linear mode, and soft forms).
- `variation.colourJitter`: linear only; random offset of each circle's gradient position.
- `variation.grain`: soft forms only; grain strength in 0–255 channel units.
- `texture.type`: circles (gradient) or soft-arcs (soft forms).
- `texture.forms`: soft forms only; every region is listed explicitly:
  `directionDegrees` (where its circle's centre lies), `radius` and `edge` (how far
  the arc's nearest point is from the image centre), both as fractions of the smaller
  dimension, `colour` (exact HSB), `opacity`, `softBlur` and `crispBlur` (the two
  passes' blur radii), and `crispFadeSide`/`crispFadeEnd` (which way along the arc
  the crisp edge fades and where it vanishes).
- `variation.noise: null`: coherent noise is not used yet.
- `elements: []`: no additional decorative figures.

## Initial artistic parameters (editable experiments)

These ranges live in COLOUR_RULES, TEXTURE_RULES, SOFT_FORM_RULES and
SOFT_FORM_COLOUR_RULES in src/recipe.js.

| Parameter | Range | Reference |
| --- | --- | --- |
| Saturation | 35–50%, one value per image | Hobbs's examples measure 40% |
| Brightness | 65–80%, one value per image | Hobbs's examples measure 70% |
| Hue span | 40–90°, either direction around the wheel | about 40° (mixed) and 80–90° (linear) |
| Circle count | 800–1,200 | enough to cover the image at this size |
| Circle radius | 2–6% of the smaller image dimension | Hobbs uses roughly 2–6% |
| Linear jitter | ±0.08 of the palette range | Hobbs offsets by about 8% of the height |

The pastel range, rather than a fixed 40/70, makes different objects easier to tell
apart. The circle size matches the references, at the user's request; at avatar size the
circles become a fine texture. The random 8% offset makes the linear transition uneven, like the
reference; it has its own random stream, so changing it does not move circles.

Soft forms (SOFT_FORM_RULES):

| Parameter | Range |
| --- | --- |
| Number of regions | 2–3 |
| Circle radius | 1.2–3 × the smaller image dimension |
| Arc's distance from the centre | −30% to +30% of the smaller dimension |
| Opacity | 85–100% (light glow: 60% of that) |
| Soft pass blur | 8–15% of the smaller dimension |
| Crisp pass blur | 1–3%, fading out 40–80% of the way along the arc |
| Grain | ±7 per channel, the same for R, G and B (no colour speckles) |

Soft-form palette (SOFT_FORM_COLOUR_RULES), hue span 50–110°:

| Tone | Saturation | Brightness | Used by |
| --- | --- | --- | --- |
| Vivid | 55–85% | 90–100% | background (hues 1–2), third region (hue 3) |
| Deep | 70–90% | 68–82% | first region (hue 3) |
| Light | 8–20% | 97–100% | second region (hue 2), translucent |

Blur and radii are relative to the image, so a 64 px avatar looks like a scaled-down
512 px image. Grain is per pixel, so it is finer relative to larger images. The
background is drawn by Canvas, which blends in RGB; for nearby hues this is close
to blending in HSB.

Circle centres may lie up to one maximum radius outside the image so edges are
covered like the interior. The background is filled with the palette's midpoint
colour, so any small gaps between circles stay within the palette. Hue interpolation
follows the shorter arc around the colour wheel. No blur or filter is applied.

## Repeatability and deferred work

The renderer accepts version 15 recipes. Regenerate older JSON from its input.
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
  circles, after the user compared the samples with his reference images.
- Version 12: adds the soft-forms preset, chosen with equal probability; the
  gradient preset is unchanged, but existing inputs may now select soft forms.
- Version 13: soft forms get their own deep/mid/light palette, measured from the
  references, instead of the pastel hue-only palette.
- Version 14: soft forms combine hues by analogous, complementary,
  split-complementary or triadic relationships; the base stays in the dominant hue.
- Version 15: soft forms become two or three arc-edged colour regions in three
  neighbouring hues, with crisp-to-smoky edges, a translucent light glow and grain.
