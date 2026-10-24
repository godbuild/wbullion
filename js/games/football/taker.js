export function createTaker(scene, { name, number, dominantFoot, jerseyColor }) {
  const B = window.BABYLON;
  const color = /^#[0-9a-f]{6}$/i.test(String(jerseyColor || '')) ? jerseyColor : '#3ba072';
  const jersey = B.Color3.FromHexString(color);

  const root = new B.TransformNode('takerRoot', scene);
  root.position = new B.Vector3(0, 0, -8);

  // ---- Legs
  function makeLeg(side) {
    const s = side === 'L' ? -1 : 1;
    const group = new B.TransformNode('t_leg' + side, scene);
    group.parent = root;
    group.position = new B.Vector3(s * 0.13, 0.8, 0);

    const thigh = B.MeshBuilder.CreateCylinder('t_thigh' + side, { height: 0.4, diameter: 0.15 }, scene);
    thigh.material = new B.StandardMaterial('t_shorts' + side, scene);
    thigh.material.diffuseColor = new B.Color3(0.1, 0.1, 0.15);
    thigh.position.y = -0.2;
    thigh.parent = group;

    const shin = B.MeshBuilder.CreateCylinder('t_shin' + side, { height: 0.38, diameter: 0.11 }, scene);
    shin.material = new B.StandardMaterial('t_sock' + side, scene);
    shin.material.diffuseColor = new B.Color3(1, 1, 1);
    shin.position.y = -0.6;
    shin.parent = group;

    const boot = B.MeshBuilder.CreateBox('t_boot' + side, { width: 0.14, height: 0.09, depth: 0.24 }, scene);
    boot.material = new B.StandardMaterial('t_bootM' + side, scene);
    boot.material.diffuseColor = new B.Color3(0.1, 0.1, 0.1);
    boot.position = new B.Vector3(0, -0.82, -0.06);
    boot.parent = group;

    return group;
  }
  const legL = makeLeg('L');
  const legR = makeLeg('R');

  // ---- Torso (back view)
  const torso = B.MeshBuilder.CreateCylinder('t_torso', { height: 0.75, diameterTop: 0.42, diameterBottom: 0.5 }, scene);
  const torsoMat = new B.StandardMaterial('t_jersey', scene);
  torsoMat.diffuseColor = jersey;
  torso.material = torsoMat;
  torso.position.y = 1.2;
  torso.parent = root;

  // Jersey number on back (simple box with plane)
  const numPlane = B.MeshBuilder.CreatePlane('t_num', { width: 0.35, height: 0.35 }, scene);
  const numMat = new B.StandardMaterial('t_numMat', scene);
  const numTex = new B.DynamicTexture('numTex', { width: 256, height: 256 }, scene, true);
  numTex.hasAlpha = true;
  numTex.drawText(String(number || 9), null, 160, 'bold 180px Arial', '#ffffff', 'transparent', true);
  numMat.diffuseTexture = numTex;
  numMat.opacityTexture = numTex;
  numPlane.material = numMat;
  numPlane.position = new B.Vector3(0, 1.25, 0.26);
  numPlane.rotation.y = Math.PI;
  numPlane.parent = root;

  // ---- Head back-of-head
  const head = B.MeshBuilder.CreateSphere('t_head', { diameter: 0.26, segments: 16 }, scene);
  const headMat = new B.StandardMaterial('t_headM', scene);
  headMat.diffuseColor = new B.Color3(0.85, 0.65, 0.5);
  head.material = headMat;
  head.position.y = 1.85;
  head.parent = root;

  // Hair
  const hair = B.MeshBuilder.CreateSphere('t_hair', { diameter: 0.28, segments: 16 }, scene);
  const hairMat = new B.StandardMaterial('t_hairM', scene);
  hairMat.diffuseColor = new B.Color3(0.1, 0.08, 0.06);
  hair.material = hairMat;
  hair.position.y = 1.88;
  hair.scaling.z = 0.9;
  hair.parent = root;

  // Ears (back)
  const earL = B.MeshBuilder.CreateSphere('t_earL', { diameter: 0.05 }, scene);
  earL.material = headMat;
  earL.position = new B.Vector3(-0.14, 1.85, 0);
  earL.scaling.z = 0.5;
  earL.parent = root;
  const earR = earL.clone('t_earR');
  earR.position.x = 0.14;
  earR.parent = root;

  // ---- Arms
  function makeArm(side) {
    const s = side === 'L' ? -1 : 1;
    const group = new B.TransformNode('t_arm' + side, scene);
    group.parent = root;
    group.position = new B.Vector3(s * 0.24, 1.45, 0);

    const upper = B.MeshBuilder.CreateCylinder('t_up' + side, { height: 0.32, diameter: 0.09 }, scene);
    upper.material = torsoMat;
    upper.position.y = -0.16;
    upper.parent = group;

    const fore = B.MeshBuilder.CreateCylinder('t_fore' + side, { height: 0.28, diameter: 0.08 }, scene);
    fore.material = headMat;
    fore.position.y = -0.48;
    fore.parent = group;

    const hand = B.MeshBuilder.CreateBox('t_hand' + side, { width: 0.1, height: 0.1, depth: 0.08 }, scene);
    hand.material = headMat;
    hand.position.y = -0.68;
    hand.parent = group;

    return group;
  }
  const armL = makeArm('L');
  const armR = makeArm('R');

  return {
    root,
    parts: { legL, legR, armL, armR, torso, head },
    name, number, dominantFoot,
    // Animation
    runup: (onKick) => animateRunup(root, legR, legL, onKick),
    reset: () => { root.position = new B.Vector3(0, 0, -8); root.rotation = B.Vector3.Zero(); }
  };

  function animateRunup(root, legR, legL, onKick) {
    const B = window.BABYLON;
    const fps = 30;

    // Runup: move from -8 to -5.7 over 0.7s
    const moveAnim = new B.Animation('runup', 'position.z', fps, B.Animation.ANIMATIONTYPE_FLOAT, B.Animation.ANIMATIONLOOPMODE_CONSTANT);
    moveAnim.setKeys([
      { frame: 0, value: -8 },
      { frame: 0.7 * fps, value: -5.7 }
    ]);

    // Swing kick leg
    const kickAnim = new B.Animation('kickLeg', 'rotation.x', fps, B.Animation.ANIMATIONTYPE_FLOAT, B.Animation.ANIMATIONLOOPMODE_CONSTANT);
    kickAnim.setKeys([
      { frame: 0, value: 0 },
      { frame: 0.5 * fps, value: -1.2 },
      { frame: 0.7 * fps, value: 1.0 },
      { frame: 0.9 * fps, value: 0.2 }
    ]);

    root.animations = [moveAnim];
    scene.beginAnimation(root, 0, 0.7 * fps, false);

    const kickLeg = dominantFoot === 'L' ? legL : legR;
    kickLeg.animations = [kickAnim];
    scene.beginAnimation(kickLeg, 0, 0.9 * fps, false, 1, () => {
      if (onKick) onKick();
    });
  }
}
