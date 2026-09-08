# Call recording plan — FreePBX 16.0.50

Status: **proposal, awaiting decision** (2026-09-08). Nothing here is implemented yet.

The omnichannel backend already *consumes* recordings — `getCallRecordings()`
lists CDRs with `recordingfile`, and `getRecordingFileStream()` streams the audio
through the FreePBX admin session. What is not yet decided is **how to make
sure agent calls actually get recorded**. This document explains how FreePBX
decides to record (read from the 16.0 source, not from memory), then proposes a
two-phase plan.

---

## 1. How FreePBX decides to record a call

Recording is not a single on/off switch. Every call passes several
**checkpoints**, and at each one FreePBX asks "does this object have an opinion?"
The logic lives in the `callrecording` module's `sub-record-check` dialplan
subroutine.

### 1.1 The five values

| Value | Meaning in the dialplan |
|---|---|
| **Force** | Start recording now if not already recording. Later "No" cannot stop it. |
| **Yes** | Start recording — *unless* an earlier checkpoint said Never/No, or it is already recording. |
| **Don't Care** | Change nothing. Whatever an earlier checkpoint decided stands. *(default everywhere)* |
| **No** | Prefer not to record — but does **not** stop a recording already running. |
| **Never** | Stop recording now and block later "Yes". |

Force and Never are absolute; Yes and No are suggestions; Don't Care is silence.

### 1.2 The checkpoints, in call order

```
Inbound call:   Inbound Route ──► (IVR) ──► Queue / Ring Group ──► Agent extension
                    "in"                       "q" / "rg"              "exten"

Outbound call:  Agent extension ──► Outbound Route
                    out/external           "out"
```

- **Inbound Route** — its Call Recording value is applied as-is. If Force, recording
  starts here and therefore *includes IVR prompts and queue hold time*.
- **Queue** — its Call Recording value is applied as-is when the caller enters the queue.
- **Agent extension (inbound)** — the queue tags the leg as *external*, so the
  extension's **Inbound External Calls** value is consulted. Don't Care = nothing changes.
- **Agent extension (outbound)** — the extension's **Outbound External Calls** value
  is consulted **first**. If it is Don't Care, the **Outbound Route**'s value is used.
  If the route says Force or Never, the route always wins.
- **Extension ↔ extension (internal)** — callee's *Inbound Internal* vs caller's
  *Outbound Internal*; if both have an opinion, the higher **Record Priority Policy**
  (0–20, default 10) wins.
- **Transfers** — a transferred leg starts with recording status "NO"; only a
  Force at the new destination restarts it.

### 1.3 Where the per-extension setting is stored — and why it matters to us

Per-extension recording is stored **only in AstDB** (Asterisk's internal
key/value store), six keys per extension:

```
AMPUSER/<ext>/recording/in/external    force|yes|dontcare|no|never
AMPUSER/<ext>/recording/out/external
AMPUSER/<ext>/recording/in/internal
AMPUSER/<ext>/recording/out/internal
AMPUSER/<ext>/recording/ondemand       disabled|enabled|override
AMPUSER/<ext>/recording/priority       0-20
```

Consequences, all verified against the source:

- **Not in MariaDB** — the MySQL path built for WebRTC settings cannot reach it
  (`users.recording` is a legacy column and is empty).
- **Not in GraphQL** — `addExtension`/`updateExtension` have no recording inputs.
- **`updateExtension` deletes and recreates the extension** (`delDevice` +
  `delUser` + `processQuickCreate`). Anything written to the extension before it
  — AstDB recording keys, and also our `sip`/`certman_mapping` rows — is wiped.
  Our `enableWebrtcSettings()` already runs *after* it; any recording write must too.
  **Guard-rail:** if the backend ever gains another `updateExtension` call
  (e.g. a rename), it must re-run the post-create steps.
- The UI reads these keys back, so anything we write shows correctly in
  Applications → Extensions → Recording Options.

### 1.4 The recording file

