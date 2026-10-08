export function createBallController(scene, ball) {
  const B = window.BABYLON;
  let velocity = new B.Vector3(0, 0, 0);
  let gravity = -9.81;
  let spinning = false;
  let curve = new B.Vector3(0, 0, 0);

  function applyShot(shotVec, opts = {}) {
    velocity = shotVec;
    curve = opts.curve || new B.Vector3(0, 0, 0);
    spinning = true;
  }

  function update(dt) {
    if (!spinning) return;

    // Apply gravity
    velocity.y += gravity * dt;

    // Apply curve (Magnus effect approximation)
    velocity.x += curve.x * dt;
    velocity.z += curve.z * dt;

    // Move
    ball.position.x += velocity.x * dt;
    ball.position.y += velocity.y * dt;
    ball.position.z += velocity.z * dt;

    // Spin visual
    ball.rotationQuaternion = B.Quaternion.RotationAxis(B.Vector3.Right(), performance.now() / 100)
      .multiply(B.Quaternion.RotationAxis(B.Vector3.Up(), performance.now() / 200));

    // Ground bounce
    if (ball.position.y < 0.22) {
      ball.position.y = 0.22;
      velocity.y = -velocity.y * 0.35;
      velocity.x *= 0.7;
      velocity.z *= 0.7;
      if (Math.abs(velocity.y) < 0.5) {
        velocity.y = 0;
      }
    }

    // Sideways bounce off posts
    if (Math.abs(ball.position.x) > 3.66 && ball.position.z > -0.2 && ball.position.z < 0.2) {
      velocity.x = -velocity.x * 0.7;
    }
  }

  function reset() {
    ball.position = new B.Vector3(0, 0.22, -5.5);
    velocity = new B.Vector3(0, 0, 0);
    curve = new B.Vector3(0, 0, 0);
    spinning = false;
  }

  function getVelocity() { return velocity; }
  function isSpinning() { return spinning; }
  function stop() { spinning = false; velocity = new B.Vector3(0, 0, 0); curve = new B.Vector3(0, 0, 0); }

  return { applyShot, update, reset, getVelocity, isSpinning, stop };
}
