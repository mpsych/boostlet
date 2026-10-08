// paste in the console after ROI Stats is running
// click around, then copy(JSON.stringify(rec)) and save as rec.json
window.rec = []
const nv = Boostlet.framework.instance, prev = nv.onLocationChange
nv.onLocationChange = loc => {
  prev(loc)
  const g = id => +document.getElementById(id).textContent
  rec.push({ vox: Array.from(loc.vox, Math.round), view: nv.opts.sliceType, mean: g('roi-mean'), std: g('roi-std'), min: g('roi-min'), max: g('roi-max'), p25: g('roi-p25'), p75: g('roi-p75') })
}
