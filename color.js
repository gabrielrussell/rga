/**
 * Color utilities for generating harmonious color palettes
 */

/**
 * Convert HSL to RGB
 * H: 0-360, S: 0-100, L: 0-100
 * Returns: { r: 0-255, g: 0-255, b: 0-255 }
 */
export function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) {
        r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
        r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
        r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
        r = x; g = 0; b = c;
    } else if (h >= 300 && h < 360) {
        r = c; g = 0; b = x;
    }

    return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255)
    };
}

/**
 * Convert RGB to hex color string
 */
export function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Convert hex color to HSL
 * Returns: { h: 0-360, s: 0-100, l: 0-100 }
 */
export function hexToHsl(hex) {
    // Remove # if present
    hex = hex.replace(/^#/, '');

    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

/**
 * Generate tetradic color harmony from a base color
 * Returns 4 colors evenly spaced around the color wheel
 */
export function generateTetradicHarmony(baseColorHex) {
    const hsl = hexToHsl(baseColorHex);
    const baseHue = hsl.h;
    const saturation = hsl.s;
    const lightness = hsl.l;

    // Tetradic: 4 colors at 0°, 90°, 180°, 270°
    const hues = [
        baseHue,
        (baseHue + 90) % 360,
        (baseHue + 180) % 360,
        (baseHue + 270) % 360
    ];

    return hues.map(h => {
        const rgb = hslToRgb(h, saturation, lightness);
        return rgbToHex(rgb.r, rgb.g, rgb.b);
    });
}

/**
 * Create a darker and more saturated variant of a color
 */
export function createDarkerSaturatedVariant(colorHex, darkenAmount = 15, saturateAmount = 15) {
    const hsl = hexToHsl(colorHex);

    const newL = Math.max(0, hsl.l - darkenAmount);
    const newS = Math.min(100, hsl.s + saturateAmount);

    const rgb = hslToRgb(hsl.h, newS, newL);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Create a desaturated variant of a color
 */
export function createDesaturatedVariant(colorHex, desaturateAmount = 20, lightnessChange = 0) {
    const hsl = hexToHsl(colorHex);

    const newS = Math.max(0, hsl.s - desaturateAmount);
    const newL = Math.max(0, Math.min(100, hsl.l + lightnessChange));

    const rgb = hslToRgb(hsl.h, newS, newL);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Create a lighter variant of a color
 */
export function createLighterVariant(colorHex, lightenAmount = 15, saturateAmount = 0) {
    const hsl = hexToHsl(colorHex);

    const newL = Math.min(100, hsl.l + lightenAmount);
    const newS = Math.max(0, Math.min(100, hsl.s + saturateAmount));

    const rgb = hslToRgb(hsl.h, newS, newL);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Generate full color palette with base colors and varied saturation/lightness
 * Interleaves variants to maintain hue variety throughout the palette
 * @param {string} baseColorHex - Base color in hex format
 * @returns {string[]} Array of hex colors with saturation variation
 */
export function generateColorPalette(baseColorHex) {
    // Generate base tetradic harmony
    const baseColors = generateTetradicHarmony(baseColorHex);

    // Start with the 4 base tetrad colors
    const palette = [...baseColors];

    // Define variant transformations
    const variantGenerators = [
        (color) => createDarkerSaturatedVariant(color, 20, 20),  // Darker, highly saturated
        (color) => createDarkerSaturatedVariant(color, 25, 10),  // Darker, moderately saturated
        (color) => createDarkerSaturatedVariant(color, 35, 25),  // Very dark, highly saturated
        (color) => createDesaturatedVariant(color, 30, 0),       // Desaturated (muted)
        (color) => createDesaturatedVariant(color, 35, 15),      // Desaturated and lighter (pastel-like)
        (color) => createLighterVariant(color, 15, 10)           // Lighter, saturated
    ];

    // Interleave variants: for each variant type, apply to all 4 base colors
    // This keeps hue variety: [base1-var1, base2-var1, base3-var1, base4-var1, base1-var2, ...]
    for (const generator of variantGenerators) {
        for (const baseColor of baseColors) {
            palette.push(generator(baseColor));
        }
    }

    return palette;
}

/**
 * Color palette manager
 */
export class ColorPalette {
    constructor(baseColor = '#3498db') {
        this.baseColor = baseColor;
        this.palette = generateColorPalette(baseColor);
    }

    /**
     * Update base color and regenerate palette
     */
    setBaseColor(colorHex) {
        this.baseColor = colorHex;
        this.palette = generateColorPalette(colorHex);
    }

    /**
     * Get color for a specific layer depth
     */
    getColorForLayer(depth) {
        if (depth === 0) {
            // Root layer is always the first color
            return this.palette[0];
        }
        // Cycle through palette for other layers
        return this.palette[(depth - 1) % this.palette.length];
    }

    /**
     * Get all colors in the palette
     */
    getAllColors() {
        return [...this.palette];
    }
}
