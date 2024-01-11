H.Drawer = function (viewer) {

  this.nv = viewer.nv;

  this.setupInteraction();

  this.label = 0;
  this.intensity = null;

  this.leftDown = false;
  this.position = null;

  this.tolerance = 30;

  this.filename = 'label.nii.gz';

  this.magicMode = false;

  this.labelmap_buffer = null;

  this.single_pixel_mode = null;

};


H.Drawer.prototype.getLabelmapPixel = function (x, y, z) {

  let dx = H.D.nv.back.dims[1];
  let dy = H.D.nv.back.dims[2];
  let dz = H.D.nv.back.dims[3];

  return H.D.nv.drawBitmap[x + y * dx + z * dx * dy];

};

H.Drawer.prototype.setLabelmapPixel = function (x, y, z, label) {

  let dx = H.D.nv.back.dims[1];
  let dy = H.D.nv.back.dims[2];
  let dz = H.D.nv.back.dims[3];

  H.D.nv.drawBitmap[x + y * dx + z * dx * dy] = label;

};

H.Drawer.prototype.getVolumePixel = function(x, y, z) {

  return H.D.nv.back.getValue(x,y,z);

};

H.Drawer.prototype.getVolumeDimensions = function() {

  return H.D.nv.back.dims.slice(1);

};


H.Drawer.prototype.setupInteraction = function () {

  // since we are not using the niivue
  // drawing that is builtin, we need
  // to keep track of the mouse position like this
  this.nv.onLocationChange = function (e) {

    this.intensity = e.values[0].value.toFixed(3).replace(/\.?0*$/, "");

    // we just enable drawing for a second to create the array
    if (!this.nv.opts.drawingEnabled) {
      this.nv.setDrawingEnabled(1);
    }
    // but then disable it
    this.nv.setDrawingEnabled(0);

    H.D.position = e['vox'];

  }.bind(this);


  document.getElementById('tolerance').oninput = this.onToleranceChange.bind(this);

  this.nv.canvas.onmousedown = this.onMouseDown.bind(this);
  this.nv.canvas.onmousemove = this.onMouseMove.bind(this);
  this.nv.canvas.onmouseup = this.onMouseUp.bind(this);
  window.onkeypress = this.onKeyPress.bind(this);
  window.onkeydown = this.onKeyDown.bind(this);
  window.onkeyup = this.onKeyUp.bind(this);

};


H.Drawer.prototype.onToleranceChange = function(e) {

  this.tolerance = parseInt(e.target.value, 10);

  document.getElementById('tolerancelabel').innerText = this.tolerance;

};


H.Drawer.prototype.onMouseDown = function (e) {

  H.D.leftDown = true;

  if (e.shiftKey) {

    // activate measuring
    H.V.nv.opts.dragMode = H.V.nv.dragModes.measurement;

  // } else if (e.altKey) {

  //   // activate Window/Level
  //   H.V.nv.opts.dragMode = H.V.nv.dragModes.contrast;

  } else {

    H.V.nv.opts.dragMode = H.V.nv.dragModes.slicer3D;

  }

  if (e.ctrlKey) {

    this.nv.canvas.style.cursor = 'wait';

    H.D.label += 1;

  } 

};


H.Drawer.prototype.onMouseMove = function (e) {

  if (e.ctrlKey) {

    this.nv.canvas.style.cursor = 'crosshair';

  } else if (this.single_pixel_mode) {

    var label = H.D.label;
    if (this.single_pixel_mode == 'draw') {

      this.nv.canvas.style.cursor = 'copy';

    } else if (this.single_pixel_mode == 'erase') {

      this.nv.canvas.style.cursor = 'help';
      label = 0;

    }

    if (H.D.position) {

      var i = H.D.position[0];
      var j = H.D.position[1];
      var k = H.D.position[2];

      this.setLabelmapPixel(i, j, k, label);
      
      // if (this.single_pixel_mode == 'draw') {
      //   H.A.merge(i, j, k);
      // }

    } 

  } else {

    this.nv.canvas.style.cursor = 'default';
  
  }

};


H.Drawer.prototype.onMouseUp = function (e) {

  H.D.leftDown = false;

  var i = H.D.position[0];
  var j = H.D.position[1];
  var k = H.D.position[2];

  if (e.altKey) {

    // calculate specific W/L
    var intensity = H.D.getVolumePixel(i, j, k);

    // according to L. Saba 2009
    var wl = [intensity*2.07, intensity*0.72];

    H.V.updateWL(wl[0], wl[1], true);

    return;

  }

  if (this.single_pixel_mode) {

    // only redraw if we were drawing or erasing
    H.D.refresh();

    // save NV undo map
    H.V.nv.drawAddUndoBitmap();

    return;

  }

  if (!e.ctrlKey) return;

  //
  // REGION GROWING HERE // DEFAULT INTERACTION
  //

  console.log(e.clientY, e.clientX);

  var i = H.D.position[0];
  var j = H.D.position[1];
  var k = H.D.position[2];

  this.intensity = H.D.getVolumePixel(i, j, k);

  H.A.threshold = this.intensity;
  H.A.intensity_max = H.D.nv.back.global_max;
  H.A.threshold_tolerance = H.D.tolerance;
  H.A.label_to_draw = H.D.label;

  console.log(i,j,k);

  H.A.grow(i, j, k);

  H.D.refresh();

  // save NV undo map
  H.V.nv.drawAddUndoBitmap();

  this.nv.canvas.style.cursor = 'default';


};

