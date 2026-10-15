# Security Policy

## Supported Versions

Only the latest release of FamVacay receives security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of FamVacay very seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

Please **do not** report security vulnerabilities via public GitHub issues. Instead:

1. Send an email to `security@famvacay.local` (or file a private GitHub Security Advisory).
2. Include a detailed description of the vulnerability, steps to reproduce, proof-of-concept payload if applicable, and the impacted environment/version.
3. Allow up to 48 hours for an acknowledgment from the maintainers.

### Security Architecture Highlights

- **Reverse Proxy Termination:** FamVacay is engineered to run exclusively behind a TLS-terminating reverse proxy. No embedded TLS.
- **Header Hardening:** Forwarded headers (`X-Forwarded-*`, RFC 7239 `Forwarded`) are only respected when `TRUST_PROXY=true` and parsed using right-most untrusted hops (`TRUSTED_PROXY_HOPS`).
- **Data Protection:** Personal family profiles, trip plans, and account credentials adhere to strict GDPR standards with cryptographic password hashing (bcrypt), WebAuthn/Passkey support, and complete data deletion workflows.
- **Container Hardening:** Containers run unprivileged (`UID 10001`, `runAsNonRoot`), with `readOnlyRootFilesystem: true`, `cap_drop: [ALL]`, and `no-new-privileges: true`.

