// SWTK v1 解析、高度場取樣、路徑投影
use crate::params::*;

#[derive(Clone, Copy, Default)]
pub struct PathPt {
    pub x: f32,
    pub z: f32,
    pub hw: f32,
    pub flags: u32,
}

pub const PF_JUMP: u32 = 1;
pub const PF_WATER: u32 = 2;
pub const PF_MUD: u32 = 4;
pub const PF_CHECK: u32 = 8;
pub const PF_RAMP: u32 = 16;

pub struct Track {
    pub id: u16,
    pub gw: usize,
    pub gh: usize,
    pub cell: f32,
    pub ox: f32,
    pub oz: f32,
    pub laps: u32,
    pub h: Vec<f32>,
    pub surf: Vec<u8>,
    pub path: Vec<PathPt>,
    pub starts: [[f32; 3]; 4],
    pub pickups: Vec<[f32; 2]>,
    // 衍生
    pub cum: Vec<f32>,  // 第 i 段起點的弧長
    pub seg: Vec<f32>,  // 第 i 段長度
    pub len: f32,       // 一圈長度
    pub curv: Vec<f32>, // 每個路徑點的曲率 1/m（取 ±3 m 弦，右轉為正）
    pub cps: Vec<usize>, // 中途檢查點（路徑索引，遞增，不含 0）
    pub lips: Vec<[f32; 2]>, // 起跳點（弧長, 進場坡度）：沿路徑中心線、依高度場推算會離地的凸折點
}

// 錯誤碼
pub const E_SHORT: i32 = -1;
pub const E_MAGIC: i32 = -2;
pub const E_VERSION: i32 = -3;
pub const E_GRID: i32 = -4;
pub const E_PATH: i32 = -5;

struct Rd<'a> {
    b: &'a [u8],
}

impl Rd<'_> {
    fn u16(&self, o: usize) -> Option<u16> {
        let s = self.b.get(o..o + 2)?;
        Some(u16::from_le_bytes([s[0], s[1]]))
    }
    fn u32(&self, o: usize) -> Option<u32> {
        let s = self.b.get(o..o + 4)?;
        Some(u32::from_le_bytes([s[0], s[1], s[2], s[3]]))
    }
    fn f32(&self, o: usize) -> Option<f32> {
        let v = f32::from_bits(self.u32(o)?);
        if v.is_finite() { Some(v) } else { Some(0.0) }
    }
    fn i16(&self, o: usize) -> Option<i16> {
        Some(self.u16(o)? as i16)
    }
}

impl Track {
    pub fn parse(b: &[u8]) -> Result<Track, i32> {
        let r = Rd { b };
        if b.len() < 96 {
            return Err(E_SHORT);
        }
        if &b[0..4] != b"SWTK" {
            return Err(E_MAGIC);
        }
        if r.u16(4) != Some(1) {
            return Err(E_VERSION);
        }
        let id = r.u16(6).ok_or(E_SHORT)?;
        let gw = r.u16(8).ok_or(E_SHORT)? as usize;
        let gh = r.u16(10).ok_or(E_SHORT)? as usize;
        let cell = r.f32(12).ok_or(E_SHORT)?;
        let ox = r.f32(16).ok_or(E_SHORT)?;
        let oz = r.f32(20).ok_or(E_SHORT)?;
        let n_path = r.u16(24).ok_or(E_SHORT)? as usize;
        let n_pick = r.u16(26).ok_or(E_SHORT)? as usize;
        let n_props = r.u16(28).ok_or(E_SHORT)? as usize;
        let laps = r.u16(30).ok_or(E_SHORT)? as u32;
        if gw < 2 || gh < 2 || !(cell > 0.01) {
            return Err(E_GRID);
        }
        if n_path < 3 {
            return Err(E_PATH);
        }
        let n = gw * gh;
        let mut o = 96;
        let need = ((o + n * 3 + 3) & !3) + n_path * 16 + 64 + n_pick * 8 + n_props * 24;
        if b.len() < need {
            return Err(E_SHORT);
        }
        let mut h = Vec::with_capacity(n);
        for k in 0..n {
            h.push(r.i16(o + k * 2).unwrap_or(0) as f32 * 0.01);
        }
        o += n * 2;
        let mut surf = Vec::with_capacity(n);
        for k in 0..n {
            let s = *b.get(o + k).unwrap_or(&WALL);
            surf.push(if s > 7 { DIRT } else { s });
        }
        o += n;
        o = (o + 3) & !3;
        let mut path = Vec::with_capacity(n_path);
        for k in 0..n_path {
            let p = o + k * 16;
            path.push(PathPt {
                x: r.f32(p).ok_or(E_SHORT)?,
                z: r.f32(p + 4).ok_or(E_SHORT)?,
                hw: r.f32(p + 8).ok_or(E_SHORT)?.max(1.5),
                flags: r.u32(p + 12).ok_or(E_SHORT)?,
            });
        }
        o += n_path * 16;
        let mut starts = [[0.0f32; 3]; 4];
        for (k, s) in starts.iter_mut().enumerate() {
            let p = o + k * 16;
            *s = [r.f32(p).ok_or(E_SHORT)?, r.f32(p + 4).ok_or(E_SHORT)?, r.f32(p + 8).ok_or(E_SHORT)?];
        }
        o += 64;
        let mut pickups = Vec::with_capacity(n_pick);
        for k in 0..n_pick {
            let p = o + k * 8;
            pickups.push([r.f32(p).ok_or(E_SHORT)?, r.f32(p + 4).ok_or(E_SHORT)?]);
        }
        // props 只給前端用，這裡略過
        let mut t = Track {
            id,
            gw,
            gh,
            cell,
            ox,
            oz,
            laps: if laps == 0 { 4 } else { laps },
            h,
            surf,
            path,
            starts,
            pickups,
            cum: Vec::new(),
            seg: Vec::new(),
            len: 0.0,
            curv: Vec::new(),
            cps: Vec::new(),
            lips: Vec::new(),
        };
        t.flatten_walls();
        t.derive();
        if !(t.len > 5.0) {
            return Err(E_PATH);
        }
        Ok(t)
    }

