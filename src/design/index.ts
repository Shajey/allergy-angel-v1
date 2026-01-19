/**
 * Design Tokens Helper
 * Provides utilities to read and access design tokens from system.json
 */

import systemJson from './system.json';

export type DesignSystem = typeof systemJson.designSystem;

/**
 * Get the design system configuration
 */
export function getDesignSystem(): DesignSystem {
  return systemJson.designSystem;
}

/**
 * Get a color value from the color palette
 */
export function getColor(
  category: keyof DesignSystem['colorPalette'],
  shade?: string
): string | Record<string, string | number> | undefined {
  const colors = systemJson.designSystem.colorPalette[category];
  if (!colors) return undefined;
  
  if (shade === undefined) {
    return colors as Record<string, string | number>;
  }
  
  if (typeof colors === 'object' && !Array.isArray(colors)) {
    return (colors as Record<string, string | number>)[shade] as string | undefined;
  }
  
  return undefined;
}

/**
 * Get a spacing value from the scale
 */
export function getSpacing(size: keyof DesignSystem['spacing']['scale']): string {
  return systemJson.designSystem.spacing.scale[size] || '0';
}

/**
 * Get a component spacing value
 */
export function getComponentSpacing(key: keyof DesignSystem['spacing']['componentSpacing']): string {
  return systemJson.designSystem.spacing.componentSpacing[key] || '0';
}

/**
 * Get a radius value
 */
export function getRadius(size: keyof DesignSystem['borderRadius']): string {
  return systemJson.designSystem.borderRadius[size] || '0';
}

/**
 * Get a shadow value
 */
export function getShadow(size: keyof DesignSystem['shadows']): string {
  return systemJson.designSystem.shadows[size] || 'none';
}

/**
 * Get typography style
 */
export function getTypographyStyle(style: keyof DesignSystem['typography']['styles']) {
  return systemJson.designSystem.typography.styles[style];
}

export { systemJson };
export const designSystem = systemJson.designSystem;
