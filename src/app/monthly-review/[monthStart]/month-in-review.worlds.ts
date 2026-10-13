export type DeckWorld = {
  background: string;
  foreground: string;
  accent: string;
  muted: string;
};

const INK = "#0E0B1F";
const CREAM = "#FFF6E5";

export const DECK_WORLDS = {
  ink: {
    background: INK,
    foreground: CREAM,
    accent: "#D7FF3A",
    muted: "#CFC7BD",
  },
  lime: {
    background: "#C6F432",
    foreground: INK,
    accent: INK,
    muted: "#333A23",
  },
  red: {
    background: "#FF4D3D",
    foreground: INK,
    accent: INK,
    muted: "#3E1825",
  },
  violet: {
    background: "#4C2EE6",
    foreground: CREAM,
    accent: CREAM,
    muted: "#E4D8E5",
  },
  steel: {
    background: "#BFD4FF",
    foreground: INK,
    accent: INK,
    muted: "#31334C",
  },
  coral: {
    background: "#FF7A59",
    foreground: INK,
    accent: INK,
    muted: "#3E212B",
  },
  amber: {
    background: "#FFC93C",
    foreground: INK,
    accent: INK,
    muted: "#3E3125",
  },
} satisfies Record<string, DeckWorld>;
