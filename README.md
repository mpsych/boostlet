# Boostlet.js

## Introduction
Boostlet.js is a generic processing framework that runs algorithms wrapped as bookmarklets and supports interacting with a variety of web-based visualization frameworks.

<img width="1470" alt="Screenshot 2023-12-20 at 7 55 14 PM" src="https://github.com/shrutivarade/boostlet/assets/37963866/5d7cfb18-5b66-4cb1-8c93-6a425ece8055">


## Features
- Easy integration with existing visualization frameworks.
- Drag-and-drop Boostlets for straightforward installation.
- Standard API for pixel data access and user interactions.
- Compatibility with BoxCraft (https://github.com/shrutivarade/BoxCraft) for enhanced region-of-interest selections and other widgets.

## Download
Get it right here: <a href='https://boostlet.org/dist/boostlet.min.js'>boostlet.min.js</a> or include it like this:
   ```html
   <script src="https://boostlet.org/dist/boostlet.min.js"></script>
   ```

## Example Usage

The following example runs a Sobel filter on the 

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

## Developer Instructions

To compile the project:

`npx parcel build`

During development, to prototype in the JS Console, there are two entrypoints:

`tests/dev.html` that uses the uncompiled code and allows developing while prototyping

`tests/dist.html` uses the compiled code

## Supported Libraries

Cornerstone2D.js
NiiVue.js
OpenSeaDragon.js

## Contributing

We welcome contributions! Please fork the repository and submit a pull request with your proposed changes.

## License

Boostlet.js is open-source software licensed under the MIT license.
