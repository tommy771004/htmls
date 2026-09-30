// 單元測試：解析、高度取樣、牆、跳台、防作弊、決定性
use crate::params::*;
use crate::race::*;
use crate::synth::{self, Spec};
use crate::track::*;
use crate::{Cfg, World};

const DT: f32 = 1.0 / 120.0;

fn tiny() -> Spec {
    let mut s = synth::stadium();
    s.gw = 3;
    s.gh = 3;
    s.cell = 1.0;
    s.ox = 0.0;
    s.oz = 0.0;
    s.h = (0..9).map(|k| ((k % 3) + (k / 3)) as f32).collect();
    s.surf = vec![DIRT, MUD, WATER, JUMP, RAMP, INFIELD, WALL, LOOSE, DIRT];
    s.path = vec![[0.0, 0.0, 2.0], [2.0, 0.0, 2.0], [2.0, 2.0, 2.0], [0.0, 2.0, 2.0]];
    s.flags = vec![0, 8, 0, 8];
    s.pickups = vec![[1.0, 1.0]];
    s
}

#[test]
fn parse_synthetic() {
    let b = synth::stadium_bytes();
    let t = Track::parse(&b).ok().unwrap();
    assert_eq!(t.id, 9);
    assert_eq!((t.gw, t.gh), (145, 97));
    assert_eq!(t.laps, 4);
    assert!((t.len - synth::stadium_len()).abs() < 0.5, "len {}", t.len);
    assert_eq!(t.pickups.len(), 5);
    assert!(t.cps.len() >= 3);
    assert_eq!(t.surface(0.0, 13.0), DIRT);
    assert_eq!(t.surface(0.0, 0.0), WALL);
    assert_eq!(t.surface(-100.0, 0.0), WALL);
    assert_eq!(t.surface(8.0, 13.0), MUD);
    // 起點 index 0 在 x = -6
    assert!((t.path[0].x + 6.0).abs() < 1e-3 && (t.path[0].z - 13.0).abs() < 1e-3);
}

#[test]
fn parse_errors() {
    let b = synth::stadium_bytes();
    assert_eq!(Track::parse(&b[..50]).err(), Some(E_SHORT));
    assert_eq!(Track::parse(&b[..b.len() - 4]).err(), Some(E_SHORT));
    let mut m = b.clone();
    m[0] = b'X';
    assert_eq!(Track::parse(&m).err(), Some(E_MAGIC));
    let mut v = b.clone();
    v[4] = 2;
    assert_eq!(Track::parse(&v).err(), Some(E_VERSION));
    let mut w = World::new();
    assert_eq!(w.load_track(&m), E_MAGIC);
    // 沒有賽道時其他呼叫不當機
    w.race_start(1, 4);
    w.step(DT);
    w.set_input(9, 1.0, 1.0, 0.0, true);
    assert_eq!(w.state.len(), STATE_LEN);
}

#[test]
fn height_bilinear() {
    let b = synth::encode(&tiny());
    let t = Track::parse(&b).ok().unwrap();
    let near = |a: f32, b: f32| (a - b).abs() < 1e-4;
    assert!(near(t.height(0.0, 0.0), 0.0));
    assert!(near(t.height(1.0, 1.0), 2.0));
    assert!(near(t.height(0.5, 0.5), 1.0));
    assert!(near(t.height(1.25, 0.5), 1.75));
    assert!(near(t.height(2.0, 2.0), 4.0));
    assert!(near(t.height(-5.0, -5.0), 0.0));
    assert!(near(t.height(10.0, 1.0), 3.0));
    // 最近取樣點
    assert_eq!(t.surface(0.4, 0.0), DIRT);
    assert_eq!(t.surface(0.6, 0.0), MUD);
    assert_eq!(t.surface(2.0, 1.0), INFIELD);
    assert_eq!(t.surface(0.0, 2.0), WALL);
    assert_eq!(t.surface(1.0, 2.0), LOOSE);
    assert_eq!(t.surface(3.0, 0.0), WALL);
}

