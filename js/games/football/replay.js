export function createReplayController(scene, cameras, ball, taker, keeper, goal) {
  let replayFrames = [];
  let isReplaying = false;
  let replaySpeed = 1.0;
  let currentFrame = 0;
  let activeCamName = 'tpt';
  let rafId = null;

  function capture() {
    replayFrames = [];
    // We record positions each frame for ~3 seconds
    const startTime = performance.now();
    const recordObs = scene.onBeforeRenderObservable.add(() => {
      const elapsed = performance.now() - startTime;
      if (elapsed > 3000) {
        scene.onBeforeRenderObservable.remove(recordObs);
        return;
      }
      replayFrames.push({
        t: elapsed,
        ball: { x: ball.position.x, y: ball.position.y, z: ball.position.z, q: ball.rotationQuaternion?.clone() },
        takerZ: taker.root.position.z,
        keeperX: keeper.root.position.x,
        keeperY: keeper.root.position.y
      });
    });
  }

  function play(camName = 'tpt', speed = 1.0, { onFinish } = {}) {
    if (!replayFrames.length) { onFinish?.(); return; }
    isReplaying = true;
    activeCamName = camName;
    replaySpeed = speed;
    scene.activeCamera = cameras[camName] || cameras.tpt;

    const startT = performance.now();
    const totalDuration = replayFrames[replayFrames.length - 1].t;

    function tick() {
      if (!isReplaying) return;
      const elapsed = (performance.now() - startT) * replaySpeed;
      if (elapsed >= totalDuration) {
        isReplaying = false;
        onFinish?.();
        return;
      }
      // Find nearest frame
      let f = replayFrames[0];
      for (const frame of replayFrames) {
        if (frame.t <= elapsed) f = frame;
        else break;
      }
      ball.position.x = f.ball.x;
      ball.position.y = f.ball.y;
      ball.position.z = f.ball.z;
      if (f.ball.q) ball.rotationQuaternion = f.ball.q.clone();
      taker.root.position.z = f.takerZ;
      keeper.root.position.x = f.keeperX;
      keeper.root.position.y = f.keeperY;

      rafId = requestAnimationFrame(tick);
    }
    tick();
  }

  function stop() {
    isReplaying = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function setSpeed(s) { replaySpeed = s; }

  function switchCamera(name) {
    activeCamName = name;
    scene.activeCamera = cameras[name] || cameras.tpt;
  }

  function getAvailableCameras() {
    return [
      { key: 'tpt', label: 'Third Person' },
      { key: 'fpt', label: 'First Person' },
      { key: 'overhead', label: 'Overhead' },
      { key: 'goalline', label: 'Goalline' },
      { key: 'backgoal', label: 'Back of Goal' },
      { key: 'ballcam', label: 'Ball Cam' }
    ];
  }

  return { capture, play, stop, setSpeed, switchCamera, getAvailableCameras };
}
