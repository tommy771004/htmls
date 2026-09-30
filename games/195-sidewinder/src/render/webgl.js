// WebGL2 渲染器：高度場地形＋SWMS 實例化網格＋方向光陰影圖＋粒子特效＋胎痕圖層。
import { program, texture, noiseData } from './glutil.js';
import { TERRAIN_VS, TERRAIN_FS, MESH_VS, MESH_FS, DEPTH_VS, DEPTH_FS, PART_VS, PART_FS } from './shaders.js';
import { lookAt, ortho, mul, xform, trs, mulInto, hexToLinear } from './math.js';
import { createCamera, arenaBounds } from './camera.js';
import { createFx } from './fx.js';
import { readTruck, readPickups, readHeader, SURF } from '../core.js';

// 場外延伸地面的顏色：鹼土 sRGB (213, 201, 173) 的線性值
const FAR_GROUND = [213, 201, 173].map((v) => Math.pow(v / 255, 2.2));

const INST = 24;              // 每個實例：mat4 + tint + extra
const WHEEL_POS = [[0.85, -0.78], [0.85, 0.78], [-0.85, -0.78], [-0.85, 0.78]];
const SUN = (() => { const v = [-0.46, 0.8, 0.39]; const l = Math.hypot(...v); return v.map((c) => c / l); })(); // 左上偏南
const SUN_COL = [2.45, 2.12, 1.72];
const SKY_COL = [0.27, 0.32, 0.4];
const GND_COL = [0.2, 0.13, 0.09];
const PROP_TINTS = ['#a8432a', '#3f6a8a', '#d0a23a', '#e6dcc6'];
const PLAYER_COL = [0.98, 0.86, 0.52];