// 比賽進入進行中，所有車都是不動的玩家車
fn racing_world() -> World {
    let mut w = World::new();
    assert_eq!(w.load_track(&synth::stadium_bytes()), 0);
    for k in 0..4 {
        w.set_truck(k, Cfg { is_ai: false, ..Cfg::default() });
    }
    w.race_start(5, 4);
    for _ in 0..(3.2 / DT) as usize {
        w.step(DT);
    }
    assert_eq!(w.phase, 2);
    w
}

fn teleport(w: &mut World, k: usize, x: f32, z: f32, yaw: f32, v: f32) {
    let tr = w.track.take().unwrap();
    let t = &mut w.trucks[k];
    t.place_at(&tr, x, z, yaw);
    t.vx = yaw.cos() * v;
    t.vz = yaw.sin() * v;
    t.s = tr.project(x, z, -1.0, 0.0).0;
    w.track = Some(tr);
}

#[test]
fn wall_never_entered() {
    let tr = Track::parse(&synth::stadium_bytes()).ok().unwrap();
    // 各種角度與速度衝向外牆與內場牆
    let cases = [
        (0.0, 13.0, 1.5708, 25.0, 0.0),
        (0.0, 13.0, 1.2, 20.0, 0.3),
        (0.0, 13.0, 2.0, 18.0, -0.5),
        (0.0, -13.0, 1.5708, 22.0, 0.0),  // 往內場
        (0.0, -13.0, -1.5708, 22.0, 1.0), // 往北牆
        (28.0, 0.0, 0.0, 25.0, 0.0),      // 東彎外牆
        (-28.0, 5.0, 2.6, 25.0, -1.0),
    ];
    for (n, &(x, z, yaw, v, steer)) in cases.iter().enumerate() {
        let mut w = racing_world();
        teleport(&mut w, 0, x, z, yaw, v);
        let mut hits = 0;
        for i in 0..(5.0 / DT) as usize {
            let nitro = i % 240 == 0;
            w.set_input(0, steer, 1.0, 0.0, nitro);
            w.step(DT);
            let t = &w.trucks[0];
            assert_ne!(tr.surface(t.x, t.z), WALL, "case {n}: 進入牆格 ({}, {})", t.x, t.z);
            hits += w.events.iter().filter(|e| e[0] == 8.0 && e[1] == 0.0).count();
            w.events.clear();
        }
        assert!(hits > 0, "case {n}: 應該撞到牆");
    }
}

#[test]
fn jump_launch_and_land() {
    let mut w = racing_world();
    // 北直線往西，跳台在 x ∈ [0, 4]
    teleport(&mut w, 0, 12.0, -13.0, core::f32::consts::PI, 15.0);
    let mut air_start = -1.0;
    let mut air_end = -1.0;
    let mut launch_ev = false;
    let mut land_ev = None;
    for i in 0..(3.0 / DT) as usize {
        w.set_input(0, 0.0, 1.0, 0.0, false);
        w.step(DT);
        let t = &w.trucks[0];
        let tm = i as f32 * DT;
        if t.air && air_start < 0.0 {
            air_start = tm;
        }
        if !t.air && air_start >= 0.0 && air_end < 0.0 && tm - air_start > 0.1 {
            air_end = tm;
        }
        for e in &w.events {
            if e[1] == 0.0 && e[0] == EV_LAUNCH {
                launch_ev = true;
            }
            if e[1] == 0.0 && e[0] == EV_LAND {
                land_ev = Some(e[2]);
            }
        }
        w.events.clear();
    }
    let air = air_end - air_start;
    eprintln!("滯空 {air:.2} s，落地衝擊 {land_ev:?}，速度 {:.1}", w.trucks[0].v_long);
    assert!(air_start >= 0.0 && air_end > 0.0, "沒有起跳或沒有落地");
    assert!((0.35..=1.1).contains(&air), "滯空 {air}");
    assert!(launch_ev && land_ev.is_some());
}

