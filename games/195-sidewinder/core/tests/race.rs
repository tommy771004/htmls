// 整合測試：用 Blender 匯出的賽道（若存在）與合成賽道跑完整 4 台 AI 比賽，外加卡位情境
use sidewinder_core::params::WALL;
use sidewinder_core::race::{STATE_LEN, TRUCK_BASE, TRUCK_STRIDE};
use sidewinder_core::synth;
use sidewinder_core::track::{wrap_pi, Track};
use sidewinder_core::{Cfg, World};

const DT: f32 = 1.0 / 120.0;

fn ts(k: usize, f: usize) -> usize {
    TRUCK_BASE + TRUCK_STRIDE * k + f
}

struct Report {
    finish: [f32; 4],
    best: [f32; 4],
    places: [u32; 4],
    time: f32,
}

fn run_race(bytes: &[u8], label: &str, skills: [f32; 4], seed: u32) -> Report {
    let mut w = World::new();
    assert_eq!(w.load_track(bytes), 0, "{label}: 賽道解析失敗");
    for (k, &sk) in skills.iter().enumerate() {
        w.set_truck(k, Cfg { is_ai: true, tires: 0, engine: 0, shocks: 0, nitro: 0, skill: sk });
    }
    w.race_start(seed, 4);
    let tr = Track::parse(bytes).unwrap();
    let mut slow = [0.0f32; 4];
    let mut worst_slow = [0.0f32; 4];
    let mut steps = 0u32;
    let mut airs = 0u32;
    let mut air_t = [0.0f32; 4];
    let mut cp_key = [(usize::MAX, 0u32, false); 4];
    let mut since = [0.0f32; 4];
    let mut jumps: Vec<f32> = Vec::new();
    while w.phase != 3 {
        w.step(DT);
        steps += 1;
        let st = &w.state;
        assert_eq!(st.len(), STATE_LEN);
        for (m, v) in st.iter().enumerate() {
            assert!(v.is_finite(), "{label}: state[{m}] 不是有限值");
        }
        for k in 0..4 {
            let t = &w.trucks[k];
            assert!(t.x.is_finite() && t.z.is_finite() && t.vx.is_finite() && t.y.is_finite());
            assert_ne!(tr.surface(t.x, t.z), WALL, "{label}: 卡車 {k} 在 WALL 格內 ({}, {}) t={}", t.x, t.z, w.time);
            if w.phase == 2 && !t.finished {
                // 漏登檢查點偵測：檢查點間距 ≤ 1/4 圈，跑了大半圈都沒推進就是漏了
                let key = (t.cp_next, t.laps, t.armed);
                if key != cp_key[k] {
                    cp_key[k] = key;
                    since[k] = 0.0;
                }
                since[k] += t.v_long.abs() * DT;
                assert!(since[k] < tr.len * 0.75 + 30.0, "{label}: 卡車 {k} 跑了 {:.0} m 沒通過下一個檢查點 {} @ ({:.1},{:.1})", since[k], t.cp_next, t.x, t.z);
                if t.v_long.abs() < 0.5 {
                    slow[k] += DT;
                    worst_slow[k] = worst_slow[k].max(slow[k]);
                } else {
                    slow[k] = 0.0;
                }
                assert!(slow[k] <= 5.0, "{label}: 卡車 {k} 卡住超過 5 秒 @ ({:.1},{:.1}) t={:.1}", t.x, t.z, w.time);
            }
            if t.air {
                airs += 1;
                air_t[k] += DT;
            } else if air_t[k] > 0.0 {
                if air_t[k] > 0.25 {
                    jumps.push(air_t[k]);
                }
                air_t[k] = 0.0;
            }
        }
        w.events.clear();
        assert!(w.time <= 180.0, "{label}: 180 秒內沒跑完；圈數 {:?}", w.trucks.iter().map(|t| t.laps).collect::<Vec<_>>());
        assert!(steps < 120 * 400, "{label}: 迴圈過長");
    }
    let mut r = Report { finish: [0.0; 4], best: [0.0; 4], places: [0; 4], time: w.time };
    for k in 0..4 {
        let t = &w.trucks[k];
        r.finish[k] = t.finish_time;
        r.best[k] = t.best_lap;
        r.places[k] = t.place;
        assert!(t.finished && !t.dnf, "{label}: 卡車 {k} 沒有正常完賽（進度 {} 圈）", t.laps);
    }
    eprintln!(
        "{label}: 全長 {:.0} m，完賽 {:?}，最佳圈 {:?}，名次 {:?}，最久慢速 {:?}，滯空步數 {airs}",
        tr.len,
        r.finish.map(|v| (v * 10.0).round() / 10.0),
        r.best.map(|v| (v * 10.0).round() / 10.0),
        r.places,
        worst_slow.map(|v| (v * 10.0).round() / 10.0)
    );
    if !jumps.is_empty() {
        let mx = jumps.iter().cloned().fold(0.0, f32::max);
        let avg = jumps.iter().sum::<f32>() / jumps.len() as f32;
        eprintln!("  跳躍（滯空 > 0.25 s）{} 次，平均 {avg:.2} s，最長 {mx:.2} s", jumps.len());
    }
    r
}

