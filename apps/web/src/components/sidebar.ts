/**
 * Sidebar Navigation Component
 *
 * Left sidebar with navigation items, active state tracking,
 * and version info footer.
 */

import { DEFAULT_CONFIG } from '@navic/shared-models';
import type { Router, RouteDefinition } from '../router.js';

export class Sidebar {
  private container: HTMLElement;
  private router: Router;

  constructor(container: HTMLElement, router: Router) {
    this.container = container;
    this.router = router;

    // Re-render on navigation to update active state
    this.router.onNavigate(() => this.render());
    this.render();
  }

  private render(): void {
    const routes = this.router.getRoutes();
    const currentPath = this.router.getCurrentPath();

    // Split routes into main nav and system nav
    const mainRoutes = routes.filter(r =>
      ['/dashboard', '/map', '/satellites', '/sensors'].includes(r.path)
    );
    const systemRoutes = routes.filter(r =>
      ['/route', '/settings'].includes(r.path)
    );

    this.container.innerHTML = `
      <div class="sidebar__nav">
        <div class="sidebar__section-title">Navigation</div>
        ${mainRoutes.map(r => this.renderItem(r, currentPath)).join('')}

        <div class="sidebar__divider"></div>
        <div class="sidebar__section-title">Planning</div>
        ${systemRoutes.map(r => this.renderItem(r, currentPath)).join('')}
      </div>

      <div class="sidebar__footer">
        <span class="sidebar__version">${DEFAULT_CONFIG.appName} v${DEFAULT_CONFIG.version}</span>
        <span>Phase 1 — Web Shell</span>
      </div>
    `;

    // Attach click handlers
    const items = this.container.querySelectorAll('.sidebar__item');
    items.forEach((item) => {
      item.addEventListener('click', () => {
        const path = (item as HTMLElement).dataset.path;
        if (path) {
          this.router.navigate(path);
        }
      });
    });
  }

  private renderItem(route: RouteDefinition, currentPath: string): string {
    const isActive = route.path === currentPath;
    return `
      <div class="sidebar__item ${isActive ? 'sidebar__item--active' : ''}"
           data-path="${route.path}"
           role="button"
           tabindex="0">
        <span class="sidebar__icon">${route.icon}</span>
        <span class="sidebar__label">${route.label}</span>
      </div>
    `;
  }
}
