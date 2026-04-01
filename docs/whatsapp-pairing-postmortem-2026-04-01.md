# WhatsApp Pairing Postmortem - 2026-04-01

## Summary

One production agent (`restaurant chez kono`) could reconnect, generate a QR code, and even appear scan-ready, but the pairing flow still failed or became silent after long pauses or manual deactivation/reactivation.

The incident was caused by a chain of state-management bugs around the WhatsApp setup lifecycle, not by one isolated database or credit issue.

## Root cause

The final blocking defect was in the WhatsApp setup watchdog:

1. The bot tracked setup age with `setupPhaseObservedAt`.
2. Fresh QR attempts inherited the age of older failed attempts.
3. The watchdog interpreted valid fresh pairing attempts as stale and killed them before `connection=open`.
4. The phone therefore saw short-lived or invalid QR sessions and reported that the connection could not be completed.

Two surrounding issues made the incident worse:

1. Re-activating an agent did not always resume paused conversations.
2. Reconnect scheduling could leave agents queued or recycled without refreshing the setup age while progress was happening.

## Fixes shipped

The following protections were added:

1. Reactivating an agent resumes active conversations.
2. Reconnect attempts recycle stale sockets instead of trusting broken in-memory state.
3. Scheduled reconnects for `connecting` and `qr_ready` agents are no longer cancelled before they can run.
4. Setup age is reset when a fresh socket attempt starts.
5. Setup age is refreshed when:
   - a QR is generated
   - WhatsApp confirms the QR scan
6. Setup age is cleared when the connection reaches `open`.
7. Deep forensic logs remain available, but noisy low-value traces are now suppressed unless verbose tracing is enabled.

## How to detect similar agents

Admin diagnostics now expose a WhatsApp risk report:

- `GET /api/admin/diagnostics/whatsapp`
- `GET /api/admin/diagnostics/whatsapp-service`

Risk signals include:

1. `connecting` for too long
2. `qr_ready` for too long on an agent that had connected before
3. long-lived `reconnect_required`
4. first-time QR flows that stay unscanned for too long

## Operational guidance

If an agent reaches `qr_ready` and remains there unusually long:

1. Check the admin WhatsApp diagnostics risk report.
2. Confirm whether the agent had connected before.
3. If yes, treat the case as a reconnect incident, not as a simple first pairing.
4. Only reset the QR after confirming the backend is on the latest reconnect fixes.

## Optional verbose tracing

Verbose low-level WhatsApp traces can be re-enabled with:

`WHATSAPP_TRACE_VERBOSE=true`

This is intended for incident debugging only.
