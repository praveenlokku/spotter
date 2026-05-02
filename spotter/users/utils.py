from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


def send_otp_email(email: str, code: str, purpose: str):
    """Send a 6-digit OTP to the user's email address."""
    if purpose == 'signup':
        subject = 'Verify your Spotter ELD account'
        action = 'complete your registration'
    else:
        subject = 'Your Spotter ELD login code'
        action = 'sign in to your account'

    body = f"""
Hello,

Your one-time verification code to {action} is:

    {code}

This code expires in {settings.OTP_EXPIRY_MINUTES} minutes. Do not share it with anyone.

If you did not request this code, please ignore this email.

— The Spotter ELD Team
""".strip()

    # ALWAYS print to console for easy debugging in Railway logs
    # This ensures you can find your OTP even if email fails
    print("\n" + "="*40)
    print(f"OTP FOR: {email}")
    print(f"PURPOSE: {purpose}")
    print(f"CODE   : {code}")
    print("="*40 + "\n")

    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
    except Exception as e:
        # The print above ensures we still see the code even if email fails
        logger.error(f"Email failed to {email}: {e}")
