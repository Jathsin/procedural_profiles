# Procedural Profiles

## Goal and scope

Create aesthetic, minimalist, coloured and textured profile images from an
object's string ID or hash. Developers should be able to use the generator to
provide visual identities for entries, entities, avatars, and other application
objects. The eventual context is a product at the user's job.

The desired aesthetic is procedural art: gradients, waves, stripes, flowing
forms, organic variation, and texture. The previously reviewed conventional
avatar generators are not the visual target. Tyler Hobbs's work and technical
essays are inspiration, not a requirement to copy his style or toolchain.

All generation runs on our infrastructure. The separate job that downloads
entries is outside this project's scope. Caching and storage policies belong to
the consuming application; the generator is responsible for its own computation,
speed, memory use, and output.

The near-term goal is a first working version the user can inspect, learn from,
and modify. Build it incrementally through explicitly requested phases, rather
than implementing the entire product in one pass.

## Working philosophy

Follow AGENTS.md:

- Do not write implementation code unless explicitly requested. This document
  plans implementation; it does not authorise starting it.
- Prefer simplicity and understandable algorithms over premature optimisation.
- Explain concepts, changes, and trade-offs briefly and clearly, as a computer
  graphics professor guiding a personal project.
- Leave technical, artistic, and product decisions to the user. Clearly label
  recommendations and unresolved choices.
- Keep developer usability, integration, maintenance, and product value in mind.
- Build only the requested phase. Review its outcome before moving forward.

Resource efficiency remains a design constraint: simplicity does not mean
unbounded drawing work or avoidable memory growth.

## Pipeline

String input → hash → seeded pseudorandom generators → recipe → preset and
its texture → complementary elements → optional post-processing → image export.

### 1. String input and hashing

Accept a string, not a number. It may contain an object ID, name, or existing hash.
Hash it to obtain avalanche behaviour: small input changes should substantially
change the seed. The user may revise this behaviour later.

Confirmed: preserve the exact string, including case, whitespace, and Unicode
normalisation. Empty strings are accepted. Reject malformed Unicode rather than
silently replacing it during UTF-8 encoding.

### 2. Seeded randomness

Generate repeatable random values from the hash. One or several generators may
be used. Separate streams for different responsibilities are recommended so that
changing texture sampling does not unexpectedly alter colour selection.

Hashing and pseudorandom generation have different jobs: hashing mixes the input;
the generator supplies the sequence of values used to construct the image.

### 3. Recipe: choose image parameters

Produce a description of the image before drawing it. The recipe contains five
parameter groups:

| Group | Responsibility |
| --- | --- |
| HSB / colour | A multi-colour palette: colour count, hue/saturation/brightness values, relationships, background/main/accent roles, and usage weights. |
| Preset | Choose the composition family: gradient, stripes, waves, or flow fields. |
| Variation | Choose probability distributions, coherent noise, and other functions appropriate to the preset. |
| Texture | Choose how the preset draws its structure: dots, lines, or other geometry. |
| Elements | Choose whether and how complementary geometry decorates the composition, such as bubbles alongside lines. |

Probability distributions and coherent noise stay separate in the maths layer.
Uniform and Gaussian distributions control how values are sampled; Perlin and
simplex noise control how values vary coherently across space. They may be used
together. Gaussian sampling is also distinct from a Gaussian blur filter.

Selection must respect compatibility between presets, textures, and elements.
Unrestricted random combinations are not automatically aesthetic. The rules and
parameter ranges will be developed and reviewed with the user.

### Multi-colour palette selection

Images may contain multiple colours. The colour recipe describes a palette,
not just one HSB triplet. Palette decisions are reproducible choices driven by
the seeded generator, within constraints agreed with the user.

The selection process will specify:

1. **Colour count:** choose how many palette colours to use from an allowed range,
   optionally with weighted probabilities. The range and weights remain open.
2. **Colour relationships:** choose a base hue and a relationship rule. Candidates
   include monochromatic (one hue with different saturation/brightness), analogous
   (nearby hues), and complementary (opposing hues). These are options, not an
   approved fixed set; relationships alone do not guarantee aesthetic quality.
3. **Roles and contrast:** assign background, main, and optional accent roles,
   with suitable saturation and brightness constraints. Whether the background
   counts toward the palette size remains to be decided.
4. **Usage:** select relative prominence or usage weights where applicable.
   Each preset translates the palette into spatial colour placement: gradient
   stops, stripe colours, or colours assigned to flow-field paths or regions.

