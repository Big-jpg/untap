# untap

**Real-time Service Status Monitoring Platform**

untap is an independent synthetic monitoring service that checks the health of various services every 60 seconds. It provides real-time status updates, incident detection with hysteresis-based thresholds, and a beautiful dark-themed dashboard.

![untap Dashboard](https://img.shields.io/badge/status-operational-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Synthetic Health Checks** - HTTP, TCP, and ICMP monitoring for 20+ services
- **60-Second Intervals** - Frequent checks ensure you know immediately when something goes wrong
- **Incident Detection** - Rolling failure rate with hysteresis (60% to open, 20% to close)
- **Elegant Dark UI** - Beautiful, responsive dashboard with status pills and sparkline charts
- **Service Categories** - Organized by AI, Social, Streaming, Developer, Cloud, and Productivity
- **Incident Timeline** - Historical view of all incidents per service
- **Owner Notifications** - Automatic alerts when critical services go down
- **Data Export** - Export check results and incidents for external analytics

## Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS 4 + Recharts
- **Backend**: Express + tRPC 11 + Node.js
- **Database**: MySQL/TiDB with Drizzle ORM
- **Authentication**: Manus OAuth (optional)

## Project Structure

```
untap/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components (Home, ServiceDetail)
│   │   ├── lib/            # tRPC client setup
│   │   └── App.tsx         # Main app with routing
├── server/                 # Backend Express + tRPC
│   ├── routers.ts          # tRPC API endpoints
│   ├── db.ts               # Database query helpers
│   ├── worker.ts           # Health check worker
│   ├── seed.ts             # Initial services data
│   └── _core/              # Framework internals
├── drizzle/                # Database schema and migrations
│   └── schema.ts           # Table definitions
└── shared/                 # Shared types and constants
```

## Database Schema

### Services Table
Stores configuration for monitored services including check type, target URL, expected status, and timeout settings.

### Check Results Table (Append-Only)
Immutable log of all health check results with timestamp, latency, HTTP status, and error information.

### Incidents Table
Tracks outages derived from multiple failing checks, with start/end times, failure rates, and resolution status.

## Deployment

### Prerequisites

- Node.js 18+ 
- pnpm 8+
- MySQL 8+ or TiDB database

### Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=mysql://user:password@host:port/database

# Authentication (optional - for admin features)
JWT_SECRET=your-jwt-secret-here
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://your-oauth-server
VITE_OAUTH_PORTAL_URL=https://your-oauth-portal

# Owner info (for notifications)
OWNER_OPEN_ID=owner-id
OWNER_NAME=Owner Name
```

### Local Development

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm db:push

# Start development server
pnpm dev
```

The app will be available at `http://localhost:3000`

### Production Build

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

### Deploy to Vercel

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy with the following settings:
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`
   - **Install Command**: `pnpm install`

### Deploy to Railway

1. Create a new project on Railway
2. Connect your GitHub repository
3. Add a MySQL database service
4. Set environment variables
5. Railway will auto-detect and deploy

### Deploy to Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build
RUN pnpm build

# Expose port
EXPOSE 3000

# Start
CMD ["pnpm", "start"]
```

Build and run:

```bash
docker build -t untap .
docker run -p 3000:3000 --env-file .env untap
```

## Configuration

### Adding New Services

Services are seeded from `server/seed.ts`. To add a new service:

```typescript
{
  slug: "my-service",
  displayName: "My Service",
  category: "Category",
  homepageUrl: "https://myservice.com",
  checkType: "http",  // "http" | "tcp" | "icmp"
  checkTarget: "https://api.myservice.com/health",
  expectedStatus: 200,
  timeoutMs: 5000,
  checkIntervalS: 60,
  isActive: true,
  isCritical: false,  // Set to true for owner notifications
}
```

### Incident Detection Thresholds

The incident detection uses rolling failure rate with hysteresis:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `THRESHOLD_OPEN` | 0.6 (60%) | Failure rate to open an incident |
| `THRESHOLD_CLOSE` | 0.2 (20%) | Failure rate to close an incident |
| `MIN_SAMPLES` | 5 | Minimum checks before evaluation |
| `WINDOW_MINUTES` | 5 | Rolling window for evaluation |

These can be modified in `server/worker.ts`.

## API Endpoints

### Public Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/trpc/services.list` | List all services with current status |
| `GET /api/trpc/services.getBySlug` | Get detailed service info with checks and incidents |
| `GET /api/trpc/incidents.recent` | Get recent incidents across all services |
| `GET /api/trpc/incidents.open` | Get currently open incidents |

### Admin Endpoints (Protected)

| Endpoint | Description |
|----------|-------------|
| `POST /api/trpc/admin.runChecks` | Trigger manual health check run |
| `POST /api/trpc/admin.startWorker` | Start the background worker |
| `POST /api/trpc/admin.stopWorker` | Stop the background worker |
| `POST /api/trpc/admin.seedDatabase` | Re-seed the database |

### Export Endpoints (Protected)

| Endpoint | Description |
|----------|-------------|
| `GET /api/trpc/export.checkResults` | Export check results for analytics |
| `GET /api/trpc/export.incidents` | Export incidents for reporting |

## Health Check Worker

The worker runs automatically on server startup and performs health checks every 60 seconds:

1. Fetches all active services from the database
2. Executes HTTP/TCP/ICMP checks based on service configuration
3. Writes results to the `check_results` table (append-only)
4. Evaluates incident status using rolling failure rate
5. Opens/closes incidents based on hysteresis thresholds
6. Sends notifications for critical service outages

## Status Derivation

Service status is derived from recent check results:

| Status | Failure Rate | Color |
|--------|--------------|-------|
| Operational | < 20% | Green |
| Degraded | 20% - 60% | Amber |
| Down | ≥ 60% | Red |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [tRPC](https://trpc.io/) for end-to-end typesafe APIs
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Charts powered by [Recharts](https://recharts.org/)
