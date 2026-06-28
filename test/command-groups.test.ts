import { expect } from 'chai';
import fs from 'fs';
import path from 'path';

import { COMMAND_GROUPS, GROUPED_COMMAND_IDS } from '../src/command-groups';

describe('command groups', () => {
  it('lists every grouped command exactly once', () => {
    const ids = COMMAND_GROUPS.flatMap(group => group.commandIds);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).to.equal(ids.length);
  });

  it('covers all root command modules except topics and plugins', () => {
    const commandsDir = path.join(__dirname, '..', 'src', 'commands');
    const rootCommandIds = fs.readdirSync(commandsDir, { withFileTypes: true })
      .flatMap(entry => {
        if (entry.isFile() && entry.name.endsWith('.ts')) {
          return [entry.name.replace(/\.ts$/, '')];
        }

        if (entry.isDirectory() && !['autocomplete', 'account'].includes(entry.name)) {
          return [];
        }

        return [];
      });

    for (const commandId of rootCommandIds) {
      expect(GROUPED_COMMAND_IDS.has(commandId), `missing help group for ${commandId}`).to.equal(true);
    }
  });
});
