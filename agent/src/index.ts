#!/usr/bin/env node
import { Command } from 'commander';
import { linkCommand } from './commands/link.js';
import { agentCommand } from './commands/agent.js';
import { runCommand } from './commands/run.js';

const program = new Command();

program
    .name('pc-insight')
    .description('PC health check agent for pc-insight Cloud')
    .version('0.1.0');

program.addCommand(linkCommand);
program.addCommand(agentCommand);
program.addCommand(runCommand);

program.parse();
