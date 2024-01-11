var H = H || {};
H.version = '0.1';

window.onload = function () {
  var url = 'https://danielhaehn.com/brain.nii';

  var query = window.location.search;
  var params = new URLSearchParams(query);
  var data = params.get('data');
  var filename = params.get('filename');

  if (data) {
    console.log('Loading', data);
    url = data;
  }

  H.V = new H.Viewer(document.getElementById('viewer'), url);
  H.D = new H.Drawer(H.V); // attach drawer

  if (filename) {
    console.log('Storing', filename)
    H.D.filename = filename;
  }


  H.A = new H.Annotator();
  H.A.setLabelmapPixel = H.D.setLabelmapPixel;
  H.A.getLabelmapPixel = H.D.getLabelmapPixel;
  H.A.getVolumePixel = H.D.getVolumePixel;
  H.A.getVolumeDimensions = H.D.getVolumeDimensions;

  setTimeout(function() {
    if (typeof run === "function") {
        run();
    }
  }, 4000);
};

function growingBenchmark() {
  // let evt = new MouseEvent("click", {
  //   clientX: 568,
  //   clientY: 354,
  //   ctrlKey: true
  // });

  // let viewer = document.getElementById('viewer');

  // // for (let x = 0; x < 1; x++) {
  // //   viewer.dispatchEvent(evt);
  // //   console.log("a");
  // // }

  console.log("custom growing:")
  for (let x = 0; x < 10; x++) {
    let i = 18;
    let j = 46;
    let k = 12;

    this.intensity = H.D.getVolumePixel(i, j, k);

    H.A.threshold = this.intensity;
    H.A.intensity_max = H.D.nv.back.global_max;
    H.A.threshold_tolerance = H.D.tolerance;
    H.A.label_to_draw = H.D.label;

    console.time("growing");

    H.A.grow(i, j, k);

    console.timeEnd("growing");

    H.D.refresh();

    // save NV undo map
    H.V.nv.drawAddUndoBitmap();

    this.nv.canvas.style.cursor = 'default';

    H.V.nv.drawUndo();
  }

  console.log("builtin growing:")
  for (let x = 0; x < 10; x++) {
    let i = 18;
    let j = 46;
    let k = 12;

    this.intensity = H.D.getVolumePixel(i, j, k);

    H.A.threshold = this.intensity;
    H.A.intensity_max = H.D.nv.back.global_max;
    H.A.threshold_tolerance = H.D.tolerance;
    H.A.label_to_draw = H.D.label;

    console.time("growing");

    H.A._grow(i, j, k);

    console.timeEnd("growing");

    H.D.refresh();

    // save NV undo map
    H.V.nv.drawAddUndoBitmap();

    this.nv.canvas.style.cursor = 'default';

    H.V.nv.drawUndo();
  }
}