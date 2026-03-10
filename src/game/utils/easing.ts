export type EasingFn = (t: number) => number;

export const linear: EasingFn = (t) => t;

export const easeInQuad: EasingFn = (t) => t * t;

export const easeOutQuad: EasingFn = (t) => t * (2 - t);

export const easeInOutQuad: EasingFn = (t) => {
  if (t < 0.5) {
    return 2 * t * t;
  }
  const u = t - 0.5;
  return 1 - 2 * u * (1 - u);
};

export const easeInCubic: EasingFn = (t) => t * t * t;

export const easeOutCubic: EasingFn = (t) => {
  const u = t - 1;
  return u * u * u + 1;
};

export const easeInOutCubic: EasingFn = (t) => {
  if (t < 0.5) {
    return 4 * t * t * t;
  }
  const u = 2 * t - 2;
  return 0.5 * u * u * u + 1;
};
