// @flow
import React, { Component } from 'react';
import React3 from 'react-three-renderer';
import * as THREE from 'three';
import Mousetrap from 'mousetrap';
import chokidar from 'chokidar';
import SplitPane from 'react-split-pane';

import TreeView from './TreeView';
import { convertFromCsg, renderedFromPackager, treeFromPackager } from './landau_helper';

const OrbitControls = require('three-orbit-controls')(THREE);

type TreePos = Array<number>;

type Props = {
};

type State = {
  canvasWidth: number,

  treeViewHovered: ?TreePos,
  treeViewSelected: ?TreePos,
  treeViewCollapsedChildren: Array<TreePos>
};

export default class Home extends Component<Props, State> {
  state = {
    cubeRotation: new THREE.Euler(),
    modulePath: process.env.LANDAU_MODULE, // TODO: arguments should be parsed somewhere more central
    mainRendered: null,
    treebeardData: null,
    renderedChildren: {},

    canvasWidth: 1000,
    // tree view
    treeViewHovered: null,
    treeViewSelected: [],
    treeViewCollapsedChildren: [],
  }
  cameraPosition = new THREE.Vector3(25, 0, 25);

  componentDidMount() {
    this.reloadModule();
    chokidar.watch(this.state.modulePath).on('all', (event, path) => {
      this.reloadModule();
    });

    Mousetrap.bind('alt+r', () => {
      this.reloadModule();
    });
  }

  reloadModule = () => {
    this.setState({
      renderedChildren: {},
      treeViewHovered: null,
      treeViewSelected: [],
      treeViewCollapsedChildren: [],
    });
    this.requestRendered();
    this.requestTree();
  }

  requestRendered = () => {
    const { modulePath, treeViewSelected } = this.state;
    const mainOpts = { module_path: modulePath, pos: treeViewSelected };
    this.setState({ mainRendered: null });
    renderedFromPackager(mainOpts, (res) => {
      const firstElement = convertFromCsg(res[0]);
      this.setState({
        mainRendered: {
          vertices: firstElement.geometry.vertices,
          faces: firstElement.geometry.faces,
        },
      });
    });
  }

  requestTree = () => {
    const { modulePath, treeViewSelected } = this.state;
    const mainOpts = { module_path: modulePath, pos: treeViewSelected };
    this.setState({ treebeardData: {} });
    treeFromPackager(mainOpts, (res) => {
      const treebeardData = this.transformTreeToTreebeard(res);
      this.setState({
        treebeardData,
      }, () => this.prefetchChildren());
    });
  }

  allTreePositions = () => {
    const { treebeardData } = this.state;
    const positions = [];
    positions.push([]); // root position
    const traverse = (obj, i, parentTreePos) => {
      let treePos = (parentTreePos || []);
      if (typeof i !== 'undefined') {
        treePos = treePos.concat([i]);
      }
      (obj.children || []).map((obj, i) => traverse(obj, i, treePos));
      positions.push(treePos);
    };
    traverse(treebeardData);
    return positions;
  }

  prefetchChildren = () => {
    const { modulePath } = this.state;
    const allTreePos = this.allTreePositions();
    // Turn of prefetching if there are too many children for performance reasons
    if (allTreePos.length > 20) {
      return;
    }
    allTreePos.forEach((treePos) => {
      const mainOpts = { module_path: modulePath, pos: treePos };
      renderedFromPackager(mainOpts, (res) => {
        const firstElement = convertFromCsg(res[0]);
        const renderedChild = {};
        renderedChild[treePos] = {
          vertices: firstElement.geometry.vertices,
          faces: firstElement.geometry.faces,
        };
        this.setState({ renderedChildren: {
          ...this.state.renderedChildren,
          ...renderedChild,
        } });
      });
    });
  }

  transformTreeToTreebeard = (tree) => {
    const mapObject = (obj, i, parentTreePos) => {
      let treePos = (parentTreePos || []);
      if (typeof i !== 'undefined') {
        treePos = treePos.concat([i]);
      }
      const name = obj.elementName;
      const props = obj.props;
      const children = (obj.children || []).map((obj, i) => mapObject(obj, i, treePos));
      return {
        name,
        children,
        props,
        treePos,
        toggled: true,
      };
    };
    return mapObject(tree);
  }

  onCameraRef = (camera) => {
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    new OrbitControls(camera, document.getElementById('canvas'));
  }

  handleCanvasWidthResize = (width) => {
    this.setState({ canvasWidth: width });
  }

  handleTreeViewHoveredChange = (val) => {
    this.setState({ treeViewHovered: val });
  }

  handleTreeViewSelectedChange = (val) => {
    this.setState({ treeViewSelected: val }, () => {
      this.requestRendered();
    });
  }

  handleTreeViewCollapsedChildrenChange = (val) => {
    this.setState({ treeViewCollapsedChildren: val });
  }

  render() {
    const { mainRendered, treeViewHovered, canvasWidth } = this.state;
    const width = canvasWidth;
    const height = 500;

    const hoveredChild = this.state.renderedChildren[treeViewHovered];
    const resizerStyle = {
      width: '3px',
      background: '#5f5f5f',
      borderLeft: '1px #3f3f3f solid',
      borderRight: '1px #3f3f3f solid',
      cursor: 'col-resize',
    };

    return (
      <div >
        <SplitPane
          defaultSize={canvasWidth}
          resizerStyle={resizerStyle}
          onDragFinished={this.handleCanvasWidthResize}
        >
          <div id="canvas">
            <React3
              mainCamera="camera" // this points to the perspectiveCamera which has the name set to "camera" below
              width={width}
              height={height}
              antialias

              clearColor={0xcccccc}
              shadowMapEnabled
              shadowMapType={THREE.PCFSoftShadowMap}
            >
              <scene>
                <perspectiveCamera
                  ref={this.onCameraRef}
                  name="camera"
                  fov={75}
                  aspect={width / height}
                  near={0.1}
                  far={1000}

                  position={this.cameraPosition}
                />
                <ambientLight />
                <pointLight
                  castShadow
                  intensity={1}
                  decay={2}
                  color={0xffffff}
                  position={new THREE.Vector3(25, 25, 25)}
                />
                <axisHelper size={10000} />
                <gridHelper size={100} step={100} />
                { mainRendered ? (
                  <group>
                    <mesh
                      castShadow
                      receiveShadow
                    >
                      <geometry
                        vertices={mainRendered.vertices}
                        faces={mainRendered.faces}
                        dynamic
                      />
                      <meshPhongMaterial
                        color={0x64b5f6}
                      />
                    </mesh>
                  </group>
                  ) : null }
                { hoveredChild ? (
                  <group>
                    <mesh
                      castShadow
                      receiveShadow
                    >
                      <geometry
                        vertices={hoveredChild.vertices}
                        faces={hoveredChild.faces}
                        dynamic
                      />
                      <meshPhongMaterial
                        transparent
                        opacity={0.5}
                        color={0xffee58}
                      />
                    </mesh>
                  </group>
                  ) : null }
              </scene>
            </React3>
          </div>
          <div style={{ width: '100%', height: '100%', overflow: 'scroll' }}>
            <TreeView
              treebeardData={this.state.treebeardData}

              selected={this.state.treeViewSelected}
              collapsedChildren={this.state.treeViewCollapsedChildren}

              onHoveredChange={this.handleTreeViewHoveredChange}
              onSelectedChange={this.handleTreeViewSelectedChange}
              onCollapsedChildrenChange={this.handleTreeViewCollapsedChildrenChange}
            />
          </div>
        </SplitPane>
      </div>
    );
  }
}
