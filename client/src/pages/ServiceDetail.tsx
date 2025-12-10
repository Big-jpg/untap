// /home/ubuntu/untap/client/src/pages/ServiceDetail.tsx
import { trpc } from "@/lib/trpc";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  Server,
  XCircle,
  Zap,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

type ServiceStatus = "ok" | "degraded" | "down";
type TimeWindow = "1h" | "6h" | "12h" | "24h" | "7d";

function StatusIcon({ status }: { status: ServiceStatus }) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="w-5 h-5" />;
    case "degraded":
      return <AlertTriangle className="w-5 h-5" />;
    case "down":
      return <XCircle className="w-5 h-5" />;
  }
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  const variants: Record<ServiceStatus, { label: string; className: string }> = {
    ok: { label: "Operational", className: "bg-status-ok/20 text-status-ok border-status-ok/30" },
    degraded: { label: "Degraded", className: "bg-status-degraded/20 text-status-degraded border-status-degraded/30" },
    down: { label: "Down", className: "bg-status-down/20 text-status-down border-status-down/30" },
  };

  const { label, className } = variants[status];

  return (
    <Badge variant="outline" className={`gap-1.5 px-3 py-1.5 text-sm font-medium ${className}`}>
      <StatusIcon status={status} />
      {label}
    </Badge>
  );
}

interface ChartDataPoint {
  time: number;
  latency: number | null;
  success: boolean;
  formattedTime: string;
}

