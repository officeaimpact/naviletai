"""
Email sender stub — logs booking requests instead of sending emails.
Used by submit_booking_request when booking_email_enabled is True.
"""

import logging

logger = logging.getLogger("mgp_bot")


def send_booking_email(**kwargs):
    logger.info("BOOKING REQUEST (email stub): %s", kwargs)
    return {"success": True, "stub": True}
