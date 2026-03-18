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
generate-image generate "A photorealistic product shot of sneakers" --model imagen-ultra
generate-image edit attachments/img-1234.jpg "Make the background blue"
generate-image edit attachments/img-1234.jpg "Make it look more polished" --model nano-banana-pro
```

## Usage

```
generate-image generate "<prompt>" [--aspect 16:9|1:1|9:16|4:3|3:4] [--model nano-banana-2|nano-banana-pro|imagen-ultra]
generate-image edit <image-path> "<instruction>" [--model nano-banana-2|nano-banana-pro]
```

- **generate** — create an image from a text description
- **edit** — modify an existing image based on an instruction
- `--aspect` — aspect ratio for generation (default: 16:9)
- `--model` — model to use (default: nano-banana-pro). See model selection below.
- `<image-path>` — path to the image to edit (relative to /workspace/group/)

## Model selection

Choose the model based on what the user is asking for:

| Model | When to use |
|-------|------------|
| `nano-banana-pro` **(default)** | Most image generation requests. Professional quality, best text rendering, complex compositions, creative work, branding, marketing assets. Use for all editing tasks. |
| `nano-banana-2` | Quick iterations, drafts, "try a few options", bulk generation, simple/casual requests, when the user explicitly asks for speed. |
| `imagen-ultra` | Photorealistic output — product photography, stock photo style, anything that should look like a real photograph. Generation only (cannot edit). |

**Rules:**
- Default to `nano-banana-pro` for most requests — it produces the best overall quality
- Use `nano-banana-2` when speed/iteration matters: user is exploring ideas, wants quick drafts, says "rough", "quick", "draft", or is iterating rapidly
- Use `imagen-ultra` when photorealism is the goal — real-world photography look
- For edit commands, always use `nano-banana-pro` (best editing capability) unless user explicitly requests `nano-banana-2`
- Never use `imagen-ultra` for editing (it can't edit)

## Resolution

**Always use 1K resolution.** Do not pass `--resolution` — the default is 1K and should not be changed.

## Output

Saves the result to `attachments/gen-{timestamp}-{random}.jpg` and prints a reference:

```
[Image: attachments/gen-1710000000000-abc123.jpg]
```

Include this reference in your response. The host will detect it and send the image to the user.

## Tips

- For generate, be descriptive in the prompt — style, lighting, mood, composition
- For edit, the instruction should describe what to change about the existing image
- Generation typically takes a few seconds

<!-- FLUX/BFL provider is available via IMAGE_PROVIDER=bfl env var -->

## Rules

- Always include the `[Image: ...]` reference in your response so the image gets sent
- If generation fails, tell the user and suggest they try a different prompt
- Don't mention the API provider or model internals unless asked
