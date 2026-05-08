// Tiny DOM helper — replaces a need for a UI framework for our small panels.
// `h(tag, attrs?, children?)` builds a DOM tree similar to JSX createElement.

type AttrValue =
  | string
  | number
  | boolean
  | EventListener
  | Record<string, string>
  | Record<string, EventListener>
  | undefined;

interface Attrs {
  class?: string;
  dataset?: Record<string, string>;
  on?: Record<string, EventListener>;
  [k: string]: AttrValue;
}

type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs,
  children?: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === false) continue;
      if (k === 'class' && typeof v === 'string') el.className = v;
      else if (k === 'dataset' && v && typeof v === 'object') {
        for (const [dk, dv] of Object.entries(v as Record<string, string>)) {
          el.dataset[dk] = dv;
        }
      } else if (k === 'on' && v && typeof v === 'object') {
        for (const [evt, handler] of Object.entries(v as Record<string, EventListener>)) {
          el.addEventListener(evt, handler);
        }
      } else if (typeof v === 'boolean') {
        if (v) el.setAttribute(k, '');
      } else {
        el.setAttribute(k, String(v));
      }
    }
  }
  if (children) {
    for (const c of children) {
      if (c === null || c === undefined || c === false) continue;
      el.append(typeof c === 'string' ? document.createTextNode(c) : c);
    }
  }
  return el;
}

export interface PanelHandle {
  root: HTMLElement;
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  setBody(node: Node): void;
}

export interface PanelOpts {
  title: string;
  side?: 'right' | 'left';
  initialBody?: Node;
}

// Creates a sliding drawer panel anchored to a side. Returns a handle to control it.
export function createPanel(opts: PanelOpts): PanelHandle {
  const side = opts.side ?? 'right';
  const titleEl = h('h2', { class: 'panel-title' }, [opts.title]);
  const closeBtn = h('button', {
    class: 'panel-close',
    type: 'button',
    'aria-label': 'Fermer le panneau',
  }, ['×']);
  const body = h('div', { class: 'panel-body' }, opts.initialBody ? [opts.initialBody] : []);
  const root = h('aside', {
    class: `panel panel-${side}`,
    role: 'dialog',
    'aria-modal': 'false',
    'aria-labelledby': 'panel-title',
    hidden: true,
  }, [
    h('header', { class: 'panel-header' }, [titleEl, closeBtn]),
    body,
  ]);

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && !root.hidden) close();
  };

  function open(): void {
    root.hidden = false;
    document.addEventListener('keydown', onKey);
  }
  function close(): void {
    root.hidden = true;
    document.removeEventListener('keydown', onKey);
  }
  function toggle(): void {
    if (root.hidden) open();
    else close();
  }
  function isOpen(): boolean {
    return !root.hidden;
  }
  function setBody(node: Node): void {
    body.replaceChildren(node);
  }

  closeBtn.addEventListener('click', close);
  document.body.appendChild(root);
  return { root, open, close, toggle, isOpen, setBody };
}
