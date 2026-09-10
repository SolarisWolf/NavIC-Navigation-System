/**
 * Hash-based SPA Router
 *
 * Handles client-side navigation using URL hash fragments.
 * Example: #/dashboard, #/map, #/satellites
 */

export interface RouteDefinition {
  path: string;
  label: string;
  icon: string;
  render: (container: HTMLElement) => void;
}

export class Router {
  private routes: Map<string, RouteDefinition> = new Map();
  private container: HTMLElement;
  private currentPath: string = '';
  private onNavigateCallbacks: Array<(path: string) => void> = [];

  constructor(container: HTMLElement) {
    this.container = container;

    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  /**
   * Register a route.
   */
  addRoute(route: RouteDefinition): void {
    this.routes.set(route.path, route);
  }

  /**
   * Register a navigation callback (e.g., to update sidebar active state).
   */
  onNavigate(callback: (path: string) => void): void {
    this.onNavigateCallbacks.push(callback);
  }

  /**
   * Navigate to a path.
   */
  navigate(path: string): void {
    window.location.hash = `#${path}`;
  }

  /**
   * Get all registered routes.
   */
  getRoutes(): RouteDefinition[] {
    return Array.from(this.routes.values());
  }

  /**
   * Get the current active path.
   */
  getCurrentPath(): string {
    return this.currentPath;
  }

  /**
   * Start the router — handle the initial route.
   */
  start(defaultPath: string = '/dashboard'): void {
    if (!window.location.hash || window.location.hash === '#') {
      window.location.hash = `#${defaultPath}`;
    } else {
      this.handleRoute();
    }
  }

  /**
   * Handle the current hash route.
   */
  private handleRoute(): void {
    const hash = window.location.hash.slice(1) || '/dashboard';
    const route = this.routes.get(hash);

    if (route) {
      this.currentPath = hash;
      this.container.innerHTML = '';
      route.render(this.container);

      // Notify listeners
      for (const cb of this.onNavigateCallbacks) {
        cb(hash);
      }
    } else {
      // Default to dashboard if route not found
      this.navigate('/dashboard');
    }
  }
}
