#!/usr/bin/env python3
"""
API обратного звонка для страницы /order.

POST /api/callback
Content-Type: application/json
Body: {"phone": "+7...", "subject": "...", "at": "ISO-8601"}

Переменные окружения — см. callback.env.example
"""

from __future__ import annotations

import email.utils
import json
import os
import re
import smtplib
import ssl
import sys
from datetime import datetime, timezone
from email.mime.text import MIMEText
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = os.environ.get("CALLBACK_BIND", "127.0.0.1")
PORT = int(os.environ.get("CALLBACK_PORT", "8787"))

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.mail.ru")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
MAIL_TO = os.environ.get("MAIL_TO", SMTP_USER)

SECRET = os.environ.get("CALLBACK_SECRET", "")
PHONE_RE = re.compile(r"^[\d\s+\-()\.]{6,24}$")


def send_mail(phone: str, subject: str, at: str) -> None:
    if not SMTP_USER or not SMTP_PASS:
        raise RuntimeError("SMTP not configured")

    body = (
        "Заявка на обратный звонок с сайта.\n\n"
        f"Телефон: {phone}\n"
        f"Время (UTC): {at or '—'}\n"
    )

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = SMTP_USER
    msg["To"] = MAIL_TO
    msg["Date"] = email.utils.format_datetime(datetime.now(timezone.utc))

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context) as smtp:
        smtp.login(SMTP_USER, SMTP_PASS)
        smtp.sendmail(SMTP_USER, [MAIL_TO], msg.as_string())


class CallbackHandler(BaseHTTPRequestHandler):
    server_version = "HeavyCallback/1.0"

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write(f"[callback] {self.address_string()} - {fmt % args}\n")

    def _cors(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept, X-Callback-Secret")

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        if self.path != "/api/callback":
            self.send_error(404)
            return
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self) -> None:
        if self.path != "/api/callback":
            self.send_error(404)
            return

        if SECRET and self.headers.get("X-Callback-Secret") != SECRET:
            self._json(403, {"ok": False, "error": "forbidden"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._json(400, {"ok": False, "error": "invalid request"})
            return

        if length <= 0 or length > 4096:
            self._json(413, {"ok": False, "error": "payload too large"})
            return

        try:
            raw = self.rfile.read(length)
            data = json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._json(400, {"ok": False, "error": "invalid json"})
            return

        phone = str(data.get("phone", "")).strip()
        subject = str(data.get("subject", "Заказать обратный звонок")).strip()[:200]
        at = str(data.get("at", "")).strip()[:64]

        if not phone or not PHONE_RE.match(phone):
            self._json(400, {"ok": False, "error": "invalid phone"})
            return

        try:
            send_mail(phone, subject, at)
        except Exception as exc:
            self.log_message("mail error: %s", exc)
            self._json(502, {"ok": False, "error": "mail failed"})
            return

        self._json(200, {"ok": True})


def main() -> None:
    if not SMTP_USER or not SMTP_PASS:
        print("Задайте SMTP_USER и SMTP_PASS (см. callback.env.example)", file=sys.stderr)
        sys.exit(1)

    server = ThreadingHTTPServer((HOST, PORT), CallbackHandler)
    print(f"callback API on http://{HOST}:{PORT}/api/callback", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
