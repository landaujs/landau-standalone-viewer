const vec3 = require("gl-vec3");

/// https://github.com/jscad/OpenJSCAD.org/blob/e95e63989190e34180b4070972154ce3686868d8/packages/utils/regl-renderer/src/controls/orbitControls.js#L191
export const zoom = ({ controls, camera, speed = 1 }, zoomDelta = 0) => {
  let { scale } = controls;

  if (
    controls.userControl.zoom &&
    camera &&
    zoomDelta !== undefined &&
    zoomDelta !== 0 &&
    !isNaN(zoomDelta)
  ) {
    // const sign = Math.sign(zoomDelta) === 0 ? 1 : Math.sign(zoomDelta);
    zoomDelta = zoomDelta * speed; // controls.userControl.zoomSpeed
    // adjust zoom scaling based on distance : the closer to the target, the lesser zoom scaling we apply
    // zoomDelta *= Math.exp(Math.max(camera.scale * 0.05, 1));
    // updated scale after we will apply the new zoomDelta to the current scale
    const newScale = zoomDelta + controls.scale;
    // updated distance after the scale has been updated, used to prevent going outside limits
    const newDistance =
      vec3.distance(camera.position, camera.target) * newScale;

    if (
      newDistance > controls.limits.minDistance &&
      newDistance < controls.limits.maxDistance
    ) {
      scale += zoomDelta;
    }
  }
  return { controls: { scale }, camera };
};
