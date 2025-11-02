import logging
import os
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


def configure_logging(default_level: str = "WARNING") -> None:
    """
    Configure root logging level from LOG_LEVEL env variable.
    """

    log_level = os.getenv("LOG_LEVEL", default_level).upper()
    numeric_level = getattr(logging, log_level, logging.WARNING)
    logging.basicConfig(level=numeric_level)
