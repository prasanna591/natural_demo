import { Image } from "react-native";

const salonLight = Image.resolveAssetSource(require("../assets/demo/salon-light.png")).uri;
const salonWarm = Image.resolveAssetSource(require("../assets/demo/salon-warm.png")).uri;
const salonDetail = Image.resolveAssetSource(require("../assets/demo/salon-detail.png")).uri;
const womenHero = Image.resolveAssetSource(require("../assets/demo/women-hero.png")).uri;
const womenHair = Image.resolveAssetSource(require("../assets/demo/women-hair.png")).uri;
const womenHairAlt = Image.resolveAssetSource(require("../assets/demo/women-hair-alt.png")).uri;
const skincare = Image.resolveAssetSource(require("../assets/demo/skincare.png")).uri;
const skincareAlt = Image.resolveAssetSource(require("../assets/demo/skincare-alt.png")).uri;
const makeup = Image.resolveAssetSource(require("../assets/demo/makeup.png")).uri;
const bridal = Image.resolveAssetSource(require("../assets/demo/bridal.png")).uri;
const spa = Image.resolveAssetSource(require("../assets/demo/spa.png")).uri;
const spaDetail = Image.resolveAssetSource(require("../assets/demo/spa-detail.png")).uri;
const menHero = Image.resolveAssetSource(require("../assets/demo/men-hero.png")).uri;
const barberShop = Image.resolveAssetSource(require("../assets/demo/barber-shop.png")).uri;
const menCut = Image.resolveAssetSource(require("../assets/demo/men-cut.png")).uri;
const menBeard = Image.resolveAssetSource(require("../assets/demo/men-beard.png")).uri;
const menPortrait = Image.resolveAssetSource(require("../assets/demo/men-portrait.png")).uri;
const barberChair = Image.resolveAssetSource(require("../assets/demo/barber-chair.png")).uri;
const menDetail = Image.resolveAssetSource(require("../assets/demo/men-detail.png")).uri;
const hairColour = Image.resolveAssetSource(require("../assets/demo/hair-colour.png")).uri;
const placeholder = Image.resolveAssetSource(require("../assets/demo/placeholder.png")).uri;

export const DEMO_IMAGES = {
  salonLight,
  salonWarm,
  salonDetail,
  womenHero,
  womenHair,
  womenHairAlt,
  skincare,
  skincareAlt,
  makeup,
  bridal,
  spa,
  spaDetail,
  menHero,
  barberShop,
  menCut,
  menBeard,
  menPortrait,
  barberChair,
  menDetail,
  hairColour,
  placeholder,
} as const;

/**
 * Map of remote Unsplash URLs (as produced by images.ts / TryOn.tsx) to the
 * bundled local demo asset URI so the app works fully offline.
 */
export const REMOTE_TO_LOCAL: Record<string, string> = {
  "https://images.unsplash.com/photo-1560066984-138dadb4c035": salonLight,
  "https://images.unsplash.com/photo-1600948836101-f9ffda59d250": salonWarm,
  "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6": salonDetail,
  "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e": womenHero,
  "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f": womenHair,
  "https://images.unsplash.com/photo-1562322140-8baeececf3df": womenHairAlt,
  "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881": skincare,
  "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1": skincareAlt,
  "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2": makeup,
  "https://images.unsplash.com/photo-1519699047748-de8e457a634e": bridal,
  "https://images.unsplash.com/photo-1540555700478-4be289fbecef": spa,
  "https://images.unsplash.com/photo-1515377905703-c4788e51af15": spaDetail,
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1": menHero,
  "https://images.unsplash.com/photo-1585747860715-2ba37e788b70": barberShop,
  "https://images.unsplash.com/photo-1621605815971-fbc98d665033": menCut,
  "https://images.unsplash.com/photo-1599351431202-1e0f0137899a": menBeard,
  "https://images.unsplash.com/photo-1517832606299-7ae9b720a186": menPortrait,
  "https://images.unsplash.com/photo-1622286342621-4bd786c2447c": barberChair,
  "https://images.unsplash.com/photo-1559599101-f09722fb4948": menDetail,
  "https://images.unsplash.com/photo-1522338242992-e1a54906a8da": hairColour,
} as const;

/** Resolve any image URL to a bundled local URI when demo mode is on. */
export function buildImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (REMOTE_TO_LOCAL[url]) return REMOTE_TO_LOCAL[url];
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return placeholder;
  }
  return url;
}
