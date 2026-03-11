import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScheduleType } from "@openorchestra/shared";
import type { JobFormState } from "./job-creation-form";

export interface ScheduleConfigFormProps {
  form: JobFormState;
  intervalError: string | null;
  calendarError: string | null;
  onFieldChange: (field: keyof JobFormState, value: string | number) => void;
}

export function ScheduleConfigForm({
  form,
  intervalError,
  calendarError,
  onFieldChange,
}: ScheduleConfigFormProps) {
  const { scheduleType } = form;

  if (scheduleType === "interval") {
    return (
      <div className="mt-1.5 space-y-1">
        <div className="flex gap-2">
          <Input
            type="number"
            value={form.intervalAmount}
            onChange={(e) => onFieldChange("intervalAmount", Number(e.target.value))}
            min={1}
            className="h-9 w-24 text-sm"
            aria-label="Interval amount"
          />
          <Select
            value={form.intervalUnit}
            onValueChange={(v) => onFieldChange("intervalUnit", v)}
          >
            <SelectTrigger className="h-9 flex-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutes</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {intervalError && (
          <p className="text-xs text-destructive">{intervalError}</p>
        )}
      </div>
    );
  }

  if (scheduleType === "calendar") {
    return (
      <div className="mt-1.5 space-y-2">
        <div className="flex gap-2">
          <Select
            value={form.calendarFrequency}
            onValueChange={(v) => onFieldChange("calendarFrequency", v)}
          >
            <SelectTrigger className="h-9 flex-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="time"
            value={form.calendarTime}
            onChange={(e) => onFieldChange("calendarTime", e.target.value)}
            className="h-9 w-28 text-sm"
            aria-label="Time"
          />
        </div>
        {form.calendarFrequency === "weekly" && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Day of week</Label>
            <Select
              value={String(form.calendarDayOfWeek)}
              onValueChange={(v) => onFieldChange("calendarDayOfWeek", Number(v))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Monday</SelectItem>
                <SelectItem value="2">Tuesday</SelectItem>
                <SelectItem value="3">Wednesday</SelectItem>
                <SelectItem value="4">Thursday</SelectItem>
                <SelectItem value="5">Friday</SelectItem>
                <SelectItem value="6">Saturday</SelectItem>
                <SelectItem value="0">Sunday</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {form.calendarFrequency === "monthly" && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Day of month</Label>
            <Input
              type="number"
              value={form.calendarDayOfMonth}
              onChange={(e) => onFieldChange("calendarDayOfMonth", Number(e.target.value))}
              min={1}
              max={31}
              className="h-9 text-sm"
              aria-label="Day of month"
            />
          </div>
        )}
        {calendarError && (
          <p className="text-xs text-destructive">{calendarError}</p>
        )}
      </div>
    );
  }

  if (scheduleType === "cron") {
    return (
      <Input
        value={(form as JobFormState & { cronExpression?: string }).cronExpression ?? ""}
        onChange={(e) => onFieldChange("cronExpression" as keyof JobFormState, e.target.value)}
        className="mt-1.5 h-9 text-sm"
        placeholder="0 9 * * 1 (Mon 9am)"
        aria-label="Cron expression"
      />
    );
  }

  // "once" and "manual" — no sub-form
  return null;
}

// Re-export ScheduleType for convenience
export type { ScheduleType };
