# IconSet Builder

A Figma plugin that generates scalable icon component sets from your existing icon designs. Select one or more icons, define your target sizes and stroke weights, and the plugin produces production-ready Figma component sets with properly outlined strokes, flattened vectors, and locked aspect ratios.

## Features

- **Batch processing** — Select up to 100 icons and generate variants for all of them at once.
- **Multiple size variants** — Define as many size variants as you need (e.g., 16px, 20px, 24px, 32px, 48px). Each becomes a named component inside a component set.
- **Custom stroke weights** — Optionally set a specific stroke weight per size variant so strokes stay visually consistent across sizes instead of scaling proportionally.
- **Stroke outlining** — All strokes are converted to filled paths, ensuring icons render correctly in any context (export, handoff, embedding).
- **Flattened output** — Each variant is flattened into a single vector node for a clean, lightweight component structure.
- **Locked aspect ratios** — Components and their contents have aspect ratios locked and constraints set to scale, so resizing stays proportional.
- **Component sets with variants** — Output uses Figma's native component set / variant system. Each icon becomes a component set with a `Size` variant property (e.g., `Size=16px`, `Size=24px`).

## Supported Input

The plugin accepts the following node types as input:

- **Frames**
- **Components**
- **Instances** (automatically detached during processing)
- **Groups**

Requirements:
- Selected nodes must be **square** (equal width and height).
- Selected nodes must contain at least one **vector layer** (vector, line, boolean operation, star, ellipse, polygon, or rectangle).

## How to Use

1. **Select your icons** on the Figma canvas. Each icon should be inside a square frame, component, or group.
2. **Run the plugin** from the Plugins menu.
3. **Configure your variants** in the plugin UI:
   - Each row defines a size (in pixels) and an optional stroke weight.
   - Use the **+** button to add more variant rows.
   - Use the **-** button to remove a row (minimum one row required).
   - Toggle **Custom stroke** on/off to control whether stroke weights are applied per-variant or left as-is from the original icon.
4. **Click Generate**. The plugin will:
   - Clone each selected icon for every variant size.
   - Scale the clone to the target size.
   - Apply the custom stroke weight (if enabled).
   - Outline all strokes into filled paths.
   - Flatten everything into a single vector.
   - Lock aspect ratios and set scale constraints.
   - Wrap all size variants into a Figma component set.
5. The generated component sets appear to the right of your original icons and are auto-selected so you can inspect them immediately.

## Default Variants

The plugin ships with five preset rows:

| Size   | Stroke Weight |
|--------|---------------|
| 16px   | 1.5           |
| 20px   | 1.5           |
| 24px   | 2             |
| 32px   | 2.5           |
| 48px   | 3             |

You can modify these or add your own before generating.

## Output Structure

For each selected icon, the plugin creates:

```
ComponentSet: "icon-name"
  ├── Component: Size=16px
  │     └── vector (flattened, outlined, aspect-ratio locked)
  ├── Component: Size=20px
  │     └── vector
  ├── Component: Size=24px
  │     └── vector
  └── ...
```

The component set container has a purple dashed border, horizontal auto-layout with 32px spacing, and 20px padding.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (includes npm)
- TypeScript (`npm install -g typescript`)

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Watch mode

```bash
npm run watch
```

### Lint

```bash
npm run lint
npm run lint:fix
```

### Loading in Figma

1. Open Figma and go to **Plugins > Development > Import plugin from manifest...**
2. Select the `manifest.json` file from this project directory.
3. The plugin will appear under **Plugins > Development > IconSet Builder**.
