# Threejei Shelf Configurator

A TypeScript-based wall mounted shelf configurator system for designing custom shelving solutions.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Server
```bash
npm start
```
This builds the TypeScript files and starts a local server at `http://localhost:8000`

### 3. Open Application
Visit `http://localhost:8000/shelf.html` in your browser

## Development

### Available Scripts

- `npm start` - Build and start server
- `npm run build` - Build TypeScript once
- `npm run dev` - Watch TypeScript files for changes (run in separate terminal)
- `npm run serve` - Start local server only
- `npm test` - Run tests

### Development Workflow

1. **For active development** (recommended):
   ```bash
   # Terminal 1: Watch TypeScript compilation
   npm run dev

   # Terminal 2: Serve files
   npm run serve
   ```

2. **For quick testing**:
   ```bash
   npm start
   ```

### Alternative Server Options

If you don't want to use npm scripts:

**Python (most systems):**
```bash
python -m http.server 8000
```

**Node.js:**
```bash
npx http-server -p 8000
```

**VS Code Live Server:**
Install the "Live Server" extension and right-click `shelf.html`

## Project Structure

```
src/                 # TypeScript source files (edit these)
├── shelf-model.ts   # Core shelf model and logic
├── shelf_viz.ts     # 3D visualization with THREE.js
└── test-shelf-model.ts # Test suite

dist/                # Compiled JavaScript (auto-generated)
shelf.html           # Main application page
```

## Why a Local Server?

This project uses ES6 modules (`import`/`export`), which browsers block when loading from `file://` protocol for security reasons. A local HTTP server is required to serve the modules properly.