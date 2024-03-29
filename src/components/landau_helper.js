import * as THREE from 'three';
// import { CSG } from '@jscad/csg';
// const WebSocket = require("ws");

// TODO: make configurable
const packagerUrl = 'http://localhost:1938';
const packagerUrlWs = 'ws://localhost:1938';

const jsonToCSG = (json) => CSG.fromPolygons(json.polygons);

const getGeometryVertex = (geometry, vertex_position) => {
  geometry.vertices.push(
    new THREE.Vector3(
      vertex_position._x,
      vertex_position._y,
      vertex_position._z
    )
  );
  return geometry.vertices.length - 1;
};

const fromCsg = (csg, defaultColor) => {
  let i,
    j,
    vertices,
    face,
    three_geometry = new THREE.Geometry(),
    polygons = csg.toPolygons();
  const faces = [];

  // dict of different THREE.Colors in mesh
  const colors = {};
  // list of different opacities used by polygons
  const opacities = [];
  let materialIdx, opacity, colorKey, polyColor, color;

  polygons.forEach((polygon) => {
    // polygon shared null? -> defaultColor, else extract color
    const vertices = polygon.vertices.map((vertex) =>
      getGeometryVertex(three_geometry, vertex.pos)
    );

    if (vertices[0] === vertices[vertices.length - 1]) {
      vertices.pop();
    }

    polyColor = polygon.shared.color
      ? polygon.shared.color.slice()
      : defaultColor.slice();
    opacity = polyColor.pop();

    // one material per opacity (color not relevant)
    // collect different opacity values in opacities
    // point to current polygon opacity with materialIdx
    const opacityIdx = opacities.indexOf(opacity);
    if (opacityIdx > -1) {
      materialIdx = opacityIdx;
    } else {
      opacities.push(opacity);
      materialIdx = opacities.length - 1;
    }

    // for each different color, create a color object
    const colorKey = polyColor.join('_');
    if (!(colorKey in colors)) {
      color = new THREE.Color();
      color.setRGB(...polyColor);
      colors[colorKey] = color;
    }

    // create a mesh face using color (not opacity~material)
    for (let k = 2; k < vertices.length; k++) {
      const pNormal = polygon.plane.normal;
      const normal = new THREE.Vector3(pNormal._x, pNormal._y, pNormal._z);
      face = new THREE.Face3(vertices[0], vertices[k - 1], vertices[k], normal);
      // colors[colorKey], materialIdx);
      // face.materialIdx = materialIdx;
      three_geometry.faces.push(face);
    }
  });

  // three_geometry.computeFaceNormals();
  // three_geometry.computeVertexNormals();

  // pass back bounding sphere radius (or 0 if empty object)
  // three_geometry.computeBoundingSphere();
  // var boundLen = three_geometry.boundingSphere.radius +
  //   three_geometry.boundingSphere.center.length() || 0;

  // return result;
  return {
    geometry: three_geometry,
  };
};

const convertFromCsg = (obj) => {
  const options = {
    faceColor: {
      r: 0.1,
      g: 0.7,
      b: 0.5,
      a: 1.0,
    }, // default face color
  };
  const faceColor = options.faceColor;
  const defaultColor_ = [
    faceColor.r,
    faceColor.g,
    faceColor.b,
    faceColor.a || 1,
  ];
  const res = fromCsg(obj, defaultColor_);

  return res;
};

const renderedFromPackager = (mainOpts, cb) => {
  const getRendered = (optionsPackets, callback) => {
    // var converted = [];
    function recurse(finished, remaining) {
      if (remaining.length === 0) {
        callback(finished);
      } else {
        renderRequest(remaining.shift(), (mainJson) => {
          // console.log("RES", mainJson);
          // const cvrt = jsonToCSG(mainJson);

          const cvrt = mainJson;
          finished.push(cvrt);
          recurse(finished, remaining);
        });
      }
    }

    recurse([], optionsPackets);
  };

  const childOpts = [];
  getRendered([mainOpts].concat(childOpts), cb);
};

const renderedWsFromPackager = (mainOpts, cb) => {
  const ws = new WebSocket(`${packagerUrlWs}/render`);
  ws.onmessage = function incoming(data) {
    console.log('WS message received', data);

    cb([JSON.parse(data.data)]);
  };
};

const renderRequest = (options, cb) => {
  fetch(`${packagerUrl}/render`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(options),
  }).then((res) => res.json().then((json) => cb(json)));
};

const treeFromPackager = (mainOpts, cb) => {
  fetch(`${packagerUrl}/tree`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(mainOpts),
  }).then((res) => res.json().then((json) => cb(json)));
};

export {
  convertFromCsg,
  renderedFromPackager,
  renderedWsFromPackager,
  treeFromPackager,
};
