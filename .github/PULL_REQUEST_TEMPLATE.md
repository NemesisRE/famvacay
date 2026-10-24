<!--
Title: Conventional Commits, it becomes the squash commit and decides the release version.
  feat(scope): ...  -> minor      fix(scope): ...  -> patch      feat!: ... -> major
See docs/development.md#pull-requests--releases
-->

## What and why

<!-- What does this change, and why? Link the issue: "Closes #123" -->

## How it was tested

<!-- Unit tests, E2E, manual check in the browser, ... -->

## Checklist

- [ ] `pnpm run lint`, `pnpm run typecheck` and `pnpm test` pass
- [ ] New or changed UI text is translated in all locales (`src/lib/i18n/locales/`)
- [ ] Database changes come with a migration (`prisma/migrations/`)
- [ ] Changes to personal data processing are reflected in the privacy policy
- [ ] Breaking changes are marked with `!` in the title and described above
