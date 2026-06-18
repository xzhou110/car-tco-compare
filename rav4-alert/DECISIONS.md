# DECISIONS — Deal Alerts Phase 2

### D1 — Tier: MULTI-DOMAIN built mostly inline (not a full agent crew)
- **Context:** /build invoked to complete Phase 2. Orchestrator holds full context (schema, engine, app); all verification (sending email, dev server) is orchestrator-only.
- **Alternatives:** spawn backend+frontend+qa+reviewer crew.
- **Rationale:** skill guidance biases to fewer agents; cold agents would re-derive context already held, and can't run the email/preview verification loop. Spawn only `reviewer` (independent code review = real value).
- **Reversible?** Yes — can fan out later if a piece proves independent/parallel.

### D2 — alert-cron reads from listings_cache, not Auto.dev
- **Context:** Auto.dev full pulls trip 429; cache already seeded (1863 rows).
- **Rationale:** per-user alerts = pure DB filters → 0 API calls, scales with users. Auto.dev is touched only by cache-refresh.mjs (separate, throttled).
- **Reversible?** Yes.

### D3 — Cron sends to the owner address only (test mode)
- **Context:** Resend unverified domain → can only send to pastnoefuture@gmail.com. User pre-authorized sending test digests to themselves.
- **Rationale:** verify end-to-end now; gate non-owner sends behind domain verification (Phase 3).
