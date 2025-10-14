import os from 'os';
import { AccessControl } from '../helpers/access-control';
import { FileSystem } from '../sources/file-system/file-system';
import { AppConfig, SourceConfig } from '../types';
import type { ISource } from '../types/abstract-file-system';

export class Config {
  access: AccessControl;

  private sources: { [key: string]: Promise<ISource> } = {};

  async makeSource(
    sourceConfig: SourceConfig,
    config: Config,
    name: string
  ): Promise<ISource> {
    // TODO Another source types
    return new FileSystem(sourceConfig, config, name);
  }

  constructor(public readonly params: AppConfig) {
    this.access = new AccessControl(params.accessControl);

    if (this.params.sources != null) {
      for (const sourceConfigName in this.params.sources) {
        this.sources[sourceConfigName] = this.makeSource(
          this.params.sources[sourceConfigName]!,
          this,
          sourceConfigName
        );
      }
    } else {
      this.sources['default'] = this.makeSource(
        {
          title: 'Default',
          name: 'default',
          root: os.homedir(),
          baseurl: params.baseurl || '/files'
        },
        this,
        'default'
      );
    }
  }

  async getSources(): Promise<ISource[]> {
    return Promise.all(Object.values(this.sources));
  }

  async getUserRole(): Promise<string> {
    return this.params.defaultRole;
  }
}
