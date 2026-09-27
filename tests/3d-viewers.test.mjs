import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import * as THREE from '../vendor/three-0.186.0/three.module.js';
import { bindOrbitKeyboard } from '../web/assets/3d/studio.js';
import { createSurface } from '../web/assets/3d/surfaces.js';

test('3D HTML entry points have parseable executable scripts and resolvable local module imports', async () => {
  const web = new URL('../web/', import.meta.url);
  let pages = 0;
  for (const name of await readdir(web)) {
    if (!name.endsWith('.html')) continue;
    const url = new URL(name, web), html = await readFile(url, 'utf8');
    if (!/THREE\.|three(?:@|\/|\.module)|WebGPURenderer|navigator\.gpu|assets\/150-brick-rts\/main.js/.test(html)) continue;
    pages++;
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    const importMap = scripts.find(([, attrs]) => /type=["']importmap["']/.test(attrs));
    const imports = importMap ? JSON.parse(importMap[2]).imports : {};
    for (const [, attrs, source] of scripts) {
      const type = attrs.match(/type=["']([^"']+)["']/)?.[1];
      if (type && !['module', 'text/javascript', 'application/javascript'].includes(type)) continue;
      if (!source.trim()) continue;
      const result = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: source, encoding: 'utf8' });
      assert.equal(result.status, 0, `${name}: ${result.stderr}`);
      for (const [, specifier] of source.matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
        let resolved = specifier;
        const key = Object.keys(imports).sort((a, b) => b.length - a.length).find(key => key === specifier || key.endsWith('/') && specifier.startsWith(key));
        if (key) resolved = imports[key] + specifier.slice(key.length);
        if (!resolved.startsWith('.')) continue;
        await assert.doesNotReject(access(new URL(resolved, url)), `${name}: missing ${resolved}`);
      }
    }
  }
  assert.ok(pages >= 38, `Expected the existing 38 3D entries; found ${pages}`);
});

test('keyboard orbit respects zoom/polar bounds, ignores shortcuts, and resets without bubbling to step navigation', () => {
  const listeners = new Map();
  const canvas = { addEventListener: (name, fn) => listeners.set(name, fn) };
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 10);
  let resets = 0;
  const controls = { object: camera, target: new THREE.Vector3(), minDistance: 5, maxDistance: 15, minPolarAngle: .1, maxPolarAngle: 1.4, update() {} };
  bindOrbitKeyboard(THREE, controls, canvas, { reset: () => { resets++; } });
  const press = (key, options = {}) => {
    const event = { key, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...options };
    listeners.get('keydown')(event);
    return event;
  };
  for (let i = 0; i < 100; i++) press('+');
  assert.ok(Math.abs(camera.position.length() - 5) < 1e-9);
  for (let i = 0; i < 100; i++) press('-');
  assert.ok(Math.abs(camera.position.length() - 15) < 1e-9);
  for (let i = 0; i < 100; i++) press('ArrowUp');
  assert.ok(Math.abs(new THREE.Spherical().setFromVector3(camera.position).phi - .1) < 1e-9);
  const before = camera.position.clone();
  assert.equal(press('ArrowRight', { metaKey: true }).prevented, undefined);
  assert.ok(camera.position.equals(before));
  assert.equal(press('Home').stopped, true);
  assert.equal(resets, 1);
});

test('microstructure textures are deterministic linear data with bounded anisotropy', () => {
  const renderer = { capabilities: { getMaxAnisotropy: () => 4 } };
  const a = createSurface(THREE, renderer, 'wood');
  const b = createSurface(THREE, renderer, 'wood');
  const fabric = createSurface(THREE, renderer, 'fabric');
  assert.deepEqual(a.image.data, b.image.data);
  assert.notDeepEqual(a.image.data, fabric.image.data);
  assert.equal(a.colorSpace, THREE.NoColorSpace);
  assert.equal(a.anisotropy, 4);
  assert.equal(a.wrapS, THREE.RepeatWrapping);
  a.dispose(); b.dispose(); fabric.dispose();
});
