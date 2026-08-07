import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SatelliteManager } from './satellites';
import { UI } from './ui';

class SatelliteTracker {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private earth: THREE.Mesh;
  private satelliteManager: SatelliteManager;
  private ui: UI;
  private clock: THREE.Clock;
  private stats = { fps: 0, frame: 0, lastTime: 0 };
  private readonly targetFPS = 30; // Increased to 30 FPS
  private readonly frameInterval = 1000 / 30; // ~33ms per frame
  private lastFrameTime = 0;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private hoveredSatellite: any = null;
  private lastHoverCheck = 0;
  private hoverCheckInterval = 100; // Faster hover detection for 30 FPS

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    );
    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // Disable for better performance
      powerPreference: 'low-power'
    });
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.raycaster.params.Points = { threshold: 5 }; // Increased from 2 for easier selection
    // Increase threshold for mesh detection
    this.raycaster.params.Mesh = { threshold: 3 };

    this.init();
    this.earth = this.createEarth();
    this.satelliteManager = new SatelliteManager(this.scene);
    this.ui = new UI(this.satelliteManager);

    this.animate();
    this.loadSatellites();
    this.setupMouseEvents();
  }

  private init() {
    // Renderer setup - limit pixel ratio for performance
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    document.getElementById('canvas-container')!.appendChild(this.renderer.domElement);

    // Camera position
    this.camera.position.set(0, 0, 300);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 80;
    this.controls.maxDistance = 2000; // Increased from 500 to allow zooming out further

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(300, 0, 300);
    this.scene.add(sunLight);

    // Stars background
    this.createStars();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private setupMouseEvents() {
    this.renderer.domElement.addEventListener('mousemove', (event) => {
      // Calculate mouse position in normalized device coordinates (-1 to +1)
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Throttle hover checks to reduce CPU load
      const now = performance.now();
      if (now - this.lastHoverCheck > this.hoverCheckInterval) {
        this.lastHoverCheck = now;
        this.checkHover();
      }
    });

    this.renderer.domElement.addEventListener('click', (event) => {
      if (this.hoveredSatellite) {
        this.ui.selectSatelliteByName(this.hoveredSatellite.data.name);
      }
    });
  }

  private checkHover() {
    // Update raycaster with camera and mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Get all satellite meshes
    const satellites = this.satelliteManager.getAllSatellites();
    const meshes = satellites.map(s => s.mesh);

    // Check for intersections
    const intersects = this.raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      // Find the satellite object that corresponds to the intersected mesh
      const intersectedMesh = intersects[0].object;
      const satellite = satellites.find(s => s.mesh === intersectedMesh);

      if (satellite && satellite !== this.hoveredSatellite) {
        // Clear previous hover
        if (this.hoveredSatellite) {
          this.satelliteManager.clearHighlight(this.hoveredSatellite);
        }

        // Set new hover
        this.hoveredSatellite = satellite;
        this.satelliteManager.highlightSatellite(satellite);
        this.ui.showTooltip(satellite, this.mouse.x, this.mouse.y);
        this.renderer.domElement.style.cursor = 'pointer';
      }
    } else {
      // No intersection, clear hover
      if (this.hoveredSatellite) {
        this.satelliteManager.clearHighlight(this.hoveredSatellite);
        this.hoveredSatellite = null;
        this.ui.hideTooltip();
        this.renderer.domElement.style.cursor = 'default';
      }
    }
  }

  private createEarth(): THREE.Mesh {
    // Further reduce geometry complexity for 1 vCPU
    const geometry = new THREE.SphereGeometry(63.71, 24, 24); // Earth radius ~6371km scaled down

    // Create earth material with basic texture
    const material = new THREE.MeshPhongMaterial({
      color: 0x2233ff,
      emissive: 0x112244,
      specular: 0x333333,
      shininess: 25,
    });

    const earth = new THREE.Mesh(geometry, material);
    this.scene.add(earth);

    // Add atmosphere glow
    const atmosphereGeometry = new THREE.SphereGeometry(65, 24, 24);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    this.scene.add(atmosphere);

    // Add grid lines for latitude/longitude
    this.addGridLines();

    return earth;
  }

  private addGridLines() {
    const gridMaterial = new THREE.LineBasicMaterial({
      color: 0x3366aa,
      transparent: true,
      opacity: 0.3,
    });

    // Reduce grid line density
    // Latitude lines
    for (let lat = -60; lat <= 60; lat += 30) {
      const phi = (90 - lat) * (Math.PI / 180);
      const radius = 63.71 * Math.sin(phi);
      const y = 63.71 * Math.cos(phi);

      const geometry = new THREE.BufferGeometry();
      const points = [];
      for (let i = 0; i <= 32; i++) {
        const theta = (i / 32) * Math.PI * 2;
        points.push(
          new THREE.Vector3(
            radius * Math.cos(theta),
            y,
            radius * Math.sin(theta)
          )
        );
      }
      geometry.setFromPoints(points);
      const line = new THREE.Line(geometry, gridMaterial);
      this.scene.add(line);
    }

    // Longitude lines - fewer lines
    for (let lon = 0; lon < 360; lon += 45) {
      const geometry = new THREE.BufferGeometry();
      const points = [];
      for (let i = 0; i <= 32; i++) {
        const phi = (i / 32) * Math.PI;
        const theta = lon * (Math.PI / 180);
        points.push(
          new THREE.Vector3(
            63.71 * Math.sin(phi) * Math.cos(theta),
            63.71 * Math.cos(phi),
            63.71 * Math.sin(phi) * Math.sin(theta)
          )
        );
      }
      geometry.setFromPoints(points);
      const line = new THREE.Line(geometry, gridMaterial);
      this.scene.add(line);
    }
  }

  private createStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.5,
      transparent: true,
      opacity: 0.8,
    });

    const starsVertices = [];
    // Reduce star count to 1000
    for (let i = 0; i < 1000; i++) {
      const x = (Math.random() - 0.5) * 2000;
      const y = (Math.random() - 0.5) * 2000;
      const z = (Math.random() - 0.5) * 2000;
      starsVertices.push(x, y, z);
    }

    starsGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(starsVertices, 3)
    );

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    this.scene.add(stars);
  }

  private async loadSatellites() {
    try {
      await this.satelliteManager.loadSatellites();
      this.ui.updateSatelliteList();
      document.getElementById('loading')!.style.display = 'none';
      document.getElementById('satellites-section')!.style.display = 'block';
    } catch (error) {
      console.error('Failed to load satellites:', error);
      document.getElementById('loading')!.textContent = 'Failed to load satellite data';
    }
  }

  private animate = () => {
    requestAnimationFrame(this.animate);

    const now = performance.now();
    const elapsed = now - this.lastFrameTime;

    // Throttle to target FPS (30 FPS = ~33ms per frame)
    if (elapsed < this.frameInterval) {
      return;
    }

    this.lastFrameTime = now - (elapsed % this.frameInterval);

    // Update controls
    this.controls.update();

    // Rotate Earth
    this.earth.rotation.y += 0.0004;

    // Scale satellites based on camera distance
    const cameraDistance = this.camera.position.length();
    const scaleFactor = Math.max(1, cameraDistance / 300); // Scale up as distance increases
    this.satelliteManager.updateScale(scaleFactor);

    // Update satellites
    const delta = this.clock.getDelta();
    this.satelliteManager.update(delta);

    // Update stats
    this.stats.frame++;
    if (now >= this.stats.lastTime + 1000) {
      this.stats.fps = Math.round((this.stats.frame * 1000) / (now - this.stats.lastTime));
      this.stats.frame = 0;
      this.stats.lastTime = now;
      document.getElementById('fps')!.textContent = this.stats.fps.toString();
    }

    // Render
    this.renderer.render(this.scene, this.camera);
  };

  private onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Initialize the app
new SatelliteTracker();