fn track_files() -> Vec<(String, Vec<u8>)> {
    // SW_TRACK_DIR 可指定其他目錄（例如預覽產出）
    let dir = std::env::var("SW_TRACK_DIR").unwrap_or_else(|_| concat!(env!("CARGO_MANIFEST_DIR"), "/../blender/out").to_string());
    let mut out = Vec::new();
    for n in 0..4 {
        let p = format!("{dir}/track_{n}.bin");
        match std::fs::read(&p) {
            Ok(b) => out.push((format!("track_{n}"), b)),
            Err(_) => eprintln!("略過 {p}（尚未匯出）"),
        }
    }
    out
}

#[test]
fn synthetic_full_race() {
    let bytes = synth::stadium_bytes();
    // 給 abi_smoke.mjs 用
    let _ = std::fs::write(concat!(env!("CARGO_MANIFEST_DIR"), "/target/synth_track.bin"), &bytes);
    // skill 1.0 平均應該比 0.3 快（單一 seed 會被發車順序與碰撞左右，取 5 個 seed 平均）
    let (mut lo, mut hi) = (0.0f32, 0.0f32);
    for seed in 7..12u32 {
        let r = run_race(&bytes, &format!("synth/seed{seed}"), [0.3, 0.5, 0.7, 1.0], seed);
        assert!(r.time < 180.0);
        lo += r.finish[0];
        hi += r.finish[3];
    }
    assert!(hi < lo, "skill 1.0 平均應快過 0.3：{:.1} vs {:.1}", hi / 5.0, lo / 5.0);
}

#[test]
fn serpent_full_race() {
    let bytes = synth::serpent_bytes();
    let _ = std::fs::write(concat!(env!("CARGO_MANIFEST_DIR"), "/target/serpent_track.bin"), &bytes);
    for seed in [7u32, 8, 9] {
        run_race(&bytes, &format!("serpent/seed{seed}"), [0.3, 0.5, 0.7, 1.0], seed);
    }
}

#[test]
fn blender_tracks_full_race() {
    for (name, b) in track_files() {
        for seed in [1u32, 99] {
            run_race(&b, &format!("{name}/seed{seed}"), [0.3, 0.5, 0.7, 1.0], seed);
        }
    }
}

// 簡單跟車控制器：追著目標卡車後方一點的位置
fn follow(w: &World, tr: &Track, me: usize, tgt: usize, gap: f32) -> (f32, f32, f32) {
    let t = &w.trucks[me];
    let o = &w.trucks[tgt];
    let (fx, fz) = o.fwd();
    let (gx, gz) = (o.x - fx * gap, o.z - fz * gap);
    let dx = gx - t.x;
    let dz = gz - t.z;
    let d = (dx * dx + dz * dz).sqrt();
    // 太近或目標點不好時，沿路徑前瞻
    let (ax, az) = if d < 2.0 {
        tr.pos_at(t.s + 6.0)
    } else {
        (gx, gz)
    };
    let ang = wrap_pi((az - t.z).atan2(ax - t.x) - t.yaw);
    let steer = (ang * 2.5).clamp(-1.0, 1.0);
    let ahead = (o.rv - t.rv) - gap;
    let thr = if ahead > 2.0 { 1.0 } else if ahead > 0.0 { 0.6 } else { 0.0 };
    let brk = if ahead < -2.0 { 0.5 } else { 0.0 };
    (steer, thr, brk)
}

