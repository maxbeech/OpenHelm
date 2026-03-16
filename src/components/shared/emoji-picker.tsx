import { useState } from "react";
import { Flag, Briefcase, Sparkles } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NodeIcon } from "@/components/shared/node-icon";
import { ICON_MAP } from "@/lib/icon-map";
import { cn } from "@/lib/utils";

const EMOJI_GRID = [
  // Targets & Goals
  "🎯", "🏆", "⭐", "🚀", "💡", "🔥", "✨", "🌟",
  // Work & Tools
  "🔧", "⚙️", "🛠️", "📦", "💼", "📋", "📊", "📈",
  // Code & Tech
  "💻", "🖥️", "🤖", "🧪", "🔬", "🧩", "🔗", "🔌",
  // Communication
  "📝", "📄", "📚", "📖", "✏️", "🗒️", "💬", "📣",
  // Nature & Time
  "🌱", "🌿", "🌍", "⏰", "📅", "🗓️", "⚡", "🔋",
  // Security & Shield
  "🔒", "🛡️", "🔑", "🏗️", "🧱", "🏠", "🏢", "🏭",
  // Fun & Misc
  "🎨", "🎵", "🎮", "🎲", "🧹", "🚩", "🏁", "🎉",
  // People & Hands
  "👁️", "🧠", "💪", "👍", "🤝", "🙌", "✅", "❌",
];

interface EmojiPickerProps {
  /** Current emoji icon (null = default icon) */
  value: string | null;
  /** Called when user selects an emoji */
  onChange: (emoji: string) => void;
  /** "goal" shows Flag default, "job" shows Briefcase default */
  variant: "goal" | "job";
  /** Optional: trigger AI regeneration */
  onRegenerate?: () => void;
  /** Whether AI regeneration is in progress */
  regenerating?: boolean;
  /** Extra classes for the trigger button */
  className?: string;
}

export function EmojiPicker({
  value,
  onChange,
  variant,
  onRegenerate,
  regenerating,
  className,
}: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex size-9 items-center justify-center rounded-md border border-input bg-background text-lg transition-colors hover:bg-accent",
            className,
          )}
          title="Change icon"
        >
          {value && ICON_MAP[value] ? (
            <NodeIcon icon={value} defaultIcon={variant === "goal" ? "flag" : "briefcase"} className="size-5" />
          ) : value ? (
            <span className="leading-none">{value}</span>
          ) : variant === "goal" ? (
            <Flag className="size-4 text-muted-foreground" />
          ) : (
            <Briefcase className="size-4 text-muted-foreground" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-2">
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className="mb-2 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <Sparkles className={cn("size-3.5", regenerating && "animate-spin")} />
            {regenerating ? "Picking icon..." : "Let AI pick"}
          </button>
        )}
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_GRID.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleSelect(emoji)}
              className={cn(
                "flex size-8 items-center justify-center rounded text-base transition-colors hover:bg-accent",
                value === emoji && "bg-accent ring-1 ring-primary",
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