    // 物理用高度：WALL 格的高度換成相鄰可行駛格的平均（土堤、輪胎堆不會把貼牆的輪子抬起來）
    fn flatten_walls(&mut self) {
        let (gw, gh) = (self.gw as i32, self.gh as i32);
        let mut done: Vec<bool> = self.surf.iter().map(|&s| s != WALL).collect();
        for _ in 0..4 {
            let mut next = done.clone();
            let mut nh = self.h.clone();
            for j in 0..gh {
                for i in 0..gw {
                    let k = (j * gw + i) as usize;
                    if done[k] {
                        continue;
                    }
                    let (mut sum, mut n) = (0.0, 0);
                    for dj in -1..=1 {
                        for di in -1..=1 {
                            let (a, b) = (i + di, j + dj);
                            if a < 0 || b < 0 || a >= gw || b >= gh {
                                continue;
                            }
                            let q = (b * gw + a) as usize;
                            if done[q] {
                                sum += self.h[q];
                                n += 1;
                            }
                        }
                    }
                    if n > 0 {
                        nh[k] = sum / n as f32;
                        next[k] = true;
                    }
                }
            }
            self.h = nh;
            done = next;
        }
    }

    fn derive(&mut self) {
        let n = self.path.len();
        let mut s = 0.0;
        self.cum.clear();
        self.seg.clear();
        for i in 0..n {
            let a = self.path[i];
            let b = self.path[(i + 1) % n];
            let l = ((b.x - a.x) * (b.x - a.x) + (b.z - a.z) * (b.z - a.z)).sqrt().max(1e-3);
            self.cum.push(s);
            self.seg.push(l);
            s += l;
        }
        self.len = s;
        // 曲率：以 ±D 弦的方向差估計
        let d = 3.0f32;
        self.curv = (0..n)
            .map(|i| {
                let s0 = self.cum[i];
                let (ax, az) = self.pos_at(s0 - d);
                let (bx, bz) = self.pos_at(s0);
                let (cx, cz) = self.pos_at(s0 + d);
                let h1 = (bz - az).atan2(bx - ax);
                let h2 = (cz - bz).atan2(cx - bx);
                wrap_pi(h2 - h1) / d
            })
            .collect();
        self.find_lips();
        // 檢查點：用 bit3；不足時補在 1/4、1/2、3/4；間距過大再補中點
        let mut cps: Vec<usize> = (1..n).filter(|&i| self.path[i].flags & PF_CHECK != 0).collect();
        if cps.len() < 2 {
            cps.clear();
            for q in 1..4 {
                cps.push(self.index_at(self.len * q as f32 / 4.0));
            }
        }
        // 補足：相鄰檢查點（含終點線）弧長差 > len/4 就補中點
        loop {
            let mut added = false;
            let mut prev_s = 0.0;
            let mut out: Vec<usize> = Vec::new();
            let mut list = cps.clone();
            isort(&mut list, |a, b| a > b);
            list.dedup();
            list.retain(|&i| i > 0);
            for &c in list.iter().chain(core::iter::once(&usize::MAX)) {
                let cs = if c == usize::MAX { self.len } else { self.cum[c] };
                if cs - prev_s > self.len * 0.25 {
                    let m = self.index_at((prev_s + cs) * 0.5);
                    if m > 0 && !list.contains(&m) && !out.contains(&m) {
                        out.push(m);
                        added = true;
                    }
                }
                if c != usize::MAX {
                    out.push(c);
                }
                prev_s = cs;
            }
            isort(&mut out, |a, b| a > b);
            out.dedup();
            cps = out;
            if !added {
                break;
            }
        }
        self.cps = cps;
    }

