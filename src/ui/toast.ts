// Minimal toast notifications — mounted in body, auto-dismiss after duration.
// `showActionToast` adds a single inline action button (undo flows, retries).
// It returns a promise that resolves to `true` when the user clicked anywhere
// on the toast (BUG-001 v2 — clicking the action button is no longer required),
// or `false` when the timeout elapsed. Pass `durationMs: null` to keep the
// toast on screen until the user interacts (used for the persistent style
// retry failure — BUG-006 v2).

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
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 400);
  }, durationMs);
}

interface ActionToastOpts {
  // Total time before auto-dismiss. Null = persistent (no auto-dismiss).
  durationMs?: number | null;
  // When true, clicking anywhere on the toast (not just the action button)
  // resolves the promise as if the user clicked the action. Default true.
  clickAnywhere?: boolean;
}

// Resolves to true if the user invoked the action (button or — when
// `clickAnywhere` — anywhere on the toast), false on timeout. Always cleans
// up the DOM. Pause + focus support for keyboard a11y (BUG-001 v2).
export function showActionToast(
  message: string,
  actionLabel: string,
  optsOrDuration: number | null | ActionToastOpts = 6000
): Promise<boolean> {
  const opts: ActionToastOpts =
    typeof optsOrDuration === 'object' && optsOrDuration !== null
      ? optsOrDuration
      : { durationMs: optsOrDuration };
  const durationMs = opts.durationMs ?? null;
  const clickAnywhere = opts.clickAnywhere ?? true;

  return new Promise((resolve) => {
    const c = ensureContainer();
    const toast = document.createElement('div');
    toast.className = 'toast toast--action';
    if (clickAnywhere) toast.classList.add('toast--clickable');

    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action-btn';
    btn.textContent = actionLabel;

    toast.append(text, btn);

    // Progress bar — only for finite durations.
    let progress: HTMLDivElement | null = null;
    if (durationMs !== null) {
      progress = document.createElement('div');
      progress.className = 'toast-progress';
      progress.style.animationDuration = `${durationMs}ms`;
      toast.append(progress);
    }

    c.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast--visible'));

    let settled = false;
    let timeoutId: number | undefined;

    const settle = (invoked: boolean): void => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      toast.classList.remove('toast--visible');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      setTimeout(() => toast.remove(), 400);
      resolve(invoked);
    };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      settle(true);
    });

    if (clickAnywhere) {
      toast.addEventListener('click', () => settle(true));
    }

    if (durationMs !== null) {
      // Pause-on-focus accessibility (BUG-001 v2 — give keyboard users time
      // to react). When focus enters the toast (button), we freeze the CSS
      // animation and reset the timer until focusout.
      let remaining = durationMs;
      let startedAt = Date.now();
      const start = (): void => {
        startedAt = Date.now();
        timeoutId = window.setTimeout(() => settle(false), remaining);
      };
      const pause = (): void => {
        if (timeoutId === undefined) return;
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
        remaining = Math.max(0, remaining - (Date.now() - startedAt));
        if (progress) progress.style.animationPlayState = 'paused';
      };
      const resume = (): void => {
        if (progress) progress.style.animationPlayState = 'running';
        if (timeoutId === undefined) start();
      };
      toast.addEventListener('focusin', pause);
      toast.addEventListener('focusout', resume);
      start();
    }
  });
}
