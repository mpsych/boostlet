var H = H || {};

H.Annotator = function () {

  this.getLabelmapPixel = null;
  this.setLabelmapPixel = null;

  this.getVolumePixel = null;

  this.getVolumeDimensions = null;

  this.visited = [];

  this.intensity_max = -1;

  this.threshold = null;
  this.threshold_tolerance = null;

  this.labels = {};
  this.labels_to_merge = {};

  // 26 neighbor directions (9 + 8 + 9)
  this.di = [0, -1, -1, -1,  0,  1, 1, 1,  0, -1, -1, -1,  0,  1,  1,  1,  0, 0, -1, -1, -1,  0,  1, 1, 1, 0];
  this.dj = [0,  0,  0,  0,  0,  0, 0, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1,  1,  1,  1,  1,  1, 1, 1, 1];  
  this.dk = [1,  1,  0, -1, -1, -1, 0, 1,  1,  1,  0, -1, -1, -1,  0,  1,  0, 1,  1,  0, -1, -1, -1, 0, 1, 0];

  // 6 neighbor directions (1 + 4 + 1)
  this.di = [0,  0,  1, -1, 0,  0];
  this.dj = [0,  0,  0,  0, 1, -1];
  this.dk = [1,  -1, 0,  0, 0,  0];



};


H.Annotator.prototype.grow = function(i, j, k) {
  let intensity = this.getVolumePixel(i, j, k);
  
  let mn = intensity * (this.threshold_tolerance / 100);
  let mx = intensity + this.threshold;

  H.D.nv.drawPt(...[i,j,k], H.D.label);

  H.D.nv.drawFloodFill([i, j, k], 0, 1, mn, mx);

  H.D.nv.refreshDrawing(1);
}


H.Annotator.prototype._grow = function(i, j, k) {

  // inspired by
  // https://github.com/effepivi/ICP3038/blob/master/Lectures/8-Segmentation/notebooks/3-region-growing-opencv.ipynb


  this.visited = [];

  var dimensions = this.getVolumeDimensions();

  var point_list = [];
  point_list.push([i, j, k]);

  this.labels[H.D.label] = [];
  this.labels_to_merge = {};

  var counter = 0;

  while( point_list.length != 0) {

    if (counter++ > 20000) {
      console.log('canceled!')
      break;
    }

    var this_point = point_list.pop();

    var i = this_point[0];
    var j = this_point[1];
    var k = this_point[2];

    //
    this.visited.push([i, j, k]);
    this.setLabelmapPixel(i, j, k, H.D.label);
    this.labels[H.D.label].push([i, j, k]);


    for (var step = 0; step < 6; step++) {

      var new_ijk = [i + this.di[step], 
                     j + this.dj[step],
                     k + this.dk[step]];

      if (new_ijk[0] < 0 || new_ijk[0] >= dimensions[0] || 
          new_ijk[1] < 0 || new_ijk[1] >= dimensions[1] ||
          new_ijk[2] < 0 || new_ijk[2] >= dimensions[2]) {

        // out of bounds
        continue;

      }

      // // check if we visited that coordinate before
      var visited = false;
      var visited_length = this.visited.length;
      for (var v=0; v<visited_length; v++) {

        var q = this.visited[v];
        if (q[0] == new_ijk[0] && q[1] == new_ijk[1] && q[2] == new_ijk[2]) {
          
          // we have been here
          // ignore and jump out
          visited = true;
          break;

        } 

      }

      if (!visited) {

        var intensity = this.getVolumePixel(new_ijk[0], new_ijk[1], new_ijk[2]);

        var old_label = this.getLabelmapPixel(new_ijk[0], new_ijk[1], new_ijk[2]);

        if (old_label != 0 && old_label != H.D.label) {

          this.labels_to_merge[old_label] = true;

        } else {

          if ((intensity >= this.threshold) || (Math.abs(intensity-this.threshold) <= (this.threshold_tolerance / 100.0 * this.threshold))) {

            point_list.push(new_ijk);

          }

        }

      } 


    }

  };

  console.log('Found labels to merge', this.labels_to_merge);

  // merge labels
  // only if there are labels to merge
  // if (Object.keys(this.labels_to_merge).length > 0) {

  //   let label_color_to_inherit = Object.keys(this.labels_to_merge)[0];
  //   let current_label = H.D.label;

  //   // a list of all labels that need to be the same color
  //   // current label + all labels that were merged
  //   let labels_to_relabel = [current_label.toString(), ...Object.keys(this.labels_to_merge)];

  //   for (let label of labels_to_relabel) {

  //       console.log(`Relabling ${label}`);

  //       for (let pt of this.labels[label]) {

  //         let i, j, k;

  //         [i, j, k] = pt;

  //         this.setLabelmapPixel(i, j, k, label_color_to_inherit);
  //     }
  //   }
  // }


};


H.Annotator.prototype.merge = function(i, j, k) {

  for (let n = 0; n < 6; n++) {
    
    let new_ijk = [
      i + this.di[n],
      j + this.dj[n],
      k + this.dk[n],
    ]

    let neighbor_label = H.D.getLabelmapPixel(new_ijk[0], new_ijk[1], new_ijk[2]);

    if (neighbor_label != H.D.label && neighbor_label != 0) {

      H.D.setLabelmapPixel(i, j, k, neighbor_label);

      return;

    }

  }

};

