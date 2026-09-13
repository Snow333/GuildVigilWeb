> **What this is:** the automated checks that run on every push. See `.github/workflows/check.yml`.
>
> ⚠ **CI passing is NOT proof the game runs.** These checks run on Linux; Steven plays on Windows,
> and the one bug class that has actually shipped a blank page — two modules differing only by
> case — passes every Linux test. After any change that adds files or moves module wiring, the
> `pnpm dev` check on Windows is still required. CI reduces the manual burden; it does not replace it.
