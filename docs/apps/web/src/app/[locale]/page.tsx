import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { FeaturedCard } from "@/components/featured-card";
import { Announcement } from "@/components/announcement";
import { buttonVariants } from "@/components/ui/button";
import { FlipWords } from "@/components/ui/flip-words";
import { Vortex } from "@/components/ui/vortex";
import { Icons } from "@/components/icons";
import { siteConfig } from "@/config/site";
import { Link } from "@/navigation";
import { cn } from "@/lib/utils";

import {
  PageHeader,
  PageActions,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";

import type { LocaleOptions } from "@/lib/opendocs/types/i18n";
import { CodeBlock } from "@/components/code-block";
import { DiscordLogoIcon } from "@radix-ui/react-icons";
import { Card } from "@/components/ui/card";

const quickStartCode = `import { Cleo } from "@cleotasks/core";
import { task, QueueClass } from "@cleotasks/core/decorators";
import { TaskPriority } from "@cleotasks/core/types/enums";

@QueueClass({
  defaultOptions: {
    priority: TaskPriority.HIGH,
    maxRetries: 3,
  },
})
class EmailService {
  @task({ id: "send-email" })
  async sendEmail(data: { to: string; template: string }) {
    // Your email logic here
  }
}`;

const faqItems = [
  {
    question: "How does Cleo compare to BullMQ?",
    answer: "Cleo builds on top of BullMQ to provide a more developer-friendly experience with TypeScript decorators, advanced group processing, and built-in monitoring. While BullMQ handles the core queue functionality, Cleo adds enterprise features and improved DX."
  },
  {
    question: "Can I use Cleo in production?",
    answer: "Yes! Cleo is production-ready and is built on battle-tested technologies like Redis and BullMQ. It includes features like dead letter queues, rate limiting, and comprehensive monitoring needed for production deployments."
  },
  {
    question: "How does group processing work?",
    answer: "Cleo's group processing allows you to organize related tasks and process them using different strategies (FIFO, Round Robin, Priority). This is perfect for handling user-specific tasks, tenant isolation, or resource allocation."
  },
  {
    question: "What's the performance like?",
    answer: "Cleo is highly performant, capable of processing thousands of tasks per second. Built on Redis, it provides low latency and high throughput. The exact performance depends on your task complexity and infrastructure."
  }
];

export const dynamicParams = true;

export default async function IndexPage({
  params,
}: {
  params: { locale: LocaleOptions };
}) {
  unstable_setRequestLocale(params.locale);
  const t = await getTranslations();

  return (
    <div className="container relative">
      <PageHeader>
        <Announcement
          title={
            "Introducing Cleo 1.0 - Production Ready!"
          }
          href="/blog/introducing-cleo-2.0"
        />

        <PageHeaderHeading>
          <FlipWords
            words={["Distributed", "Scalable", "Type-Safe"]}
            className="text-9xl -z-10"
          />

          <TextGenerateEffect
            words={
              t("site.heading") || "Task Queue System for TypeScript Developers"
            }
          />
        </PageHeaderHeading>

        <PageHeaderDescription>
          {t("site.description") ||
            "Build robust distributed task processing systems with type-safe decorators, advanced group processing strategies, and real-time monitoring. Perfect for microservices and event-driven architectures."}
        </PageHeaderDescription>

        <div className="mt-4 mb-8">
          <CodeBlock className="text-sm min-w-[600px]" code={quickStartCode} language="ts" />
        </div>

        <PageActions>
          <Link href="/docs" className={cn(buttonVariants())}>
            {t("site.buttons.get_started") || "Start Building"}
          </Link>

          <Link
            target="_blank"
            rel="noreferrer"
            href={siteConfig.links.github.url}
            title={siteConfig.links.github.label}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Icons.gitHub className="mr-2 size-4" />
            {siteConfig.links.github.label}
          </Link>
        </PageActions>

        <div className="fixed left-0 -top-40 size-full -z-10 overflow-hidden">
          <Vortex
            backgroundColor="transparent"
            className="flex size-full"
            rangeY={300}
            baseRadius={2}
            particleCount={20}
            rangeSpeed={1.5}
          />
        </div>
      </PageHeader>

      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
          <FeaturedCard
            icon="🔄"
            title="Type-Safe Task Processing"
            description="First-class TypeScript support with decorators. Get compile-time validation, autocomplete, and type inference for your tasks."
            code={`@task({ id: "process" })
async processData(
  data: ProcessInput
): Promise<Result> {
  // Type-safe processing
}`}
          />

          <FeaturedCard
            icon="👥"
            title="Advanced Group Processing"
            description="Organize tasks with sophisticated group processing strategies. Support for FIFO, Round Robin, and Priority-based execution."
            code={`queueManager.setGroupProcessingStrategy(
  GroupProcessingStrategy.PRIORITY
);`}
          />

          <FeaturedCard
            icon="📊"
            title="Real-time Event System"
            description="Build reactive systems with comprehensive event handling. Monitor task lifecycle, progress, and system health in real-time."
            code={`queueManager.onTaskEvent(
  ObserverEvent.STATUS_CHANGE,
  (taskId, status) => {
    // Handle status change
  }
);`}
          />

          <FeaturedCard
            icon="⚡"
            title="Redis-Powered Performance"
            description="Built on Redis and BullMQ for enterprise-grade reliability. Handles millions of tasks with automatic retries and error handling."
            code={`cleo.configure({
  redis: {
    cluster: true,
    nodes: [/*...*/],
  },
});`}


          />
        </div>

        <FeaturedCard
          icon="🚀"
          orientation="horizontal"
          title="Enterprise-Ready Features"
          description="Built for production with distributed locks, dead letter queues, rate limiting, and comprehensive monitoring. Scale from startup to enterprise with confidence."
          code={`@QueueClass({
  defaultOptions: {
    maxRetries: 3,
    rateLimiter: {
      max: 1000,
      duration: 1000,
    },
  },
})`}
        />
      </section>

      <section className="mt-16 flex flex-col gap-8">
        <h2 className="text-3xl font-bold tracking-tight">
          Getting Started is Easy
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <h3 className="font-bold mb-2">1. Install</h3>
            <CodeBlock
              language="bash"
              code="npm install @cleotasks/core"
              className="text-sm"
            />
          </Card>

          <Card className="p-6">
            <h3 className="font-bold mb-2">2. Configure</h3>
            <CodeBlock
              language="ts"
              code={`const cleo = Cleo.getInstance();
cleo.configure({
  redis: { /* config */ }
});`}
              className="text-sm"
            />
          </Card>

          <Card className="p-6">
            <h3 className="font-bold mb-2">3. Create Tasks</h3>
            <CodeBlock
              language="ts"
              code={`@task()
async processTask() {
  // Your task logic
}`}
              className="text-sm"
            />
          </Card>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-3xl font-bold tracking-tight mb-8">
          Frequently Asked Questions
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {faqItems.map((item, index) => (
            <Card key={index} className="p-6">
              <h3 className="font-bold mb-2">{item.question}</h3>
              <p className="text-muted-foreground text-sm">
                {item.answer}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-16 mb-16">
        <Card className="p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">
                Join Our Community
              </h2>
              <p className="text-muted-foreground">
                Get help, share your experience, and contribute to making Cleo better.
              </p>
            </div>

            <div className="flex gap-4">
              <Link
                href={siteConfig.links.discord.url}
                className={cn(buttonVariants({ variant: "default" }))}
              >
                <DiscordLogoIcon className="mr-2 size-4" />
                Join Discord
              </Link>

              <Link
                href={siteConfig.links.github.url}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <Icons.gitHub className="mr-2 size-4" />
                Star on GitHub
              </Link>
            </div>
          </div>
        </Card>
      </section>

      <section className="mt-16 mb-16">
        <Card className="p-8 bg-primary text-primary-foreground">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">
                Ready to Get Started?
              </h2>
              <p className="text-primary-foreground/80">
                Start building scalable task processing systems with Cleo today.
              </p>
            </div>

            <div className="flex gap-4">
              <Link
                href="/docs"
                className={cn(buttonVariants({
                  variant: "secondary",
                  size: "lg",
                }))}
              >
                Read the Docs
              </Link>

              <Link
                href="/docs/quick-start"
                className={cn(buttonVariants({
                  variant: "secondary",
                  size: "lg",
                }))}
              >
                Quick Start Guide
              </Link>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
