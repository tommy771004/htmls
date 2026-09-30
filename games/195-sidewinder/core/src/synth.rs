// 測試用合成賽道：體育場形迴圈，含跳台、泥地、水坑、鬆土
use crate::params::*;

pub struct Spec {
    pub id: u16,
    pub gw: usize,
    pub gh: usize,
    pub cell: f32,
    pub ox: f32,
    pub oz: f32,
    pub laps: u16,
    pub h: Vec<f32>,
    pub surf: Vec<u8>,
    pub path: Vec<[f32; 3]>,
    pub flags: Vec<u32>,
    pub starts: [[f32; 3]; 4],
    pub pickups: Vec<[f32; 2]>,
}

// 編碼成 SWTK v1 位元組
pub fn encode(s: &Spec) -> Vec<u8> {
    let mut b: Vec<u8> = Vec::new();
    b.extend_from_slice(b"SWTK");
    let u16s = |b: &mut Vec<u8>, v: u16| b.extend_from_slice(&v.to_le_bytes());
    let f32s = |b: &mut Vec<u8>, v: f32| b.extend_from_slice(&v.to_le_bytes());
    u16s(&mut b, 1);
    u16s(&mut b, s.id);
    u16s(&mut b, s.gw as u16);
    u16s(&mut b, s.gh as u16);
    f32s(&mut b, s.cell);
    f32s(&mut b, s.ox);
    f32s(&mut b, s.oz);
    u16s(&mut b, s.path.len() as u16);
    u16s(&mut b, s.pickups.len() as u16);
    u16s(&mut b, 1); // 一個 prop
    u16s(&mut b, s.laps);
    for _ in 0..8 {
        f32s(&mut b, 0.0);
    }
    let mut name = [0u8; 32];
    name[..5].copy_from_slice(b"SYNTH");
    b.extend_from_slice(&name);
    for &v in &s.h {
        b.extend_from_slice(&((v * 100.0).round() as i16).to_le_bytes());
    }
    b.extend_from_slice(&s.surf);
    while b.len() % 4 != 0 {
        b.push(0);
    }
    for (k, p) in s.path.iter().enumerate() {
        f32s(&mut b, p[0]);
        f32s(&mut b, p[1]);
        f32s(&mut b, p[2]);
        b.extend_from_slice(&s.flags[k].to_le_bytes());
    }
    for st in &s.starts {
        f32s(&mut b, st[0]);
        f32s(&mut b, st[1]);
        f32s(&mut b, st[2]);
        f32s(&mut b, 0.0);
    }
    for p in &s.pickups {
        f32s(&mut b, p[0]);
        f32s(&mut b, p[1]);
    }
    // prop：mesh 9 起終點拱門
    u16s(&mut b, 9);
    u16s(&mut b, 0);
    for v in [-6.0f32, 0.0, 13.0, 0.0, 1.0] {
        f32s(&mut b, v);
    }
    b
}

const A: f32 = 17.0; // 直線半長
const R: f32 = 13.0; // 彎道半徑
const HW: f32 = 4.5;

// 中心線：從 (-A, R) 往東，逆時針（畫面上）繞一圈
fn center(s: f32) -> (f32, f32) {
    let pi = core::f32::consts::PI;
    let st = 2.0 * A;
    let arc = pi * R;
    let l = 2.0 * st + 2.0 * arc;
    let s = ((s % l) + l) % l;
    if s < st {
        (-A + s, R)
    } else if s < st + arc {
        let th = pi * 0.5 - (s - st) / R;
        (A + R * th.cos(), R * th.sin())
    } else if s < 2.0 * st + arc {
        (A - (s - st - arc), -R)
    } else {
        let th = -pi * 0.5 - (s - 2.0 * st - arc) / R;
        (-A + R * th.cos(), R * th.sin())
    }
}

pub fn stadium_len() -> f32 {
    4.0 * A + 2.0 * core::f32::consts::PI * R
}

// 到中心線的距離與是否在內側
fn dist(x: f32, z: f32) -> (f32, bool) {
    let cx = x.clamp(-A, A);
    let d = ((x - cx) * (x - cx) + z * z).sqrt();
    ((d - R).abs(), d < R)
}

