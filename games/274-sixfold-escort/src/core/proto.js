// 六器鏢行 — 本機封包層：世界狀態機的每個動作都包成一個二進位封包（ArrayBuffer / DataView），
// 經同一條匯流排派給處理器，方便測試與記錄；沒有真的連網。

export const OPCODES = {
  C2S_MOVE_DATAGRAM: 1001,        // Unreliable Datagram: 高頻位置移動與輕功插值
  C2S_CAST_LINKED_SKILL: 2001,    // Reliable Stream: 匣中取器——「切兵器 + 出招」單一封包
  S2C_COMBAT_DAMAGE_RESULT: 2002, // Reliable Stream: 伺服器權威傷害、五行相剋與破罡廣播
  C2S_USE_SMART_POTION: 2050,     // Reliable Stream: 藥囊瞬補／閾值觸發
  S2C_MECH_STATE_SYNC: 2100,      // Reliable Stream: 偃甲 7s 上機／合體／遺墟 0 樞力同步
  S2C_SESSION_HANDOFF: 3001,      // Reliable Stream: 換手（電腦 <-> 手機）
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class EscortNetBus {
  constructor() {
    this.seqId = 0;
    this.transportMode = 'local-loopback';
    this.lastRttMs = 11;
    this.packetLog = []; // 最近 24 筆封包紀錄（除錯用）
    this.listeners = new Map();
  }

  on(opcode, handler) {
    if (!this.listeners.has(opcode)) this.listeners.set(opcode, []);
    this.listeners.get(opcode).push(handler);
  }

  /**
   * 將訊息編碼為二進位 ArrayBuffer（16-byte Envelope Header + Payload Bytes）
   */
  encodeEnvelope(opcode, payloadObj, clientTimeMs = Date.now()) {
    const seq = ++this.seqId;
    const payloadBytes = encoder.encode(JSON.stringify(payloadObj));
    const buf = new ArrayBuffer(16 + payloadBytes.byteLength);
    const dv = new DataView(buf);
    dv.setUint32(0, opcode, false);
    dv.setUint32(4, seq, false);
    dv.setFloat64(8, clientTimeMs, false);
    new Uint8Array(buf, 16).set(payloadBytes);
    return { buffer: buf, seqId: seq, byteLength: buf.byteLength };
  }

  decodeEnvelope(buffer) {
    const dv = new DataView(buffer);
    const opcode = dv.getUint32(0, false);
    const seqId = dv.getUint32(4, false);
    const clientTimeMs = dv.getFloat64(8, false);
    const payloadStr = decoder.decode(new Uint8Array(buffer, 16));
    return {
      opcode,
      seqId,
      clientTimeMs,
      payload: JSON.parse(payloadStr),
    };
  }

  send(opcode, payloadObj, channel = 'RELIABLE_STREAM') {
    const t0 = performance.now ? performance.now() : Date.now();
    const { buffer, seqId, byteLength } = this.encodeEnvelope(opcode, payloadObj, Date.now());
    const decoded = this.decodeEnvelope(buffer);

    if (opcode !== OPCODES.C2S_MOVE_DATAGRAM) {
      this.packetLog.unshift({
        seqId,
        opcode,
        channel,
        bytes: byteLength,
        summary: summarizePacket(opcode, decoded.payload),
        at: new Date().toISOString().slice(11, 23),
      });
      if (this.packetLog.length > 24) this.packetLog.length = 24;
    }

    const handlers = this.listeners.get(opcode) || [];
    const results = handlers.map((fn) => fn(decoded.payload, decoded));
    const t1 = performance.now ? performance.now() : Date.now();
    this.lastRttMs = Math.max(4, Math.min(28, Math.round((t1 - t0) * 10 + 9)));
    return { seqId, byteLength, results };
  }
}

function summarizePacket(opcode, p) {
  switch (opcode) {
    case OPCODES.C2S_CAST_LINKED_SKILL:
      return `C2S_CastLinkedSkill #${p.skill_id} ⇄ ${p.linked_weapon_uid || '徒手/內功'}`;
    case OPCODES.S2C_COMBAT_DAMAGE_RESULT:
      return `S2C_Damage HP-${p.hp_damage} 罡氣-${p.shield_absorbed}${p.is_shield_broken ? ' [破罡!]' : ''}`;
    case OPCODES.C2S_USE_SMART_POTION:
      return `C2S_SmartPotion ${p.potion_type}${p.is_auto_triggered ? ' [自動閾值]' : ''}`;
    case OPCODES.S2C_MECH_STATE_SYNC:
      return `S2C_MechSync ${p.phase} T${p.mech_tier} 樞力:${p.current_gear}${p.is_free_gear_zone ? ' [遺墟0耗]' : ''}`;
    case OPCODES.S2C_SESSION_HANDOFF:
      return `S2C_Handoff ${p.from_device} → ${p.to_device} (${p.handoff_latency_ms}ms)`;
    default:
      return `Opcode ${opcode}`;
  }
}

const SAVE_KEY = 'sixfold_escort_274_v1';

export function loadSavedState() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStateSnapshot(snapshot) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedState() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
