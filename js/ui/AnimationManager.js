// Animation helpers honoring the animations/reduced-motion setting.
export function animationsEnabled() {
  try {
    return document.body.dataset.animations !== 'off';
  } catch {
    return true;
  }
}

export function reducedMotion() {
  return document.body.dataset.reducedMotion === 'on' ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

export function pulse(node) {
  if (!node || !animationsEnabled() || reducedMotion()) return;
  node.classList.remove('pulse-once');
  void node.offsetWidth; // restart the keyframe
  node.classList.add('pulse-once');
}

export function flashResult(node, kind) {
  if (!node) return;
  node.classList.remove('flash-win', 'flash-loss', 'flash-push');
  void node.offsetWidth;
  if (!animationsEnabled() || reducedMotion()) return;
  if (kind === 'win') node.classList.add('flash-win');
  else if (kind === 'loss') node.classList.add('flash-loss');
  else node.classList.add('flash-push');
}

export const AnimationManager = { animationsEnabled, reducedMotion, pulse, flashResult };
