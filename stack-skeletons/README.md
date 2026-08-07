# stack-skeletons/ — one sub-issue skeleton per repo key

> Renamed from `stacks/` (WF-78): in a project, `stacks/` holds the REPO CHECKOUTS.
> These are the per-stack sub-issue templates `tools/provision` overlays into every
> new feature job's `features/<slug>/stacks/`.


★ PROFILE — FILL ME (workflow/PROFILE.md item 6). Write one `<key>.md` here per
repo key in `repos.sh`, from the engine's
[`_stack.md.template`](../../../features/_templates/feature/stack-skeletons/_stack.md.template).

`tools/provision` copies every `*.md` in this dir into a new feature job's
`stack-skeletons/` folder, on top of the engine template — so each job starts with the
right stack files for THIS project's repos, already named.
