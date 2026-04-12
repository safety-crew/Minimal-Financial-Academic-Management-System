## Run Locally

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/safety-crew/Minimal-Financial-Academic-Management-System.git
   cd Minimal-Financial-Academic-Management-System
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

The application will start and be available at `http://localhost:3000` (or the configured port).

### Running with Electron

Electron allows you to run the application as a desktop application on Windows, macOS, and Linux.

#### Setup Electron

1. Install Electron as a dev dependency (if not already installed):
   ```bash
   npm install --save-dev electron
   ```

2. Install additional dev dependencies for building Electron apps:
   ```bash
   npm install --save-dev electron-builder
   ```

#### Start Electron Development Mode

1. Build the application:
   ```bash
   npm run build
   ```

2. Start Electron:
   ```bash
   npm run electron
   ```
   
   Or, if you have a custom Electron script configured:
   ```bash
   electron .
   ```

#### Package as Electron App

1. Build the distribution package:
   ```bash
   npm run electron-build
   ```
   
   This will create a packaged application in the `dist/` or `out/` directory depending on your configuration.

2. The packaged app can be distributed to users for installation on their systems.

### Troubleshooting

- **Port already in use**: If port 3000 is already in use, you can specify a different port:
  ```bash
  PORT=3001 npm run dev
  ```

- **Module not found errors**: Clear node_modules and reinstall:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

- **Electron won't start**: Ensure you have built the application first with `npm run build`