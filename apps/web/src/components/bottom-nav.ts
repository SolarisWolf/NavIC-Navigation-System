/**
 * Mobile Bottom Navigation Bar Component
 *
 * Thumb-friendly bottom navigation bar for mobile devices,
 * featuring core screens (Map, Route, NavIC/SVs, Dashboard, Settings).
 * Automatically updates active state on route changes.
 */

import type { Router } from '../router.js';

export interface MobileNavItem {
  path: string;
  label: string;
  icon: string;
}

export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { path: '/map', label: 'Map', icon: '🗺️' },
  { path: '/route', label: 'Navigate', icon: '🧭' },
  { path: '/satellites', label: 'GNSS', icon: '🛰️' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export class MobileBottomNav {
  private container: HTMLElement;
  private router: Router;

  constructor(container: HTMLElement, router: Router) {
    this.container = container;
    this.router = router;

    this.router.onNavigate(() => this.render());
    this.render();
  }

  private render(): void {
    const currentPath = this.router.getCurrentPath();

    this.container.innerHTML = `
      <div class="mobile-bottom-nav__inner">
        ${MOBILE_NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.path;
          return `
            <button class="mobile-bottom-nav__item ${isActive ? 'mobile-bottom-nav__item--active' : ''}"
                    data-path="${item.path}"
                    role="tab"
                    aria-selected="${isActive}"
                    aria-label="${item.label}">
              <span class="mobile-bottom-nav__icon">${item.icon}</span>
              <span class="mobile-bottom-nav__label">${item.label}</span>
              ${isActive ? '<span class="mobile-bottom-nav__indicator"></span>' : ''}
            </button>
          `;
        }).join('')}
      </div>
    `;

    // Attach click listeners
    const buttons = this.container.querySelectorAll<HTMLButtonElement>('.mobile-bottom-nav__item');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const path = btn.dataset.path;
        if (path) {
          this.router.navigate(path);
        }
      });
    });
  }
}
