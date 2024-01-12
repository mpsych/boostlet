# Boostlet.js

[![Node CI for Boostlet](https://github.com/gaiborjosue/boostlet/actions/workflows/node.js.yml/badge.svg?branch=main)](https://github.com/gaiborjosue/boostlet/actions/workflows/node.js.yml)

## Introduction
Boostlet.js is an innovative framework designed to extend the capabilities of web-based biomedical image visualization libraries with powerful image processing features. It allows the seamless integration of image processing modules, known as Boostlets, across various frameworks like Cornerstone2D.js, NiiVue.js, and OpenSeaDragon.js. Boostlets are modules that can extend web-based visualization
frameworks with extra functionality such as processing

<img width="1470" alt="Screenshot 2023-12-20 at 7 55 14 PM" src="https://github.com/shrutivarade/boostlet/assets/37963866/5d7cfb18-5b66-4cb1-8c93-6a425ece8055">


## Features
- Easy integration with existing visualization frameworks.
- Drag-and-drop Boostlets for straightforward installation.
- Standard API for pixel data access and user interactions.
- Compatibility with BoxCraft (https://github.com/shrutivarade/BoxCraft) for enhanced region-of-interest selections.

## Getting Started
1. Clone the repository:
   ```bash
   git clone git@github.com:shrutivarade/boostlet.git
2. <script src="https://raw.githubusercontent.com/mpsych/boostlet/main/dist/boostlet.min.js"></script>

## Usage

Drag a Boostlet to your bookmarks bar, visit a supported data repository, and click the Boostlet to process the displayed image.

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
Contributing

We welcome contributions! Please fork the repository and submit a pull request with your proposed changes.

## License

Boostlet.js is open-source software licensed under the MIT license.
