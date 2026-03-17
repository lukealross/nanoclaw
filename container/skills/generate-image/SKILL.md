---
name: generate-image
description: Generate images from text or edit existing images. Use when user asks to create, generate, draw, design, or modify an image.
allowed-tools: Bash(generate-image:*)
---

# Image Generation

## Quick start

```bash
generate-image generate "A sunset over Table Mountain"
generate-image generate "A minimalist logo for a coffee shop" --aspect 1:1
generate-image edit attachments/img-1234.jpg "Make the background blue"
```

## Usage

```
generate-image generate "<prompt>" [--aspect 16:9|1:1|9:16|4:3|3:4]
generate-image edit <image-path> "<instruction>"
```

- **generate** — create an image from a text description (FLUX.2 Pro)
- **edit** — modify an existing image based on an instruction (FLUX.1 Kontext Pro)
- `--aspect` — aspect ratio for generation (default: 16:9)
- `<image-path>` — path to the image to edit (relative to /workspace/group/)

## Output

Saves the result to `attachments/gen-{timestamp}-{random}.jpg` and prints a reference:

```
[Image: attachments/gen-1710000000000-abc123.jpg]
```

Include this reference in your response. The host will detect it and send the image to the user.

## Tips

- For generate, be descriptive in the prompt — style, lighting, mood, composition
- For edit, the instruction should describe what to change about the existing image
- Generation takes 10-30 seconds; editing may take slightly longer

## Rules

- Always include the `[Image: ...]` reference in your response so the image gets sent
- If generation fails, tell the user and suggest they try a different prompt
- Don't mention the API provider (BFL/FLUX) unless asked
