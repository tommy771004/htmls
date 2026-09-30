// 所有調校數值集中在這裡

pub const DIRT: u8 = 0;
pub const LOOSE: u8 = 1;
pub const MUD: u8 = 2;
pub const WATER: u8 = 3;
pub const JUMP: u8 = 4;
pub const RAMP: u8 = 5;
pub const WALL: u8 = 6;
pub const INFIELD: u8 = 7;

// 卡車固定幾何（SPEC §4）
pub const AXLE_F: f32 = 0.85;
pub const AXLE_R: f32 = -0.85;
pub const TRACK_HALF: f32 = 0.78;
pub const WHEEL_R: f32 = 0.42;
pub const WHEELBASE: f32 = AXLE_F - AXLE_R;
pub const BODY_R: f32 = 0.85; // 撞牆：兩個圓
pub const BODY_CX: f32 = 0.45;
// 卡車互撞：有向矩形半長、半寬（對齊 blender/trucks.py 車身外緣：保險桿 ±1.44、車側 ±0.87）
pub const BOX_HX: f32 = 1.42;
pub const BOX_HZ: f32 = 0.86;

// 世界
pub const GRAVITY: f32 = 15.5; // 街機重力，滯空短一點
pub const SLOPE_G: f32 = 9.0; // 坡度加減速用的重力分量
pub const MAX_DT: f32 = 1.0 / 30.0;
pub const SUB_DT: f32 = 1.0 / 120.0;

// 引擎、煞車
pub const BASE_VMAX: f32 = 17.0;
pub const VMAX_PER_LVL: f32 = 0.06; // lvl5 = +30%
pub const BASE_ACCEL: f32 = 11.5;
pub const ACCEL_PER_LVL: f32 = 0.9;
pub const BRAKE_DECEL: f32 = 22.0;
pub const REVERSE_VMAX: f32 = 6.0;
pub const REVERSE_ACCEL: f32 = 8.0;
pub const ROLL_DRAG: f32 = 1.2; // 放油門時的滾動阻力 m/s²
pub const OVERSPEED_K: f32 = 3.0; // 超過地面極速時的減速係數 1/s

// 輪胎
pub const BASE_GRIP: f32 = 16.5; // 側向加速度上限 m/s²
pub const GRIP_PER_LVL: f32 = 0.07;
pub const STEER_MAX_LO: f32 = 0.62; // 低速最大轉角（弧度）
pub const STEER_MAX_HI: f32 = 0.24; // 高速
pub const STEER_RATE: f32 = 6.0; // 方向盤回應 1/s
pub const SCRUB: f32 = 0.18; // 側滑時吃掉的縱向速度比例

// 避震
pub const SUSP_K: f32 = 160.0;
pub const SUSP_C: f32 = 16.0;
pub const AIR_PITCH_K: f32 = 45.0; // 滯空 pitch 追飛行路徑角的彈簧（約 0.3 秒跟上）
pub const AIR_PITCH_C: f32 = 11.0;
pub const LAND_LOSS_BASE: f32 = 0.40; // 重落地（撞擊 1.0）掉速比例（lvl0）
pub const LAND_LOSS_PER_LVL: f32 = 0.066; // lvl5 = 0.07
pub const LAND_REC_BASE: f32 = 1.0; // 重落地後抓地與加速恢復秒數（lvl0；lvl5 = 0.2）
pub const LAND_REC_PER_LVL: f32 = 0.16;
// 顛簸：貼地行駛時地面垂直速度一步（1/120 s）內變化超過 BUMP_JOLT 的部分，每 1 m/s 掉 BUMP_LOSS 的速度；
// 避震每級吸收 BUMP_ABSORB_PER_LVL（lvl5 只剩 15%）
pub const BUMP_JOLT_RATE: f32 = 36.0; // m/s²（× dt = 每步門檻）
pub const BUMP_LOSS: f32 = 0.022;
pub const BUMP_ABSORB_PER_LVL: f32 = 0.17;
// 路面震動：|Δ地面垂直速度|（每步）的指數平均（時間常數 SHAKE_TAU）。超過 SHAKE_FLOOR 的部分乘 SHAKE_K
// 變成極速與加速的折扣（上限 SHAKE_MAX），同樣依避震等級吸收。搓板路、坡面、土包上沒避震的車跑不快。
pub const SHAKE_TAU: f32 = 0.3;
pub const SHAKE_FLOOR: f32 = 0.02;
pub const SHAKE_K: f32 = 2.2;
pub const SHAKE_MAX: f32 = 0.35;

