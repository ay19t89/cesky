import { createContext } from 'svelte';

export type View = 'lookup' | 'saved' | 'patterns';
export type ExportFormat = 'csv' | 'xlsx' | 'pdf-a4' | 'pdf-a3';

export interface ToolbarRegistration {
  readonly savedCount: number;
  readonly exportDisabled: boolean;
  onExport: (format: ExportFormat) => void;
}

const emptyToolbar: ToolbarRegistration = {
  savedCount: 0,
  exportDisabled: true,
  onExport: () => {}
};

export class AppShellState {
  toolbar = $state.raw<ToolbarRegistration>(emptyToolbar);
  private openLoginHandler: () => void = () => {};

  registerToolbar(toolbar: ToolbarRegistration): () => void {
    this.toolbar = toolbar;
    return () => {
      if (this.toolbar === toolbar) this.toolbar = emptyToolbar;
    };
  }

  registerLoginHandler(handler: () => void): void {
    this.openLoginHandler = handler;
  }

  openLogin(): void {
    this.openLoginHandler();
  }
}

export const [getAppShell, setAppShell] = createContext<AppShellState>();
