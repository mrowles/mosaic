var Mosaic = (function () {

  'use strict';

  var $fileUploader = document.getElementById('image-uploader');
  var $canvasMosaic = document.getElementById('canvas-mosaic');
  var canvasMosaicCtx = $canvasMosaic.getContext('2d');
  //var colourRows = [];

  /**
   * Mosaic
   */
  function Mosaic() {
    this.items = [];
    this.max = 0;
  }

  // Convert an RGB value to Hex
  function convertRgbToHex(r, g, b) {
    var hex = '#FFFFFF';

    if (!r || !g || !b) {
      return hex;
    }

    hex = '#' + convertRgbComponentToHex(r) + convertRgbComponentToHex(g) + convertRgbComponentToHex(b);

    return hex;
  }

  // Convert an RGB component to hex
  function convertRgbComponentToHex(c) {
    var hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }

  // Compute average RGB of given Canvas data
  function getAverageRgbOfCanvas(imgData) {
    var BLOCKSIZE = 1;
    var DATA_LEN = imgData.data.length;
    var rgb = {
      r: 0,
      g: 0,
      b: 0
    };
    var i = -4;
    var count = 0;

    // Loop through the pixels in the block and gather the correct rgb values
    while (( i += BLOCKSIZE * 4 ) < DATA_LEN) {
      ++count;
      rgb.r += imgData.data[i];
      rgb.g += imgData.data[i + 1];
      rgb.b += imgData.data[i + 2];
    }

    // Correctly assign the floored r,g,b values to the object
    rgb.r = Math.floor(rgb.r / count);
    rgb.g = Math.floor(rgb.g / count);
    rgb.b = Math.floor(rgb.b / count);

    return rgb;
  }


  function defer() {
    var resolve;
    var reject;
    var promise = new Promise(function (a, b) {
      resolve = a;
      reject = b;
    });

    return {
      resolve: resolve,
      reject: reject,
      promise: promise
    };
  }

  function TileRow(row, preloader, index) {
    preloader.queue(row)
      .then(function () {
        console.log('Row ' + index + ' loaded.');
      }, function (err) {
        console.log('Error:', err);
      });

  }

  // TODO
  // Needs comments
  function workMagic(tiles) {
    tiles.forEach(function (array, index) {
      new TileRow(array, mosaic, index);
    });

    mosaic.preload().then(function (tiles) {
      console.log('All mosaic tiles loaded:', tiles.length);
    }, function (err) {
      console.log('Error loading mosaic tiles:', err);
    });
  }

  /**
   * The `queue` methods is intended to add an array (a deck) of images to the
   * queue. It does not preload the images though; only adds them to the queue.
   * @param  {Array} array - Array of images to add the queue
   * @return {Promise}
   */
  Mosaic.prototype.queue = function (array) {

    if (!Array.isArray(array)) {
      array = [array];
    }

    if (array.length > this.max) {
      this.max = array.length;
    }
    var deferred = defer();

    this.items.push({
      collection: array,
      deferred: deferred
    });

    return deferred.promise;
  };

  /**
   * The `preloadImage` preloads the image resource living at `path` and returns
   * a promise that resolves when the image is successfully loaded by the
   * browser or if there is an error. Beware, the promise is not rejected in
   * case the image cannot be loaded; it gets resolved nevertheless.
   * @param  {String} path - Image url
   * @return {Promise}
   */
  Mosaic.prototype.preloadImage = function (path) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = resolve;
      image.onerror = resolve;
      image.src = path;
    });
  };

  /**
   * The `preload` method preloads the whole queue of decks added through the
   * `queue` method. It returns a promise that gets resolved when all decks have
   * been fully loaded.
   * The decks are loaded either sequencially (one after the other) or in
   * parallel, depending on the `parallel` options.
   * @return {Promise}
   */
  Mosaic.prototype.preload = function () {
    var tile;
    var tiles = [];

    var x = 0;
    var y = 0;

    for (var i = 0; i < this.max; i++) {
      this.items.forEach(function (item) {
        if (typeof item.collection[i] !== 'undefined') {
          item.collection[i] = this.preloadImage(item.collection[i]);
        }
      }, this);
    }

    this.items.forEach(function (item) {

      tile = Promise.all(item.collection).then(function (item) {
        x = 0;

        item.forEach(function (img) {
          var path = img.path ? img.path[0] : img.target;
          canvasMosaicCtx.drawImage(path, x, y, TILE_WIDTH, TILE_HEIGHT);
          x = x + TILE_HEIGHT;
        });

        y = y + TILE_WIDTH;
      }, function (err) {
        console.log('error: ', err);
      });

      tiles.push(tile);
    });

    return Promise.all(tiles);
  };

  // Builds service information related to each tile
  function buildTileServices(canvasContext, height, width) {
    var imgData;
    var rgb = '';
    var hex = '';
    var service = '';
    var colourRow = [];
    var tiles = [];

    for (var col = 0; (col + TILE_WIDTH) < height; col += TILE_WIDTH) {
      colourRow = [];

      for (var row = 0; (row + TILE_HEIGHT) < width; row += TILE_HEIGHT) {

        imgData = canvasContext.getImageData(row, col, TILE_WIDTH, TILE_HEIGHT);

        rgb = getAverageRgbOfCanvas(imgData);
        hex = convertRgbToHex(rgb.r, rgb.g, rgb.b);
        service = '/color/' + hex.split('#')[1];

        colourRow.push(service);
      }

      tiles.push(colourRow);
    }

    return tiles;
  }

  // Creates the mosaic information
  function createMosaicData(image) {
    var width = image.width;
    var height = image.height;

    $canvasMosaic.width = image.width;
    $canvasMosaic.height = image.height;

    var $canvasEl = document.createElement('canvas');
    $canvasEl.width = width;
    $canvasEl.height = height;

    var inMemoryCanvasCtx = $canvasEl.getContext('2d');
    inMemoryCanvasCtx.drawImage(image, 0, 0);
    inMemoryCanvasCtx.save();

    var tiles = buildTileServices(inMemoryCanvasCtx, height, width);

    return tiles;
  }

  // Upload a file
  // TODO
  // Needs work, should return promise
  function loadFile() {
    var fileUpload = new FileReader();

    if ($fileUploader.files.length < 1) {
      console.log('No file supplied');
      return;
    }

    var image = $fileUploader.files[0];

    if (image.type.indexOf('image') === -1) {
      console.log('Not an image supplied');
      return;
    }

    fileUpload.onload = function (e) {
      var source = e.target.result;
      loadImage(source);
    };

    fileUpload.onerror = function (e) {
      console.log('Error reading file, please try again');
    };

    fileUpload.readAsDataURL(image);
  }

  // Load an image
  // TODO
  // Needs work, should return promise
  function loadImage(src) {
    var image = new Image();

    image.onload = function () {
      var tiles = createMosaicData(image);
      workMagic(tiles);
    };

    image.onerror = function () {
      console.log('Error loading image, please try again');
    };

    image.src = src;
  }

  Mosaic.prototype.loadFile = function () {
    return loadFile.call(this);
  };

  Mosaic.prototype.loadImage = function (src) {
    return loadImage.call(this, src);
  };

  Mosaic.prototype.createMosaic = function (image) {
    return createMosaic().call(this, image)
  };

  return Mosaic;

}());

var mosaic = new Mosaic();


