// 比賽：倒數、圈數與檢查點、名次、道具、完賽、事件、狀態輸出
use crate::ai::{self, Ai, Ctx};
use crate::params::*;
use crate::rng::Rng;
use crate::track::{isort, Track};
use crate::truck::{Ctl, Truck};

pub const STATE_LEN: usize = 176;
pub const TRUCK_BASE: usize = 16;
pub const TRUCK_STRIDE: usize = 32;
pub const PICK_BASE: usize = 144;
pub const EVENTS_MAX: usize = 256;

// 事件 type
pub const EV_BEEP: f32 = 1.0;
pub const EV_GO: f32 = 2.0;
pub const EV_LAUNCH: f32 = 3.0;
pub const EV_LAND: f32 = 4.0;
pub const EV_SPLASH: f32 = 5.0;
pub const EV_MUD: f32 = 6.0;
pub const EV_BUMP: f32 = 7.0;
pub const EV_WALL: f32 = 8.0;
pub const EV_NITRO: f32 = 9.0;
pub const EV_PICKUP: f32 = 10.0;
pub const EV_LAP: f32 = 11.0;
pub const EV_FINISH: f32 = 12.0;
pub const EV_LAST_LAP: f32 = 13.0;
pub const EV_PASS: f32 = 14.0;
pub const EV_WRONG: f32 = 15.0;

#[derive(Clone, Copy, Default)]
pub struct Pickup {
    pub x: f32,
    pub z: f32,
    pub kind: u8,
    pub life: f32,
    pub spot: usize,
}

#[derive(Clone, Copy, Default)]
pub struct Cfg {
    pub is_ai: bool,
    pub tires: u32,
    pub engine: u32,
    pub shocks: u32,
    pub nitro: u32,
    pub skill: f32,
}

pub struct World {
    pub track: Option<Track>,
    pub cfg: [Cfg; 4],
    pub trucks: Vec<Truck>,
    pub phase: u32,
    pub time: f32,
    pub countdown: f32,
    pub laps: u32,
    pub rng: Rng,
    pub pickups: [Pickup; PICKUP_SLOTS],
    pub spawn_t: f32,
    pub finish_deadline: f32, // < 0 表示還沒人完賽
    pub finish_order: u32,
    pub events: Vec<[f32; 4]>,
    pub state: Vec<f32>,
}

impl Default for World {
    fn default() -> Self {
        Self::new()
    }
}

impl World {
    pub fn new() -> World {
        let mut cfg = [Cfg { is_ai: true, skill: 0.5, ..Cfg::default() }; 4];
        cfg[0].is_ai = false;
        World {
            track: None,
            cfg,
            trucks: vec![Truck::default(); 4],
            phase: 0,
            time: 0.0,
            countdown: 0.0,
            laps: 4,
            rng: Rng::new(1),
            pickups: [Pickup::default(); PICKUP_SLOTS],
            spawn_t: 0.0,
            finish_deadline: -1.0,
            finish_order: 0,
            events: Vec::with_capacity(EVENTS_MAX),
            state: vec![0.0; STATE_LEN],
        }
    }

    pub fn load_track(&mut self, bytes: &[u8]) -> i32 {
        match Track::parse(bytes) {
            Ok(t) => {
                self.laps = t.laps;
                self.track = Some(t);
                self.phase = 0;
                self.reset_trucks();
                self.events.clear();
                self.write_state();
                0
            }
            Err(e) => e,
        }
    }

    pub fn set_truck(&mut self, i: usize, c: Cfg) {
        if i >= 4 {
            return;
        }
        self.cfg[i] = c;
        let t = &mut self.trucks[i];
        apply_cfg(t, &c);
        if self.phase <= 1 {
            t.nitro_n = 3 + c.nitro.min(5);
        }
        self.write_state();
    }

