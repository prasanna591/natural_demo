import { Image } from "react-native";

const local = (name: string): string => {
  return Image.resolveAssetSource(require(`../assets/demo/${name}.png`)).uri;
};

export const DEMO_IMAGES = {
  salonLight: local("salon-light"),
  salonWarm: local("salon-warm"),
  salonDetail: local("salon-detail"),
  womenHero: local("women-hero"),
  womenHair: local("women-hair"),
  womenHairAlt: local("women-hair-alt"),
  skincare: local("skincare"),
  skincareAlt: local("skincare-alt"),
  makeup: local("makeup"),
  bridal: local("bridal"),
  spa: local("spa"),
  spaDetail: local("spa-detail"),
  menHero: local("men-hero"),
  barberShop: local("barber-shop"),
  menCut: local("men-cut"),
  menBeard: local("men-beard"),
  menPortrait: local("men-portrait"),
  barberChair: local("barber-chair"),
  menDetail: local("men-detail"),
  hairColour: local("hair-colour"),
  placeholder: local("placeholder"),
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

/** Resolve any image URL to a bundled local URI when demo mode is on. */
export function buildImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (REMOTE_TO_LOCAL[url]) return REMOTE_TO_LOCAL[url];
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return REMOTE_TO_LOCAL.placeholder;
  }
  return url;
}
