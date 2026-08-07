import { SatelliteManager } from './satellites';

export class UI {
  private satelliteManager: SatelliteManager;
  private activeFilters: Set<string> = new Set();
  private tooltip: HTMLElement | null = null;

  constructor(satelliteManager: SatelliteManager) {
    this.satelliteManager = satelliteManager;
    this.setupEventListeners();
    this.createTooltip();
  }

  private setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    searchInput.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value;
      this.handleSearch(query);
    });

    // Toggle orbits
    const toggleOrbits = document.getElementById('toggle-orbits') as HTMLInputElement;
    toggleOrbits.addEventListener('change', (e) => {
      this.satelliteManager.toggleOrbits((e.target as HTMLInputElement).checked);
    });

    // Toggle labels
    const toggleLabels = document.getElementById('toggle-labels') as HTMLInputElement;
    toggleLabels.addEventListener('change', (e) => {
      this.satelliteManager.toggleLabels((e.target as HTMLInputElement).checked);
    });
  }

  private createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'satellite-tooltip';
    this.tooltip.style.cssText = `
      position: fixed;
      background: rgba(10, 14, 26, 0.95);
      border: 1px solid rgba(74, 158, 255, 0.5);
      border-radius: 8px;
      padding: 12px 16px;
      color: white;
      font-size: 13px;
      pointer-events: none;
      display: none;
      z-index: 1000;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      max-width: 300px;
    `;
    document.body.appendChild(this.tooltip);
  }

  updateSatelliteList() {
    // Setup category filters - all start as inactive (not loaded)
    const categories = this.satelliteManager.getCategories();
    const filterContainer = document.getElementById('category-filters')!;
    filterContainer.innerHTML = '';

    categories.forEach(cat => {
      const button = document.createElement('button');
      button.className = 'filter-btn'; // Start inactive
      button.innerHTML = `
        <span>${cat.name}</span>
        <span class="count">${cat.count}</span>
      `;
      button.onclick = () => this.toggleCategory(cat.file, button);
      filterContainer.appendChild(button);
    });

    // Initialize with empty satellite list
    this.renderSatellites([]);

    // Update loading message
    document.getElementById('loading')!.style.display = 'none';
    document.getElementById('satellites-section')!.style.display = 'block';
  }

  private handleSearch(query: string) {
    const results = this.satelliteManager.searchSatellites(query);
    this.renderSatellites(results.slice(0, 50)); // Reduced from 100
  }

  private renderSatellites(satellites: any[]) {
    const listContainer = document.getElementById('satellite-list')!;
    const countElement = document.getElementById('satellite-count')!;

    listContainer.innerHTML = '';
    countElement.textContent = satellites.length.toString();

    satellites.forEach(sat => {
      const item = document.createElement('div');
      item.className = 'satellite-item';
      item.innerHTML = `
        <div class="satellite-name">${sat.data.name}</div>
        <div class="satellite-info">ID: ${sat.data.id} | ${this.getCategoryDisplayName(sat.data.category)}</div>
      `;
      item.onclick = () => this.selectSatellite(sat.data.name, item);
      listContainer.appendChild(item);
    });
  }

  private selectSatellite(name: string, element: HTMLElement) {
    // Remove previous selection
    document.querySelectorAll('.satellite-item').forEach(el => {
      el.classList.remove('selected');
    });

    // Add selection
    element.classList.add('selected');
    this.satelliteManager.selectSatellite(name);
  }

  private async toggleCategory(category: string, button: HTMLButtonElement) {
    const isLoaded = this.satelliteManager.isCategoryLoaded(category);
    const isLoading = this.satelliteManager.isCategoryLoading(category);

    if (isLoading) {
      console.log(`Category ${category} is already loading...`);
      return;
    }

    if (isLoaded) {
      // Unload category
      await this.satelliteManager.unloadCategory(category);
      button.classList.remove('active');
      this.activeFilters.delete(category);

      // Count stays static - no need to update to 0
    } else {
      // Load category
      button.classList.add('loading');
      const countSpan = button.querySelector('.count') as HTMLElement;
      const originalCount = countSpan ? countSpan.textContent : '';
      if (countSpan) countSpan.textContent = 'Loading...';

      try {
        await this.satelliteManager.loadCategory(category);
        button.classList.remove('loading');
        button.classList.add('active');
        this.activeFilters.add(category);

        // Restore original static count
        if (countSpan) countSpan.textContent = originalCount;
      } catch (error) {
        console.error(`Failed to load category ${category}:`, error);
        button.classList.remove('loading');
        if (countSpan) countSpan.textContent = 'Error';
      }
    }

    // Update satellite list
    this.renderSatellites(this.satelliteManager.getAllSatellites().slice(0, 50));
  }

  private getCategoryDisplayName(category: string): string {
    const map: { [key: string]: string } = {
      'starlink': 'Starlink',
      'stations': 'Space Station',
      'gps-ops': 'GPS',
      'weather': 'Weather',
      'oneweb': 'OneWeb',
      'amateur': 'Amateur',
    };
    return map[category] || category;
  }

  showTooltip(satellite: any, mouseX: number, mouseY: number) {
    if (!this.tooltip) return;

    const info = this.satelliteManager.getSatelliteInfo(satellite);

    this.tooltip.innerHTML = `
      <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #4a9eff;">
        ${info.name}
      </div>
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 12px;">
        <span style="color: #888;">ID:</span>
        <span>${info.id}</span>
        <span style="color: #888;">Category:</span>
        <span>${this.getCategoryDisplayName(info.category)}</span>
        <span style="color: #888;">Altitude:</span>
        <span>${info.altitude}</span>
        <span style="color: #888;">Inclination:</span>
        <span>${info.inclination}</span>
        <span style="color: #888;">Period:</span>
        <span>${info.period}</span>
        <span style="color: #888;">Eccentricity:</span>
        <span>${info.eccentricity}</span>
      </div>
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11px; color: #888;">
        Click to select and show orbit
      </div>
    `;

    // Position tooltip near cursor
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const x = ((mouseX + 1) / 2) * window.innerWidth + 15;
    const y = ((-mouseY + 1) / 2) * window.innerHeight + 15;

    // Keep tooltip within viewport
    const finalX = Math.min(x, window.innerWidth - tooltipRect.width - 20);
    const finalY = Math.min(y, window.innerHeight - tooltipRect.height - 20);

    this.tooltip.style.left = `${finalX}px`;
    this.tooltip.style.top = `${finalY}px`;
    this.tooltip.style.display = 'block';
  }

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  }

  selectSatelliteByName(name: string) {
    this.satelliteManager.selectSatellite(name);

    // Scroll to satellite in list if visible
    const listItems = document.querySelectorAll('.satellite-item');
    listItems.forEach(item => {
      if (item.querySelector('.satellite-name')?.textContent === name) {
        item.classList.add('selected');
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  }
}
