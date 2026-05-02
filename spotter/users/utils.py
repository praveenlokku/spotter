from django.core.mail import send_mail
from django.conf import settings


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

    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
    except Exception as e:
        # Log but don't crash — during dev the console backend will print it
        print(f"[OTP EMAIL ERROR] Could not send OTP to {email}: {e}")