fn blocking_scenario(bytes: &[u8], label: &str) {
    let tr = Track::parse(bytes).unwrap();
    let mut w = World::new();
    w.load_track(bytes);
    w.set_truck(0, Cfg { is_ai: false, tires: 3, engine: 3, shocks: 0, nitro: 0, skill: 0.0 });
    for k in 1..4 {
        w.set_truck(k, Cfg { is_ai: true, tires: 0, engine: 0, shocks: 0, nitro: 0, skill: 0.6 });
    }
    w.race_start(3, 4);
    let mut blocked = [false; 4];
    let mut t = 0.0;
    while t < 60.0 && w.phase != 3 {
        // 跟著名次在自己前面最近的 AI
        let me = &w.trucks[0];
        let mut tgt = 1;
        let mut best = f32::MAX;
        for k in 1..4 {
            let g = w.trucks[k].rv - me.rv;
            if g > 0.0 && g < best {
                best = g;
                tgt = k;
            }
        }
        let (s, th, b) = follow(&w, &tr, 0, tgt, 5.0);
        w.set_input(0, s, th, b, false);
        w.step(DT);
        w.events.clear();
        t += DT;
        for k in 1..4 {
            if w.state[ts(k, 29)] == 1.0 {
                blocked[k] = true;
            }
        }
    }
    let n = blocked.iter().filter(|&&b| b).count();
    eprintln!("{label}: 卡位 AI {:?}", blocked);
    assert!(n >= 1, "{label}: 沒有任何 AI 進入卡位模式");
}

#[test]
fn ai_blocks_player() {
    blocking_scenario(&synth::stadium_bytes(), "synth");
    blocking_scenario(&synth::serpent_bytes(), "serpent");
    for (name, b) in track_files() {
        blocking_scenario(&b, &name);
    }
}

// 診斷：同 skill 四台，看各 skill 的圈速（cargo test -- --ignored --nocapture）
#[test]
#[ignore]
fn pace_by_skill() {
    for (name, bytes) in [("stadium", synth::stadium_bytes()), ("serpent", synth::serpent_bytes())]
        .into_iter()
        .map(|(a, b)| (a.to_string(), b))
        .chain(track_files())
    {
        for sk in [0.0f32, 0.3, 0.5, 0.7, 1.0] {
            let r = run_race(&bytes, &format!("{name} skill {sk}"), [sk; 4], 5);
            let _ = r;
        }
    }
}

#[test]
#[ignore]
fn trace_lap() {
    let bytes = std::env::var("TRACK").ok().and_then(|p| std::fs::read(p).ok()).unwrap_or_else(synth::serpent_bytes);
    let sk: f32 = std::env::var("SKILL").ok().and_then(|v| v.parse().ok()).unwrap_or(1.0);
    let mut w = World::new();
    w.load_track(&bytes);
    for k in 0..4 {
        w.set_truck(k, Cfg { is_ai: true, skill: if k == 3 { sk } else { 0.0 }, ..Cfg::default() });
    }
    w.race_start(5, 4);
    let mut acc = 0.0;
    while w.phase != 3 && w.time < 60.0 {
        w.step(DT);
        acc += DT;
        let t = &w.trucks[3];
        if acc >= 0.25 {
            acc = 0.0;
            eprintln!(
                "t={:5.2} s={:6.1} lat={:5.1} x={:6.1} z={:6.1} v={:5.1} va={:5.1} mode={} air={} slip={:.2} surf={} lap={} place={}",
                w.time, t.s, t.lat, t.x, t.z, t.v_long, t.ai.vallow, t.ai.mode, t.air as u8, t.slip, t.surface, t.laps, t.place
            );
        }
        w.events.clear();
    }
}

