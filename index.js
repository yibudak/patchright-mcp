#!/usr/bin/env node
const { program } = require('patchright-core/lib/utilsBundle');
const { decorateMCPCommand } = require('patchright-core/lib/tools/mcp/program');
const { version } = require('./package.json');

decorateMCPCommand(program.version('Version ' + version).name('Patchright MCP'));
void program.parseAsync(process.argv);
