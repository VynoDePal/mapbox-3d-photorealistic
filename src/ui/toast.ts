// Minimal toast notifications — mounted in body, auto-dismiss after duration.
// `showActionToast` adds a single inline action button (used for undo flows
// — see BUG-003). It returns a promise that resolves to true if the user
// clicked the action, false if the toast timed out without interaction.

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

// Resolves to true if the user clicked the action (e.g. "Undo"), or false
// if the toast timed out. Either way, the toast is removed afterwards.
export function showActionToast(
  message: string,
  actionLabel: string,
  durationMs = 5000
): Promise<boolean> {
  return new Promise((resolve) => {
    const c = ensureContainer();
    const toast = document.createElement('div');
    toast.className = 'toast toast--action';

    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action-btn';
    btn.textContent = actionLabel;

    toast.append(text, btn);
    c.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast--visible'));

    let settled = false;
    const settle = (clicked: boolean): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      toast.classList.remove('toast--visible');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      setTimeout(() => toast.remove(), 400);
      resolve(clicked);
    };

    btn.addEventListener('click', () => settle(true));
    const timeoutId = window.setTimeout(() => settle(false), durationMs);
  });
}
