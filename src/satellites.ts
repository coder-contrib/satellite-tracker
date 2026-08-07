import * as THREE from 'three';
import * as satellite from 'satellite.js';

export interface SatelliteData {
  name: string;
  id: number;
  tle1: string;
  tle2: string;
  category: string;
}

export interface SatelliteObject {
  data: SatelliteData;
  satrec: satellite.SatelliteRecord;
  mesh: THREE.Mesh;
  orbitLine?: THREE.Line;
  label?: THREE.Sprite;
  position: THREE.Vector3;
}

export class SatelliteManager {
  private scene: THREE.Scene;
  private satellites: SatelliteObject[] = [];
  private activeSatellite: SatelliteObject | null = null;
  private showOrbit = false;
  private showLabels = false; // Default off for performance
  private lastUpdateTime = 0;
  private updateInterval = 150; // Update satellites every 150ms for 30 FPS

  // Shared geometries and materials for memory efficiency
  private sharedGeometry = new THREE.SphereGeometry(1.0, 4, 4); // Increased from 0.5 to 1.0 for easier clicking
  private materialCache = new Map<string, THREE.MeshBasicMaterial>();

  // Track loaded categories
  private loadedCategories = new Set<string>();
  private loadingCategories = new Set<string>();

  // Satellite categories from CelesTrak - all categories included with static counts
  private categories = [
    { name: 'ISS & Space Stations', file: 'stations', count: 15, loaded: false },
    { name: 'Starlink', file: 'starlink', count: 6000, loaded: false },
    { name: 'GPS Operational', file: 'gps-ops', count: 50, loaded: false },
    { name: 'Weather', file: 'weather', count: 50, loaded: false },
    { name: 'OneWeb', file: 'oneweb', count: 600, loaded: false },
    { name: 'Amateur Radio', file: 'amateur', count: 200, loaded: false },
  ];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.lastUpdateTime = performance.now();
  }

  async loadSatellites() {
    // Don't load any satellites by default - wait for user to enable categories
    document.getElementById('total-satellites')!.textContent = '0';
    console.log('Satellite manager initialized. Categories will load on-demand.');
  }

  async loadCategory(categoryFile: string): Promise<void> {
    // Prevent duplicate loading
    if (this.loadedCategories.has(categoryFile) || this.loadingCategories.has(categoryFile)) {
      console.log(`Category ${categoryFile} already loaded or loading`);
      return;
    }

    console.log(`Starting to load category: ${categoryFile}`);
    this.loadingCategories.add(categoryFile);

    try {
      await this.fetchCategory(categoryFile);
      this.loadedCategories.add(categoryFile);

      // Update category loaded status (keep static count)
      const cat = this.categories.find(c => c.file === categoryFile);
      if (cat) cat.loaded = true;

      console.log(`Successfully loaded ${categoryFile}. Total satellites now: ${this.satellites.length}`);
      document.getElementById('total-satellites')!.textContent = this.satellites.length.toString();
    } finally {
      this.loadingCategories.delete(categoryFile);
    }
  }

  async unloadCategory(categoryFile: string): Promise<void> {
    if (!this.loadedCategories.has(categoryFile)) {
      return;
    }

    // Remove all satellites from this category
    const satellitesToRemove = this.satellites.filter(sat => sat.data.category === categoryFile);

    for (const sat of satellitesToRemove) {
      // Remove from scene
      this.scene.remove(sat.mesh);
      if (sat.label) this.scene.remove(sat.label);
      if (sat.orbitLine) this.scene.remove(sat.orbitLine);
    }

    // Remove from array
    this.satellites = this.satellites.filter(sat => sat.data.category !== categoryFile);

    // Update state (keep static count)
    this.loadedCategories.delete(categoryFile);
    const cat = this.categories.find(c => c.file === categoryFile);
    if (cat) {
      cat.loaded = false;
      // Don't reset count - keep it static
    }

    // Clear active satellite if it was from this category
    if (this.activeSatellite && this.activeSatellite.data.category === categoryFile) {
      this.activeSatellite = null;
    }

    document.getElementById('total-satellites')!.textContent = this.satellites.length.toString();
    console.log(`Unloaded ${categoryFile}: ${this.satellites.length} remaining satellites`);
  }

  isCategoryLoaded(categoryFile: string): boolean {
    return this.loadedCategories.has(categoryFile);
  }

  isCategoryLoading(categoryFile: string): boolean {
    return this.loadingCategories.has(categoryFile);
  }

  private async fetchCategory(category: string): Promise<void> {
    try {
      // Try to fetch from CelesTrak first, fallback to sample data
      let response;
      let usingSampleData = false;

      try {
        response = await fetch(`/api/celestrak/NORAD/elements/gp.php?GROUP=${category}&FORMAT=tle`);
        if (!response.ok) throw new Error('CelesTrak returned ' + response.status);
      } catch (error) {
        console.warn(`CelesTrak unavailable, using sample data for ${category}`);
        response = await fetch('/data/sample-tle.txt');
        usingSampleData = true;
      }

      if (!response.ok) {
        console.error(`Failed to fetch ${category}: ${response.status}`);
        return;
      }

      const text = await response.text();
      const lines = text.trim().split('\n');

      let count = 0;
      for (let i = 0; i < lines.length; i += 3) {
        if (i + 2 < lines.length) {
          const name = lines[i].trim();
          const tle1 = lines[i + 1].trim();
          const tle2 = lines[i + 2].trim();

          const satrec = satellite.twoline2satrec(tle1, tle2);

          if (satrec.error === 0) {
            const satData: SatelliteData = {
              name,
              id: satrec.satnum,
              tle1,
              tle2,
              category,
            };

            this.createSatellite(satData, satrec);
            count++;
          }
        }
      }

      console.log(`Fetched ${count} satellites for ${category}${usingSampleData ? ' (sample data)' : ''}`);

    } catch (error) {
      console.error(`Error fetching ${category}:`, error);
    }
  }

  private createSatellite(data: SatelliteData, satrec: satellite.SatelliteRecord) {
    // Reuse shared geometry for all satellites
    const color = this.getCategoryColor(data.category);

    // Get or create material from cache - using Phong material for shiny effect
    let material = this.materialCache.get(data.category);
    if (!material) {
      material = new THREE.MeshPhongMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.3,
        shininess: 100,
        specular: 0xffffff,
        transparent: true,
        opacity: 0.95
      }) as any;
      this.materialCache.set(data.category, material as any);
    }

    const mesh = new THREE.Mesh(this.sharedGeometry, material);
    mesh.visible = true; // Ensure visible

    // Don't create labels by default - only on demand to save memory
    const satObject: SatelliteObject = {
      data,
      satrec,
      mesh,
      position: new THREE.Vector3(),
    };

    this.satellites.push(satObject);
    this.scene.add(mesh);

    // Initialize position immediately
    this.updateSatellitePosition(satObject);

    // Log first few for debugging
    if (this.satellites.length <= 3) {
      console.log(`Created satellite ${data.name} at position:`, satObject.position);
    }
  }

  private updateSatellitePosition(sat: SatelliteObject) {
    const date = new Date();
    const positionAndVelocity = satellite.propagate(sat.satrec, date);

    if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
      const position = positionAndVelocity.position;
      const scale = 63.71 / 6371;
      sat.position.set(
        position.x * scale,
        position.z * scale,
        -position.y * scale
      );
      sat.mesh.position.copy(sat.position);
    }
  }

  private createLabel(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.font = '24px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.8
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(20, 5, 1);

    return sprite;
  }

  private getCategoryColor(category: string): number {
    const colors: { [key: string]: number } = {
      'starlink': 0x00ff00,
      'stations': 0xff0000,
      'gps-ops': 0xffaa00,
      'weather': 0x00aaff,
      'oneweb': 0xff00ff,
      'amateur': 0xffff00,
    };
    return colors[category] || 0xffffff;
  }

  update(delta: number) {
    const now = performance.now();

    // Throttle updates to reduce CPU load
    if (now - this.lastUpdateTime < this.updateInterval) {
      return;
    }

    this.lastUpdateTime = now;
    const date = new Date();

    for (const sat of this.satellites) {
      this.updateSatellitePosition(sat);
      if (sat.label) {
        sat.label.position.copy(sat.position);
        sat.label.position.y += 2;
      }
    }

    // Update orbit line if active satellite
    if (this.activeSatellite && this.showOrbit) {
      this.updateOrbitLine(this.activeSatellite);
    }
  }

  updateScale(scaleFactor: number) {
    // Scale all satellite meshes based on camera distance
    for (const sat of this.satellites) {
      sat.mesh.scale.setScalar(scaleFactor);
    }
  }

  private updateOrbitLine(sat: SatelliteObject) {
    if (sat.orbitLine) {
      this.scene.remove(sat.orbitLine);
    }

    const points: THREE.Vector3[] = [];
    const now = new Date();
    const period = 90; // Approximate orbit period in minutes

    // Reduce orbit line resolution
    for (let i = 0; i <= 50; i++) {
      const time = new Date(now.getTime() + (i * period * 60000) / 50);
      const positionAndVelocity = satellite.propagate(sat.satrec, time);

      if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
        const position = positionAndVelocity.position;
        const scale = 63.71 / 6371;
        points.push(new THREE.Vector3(
          position.x * scale,
          position.z * scale,
          -position.y * scale
        ));
      }
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.6
    });
    sat.orbitLine = new THREE.Line(geometry, material);
    this.scene.add(sat.orbitLine);
  }

  selectSatellite(name: string) {
    // Clear previous selection
    if (this.activeSatellite) {
      (this.activeSatellite.mesh.material as THREE.MeshBasicMaterial).emissive.setHex(0x000000);
      if (this.activeSatellite.orbitLine) {
        this.scene.remove(this.activeSatellite.orbitLine);
        this.activeSatellite.orbitLine = undefined;
      }
    }

    // Select new satellite
    const sat = this.satellites.find(s => s.data.name === name);
    if (sat) {
      this.activeSatellite = sat;
      (sat.mesh.material as THREE.MeshBasicMaterial).emissive.setHex(0xff0000);

      if (this.showOrbit) {
        this.updateOrbitLine(sat);
      }
    }
  }

  toggleOrbits(show: boolean) {
    this.showOrbit = show;

    if (!show && this.activeSatellite?.orbitLine) {
      this.scene.remove(this.activeSatellite.orbitLine);
      this.activeSatellite.orbitLine = undefined;
    } else if (show && this.activeSatellite) {
      this.updateOrbitLine(this.activeSatellite);
    }
  }

  toggleLabels(show: boolean) {
    this.showLabels = show;
    for (const sat of this.satellites) {
      if (show && !sat.label) {
        // Create label on demand
        sat.label = this.createLabel(sat.data.name);
        this.scene.add(sat.label);
      }
      if (sat.label) {
        sat.label.visible = show;
      }
    }
  }

  filterByCategory(category: string, show: boolean) {
    for (const sat of this.satellites) {
      if (sat.data.category === category) {
        sat.mesh.visible = show;
        if (sat.label) {
          sat.label.visible = show && this.showLabels;
        }
      }
    }
  }

  searchSatellites(query: string): SatelliteObject[] {
    if (!query) return this.satellites;

    const q = query.toLowerCase();
    return this.satellites.filter(sat =>
      sat.data.name.toLowerCase().includes(q)
    );
  }

  getCategories() {
    return this.categories;
  }

  getAllSatellites(): SatelliteObject[] {
    return this.satellites;
  }

  highlightSatellite(sat: SatelliteObject) {
    // Scale up the satellite even more for visibility
    sat.mesh.scale.multiplyScalar(2.5); // Increased from 2 to 2.5
  }

  clearHighlight(sat: SatelliteObject) {
    // Reset scale (considering current zoom scale factor)
    sat.mesh.scale.setScalar(1);
  }

  getSatelliteInfo(sat: SatelliteObject) {
    const satrec = sat.satrec;
    return {
      name: sat.data.name,
      id: sat.data.id,
      category: sat.data.category,
      inclination: (satrec.inclo * 180 / Math.PI).toFixed(2) + '°',
      eccentricity: satrec.ecco.toFixed(6),
      period: (2 * Math.PI / satrec.no).toFixed(2) + ' min',
      altitude: ((1 / Math.cbrt(satrec.no * satrec.no / 398600.4418) - 6371)).toFixed(2) + ' km',
    };
  }
}
