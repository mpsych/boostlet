// paste in the console after ROI Stats is running on the papaya viewer
// click in every panel, then copy(JSON.stringify(rec)) and save as recp_NAME.json
// it listens through boostlet so it sees the same ras voxel and plane the plugin used
// papaya world coordinates do not follow the nifti affine so no mm is stored
// and check.py compares by voxel only
window.rec = []
Boostlet.on_location_change(loc => {
  const g = id => +document.getElementById(id).textContent
  rec.push({
    vox: Array.from(loc.vox, Math.round),
    // papaya always shows all three panels so record it like a multiplanar view
    view: 3,
    clicked: Boostlet.get_plane(loc),
    title: document.getElementById('roi-title').textContent,
    mean: g('roi-mean'), std: g('roi-std'), min: g('roi-min'), max: g('roi-max'), p25: g('roi-p25'), p75: g('roi-p75')
  })
})