pub fn stadium() -> Spec {
    let cell = 0.5;
    let (gw, gh) = (145usize, 97usize);
    let (ox, oz) = (-36.0f32, -24.0f32);
    let mut h = vec![0.0f32; gw * gh];
    let mut surf = vec![WALL; gw * gh];
    for j in 0..gh {
        for i in 0..gw {
            let x = ox + i as f32 * cell;
            let z = oz + j as f32 * cell;
            let (d, inner) = dist(x, z);
            let k = j * gw + i;
            let mut s = if d <= HW {
                DIRT
            } else if inner && d <= HW + 2.5 {
                INFIELD
            } else {
                WALL
            };
            if s == DIRT {
                // 泥地：南直線 x ∈ [4, 12]
                if z > 0.0 && (4.0..=12.0).contains(&x) {
                    s = MUD;
                    h[k] = -0.1;
                }
                // 跳台：北直線往西，x 從 4 升到 0（高 1.0 m），x < 0 直接落下
                if z < 0.0 && (0.0..=4.0).contains(&x) {
                    s = JUMP;
                    h[k] = (4.0 - x) * 0.25;
                }
                // 水坑：西彎
                if x < -A - 6.0 && z.abs() < 6.0 {
                    s = WATER;
                    h[k] = -0.15;
                }
                // 鬆土：東彎
                if x > A + 8.0 {
                    s = LOOSE;
                }
            }
            if s == WALL {
                h[k] = 0.8;
            }
            surf[k] = s;
        }
    }
    // 路徑：每 2 m 一點，index 0 在 x = -6 的南直線上
    let l = stadium_len();
    let n = (l / 2.0).round() as usize;
    let step = l / n as f32;
    let s0 = A - 6.0;
    let mut path = Vec::new();
    let mut flags = Vec::new();
    for k in 0..n {
        let s = s0 + k as f32 * step;
        let (x, z) = center(s);
        path.push([x, z, HW]);
        let mut f = 0;
        if z > 0.0 && (4.0..=12.0).contains(&x) && z.abs() > R - 1.0 {
            f |= 4;
        }
        if z < 0.0 && (0.0..=4.0).contains(&x) && z.abs() > R - 1.0 {
            f |= 1;
        }
        if x < -A - 6.0 {
            f |= 2;
        }
        if k == n / 4 || k == n / 2 || k == 3 * n / 4 {
            f |= 8;
        }
        flags.push(f);
    }
    let starts = [
        [-9.0, R - 1.6, 0.0],
        [-9.0, R + 1.6, 0.0],
        [-13.0, R - 1.6, 0.0],
        [-13.0, R + 1.6, 0.0],
    ];
    let pickups = vec![[10.0, R], [A + R, 0.0], [-5.0, -R], [-A - R, 0.0], [0.0, R + 2.0]];
    Spec { id: 9, gw, gh, cell, ox, oz, laps: 4, h, surf, path, flags, starts, pickups }
}

pub fn stadium_bytes() -> Vec<u8> {
    encode(&stadium())
}

