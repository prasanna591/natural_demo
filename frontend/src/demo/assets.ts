/**
 * Demo image assets.
 *
 * Real remote images are scrapped. Every image is an inline SVG data-URI so the
 * app works fully offline, loads instantly, and never depends on the network or
 * on Metro asset resolution. Colours are drawn from the men's ivory + olive
 * palette so the placeholders look intentional and stay adaptable to any
 * section.
 */

const svgUri = (color: string, width = 900, height = 600): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${color}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const ivory = "#F5F1E9";
const surface = "#FFFFFF";
const primary = "#30372D";
const accent = "#78836A";
const highlight = "#C5A66A";
const ink = "#292C25";
const border = "#E5DED2";

export const DEMO_IMAGES = {
  salonLight: svgUri(ivory, 900, 600),
  salonWarm: svgUri("#E9E2D0", 900, 600),
  salonDetail: svgUri("#D8CCB8", 900, 600),
  womenHero: svgUri(highlight, 1500, 1000),
  womenHair: svgUri("#B8A48A", 1500, 1000),
  womenHairAlt: svgUri("#B8A48A", 700, 700),
  skincare: svgUri("#C9D6C8", 1200, 800),
  skincareAlt: svgUri("#C9D6C8", 1200, 800),
  makeup: svgUri("#C5A66A", 1000, 700),
  bridal: svgUri("#EFE9DA", 700, 700),
  spa: svgUri("#B8C4B8", 1200, 800),
  spaDetail: svgUri("#B8C4B8", 1200, 800),
  menHero: svgUri(primary, 1500, 1000),
  barberShop: svgUri("#4A554A", 1200, 800),
  menCut: svgUri("#4A554A", 700, 700),
  menBeard: svgUri("#3A443A", 700, 700),
  menPortrait: svgUri("#3A443A", 700, 700),
  barberChair: svgUri("#2E372E", 1000, 700),
  menDetail: svgUri("#4A554A", 1200, 800),
  hairColour: svgUri(highlight, 700, 700),
  placeholder: svgUri(border, 400, 400),
} as const;

/**
 * Map of remote Unsplash URLs (as produced by images.ts / TryOn.tsx) to the
 * bundled local demo asset URI so the app works fully offline.
 */
export const REMOTE_TO_LOCAL: Record<string, string> = {
  "https://images.unsplash.com/photo-1560066984-138dadb4c035": DEMO_IMAGES.salonLight,
  "https://images.unsplash.com/photo-1600948836101-f9ffda59d250": DEMO_IMAGES.salonWarm,
  "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6": DEMO_IMAGES.salonDetail,
  "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e": DEMO_IMAGES.womenHero,
  "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f": DEMO_IMAGES.womenHair,
  "https://images.unsplash.com/photo-1562322140-8baeececf3df": DEMO_IMAGES.womenHairAlt,
  "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881": DEMO_IMAGES.skincare,
  "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1": DEMO_IMAGES.skincareAlt,
  "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2": DEMO_IMAGES.makeup,
  "https://images.unsplash.com/photo-1519699047748-de8e457a634e": DEMO_IMAGES.bridal,
  "https://images.unsplash.com/photo-1540555700478-4be289fbecef": DEMO_IMAGES.spa,
  "https://images.unsplash.com/photo-1515377905703-c4788e51af15": DEMO_IMAGES.spaDetail,
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1": DEMO_IMAGES.menHero,
  "https://images.unsplash.com/photo-1585747860715-2ba37e788b70": DEMO_IMAGES.barberShop,
  "https://images.unsplash.com/photo-1621605815971-fbc98d665033": DEMO_IMAGES.menCut,
  "https://images.unsplash.com/photo-1599351431202-1e0f0137899a": DEMO_IMAGES.menBeard,
  "https://images.unsplash.com/photo-1517832606299-7ae9b720a186": DEMO_IMAGES.menPortrait,
  "https://images.unsplash.com/photo-1622286342621-4bd786c2447c": DEMO_IMAGES.barberChair,
  "https://images.unsplash.com/photo-1559599101-f09722fb4948": DEMO_IMAGES.menDetail,
  "https://images.unsplash.com/photo-1522338242992-e1a54906a8da": DEMO_IMAGES.hairColour,
} as const;

/** Resolve any image URL to a local demo URI. Never returns a network URL, so
 * the app never hangs trying to fetch remote images while offline. */
export function buildImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (REMOTE_TO_LOCAL[url]) return REMOTE_TO_LOCAL[url];
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return DEMO_IMAGES.placeholder;
  }
  return url;
}
