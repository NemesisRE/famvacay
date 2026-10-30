# Security Policy

## Supported Versions

Only the latest release of FamVacay receives security updates.

| Version        | Supported          |
| -------------- | ------------------ |
| Latest release | :white_check_mark: |
| Older releases | :x:                |

## Reporting a Vulnerability

We take the security of FamVacay very seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

> [!CAUTION]
> Please **do not** report security vulnerabilities via public GitHub issues, discussions or pull
> requests - that discloses them before a fix exists.

Instead:

1. Open a [private security advisory](https://github.com/NemesisRE/famvacay/security/advisories/new) on GitHub (only the maintainers can see it), or send an email to `security@famvacay.us`.
2. Include a detailed description of the vulnerability, steps to reproduce, proof-of-concept payload if applicable, and the impacted environment/version.
3. Allow up to 48 hours for an acknowledgment from the maintainers.

### Security Architecture Highlights

- **Reverse Proxy Termination:** FamVacay is engineered to run exclusively behind a TLS-terminating reverse proxy. No embedded TLS.
- **Header Hardening:** Forwarded headers (`X-Forwarded-*`, RFC 7239 `Forwarded`) are only respected when `TRUST_PROXY=true` and parsed using right-most untrusted hops (`TRUSTED_PROXY_HOPS`).
- **Data Protection:** Personal family profiles, trip plans, and account credentials adhere to strict GDPR standards with cryptographic password hashing (bcrypt), WebAuthn/Passkey support, and complete data deletion workflows.
- **Container Hardening:** The app runs unprivileged (`UID 10001`, `runAsNonRoot`), with a read-only root filesystem, all capabilities dropped and `no-new-privileges`. Database and cache sit on an internal network without host ports or internet access.
- **Supply Chain:** Container images and GitHub Actions are pinned by digest, and dependency updates wait at least a day after their release (pnpm `minimumReleaseAge`, Renovate).

