# untap - Service Status Monitoring Platform TODO

## Database & Schema
- [x] Create services table with check configuration (HTTP/TCP/ICMP)
- [x] Create check_results table (append-only) with proper indexes
- [x] Create incidents table with status enum (open/resolved)
- [x] Push database migrations

## Backend Features
- [x] Implement database query helpers for services, check_results, incidents
- [x] Create tRPC procedures for fetching service status
- [x] Build background worker for health checks (HTTP/TCP/ICMP)
- [x] Implement incident detection engine with rolling failure rate
- [x] Use hysteresis thresholds (60% to open, 20% to close)
- [x] Create seed script for initial services (OpenAI, Claude, Grok, Twitter, Reddit, etc.)

## API Endpoints
- [x] GET /api/services - status summary for all services
- [x] GET /api/services/[slug]/status - detailed service view with checks and incidents

## Frontend Pages
- [x] Landing page with service grid showing status pills (green/amber/red)
- [x] Recent incidents sidebar on landing page
- [x] Service detail page with 24h sparkline chart
- [x] Incident timeline on detail page
- [x] Service metadata display

## Notifications & Analytics
- [x] Send owner notifications when critical services go down
- [x] Notify on incident detection
- [x] Export check_results data for analytics
- [x] Export incident data for historical reporting

## Scheduler
- [x] Implement scheduler to trigger checks every 60 seconds

## Styling
- [x] Elegant and polished visual design throughout
- [x] Status colors: green (ok), amber (degraded), red (down)
