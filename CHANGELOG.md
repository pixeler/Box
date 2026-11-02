# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Repository scaffolding for the open-source release: README, MIT license,
  contribution, security and conduct guides, issue and pull request templates,
  CI and release workflows.

### Fixed
- Typing a space in a note no longer throws the caret into a task list: the
  note's task cards and add-task row can neither take focus nor swallow the
  space bar, and the editor keeps the keyboard.

### Security
- The desktop window refuses to navigate away from the app, and only `http`,
  `https` and `mailto` links reach the system browser, so note content can no
  longer launch local files or registered protocol handlers.
- The renderer runs in the OS sandbox, and camera, microphone, location and
  MIDI permission requests are refused instead of prompted.
- Note PDF export prints in a sandboxed renderer with scripting off, and
  exported documents keep only web and mail links (`javascript:` and `file:`
  links lose their anchor).
- The app shell ships a Content-Security-Policy: own-bundle scripts, no
  plugins, no foreign frames and no eval.
- The PDF bridge sanitises its suggested file name instead of trusting the
  renderer's string, and the app protocol handler rejects malformed URLs.

## [0.1.0] — 2026-11-02

First public release. SpaceZen was built as a private second-brain app and this
tag marks the point where it became open source.

### Added
- Block editor on BlockNote with custom task, task-reference and **bookmark**
  blocks, slash-menu entries and Persian UI strings.
- Notes: templates with icon/cover/colour, notebooks, nested folders, tags,
  version history, Markdown and PDF export.
- Tasks: inbox and project lists, priorities, due dates, repeats, kanban view,
  and inline task blocks inside notes.
- Jalali calendar with month/week/day views and a merged day stream of notes,
  tasks and events.
- Focus sessions with ambient soundscapes, desktop badge/title countdown and
  focus history.
- Quick capture, full-text search and resurfacing of older notes.
- Local-first storage on Dexie with optional Supabase cloud sync.
- Desktop shell for Windows (Electron) and an Android build (Capacitor).

### Changed
- Pasted content now prefers HTML over plain text, so formatting survives a
  paste; a bare URL on an empty line becomes a bookmark card.
- The product, window title, manifest and artifacts are named **SpaceZen**
  consistently; the previous "Box" profile folder is migrated on first launch.

### Fixed
- Space and Enter no longer activate controls inside note task blocks, which
  used to move the caret out of the paragraph being edited.

### Removed
- Dead code from earlier designs: the legacy `lime` design system, unused
  calendar and notebook views, and orphaned assets.
