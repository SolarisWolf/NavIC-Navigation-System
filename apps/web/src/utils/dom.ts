/**
 * DOM Utility Functions
 *
 * Lightweight helpers for creating and managing DOM elements
 * without a framework.
 */

/**
 * Create an HTML element with attributes and children.
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>,
  ...children: (string | Node)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);

  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'className') {
        el.className = value;
      } else if (key === 'innerHTML') {
        el.innerHTML = value;
      } else if (key === 'textContent') {
        el.textContent = value;
      } else {
        el.setAttribute(key, value);
      }
    }
  }

  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else {
      el.appendChild(child);
    }
  }

  return el;
}

/**
 * Shorthand for querySelector.
 */
export function qs<T extends Element = HTMLElement>(
  selector: string,
  parent: ParentNode = document,
): T | null {
  return parent.querySelector<T>(selector);
}

/**
 * Shorthand for querySelectorAll as array.
 */
export function qsa<T extends Element = HTMLElement>(
  selector: string,
  parent: ParentNode = document,
): T[] {
  return Array.from(parent.querySelectorAll<T>(selector));
}

/**
 * Set HTML content of an element safely.
 */
export function setHTML(el: Element, html: string): void {
  el.innerHTML = html;
}

/**
 * Clear all children of an element.
 */
export function clearChildren(el: Element): void {
  el.innerHTML = '';
}

/**
 * Create a metric row (label + value pair).
 */
export function createMetricRow(
  label: string,
  value: string,
  valueClass: string = '',
): HTMLElement {
  const row = createElement('div', { className: 'metric-row' });
  row.appendChild(createElement('span', { className: 'metric-row__label' }, label));

  const valueEl = createElement('span', {
    className: `metric-row__value ${value === '--' ? 'metric-row__value--empty' : valueClass}`.trim(),
  }, value);
  row.appendChild(valueEl);

  return row;
}

/**
 * Format the current time as HH:MM:SS.
 */
export function formatTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
