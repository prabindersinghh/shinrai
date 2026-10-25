"""Passive cyber-posture check of a partner's public domain: SPF/DMARC over DNS-over-HTTPS, one TLS handshake per probe,
and one plain HTTPS GET of "/" to read version banners. No port scan, no crawling, no credentials, no redirects.
The domain is user input and this server connects to it, so it must resolve to public addresses only (SSRF guard),
and the connection is pinned to the address that was checked.

Statuses: pass | warn | fail | na. A check that cannot be run is "na" and never counts against the partner.
Self-check (offline): python -m app.adapters.cyber_posture"""
from __future__ import annotations

import asyncio
import ipaddress
import re
import socket
import ssl
from datetime import datetime, timezone

import httpx

from .base import HTTP_HEADERS, NotAvailable, SourceAdapter

CONNECT_S = 8.0  # per socket operation; slow shared hosting is common
DOH_S = 5.0
HEDGE_S = 1.5
THREAD_S = 20.0  # hard bound on one probe thread
FREE_MAIL = {"gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.co.jp", "hotmail.com", "outlook.com",
             "live.com", "rediffmail.com", "icloud.com", "aol.com", "proton.me", "protonmail.com"}
DOH = ("https://dns.google/resolve", "https://cloudflare-dns.com/dns-query")
_LABEL = re.compile(r"^(?!-)[a-z0-9-]{1,63}(?<!-)$")
_URL = re.compile(r"(?:https?://|www\.)([a-z0-9][a-z0-9.-]*\.[a-z]{2,})", re.I)
_EMAIL = re.compile(r"[\w.+-]+@([a-z0-9][a-z0-9.-]*\.[a-z]{2,})", re.I)


def clean_domain(raw: str) -> str:
    """'https://www.Example.in:443/about' -> 'www.example.in'. ValueError unless it looks like a public hostname."""
    d = re.sub(r"^[a-z][a-z0-9+.-]*://", "", raw.strip().lower())
    d = re.split(r"[/?#]", d)[0].rsplit("@", 1)[-1].split(":")[0].rstrip(".")
    try:
        d = d.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise ValueError("invalid domain") from exc
    labels = d.split(".")
    if len(labels) < 2 or len(d) > 253 or labels[-1].isdigit() or not all(_LABEL.match(x) for x in labels):
        raise ValueError("not a public domain name")
    return d


def domain_from_text(text: str) -> str | None:
    """First website host in a brochure, else the first non-free-mail email domain."""
    for pattern in (_URL, _EMAIL):
        for m in pattern.finditer(text or ""):
            d = m.group(1).lower().removeprefix("www.")
            if d not in FREE_MAIL:
                try:
                    return clean_domain(d)
                except ValueError:
                    continue
    return None


def domain_from_email(email: str | None) -> str | None:
    d = (email or "").rsplit("@", 1)[-1].strip().lower()
    if not d or d in FREE_MAIL:
        return None
    try:
        return clean_domain(d)
    except ValueError:
        return None


async def resolve_public(host: str) -> list[str]:
    """Addresses for host via DoH (the system resolver can stall for 30 s). NotAvailable if it does not resolve or if
    ANY address is not globally routable: the caller connects only to an address that passed this check."""
    ips: list[str] = []
    for rtype, code in (("A", 1), ("AAAA", 28)):
        ips = [a["data"] for a in await _doh(host, rtype) if a.get("type") == code]
        if ips:
            break
    if not ips:
        raise NotAvailable(f"{host} does not resolve")
    try:
        public = all(ipaddress.ip_address(ip).is_global for ip in ips)
    except ValueError as exc:
        raise NotAvailable(f"{host} returned an unreadable address") from exc
    if not public:
        raise NotAvailable(f"{host} resolves to a non-public address; not checked")
    return ips


def _ctx(verify: bool, lo: ssl.TLSVersion | None = None, hi: ssl.TLSVersion | None = None) -> ssl.SSLContext:
    if verify:
        ctx = ssl.create_default_context()
    else:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname, ctx.verify_mode = False, ssl.CERT_NONE
    if lo or hi:
        ctx.set_ciphers("ALL:@SECLEVEL=0")
        ctx.minimum_version, ctx.maximum_version = lo or ctx.minimum_version, hi or ctx.maximum_version
    return ctx


