// /home/ubuntu/untap/client/src/pages/Home.tsx
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink,
  Zap,
  Shield,
  BarChart3
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type ServiceStatus = "ok" | "degraded" | "down";

interface ServiceCardProps {
  slug: string;
  displayName: string;
  category: string | null;
  currentStatus: ServiceStatus;
  lastCheck: Date | null;
  latencyMs: number | null;
  openIncident: {
    id: number;
    startedAt: Date;
    failureRate: number | null;
  } | null;
}

function StatusIcon({ status }: { status: ServiceStatus }) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="w-4 h-4" />;
    case "degraded":
      return <AlertTriangle className="w-4 h-4" />;
    case "down":
      return <XCircle className="w-4 h-4" />;
  }
}

function StatusPill({ status }: { status: ServiceStatus }) {
  const labels: Record<ServiceStatus, string> = {
    ok: "Operational",
    degraded: "Degraded",
    down: "Down",
  };

  return (
    <span className={`status-pill status-${status}`}>
      <StatusIcon status={status} />
      {labels[status]}
    </span>
  );
}

function ServiceCard({ slug, displayName, category, currentStatus, lastCheck, latencyMs, openIncident }: ServiceCardProps) {
  return (
    <Link href={`/service/${slug}`}>
      <Card className="service-card h-full cursor-pointer border-border/50 hover:border-border bg-card/50 backdrop-blur-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{displayName}</h3>
              {category && (
                <span className="text-xs text-muted-foreground">{category}</span>
              )}
            </div>
            <StatusPill status={currentStatus} />
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {lastCheck ? (
                <span>{formatDistanceToNow(new Date(lastCheck), { addSuffix: true })}</span>
              ) : (
                <span>No checks yet</span>
              )}
            </div>
            {latencyMs !== null && currentStatus === "ok" && (
              <div className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                <span>{latencyMs}ms</span>
              </div>
            )}
          </div>

          {openIncident && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="flex items-center gap-1.5 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-status-down" />
                <span className="text-muted-foreground">
                  Incident started {formatDistanceToNow(new Date(openIncident.startedAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function ServiceCardSkeleton() {
  return (
    <Card className="h-full border-border/50 bg-card/50">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <Skeleton className="h-5 w-32 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

interface IncidentItemProps {
  serviceName: string | null;
  serviceSlug: string | null;
  startedAt: Date;
  endedAt: Date | null;
  status: "open" | "resolved";
  summary: string | null;
}

function IncidentItem({ serviceName, serviceSlug, startedAt, endedAt, status, summary }: IncidentItemProps) {
  const isOpen = status === "open";
  
  return (
    <div className="incident-timeline py-3 first:pt-0 last:pb-0">
      <div className={`incident-dot ${isOpen ? 'incident-dot-open' : 'incident-dot-resolved'}`} />
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {serviceSlug ? (
            <Link href={`/service/${serviceSlug}`} className="font-medium text-sm hover:text-primary transition-colors">
              {serviceName}
            </Link>
          ) : (
            <span className="font-medium text-sm">{serviceName || "Unknown Service"}</span>
          )}
          <Badge variant={isOpen ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0">
            {isOpen ? "Ongoing" : "Resolved"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {summary || (isOpen ? "Service experiencing issues" : "Issue resolved")}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>
            {formatDistanceToNow(new Date(startedAt), { addSuffix: true })}
            {endedAt && ` • Duration: ${formatDistanceToNow(new Date(startedAt), { includeSeconds: true })}`}
          </span>
        </div>
      </div>
    </div>
  );
}

function IncidentSkeleton() {
  return (
    <div className="incident-timeline py-3">
      <div className="incident-dot bg-muted" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

function StatsCard({ icon: Icon, label, value, subtext }: { icon: typeof Activity; label: string; value: string | number; subtext?: string }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border/50">
      <div className="p-2.5 rounded-lg bg-primary/10">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: services, isLoading: servicesLoading } = trpc.services.list.useQuery();
  const { data: recentIncidents, isLoading: incidentsLoading } = trpc.incidents.recent.useQuery({ limit: 8 });
  const { data: openIncidents } = trpc.incidents.open.useQuery();

  const totalServices = services?.length || 0;
  const operationalServices = services?.filter(s => s.currentStatus === "ok").length || 0;
  const activeIncidents = openIncidents?.length || 0;

  // Group services by category
  const servicesByCategory = services?.reduce((acc, service) => {
    const category = service.category || "Other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, typeof services>) || {};

  const categories = Object.keys(servicesByCategory).sort();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">untap</h1>
                <p className="text-xs text-muted-foreground">Service Status Monitor</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeIncidents > 0 ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {activeIncidents} Active {activeIncidents === 1 ? 'Incident' : 'Incidents'}
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1 bg-status-ok/20 text-status-ok border-0">
                  <CheckCircle2 className="w-3 h-3" />
                  All Systems Operational
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b border-border/50 bg-gradient-to-b from-card/50 to-background">
        <div className="container py-12">
          <div className="max-w-2xl mb-10">
            <h2 className="text-3xl font-bold text-foreground mb-3">
              Real-time Service Monitoring
            </h2>
            <p className="text-muted-foreground">
              Independent synthetic monitoring for the services you depend on. 
              We check every 60 seconds so you know immediately when something goes wrong.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard 
              icon={BarChart3} 
              label="Services Monitored" 
              value={totalServices} 
            />
            <StatsCard 
              icon={Shield} 
              label="Operational" 
              value={`${totalServices > 0 ? Math.round((operationalServices / totalServices) * 100) : 0}%`} 
            />
            <StatsCard 
              icon={Zap} 
              label="Check Interval" 
              value="60s" 
            />
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Services Grid */}
          <div className="lg:col-span-3">
            {servicesLoading ? (
              <div className="space-y-8">
                {[1, 2].map((i) => (
                  <div key={i}>
                    <Skeleton className="h-6 w-24 mb-4" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {[1, 2, 3].map((j) => (
                        <ServiceCardSkeleton key={j} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {categories.map((category) => (
                  <div key={category}>
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                      {category}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {servicesByCategory[category]?.map((service) => (
                        <ServiceCard
                          key={service.slug}
                          slug={service.slug}
                          displayName={service.displayName}
                          category={service.category}
                          currentStatus={service.currentStatus}
                          lastCheck={service.lastCheck}
                          latencyMs={service.latencyMs}
                          openIncident={service.openIncident}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Incidents Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24">
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold text-foreground">Recent Incidents</h3>
                  </div>

                  {incidentsLoading ? (
                    <div className="space-y-0">
                      {[1, 2, 3].map((i) => (
                        <IncidentSkeleton key={i} />
                      ))}
                    </div>
                  ) : recentIncidents && recentIncidents.length > 0 ? (
                    <div className="space-y-0">
                      {recentIncidents.map((incident) => (
                        <IncidentItem
                          key={incident.id}
                          serviceName={incident.serviceName}
                          serviceSlug={incident.serviceSlug}
                          startedAt={incident.startedAt}
                          endedAt={incident.endedAt}
                          status={incident.status}
                          summary={incident.summary}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle2 className="w-10 h-10 text-status-ok mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No recent incidents</p>
                      <p className="text-xs text-muted-foreground mt-1">All services running smoothly</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/30">
        <div className="container py-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} untap. Independent service monitoring.</p>
            <div className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" />
              <span>Checks every 60 seconds</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