export function createGLRenderer(canvas, gl, assets) {
  const { meshes, tracks, albedo } = assets;
  const cam = createCamera();
  const lightVP = new Float32Array(16);
  const shadowSize = Math.min(2048, gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048);

  let G = null;          // 所有 GPU 資源（遺失後重建）
  let lost = false;
  let T = null;          // 目前賽道：{ id, track, bounds, fx, gpu }
  const perTrack = new Map();
  let cssW = canvas.clientWidth || 1, cssH = canvas.clientHeight || 1, dpr = 1;
  let insets = { top: 0, right: 0, bottom: 0, left: 0 };
  let time = 0, frame = 0;
  let inst = new Float32Array(INST * 64);
  const stats = { drawCalls: 0, particles: 0 };
  const tmp = new Float32Array(16), tmpL = new Float32Array(16);
  let colorsKey = '', colorsLin = PROP_TINTS.map((h) => hexToLinear(h));
  const propTints = PROP_TINTS.map((h) => hexToLinear(h));

  // ---- GPU 初始化 ----
  function initGPU() {
    const g = {};
    g.terrain = program(gl, TERRAIN_VS, TERRAIN_FS, '地形');
    g.mesh = program(gl, MESH_VS, MESH_FS, '網格');
    g.depth = program(gl, DEPTH_VS, DEPTH_FS, '陰影');
    g.part = program(gl, PART_VS, PART_FS, '粒子');

    const nz = noiseData(256);
    g.noise = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, g.noise);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, nz);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);

    // 陰影圖
    g.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, g.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, shadowSize, shadowSize);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    g.shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, g.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, g.shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // 網格
    g.meshes = meshes.map((m) => {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buf = (data, loc, size, type, norm) => {
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, type, norm, 0, 0);
        return b;
      };
      buf(m.pos, 0, 3, gl.FLOAT, false);
      buf(m.nrm, 1, 4, gl.BYTE, true);
      buf(m.col, 2, 4, gl.UNSIGNED_BYTE, true);
      const ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
      for (let l = 3; l <= 8; l++) { gl.enableVertexAttribArray(l); gl.vertexAttribDivisor(l, 1); }
      gl.bindVertexArray(null);
      return { vao, count: m.idx.length };
    });
    g.dynInst = gl.createBuffer();

    // 粒子四角形
    g.partVao = gl.createVertexArray();
    gl.bindVertexArray(g.partVao);
    const qb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    g.partBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g.partBuf);
    for (let l = 1; l <= 3; l++) {
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 48, (l - 1) * 16);
      gl.vertexAttribDivisor(l, 1);
    }
    gl.bindVertexArray(null);
    G = g;
  }

  // ---- 賽道 CPU 資料 ----
  function buildTerrainCPU(t) {
    const { gw, gh, cell, originX, originZ, height, surface } = t;
    const N = gw * gh;
    // 周圍一圈延伸地面：邊界點 → 8 m → 320 m
    const ring = [];
    for (let i = 0; i < gw; i++) ring.push([i, 0]);
    for (let j = 1; j < gh; j++) ring.push([gw - 1, j]);
    for (let i = gw - 2; i >= 0; i--) ring.push([i, gh - 1]);
    for (let j = gh - 2; j >= 1; j--) ring.push([0, j]);
    const R = ring.length;
    const nv = N + R * 2;
    const pos = new Float32Array(nv * 3), nrm = new Int8Array(nv * 4), mat = new Uint8Array(nv * 4);
    const H = (i, j) => height[Math.min(gh - 1, Math.max(0, j)) * gw + Math.min(gw - 1, Math.max(0, i))];
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const k = j * gw + i;
        pos[k * 3] = originX + i * cell; pos[k * 3 + 1] = height[k]; pos[k * 3 + 2] = originZ + j * cell;
        const dx = (H(i + 1, j) - H(i - 1, j)) / (2 * cell), dz = (H(i, j + 1) - H(i, j - 1)) / (2 * cell);
        const l = Math.hypot(dx, 1, dz);
        nrm[k * 4] = -dx / l * 127; nrm[k * 4 + 1] = 1 / l * 127; nrm[k * 4 + 2] = -dz / l * 127;
        const s = surface[k];
        mat[k * 4] = s === SURF.MUD ? 255 : 0;
        mat[k * 4 + 1] = s === SURF.WATER ? 255 : 0;
        mat[k * 4 + 2] = s === SURF.LOOSE ? 255 : s === SURF.WALL ? 140 : 0;
        mat[k * 4 + 3] = s === SURF.INFIELD ? 255 : 0;
      }
    }
    // 泥、水、鬆土、草的權重做一次 3×3 模糊，邊界不再是 0.5 m 的鋸齒
    const src = mat.slice(0, N * 4);
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        for (let c = 0; c < 4; c++) {
          let sum = 0, n = 0;
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
            const ii = i + di, jj = j + dj;
            if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
            const wgt = di === 0 && dj === 0 ? 4 : (di === 0 || dj === 0 ? 2 : 1);
            sum += src[(jj * gw + ii) * 4 + c] * wgt; n += wgt;
          }
          mat[(j * gw + i) * 4 + c] = Math.round(sum / n);
        }
      }
    }
    const sorted = Float32Array.from(height).sort();
    const base = sorted[Math.floor(sorted.length * 0.1)];
    const cx = originX + (gw - 1) * cell / 2, cz = originZ + (gh - 1) * cell / 2;
    const hw = (gw - 1) * cell / 2, hd = (gh - 1) * cell / 2;
    for (let r = 0; r < R; r++) {
      const [i, j] = ring[r];
      const k = j * gw + i;
      // 邊界點的法線改成朝上：否則貼邊的坡（例如跳台）的法線會被外圍 8 m 的裙邊內插出一條長長的暗紋
      nrm[k * 4] = 0; nrm[k * 4 + 1] = 127; nrm[k * 4 + 2] = 0;
      const x = pos[k * 3], z = pos[k * 3 + 2];
      // 往外的方向（角落取對角）
      let ox = Math.abs(x - cx) >= hw - 1e-3 ? Math.sign(x - cx) : 0;
      let oz = Math.abs(z - cz) >= hd - 1e-3 ? Math.sign(z - cz) : 0;
      for (let q = 0; q < 2; q++) {
        const d = q === 0 ? 8 : 320;
        const v = N + r * 2 + q;
        pos[v * 3] = x + ox * d; pos[v * 3 + 2] = z + oz * d;
        pos[v * 3 + 1] = q === 0 ? Math.min(height[k], base + 0.2) : base - 1.5;
        nrm[v * 4 + 1] = 127;
      }
    }
    const nq = (gw - 1) * (gh - 1) * 6 + R * 12;
    const idx = new Uint32Array(nq);
    let p = 0;
    for (let j = 0; j < gh - 1; j++) {
      for (let i = 0; i < gw - 1; i++) {
        const a = j * gw + i, b = a + 1, c = a + gw, d = c + 1;
        // 依對角線高度差選切法，坡面比較平順
        if (Math.abs(height[a] - height[d]) < Math.abs(height[b] - height[c])) {
          idx[p++] = a; idx[p++] = c; idx[p++] = d; idx[p++] = a; idx[p++] = d; idx[p++] = b;
        } else {
          idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d;
        }
      }
    }
    for (let r = 0; r < R; r++) {
      const r2 = (r + 1) % R;
      const e0 = ring[r][1] * gw + ring[r][0], e1 = ring[r2][1] * gw + ring[r2][0];
      const m0 = N + r * 2, m1 = N + r2 * 2;
      idx[p++] = e0; idx[p++] = e1; idx[p++] = m0; idx[p++] = e1; idx[p++] = m1; idx[p++] = m0;
      idx[p++] = m0; idx[p++] = m1; idx[p++] = m0 + 1; idx[p++] = m1; idx[p++] = m1 + 1; idx[p++] = m0 + 1;
    }
    return { pos, nrm, mat, idx };
  }

  function ensureTrack(id) {
    if (perTrack.has(id)) return perTrack.get(id);
    const track = tracks[id];
    const img = albedo[id] || albedo[0];
    const e = {
      id, track, img,
      bounds: arenaBounds(track, meshes),
      cpu: buildTerrainCPU(track),
      // 場外地色：固定的鹼土色（以前取貼圖外緣平均，會被土堤的紅色染暗）
      edge: FAR_GROUND,
      fx: createFx(track, img, meshes),
      props: null, gpu: null,
    };
    // 道具實例（依網格分組）
    const groups = new Map();
    track.props.forEach((p, n) => {
      if (!meshes[p.mesh]) return;
      if (!groups.has(p.mesh)) groups.set(p.mesh, []);
      groups.get(p.mesh).push([p, n]);
    });
    const data = new Float32Array(track.props.length * INST);
    const list = [];
    let o = 0;
    for (const [mesh, arr] of groups) {
      list.push({ mesh, first: o, count: arr.length });
      for (const [p, n] of arr) {
        trs(data, o * INST, p.x, p.y, p.z, p.yaw, 0, 0, p.scale || 1);
        const c = propTints[n % 4];
        data.set([c[0], c[1], c[2], 1, 0, 1, 0, 0], o * INST + 16);
        o++;
      }
    }
    e.props = { data, list };
    perTrack.set(id, e);
    return e;
  }

  function uploadTrack(e) {
    if (e.gpu) return;
    const g = {};
    g.vao = gl.createVertexArray();
    gl.bindVertexArray(g.vao);
    const vb = (data, loc, size, type, norm) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, type, norm, 0, 0);
      return b;
    };
    g.bufs = [vb(e.cpu.pos, 0, 3, gl.FLOAT, false), vb(e.cpu.nrm, 1, 4, gl.BYTE, true), vb(e.cpu.mat, 2, 4, gl.UNSIGNED_BYTE, true)];
    g.ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, e.cpu.idx, gl.STATIC_DRAW);
    g.count = e.cpu.idx.length;
    gl.bindVertexArray(null);
    g.albedo = texture(gl, e.img, { srgb: true, mips: true });
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    g.marks = texture(gl, e.fx.marks, { mips: false, premult: true });
    g.props = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g.props);
    gl.bufferData(gl.ARRAY_BUFFER, e.props.data, gl.STATIC_DRAW);
    e.gpu = g;
  }

  function freeTrack(e) {
    if (!e || !e.gpu) return;
    const g = e.gpu;
    if (!gl.isContextLost()) {
      gl.deleteVertexArray(g.vao);
      g.bufs.forEach((b) => gl.deleteBuffer(b));
      gl.deleteBuffer(g.ib); gl.deleteBuffer(g.props);
      gl.deleteTexture(g.albedo); gl.deleteTexture(g.marks);
    }
    e.gpu = null;
  }

  function fitLight(b) {
    const c = [(b.x0 + b.x1) / 2, b.y0, (b.z0 + b.z1) / 2];
    const eye = [c[0] + SUN[0] * 120, c[1] + SUN[1] * 120, c[2] + SUN[2] * 120];
    const v = lookAt(eye, c, [0, 1, 0], new Float32Array(16));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const x of [b.x0, b.x1]) for (const z of [b.z0, b.z1]) for (const y of [b.y0 - 1, b.yTop + 1]) {
      const p = xform(v, x, y, z);
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]);
    }
    mul(ortho(x0 - 1, x1 + 1, y0 - 1, y1 + 1, -z1 - 5, -z0 + 5), v, lightVP);
  }

  function refit() {
    if (!T) return;
    cam.fit(T.bounds, cssW, cssH, insets, T.track.cam);
  }

  // ---- 每幀的動態實例 ----
  function buildDynamic(core, opts) {
    const s = core.state();
    const trucks = [0, 1, 2, 3].map((k) => readTruck(s, k));
    const picks = readPickups(s);
    const key = (opts.truckColors || []).join();
    if (key !== colorsKey) {
      colorsKey = key;
      colorsLin = [0, 1, 2, 3].map((k) => hexToLinear((opts.truckColors && opts.truckColors[k]) || PROP_TINTS[k], propTints[k]));
    }
    const need = (4 + 16 + 8) * INST;
    if (inst.length < need) inst = new Float32Array(need);
    const track = T.track;
    // 車身 0..3；畫面很小（直式手機）時卡車只在畫面上放大，碰撞不變。以輪底為基準放大，輪子不會陷進地面
    const ppm = cam.rect && cam.rect.w > 0 ? cam.rect.w / track.width : 14;
    const ts = Math.min(1.3, Math.max(1, 1 + (11 - ppm) * 0.05));
    for (let k = 0; k < 4; k++) {
      const t = trucks[k], c = colorsLin[k];
      trs(inst, k * INST, t.x, t.y + 0.42 * (ts - 1), t.z, t.yaw, t.pitch, t.roll, ts);
      inst.set([c[0], c[1], c[2], 1, Math.min(1, t.wet), 1, 0, 0], k * INST + 16);
    }
    // 輪子 4..19
    for (let k = 0; k < 4; k++) {
      const t = trucks[k], c = colorsLin[k];
      const bo = k * INST;
      for (let w = 0; w < 4; w++) {
        const [wx, wz] = WHEEL_POS[w];
        // core 的壓縮量＝輪心相對車身上移量（滯空時為下垂的負值）
        const dy = Math.min(0.32, Math.max(-0.3, t.susp[w]));
        trs(tmpL, 0, wx, dy, wz, w < 2 ? t.steer * 0.5 : 0, -t.wheelAngle, wz < 0 ? Math.PI : 0, 1);
        const o = (4 + k * 4 + w) * INST;
        mulInto(inst, o, inst, bo, tmpL);
        inst.set([c[0], c[1], c[2], 1, Math.min(1, t.wet * 1.3), 1, 0, 0], o + 16);
      }
    }
    // 道具（氮氣瓶、錢袋）
    let nN = 0, nM = 0;
    const act = picks.filter((p) => p.active && p.type > 0);
    const nitroList = act.filter((p) => p.type === 1), moneyList = act.filter((p) => p.type === 2);
    let o = 20;
    const pickupMesh = (list, id) => {
      const first = o;
      for (const p of list) {
        const bob = Math.sin(time * 3 + p.x * 0.7) * 0.14;
        // 放大 1.8 倍：原尺寸在整條賽道入鏡的鏡頭下只有 8–10 px，和場邊雜物分不出來
        trs(inst, o * INST, p.x, track.heightAt(p.x, p.z) + 0.75 + bob, p.z, time * 1.8 + p.z, 0, 0, 1.8);
        inst.set([1, 1, 1, 1, 0, 1.08 + Math.sin(time * 6 + p.x) * 0.08, 0, 0], o * INST + 16);
        o++;
      }
      return { mesh: id, first, count: o - first };
    };
    const pn = pickupMesh(nitroList, 11), pm = pickupMesh(moneyList, 12);
    nN = pn.count; nM = pm.count;
    return { trucks, n: o, groups: [{ mesh: 0, first: 0, count: 4 }, { mesh: 1, first: 4, count: 16 }, pn, pm].filter((gr) => gr.count > 0 && meshes[gr.mesh]), nN, nM };
  }

  function bindInstances(buf, first) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const base = first * INST * 4;
    for (let l = 0; l < 4; l++) gl.vertexAttribPointer(3 + l, 4, gl.FLOAT, false, INST * 4, base + l * 16);
    gl.vertexAttribPointer(7, 4, gl.FLOAT, false, INST * 4, base + 64);
    gl.vertexAttribPointer(8, 4, gl.FLOAT, false, INST * 4, base + 80);
  }

  function drawGroups(groups, buf) {
    for (const gr of groups) {
      const m = G.meshes[gr.mesh];
      gl.bindVertexArray(m.vao);
      bindInstances(buf, gr.first);
      gl.drawElementsInstanced(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0, gr.count);
      stats.drawCalls++;
    }
  }

  function setLightUniforms(u) {
    gl.uniform3fv(u.uSunDir, SUN);
    gl.uniform3fv(u.uSunCol, SUN_COL);
    gl.uniform3fv(u.uSkyCol, SKY_COL);
    gl.uniform3fv(u.uGndCol, GND_COL);
    gl.uniform2f(u.uShadowTexel, 1 / shadowSize, 1 / shadowSize);
    gl.uniformMatrix4fv(u.uLightVP, false, lightVP);
    gl.uniform3fv(u.uEye, cam.eye);
    gl.activeTexture(gl.TEXTURE0 + 5);
    gl.bindTexture(gl.TEXTURE_2D, G.shadowTex);
    gl.uniform1i(u.uShadow, 5);
  }

  function draw(core, dt, opts = {}) {
    if (lost || !G || !T) return;
    dt = opts.paused ? 0 : Math.max(0, Math.min(dt || 0, 0.1));
    time += dt; frame++;
    stats.drawCalls = 0;
    const e = T;
    e.fx.update(core, dt, opts);
    const dyn = buildDynamic(core, opts);

    // 胎痕圖層更新（隔幀）
    if (e.fx.marksDirty && (frame & 1) === 0) {
      gl.bindTexture(gl.TEXTURE_2D, e.gpu.marks);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, e.fx.marks);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      e.fx.clearMarksDirty();
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, G.dynInst);
    gl.bufferData(gl.ARRAY_BUFFER, inst.subarray(0, dyn.n * INST), gl.DYNAMIC_DRAW);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // 陰影 pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, G.shadowFbo);
    gl.viewport(0, 0, shadowSize, shadowSize);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(G.depth.p);
    gl.uniformMatrix4fv(G.depth.u.uLightVP, false, lightVP);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.5, 3);
    gl.disable(gl.CULL_FACE);
    gl.uniform1f(G.depth.u.uInstanced, 0);
    gl.bindVertexArray(e.gpu.vao);
    gl.drawElements(gl.TRIANGLES, e.gpu.count, gl.UNSIGNED_INT, 0);
    stats.drawCalls++;
    gl.uniform1f(G.depth.u.uInstanced, 1);
    drawGroups(e.props.list, e.gpu.props);
    drawGroups(dyn.groups, G.dynInst);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // 主 pass
    gl.viewport(0, 0, canvas.width, canvas.height);
    const ec = e.edge;
    gl.clearColor(Math.pow(ec[0] * 0.42, 1 / 2.2), Math.pow(ec[1] * 0.42, 1 / 2.2), Math.pow(ec[2] * 0.42, 1 / 2.2), 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 地形
    const tp = G.terrain;
    gl.useProgram(tp.p);
    gl.uniformMatrix4fv(tp.u.uViewProj, false, cam.viewProj);
    setLightUniforms(tp.u);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, e.gpu.albedo); gl.uniform1i(tp.u.uAlbedo, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, e.gpu.marks); gl.uniform1i(tp.u.uMarks, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, G.noise); gl.uniform1i(tp.u.uNoise, 2);
    const tr = e.track;
    gl.uniform4f(tp.u.uArena, tr.originX, tr.originZ, 1 / tr.width, 1 / tr.depth);
    gl.uniform3fv(tp.u.uEdgeCol, e.edge);
    gl.uniform1f(tp.u.uTime, time);
    const p0 = dyn.trucks[0];
    const showPlayer = !opts.attract && opts.playerMarker !== false && readHeader(core.state()).phase >= 1;
    gl.uniform4f(tp.u.uPlayer, p0.x, p0.z, p0.yaw, showPlayer ? 0.85 : 0);
    gl.uniform3fv(tp.u.uPlayerCol, PLAYER_COL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.bindVertexArray(e.gpu.vao);
    gl.drawElements(gl.TRIANGLES, e.gpu.count, gl.UNSIGNED_INT, 0);
    stats.drawCalls++;
    gl.disable(gl.CULL_FACE);

    // 網格
    const mp = G.mesh;
    gl.useProgram(mp.p);
    gl.uniformMatrix4fv(mp.u.uViewProj, false, cam.viewProj);
    setLightUniforms(mp.u);
    drawGroups(e.props.list, e.gpu.props);
    drawGroups(dyn.groups, G.dynInst);

    // 粒子
    const fx = e.fx;
    stats.particles = fx.count;
    if (fx.count > 0) {
      const pp = G.part;
      gl.useProgram(pp.p);
      gl.uniformMatrix4fv(pp.u.uViewProj, false, cam.viewProj);
      gl.uniform3fv(pp.u.uRight, cam.right);
      gl.uniform3fv(pp.u.uUp, cam.up);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, G.noise); gl.uniform1i(pp.u.uNoise, 2);
      gl.bindBuffer(gl.ARRAY_BUFFER, G.partBuf);
      gl.bufferData(gl.ARRAY_BUFFER, fx.data.subarray(0, fx.count * fx.stride), gl.DYNAMIC_DRAW);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.bindVertexArray(G.partVao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, fx.count);
      stats.drawCalls++;
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    gl.bindVertexArray(null);
  }

  function setTrack(id) {
    if (!tracks[id]) id = 0;
    if (T && T.id === id) return;
    if (T) freeTrack(T);
    T = ensureTrack(id);
    T.fx.reset();
    if (G) uploadTrack(T);
    fitLight(T.bounds);
    refit();
  }

  function resize(w, h, ratio = globalThis.devicePixelRatio || 1) {
    cssW = Math.max(1, w); cssH = Math.max(1, h);
    dpr = Math.min(2, Math.max(1, ratio));
    const pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    refit();
  }

  const onLost = (ev) => { ev.preventDefault(); lost = true; G = null; for (const e of perTrack.values()) e.gpu = null; };
  const onRestored = () => {
    try {
      initGPU();
      if (T) uploadTrack(T);
      lost = false;
    } catch (err) { console.warn('WebGL 重建失敗', err); }
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  initGPU();
  setTrack(0);

  return {
    kind: 'webgl2',
    setTrack,
    resize,
    draw,
    setInsets(o) { insets = { top: 0, right: 0, bottom: 0, left: 0, ...o }; refit(); },
    trackRectOnScreen: () => ({ ...cam.rect }),
    worldToScreen: (x, y, z) => cam.worldToScreen(x, y, z),
    screenToWorld: (x, y, planeY) => cam.screenToWorld(x, y, planeY ?? (T ? T.bounds.y0 : 0)),
    truckScreen(core, k) { const t = readTruck(core.state(), k); return cam.worldToScreen(t.x, t.y + 1.6, t.z); },
    isLost: () => lost,
    clearMarks() { if (T) T.fx.reset(); },
    stats,
    destroy() {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      for (const e of perTrack.values()) freeTrack(e);
    },
  };
}