// 氮氣
pub const NITRO_TIME: f32 = 1.6;
pub const NITRO_THRUST: f32 = 13.0;
pub const NITRO_VMAX: f32 = 1.38;
pub const NITRO_MAX: u32 = 9;

// 比賽
pub const FINISH_GRACE: f32 = 20.0;
pub const COUNTDOWN: f32 = 3.0;
pub const PICKUP_SLOTS: usize = 8;
pub const PICKUP_MAX_ACTIVE: usize = 3;
pub const PICKUP_R: f32 = 1.7;
pub const PICKUP_LIFE: f32 = 14.0;
// 道具出現間隔（秒）與錢袋比例：一季獎金約夠買 6–9 級
pub const PICKUP_GAP: (f32, f32) = (4.0, 7.5);
pub const PICKUP_MONEY_P: f32 = 0.28;

// 地面：抓地倍率、極速倍率、額外阻力 m/s²、沾泥速率 1/s
pub struct Surf {
    pub grip: f32,
    pub vmax: f32,
    pub drag: f32,
    pub mud: f32,
}

pub const SURF: [Surf; 8] = [
    Surf { grip: 1.0, vmax: 1.0, drag: 0.0, mud: 0.0 },    // DIRT
    Surf { grip: 0.84, vmax: 0.88, drag: 0.6, mud: 0.0 },  // LOOSE
    Surf { grip: 0.5, vmax: 0.62, drag: 1.8, mud: 0.7 },   // MUD
    Surf { grip: 0.55, vmax: 0.62, drag: 2.0, mud: 0.5 },  // WATER
    Surf { grip: 1.0, vmax: 1.0, drag: 0.0, mud: 0.0 },    // JUMP
    Surf { grip: 0.95, vmax: 1.0, drag: 0.0, mud: 0.0 },   // RAMP
    Surf { grip: 0.8, vmax: 0.5, drag: 4.0, mud: 0.0 },    // WALL（理論上不會站上去）
    Surf { grip: 0.66, vmax: 0.48, drag: 2.0, mud: 0.05 }, // INFIELD
];

pub fn surf(k: u8) -> &'static Surf {
    &SURF[(k as usize) & 7]
}

pub fn lvl(l: u32) -> f32 {
    (if l > 5 { 5 } else { l }) as f32
}

// 升級數值（SPEC §5 sw_upgrade_stat）
pub fn upgrade_stat(kind: u32, level: u32) -> f32 {
    let l = lvl(level);
    match kind {
        0 => 1.0 + GRIP_PER_LVL * l,
        1 => BASE_VMAX * (1.0 + VMAX_PER_LVL * l),
        2 => LAND_REC_BASE - LAND_REC_PER_LVL * l,
        3 => 3.0 + l,
        _ => 0.0,
    }
}

// 落地撞擊 0..1（法向撞擊速度 iv，m/s）
pub fn land_impact(iv: f32) -> f32 {
    ((iv - 2.0) / 7.0).clamp(0.0, 1.0)
}

// 撞擊 1.0 時的落地掉速比例
pub fn land_loss(shocks: u32) -> f32 {
    LAND_LOSS_BASE - LAND_LOSS_PER_LVL * lvl(shocks)
}

// 顛簸剩下多少（1 = 全吃）
pub fn bump_keep(shocks: u32) -> f32 {
    1.0 - BUMP_ABSORB_PER_LVL * lvl(shocks)
}
