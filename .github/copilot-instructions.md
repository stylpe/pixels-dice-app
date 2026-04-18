- [x] Verify that the copilot-instructions.md file in the .github directory is created.
- [x] Clarify Project Requirements
- [x] Scaffold the Project
- [x] Customize the Project
- [x] Install Required Extensions
- [x] Compile the Project
- [x] Create and Run Task
- [ ] Launch the Project
- [x] Ensure Documentation is Complete

## Project Notes

- Host-first setup. No devcontainer.
- Stack: Vite vanilla TypeScript, pnpm, Biome, Vitest, Playwright.
- App target: browser-only Web Bluetooth client for Pixels dice using @systemic-games/pixels-web-connect.
- Keep Pixels API behind src/pixels wrapper code.
- Verified commands: `pnpm check`, `pnpm test`, `pnpm build`.
- VS Code tasks: `dev`, `build`.
- VS Code launch: `Edge: Launch Pixels App`.
- No required extensions identified.
- Launch step stays pending until user confirms they want debug or run started.
- Unix-style line endings, LF, for all files.
- Preserve LF on every edit. CRLF warnings from git/formatters count as regressions to avoid, not harmless noise.
- After touching files, prefer formatting or save paths that keep existing LF endings intact.