def _connect(ip: str, host: str, ctx: ssl.SSLContext) -> ssl.SSLSocket:
    """Blocking TLS connect to the address that was checked. Run in a thread: asyncio's TLS shutdown can take
    seconds to unwind after a failed handshake, a plain socket raises at once and honours its timeout."""
    sock = socket.create_connection((ip, 443), timeout=CONNECT_S)
    try:
        return ctx.wrap_socket(sock, server_hostname=host)
    except BaseException:
        sock.close()
        raise


def _check(name: str, status: str, result: str, ja: str) -> dict:
    return {"check": name, "result": result, "result_ja": ja, "status": status}


CERT_FAULTS = [("expired", "expired", "証明書の有効期限が切れています"), ("self", "self-signed", "自己署名証明書です"),
               ("hostname", "issued for a different hostname", "別のドメイン名向けの証明書です"),
               ("mismatch", "issued for a different hostname", "別のドメイン名向けの証明書です"),
               ("issuer", "issuer not trusted", "発行元が信頼されていません")]


def _tls_certificate(ip: str, host: str) -> dict:
    name = "TLS certificate"
    try:
        with _connect(ip, host, _ctx(True)) as s:
            cert = s.getpeercert()
    except ssl.SSLCertVerificationError as exc:
        why = (exc.verify_message or "").lower()
        nice, ja = next(((en, jp) for key, en, jp in CERT_FAULTS if key in why), (why or "failed verification", "証明書の検証に失敗"))
        return _check(name, "fail", f"Certificate {nice}", ja)
    except OSError:
        return _check(name, "warn", "No HTTPS answer on port 443", "443番ポートでHTTPS応答なし")
    ends = ssl.cert_time_to_seconds(cert["notAfter"])
    left = (ends - datetime.now(timezone.utc).timestamp()) / 86400
    issuer = next((v for rdn in cert.get("issuer", ()) for k, v in rdn if k == "organizationName"), "unknown issuer")
    until = datetime.fromtimestamp(ends, timezone.utc).strftime("%Y-%m-%d")
    if left < 21:
        days = max(int(left), 0)
        return _check(name, "warn", f"Valid but expires in {days} days ({until}); issuer {issuer}", f"有効ですが残り{days}日（{until}まで）、発行元 {issuer}")
    return _check(name, "pass", f"Valid until {until}; issuer {issuer}", f"{until}まで有効、発行元 {issuer}")


# Local OpenSSL may refuse to speak TLS 1.0/1.1 at all; that says nothing about the partner's server.
_LOCAL_LIMIT = ("UNSUPPORTED_PROTOCOL", "NO_PROTOCOLS_AVAILABLE", "NO_CIPHERS_AVAILABLE", "NO_SUITABLE_DIGEST")
LEGACY_S = 6.0


def _tls_protocols(ip: str, host: str) -> dict:
    name = "TLS protocols"
    try:
        with _connect(ip, host, _ctx(False)) as s:
            best = s.version() or "TLS"
    except OSError:
        return _check(name, "na", "No TLS handshake to test", "TLS接続できず確認不可")
    untestable = _check(name, "na", f"Best offered: {best}; legacy versions not testable from this server", f"最高：{best}。旧バージョンは確認不可")
    try:
        ctx = _ctx(False, ssl.TLSVersion.TLSv1, ssl.TLSVersion.TLSv1_1)
        sock = socket.create_connection((ip, 443), timeout=LEGACY_S)
        try:
            with ctx.wrap_socket(sock, server_hostname=host) as s:
                return _check(name, "fail", f"{s.version()} still accepted (best offered: {best})", f"{s.version()}を受け付けています（最高：{best}）")
        except BaseException:
            sock.close()
            raise
    except ValueError:
        return untestable
    except ssl.SSLError as exc:
        if any(r in str(exc) for r in _LOCAL_LIMIT):
            return untestable
        return _check(name, "pass", f"Best offered: {best}; TLS 1.0 and 1.1 refused", f"最高：{best}。TLS 1.0/1.1は拒否")
    except ConnectionError:
        return _check(name, "pass", f"Best offered: {best}; TLS 1.0 and 1.1 refused", f"最高：{best}。TLS 1.0/1.1は拒否")
    except OSError:  # no alert and no reset: a timeout proves nothing either way
        return _check(name, "na", f"Best offered: {best}; legacy versions got no answer in {LEGACY_S:.0f}s", f"最高：{best}。旧バージョンは{LEGACY_S:.0f}秒以内に応答なし")