    fn reset_trucks(&mut self) {
        let Some(tr) = self.track.as_ref() else { return };
        for k in 0..4 {
            let mut t = Truck::default();
            apply_cfg(&mut t, &self.cfg[k]);
            let st = tr.starts[k];
            t.place_at(tr, st[0], st[1], st[2]);
            t.nitro_n = 3 + self.cfg[k].nitro.min(5);
            let (s, lat, _) = tr.project(t.x, t.z, -1.0, 0.0);
            t.s = s;
            t.lat = lat;
            // 發車格在起終點線後方 → 第一次過線只是「上線」，不算圈
            t.armed = s < tr.len * 0.5;
            t.cp_next = if t.armed { tr.cps.iter().position(|&c| tr.cum[c] > s).unwrap_or(tr.cps.len()) } else { 0 };
            t.place = k as u32 + 1;
            t.ai.lane = lat;
            let (rv, frac) = rank_value(tr, &t);
            t.rv = rv;
            t.frac = frac;
            self.trucks[k] = t;
        }
    }

    pub fn race_start(&mut self, seed: u32, laps: u32) {
        if self.track.is_none() {
            return;
        }
        self.rng = Rng::new(seed);
        self.laps = if laps == 0 { self.track.as_ref().map_or(4, |t| t.laps) } else { laps.min(99) };
        self.reset_trucks();
        for k in 0..4 {
            let lane = self.trucks[k].lat;
            let mut a = Ai::init(&mut self.rng, k);
            a.lane = lane;
            self.trucks[k].ai = a;
        }
        self.phase = 1;
        self.time = 0.0;
        self.countdown = COUNTDOWN;
        self.pickups = [Pickup::default(); PICKUP_SLOTS];
        self.spawn_t = self.rng.range(2.0, 4.0);
        self.finish_deadline = -1.0;
        self.finish_order = 0;
        self.events.clear();
        self.push(EV_BEEP, 0, 3.0, 0.0);
        self.write_state();
    }

    pub fn set_input(&mut self, i: usize, steer: f32, thr: f32, brk: f32, nitro: bool) {
        if let Some(t) = self.trucks.get_mut(i) {
            let f = |v: f32| if v.is_finite() { v } else { 0.0 };
            t.input = Ctl { steer: f(steer).clamp(-1.0, 1.0), thr: f(thr).clamp(0.0, 1.0), brk: f(brk).clamp(0.0, 1.0), nitro };
        }
    }

    pub fn push(&mut self, ty: f32, truck: usize, a: f32, b: f32) {
        if self.events.len() < EVENTS_MAX {
            self.events.push([ty, truck as f32, a, b]);
        }
    }

    pub fn step(&mut self, dt: f32) {
        if self.track.is_none() || !(dt > 0.0) {
            return;
        }
        let dt = dt.min(MAX_DT);
        let n = (dt / SUB_DT - 1e-4).ceil().max(1.0) as usize;
        let h = dt / n as f32;
        for _ in 0..n {
            self.sub(h);
        }
        self.write_state();
    }

    fn sub(&mut self, dt: f32) {
        let Some(tr) = self.track.take() else { return };
        match self.phase {
            1 => {
                let before = self.countdown;
                self.countdown -= dt;
                for b in [2.0f32, 1.0] {
                    if before > b && self.countdown <= b {
                        self.push(EV_BEEP, 0, b, 0.0);
                    }
                }
                let cd = self.countdown;
                for (k, t) in self.trucks.iter_mut().enumerate() {
                    t.physics(&tr, dt, Ctl::default());
                    // 倒數時可以催油門（只給音效）
                    let thr = if t.is_ai { if cd < 1.2 + 0.2 * k as f32 { 0.7 } else { 0.25 } } else { t.input.thr };
                    t.rpm += ((0.2 + 0.75 * thr) - t.rpm) * (6.0 * dt).min(1.0);
                }
                if self.countdown <= 0.0 {
                    self.countdown = 0.0;
                    self.phase = 2;
                    self.push(EV_GO, 0, 0.0, 0.0);
                }
            }
            2 | 3 => self.race_sub(&tr, dt),
            _ => {
                for t in self.trucks.iter_mut() {
                    t.physics(&tr, dt, Ctl::default());
                }
            }
        }
        self.track = Some(tr);
    }

