import { describe, expect, it } from 'vitest';
import { validateContent } from '../../src/core/content';

describe('內容驗證', () => {
  it('資料本身沒有重複 ID、斷掉的參照或不安全的落點', () => {
    expect(validateContent()).toEqual([]);
  });
});

describe('內容驗證會抓出問題', () => {
  it('缺少素材與未實作的劇本會被列出', () => {
    const errors = validateContent({ spriteKeys: new Set(), scripts: new Set() });
    expect(errors.some((e) => e.includes('缺少素材 mon.wickling.front'))).toBe(true);
    expect(errors.some((e) => e.includes('劇本 tutor 尚未實作'))).toBe(true);
  });

  it('完整的素材與劇本都齊全', async () => {
    const { buildSprites } = await import('../../src/art');
    const { SCRIPT_NAMES } = await import('../../src/app/scripts');
    expect(validateContent({ spriteKeys: new Set(buildSprites().keys()), scripts: SCRIPT_NAMES })).toEqual([]);
  });
});
