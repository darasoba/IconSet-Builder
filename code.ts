type VariantConfig = {
  sizePx: number;
  strokeWeight: number;
};

type GenerateMessage = {
  type: "generate";
  variants: VariantConfig[];
  customStroke: boolean;
};

type CancelMessage = {
  type: "cancel";
};

type UiMessage = GenerateMessage | CancelMessage;

type SupportedSelection = FrameNode | ComponentNode | InstanceNode | GroupNode;
type RescalableNode = SceneNode & { rescale: (scaleFactor: number) => void };

const UI_WIDTH = 340;
const UI_HEIGHT = 460;

const DRAWABLE_TYPES = new Set<NodeType>([
  "VECTOR",
  "LINE",
  "BOOLEAN_OPERATION",
  "STAR",
  "ELLIPSE",
  "POLYGON",
  "RECTANGLE",
]);

figma.showUI(__html__, { width: UI_WIDTH, height: UI_HEIGHT });

figma.ui.onmessage = async (msg: UiMessage) => {
  if (msg.type === "generate") {
    await handleGenerate(msg);
  }
};

async function handleGenerate(msg: GenerateMessage): Promise<void> {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    return notifyError("Select at least one square icon frame to generate variants.");
  }

  if (selection.length > 100) {
    return notifyError("Select a maximum of 100 icons.");
  }

  const variants = sanitizeVariants(msg.variants, msg.customStroke);
  if (variants.length === 0) {
    return notifyError("Add at least one valid variant size.");
  }

  // Filter and validate all selected icons
  const validIcons: SupportedSelection[] = [];
  for (const node of selection) {
    if (!isSupportedSelection(node)) {
      continue;
    }
    if (!isSquare(node)) {
      continue;
    }
    if (!hasDrawableDescendant(node)) {
      continue;
    }
    validIcons.push(node);
  }

  if (validIcons.length === 0) {
    return notifyError("No valid icons found. Select square frames, components, instances, or groups with vector layers.");
  }

  const componentSets: ComponentSetNode[] = [];
  let currentY = 0;
  let maxWidth = 0;

  // Process each valid icon
  for (const selected of validIcons) {
    const baseSize = selected.width;
    const baseName = selected.name.replace(/\s*\/\s*/g, "-");

    // Create individual components for each variant
    const components: ComponentNode[] = [];

    for (const variant of variants) {
      const component = createVariantComponent(
        selected,
        variant,
        baseSize,
        baseName,
        msg.customStroke
      );
      components.push(component);
    }

    // Combine components into a component set
    const componentSet = figma.combineAsVariants(components, figma.currentPage);
    componentSet.name = baseName;

    // Style the component set container with dotted purple border
    componentSet.fills = [];
    componentSet.strokes = [
      {
        type: "SOLID",
        color: { r: 0.6, g: 0.4, b: 0.9 }, // Purple color
      },
    ];
    componentSet.strokeWeight = 1;
    componentSet.dashPattern = [8, 4]; // Dotted/dashed pattern
    componentSet.cornerRadius = 8;
    componentSet.layoutMode = "HORIZONTAL";
    componentSet.itemSpacing = 40;
    componentSet.counterAxisAlignItems = "CENTER";
    componentSet.primaryAxisSizingMode = "AUTO";
    componentSet.counterAxisSizingMode = "AUTO";
    componentSet.paddingLeft = 20;
    componentSet.paddingRight = 20;
    componentSet.paddingTop = 20;
    componentSet.paddingBottom = 20;

    // Position component sets in a grid layout
    if (componentSets.length === 0) {
      // First one: position next to the first selected icon
      componentSet.x = selected.x + selected.width + 48;
      componentSet.y = selected.y;
      currentY = selected.y;
      maxWidth = selected.width + 48;
    } else {
      // Subsequent ones: stack vertically
      const previousSet = componentSets[componentSets.length - 1];
      componentSet.x = previousSet.x;
      componentSet.y = previousSet.y + previousSet.height + 40;
      currentY = componentSet.y;
    }

    componentSets.push(componentSet);
  }

  // Select all created component sets
  figma.currentPage.selection = componentSets;
  figma.viewport.scrollAndZoomIntoView(componentSets);

  const iconCount = validIcons.length;
  const variantCount = variants.length;
  figma.notify(`Created ${iconCount} component set${iconCount > 1 ? "s" : ""} with ${variantCount} size variant${variantCount > 1 ? "s" : ""} each.`);
}

