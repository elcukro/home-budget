"""
Email Service for FiredUp

Handles transactional emails using Resend API.
All emails are in Polish (primary market).
"""

import os
import logging
import time
from datetime import datetime, timezone
from typing import Optional
from enum import Enum

import sentry_sdk

logger = logging.getLogger(__name__)

# Resend configuration
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
EMAIL_FROM_ADDRESS = os.getenv("EMAIL_FROM_ADDRESS", "noreply@firedup.app")
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "FiredUp")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://firedup.app")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Check if email service is available
_resend_available = False
_resend = None

if RESEND_API_KEY:
    try:
        import resend
        resend.api_key = RESEND_API_KEY
        _resend = resend
        _resend_available = True
        logger.info("Resend email service initialized successfully")
    except ImportError:
        logger.warning("Resend package not installed. Run: pip install resend")
else:
    if ENVIRONMENT == "production":
        logger.error("RESEND_API_KEY not configured in production! Emails will not be sent.")
        sentry_sdk.capture_message("RESEND_API_KEY not configured in production", level="error")
    else:
        logger.info("RESEND_API_KEY not configured. Email sending disabled in development.")


class EmailType(Enum):
    """Types of transactional emails."""
    WELCOME = "welcome"
    PAYMENT_CONFIRMATION = "payment_confirmation"
    TRIAL_ENDING = "trial_ending"
    TRIAL_ENDED = "trial_ended"
    SUBSCRIPTION_CANCELED = "subscription_canceled"
    PAYMENT_FAILED = "payment_failed"
    PARTNER_INVITATION = "partner_invitation"


def _format_currency(amount_grosze: int) -> str:
    """
    Format amount in grosze to PLN string.
    Uses Polish formatting: comma as decimal, space before currency.
    Example: 4900 -> "49,00 zł"
    """
    zloty = amount_grosze / 100
    return f"{zloty:,.2f} zł".replace(",", " ").replace(".", ",")


def _get_plan_name(plan_type: str) -> str:
    """Get Polish name for plan type."""
    plan_names = {
        "monthly": "Plan Miesięczny",
        "annual": "Plan Roczny",
        "lifetime": "Plan Dożywotni",
    }
    return plan_names.get(plan_type, plan_type.capitalize())


def _get_email_footer() -> str:
    """Get standard email footer with legal info."""
    return """
---
FiredUp - Twój osobisty asystent finansowy
https://firedup.app

Aby zrezygnować z otrzymywania powiadomień email, odwiedź ustawienia konta:
{frontend_url}/settings

Ten email został wysłany automatycznie. Prosimy nie odpowiadać na tę wiadomość.
""".format(frontend_url=FRONTEND_URL)


def is_email_available() -> bool:
    """Check if email service is available."""
    return _resend_available


def _send_email(
    to_email: str,
    subject: str,
    html_content: str,
    email_type: EmailType,
    user_name: Optional[str] = None,
    max_retries: int = 3,
) -> bool:
    """
    Internal function to send email via Resend with retry logic.

    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML content of the email
        email_type: Type of email for logging
        user_name: Optional user name for logging
        max_retries: Maximum number of retry attempts (default: 3)

    Returns:
        True if sent successfully, False otherwise
    """
    if not _resend_available:
        logger.info(f"Email not sent (service unavailable): {email_type.value} to {to_email[:20]}...")
        return False

    if not to_email:
        logger.warning(f"Cannot send {email_type.value} email: no recipient email")
        return False

    # Add plain text version
    import re
    text_content = re.sub(r'<[^>]+>', '', html_content)
    text_content = re.sub(r'\n\s*\n', '\n\n', text_content)

    params = {
        "from": f"{EMAIL_FROM_NAME} <{EMAIL_FROM_ADDRESS}>",
        "to": [to_email],
        "subject": subject,
        "html": html_content,
        "text": text_content,
    }

    # Retry with exponential backoff
    for attempt in range(max_retries):
        try:
            response = _resend.Emails.send(params)

            logger.info(
                f"Email sent: {email_type.value} to {to_email[:20]}... "
                f"(id: {response.get('id', 'unknown')})"
            )
            return True

        except Exception as e:
            is_last_attempt = attempt == max_retries - 1

            if is_last_attempt:
                logger.error(
                    f"Failed to send {email_type.value} email to {to_email[:20]}... "
                    f"after {max_retries} attempts: {e}"
                )
                sentry_sdk.capture_exception(e)
                return False
            else:
                # Exponential backoff: 1s, 2s, 4s
                wait_time = 2 ** attempt
                logger.warning(
                    f"Email send attempt {attempt + 1}/{max_retries} failed for "
                    f"{email_type.value} to {to_email[:20]}..., retrying in {wait_time}s: {e}"
                )
                time.sleep(wait_time)

    return False


