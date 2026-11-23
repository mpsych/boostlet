/*
 * Brain segmentation with @brainchop/mindgrab (brainchop.org MeshNet models, in wasm).
 * NIfTI bytes in, NIfTI labels out, in native geometry; works with NiiVue 0.6 and 1.0.
 * Loaded as a module by brainchop.js after Boostlet.init().
 */
CATEGORY = 'Hidden';

const MINDGRAB = 'https://cdn.jsdelivr.net/npm/@brainchop/mindgrab@0.1.20261029/dist/index.js';
const { segment, MODELS } = await import(MINDGRAB);

const fw = Boostlet.framework;
const nv = fw.instance;
const labelModels = Object.keys(MODELS).filter(m => MODELS[m].outputKind === 'labels');
const model = prompt(`Segmentation model (${labelModels.join(', ')})`, 'mindmap');

if (labelModels.includes(model)) {
  Boostlet.hint(`brainchop: running ${model}...`, 60000);
  try {
    while (nv.volumes.length > 1) await nv.removeVolume(fw.v1 ? 1 : nv.volumes[1]);
    const input = await (fw.v1 ? nv.saveVolume({ volumeByIndex: 0, filename: '' }) : nv.saveImage({ filename: '', volumeByIndex: 0 }));
    // worker: false, since a module worker can't start from the CDN inside someone else's page
    const { image, backend, elapsedMs } = await segment(input, { model, worker: false });
    const name = `${model}.nii`;
    if (fw.v1) {
      const colormap = nv.addColormap(`brainchop-${model}`, MODELS[model].colormap);
      await nv.addVolume({ url: new File([image], name), colormap, opacity: 0.5 });
    } else {
      const labels = await nv.volumes[0].constructor.new(image, name); // NVImage.new
      labels.setColormapLabel(MODELS[model].colormap);
      labels.opacity = 0.5;
      // addVolume then calls the host page's onImageLoaded, which may throw (e.g. a UI that expects one
      // volume); our overlay is already in by then, so only a failure to add it counts
      try { nv.addVolume(labels); } catch (e) { if (!nv.volumes.includes(labels)) throw e; }
    }
    document.getElementById('BoostletHint')?.remove();
    Boostlet.hint(`brainchop ${model}: ${(elapsedMs / 1000).toFixed(1)} s on ${backend}`, 5000);
  } catch (e) {
    document.getElementById('BoostletHint')?.remove();
    Boostlet.hint(`brainchop failed: ${e.message ?? e}`, 8000);
    throw e;
  }
}
