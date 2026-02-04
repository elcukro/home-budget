import logging
import os
import re
from typing import Callable, Iterable

_VERBOSE_TOKENS: tuple[str, ...] = (
    "[fastapi]",
    "[insights]",
    "[openai api]",
)

VERBOSE_API_LOGS = os.getenv("ENABLE_VERBOSE_API_LOGS", "false").lower() in (
    "1",
    "true",
    "yes",
)

# Flag to control PII masking in logs (default: enabled in production)
_IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"
MASK_PII_IN_LOGS = os.getenv("MASK_PII_IN_LOGS", str(_IS_PRODUCTION)).lower() in (
    "1",
    "true",
    "yes",
)


def mask_email_in_string(text: str) -> str:
    """
    Mask email addresses in a string for safe logging.

    Example: user john.doe@example.com logged in -> user j***e@e***e.com logged in
    """
    if not MASK_PII_IN_LOGS:
        return text

    def mask_email(match: re.Match) -> str:
        email = match.group(0)
        local, domain = email.rsplit('@', 1)

        # Mask local part
        if len(local) <= 2:
            masked_local = local[0] + '*' * max(1, len(local) - 1)
        else:
            masked_local = local[0] + '*' * (len(local) - 2) + local[-1]

        # Mask domain
        domain_parts = domain.split('.')
        masked_domain_parts = []
        for part in domain_parts:
            if len(part) <= 2:
                masked_domain_parts.append(part[0] + '*' * max(1, len(part) - 1))
            else:
                masked_domain_parts.append(part[0] + '*' * (len(part) - 2) + part[-1])

        return f"{masked_local}@{'.'.join(masked_domain_parts)}"

    # Email regex pattern
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    return re.sub(email_pattern, mask_email, text)


def sanitize_log_message(message: str) -> str:
    """
    Sanitize a log message by masking PII.
    Currently masks email addresses.
    """
    return mask_email_in_string(message)


def _should_log_verbose(message: str) -> bool:
    if VERBOSE_API_LOGS:
        return True
    lowered = message.lower()
    return any(token in lowered for token in ("error", "traceback"))


def make_conditional_print(logger_name: str) -> Callable[..., None]:
    """
    Returns a print-like callable that quiets chatty debug output unless
    ENABLE_VERBOSE_API_LOGS is enabled. Error-like messages still reach the log.
    """

    logger = logging.getLogger(logger_name)

    def _conditional_print(*args: object, **kwargs: object) -> None:
        if not args:
            return
        message = " ".join(str(arg) for arg in args)

        if not _should_log_verbose(message):
            return

        level = logging.ERROR if "error" in message.lower() or "traceback" in message.lower() else logging.DEBUG
        logger.log(level, message)

    return _conditional_print


class SecureLogger:
    """
    A wrapper around the standard logger that automatically sanitizes PII.
    Use this for logs that might contain user data.
    """

    def __init__(self, name: str):
        self._logger = logging.getLogger(name)

    def _sanitize(self, msg: str, args: tuple) -> tuple[str, tuple]:
        """Sanitize the message and any string arguments."""
        sanitized_msg = sanitize_log_message(str(msg))
        sanitized_args = tuple(
            sanitize_log_message(str(arg)) if isinstance(arg, str) else arg
            for arg in args
        )
        return sanitized_msg, sanitized_args

    def debug(self, msg: str, *args, **kwargs) -> None:
        msg, args = self._sanitize(msg, args)
        self._logger.debug(msg, *args, **kwargs)

    def info(self, msg: str, *args, **kwargs) -> None:
        msg, args = self._sanitize(msg, args)
        self._logger.info(msg, *args, **kwargs)

    def warning(self, msg: str, *args, **kwargs) -> None:
        msg, args = self._sanitize(msg, args)
        self._logger.warning(msg, *args, **kwargs)

    def error(self, msg: str, *args, **kwargs) -> None:
        msg, args = self._sanitize(msg, args)
        self._logger.error(msg, *args, **kwargs)

    def critical(self, msg: str, *args, **kwargs) -> None:
        msg, args = self._sanitize(msg, args)
        self._logger.critical(msg, *args, **kwargs)

    def exception(self, msg: str, *args, **kwargs) -> None:
        msg, args = self._sanitize(msg, args)
        self._logger.exception(msg, *args, **kwargs)


def get_secure_logger(name: str) -> SecureLogger:
    """Get a secure logger that automatically masks PII."""
    return SecureLogger(name)


def configure_logging(default_level: str = "WARNING") -> None:
    """
    Configure root logging level from LOG_LEVEL env variable.
    """

    log_level = os.getenv("LOG_LEVEL", default_level).upper()
    numeric_level = getattr(logging, log_level, logging.WARNING)
    logging.basicConfig(level=numeric_level)
