(function () {

  'use strict';

  var assign = require('object-assign');
  var vary = require('vary');

  var defaults = {
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204
  };

  /**
   * Checks if the input is a string.
   * @param s - The input to check.
   * @returns {boolean} - True if the input is a string, false otherwise.
   */
  function isString(s) {
    return typeof s === 'string' || s instanceof String;
  }

  /**
   * Determines if a given origin is allowed based on a provided allowed origin.
   * @param {string} origin - The origin to check.
   * @param {string|RegExp|Array<string|RegExp>} allowedOrigin - The allowed origin(s) to compare against.
   * @returns {boolean} - True if the origin is allowed, false otherwise.
   */
  function isOriginAllowed(origin, allowedOrigin) {
    if (Array.isArray(allowedOrigin)) {
      for (var i = 0; i < allowedOrigin.length; ++i) {
        if (isOriginAllowed(origin, allowedOrigin[i])) {
          return true;
        }
      }
      return false;
    } else if (isString(allowedOrigin)) {
      return origin === allowedOrigin;
    } else if (allowedOrigin instanceof RegExp) {
      return allowedOrigin.test(origin);
    } else {
      return !!allowedOrigin;
    }
  }

  /**
   * Configures the origin for a CORS request.
   * @param {object} options - The options for configuring the origin.
   * @param {object} req - The request object.
   * @returns {array} headers - An array of headers to be added to the response.
   * @remarks This function checks the origin of the request and determines whether it is allowed based on the options provided. If the origin is allowed, it is reflected in the response headers. If not, the response headers will not include the Access-Control-Allow-Origin header.
   */
  function configureOrigin(options, req) {
    var requestOrigin = req.headers.origin,
      headers = [],
      isAllowed;

    if (!options.origin || options.origin === '*') {
      // allow any origin
      headers.push([{
        key: 'Access-Control-Allow-Origin',
        value: '*'
      }]);
    } else if (isString(options.origin)) {
      // fixed origin
      headers.push([{
        key: 'Access-Control-Allow-Origin',
        value: options.origin
      }]);
      headers.push([{
        key: 'Vary',
        value: 'Origin'
      }]);
    } else {
      isAllowed = isOriginAllowed(requestOrigin, options.origin);
      // reflect origin
      headers.push([{
        key: 'Access-Control-Allow-Origin',
        value: isAllowed ? requestOrigin : false
      }]);
      headers.push([{
        key: 'Vary',
        value: 'Origin'
      }]);
    }

    return headers;
  }

  /**
   * Configures the allowed HTTP methods for a CORS request.
   * @param {Object} options - The options object.
   * @param {Array|string} options.methods - The array or string of allowed HTTP methods.
   * @returns {Object} - An object with the key 'Access-Control-Allow-Methods' and the configured methods as the value.
   */
  function configureMethods(options) {
    var methods = options.methods;
    if (methods.join) {
      methods = options.methods.join(','); // .methods is an array, so turn it into a string
    }
    return {
      key: 'Access-Control-Allow-Methods',
      value: methods
    };
  }

  /**
   * Configures credentials based on the provided options.
   * @param {Object} options - The options object.
   * @param {boolean} options.credentials - Whether or not to include credentials.
   * @returns {Object|null} - An object with the key 'Access-Control-Allow-Credentials' and value 'true' if options.credentials is true, otherwise null.
   */
  function configureCredentials(options) {
    if (options.credentials === true) {
      return {
        key: 'Access-Control-Allow-Credentials',
        value: 'true'
      };
    }
    return null;
  }

  /**
   * Configures the allowed headers for a CORS request.
   * @param {object} options - The options for configuring the allowed headers.
   * @param {object} req - The request object.
   * @returns {array} headers - The configured headers as an array of objects with key-value pairs.
   */
  function configureAllowedHeaders(options, req) {
    var allowedHeaders = options.allowedHeaders || options.headers;
    var headers = [];

    if (!allowedHeaders) {
      allowedHeaders = req.headers['access-control-request-headers']; // .headers wasn't specified, so reflect the request headers
      headers.push([{
        key: 'Vary',
        value: 'Access-Control-Request-Headers'
      }]);
    } else if (allowedHeaders.join) {
      allowedHeaders = allowedHeaders.join(','); // .headers is an array, so turn it into a string
    }
    if (allowedHeaders && allowedHeaders.length) {
      headers.push([{
        key: 'Access-Control-Allow-Headers',
        value: allowedHeaders
      }]);
    }

    return headers;
  }

  /**
   * Configures the exposed headers for a CORS request.
   * @param {Object} options - The options object.
   * @param {Array} options.exposedHeaders - The headers to expose.
   * @returns {Object|null} - The Access-Control-Expose-Headers key-value pair or null if no headers are provided.
   */
  function configureExposedHeaders(options) {
    var headers = options.exposedHeaders;
    if (!headers) {
      return null;
    } else if (headers.join) {
      headers = headers.join(','); // .headers is an array, so turn it into a string
    }
    if (headers && headers.length) {
      return {
        key: 'Access-Control-Expose-Headers',
        value: headers
      };
    }
    return null;
  }

  /**
   * Configures the maximum age for Access-Control-Max-Age header based on the provided options.
   * @param {object} options - The options object.
   * @param {number} options.maxAge - The maximum age in seconds.
   * @returns {object|null} - Returns an object with key and value properties for the Access-Control-Max-Age header if maxAge is provided and not empty, otherwise returns null.
   */
  function configureMaxAge(options) {
    var maxAge = (typeof options.maxAge === 'number' || options.maxAge) && options.maxAge.toString()
    if (maxAge && maxAge.length) {
      return {
        key: 'Access-Control-Max-Age',
        value: maxAge
      };
    }
    return null;
  }

  /**
   * Applies headers to a response object.
   * @param {Array<Object>} headers - An array of header objects.
   * @param {Object} res - The response object to apply headers to.
   */
  function applyHeaders(headers, res) {
    for (var i = 0, n = headers.length; i < n; i++) {
      var header = headers[i];
      if (header) {
        if (Array.isArray(header)) {
          applyHeaders(header, res);
        } else if (header.key === 'Vary' && header.value) {
          vary(res, header.value);
        } else if (header.value) {
          res.setHeader(header.key, header.value);
        }
      }
    }
  }

  /**
   * Middleware function for handling Cross-Origin Resource Sharing (CORS).
   * @param {object} options - Options for configuring CORS behavior.
   * @param {object} req - The HTTP request object.
   * @param {object} res - The HTTP response object.
   * @param {function} next - The next middleware function in the chain.
   */
  function cors(options, req, res, next) {
    var headers = [],
      method = req.method && req.method.toUpperCase && req.method.toUpperCase();

    if (method === 'OPTIONS') {
      // preflight
      headers.push(configureOrigin(options, req));
      headers.push(configureCredentials(options))
      headers.push(configureMethods(options))
      headers.push(configureAllowedHeaders(options, req));
      headers.push(configureMaxAge(options))
      headers.push(configureExposedHeaders(options))
      applyHeaders(headers, res);

      if (options.preflightContinue) {
        next();
      } else {
        // Safari (and potentially other browsers) need content-length 0,
        //   for 204 or they just hang waiting for a body
        res.statusCode = options.optionsSuccessStatus;
        res.setHeader('Content-Length', '0');
        res.end();
      }
    } else {
      // actual response
      headers.push(configureOrigin(options, req));
      headers.push(configureCredentials(options))
      headers.push(configureExposedHeaders(options))
      applyHeaders(headers, res);
      next();
    }
  }

  /**
   * Wraps a middleware function with options in a closure, allowing for dynamic options based on the request.
   * @param {Function|Object} o - Either a function that returns options based on the request or a static options object.
   * @returns {Function} - A middleware function that can be used in an Express app.
   */
  function middlewareWrapper(o) {
    // if options are static (either via defaults or custom options passed in), wrap in a function
    var optionsCallback = null;
    if (typeof o === 'function') {
      optionsCallback = o;
    } else {
      optionsCallback = function (req, cb) {
        cb(null, o);
      };
    }

    return function corsMiddleware(req, res, next) {
      optionsCallback(req, function (err, options) {
        if (err) {
          next(err);
        } else {
          var corsOptions = assign({}, defaults, options);
          var originCallback = null;
          if (corsOptions.origin && typeof corsOptions.origin === 'function') {
            originCallback = corsOptions.origin;
          } else if (corsOptions.origin) {
            originCallback = function (origin, cb) {
              cb(null, corsOptions.origin);
            };
          }

          if (originCallback) {
            originCallback(req.headers.origin, function (err2, origin) {
              if (err2 || !origin) {
                next(err2);
              } else {
                corsOptions.origin = origin;
                cors(corsOptions, req, res, next);
              }
            });
          } else {
            next();
          }
        }
      });
    };
  }

  // can pass either an options hash, an options delegate, or nothing
  module.exports = middlewareWrapper;

}());
