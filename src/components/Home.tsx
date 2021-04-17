// @flow
import React, { Component } from "react";
// import React3 from "react-three-renderer";
// import * as THREE from 'three';
import Mousetrap from "mousetrap";
import SplitPane from "react-split-pane";

import TreeView from "./TreeView";
import ReglView from "./ReglView";
import {
  convertFromCsg,
  renderedFromPackager,
  renderedWsFromPackager,
  treeFromPackager
} from "./landau_helper";

// const OrbitControls = require('three-orbit-controls')(THREE);

type TreePos = Array<number>;

type Props = {};

type State = {
  canvasWidth: number,

  treeViewHovered?: TreePos,
  treeViewSelected?: TreePos,
  treeViewCollapsedChildren: Array<TreePos>
};

export default class Home extends Component<Props> {
  state = {
    // cubeRotation: new THREE.Euler(),
    // modulePath: process.env.LANDAU_MODULE, // TODO: arguments should be parsed somewhere more central
    mainRendered: null,
    treebeardData: null,
    renderedChildren: {},

    canvasWidth: 1000,
    // tree view
    treeViewHovered: null,
    treeViewSelected: [],
    treeViewCollapsedChildren: []
  };
  // cameraPosition = new THREE.Vector3(25, 0, 25);

  componentDidMount() {
    // this.reloadModule();
    this.subscribeRendered();

    Mousetrap.bind("alt+r", () => {
      this.reloadModule();
    });
  }

  reloadModule = () => {
    this.setState({
      renderedChildren: {},
      treeViewHovered: null,
      treeViewSelected: [],
      treeViewCollapsedChildren: []
    });
    this.requestRendered();
    // this.requestTree();
  };

  requestRendered = () => {
    const { modulePath, treeViewSelected } = this.state;
    const mainOpts = { module_path: modulePath, pos: treeViewSelected };
    this.setState({ mainRendered: null });
    renderedFromPackager(mainOpts, res => {
      // const firstElement = convertFromCsg(res[0]);
      const firstElement = res[0];
      console.log("firstElement", firstElement);
      const treebeardData = this.transformTreeToTreebeard(
        firstElement.fiberTree
      );
      this.setState({
        treebeardData,
        solids: [firstElement]
      });
    });
  };

  subscribeRendered = () => {
    const mainOpts = {}; // TODO: rm
    renderedWsFromPackager(mainOpts, res => {
      const firstElement = res[0];
      console.log("firstElement", firstElement);
      const treebeardData = this.transformTreeToTreebeard(
        firstElement.fiberTree
      );
      this.setState({
        treebeardData,
        solids: [firstElement]
      });
    });
  };

  // requestTree = () => {
  // const { modulePath, treeViewSelected } = this.state;
  // const mainOpts = { module_path: modulePath, pos: treeViewSelected };
  // this.setState({ treebeardData: {} });
  // treeFromPackager(mainOpts, res => {
  // const treebeardData = this.transformTreeToTreebeard(res);
  // this.setState(
  // {
  // treebeardData
  // },
  // () => this.prefetchChildren()
  // );
  // });
  // };

  allTreePositions = () => {
    const { treebeardData } = this.state;
    const positions = [];
    positions.push([]); // root position
    const traverse = (obj, i, parentTreePos) => {
      let treePos = parentTreePos || [];
      if (typeof i !== "undefined") {
        treePos = treePos.concat([i]);
      }
      (obj.children || []).map((obj, i) => traverse(obj, i, treePos));
      positions.push(treePos);
    };
    traverse(treebeardData);
    return positions;
  };

  // prefetchChildren = () => {
  // const { modulePath } = this.state;
  // const allTreePos = this.allTreePositions();
  // // Turn of prefetching if there are too many children for performance reasons
  // if (allTreePos.length > 20) {
  // return;
  // }
  // allTreePos.forEach(treePos => {
  // const mainOpts = { module_path: modulePath, pos: treePos };
  // renderedFromPackager(mainOpts, res => {
  // const firstElement = res[0];
  // console.log("firstElement", firstElement);
  // this.setState({
  // solids: [firstElement]
  // });
  // });
  // });
  // };

  transformTreeToTreebeard = tree => {
    const mapObject = (obj, i, parentTreePos) => {
      let treePos = parentTreePos || [];
      if (typeof i !== "undefined") {
        treePos = treePos.concat([i]);
      }
      const name = obj.displayName;
      const props = obj.props;
      const children = (obj.children || []).map((obj, i) =>
        mapObject(obj, i, treePos)
      );
      return {
        name,
        id: obj._randomId,
        children,
        props,
        treePos,
        toggled: true
      };
    };
    return mapObject(tree);
  };

  onCameraRef = camera => {
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    new OrbitControls(camera, document.getElementById("canvas"));
  };

  handleCanvasWidthResize = width => {
    this.setState({ canvasWidth: width });
  };

  handleTreeViewHoveredChange = val => {
    this.setState({ treeViewHovered: val });
  };

  handleTreeViewSelectedChange = val => {
    this.setState({ treeViewSelected: val }, () => {
      // TODO: remove, as we return all models in one go
      // this.requestRendered();
    });
  };

  handleTreeViewCollapsedChildrenChange = val => {
    this.setState({ treeViewCollapsedChildren: val });
  };

  render() {
    const {
      mainRendered,
      treeViewHovered,
      treeViewSelected,
      canvasWidth
    } = this.state;
    const width = canvasWidth;
    const height = 500;

    const hoveredChild = this.state.renderedChildren[treeViewHovered];
    const resizerStyle = {
      width: "3px",
      background: "#5f5f5f",
      borderLeft: "1px #3f3f3f solid",
      borderRight: "1px #3f3f3f solid",
      cursor: "col-resize"
    };

    // TODO: extract into function
    let solids = [];
    if (this.state.solids) {
      solids = this.state.solids;
      if (treeViewSelected.length !== 0) {
        let selectedTreeElement = this.state.treebeardData;
        treeViewSelected.forEach(idx => {
          selectedTreeElement = selectedTreeElement.children[idx];
        });
        const selectedId = selectedTreeElement.id;

        const findCsgById = (csg, id) => {
          if (csg.id === id) {
            return csg;
          }
          const childResults = csg.children.map(child => {
            const childCsg = findCsgById(child, id);
            if (childCsg) {
              return childCsg;
            }
          });
          const foundChild = childResults.find(Boolean);
          if (foundChild) {
            return foundChild;
          }
          return null;
        };
        // TODO: handle multiple solids
        const csgById = findCsgById(this.state.solids[0], selectedId);
        if (csgById) {
          solids = [csgById];
        }
      }
    }

    return (
      <div>
        <SplitPane
          defaultSize={canvasWidth}
          resizerStyle={resizerStyle}
          onDragFinished={this.handleCanvasWidthResize}
        >
          <div id="canvas" style={{ height: "500px" }}>
            <ReglView solids={solids} width={width} height={height} />
          </div>
          <div style={{ width: "100%", height: "100%", overflow: "scroll" }}>
            <TreeView
              treebeardData={this.state.treebeardData}
              selected={this.state.treeViewSelected}
              collapsedChildren={this.state.treeViewCollapsedChildren}
              onHoveredChange={this.handleTreeViewHoveredChange}
              onSelectedChange={this.handleTreeViewSelectedChange}
              onCollapsedChildrenChange={
                this.handleTreeViewCollapsedChildrenChange
              }
            />
          </div>
        </SplitPane>
      </div>
    );
  }
}
