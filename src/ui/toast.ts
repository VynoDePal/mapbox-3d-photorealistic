// Minimal toast notifications — mounted in body, auto-dismiss after duration.

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (container && document.body.contains(container)) return container;
  container = document.createElement('div');
  container.className = 'toast-container';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('role', 'status');
  document.body.appendChild(container);
  return container;
}

export function showToast(message: string, durationMs = 2000): void {
  const c = ensureContainer();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  c.appendChild(toast);
  // Trigger CSS enter animation on next frame.
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    // Hard-fallback in case transitionend never fires.
    setTimeout(() => toast.remove(), 400);
  }, durationMs);
}
