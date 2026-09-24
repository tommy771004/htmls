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
  /** 以格子排列時的欄數；上下移動一整列，左右在同一列內移動。 */
  columns?: number;
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
    const cols = this.spec.columns ?? 1;
    if (cols > 1 && n > 0 && (button === 'up' || button === 'down' || button === 'left' || button === 'right')) {
      return this.moveInGrid(button, n, cols);
    }
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

  /** 格子移動：碰到邊緣就停住，不會繞回另一邊。 */
  private moveInGrid(button: 'up' | 'down' | 'left' | 'right', n: number, cols: number): PanelResult {
    const col = this.cursor % cols;
    let next = this.cursor;
    if (button === 'up') next = this.cursor - cols;
    else if (button === 'down') next = this.cursor + cols;
    else if (button === 'left') next = col > 0 ? this.cursor - 1 : -1;
    else next = col < cols - 1 ? this.cursor + 1 : -1;
    if (next < 0 || next >= n) return 'none';
    this.cursor = next;
    return 'cursor';
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
      columns: spec.columns,
    };
  }
}