def send_welcome_email(
    to_email: str,
    user_name: Optional[str] = None,
    trial_end_date: Optional[datetime] = None,
) -> bool:
    """
    Send welcome email to new user.

    Args:
        to_email: User's email address
        user_name: User's display name
        trial_end_date: When the trial ends
    """
    greeting = f"Cześć {user_name}!" if user_name else "Cześć!"

    trial_info = ""
    if trial_end_date:
        # Format date in Polish style
        trial_end_str = trial_end_date.strftime("%d.%m.%Y")
        trial_info = f"""
        <p>Twój <strong>7-dniowy bezpłatny okres próbny</strong> kończy się <strong>{trial_end_str}</strong>.</p>
        <p>W tym czasie masz pełny dostęp do wszystkich funkcji Premium!</p>
        """
    else:
        trial_info = """
        <p>Masz <strong>7 dni bezpłatnego okresu próbnego</strong> z pełnym dostępem do wszystkich funkcji Premium!</p>
        """

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }}
        .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
        .button {{ display: inline-block; background: #667eea; color: white !important; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin: 20px 0; }}
        .tips {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }}
        .tip {{ padding: 10px 0; border-bottom: 1px solid #eee; }}
        .tip:last-child {{ border-bottom: none; }}
        .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🔥 Witamy w FiredUp!</h1>
    </div>
    <div class="content">
        <p>{greeting}</p>

        <p>Dziękujemy za dołączenie do <strong>FiredUp</strong> – Twojego osobistego asystenta finansowego!</p>

        {trial_info}

        <div class="tips">
            <h3>💡 Szybki start:</h3>
            <div class="tip">📊 <strong>Dashboard</strong> – zobacz swoje finanse na pierwszy rzut oka</div>
            <div class="tip">💸 <strong>Wydatki</strong> – śledź gdzie idą Twoje pieniądze</div>
            <div class="tip">🏦 <strong>Kredyty</strong> – kontroluj spłaty i planuj nadpłaty</div>
            <div class="tip">🎯 <strong>Cele oszczędnościowe</strong> – osiągaj swoje marzenia</div>
            <div class="tip">🔥 <strong>Baby Steps</strong> – buduj finansową niezależność krok po kroku</div>
        </div>

        <p style="text-align: center;">
            <a href="{FRONTEND_URL}/dashboard" class="button">Przejdź do aplikacji →</a>
        </p>

        <p>Jeśli masz pytania, odpowiedz na tego maila – chętnie pomożemy!</p>

        <p>Powodzenia na drodze do finansowej wolności! 🚀</p>

        <p>Zespół FiredUp</p>
    </div>
    <div class="footer">
        <p>FiredUp - Twój osobisty asystent finansowy<br>
        <a href="{FRONTEND_URL}">firedup.app</a></p>
        <p><a href="{FRONTEND_URL}/settings">Zarządzaj ustawieniami email</a></p>
    </div>
</body>
</html>
"""

    return _send_email(
        to_email=to_email,
        subject="🔥 Witamy w FiredUp! Rozpocznij swoją podróż do finansowej wolności",
        html_content=html_content,
        email_type=EmailType.WELCOME,
        user_name=user_name,
    )


def send_payment_confirmation_email(
    to_email: str,
    user_name: Optional[str] = None,
    plan_type: str = "monthly",
    amount_grosze: int = 0,
    receipt_url: Optional[str] = None,
    period_start: Optional[datetime] = None,
    period_end: Optional[datetime] = None,
) -> bool:
    """
    Send payment confirmation email.

    Args:
        to_email: User's email address
        user_name: User's display name
        plan_type: Type of plan purchased
        amount_grosze: Amount paid in grosze (PLN minor units)
        receipt_url: Stripe receipt URL
        period_start: Billing period start
        period_end: Billing period end
    """
    greeting = f"Cześć {user_name}!" if user_name else "Cześć!"
    plan_name = _get_plan_name(plan_type)
    amount_formatted = _format_currency(amount_grosze)

    period_info = ""
    if period_start and period_end:
        start_str = period_start.strftime("%d.%m.%Y")
        end_str = period_end.strftime("%d.%m.%Y")
        period_info = f"<p><strong>Okres rozliczeniowy:</strong> {start_str} - {end_str}</p>"

    receipt_button = ""
    if receipt_url:
        receipt_button = f"""
        <p style="text-align: center;">
            <a href="{receipt_url}" class="button-secondary">Zobacz paragon →</a>
        </p>
        """

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }}
        .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
        .summary {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }}
        .amount {{ font-size: 32px; font-weight: bold; color: #10b981; text-align: center; }}
        .button {{ display: inline-block; background: #667eea; color: white !important; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin: 20px 0; }}
        .button-secondary {{ display: inline-block; background: white; color: #667eea !important; padding: 10px 20px; border-radius: 6px; text-decoration: none; border: 2px solid #667eea; }}
        .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>✅ Płatność potwierdzona!</h1>
    </div>
    <div class="content">
        <p>{greeting}</p>

        <p>Dziękujemy za zakup! Twoja płatność została pomyślnie zrealizowana.</p>

        <div class="summary">
            <p class="amount">{amount_formatted}</p>
            <p style="text-align: center;"><strong>{plan_name}</strong></p>
            {period_info}
        </div>

        <p>Masz teraz pełny dostęp do wszystkich funkcji Premium FiredUp:</p>
        <ul>
            <li>✅ Nielimitowane wydatki i przychody</li>
            <li>✅ Integracja z bankiem (Tink)</li>
            <li>✅ Zaawansowane raporty i eksporty</li>
            <li>✅ AI Insights (analiza wydatków)</li>
        </ul>

        {receipt_button}

        <p style="text-align: center;">
            <a href="{FRONTEND_URL}/dashboard" class="button">Przejdź do aplikacji →</a>
        </p>

        <p>Dziękujemy za wsparcie! 🙏</p>

        <p>Zespół FiredUp</p>
    </div>
    <div class="footer">
        <p>FiredUp - Twój osobisty asystent finansowy<br>
        <a href="{FRONTEND_URL}">firedup.app</a></p>
        <p><a href="{FRONTEND_URL}/settings?tab=billing">Zarządzaj subskrypcją</a></p>
    </div>
</body>
</html>
"""

    return _send_email(
        to_email=to_email,
        subject=f"✅ Potwierdzenie płatności – {plan_name} ({amount_formatted})",
        html_content=html_content,
        email_type=EmailType.PAYMENT_CONFIRMATION,
        user_name=user_name,
    )


def send_trial_ending_email(
    to_email: str,
    user_name: Optional[str] = None,
    trial_days_left: int = 3,
    trial_end_date: Optional[datetime] = None,
) -> bool:
    """
    Send trial ending reminder email.

    Args:
        to_email: User's email address
        user_name: User's display name
        trial_days_left: Number of days left in trial
        trial_end_date: When the trial ends
    """
    greeting = f"Cześć {user_name}!" if user_name else "Cześć!"

    end_date_str = ""
    if trial_end_date:
        end_date_str = trial_end_date.strftime("%d.%m.%Y")

    days_text = "dni" if trial_days_left != 1 else "dzień"

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }}
        .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
        .countdown {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }}
        .days {{ font-size: 48px; font-weight: bold; color: #f59e0b; }}
        .pricing {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }}
        .plan {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }}
        .plan:last-child {{ border-bottom: none; }}
        .button {{ display: inline-block; background: #667eea; color: white !important; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin: 20px 0; }}
        .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>⏰ Twój trial kończy się wkrótce!</h1>
    </div>
    <div class="content">
        <p>{greeting}</p>

        <p>Chcieliśmy Ci przypomnieć, że Twój bezpłatny okres próbny FiredUp kończy się już niedługo.</p>

        <div class="countdown">
            <div class="days">{trial_days_left}</div>
            <div>{days_text} do końca trialu</div>
            <div style="color: #666; font-size: 14px;">({end_date_str})</div>
        </div>

        <p>Po zakończeniu okresu próbnego stracisz dostęp do funkcji Premium:</p>
        <ul>
            <li>❌ Limit 20 wydatków/miesiąc (zamiast nielimitowanych)</li>
            <li>❌ Brak integracji z bankiem</li>
            <li>❌ Brak AI Insights</li>
            <li>❌ Ograniczone eksporty</li>
        </ul>

        <div class="pricing">
            <h3>💳 Wybierz plan Premium:</h3>
            <div class="plan">
                <span><strong>Plan Miesięczny</strong></span>
                <span>29 zł/miesiąc</span>
            </div>
            <div class="plan">
                <span><strong>Plan Roczny</strong> <small>(oszczędzasz 20%)</small></span>
                <span>279 zł/rok</span>
            </div>
            <div class="plan">
                <span><strong>Plan Dożywotni</strong> <small>(płacisz raz!)</small></span>
                <span>499 zł jednorazowo</span>
            </div>
        </div>

        <p style="text-align: center;">
            <a href="{FRONTEND_URL}/#pricing" class="button">Wybierz plan →</a>
        </p>

        <p>Masz pytania? Odpowiedz na tego maila – chętnie pomożemy!</p>

        <p>Zespół FiredUp</p>
    </div>
    <div class="footer">
        <p>FiredUp - Twój osobisty asystent finansowy<br>
        <a href="{FRONTEND_URL}">firedup.app</a></p>
        <p><a href="{FRONTEND_URL}/settings">Zarządzaj ustawieniami email</a></p>
    </div>
</body>
</html>
"""

    return _send_email(
        to_email=to_email,
        subject=f"⏰ Zostało {trial_days_left} {days_text} Twojego trialu FiredUp",
        html_content=html_content,
        email_type=EmailType.TRIAL_ENDING,
        user_name=user_name,
    )


def send_trial_ended_email(
    to_email: str,
    user_name: Optional[str] = None,
) -> bool:
    """
    Send trial ended notification email.

    Args:
        to_email: User's email address
        user_name: User's display name
    """
    greeting = f"Cześć {user_name}!" if user_name else "Cześć!"

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }}
        .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
        .info-box {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }}
        .button {{ display: inline-block; background: #667eea; color: white !important; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin: 20px 0; }}
        .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>📅 Twój trial zakończył się</h1>
    </div>
    <div class="content">
        <p>{greeting}</p>

        <p>Twój 7-dniowy bezpłatny okres próbny FiredUp dobiegł końca.</p>

        <div class="info-box">
            <p><strong>Co to oznacza?</strong></p>
            <p>Twoje konto zostało automatycznie przełączone na plan darmowy. Twoje dane są bezpieczne i nadal masz dostęp do podstawowych funkcji.</p>
        </div>

        <p><strong>W planie darmowym masz:</strong></p>
        <ul>
            <li>✅ Do 20 wydatków miesięcznie</li>
            <li>✅ Do 3 przychodów miesięcznie</li>
            <li>✅ Do 3 kredytów</li>
            <li>✅ Podstawowe raporty</li>
        </ul>

        <p><strong>Funkcje Premium, które straciłeś:</strong></p>
        <ul>
            <li>❌ Nielimitowane transakcje</li>
            <li>❌ Integracja z bankiem (Tink)</li>
            <li>❌ AI Insights</li>
            <li>❌ Zaawansowane eksporty (CSV, Excel)</li>
        </ul>

        <p>Chcesz odzyskać pełny dostęp? Wybierz plan Premium!</p>

        <p style="text-align: center;">
            <a href="{FRONTEND_URL}/#pricing" class="button">Zobacz plany Premium →</a>
        </p>

        <p>Dziękujemy, że wypróbowałeś FiredUp! 🙏</p>

        <p>Zespół FiredUp</p>
    </div>
    <div class="footer">
        <p>FiredUp - Twój osobisty asystent finansowy<br>
        <a href="{FRONTEND_URL}">firedup.app</a></p>
        <p><a href="{FRONTEND_URL}/settings">Zarządzaj ustawieniami email</a></p>
    </div>
</body>
</html>
"""

    return _send_email(
        to_email=to_email,
        subject="📅 Twój trial FiredUp zakończył się – co dalej?",
        html_content=html_content,
        email_type=EmailType.TRIAL_ENDED,
        user_name=user_name,
    )


def send_subscription_canceled_email(
    to_email: str,
    user_name: Optional[str] = None,
    cancel_date: Optional[datetime] = None,
) -> bool:
    """
    Send subscription cancellation confirmation email.

    Args:
        to_email: User's email address
        user_name: User's display name
        cancel_date: When the subscription was canceled
    """
    greeting = f"Cześć {user_name}!" if user_name else "Cześć!"

    cancel_date_str = ""
    if cancel_date:
        cancel_date_str = cancel_date.strftime("%d.%m.%Y")

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }}
        .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
        .info-box {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }}
        .button {{ display: inline-block; background: #667eea; color: white !important; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin: 20px 0; }}
        .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>👋 Subskrypcja anulowana</h1>
    </div>
    <div class="content">
        <p>{greeting}</p>

        <p>Potwierdzamy anulowanie Twojej subskrypcji FiredUp Premium.</p>

        <div class="info-box">
            <p><strong>⚠️ Ważna informacja:</strong></p>
            <p>Twoje konto zostało przełączone na plan darmowy. Wszystkie Twoje dane są bezpieczne i pozostają w systemie.</p>
        </div>

        <p>Jeśli anulowałeś subskrypcję przez pomyłkę lub zmieniłeś zdanie, możesz w każdej chwili ponownie aktywować Premium:</p>

        <p style="text-align: center;">
            <a href="{FRONTEND_URL}/#pricing" class="button">Reaktywuj Premium →</a>
        </p>

        <p>Czy możemy Ci jakoś pomóc? Jeśli masz uwagi lub sugestie, odpowiedz na tego maila – każda opinia jest dla nas cenna!</p>

        <p>Dziękujemy, że byłeś z nami! 🙏</p>

        <p>Zespół FiredUp</p>
    </div>
    <div class="footer">
        <p>FiredUp - Twój osobisty asystent finansowy<br>
        <a href="{FRONTEND_URL}">firedup.app</a></p>
        <p><a href="{FRONTEND_URL}/settings">Zarządzaj ustawieniami email</a></p>
    </div>
</body>
</html>
"""

    return _send_email(
        to_email=to_email,
        subject="👋 Potwierdzenie anulowania subskrypcji FiredUp",
        html_content=html_content,
        email_type=EmailType.SUBSCRIPTION_CANCELED,
        user_name=user_name,
    )


def send_payment_failed_email(
    to_email: str,
    user_name: Optional[str] = None,
    failure_reason: Optional[str] = None,
) -> bool:
    """
    Send payment failed notification email.

    Args:
        to_email: User's email address
        user_name: User's display name
        failure_reason: Reason for payment failure
    """
    greeting = f"Cześć {user_name}!" if user_name else "Cześć!"

    # Don't expose detailed failure reasons to users
    generic_reason = "Płatność nie powiodła się. Sprawdź swoją metodę płatności."

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }}
        .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
        .alert-box {{ background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }}
        .steps {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }}
        .step {{ padding: 10px 0; border-bottom: 1px solid #eee; }}
        .step:last-child {{ border-bottom: none; }}
        .button {{ display: inline-block; background: #667eea; color: white !important; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin: 20px 0; }}
        .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>⚠️ Płatność nie powiodła się</h1>
    </div>
    <div class="content">
        <p>{greeting}</p>

        <p>Niestety, nie udało się przetworzyć Twojej ostatniej płatności za subskrypcję FiredUp Premium.</p>

        <div class="alert-box">
            <p><strong>⚠️ Wymagane działanie:</strong></p>
            <p>Zaktualizuj swoją metodę płatności, aby zachować dostęp do funkcji Premium.</p>
        </div>

        <div class="steps">
            <h3>📋 Co możesz zrobić:</h3>
            <div class="step">1. Sprawdź, czy karta ma wystarczające środki</div>
            <div class="step">2. Upewnij się, że karta nie wygasła</div>
            <div class="step">3. Zaktualizuj dane karty w ustawieniach płatności</div>
        </div>

        <p style="text-align: center;">
            <a href="{FRONTEND_URL}/settings?tab=billing" class="button">Zaktualizuj płatność →</a>
        </p>

        <p>Jeśli potrzebujesz pomocy, odpowiedz na tego maila – chętnie Ci pomożemy!</p>

        <p>Zespół FiredUp</p>
    </div>
    <div class="footer">
        <p>FiredUp - Twój osobisty asystent finansowy<br>
        <a href="{FRONTEND_URL}">firedup.app</a></p>
        <p><a href="{FRONTEND_URL}/settings">Zarządzaj ustawieniami email</a></p>
    </div>
</body>
</html>
"""

    return _send_email(
        to_email=to_email,
        subject="⚠️ Płatność za FiredUp nie powiodła się – wymagane działanie",
        html_content=html_content,
        email_type=EmailType.PAYMENT_FAILED,
        user_name=user_name,
    )


def send_partner_invitation_email(
    to_email: str,
    inviter_name: Optional[str] = None,
    token: str = "",
) -> bool:
    """
    Send partner invitation email.

    Args:
        to_email: Partner's email address
        inviter_name: Name of the person who sent the invitation
        token: Invitation token for the accept link
    """
    inviter_display = inviter_name or "Ktoś"
    accept_url = f"{FRONTEND_URL}/partner/accept?token={token}"

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }}
        .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
        .info-box {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }}
        .button {{ display: inline-block; background: #667eea; color: white !important; padding: 14px 36px; border-radius: 6px; text-decoration: none; margin: 20px 0; font-size: 16px; font-weight: bold; }}
        .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>👥 Zaproszenie do wspólnego budżetu</h1>
    </div>
    <div class="content">
        <p>Cześć!</p>

        <p><strong>{inviter_display}</strong> zaprasza Cię do wspólnego zarządzania budżetem domowym w FiredUp.</p>

        <div class="info-box">
            <h3>Co to oznacza?</h3>
            <ul>
                <li>📊 Wspólny widok wszystkich finansów domowych</li>
                <li>💰 Śledzenie wydatków i przychodów obu osób</li>
                <li>🎯 Wspólne cele oszczędnościowe</li>
                <li>🔥 Wspólna droga do finansowej wolności</li>
            </ul>
            <p style="color: #666; font-size: 14px;">Twoje konto będzie korzystać z planu Premium partnera — bez dodatkowych opłat.</p>
        </div>

        <p style="text-align: center;">
            <a href="{accept_url}" class="button">Dołącz do budżetu →</a>
        </p>

        <p style="color: #666; font-size: 13px;">Zaproszenie jest ważne przez 7 dni. Jeśli nie spodziewałeś/aś się tego zaproszenia, zignoruj tę wiadomość.</p>

        <p>Zespół FiredUp</p>
    </div>
    <div class="footer">
        <p>FiredUp - Twój osobisty asystent finansowy<br>
        <a href="{FRONTEND_URL}">firedup.app</a></p>
    </div>
</body>
</html>
"""

    return _send_email(
        to_email=to_email,
        subject=f"👥 {inviter_display} zaprasza Cię do wspólnego zarządzania budżetem",
        html_content=html_content,
        email_type=EmailType.PARTNER_INVITATION,
    )
