export type Point = { x: number; y: number };
export type Artwork = { left: number; top: number; right: number; bottom: number };
export type CardPlacement = { left: number; top: number; right: number; bottom: number; aspectRatio: number };
export const NAME_CROP_ZOOM = { close: 3, wide: 2 } as const;
export type NamePlacements = Record<keyof typeof NAME_CROP_ZOOM, CardPlacement[]>;
export const NAME_OPENING_VARIANT = 10;
export const NAME_OPENING_ZOOM = [{ close: 1.25, wide: 1 }, { close: 1.7, wide: 1.25 }] as const;

export function nameOpeningLevel(round: number) {
  return round <= 3 ? 0 : round <= 6 ? 1 : null;
}

export function cardPlacement(width: number, height: number, crop: ReturnType<typeof cropFrame>): CardPlacement {
  return {
    left: crop.left / width,
    top: crop.top / height,
    right: 1 - (crop.left + crop.width) / width,
    bottom: 1 - (crop.top + crop.height) / height,
    aspectRatio: width / height,
  };
}

const ODD_ZOOM = [1.2, 1.55, 2.1, 2.8, 4] as const;
const ODD_LEVEL_STARTS = [1, 3, 6, 10, 15];
export const ODD_VARIANT_COUNT = ODD_ZOOM.length;

export function oddVariant(round: number) {
  return Math.max(0, ODD_LEVEL_STARTS.findLastIndex((start) => round >= start));
}

export function oddCropCenter(centers: Point[], details: Point[] | undefined, seed: number, variant: number) {
  const candidates = variant >= ODD_VARIANT_COUNT - 2 && details?.length ? details : centers;
  return candidates[seed % candidates.length];
}

export function oddCrop(width: number, height: number, area: Artwork, center: Point, seed: number, variant: number) {
  const scale = variant === ODD_VARIANT_COUNT - 1 ? 0.75 : 0.9;
  const frame = cropFrame(width, height, area, center, ODD_ZOOM[variant] * scale);
  const cropWidth = Math.max(1, Math.floor(frame.width * scale));
  const cropHeight = Math.max(1, Math.floor(frame.height * scale));
  const left = frame.left + (seed & 0xffff) % (frame.width - cropWidth + 1);
  const top = frame.top + (seed >>> 16) % (frame.height - cropHeight + 1);
  const crop = { left, top, width: cropWidth, height: cropHeight };
  return { crop, placement: cardPlacement(width, height, crop) };
}

export function cropFrame(width: number, height: number, area: Artwork, center: Point, zoom: number) {
  const left = Math.ceil(area.left * width);
  const top = Math.ceil(area.top * height);
  const right = Math.floor(area.right * width);
  const bottom = Math.floor(area.bottom * height);
  const cropWidth = Math.floor((right - left) / zoom);
  const cropHeight = Math.floor((bottom - top) / zoom);
  if (left < 0 || top < 0 || right > width || bottom > height || cropWidth < 1 || cropHeight < 1) {
    throw new Error("일러스트 영역이 원본 이미지 범위를 벗어났어요.");
  }
  if (center.x < area.left || center.x > area.right || center.y < area.top || center.y > area.bottom) {
    throw new Error("확대 중심점은 일러스트 영역 안에 있어야 해요.");
  }
  return {
    left: Math.max(left, Math.min(right - cropWidth, Math.round(center.x * width - cropWidth / 2))),
    top: Math.max(top, Math.min(bottom - cropHeight, Math.round(center.y * height - cropHeight / 2))),
    width: cropWidth,
    height: cropHeight,
  };
}

export function nameCropCenters(width: number, height: number, area: Artwork, focalPoint: Point): Point[] {
  const xOffset = (area.right - area.left) * 0.15;
  const yOffset = (area.bottom - area.top) * 0.15;
  const candidates = [
    [-1, -1], [1, -1], [1, 1], [-1, 1],
  ];
  const frames = new Set<string>();
  return candidates.flatMap(([x, y]) => {
    const center = {
      x: Math.min(area.right, Math.max(area.left, focalPoint.x + x * xOffset)),
      y: Math.min(area.bottom, Math.max(area.top, focalPoint.y + y * yOffset)),
    };
    const { left, top } = cropFrame(width, height, area, center, 3);
    const key = `${left}/${top}`;
    if (frames.has(key)) return [];
    frames.add(key);
    return [center];
  });
}

export type CropSource = {
  id: string;
  width: number;
  height: number;
  area: Artwork;
  focus: Point;
  details?: Point[];
};

export function runtimeCrop(source: CropSource, game: "name" | "odd", round: number, runId: string, slot: number, frame: "close" | "wide") {
  const { width, height, area, focus } = source;
  let seed = game === "odd" ? 0 : slot;
  for (const character of `${runId}/${round}`) seed = Math.imul(seed ^ character.charCodeAt(0), 16_777_619) >>> 0;
  if (game === "odd") {
    // Use the same relative window on all three cards. The subject's face is never an input.
    const zoom = 1.25 + Math.min(round - 1, 17) * 0.085;
    const horizontal = (seed & 0xffff) / 0xffff;
    const vertical = (seed >>> 16) / 0xffff;
    const center = {
      x: area.left + (area.right - area.left) * (0.5 / zoom + horizontal * (1 - 1 / zoom)),
      y: area.top + (area.bottom - area.top) * (0.5 / zoom + vertical * (1 - 1 / zoom)),
    };
    const crop = cropFrame(width, height, area, center, zoom);
    return { crop, placement: cardPlacement(width, height, crop) };
  }
  const edges = [0.19, 0.81].flatMap((x) => [0.22, 0.78].map((y) => ({
    x: area.left + x * (area.right - area.left),
    y: area.top + y * (area.bottom - area.top),
  })));
  const context = seed % 4 === 0 ? edges[(seed >>> 8) % edges.length] : undefined;
  const opening = nameOpeningLevel(round);
  const zoom = opening === null ? NAME_CROP_ZOOM[frame] : NAME_OPENING_ZOOM[opening][frame];
  // Off-center clues cover at least two thirds of the illustration in each direction.
  const crop = cropFrame(width, height, area, context ?? focus, context ? Math.min(zoom, frame === "wide" ? 1.2 : 1.5) : zoom);
  return { crop, placement: cardPlacement(width, height, crop) };
}
