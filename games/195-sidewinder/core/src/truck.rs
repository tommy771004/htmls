// 單台卡車：懸吊、輪胎、坡度、跳台、牆
use crate::ai::Ai;
use crate::params::*;
use crate::track::Track;

#[derive(Clone, Copy, Default)]
pub struct Ctl {
    pub steer: f32,
    pub thr: f32,
    pub brk: f32,
    pub nitro: bool,
}

// 車身局部輪位（前 +x、右 +z）：FL, FR, RL, RR
pub const WHEELS: [(f32, f32); 4] = [
    (AXLE_F, -TRACK_HALF),
    (AXLE_F, TRACK_HALF),
    (AXLE_R, -TRACK_HALF),
    (AXLE_R, TRACK_HALF),
];

#[derive(Clone, Default)]
pub struct Truck {
    // 設定
    pub is_ai: bool,
    pub tires: u32,
    pub engine: u32,
    pub shocks: u32,
    pub nitro_lvl: u32,
    pub skill: f32,
    // 運動
    pub x: f32,
    pub z: f32,
    pub y: f32,
    pub vx: f32,
    pub vz: f32,
    pub vy: f32,
    pub yaw: f32,
    pub yaw_rate: f32,
    pub steer: f32,
    pub wheel_rot: f32,
    pub pitch: f32,
    pub pitch_v: f32,
    pub roll: f32,
    pub roll_v: f32,
    pub bounce: f32,
    pub bounce_v: f32,
    pub comp: [f32; 4],
    pub air: bool,
    pub air_t: f32,
    pub launched: bool, // 已送出起跳事件
    pub land_t: f32,
    pub surface: u8,
    pub slip: f32,
    pub rpm: f32,
    pub mud: f32,
    pub v_long: f32,
    pub nitro_n: u32,
    pub nitro_t: f32,
    pub nitro_prev: bool,
    pub rb: f32, // 追趕平衡的極速倍率（只給 AI）
    pub thr_cap: f32,
    // 輸入
    pub input: Ctl,
    // 比賽
    pub s: f32,
    pub lat: f32,
    pub armed: bool,
    pub cp_next: usize,
    pub laps: u32,
    pub finished: bool,
    pub dnf: bool,
    pub finish_time: f32,
    pub best_lap: f32,
    pub last_lap: f32,
    pub lap_start: f32,
    pub money: f32,
    pub place: u32,
    pub rv: f32, // 排名用累計進度（公尺）
    pub frac: f32,
    pub pass_cd: f32,
    pub wall_cd: f32,
    pub bump_cd: f32,
    pub splash_cd: f32,
    pub wrong: bool,  // 逆向中（已送出 EV_WRONG a=1）
    pub wrong_t: f32, // 逆向／回正計時
    pub bump_loss: f32, // 診斷：本場落地與顛簸累計掉速比例
    pub shake: f32,     // 路面震動（見 params SHAKE_*）
    pub ai: Ai,
}

pub struct Fx {
    pub launch: Option<f32>,
    pub land: Option<f32>,
    pub wall: Option<f32>,
    pub splash: Option<f32>,
    pub mud_in: bool,
}

fn sgn(v: f32) -> f32 {
    if v < 0.0 { -1.0 } else { 1.0 }
}

impl Truck {
    pub fn fwd(&self) -> (f32, f32) {
        (self.yaw.cos(), self.yaw.sin())
    }

    pub fn wheel_pos(&self, k: usize) -> (f32, f32) {
        let (c, s) = (self.yaw.cos(), self.yaw.sin());
        let (fx, rz) = WHEELS[k];
        // 右 = (-sin, cos)
        (self.x + c * fx - s * rz, self.z + s * fx + c * rz)
    }

    pub fn vmax(&self) -> f32 {
        let n = if self.nitro_t > 0.0 { NITRO_VMAX } else { 1.0 };
        upgrade_stat(1, self.engine) * n * self.rb
    }

    // 路面震動造成的極速／加速折扣（1 = 沒有）
    pub fn shake_mul(&self) -> f32 {
        1.0 - (SHAKE_K * (self.shake - SHAKE_FLOOR)).clamp(0.0, SHAKE_MAX) * bump_keep(self.shocks)
    }