#[test]
fn surfaces_slow_down() {
    // 在各地面上全油門直線跑，看穩定速度
    let tr = Track::parse(&synth::stadium_bytes()).ok().unwrap();
    let top = |s: u8| {
        let mut sp = synth::stadium();
        for (k, v) in sp.surf.iter_mut().enumerate() {
            if *v != WALL {
                *v = s;
                sp.h[k] = 0.0;
            }
        }
        let b = synth::encode(&sp);
        let mut w = World::new();
        w.load_track(&b);
        for k in 0..4 {
            w.set_truck(k, Cfg { is_ai: false, ..Cfg::default() });
        }
        w.race_start(1, 4);
        for _ in 0..(3.1 / DT) as usize {
            w.step(DT);
        }
        // 其他車移到北直線，不擋路
        for k in 1..4 {
            teleport(&mut w, k, 5.0 * k as f32, -13.0, 0.0, 0.0);
        }
        teleport(&mut w, 0, -17.0, 13.0, 0.0, 0.0);
        let mut vmax: f32 = 0.0;
        for _ in 0..(2.4 / DT) as usize {
            w.set_input(0, 0.0, 1.0, 0.0, false);
            w.step(DT);
            vmax = vmax.max(w.trucks[0].v_long);
        }
        vmax
    };
    let d = top(DIRT);
    let m = top(MUD);
    let wa = top(WATER);
    let inf = top(INFIELD);
    eprintln!("2.4 秒後極速：泥土 {d:.1}，泥地 {m:.1}，水 {wa:.1}，草 {inf:.1}");
    assert!(m < d * 0.7 && wa < d * 0.7 && inf < d * 0.7);
    let _ = tr;
}

#[test]
fn lap_cannot_be_cheated() {
    let mut w = racing_world();
    // 發車格在線後（x=-9, -13），線在 x=-6：往前過線只算上線
    let drive = |w: &mut World, thr: f32, brk: f32, secs: f32| {
        for _ in 0..(secs / DT) as usize {
            w.set_input(0, 0.0, thr, brk, false);
            w.step(DT);
        }
    };
    drive(&mut w, 1.0, 0.0, 1.2);
    assert!(w.trucks[0].x > -6.0, "應該過線 x={}", w.trucks[0].x);
    assert!(w.trucks[0].armed);
    assert_eq!(w.trucks[0].laps, 0);
    // 煞停後倒車過線，再往前過線
    drive(&mut w, 0.0, 1.0, 3.5);
    assert!(w.trucks[0].x < -6.5, "應該倒回線後 x={}", w.trucks[0].x);
    drive(&mut w, 1.0, 0.0, 1.5);
    assert!(w.trucks[0].x > -6.0);
    assert_eq!(w.trucks[0].laps, 0, "倒車再過線不算圈");
    assert_eq!(w.trucks[0].cp_next, 0);
    // 直接瞬移到線前再過線：沒通過檢查點，不算
    for _ in 0..3 {
        teleport(&mut w, 0, -8.0, 13.0, 0.0, 8.0);
        drive(&mut w, 1.0, 0.0, 0.6);
    }
    assert_eq!(w.trucks[0].laps, 0);
    // 反著跑整圈（往西繞）到線前再掉頭過線
    teleport(&mut w, 0, -12.0, 13.0, core::f32::consts::PI, 0.0);
    let tr = Track::parse(&synth::stadium_bytes()).ok().unwrap();
    let mut dist = 0.0;
    for _ in 0..(60.0 / DT) as usize {
        let t = &w.trucks[0];
        dist += t.v_long.abs() * DT;
        // 沿路徑反方向前瞻
        let (gx, gz) = tr.pos_at(t.s - 6.0);
        let ang = wrap_pi((gz - t.z).atan2(gx - t.x) - t.yaw);
        w.set_input(0, (ang * 2.5).clamp(-1.0, 1.0), 0.7, 0.0, false);
        w.step(DT);
        if dist > tr.len - 10.0 && w.trucks[0].x < -3.0 && w.trucks[0].z > 8.0 {
            break;
        }
    }
    let t = &w.trucks[0];
    eprintln!("逆向繞圈後 x={:.1} z={:.1} t={:.1} rv={:.1} cp_next={}", t.x, t.z, w.time, t.rv, t.cp_next);
    assert!(dist > tr.len - 10.0 && t.x < -3.0, "逆向應繞完一圈");
    assert_eq!(t.laps, 0, "逆向繞圈不算");
    // 反向跑不會通過任何檢查點，進度最多夾在第一個檢查點
    assert_eq!(t.cp_next, 0);
    assert!(t.rv <= tr.cum[tr.cps[0]] + 1e-3, "rv {}", t.rv);
    // 逆向越過線後掉頭往前過線
    teleport(&mut w, 0, -10.0, 13.0, 0.0, 6.0);
    drive(&mut w, 1.0, 0.0, 1.0);
    assert!(w.trucks[0].x > -5.0);
    assert_eq!(w.trucks[0].laps, 0, "逆向一圈後再過線不算");
}

