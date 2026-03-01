const HUE_RANGE = 360;
const LIGHT_SURFACE_RGB: [number, number, number] = [255, 255, 255];
const DARK_SURFACE_RGB: [number, number, number] = [17, 24, 39];
const WCAG_SMALL_TEXT_CONTRAST = 7;
const UNCATEGORIZED_LABEL = "uncategorized";

type ColorProfile = {
  chroma: number;
  lightness: number;
  borderLightness: number;
  backgroundAlpha: number;
  borderAlpha: number;
};

export type DeterministicColorVariation = "vibrant" | "muted" | "mattePastel";

const COLOR_PROFILES: Record<DeterministicColorVariation, ColorProfile> = {
  vibrant: {
    chroma: 0.22,
    lightness: 60,
    borderLightness: 48,
    backgroundAlpha: 1,
    borderAlpha: 1,
  },
  muted: {
    chroma: 0.14,
    lightness: 64,
    borderLightness: 54,
    backgroundAlpha: 1,
    borderAlpha: 1,
  },
  mattePastel: {
    chroma: 0.08,
    lightness: 82,
    borderLightness: 70,
    backgroundAlpha: 1,
    borderAlpha: 1,
  },
};

function normalizeText(text: string) {
  const trimmed = text.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : UNCATEGORIZED_LABEL;
}

function hashText(text: string) {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function getRelativeLuminanceChannel(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance([red, green, blue]: [number, number, number]) {
  const r = getRelativeLuminanceChannel(red);
  const g = getRelativeLuminanceChannel(green);
  const b = getRelativeLuminanceChannel(blue);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(
  first: [number, number, number],
  second: [number, number, number],
) {
  const firstLuminance = getRelativeLuminance(first);
  const secondLuminance = getRelativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function oklchToRgb(hue: number, chroma: number, lightness: number) {
  const labLightness = lightness / 100;
  const hueRadians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(hueRadians);
  const b = chroma * Math.sin(hueRadians);

  const lPrime = labLightness + 0.396_337_777_4 * a + 0.215_803_757_3 * b;
  const mPrime = labLightness - 0.105_561_345_8 * a - 0.063_854_172_8 * b;
  const sPrime = labLightness - 0.089_484_177_5 * a - 1.291_485_548 * b;

  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;

  const linearRed =
    4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s;
  const linearGreen =
    -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s;
  const linearBlue =
    -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s;

  const toSrgbChannel = (linearChannel: number) => {
    const clampedLinear = Math.min(1, Math.max(0, linearChannel));
    const srgb =
      clampedLinear <= 0.003_130_8
        ? 12.92 * clampedLinear
        : 1.055 * clampedLinear ** (1 / 2.4) - 0.055;

    return Math.round(Math.min(1, Math.max(0, srgb)) * 255);
  };

  return [
    toSrgbChannel(linearRed),
    toSrgbChannel(linearGreen),
    toSrgbChannel(linearBlue),
  ] as [number, number, number];
}

function formatCssNumber(value: number) {
  const fixed = value.toFixed(4);
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export type DeterministicColor = {
  hue: number;
  saturation: number;
  lightness: number;
  backgroundColor: string;
  borderColor: string;
  lightTextColor: string;
  darkTextColor: string;
  lightContrastRatio: number;
  darkContrastRatio: number;
};

function compositeRgb(
  foreground: [number, number, number],
  background: [number, number, number],
  alpha: number,
) {
  const red = Math.round(foreground[0] * alpha + background[0] * (1 - alpha));
  const green = Math.round(foreground[1] * alpha + background[1] * (1 - alpha));
  const blue = Math.round(foreground[2] * alpha + background[2] * (1 - alpha));
  return [red, green, blue] as [number, number, number];
}

function toHexChannel(value: number) {
  return value.toString(16).padStart(2, "0");
}

function pickAaTextColor(
  background: [number, number, number],
  preferredTone: "light" | "dark",
  minimumContrast: number,
) {
  const preferredGray = preferredTone === "light" ? 255 : 0;
  let bestGray = preferredGray;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestContrast = getContrastRatio(background, [
    bestGray,
    bestGray,
    bestGray,
  ]);
  let fallbackGray = bestGray;
  let fallbackContrast = bestContrast;

  for (let gray = 0; gray <= 255; gray += 1) {
    const grayRgb: [number, number, number] = [gray, gray, gray];
    const contrast = getContrastRatio(background, grayRgb);

    if (contrast > fallbackContrast) {
      fallbackContrast = contrast;
      fallbackGray = gray;
    }

    if (contrast >= minimumContrast) {
      const distance = Math.abs(gray - preferredGray);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestGray = gray;
        bestContrast = contrast;
      }
    }
  }

  if (bestDistance === Number.POSITIVE_INFINITY) {
    bestGray = fallbackGray;
    bestContrast = fallbackContrast;
  }

  return {
    textColor: `#${toHexChannel(bestGray)}${toHexChannel(bestGray)}${toHexChannel(bestGray)}`,
    contrastRatio: bestContrast,
  };
}

export function getDeterministicColorFromText(
  text: string,
  variation: DeterministicColorVariation = "muted",
): DeterministicColor {
  const profile = COLOR_PROFILES[variation];
  const normalized = normalizeText(text);
  const hue = hashText(normalized) % HUE_RANGE;
  const saturation = Number((profile.chroma * 100).toFixed(4));
  const lightness = profile.lightness;
  const backgroundRgb = oklchToRgb(hue, profile.chroma, lightness);
  const lightThemeBackground = compositeRgb(
    backgroundRgb,
    LIGHT_SURFACE_RGB,
    profile.backgroundAlpha,
  );
  const darkThemeBackground = compositeRgb(
    backgroundRgb,
    DARK_SURFACE_RGB,
    profile.backgroundAlpha,
  );
  const darkThemeText = pickAaTextColor(
    darkThemeBackground,
    "light",
    WCAG_SMALL_TEXT_CONTRAST,
  );
  const tunedLightThemeText = pickAaTextColor(
    lightThemeBackground,
    "dark",
    WCAG_SMALL_TEXT_CONTRAST,
  );

  return {
    hue,
    saturation,
    lightness,
    backgroundColor: `oklch(${formatCssNumber(lightness)}% ${formatCssNumber(profile.chroma)} ${formatCssNumber(hue)} / ${formatCssNumber(profile.backgroundAlpha)})`,
    borderColor: `oklch(${formatCssNumber(profile.borderLightness)}% ${formatCssNumber(profile.chroma)} ${formatCssNumber(hue)} / ${formatCssNumber(profile.borderAlpha)})`,
    lightTextColor: tunedLightThemeText.textColor,
    darkTextColor: darkThemeText.textColor,
    lightContrastRatio: tunedLightThemeText.contrastRatio,
    darkContrastRatio: darkThemeText.contrastRatio,
  };
}
