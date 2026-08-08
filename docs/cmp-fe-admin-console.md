---
kind: component
id: cmp-fe-admin-console
title: "The operator's console"
plane: implementation
part_of: mod-fe-exam-builder
realizes: [feat-admin-console]
depends_on: [cmp-be-admin-api]
repos: [teacher-fe@04014dc]
source: [teacher-fe/src/components/AdminConsole.tsx]
status: fresh
last_verified: 2026-08-08
tags: [frontend, arabic, rtl, admin]
---

# The operator's console

Reached at `#/admin` — an **address, not an inference**. The backend exposes role on no
teacher-facing surface, so auto-detecting an admin would mean firing a privileged request
from every teacher session just to find out. The server stays the sole authority: the
console renders whatever `requireAdmin` allows, and decides nothing itself.

## What it refuses to do

- **Never renders a currency symbol** beside the usage figure. The product runs on a
  subscription; there is no per-exam money, and a KPI labelled in dollars would mislead the
  one person this screen exists to inform.
- **Never shows a hash.** Asserted directly against the rendered output.
- **Never shows an average without its denominator.** The disclosure line states how many
  exams the usage and duration averages were computed over — most exams predate those fields.
- A teacher who navigates to `#/admin` gets a refusal in Arabic and **no data**, and a
  teacher session issues **zero** admin requests.

## One thing only a browser could catch

A truncated teacher id rendered as `…a45e660a`. The ellipsis is bidi-**neutral**, so in an
RTL page it resolved to the paragraph direction and painted to the *left* of the Latin run —
reading as though the id were cut at the wrong end, and pointing an operator at the wrong
place. `textContent` is byte-identical either way, so no jsdom assertion could see it. Fixed
with an `ltr` isolate, and the oracle now pins the isolation rather than the text.
