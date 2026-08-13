import { useState } from "react";
import { useCreateShare } from "@workspace/api-client-react";
import type { Finding } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Share2, Copy, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShareButtonProps {
  module: string;
  title: string;
  trustScore?: number | null;
  riskScore: number;
  aiSummary?: string | null;
  findings: Finding[];
  posture?: unknown;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ShareButton({
  module,
  title,
  trustScore,
  riskScore,
  aiSummary,
  findings,
  posture,
  variant = "outline",
  size = "sm",
}: ShareButtonProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const createShare = useCreateShare();

  function handleShare() {
    createShare.mutate(
      {
        data: {
          module,
          title,
          trustScore: trustScore ?? null,
          riskScore,
          aiSummary: aiSummary ?? null,
          findings,
          posture: posture ?? null,
        },
      },
      {
        onSuccess(data) {
          setShareUrl(data.shareUrl);
          setOpen(true);
        },
        onError() {
          toast({
            title: "Could not create share link",
            description: "Try again in a moment.",
            variant: "destructive",
          });
        },
      },
    );
  }

  function copyUrl() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleShare}
        disabled={createShare.isPending}
        title="Share a one-page summary of this scan"
      >
        {createShare.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Share2 className="w-3.5 h-3.5" />
        )}
        <span className="ml-1.5">Share</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share this scan summary</DialogTitle>
            <DialogDescription>
              This link shows a read-only one-page summary to anyone who has it.
              No account needed. Valid for 90 days.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-2">
            <input
              readOnly
              value={shareUrl ?? ""}
              className="flex-1 text-sm px-3 py-2 border rounded-md bg-muted font-mono truncate"
            />
            <Button size="sm" onClick={copyUrl} variant="outline">
              {copied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            The link is ready. Send it to whoever needs to see this result.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