// 診斷：升級過的「玩家代理」（skill 0.7 的 AI）對上 skill 0.5／1.0 的對手
#[test]
#[ignore]
fn upgraded_proxy() {
    for (name, bytes) in [("stadium", synth::stadium_bytes()), ("serpent", synth::serpent_bytes())]
        .into_iter()
        .map(|(a, b)| (a.to_string(), b))
        .chain(track_files())
    {
        for (lvl, opp) in [(0u32, 0.5f32), (3, 0.5), (5, 0.5), (0, 1.0), (3, 1.0), (5, 1.0)] {
            let mut wins = 0;
            let mut sum = 0.0;
            for seed in 1..=6u32 {
                let mut w = World::new();
                w.load_track(&bytes);
                w.set_truck(0, Cfg { is_ai: true, tires: lvl, engine: lvl, shocks: lvl, nitro: lvl, skill: 0.7 });
                for k in 1..4 {
                    w.set_truck(k, Cfg { is_ai: true, skill: opp, ..Cfg::default() });
                }
                w.race_start(seed, 4);
                while w.phase != 3 && w.time < 200.0 {
                    w.step(DT);
                    w.events.clear();
                }
                if w.trucks[0].place == 1 {
                    wins += 1;
                }
                sum += w.trucks[0].place as f32;
            }
            eprintln!("{name}: 代理升級 lvl{lvl} vs skill {opp}：6 場贏 {wins}，平均名次 {:.1}", sum / 6.0);
        }
    }
}

// 診斷：數位鍵盤式玩家（轉向只有 -1/0/1、油門全開）能不能跑完、圈速多少
#[test]
#[ignore]
fn keyboard_bot() {
    for (name, bytes) in [("serpent", synth::serpent_bytes())].into_iter().map(|(a, b)| (a.to_string(), b)).chain(track_files()) {
        let tr = Track::parse(&bytes).unwrap();
        let mut w = World::new();
        w.load_track(&bytes);
        w.set_truck(0, Cfg { is_ai: false, ..Cfg::default() });
        for k in 1..4 {
            w.set_truck(k, Cfg { is_ai: true, skill: 0.5, ..Cfg::default() });
        }
        w.race_start(3, 4);
        let mut walls = 0;
        while w.phase != 3 && w.time < 150.0 {
            let t = &w.trucks[0];
            let la = 4.0 + 0.35 * t.v_long.abs();
            let (gx, gz) = tr.pos_at(t.s + la);
            let ang = wrap_pi((gz - t.z).atan2(gx - t.x) - t.yaw);
            let steer = if ang > 0.12 { 1.0 } else if ang < -0.12 { -1.0 } else { 0.0 };
            let k = tr.curv_at(t.s + 6.0).abs();
            let brk = if k > 0.12 && t.v_long > 10.0 { 1.0 } else { 0.0 };
            w.set_input(0, steer, 1.0 - brk, brk, false);
            w.step(DT);
            walls += w.events.iter().filter(|e| e[0] == 8.0 && e[1] == 0.0).count();
            w.events.clear();
        }
        let t = &w.trucks[0];
        eprintln!("{name}: 鍵盤機器人 名次 {} 圈 {} 最佳圈 {:.1} 撞牆 {walls}；AI 最佳圈 {:?}", t.place, t.laps, t.best_lap,
            (1..4).map(|k| (w.trucks[k].best_lap * 10.0).round() / 10.0).collect::<Vec<_>>());
    }
}

#[test]
#[ignore]
fn track_info() {
    for (name, bytes) in track_files() {
        let tr = Track::parse(&bytes).unwrap();
        let mut w = World::new();
        w.load_track(&bytes);
        let arm: Vec<bool> = w.trucks.iter().map(|t| t.armed).collect();
        let cps: Vec<i32> = tr.cps.iter().map(|&c| tr.cum[c] as i32).collect();
        let walls = (0..4).filter(|&k| { let s = tr.starts[k]; tr.is_wall(s[0], s[1]) }).count();
        let maxk = tr.curv.iter().fold(0.0f32, |a, &b| a.max(b.abs()));
        eprintln!("{name}: 長 {:.0} m，路徑點 {}，檢查點弧長 {cps:?}，發車已上線 {arm:?}，發車格在牆 {walls}，最大曲率 {maxk:.2}，道具點 {}", tr.len, tr.path.len(), tr.pickups.len());
        let lips: Vec<String> = tr.lips.iter().map(|l| format!("s={:.1} 坡{:.2} 飛@14:{:.1} 飛@22:{:.1}", l[0], l[1], tr.flight(l[0], l[1], 14.0).0, tr.flight(l[0], l[1], 22.0).0)).collect();
        eprintln!("  起跳點 {lips:?}");
        for (sk, up) in [(0.5f32, 0u32), (0.93, 0), (0.93, 5)] {
            let alat = 16.5 * sidewinder_core::params::upgrade_stat(0, up) * (0.6 + 0.44 * sk);
            let b = 22.0 * (0.4 + 0.4 * sk);
            let vmax = sidewinder_core::params::upgrade_stat(1, up);
            let vs: Vec<String> = tr.lips.iter().map(|l| format!("{:.1}", sidewinder_core::ai::lip_speed(&tr, *l, alat, b, vmax * 1.38 * 1.06, 0.2))).collect();
            eprintln!("  skill {sk} up{up} vmax {vmax:.1}：安全起跳速度 {vs:?}");
        }
    }
}

