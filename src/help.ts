import { Command, Help } from '@oclif/core';
import chalk from 'chalk';

import { COMMAND_GROUPS } from './command-groups';

export default class MetaHelp extends Help {
  protected formatGroupedCommands(title: string, description: string, commands: Command.Loadable[]): string {
    const body = this.renderList(commands.map(command => {
      const entry = { ...command };

      if (this.config.topicSeparator !== ':') {
        entry.id = entry.id.replaceAll(':', this.config.topicSeparator);
      }

      const summary = this.summary(entry);

      return [
        chalk.cyan(entry.id),
        summary && chalk.gray(summary),
      ];
    }), {
      indentation: 2,
      spacer: '\n',
      stripAnsi: this.opts.stripAnsi,
    });

    const header = `${title}\n  ${description}`;

    return this.section(header, body);
  }

  protected async showRootHelp(): Promise<void> {
    const state = this.config.pjson?.oclif?.state;

    if (state) {
      this.log(state === 'deprecated'
        ? `${this.config.bin} is deprecated\n`
        : `${this.config.bin} is in ${state}.\n`);
    }

    this.log(this.formatRoot());
    this.log('');

    const rootTopics = this.sortedTopics.filter(topic => !topic.name.includes(':'));

    if (rootTopics.length > 0) {
      this.log(this.formatTopics(rootTopics));
      this.log('');
    }

    const rootCommands = this.sortedCommands.filter(command => command.id && !command.id.includes(':'));
    const assignedCommandIds = new Set<string>();

    for (const group of COMMAND_GROUPS) {
      const commands = group.commandIds
        .map(id => rootCommands.find(command => command.id === id))
        .filter((command): command is Command.Loadable => Boolean(command));

      for (const command of commands) {
        assignedCommandIds.add(command.id);
      }

      if (commands.length === 0) {
        continue;
      }

      this.log(this.formatGroupedCommands(group.title, group.description, commands));
      this.log('');
    }

    const remainingCommands = rootCommands.filter(command => !assignedCommandIds.has(command.id));

    if (remainingCommands.length > 0) {
      this.log(this.formatCommands(remainingCommands));
      this.log('');
    }
  }
}
