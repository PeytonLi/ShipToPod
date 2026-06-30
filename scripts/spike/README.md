# Go / No-Go Spike

Run these with real keys in `.env.local` **before** spawning the parallel feature
agents (engine / infra / ui). This is the main de-risking lever. All four must pass.

```bash
node scripts/spike/deepseek.mjs       # (a) DeepSeek teacher + student respond (HARD GATE)
node scripts/spike/runner-sql.mjs     # (b) SQLite test runner accepts + rejects
node scripts/spike/runner-python.mjs  # (c) pytest subprocess runner accepts + rejects
bash  scripts/spike/prime.sh          # (d) prime CLI authed (+ <run-id> to capture metrics)
```

Outputs two committed fixtures:
- `packages/inference/__fixtures__/break-fix.sample.json`
- `packages/trainer/__fixtures__/metrics.sample.txt`

If `deepseek.mjs` reports the student model 404, set `STUDENT_PROVIDER=runpod-flash`
and `STUDENT_BASE_URL=<endpoint>` in `.env.local` and record it in `docs/DECISIONS.md`.
