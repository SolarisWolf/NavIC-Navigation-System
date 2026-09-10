/**
 * Route Planning Screen
 *
 * Destination input, routing profile/optimization selection,
 * and route summary display.
 * Controls are disabled until routing engine (Phase 8) and POI database
 * (Phase 7) are available.
 */

export function renderRouteScreen(container: HTMLElement): void {
  container.innerHTML = `
    <div class="route-screen screen">
      <div class="screen__header">
        <div>
          <h1 class="screen__title">Route Planning</h1>
          <p class="screen__subtitle">Offline route calculation and navigation setup</p>
        </div>
      </div>

      <!-- Route Input Form -->
      <div class="route-form">
        <div class="route-form__title">Plan Your Route</div>

        <div class="route-field">
          <label class="route-field__label">Origin</label>
          <input
            class="route-field__input"
            type="text"
            placeholder="Current position (auto-detected)"
            disabled
            id="route-origin"
          />
          <span class="route-field__hint">
            Will auto-populate from GNSS position (Phase 3)
          </span>
        </div>

        <div class="route-field">
          <label class="route-field__label">Destination</label>
          <input
            class="route-field__input"
            type="text"
            placeholder="Search for a destination..."
            disabled
            id="route-destination"
          />
          <span class="route-field__hint">
            Offline POI search available in Phase 7
          </span>
        </div>

        <!-- Options -->
        <div class="route-options">
          <div class="route-options__group">
            <span class="route-options__label">Profile</span>
            <div class="toggle-group">
              <div class="toggle-group__item toggle-group__item--active" data-profile="car">🚗 Car</div>
              <div class="toggle-group__item" data-profile="bicycle">🚲 Bicycle</div>
              <div class="toggle-group__item" data-profile="walking">🚶 Walking</div>
            </div>
          </div>

          <div class="route-options__group">
            <span class="route-options__label">Optimize</span>
            <div class="toggle-group">
              <div class="toggle-group__item toggle-group__item--active" data-opt="fastest">⚡ Fastest</div>
              <div class="toggle-group__item" data-opt="shortest">📏 Shortest</div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="route-form__actions">
          <button class="btn btn--primary" disabled id="btn-calculate">
            🧭 Calculate Route
          </button>
          <button class="btn btn--secondary" disabled id="btn-clear">
            Clear
          </button>
        </div>
      </div>

      <!-- Route Summary -->
      <div class="route-summary">
        <div class="route-summary__title">Route Summary</div>
        <div class="route-summary__empty">
          <div class="route-summary__empty-icon">🛤️</div>
          <p>No route calculated</p>
          <p style="margin-top: var(--space-2); font-size: var(--text-xs); color: var(--text-muted);">
            Offline routing engine will be available in Phase 8.
            Routes are calculated locally using GraphHopper — no internet required.
          </p>
        </div>
      </div>
    </div>
  `;

  // Toggle group interaction
  const toggleGroups = container.querySelectorAll('.toggle-group');
  toggleGroups.forEach((group) => {
    const items = group.querySelectorAll('.toggle-group__item');
    items.forEach((item) => {
      item.addEventListener('click', () => {
        items.forEach((i) => i.classList.remove('toggle-group__item--active'));
        item.classList.add('toggle-group__item--active');
      });
    });
  });
}