    // 放到發車位置
    pub fn place_at(&mut self, tr: &Track, x: f32, z: f32, yaw: f32) {
        self.x = x;
        self.z = z;
        self.yaw = yaw;
        self.vx = 0.0;
        self.vz = 0.0;
        self.vy = 0.0;
        self.yaw_rate = 0.0;
        self.steer = 0.0;
        self.air = false;
        self.air_t = 0.0;
        self.land_t = 0.0;
        self.bounce = 0.0;
        self.bounce_v = 0.0;
        self.pitch_v = 0.0;
        self.roll_v = 0.0;
        self.comp = [0.0; 4];
        self.mud = 0.0;
        self.shake = 0.0;
        self.nitro_t = 0.0;
        self.rb = 1.0;
        self.thr_cap = 1.0;
        let (g, p, r) = self.ground(tr);
        self.y = g + WHEEL_R;
        self.pitch = p;
        self.roll = r;
        self.surface = tr.surface(x, z);
    }

    // 四輪地面平均高度、目標 pitch、roll
    fn ground(&self, tr: &Track) -> (f32, f32, f32) {
        let mut h = [0.0f32; 4];
        for (k, hk) in h.iter_mut().enumerate() {
            let (wx, wz) = self.wheel_pos(k);
            *hk = tr.height(wx, wz);
        }
        let avg = (h[0] + h[1] + h[2] + h[3]) * 0.25;
        let pitch = ((h[0] + h[1]) * 0.5 - (h[2] + h[3]) * 0.5).atan2(WHEELBASE);
        // roll 正 = 左側高
        let roll = ((h[0] + h[2]) * 0.5 - (h[1] + h[3]) * 0.5).atan2(2.0 * TRACK_HALF);
        (avg, pitch, roll)
    }