H.Drawer.prototype.onKeyPress = function(e) {

  if (e.code == 'Space') {
    
    H.V.changeView();

  } else if (e.code == 'KeyZ') {

    H.V.nv.drawUndo();
    // H.A.undo();

  } else if (e.code == 'KeyX') {

    H.D.save();

  } else if (e.code == 'KeyA') {

    this.nv.moveCrosshairInVox(-1, 0, 0);

  } else if (e.code == 'KeyD') {

    this.nv.moveCrosshairInVox(1, 0, 0);

  } else if (e.code == 'KeyS') {

    // anterior 
    this.nv.moveCrosshairInVox(0, 1, 0);

  } else if (e.code == 'KeyW') {

    // posterior 
    this.nv.moveCrosshairInVox(0, -1, 0);

  } else if (e.code == 'KeyR') {

    H.V.reset();

  } else if (e.code == 'KeyQ') {

    if (!this.magicMode) {

      // magic mode thanks to Chris 'The Beast' Rorden
      // from: https://niivue.github.io/niivue/features/cactus.html
      // H.V.nv.volumes[0].colorMap = "ct_kidneys";
      // H.V.nv.volumes[0].cal_min = 130;
      // H.V.nv.volumes[0].cal_max = 1000;
      // H.V.nv.updateGLVolume();

      this.labelmap_buffer = H.V.nv.drawBitmap.slice();

      var binarized = new cv.Mat();
      var labels = cv.matFromArray(H.V.nv.drawBitmap.length, 
                                   1, cv.CV_8UC1, H.V.nv.drawBitmap);

      cv.threshold(labels, binarized, 0, 2, cv.THRESH_BINARY);

      H.V.nv.drawBitmap = binarized.data;

      H.V.nv.setDrawColormap("_itksnap");
      H.V.nv.volumes[0].colorMap = "ct_kidneys";
      H.D.nv.refreshDrawing();
      H.V.nv.updateGLVolume();


      this.magicMode = true;

    } else {

      // TODO cleanup to avoid duplication
      H.V.nv.drawBitmap = this.labelmap_buffer;

      H.V.nv.setDrawColormap("_slicer3d");
      H.V.nv.volumes[0].colorMap = "gray";
      var wl = H.V.getWLFromMinMax(130, 1500);
      H.V.updateWL(wl[0], wl[1], true);
      H.D.nv.refreshDrawing();

      H.V.nv.updateGLVolume();

      this.magicMode = false;

    }


  } else if (e.code == 'KeyC') {

    // TODO finish implementing connected components (not working)

      console.log("connected components");

      this.labelmap_buffer = H.V.nv.drawBitmap.slice();

      var components = new cv.Mat();
      var labels = cv.matFromArray(H.V.nv.drawBitmap.length, 1, cv.CV_8UC1, H.V.nv.drawBitmap);

      cv.connectedComponents(labels, components, 8);

      H.V.nv.drawBitmap = components.data;

      // empty?
      console.log(H.V.nv.drawBitmap);

      H.V.nv.refreshDrawing();
      H.V.nv.updateGLVolume();
  }

  
};


H.Drawer.prototype.onKeyDown = function(e) {

  if (e.key == 'Alt') {

    H.V.nv.drawOpacity = 0.;
    H.V.nv.updateGLVolume();

  } else if (e.key == 1) {

    this.single_pixel_mode = 'draw';

  } else if (e.key == 2) {

    this.single_pixel_mode = 'erase';

  } else {

    this.single_pixel_mode = null;

  }

};


H.Drawer.prototype.onKeyUp = function(e) {

  if (e.key == 'Alt') {

    H.V.nv.drawOpacity = 1.0;
    H.V.nv.updateGLVolume();

  }

  this.single_pixel_mode = null;
  this.nv.canvas.style.cursor = 'default';

};


H.Drawer.prototype.refresh = function() {

  H.D.nv.refreshDrawing(true);

  var unique_labels = [... new Set(H.D.nv.drawBitmap)].length-1;

  document.getElementById('stats').innerHTML = unique_labels;


};

H.Drawer.prototype.save = function () {

  H.D.nv.saveImage(H.D.filename, true);

};