    fn player(&self) -> Option<usize> {
        if !self.trucks[0].is_ai { Some(0) } else { None }
    }

    fn race_sub(&mut self, tr: &Track, dt: f32) {
        let racing = self.phase == 2;
        if racing {
            self.time += dt;
        }
        let player = self.player();
        // 追趕平衡（溫和）
        if let Some(p) = player {
            let prv = self.trucks[p].rv;
            for k in 0..4 {
                if k != p && self.trucks[k].is_ai {
                    let gap = prv - self.trucks[k].rv;
                    self.trucks[k].rb = 1.0 + (gap / (tr.len * 0.5)).clamp(-0.05, 0.06);
                }
            }
        }
        // 控制
        let mut ctl = [Ctl::default(); 4];
        {
            let cx = Ctx { tr, time: self.time, racing, player };
            for (k, c) in ctl.iter_mut().enumerate() {
                let (auto, done, input) = {
                    let t = &self.trucks[k];
                    (t.is_ai || t.finished || !racing, t.finished, t.input)
                };
                if auto {
                    let (mut c2, a) = ai::think(&self.trucks, k, &cx, dt, &mut self.rng);
                    if !racing || done {
                        c2.nitro = false;
                    }
                    self.trucks[k].ai = a;
                    self.trucks[k].thr_cap = if done || !racing { 0.55 } else { 1.0 };
                    *c = c2;
                } else {
                    *c = input;
                }
            }
        }
        for k in 0..4 {
            let t = &mut self.trucks[k];
            // 氮氣（邊緣觸發）
            let pressed = ctl[k].nitro;
            if pressed && !t.nitro_prev && t.nitro_n > 0 && t.nitro_t <= 0.0 && racing && !t.finished {
                t.nitro_n -= 1;
                t.nitro_t = NITRO_TIME;
                let left = t.nitro_n as f32;
                self.push(EV_NITRO, k, left, 0.0);
            }
            let t = &mut self.trucks[k];
            t.nitro_prev = pressed;
            t.wall_cd -= dt;
            t.bump_cd -= dt;
            t.pass_cd -= dt;
            let fx = t.physics(tr, dt, ctl[k]);
            if let Some(v) = fx.launch {
                self.push(EV_LAUNCH, k, v, 0.0);
            }
            if let Some(v) = fx.land {
                self.push(EV_LAND, k, v, 0.0);
            }
            if let Some(v) = fx.splash {
                self.push(EV_SPLASH, k, v, 0.0);
            }
            if fx.mud_in {
                self.push(EV_MUD, k, 0.0, 0.0);
            }
            if let Some(v) = fx.wall {
                if self.trucks[k].wall_cd <= 0.0 {
                    self.trucks[k].wall_cd = 0.25;
                    self.push(EV_WALL, k, v, 0.0);
                }
            }
        }
        self.collide(tr);
        for k in 0..4 {
            self.progress(tr, k, dt);
        }
        if racing {
            self.pickups_step(tr, dt);
        }
        self.update_rv_with(tr);
        self.placement();
        if racing {
            self.finish_rules();
        }
    }