The recipe selects colours and their roles; the preset applies them to its
geometry. Colour count refers to selected palette colours or gradient stops,
not the number of distinct pixel colours after interpolation and rendering.
A two-stop gradient can contain many intermediate colours.

Confirmed for the first recipe: two seeded endpoint colours, with a
monochromatic or analogous relationship. Initial numeric HSB ranges and equal
relationship weights are provisional experimental defaults documented in README.md. Variable counts and more elaborate selection can follow after
the initial palette is reviewed across sample seeds.

### 4. Presets and drawing texture

Presets form a dedicated package/folder, with an implementation per preset.
Each preset owns its drawing textures because the marks depend on its geometry.
For example, a flow field can be expressed as strokes or dots along paths.
There is no separate texture module in the agreed structure.

Elements remain a single module. Presets provide the composition information
needed for sensible placement of complementary figures.

### 5. Post-processing, last

Reserve a separate module for effects applied after drawing, such as Gaussian
blur. Implement this stage only at the end of the planned sequence. It is optional
and distinct from the texture drawn by a preset. Account for additional passes
and image buffers when evaluating its cost.

### 6. Export

Return an encoded image through the public pipeline. PNG and JPEG are the target
formats; PNG is the recommended initial format, pending user confirmation.
PNG preserves pixels and transparency; JPEG trades detail for potentially smaller
files and does not support transparency.

A canvas is the in-memory drawing surface, not the output format. The renderer
turns drawing instructions into pixels; the encoder produces PNG/JPEG data.
Writing examples to samples/ belongs to the sample runner. The generator should
not automatically save every image to disk.

## Tools and decision status

The table distinguishes explicit choices from the proposed implementation stack.
Recommendations are not additional user decisions.

| Area | Tool / approach | Status and reason |
| --- | --- | --- |
| Language | JavaScript | User's proposed implementation language. |
| Execution | Our infrastructure | Confirmed; no browser generation requirement. |
| Runtime | Node.js | Recommended to run JavaScript outside a browser; no HTTP service required. |
| Hashing | SHA-256 through Node crypto | Confirmed for milestone 1. |
| Pseudorandom generation | seedrandom | Confirmed for milestone 1, with independent named streams. |
| Distributions and geometry | JavaScript Math plus small helpers | Recommended for simplicity; distributions remain separate from noise. |
| Coherent noise | noisejs | Accepted by the user; provides Perlin and simplex noise. |
| Recipe | Plain JavaScript | Recommended; contains selection rules without drawing dependencies. |
| Presets and elements | Canvas 2D drawing interface | Recommended for gradients, paths, dots, and shapes. |
| Renderer | @napi-rs/canvas, backed by Skia | Recommended server-side Canvas implementation and image export. Skia performs the underlying 2D rendering. |
| Post-processing | Dedicated module; consider sharp | Deferred until the final phase; no filter library selected yet. |
| Output | PNG initially; JPEG option | Both discussed as target formats; initial PNG is a recommendation. |
| Samples | Node filesystem tools | Recommended for a separate sample runner saving to samples/. |

Quil/Processing remain alternatives only if they materially simplify the task
while retaining suitable efficiency. The user has no preference for them merely
because references use them. The current recommendation is to stay with the
JavaScript stack; no performance superiority is assumed without measurement.

Noise support is extensible. Start with the accepted library's Perlin and simplex
options as needed; do not implement every noise family in advance. Additional
noise algorithms or combinations require a concrete visual purpose.

## Planned project structure

These are planned paths, not instructions to create implementation files now.
Presets is a local package/folder; separate publication and package tooling are
not required at this stage.

    procedural_profiles/
      AGENTS.md
      PROJECT.md
      README.md
      pipeline.js                 Public entry point and orchestration
      src/
        input-randomness.js       String handling, hash, seeded generators
        math/
          distributions.js        Uniform/Gaussian sampling helpers
          noise.js                Perlin/simplex through noisejs
          geometry.js             Geometry and interpolation as needed
        recipe.js                 Compatible parameter selection
        presets/
          index.js                Preset selection/exports
          gradient.js             Gradient composition and drawing texture
          stripes.js              Stripe composition and drawing texture
          waves.js                Wave composition and drawing texture
          flow-fields.js          Flow-field composition and drawing texture
        elements.js               Complementary geometry and placement helpers
        renderer.js               Drawing surface and image encoding
        postprocessing.js         Reserved for the final phase
      scripts/
        generate-samples.js       Calls pipeline and saves review images
      samples/                    Generated PNG/JPEG examples

