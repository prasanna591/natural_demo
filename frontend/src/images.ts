import type { Section } from "./theme";
import type { Salon, Service } from "./api";
import { buildImageUrl } from "./api";

const photo = (id: string, width = 1000) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;

const IMG = {
  salonLight: "photo-1560066984-138dadb4c035",
  salonWarm: "photo-1600948836101-f9ffda59d250",
  salonDetail: "photo-1633681926022-84c23e8cb2d6",
  salonWomen: "photo-1560066984-138dadb4c035",
  salonMen: "photo-1605497788044-5a32c7078486",
  womenHero: "photo-1522337360788-8b13dee7a37e",
  womenHair: "photo-1521590832167-7bcbfaa6381f",
  womenHairAlt: "photo-1562322140-8baeececf3df",
  skincare: "photo-1570172619644-dfd03ed5d881",
  skincareAlt: "photo-1595476108010-b4d1f102b1b1",
  makeup: "photo-1487412947147-5cebf100ffc2",
  bridal: "photo-1519699047748-de8e457a634e",
  spa: "photo-1540555700478-4be289fbecef",
  spaDetail: "photo-1515377905703-c4788e51af15",
  menHero: "photo-1503951914875-452162b0f3f1",
  barberShop: "photo-1585747860715-2ba37e788b70",
  menCut: "photo-1621605815971-fbc98d665033",
  menBeard: "photo-1599351431202-1e0f0137899a",
  barberChair: "photo-1622286342621-4bd786c2447c",
  menPortrait: "photo-1517832606299-7ae9b720a186",
  menDetail: "photo-1559599101-f09722fb4948",
  hairColour: "photo-1522338242992-e1a54906a8da",
  hairStyling: "photo-1522337360788-8b13dee7a37e",
  facialTreatment: "photo-1570172619644-dfd03ed5d881",
  bridalMakeup: "photo-1519699047748-de8e457a634e",
  spaMassage: "photo-1540555700478-4be289fbecef",
  menGrooming: "photo-1559272747-523c0ccde6ee",
};

export const heroImage: Record<Section, string> = {
  women: photo(IMG.womenHero, 1500),
  men: photo(IMG.menHero, 1500),
};

export const heroPortrait: Record<Section, string> = {
  women: photo(IMG.womenHairAlt, 700),
  men: photo(IMG.menPortrait, 700),
};

export const editorialImage: Record<Section, string> = {
  women: photo(IMG.spa, 1200),
  men: photo(IMG.barberShop, 1200),
};

export const promiseImage: Record<Section, string> = {
  women: photo(IMG.spaDetail, 1200),
  men: photo(IMG.menDetail, 1200),
};

export const bannerImage: Record<Section, string> = {
  women: photo(IMG.salonWomen, 1500),
  men: photo(IMG.salonMen, 1500),
};

export const haircutImage: Record<Section, string> = {
  women: photo(IMG.womenHair, 1500),
  men: photo(IMG.menCut, 1500),
};

export const hairColourImage: Record<Section, string> = {
  women: photo(IMG.hairColour, 1500),
  men: photo(IMG.hairColour, 1500),
};

export const skincareImage: Record<Section, string> = {
  women: photo(IMG.skincare, 1500),
  men: photo(IMG.skincareAlt, 1500),
};

export const bridalImage: Record<Section, string> = {
  women: photo(IMG.bridalMakeup, 1500),
  men: photo(IMG.makeup, 1500),
};

export const spaImage: Record<Section, string> = {
  women: photo(IMG.spaMassage, 1500),
  men: photo(IMG.spa, 1500),
};

export const mensGroomingImage: Record<Section, string> = {
  women: photo(IMG.barberShop, 1500),
  men: photo(IMG.menGrooming, 1500),
};

export const authImage: Record<Section, string> = {
  women: photo(IMG.salonWarm, 1200),
  men: photo(IMG.menHero, 1200),
};

export const offerImage: Record<Section, string> = {
  women: photo(IMG.makeup, 1000),
  men: photo(IMG.barberChair, 1000),
};

export const categoryImage: Record<string, Record<Section, string>> = {
  Hair: { women: photo(IMG.womenHair), men: photo(IMG.menCut) },
  Skin: { women: photo(IMG.skincare), men: photo(IMG.skincareAlt) },
  Body: { women: photo(IMG.spa), men: photo(IMG.spa) },
  Bridal: { women: photo(IMG.bridal), men: photo(IMG.makeup) },
  "Men's grooming": { women: photo(IMG.barberShop), men: photo(IMG.menBeard) },
};

const salonImages = [photo(IMG.salonWarm, 1200), photo(IMG.salonLight, 1200), photo(IMG.salonDetail, 1200)];

export function serviceImage(service: Service, section: Section) {
  if (service.image_url) return buildImageUrl(service.image_url);
  const name = `${service.name} ${service.category}`.toLowerCase();
  if (name.includes("bridal") || name.includes("wedding")) return photo(IMG.bridal, 900);
  if (name.includes("groom") || name.includes("beard") || name.includes("shav") || name.includes("men")) {
    return photo(section === "men" ? IMG.menBeard : IMG.barberShop, 900);
  }
  if (name.includes("facial") || name.includes("skin") || name.includes("radiance")) return photo(IMG.skincare, 900);
  if (name.includes("massage") || name.includes("body")) return photo(IMG.spa, 900);
  if (name.includes("colour") || name.includes("color")) return photo(IMG.hairColour, 900);
  if (section === "men") return photo(IMG.menCut, 900);
  return photo(name.includes("spa") ? IMG.womenHairAlt : IMG.womenHair, 900);
}

export function categoryImageFor(name: string, section: Section) {
  return categoryImage[name]?.[section] ?? (section === "men" ? photo(IMG.menDetail, 900) : photo(IMG.womenHairAlt, 900));
}

export function salonImageFor(index: number, salon?: Salon) {
  if (salon?.image_url) return buildImageUrl(salon.image_url);
  return salonImages[index % salonImages.length];
}