    // 卡車互撞：有向矩形（SAT），等質量衝量交換
    fn collide(&mut self, tr: &Track) {
        for i in 0..4 {
            for j in (i + 1)..4 {
                let (a, b) = {
                    let (l, r) = self.trucks.split_at_mut(j);
                    (&mut l[i], &mut r[0])
                };
                if (a.y - b.y).abs() > 1.3 {
                    continue;
                }
                let (ac, as_) = (a.yaw.cos(), a.yaw.sin());
                let (bc, bs) = (b.yaw.cos(), b.yaw.sin());
                let (dx, dz) = (b.x - a.x, b.z - a.z);
                let rmax = 2.0 * (BOX_HX * BOX_HX + BOX_HZ * BOX_HZ).sqrt();
                if dx * dx + dz * dz > rmax * rmax {
                    continue;
                }
                // 有向矩形分離軸（SAT）：四個軸取重疊最少的當法線（a → b）
                let axes = [(ac, as_), (-as_, ac), (bc, bs), (-bs, bc)];
                let mut best: Option<(f32, f32, f32)> = None;
                for (nx, nz) in axes {
                    let ra = BOX_HX * (ac * nx + as_ * nz).abs() + BOX_HZ * (-as_ * nx + ac * nz).abs();
                    let rb = BOX_HX * (bc * nx + bs * nz).abs() + BOX_HZ * (-bs * nx + bc * nz).abs();
                    let d = dx * nx + dz * nz;
                    let ov = ra + rb - d.abs();
                    if ov <= 0.0 {
                        best = None;
                        break;
                    }
                    if best.is_none_or(|q| ov < q.2) {
                        let sg = if d < 0.0 { -1.0 } else { 1.0 };
                        best = Some((nx * sg, nz * sg, ov));
                    }
                }
                let Some((nx, nz, pen)) = best else { continue };
                let p = pen * 0.5 + 0.001;
                a.x -= nx * p;
                a.z -= nz * p;
                b.x += nx * p;
                b.z += nz * p;
                let vr = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
                let mut jimp = 0.0;
                if vr < 0.0 {
                    jimp = -(1.0 + 0.35) * vr * 0.5;
                    a.vx -= nx * jimp;
                    a.vz -= nz * jimp;
                    b.vx += nx * jimp;
                    b.vz += nz * jimp;
                    // 側面被撞會轉一點
                    let side = (-as_ * nx + ac * nz).clamp(-1.0, 1.0);
                    a.yaw_rate -= side * jimp * 0.15;
                    let side_b = (-bs * nx + bc * nz).clamp(-1.0, 1.0);
                    b.yaw_rate += side_b * jimp * 0.15;
                }
                // 推進牆的話由牆修正
                a.walls(tr);
                b.walls(tr);
                if jimp > 0.8 && a.bump_cd <= 0.0 && b.bump_cd <= 0.0 {
                    a.bump_cd = 0.25;
                    b.bump_cd = 0.25;
                    self.push(EV_BUMP, i, (jimp / 8.0).min(1.0), j as f32);
                }
            }
        }
        for t in self.trucks.iter_mut() {
            if tr.is_wall(t.x, t.z) {
                // 夾在車與牆之間的極端情況：退回最近的非牆位置
                let (s, _, _) = tr.project(t.x, t.z, t.s, 12.0);
                let (px, pz) = tr.pos_at(s);
                let dx = px - t.x;
                let dz = pz - t.z;
                let d = (dx * dx + dz * dz).sqrt().max(1e-3);
                let mut k = 0;
                while tr.is_wall(t.x, t.z) && k < 40 {
                    t.x += dx / d * 0.1;
                    t.z += dz / d * 0.1;
                    k += 1;
                }
                t.vx *= 0.3;
                t.vz *= 0.3;
            }
        }
    }

