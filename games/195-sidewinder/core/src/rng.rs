// xorshift32：決定性亂數，不用系統時間
#[derive(Clone, Copy)]
pub struct Rng(pub u32);

impl Rng {
    pub fn new(seed: u32) -> Rng {
        Rng(if seed == 0 { 0x9E37_79B9 } else { seed })
    }
    pub fn next(&mut self) -> u32 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        x
    }
    // [0,1)
    pub fn f(&mut self) -> f32 {
        (self.next() >> 8) as f32 * (1.0 / 16_777_216.0)
    }
    pub fn range(&mut self, a: f32, b: f32) -> f32 {
        a + (b - a) * self.f()
    }
    // 0..n-1
    pub fn below(&mut self, n: u32) -> u32 {
        if n == 0 { 0 } else { self.next() % n }
    }
}
