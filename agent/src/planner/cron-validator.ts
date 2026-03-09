/**
 * Standalone cron validation utility.
 * Used by generate.ts for post-generation validation of cron expressions.
 */

import { CronExpressionParser } from "cron-parser";

/**
 * Validate a cron expression. Throws if the expression is invalid.
 */
export function validateCronExpression(expression: string): void {
  CronExpressionParser.parse(expression);
}