function LatencyChart({ data, incidents }: { data: ChartDataPoint[]; incidents: Array<{ startedAt: Date; endedAt: Date | null }> }) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      ...point,
      latency: point.success ? point.latency : null,
      error: !point.success ? 1 : null,
    }));
  }, [data]);

  const maxLatency = useMemo(() => {
    const latencies = data.filter(d => d.latency !== null).map(d => d.latency as number);
    return latencies.length > 0 ? Math.max(...latencies) * 1.2 : 1000;
  }, [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-medium text-foreground mb-1">{point.formattedTime}</p>
          {point.success ? (
            <div className="flex items-center gap-2 text-status-ok">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{point.latency}ms</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-status-down">
              <XCircle className="w-3.5 h-3.5" />
              <span>Failed</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.65 0.2 250)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="oklch(0.65 0.2 250)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.62 0.25 25)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="oklch(0.62 0.25 25)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.1)" vertical={false} />
          <XAxis
            dataKey="formattedTime"
            tick={{ fontSize: 11, fill: "oklch(0.5 0.01 280)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            domain={[0, maxLatency]}
            tick={{ fontSize: 11, fill: "oklch(0.5 0.01 280)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}ms`}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="latency"
            stroke="oklch(0.65 0.2 250)"
            strokeWidth={2}
            fill="url(#latencyGradient)"
            connectNulls={false}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function UptimeBar({ checks }: { checks: Array<{ success: boolean; t: Date }> }) {
  // Group checks into time buckets for visualization
  const buckets = useMemo(() => {
    if (checks.length === 0) return [];
    
    const bucketCount = Math.min(90, checks.length);
    const bucketSize = Math.ceil(checks.length / bucketCount);
    const result: Array<{ success: number; total: number }> = [];
    
    for (let i = 0; i < checks.length; i += bucketSize) {
      const bucket = checks.slice(i, i + bucketSize);
      const successCount = bucket.filter(c => c.success).length;
      result.push({ success: successCount, total: bucket.length });
    }
    
    return result;
  }, [checks]);

  return (
    <div className="flex gap-0.5 h-8">
      {buckets.map((bucket, i) => {
        const ratio = bucket.success / bucket.total;
        let colorClass = "bg-status-ok";
        if (ratio < 0.5) colorClass = "bg-status-down";
        else if (ratio < 1) colorClass = "bg-status-degraded";
        
        return (
          <div
            key={i}
            className={`flex-1 rounded-sm ${colorClass} transition-all hover:opacity-80`}
            title={`${Math.round(ratio * 100)}% success`}
          />
        );
      })}
    </div>
  );
}

interface IncidentTimelineProps {
  incidents: Array<{
    id: number;
    startedAt: Date;
    endedAt: Date | null;
    status: "open" | "resolved";
    failureRate: number | null;
    summary: string | null;
  }>;
}

function IncidentTimeline({ incidents }: IncidentTimelineProps) {
  if (incidents.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="w-12 h-12 text-status-ok mx-auto mb-4" />
        <p className="text-muted-foreground">No incidents recorded</p>
        <p className="text-sm text-muted-foreground mt-1">This service has been running smoothly</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {incidents.map((incident) => {
        const isOpen = incident.status === "open";
        const duration = incident.endedAt
          ? formatDistanceToNow(new Date(incident.startedAt), { includeSeconds: true })
          : null;

        return (
          <div
            key={incident.id}
            className={`relative pl-6 pb-4 border-l-2 ${
              isOpen ? "border-status-down" : "border-border"
            }`}
          >
            <div
              className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-background ${
                isOpen ? "bg-status-down" : "bg-status-ok"
              }`}
            />
            <div className="bg-card/50 border border-border/50 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <Badge
                    variant={isOpen ? "destructive" : "secondary"}
                    className="mb-2"
                  >
                    {isOpen ? "Ongoing" : "Resolved"}
                  </Badge>
                  <p className="text-sm text-foreground">
                    {incident.summary || (isOpen ? "Service experiencing issues" : "Issue resolved")}
                  </p>
                </div>
                {incident.failureRate !== null && (
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">{incident.failureRate}%</p>
                    <p className="text-xs text-muted-foreground">Failure Rate</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Started {format(new Date(incident.startedAt), "MMM d, yyyy HH:mm")}</span>
                </div>
                {incident.endedAt && (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Resolved {format(new Date(incident.endedAt), "MMM d, yyyy HH:mm")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ServiceDetail() {
  const params = useParams<{ slug: string }>();
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("24h");

  const { data, isLoading, error } = trpc.services.getBySlug.useQuery({
    slug: params.slug || "",
    window: timeWindow,
  });

  const chartData = useMemo(() => {
    if (!data?.checks) return [];
    return data.checks.map((check) => ({
      time: new Date(check.t).getTime(),
      latency: check.latencyMs,
      success: check.success,
      formattedTime: format(new Date(check.t), "HH:mm"),
    }));
  }, [data?.checks]);

  const uptimePercentage = useMemo(() => {
    if (!data?.checks || data.checks.length === 0) return 100;
    const successful = data.checks.filter((c) => c.success).length;
    return Math.round((successful / data.checks.length) * 100 * 10) / 10;
  }, [data?.checks]);

  const avgLatency = useMemo(() => {
    if (!data?.checks) return null;
    const successfulChecks = data.checks.filter((c) => c.success && c.latencyMs);
    if (successfulChecks.length === 0) return null;
    const sum = successfulChecks.reduce((acc, c) => acc + (c.latencyMs || 0), 0);
    return Math.round(sum / successfulChecks.length);
  }, [data?.checks]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
          <div className="container py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container py-8">
          <Skeleton className="h-64 w-full mb-8" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-status-down mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Service Not Found</h1>
          <p className="text-muted-foreground mb-6">The service you're looking for doesn't exist.</p>
          <Link href="/">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { service, currentStatus, checks, incidents } = data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-foreground truncate">{service.displayName}</h1>
                <StatusBadge status={currentStatus} />
              </div>
              {service.category && (
                <p className="text-sm text-muted-foreground">{service.category}</p>
              )}
            </div>
            {service.homepageUrl && (
              <a
                href={service.homepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Visit Site
                </Button>
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-status-ok/10">
                  <CheckCircle2 className="w-5 h-5 text-status-ok" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{uptimePercentage}%</p>
                  <p className="text-xs text-muted-foreground">Uptime ({timeWindow})</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {avgLatency !== null ? `${avgLatency}ms` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Response Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-muted">
                  <Activity className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{checks.length}</p>
                  <p className="text-xs text-muted-foreground">Total Checks ({timeWindow})</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Time Window Selector */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Response Time</h2>
          <Tabs value={timeWindow} onValueChange={(v) => setTimeWindow(v as TimeWindow)}>
            <TabsList>
              <TabsTrigger value="1h">1h</TabsTrigger>
              <TabsTrigger value="6h">6h</TabsTrigger>
              <TabsTrigger value="12h">12h</TabsTrigger>
              <TabsTrigger value="24h">24h</TabsTrigger>
              <TabsTrigger value="7d">7d</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Latency Chart */}
        <Card className="border-border/50 bg-card/50 mb-8">
          <CardContent className="p-6">
            {checks.length > 0 ? (
              <>
                <LatencyChart data={chartData} incidents={incidents} />
                <div className="mt-6">
                  <p className="text-xs text-muted-foreground mb-2">Uptime History</p>
                  <UptimeBar checks={checks} />
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <Activity className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground">No check data available</p>
                  <p className="text-sm text-muted-foreground mt-1">Checks will appear here once monitoring begins</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Service Info & Incidents */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Service Metadata */}
          <Card className="border-border/50 bg-card/50 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4 h-4" />
                Monitoring Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Check Type</p>
                <Badge variant="secondary" className="uppercase">
                  {service.checkType}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Target Endpoint</p>
                <p className="text-sm text-foreground font-mono break-all bg-muted/50 p-2 rounded">
                  {service.checkTarget}
                </p>
              </div>
              {service.checkType === "http" && service.expectedStatus && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Expected Status</p>
                  <Badge variant="outline">{service.expectedStatus}</Badge>
                </div>
              )}
              {service.isCritical && (
                <div className="flex items-center gap-2 text-sm text-status-degraded">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Critical Service</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Incident Timeline */}
          <Card className="border-border/50 bg-card/50 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Incident History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IncidentTimeline incidents={incidents} />
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/30 mt-12">
        <div className="container py-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              ← Back to all services
            </Link>
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
