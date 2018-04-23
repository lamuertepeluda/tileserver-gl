'use strict';

var path = require('path'),
    fs = require('fs'),
    randomColor = require('randomcolor');

var clone = require('clone'),
    glyphCompose = require('glyph-pbf-composite');


module.exports.getPublicUrl = function(publicUrl, req) {
  return req.get('x-forwarded-url') || publicUrl || (req.protocol + '://' + req.headers.host + '/')
}

module.exports.getTileUrls = function(req, domains, path, format, publicUrl, aliases) {

  if (domains) {
    if (domains.constructor === String && domains.length > 0) {
      domains = domains.split(',');
    }
    var host = req.headers.host;
    var hostParts = host.split('.');
    var relativeSubdomainsUsable = hostParts.length > 1 &&
        !/^([0-9]{1,3}\.){3}[0-9]{1,3}(\:[0-9]+)?$/.test(host);
    var newDomains = [];
    domains.forEach(function(domain) {
      if (domain.indexOf('*') !== -1) {
        if (relativeSubdomainsUsable) {
          var newParts = hostParts.slice(1);
          newParts.unshift(domain.replace('*', hostParts[0]));
          newDomains.push(newParts.join('.'));
        }
      } else {
        newDomains.push(domain);
      }
    });
    domains = newDomains;
  }
  if (!domains || domains.length == 0) {
    domains = [req.headers.host];
  }

  var key = req.query.key;
  var queryParams = [];
  if (req.query.key) {
    queryParams.push('key=' + req.query.key);
  }
  if (req.query.style) {
    queryParams.push('style=' + req.query.style);
  }
  var query = queryParams.length > 0 ? ('?' + queryParams.join('&')) : '';

  if (aliases && aliases[format]) {
    format = aliases[format];
  }

  var uris = [];
  const baseUrl = req.get('x-forwarded-url') || publicUrl
  if (!baseUrl) {
    domains.forEach(function(domain) {
      uris.push(req.protocol + '://' + domain + '/' + path +
                '/{z}/{x}/{y}.' + format + query);
    });
  } else {
    uris.push(baseUrl + path + '/{z}/{x}/{y}.' + format + query)
  }

  return uris;
};

module.exports.fixTileJSONCenter = function(tileJSON) {
  if (tileJSON.bounds && !tileJSON.center) {
    var fitWidth = 1024;
    var tiles = fitWidth / 256;
    tileJSON.center = [
      (tileJSON.bounds[0] + tileJSON.bounds[2]) / 2,
      (tileJSON.bounds[1] + tileJSON.bounds[3]) / 2,
      Math.round(
        -Math.log((tileJSON.bounds[2] - tileJSON.bounds[0]) / 360 / tiles) /
        Math.LN2
      )
    ];
  }
};

var getFontPbf = function(allowedFonts, fontPath, name, range, fallbacks) {
  return new Promise(function(resolve, reject) {
    if (!allowedFonts || (allowedFonts[name] && fallbacks)) {
      var filename = path.join(fontPath, name, range + '.pbf');
      if (!fallbacks) {
        fallbacks = clone(allowedFonts || {});
      }
      delete fallbacks[name];
      fs.readFile(filename, function(err, data) {
        if (err) {
          console.error('ERROR: Font not found:', name);
          if (fallbacks && Object.keys(fallbacks).length) {
            var fallbackName;

            var fontStyle = name.split(' ').pop();
            if (['Regular', 'Bold', 'Italic'].indexOf(fontStyle) < 0) {
              fontStyle = 'Regular';
            }
            fallbackName = 'Noto Sans ' + fontStyle;
            if (!fallbacks[fallbackName]) {
              fallbackName = 'Open Sans ' + fontStyle;
              if (!fallbacks[fallbackName]) {
                fallbackName = Object.keys(fallbacks)[0];
              }
            }

            console.error('ERROR: Trying to use', fallbackName, 'as a fallback');
            delete fallbacks[fallbackName];
            getFontPbf(null, fontPath, fallbackName, range, fallbacks).then(resolve, reject);
          } else {
            reject('Font load error: ' + name);
          }
        } else {
          resolve(data);
        }
      });
    } else {
      reject('Font not allowed: ' + name);
    }
  });
};

module.exports.getFontsPbf = function(allowedFonts, fontPath, names, range, fallbacks) {
  var fonts = names.split(',');
  var queue = [];
  fonts.forEach(function(font) {
    queue.push(
      getFontPbf(allowedFonts, fontPath, font, range, clone(allowedFonts || fallbacks))
    );
  });

  return Promise.all(queue).then(function(values) {
    return glyphCompose.combine(values);
  });
};

module.exports.createDataStyle = function(id, tileJSON) {
  var style = {
    version: 8,
    sources: {
      [id]: {
        type: 'vector',
        url: 'mbtiles://{' + id + '}'
      }
    },
    layers: [{
      id: "background",
      type: "background",
      paint: {
        "background-color": "#fff"
      }
    }]
  };
  tileJSON.vector_layers.forEach(function(layer) {
    var geometryType
    if (tileJSON.tilestats) {
      var layerStats = (tileJSON.tilestats.layers || []).find(l => l.layer === layer.id)
      geometryType = layerStats && layerStats.geometry
    }

    if (geometryType === 'Polygon') {
      polygonLayer();
    } else if (geometryType === 'LineString') {
      lineLayer();
    } else if (geometryType === 'Point') {
      pointLayer();
    } else {
      polygonLayer();
      lineLayer();
      pointLayer();
    }

    function polygonLayer() {
      style.layers.push(    {
        "id": layer.id + "_polygon",
        "source": id,
        "source-layer": layer.id,
        "type": "fill",
        "paint": {
          "fill-color": randomColor({luminosity: 'bright', format: 'rgba', alpha: 0.4}),
          "fill-antialias": false
        },
        "filter": ["==", "$type", "Polygon"]
      })
    }

    function lineLayer() {
      style.layers.push(    {
        "id": layer.id + '_line',
        "source": id,
        "source-layer": layer.id,
        "type": "line",
        "paint": {
          "line-color": randomColor({luminosity: 'bright', format: 'rgba', alpha: 0.6})
        },
        "layout": {
          "line-join": 'bevel'
        },
        "filter": ["==", "$type", "LineString"]
      })
    }

    function pointLayer() {
      style.layers.push({
        "id": layer.id + '_point',
        "source": id,
        "source-layer": layer.id,
        "type": "circle",
        "paint": {
          "circle-color": randomColor({luminosity: 'bright', format: 'rgb'}),
          "circle-radius": 2
        },
        "filter": ["==", "$type", "Point"]
      })
    }
  })
  return style;
}
