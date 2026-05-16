# patchright-mcp

**Drop-in stealth replacement for `@playwright/mcp`.** Same tools, same flags — but the browser underneath is [Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright), an undetected Chromium fork. Six lines of code: a thin shim over the MCP server bundled inside `patchright-core`.

## Install (Claude Code)

```bash
claude mcp add patchright -s user -- npx -y @yibudak/patchright-mcp
```

Or from source:

```bash
git clone https://github.com/yibudak/patchright-mcp.git
cd patchright-mcp
npm install   # also downloads patched Chromium via patchright
claude mcp add patchright -s user -- node "$PWD/index.js"
```

## How it works

Microsoft ships [`@playwright/mcp`](https://github.com/microsoft/playwright-mcp) as a thin wrapper around an MCP server that lives inside `playwright-core` itself. Vinyzu ships [`patchright-core`](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright), which is `playwright-core` with stealth patches applied to the Chromium launcher (no `Runtime.enable` leak, `--disable-blink-features=AutomationControlled`, shadow-DOM piercing, etc.).

This package is just:

```js
#!/usr/bin/env node
const { program } = require('patchright-core/lib/utilsBundle');
const { decorateMCPCommand } = require('patchright-core/lib/tools/mcp/program');
const { version } = require('./package.json');

decorateMCPCommand(program.version('Version ' + version).name('Patchright MCP'));
void program.parseAsync(process.argv);
```

So you get **every tool and CLI flag of `@playwright/mcp`** — browser navigation, accessibility snapshots, click-by-ref, network interception, multi-tab, extension bridge, CDP relay, codegen — but the underlying Chromium is patched against detection.

## Stealth tips

- `--browser=chrome` to use your installed Chrome instead of bundled Chromium.
- `--user-data-dir <path>` for a persistent profile. Cookies and fingerprints survive between runs — the strongest passive stealth signal.
- Skip `--headless`. Headless Chrome is detectable; default is headed.

## CLI flags

Run `npx @yibudak/patchright-mcp --help` for the full list. Identical to `@playwright/mcp`.

## Why not the `patchright-mcp` already on npm?

There is an unscoped `patchright-mcp` package on npm (publisher `ikaleio`) whose `repository` URL points to a GitHub repo that does not exist (`Kaliiiiiiiiii-Vinyzu/patchright-mcp` — 404). This package is scoped under `@yibudak/`, lives at the URL it claims, and is small enough to read in a minute.

## Credits

- **[Microsoft Playwright](https://playwright.dev/)** — underlying automation framework and MCP server design ([microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp), Apache-2.0).
- **[Vinyzu's Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright)** — stealth patches and the bundled MCP runtime (Apache-2.0).

## License

Apache-2.0