def eol_in(banner: str) -> list[str]:
    # ponytail: static end-of-life table dated 2026-10; swap for the endoflife.date API if it must stay current.
    out = []
    for major, minor in re.findall(r"PHP/(\d+)\.(\d+)", banner, re.I):
        if (int(major), int(minor)) < (8, 2):
            out.append(f"PHP {major}.{minor}")
    for ver in re.findall(r"Apache/(\d+\.\d+)", banner, re.I):
        if ver in ("1.3", "2.0", "2.2"):
            out.append(f"Apache {ver}")
    for major, minor in re.findall(r"Microsoft-IIS/(\d+)\.(\d+)", banner, re.I):
        if (int(major), int(minor)) <= (8, 5):
            out.append(f"IIS {major}.{minor}")
    for major, minor in re.findall(r"OpenSSL/(\d+)\.(\d+)", banner, re.I):
        if int(major) < 3:
            out.append(f"OpenSSL {major}.{minor}")
    return list(dict.fromkeys(out))


def _exposed_software(ip: str, host: str) -> dict:
    name = "Exposed software"
    try:
        with _connect(ip, host, _ctx(False)) as s:
            s.sendall(f"GET / HTTP/1.1\r\nHost: {host}\r\nUser-Agent: {HTTP_HEADERS['User-Agent']}\r\nAccept: */*\r\n"
                      f"Connection: close\r\n\r\n".encode())
            head = b""
            while b"\r\n\r\n" not in head and len(head) < 16384:
                chunk = s.recv(4096)
                if not chunk:
                    break
                head += chunk
    except OSError:
        return _check(name, "na", "No HTTP response to read version banners from", "バージョン情報を読み取れるHTTP応答なし")
    banners = [ln.split(":", 1)[1].strip() for ln in head.decode("latin-1").split("\r\n")[1:]
               if ln.lower().startswith(("server:", "x-powered-by:"))]
    text = " ".join(banners)
    bad = eol_in(text)
    if bad:
        return _check(name, "warn", f"{', '.join(bad)} on the public web server (end of life)", f"公開サーバーで{'、'.join(bad)}を使用（保守終了）")
    if text:
        return _check(name, "pass", f"Banner: {text[:80]}", f"バナー：{text[:80]}")
    return _check(name, "pass", "No version banners disclosed", "バージョン情報を公開していません")


async def _doh(name: str, rtype: str) -> list[dict]:
    """Hedged lookup: the second resolver starts only if the first has not answered within HEDGE_S; first answer wins."""
    async with httpx.AsyncClient(timeout=DOH_S, headers={**HTTP_HEADERS, "accept": "application/dns-json"}) as c:
        async def ask(url: str, delay: float) -> list[dict]:
            await asyncio.sleep(delay)
            r = await c.get(url, params={"name": name, "type": rtype})
            r.raise_for_status()
            return r.json().get("Answer", [])

        pending = {asyncio.ensure_future(ask(url, i * HEDGE_S)) for i, url in enumerate(DOH)}
        try:
            while pending:
                done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
                for t in done:
                    if not t.exception():
                        return t.result()
        finally:
            for t in pending:
                t.cancel()
    raise NotAvailable("DNS-over-HTTPS unavailable")


async def _txt(name: str) -> list[str]:
    return ["".join(re.findall(r'"((?:[^"\\]|\\.)*)"', a["data"])) or a["data"] for a in await _doh(name, "TXT") if a.get("type") == 16]


def judge_mail(spf: list[str], dmarc: list[str]) -> tuple[str, str, str]:
    s = next((t for t in spf if t.lower().startswith("v=spf1")), None)
    d = next((t for t in dmarc if t.lower().startswith("v=dmarc1")), None)
    parts, ja, worst = [], [], "pass"

    def bump(level: str) -> None:
        nonlocal worst
        worst = max(worst, level, key=("pass", "warn", "fail").index)

    if not s:
        parts.append("No SPF record")
        ja.append("SPFレコードなし")
        bump("fail")
    elif re.search(r"[+?]all\b", s.lower()) or not re.search(r"[~-]all\b", s.lower()):
        parts.append("SPF does not restrict senders")
        ja.append("SPFが送信元を制限していません")
        bump("warn")
    else:
        parts.append("SPF restricts senders")
        ja.append("SPFで送信元を制限")
    if not d:
        parts.append("no DMARC policy")
        ja.append("DMARCポリシーなし")
        bump("fail")
    else:
        policy = (re.search(r"\bp=(\w+)", d.lower()) or [None, "none"])[1]
        parts.append(f"DMARC p={policy}")
        ja.append(f"DMARC p={policy}")
        if policy == "none":
            bump("warn")
    return worst, "; ".join(parts), "、".join(ja)


