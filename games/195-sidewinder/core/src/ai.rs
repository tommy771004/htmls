// 對手 AI：前瞻跑線、依 skill 煞車與用氮氣、卡位、脫困
use crate::params::*;
use crate::rng::Rng;
use crate::track::{wrap_pi, Track, PF_MUD, PF_WATER};
use crate::truck::{Ctl, Truck};

pub const M_LINE: u8 = 0;
pub const M_BLOCK: u8 = 1;
pub const M_RECOVER: u8 = 2;

#[derive(Clone, Copy, Default)]
pub struct Ai {
    pub mode: u8,
    pub lane: f32,      // 目前橫向偏移（公尺，右正）
    pub lane_base: f32, // 偏好車道 -1..1（乘上可用半寬）
    pub phase: f32,     // 路線誤差的相位
    pub block_t: f32,
    pub block_cd: f32,
    pub stuck_t: f32,
    pub wrong_t: f32,
    pub recover_t: f32,
    pub recover_dir: f32,
    pub nitro_cd: f32,
    pub blocks: u32,
    pub vallow: f32, // 除錯：目前允許速度
    // 每個起跳點的安全起跳速度快取（0 = 還沒算；skill、輪胎一場內不變）
    pub lip_v: [f32; LIP_CACHE],
}

const LIP_CACHE: usize = 16;

pub struct Ctx<'a> {
    pub tr: &'a Track,
    pub time: f32,
    pub racing: bool,
    pub player: Option<usize>, // 非 AI 的玩家（卡位、追趕平衡的對象）
}

impl Ai {
    pub fn init(rng: &mut Rng, k: usize) -> Ai {
        Ai {
            lane_base: [-0.25, 0.25, -0.1, 0.1][k & 3] + rng.range(-0.15, 0.15),
            phase: rng.range(0.0, 6.28),
            nitro_cd: rng.range(2.0, 5.0),
            block_cd: rng.range(1.0, 3.0),
            ..Ai::default()
        }
    }
}

// 起跳點的安全起跳速度：飛行途中不能煞車也不能轉向，
// 所以要保證（1）直線飛行不會撞牆（2）落地（扣掉落地掉速）後剩下的距離還煞得到前方彎道的安全速度。
// loss_k = 撞擊 1.0 時的落地掉速比例（依避震等級，見 truck.rs）。
pub fn lip_speed(tr: &Track, lip: [f32; 2], alat: f32, b: f32, vcap: f32, loss_k: f32) -> f32 {
    let mut v = vcap;
    while v > 6.0 {
        let (fly, wall, iv) = tr.flight(lip[0], lip[1], v);
        if !wall {
            let vl = v * (1.0 - land_impact(iv) * loss_k);
            let mut ok = true;
            let reach = fly + vl * vl / (2.0 * b) + 10.0;
            let mut d = fly;
            while d <= reach {
                let (.., fl) = tr.sample(lip[0] + d);
                // 剛落地、又常落在泥地／水坑：煞車打 0.75 折（truck.rs 在低抓地面的煞車就是這樣）
                let bl = if fl & (PF_MUD | PF_WATER) != 0 { b * 0.7 } else { b * 0.85 };
                let vs = safe_speed(tr, lip[0] + d, alat);
                if vl * vl > vs * vs + 2.0 * bl * (d - fly) {
                    ok = false;
                    break;
                }
                d += 1.5;
            }
            if ok {
                return v;
            }
        }
        v -= 0.75;
    }
    6.0
}

// 在 s 前方 d 公尺處的安全速度
fn safe_speed(tr: &Track, s: f32, alat: f32) -> f32 {
    let k = tr.curv_at(s).abs().max(0.004);
    let (.., fl) = tr.sample(s);
    // 和 params SURF 的抓地倍率一致（泥地 0.5、水坑 0.55）
    let g = if fl & PF_MUD != 0 {
        0.5
    } else if fl & PF_WATER != 0 {
        0.55
    } else {
        1.0
    };
    (alat * g / k).sqrt()
}

