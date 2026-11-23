# Boostlet.js

## Introduction
Boostlet.js is a generic processing framework that runs algorithms wrapped as bookmarklets and supports interacting with a variety of web-based visualization frameworks.

<img width="1470" alt="Screenshot 2023-12-20 at 7 55 14 PM" src="https://github.com/shrutivarade/boostlet/assets/37963866/5d7cfb18-5b66-4cb1-8c93-6a425ece8055">


## Features
- Easy integration with existing visualization frameworks.
- Drag-and-drop Boostlets for straightforward installation (see [boostlet.org](https://boostlet.org)).
- Standard API for pixel data access and user interactions.
- Compatibility with BoxCraft (https://github.com/shrutivarade/BoxCraft) for enhanced region-of-interest selections and other widgets.

## Download
Get it right here: <a href='https://boostlet.org/dist/boostlet.min.js'>boostlet.min.js</a> or include it like this:
   ```html
   <script src="https://boostlet.org/dist/boostlet.min.js"></script>
   ```

## Example Usage

The following example creates a Boostlet that runs a Sobel filter.

```javascript
script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";

script.onload = run;
document.head.appendChild(script);
eval(script);


function run() {
  
  // detect visualization framework
  Boostlet.init();

  image = Boostlet.get_image();

  kernel = [
    -1, 0, 1,
    -2, 0, 2,
    -1, 0, 1
  ];

  filtered = Boostlet.filter(image.data, image.width, image.height, kernel);

  Boostlet.set_image( filtered );

}
```

More in [examples/](examples/).

## API

All methods are on the global `Boostlet`.

| Method | Description |
|---|---|
| `init(name?, instance?)` | Detect the framework. `init('niivue', nv)` passes a NiiVue instance explicitly. |
| `get_image(raw?)` | Current 2D view as grayscale `{data, width, height}`. On NiiVue, `get_image(true)` returns raw voxels of the current slice (in multiplanar, the panel clicked last). |
| `set_image(pixels)` | Draw grayscale pixels back onto the view. |
| `set_mask(mask)` | Overlay a 2D mask. |
| `select_box(callback)` | Let the user drag a region-of-interest box. |

Voxel methods (NiiVue and Papaya), in RAS voxel coords:

| Method | Description |
|---|---|
| `has_volume()` | True once the viewer shows a volume. |
| `get_plane(loc?)` | 0 axial, 1 coronal, 2 sagittal; in multiplanar, the panel clicked last. |
| `get_crosshair_vox()` | Voxel under the crosshair. |
| `on_location_change(callback)` | `callback(location)` on every crosshair move; `location.vox`, `location.axCorSag`. |
| `get_subvolume(start, end)` | Raw voxels `{data, dims}`, end inclusive, clamped. |
| `get_dims()` | NiiVue only: `[width, height, 1]` of the current plane. |
| `get_scaling()` | `{slope, inter, cal_min, cal_max}`: display = raw × slope + inter. |
| `get_display_flip(plane)` | `{x, y}`: whether the viewer mirrors that plane on screen. |
| `slice_type()` | NiiVue only: 0 axial, 1 coronal, 2 sagittal, 3 multiplanar, 4 render. |

Utilities:

| Method | Description |
|---|---|
| `filter(pixels, width, height, kernel)` | Square-kernel convolution (e.g. 3×3). |
| `convert_to_png(data, width, height)` | Encode RGBA pixels as PNG bytes. |
| `load_script(url, callback)` | Load an external script. |
| `send_http_post(url, data, callback)` | POST data to a URL. |
| `hint(message, duration)` | Show a temporary message (ms). |

## Supported Libraries

- NiiVue.js (0.6 and 1.0rc)
- Cornerstone2D.js
- OpenSeaDragon.js
- Papaya
- XTK
- Any other page: falls back to the largest `<canvas>`.

NiiVue is detected on `window` (e.g. `window.nv`) or from a `<niivue-viewer>`/`<niivue-scene>` web component. Other ES module pages, typical for NiiVue 1.0, keep the instance private; pass it explicitly with `Boostlet.init('niivue', nv)`. All examples support both NiiVue 0.6 and 1.0 (live on boostlet.org once this version is deployed). imageCaptioning needs a Hugging Face token and has not been verified end to end.

## Developer Instructions

```bash
npm install
npx parcel build --no-cache   # dist/boostlet.min.js (npm run build also builds BoxCraft)
npm run dev                   # live-server on :5501
npm test                      # puppeteer screenshots vs tests/scripts/images/GroundTruth_*.png
```

To prototype in the JS console: `tests/dev.html` uses the uncompiled source, `tests/dist.html` the compiled build. Example scripts load the production build from boostlet.org; the NiiVue test pages run them against your local `dist/` instead (`tests/niivue/js/local_example.js`), so build first. See [tests/README.md](tests/README.md).

## Contributing

We welcome contributions! Please fork the repository and submit a pull request with your proposed changes.

## License

Boostlet.js is open-source software licensed under the MIT license.
