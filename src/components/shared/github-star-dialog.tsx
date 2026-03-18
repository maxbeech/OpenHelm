import { open as openUrl } from "@tauri-apps/plugin-shell";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

const GITHUB_URL = "https://github.com/maxbeech/openhelm";
const STORAGE_KEY_DISMISSED = "gh-star-dismissed";
const STORAGE_KEY_REMIND_AT = "gh-star-remind-at";
const REMIND_DELAY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function getStarBannerVisible(): boolean {
  if (localStorage.getItem(STORAGE_KEY_DISMISSED) === "true") return false;
  const remindAt = localStorage.getItem(STORAGE_KEY_REMIND_AT);
  if (remindAt && Date.now() < parseInt(remindAt, 10)) return false;
  return true;
}

interface GitHubStarDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDismiss: () => void;
}

export function GitHubStarDialog({ open, onOpenChange, onDismiss }: GitHubStarDialogProps) {
  function handleStar() {
    openUrl(GITHUB_URL);
    localStorage.setItem(STORAGE_KEY_DISMISSED, "true");
    onDismiss();
    onOpenChange(false);
  }

  function handleRemindLater() {
    localStorage.setItem(STORAGE_KEY_REMIND_AT, String(Date.now() + REMIND_DELAY_MS));
    onDismiss();
    onOpenChange(false);
  }

  function handleDismissPermanently() {
    localStorage.setItem(STORAGE_KEY_DISMISSED, "true");
    onDismiss();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm text-center" showCloseButton={false}>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="flex size-12 items-center justify-center rounded-full bg-yellow-500/15">
            <Star className="size-6 text-yellow-400 fill-yellow-400" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-base font-semibold">Enjoying OpenHelm?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A GitHub star takes two seconds and means the world to us —
              it helps other developers discover the project.
            </p>
          </div>

          <Button
            className="w-full gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
            onClick={handleStar}
          >
            <Star className="size-4 fill-current" />
            Star on GitHub
          </Button>

          <Button
            variant="secondary"
            className="w-full"
            onClick={handleRemindLater}
          >
            Remind me in a week
          </Button>

          <button
            onClick={handleDismissPermanently}
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            Don't show again
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
