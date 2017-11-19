// @flow
import React, { Component } from 'react';
import React3 from 'react-three-renderer';
import * as THREE from 'three';
import _ from 'lodash-es';
import { Treebeard, decorators as treeDecorators } from 'react-treebeard';
import Mousetrap from 'mousetrap';

import { convertFromCsg, renderedFromPackager, treeFromPackager } from './landau_helper';

const OrbitControls = require('three-orbit-controls')(THREE);

type TreePos = Array<number>;

type Props = {
};

type State = {
  hoveredChildPos: ?TreePos,
  selectedPos: ?TreePos,
  collapsedChildPos: Array<TreePos>,
};

export default class Home extends Component<Props, State> {
  state = {
    cubeRotation: new THREE.Euler(),
    modulePath: '/Users/hobofan/stuff/snappy-reprap/landau/scratchpad3.js',
    mainRendered: null,
    treebeardData: null,
    renderedChildren: {},
    // tree view
    hoveredChildPos: null,
    selectedPos: [],
    collapsedChildPos: [],
  }
  cameraPosition = new THREE.Vector3(25, 0, 25);

  componentDidMount() {
    this.reloadModule();

    Mousetrap.bind('alt+r', () => {
      this.reloadModule();
    });
  }

  reloadModule = () => {
    this.setState({
      renderedChildren: {},
      hoveredChildPos: null,
      selectedPos: [],
      collapsedChildPos: [],
    });
    this.requestRendered();
    this.requestTree();
  }

  requestRendered = () => {
    const { modulePath, selectedPos } = this.state;
    const mainOpts = { module_path: modulePath, pos: selectedPos };
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
    const { modulePath, selectedPos } = this.state;
    const mainOpts = { module_path: modulePath, pos: selectedPos };
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
        }});
      });
    })
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
    }
    return mapObject(tree);
  }

  onCameraRef = (camera) => {
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    new OrbitControls(camera);
  }

  onTreeNodeClick = (node: { treePos: TreePos }) => {
    this.setState({
      selectedPos: node.treePos,
    }, () => {
      this.requestRendered();
    });
  }

  onTreeNodeToggle = (nodePos: TreePos) => {
    this.setState({
      collapsedChildPos: _.xor(this.state.collapsedChildPos, [nodePos]),
    });
  }

  onTreeNodeHover = (nodePos: TreePos) => {
    if (nodePos !== this.state.hoveredChildPos) {
      this.setState({
        hoveredChildPos: nodePos,
      });
    }
  }

  onTreeNodeHoverLeave = (nodePos: TreePos) => {
    if (nodePos === this.state.hoveredChildPos) {
      this.setState({
        hoveredChildPos: null,
      });
    }
  }

  treeData = () => {
    let data = this.state.treebeardData || {};
    data = _.clone(data);

    const { selectedPos } = this.state;
    const makeModifier = (modifier) => {
      const modify = (obj, remainingPos) => {
        if (_.isEmpty(remainingPos)) {
          return modifier(obj);
        }

        const children = obj.children.map((child, i) => {
          const [j, ...childRemainingPos] = remainingPos;
          if (i === j) {
            return modify(child, childRemainingPos);
          }
          return child;
        });
        return {
          ...obj,
          children,
        };
      };
      return modify;
    };

    const markSelected = makeModifier((obj) => {
      const newObj = _.clone(obj);
      newObj.active = true;
      return newObj;
    });
    data = markSelected(data, selectedPos);

    const markCollapsed = makeModifier((obj) => {
      const newObj = _.clone(obj);
      newObj.toggled = false;
      return newObj;
    });
    this.state.collapsedChildPos.forEach((collapsedPos) => {
      data = markCollapsed(data, collapsedPos);
    });

    return data;
  }

  renderTreeview = () => {
    const self = this;
    const decorators = Object.assign({}, treeDecorators, {
      Toggle: (props) => {
        return (
          <div style={props.style.base} onClick={() => this.onTreeNodeToggle(props.node.treePos)}>
            <treeDecorators.Toggle {...props} />
          </div>
        );
      },
    });
    class Container extends treeDecorators.Container {
      renderToggleDecorator() {
        const {style, decorators} = this.props;

        return <decorators.Toggle {...this.props} style={style.toggle}/>;
      }
    }
    class TwiceContainer extends React.Component {
      render() {
        return (
          <div
            onMouseOver={() => self.onTreeNodeHover(this.props.node.treePos)}
            onMouseLeave={() => self.onTreeNodeHoverLeave(this.props.node.treePos)}
          >
            <Container {...this.props} />
          </div>
        );
      }
    }
    decorators.Container = TwiceContainer;

    return (
      <Treebeard
        data={this.treeData()}
        decorators={decorators}
        onToggle={this.onTreeNodeClick}
      />
    );
  }

  render() {
    const { mainRendered, hoveredChildPos } = this.state;
    const width = 1000;
    const height = 500;

    const hoveredChild = this.state.renderedChildren[hoveredChildPos];

    return (
      <div >
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
        <div style={{ display: 'inline-block', width: '100%', top: 0, position: 'absolute' }}>
          { this.renderTreeview() }
        </div>
      </div>
    );
  }
}
