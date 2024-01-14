H.Viewer = function(element, url) {
  
  //instance of niivue
  nv = new niivue.Niivue({    
    textHeight : 0.02,
    loadingText: 'please wait',
    rulerColor: [0, 1, 1, 0.1],
    onImageLoaded: this.setupWLSlider
  });


  this.nv = nv;

  //attach object to viewer
  nv.attachToCanvas(element);

  //set default view to coronal
  nv.setSliceType(nv.sliceTypeCoronal);
  
  // crosshair
  nv.setCrosshairColor([0, 1, 1, 0.1]);
  nv.opts.crosshairWidth = 0.2;
  nv.opts.show3Dcrosshair = true;



  var data = [{
    url: url,
    colorMap: 'gray',
    opacity: 1, 
    visible: true,
    // cal_min: 444,
    // cal_max: 1500
  }];

  nv.drawOpacity = 1.0;
  nv.setDrawColormap("_slicer3d")

  nv.loadVolumes(data);

  nv.setSliceMM(true);
  nv.opts.dragMode = nv.dragModes.slicer3D;

  this.sliderWL = null;

  this.view = 4;

};

H.Viewer.prototype.changeView = function() {

  this.view++;

  if (this.view > 4) {
    this.view = 0;
  }

  this.nv.setSliceType(this.view);

};


H.Viewer.prototype.setupWLSlider = function(v) {



  // setup WL slider
  var slider = document.getElementById('wlslider');

  noUiSlider.create(slider, {
      start: [v.global_min, v.global_max],
      behaviour: 'drag',
      connect: true,
      range: {
          'min': v.global_min,
          'max': v.global_max
      },

  });


  H.V.sliderWL = slider;
  H.V.sliderWL.noUiSlider.on('end', function(values) {

    var wl = H.V.getWLFromMinMax(parseInt(values[0]), parseInt(values[1]));

    H.V.updateWL(parseInt(wl[0]), parseInt(wl[1]), false);


  });
  // console.log('slider set up', H.V.sliderWL)


  H.V.reset();

};


H.Viewer.prototype.getWLFromMinMax = function(cal_min, cal_max) {

  var windoo = cal_max - cal_min; // BONE HU
  var level = (cal_min + cal_max) / 2;

  return [windoo, level];

};


H.Viewer.prototype.updateWL = function(windoo, level, updateSlider) {

  var cal_min = parseInt(level - windoo/2);
  var cal_max = parseInt(level + windoo/2);

  H.V.nv.volumes[0].cal_min = cal_min;
  H.V.nv.volumes[0].cal_max = cal_max;
  H.V.nv.updateGLVolume();

  if (updateSlider) {
    H.V.sliderWL.noUiSlider.set([cal_min, cal_max]);
  }
  
  document.getElementById('windowlabel').innerText = cal_min+'-'+cal_max;

};


H.Viewer.prototype.reset = function() {

  // now let's update WL
  var wl = H.V.getWLFromMinMax(130, 1500); // HU BONE!
  H.V.updateWL(wl[0], wl[1], true); // propagate to UI + volume

};

