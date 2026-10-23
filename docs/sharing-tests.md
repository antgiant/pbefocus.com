# Sharing tests (Phase 0, item 5)

These tests decide whether the sharing design in `unified-storage-plan.md` (section 3.8) works as written, or whether the
link-only fallback is needed. They use the lab page in `shared/storage-lab/`, which signs in with the real "PBE Focus" Google
and Microsoft apps. You need two accounts per provider (call them **A** and **B**); a work or school Microsoft account **C**
is a bonus. Use two different browser profiles (or a normal and a private window) so A and B stay signed in side by side.

## Setup (once)

Run the lab from an origin that is registered with both apps. Pick one:

| | Where it runs | Google (authorized JavaScript origin) | Google API key referrer | Microsoft (SPA redirect URI) |
|---|---|---|---|---|
| **Deployed** (recommended; works from any device) | `https://pbefocus.com/shared/storage-lab/` | `https://pbefocus.com` | `https://pbefocus.com/*` | `https://pbefocus.com/shared/storage-lab/` |
| **Local** | `python3 -m http.server 8080 --directory shared/storage-lab` then `http://localhost:8080/` | `http://localhost:8080` | `http://localhost:8080/*` (Google may refuse localhost for referrer restrictions; if the Picker fails locally, use the deployed option) | `http://localhost:8080/` |

The lab page prints the exact origin and redirect URI to register at the top. Microsoft requires an exact redirect URI match,
including the trailing slash.

## Google tests (`drive.file` + `drive.appdata`)

For each test, copy the lab log (button "Copy log") and note the browser.

| # | Steps | What we learn | Expected / hoped |
|---|---|---|---|
| G1 | A: Sign in. Then "Silent token". | Sign-in works; silent renewal works without a popup. | Both succeed. |
| G2 | A: "Create a test folder", "Write a test file", "List folder", "Read newest test file". | Basic read/write in a folder the app created. | All succeed. |
| G3 | A: "Write pointer" then "Read pointer" (appdata). | The settings pointer works. | Both succeed. |
| G4 | In Drive, make a folder with a couple of files you create by hand. A: "Pick a folder" and choose it. "List folder", then "Write a test file". | **Does a picked folder show files the app did not create?** Can we write into it? | Unknown. If list shows only app-created files, tell me the exact output. |
| G5 | A: with the G2 folder chosen, copy its folder ID. Share it to B as **editor**. B: sign in, "Pick a folder" using the **Shared with me** tab, choose it. B: "Folder details", "List folder", "Read newest test file", "Write a test file". A: "List folder". | **Cross-person sharing.** Can B see A's files, write, and does A see B's? | B sees A's file and A sees B's file. |
| G6 | B (still in the browser from G5): in a different browser profile or device, sign in as B and paste the folder ID into "Use folder ID". Do not use the Picker. | Does the grant persist across sessions and devices? | Works (grant stored by Google). If 404, B must re-pick on each device. |
| G7 | A: create a new folder, share it to B as **viewer**. B: pick it, "List folder", "Write a test file". | Viewer-only behavior. | List works; write fails with 403. |
| G8 | A: "Poll folder every 15 s for 3 min". B: write a test file during that time. | Latency and rate-limit behavior of polling a shared folder. | New file appears within one or two polls. |
| G9 | Repeat G1 in Safari and in a private window. | Sign-in and silent token in stricter browsers. | Report any failures. |
| G10 | If the lab is deployed at two registered origins (or from the lab and Karaoke later): pick a folder in one origin, then use "Use folder ID" in the other with the same account. | Whether a grant carries across apps on the same client. | Works. |

## Microsoft tests (`Files.ReadWrite.All`)

| # | Steps | What we learn | Expected / hoped |
|---|---|---|---|
| M1 | A: Sign in (redirect). "Silent token". | Sign-in works; silent renewal works. | Both succeed. |
| M2 | A: "Create a test folder", "Write a test file", "List folder", "Read newest test file". | Basic read/write in a chosen folder. | All succeed. |
| M3 | A: "Write pointer" then "Read pointer" (app folder). | The settings pointer works under the broad scope. | Both succeed. |
| M4 | A: "Browse My files", open a folder, "Choose this folder". | Our own folder chooser built on Graph is usable. | Works. Note anything awkward. |
| M5 | A: invite B as **editor**. B: sign in, click "Shared with me (Graph list)", then try to open the folder. Also try "Browse My files" after adding a shortcut in OneDrive. | **How a recipient finds a shared folder.** | Shared list may be incomplete; note what shows. |
| M6 | A: "Create link" (edit, anyone with the link). B: paste the link into "Use link", then "List folder", "Write a test file". A: "List folder". | Link-based join, cross-person read/write. | Works both directions. |
| M7 | A: invite B as **viewer** (or a view link). B: "Write a test file". | Viewer-only behavior. | Write fails with 403. |
| M8 | A: "Poll folder every 15 s for 3 min" while B writes. | Latency and throttling on a shared folder. | New file appears within one or two polls. |
| M9 | If you have a work/school account **C**: Sign in. Repeat M2 and M6 with C as the owner or recipient. | Does the broad scope need admin approval; what message appears. | Report the exact message. |
| M10 | Repeat M1 in Safari. | Redirect sign-in and silent token in stricter browsers. | Report any failures. |

## What to send back

For each test group, paste the copied log with the test number. The most important results:

- G4: what the Picker exposes in a pre-existing folder.
- G5 and G6: cross-person sharing and whether grants persist across devices.
- M5 and M6: how a Microsoft recipient reliably finds a shared folder.
- Any 403, "not found", or consent-screen messages, word for word.

Clean up with "Delete my test files" afterwards. The lab only deletes files whose names start with `pbe-lab-`.
