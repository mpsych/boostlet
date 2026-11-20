// paste in the console after ROI Stats is running
// click in every panel, then copy(JSON.stringify(rec)) and save as rec.json
window.rec = []
const nv = Boostlet.framework.instance, prev = nv.onLocationChange
nv.onLocationChange = loc => {
  prev(loc)
  const g = id => +document.getElementById(id).textContent
  rec.push({
    // world position in mm so the check works for any stored axis order
    mm: Array.from(loc.mm).slice(0, 3),
    vox: Array.from(loc.vox, Math.round),
    // layout of the viewer and the panel niivue reports as clicked
    view: nv.opts.sliceType,
    clicked: Number.isFinite(loc.axCorSag) ? loc.axCorSag : null,
    title: document.getElementById('roi-title').textContent,
    mean: g('roi-mean'), std: g('roi-std'), min: g('roi-min'), max: g('roi-max'), p25: g('roi-p25'), p75: g('roi-p75')
  })
}
