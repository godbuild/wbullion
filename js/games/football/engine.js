let babylonPromise;

export async function loadBabylon() {
  if (window.BABYLON?.Engine && window.BABYLON?.Scene) return window.BABYLON;
  if (babylonPromise) return babylonPromise;

  babylonPromise = new Promise((resolve, reject) => {
    const sources = [
      'https://cdn.babylonjs.com/babylon.js',
      'https://cdn.jsdelivr.net/npm/babylonjs@7.51.0/babylon.js'
    ];
    let index = 0;
    const tryNext = () => {
      if (window.BABYLON) return resolve(window.BABYLON);
      if (index >= sources.length) return reject(new Error('Babylon.js could not be loaded'));
      const script = document.createElement('script');
      script.src = sources[index++];
      script.async = true;
      script.onload = () => window.BABYLON ? resolve(window.BABYLON) : tryNext();
      script.onerror = tryNext;
      document.head.appendChild(script);
    };
    tryNext();
  }).catch(error => {
    babylonPromise = null;
    throw error;
  });

  return babylonPromise;
}

export function createScene(canvas, { isDark }) {
  const B = window.BABYLON;
  if (!canvas) throw new Error('Football canvas is unavailable');

  let engine;
  try {
    engine = new B.Engine(canvas, false, { preserveDrawingBuffer: false, stencil: true, antialias: true });
  } catch (primaryError) {
    try {
      engine = new B.Engine(canvas, false, { preserveDrawingBuffer: false, stencil: false, antialias: false, disableWebGL2Support: true });
    } catch (fallbackError) {
      throw new Error(`Football graphics engine unavailable: ${fallbackError?.message || primaryError?.message || 'WebGL failed'}`);
    }
  }
  const scene = new B.Scene(engine);
  scene.clearColor = isDark
    ? new B.Color4(0.03, 0.06, 0.12, 1)
    : new B.Color4(0.55, 0.75, 0.95, 1);

  // Cameras — we'll switch between them for replay
  const cameras = {};
  cameras.tpt = new B.FreeCamera('tpt', new B.Vector3(0, 3, -10), scene);
  cameras.tpt.setTarget(new B.Vector3(0, 3, 0));
  cameras.tpt.fov = 0.9;
  scene.activeCamera = cameras.tpt;

  cameras.fpt = new B.FreeCamera('fpt', new B.Vector3(0, 2, -5.5), scene);
  cameras.fpt.setTarget(new B.Vector3(0, 3, 0));

  cameras.overhead = new B.FreeCamera('overhead', new B.Vector3(0, 12, -6), scene);
  cameras.overhead.setTarget(new B.Vector3(0, 2, 0));

  cameras.goalline = new B.FreeCamera('goalline', new B.Vector3(0, 2.5, 3), scene);
  cameras.goalline.setTarget(new B.Vector3(0, 3, -2));

  cameras.backgoal = new B.FreeCamera('backgoal', new B.Vector3(0, 3, 8), scene);
  cameras.backgoal.setTarget(new B.Vector3(0, 3, 0));

  cameras.ball = new B.FreeCamera('ballcam', new B.Vector3(0, 1, -5), scene);
  cameras.ball.setTarget(new B.Vector3(0, 3, 0));

  // Lights
  const hemi = new B.HemisphericLight('hemi', new B.Vector3(0, 1, 0), scene);
  hemi.intensity = isDark ? 0.55 : 1.0;
  const dir = new B.DirectionalLight('dir', new B.Vector3(-0.5, -1, 0.5), scene);
  dir.intensity = 0.7;

  // Field
  const field = B.MeshBuilder.CreateGround('field', { width: 30, height: 25 }, scene);
  const fieldMat = new B.StandardMaterial('fieldMat', scene);
  fieldMat.diffuseColor = isDark
    ? new B.Color3(0.10, 0.25, 0.14)
    : new B.Color3(0.20, 0.55, 0.24);
  field.material = fieldMat;

  // Grass stripes
  for (let i = 0; i < 12; i++) {
    const stripe = B.MeshBuilder.CreateGround('stripe' + i, { width: 30, height: 1.1 }, scene);
    const sm = new B.StandardMaterial('sm' + i, scene);
    sm.diffuseColor = isDark
      ? new B.Color3(0.12, 0.28, 0.16)
      : new B.Color3(0.24, 0.60, 0.28);
    sm.alpha = 0.5;
    stripe.material = sm;
    stripe.position.z = -12 + i * 2;
    stripe.position.y = 0.01;
  }

  return { engine, scene, cameras };
}

