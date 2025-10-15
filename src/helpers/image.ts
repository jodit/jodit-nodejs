/**
 * Image utility class for generating file/folder icons
 *
 * - Color palette for different file extensions
 * - Color manipulation (luminate/darken)
 * - RGB to hex conversion
 * - SVG icon generation for files and folders
 *
 */

/**
 * RGB color tuple [R, G, B]
 */
export type RGBColor = [number, number, number];

/**
 * Interface for file/folder objects
 */
export interface IFileForIcon {
  isDirectory: () => Promise<boolean>;
  getExtension: () => Promise<string>;
}

/**
 * Interface for source objects that can create files
 */
export interface ISourceForIcon {
  makeFile: (filename: string, content: string) => Promise<unknown>;
}

/**
 * Image utility class
 * (PHP lines 19-158)
 */
export class Image {
  /**
   * Color palette for file type icons
   * Each color is represented as [R, G, B] tuple
   * (PHP lines 20-35)
   */
  static readonly colors: RGBColor[] = [
    [228, 84, 83],
    [237, 234, 67],
    [122, 223, 237],
    [228, 84, 83],
    [245, 170, 43],
    [174, 196, 70],
    [212, 110, 173],
    [241, 197, 222],
    [222, 145, 154],
    [143, 205, 190],
    [148, 16, 76],
    [146, 165, 171],
    [0, 106, 180],
    [0, 106, 180]
  ];

  /**
   * Adjust color brightness (lighten or darken)
   * (PHP lines 42-48)
   *
   * @param color - RGB color tuple
   * @param percent - Brightness percentage (0-100, 50 = no change, <50 = darken, >50 = lighten)
   * @returns New RGB color tuple
   */
  static luminate(color: RGBColor, percent: number): RGBColor {
    const result: RGBColor = [0, 0, 0];

    for (let i = 0; i < color.length; i++) {
      const value = this.luminateValue(color[i] as number, percent);
      result[i] = Math.min(Math.max(0, Math.round(value)), 255);
    }

    return result;
  }

  /**
   * Adjust a single color value brightness
   *
   * @param value - Color value (0-255)
   * @param percent - Brightness percentage (0-100)
   * @returns Adjusted color value
   */
  static luminateValue(value: number, percent: number): number {
    // No change at 50% (line 55-57)
    if (percent === 50) {
      return value;
    }

    // Ratio = value from 0 to 2 (line 60)
    const ratio = (percent * 2) / 100;

    // Darken color (lines 63-65)
    if (percent < 50) {
      return value * ratio;
    }

    // Lighten color (lines 67-74)
    // Reverse ratio
    const reversedRatio = 2 - ratio;
    const diff = (255 - value) * reversedRatio;

    return 255 - diff;
  }

  /**
   * Convert RGB color to hex string
   *
   * @param r - Red component (0-255)
   * @param g - Green component (0-255)
   * @param b - Blue component (0-255)
   * @returns Hex color string (e.g., "#ff0000")
   */
  static fromRGB(r: number, g: number, b: number): string {
    // Convert to hex and pad with 0 if needed (lines 78-81)
    let rHex = Math.round(r).toString(16);
    if (rHex.length < 2) {
      rHex = '0' + rHex;
    }

    // Convert g to hex and pad (lines 83-86)
    let gHex = Math.round(g).toString(16);
    if (gHex.length < 2) {
      gHex = '0' + gHex;
    }

    // Convert b to hex and pad (lines 88-91)
    let bHex = Math.round(b).toString(16);
    if (bHex.length < 2) {
      bHex = '0' + bHex;
    }

    // Return hex color string (line 93)
    return '#' + rHex + gHex + bHex;
  }

  /**
   * Generate SVG icon for a file or folder
   *
   * Creates a colored SVG icon based on file extension:
   * - Folders get a simple colored document icon
   * - Files get a document icon with extension label
   *
   * @param file - File or folder object
   * @param iconName - Name for the generated icon file
   * @param source - Source object that can save the icon
   * @param width - Icon width (default: 100)
   * @param height - Icon height (default: 100)
   */
  static async generateIcon(
    file: IFileForIcon,
    iconName: string,
    source: ISourceForIcon,
    width: number = 100,
    height: number = 100
  ): Promise<void> {
    // Get word for icon (folder or extension) (lines 103-105)
    const word = (await file.isDirectory())
      ? 'folder'
      : (await file.getExtension()).toUpperCase();

    // Select color from palette based on first character (lines 107-108)
    const code = word.charCodeAt(0) % this.colors.length;
    const color = this.colors[code] as RGBColor;

    // Generate color variations (lines 109-118)
    const darkColor = this.luminate(color, 30);
    const shadowColor = this.luminate(color, 45);

    const main = this.fromRGB(color[0], color[1], color[2]);
    const dark = this.fromRGB(darkColor[0], darkColor[1], darkColor[2]);
    const shadow = this.fromRGB(shadowColor[0], shadowColor[1], shadowColor[2]);

    // Calculate label dimensions (lines 120-125)
    const labelX = 13;
    const labelY = 55;
    const labelWidth = word.length < 5 ? 54 : 70;
    const labelHeight = 22;
    const textX = labelX + labelWidth / 2;
    const textY = labelY + labelHeight / 2 + 2;

    // Generate label (only for files, not folders)
    const label = (await file.isDirectory())
      ? ''
      : `
		<g>
			<rect x="${labelX}" y="${labelY}" width="${labelWidth}" height="${labelHeight}" rx="4" fill="${dark}"/>
			<text
          x="${textX}"
          y="${textY}"
          dominant-baseline="middle"
          text-anchor="middle"
          fill="white"
          font-family="Arial"
          font-size="16"
      >
      	${word}
      </text>
		</g>
		<path d="M64.5 56.5L80 72V82.54V82.54C79.7186 86.7384 76.2078 90 72 90V90H52L20.5 77L64.5 56.5Z" fill="${shadow}" fill-opacity="0.5"/>
`;

    const svg = `
	<svg width="${width}" height="${height}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
		<path d="M20 19C20 14.5817 23.5817 11 28 11H56L80 34.5V82C80 86.4183 76.4183 90 72 90H28C23.5817 90 20 86.4183 20 82V19Z" fill="${main}"/>
		${label}
		<path d="M79.5 34L80 36.5V42L64 33.5L60.5 31L79.5 34Z" fill="${shadow}" fill-opacity="0.5"/>
		<path d="M56 11L80 34.5L66.063 34.1832C61.4741 34.079 57.699 30.538 57.3013 25.9652L56 11Z" fill="${dark}"/>
	</svg>
`;

    await source.makeFile(iconName, svg);
  }
}