async def email_protection(host: str) -> dict:
    try:
        return await asyncio.wait_for(_email_protection(host), 10)
    except asyncio.TimeoutError:
        return _check("Email spoofing protection", "na", "DNS lookup timed out", "DNS照会がタイムアウト")


async def _email_protection(host: str) -> dict:
    name = "Email spoofing protection"
    bare = host.removeprefix("www.")
    labels = bare.split(".")
    levels = [bare] + ([".".join(labels[1:])] if len(labels) > 2 else [])
    try:
        for level in levels:  # DMARC discovery falls back to the organisational domain
            spf, dmarc = await asyncio.gather(_txt(level), _txt(f"_dmarc.{level}"))
            if any(t.lower().startswith(("v=spf1", "v=dmarc1")) for t in spf + dmarc):
                break
    except NotAvailable:
        return _check(name, "na", "DNS lookup unavailable", "DNS照会できず")
    status, text, ja = judge_mail(spf, dmarc)
    return _check(name, status, text, ja)


async def _in_thread(fn, name: str, ip: str, host: str) -> dict:
    try:
        return await asyncio.wait_for(asyncio.to_thread(fn, ip, host), THREAD_S)
    except asyncio.TimeoutError:
        return _check(name, "na", f"Timed out after {THREAD_S:.0f}s", f"{THREAD_S:.0f}秒でタイムアウト")


class CyberPosture(SourceAdapter):
    name = "cyber_posture"
    source_name = "Passive cyber posture check"
    url = "https://www.rfc-editor.org/rfc/rfc7489"
    timeout_s = 30.0

    async def live(self, query: dict) -> list[dict]:
        try:
            host = clean_domain(query.get("domain", ""))
        except ValueError as exc:
            raise NotAvailable(str(exc)) from exc
        ip = (await resolve_public(host))[0]
        cert, proto, mail, soft = await asyncio.gather(
            _in_thread(_tls_certificate, "TLS certificate", ip, host), _in_thread(_tls_protocols, "TLS protocols", ip, host),
            email_protection(host), _in_thread(_exposed_software, "Exposed software", ip, host))
        return [{"domain": host, "checks": [cert, proto, mail, soft], "checked_at": datetime.now(timezone.utc).isoformat()}]

    def summarize(self, records: list[dict]) -> str:
        checks = records[0]["checks"] if records else []
        return f"{sum(c['status'] == 'fail' for c in checks)} failed · {sum(c['status'] == 'warn' for c in checks)} warnings"


if __name__ == "__main__":
    assert clean_domain("https://WWW.Example.in:443/about?x=1") == "www.example.in"
    assert clean_domain("info@sunriseauto-demo.in") == "sunriseauto-demo.in"
    for bad in ("localhost", "10.0.0.1", "http://[::1]/", "a_b.com", "-x.com", "foo", ""):
        try:
            clean_domain(bad)
        except ValueError:
            continue
        raise AssertionError(f"accepted {bad!r}")
    assert domain_from_text("Contact: sales@gmail.com, visit https://www.kaveri-eng.in/about") == "kaveri-eng.in"
    assert domain_from_text("mail ops@acme-parts.co.in") == "acme-parts.co.in"
    assert domain_from_text("only gmail: a@gmail.com") is None
    assert eol_in("Apache/2.4.58 (Ubuntu) PHP/7.4.33 OpenSSL/1.1.1w") == ["PHP 7.4", "OpenSSL 1.1"]
    assert eol_in("nginx/1.25.3 PHP/8.3.1") == [] and eol_in("Microsoft-IIS/10.0") == []
    assert judge_mail([], []) == ("fail", "No SPF record; no DMARC policy", "SPFレコードなし、DMARCポリシーなし")
    assert judge_mail(["v=spf1 include:_spf.google.com ~all"], ["v=DMARC1; p=reject"])[:2] == ("pass", "SPF restricts senders; DMARC p=reject")
    assert judge_mail(["v=spf1 +all"], ["v=DMARC1; p=none"])[0] == "warn"
    assert all(c["result_ja"] for c in (_check("x", "pass", "en", "ja"),))
    for ip in ("127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.0.9", "::1", "fc00::1"):
        assert not ipaddress.ip_address(ip).is_global, ip

    assert _txt.__name__ == "_txt"
    print("cyber_posture self-check ok")