pub fn think(trucks: &[Truck], i: usize, cx: &Ctx, dt: f32, rng: &mut Rng) -> (Ctl, Ai) {
    let me = &trucks[i];
    let tr = cx.tr;
    let mut ai = me.ai;
    let skill = if me.is_ai { me.skill.clamp(0.0, 1.0) } else { 0.8 };
    let v = me.v_long;
    let spd = v.abs();
    let (hw, ..) = {
        let p = tr.sample(me.s);
        (p.4, p.5)
    };

    // 卡位判斷
    ai.block_cd -= dt;
    let mut want_lane;
    let lim = |hw: f32| (hw - 1.3).max(0.2);
    let wob = (cx.time * (0.35 + 0.2 * ai.lane_base.abs()) + ai.phase).sin() * (1.0 - skill) * 1.6;
    // 彎道切內線（高手切得多）
    let kap = tr.curv_at(me.s + 3.0 + 0.3 * spd);
    let apex = (kap * 8.0).clamp(-1.0, 1.0) * (0.35 + 0.5 * skill);
    want_lane = ((ai.lane_base * (1.0 - apex.abs()) + apex) * lim(hw)) + wob;
    if let (Some(p), true) = (cx.player, cx.racing && me.is_ai && !me.finished) {
        let pl = &trucks[p];
        let gap = me.rv - pl.rv; // 玩家落後多少公尺
        let near = (pl.lat - me.lat).abs() < 3.2;
        if ai.mode == M_BLOCK {
            ai.block_t -= dt;
            if ai.block_t <= 0.0 || gap < -0.5 || gap > 16.0 || pl.finished {
                ai.mode = M_LINE;
                ai.block_cd = 6.0 - 2.0 * skill + rng.range(0.0, 1.5);
            } else {
                want_lane = pl.lat;
            }
        } else if ai.mode == M_LINE && ai.block_cd <= 0.0 && gap > 0.5 && gap <= 12.0 && near && !pl.finished && !me.air {
            ai.mode = M_BLOCK;
            ai.block_t = 1.5 + skill;
            ai.blocks += 1;
            want_lane = pl.lat;
        }
    } else if ai.mode == M_BLOCK {
        ai.mode = M_LINE;
    }
    let rate = if ai.mode == M_BLOCK { 4.0 } else { 2.2 };
    let d = (want_lane - ai.lane).clamp(-rate * dt, rate * dt);
    ai.lane += d;

    // 前瞻點
    let la = 3.5 + 0.36 * spd;
    let (px, pz, tx, tz, hwl, _) = tr.sample(me.s + la);
    let lane = ai.lane.clamp(-lim(hwl), lim(hwl));
    let gx = px - tz * lane;
    let gz = pz + tx * lane;
    let ang = wrap_pi((gz - me.z).atan2(gx - me.x) - me.yaw);
    let mut steer = (ang * 2.6).clamp(-1.0, 1.0);

    // 速度規劃：往前看，取可煞停的最低速度
    let gm = upgrade_stat(0, me.tires);
    let alat = BASE_GRIP * gm * (0.6 + 0.44 * skill);
    let b = BRAKE_DECEL * (0.4 + 0.4 * skill);
    let vmax = upgrade_stat(1, me.engine);
    let mut vallow = f32::MAX;
    let mut straight = -1.0; // 前方不用減速的距離
    let horizon = spd * spd / (2.0 * b) + 10.0;
    let mut dd = 0.0;
    while dd <= horizon.max(40.0) {
        let vs = safe_speed(tr, me.s + dd, alat);
        if dd <= horizon {
            vallow = vallow.min((vs * vs + 2.0 * b * dd).sqrt());
        }
        if straight < 0.0 && vs < vmax {
            straight = dd;
        }
        dd += 1.5;
    }
    if straight < 0.0 {
        straight = dd;
    }
    // 起跳點：滯空時不能煞車，前方有跳台就依安全起跳速度限速；跳台接彎道時不算「直線」（不放氮氣）
    let vcap = vmax * NITRO_VMAX * 1.06;
    let scan = horizon.max(40.0);
    let nitro_reach = NITRO_TIME * vcap + 8.0;
    for (li, lip) in tr.lips.iter().enumerate() {
        let dj = tr.wrap_s(lip[0] - me.s);
        if dj > scan.max(nitro_reach) {
            continue;
        }
        let vl = if li < LIP_CACHE && ai.lip_v[li] > 0.0 {
            ai.lip_v[li]
        } else {
            // 落地掉速依自己的避震等級估計（打 7 折留餘裕：撞擊預測不準）
            let v = lip_speed(tr, *lip, alat, b, vcap, 0.7 * land_loss(me.shocks));
            if li < LIP_CACHE {
                ai.lip_v[li] = v;
            }
            v
        };
        if dj <= scan {
            vallow = vallow.min((vl * vl + 2.0 * b * dj).sqrt());
        }
        // 需要比一般極速還慢才能安全起跳：和彎道一樣算煞車點（不在它前面放氮氣）
        if vl < vmax && dj < nitro_reach {
            straight = straight.min(dj);
        }
    }
    // 目前離路線太偏時（大角度）先減速
    if ang.abs() > 0.9 {
        vallow = vallow.min(7.0);
    }
    ai.vallow = vallow;
    let thr_max = (0.68 + 0.32 * skill) * me.thr_cap;
    let mut thr;
    let mut brk = 0.0;
    if spd > vallow + 1.0 {
        thr = 0.0;
        brk = ((spd - vallow) / 5.0).clamp(0.2, 1.0);
    } else if spd > vallow {
        thr = 0.25 * thr_max;
    } else {
        thr = thr_max;
    }

    // 氮氣
    ai.nitro_cd -= dt;
    let mut nitro = false;
    if cx.racing && me.nitro_n > 0 && me.nitro_t <= 0.0 && ai.nitro_cd <= 0.0 && !me.air && !me.finished {
        // 前方要有夠長的直線（高手算得準，新手常浪費在彎前）
        let clear = straight > 34.0 - 8.0 * skill;
        let sloppy = rng.f() < 0.03 * (1.0 - skill);
        if (clear && spd > vmax * 0.45 && ang.abs() < 0.3) || sloppy {
            if rng.f() < 0.3 + 0.7 * skill || sloppy {
                nitro = true;
            }
            ai.nitro_cd = 3.0 + (1.0 - skill) * 5.0 + rng.range(0.0, 2.0);
        } else {
            ai.nitro_cd = 0.25;
        }
    }

    // 卡住／逆向偵測 → 倒車脫困
    if cx.racing {
        if ai.mode == M_RECOVER {
            ai.recover_t -= dt;
            thr = 0.0;
            brk = 1.0;
            steer = -ai.recover_dir;
            nitro = false;
            if ai.recover_t <= 0.0 {
                ai.mode = M_LINE;
                ai.stuck_t = 0.0;
                ai.wrong_t = 0.0;
            }
        } else {
            if spd < 1.0 && thr > 0.2 && !me.air {
                ai.stuck_t += dt;
            } else {
                ai.stuck_t = (ai.stuck_t - 2.0 * dt).max(0.0);
            }
            if ang.abs() > 1.9 && spd < 4.0 {
                ai.wrong_t += dt;
            } else {
                ai.wrong_t = 0.0;
            }
            if ai.stuck_t > 1.5 || ai.wrong_t > 1.0 {
                ai.mode = M_RECOVER;
                ai.recover_t = 1.0 + rng.range(0.0, 0.5);
                ai.recover_dir = if ang >= 0.0 { 1.0 } else { -1.0 };
                ai.stuck_t = 0.0;
                ai.wrong_t = 0.0;
            }
        }
    }
    if ai.mode != M_RECOVER && ang.abs() > 1.2 {
        steer = if ang > 0.0 { 1.0 } else { -1.0 };
    }
    (Ctl { steer, thr, brk, nitro }, ai)
}