    pub fn physics(&mut self, tr: &Track, dt: f32, c: Ctl) -> Fx {
        let mut fx = Fx { launch: None, land: None, wall: None, splash: None, mud_in: false };
        let x0 = self.x;
        let z0 = self.z;
        let (mut cy, mut sy) = (self.yaw.cos(), self.yaw.sin());

        // 每輪地面種類
        let mut gf = 0.0;
        let mut gr = 0.0;
        let mut vm = 0.0;
        let mut drag = 0.0;
        let mut mudr = 0.0;
        for k in 0..4 {
            let (wx, wz) = self.wheel_pos(k);
            let sf = surf(tr.surface(wx, wz));
            if k < 2 { gf += sf.grip * 0.5 } else { gr += sf.grip * 0.5 }
            vm += sf.vmax * 0.25;
            drag += sf.drag * 0.25;
            mudr += sf.mud * 0.25;
        }
        let prev_surface = self.surface;
        self.surface = tr.surface(self.x, self.z);

        self.steer += (c.steer.clamp(-1.0, 1.0) - self.steer) * (STEER_RATE * dt).min(1.0);
        let thr = c.thr.clamp(0.0, 1.0);
        let brk = c.brk.clamp(0.0, 1.0);

        let mut v_long = self.vx * cy + self.vz * sy;
        let mut v_lat = -self.vx * sy + self.vz * cy;

        if !self.air {
            let rec = (self.land_t / LAND_REC_BASE).clamp(0.0, 1.0);
            let sm = self.shake_mul();
            // 震動時輪胎彈跳，側向抓地也跟著掉（折扣的 0.7 倍）
            let gm = upgrade_stat(0, self.tires) * (1.0 - 0.45 * rec) * (1.0 - 0.7 * (1.0 - sm));
            let af = BASE_GRIP * gm * gf;
            let ar = BASE_GRIP * gm * gr;
            let vmax = self.vmax() * vm * sm;
            let accel = (BASE_ACCEL + ACCEL_PER_LVL * lvl(self.engine))
                * (0.6 + 0.4 * gr.min(1.0))
                * (1.0 - 0.6 * rec)
                * sm;

            // 縱向
            let mut a = 0.0;
            if thr > 0.0 {
                if v_long < -0.5 {
                    a += BRAKE_DECEL * thr;
                } else {
                    // 半油門 = 較低的目標極速（類比扳機）
                    let vt = vmax * (0.35 + 0.65 * thr);
                    if v_long < vt {
                        a += accel * thr.max(0.3) * (1.0 - v_long / vt).max(0.0).sqrt();
                    }
                }
            }
            if brk > 0.0 {
                if v_long > 0.4 {
                    a -= BRAKE_DECEL * brk * (0.5 + 0.5 * ((gf + gr) * 0.5).min(1.0));
                } else if thr <= 0.0 {
                    a -= REVERSE_ACCEL * brk * (1.0 + v_long / REVERSE_VMAX).max(0.0);
                }
            }
            if self.nitro_t > 0.0 && v_long < vmax && brk <= 0.0 {
                a += NITRO_THRUST * (0.5 + 0.5 * gr.min(1.0));
            }
            // 阻力（不讓它反向）
            let mut d = drag;
            if thr <= 0.0 && brk <= 0.0 {
                d += ROLL_DRAG;
            }
            if v_long > vmax {
                d += OVERSPEED_K * (v_long - vmax);
            }
            if v_long < -REVERSE_VMAX {
                d += OVERSPEED_K * (-REVERSE_VMAX - v_long);
            }
            v_long += a * dt;
            let dd = d * dt;
            if v_long.abs() <= dd { v_long = 0.0 } else { v_long -= sgn(v_long) * dd }

            // 轉向：運動學角速度，受前輪抓地限制；後輪抓地較低時甩尾
            let spd = v_long.abs();
            let dmax = STEER_MAX_LO + (STEER_MAX_HI - STEER_MAX_LO) * (spd / 16.0).min(1.0);
            let w_kin = v_long * (self.steer * dmax).tan() / WHEELBASE;
            // 泥地／水坑：後輪鬆，車頭轉得比速度方向多（甩尾）
            let loose = (1.0 - gr).clamp(0.0, 0.5);
            let w_lim = af * (1.3 + 1.2 * loose) / spd.max(1.0);
            let over = ((gf - gr) / gf.max(0.1)).clamp(0.0, 0.6);
            let mut w_t = w_kin.clamp(-w_lim, w_lim) * (1.0 + over * 0.9);
            // 自動回正：車頭朝速度方向靠
            if spd > 1.0 {
                let beta = v_lat.atan2(spd) * sgn(v_long);
                w_t += beta * 3.0 * (gr / gf.max(0.1)).min(1.0) * (1.0 - loose);
            }
            self.yaw_rate += (w_t - self.yaw_rate) * (10.0 * dt).min(1.0);

            // 重新組速度後轉車頭
            let wvx = cy * v_long - sy * v_lat;
            let wvz = sy * v_long + cy * v_lat;
            self.yaw += self.yaw_rate * dt;
            cy = self.yaw.cos();
            sy = self.yaw.sin();
            v_long = wvx * cy + wvz * sy;
            v_lat = -wvx * sy + wvz * cy;

            // 側向抓地
            let alat = (af + ar) * 0.5;
            let dv = v_lat.abs().min(alat * dt);
            v_lat -= sgn(v_lat) * dv;
            if v_long.abs() > 0.5 {
                v_long -= sgn(v_long) * dv * SCRUB;
            }
            self.slip = ((v_lat.abs() - 0.3) / 3.5).clamp(0.0, 1.0);
            if thr > 0.8 && v_long.abs() < 4.0 && gr < 0.7 {
                self.slip = self.slip.max(0.6); // 泥地原地空轉
            }

            self.vx = cy * v_long - sy * v_lat;
            self.vz = sy * v_long + cy * v_lat;

            // 坡度：重力沿坡面分量
            let e = 0.7;
            let hx = (tr.height(self.x + e, self.z) - tr.height(self.x - e, self.z)) / (2.0 * e);
            let hz = (tr.height(self.x, self.z + e) - tr.height(self.x, self.z - e)) / (2.0 * e);
            let k = SLOPE_G / (1.0 + hx * hx + hz * hz).sqrt();
            self.vx -= hx * k * dt;
            self.vz -= hz * k * dt;

            self.wheel_rot += v_long * dt / WHEEL_R;
            self.land_t = (self.land_t - dt).max(0.0);
            // 轉速（三段變速的鋸齒）
            let r = (v_long.abs() / self.vmax().max(1.0)).clamp(0.0, 1.0);
            let g = (r * 3.0).min(2.999);
            let tgt = if thr > 0.0 && v_long.abs() < 1.0 { 0.35 + 0.4 * thr } else { 0.2 + 0.8 * (g - g.floor()) * (0.55 + 0.15 * g) + 0.2 * r };
            self.rpm += (tgt.clamp(0.0, 1.0) - self.rpm) * (8.0 * dt).min(1.0);
        } else {
            // 滯空：只能微調車頭
            self.yaw_rate += (self.steer * 0.6 - self.yaw_rate) * (4.0 * dt).min(1.0);
            self.yaw += self.yaw_rate * dt;
            self.vx *= 1.0 - 0.02 * dt;
            self.vz *= 1.0 - 0.02 * dt;
            self.wheel_rot += (v_long + thr * 10.0) * dt / WHEEL_R;
            self.rpm += ((0.3 + 0.7 * thr) - self.rpm) * (6.0 * dt).min(1.0);
            self.slip = 0.0;
            cy = self.yaw.cos();
            sy = self.yaw.sin();
        }

        self.x += self.vx * dt;
        self.z += self.vz * dt;

        // 牆
        let imp = self.walls(tr);
        if !(self.x.is_finite() && self.z.is_finite()) || tr.is_wall(self.x, self.z) {
            self.x = x0;
            self.z = z0;
            self.vx *= -0.2;
            self.vz *= -0.2;
        }
        if imp > 1.0 {
            fx.wall = Some((imp / 12.0).min(1.0));
        }

        // 垂直：地面跟隨、起跳、落地
        let (g, tp, tro) = self.ground(tr);
        let target = g + WHEEL_R;
        if !self.air {
            let yb = self.y + self.vy * dt - 0.5 * GRAVITY * dt * dt;
            if target < yb - 0.004 && v_long.abs() > 3.0 {
                self.air = true;
                self.air_t = 0.0;
                self.launched = false;
                self.vy = (self.vy * 0.85).min(6.0) - GRAVITY * dt;
                self.y = yb;
            } else {
                let vy = ((target - self.y) / dt).clamp(-12.0, 9.0);
                // 換算成 120 Hz 一步的變化量，讓震動值和步長無關
                let dvy = (vy - self.vy).abs() * (dt * 120.0).min(1.0);
                self.shake += (dvy - self.shake) * (dt / SHAKE_TAU).min(1.0);
                // 顛簸：地面垂直速度突變（坡面轉折、搓板路、土包）吃掉一點速度，避震越好吃得越少
                let jolt = ((vy - self.vy).abs() - BUMP_JOLT_RATE * dt).max(0.0);
                if jolt > 0.0 && v_long.abs() > 2.0 {
                    let loss = (jolt * BUMP_LOSS * bump_keep(self.shocks)).min(0.3);
                    self.vx *= 1.0 - loss;
                    self.vz *= 1.0 - loss;
                    self.bump_loss += loss;
                    self.land_t = self.land_t.max(jolt * 0.04 * bump_keep(self.shocks));
                }
                self.vy = vy;
                self.y = target;
            }
        } else {
            self.air_t += dt;
            self.vy -= GRAVITY * dt;
            self.y += self.vy * dt;
            if !self.launched && self.air_t > 0.08 {
                self.launched = true;
                fx.launch = Some(self.vy.max(0.0));
            }
            if self.y <= target {
                // 地面沿行進方向的垂直速度
                let e = 0.7;
                let hx = (tr.height(self.x + e, self.z) - tr.height(self.x - e, self.z)) / (2.0 * e);
                let hz = (tr.height(self.x, self.z + e) - tr.height(self.x, self.z - e)) / (2.0 * e);
                let gv = hx * self.vx + hz * self.vz;
                let iv = (gv - self.vy).max(0.0);
                let impact = land_impact(iv);
                let loss = impact * land_loss(self.shocks);
                self.bump_loss += loss;
                self.vx *= 1.0 - loss;
                self.vz *= 1.0 - loss;
                self.land_t = upgrade_stat(2, self.shocks) * impact;
                self.shake = self.shake.max(0.25 * impact);
                self.bounce_v -= iv.min(10.0) * 0.12;
                self.y = target;
                self.vy = gv.clamp(-12.0, 9.0);
                self.air = false;
                // 有送出起跳事件才送落地，兩者成對
                if self.launched {
                    fx.land = Some(impact.max(0.05));
                    self.launched = false;
                }
                self.air_t = 0.0;
            }
        }

        // pitch／roll 彈簧阻尼
        if !self.air {
            self.pitch_v += (SUSP_K * (tp - self.pitch) - SUSP_C * self.pitch_v) * dt;
            self.roll_v += (SUSP_K * (tro - self.roll) - SUSP_C * self.roll_v) * dt;
        } else {
            // 滯空：車頭跟著飛行路徑（上升時抬頭、下降時壓低），像街機卡車一樣大致平著落地；±0.9 夾限只當安全網
            let vh = (self.vx * self.vx + self.vz * self.vz).sqrt().max(1.0);
            let tp_air = (0.7 * self.vy.atan2(vh)).clamp(-0.4, 0.4);
            self.pitch_v += (AIR_PITCH_K * (tp_air - self.pitch) - AIR_PITCH_C * self.pitch_v) * dt;
            self.roll_v += (-2.0 * self.roll_v - 1.0 * self.roll) * dt;
        }
        self.pitch = (self.pitch + self.pitch_v * dt).clamp(-0.9, 0.9);
        self.roll = (self.roll + self.roll_v * dt).clamp(-0.7, 0.7);
        self.bounce_v += (-220.0 * self.bounce - 18.0 * self.bounce_v) * dt;
        self.bounce = (self.bounce + self.bounce_v * dt).clamp(-0.25, 0.15);

        // 懸吊壓縮
        let yr = self.y + self.bounce;
        for k in 0..4 {
            let (lx, rz) = WHEELS[k];
            if self.air && self.y > target + 0.05 {
                self.comp[k] += (-0.15 - self.comp[k]) * (8.0 * dt).min(1.0);
            } else {
                let (wx, wz) = self.wheel_pos(k);
                let body = yr + lx * self.pitch.sin() - rz * self.roll.sin();
                let c = tr.height(wx, wz) + WHEEL_R - body;
                self.comp[k] = c.clamp(-0.18, 0.3);
            }
        }

        // 沾泥
        if mudr > 0.0 && !self.air {
            self.mud = (self.mud + mudr * dt * (0.3 + v_long.abs() / 10.0)).min(1.0);
        } else {
            self.mud = (self.mud - 0.02 * dt).max(0.0);
        }
        let surf_now = self.surface;
        if surf_now == WATER && !self.air {
            self.splash_cd -= dt;
            if (prev_surface != WATER || self.splash_cd <= 0.0) && v_long.abs() > 3.0 {
                fx.splash = Some(v_long.abs());
                self.splash_cd = 0.45;
            }
        }
        if surf_now == MUD && prev_surface != MUD && !self.air {
            fx.mud_in = true;
        }
        if self.nitro_t > 0.0 {
            self.nitro_t = (self.nitro_t - dt).max(0.0);
        }
        self.v_long = self.vx * cy + self.vz * sy;
        // 保持精度：輪子轉角繞回；yaw 維持連續（方便內插），只在很大時減掉整數圈
        let tau = core::f32::consts::TAU;
        self.wheel_rot %= tau;
        if self.yaw.abs() > 200.0 {
            self.yaw -= (self.yaw / tau).trunc() * tau;
        }
        fx
    }

