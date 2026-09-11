/**
 * Destination Search Full-Screen Modal Component (Specification §3 & §4)
 *
 * Expands into a modern, distraction-free search experience:
 * - Prominent "● Offline Search" indicator
 * - Recent destinations in Bengaluru (Airport, Electronic City, Bull Temple, Lalbagh)
 * - Quick Nearby category chips (Hospitals, Fuel, Food, Parking, Banks, Landmarks)
 * - Real-time fuzzy POI search results with distance and direct Navigate button
 */

import type { POI } from '@navic/shared-models';
import { poiService } from '../services/poi-service.js';
import { routingService } from '../services/routing-service.js';
import { fusionService } from '../services/fusion-service.js';
import { positionService } from '../services/position-service.js';
import type { Router } from '../router.js';

export interface RecentPlace {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  subtitle: string;
}

const RECENT_PLACES: RecentPlace[] = [
  {
    id: 'rec-1',
    name: 'Kempegowda International Airport',
    category: 'transport',
    latitude: 13.1986,
    longitude: 77.7066,
    subtitle: 'Devanahalli, Bengaluru',
  },
  {
    id: 'rec-2',
    name: 'Electronic City Phase 1',
    category: 'commercial',
    latitude: 12.8399,
    longitude: 77.6770,
    subtitle: 'Hosur Road, Bengaluru',
  },
  {
    id: 'rec-3',
    name: 'Dodda Ganesha & Bull Temple',
    category: 'temple',
    latitude: 12.9427,
    longitude: 77.5681,
    subtitle: 'Basavanagudi, Bengaluru',
  },
  {
    id: 'rec-4',
    name: 'Lalbagh Botanical Gardens',
    category: 'park',
    latitude: 12.9507,
    longitude: 77.5848,
    subtitle: 'Mavalli, Bengaluru',
  },
  {
    id: 'rec-5',
    name: 'Vidyarthi Bhavan',
    category: 'restaurant',
    latitude: 12.9443,
    longitude: 77.5732,
    subtitle: 'Gandhi Bazaar, Basavanagudi',
  },
];

const CATEGORY_ITEMS = [
  { key: 'all', label: 'All', icon: '🌟' },
  { key: 'hospital', label: 'Hospitals', icon: '🏥' },
  { key: 'fuel', label: 'Petrol Stations', icon: '⛽' },
  { key: 'restaurant', label: 'Restaurants', icon: '🍴' },
  { key: 'parking', label: 'Parking', icon: '🅿️' },
  { key: 'bank', label: 'Banks / ATMs', icon: '🏦' },
  { key: 'temple', label: 'Landmarks / Temples', icon: '🏛️' },
];

export class DestinationSearchModal {
  private container: HTMLElement;
  private router?: Router;
  private isOpen = false;
  private activeCategory = 'all';

  constructor(container: HTMLElement, router?: Router) {
    this.container = container;
    this.router = router;
    this.render();
  }