The public entry point accepts a string ID and, if agreed, configuration options.
generateRecipe(input) synchronously returns a plain recipe object.
generateImage(input, { width, height }) asynchronously returns PNG bytes.
Dimensions default to 512 × 512 and are bounded from 1 to 2048.

Milestone 1 also adds src/math/distributions.js, scripts/inspect-recipe.js,
test/recipe.test.js, package.json, and a dependency lockfile. The renderer, gradient preset package, sample runner, and maths colour helpers
are now implemented. Noise, elements, and post-processing files remain deferred.

## Milestones, ordered by increasing complexity

This is a proposed teaching and implementation order, not authorisation to build
all milestones. Complexity assumes basic implementations; elaborate gradients
could be more expensive than simple waves.

### 0. Agree the first slice

Confirm remaining tool choices, input treatment, output size/format, initial
palette count and relationship rules, and the smallest useful gradient example.
Establish a small fixed set of review IDs,
including similar strings. Keep the first phase's scope concrete and limited.

### 1. String-to-recipe foundation (implemented)

The user revised the first milestone to produce parameters only. Implement
SHA-256, independent seedrandom streams, range/integer/weighted/optional selection
helpers, and a versioned linear-gradient recipe with two endpoint colours.
Preserve exact strings; select monochromatic or analogous relationships.
Return inspectable JSON through generateRecipe(input) in pipeline.js.

No rendering, noise sampling, textures, decorations, or image export in this phase.
The inspection script prints JSON; samples/object-123.json is a review example.

Review: repeatability, a known SHA-256 vector, exact input handling, stream
independence, selection boundaries, and compatible recipes over 1,000 inputs.
The original five recipe tests passed; subsequent rendering work expands the suite. This is not a uniqueness or visual-quality proof.

### 1b. Gradient rendering with two equally likely modes (implemented)

The user chose an evenly mixed colour field resembling the reference, while
requiring it to be equally likely as a linear transition. Recipe version 2
therefore selects linear or mixed mode with equal weights. This is probability,
not an exact 50/50 quota per batch. Both retain the two-colour monochromatic or
analogous palette options; no palette is hard-coded to green/turquoise.

Current recipe version 6 uses only soft marks. The hard-edged circle feature is
removed at the user's request. The seed still chooses equally between directional
and evenly mixed colour arrangements. Every mark fades to transparency at its edge;
no plain smooth gradient or post-processing blur is used.

The seed selects either 350–650 medium marks (radii 2.5–7% of the smaller image
dimension), or 100–220 broad marks (radii 6–16%), with equal initial weights.
These are adjustable experimental ranges. Larger marks cover more pixels, so fewer
marks do not automatically imply faster rendering.

Palettes now contain 3–5 evenly positioned stops. Monochromatic or analogous hue
relationships are retained; analogous stops span 20–45°. Interior stops sample
saturation and brightness independently within the palette bounds. Rendering
interpolates between surrounding stops so every selected colour contributes.
The renderer remains @napi-rs/canvas with PNG export, 512 × 512 by default.

The user approved an experiment with saturation 65–90% and at least 25 brightness
percentage points between endpoints. Both arrangements now share these constraints:
start brightness 35–60%, end brightness start+25 to 95%, retaining monochromatic
and analogous relationships. These endpoint constraints are not guarantees of
perceptual contrast in the final blended image.

The user confirmed the reference-style field of marks as the target, distributed
either evenly in colour or following a directional colour transition. The internal
`linear` name refers only to this directional arrangement, never a plain fill.
Version 5 adds seeded colour jitter of ±0.15 in palette position for directional
marks, clamped to [0, 1], to keep local variation. A separate colour-variation
stream preserves geometry. The same sample inputs were regenerated for review.

pipeline.js now exposes asynchronous generateImage(input, options), returning PNG
bytes, alongside generateRecipe(input). Only the sample script writes files.
It saves PNG/JSON pairs using safe hash-based filenames, sequentially.

Verification: 13 tests pass, covering recipes and both PNG modes; rendered samples
were visually inspected. Older recipes must be regenerated for the version 6 renderer.
Noise, decorative elements, other presets, JPEG, and post-processing remain deferred.

### 2. Controlled variation within gradients

Introduce distributions and noise as separate maths capabilities. Add restrained
colour variation or texture inside the gradient preset. Compare Perlin and simplex
where useful; do not force both into every image.

Review: effects are explainable and controllable; texture remains visible and
pleasant at the intended size; the colour palette retains coherence.

### 3. Stripes

Add straight stripe compositions with controlled spacing, thickness, colour, and
preset-specific drawing textures. Expand the recipe only as required.

Review: variation produces coherent compositions across a collection of seeds;
mark counts and runtime remain bounded.

