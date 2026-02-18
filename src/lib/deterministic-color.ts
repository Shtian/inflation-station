const HUE_RANGE = 360;
const LIGHT_SURFACE_RGB: [number, number, number] = [255, 255, 255];
const DARK_SURFACE_RGB: [number, number, number] = [17, 24, 39];
const WCAG_SMALL_TEXT_CONTRAST = 7;
const UNCATEGORIZED_LABEL = "uncategorized";

type ColorProfile = {
  saturation: number;
  lightness: number;
  borderLightness: number;
  backgroundAlpha: number;
  borderAlpha: number;
};

export type DeterministicColorVariation = "vibrant" | "muted" | "mattePastel";

const COLOR_PROFILES: Record<DeterministicColorVariation, ColorProfile> = {
  vibrant: {
    saturation: 72,
    lightness: 46,
    borderLightness: 34,
    backgroundAlpha: 1,
    borderAlpha: 1,
  },
  muted: {
    saturation: 52,
    lightness: 52,
    borderLightness: 40,
    backgroundAlpha: 1,
    borderAlpha: 1,
  },
  mattePastel: {
    saturation: 34,
    lightness: 78,
    borderLightness: 62,
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

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const hueSection = hue / 60;
  const x = chroma * (1 - Math.abs((hueSection % 2) - 1));
  const match = l - chroma / 2;

  let redPrime = 0;
  let greenPrime = 0;
  let bluePrime = 0;

  if (hueSection >= 0 && hueSection < 1) {
    redPrime = chroma;
    greenPrime = x;
  } else if (hueSection >= 1 && hueSection < 2) {
    redPrime = x;
    greenPrime = chroma;
  } else if (hueSection >= 2 && hueSection < 3) {
    greenPrime = chroma;
    bluePrime = x;
  } else if (hueSection >= 3 && hueSection < 4) {
    greenPrime = x;
    bluePrime = chroma;
  } else if (hueSection >= 4 && hueSection < 5) {
    redPrime = x;
    bluePrime = chroma;
  } else {
    redPrime = chroma;
    bluePrime = x;
  }

  const red = Math.round((redPrime + match) * 255);
  const green = Math.round((greenPrime + match) * 255);
  const blue = Math.round((bluePrime + match) * 255);
  return [red, green, blue] as [number, number, number];
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
  const saturation = profile.saturation;
  const lightness = profile.lightness;
  const backgroundRgb = hslToRgb(hue, saturation, lightness);
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
    backgroundColor: `hsl(${hue} ${saturation}% ${lightness}% / ${profile.backgroundAlpha})`,
    borderColor: `hsl(${hue} ${saturation}% ${profile.borderLightness}% / ${profile.borderAlpha})`,
    lightTextColor: tunedLightThemeText.textColor,
    darkTextColor: darkThemeText.textColor,
    lightContrastRatio: tunedLightThemeText.contrastRatio,
    darkContrastRatio: darkThemeText.contrastRatio,
  };
}