#[test]
fn shortcut_does_not_count() {
    // 內場全部改成可通行的草地，從南直線直接穿過內場到北直線，跳過東彎的檢查點
    let mut sp = synth::stadium();
    for j in 0..sp.gh {
        for i in 0..sp.gw {
            let x = sp.ox + i as f32 * sp.cell;
            let z = sp.oz + j as f32 * sp.cell;
            let k = j * sp.gw + i;
            if sp.surf[k] == WALL && x.abs() < 16.0 && z.abs() < 8.0 {
                sp.surf[k] = INFIELD;
                sp.h[k] = 0.0;
            }
        }
    }
    let b = synth::encode(&sp);
    let tr = Track::parse(&b).ok().unwrap();
    let mut w = World::new();
    w.load_track(&b);
    for k in 0..4 {
        w.set_truck(k, Cfg { is_ai: false, ..Cfg::default() });
    }
    w.race_start(2, 4);
    for _ in 0..(3.2 / DT) as usize {
        w.step(DT);
    }
    let go = |w: &mut World, tx: f32, tz: f32, secs: f32| {
        for _ in 0..(secs / DT) as usize {
            let t = &w.trucks[0];
            let ang = wrap_pi((tz - t.z).atan2(tx - t.x) - t.yaw);
            w.set_input(0, (ang * 2.5).clamp(-1.0, 1.0), 0.8, 0.0, false);
            w.step(DT);
            let t = &w.trucks[0];
            if (t.x - tx).abs() < 1.5 && (t.z - tz).abs() < 1.5 {
                break;
            }
        }
    };
    // 過線上線，再往北穿越內場，沿北直線往西，繞西彎回到線前
    go(&mut w, 0.0, 13.0, 3.0);
    assert!(w.trucks[0].armed);
    go(&mut w, 0.0, -13.0, 6.0);
    assert!(w.trucks[0].z < -11.0, "應該穿過內場到北直線 z={}", w.trucks[0].z);
    go(&mut w, -17.0, -13.0, 4.0);
    go(&mut w, -30.0, 0.0, 4.0);
    go(&mut w, -17.0, 13.0, 4.0);
    go(&mut w, 0.0, 13.0, 4.0);
    let t = &w.trucks[0];
    assert!(t.x > -3.0, "應該回到線後方 x={}", t.x);
    assert_eq!(t.laps, 0, "抄捷徑不算圈");
    assert_eq!(t.cp_next, 0, "跳過的檢查點不能補登");
    assert!(t.rv <= tr.cum[tr.cps[0]] + 1e-3);
}