### 4. Waves

Extend the geometric vocabulary to curved or oscillating bands/lines. Introduce
appropriate functions and coherent perturbations without losing control of shape.

Review: curves render smoothly, texture follows the geometry, and complexity is
justified by a visible improvement.

### 5. Flow fields

Define a direction field and trace paths through it. Expose a small set of useful
controls, such as field scale, path length, step size, and density. Keep dot/stroke
textures inside this preset. More involved spacing or collision rules come only
if explicitly requested.

Review: paths have the desired visual character; path and step limits prevent
runaway work; compare rendering cost with simpler presets.

### 6. Complementary elements and recipe refinement

Implement optional decorations in elements.js, starting with simple geometry.
Let presets provide placement context. Refine compatibility and selection rules
across presets, colours, textures, and decorations.

Review: elements support the composition rather than clutter it; placement work
is bounded; inspect collections at actual profile-picture size.

### 7. Optional post-processing

Implement only the requested filters after the drawing pipeline is established.
A Gaussian blur is one possible experiment, not a committed default. Select a
library such as sharp only if the agreed effects justify it.

Review: compare before/after images, generation time, memory, and preservation of
fine texture. Confirm export behaviour after filtering.

## Verification and resource constraints throughout

- Distinguish deterministic generation from guaranteed uniqueness. Equal input,
  settings, version, and rendering environment should reproduce the same result.
- Avalanche behaviour changes the hash substantially, but cannot guarantee that
  every pair of images looks radically different. Review the resulting recipes
  and images, not only the hashes.
- Different IDs can produce identical or perceptually similar images. A strict
  uniqueness guarantee and its supported population are unresolved requirements.
- Judge aesthetics across a collection of seeds and at the intended display size.
- Bound image dimensions, marks, path steps, and placement attempts as appropriate.
- Measure generation time, export time, and memory on representative samples.
  No numerical performance budget is agreed yet.
- Avoid generating detail that cannot contribute at the output resolution.
- Start with simple execution; add concurrency or optimisation only when measured
  needs justify it. Release drawing resources when they are no longer needed.
- Keep benchmark/sample generation separate from the unrelated import job.
- Do not implement caching. Leave retention and storage policies to consumers.
- Track algorithm/settings versions when defining reproducibility. Do not promise
  identical pixels across different rendering engines or untested upgrades.

## Modular prompts for implementation

Prepare one prompt per user-requested phase. Each should state:

1. The concrete objective and concepts being learned.
2. The agreed inputs, outputs, tools, and existing decisions.
3. The modules involved and changes within scope.
4. What remains deferred to later phases.
5. How to inspect the images and verify correctness/resource use.

Explain the outcome briefly, record user-approved decisions, and wait for the next
requested phase. Do not turn this roadmap into a single full-product prompt.

## References

Art and theory:

- [Tyler Hobbs — Flow Fields](https://www.tylerxhobbs.com/words/flow-fields)
- [Tyler Hobbs — Fidenza](https://www.tylerxhobbs.com/works/fidenza)
- [Creating Soft Textures Generatively](https://www.tylerxhobbs.com/words/creating-soft-textures-generatively)
- [Utilizing Random Number Generator Seeds](https://www.tylerxhobbs.com/words/utilizing-random-number-generator-seeds)
- [Working with Color in Generative Art](https://www.tylerxhobbs.com/words/working-with-color-in-generative-art)
- [The Nature of Code — Randomness](https://natureofcode.com/random/)
- [The Book of Shaders — Noise](https://thebookofshaders.com/11/)
- [The Book of Shaders — Fractal Brownian Motion](https://thebookofshaders.com/13/)

Tools discussed:

- [Node.js](https://nodejs.org/en/about)
- [Node crypto](https://nodejs.org/api/crypto.html)
- [seedrandom](https://github.com/davidbau/seedrandom)
- [noisejs](https://github.com/josephg/noisejs)
- [Canvas implementation](https://github.com/Brooooooklyn/canvas)
- [Skia](https://skia.org/docs/)
- [sharp](https://github.com/lovell/sharp)
- [Quil](https://github.com/quil/quil)
- [Processing](https://processing.org/)

## Current status

Milestones 1 and 1b are implemented: exact string → SHA-256 → seeded recipe →
equally likely linear or evenly mixed gradient → PNG. README.md explains each
module, execution commands, and the provisional artistic parameters. Thirteen tests
pass and both rendered modes have been visually inspected. Later work remains
subject to explicit user requests. This document records the current scope and
does not authorise implementing remaining milestones automatically.
