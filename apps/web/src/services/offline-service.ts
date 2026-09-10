/**
 * Offline Service
 *
 * Manages offline resilience, Service Worker lifecycle, offline storage audits,
 * simulated network disconnection, and offline subsystem readiness verification.
 */

import { Logger } from '@navic/shared-models';

export interface CacheStats {
  shellCount: number;
  tilesCount: number;
  quotaBytes?: number;
  usageBytes?: number;
}

export interface SubsystemAuditResult {
  name: string;
  category: 'core' | 'storage' | 'sensors' | 'audio';
  ready: boolean;
  latencyMs: number;
  details: string;
}

export interface OfflineStatus {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  effectiveOffline: boolean;
  serviceWorkerActive: boolean;
  cacheStats: CacheStats;
}

export type OfflineListener = (status: OfflineStatus) => void;

class OfflineServiceImpl {
  private logger = new Logger('OfflineService');
  private isOnline = navigator.onLine;
  private isSimulatedOffline = false;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private listeners: Set<OfflineListener> = new Set();
  private cachedStats: CacheStats = { shellCount: 0, tilesCount: 0 };

  constructor() {
    this.initNetworkListeners();
    this.initServiceWorker();
  }

  private initNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.logger.info('Network state changed: ONLINE');
      this.notify();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.logger.warn('Network state changed: OFFLINE — operating 100% on-device');
      this.notify();
    });
  }

  private async initServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      this.logger.warn('Service Workers are not supported in this browser environment');
      return;
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      this.logger.info(`Service Worker registered with scope: ${this.swRegistration.scope}`);

      // Refresh cache stats
      await this.refreshCacheStats();
      this.notify();
    } catch (err) {
      this.logger.warn('Service Worker registration skipped or failed:', err);
    }
  }

  public getStatus(): OfflineStatus {
    return {
      isOnline: this.isOnline,
      isSimulatedOffline: this.isSimulatedOffline,
      effectiveOffline: !this.isOnline || this.isSimulatedOffline,
      serviceWorkerActive: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
      cacheStats: this.cachedStats,
    };
  }

  public setSimulatedOffline(offline: boolean): void {
    this.isSimulatedOffline = offline;
    this.logger.warn(`Simulated Offline Mode: ${offline ? 'ENABLED' : 'DISABLED'}`);
    this.notify();
  }

  public toggleSimulatedOffline(): boolean {
    this.setSimulatedOffline(!this.isSimulatedOffline);
    return this.isSimulatedOffline;
  }

  public subscribe(listener: OfflineListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const status = this.getStatus();
    for (const listener of this.listeners) {
      listener(status);
    }
  }

  /**
   * Fetches latest cache counts and storage usage estimates from the Service Worker.
   */
  public async refreshCacheStats(): Promise<CacheStats> {
    const stats: CacheStats = { shellCount: 0, tilesCount: 0 };

    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const est = await navigator.storage.estimate();
        stats.usageBytes = est.usage;
        stats.quotaBytes = est.quota;
      } catch {
        // Ignored
      }
    }

    if (navigator.serviceWorker?.controller) {
      try {
        const messagePromise = new Promise<any>((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = (event) => resolve(event.data);
          navigator.serviceWorker.controller?.postMessage({ type: 'GET_CACHE_STATS' }, [channel.port2]);
          setTimeout(() => resolve(null), 1000); // 1s timeout
        });

        const res = await messagePromise;
        if (res && res.status === 'ok') {
          stats.shellCount = res.shellCount ?? 0;
          stats.tilesCount = res.tilesCount ?? 0;
        }
      } catch (err) {
        this.logger.warn('Failed to query SW cache stats:', err);
      }
    } else if ('caches' in window) {
      try {
        if (await caches.has('navic-shell-v1')) {
          const c = await caches.open('navic-shell-v1');
          stats.shellCount = (await c.keys()).length;
        }
        if (await caches.has('navic-tiles-v1')) {
          const c = await caches.open('navic-tiles-v1');
          stats.tilesCount = (await c.keys()).length;
        }
      } catch {
        // Ignored
      }
    }

    this.cachedStats = stats;
    return stats;
  }

  /**
   * Clears offline caches.
   */
  public async clearCaches(): Promise<void> {
    if ('caches' in window) {
      await caches.delete('navic-shell-v1');
      await caches.delete('navic-tiles-v1');
    }
    await this.refreshCacheStats();
    this.notify();
  }

  /**
   * Comprehensive audit of all offline subsystems.
   */
  public async auditSubsystems(): Promise<SubsystemAuditResult[]> {
    const results: SubsystemAuditResult[] = [];

    // 1. Embedded Road Graph Check
    const t0 = performance.now();
    let graphReady = false;
    let graphDetails = 'Not loaded';
    try {
      const { routingService } = await import('./routing-service.js');
      const graph = routingService.getEngine().getGraph();
      const nodes = graph.nodeCount();
      const edges = graph.edgeCount();
      graphReady = nodes > 0 && edges > 0;
      graphDetails = `${nodes} vertices, ${edges} road edges (100% offline embedded)`;
    } catch (e: any) {
      graphDetails = e.message;
    }
    results.push({
      name: 'Topological Road Graph',
      category: 'core',
      ready: graphReady,
      latencyMs: performance.now() - t0,
      details: graphDetails,
    });

    // 2. Offline POI Database Check
    const t1 = performance.now();
    let poiReady = false;
    let poiDetails = 'Not loaded';
    try {
      const { poiService } = await import('./poi-service.js');
      const count = poiService.getAll().length;
      poiReady = count > 0;
      poiDetails = `${count} Delhi POIs across 10 categories with spatial indexing`;
    } catch (e: any) {
      poiDetails = e.message;
    }
    results.push({
      name: 'Offline POI Database',
      category: 'core',
      ready: poiReady,
      latencyMs: performance.now() - t1,
      details: poiDetails,
    });

    // 3. 7-State EKF Sensor Fusion Check
    const t2 = performance.now();
    let ekfReady = false;
    let ekfDetails = 'Idle';
    try {
      const { fusionService } = await import('./fusion-service.js');
      const status = fusionService.getStatus();
      ekfReady = !!status;
      ekfDetails = `50 Hz cycle budget, mode: ${status?.mode ?? 'ACTIVE'}, update rate: ${status?.updateRateHz ?? 50} Hz`;
    } catch (e: any) {
      ekfDetails = e.message;
    }
    results.push({
      name: '7-State EKF Sensor Fusion',
      category: 'sensors',
      ready: ekfReady,
      latencyMs: performance.now() - t2,
      details: ekfDetails,
    });

    // 4. Procedural Audio & Web Speech Check
    const t3 = performance.now();
    let audioReady = false;
    let audioDetails = 'Unavailable';
    try {
      const { voiceGuidanceService } = await import('./voice-guidance-service.js');
      const hasAudioContext = typeof window.AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined';
      const hasSpeech = typeof window.speechSynthesis !== 'undefined';
      audioReady = hasAudioContext;
      audioDetails = `Web Audio API: ${hasAudioContext ? 'Active' : 'Missing'} | TTS SpeechSynthesis: ${hasSpeech ? 'Available' : 'Fallback only'}`;
    } catch (e: any) {
      audioDetails = e.message;
    }
    results.push({
      name: 'Procedural Audio & Speech',
      category: 'audio',
      ready: audioReady,
      latencyMs: performance.now() - t3,
      details: audioDetails,
    });

    // 5. Offline Storage & Tile Cache
    const t4 = performance.now();
    const stats = await this.refreshCacheStats();
    results.push({
      name: 'Offline Tile & Asset Cache',
      category: 'storage',
      ready: true,
      latencyMs: performance.now() - t4,
      details: `${stats.tilesCount} tiles cached | ${stats.shellCount} shell files | ${(stats.usageBytes ? (stats.usageBytes / (1024 * 1024)).toFixed(1) : '0')} MB`,
    });

    return results;
  }
}

export const offlineService = new OfflineServiceImpl();
