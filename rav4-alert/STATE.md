# STATE — Deal Alerts Phase 2

**Phase:** Phase 2 built & verified, plus the 10-item refinement pass. Double opt-in is code-complete but needs one SQL paste to activate.

## Done & verified (this pass)
- #2 Header buttons reordered: Load a real car · Get deal alerts · Share · theme · Reset(set apart). Verified live.
- #3 Form: "up to 3 preferences" copy; per-preference Name field (defaults to make+model / "Preference N"). Verified.
- #2b Form: Min price + Max price (was max only); "XLE and above only" shows ONLY for RAV4 models. Verified (RAV4/RAV4 Hybrid show it; Accord hides it). Cron honors priceMin + RAV4-only XLE.
- #5 Email/sheet use the stored preference NAME (not "List 1/2"). Verified.
- #6 Top-10 table: removed "Per year"; "Days" → "Days on mkt". Verified.
- #7 Only top-10 TCO highlighted green; others regular. Verified (7 non-green, top-10 green).
- #8 Detail sheet vdp + carfax are clickable hyperlinks. Verified (cell.value.hyperlink set).
- #9 Friendly greeting + summary intro. Verified; real email sent (id 9d0b2b40).
- #4 Unsubscribe link in every digest footer. Verified present.
- Confirm/Unsubscribe pages route via #/confirm + #/unsubscribe (render verified; RPC pending SQL).
- 0 console errors; app build green.

## Pending — ONE user action unblocks the rest
- **USER: run `rav4-alert/supabase/phase2b.sql` once in the Supabase SQL editor.** It bundles: hardened anon-insert RLS (`with check (confirmed=false)`), the `confirmation_sent_at` column, and the `confirm_subscriber` + `unsubscribe_all` SECURITY DEFINER RPCs. After that, `send-confirmations.mjs`, the confirm page, and the unsubscribe link all work — I'll verify them live.
- (Can't run DDL myself — only the API keys, not the DB password.)

## Phase 3 (later)
Deploy app to GitHub Pages; add GH Actions secrets; verify a Resend domain (SPF/DKIM/DMARC) before emailing non-owner addresses; Stripe paywall; real scheduler. Reviewer should-fixes S1/S2/S3. Auto.dev commercial license before charging.