    // 路徑追蹤、檢查點門、圈數
    fn progress(&mut self, tr: &Track, k: usize, dt: f32) {
        let time = self.time;
        let laps_total = self.laps;
        let racing = self.phase == 2;
        let t = &mut self.trucks[k];
        let s_old = t.s;
        let (mut s, mut lat, d) = tr.project(t.x, t.z, t.s, 12.0);
        if d > 8.0 {
            let g = tr.project(t.x, t.z, -1.0, 0.0);
            if g.2 < d - 3.0 {
                s = g.0;
                lat = g.1;
            }
        }
        t.s = s;
        t.lat = lat;
        if !racing || t.finished {
            if t.wrong {
                t.wrong = false;
                t.wrong_t = 0.0;
                self.push(EV_WRONG, k, 0.0, 0.0);
            }
            return;
        }
        // 逆向：車頭和路線切線夾角 > 120° 且往前開（> 3 m/s），持續 1 秒才提示；車頭轉回、往前開 0.5 秒後解除。
        // 看車頭而不是速度方向：倒車脫困（玩家或 AI 的脫困模式）不算逆向
        let (_, _, tx, tz, ..) = tr.sample(s);
        let hd = t.yaw.cos() * tx + t.yaw.sin() * tz;
        let back = !t.air && t.v_long > 3.0 && hd < -0.5;
        let fwd = t.v_long > 2.0 && hd > 0.3;
        let mut wrong_ev = None;
        if !t.wrong {
            t.wrong_t = if back { t.wrong_t + dt } else { 0.0 };
            if t.wrong_t > 1.0 {
                t.wrong = true;
                t.wrong_t = 0.0;
                wrong_ev = Some(1.0);
            }
        } else {
            t.wrong_t = if fwd { t.wrong_t + dt } else { 0.0 };
            if t.wrong_t > 0.5 {
                t.wrong = false;
                t.wrong_t = 0.0;
                wrong_ev = Some(0.0);
            }
        }
        if let Some(a) = wrong_ev {
            self.push(EV_WRONG, k, a, 0.0);
        }
        let t = &mut self.trucks[k];
        let ncp = tr.cps.len();
        let target = if !t.armed || t.cp_next >= ncp { 0 } else { tr.cps[t.cp_next] };
        if !gate_crossed(tr, target, s_old, s, (t.x, t.z)) {
            return;
        }
        let mut ev: [Option<(f32, f32)>; 3] = [None; 3];
        if !t.armed {
            t.armed = true;
            t.cp_next = 0;
            t.lap_start = time;
        } else if t.cp_next >= ncp {
            t.laps += 1;
            t.cp_next = 0;
            let lt = time - t.lap_start;
            t.lap_start = time;
            t.last_lap = lt;
            if t.best_lap <= 0.0 || lt < t.best_lap {
                t.best_lap = lt;
            }
            ev[0] = Some((EV_LAP, t.laps as f32));
            if t.laps >= laps_total {
                t.finished = true;
                t.finish_time = time;
                self.finish_order += 1;
                t.place = self.finish_order;
                ev[1] = Some((EV_FINISH, self.finish_order as f32));
                if self.finish_deadline < 0.0 {
                    self.finish_deadline = time + FINISH_GRACE;
                }
            } else if t.laps + 1 == laps_total {
                ev[2] = Some((EV_LAST_LAP, t.laps as f32 + 1.0));
            }
        } else {
            t.cp_next += 1;
        }
        for (ty, a) in ev.into_iter().flatten() {
            self.push(ty, k, a, 0.0);
        }
    }

    fn update_rv_with(&mut self, tr: &Track) {
        for t in self.trucks.iter_mut() {
            let (rv, frac) = rank_value(tr, t);
            t.rv = rv;
            t.frac = frac;
        }
    }

    fn placement(&mut self) {
        // 已完賽依完賽順序；其餘依累計進度
        let mut idx = [0usize, 1, 2, 3];
        let tk = &self.trucks;
        let key = |k: usize| {
            let t = &tk[k];
            let f = if t.finished && !t.dnf { t.place as f32 } else { 100.0 };
            (f, -t.rv)
        };
        // a 排在 b 後面？
        isort(&mut idx, |&a, &b| {
            let (ka, kb) = (key(a), key(b));
            ka.0 > kb.0 || (ka.0 == kb.0 && (ka.1 > kb.1 || (ka.1 == kb.1 && a > b)))
        });
        let racing = self.phase == 2 && self.time > 1.0;
        for (p, &k) in idx.iter().enumerate() {
            let np = p as u32 + 1;
            let t = &mut self.trucks[k];
            let old = t.place;
            if t.finished && !t.dnf {
                continue;
            }
            t.place = np;
            if racing && np < old && t.pass_cd <= 0.0 {
                t.pass_cd = 1.0;
                self.push(EV_PASS, k, np as f32, 0.0);
            }
        }
    }