    // 沿路徑中心線找起跳點：以參考速度 14 m/s 經過時會飛超過 2.5 m 的凸折點（跳台頂、平台邊、坡頂）。
    // 同一段連續的候選只記第一個（真正離地的位置）。
    fn find_lips(&mut self) {
        let step = 0.5f32;
        let n = (self.len / step) as usize;
        let hs = |t: &Track, s: f32| {
            let (x, z) = t.pos_at(s);
            t.height(x, z)
        };
        let mut lips = Vec::new();
        let mut run = false;
        for i in 0..n {
            let s = i as f32 * step;
            let slope = (hs(self, s) - hs(self, s - 1.0)) / 1.0;
            let (d, ..) = self.flight(s, slope, 14.0);
            let cand = d > 2.5;
            if cand && !run {
                lips.push([s, slope]);
            }
            run = cand;
        }
        self.lips = lips;
    }

    // 以速度 v、進場坡度 slope 從弧長 s 沿切線直飛：回傳（落地前的水平距離, 途中是否撞到牆, 落地時的法向撞擊速度）。
    // 起跳垂直速度同 truck.rs（0.85 × 地面垂直速度，上限 6 m/s），四輪平均高度讓實際起跳比中心線剖面溫和，
    // 再打 0.8 折（對照 tests/race.rs flight_model 的實測飛行距離校正）。撞擊速度的算法同 truck.rs 落地。
    pub fn flight(&self, s: f32, slope: f32, v: f32) -> (f32, bool, f32) {
        if v < 3.0 {
            return (0.0, false, 0.0);
        }
        let (x0, z0, tx, tz, ..) = self.sample(s);
        let y0 = self.height(x0, z0);
        let vy0 = (0.68 * v * slope.max(0.0)).min(6.0);
        // 車身左右緣（±0.9 m）也要檢查牆
        let (rx, rz) = (-tz * 0.9, tx * 0.9);
        let mut d = 0.5;
        while d < 50.0 {
            let t = d / v;
            let y = y0 + vy0 * t - 0.5 * GRAVITY * t * t;
            let (x, z) = (x0 + tx * d, z0 + tz * d);
            if self.is_wall(x, z) || self.is_wall(x + rx, z + rz) || self.is_wall(x - rx, z - rz) {
                return (d, true, 0.0);
            }
            let g = self.height(x, z);
            if y <= g {
                let gs = (self.height(x + tx * 0.7, z + tz * 0.7) - self.height(x - tx * 0.7, z - tz * 0.7)) / 1.4;
                let iv = (gs * v - (vy0 - GRAVITY * t)).max(0.0);
                return (d, false, iv);
            }
            d += 0.5;
        }
        (d, false, 0.0)
    }

    // 弧長 → 最近的路徑點索引
    pub fn index_at(&self, s: f32) -> usize {
        let s = self.wrap_s(s);
        let mut best = 0;
        let mut bd = f32::MAX;
        for i in 0..self.path.len() {
            let d = (self.cum[i] - s).abs().min(self.len - (self.cum[i] - s).abs());
            if d < bd {
                bd = d;
                best = i;
            }
        }
        best
    }

    pub fn wrap_s(&self, s: f32) -> f32 {
        let mut s = s % self.len;
        if s < 0.0 {
            s += self.len;
        }
        s
    }

    // 弧長所在的段索引
    pub fn seg_at(&self, s: f32) -> usize {
        let s = self.wrap_s(s);
        // 二分搜尋
        let (mut lo, mut hi) = (0usize, self.cum.len() - 1);
        while lo < hi {
            let mid = (lo + hi + 1) / 2;
            if self.cum[mid] <= s { lo = mid } else { hi = mid - 1 }
        }
        lo
    }

    pub fn pos_at(&self, s: f32) -> (f32, f32) {
        let p = self.sample(s);
        (p.0, p.1)
    }

    // (x, z, tx, tz, hw, flags)
    pub fn sample(&self, s: f32) -> (f32, f32, f32, f32, f32, u32) {
        let s = self.wrap_s(s);
        let i = self.seg_at(s);
        let n = self.path.len();
        let a = self.path[i];
        let b = self.path[(i + 1) % n];
        let t = ((s - self.cum[i]) / self.seg[i]).clamp(0.0, 1.0);
        let l = self.seg[i];
        (
            a.x + (b.x - a.x) * t,
            a.z + (b.z - a.z) * t,
            (b.x - a.x) / l,
            (b.z - a.z) / l,
            a.hw + (b.hw - a.hw) * t,
            if t < 0.5 { a.flags } else { b.flags },
        )
    }