#[test]
#[ignore]
fn trace_truck() {
    let bytes = std::env::var("TRACK").ok().and_then(|p| std::fs::read(p).ok()).unwrap_or_else(synth::serpent_bytes);
    let k: usize = std::env::var("K").ok().and_then(|v| v.parse().ok()).unwrap_or(0);
    let seed: u32 = std::env::var("SEED").ok().and_then(|v| v.parse().ok()).unwrap_or(7);
    let mut w = World::new();
    w.load_track(&bytes);
    for (i, sk) in [0.3f32, 0.5, 0.7, 1.0].iter().enumerate() {
        w.set_truck(i, Cfg { is_ai: true, skill: *sk, ..Cfg::default() });
    }
    w.race_start(seed, 4);
    let mut acc = 0.0;
    while w.phase != 3 && w.time < 150.0 {
        w.step(DT);
        acc += DT;
        let t = &w.trucks[k];
        for e in &w.events {
            if e[1] as usize == k && e[0] >= 7.0 {
                eprintln!("  ev {} a={:.2} b={:.0} t={:.2}", e[0], e[2], e[3], w.time);
            }
        }
        if acc >= 0.5 {
            acc = 0.0;
            eprintln!(
                "t={:5.2} s={:6.1} lat={:5.1} x={:6.1} z={:6.1} yaw={:5.2} v={:5.1} va={:5.1} mode={} air={} slip={:.2} surf={} lap={} cp={} place={}",
                w.time, t.s, t.lat, t.x, t.z, t.yaw, t.v_long, t.ai.vallow, t.ai.mode, t.air as u8, t.slip, t.surface, t.laps, t.cp_next, t.place
            );
        }
        w.events.clear();
    }
}

// 壓力測試：多個 seed（cargo test -- --ignored stress）
#[test]
#[ignore]
fn stress_many_seeds() {
    let n: u32 = std::env::var("SEEDS").ok().and_then(|v| v.parse().ok()).unwrap_or(20);
    for (name, bytes) in [("stadium", synth::stadium_bytes()), ("serpent", synth::serpent_bytes())]
        .into_iter()
        .map(|(a, b)| (a.to_string(), b))
        .chain(track_files())
    {
        for seed in 100..100 + n {
            run_race(&bytes, &format!("{name}/{seed}"), [0.3, 0.5, 0.7, 1.0], seed);
            run_race(&bytes, &format!("{name}/{seed}/same"), [0.6; 4], seed);
        }
    }
}

// 診斷：實際飛行距離與 Track::flight 預測比較（cargo test --release --test race flight_model -- --ignored --nocapture）
#[test]
#[ignore]
fn flight_model() {
    for (name, bytes) in track_files() {
        let tr = Track::parse(&bytes).unwrap();
        let mut w = World::new();
        w.load_track(&bytes);
        let up: u32 = std::env::var("UP").ok().and_then(|v| v.parse().ok()).unwrap_or(0);
        for k in 0..4 {
            w.set_truck(k, Cfg { is_ai: true, tires: up, engine: up, shocks: up, nitro: up, skill: 0.9 });
        }
        w.race_start(3, 4);
        let mut st: [Option<(f32, f32, f32, f32)>; 4] = [None; 4];
        let mut rows = Vec::new();
        while w.phase != 3 && w.time < 150.0 {
            w.step(DT);
            w.events.clear();
            for k in 0..4 {
                let t = &w.trucks[k];
                match (t.air, st[k]) {
                    (true, None) => st[k] = Some((t.s, t.x, t.z, t.v_long)),
                    (false, Some((s0, x0, z0, v0))) => {
                        let d = ((t.x - x0).powi(2) + (t.z - z0).powi(2)).sqrt();
                        if d > 2.0 {
                            let lip = tr.lips.iter().min_by(|a, b| tr.wrap_s(s0 - a[0] + 3.0).partial_cmp(&tr.wrap_s(s0 - b[0] + 3.0)).unwrap()).copied().unwrap_or([0.0, 0.0]);
                            let pred = tr.flight(lip[0], lip[1], v0);
                            rows.push(format!("s0={s0:.1} lip={:.1} v={v0:.1} d={d:.1} pred={:.1}{}", lip[0], pred.0, if pred.1 { "W" } else { "" }));
                        }
                        st[k] = None;
                    }
                    _ => {}
                }
            }
        }
        rows.sort();
        rows.dedup();
        eprintln!("{name}:");
        for r in rows.iter().step_by(2) {
            eprintln!("  {r}");
        }
    }
}

