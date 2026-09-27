// Reflection lighting for model viewers. No background, model, or camera mutation.
// The caller owns the returned render target for the lifetime of its scene.
export function createStudioEnvironment(THREE, renderer) {
  const room = new THREE.Scene();
  room.background = new THREE.Color('#30383e');
  const geometry = new THREE.PlaneGeometry(1, 1);
  const cards = [
    { size: [5, 7], at: [-4, 5, 3], color: '#fff2df', energy: 3.5 },
    { size: [3, 6], at: [5, 2, 1], color: '#deebff', energy: 2 },
    { size: [5, 3], at: [0, 6, -4], color: '#ffffff', energy: 3 },
  ];
  for (const card of cards) {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(card.color).multiplyScalar(card.energy),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...card.at);
    mesh.scale.set(...card.size, 1);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  try {
    return generator.fromScene(room, 0.04);
  } finally {
    generator.dispose();
    geometry.dispose();
    room.children.forEach(mesh => mesh.material.dispose());
  }
}

// Bounded keyboard orbit, scoped to the focused canvas so page controls keep
// their native arrow-key behavior. Keep the page's own reset composition.
export function bindOrbitKeyboard(THREE, controls, canvas, { reset, change = () => {} }) {
  canvas.tabIndex = 0;
  const offset = new THREE.Vector3();
  const spherical = new THREE.Spherical();
  canvas.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Home') { reset(); change(); return; }
    spherical.setFromVector3(offset.copy(controls.object.position).sub(controls.target));
    const step = event.shiftKey ? 0.04 : 0.12;
    if (event.key === 'ArrowLeft') spherical.theta -= step;
    if (event.key === 'ArrowRight') spherical.theta += step;
    if (event.key === 'ArrowUp') spherical.phi -= step;
    if (event.key === 'ArrowDown') spherical.phi += step;
    if (event.key === '+' || event.key === '=') spherical.radius *= 0.9;
    if (event.key === '-') spherical.radius *= 1.1;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, Math.max(0.01, controls.minPolarAngle), Math.min(Math.PI - 0.01, controls.maxPolarAngle));
    spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
    controls.object.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    controls.update();
    change();
  });
}