When recording starts, FreePBX runs MixMonitor writing to

```
<MIXMON_DIR>/YYYY/MM/DD/<type>-<dest>-<from>-<YYYYMMDD-HHMMSS>-<uniqueid>.<MIXMON_FORMAT>
```

and sets `CDR(recordingfile)` to that filename — the field the backend already
reads. `MIXMON_DIR` defaults to `/var/spool/asterisk/monitor/`, `MIXMON_FORMAT`
to `wav` (≈ 1 MB per minute of call). There is **no built-in retention** —
files accumulate until something deletes them.

---

## 2. Worked examples for this deployment

Agents are created by the backend with FreePBX defaults: all four directions
**Don't Care**, on-demand disabled, priority 10.

| # | Scenario | Route / Queue setting | Agent setting | Result |
|---|---|---|---|---|
| 1 | Customer → DID → Queue → Agent | Inbound Route **Force** | Don't Care | Recorded from the first ring, including IVR and hold. Agent changes nothing. |
| 2 | Customer → DID → Queue → Agent | Inbound Route Don't Care, Queue **Force** | Don't Care | Recorded from queue entry. IVR before the queue is not recorded. |
| 3 | Agent → customer | Outbound Route **Force** | Don't Care | Agent is Don't Care → route decides → recorded. |
| 4 | Agent → customer | Outbound Route Don't Care | Don't Care | **Not recorded.** Nobody had an opinion. |
| 5 | Customer → DID → Queue → Agent | everything Don't Care | Inbound External **Force** | Recorded — but only from the moment the agent answers. Hold/IVR lost. |
| 6 | Agent → Agent (internal) | n/a | both Don't Care | Not recorded. Usually what you want. |
| 7 | Agent transfers customer to Agent B | Inbound Route Force | Don't Care | Recording continues on the original channel; B's leg starts unrecorded unless B is Force. |

Rows 1 + 3 are the contact-center pattern: **record at the route level, keep
agents at Don't Care**. Row 5 shows why per-agent Force is *worse* for a
contact center — it misses the hold time and depends on every agent being set.

---

## 3. Recommendation

**Phase 1 — record at route/queue level. No code. Do this first.**
It covers 100 % of customer calls regardless of which agent answers, cannot
miss a newly created agent, and a policy change is one edit instead of N.

**Phase 2 — per-agent settings via AMI. Optional. Only if Phase 1 cannot
express a requirement** (agent-to-agent internal recording, per-agent opt-out,
or giving agents on-demand `*1` control).

---

## 4. Phase 0 — verify the current state (10 minutes, on the PBX as root)

```bash
# Where and how recordings are written today
fwconsole setting MIXMON_DIR; fwconsole setting MIXMON_FORMAT
du -sh /var/spool/asterisk/monitor 2>/dev/null; df -h /var/spool

# Recording settings currently set on routes/queues (empty = nothing set = Don't Care)
mysql asterisk -e "SELECT display, extension AS did, cidnum, callrecording FROM callrecording_module"
mysql asterisk -e "SELECT extension AS queue, data AS recording FROM queues_config WHERE keyword='recording'"

# A reference agent's per-extension settings (all dontcare expected)
asterisk -rx "database show AMPUSER/3022/recording"

# Does the backend's recording endpoint already return files for recent calls?
mysql asteriskcdrdb -e "SELECT calldate, src, dst, disposition, recordingfile FROM cdr ORDER BY calldate DESC LIMIT 10"
```

Also: Settings → Advanced Settings → search "Call Recording" — confirm
**Call Recording Policy** (`REC_POLICY`) and note **MIXMON_FORMAT**.

---

## 5. Phase 1 — route/queue-level recording (no code)

All in the FreePBX admin UI, once, then **Apply Config**.

1. **Connectivity → Inbound Routes** → each DID that reaches agents → *Other* tab →
   **Call Recording = Force**. This captures IVR and hold time (example 1).
2. **Connectivity → Outbound Routes** → each route agents dial through →
   *Additional Settings* → **Call Recording = Force** (example 3).