#[test]
fn legit_lap_counts() {
    let mut w = World::new();
    w.load_track(&synth::stadium_bytes());
    for k in 0..4 {
        w.set_truck(k, Cfg { is_ai: true, skill: 1.0, ..Cfg::default() });
    }
    w.race_start(11, 2);
    let mut laps_ev = 0;
    for _ in 0..(60.0 / DT) as usize {
        w.step(DT);
        laps_ev += w.events.iter().filter(|e| e[0] == EV_LAP).count();
        w.events.clear();
        if w.phase == 3 {
            break;
        }
    }
    assert_eq!(w.phase, 3);
    assert_eq!(laps_ev, 8);
    let mut places: Vec<f32> = (0..4).map(|k| w.state[TRUCK_BASE + TRUCK_STRIDE * k + 15]).collect();
    places.sort_by(|a, b| a.partial_cmp(b).unwrap());
    assert_eq!(places, vec![1.0, 2.0, 3.0, 4.0]);
}

#[test]
fn deterministic() {
    let run = || {
        let mut w = World::new();
        w.load_track(&synth::stadium_bytes());
        w.set_truck(0, Cfg { is_ai: false, tires: 2, engine: 3, shocks: 1, nitro: 2, skill: 0.0 });
        for k in 1..4 {
            w.set_truck(k, Cfg { is_ai: true, skill: 0.3 * k as f32, ..Cfg::default() });
        }
        w.race_start(1234, 4);
        let mut evs = Vec::new();
        for i in 0..(45.0 / DT) as usize {
            let t = i as f32 * DT;
            w.set_input(0, (t * 0.7).sin(), 1.0, 0.0, i % 400 == 0);
            w.step(DT);
            evs.extend(w.events.drain(..));
        }
        (w.state.clone(), evs)
    };
    let (a, ea) = run();
    let (b, eb) = run();
    assert_eq!(a.iter().map(|v| v.to_bits()).collect::<Vec<_>>(), b.iter().map(|v| v.to_bits()).collect::<Vec<_>>());
    assert_eq!(ea.len(), eb.len());
    assert!(ea.iter().zip(eb.iter()).all(|(x, y)| x.iter().zip(y.iter()).all(|(p, q)| p.to_bits() == q.to_bits())));
}

#[test]
fn upgrade_stats() {
    assert!((upgrade_stat(1, 5) / upgrade_stat(1, 0) - 1.3).abs() < 1e-4);
    assert!(upgrade_stat(0, 5) > upgrade_stat(0, 0));
    assert!(upgrade_stat(2, 5) < upgrade_stat(2, 0));
    assert_eq!(upgrade_stat(3, 2), 5.0);
    assert_eq!(upgrade_stat(9, 2), 0.0);
    assert_eq!(upgrade_stat(1, 99), upgrade_stat(1, 5));
}

// 滯空時車頭跟著飛行路徑：落地不會抬頭撞到 ±0.9 的夾限（SPEC §6）
#[test]
fn air_pitch_follows_flight_path() {
    let mut w = racing_world();
    teleport(&mut w, 0, 12.0, -13.0, core::f32::consts::PI, 16.0);
    let mut max_air = 0.0f32;
    let mut land_pitch = None;
    let mut was_air = false;
    for _ in 0..(3.0 / DT) as usize {
        w.set_input(0, 0.0, 1.0, 0.0, false);
        w.step(DT);
        w.events.clear();
        let t = &w.trucks[0];
        if t.air {
            max_air = max_air.max(t.pitch.abs());
        } else if was_air && land_pitch.is_none() {
            land_pitch = Some(t.pitch);
        }
        was_air = t.air;
    }
    eprintln!("滯空最大 |pitch| {max_air:.2}，落地 pitch {land_pitch:?}");
    assert!(max_air < 0.6, "滯空 pitch 過大 {max_air}");
    assert!(land_pitch.is_some_and(|p| p.abs() < 0.5));
}