  public open(initialCategory?: string): void {
    this.isOpen = true;
    this.container.style.display = 'block';
    document.body.classList.add('search-modal-open');
    if (initialCategory) {
      this.activeCategory = initialCategory;
      this.updateCategoryUI();
      const input = this.container.querySelector<HTMLInputElement>('#search-modal-input');
      if (input) input.value = '';
      this.showCategoryResults(this.activeCategory);
      return;
    } else {
      this.activeCategory = 'all';
      this.updateCategoryUI();
    }
    const input = this.container.querySelector<HTMLInputElement>('#search-modal-input');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 100);
    }
    this.showDefaultSuggestions();
  }

  private updateCategoryUI(): void {
    this.container.querySelectorAll<HTMLButtonElement>('.search-cat-chip').forEach((chip) => {
      if (chip.dataset.cat === this.activeCategory) {
        chip.classList.add('search-cat-chip--active');
      } else {
        chip.classList.remove('search-cat-chip--active');
      }
    });
  }

  public close(): void {
    this.isOpen = false;
    this.container.style.display = 'none';
    document.body.classList.remove('search-modal-open');
  }

  private render(): void {
    this.container.className = 'destination-search-modal';
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div class="search-modal__backdrop"></div>
      <div class="search-modal__content">
        <!-- Top Bar -->
        <div class="search-modal__top-bar">
          <button class="search-modal__back-btn" id="btn-search-modal-back" aria-label="Back">
            ←
          </button>

          <div class="search-modal__input-wrapper">
            <span class="search-modal__icon">🔍</span>
            <input type="text"
                   id="search-modal-input"
                   class="search-modal__input"
                   placeholder="Search places or roads in Bengaluru..."
                   autocomplete="off" />
            <button class="search-modal__clear-btn" id="btn-search-modal-clear" style="display: none;">✕</button>
          </div>

          <div class="search-modal__offline-tag">
            <span class="offline-tag-dot"></span>
            <span>Offline Search</span>
          </div>
        </div>

        <!-- Quick Filter Categories -->
        <div class="search-modal__category-bar" id="search-modal-categories">
          ${CATEGORY_ITEMS.map((cat) => `
            <button class="search-cat-chip ${cat.key === 'all' ? 'search-cat-chip--active' : ''}"
                    data-cat="${cat.key}">
              <span>${cat.icon}</span>
              <span>${cat.label}</span>
            </button>
          `).join('')}
        </div>

        <!-- Body Area: Recent / Nearby or Live Results -->
        <div class="search-modal__scroll-area" id="search-modal-results">
          <!-- Populated dynamically -->
        </div>
      </div>
    `;

    // Event listeners
    this.container.querySelector('#btn-search-modal-back')?.addEventListener('click', () => this.close());
    this.container.querySelector('.search-modal__backdrop')?.addEventListener('click', () => this.close());

    const input = this.container.querySelector<HTMLInputElement>('#search-modal-input');
    const clearBtn = this.container.querySelector<HTMLElement>('#btn-search-modal-clear');

    input?.addEventListener('input', () => {
      const val = input.value.trim();
      if (clearBtn) clearBtn.style.display = val ? 'flex' : 'none';
      if (val) {
        this.performSearch(val);
      } else {
        this.showDefaultSuggestions();
      }
    });

    clearBtn?.addEventListener('click', () => {
      if (input) {
        input.value = '';
        input.focus();
      }
      if (clearBtn) clearBtn.style.display = 'none';
      this.showDefaultSuggestions();
    });

    // Category chips
    this.container.querySelectorAll<HTMLButtonElement>('.search-cat-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        this.container.querySelectorAll('.search-cat-chip').forEach((c) => c.classList.remove('search-cat-chip--active'));
        chip.classList.add('search-cat-chip--active');
        this.activeCategory = chip.dataset.cat || 'all';

        const q = input?.value.trim() || '';
        if (q) {
          this.performSearch(q);
        } else {
          this.showCategoryResults(this.activeCategory);
        }
      });
    });
  }

  private getCurrentOrigin(): { latitude: number; longitude: number } {
    const fused = fusionService.getLatestEstimate();
    if (fused && fused.coordinate.latitude !== 0) {
      return fused.coordinate;
    }
    const raw = positionService.lastPosition;
    if (raw && raw.coordinate.latitude !== 0) {
      return raw.coordinate;
    }
    return { latitude: 12.9343, longitude: 77.5627 }; // Bengaluru center
  }

  private calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private formatDist(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }

  private showDefaultSuggestions(): void {
    const resultsContainer = this.container.querySelector<HTMLElement>('#search-modal-results');
    if (!resultsContainer) return;

    const origin = this.getCurrentOrigin();

    resultsContainer.innerHTML = `
      <div class="search-section">
        <div class="search-section__title">
          <span>🕘 RECENT & POPULAR DESTINATIONS</span>
        </div>
        <div class="search-places-list">
          ${RECENT_PLACES.map((place) => {
            const dist = this.calculateDistanceMeters(origin.latitude, origin.longitude, place.latitude, place.longitude);
            return `
              <div class="search-place-item" data-id="${place.id}" data-lat="${place.latitude}" data-lon="${place.longitude}" data-name="${place.name}">
                <span class="search-place-icon">🕘</span>
                <div class="search-place-info">
                  <div class="search-place-name">${place.name}</div>
                  <div class="search-place-subtitle">${place.subtitle} · <span class="dist-accent">${this.formatDist(dist)}</span></div>
                </div>
                <button class="search-place-nav-btn" data-lat="${place.latitude}" data-lon="${place.longitude}" data-name="${place.name}">
                  Navigate
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="search-section">
        <div class="search-section__title">
          <span>📍 NEARBY BENGALURU POINTS OF INTEREST</span>
        </div>
        <div class="search-places-list" id="nearby-poi-list">
          ${poiService.getAll().slice(0, 8).map((poi) => {
            const dist = this.calculateDistanceMeters(origin.latitude, origin.longitude, poi.latitude, poi.longitude);
            return `
              <div class="search-place-item" data-lat="${poi.latitude}" data-lon="${poi.longitude}" data-name="${poi.name}">
                <span class="search-place-icon">📍</span>
                <div class="search-place-info">
                  <div class="search-place-name">${poi.name}</div>
                  <div class="search-place-subtitle">${poi.category.toUpperCase()} · <span class="dist-accent">${this.formatDist(dist)}</span></div>
                </div>
                <button class="search-place-nav-btn" data-lat="${poi.latitude}" data-lon="${poi.longitude}" data-name="${poi.name}">
                  Navigate
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.attachItemHandlers(resultsContainer);
  }

  private showCategoryResults(category: string): void {
    const resultsContainer = this.container.querySelector<HTMLElement>('#search-modal-results');
    if (!resultsContainer) return;

    const origin = this.getCurrentOrigin();
    const all = poiService.getAll();
    const filtered = category === 'all' ? all : all.filter((p) => p.category.toLowerCase().includes(category.toLowerCase()));

    resultsContainer.innerHTML = `
      <div class="search-section">
        <div class="search-section__title">
          <span>${category.toUpperCase()} RESULTS (${filtered.length} OFFLINE)</span>
        </div>
        <div class="search-places-list">
          ${filtered.length === 0 ? '<div class="no-results-msg">No places found in this category offline</div>' : ''}
          ${filtered.map((poi) => {
            const dist = this.calculateDistanceMeters(origin.latitude, origin.longitude, poi.latitude, poi.longitude);
            return `
              <div class="search-place-item" data-lat="${poi.latitude}" data-lon="${poi.longitude}" data-name="${poi.name}">
                <span class="search-place-icon">📍</span>
                <div class="search-place-info">
                  <div class="search-place-name">${poi.name}</div>
                  <div class="search-place-subtitle">${poi.address || poi.category} · <span class="dist-accent">${this.formatDist(dist)}</span></div>
                </div>
                <button class="search-place-nav-btn" data-lat="${poi.latitude}" data-lon="${poi.longitude}" data-name="${poi.name}">
                  Navigate
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.attachItemHandlers(resultsContainer);
  }

  private performSearch(query: string): void {
    const resultsContainer = this.container.querySelector<HTMLElement>('#search-modal-results');
    if (!resultsContainer) return;

    const origin = this.getCurrentOrigin();
    const category = this.activeCategory === 'all' ? undefined : (this.activeCategory as any);
    const searchResults = poiService.search(query, { category, limit: 15 });

    // Also match recent places
    const matchedRecents = RECENT_PLACES.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) || p.subtitle.toLowerCase().includes(query.toLowerCase())
    );

    resultsContainer.innerHTML = `
      <div class="search-section">
        <div class="search-section__title">
          <span>SEARCH RESULTS FOR "${query.toUpperCase()}" (${searchResults.length + matchedRecents.length} FOUND)</span>
        </div>
        <div class="search-places-list">
          ${searchResults.length === 0 && matchedRecents.length === 0 ? `
            <div class="no-results-msg">
              No offline destinations match "${query}".<br/>
              <span class="text-muted">Try searching for Bull Temple, Lalbagh, Electronic City, or Hospital.</span>
            </div>
          ` : ''}

          ${matchedRecents.map((place) => {
            const dist = this.calculateDistanceMeters(origin.latitude, origin.longitude, place.latitude, place.longitude);
            return `
              <div class="search-place-item" data-lat="${place.latitude}" data-lon="${place.longitude}" data-name="${place.name}">
                <span class="search-place-icon">🕘</span>
                <div class="search-place-info">
                  <div class="search-place-name">${place.name}</div>
                  <div class="search-place-subtitle">${place.subtitle} · <span class="dist-accent">${this.formatDist(dist)}</span></div>
                </div>
                <button class="search-place-nav-btn" data-lat="${place.latitude}" data-lon="${place.longitude}" data-name="${place.name}">
                  Navigate
                </button>
              </div>
            `;
          }).join('')}

          ${searchResults.map((res) => {
            const poi = res.poi;
            const dist = res.distanceMeters ?? this.calculateDistanceMeters(origin.latitude, origin.longitude, poi.latitude, poi.longitude);
            return `
              <div class="search-place-item" data-lat="${poi.latitude}" data-lon="${poi.longitude}" data-name="${poi.name}">
                <span class="search-place-icon">📍</span>
                <div class="search-place-info">
                  <div class="search-place-name">${poi.name}</div>
                  <div class="search-place-subtitle">${poi.address || poi.category} · <span class="dist-accent">${this.formatDist(dist)}</span></div>
                </div>
                <button class="search-place-nav-btn" data-lat="${poi.latitude}" data-lon="${poi.longitude}" data-name="${poi.name}">
                  Navigate
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.attachItemHandlers(resultsContainer);
  }

  private attachItemHandlers(container: HTMLElement): void {
    container.querySelectorAll<HTMLElement>('.search-place-item, .search-place-nav-btn').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const lat = parseFloat(el.dataset.lat || '0');
        const lon = parseFloat(el.dataset.lon || '0');
        const name = el.dataset.name || 'Destination';

        if (lat !== 0 && lon !== 0) {
          this.navigateToDestination(lat, lon, name);
        }
      });
    });
  }

  private navigateToDestination(lat: number, lon: number, name: string): void {
    const origin = this.getCurrentOrigin();

    // Close modal
    this.close();

    // Calculate route immediately via routing service
    routingService.calculateRoute({
      origin,
      destination: { latitude: lat, longitude: lon },
    });

    // Navigate to Map screen
    if (this.router) {
      this.router.navigate('/map');
    } else {
      window.location.hash = '#/map';
    }
  }
}
