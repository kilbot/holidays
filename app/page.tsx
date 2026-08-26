import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  const mapboxReady = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">
          Southbound
        </h1>
        <Badge variant="secondary">walking skeleton</Badge>
      </div>
      <p className="text-muted-foreground">
        Valencia → Australia, Dec 2026 – Feb 2027. The planner is being built —
        this page proves the deploy pipeline. Layout direction: Globe stage.
      </p>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Pipeline check</CardTitle>
          <CardDescription>What this skeleton verifies</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div>Next.js App Router + Tailwind + shadcn/ui — rendering ✓</div>
          <div>
            Mapbox token wired — {mapboxReady ? "present ✓" : "missing ✗"}
          </div>
          <div>Deployed from main via Vercel ✓</div>
        </CardContent>
      </Card>
      <a
        className={buttonVariants()}
        href="https://github.com/kilbot/holidays/issues/1"
      >
        Follow the map
      </a>
    </main>
  );
}