    fn finish_rules(&mut self) {
        let all = self.trucks.iter().all(|t| t.finished);
        let cutoff = self.finish_deadline >= 0.0 && self.time >= self.finish_deadline;
        if cutoff && !all {
            // 未完賽依進度排名
            let mut idx: Vec<usize> = (0..4).filter(|&k| !self.trucks[k].finished).collect();
            let tk = &self.trucks;
            isort(&mut idx, |&a, &b| tk[a].rv < tk[b].rv || (tk[a].rv == tk[b].rv && a > b));
            for k in idx {
                self.finish_order += 1;
                let time = self.time;
                let t = &mut self.trucks[k];
                t.finished = true;
                t.dnf = true;
                t.finish_time = time;
                t.place = self.finish_order;
                let p = t.place as f32;
                self.push(EV_FINISH, k, p, 1.0);
            }
        }
        if self.trucks.iter().all(|t| t.finished) || self.time > 900.0 {
            self.phase = 3;
        }
    }

    fn pickups_step(&mut self, tr: &Track, dt: f32) {
        let np = tr.pickups.len();
        if np == 0 {
            return;
        }
        for p in self.pickups.iter_mut() {
            if p.kind != 0 {
                p.life -= dt;
                if p.life <= 0.0 {
                    p.kind = 0;
                }
            }
        }
        self.spawn_t -= dt;
        let active = self.pickups.iter().filter(|p| p.kind != 0).count();
        if self.spawn_t <= 0.0 {
            self.spawn_t = self.rng.range(PICKUP_GAP.0, PICKUP_GAP.1);
            if active < PICKUP_MAX_ACTIVE.min(np) {
                let mut spot = self.rng.below(np as u32) as usize;
                for _ in 0..np {
                    if self.pickups.iter().any(|p| p.kind != 0 && p.spot == spot) {
                        spot = (spot + 1) % np;
                    } else {
                        break;
                    }
                }
                let free = self.pickups.iter().any(|p| p.kind != 0 && p.spot == spot);
                if !free {
                    if let Some(slot) = self.pickups.iter().position(|p| p.kind == 0) {
                        let kind = if self.rng.f() < PICKUP_MONEY_P { 2 } else { 1 };
                        let sp = tr.pickups[spot];
                        self.pickups[slot] = Pickup { x: sp[0], z: sp[1], kind, life: PICKUP_LIFE, spot };
                    }
                }
            }
        }
        for pi in 0..PICKUP_SLOTS {
            let p = self.pickups[pi];
            if p.kind == 0 {
                continue;
            }
            for k in 0..4 {
                let t = &self.trucks[k];
                let dx = t.x - p.x;
                let dz = t.z - p.z;
                if dx * dx + dz * dz < PICKUP_R * PICKUP_R && t.y - tr.height(p.x, p.z) < 2.2 && !t.finished {
                    let amount = if p.kind == 2 { 10_000.0 + 5_000.0 * self.rng.below(7) as f32 } else { 0.0 };
                    let t = &mut self.trucks[k];
                    if p.kind == 1 {
                        t.nitro_n = (t.nitro_n + 1).min(NITRO_MAX);
                    } else {
                        t.money += amount;
                    }
                    self.pickups[pi].kind = 0;
                    self.push(EV_PICKUP, k, p.kind as f32, amount);
                    break;
                }
            }
        }
    }

