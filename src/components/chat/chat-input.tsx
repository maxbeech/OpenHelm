import { useState, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChatStore, CHAT_MODELS, CHAT_EFFORTS, type ChatModelValue, type ChatEffortValue } from "@/stores/chat-store";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { chatModel, chatEffort, setChatModel, setChatEffort } = useChatStore();

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border p-3">
      {/* Model / effort selectors */}
      <div className="flex items-center gap-2">
        <Select value={chatModel} onValueChange={(v) => setChatModel(v as ChatModelValue)}>
          <SelectTrigger className="h-7 flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHAT_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-xs">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={chatEffort} onValueChange={(v) => setChatEffort(v as ChatEffortValue)}>
          <SelectTrigger className="h-7 flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHAT_EFFORTS.map((e) => (
              <SelectItem key={e.value} value={e.value} className="text-xs">
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Text input row */}
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything... (Enter to send)"
          rows={1}
          disabled={disabled}
          className="max-h-32 min-h-[36px] flex-1 resize-none text-sm"
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="size-9 shrink-0 p-0"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
