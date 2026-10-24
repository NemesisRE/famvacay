# Contributing to FamVacay

Thanks for helping! Bug reports, ideas and pull requests are all welcome.

- **Bugs and ideas:** open an [issue](https://github.com/NemesisRE/famvacay/issues/new/choose).
- **Security issues:** never in a public issue. Use a
  [private security advisory](https://github.com/NemesisRE/famvacay/security/advisories/new),
  see [SECURITY.md](SECURITY.md).

## Pull requests

1. Set up the project as described in [docs/development.md](docs/development.md).
2. Create a branch from `main` and keep the change focused on one thing.
3. Before pushing, run `pnpm run lint`, `pnpm run typecheck` and `pnpm test`.
4. Give the pull request a [Conventional Commits](https://www.conventionalcommits.org/) title, for
   example `feat(share): add expiry date to shared links` or `fix(optimizer): ...`. The title
   becomes the squash commit on `main`, sets the release labels and decides the next version
   (`feat` → minor, `fix` and others → patch, `!` → major). A check enforces the format.

Changes reach `main` only through pull requests; all CI checks must pass before merging.

## Conventions

- UI text goes into every locale in `src/lib/i18n/locales/` (an automated check compares the keys).
- Database changes need a Prisma migration in `prisma/migrations/`.
- Anything that changes which personal data is processed must also update the privacy policy
  (`src/components/legal/PrivacyContent.tsx` and the `legal` locale strings).

By contributing you agree that your contribution is licensed under the project's
[AGPL-3.0 license](LICENSE).
