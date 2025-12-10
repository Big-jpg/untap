// /home/ubuntu/untap/server/seed.ts
import { getDb } from "./db";
import { services } from "../drizzle/schema";

interface SeedService {
  slug: string;
  displayName: string;
  category: string;
  homepageUrl: string;
  checkType: "http" | "tcp" | "icmp";
  checkTarget: string;
  expectedStatus: number;
  expectedBody?: string;
  timeoutMs: number;
  checkIntervalS: number;
  isActive: boolean;
  isCritical: boolean;
}

const seedServices: SeedService[] = [
  // AI Services
  {
    slug: "openai",
    displayName: "OpenAI",
    category: "AI",
    homepageUrl: "https://openai.com",
    checkType: "http",
    checkTarget: "https://api.openai.com/v1/models",
    expectedStatus: 401,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: true,
  },
  {
    slug: "anthropic",
    displayName: "Anthropic Claude",
    category: "AI",
    homepageUrl: "https://anthropic.com",
    checkType: "http",
    checkTarget: "https://api.anthropic.com/v1/messages",
    expectedStatus: 401,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: true,
  },
  {
    slug: "google-ai",
    displayName: "Google AI (Gemini)",
    category: "AI",
    homepageUrl: "https://ai.google.dev",
    checkType: "http",
    checkTarget: "https://generativelanguage.googleapis.com/v1/models",
    expectedStatus: 403,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: true,
  },
  {
    slug: "perplexity",
    displayName: "Perplexity AI",
    category: "AI",
    homepageUrl: "https://perplexity.ai",
    checkType: "http",
    checkTarget: "https://www.perplexity.ai",
    expectedStatus: 200,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: false,
  },
  {
    slug: "huggingface",
    displayName: "Hugging Face",
    category: "AI",
    homepageUrl: "https://huggingface.co",
    checkType: "http",
    checkTarget: "https://huggingface.co/api/models",
    expectedStatus: 200,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: false,
  },
  // Social Media
  {
    slug: "twitter",
    displayName: "X (Twitter)",
    category: "Social",
    homepageUrl: "https://x.com",
    checkType: "http",
    checkTarget: "https://x.com",
    expectedStatus: 200,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: true,
  },
  {
    slug: "reddit",
    displayName: "Reddit",
    category: "Social",
    homepageUrl: "https://reddit.com",
    checkType: "http",
    checkTarget: "https://www.reddit.com/.json",
    expectedStatus: 200,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: false,
  },
  {
    slug: "discord",
    displayName: "Discord",
    category: "Social",
    homepageUrl: "https://discord.com",
    checkType: "http",
    checkTarget: "https://discord.com/api/v10/gateway",
    expectedStatus: 200,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: true,
  },
  // Streaming & Gaming
  {
    slug: "twitch",
    displayName: "Twitch",
    category: "Streaming",
    homepageUrl: "https://twitch.tv",
    checkType: "http",
    checkTarget: "https://www.twitch.tv",
    expectedStatus: 200,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: false,
  },
  {
    slug: "youtube",
    displayName: "YouTube",
    category: "Streaming",
    homepageUrl: "https://youtube.com",
    checkType: "http",
    checkTarget: "https://www.youtube.com",
    expectedStatus: 200,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: true,
  },
  {
    slug: "spotify",
    displayName: "Spotify",
    category: "Streaming",
    homepageUrl: "https://spotify.com",
    checkType: "http",
    checkTarget: "https://api.spotify.com/v1/browse/categories",
    expectedStatus: 401,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: false,
  },
  // Developer Tools
  {
    slug: "github",
    displayName: "GitHub",
    category: "Developer",
    homepageUrl: "https://github.com",
    checkType: "http",
    checkTarget: "https://api.github.com",
    expectedStatus: 200,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: true,
  },
  {
    slug: "vercel",
    displayName: "Vercel",
    category: "Developer",
    homepageUrl: "https://vercel.com",
    checkType: "http",
    checkTarget: "https://api.vercel.com",
    expectedStatus: 401,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: false,
  },
  {
    slug: "npm",
    displayName: "npm Registry",
    category: "Developer",
    homepageUrl: "https://npmjs.com",
    checkType: "http",
    checkTarget: "https://registry.npmjs.org",
    expectedStatus: 200,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: false,
  },
  // Cloud Services
  {
    slug: "aws",
    displayName: "AWS",
    category: "Cloud",
    homepageUrl: "https://aws.amazon.com",
    checkType: "http",
    checkTarget: "https://health.aws.amazon.com",
    expectedStatus: 200,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: true,
  },
  {
    slug: "azure",
    displayName: "Microsoft Azure",
    category: "Cloud",
    homepageUrl: "https://azure.microsoft.com",
    checkType: "http",
    checkTarget: "https://status.azure.com/en-us/status",
    expectedStatus: 200,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: true,
  },
  {
    slug: "gcp",
    displayName: "Google Cloud",
    category: "Cloud",
    homepageUrl: "https://cloud.google.com",
    checkType: "http",
    checkTarget: "https://status.cloud.google.com",
    expectedStatus: 200,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: true,
  },
  // Productivity
  {
    slug: "slack",
    displayName: "Slack",
    category: "Productivity",
    homepageUrl: "https://slack.com",
    checkType: "http",
    checkTarget: "https://slack.com/api/api.test",
    expectedStatus: 200,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: true,
  },
  {
    slug: "notion",
    displayName: "Notion",
    category: "Productivity",
    homepageUrl: "https://notion.so",
    checkType: "http",
    checkTarget: "https://www.notion.so",
    expectedStatus: 200,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: false,
  },
  {
    slug: "linear",
    displayName: "Linear",
    category: "Productivity",
    homepageUrl: "https://linear.app",
    checkType: "http",
    checkTarget: "https://linear.app",
    expectedStatus: 200,
    timeoutMs: 10000,
    checkIntervalS: 60,
    isActive: true,
    isCritical: false,
  },
];

export async function seedDatabase(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[Seed] Database not available");
    return;
  }

  console.log("[Seed] Starting database seed...");

  for (const service of seedServices) {
    try {
      await db.insert(services).values(service).onDuplicateKeyUpdate({
        set: {
          displayName: service.displayName,
          category: service.category,
          homepageUrl: service.homepageUrl,
          checkType: service.checkType,
          checkTarget: service.checkTarget,
          expectedStatus: service.expectedStatus,
          expectedBody: service.expectedBody || null,
          timeoutMs: service.timeoutMs,
          checkIntervalS: service.checkIntervalS,
          isActive: service.isActive,
          isCritical: service.isCritical,
        },
      });
      console.log(`[Seed] Upserted service: ${service.displayName}`);
    } catch (error) {
      console.error(`[Seed] Failed to upsert ${service.displayName}:`, error);
    }
  }

  console.log("[Seed] Database seed complete!");
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