    // 兩個圓對 WALL 格子推出，回傳法向撞擊速度
    pub fn walls(&mut self, tr: &Track) -> f32 {
        let mut imp = 0.0f32;
        let hc = tr.cell * 0.5;
        for _ in 0..4 {
            let (cy, sy) = (self.yaw.cos(), self.yaw.sin());
            let mut best: Option<(f32, f32, f32)> = None; // nx, nz, pen
            for off in [-BODY_CX, BODY_CX] {
                let cx = self.x + cy * off;
                let cz = self.z + sy * off;
                let (i0, j0) = tr.cell_of(cx - BODY_R, cz - BODY_R);
                let (i1, j1) = tr.cell_of(cx + BODY_R, cz + BODY_R);
                for j in j0..=j1 {
                    for i in i0..=i1 {
                        if tr.surf_ij(i, j) != WALL {
                            continue;
                        }
                        let sx = tr.ox + i as f32 * tr.cell;
                        let sz = tr.oz + j as f32 * tr.cell;
                        let qx = cx.clamp(sx - hc, sx + hc);
                        let qz = cz.clamp(sz - hc, sz + hc);
                        let dx = cx - qx;
                        let dz = cz - qz;
                        let d = (dx * dx + dz * dz).sqrt();
                        let hit = if d > 1e-4 {
                            if d < BODY_R { Some((dx / d, dz / d, BODY_R - d)) } else { None }
                        } else {
                            // 圓心在格子裡：沿離格子中心較遠的軸推出
                            let ex = cx - sx;
                            let ez = cz - sz;
                            if ex.abs() > ez.abs() {
                                Some((sgn(ex), 0.0, BODY_R + hc - ex.abs()))
                            } else {
                                Some((0.0, sgn(ez), BODY_R + hc - ez.abs()))
                            }
                        };
                        if let Some(h) = hit {
                            if best.is_none_or(|b| h.2 > b.2) {
                                best = Some(h);
                            }
                        }
                    }
                }
            }
            let Some((nx, nz, pen)) = best else { break };
            self.x += nx * (pen + 0.002);
            self.z += nz * (pen + 0.002);
            let vn = self.vx * nx + self.vz * nz;
            if vn < 0.0 {
                imp = imp.max(-vn);
                let e = 0.3;
                self.vx -= (1.0 + e) * vn * nx;
                self.vz -= (1.0 + e) * vn * nz;
                // 切向摩擦
                let f = 1.0 - 0.25 * (-vn / 10.0).min(1.0);
                let tv = self.vx * -nz + self.vz * nx;
                let keep = tv * (1.0 - f);
                self.vx -= -nz * keep;
                self.vz -= nx * keep;
                // 撞牆讓車頭稍微轉向切線
                self.yaw_rate *= 0.5;
            }
        }
        imp
    }
}
