// 響尾蛇越野 SIDEWINDER 核心：賽道解析、卡車物理、AI、比賽規則
// WASM ABI 見 SPEC §5；原生目標可 cargo test

pub mod ai;
pub mod params;
pub mod race;
pub mod rng;
pub mod synth;
pub mod track;
pub mod truck;

use core::cell::UnsafeCell;
pub use race::{Cfg, World};

struct Global(UnsafeCell<Option<World>>, UnsafeCell<Vec<u8>>);
// wasm 單執行緒；原生測試不走全域狀態
unsafe impl Sync for Global {}
static G: Global = Global(UnsafeCell::new(None), UnsafeCell::new(Vec::new()));

#[allow(clippy::mut_from_ref)]
fn w() -> &'static mut World {
    unsafe {
        let g = &mut *G.0.get();
        if g.is_none() {
            *g = Some(World::new());
        }
        g.as_mut().unwrap_unchecked()
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn sw_alloc(len: u32) -> *mut u8 {
    unsafe {
        let b = &mut *G.1.get();
        b.clear();
        b.resize(len as usize, 0);
        b.as_mut_ptr()
    }
}

/// # Safety
/// ptr 必須指向 len 位元組可讀記憶體（通常是 sw_alloc 回傳的區塊）
#[unsafe(no_mangle)]
pub unsafe extern "C" fn sw_load_track(ptr: *const u8, len: u32) -> i32 {
    if ptr.is_null() {
        return track::E_SHORT;
    }
    let bytes = unsafe { core::slice::from_raw_parts(ptr, len as usize) };
    w().load_track(bytes)
}

#[unsafe(no_mangle)]
pub extern "C" fn sw_set_truck(i: u32, is_ai: u32, tires: u32, engine: u32, shocks: u32, nitro: u32, skill: f32) {
    w().set_truck(i as usize, Cfg { is_ai: is_ai != 0, tires, engine, shocks, nitro, skill });
}

#[unsafe(no_mangle)]
pub extern "C" fn sw_race_start(seed: u32, laps: u32) {
    w().race_start(seed, laps);
}

#[unsafe(no_mangle)]
pub extern "C" fn sw_set_input(i: u32, steer: f32, throttle: f32, brake: f32, nitro: u32) {
    w().set_input(i as usize, steer, throttle, brake, nitro != 0);
}

#[unsafe(no_mangle)]
pub extern "C" fn sw_step(dt: f32) {
    w().step(dt);
}

#[unsafe(no_mangle)]
pub extern "C" fn sw_state_ptr() -> *const f32 {
    w().state.as_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn sw_state_len() -> u32 {
    w().state.len() as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn sw_events_ptr() -> *const f32 {
    w().events.as_ptr() as *const f32
}

#[unsafe(no_mangle)]
pub extern "C" fn sw_events_count() -> u32 {
    w().events.len() as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn sw_events_clear() {
    w().events.clear();
}

#[unsafe(no_mangle)]
pub extern "C" fn sw_upgrade_stat(kind: u32, level: u32) -> f32 {
    params::upgrade_stat(kind, level)
}

#[cfg(test)]
mod tests;