function createVariantComponent(
  source: SupportedSelection,
  variant: VariantConfig,
  baseSize: number,
  baseName: string,
  customStroke: boolean
): ComponentNode {
  // Create the component
  const component = figma.createComponent();
  component.name = `Size=${variant.sizePx}px`;
  component.resizeWithoutConstraints(variant.sizePx, variant.sizePx);
  component.fills = [];
  component.clipsContent = true;

  // Clone the source
  const clone = source.clone();

  // Detach if it's an instance
  let workingNode: SceneNode = clone;
  if (clone.type === "INSTANCE") {
    workingNode = clone.detachInstance();
  }

  // Add to component first
  component.appendChild(workingNode);

  // Scale the content
  const scale = variant.sizePx / baseSize;
  if (scale !== 1 && canRescale(workingNode)) {
    workingNode.rescale(scale);
  }

  // Apply custom stroke if enabled
  if (customStroke) {
    applyStrokeWeight(workingNode, variant.strokeWeight);
  }

  // Center the content in the component
  workingNode.x = Math.round((variant.sizePx - workingNode.width) / 2);
  workingNode.y = Math.round((variant.sizePx - workingNode.height) / 2);

  // Flatten the content to simplify (outlines strokes, renames to "vector")
  flattenContent(component);

  // Step 4: Lock aspect ratio on component and all children
  lockAspectRatio(component);

  return component;
}

function flattenContent(component: ComponentNode): void {
  const children = [...component.children];
  if (children.length === 0) return;

  try {
    // Flatten all children into a single vector
    const flattened = figma.flatten(children, component);
    flattened.name = "vector";
    flattened.constraints = { horizontal: "SCALE", vertical: "SCALE" };
    // Lock aspect ratio on the flattened vector
    if ("constrainProportions" in flattened) {
      flattened.constrainProportions = true;
    }
  } catch {
    // If flattening fails, just rename the children to "vector"
    for (const child of component.children) {
      child.name = "vector";
      if ("constraints" in child) {
        child.constraints = { horizontal: "SCALE", vertical: "SCALE" };
      }
      // Lock aspect ratio
      if ("constrainProportions" in child) {
        child.constrainProportions = true;
      }
    }
  }

  // Lock aspect ratio on the component itself
  component.constrainProportions = true;
}

// Step 4: Lock aspect ratio on all nodes
function lockAspectRatio(component: ComponentNode): void {
  // Lock on the component frame
  component.constrainProportions = true;

  // Lock on all children recursively
  const lockNode = (node: SceneNode) => {
    if ("constrainProportions" in node) {
      node.constrainProportions = true;
    }
    if ("children" in node) {
      for (const child of node.children) {
        lockNode(child);
      }
    }
  };

  for (const child of component.children) {
    lockNode(child);
  }
}

function isSupportedSelection(node: SceneNode): node is SupportedSelection {
  return (
    node.type === "FRAME" ||
    node.type === "COMPONENT" ||
    node.type === "INSTANCE" ||
    node.type === "GROUP"
  );
}

function isSquare(node: SceneNode): boolean {
  return Math.abs(node.width - node.height) < 0.01;
}

function hasDrawableDescendant(node: SceneNode): boolean {
  if (DRAWABLE_TYPES.has(node.type)) {
    return true;
  }
  if (!("findAll" in node)) {
    return false;
  }
  return node.findAll((child) => DRAWABLE_TYPES.has(child.type)).length > 0;
}

function sanitizeVariants(
  raw: VariantConfig[],
  customStroke: boolean
): VariantConfig[] {
  const variants: VariantConfig[] = [];
  for (const item of raw) {
    const sizePx = Math.round(Number(item.sizePx));
    const strokeWeight = Number(item.strokeWeight);

    if (!Number.isFinite(sizePx) || sizePx <= 0) {
      continue;
    }

    if (customStroke && (!Number.isFinite(strokeWeight) || strokeWeight <= 0)) {
      continue;
    }

    variants.push({
      sizePx,
      strokeWeight: Number.isFinite(strokeWeight) ? strokeWeight : 1,
    });
  }

  return variants;
}

function canRescale(node: SceneNode): node is RescalableNode {
  return "rescale" in node;
}

function applyStrokeWeight(root: SceneNode, weight: number): void {
  const nodes = collectNodes(root, isStrokeNode);

  for (const node of nodes) {
    try {
      node.strokeWeight = weight;
    } catch {
      // Ignore nodes that reject stroke updates
    }
  }
}

function isStrokeNode(
  node: SceneNode
): node is SceneNode & { strokeWeight: number } {
  return "strokeWeight" in node;
}

function collectNodes<T extends SceneNode>(
  root: SceneNode,
  predicate: (node: SceneNode) => node is T
): T[];
function collectNodes(
  root: SceneNode,
  predicate: (node: SceneNode) => boolean
): SceneNode[];
function collectNodes(
  root: SceneNode,
  predicate: (node: SceneNode) => boolean
): SceneNode[] {
  const matches: SceneNode[] = [];
  const visit = (node: SceneNode) => {
    if (predicate(node)) {
      matches.push(node);
    }
    if ("children" in node) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };
  visit(root);
  return matches;
}

function notifyError(message: string): void {
  figma.notify(message);
  figma.ui.postMessage({ type: "error", message });
}
