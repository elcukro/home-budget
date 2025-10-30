import { IntlShape } from "react-intl";
import type { ValidationError } from "./validation";

export function formatValidationError(
  intl: Pick<IntlShape, "formatMessage">,
  error: ValidationError | null,
  fallback?: string,
): string {
  if (!error) {
    return fallback ?? "";
  }
  return intl.formatMessage(
    { id: error.messageId, defaultMessage: fallback ?? error.messageId },
    error.values,
  );
}
