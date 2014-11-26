/* globals define,History */

define(['jquery', 'history'], function($) {
  'use strict';

  var FAIL_CONTROLLER_NAME = 'failController';

  var getBodyClasses = function getBodyClasses() {
    var r, c, arr = [];
    for (var key in A.routes) {
      c = A.routes[key];
      if (typeof c.bodyClass !== 'undefined') {
        arr.push(c.bodyClass);
      }
    }
    r = arr.join(' ');
    return r;
  };

  var _callController = function(state) {
    var controller = state.controller,
      route = state.route,
      data = state.data,
      params = state.params,
      inRouteHash = state.hash,
      matchedRoute = A.matchRoute(route),
      routeData = A.routes[matchedRoute.found],
      $body = $('body');

    $body.removeClass(getBodyClasses());

    if (typeof routeData !== 'undefined' &&
      typeof routeData.bodyClass !== 'undefined') {

      $body.addClass(routeData.bodyClass);
    }
    // call controller
    A[controller](route, data, params);
    if (inRouteHash) window.location.hash = inRouteHash;
  };

  var noop = function() {};

  var A = {
    version: '0.1.2',
    routes: {},
    base: '',
    routed: false,
    onRouteChange: null,
    beforeIntercept: noop,

    // on State change
    //   - e: event object
    onStateChange: function() {
      var state = History.getState(),
        data = state.data,
        next;

      next = function() {
        if (A.routed) {
          _callController(data);
        }
      };

      if (A.onRouteChange === null) {
        next();
      } else {
        A.onRouteChange(function() {
          A.onRouteChange = null;
          next();
        }, data.route, data.data, data.params);
      }
    },

    // Intercepta request de links para hacer requests XHR en vez de
    //   recargar toda la página
    intercept: function(e) {
      A.beforeIntercept();
      A.beforeIntercept = noop;
      var $this = $(this);
      if ($this.data('xhr') === 'back') {
        History.back();
      } else {
        A.route($this.attr('href'));
      }
      //Si autoscroll es true tira la pagina hacia arriba
      if ($this.data('autoscroll') === 'true' ||
        $this.data('autoscroll') === true) {
        $('body').scrollTop(0);
      }
      e.preventDefault();
    },

    // match route pattern
    matchRoute: function(route) {
      var i, patternSplit, pattern,
        routeSplit = route.split('/'),
        failed = false,
        found = false,
        params = {};

      for (pattern in A.routes) {
        patternSplit = pattern.split('/');
        if (routeSplit.length === patternSplit.length) {
          failed = false;
          for (i = 0; i < patternSplit.length; i++) {
            if (patternSplit[i][0] === ':' && patternSplit[i].length > 1) {
              params[patternSplit[i].substr(1)] = routeSplit[i];
            } else if (patternSplit[i] !== routeSplit[i]) {
              params = {};
              failed = true;
              break;
            }
          }
          if (!failed) {
            found = pattern;
            break;
          }
        }
      }

      return {
        found: found,
        params: params
      };
    },

    // route
    route: function(route, replace) {
      var routeData,
        controller,
        callController,
        baseAndRoute,
        params = {},
        inRouteHash,
        routeSplit = route.split('#');

      // call controller
      callController = function(data, status, params, controller,
        baseAndRoute, routeData, replace) {
        var f = replace ? 'replaceState' : 'pushState',
          state = {
            controller: controller,
            route: baseAndRoute,
            hash: inRouteHash,
            data: data,
            params: params,
            status: status
          };
        if (History.enabled) {
          // Push state
          History[f](state, routeData.title, baseAndRoute);

          // Call controller directly when replacing the state
          if (replace) {
            A.routed = true;
            _callController(state);
          }
        } else {
          _callController(state);
        }
      };

      inRouteHash = routeSplit[1];
      route = routeSplit[0];

      baseAndRoute = this.base + route;

      if (inRouteHash) {
        inRouteHash = '#' + inRouteHash;
      }

      // defaults
      if (typeof replace === 'undefined') {
        replace = false;
      }

      // replace to true if we are on the same path
      replace = window.location.pathname === this.base + route || replace;

      // find route data
      routeData = A.routes[route];
      if (typeof routeData === 'undefined') {
        routeData = A.matchRoute(route);
        if (routeData.found !== false) {
          params = routeData.params;
          routeData = A.routes[routeData.found];
        } else {
          controller = FAIL_CONTROLLER_NAME;
          callController(null, 404, params, controller, baseAndRoute, routeData,
            replace);
          return;
        }
      }

      // route data defautls
      if (typeof routeData.req === 'undefined') {
        routeData.req = true;
      }

      // get controller
      controller = routeData.controller;

      // GET
      if (routeData.req) {
        $.ajaxSetup({
          cache: false
        });
        $.get(baseAndRoute, function(data, textStatus, jqXHR) {
            callController(data, jqXHR.status, params, controller, baseAndRoute,
              routeData, replace);
          })
          .fail(function(jqXHR) {
            controller = FAIL_CONTROLLER_NAME;
            callController(null, jqXHR.status, params, controller, baseAndRoute,
              routeData, replace);
          });
      } else {
        callController(null, 200, params, controller, baseAndRoute, routeData,
          replace);
      }
    },

    // compile
    compile: function($el) {
      if (typeof $el === 'undefined') {
        $el = $(document);
      }
      // link interceptor
      $el.find('a[data-xhr]').unbind('click').click(A.intercept);
    },

    // ----------------------
    // Init
    // ----------------------

    // App init
    init: function() {
      var route;

      // history events
      History.Adapter.bind(window, 'statechange', A.onStateChange);

      // initial compilation
      A.compile();

      // route
      route = window.location.pathname;
      if (route.indexOf(this.base) === 0) {
        route = route.substr(this.base.length);
      }
      A.route(route, true);
    }
  };

  A[FAIL_CONTROLLER_NAME] = noop;

  return A;
});