    pub fn write_state(&mut self) {
        let st = &mut self.state;
        for v in st.iter_mut() {
            *v = 0.0;
        }
        st[0] = self.phase as f32;
        st[1] = self.time;
        st[2] = self.countdown.max(0.0);
        st[3] = self.laps as f32;
        st[4] = 4.0;
        st[5] = PICKUP_SLOTS as f32;
        let p0 = &self.trucks[0];
        st[6] = if p0.finished { p0.place as f32 } else { 0.0 };
        st[7] = self.track.as_ref().map_or(0.0, |t| t.id as f32);
        st[8] = self.trucks.iter().map(|t| t.laps).max().unwrap_or(0) as f32;
        // 9：玩家（第 0 台）本圈起算的比賽時間；第一次過起終點線（上線）前為 -1
        st[9] = if p0.armed { p0.lap_start } else { -1.0 };
        for (k, t) in self.trucks.iter().enumerate() {
            let o = TRUCK_BASE + TRUCK_STRIDE * k;
            let v = [
                t.x,
                t.y + t.bounce,
                t.z,
                t.yaw,
                t.pitch,
                t.roll,
                t.v_long,
                t.steer,
                t.wheel_rot,
                t.comp[0],
                t.comp[1],
                t.comp[2],
                t.comp[3],
                t.laps as f32,
                t.frac,
                t.place as f32,
                t.surface as f32,
                if t.air { 1.0 } else { 0.0 },
                t.nitro_n as f32,
                t.nitro_t,
                if t.finished { 1.0 } else { 0.0 },
                t.finish_time,
                t.best_lap,
                t.last_lap,
                t.money,
                t.rpm,
                t.slip,
                t.vy,
                if t.is_ai { 1.0 } else { 0.0 },
                t.ai.mode as f32,
                t.mud,
                if t.dnf { 1.0 } else { 0.0 },
            ];
            for (m, x) in v.iter().enumerate() {
                st[o + m] = if x.is_finite() { *x } else { 0.0 };
            }
        }
        for (k, p) in self.pickups.iter().enumerate() {
            let o = PICK_BASE + 4 * k;
            st[o] = p.x;
            st[o + 1] = p.z;
            st[o + 2] = p.kind as f32;
            st[o + 3] = if p.kind != 0 { 1.0 } else { 0.0 };
        }
    }
}

fn apply_cfg(t: &mut Truck, c: &Cfg) {
    t.is_ai = c.is_ai;
    t.tires = c.tires.min(5);
    t.engine = c.engine.min(5);
    t.shocks = c.shocks.min(5);
    t.nitro_lvl = c.nitro.min(5);
    t.skill = if c.skill.is_finite() { c.skill.clamp(0.0, 1.0) } else { 0.5 };
}

// 檢查點：路徑追蹤的弧長往前越過檢查點（一步內前進 < 15 m），且當下離檢查點不遠
// 倒車越過不算；抄捷徑跳過檢查點時離檢查點太遠也不算，要回頭補
pub fn gate_crossed(tr: &Track, c: usize, s_old: f32, s_new: f32, pos: (f32, f32)) -> bool {
    let l = tr.len;
    let mut ds = s_new - s_old;
    if ds > l * 0.5 {
        ds -= l;
    } else if ds < -l * 0.5 {
        ds += l;
    }
    if !(ds > 0.0 && ds < 15.0) {
        return false;
    }
    let sc = tr.cum[c];
    let rel = tr.wrap_s(sc - s_old);
    if !(rel > 0.0 && rel <= ds) {
        return false;
    }
    let p = tr.path[c];
    let dx = pos.0 - p.x;
    let dz = pos.1 - p.z;
    dx * dx + dz * dz <= (p.hw + 3.5) * (p.hw + 3.5)
}

// 排名值（公尺）與本圈進度 0..1；進度夾在「上一個已通過」與「下一個」檢查點之間
pub fn rank_value(tr: &Track, t: &Truck) -> (f32, f32) {
    let l = tr.len;
    if !t.armed {
        let s = if t.s > l * 0.5 { t.s - l } else { t.s.min(0.0) };
        return (s.min(0.0), 0.0);
    }
    let ncp = tr.cps.len();
    let last = if t.cp_next == 0 { 0.0 } else { tr.cum[tr.cps[t.cp_next - 1]] };
    let next = if t.cp_next >= ncp { l } else { tr.cum[tr.cps[t.cp_next]] };
    let mut s = t.s;
    if t.cp_next >= ncp && s < last - l * 0.5 {
        s += l;
    }
    if t.cp_next == 0 && s > l * 0.5 {
        s -= l;
    }
    let s = s.clamp(last, next);
    (t.laps as f32 * l + s, (s / l).clamp(0.0, 1.0))
}
