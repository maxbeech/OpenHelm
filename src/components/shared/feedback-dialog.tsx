import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { submitUserFeedback } from "@/lib/sentry";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type FeedbackType = "feedback" | "bug-report";

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [type, setType] = useState<FeedbackType>("feedback");
  const [message, setMessage] = useState("");
  const [includeAnonymousData, setIncludeAnonymousData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setType("feedback");
      setMessage("");
      setIncludeAnonymousData(true);
      setSubmitting(false);
      setDone(false);
    }
  }, [open]);

  const isBugReport = type === "bug-report";
  const canSubmit = isBugReport || message.trim().length > 0;

  async function handleSubmit() {
    setSubmitting(true);
    submitUserFeedback(type, message, includeAnonymousData);
    setSubmitting(false);
    setDone(true);
    setTimeout(() => onOpenChange(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Feedback</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Thank you for your feedback!
          </div>
        ) : (
          <>
            {/* Type toggle */}
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {(["feedback", "bug-report"] as FeedbackType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    type === t
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "feedback" ? "Feedback" : "Bug Report"}
                </button>
              ))}
            </div>

            {/* Message */}
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                isBugReport
                  ? "Describe what happened (optional)"
                  : "What's on your mind?"
              }
              rows={4}
              className="resize-none"
            />

            {/* Anonymous data checkbox */}
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="anon-data"
                checked={includeAnonymousData}
                onCheckedChange={(v) => setIncludeAnonymousData(!!v)}
              />
              <div className="grid gap-0.5">
                <Label htmlFor="anon-data" className="text-sm leading-none">
                  Include anonymous app data
                </Label>
                <p className="text-xs text-muted-foreground">
                  Helps us understand context without identifying you
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-1.5">
                    <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Submitting…
                  </span>
                ) : (
                  "Submit"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