3. **Applications → Queues** → each agent queue → *General* → **Call Recording =
   Force**. Redundant with step 1 for calls that came through a DID, but covers
   calls entering the queue from anywhere else (example 2). Harmless: Force on
   an already-recording call is a no-op.
4. Leave agent extensions at Don't Care — exactly what the backend creates.

Verify: place one inbound and one outbound test call, then

```bash
mysql asteriskcdrdb -e "SELECT calldate, src, dst, recordingfile FROM cdr ORDER BY calldate DESC LIMIT 2"
```

Both rows must have a non-empty `recordingfile`, and the omnichannel UI must
play them via the existing endpoint.

### Operational items that come with Phase 1

- **Disk / retention.** `wav` ≈ 1 MB/min. 20 agents × 4 h talk-time/day ≈ 5 GB/day.
  Decide a retention period and enforce it — FreePBX will not. Simplest:
  a root cron on the PBX, e.g. 90 days:
  `find /var/spool/asterisk/monitor -type f -mtime +90 -delete`.
  Note this leaves `recordingfile` in the CDR pointing at a deleted file; the
  backend's stream endpoint should return 404 gracefully for that case.
- **Format.** Keep `wav` unless space forces a change; `wav49` (GSM) is ~10×
  smaller but noticeably worse, and browsers play `wav` natively.
- **Legal notice.** If callers must be told they are recorded, that is an
  announcement on the Inbound Route / IVR — not a recording setting.

---

## 6. Phase 2 — per-agent recording via AMI (optional)

Only if a requirement cannot be met by Phase 1. Mechanism: after
`enableWebrtcSettings()`, the backend connects to Asterisk's Manager Interface
(AMI, TCP 5038 — what FreePBX's own UI uses to write AstDB) and sends six
`DBPut` actions.

### PBX-side one-time setup

```
# /etc/asterisk/manager_custom.conf
[omni-ami]
secret = <openssl rand -base64 32>
deny   = 0.0.0.0/0.0.0.0
permit = 10.8.0.100/255.255.255.255
read   =
write  = system          ; DBPut/DBGet/DBDel need the "system" class
```

then `asterisk -rx "manager reload"`. Check `grep -E '^(bindaddr|port)'
/etc/asterisk/manager.conf` — if it is `127.0.0.1`, it must be widened (this
file is generated by FreePBX; change it via the Asterisk Manager settings in
Advanced Settings, not by hand) and 5038 firewalled to `10.8.0.100` exactly as
was done for 3306.

### Backend change (≈ half a day including test)

- New env: `FREEPBX_AMI_HOST`, `FREEPBX_AMI_PORT=5038`, `FREEPBX_AMI_USER`,
  `FREEPBX_AMI_SECRET`, and a `FREEPBX_RECORDING_POLICY` (or constants) holding the
  six values.
- A ~60-line AMI client on Node's `net` module (login → N × DBPut → logoff), or
  the `asterisk-ami-client` package.
- `applyRecordingPolicy(extensionId)` called right after `enableWebrtcSettings()`
  — i.e. after `updateExtension`, for the reason in §1.3 — with the same
  rollback-on-failure pattern.
- Verify: `asterisk -rx "database show AMPUSER/<ext>/recording"` and the
  extension's Recording Options in the UI.

### What Phase 2 would let us express that Phase 1 cannot

- Record agent-to-agent internal calls (Inbound/Outbound Internal = Force).
- Exempt specific agents (Never) while routes say Force.
- Give agents one-touch `*1` on-demand recording (`ondemand = enabled`),
  which for the WebRTC softphone means sending DTMF `*1` mid-call.

---

## 7. Decisions needed

1. Go with Phase 1? If so, which Inbound Routes, Outbound Routes and Queues
   carry agent traffic (or "all of them").
2. Retention period for recordings (days) — and who owns the cron.
3. Is there any requirement from §6 that forces Phase 2 now? If not, defer it.
