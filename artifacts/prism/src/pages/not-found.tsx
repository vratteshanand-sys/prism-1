import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [_, setLocation] = useLocation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] w-full bg-noise space-y-4">
      <div className="text-8xl font-mono font-bold text-primary">404</div>
      <h1 className="text-2xl font-bold tracking-tight">Signal Lost</h1>
      <p className="text-muted-foreground max-w-md text-center">
        The sector you're trying to reach does not exist in our telemetry. Return to base.
      </p>
      <Button onClick={() => setLocation("/")} className="mt-4 font-bold tracking-wide">
        Return to Command Center
      </Button>
    </div>
  );
}
