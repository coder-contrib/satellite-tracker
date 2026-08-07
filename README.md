# Satellite Tracker

A real-time 3D satellite tracking web application built with Three.js and TypeScript. Track thousands of satellites orbiting Earth with live position updates using official TLE data from CelesTrak.

![Satellite Tracker](https://img.shields.io/badge/status-active-brightgreen)

## Features

- 🌍 **Interactive 3D Earth Globe** - Smooth rotation and zoom controls
- 🛰️ **Real-time Satellite Tracking** - Live position updates using Two-Line Element (TLE) data
- 🎯 **Multiple Categories** - ISS, Starlink, GPS, Weather, OneWeb, Amateur Radio satellites
- 🔍 **Search & Filter** - Find specific satellites by name or filter by category
- 📡 **Orbital Visualization** - Display satellite orbits and trajectories
- 🏷️ **Smart Labels** - Toggle satellite name labels on/off
- 🖱️ **Hover Details** - Hover over satellites to see detailed orbital information
- 👆 **Click to Select** - Click satellites to select and show their orbit
- ⚡ **Optimized Performance** - 10 FPS target, optimized for 1 vCPU / 2GB containers

## Technology Stack

- **TypeScript** - Type-safe development
- **Three.js** - 3D graphics rendering
- **satellite.js** - SGP4/SDP4 satellite position calculations
- **Vite** - Fast build tool and dev server
- **CelesTrak API** - Official NORAD satellite data

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. (Optional) Configure port by creating `.env` file:
```bash
PORT=8080  # Default is 5173
```

3. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Deployment

### Docker (Recommended)
```bash
# Build and run with Docker Compose
docker-compose up -d

# Access at http://localhost:8080
```

### Manual Docker Build
```bash
docker build -t satellite-tracker .
docker run -d --name satellite-tracker --cpus="1.0" --memory="2g" -p 8080:80 satellite-tracker
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment guides including:
- Kubernetes deployment
- AWS ECS, Google Cloud Run, Azure Container Instances
- Resource configuration and scaling
- Monitoring and troubleshooting
- Production recommendations

## How It Works

1. **Data Source**: Fetches Two-Line Element (TLE) data from CelesTrak's public API
2. **Propagation**: Uses SGP4/SDP4 algorithms via satellite.js to calculate real-time positions
3. **Visualization**: Renders satellites as colored dots on a 3D Earth globe using Three.js
4. **Updates**: Updates satellite positions at 3.3 Hz (every 300ms) for optimal performance
5. **Rendering**: Targets 10 FPS for smooth animation with minimal resource usage

## Satellite Categories

- **ISS & Space Stations** - International Space Station and other crewed stations
- **Starlink** - SpaceX satellite constellation for internet
- **GPS Operational** - Global Positioning System satellites
- **Weather** - Weather monitoring satellites
- **OneWeb** - OneWeb satellite constellation
- **Amateur Radio** - Ham radio satellites

Total: ~5,000+ satellites

## Controls

- **Left Mouse** - Rotate view
- **Right Mouse / Scroll** - Zoom in/out
- **Hover over satellite** - View detailed information (altitude, inclination, period, etc.)
- **Click satellite** - Select and show orbital path
- **Search Box** - Find satellites by name
- **Category Filters** - Show/hide satellite groups
- **Show Orbits** - Display orbital path for selected satellite
- **Show Labels** - Toggle satellite name labels

## Data Attribution

Satellite data provided by [CelesTrak](https://celestrak.org) - NORAD Two-Line Element Sets

## Performance

Optimized for ultra-low resource containerized environments:
- **Target**: 1 vCPU / 2GB memory
- **Frame rate**: 10 FPS
- **Satellites**: ~5,000+ (all categories)
- **Stars**: 1,000 (reduced for performance)
- **Memory usage**: ~400-600 MB
- **CPU usage**: ~30-40% of single vCPU

See [PERFORMANCE_1vCPU.md](PERFORMANCE_1vCPU.md) for detailed optimization notes.

**Previous config** (2 vCPU / 4GB): See [PERFORMANCE.md](PERFORMANCE.md)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
