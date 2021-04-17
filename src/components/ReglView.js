import React, { Component } from "react";
const {
  prepareRender,
  drawCommands,
  cameras,
  entitiesFromSolids
} = require("@jscad/regl-renderer");
const orbitControls = require("@jscad/regl-renderer").controls.orbit;

import { zoom } from "./camera_controls";

class ReglView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      zoomDelta: 0,
      panDelta: [0, 0],
      rotateDelta: [0, 0],
      solids: entitiesFromSolids({}, this.props.solids)
    };

    this.reglContainer = null;
    this.renderFn = null;

    this.setReglContainerRef = element => {
      this.reglContainer = element;

      const gestures = require("most-gestures").pointerGestures(
        this.reglContainer
      );
      gestures.drags.forEach(data => {
        const ev = data.originalEvents[0];
        const { x, y } = data.delta;
        const shiftKey =
          ev.shiftKey === true || (ev.touches && ev.touches.length > 2);
        if (shiftKey) {
          this.setState({
            panDelta: [this.state.panDelta[0] + x, this.state.panDelta[1] + y]
          });
          // panDelta[0] += x;
          // panDelta[1] += y;
        } else {
          this.setState({
            rotateDelta: [
              this.state.rotateDelta[0] - x,
              this.state.rotateDelta[1] - y
            ]
          });
          // rotateDelta[0] -= x;
          // rotateDelta[1] -= y;
        }
      });
      gestures.zooms.forEach(x => {
        this.setState({ zoomDelta: this.state.zoomDelta - x });
      });

      // prepare
      this.renderFn = prepareRender(this.initialOptionsFromProps());
    };
  }

  componentWillReceiveProps(nextProps) {
    this.setState({ solids: entitiesFromSolids({}, nextProps.solids) });
  }

  initialOptionsFromProps() {
    const { width, height } = this.props;

    // prepare the camera
    const perspectiveCamera = cameras.perspective;
    const camera = Object.assign({}, perspectiveCamera.defaults);
    perspectiveCamera.setProjection(camera, camera, {
      width,
      height
    });
    perspectiveCamera.update(camera, camera);

    const options = {
      glOptions: { container: this.reglContainer },
      camera,
      drawCommands: {
        // draw commands bootstrap themselves the first time they are run
        drawGrid: drawCommands.drawGrid, // require('./src/rendering/drawGrid/index.js'),
        drawAxis: drawCommands.drawAxis, // require('./src/rendering/drawAxis'),
        drawMesh: drawCommands.drawMesh // require('./src/rendering/drawMesh/index.js')
      },
      // data
      entities: [
        {
          // grid data
          // the choice of what draw command to use is also data based
          visuals: {
            drawCmd: "drawGrid",
            show: true,
            color: [0, 0, 0, 1],
            subColor: [0, 0, 1, 0.5],
            fadeOut: false,
            transparent: true
          },
          size: [500, 500],
          ticks: [10, 1]
        },
        {
          visuals: {
            drawCmd: "drawAxis",
            show: true
          }
        },
        ...this.state.solids
      ]
    };
    return options;
  }

  optionsFromProps() {
    const { width, height } = this.props;
    // const solids = entitiesFromSolids({}, this.props.solids);

    let controls = orbitControls.defaults;

    // prepare the camera
    const perspectiveCamera = cameras.perspective;
    const camera = Object.assign({}, perspectiveCamera.defaults);
    perspectiveCamera.setProjection(camera, camera, {
      width,
      height
    });
    perspectiveCamera.update(camera, camera);

    // Zoom, pan, etc.
    const zoomSpeed = 0.0001;
    const rotateSpeed = 0.01;
    const panSpeed = 0.1;
    // Rotate
    let updated = orbitControls.rotate(
      { controls, camera, speed: rotateSpeed },
      this.state.rotateDelta
    );
    controls = { ...controls, ...updated.controls };

    updated = orbitControls.pan(
      { controls, camera, speed: panSpeed },
      this.state.panDelta
    );
    // panDelta = [0, 0]
    camera.position = updated.camera.position;
    camera.target = updated.camera.target;

    updated = zoom(
      { controls, camera, speed: zoomSpeed },
      this.state.zoomDelta
    );
    controls = { ...controls, ...updated.controls };

    // Apply orbit controls
    updated = orbitControls.update({ controls, camera });
    controls = { ...controls, ...updated.controls };
    camera.position = updated.camera.position;
    perspectiveCamera.update(camera);

    const options = {
      glOptions: { container: this.reglContainer },
      camera,
      drawCommands: {
        // draw commands bootstrap themselves the first time they are run
        drawGrid: drawCommands.drawGrid, // require('./src/rendering/drawGrid/index.js'),
        drawAxis: drawCommands.drawAxis, // require('./src/rendering/drawAxis'),
        drawMesh: drawCommands.drawMesh // require('./src/rendering/drawMesh/index.js')
      },
      // data
      entities: [
        {
          // grid data
          // the choice of what draw command to use is also data based
          visuals: {
            drawCmd: "drawGrid",
            show: true,
            color: [0, 0, 0, 1],
            subColor: [0, 0, 1, 0.5],
            fadeOut: false,
            transparent: true
          },
          size: [500, 500],
          ticks: [10, 1]
        },
        {
          visuals: {
            drawCmd: "drawAxis",
            show: true
          }
        },
        ...this.state.solids
      ]
    };

    return options;
  }

  render() {
    if (this.reglContainer) {
      // do the actual render :  it is a simple function !
      this.renderFn(this.optionsFromProps());
    }

    return <div ref={this.setReglContainerRef} style={{ height: "500px" }} />;
  }
}

export default ReglView;