// 蛇行賽道：三個髮夾彎、跳台、泥地、水坑，全長約 250 m（比較像真正的賽道）
pub fn serpent() -> Spec {
    let ctrl: [[f32; 2]; 10] = [
        [-26.0, 16.0],
        [27.0, 16.0],
        [27.0, 5.0],
        [-8.0, 5.0],
        [-8.0, -6.0],
        [27.0, -6.0],
        [27.0, -17.0],
        [-29.0, -17.0],
        [-29.0, 16.0],
        [-27.0, 16.0],
    ];
    // Chaikin 切角
    let mut pts: Vec<[f32; 2]> = ctrl.to_vec();
    for _ in 0..4 {
        let n = pts.len();
        let mut out = Vec::with_capacity(n * 2);
        for i in 0..n {
            let a = pts[i];
            let b = pts[(i + 1) % n];
            out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
            out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
        }
        pts = out;
    }
    // 重新取樣成約 2 m 間距，起點在 (-12, 16)
    let n = pts.len();
    let mut cum = vec![0.0f32];
    for i in 0..n {
        let a = pts[i];
        let b = pts[(i + 1) % n];
        let l = ((b[0] - a[0]).powi(2) + (b[1] - a[1]).powi(2)).sqrt();
        cum.push(cum[i] + l);
    }
    let total = cum[n];
    let at = |s: f32| -> [f32; 2] {
        let s = ((s % total) + total) % total;
        let mut i = 0;
        while i + 1 < n && cum[i + 1] <= s {
            i += 1;
        }
        let a = pts[i];
        let b = pts[(i + 1) % n];
        let t = (s - cum[i]) / (cum[i + 1] - cum[i]).max(1e-4);
        [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    };
    // 起點弧長
    let mut s0 = 0.0;
    let mut bd = f32::MAX;
    let mut s = 0.0;
    while s < total {
        let p = at(s);
        let d = (p[0] + 12.0).abs() + (p[1] - 16.0).abs();
        if d < bd {
            bd = d;
            s0 = s;
        }
        s += 0.25;
    }
    let np = (total / 2.0).round() as usize;
    let step = total / np as f32;
    let hw = 4.0f32;
    let path: Vec<[f32; 3]> = (0..np).map(|k| {
        let p = at(s0 + k as f32 * step);
        [p[0], p[1], hw]
    }).collect();

    let cell = 0.5;
    let (gw, gh) = (145usize, 97usize);
    let (ox, oz) = (-36.0f32, -24.0f32);
    let mut h = vec![0.0f32; gw * gh];
    let mut surf = vec![WALL; gw * gh];
    for j in 0..gh {
        for i in 0..gw {
            let x = ox + i as f32 * cell;
            let z = oz + j as f32 * cell;
            let mut d = f32::MAX;
            for k in 0..np {
                let a = path[k];
                let b = path[(k + 1) % np];
                let (ex, ez) = (b[0] - a[0], b[1] - a[1]);
                let l2 = (ex * ex + ez * ez).max(1e-6);
                let t = (((x - a[0]) * ex + (z - a[1]) * ez) / l2).clamp(0.0, 1.0);
                let (px, pz) = (a[0] + ex * t - x, a[1] + ez * t - z);
                d = d.min((px * px + pz * pz).sqrt());
            }
            let k = j * gw + i;
            if d > hw {
                h[k] = 0.8;
                continue;
            }
            let mut s = DIRT;
            // 跳台：第三條直線（z = -6，往東），x ∈ [6, 10] 升到 0.9 m 後落下
            if (z + 6.0).abs() < 5.0 && (6.0..=10.0).contains(&x) {
                s = JUMP;
                h[k] = (x - 6.0) * 0.225;
            }
            // 泥地：第一個髮夾彎
            if x > 24.0 && z > 3.0 && z < 18.0 && (z - 10.5).abs() < 3.5 {
                s = MUD;
                h[k] = -0.1;
            }
            // 水坑：最後一條直線（z = -17）
            if (z + 17.0).abs() < 5.0 && (-12.0..=-4.0).contains(&x) {
                s = WATER;
                h[k] = -0.15;
            }
            // 鬆土與坡道：西側直線
            if x < -25.0 && z > -12.0 && z < 12.0 {
                s = RAMP;
                h[k] = (1.0 - (z / 12.0).abs()) * 1.2;
            }
            surf[k] = s;
        }
    }
    let mut flags = Vec::with_capacity(np);
    for p in &path {
        let (x, z) = (p[0], p[1]);
        let mut f = 0;
        if (z + 6.0).abs() < 1.0 && (6.0..=10.0).contains(&x) {
            f |= 1;
        }
        if (z + 17.0).abs() < 1.0 && (-12.0..=-4.0).contains(&x) {
            f |= 2;
        }
        if x > 24.0 && (z - 10.5).abs() < 3.5 {
            f |= 4;
        }
        if x < -25.0 && z.abs() < 12.0 {
            f |= 16;
        }
        flags.push(f);
    }
    for q in 1..5 {
        flags[np * q / 5] |= 8;
    }
    let starts = [
        [-15.0, 14.4, 0.0],
        [-15.0, 17.6, 0.0],
        [-19.0, 14.4, 0.0],
        [-19.0, 17.6, 0.0],
    ];
    let pickups = vec![[0.0, 16.0], [10.0, 5.0], [0.0, -6.0], [-20.0, -17.0], [-29.0, 0.0], [20.0, -17.0]];
    Spec { id: 8, gw, gh, cell, ox, oz, laps: 4, h, surf, path, flags, starts, pickups }
}

pub fn serpent_bytes() -> Vec<u8> {
    encode(&serpent())
}