export function createGoalpost(scene, { logoTextureUrl }) {
  const B = window.BABYLON;
  const goalRoot = new B.TransformNode('goalRoot', scene);

  // Dimensions: 7.32m wide, 2.44m high
  const W = 7.32, H = 2.44, r = 0.06;

  const postMat = new B.StandardMaterial('postMat', scene);
  postMat.diffuseColor = new B.Color3(1, 1, 1);
  postMat.emissiveColor = new B.Color3(0.3, 0.3, 0.3);

  // Posts
  const leftPost = B.MeshBuilder.CreateCylinder('leftPost', { height: H, diameter: r * 2 }, scene);
  leftPost.material = postMat;
  leftPost.position = new B.Vector3(-W/2, H/2, 0);
  leftPost.parent = goalRoot;

  const rightPost = B.MeshBuilder.CreateCylinder('rightPost', { height: H, diameter: r * 2 }, scene);
  rightPost.material = postMat;
  rightPost.position = new B.Vector3(W/2, H/2, 0);
  rightPost.parent = goalRoot;

  // Crossbar
  const crossbar = B.MeshBuilder.CreateCylinder('crossbar', { height: W, diameter: r * 2 }, scene);
  crossbar.material = postMat;
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position = new B.Vector3(0, H, 0);
  crossbar.parent = goalRoot;

  // Net (semi-transparent)
  const netMat = new B.StandardMaterial('netMat', scene);
  netMat.diffuseColor = new B.Color3(0.9, 0.9, 0.9);
  netMat.alpha = 0.28;
  netMat.emissiveColor = new B.Color3(0.4, 0.4, 0.4);

  // Back plane
  const backNet = B.MeshBuilder.CreatePlane('backNet', { width: W, height: H }, scene);
  backNet.material = netMat;
  backNet.position = new B.Vector3(0, H/2, 1.5);
  backNet.parent = goalRoot;

  // Top net
  const topNet = B.MeshBuilder.CreatePlane('topNet', { width: W, height: 1.5 }, scene);
  topNet.material = netMat;
  topNet.rotation.x = Math.PI / 2;
  topNet.position = new B.Vector3(0, H, 0.75);
  topNet.parent = goalRoot;

  // Side nets
  const leftNet = B.MeshBuilder.CreatePlane('leftNet', { width: 1.5, height: H }, scene);
  leftNet.material = netMat;
  leftNet.rotation.y = Math.PI / 2;
  leftNet.position = new B.Vector3(-W/2, H/2, 0.75);
  leftNet.parent = goalRoot;

  const rightNet = B.MeshBuilder.CreatePlane('rightNet', { width: 1.5, height: H }, scene);
  rightNet.material = netMat;
  rightNet.rotation.y = Math.PI / 2;
  rightNet.position = new B.Vector3(W/2, H/2, 0.75);
  rightNet.parent = goalRoot;

  // Site logo watermark at center of net
  const logoPlane = B.MeshBuilder.CreatePlane('logo', { width: 1.4, height: 1.4 }, scene);
  const logoMat = new B.StandardMaterial('logoMat', scene);
  logoMat.diffuseTexture = new B.Texture(logoTextureUrl || '/images/logo.png', scene);
  logoMat.opacityTexture = logoMat.diffuseTexture;
  logoMat.emissiveColor = new B.Color3(0.6, 0.6, 0.6);
  logoMat.alpha = 0.35;
  logoPlane.material = logoMat;
  logoPlane.position = new B.Vector3(0, H/2, 1.48);
  logoPlane.parent = goalRoot;

  return goalRoot;
}

export function createBall(scene, logoUrl) {
  const B = window.BABYLON;
  const ball = B.MeshBuilder.CreateSphere('ball', { diameter: 0.44, segments: 24 }, scene);

  const mat = new B.StandardMaterial('ballMat', scene);
  mat.diffuseColor = new B.Color3(1, 1, 1);
  mat.specularColor = new B.Color3(0.8, 0.8, 0.8);
  mat.specularPower = 32;
  ball.material = mat;

  // Logo decal in center
  const logo = B.MeshBuilder.CreateDisc('ballLogo', { radius: 0.09, tessellation: 24 }, scene);
  const logoMat = new B.StandardMaterial('ballLogoMat', scene);
  logoMat.diffuseTexture = new B.Texture(logoUrl || '/images/logo.png', scene);
  logoMat.opacityTexture = logoMat.diffuseTexture;
  logoMat.emissiveColor = new B.Color3(0.2, 0.2, 0.2);
  logo.material = logoMat;
  logo.parent = ball;
  logo.rotation.y = Math.PI / 2;
  logo.position.z = 0.222;

  // Green + purple tint via second emissive ring
  const ring = B.MeshBuilder.CreateTorus('ballRing', { diameter: 0.44, thickness: 0.02, tessellation: 24 }, scene);
  const ringMat = new B.StandardMaterial('ringMat', scene);
  ringMat.diffuseColor = new B.Color3(0.23, 0.63, 0.45);
  ringMat.emissiveColor = new B.Color3(0.1, 0.3, 0.2);
  ring.material = ringMat;
  ring.parent = ball;
  ring.rotation.x = Math.PI / 2;

  ball.position = new B.Vector3(0, 0.22, -5.5);
  ball.rotationQuaternion = B.Quaternion.Identity();

  return ball;
}
