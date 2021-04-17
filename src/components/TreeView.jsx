// @flow
import React, { Component } from 'react';
import _ from 'lodash-es';
import { Treebeard, decorators as treeDecorators } from 'react-treebeard';

type TreePos = Array<number>;

type Props = {
  treebeardData: any,

  selected: ?TreePos,
  collapsedChildren: Array<TreePos>,

  onHoveredChange: (?TreePos) => void,
  onSelectedChange: (?TreePos) => void,
  onCollapsedChildrenChange: (Array<TreePos>) => void,
};

type State = {
  hovered: ?TreePos,
}

export default class TreeView extends Component<Props, State> {
  state = {
    hovered: null,
  }

  treeData = () => {
    const { treebeardData, selected, collapsedChildren } = this.props;
    let data = treebeardData || {};
    data = _.clone(data);

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
    data = markSelected(data, selected);

    const markCollapsed = makeModifier((obj) => {
      const newObj = _.clone(obj);
      newObj.toggled = false;
      return newObj;
    });
    collapsedChildren.forEach((collapsedPos) => {
      data = markCollapsed(data, collapsedPos);
    });

    return data;
  }

  onTreeNodeClick = (node: { treePos: TreePos }) => {
    this.props.onSelectedChange(node.treePos);
  }

  onTreeNodeToggle = (nodePos: TreePos) => {
    const collapsed = _.xor(this.props.collapsedChildren, [nodePos]);
    this.props.onCollapsedChildrenChange(collapsed);
  }

  onTreeNodeHover = (nodePos: TreePos) => {
    if (nodePos !== this.state.hovered) {
      this.setState({
        hovered: nodePos,
      });
      this.props.onHoveredChange(nodePos);
    }
  }

  onTreeNodeHoverLeave = (nodePos: TreePos) => {
    if (nodePos === this.state.hovered) {
      this.setState({
        hovered: null,
      });
      this.props.onHoveredChange(null);
    }
  }

  render() {
    const self = this;
    const decorators = Object.assign({}, treeDecorators, {
      Toggle: (props) => {
        if (props.node.children.length === 0) {
          return <div style={props.style.base}></div>;
        }
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
}