// 診斷：落地＋顛簸累計掉速（SH=避震等級）
#[test]
#[ignore]
fn bump_budget() {
    let sh: u32 = std::env::var("SH").ok().and_then(|v| v.parse().ok()).unwrap_or(0);
    for (name, bytes) in track_files() {
        let mut w = World::new();
        w.load_track(&bytes);
        for k in 0..4 {
            w.set_truck(k, Cfg { is_ai: true, tires: 0, engine: 0, shocks: sh, nitro: 0, skill: 0.85 });
        }
        w.race_start(5, 4);
        let (mut sm_sum, mut sm_n, mut sh_hi) = (0.0f32, 0u32, 0u32);
        while w.phase != 3 && w.time < 200.0 {
            w.step(DT);
            w.events.clear();
            if w.phase == 2 {
                for t in &w.trucks {
                    sm_sum += t.shake_mul();
                    sm_n += 1;
                    if t.shake > 0.1 { sh_hi += 1; }
                }
            }
        }
        let bl: Vec<f32> = w.trucks.iter().map(|t| (t.bump_loss * 100.0).round() / 100.0).collect();
        eprintln!("  平均震動折扣 {:.3}，震動 > 0.1 的時間比例 {:.3}", sm_sum / sm_n as f32, sh_hi as f32 / sm_n as f32);
        let ft: Vec<f32> = w.trucks.iter().map(|t| (t.finish_time * 10.0).round() / 10.0).collect();
        eprintln!("{name} shocks{sh}: 累計掉速比例 {bl:?} 完賽 {ft:?}");
    }
}

// 回歸：第 0 條賽道（兩個長跳台後接彎）上，升級 3–5 級的 AI 不會用氮氣飛進牆後卡住倒車。
// 3 個 seed 平均每台每場的脫困（mode 2）時間要 < 1 秒。
#[test]
fn track0_upgraded_ai_no_pileups() {
    let files = track_files();
    let Some((_, bytes)) = files.iter().find(|(n, _)| n == "track_0") else { return };
    let ups = [(0.85f32, [3u32, 3, 3, 3]), (0.94, [5, 5, 5, 5]), (0.89, [5, 5, 5, 5]), (0.84, [4, 4, 5, 4])];
    let mut rec = 0.0f32;
    let seeds = [1u32, 2, 3];
    for &seed in &seeds {
        let mut w = World::new();
        w.load_track(bytes);
        for (k, (sk, u)) in ups.iter().enumerate() {
            w.set_truck(k, Cfg { is_ai: true, tires: u[0], engine: u[1], shocks: u[2], nitro: u[3], skill: *sk });
        }
        w.race_start(seed, 4);
        while w.phase != 3 && w.time < 200.0 {
            w.step(DT);
            w.events.clear();
            if w.phase == 2 {
                rec += w.trucks.iter().filter(|t| t.ai.mode == 2 && !t.finished).count() as f32 * DT;
            }
        }
        assert_eq!(w.phase, 3, "seed {seed}: 沒跑完");
    }
    let per = rec / (seeds.len() * 4) as f32;
    eprintln!("track_0 升級 AI：平均每台每場脫困 {per:.2} s");
    assert!(per < 1.0, "脫困時間過長 {per:.2} s／台／場");
}