// 避震：同一條跳台，lvl5 落地後的速度比 lvl0 快；顛簸掉速也比較少
#[test]
fn shocks_reduce_landing_and_bump_loss() {
    let run = |sh: u32| {
        let mut w = racing_world();
        w.set_truck(0, Cfg { is_ai: false, shocks: sh, ..Cfg::default() });
        teleport(&mut w, 0, 12.0, -13.0, core::f32::consts::PI, 17.0);
        for _ in 0..(2.5 / DT) as usize {
            w.set_input(0, 0.0, 1.0, 0.0, false);
            w.step(DT);
            w.events.clear();
        }
        (w.trucks[0].x, w.trucks[0].bump_loss)
    };
    let (x0, l0) = run(0);
    let (x5, l5) = run(5);
    eprintln!("避震 0：x {x0:.2} 掉速 {l0:.3}；避震 5：x {x5:.2} 掉速 {l5:.3}");
    assert!(l5 < l0 * 0.5, "避震 5 的落地／顛簸掉速應少很多");
    assert!(x5 < x0, "避震 5 應該跑得比較遠（往西）");
}

// 逆向提示：倒著開超過 1 秒送出 EV_WRONG a=1，轉回正向後送 a=0
#[test]
fn wrong_way_event() {
    let mut w = racing_world();
    // 倒車（車頭朝正向、往後退）不算逆向
    teleport(&mut w, 0, -20.0, -13.0, core::f32::consts::PI, 0.0);
    for _ in 0..(2.5 / DT) as usize {
        w.set_input(0, 0.0, 0.0, 1.0, false);
        w.step(DT);
        assert!(!w.events.iter().any(|e| e[0] == EV_WRONG && e[1] == 0.0), "倒車不該送出逆向");
        w.events.clear();
    }
    assert!(w.trucks[0].v_long < -3.0, "應該在倒車 {}", w.trucks[0].v_long);
    // 北直線的行車方向往西（見 jump_launch_and_land），往東開就是逆向
    teleport(&mut w, 0, -20.0, -13.0, 0.0, 8.0);
    let mut on = None;
    for i in 0..(2.0 / DT) as usize {
        w.set_input(0, 0.0, 0.6, 0.0, false);
        w.step(DT);
        for e in &w.events {
            if e[0] == EV_WRONG && e[1] == 0.0 && e[2] == 1.0 && on.is_none() {
                on = Some(i as f32 * DT);
            }
        }
        w.events.clear();
    }
    assert!(on.is_some_and(|t| t > 0.9 && t < 1.5), "逆向提示時間 {on:?}");
    teleport(&mut w, 0, 20.0, -13.0, core::f32::consts::PI, 8.0);
    let mut off = false;
    for _ in 0..(1.5 / DT) as usize {
        w.set_input(0, 0.0, 0.6, 0.0, false);
        w.step(DT);
        off |= w.events.iter().any(|e| e[0] == EV_WRONG && e[1] == 0.0 && e[2] == 0.0);
        w.events.clear();
    }
    assert!(off, "回正後應送出 a=0");
}

// 表頭 9：玩家上線前 -1，上線後是本圈起算時間
#[test]
fn player_lap_start_slot() {
    let mut w = World::new();
    w.load_track(&synth::stadium_bytes());
    w.set_truck(0, Cfg { is_ai: false, ..Cfg::default() });
    w.race_start(5, 4);
    w.step(DT);
    assert_eq!(w.state[9], if w.trucks[0].armed { 0.0 } else { -1.0 });
    let mut armed_at = None;
    for _ in 0..(20.0 / DT) as usize {
        let t = &w.trucks[0];
        let tr = w.track.as_ref().unwrap();
        let (gx, gz) = tr.pos_at(t.s + 6.0);
        let ang = crate::track::wrap_pi((gz - t.z).atan2(gx - t.x) - t.yaw);
        w.set_input(0, (ang * 2.5).clamp(-1.0, 1.0), 0.7, 0.0, false);
        w.step(DT);
        w.events.clear();
        if w.trucks[0].armed && armed_at.is_none() {
            armed_at = Some(w.time);
            assert!((w.state[9] - w.trucks[0].lap_start).abs() < 1e-6 && w.state[9] > 0.0);
        }
    }
    assert!(armed_at.is_some(), "20 秒內應該通過起終點線");
}
