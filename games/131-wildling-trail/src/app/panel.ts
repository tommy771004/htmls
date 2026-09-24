import type { Button, DetailVM, ListRow, PanelVM, QtyVM } from './types';

export interface PanelSpec {
  kind: string;
  title: string | (() => string);
  rows: () => ListRow[];
  detail?: (cursor: number) => DetailVM | undefined;
  hint?: string | (() => string);
  onConfirm: (cursor: number) => void;
  /** 省略代表這個面板不能取消（例如強制換怪）。 */
  onCancel?: () => void;
  onSide?: (delta: -1 | 1) => void;
  qty?: () => QtyVM;
  layout?: PanelVM['layout'];
  cursor?: number;
}

export type PanelResult = 'cursor' | 'confirm' | 'cancel' | 'side' | 'none';

/** 通用清單面板：上下移動游標，確認／取消交給 spec 處理。 */
export class Panel {
  cursor: number;

  constructor(readonly spec: PanelSpec) {
    this.cursor = spec.cursor ?? 0;
  }

  get kind(): string {
    return this.spec.kind;
  }

  private clamp(): number {
    const n = this.spec.rows().length;
    if (n === 0) return (this.cursor = 0);
    this.cursor = Math.max(0, Math.min(n - 1, this.cursor));
    return n;
  }

  press(button: Button): PanelResult {
    const n = this.clamp();
    switch (button) {
      case 'up':
        if (n === 0) return 'none';
        this.cursor = (this.cursor + n - 1) % n;
        return 'cursor';
      case 'down':
        if (n === 0) return 'none';
        this.cursor = (this.cursor + 1) % n;
        return 'cursor';
      case 'left':
      case 'right':
        if (!this.spec.onSide) return 'none';
        this.spec.onSide(button === 'left' ? -1 : 1);
        return 'side';
      case 'confirm':
        if (n === 0 && !this.spec.qty) return 'none';
        this.spec.onConfirm(this.cursor);
        return 'confirm';
      case 'cancel':
      case 'menu':
        if (!this.spec.onCancel) return 'none';
        this.spec.onCancel();
        return 'cancel';
    }
  }

  vm(): PanelVM {
    this.clamp();
    const { spec } = this;
    return {
      kind: spec.kind,
      title: typeof spec.title === 'function' ? spec.title() : spec.title,
      rows: spec.rows(),
      cursor: this.cursor,
      detail: spec.detail?.(this.cursor),
      hint: typeof spec.hint === 'function' ? spec.hint() : spec.hint,
      qty: spec.qty?.(),
      layout: spec.layout,
    };
  }
}