    // 有號曲率（右轉為正）
    pub fn curv_at(&self, s: f32) -> f32 {
        let s = self.wrap_s(s);
        let i = self.seg_at(s);
        let n = self.path.len();
        let t = ((s - self.cum[i]) / self.seg[i]).clamp(0.0, 1.0);
        self.curv[i] * (1.0 - t) + self.curv[(i + 1) % n] * t
    }

    // 投影到路徑：在 hint 附近 ±win 公尺內找最近段；hint < 0 表示全域搜尋
    // 回傳 (s, 橫向偏移（右正）, 距離)
    pub fn project(&self, x: f32, z: f32, hint: f32, win: f32) -> (f32, f32, f32) {
        let n = self.path.len();
        let (i0, cnt) = if hint < 0.0 || win * 2.0 >= self.len {
            (0, n)
        } else {
            let a = self.seg_at(hint - win);
            let b = self.seg_at(hint + win);
            let c = if b >= a { b - a + 1 } else { b + n - a + 1 };
            (a, c.min(n))
        };
        let mut best = (0.0, 0.0, f32::MAX);
        for k in 0..cnt {
            let i = (i0 + k) % n;
            let a = self.path[i];
            let b = self.path[(i + 1) % n];
            let l = self.seg[i];
            let tx = (b.x - a.x) / l;
            let tz = (b.z - a.z) / l;
            let dx = x - a.x;
            let dz = z - a.z;
            let t = (dx * tx + dz * tz).clamp(0.0, l);
            let px = dx - tx * t;
            let pz = dz - tz * t;
            let d = (px * px + pz * pz).sqrt();
            if d < best.2 {
                // 右方向 = (-tz, tx)
                let lat = -px * tz + pz * tx;
                best = (self.wrap_s(self.cum[i] + t), lat, d);
            }
        }
        best
    }

    #[inline]
    fn hgt(&self, i: usize, j: usize) -> f32 {
        self.h[j * self.gw + i]
    }

    // 雙線性內插高度（公尺），界外夾到邊緣
    pub fn height(&self, x: f32, z: f32) -> f32 {
        let fx = ((x - self.ox) / self.cell).clamp(0.0, (self.gw - 1) as f32);
        let fz = ((z - self.oz) / self.cell).clamp(0.0, (self.gh - 1) as f32);
        let i = (fx as usize).min(self.gw - 2);
        let j = (fz as usize).min(self.gh - 2);
        let u = fx - i as f32;
        let v = fz - j as f32;
        let a = self.hgt(i, j) + (self.hgt(i + 1, j) - self.hgt(i, j)) * u;
        let b = self.hgt(i, j + 1) + (self.hgt(i + 1, j + 1) - self.hgt(i, j + 1)) * u;
        a + (b - a) * v
    }

    // 取樣點 (i, j) 的地面種類；界外 = WALL
    pub fn surf_ij(&self, i: i32, j: i32) -> u8 {
        if i < 0 || j < 0 || i >= self.gw as i32 || j >= self.gh as i32 {
            WALL
        } else {
            self.surf[j as usize * self.gw + i as usize]
        }
    }

    pub fn cell_of(&self, x: f32, z: f32) -> (i32, i32) {
        (
            ((x - self.ox) / self.cell + 0.5).floor() as i32,
            ((z - self.oz) / self.cell + 0.5).floor() as i32,
        )
    }

    // 最近取樣點的地面種類（每個取樣點代表以它為中心、邊長 cell 的方格）
    pub fn surface(&self, x: f32, z: f32) -> u8 {
        let (i, j) = self.cell_of(x, z);
        self.surf_ij(i, j)
    }

    pub fn is_wall(&self, x: f32, z: f32) -> bool {
        self.surface(x, z) == WALL
    }
}

// 插入排序（元素很少；避免把標準庫排序整套編進 wasm）
pub fn isort<T: Copy>(v: &mut [T], gt: impl Fn(&T, &T) -> bool) {
    for i in 1..v.len() {
        let x = v[i];
        let mut j = i;
        while j > 0 && gt(&v[j - 1], &x) {
            v[j] = v[j - 1];
            j -= 1;
        }
        v[j] = x;
    }
}

pub fn wrap_pi(a: f32) -> f32 {
    let tau = core::f32::consts::TAU;
    let mut a = a % tau;
    if a > core::f32::consts::PI {
        a -= tau;
    } else if a < -core::f32::consts::PI {
        a += tau;
    }
    a
}
