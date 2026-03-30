# MATF Dashboard - React Version

This is a React.js recreation of the Multi-Agent Testing Framework dashboard, maintaining the exact look, feel, and functionality of the original vanilla JavaScript version.

## Features

- ✅ **Identical UI/UX** - Exact styling and layout from original dashboard
- ✅ **Theme Toggle** - Light/Dark theme support with localStorage persistence
- ✅ **Density Toggle** - Compact/Comfortable view modes
- ✅ **Live Updates** - EventSource (SSE) integration for real-time runtime status
- ✅ **Adaptive Refresh** - Exponential backoff on failures
- ✅ **Authentication** - JWT token support with modal prompt
- ✅ **Debug Log** - Network diagnostics and request tracking
- ✅ **Full Feature Parity**:
  - Repository watchers management (add, filter, run, enable/disable)
  - Test executions list with status badges
  - Reports list with download links
  - Test cases display
  - Live queue statistics
  - Running/Queued executions tracking
  - Queue reset functionality

## Setup & Development

### Install Dependencies

```bash
cd public-react
npm install
```

### Development Server

```bash
npm run dev
```

This will start Vite dev server on `http://localhost:5173` with proxy to API on `http://localhost:3000`.

### Build for Production

```bash
npm run build
```

Output will be in `../public-react-build/` directory.

### Lint

```bash
npm run lint
```

## Project Structure

```
public-react/
├── src/
│   ├── components/           # React components
│   │   ├── Header.jsx       # Main header with theme/density toggles
│   │   ├── StatsBar.jsx     # Stats summary bar
│   │   ├── WatchForm.jsx    # Form to add GitHub watchers
│   │   ├── WatchersSection.jsx  # Watchers list with filters
│   │   ├── ExecutionsList.jsx   # Test executions
│   │   ├── ReportsList.jsx      # Reports list
│   │   ├── TestsList.jsx        # Test cases
│   │   ├── LiveStatus.jsx       # Live runtime stats
│   │   ├── DebugLog.jsx         # Debug console
│   │   ├── Footer.jsx           # Footer links
│   │   └── TokenModal.jsx       # Auth token modal
│   ├── hooks/
│   │   ├── useDashboard.js      # Dashboard state & auto-refresh
│   │   └── useEventSource.js    # SSE connection hook
│   ├── utils/
│   │   └── api.js               # API wrapper, theme, storage utils
│   ├── App.jsx                  # Main app component
│   ├── App.css                  # Styles (exact copy from original)
│   └── main.jsx                 # React entry point
├── public/
│   └── index.html               # HTML template
├── package.json
├── vite.config.js               # Vite configuration
└── .eslintrc.cjs                # ESLint config
```

## Key Differences from Original

While the UI and behavior are identical, the implementation uses modern React patterns:

1. **State Management**: `useState` + `useCallback` replaces global variables
2. **Effects**: `useEffect` replaces manual DOM listeners and intervals
3. **SSE Integration**: Custom `useEventSource` hook for runtime stream
4. **Auto-refresh**: Adaptive polling with exponential backoff in `useDashboard` hook
5. **Component Split**: Modular components instead of monolithic script

## API Integration

The dashboard expects the MATF API to be running on `http://localhost:3000` (proxied via Vite in dev mode).

**Key Endpoints Used**:
- `GET /api/v1/gui/dashboard` - Main dashboard data
- `GET /api/v1/gui/watchers` - Repository watchers
- `POST /api/v1/gui/watchers` - Add watcher
- `PATCH /api/v1/gui/watchers/:id` - Update watcher
- `POST /api/v1/gui/watchers/:id/run` - Trigger watcher
- `GET /api/v1/gui/runtime` - Runtime statistics
- `GET /api/v1/gui/runtime/stream` - SSE stream for live updates
- `POST /api/v1/gui/runtime/reset-queues` - Clear queues

## Deployment

To deploy the React build:

1. Build the project: `npm run build`
2. Copy contents of `../public-react-build/` to your web server
3. Configure server to proxy `/api` requests to the MATF API
4. Ensure proper CORS settings if API is on different origin

## Browser Support

- Modern browsers with ES2020+ support
- EventSource (SSE) support required for live updates
- localStorage for theme/density/token persistence

## License

Same as parent MATF project - MIT
