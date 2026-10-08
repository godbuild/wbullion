export function createKeeper(scene) {
  const B = window.BABYLON;

  const root = new B.TransformNode('keeperRoot', scene);
  root.position = new B.Vector3(0, 0, -0.15);

  // Colors
  const skinColor = new B.Color3(0.85, 0.65, 0.5);
  const hairColor = new B.Color3(0.15, 0.1, 0.08);
  const jerseyColor = new B.Color3(1.0, 0.85, 0.1); // yellow keeper jersey
  const shortsColor = new B.Color3(0.1, 0.1, 0.15);
  const gloveColor = new B.Color3(0.85, 0.15, 0.15);
  const sockColor = new B.Color3(1, 1, 1);
  const bootColor = new B.Color3(0.1, 0.1, 0.1);

  // Materials
  const skinMat = new B.StandardMaterial('skinK', scene); skinMat.diffuseColor = skinColor;
  const hairMat = new B.StandardMaterial('hairK', scene); hairMat.diffuseColor = hairColor;
  const jerseyMat = new B.StandardMaterial('jerseyK', scene); jerseyMat.diffuseColor = jerseyColor;
  const shortsMat = new B.StandardMaterial('shortsK', scene); shortsMat.diffuseColor = shortsColor;
  const gloveMat = new B.StandardMaterial('gloveK', scene); gloveMat.diffuseColor = gloveColor;
  const sockMat = new B.StandardMaterial('sockK', scene); sockMat.diffuseColor = sockColor;
  const bootMat = new B.StandardMaterial('bootK', scene); bootMat.diffuseColor = bootColor;

  // ---- Head group
  const head = new B.TransformNode('k_head', scene);
  head.parent = root;
  head.position.y = 1.75;

  const headMesh = B.MeshBuilder.CreateSphere('k_headmesh', { diameter: 0.24, segments: 16 }, scene);
  headMesh.material = skinMat;
  headMesh.parent = head;

  // Hair
  const hair = B.MeshBuilder.CreateSphere('k_hair', { diameter: 0.26, segments: 16, slice: 0.5 }, scene);
  hair.material = hairMat;
  hair.parent = head;
  hair.position.y = 0.03;

  // Eyes (two small spheres)
  const eyeL = B.MeshBuilder.CreateSphere('k_eyeL', { diameter: 0.03 }, scene);
  eyeL.material = new B.StandardMaterial('eyeL', scene);
  eyeL.material.diffuseColor = new B.Color3(0.05, 0.05, 0.05);
  eyeL.position = new B.Vector3(-0.05, 0.02, -0.11);
  eyeL.parent = head;

  const eyeR = eyeL.clone('k_eyeR');
  eyeR.position.x = 0.05;
  eyeR.parent = head;

  // Nose
  const nose = B.MeshBuilder.CreateSphere('k_nose', { diameter: 0.04 }, scene);
  nose.material = skinMat;
  nose.position = new B.Vector3(0, -0.01, -0.12);
  nose.parent = head;

  // Mouth
  const mouth = B.MeshBuilder.CreateBox('k_mouth', { width: 0.06, height: 0.015, depth: 0.01 }, scene);
  mouth.material = new B.StandardMaterial('mouthK', scene);
  mouth.material.diffuseColor = new B.Color3(0.4, 0.1, 0.1);
  mouth.position = new B.Vector3(0, -0.06, -0.11);
  mouth.parent = head;

  // Ears
  const earL = B.MeshBuilder.CreateSphere('k_earL', { diameter: 0.05 }, scene);
  earL.material = skinMat;
  earL.scaling.z = 0.5;
  earL.position = new B.Vector3(-0.13, 0, 0);
  earL.parent = head;
  const earR = earL.clone('k_earR');
  earR.position.x = 0.13;
  earR.parent = head;

  // ---- Torso
  const torso = B.MeshBuilder.CreateCylinder('k_torso', { height: 0.7, diameterTop: 0.42, diameterBottom: 0.48 }, scene);
  torso.material = jerseyMat;
  torso.position.y = 1.15;
  torso.parent = root;

  // ---- Arms
  function makeArm(side) {
    const s = side === 'L' ? -1 : 1;
    const group = new B.TransformNode('k_arm' + side, scene);
    group.parent = root;
    group.position = new B.Vector3(s * 0.24, 1.45, 0);

    const upper = B.MeshBuilder.CreateCylinder('k_up' + side, { height: 0.32, diameter: 0.09 }, scene);
    upper.material = jerseyMat;
    upper.position.y = -0.16;
    upper.parent = group;

    const fore = B.MeshBuilder.CreateCylinder('k_fore' + side, { height: 0.28, diameter: 0.08 }, scene);
    fore.material = skinMat;
    fore.position.y = -0.48;
    fore.parent = group;

    const glove = B.MeshBuilder.CreateBox('k_glove' + side, { width: 0.13, height: 0.13, depth: 0.10 }, scene);
    glove.material = gloveMat;
    glove.position.y = -0.68;
    glove.parent = group;

    return group;
  }
  const armL = makeArm('L');
  const armR = makeArm('R');

  // ---- Legs
  function makeLeg(side) {
    const s = side === 'L' ? -1 : 1;
    const group = new B.TransformNode('k_leg' + side, scene);
    group.parent = root;
    group.position = new B.Vector3(s * 0.11, 0.8, 0);

    const thigh = B.MeshBuilder.CreateCylinder('k_thigh' + side, { height: 0.35, diameter: 0.14 }, scene);
    thigh.material = shortsMat;
    thigh.position.y = -0.18;
    thigh.parent = group;

    const knee = B.MeshBuilder.CreateSphere('k_knee' + side, { diameter: 0.1 }, scene);
    knee.material = skinMat;
    knee.position.y = -0.38;
    knee.parent = group;

    const shin = B.MeshBuilder.CreateCylinder('k_shin' + side, { height: 0.34, diameter: 0.11 }, scene);
    shin.material = sockMat;
    shin.position.y = -0.57;
    shin.parent = group;

    const shinGuard = B.MeshBuilder.CreateBox('k_shinG' + side, { width: 0.13, height: 0.28, depth: 0.05 }, scene);
    shinGuard.material = new B.StandardMaterial('sg' + side, scene);
    shinGuard.material.diffuseColor = new B.Color3(0.9, 0.9, 0.9);
    shinGuard.position = new B.Vector3(0, -0.57, -0.05);
    shinGuard.parent = group;

    const boot = B.MeshBuilder.CreateBox('k_boot' + side, { width: 0.13, height: 0.09, depth: 0.22 }, scene);
    boot.material = bootMat;
    boot.position = new B.Vector3(0, -0.76, -0.04);
    boot.parent = group;

    return group;
  }
  const legL = makeLeg('L');
  const legR = makeLeg('R');

  // Return rig with parts for animation
  return {
    root,
    parts: { head, torso, armL, armR, legL, legR, gloveL: armL.children[2], gloveR: armR.children[2] },
    // Animation helpers
    dive: (direction, style) => animateDive(root, parts, direction, style),
    reset: () => resetKeeper(root, parts)
  };

  function resetKeeper(root, parts) {
    root.position = new B.Vector3(0, 0, -0.15);
    root.rotation = B.Vector3.Zero();
    root.rotationQuaternion = null;
  }

  function animateDive(root, parts, direction, style) {
    // direction: 'left' | 'right' | 'center'
    // style: 'high' | 'low' | 'kneel' | 'lie' | 'stand'
    const B = window.BABYLON;
    const dir = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;

    // Simple keyframe animation using Babylon Animation
    const fps = 30;
    const duration = 0.5;

    const endX = dir * 1.2;
    const endY = style === 'high' ? 0.9 : style === 'low' ? 0.2 : style === 'kneel' ? -0.3 : 0;
    const endRotZ = dir * (style === 'high' ? 1.4 : style === 'low' ? 1.1 : 0);

    const animX = new B.Animation('kx', 'position.x', fps, B.Animation.ANIMATIONTYPE_FLOAT, B.Animation.ANIMATIONLOOPMODE_CONSTANT);
    animX.setKeys([{ frame: 0, value: root.position.x }, { frame: duration * fps, value: endX }]);

    const animY = new B.Animation('ky', 'position.y', fps, B.Animation.ANIMATIONTYPE_FLOAT, B.Animation.ANIMATIONLOOPMODE_CONSTANT);
    animY.setKeys([{ frame: 0, value: root.position.y }, { frame: duration * fps, value: endY }]);

    const animRotZ = new B.Animation('krz', 'rotation.z', fps, B.Animation.ANIMATIONTYPE_FLOAT, B.Animation.ANIMATIONLOOPMODE_CONSTANT);
    animRotZ.setKeys([{ frame: 0, value: 0 }, { frame: duration * fps, value: endRotZ }]);

    root.animations = [animX, animY, animRotZ];
    scene.beginAnimation(root, 0, duration * fps, false);
  }
}
