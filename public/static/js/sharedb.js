(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
// ISC @ Julien Fontanet

'use strict'

// ===================================================================

var defineProperty = Object.defineProperty

// -------------------------------------------------------------------

var captureStackTrace = Error.captureStackTrace
if (!captureStackTrace) {
  captureStackTrace = function captureStackTrace (error) {
    var container = new Error()

    defineProperty(error, 'stack', {
      configurable: true,
      get: function getStack () {
        var stack = container.stack

        // Replace property with value for faster future accesses.
        defineProperty(this, 'stack', {
          value: stack
        })

        return stack
      },
      set: function setStack (stack) {
        defineProperty(error, 'stack', {
          configurable: true,
          value: stack,
          writable: true
        })
      }
    })
  }
}

// -------------------------------------------------------------------

function BaseError (message) {
  if (message) {
    defineProperty(this, 'message', {
      configurable: true,
      value: message,
      writable: true
    })
  }

  var cname = this.constructor.name
  if (
    cname &&
    cname !== this.name
  ) {
    defineProperty(this, 'name', {
      configurable: true,
      value: cname,
      writable: true
    })
  }

  captureStackTrace(this, this.constructor)
}

BaseError.prototype = Object.create(Error.prototype, {
  // See: https://github.com/JsCommunity/make-error/issues/4
  constructor: {
    configurable: true,
    value: BaseError,
    writable: true
  }
})

// -------------------------------------------------------------------

// Sets the name of a function if possible (depends of the JS engine).
var setFunctionName = (function () {
  function setFunctionName (fn, name) {
    return defineProperty(fn, 'name', {
      configurable: true,
      value: name
    })
  }
  try {
    var f = function () {}
    setFunctionName(f, 'foo')
    if (f.name === 'foo') {
      return setFunctionName
    }
  } catch (_) {}
})()

// -------------------------------------------------------------------

function makeError (constructor, super_) {
  if (super_ == null || super_ === Error) {
    super_ = BaseError
  } else if (typeof super_ !== 'function') {
    throw new TypeError('super_ should be a function')
  }

  var name
  if (typeof constructor === 'string') {
    name = constructor
    constructor = function () { super_.apply(this, arguments) }

    // If the name can be set, do it once and for all.
    if (setFunctionName) {
      setFunctionName(constructor, name)
      name = null
    }
  } else if (typeof constructor !== 'function') {
    throw new TypeError('constructor should be either a string or a function')
  }

  // Also register the super constructor also as `constructor.super_` just
  // like Node's `util.inherits()`.
  constructor.super_ = constructor['super'] = super_

  var properties = {
    constructor: {
      configurable: true,
      value: constructor,
      writable: true
    }
  }

  // If the name could not be set on the constructor, set it on the
  // prototype.
  if (name != null) {
    properties.name = {
      configurable: true,
      value: name,
      writable: true
    }
  }
  constructor.prototype = Object.create(super_.prototype, properties)

  return constructor
}
exports = module.exports = makeError
exports.BaseError = BaseError

},{}],3:[function(require,module,exports){
// These methods let you build a transform function from a transformComponent
// function for OT types like JSON0 in which operations are lists of components
// and transforming them requires N^2 work. I find it kind of nasty that I need
// this, but I'm not really sure what a better solution is. Maybe I should do
// this automatically to types that don't have a compose function defined.

// Add transform and transformX functions for an OT type which has
// transformComponent defined.  transformComponent(destination array,
// component, other component, side)
module.exports = bootstrapTransform
function bootstrapTransform(type, transformComponent, checkValidOp, append) {
  var transformComponentX = function(left, right, destLeft, destRight) {
    transformComponent(destLeft, left, right, 'left');
    transformComponent(destRight, right, left, 'right');
  };

  var transformX = type.transformX = function(leftOp, rightOp) {
    checkValidOp(leftOp);
    checkValidOp(rightOp);
    var newRightOp = [];

    for (var i = 0; i < rightOp.length; i++) {
      var rightComponent = rightOp[i];

      // Generate newLeftOp by composing leftOp by rightComponent
      var newLeftOp = [];
      var k = 0;
      while (k < leftOp.length) {
        var nextC = [];
        transformComponentX(leftOp[k], rightComponent, newLeftOp, nextC);
        k++;

        if (nextC.length === 1) {
          rightComponent = nextC[0];
        } else if (nextC.length === 0) {
          for (var j = k; j < leftOp.length; j++) {
            append(newLeftOp, leftOp[j]);
          }
          rightComponent = null;
          break;
        } else {
          // Recurse.
          var pair = transformX(leftOp.slice(k), nextC);
          for (var l = 0; l < pair[0].length; l++) {
            append(newLeftOp, pair[0][l]);
          }
          for (var r = 0; r < pair[1].length; r++) {
            append(newRightOp, pair[1][r]);
          }
          rightComponent = null;
          break;
        }
      }

      if (rightComponent != null) {
        append(newRightOp, rightComponent);
      }
      leftOp = newLeftOp;
    }
    return [leftOp, newRightOp];
  };

  // Transforms op with specified type ('left' or 'right') by otherOp.
  type.transform = function(op, otherOp, type) {
    if (!(type === 'left' || type === 'right'))
      throw new Error("type must be 'left' or 'right'");

    if (otherOp.length === 0) return op;

    if (op.length === 1 && otherOp.length === 1)
      return transformComponent([], op[0], otherOp[0], type);

    if (type === 'left')
      return transformX(op, otherOp)[0];
    else
      return transformX(otherOp, op)[1];
  };
};

},{}],4:[function(require,module,exports){
// Only the JSON type is exported, because the text type is deprecated
// otherwise. (If you want to use it somewhere, you're welcome to pull it out
// into a separate module that json0 can depend on).

module.exports = {
  type: require('./json0')
};

},{"./json0":5}],5:[function(require,module,exports){
/*
 This is the implementation of the JSON OT type.

 Spec is here: https://github.com/josephg/ShareJS/wiki/JSON-Operations

 Note: This is being made obsolete. It will soon be replaced by the JSON2 type.
*/

/**
 * UTILITY FUNCTIONS
 */

/**
 * Checks if the passed object is an Array instance. Can't use Array.isArray
 * yet because its not supported on IE8.
 *
 * @param obj
 * @returns {boolean}
 */
var isArray = function(obj) {
  return Object.prototype.toString.call(obj) == '[object Array]';
};

/**
 * Checks if the passed object is an Object instance.
 * No function call (fast) version
 *
 * @param obj
 * @returns {boolean}
 */
var isObject = function(obj) {
  return (!!obj) && (obj.constructor === Object);
};

/**
 * Clones the passed object using JSON serialization (which is slow).
 *
 * hax, copied from test/types/json. Apparently this is still the fastest way
 * to deep clone an object, assuming we have browser support for JSON.  @see
 * http://jsperf.com/cloning-an-object/12
 */
var clone = function(o) {
  return JSON.parse(JSON.stringify(o));
};

/**
 * JSON OT Type
 * @type {*}
 */
var json = {
  name: 'json0',
  uri: 'http://sharejs.org/types/JSONv0'
};

// You can register another OT type as a subtype in a JSON document using
// the following function. This allows another type to handle certain
// operations instead of the builtin JSON type.
var subtypes = {};
json.registerSubtype = function(subtype) {
  subtypes[subtype.name] = subtype;
};

json.create = function(data) {
  // Null instead of undefined if you don't pass an argument.
  return data === undefined ? null : clone(data);
};

json.invertComponent = function(c) {
  var c_ = {p: c.p};

  // handle subtype ops
  if (c.t && subtypes[c.t]) {
    c_.t = c.t;
    c_.o = subtypes[c.t].invert(c.o);
  }

  if (c.si !== void 0) c_.sd = c.si;
  if (c.sd !== void 0) c_.si = c.sd;
  if (c.oi !== void 0) c_.od = c.oi;
  if (c.od !== void 0) c_.oi = c.od;
  if (c.li !== void 0) c_.ld = c.li;
  if (c.ld !== void 0) c_.li = c.ld;
  if (c.na !== void 0) c_.na = -c.na;

  if (c.lm !== void 0) {
    c_.lm = c.p[c.p.length-1];
    c_.p = c.p.slice(0,c.p.length-1).concat([c.lm]);
  }

  return c_;
};

json.invert = function(op) {
  var op_ = op.slice().reverse();
  var iop = [];
  for (var i = 0; i < op_.length; i++) {
    iop.push(json.invertComponent(op_[i]));
  }
  return iop;
};

json.checkValidOp = function(op) {
  for (var i = 0; i < op.length; i++) {
    if (!isArray(op[i].p)) throw new Error('Missing path');
  }
};

json.checkList = function(elem) {
  if (!isArray(elem))
    throw new Error('Referenced element not a list');
};

json.checkObj = function(elem) {
  if (!isObject(elem)) {
    throw new Error("Referenced element not an object (it was " + JSON.stringify(elem) + ")");
  }
};

// helper functions to convert old string ops to and from subtype ops
function convertFromText(c) {
  c.t = 'text0';
  var o = {p: c.p.pop()};
  if (c.si != null) o.i = c.si;
  if (c.sd != null) o.d = c.sd;
  c.o = [o];
}

function convertToText(c) {
  c.p.push(c.o[0].p);
  if (c.o[0].i != null) c.si = c.o[0].i;
  if (c.o[0].d != null) c.sd = c.o[0].d;
  delete c.t;
  delete c.o;
}

json.apply = function(snapshot, op) {
  json.checkValidOp(op);

  op = clone(op);

  var container = {
    data: snapshot
  };

  for (var i = 0; i < op.length; i++) {
    var c = op[i];

    // convert old string ops to use subtype for backwards compatibility
    if (c.si != null || c.sd != null)
      convertFromText(c);

    var parent = null;
    var parentKey = null;
    var elem = container;
    var key = 'data';

    for (var j = 0; j < c.p.length; j++) {
      var p = c.p[j];

      parent = elem;
      parentKey = key;
      elem = elem[key];
      key = p;

      if (parent == null)
        throw new Error('Path invalid');
    }

    // handle subtype ops
    if (c.t && c.o !== void 0 && subtypes[c.t]) {
      elem[key] = subtypes[c.t].apply(elem[key], c.o);

    // Number add
    } else if (c.na !== void 0) {
      if (typeof elem[key] != 'number')
        throw new Error('Referenced element not a number');

      elem[key] += c.na;
    }

    // List replace
    else if (c.li !== void 0 && c.ld !== void 0) {
      json.checkList(elem);
      // Should check the list element matches c.ld
      elem[key] = c.li;
    }

    // List insert
    else if (c.li !== void 0) {
      json.checkList(elem);
      elem.splice(key,0, c.li);
    }

    // List delete
    else if (c.ld !== void 0) {
      json.checkList(elem);
      // Should check the list element matches c.ld here too.
      elem.splice(key,1);
    }

    // List move
    else if (c.lm !== void 0) {
      json.checkList(elem);
      if (c.lm != key) {
        var e = elem[key];
        // Remove it...
        elem.splice(key,1);
        // And insert it back.
        elem.splice(c.lm,0,e);
      }
    }

    // Object insert / replace
    else if (c.oi !== void 0) {
      json.checkObj(elem);

      // Should check that elem[key] == c.od
      elem[key] = c.oi;
    }

    // Object delete
    else if (c.od !== void 0) {
      json.checkObj(elem);

      // Should check that elem[key] == c.od
      delete elem[key];
    }

    else {
      throw new Error('invalid / missing instruction in op');
    }
  }

  return container.data;
};

// Helper to break an operation up into a bunch of small ops.
json.shatter = function(op) {
  var results = [];
  for (var i = 0; i < op.length; i++) {
    results.push([op[i]]);
  }
  return results;
};

// Helper for incrementally applying an operation to a snapshot. Calls yield
// after each op component has been applied.
json.incrementalApply = function(snapshot, op, _yield) {
  for (var i = 0; i < op.length; i++) {
    var smallOp = [op[i]];
    snapshot = json.apply(snapshot, smallOp);
    // I'd just call this yield, but thats a reserved keyword. Bah!
    _yield(smallOp, snapshot);
  }

  return snapshot;
};

// Checks if two paths, p1 and p2 match.
var pathMatches = json.pathMatches = function(p1, p2, ignoreLast) {
  if (p1.length != p2.length)
    return false;

  for (var i = 0; i < p1.length; i++) {
    if (p1[i] !== p2[i] && (!ignoreLast || i !== p1.length - 1))
      return false;
  }

  return true;
};

json.append = function(dest,c) {
  c = clone(c);

  if (dest.length === 0) {
    dest.push(c);
    return;
  }

  var last = dest[dest.length - 1];

  // convert old string ops to use subtype for backwards compatibility
  if ((c.si != null || c.sd != null) && (last.si != null || last.sd != null)) {
    convertFromText(c);
    convertFromText(last);
  }

  if (pathMatches(c.p, last.p)) {
    // handle subtype ops
    if (c.t && last.t && c.t === last.t && subtypes[c.t]) {
      last.o = subtypes[c.t].compose(last.o, c.o);

      // convert back to old string ops
      if (c.si != null || c.sd != null) {
        var p = c.p;
        for (var i = 0; i < last.o.length - 1; i++) {
          c.o = [last.o.pop()];
          c.p = p.slice();
          convertToText(c);
          dest.push(c);
        }

        convertToText(last);
      }
    } else if (last.na != null && c.na != null) {
      dest[dest.length - 1] = {p: last.p, na: last.na + c.na};
    } else if (last.li !== undefined && c.li === undefined && c.ld === last.li) {
      // insert immediately followed by delete becomes a noop.
      if (last.ld !== undefined) {
        // leave the delete part of the replace
        delete last.li;
      } else {
        dest.pop();
      }
    } else if (last.od !== undefined && last.oi === undefined && c.oi !== undefined && c.od === undefined) {
      last.oi = c.oi;
    } else if (last.oi !== undefined && c.od !== undefined) {
      // The last path component inserted something that the new component deletes (or replaces).
      // Just merge them.
      if (c.oi !== undefined) {
        last.oi = c.oi;
      } else if (last.od !== undefined) {
        delete last.oi;
      } else {
        // An insert directly followed by a delete turns into a no-op and can be removed.
        dest.pop();
      }
    } else if (c.lm !== undefined && c.p[c.p.length - 1] === c.lm) {
      // don't do anything
    } else {
      dest.push(c);
    }
  } else {
    // convert string ops back
    if ((c.si != null || c.sd != null) && (last.si != null || last.sd != null)) {
      convertToText(c);
      convertToText(last);
    }

    dest.push(c);
  }
};

json.compose = function(op1,op2) {
  json.checkValidOp(op1);
  json.checkValidOp(op2);

  var newOp = clone(op1);

  for (var i = 0; i < op2.length; i++) {
    json.append(newOp,op2[i]);
  }

  return newOp;
};

json.normalize = function(op) {
  var newOp = [];

  op = isArray(op) ? op : [op];

  for (var i = 0; i < op.length; i++) {
    var c = op[i];
    if (c.p == null) c.p = [];

    json.append(newOp,c);
  }

  return newOp;
};

// Returns the common length of the paths of ops a and b
json.commonLengthForOps = function(a, b) {
  var alen = a.p.length;
  var blen = b.p.length;
  if (a.na != null || a.t)
    alen++;

  if (b.na != null || b.t)
    blen++;

  if (alen === 0) return -1;
  if (blen === 0) return null;

  alen--;
  blen--;

  for (var i = 0; i < alen; i++) {
    var p = a.p[i];
    if (i >= blen || p !== b.p[i])
      return null;
  }

  return alen;
};

// Returns true if an op can affect the given path
json.canOpAffectPath = function(op, path) {
  return json.commonLengthForOps({p:path}, op) != null;
};

// transform c so it applies to a document with otherC applied.
json.transformComponent = function(dest, c, otherC, type) {
  c = clone(c);

  var common = json.commonLengthForOps(otherC, c);
  var common2 = json.commonLengthForOps(c, otherC);
  var cplength = c.p.length;
  var otherCplength = otherC.p.length;

  if (c.na != null || c.t)
    cplength++;

  if (otherC.na != null || otherC.t)
    otherCplength++;

  // if c is deleting something, and that thing is changed by otherC, we need to
  // update c to reflect that change for invertibility.
  if (common2 != null && otherCplength > cplength && c.p[common2] == otherC.p[common2]) {
    if (c.ld !== void 0) {
      var oc = clone(otherC);
      oc.p = oc.p.slice(cplength);
      c.ld = json.apply(clone(c.ld),[oc]);
    } else if (c.od !== void 0) {
      var oc = clone(otherC);
      oc.p = oc.p.slice(cplength);
      c.od = json.apply(clone(c.od),[oc]);
    }
  }

  if (common != null) {
    var commonOperand = cplength == otherCplength;

    // backward compatibility for old string ops
    var oc = otherC;
    if ((c.si != null || c.sd != null) && (otherC.si != null || otherC.sd != null)) {
      convertFromText(c);
      oc = clone(otherC);
      convertFromText(oc);
    }

    // handle subtype ops
    if (oc.t && subtypes[oc.t]) {
      if (c.t && c.t === oc.t) {
        var res = subtypes[c.t].transform(c.o, oc.o, type);

        if (res.length > 0) {
          // convert back to old string ops
          if (c.si != null || c.sd != null) {
            var p = c.p;
            for (var i = 0; i < res.length; i++) {
              c.o = [res[i]];
              c.p = p.slice();
              convertToText(c);
              json.append(dest, c);
            }
          } else {
            c.o = res;
            json.append(dest, c);
          }
        }

        return dest;
      }
    }

    // transform based on otherC
    else if (otherC.na !== void 0) {
      // this case is handled below
    } else if (otherC.li !== void 0 && otherC.ld !== void 0) {
      if (otherC.p[common] === c.p[common]) {
        // noop

        if (!commonOperand) {
          return dest;
        } else if (c.ld !== void 0) {
          // we're trying to delete the same element, -> noop
          if (c.li !== void 0 && type === 'left') {
            // we're both replacing one element with another. only one can survive
            c.ld = clone(otherC.li);
          } else {
            return dest;
          }
        }
      }
    } else if (otherC.li !== void 0) {
      if (c.li !== void 0 && c.ld === undefined && commonOperand && c.p[common] === otherC.p[common]) {
        // in li vs. li, left wins.
        if (type === 'right')
          c.p[common]++;
      } else if (otherC.p[common] <= c.p[common]) {
        c.p[common]++;
      }

      if (c.lm !== void 0) {
        if (commonOperand) {
          // otherC edits the same list we edit
          if (otherC.p[common] <= c.lm)
            c.lm++;
          // changing c.from is handled above.
        }
      }
    } else if (otherC.ld !== void 0) {
      if (c.lm !== void 0) {
        if (commonOperand) {
          if (otherC.p[common] === c.p[common]) {
            // they deleted the thing we're trying to move
            return dest;
          }
          // otherC edits the same list we edit
          var p = otherC.p[common];
          var from = c.p[common];
          var to = c.lm;
          if (p < to || (p === to && from < to))
            c.lm--;

        }
      }

      if (otherC.p[common] < c.p[common]) {
        c.p[common]--;
      } else if (otherC.p[common] === c.p[common]) {
        if (otherCplength < cplength) {
          // we're below the deleted element, so -> noop
          return dest;
        } else if (c.ld !== void 0) {
          if (c.li !== void 0) {
            // we're replacing, they're deleting. we become an insert.
            delete c.ld;
          } else {
            // we're trying to delete the same element, -> noop
            return dest;
          }
        }
      }

    } else if (otherC.lm !== void 0) {
      if (c.lm !== void 0 && cplength === otherCplength) {
        // lm vs lm, here we go!
        var from = c.p[common];
        var to = c.lm;
        var otherFrom = otherC.p[common];
        var otherTo = otherC.lm;
        if (otherFrom !== otherTo) {
          // if otherFrom == otherTo, we don't need to change our op.

          // where did my thing go?
          if (from === otherFrom) {
            // they moved it! tie break.
            if (type === 'left') {
              c.p[common] = otherTo;
              if (from === to) // ugh
                c.lm = otherTo;
            } else {
              return dest;
            }
          } else {
            // they moved around it
            if (from > otherFrom) c.p[common]--;
            if (from > otherTo) c.p[common]++;
            else if (from === otherTo) {
              if (otherFrom > otherTo) {
                c.p[common]++;
                if (from === to) // ugh, again
                  c.lm++;
              }
            }

            // step 2: where am i going to put it?
            if (to > otherFrom) {
              c.lm--;
            } else if (to === otherFrom) {
              if (to > from)
                c.lm--;
            }
            if (to > otherTo) {
              c.lm++;
            } else if (to === otherTo) {
              // if we're both moving in the same direction, tie break
              if ((otherTo > otherFrom && to > from) ||
                  (otherTo < otherFrom && to < from)) {
                if (type === 'right') c.lm++;
              } else {
                if (to > from) c.lm++;
                else if (to === otherFrom) c.lm--;
              }
            }
          }
        }
      } else if (c.li !== void 0 && c.ld === undefined && commonOperand) {
        // li
        var from = otherC.p[common];
        var to = otherC.lm;
        p = c.p[common];
        if (p > from) c.p[common]--;
        if (p > to) c.p[common]++;
      } else {
        // ld, ld+li, si, sd, na, oi, od, oi+od, any li on an element beneath
        // the lm
        //
        // i.e. things care about where their item is after the move.
        var from = otherC.p[common];
        var to = otherC.lm;
        p = c.p[common];
        if (p === from) {
          c.p[common] = to;
        } else {
          if (p > from) c.p[common]--;
          if (p > to) c.p[common]++;
          else if (p === to && from > to) c.p[common]++;
        }
      }
    }
    else if (otherC.oi !== void 0 && otherC.od !== void 0) {
      if (c.p[common] === otherC.p[common]) {
        if (c.oi !== void 0 && commonOperand) {
          // we inserted where someone else replaced
          if (type === 'right') {
            // left wins
            return dest;
          } else {
            // we win, make our op replace what they inserted
            c.od = otherC.oi;
          }
        } else {
          // -> noop if the other component is deleting the same object (or any parent)
          return dest;
        }
      }
    } else if (otherC.oi !== void 0) {
      if (c.oi !== void 0 && c.p[common] === otherC.p[common]) {
        // left wins if we try to insert at the same place
        if (type === 'left') {
          json.append(dest,{p: c.p, od:otherC.oi});
        } else {
          return dest;
        }
      }
    } else if (otherC.od !== void 0) {
      if (c.p[common] == otherC.p[common]) {
        if (!commonOperand)
          return dest;
        if (c.oi !== void 0) {
          delete c.od;
        } else {
          return dest;
        }
      }
    }
  }

  json.append(dest,c);
  return dest;
};

require('./bootstrapTransform')(json, json.transformComponent, json.checkValidOp, json.append);

/**
 * Register a subtype for string operations, using the text0 type.
 */
var text = require('./text0');

json.registerSubtype(text);
module.exports = json;


},{"./bootstrapTransform":3,"./text0":6}],6:[function(require,module,exports){
// DEPRECATED!
//
// This type works, but is not exported. Its included here because the JSON0
// embedded string operations use this library.


// A simple text implementation
//
// Operations are lists of components. Each component either inserts or deletes
// at a specified position in the document.
//
// Components are either:
//  {i:'str', p:100}: Insert 'str' at position 100 in the document
//  {d:'str', p:100}: Delete 'str' at position 100 in the document
//
// Components in an operation are executed sequentially, so the position of components
// assumes previous components have already executed.
//
// Eg: This op:
//   [{i:'abc', p:0}]
// is equivalent to this op:
//   [{i:'a', p:0}, {i:'b', p:1}, {i:'c', p:2}]

var text = module.exports = {
  name: 'text0',
  uri: 'http://sharejs.org/types/textv0',
  create: function(initial) {
    if ((initial != null) && typeof initial !== 'string') {
      throw new Error('Initial data must be a string');
    }
    return initial || '';
  }
};

/** Insert s2 into s1 at pos. */
var strInject = function(s1, pos, s2) {
  return s1.slice(0, pos) + s2 + s1.slice(pos);
};

/** Check that an operation component is valid. Throws if its invalid. */
var checkValidComponent = function(c) {
  if (typeof c.p !== 'number')
    throw new Error('component missing position field');

  if ((typeof c.i === 'string') === (typeof c.d === 'string'))
    throw new Error('component needs an i or d field');

  if (c.p < 0)
    throw new Error('position cannot be negative');
};

/** Check that an operation is valid */
var checkValidOp = function(op) {
  for (var i = 0; i < op.length; i++) {
    checkValidComponent(op[i]);
  }
};

/** Apply op to snapshot */
text.apply = function(snapshot, op) {
  var deleted;

  checkValidOp(op);
  for (var i = 0; i < op.length; i++) {
    var component = op[i];
    if (component.i != null) {
      snapshot = strInject(snapshot, component.p, component.i);
    } else {
      deleted = snapshot.slice(component.p, component.p + component.d.length);
      if (component.d !== deleted)
        throw new Error("Delete component '" + component.d + "' does not match deleted text '" + deleted + "'");

      snapshot = snapshot.slice(0, component.p) + snapshot.slice(component.p + component.d.length);
    }
  }
  return snapshot;
};

/**
 * Append a component to the end of newOp. Exported for use by the random op
 * generator and the JSON0 type.
 */
var append = text._append = function(newOp, c) {
  if (c.i === '' || c.d === '') return;

  if (newOp.length === 0) {
    newOp.push(c);
  } else {
    var last = newOp[newOp.length - 1];

    if (last.i != null && c.i != null && last.p <= c.p && c.p <= last.p + last.i.length) {
      // Compose the insert into the previous insert
      newOp[newOp.length - 1] = {i:strInject(last.i, c.p - last.p, c.i), p:last.p};

    } else if (last.d != null && c.d != null && c.p <= last.p && last.p <= c.p + c.d.length) {
      // Compose the deletes together
      newOp[newOp.length - 1] = {d:strInject(c.d, last.p - c.p, last.d), p:c.p};

    } else {
      newOp.push(c);
    }
  }
};

/** Compose op1 and op2 together */
text.compose = function(op1, op2) {
  checkValidOp(op1);
  checkValidOp(op2);
  var newOp = op1.slice();
  for (var i = 0; i < op2.length; i++) {
    append(newOp, op2[i]);
  }
  return newOp;
};

/** Clean up an op */
text.normalize = function(op) {
  var newOp = [];

  // Normalize should allow ops which are a single (unwrapped) component:
  // {i:'asdf', p:23}.
  // There's no good way to test if something is an array:
  // http://perfectionkills.com/instanceof-considered-harmful-or-how-to-write-a-robust-isarray/
  // so this is probably the least bad solution.
  if (op.i != null || op.p != null) op = [op];

  for (var i = 0; i < op.length; i++) {
    var c = op[i];
    if (c.p == null) c.p = 0;

    append(newOp, c);
  }

  return newOp;
};

// This helper method transforms a position by an op component.
//
// If c is an insert, insertAfter specifies whether the transform
// is pushed after the insert (true) or before it (false).
//
// insertAfter is optional for deletes.
var transformPosition = function(pos, c, insertAfter) {
  // This will get collapsed into a giant ternary by uglify.
  if (c.i != null) {
    if (c.p < pos || (c.p === pos && insertAfter)) {
      return pos + c.i.length;
    } else {
      return pos;
    }
  } else {
    // I think this could also be written as: Math.min(c.p, Math.min(c.p -
    // otherC.p, otherC.d.length)) but I think its harder to read that way, and
    // it compiles using ternary operators anyway so its no slower written like
    // this.
    if (pos <= c.p) {
      return pos;
    } else if (pos <= c.p + c.d.length) {
      return c.p;
    } else {
      return pos - c.d.length;
    }
  }
};

// Helper method to transform a cursor position as a result of an op.
//
// Like transformPosition above, if c is an insert, insertAfter specifies
// whether the cursor position is pushed after an insert (true) or before it
// (false).
text.transformCursor = function(position, op, side) {
  var insertAfter = side === 'right';
  for (var i = 0; i < op.length; i++) {
    position = transformPosition(position, op[i], insertAfter);
  }

  return position;
};

// Transform an op component by another op component. Asymmetric.
// The result will be appended to destination.
//
// exported for use in JSON type
var transformComponent = text._tc = function(dest, c, otherC, side) {
  //var cIntersect, intersectEnd, intersectStart, newC, otherIntersect, s;

  checkValidComponent(c);
  checkValidComponent(otherC);

  if (c.i != null) {
    // Insert.
    append(dest, {i:c.i, p:transformPosition(c.p, otherC, side === 'right')});
  } else {
    // Delete
    if (otherC.i != null) {
      // Delete vs insert
      var s = c.d;
      if (c.p < otherC.p) {
        append(dest, {d:s.slice(0, otherC.p - c.p), p:c.p});
        s = s.slice(otherC.p - c.p);
      }
      if (s !== '')
        append(dest, {d: s, p: c.p + otherC.i.length});

    } else {
      // Delete vs delete
      if (c.p >= otherC.p + otherC.d.length)
        append(dest, {d: c.d, p: c.p - otherC.d.length});
      else if (c.p + c.d.length <= otherC.p)
        append(dest, c);
      else {
        // They overlap somewhere.
        var newC = {d: '', p: c.p};

        if (c.p < otherC.p)
          newC.d = c.d.slice(0, otherC.p - c.p);

        if (c.p + c.d.length > otherC.p + otherC.d.length)
          newC.d += c.d.slice(otherC.p + otherC.d.length - c.p);

        // This is entirely optional - I'm just checking the deleted text in
        // the two ops matches
        var intersectStart = Math.max(c.p, otherC.p);
        var intersectEnd = Math.min(c.p + c.d.length, otherC.p + otherC.d.length);
        var cIntersect = c.d.slice(intersectStart - c.p, intersectEnd - c.p);
        var otherIntersect = otherC.d.slice(intersectStart - otherC.p, intersectEnd - otherC.p);
        if (cIntersect !== otherIntersect)
          throw new Error('Delete ops delete different text in the same region of the document');

        if (newC.d !== '') {
          newC.p = transformPosition(newC.p, otherC);
          append(dest, newC);
        }
      }
    }
  }

  return dest;
};

var invertComponent = function(c) {
  return (c.i != null) ? {d:c.i, p:c.p} : {i:c.d, p:c.p};
};

// No need to use append for invert, because the components won't be able to
// cancel one another.
text.invert = function(op) {
  // Shallow copy & reverse that sucka.
  op = op.slice().reverse();
  for (var i = 0; i < op.length; i++) {
    op[i] = invertComponent(op[i]);
  }
  return op;
};

require('./bootstrapTransform')(text, transformComponent, checkValidOp, append);

},{"./bootstrapTransform":3}],7:[function(require,module,exports){
// Text document API for the 'text' type. This implements some standard API
// methods for any text-like type, so you can easily bind a textarea or
// something without being fussy about the underlying OT implementation.
//
// The API is desigend as a set of functions to be mixed in to some context
// object as part of its lifecycle. It expects that object to have getSnapshot
// and submitOp methods, and call _onOp when an operation is received.
//
// This API defines:
//
// - getLength() returns the length of the document in characters
// - getText() returns a string of the document
// - insert(pos, text, [callback]) inserts text at position pos in the document
// - remove(pos, length, [callback]) removes length characters at position pos
//
// A user can define:
// - onInsert(pos, text): Called when text is inserted.
// - onRemove(pos, length): Called when text is removed.

module.exports = api;
function api(getSnapshot, submitOp) {
  return {
    // Returns the text content of the document
    get: function() { return getSnapshot(); },

    // Returns the number of characters in the string
    getLength: function() { return getSnapshot().length; },

    // Insert the specified text at the given position in the document
    insert: function(pos, text, callback) {
      return submitOp([pos, text], callback);
    },

    remove: function(pos, length, callback) {
      return submitOp([pos, {d:length}], callback);
    },

    // When you use this API, you should implement these two methods
    // in your editing context.
    //onInsert: function(pos, text) {},
    //onRemove: function(pos, removedLength) {},

    _onOp: function(op) {
      var pos = 0;
      var spos = 0;
      for (var i = 0; i < op.length; i++) {
        var component = op[i];
        switch (typeof component) {
          case 'number':
            pos += component;
            spos += component;
            break;
          case 'string':
            if (this.onInsert) this.onInsert(pos, component);
            pos += component.length;
            break;
          case 'object':
            if (this.onRemove) this.onRemove(pos, component.d);
            spos += component.d;
        }
      }
    }
  };
};
api.provides = {text: true};

},{}],8:[function(require,module,exports){
var type = require('./text');
type.api = require('./api');

module.exports = {
  type: type
};

},{"./api":7,"./text":9}],9:[function(require,module,exports){
/* Text OT!
 *
 * This is an OT implementation for text. It is the standard implementation of
 * text used by ShareJS.
 *
 * This type is composable but non-invertable. Its similar to ShareJS's old
 * text-composable type, but its not invertable and its very similar to the
 * text-tp2 implementation but it doesn't support tombstones or purging.
 *
 * Ops are lists of components which iterate over the document.
 * Components are either:
 *   A number N: Skip N characters in the original document
 *   "str"     : Insert "str" at the current position in the document
 *   {d:N}     : Delete N characters at the current position in the document
 *
 * Eg: [3, 'hi', 5, {d:8}]
 *
 * The operation does not have to skip the last characters in the document.
 *
 * Snapshots are strings.
 *
 * Cursors are either a single number (which is the cursor position) or a pair of
 * [anchor, focus] (aka [start, end]). Be aware that end can be before start.
 */

/** @module text */

exports.name = 'text';
exports.uri = 'http://sharejs.org/types/textv1';

/** Create a new text snapshot.
 *
 * @param {string} initial - initial snapshot data. Optional. Defaults to ''.
 */
exports.create = function(initial) {
  if ((initial != null) && typeof initial !== 'string') {
    throw Error('Initial data must be a string');
  }
  return initial || '';
};

var isArray = Array.isArray || function(obj) {
  return Object.prototype.toString.call(obj) === "[object Array]";
};

/** Check the operation is valid. Throws if not valid. */
var checkOp = function(op) {
  if (!isArray(op)) throw Error('Op must be an array of components');

  var last = null;
  for (var i = 0; i < op.length; i++) {
    var c = op[i];
    switch (typeof c) {
      case 'object':
        // The only valid objects are {d:X} for +ive values of X.
        //if (!(typeof c.d === 'number' && c.d > 0)) throw Error('Object components must be deletes of size > 0');
        break;
      case 'string':
        // Strings are inserts.
        if (!(c.length > 0)) throw Error('Inserts cannot be empty');
        break;
      case 'number':
        // Numbers must be skips. They have to be +ive numbers.
        if (!(c > 0)) throw Error('Skip components must be >0');
        if (typeof last === 'number') throw Error('Adjacent skip components should be combined');
        break;
    }
    last = c;
  }

  if (typeof last === 'number') throw Error('Op has a trailing skip');
};

/** Check that the given selection range is valid. */
var checkSelection = function(selection) {
  // This may throw from simply inspecting selection[0] / selection[1]. Thats
  // sort of ok, though it'll generate the wrong message.
  if (typeof selection !== 'number'
      && (typeof selection[0] !== 'number' || typeof selection[1] !== 'number'))
    throw Error('Invalid selection');
};

/** Make a function that appends to the given operation. */
var makeAppend = function(op) {
  return function(component) {
    if (!component || component.d === 0) {
      // The component is a no-op. Ignore!
 
    } else if (op.length === 0) {
      return op.push(component);

    } else if (typeof component === typeof op[op.length - 1]) {
      if (typeof component === 'object') {
        return op[op.length - 1].d += component.d;
      } else {
        return op[op.length - 1] += component;
      }
    } else {
      return op.push(component);
    }
  };
};

/** Makes and returns utility functions take and peek. */
var makeTake = function(op) {
  // The index of the next component to take
  var idx = 0;
  // The offset into the component
  var offset = 0;

  // Take up to length n from the front of op. If n is -1, take the entire next
  // op component. If indivisableField == 'd', delete components won't be separated.
  // If indivisableField == 'i', insert components won't be separated.
  var take = function(n, indivisableField) {
    // We're at the end of the operation. The op has skips, forever. Infinity
    // might make more sense than null here.
    if (idx === op.length)
      return n === -1 ? null : n;

    var part;
    var c = op[idx];
    if (typeof c === 'number') {
      // Skip
      if (n === -1 || c - offset <= n) {
        part = c - offset;
        ++idx;
        offset = 0;
        return part;
      } else {
        offset += n;
        return n;
      }
    } else if (typeof c === 'string') {
      // Insert
      if (n === -1 || indivisableField === 'i' || c.length - offset <= n) {
        part = c.slice(offset);
        ++idx;
        offset = 0;
        return part;
      } else {
        part = c.slice(offset, offset + n);
        offset += n;
        return part;
      }
    } else {
      // Delete
      if (n === -1 || indivisableField === 'd' || c.d - offset <= n) {
        part = {d: c.d - offset};
        ++idx;
        offset = 0;
        return part;
      } else {
        offset += n;
        return {d: n};
      }
    }
  };

  // Peek at the next op that will be returned.
  var peekType = function() { return op[idx]; };

  return [take, peekType];
};

/** Get the length of a component */
var componentLength = function(c) {
  // Uglify will compress this down into a ternary
  if (typeof c === 'number') {
    return c;
  } else {
    return c.length || c.d;
  }
};

/** Trim any excess skips from the end of an operation.
 *
 * There should only be at most one, because the operation was made with append.
 */
var trim = function(op) {
  if (op.length > 0 && typeof op[op.length - 1] === 'number') {
    op.pop();
  }
  return op;
};

exports.normalize = function(op) {
  var newOp = [];
  var append = makeAppend(newOp);
  for (var i = 0; i < op.length; i++) {
    append(op[i]);
  }
  return trim(newOp);
};

/** Apply an operation to a document snapshot */
exports.apply = function(str, op) {
  if (typeof str !== 'string') {
    throw Error('Snapshot should be a string');
  }
  checkOp(op);

  // We'll gather the new document here and join at the end.
  var newDoc = [];

  for (var i = 0; i < op.length; i++) {
    var component = op[i];
    switch (typeof component) {
      case 'number':
        if (component > str.length) throw Error('The op is too long for this document');

        newDoc.push(str.slice(0, component));
        // This might be slow for big strings. Consider storing the offset in
        // str instead of rewriting it each time.
        str = str.slice(component);
        break;
      case 'string':
        newDoc.push(component);
        break;
      case 'object':
        str = str.slice(component.d);
        break;
    }
  }

  return newDoc.join('') + str;
};

/** Transform op by otherOp.
 *
 * @param op - The operation to transform
 * @param otherOp - Operation to transform it by
 * @param side - Either 'left' or 'right'
 */
exports.transform = function(op, otherOp, side) {
  if (side != 'left' && side != 'right') throw Error("side (" + side + ") must be 'left' or 'right'");

  checkOp(op);
  checkOp(otherOp);

  var newOp = [];
  var append = makeAppend(newOp);

  var _fns = makeTake(op);
  var take = _fns[0],
      peek = _fns[1];

  for (var i = 0; i < otherOp.length; i++) {
    var component = otherOp[i];

    var length, chunk;
    switch (typeof component) {
      case 'number': // Skip
        length = component;
        while (length > 0) {
          chunk = take(length, 'i');
          append(chunk);
          if (typeof chunk !== 'string') {
            length -= componentLength(chunk);
          }
        }
        break;

      case 'string': // Insert
        if (side === 'left') {
          // The left insert should go first.
          if (typeof peek() === 'string') {
            append(take(-1));
          }
        }

        // Otherwise skip the inserted text.
        append(component.length);
        break;

      case 'object': // Delete
        length = component.d;
        while (length > 0) {
          chunk = take(length, 'i');
          switch (typeof chunk) {
            case 'number':
              length -= chunk;
              break;
            case 'string':
              append(chunk);
              break;
            case 'object':
              // The delete is unnecessary now - the text has already been deleted.
              length -= chunk.d;
          }
        }
        break;
    }
  }
  
  // Append any extra data in op1.
  while ((component = take(-1)))
    append(component);
  
  return trim(newOp);
};

/** Compose op1 and op2 together and return the result */
exports.compose = function(op1, op2) {
  checkOp(op1);
  checkOp(op2);

  var result = [];
  var append = makeAppend(result);
  var take = makeTake(op1)[0];

  for (var i = 0; i < op2.length; i++) {
    var component = op2[i];
    var length, chunk;
    switch (typeof component) {
      case 'number': // Skip
        length = component;
        while (length > 0) {
          chunk = take(length, 'd');
          append(chunk);
          if (typeof chunk !== 'object') {
            length -= componentLength(chunk);
          }
        }
        break;

      case 'string': // Insert
        append(component);
        break;

      case 'object': // Delete
        length = component.d;

        while (length > 0) {
          chunk = take(length, 'd');

          switch (typeof chunk) {
            case 'number':
              append({d: chunk});
              length -= chunk;
              break;
            case 'string':
              length -= chunk.length;
              break;
            case 'object':
              append(chunk);
          }
        }
        break;
    }
  }

  while ((component = take(-1)))
    append(component);

  return trim(result);
};


var transformPosition = function(cursor, op) {
  var pos = 0;
  for (var i = 0; i < op.length; i++) {
    var c = op[i];
    if (cursor <= pos) break;

    // I could actually use the op_iter stuff above - but I think its simpler
    // like this.
    switch (typeof c) {
      case 'number':
        if (cursor <= pos + c)
          return cursor;
        pos += c;
        break;

      case 'string':
        pos += c.length;
        cursor += c.length;
        break;

      case 'object':
        cursor -= Math.min(c.d, cursor - pos);
        break;
    }
  }
  return cursor;
};

exports.transformSelection = function(selection, op, isOwnOp) {
  var pos = 0;
  if (isOwnOp) {
    // Just track the position. We'll teleport the cursor to the end anyway.
    // This works because text ops don't have any trailing skips at the end - so the last
    // component is the last thing.
    for (var i = 0; i < op.length; i++) {
      var c = op[i];
      switch (typeof c) {
        case 'number':
          pos += c;
          break;
        case 'string':
          pos += c.length;
          break;
        // Just eat deletes.
      }
    }
    return pos;
  } else {
    return typeof selection === 'number' ?
      transformPosition(selection, op) : [transformPosition(selection[0], op), transformPosition(selection[1], op)];
  }
};

exports.selectionEq = function(c1, c2) {
  if (c1[0] != null && c1[0] === c1[1]) c1 = c1[0];
  if (c2[0] != null && c2[0] === c2[1]) c2 = c2[0];
  return c1 === c2 || (c1[0] != null && c2[0] != null && c1[0] === c2[0] && c1[1] == c2[1]);
};


},{}],10:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],11:[function(require,module,exports){
(function (global){
global.sharedb=require("../server/vendor/sharedb/lib/client")
global.otText = require('ot-text');
sharedb.types.register(otText.type);


sharedb.types.map['json0'].registerSubtype(otText.type);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../server/vendor/sharedb/lib/client":14,"ot-text":8}],12:[function(require,module,exports){
(function (process){
var Doc = require('./doc');
var Query = require('./query');
var emitter = require('../emitter');
var ShareDBError = require('../error');
var types = require('../types');
var util = require('../util');

/**
 * Handles communication with the sharejs server and provides queries and
 * documents.
 *
 * We create a connection with a socket object
 *   connection = new sharejs.Connection(sockset)
 * The socket may be any object handling the websocket protocol. See the
 * documentation of bindToSocket() for details. We then wait for the connection
 * to connect
 *   connection.on('connected', ...)
 * and are finally able to work with shared documents
 *   connection.get('food', 'steak') // Doc
 *
 * @param socket @see bindToSocket
 */
module.exports = Connection;
function Connection(socket) {
  emitter.EventEmitter.call(this);

  // Map of collection -> id -> doc object for created documents.
  // (created documents MUST BE UNIQUE)
  this.collections = {};

  // Each query is created with an id that the server uses when it sends us
  // info about the query (updates, etc)
  this.nextQueryId = 1;

  // Map from query ID -> query object.
  this.queries = {};

  // A unique message number for the given id
  this.seq = 1;

  // Equals agent.clientId on the server
  this.id = null;

  // This direct reference from connection to agent is not used internal to
  // ShareDB, but it is handy for server-side only user code that may cache
  // state on the agent and read it in middleware
  this.agent = null;

  this.debug = true;

  this.bindToSocket(socket);
}
emitter.mixin(Connection);


/**
 * Use socket to communicate with server
 *
 * Socket is an object that can handle the websocket protocol. This method
 * installs the onopen, onclose, onmessage and onerror handlers on the socket to
 * handle communication and sends messages by calling socket.send(message). The
 * sockets `readyState` property is used to determine the initaial state.
 *
 * @param socket Handles the websocket protocol
 * @param socket.readyState
 * @param socket.close
 * @param socket.send
 * @param socket.onopen
 * @param socket.onclose
 * @param socket.onmessage
 * @param socket.onerror
 */
Connection.prototype.bindToSocket = function(socket) {
  if (this.socket) {
    this.socket.close();
    this.socket.onmessage = null;
    this.socket.onopen = null;
    this.socket.onerror = null;
    this.socket.onclose = null;
  }

  this.socket = socket;

  // State of the connection. The correspoding events are emmited when this changes
  //
  // - 'connecting'   The connection is still being established, or we are still
  //                    waiting on the server to send us the initialization message
  // - 'connected'    The connection is open and we have connected to a server
  //                    and recieved the initialization message
  // - 'disconnected' Connection is closed, but it will reconnect automatically
  // - 'closed'       The connection was closed by the client, and will not reconnect
  // - 'stopped'      The connection was closed by the server, and will not reconnect
  this.state = (socket.readyState === 0 || socket.readyState === 1) ? 'connecting' : 'disconnected';

  // This is a helper variable the document uses to see whether we're
  // currently in a 'live' state. It is true if and only if we're connected
  this.canSend = false;

  var connection = this;

  socket.onmessage = function(event) {
    try {
      var data = (typeof event.data === 'string') ?
        JSON.parse(event.data) : event.data;
    } catch (err) {
      console.warn('Failed to parse message', event);
      return;
    }

    if (connection.debug) console.log('RECV', JSON.stringify(data));

    var request = {data: data};
    connection.emit('receive', request);
    if (!request.data) return;

    try {
      connection.handleMessage(request.data);
    } catch (err) {
      process.nextTick(function() {
        connection.emit('error', err);
      });
    }
  };

  socket.onopen = function() {
    connection._setState('connecting');
  };

  socket.onerror = function(err) {
    // This isn't the same as a regular error, because it will happen normally
    // from time to time. Your connection should probably automatically
    // reconnect anyway, but that should be triggered off onclose not onerror.
    // (onclose happens when onerror gets called anyway).
    connection.emit('connection error', err);
  };

  socket.onclose = function(reason) {
    // node-browserchannel reason values:
    //   'Closed' - The socket was manually closed by calling socket.close()
    //   'Stopped by server' - The server sent the stop message to tell the client not to try connecting
    //   'Request failed' - Server didn't respond to request (temporary, usually offline)
    //   'Unknown session ID' - Server session for client is missing (temporary, will immediately reestablish)

    if (reason === 'closed' || reason === 'Closed') {
      connection._setState('closed', reason);

    } else if (reason === 'stopped' || reason === 'Stopped by server') {
      connection._setState('stopped', reason);

    } else {
      connection._setState('disconnected', reason);
    }
  };
};

/**
 * @param {object} message
 * @param {String} message.a action
 */
Connection.prototype.handleMessage = function(message) {
  console.log(message)
  var err = null;
  if (message.error) {
    // wrap in Error object so can be passed through event emitters
    err = new Error(message.error.message);
    err.code = message.error.code;
    // Add the message data to the error object for more context
    err.data = message;
    delete message.error;
  }
  // Switch on the message action. Most messages are for documents and are
  // handled in the doc class.
  switch (message.a) {
    case 'init':
      // Client initialization packet
      if (message.protocol !== 1) {
        err = new ShareDBError(4019, 'Invalid protocol version');
        return this.emit('error', err);
      }
      if (types.map[message.type] !== types.defaultType) {
        err = new ShareDBError(4020, 'Invalid default type');
        return this.emit('error', err);
      }
      if (typeof message.id !== 'string') {
        err = new ShareDBError(4021, 'Invalid client id');
        return this.emit('error', err);
      }
      this.id = message.id;

      this._setState('connected');
      return;

    case 'qf':
      var query = this.queries[message.id];
      if (query) query._handleFetch(err, message.data, message.extra);
      return;
    case 'qs':
      var query = this.queries[message.id];
      if (query) query._handleSubscribe(err, message.data, message.extra);
      return;
    case 'qu':
      // Queries are removed immediately on calls to destroy, so we ignore
      // replies to query unsubscribes. Perhaps there should be a callback for
      // destroy, but this is currently unimplemented
      return;
    case 'q':
      // Query message. Pass this to the appropriate query object.
      var query = this.queries[message.id];
      if (!query) return;
      if (err) return query._handleError(err);
      if (message.diff) query._handleDiff(message.diff);
      if (message.hasOwnProperty('extra')) query._handleExtra(message.extra);
      return;

    case 'bf':
      return this._handleBulkMessage(message, '_handleFetch');
    case 'bs':
      return this._handleBulkMessage(message, '_handleSubscribe');
    case 'bu':
      return this._handleBulkMessage(message, '_handleUnsubscribe');

    case 'f':
      var doc = this.getExisting(message.c, message.d);
      if (doc) doc._handleFetch(err, message.data);
      return;
    case 's':
      var doc = this.getExisting(message.c, message.d);
      if (doc) doc._handleSubscribe(err, message.data);
      return;
    case 'u':
      var doc = this.getExisting(message.c, message.d);
      if (doc) doc._handleUnsubscribe(err);
      return;
    case 'op':
      var doc = this.getExisting(message.c, message.d);
      if (doc) doc._handleOp(err, message);
      return;

    default:
      console.warn('Ignorning unrecognized message', message);
  }
};

Connection.prototype._handleBulkMessage = function(message, method) {
  if (message.data) {
    for (var id in message.data) {
      var doc = this.getExisting(message.c, id);
      if (doc) doc[method](message.error, message.data[id]);
    }
  } else if (Array.isArray(message.b)) {
    for (var i = 0; i < message.b.length; i++) {
      var id = message.b[i];
      var doc = this.getExisting(message.c, id);
      if (doc) doc[method](message.error);
    }
  } else if (message.b) {
    for (var id in message.b) {
      var doc = this.getExisting(message.c, id);
      if (doc) doc[method](message.error);
    }
  } else {
    console.error('Invalid bulk message', message);
  }
};

Connection.prototype._reset = function() {
  this.seq = 1;
  this.id = null;
  this.agent = null;
};

// Set the connection's state. The connection is basically a state machine.
Connection.prototype._setState = function(newState, reason) {
  if (this.state === newState) return;

  // I made a state diagram. The only invalid transitions are getting to
  // 'connecting' from anywhere other than 'disconnected' and getting to
  // 'connected' from anywhere other than 'connecting'.
  if (
    (newState === 'connecting' && this.state !== 'disconnected' && this.state !== 'stopped' && this.state !== 'closed') ||
    (newState === 'connected' && this.state !== 'connecting')
  ) {
    var err = new ShareDBError(5007, 'Cannot transition directly from ' + this.state + ' to ' + newState);
    return this.emit('error', err);
  }

  this.state = newState;
  this.canSend = (newState === 'connected');

  if (newState === 'disconnected' || newState === 'stopped' || newState === 'closed') this._reset();

  // Group subscribes together to help server make more efficient calls
  this.startBulk();
  // Emit the event to all queries
  for (var id in this.queries) {
    var query = this.queries[id];
    query._onConnectionStateChanged();
  }
  // Emit the event to all documents
  for (var collection in this.collections) {
    var docs = this.collections[collection];
    for (var id in docs) {
      docs[id]._onConnectionStateChanged();
    }
  }
  this.endBulk();

  this.emit(newState, reason);
  this.emit('state', newState, reason);
};

Connection.prototype.startBulk = function() {
  if (!this.bulk) this.bulk = {};
};

Connection.prototype.endBulk = function() {
  if (this.bulk) {
    for (var collection in this.bulk) {
      var actions = this.bulk[collection];
      this._sendBulk('f', collection, actions.f);
      this._sendBulk('s', collection, actions.s);
      this._sendBulk('u', collection, actions.u);
    }
  }
  this.bulk = null;
};

Connection.prototype._sendBulk = function(action, collection, values) {
  if (!values) return;
  var ids = [];
  var versions = {};
  var versionsCount = 0;
  var versionId;
  for (var id in values) {
    var value = values[id];
    if (value == null) {
      ids.push(id);
    } else {
      versions[id] = value;
      versionId = id;
      versionsCount++;
    }
  }
  if (ids.length === 1) {
    var id = ids[0];
    this.send({a: action, c: collection, d: id});
  } else if (ids.length) {
    this.send({a: 'b' + action, c: collection, b: ids});
  }
  if (versionsCount === 1) {
    var version = versions[versionId];
    this.send({a: action, c: collection, d: versionId, v: version});
  } else if (versionsCount) {
    this.send({a: 'b' + action, c: collection, b: versions});
  }
};

Connection.prototype._sendAction = function(action, doc, version) {
  // Ensure the doc is registered so that it receives the reply message
  this._addDoc(doc);
  if (this.bulk) {
    // Bulk subscribe
    var actions = this.bulk[doc.collection] || (this.bulk[doc.collection] = {});
    var versions = actions[action] || (actions[action] = {});
    var isDuplicate = versions.hasOwnProperty(doc.id);
    versions[doc.id] = version;
    return isDuplicate;
  } else {
    // Send single doc subscribe message
    var message = {a: action, c: doc.collection, d: doc.id, v: version};
    this.send(message);
  }
};

Connection.prototype.sendFetch = function(doc) {
  return this._sendAction('f', doc, doc.version);
};

Connection.prototype.sendSubscribe = function(doc) {
  return this._sendAction('s', doc, doc.version);
};

Connection.prototype.sendUnsubscribe = function(doc) {
  return this._sendAction('u', doc);
};

Connection.prototype.sendOp = function(doc, op) {
  // Ensure the doc is registered so that it receives the reply message
  this._addDoc(doc);
  var message = {
    a: 'op',
    c: doc.collection,
    d: doc.id,
    v: doc.version,
    src: op.src,
    seq: op.seq
  };
  if (op.op) message.op = op.op;
  if (op.create) message.create = op.create;
  if (op.del) message.del = op.del;
  this.send(message);
};


/**
 * Sends a message down the socket
 */
Connection.prototype.send = function(message) {
  if (this.debug) console.log('SEND', JSON.stringify(message));

  this.emit('send', message);
  this.socket.send(JSON.stringify(message));
};


/**
 * Closes the socket and emits 'closed'
 */
Connection.prototype.close = function() {
  this.socket.close();
};

Connection.prototype.getExisting = function(collection, id) {
  if (this.collections[collection]) return this.collections[collection][id];
};


/**
 * Get or create a document.
 *
 * @param collection
 * @param id
 * @return {Doc}
 */
Connection.prototype.get = function(collection, id) {
  var docs = this.collections[collection] ||
    (this.collections[collection] = {});

  var doc = docs[id];
  if (!doc) {
    doc = docs[id] = new Doc(this, collection, id);
    this.emit('doc', doc);
  }

  return doc;
};


/**
 * Remove document from this.collections
 *
 * @private
 */
Connection.prototype._destroyDoc = function(doc) {
  var docs = this.collections[doc.collection];
  if (!docs) return;

  delete docs[doc.id];

  // Delete the collection container if its empty. This could be a source of
  // memory leaks if you slowly make a billion collections, which you probably
  // won't do anyway, but whatever.
  if (!util.hasKeys(docs)) {
    delete this.collections[doc.collection];
  }
};

Connection.prototype._addDoc = function(doc) {
  var docs = this.collections[doc.collection];
  if (!docs) {
    docs = this.collections[doc.collection] = {};
  }
  if (docs[doc.id] !== doc) {
    docs[doc.id] = doc;
  }
};

// Helper for createFetchQuery and createSubscribeQuery, below.
Connection.prototype._createQuery = function(action, collection, q, options, callback) {
  var id = this.nextQueryId++;
  var query = new Query(action, this, id, collection, q, options, callback);
  this.queries[id] = query;
  query.send();
  return query;
};

// Internal function. Use query.destroy() to remove queries.
Connection.prototype._destroyQuery = function(query) {
  delete this.queries[query.id];
};

// The query options object can contain the following fields:
//
// db: Name of the db for the query. You can attach extraDbs to ShareDB and
//   pick which one the query should hit using this parameter.

// Create a fetch query. Fetch queries are only issued once, returning the
// results directly into the callback.
//
// The callback should have the signature function(error, results, extra)
// where results is a list of Doc objects.
Connection.prototype.createFetchQuery = function(collection, q, options, callback) {
  return this._createQuery('qf', collection, q, options, callback);
};

// Create a subscribe query. Subscribe queries return with the initial data
// through the callback, then update themselves whenever the query result set
// changes via their own event emitter.
//
// If present, the callback should have the signature function(error, results, extra)
// where results is a list of Doc objects.
Connection.prototype.createSubscribeQuery = function(collection, q, options, callback) {
  return this._createQuery('qs', collection, q, options, callback);
};

Connection.prototype.hasPending = function() {
  return !!(
    this._firstDoc(hasPending) ||
    this._firstQuery(hasPending)
  );
};
function hasPending(object) {
  return object.hasPending();
}

Connection.prototype.hasWritePending = function() {
  return !!this._firstDoc(hasWritePending);
};
function hasWritePending(object) {
  return object.hasWritePending();
}

Connection.prototype.whenNothingPending = function(callback) {
  var doc = this._firstDoc(hasPending);
  if (doc) {
    // If a document is found with a pending operation, wait for it to emit
    // that nothing is pending anymore, and then recheck all documents again.
    // We have to recheck all documents, just in case another mutation has
    // been made in the meantime as a result of an event callback
    doc.once('nothing pending', this._nothingPendingRetry(callback));
    return;
  }
  var query = this._firstQuery(hasPending);
  if (query) {
    query.once('ready', this._nothingPendingRetry(callback));
    return;
  }
  // Call back when no pending operations
  process.nextTick(callback);
};
Connection.prototype._nothingPendingRetry = function(callback) {
  var connection = this;
  return function() {
    process.nextTick(function() {
      connection.whenNothingPending(callback);
    });
  };
};

Connection.prototype._firstDoc = function(fn) {
  for (var collection in this.collections) {
    var docs = this.collections[collection];
    for (var id in docs) {
      var doc = docs[id];
      if (fn(doc)) {
        return doc;
      }
    }
  }
};

Connection.prototype._firstQuery = function(fn) {
  for (var id in this.queries) {
    var query = this.queries[id];
    if (fn(query)) {
      return query;
    }
  }
};

}).call(this,require('_process'))

},{"../emitter":16,"../error":17,"../types":18,"../util":19,"./doc":13,"./query":15,"_process":10}],13:[function(require,module,exports){
(function (process){
var emitter = require('../emitter');
var ShareDBError = require('../error');
var types = require('../types');

/**
 * A Doc is a client's view on a sharejs document.
 *
 * It is is uniquely identified by its `id` and `collection`.  Documents
 * should not be created directly. Create them with connection.get()
 *
 *
 * Subscriptions
 * -------------
 *
 * We can subscribe a document to stay in sync with the server.
 *   doc.subscribe(function(error) {
 *     doc.subscribed // = true
 *   })
 * The server now sends us all changes concerning this document and these are
 * applied to our data. If the subscription was successful the initial
 * data and version sent by the server are loaded into the document.
 *
 * To stop listening to the changes we call `doc.unsubscribe()`.
 *
 * If we just want to load the data but not stay up-to-date, we call
 *   doc.fetch(function(error) {
 *     doc.data // sent by server
 *   })
 *
 *
 * Events
 * ------
 *
 * You can use doc.on(eventName, callback) to subscribe to the following events:
 * - `before op (op, source)` Fired before a partial operation is applied to the data.
 *   It may be used to read the old data just before applying an operation
 * - `op (op, source)` Fired after every partial operation with this operation as the
 *   first argument
 * - `create (source)` The document was created. That means its type was
 *   set and it has some initial data.
 * - `del (data, source)` Fired after the document is deleted, that is
 *   the data is null. It is passed the data before delteion as an
 *   arguments
 * - `load ()` Fired when a new snapshot is ingested from a fetch, subscribe, or query
 */

module.exports = Doc;
function Doc(connection, collection, id) {
  emitter.EventEmitter.call(this);

  this.connection = connection;

  this.collection = collection;
  this.id = id;

  this.version = null;
  this.type = null;
  this.data = undefined;

  // Array of callbacks or nulls as placeholders
  this.inflightFetch = [];
  this.inflightSubscribe = [];
  this.inflightUnsubscribe = [];
  this.pendingFetch = [];

  // Whether we think we are subscribed on the server. Synchronously set to
  // false on calls to unsubscribe and disconnect. Should never be true when
  // this.wantSubscribe is false
  this.subscribed = false;
  // Whether to re-establish the subscription on reconnect
  this.wantSubscribe = false;

  // The op that is currently roundtripping to the server, or null.
  //
  // When the connection reconnects, the inflight op is resubmitted.
  //
  // This has the same format as an entry in pendingOps
  this.inflightOp = null;

  // All ops that are waiting for the server to acknowledge this.inflightOp
  // This used to just be a single operation, but creates & deletes can't be
  // composed with regular operations.
  //
  // This is a list of {[create:{...}], [del:true], [op:...], callbacks:[...]}
  this.pendingOps = [];

  // The OT type of this document. An uncreated document has type `null`
  this.type = null;

  // The applyStack enables us to track any ops submitted while we are
  // applying an op incrementally. This value is an array when we are
  // performing an incremental apply and null otherwise. When it is an array,
  // all submitted ops should be pushed onto it. The `_otApply` method will
  // reset it back to null when all incremental apply loops are complete.
  this.applyStack = null;

  // Disable the default behavior of composing submitted ops. This is read at
  // the time of op submit, so it may be toggled on before submitting a
  // specifc op and toggled off afterward
  this.preventCompose = false;
}
emitter.mixin(Doc);

Doc.prototype.destroy = function(callback) {
  var doc = this;
  doc.whenNothingPending(function() {
    doc.connection._destroyDoc(doc);
    if (doc.wantSubscribe) {
      return doc.unsubscribe(callback);
    }
    if (callback) callback();
  });
};


// ****** Manipulating the document data, version and type.

// Set the document's type, and associated properties. Most of the logic in
// this function exists to update the document based on any added & removed API
// methods.
//
// @param newType OT type provided by the ottypes library or its name or uri
Doc.prototype._setType = function(newType) {
  if (typeof newType === 'string') {
    newType = types.map[newType];
  }

  if (newType) {
    this.type = newType;

  } else if (newType === null) {
    this.type = newType;
    // If we removed the type from the object, also remove its data
    this.data = undefined;

  } else {
    var err = new ShareDBError(4008, 'Missing type ' + newType);
    return this.emit('error', err);
  }
};

// Ingest snapshot data. This data must include a version, snapshot and type.
// This is used both to ingest data that was exported with a webpage and data
// that was received from the server during a fetch.
//
// @param snapshot.v    version
// @param snapshot.data
// @param snapshot.type
// @param callback
Doc.prototype.ingestSnapshot = function(snapshot, callback) {
  if (!snapshot) return callback && callback();

  if (typeof snapshot.v !== 'number') {
    var err = new ShareDBError(5008, 'Missing version in ingested snapshot. ' + this.collection + '.' + this.id);
    if (callback) return callback(err);
    return this.emit('error', err);
  }

  // If the doc is already created or there are ops pending, we cannot use the
  // ingested snapshot and need ops in order to update the document
  if (this.type || this.hasWritePending()) {
    // The version should only be null on a created document when it was
    // created locally without fetching
    if (this.version == null) {
      if (this.hasWritePending()) {
        // If we have pending ops and we get a snapshot for a locally created
        // document, we have to wait for the pending ops to complete, because
        // we don't know what version to fetch ops from. It is possible that
        // the snapshot came from our local op, but it is also possible that
        // the doc was created remotely (which would conflict and be an error)
        return callback && this.once('no write pending', callback);
      }
      // Otherwise, we've encounted an error state
      var err = new ShareDBError(5009, 'Cannot ingest snapshot in doc with null version. ' + this.collection + '.' + this.id);
      if (callback) return callback(err);
      return this.emit('error', err);
    }
    // If we got a snapshot for a version further along than the document is
    // currently, issue a fetch to get the latest ops and catch us up
    if (snapshot.v > this.version) return this.fetch(callback);
    return callback && callback();
  }

  // Ignore the snapshot if we are already at a newer version. Under no
  // circumstance should we ever set the current version backward
  if (this.version > snapshot.v) return callback && callback();

  this.version = snapshot.v;
  var type = (snapshot.type === undefined) ? types.defaultType : snapshot.type;
  this._setType(type);
  this.data = (this.type && this.type.deserialize) ?
    this.type.deserialize(snapshot.data) :
    snapshot.data;
  this.emit('load');
  callback && callback();
};

Doc.prototype.whenNothingPending = function(callback) {
  if (this.hasPending()) {
    this.once('nothing pending', callback);
    return;
  }
  callback();
};

Doc.prototype.hasPending = function() {
  return !!(
    this.inflightOp ||
    this.pendingOps.length ||
    this.inflightFetch.length ||
    this.inflightSubscribe.length ||
    this.inflightUnsubscribe.length ||
    this.pendingFetch.length
  );
};

Doc.prototype.hasWritePending = function() {
  return !!(this.inflightOp || this.pendingOps.length);
};

Doc.prototype._emitNothingPending = function() {
  if (this.hasWritePending()) return;
  this.emit('no write pending');
  if (this.hasPending()) return;
  this.emit('nothing pending');
};

// **** Helpers for network messages

Doc.prototype._emitResponseError = function(err, callback) {
  if (callback) {
    callback(err);
    this._emitNothingPending();
    return;
  }
  this._emitNothingPending();
  this.emit('error', err);
};

Doc.prototype._handleFetch = function(err, snapshot) {
  var callback = this.inflightFetch.shift();
  if (err) return this._emitResponseError(err, callback);
  this.ingestSnapshot(snapshot, callback);
  this._emitNothingPending();
};

Doc.prototype._handleSubscribe = function(err, snapshot) {
  var callback = this.inflightSubscribe.shift();
  if (err) return this._emitResponseError(err, callback);
  // Indicate we are subscribed only if the client still wants to be. In the
  // time since calling subscribe and receiving a response from the server,
  // unsubscribe could have been called and we might already be unsubscribed
  // but not have received the response. Also, because requests from the
  // client are not serialized and may take different async time to process,
  // it is possible that we could hear responses back in a different order
  // from the order originally sent
  if (this.wantSubscribe) this.subscribed = true;
  this.ingestSnapshot(snapshot, callback);
  this._emitNothingPending();
};

Doc.prototype._handleUnsubscribe = function(err) {
  var callback = this.inflightUnsubscribe.shift();
  if (err) return this._emitResponseError(err, callback);
  if (callback) callback();
  this._emitNothingPending();
};

Doc.prototype._handleOp = function(err, message) {
  if (err) {
    if (this.inflightOp) {
      // The server has rejected submission of the current operation. If we get
      // an error code 4002 "Op submit rejected", this was done intentionally
      // and we should roll back but not return an error to the user.
      if (err.code === 4002) err = null;
      return this._rollback(err);
    }
    return this.emit('error', err);
  }

  if (this.inflightOp &&
      message.src === this.inflightOp.src &&
      message.seq === this.inflightOp.seq) {
    // The op has already been applied locally. Just update the version
    // and pending state appropriately
    this._opAcknowledged(message);
    return;
  }

  if (this.version == null || message.v > this.version) {
    // This will happen in normal operation if we become subscribed to a
    // new document via a query. It can also happen if we get an op for
    // a future version beyond the version we are expecting next. This
    // could happen if the server doesn't publish an op for whatever reason
    // or because of a race condition. In any case, we can send a fetch
    // command to catch back up.
    //
    // Fetch only sends a new fetch command if no fetches are inflight, which
    // will act as a natural debouncing so we don't send multiple fetch
    // requests for many ops received at once.
    this.fetch();
    return;
  }

  if (message.v < this.version) {
    // We can safely ignore the old (duplicate) operation.
    return;
  }

  if (this.inflightOp) {
    var transformErr = transformX(this.inflightOp, message);
    if (transformErr) return this._hardRollback(transformErr);
  }

  for (var i = 0; i < this.pendingOps.length; i++) {
    var transformErr = transformX(this.pendingOps[i], message);
    if (transformErr) return this._hardRollback(transformErr);
  }

  this.version++;
  this._otApply(message, false);
  return;
};

// Called whenever (you guessed it!) the connection state changes. This will
// happen when we get disconnected & reconnect.
Doc.prototype._onConnectionStateChanged = function() {
  if (this.connection.canSend) {
    this.flush();
    this._resubscribe();
  } else {
    if (this.inflightOp) {
      this.pendingOps.unshift(this.inflightOp);
      this.inflightOp = null;
    }
    this.subscribed = false;
    if (this.inflightFetch.length || this.inflightSubscribe.length) {
      this.pendingFetch = this.pendingFetch.concat(this.inflightFetch, this.inflightSubscribe);
      this.inflightFetch.length = 0;
      this.inflightSubscribe.length = 0;
    }
    if (this.inflightUnsubscribe.length) {
      var callbacks = this.inflightUnsubscribe;
      this.inflightUnsubscribe = [];
      callEach(callbacks);
    }
  }
};

Doc.prototype._resubscribe = function() {
  var callbacks = this.pendingFetch;
  this.pendingFetch = [];

  if (this.wantSubscribe) {
    if (callbacks.length) {
      this.subscribe(function(err) {
        callEach(callbacks, err);
      });
      return;
    }
    this.subscribe();
    return;
  }

  if (callbacks.length) {
    this.fetch(function(err) {
      callEach(callbacks, err);
    });
  }
};

// Request the current document snapshot or ops that bring us up to date
Doc.prototype.fetch = function(callback) {
  if (this.connection.canSend) {
    var isDuplicate = this.connection.sendFetch(this);
    pushActionCallback(this.inflightFetch, isDuplicate, callback);
    return;
  }
  this.pendingFetch.push(callback);
};

// Fetch the initial document and keep receiving updates
Doc.prototype.subscribe = function(callback) {
  this.wantSubscribe = true;
  if (this.connection.canSend) {
    var isDuplicate = this.connection.sendSubscribe(this);
    pushActionCallback(this.inflightSubscribe, isDuplicate, callback);
    return;
  }
  this.pendingFetch.push(callback);
};

// Unsubscribe. The data will stay around in local memory, but we'll stop
// receiving updates
Doc.prototype.unsubscribe = function(callback) {
  this.wantSubscribe = false;
  // The subscribed state should be conservative in indicating when we are
  // subscribed on the server. We'll actually be unsubscribed some time
  // between sending the message and hearing back, but we cannot know exactly
  // when. Thus, immediately mark us as not subscribed
  this.subscribed = false;
  if (this.connection.canSend) {
    var isDuplicate = this.connection.sendUnsubscribe(this);
    pushActionCallback(this.inflightUnsubscribe, isDuplicate, callback);
    return;
  }
  if (callback) process.nextTick(callback);
};

function pushActionCallback(inflight, isDuplicate, callback) {
  if (isDuplicate) {
    var lastCallback = inflight.pop();
    inflight.push(function(err) {
      lastCallback && lastCallback(err);
      callback && callback(err);
    });
  } else {
    inflight.push(callback);
  }
}


// Operations //

// Send the next pending op to the server, if we can.
//
// Only one operation can be in-flight at a time. If an operation is already on
// its way, or we're not currently connected, this method does nothing.
Doc.prototype.flush = function() {
  // Ignore if we can't send or we are already sending an op
  if (!this.connection.canSend || this.inflightOp) return;

  // Send first pending op unless paused
  if (!this.paused && this.pendingOps.length) {
    this._sendOp();
  }
};

// Helper function to set op to contain a no-op.
function setNoOp(op) {
  delete op.op;
  delete op.create;
  delete op.del;
}

// Transform server op data by a client op, and vice versa. Ops are edited in place.
function transformX(client, server) {
  // Order of statements in this function matters. Be especially careful if
  // refactoring this function

  // A client delete op should dominate if both the server and the client
  // delete the document. Thus, any ops following the client delete (such as a
  // subsequent create) will be maintained, since the server op is transformed
  // to a no-op
  if (client.del) return setNoOp(server);

  if (server.del) {
    return new ShareDBError(4017, 'Document was deleted');
  }
  if (server.create) {
    return new ShareDBError(4018, 'Document alredy created');
  }

  // Ignore no-op coming from server
  if (!server.op) return;

  // I believe that this should not occur, but check just in case
  if (client.create) {
    return new ShareDBError(4018, 'Document already created');
  }

  // They both edited the document. This is the normal case for this function -
  // as in, most of the time we'll end up down here.
  //
  // You should be wondering why I'm using client.type instead of this.type.
  // The reason is, if we get ops at an old version of the document, this.type
  // might be undefined or a totally different type. By pinning the type to the
  // op data, we make sure the right type has its transform function called.
  if (client.type.transformX) {
    var result = client.type.transformX(client.op, server.op);
    client.op = result[0];
    server.op = result[1];
  } else {
    var clientOp = client.type.transform(client.op, server.op, 'left');
    var serverOp = client.type.transform(server.op, client.op, 'right');
    client.op = clientOp;
    server.op = serverOp;
  }
};

/**
 * Applies the operation to the snapshot
 *
 * If the operation is create or delete it emits `create` or `del`. Then the
 * operation is applied to the snapshot and `op` and `after op` are emitted.
 * If the type supports incremental updates and `this.incremental` is true we
 * fire `op` after every small operation.
 *
 * This is the only function to fire the above mentioned events.
 *
 * @private
 */
Doc.prototype._otApply = function(op, source) {
  if (op.op) {
    if (!this.type) {
      var err = new ShareDBError(4015, 'Cannot apply op to uncreated document. ' + this.collection + '.' + this.id);
      return this.emit('error', err);
    }

    // Iteratively apply multi-component remote operations and rollback ops
    // (source === false) for the default JSON0 OT type. It could use
    // type.shatter(), but since this code is so specific to use cases for the
    // JSON0 type and ShareDB explicitly bundles the default type, we might as
    // well write it this way and save needing to iterate through the op
    // components twice.
    //
    // Ideally, we would not need this extra complexity. However, it is
    // helpful for implementing bindings that update DOM nodes and other
    // stateful objects by translating op events directly into corresponding
    // mutations. Such bindings are most easily written as responding to
    // individual op components one at a time in order, and it is important
    // that the snapshot only include updates from the particular op component
    // at the time of emission. Eliminating this would require rethinking how
    // such external bindings are implemented.
    if (!source && this.type === types.defaultType && op.op.length > 1) {
      if (!this.applyStack) this.applyStack = [];
      var stackLength = this.applyStack.length;
      for (var i = 0; i < op.op.length; i++) {
        var component = op.op[i];
        var componentOp = {op: [component]};
        // Transform componentOp against any ops that have been submitted
        // sychronously inside of an op event handler since we began apply of
        // our operation
        for (var j = stackLength; j < this.applyStack.length; j++) {
          var transformErr = transformX(this.applyStack[j], componentOp);
          if (transformErr) return this._hardRollback(transformErr);
        }
        // Apply the individual op component
        this.emit('before op', componentOp.op, source);
        this.data = this.type.apply(this.data, componentOp.op);
        this.emit('op', componentOp.op, source);
      }
      // Pop whatever was submitted since we started applying this op
      this._popApplyStack(stackLength);
      return;
    }

    // The 'before op' event enables clients to pull any necessary data out of
    // the snapshot before it gets changed
    this.emit('before op', op.op, source);
    // Apply the operation to the local data, mutating it in place
    this.data = this.type.apply(this.data, op.op);
    // Emit an 'op' event once the local data includes the changes from the
    // op. For locally submitted ops, this will be synchronously with
    // submission and before the server or other clients have received the op.
    // For ops from other clients, this will be after the op has been
    // committed to the database and published
    this.emit('op', op.op, source);
    return;
  }

  if (op.create) {
    this._setType(op.create.type);
    this.data = (this.type.deserialize) ?
      (this.type.createDeserialized) ?
        this.type.createDeserialized(op.create.data) :
        this.type.deserialize(this.type.create(op.create.data)) :
      this.type.create(op.create.data);
    this.emit('create', source);
    return;
  }

  if (op.del) {
    var oldData = this.data;
    this._setType(null);
    this.emit('del', oldData, source);
    return;
  }
};


// ***** Sending operations

// Actually send op to the server.
Doc.prototype._sendOp = function() {
  // Wait until we have a src id from the server
  var src = this.connection.id;
  if (!src) return;

  // When there is no inflightOp, send the first item in pendingOps. If
  // there is inflightOp, try sending it again
  if (!this.inflightOp) {
    // Send first pending op
    this.inflightOp = this.pendingOps.shift();
  }
  var op = this.inflightOp;
  if (!op) {
    var err = new ShareDBError(5010, 'No op to send on call to _sendOp');
    return this.emit('error', err);
  }

  // Track data for retrying ops
  op.sentAt = Date.now();
  op.retries = (op.retries == null) ? 0 : op.retries + 1;

  // The src + seq number is a unique ID representing this operation. This tuple
  // is used on the server to detect when ops have been sent multiple times and
  // on the client to match acknowledgement of an op back to the inflightOp.
  // Note that the src could be different from this.connection.id after a
  // reconnect, since an op may still be pending after the reconnection and
  // this.connection.id will change. In case an op is sent multiple times, we
  // also need to be careful not to override the original seq value.
  if (op.seq == null) op.seq = this.connection.seq++;

  this.connection.sendOp(this, op);

  // src isn't needed on the first try, since the server session will have the
  // same id, but it must be set on the inflightOp in case it is sent again
  // after a reconnect and the connection's id has changed by then
  if (op.src == null) op.src = src;
};


// Queues the operation for submission to the server and applies it locally.
//
// Internal method called to do the actual work for submit(), create() and del().
// @private
//
// @param op
// @param [op.op]
// @param [op.del]
// @param [op.create]
// @param [callback] called when operation is submitted
Doc.prototype._submit = function(op, source, callback) {
  // Locally submitted ops must always have a truthy source
  if (!source) source = true;

  // The op contains either op, create, delete, or none of the above (a no-op).
  if (op.op) {
    if (!this.type) {
      var err = new ShareDBError(4015, 'Cannot submit op. Document has not been created. ' + this.collection + '.' + this.id);
      if (callback) return callback(err);
      return this.emit('error', err);
    }
    // Try to normalize the op. This removes trailing skip:0's and things like that.
    if (this.type.normalize) op.op = this.type.normalize(op.op);
  }

  this._pushOp(op, callback);
  this._otApply(op, source);

  // The call to flush is delayed so if submit() is called multiple times
  // synchronously, all the ops are combined before being sent to the server.
  var doc = this;
  process.nextTick(function() {
    doc.flush();
  });
};

Doc.prototype._pushOp = function(op, callback) {
  if (this.applyStack) {
    // If we are in the process of incrementally applying an operation, don't
    // compose the op and push it onto the applyStack so it can be transformed
    // against other components from the op or ops being applied
    this.applyStack.push(op);
  } else {
    // If the type supports composes, try to compose the operation onto the
    // end of the last pending operation.
    var composed = this._tryCompose(op);
    if (composed) {
      composed.callbacks.push(callback);
      return;
    }
  }
  // Push on to the pendingOps queue of ops to submit if we didn't compose
  op.type = this.type;
  op.callbacks = [callback];
  this.pendingOps.push(op);
};

Doc.prototype._popApplyStack = function(to) {
  if (to > 0) {
    this.applyStack.length = to;
    return;
  }
  // Once we have completed the outermost apply loop, reset to null and no
  // longer add ops to the applyStack as they are submitted
  var op = this.applyStack[0];
  this.applyStack = null;
  if (!op) return;
  // Compose the ops added since the beginning of the apply stack, since we
  // had to skip compose when they were originally pushed
  var i = this.pendingOps.indexOf(op);
  if (i === -1) return;
  var ops = this.pendingOps.splice(i);
  for (var i = 0; i < ops.length; i++) {
    var op = ops[i];
    var composed = this._tryCompose(op);
    if (composed) {
      composed.callbacks = composed.callbacks.concat(op.callbacks);
    } else {
      this.pendingOps.push(op);
    }
  }
};

// Try to compose a submitted op into the last pending op. Returns the
// composed op if it succeeds, undefined otherwise
Doc.prototype._tryCompose = function(op) {
  if (this.preventCompose) return;

  // We can only compose into the last pending op. Inflight ops have already
  // been sent to the server, so we can't modify them
  var last = this.pendingOps[this.pendingOps.length - 1];
  if (!last) return;

  // Compose an op into a create by applying it. This effectively makes the op
  // invisible, as if the document were created including the op originally
  if (last.create && op.op) {
    last.create.data = this.type.apply(last.create.data, op.op);
    return last;
  }

  // Compose two ops into a single op if supported by the type. Types that
  // support compose must be able to compose any two ops together
  if (last.op && op.op && this.type.compose) {
    last.op = this.type.compose(last.op, op.op);
    return last;
  }
};

// *** Client OT entrypoints.

// Submit an operation to the document.
//
// @param operation handled by the OT type
// @param options  {source: ...}
// @param [callback] called after operation submitted
//
// @fires before op, op, after op
Doc.prototype.submitOp = function(component, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = null;
  }
  var op = {op: component};
  var source = options && options.source;
  this._submit(op, source, callback);
};

// Create the document, which in ShareJS semantics means to set its type. Every
// object implicitly exists in the database but has no data and no type. Create
// sets the type of the object and can optionally set some initial data on the
// object, depending on the type.
//
// @param data  initial
// @param type  OT type
// @param options  {source: ...}
// @param callback  called when operation submitted
Doc.prototype.create = function(data, type, options, callback) {
  if (typeof type === 'function') {
    callback = type;
    options = null;
    type = null;
  } else if (typeof options === 'function') {
    callback = options;
    options = null;
  }
  if (!type) {
    type = types.defaultType.uri;
  }
  if (this.type) {
    var err = new ShareDBError(4016, 'Document already exists');
    if (callback) return callback(err);
    return this.emit('error', err);
  }
  var op = {create: {type: type, data: data}};
  var source = options && options.source;
  this._submit(op, source, callback);
};

// Delete the document. This creates and submits a delete operation to the
// server. Deleting resets the object's type to null and deletes its data. The
// document still exists, and still has the version it used to have before you
// deleted it (well, old version +1).
//
// @param options  {source: ...}
// @param callback  called when operation submitted
Doc.prototype.del = function(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = null;
  }
  if (!this.type) {
    var err = new ShareDBError(4015, 'Document does not exist');
    if (callback) return callback(err);
    return this.emit('error', err);
  }
  var op = {del: true};
  var source = options && options.source;
  this._submit(op, source, callback);
};


// Stops the document from sending any operations to the server.
Doc.prototype.pause = function() {
  this.paused = true;
};

// Continue sending operations to the server
Doc.prototype.resume = function() {
  this.paused = false;
  this.flush();
};


// *** Receiving operations

// This is called when the server acknowledges an operation from the client.
Doc.prototype._opAcknowledged = function(message) {
  if (this.inflightOp.create) {
    this.version = message.v;

  } else if (message.v !== this.version) {
    // We should already be at the same version, because the server should
    // have sent all the ops that have happened before acknowledging our op
    console.warn('Invalid version from server. Expected: ' + this.version + ' Received: ' + message.v, message);

    // Fetching should get us back to a working document state
    return this.fetch();
  }

  // The op was committed successfully. Increment the version number
  this.version++;

  this._clearInflightOp();
};

Doc.prototype._rollback = function(err) {
  // The server has rejected submission of the current operation. Invert by
  // just the inflight op if possible. If not possible to invert, cancel all
  // pending ops and fetch the latest from the server to get us back into a
  // working state, then call back
  var op = this.inflightOp;

  if (op.op && op.type.invert) {
    op.op = op.type.invert(op.op);

    // Transform the undo operation by any pending ops.
    for (var i = 0; i < this.pendingOps.length; i++) {
      var transformErr = transformX(this.pendingOps[i], op);
      if (transformErr) return this._hardRollback(transformErr);
    }

    // ... and apply it locally, reverting the changes.
    //
    // This operation is applied to look like it comes from a remote source.
    // I'm still not 100% sure about this functionality, because its really a
    // local op. Basically, the problem is that if the client's op is rejected
    // by the server, the editor window should update to reflect the undo.
    this._otApply(op, false);

    this._clearInflightOp(err);
    return;
  }

  this._hardRollback(err);
};

Doc.prototype._hardRollback = function(err) {
  // Cancel all pending ops and reset if we can't invert
  var op = this.inflightOp;
  var pending = this.pendingOps;
  this._setType(null);
  this.version = null;
  this.inflightOp = null;
  this.pendingOps = [];

  // Fetch the latest from the server to get us back into a working state
  var doc = this;
  this.fetch(function() {
    var called = op && callEach(op.callbacks, err);
    for (var i = 0; i < pending.length; i++) {
      callEach(pending[i].callbacks, err);
    }
    if (err && !called) return doc.emit('error', err);
  });
};

Doc.prototype._clearInflightOp = function(err) {
  var called = callEach(this.inflightOp.callbacks, err);

  this.inflightOp = null;
  this.flush();
  this._emitNothingPending();

  if (err && !called) return this.emit('error', err);
};

function callEach(callbacks, err) {
  var called = false;
  for (var i = 0; i < callbacks.length; i++) {
    var callback = callbacks[i];
    if (callback) {
      callback(err);
      called = true;
    }
  }
  return called;
}

}).call(this,require('_process'))

},{"../emitter":16,"../error":17,"../types":18,"_process":10}],14:[function(require,module,exports){
exports.Connection = require('./connection');
exports.Doc = require('./doc');
exports.Error = require('../error');
exports.Query = require('./query');
exports.types = require('../types');

},{"../error":17,"../types":18,"./connection":12,"./doc":13,"./query":15}],15:[function(require,module,exports){
(function (process){
var emitter = require('../emitter');

// Queries are live requests to the database for particular sets of fields.
//
// The server actively tells the client when there's new data that matches
// a set of conditions.
module.exports = Query;
function Query(action, connection, id, collection, query, options, callback) {
  emitter.EventEmitter.call(this);

  // 'qf' or 'qs'
  this.action = action;

  this.connection = connection;
  this.id = id;
  this.collection = collection;

  // The query itself. For mongo, this should look something like {"data.x":5}
  this.query = query;

  // A list of resulting documents. These are actual documents, complete with
  // data and all the rest. It is possible to pass in an initial results set,
  // so that a query can be serialized and then re-established
  this.results = null;
  if (options && options.results) {
    this.results = options.results;
    delete options.results;
  }
  this.extra = undefined;

  // Options to pass through with the query
  this.options = options;

  this.callback = callback;
  this.ready = false;
  this.sent = false;
}
emitter.mixin(Query);

Query.prototype.hasPending = function() {
  return !this.ready;
};

// Helper for subscribe & fetch, since they share the same message format.
//
// This function actually issues the query.
Query.prototype.send = function() {
  if (!this.connection.canSend) return;

  var message = {
    a: this.action,
    id: this.id,
    c: this.collection,
    q: this.query
  };
  if (this.options) {
    message.o = this.options;
  }
  if (this.results) {
    // Collect the version of all the documents in the current result set so we
    // don't need to be sent their snapshots again.
    var results = [];
    for (var i = 0; i < this.results.length; i++) {
      var doc = this.results[i];
      results.push([doc.id, doc.version]);
    }
    message.r = results;
  }

  this.connection.send(message);
  this.sent = true;
};

// Destroy the query object. Any subsequent messages for the query will be
// ignored by the connection.
Query.prototype.destroy = function(callback) {
  if (this.connection.canSend && this.action === 'qs') {
    this.connection.send({a: 'qu', id: this.id});
  }
  this.connection._destroyQuery(this);
  // There is a callback for consistency, but we don't actually wait for the
  // server's unsubscribe message currently
  if (callback) process.nextTick(callback);
};

Query.prototype._onConnectionStateChanged = function() {
  if (this.connection.canSend && !this.sent) {
    this.send();
  } else {
    this.sent = false;
  }
};

Query.prototype._handleFetch = function(err, data, extra) {
  // Once a fetch query gets its data, it is destroyed.
  this.connection._destroyQuery(this);
  this._handleResponse(err, data, extra);
};

Query.prototype._handleSubscribe = function(err, data, extra) {
  this._handleResponse(err, data, extra);
};

Query.prototype._handleResponse = function(err, data, extra) {
  var callback = this.callback;
  this.callback = null;
  if (err) return this._finishResponse(err, callback);
  if (!data) return this._finishResponse(null, callback);

  var query = this;
  var wait = 1;
  var finish = function(err) {
    if (err) return query._finishResponse(err, callback);
    if (--wait) return;
    query._finishResponse(null, callback);
  };

  if (Array.isArray(data)) {
    wait += data.length;
    this.results = this._ingestSnapshots(data, finish);
    this.extra = extra;

  } else {
    for (var id in data) {
      wait++;
      var snapshot = data[id];
      var doc = this.connection.get(snapshot.c || this.collection, id);
      doc.ingestSnapshot(snapshot, finish);
    }
  }

  finish();
};

Query.prototype._ingestSnapshots = function(snapshots, finish) {
  var results = [];
  for (var i = 0; i < snapshots.length; i++) {
    var snapshot = snapshots[i];
    var doc = this.connection.get(snapshot.c || this.collection, snapshot.d);
    doc.ingestSnapshot(snapshot, finish);
    results.push(doc);
  }
  return results;
};

Query.prototype._finishResponse = function(err, callback) {
  this.emit('ready');
  this.ready = true;
  if (err) {
    this.connection._destroyQuery(this);
    if (callback) return callback(err);
    return this.emit('error', err);
  }
  if (callback) callback(null, this.results, this.extra);
};

Query.prototype._handleError = function(err) {
  this.emit('error', err);
};

Query.prototype._handleDiff = function(diff) {
  // We need to go through the list twice. First, we'll ingest all the new
  // documents. After that we'll emit events and actually update our list.
  // This avoids race conditions around setting documents to be subscribed &
  // unsubscribing documents in event callbacks.
  for (var i = 0; i < diff.length; i++) {
    var d = diff[i];
    if (d.type === 'insert') d.values = this._ingestSnapshots(d.values);
  }

  for (var i = 0; i < diff.length; i++) {
    var d = diff[i];
    switch (d.type) {
      case 'insert':
        var newDocs = d.values;
        Array.prototype.splice.apply(this.results, [d.index, 0].concat(newDocs));
        this.emit('insert', newDocs, d.index);
        break;
      case 'remove':
        var howMany = d.howMany || 1;
        var removed = this.results.splice(d.index, howMany);
        this.emit('remove', removed, d.index);
        break;
      case 'move':
        var howMany = d.howMany || 1;
        var docs = this.results.splice(d.from, howMany);
        Array.prototype.splice.apply(this.results, [d.to, 0].concat(docs));
        this.emit('move', docs, d.from, d.to);
        break;
    }
  }

  this.emit('changed', this.results);
};

Query.prototype._handleExtra = function(extra) {
  this.extra = extra;
  this.emit('extra', extra);
};

}).call(this,require('_process'))

},{"../emitter":16,"_process":10}],16:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter;

exports.EventEmitter = EventEmitter;
exports.mixin = mixin;

function mixin(Constructor) {
  for (var key in EventEmitter.prototype) {
    Constructor.prototype[key] = EventEmitter.prototype[key];
  }
}

},{"events":1}],17:[function(require,module,exports){
var makeError = require('make-error');

function ShareDBError(code, message) {
  ShareDBError.super.call(this, message);
  this.code = code;
}

makeError(ShareDBError);

module.exports = ShareDBError;

},{"make-error":2}],18:[function(require,module,exports){

exports.defaultType = require('ot-json0').type;

exports.map = {};

exports.register = function(type) {
  if (type.name) exports.map[type.name] = type;
  if (type.uri) exports.map[type.uri] = type;
};

exports.register(exports.defaultType);

},{"ot-json0":4}],19:[function(require,module,exports){

exports.doNothing = doNothing;
function doNothing() {}

exports.hasKeys = function(object) {
  for (var key in object) return true;
  return false;
};

},{}]},{},[11])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9tYWtlLWVycm9yL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL290LWpzb24wL2xpYi9ib290c3RyYXBUcmFuc2Zvcm0uanMiLCJub2RlX21vZHVsZXMvb3QtanNvbjAvbGliL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL290LWpzb24wL2xpYi9qc29uMC5qcyIsIm5vZGVfbW9kdWxlcy9vdC1qc29uMC9saWIvdGV4dDAuanMiLCJub2RlX21vZHVsZXMvb3QtdGV4dC9saWIvYXBpLmpzIiwibm9kZV9tb2R1bGVzL290LXRleHQvbGliL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL290LXRleHQvbGliL3RleHQuanMiLCJub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwic3JjL2NsaWVudC9pbmRleC5qcyIsInNyYy9zZXJ2ZXIvdmVuZG9yL3NoYXJlZGIvbGliL2NsaWVudC9jb25uZWN0aW9uLmpzIiwic3JjL3NlcnZlci92ZW5kb3Ivc2hhcmVkYi9saWIvY2xpZW50L2RvYy5qcyIsInNyYy9zZXJ2ZXIvdmVuZG9yL3NoYXJlZGIvbGliL2NsaWVudC9pbmRleC5qcyIsInNyYy9zZXJ2ZXIvdmVuZG9yL3NoYXJlZGIvbGliL2NsaWVudC9xdWVyeS5qcyIsInNyYy9zZXJ2ZXIvdmVuZG9yL3NoYXJlZGIvbGliL2VtaXR0ZXIuanMiLCJzcmMvc2VydmVyL3ZlbmRvci9zaGFyZWRiL2xpYi9lcnJvci5qcyIsInNyYy9zZXJ2ZXIvdmVuZG9yL3NoYXJlZGIvbGliL3R5cGVzLmpzIiwic3JjL3NlcnZlci92ZW5kb3Ivc2hhcmVkYi9saWIvdXRpbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqYUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3BMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNua0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM5NEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3ZNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQXQgbGVhc3QgZ2l2ZSBzb21lIGtpbmQgb2YgY29udGV4dCB0byB0aGUgdXNlclxuICAgICAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LiAoJyArIGVyICsgJyknKTtcbiAgICAgICAgZXJyLmNvbnRleHQgPSBlcjtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2UgaWYgKGxpc3RlbmVycykge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKHRoaXMuX2V2ZW50cykge1xuICAgIHZhciBldmxpc3RlbmVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpXG4gICAgICByZXR1cm4gMTtcbiAgICBlbHNlIGlmIChldmxpc3RlbmVyKVxuICAgICAgcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RoO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSk7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIvLyBJU0MgQCBKdWxpZW4gRm9udGFuZXRcblxuJ3VzZSBzdHJpY3QnXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxudmFyIGRlZmluZVByb3BlcnR5ID0gT2JqZWN0LmRlZmluZVByb3BlcnR5XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxudmFyIGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2VcbmlmICghY2FwdHVyZVN0YWNrVHJhY2UpIHtcbiAgY2FwdHVyZVN0YWNrVHJhY2UgPSBmdW5jdGlvbiBjYXB0dXJlU3RhY2tUcmFjZSAoZXJyb3IpIHtcbiAgICB2YXIgY29udGFpbmVyID0gbmV3IEVycm9yKClcblxuICAgIGRlZmluZVByb3BlcnR5KGVycm9yLCAnc3RhY2snLCB7XG4gICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICBnZXQ6IGZ1bmN0aW9uIGdldFN0YWNrICgpIHtcbiAgICAgICAgdmFyIHN0YWNrID0gY29udGFpbmVyLnN0YWNrXG5cbiAgICAgICAgLy8gUmVwbGFjZSBwcm9wZXJ0eSB3aXRoIHZhbHVlIGZvciBmYXN0ZXIgZnV0dXJlIGFjY2Vzc2VzLlxuICAgICAgICBkZWZpbmVQcm9wZXJ0eSh0aGlzLCAnc3RhY2snLCB7XG4gICAgICAgICAgdmFsdWU6IHN0YWNrXG4gICAgICAgIH0pXG5cbiAgICAgICAgcmV0dXJuIHN0YWNrXG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbiBzZXRTdGFjayAoc3RhY2spIHtcbiAgICAgICAgZGVmaW5lUHJvcGVydHkoZXJyb3IsICdzdGFjaycsIHtcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgdmFsdWU6IHN0YWNrLFxuICAgICAgICAgIHdyaXRhYmxlOiB0cnVlXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfSlcbiAgfVxufVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmZ1bmN0aW9uIEJhc2VFcnJvciAobWVzc2FnZSkge1xuICBpZiAobWVzc2FnZSkge1xuICAgIGRlZmluZVByb3BlcnR5KHRoaXMsICdtZXNzYWdlJywge1xuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgdmFsdWU6IG1lc3NhZ2UsXG4gICAgICB3cml0YWJsZTogdHJ1ZVxuICAgIH0pXG4gIH1cblxuICB2YXIgY25hbWUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWVcbiAgaWYgKFxuICAgIGNuYW1lICYmXG4gICAgY25hbWUgIT09IHRoaXMubmFtZVxuICApIHtcbiAgICBkZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbmFtZScsIHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIHZhbHVlOiBjbmFtZSxcbiAgICAgIHdyaXRhYmxlOiB0cnVlXG4gICAgfSlcbiAgfVxuXG4gIGNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIHRoaXMuY29uc3RydWN0b3IpXG59XG5cbkJhc2VFcnJvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVycm9yLnByb3RvdHlwZSwge1xuICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9Kc0NvbW11bml0eS9tYWtlLWVycm9yL2lzc3Vlcy80XG4gIGNvbnN0cnVjdG9yOiB7XG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHZhbHVlOiBCYXNlRXJyb3IsXG4gICAgd3JpdGFibGU6IHRydWVcbiAgfVxufSlcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vLyBTZXRzIHRoZSBuYW1lIG9mIGEgZnVuY3Rpb24gaWYgcG9zc2libGUgKGRlcGVuZHMgb2YgdGhlIEpTIGVuZ2luZSkuXG52YXIgc2V0RnVuY3Rpb25OYW1lID0gKGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gc2V0RnVuY3Rpb25OYW1lIChmbiwgbmFtZSkge1xuICAgIHJldHVybiBkZWZpbmVQcm9wZXJ0eShmbiwgJ25hbWUnLCB7XG4gICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICB2YWx1ZTogbmFtZVxuICAgIH0pXG4gIH1cbiAgdHJ5IHtcbiAgICB2YXIgZiA9IGZ1bmN0aW9uICgpIHt9XG4gICAgc2V0RnVuY3Rpb25OYW1lKGYsICdmb28nKVxuICAgIGlmIChmLm5hbWUgPT09ICdmb28nKSB7XG4gICAgICByZXR1cm4gc2V0RnVuY3Rpb25OYW1lXG4gICAgfVxuICB9IGNhdGNoIChfKSB7fVxufSkoKVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmZ1bmN0aW9uIG1ha2VFcnJvciAoY29uc3RydWN0b3IsIHN1cGVyXykge1xuICBpZiAoc3VwZXJfID09IG51bGwgfHwgc3VwZXJfID09PSBFcnJvcikge1xuICAgIHN1cGVyXyA9IEJhc2VFcnJvclxuICB9IGVsc2UgaWYgKHR5cGVvZiBzdXBlcl8gIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdzdXBlcl8gc2hvdWxkIGJlIGEgZnVuY3Rpb24nKVxuICB9XG5cbiAgdmFyIG5hbWVcbiAgaWYgKHR5cGVvZiBjb25zdHJ1Y3RvciA9PT0gJ3N0cmluZycpIHtcbiAgICBuYW1lID0gY29uc3RydWN0b3JcbiAgICBjb25zdHJ1Y3RvciA9IGZ1bmN0aW9uICgpIHsgc3VwZXJfLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykgfVxuXG4gICAgLy8gSWYgdGhlIG5hbWUgY2FuIGJlIHNldCwgZG8gaXQgb25jZSBhbmQgZm9yIGFsbC5cbiAgICBpZiAoc2V0RnVuY3Rpb25OYW1lKSB7XG4gICAgICBzZXRGdW5jdGlvbk5hbWUoY29uc3RydWN0b3IsIG5hbWUpXG4gICAgICBuYW1lID0gbnVsbFxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlb2YgY29uc3RydWN0b3IgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdjb25zdHJ1Y3RvciBzaG91bGQgYmUgZWl0aGVyIGEgc3RyaW5nIG9yIGEgZnVuY3Rpb24nKVxuICB9XG5cbiAgLy8gQWxzbyByZWdpc3RlciB0aGUgc3VwZXIgY29uc3RydWN0b3IgYWxzbyBhcyBgY29uc3RydWN0b3Iuc3VwZXJfYCBqdXN0XG4gIC8vIGxpa2UgTm9kZSdzIGB1dGlsLmluaGVyaXRzKClgLlxuICBjb25zdHJ1Y3Rvci5zdXBlcl8gPSBjb25zdHJ1Y3Rvclsnc3VwZXInXSA9IHN1cGVyX1xuXG4gIHZhciBwcm9wZXJ0aWVzID0ge1xuICAgIGNvbnN0cnVjdG9yOiB7XG4gICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICB2YWx1ZTogY29uc3RydWN0b3IsXG4gICAgICB3cml0YWJsZTogdHJ1ZVxuICAgIH1cbiAgfVxuXG4gIC8vIElmIHRoZSBuYW1lIGNvdWxkIG5vdCBiZSBzZXQgb24gdGhlIGNvbnN0cnVjdG9yLCBzZXQgaXQgb24gdGhlXG4gIC8vIHByb3RvdHlwZS5cbiAgaWYgKG5hbWUgIT0gbnVsbCkge1xuICAgIHByb3BlcnRpZXMubmFtZSA9IHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIHZhbHVlOiBuYW1lLFxuICAgICAgd3JpdGFibGU6IHRydWVcbiAgICB9XG4gIH1cbiAgY29uc3RydWN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlcl8ucHJvdG90eXBlLCBwcm9wZXJ0aWVzKVxuXG4gIHJldHVybiBjb25zdHJ1Y3RvclxufVxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gbWFrZUVycm9yXG5leHBvcnRzLkJhc2VFcnJvciA9IEJhc2VFcnJvclxuIiwiLy8gVGhlc2UgbWV0aG9kcyBsZXQgeW91IGJ1aWxkIGEgdHJhbnNmb3JtIGZ1bmN0aW9uIGZyb20gYSB0cmFuc2Zvcm1Db21wb25lbnRcbi8vIGZ1bmN0aW9uIGZvciBPVCB0eXBlcyBsaWtlIEpTT04wIGluIHdoaWNoIG9wZXJhdGlvbnMgYXJlIGxpc3RzIG9mIGNvbXBvbmVudHNcbi8vIGFuZCB0cmFuc2Zvcm1pbmcgdGhlbSByZXF1aXJlcyBOXjIgd29yay4gSSBmaW5kIGl0IGtpbmQgb2YgbmFzdHkgdGhhdCBJIG5lZWRcbi8vIHRoaXMsIGJ1dCBJJ20gbm90IHJlYWxseSBzdXJlIHdoYXQgYSBiZXR0ZXIgc29sdXRpb24gaXMuIE1heWJlIEkgc2hvdWxkIGRvXG4vLyB0aGlzIGF1dG9tYXRpY2FsbHkgdG8gdHlwZXMgdGhhdCBkb24ndCBoYXZlIGEgY29tcG9zZSBmdW5jdGlvbiBkZWZpbmVkLlxuXG4vLyBBZGQgdHJhbnNmb3JtIGFuZCB0cmFuc2Zvcm1YIGZ1bmN0aW9ucyBmb3IgYW4gT1QgdHlwZSB3aGljaCBoYXNcbi8vIHRyYW5zZm9ybUNvbXBvbmVudCBkZWZpbmVkLiAgdHJhbnNmb3JtQ29tcG9uZW50KGRlc3RpbmF0aW9uIGFycmF5LFxuLy8gY29tcG9uZW50LCBvdGhlciBjb21wb25lbnQsIHNpZGUpXG5tb2R1bGUuZXhwb3J0cyA9IGJvb3RzdHJhcFRyYW5zZm9ybVxuZnVuY3Rpb24gYm9vdHN0cmFwVHJhbnNmb3JtKHR5cGUsIHRyYW5zZm9ybUNvbXBvbmVudCwgY2hlY2tWYWxpZE9wLCBhcHBlbmQpIHtcbiAgdmFyIHRyYW5zZm9ybUNvbXBvbmVudFggPSBmdW5jdGlvbihsZWZ0LCByaWdodCwgZGVzdExlZnQsIGRlc3RSaWdodCkge1xuICAgIHRyYW5zZm9ybUNvbXBvbmVudChkZXN0TGVmdCwgbGVmdCwgcmlnaHQsICdsZWZ0Jyk7XG4gICAgdHJhbnNmb3JtQ29tcG9uZW50KGRlc3RSaWdodCwgcmlnaHQsIGxlZnQsICdyaWdodCcpO1xuICB9O1xuXG4gIHZhciB0cmFuc2Zvcm1YID0gdHlwZS50cmFuc2Zvcm1YID0gZnVuY3Rpb24obGVmdE9wLCByaWdodE9wKSB7XG4gICAgY2hlY2tWYWxpZE9wKGxlZnRPcCk7XG4gICAgY2hlY2tWYWxpZE9wKHJpZ2h0T3ApO1xuICAgIHZhciBuZXdSaWdodE9wID0gW107XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJpZ2h0T3AubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciByaWdodENvbXBvbmVudCA9IHJpZ2h0T3BbaV07XG5cbiAgICAgIC8vIEdlbmVyYXRlIG5ld0xlZnRPcCBieSBjb21wb3NpbmcgbGVmdE9wIGJ5IHJpZ2h0Q29tcG9uZW50XG4gICAgICB2YXIgbmV3TGVmdE9wID0gW107XG4gICAgICB2YXIgayA9IDA7XG4gICAgICB3aGlsZSAoayA8IGxlZnRPcC5sZW5ndGgpIHtcbiAgICAgICAgdmFyIG5leHRDID0gW107XG4gICAgICAgIHRyYW5zZm9ybUNvbXBvbmVudFgobGVmdE9wW2tdLCByaWdodENvbXBvbmVudCwgbmV3TGVmdE9wLCBuZXh0Qyk7XG4gICAgICAgIGsrKztcblxuICAgICAgICBpZiAobmV4dEMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgcmlnaHRDb21wb25lbnQgPSBuZXh0Q1swXTtcbiAgICAgICAgfSBlbHNlIGlmIChuZXh0Qy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBmb3IgKHZhciBqID0gazsgaiA8IGxlZnRPcC5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgYXBwZW5kKG5ld0xlZnRPcCwgbGVmdE9wW2pdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmlnaHRDb21wb25lbnQgPSBudWxsO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFJlY3Vyc2UuXG4gICAgICAgICAgdmFyIHBhaXIgPSB0cmFuc2Zvcm1YKGxlZnRPcC5zbGljZShrKSwgbmV4dEMpO1xuICAgICAgICAgIGZvciAodmFyIGwgPSAwOyBsIDwgcGFpclswXS5sZW5ndGg7IGwrKykge1xuICAgICAgICAgICAgYXBwZW5kKG5ld0xlZnRPcCwgcGFpclswXVtsXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciAodmFyIHIgPSAwOyByIDwgcGFpclsxXS5sZW5ndGg7IHIrKykge1xuICAgICAgICAgICAgYXBwZW5kKG5ld1JpZ2h0T3AsIHBhaXJbMV1bcl0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByaWdodENvbXBvbmVudCA9IG51bGw7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHJpZ2h0Q29tcG9uZW50ICE9IG51bGwpIHtcbiAgICAgICAgYXBwZW5kKG5ld1JpZ2h0T3AsIHJpZ2h0Q29tcG9uZW50KTtcbiAgICAgIH1cbiAgICAgIGxlZnRPcCA9IG5ld0xlZnRPcDtcbiAgICB9XG4gICAgcmV0dXJuIFtsZWZ0T3AsIG5ld1JpZ2h0T3BdO1xuICB9O1xuXG4gIC8vIFRyYW5zZm9ybXMgb3Agd2l0aCBzcGVjaWZpZWQgdHlwZSAoJ2xlZnQnIG9yICdyaWdodCcpIGJ5IG90aGVyT3AuXG4gIHR5cGUudHJhbnNmb3JtID0gZnVuY3Rpb24ob3AsIG90aGVyT3AsIHR5cGUpIHtcbiAgICBpZiAoISh0eXBlID09PSAnbGVmdCcgfHwgdHlwZSA9PT0gJ3JpZ2h0JykpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0eXBlIG11c3QgYmUgJ2xlZnQnIG9yICdyaWdodCdcIik7XG5cbiAgICBpZiAob3RoZXJPcC5sZW5ndGggPT09IDApIHJldHVybiBvcDtcblxuICAgIGlmIChvcC5sZW5ndGggPT09IDEgJiYgb3RoZXJPcC5sZW5ndGggPT09IDEpXG4gICAgICByZXR1cm4gdHJhbnNmb3JtQ29tcG9uZW50KFtdLCBvcFswXSwgb3RoZXJPcFswXSwgdHlwZSk7XG5cbiAgICBpZiAodHlwZSA9PT0gJ2xlZnQnKVxuICAgICAgcmV0dXJuIHRyYW5zZm9ybVgob3AsIG90aGVyT3ApWzBdO1xuICAgIGVsc2VcbiAgICAgIHJldHVybiB0cmFuc2Zvcm1YKG90aGVyT3AsIG9wKVsxXTtcbiAgfTtcbn07XG4iLCIvLyBPbmx5IHRoZSBKU09OIHR5cGUgaXMgZXhwb3J0ZWQsIGJlY2F1c2UgdGhlIHRleHQgdHlwZSBpcyBkZXByZWNhdGVkXG4vLyBvdGhlcndpc2UuIChJZiB5b3Ugd2FudCB0byB1c2UgaXQgc29tZXdoZXJlLCB5b3UncmUgd2VsY29tZSB0byBwdWxsIGl0IG91dFxuLy8gaW50byBhIHNlcGFyYXRlIG1vZHVsZSB0aGF0IGpzb24wIGNhbiBkZXBlbmQgb24pLlxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgdHlwZTogcmVxdWlyZSgnLi9qc29uMCcpXG59O1xuIiwiLypcbiBUaGlzIGlzIHRoZSBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgSlNPTiBPVCB0eXBlLlxuXG4gU3BlYyBpcyBoZXJlOiBodHRwczovL2dpdGh1Yi5jb20vam9zZXBoZy9TaGFyZUpTL3dpa2kvSlNPTi1PcGVyYXRpb25zXG5cbiBOb3RlOiBUaGlzIGlzIGJlaW5nIG1hZGUgb2Jzb2xldGUuIEl0IHdpbGwgc29vbiBiZSByZXBsYWNlZCBieSB0aGUgSlNPTjIgdHlwZS5cbiovXG5cbi8qKlxuICogVVRJTElUWSBGVU5DVElPTlNcbiAqL1xuXG4vKipcbiAqIENoZWNrcyBpZiB0aGUgcGFzc2VkIG9iamVjdCBpcyBhbiBBcnJheSBpbnN0YW5jZS4gQ2FuJ3QgdXNlIEFycmF5LmlzQXJyYXlcbiAqIHlldCBiZWNhdXNlIGl0cyBub3Qgc3VwcG9ydGVkIG9uIElFOC5cbiAqXG4gKiBAcGFyYW0gb2JqXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xudmFyIGlzQXJyYXkgPSBmdW5jdGlvbihvYmopIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuXG4vKipcbiAqIENoZWNrcyBpZiB0aGUgcGFzc2VkIG9iamVjdCBpcyBhbiBPYmplY3QgaW5zdGFuY2UuXG4gKiBObyBmdW5jdGlvbiBjYWxsIChmYXN0KSB2ZXJzaW9uXG4gKlxuICogQHBhcmFtIG9ialxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbnZhciBpc09iamVjdCA9IGZ1bmN0aW9uKG9iaikge1xuICByZXR1cm4gKCEhb2JqKSAmJiAob2JqLmNvbnN0cnVjdG9yID09PSBPYmplY3QpO1xufTtcblxuLyoqXG4gKiBDbG9uZXMgdGhlIHBhc3NlZCBvYmplY3QgdXNpbmcgSlNPTiBzZXJpYWxpemF0aW9uICh3aGljaCBpcyBzbG93KS5cbiAqXG4gKiBoYXgsIGNvcGllZCBmcm9tIHRlc3QvdHlwZXMvanNvbi4gQXBwYXJlbnRseSB0aGlzIGlzIHN0aWxsIHRoZSBmYXN0ZXN0IHdheVxuICogdG8gZGVlcCBjbG9uZSBhbiBvYmplY3QsIGFzc3VtaW5nIHdlIGhhdmUgYnJvd3NlciBzdXBwb3J0IGZvciBKU09OLiAgQHNlZVxuICogaHR0cDovL2pzcGVyZi5jb20vY2xvbmluZy1hbi1vYmplY3QvMTJcbiAqL1xudmFyIGNsb25lID0gZnVuY3Rpb24obykge1xuICByZXR1cm4gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShvKSk7XG59O1xuXG4vKipcbiAqIEpTT04gT1QgVHlwZVxuICogQHR5cGUgeyp9XG4gKi9cbnZhciBqc29uID0ge1xuICBuYW1lOiAnanNvbjAnLFxuICB1cmk6ICdodHRwOi8vc2hhcmVqcy5vcmcvdHlwZXMvSlNPTnYwJ1xufTtcblxuLy8gWW91IGNhbiByZWdpc3RlciBhbm90aGVyIE9UIHR5cGUgYXMgYSBzdWJ0eXBlIGluIGEgSlNPTiBkb2N1bWVudCB1c2luZ1xuLy8gdGhlIGZvbGxvd2luZyBmdW5jdGlvbi4gVGhpcyBhbGxvd3MgYW5vdGhlciB0eXBlIHRvIGhhbmRsZSBjZXJ0YWluXG4vLyBvcGVyYXRpb25zIGluc3RlYWQgb2YgdGhlIGJ1aWx0aW4gSlNPTiB0eXBlLlxudmFyIHN1YnR5cGVzID0ge307XG5qc29uLnJlZ2lzdGVyU3VidHlwZSA9IGZ1bmN0aW9uKHN1YnR5cGUpIHtcbiAgc3VidHlwZXNbc3VidHlwZS5uYW1lXSA9IHN1YnR5cGU7XG59O1xuXG5qc29uLmNyZWF0ZSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgLy8gTnVsbCBpbnN0ZWFkIG9mIHVuZGVmaW5lZCBpZiB5b3UgZG9uJ3QgcGFzcyBhbiBhcmd1bWVudC5cbiAgcmV0dXJuIGRhdGEgPT09IHVuZGVmaW5lZCA/IG51bGwgOiBjbG9uZShkYXRhKTtcbn07XG5cbmpzb24uaW52ZXJ0Q29tcG9uZW50ID0gZnVuY3Rpb24oYykge1xuICB2YXIgY18gPSB7cDogYy5wfTtcblxuICAvLyBoYW5kbGUgc3VidHlwZSBvcHNcbiAgaWYgKGMudCAmJiBzdWJ0eXBlc1tjLnRdKSB7XG4gICAgY18udCA9IGMudDtcbiAgICBjXy5vID0gc3VidHlwZXNbYy50XS5pbnZlcnQoYy5vKTtcbiAgfVxuXG4gIGlmIChjLnNpICE9PSB2b2lkIDApIGNfLnNkID0gYy5zaTtcbiAgaWYgKGMuc2QgIT09IHZvaWQgMCkgY18uc2kgPSBjLnNkO1xuICBpZiAoYy5vaSAhPT0gdm9pZCAwKSBjXy5vZCA9IGMub2k7XG4gIGlmIChjLm9kICE9PSB2b2lkIDApIGNfLm9pID0gYy5vZDtcbiAgaWYgKGMubGkgIT09IHZvaWQgMCkgY18ubGQgPSBjLmxpO1xuICBpZiAoYy5sZCAhPT0gdm9pZCAwKSBjXy5saSA9IGMubGQ7XG4gIGlmIChjLm5hICE9PSB2b2lkIDApIGNfLm5hID0gLWMubmE7XG5cbiAgaWYgKGMubG0gIT09IHZvaWQgMCkge1xuICAgIGNfLmxtID0gYy5wW2MucC5sZW5ndGgtMV07XG4gICAgY18ucCA9IGMucC5zbGljZSgwLGMucC5sZW5ndGgtMSkuY29uY2F0KFtjLmxtXSk7XG4gIH1cblxuICByZXR1cm4gY187XG59O1xuXG5qc29uLmludmVydCA9IGZ1bmN0aW9uKG9wKSB7XG4gIHZhciBvcF8gPSBvcC5zbGljZSgpLnJldmVyc2UoKTtcbiAgdmFyIGlvcCA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IG9wXy5sZW5ndGg7IGkrKykge1xuICAgIGlvcC5wdXNoKGpzb24uaW52ZXJ0Q29tcG9uZW50KG9wX1tpXSkpO1xuICB9XG4gIHJldHVybiBpb3A7XG59O1xuXG5qc29uLmNoZWNrVmFsaWRPcCA9IGZ1bmN0aW9uKG9wKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoIWlzQXJyYXkob3BbaV0ucCkpIHRocm93IG5ldyBFcnJvcignTWlzc2luZyBwYXRoJyk7XG4gIH1cbn07XG5cbmpzb24uY2hlY2tMaXN0ID0gZnVuY3Rpb24oZWxlbSkge1xuICBpZiAoIWlzQXJyYXkoZWxlbSkpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdSZWZlcmVuY2VkIGVsZW1lbnQgbm90IGEgbGlzdCcpO1xufTtcblxuanNvbi5jaGVja09iaiA9IGZ1bmN0aW9uKGVsZW0pIHtcbiAgaWYgKCFpc09iamVjdChlbGVtKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlJlZmVyZW5jZWQgZWxlbWVudCBub3QgYW4gb2JqZWN0IChpdCB3YXMgXCIgKyBKU09OLnN0cmluZ2lmeShlbGVtKSArIFwiKVwiKTtcbiAgfVxufTtcblxuLy8gaGVscGVyIGZ1bmN0aW9ucyB0byBjb252ZXJ0IG9sZCBzdHJpbmcgb3BzIHRvIGFuZCBmcm9tIHN1YnR5cGUgb3BzXG5mdW5jdGlvbiBjb252ZXJ0RnJvbVRleHQoYykge1xuICBjLnQgPSAndGV4dDAnO1xuICB2YXIgbyA9IHtwOiBjLnAucG9wKCl9O1xuICBpZiAoYy5zaSAhPSBudWxsKSBvLmkgPSBjLnNpO1xuICBpZiAoYy5zZCAhPSBudWxsKSBvLmQgPSBjLnNkO1xuICBjLm8gPSBbb107XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRUb1RleHQoYykge1xuICBjLnAucHVzaChjLm9bMF0ucCk7XG4gIGlmIChjLm9bMF0uaSAhPSBudWxsKSBjLnNpID0gYy5vWzBdLmk7XG4gIGlmIChjLm9bMF0uZCAhPSBudWxsKSBjLnNkID0gYy5vWzBdLmQ7XG4gIGRlbGV0ZSBjLnQ7XG4gIGRlbGV0ZSBjLm87XG59XG5cbmpzb24uYXBwbHkgPSBmdW5jdGlvbihzbmFwc2hvdCwgb3ApIHtcbiAganNvbi5jaGVja1ZhbGlkT3Aob3ApO1xuXG4gIG9wID0gY2xvbmUob3ApO1xuXG4gIHZhciBjb250YWluZXIgPSB7XG4gICAgZGF0YTogc25hcHNob3RcbiAgfTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IG9wLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGMgPSBvcFtpXTtcblxuICAgIC8vIGNvbnZlcnQgb2xkIHN0cmluZyBvcHMgdG8gdXNlIHN1YnR5cGUgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5XG4gICAgaWYgKGMuc2kgIT0gbnVsbCB8fCBjLnNkICE9IG51bGwpXG4gICAgICBjb252ZXJ0RnJvbVRleHQoYyk7XG5cbiAgICB2YXIgcGFyZW50ID0gbnVsbDtcbiAgICB2YXIgcGFyZW50S2V5ID0gbnVsbDtcbiAgICB2YXIgZWxlbSA9IGNvbnRhaW5lcjtcbiAgICB2YXIga2V5ID0gJ2RhdGEnO1xuXG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBjLnAubGVuZ3RoOyBqKyspIHtcbiAgICAgIHZhciBwID0gYy5wW2pdO1xuXG4gICAgICBwYXJlbnQgPSBlbGVtO1xuICAgICAgcGFyZW50S2V5ID0ga2V5O1xuICAgICAgZWxlbSA9IGVsZW1ba2V5XTtcbiAgICAgIGtleSA9IHA7XG5cbiAgICAgIGlmIChwYXJlbnQgPT0gbnVsbClcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdQYXRoIGludmFsaWQnKTtcbiAgICB9XG5cbiAgICAvLyBoYW5kbGUgc3VidHlwZSBvcHNcbiAgICBpZiAoYy50ICYmIGMubyAhPT0gdm9pZCAwICYmIHN1YnR5cGVzW2MudF0pIHtcbiAgICAgIGVsZW1ba2V5XSA9IHN1YnR5cGVzW2MudF0uYXBwbHkoZWxlbVtrZXldLCBjLm8pO1xuXG4gICAgLy8gTnVtYmVyIGFkZFxuICAgIH0gZWxzZSBpZiAoYy5uYSAhPT0gdm9pZCAwKSB7XG4gICAgICBpZiAodHlwZW9mIGVsZW1ba2V5XSAhPSAnbnVtYmVyJylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdSZWZlcmVuY2VkIGVsZW1lbnQgbm90IGEgbnVtYmVyJyk7XG5cbiAgICAgIGVsZW1ba2V5XSArPSBjLm5hO1xuICAgIH1cblxuICAgIC8vIExpc3QgcmVwbGFjZVxuICAgIGVsc2UgaWYgKGMubGkgIT09IHZvaWQgMCAmJiBjLmxkICE9PSB2b2lkIDApIHtcbiAgICAgIGpzb24uY2hlY2tMaXN0KGVsZW0pO1xuICAgICAgLy8gU2hvdWxkIGNoZWNrIHRoZSBsaXN0IGVsZW1lbnQgbWF0Y2hlcyBjLmxkXG4gICAgICBlbGVtW2tleV0gPSBjLmxpO1xuICAgIH1cblxuICAgIC8vIExpc3QgaW5zZXJ0XG4gICAgZWxzZSBpZiAoYy5saSAhPT0gdm9pZCAwKSB7XG4gICAgICBqc29uLmNoZWNrTGlzdChlbGVtKTtcbiAgICAgIGVsZW0uc3BsaWNlKGtleSwwLCBjLmxpKTtcbiAgICB9XG5cbiAgICAvLyBMaXN0IGRlbGV0ZVxuICAgIGVsc2UgaWYgKGMubGQgIT09IHZvaWQgMCkge1xuICAgICAganNvbi5jaGVja0xpc3QoZWxlbSk7XG4gICAgICAvLyBTaG91bGQgY2hlY2sgdGhlIGxpc3QgZWxlbWVudCBtYXRjaGVzIGMubGQgaGVyZSB0b28uXG4gICAgICBlbGVtLnNwbGljZShrZXksMSk7XG4gICAgfVxuXG4gICAgLy8gTGlzdCBtb3ZlXG4gICAgZWxzZSBpZiAoYy5sbSAhPT0gdm9pZCAwKSB7XG4gICAgICBqc29uLmNoZWNrTGlzdChlbGVtKTtcbiAgICAgIGlmIChjLmxtICE9IGtleSkge1xuICAgICAgICB2YXIgZSA9IGVsZW1ba2V5XTtcbiAgICAgICAgLy8gUmVtb3ZlIGl0Li4uXG4gICAgICAgIGVsZW0uc3BsaWNlKGtleSwxKTtcbiAgICAgICAgLy8gQW5kIGluc2VydCBpdCBiYWNrLlxuICAgICAgICBlbGVtLnNwbGljZShjLmxtLDAsZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gT2JqZWN0IGluc2VydCAvIHJlcGxhY2VcbiAgICBlbHNlIGlmIChjLm9pICE9PSB2b2lkIDApIHtcbiAgICAgIGpzb24uY2hlY2tPYmooZWxlbSk7XG5cbiAgICAgIC8vIFNob3VsZCBjaGVjayB0aGF0IGVsZW1ba2V5XSA9PSBjLm9kXG4gICAgICBlbGVtW2tleV0gPSBjLm9pO1xuICAgIH1cblxuICAgIC8vIE9iamVjdCBkZWxldGVcbiAgICBlbHNlIGlmIChjLm9kICE9PSB2b2lkIDApIHtcbiAgICAgIGpzb24uY2hlY2tPYmooZWxlbSk7XG5cbiAgICAgIC8vIFNob3VsZCBjaGVjayB0aGF0IGVsZW1ba2V5XSA9PSBjLm9kXG4gICAgICBkZWxldGUgZWxlbVtrZXldO1xuICAgIH1cblxuICAgIGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIC8gbWlzc2luZyBpbnN0cnVjdGlvbiBpbiBvcCcpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBjb250YWluZXIuZGF0YTtcbn07XG5cbi8vIEhlbHBlciB0byBicmVhayBhbiBvcGVyYXRpb24gdXAgaW50byBhIGJ1bmNoIG9mIHNtYWxsIG9wcy5cbmpzb24uc2hhdHRlciA9IGZ1bmN0aW9uKG9wKSB7XG4gIHZhciByZXN1bHRzID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICByZXN1bHRzLnB1c2goW29wW2ldXSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdHM7XG59O1xuXG4vLyBIZWxwZXIgZm9yIGluY3JlbWVudGFsbHkgYXBwbHlpbmcgYW4gb3BlcmF0aW9uIHRvIGEgc25hcHNob3QuIENhbGxzIHlpZWxkXG4vLyBhZnRlciBlYWNoIG9wIGNvbXBvbmVudCBoYXMgYmVlbiBhcHBsaWVkLlxuanNvbi5pbmNyZW1lbnRhbEFwcGx5ID0gZnVuY3Rpb24oc25hcHNob3QsIG9wLCBfeWllbGQpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBzbWFsbE9wID0gW29wW2ldXTtcbiAgICBzbmFwc2hvdCA9IGpzb24uYXBwbHkoc25hcHNob3QsIHNtYWxsT3ApO1xuICAgIC8vIEknZCBqdXN0IGNhbGwgdGhpcyB5aWVsZCwgYnV0IHRoYXRzIGEgcmVzZXJ2ZWQga2V5d29yZC4gQmFoIVxuICAgIF95aWVsZChzbWFsbE9wLCBzbmFwc2hvdCk7XG4gIH1cblxuICByZXR1cm4gc25hcHNob3Q7XG59O1xuXG4vLyBDaGVja3MgaWYgdHdvIHBhdGhzLCBwMSBhbmQgcDIgbWF0Y2guXG52YXIgcGF0aE1hdGNoZXMgPSBqc29uLnBhdGhNYXRjaGVzID0gZnVuY3Rpb24ocDEsIHAyLCBpZ25vcmVMYXN0KSB7XG4gIGlmIChwMS5sZW5ndGggIT0gcDIubGVuZ3RoKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHAxLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHAxW2ldICE9PSBwMltpXSAmJiAoIWlnbm9yZUxhc3QgfHwgaSAhPT0gcDEubGVuZ3RoIC0gMSkpXG4gICAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbmpzb24uYXBwZW5kID0gZnVuY3Rpb24oZGVzdCxjKSB7XG4gIGMgPSBjbG9uZShjKTtcblxuICBpZiAoZGVzdC5sZW5ndGggPT09IDApIHtcbiAgICBkZXN0LnB1c2goYyk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIGxhc3QgPSBkZXN0W2Rlc3QubGVuZ3RoIC0gMV07XG5cbiAgLy8gY29udmVydCBvbGQgc3RyaW5nIG9wcyB0byB1c2Ugc3VidHlwZSBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHlcbiAgaWYgKChjLnNpICE9IG51bGwgfHwgYy5zZCAhPSBudWxsKSAmJiAobGFzdC5zaSAhPSBudWxsIHx8IGxhc3Quc2QgIT0gbnVsbCkpIHtcbiAgICBjb252ZXJ0RnJvbVRleHQoYyk7XG4gICAgY29udmVydEZyb21UZXh0KGxhc3QpO1xuICB9XG5cbiAgaWYgKHBhdGhNYXRjaGVzKGMucCwgbGFzdC5wKSkge1xuICAgIC8vIGhhbmRsZSBzdWJ0eXBlIG9wc1xuICAgIGlmIChjLnQgJiYgbGFzdC50ICYmIGMudCA9PT0gbGFzdC50ICYmIHN1YnR5cGVzW2MudF0pIHtcbiAgICAgIGxhc3QubyA9IHN1YnR5cGVzW2MudF0uY29tcG9zZShsYXN0Lm8sIGMubyk7XG5cbiAgICAgIC8vIGNvbnZlcnQgYmFjayB0byBvbGQgc3RyaW5nIG9wc1xuICAgICAgaWYgKGMuc2kgIT0gbnVsbCB8fCBjLnNkICE9IG51bGwpIHtcbiAgICAgICAgdmFyIHAgPSBjLnA7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGFzdC5vLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgIGMubyA9IFtsYXN0Lm8ucG9wKCldO1xuICAgICAgICAgIGMucCA9IHAuc2xpY2UoKTtcbiAgICAgICAgICBjb252ZXJ0VG9UZXh0KGMpO1xuICAgICAgICAgIGRlc3QucHVzaChjKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnZlcnRUb1RleHQobGFzdCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChsYXN0Lm5hICE9IG51bGwgJiYgYy5uYSAhPSBudWxsKSB7XG4gICAgICBkZXN0W2Rlc3QubGVuZ3RoIC0gMV0gPSB7cDogbGFzdC5wLCBuYTogbGFzdC5uYSArIGMubmF9O1xuICAgIH0gZWxzZSBpZiAobGFzdC5saSAhPT0gdW5kZWZpbmVkICYmIGMubGkgPT09IHVuZGVmaW5lZCAmJiBjLmxkID09PSBsYXN0LmxpKSB7XG4gICAgICAvLyBpbnNlcnQgaW1tZWRpYXRlbHkgZm9sbG93ZWQgYnkgZGVsZXRlIGJlY29tZXMgYSBub29wLlxuICAgICAgaWYgKGxhc3QubGQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyBsZWF2ZSB0aGUgZGVsZXRlIHBhcnQgb2YgdGhlIHJlcGxhY2VcbiAgICAgICAgZGVsZXRlIGxhc3QubGk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZXN0LnBvcCgpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobGFzdC5vZCAhPT0gdW5kZWZpbmVkICYmIGxhc3Qub2kgPT09IHVuZGVmaW5lZCAmJiBjLm9pICE9PSB1bmRlZmluZWQgJiYgYy5vZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBsYXN0Lm9pID0gYy5vaTtcbiAgICB9IGVsc2UgaWYgKGxhc3Qub2kgIT09IHVuZGVmaW5lZCAmJiBjLm9kICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIFRoZSBsYXN0IHBhdGggY29tcG9uZW50IGluc2VydGVkIHNvbWV0aGluZyB0aGF0IHRoZSBuZXcgY29tcG9uZW50IGRlbGV0ZXMgKG9yIHJlcGxhY2VzKS5cbiAgICAgIC8vIEp1c3QgbWVyZ2UgdGhlbS5cbiAgICAgIGlmIChjLm9pICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbGFzdC5vaSA9IGMub2k7XG4gICAgICB9IGVsc2UgaWYgKGxhc3Qub2QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBkZWxldGUgbGFzdC5vaTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEFuIGluc2VydCBkaXJlY3RseSBmb2xsb3dlZCBieSBhIGRlbGV0ZSB0dXJucyBpbnRvIGEgbm8tb3AgYW5kIGNhbiBiZSByZW1vdmVkLlxuICAgICAgICBkZXN0LnBvcCgpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoYy5sbSAhPT0gdW5kZWZpbmVkICYmIGMucFtjLnAubGVuZ3RoIC0gMV0gPT09IGMubG0pIHtcbiAgICAgIC8vIGRvbid0IGRvIGFueXRoaW5nXG4gICAgfSBlbHNlIHtcbiAgICAgIGRlc3QucHVzaChjKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gY29udmVydCBzdHJpbmcgb3BzIGJhY2tcbiAgICBpZiAoKGMuc2kgIT0gbnVsbCB8fCBjLnNkICE9IG51bGwpICYmIChsYXN0LnNpICE9IG51bGwgfHwgbGFzdC5zZCAhPSBudWxsKSkge1xuICAgICAgY29udmVydFRvVGV4dChjKTtcbiAgICAgIGNvbnZlcnRUb1RleHQobGFzdCk7XG4gICAgfVxuXG4gICAgZGVzdC5wdXNoKGMpO1xuICB9XG59O1xuXG5qc29uLmNvbXBvc2UgPSBmdW5jdGlvbihvcDEsb3AyKSB7XG4gIGpzb24uY2hlY2tWYWxpZE9wKG9wMSk7XG4gIGpzb24uY2hlY2tWYWxpZE9wKG9wMik7XG5cbiAgdmFyIG5ld09wID0gY2xvbmUob3AxKTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IG9wMi5sZW5ndGg7IGkrKykge1xuICAgIGpzb24uYXBwZW5kKG5ld09wLG9wMltpXSk7XG4gIH1cblxuICByZXR1cm4gbmV3T3A7XG59O1xuXG5qc29uLm5vcm1hbGl6ZSA9IGZ1bmN0aW9uKG9wKSB7XG4gIHZhciBuZXdPcCA9IFtdO1xuXG4gIG9wID0gaXNBcnJheShvcCkgPyBvcCA6IFtvcF07XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBjID0gb3BbaV07XG4gICAgaWYgKGMucCA9PSBudWxsKSBjLnAgPSBbXTtcblxuICAgIGpzb24uYXBwZW5kKG5ld09wLGMpO1xuICB9XG5cbiAgcmV0dXJuIG5ld09wO1xufTtcblxuLy8gUmV0dXJucyB0aGUgY29tbW9uIGxlbmd0aCBvZiB0aGUgcGF0aHMgb2Ygb3BzIGEgYW5kIGJcbmpzb24uY29tbW9uTGVuZ3RoRm9yT3BzID0gZnVuY3Rpb24oYSwgYikge1xuICB2YXIgYWxlbiA9IGEucC5sZW5ndGg7XG4gIHZhciBibGVuID0gYi5wLmxlbmd0aDtcbiAgaWYgKGEubmEgIT0gbnVsbCB8fCBhLnQpXG4gICAgYWxlbisrO1xuXG4gIGlmIChiLm5hICE9IG51bGwgfHwgYi50KVxuICAgIGJsZW4rKztcblxuICBpZiAoYWxlbiA9PT0gMCkgcmV0dXJuIC0xO1xuICBpZiAoYmxlbiA9PT0gMCkgcmV0dXJuIG51bGw7XG5cbiAgYWxlbi0tO1xuICBibGVuLS07XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhbGVuOyBpKyspIHtcbiAgICB2YXIgcCA9IGEucFtpXTtcbiAgICBpZiAoaSA+PSBibGVuIHx8IHAgIT09IGIucFtpXSlcbiAgICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIGFsZW47XG59O1xuXG4vLyBSZXR1cm5zIHRydWUgaWYgYW4gb3AgY2FuIGFmZmVjdCB0aGUgZ2l2ZW4gcGF0aFxuanNvbi5jYW5PcEFmZmVjdFBhdGggPSBmdW5jdGlvbihvcCwgcGF0aCkge1xuICByZXR1cm4ganNvbi5jb21tb25MZW5ndGhGb3JPcHMoe3A6cGF0aH0sIG9wKSAhPSBudWxsO1xufTtcblxuLy8gdHJhbnNmb3JtIGMgc28gaXQgYXBwbGllcyB0byBhIGRvY3VtZW50IHdpdGggb3RoZXJDIGFwcGxpZWQuXG5qc29uLnRyYW5zZm9ybUNvbXBvbmVudCA9IGZ1bmN0aW9uKGRlc3QsIGMsIG90aGVyQywgdHlwZSkge1xuICBjID0gY2xvbmUoYyk7XG5cbiAgdmFyIGNvbW1vbiA9IGpzb24uY29tbW9uTGVuZ3RoRm9yT3BzKG90aGVyQywgYyk7XG4gIHZhciBjb21tb24yID0ganNvbi5jb21tb25MZW5ndGhGb3JPcHMoYywgb3RoZXJDKTtcbiAgdmFyIGNwbGVuZ3RoID0gYy5wLmxlbmd0aDtcbiAgdmFyIG90aGVyQ3BsZW5ndGggPSBvdGhlckMucC5sZW5ndGg7XG5cbiAgaWYgKGMubmEgIT0gbnVsbCB8fCBjLnQpXG4gICAgY3BsZW5ndGgrKztcblxuICBpZiAob3RoZXJDLm5hICE9IG51bGwgfHwgb3RoZXJDLnQpXG4gICAgb3RoZXJDcGxlbmd0aCsrO1xuXG4gIC8vIGlmIGMgaXMgZGVsZXRpbmcgc29tZXRoaW5nLCBhbmQgdGhhdCB0aGluZyBpcyBjaGFuZ2VkIGJ5IG90aGVyQywgd2UgbmVlZCB0b1xuICAvLyB1cGRhdGUgYyB0byByZWZsZWN0IHRoYXQgY2hhbmdlIGZvciBpbnZlcnRpYmlsaXR5LlxuICBpZiAoY29tbW9uMiAhPSBudWxsICYmIG90aGVyQ3BsZW5ndGggPiBjcGxlbmd0aCAmJiBjLnBbY29tbW9uMl0gPT0gb3RoZXJDLnBbY29tbW9uMl0pIHtcbiAgICBpZiAoYy5sZCAhPT0gdm9pZCAwKSB7XG4gICAgICB2YXIgb2MgPSBjbG9uZShvdGhlckMpO1xuICAgICAgb2MucCA9IG9jLnAuc2xpY2UoY3BsZW5ndGgpO1xuICAgICAgYy5sZCA9IGpzb24uYXBwbHkoY2xvbmUoYy5sZCksW29jXSk7XG4gICAgfSBlbHNlIGlmIChjLm9kICE9PSB2b2lkIDApIHtcbiAgICAgIHZhciBvYyA9IGNsb25lKG90aGVyQyk7XG4gICAgICBvYy5wID0gb2MucC5zbGljZShjcGxlbmd0aCk7XG4gICAgICBjLm9kID0ganNvbi5hcHBseShjbG9uZShjLm9kKSxbb2NdKTtcbiAgICB9XG4gIH1cblxuICBpZiAoY29tbW9uICE9IG51bGwpIHtcbiAgICB2YXIgY29tbW9uT3BlcmFuZCA9IGNwbGVuZ3RoID09IG90aGVyQ3BsZW5ndGg7XG5cbiAgICAvLyBiYWNrd2FyZCBjb21wYXRpYmlsaXR5IGZvciBvbGQgc3RyaW5nIG9wc1xuICAgIHZhciBvYyA9IG90aGVyQztcbiAgICBpZiAoKGMuc2kgIT0gbnVsbCB8fCBjLnNkICE9IG51bGwpICYmIChvdGhlckMuc2kgIT0gbnVsbCB8fCBvdGhlckMuc2QgIT0gbnVsbCkpIHtcbiAgICAgIGNvbnZlcnRGcm9tVGV4dChjKTtcbiAgICAgIG9jID0gY2xvbmUob3RoZXJDKTtcbiAgICAgIGNvbnZlcnRGcm9tVGV4dChvYyk7XG4gICAgfVxuXG4gICAgLy8gaGFuZGxlIHN1YnR5cGUgb3BzXG4gICAgaWYgKG9jLnQgJiYgc3VidHlwZXNbb2MudF0pIHtcbiAgICAgIGlmIChjLnQgJiYgYy50ID09PSBvYy50KSB7XG4gICAgICAgIHZhciByZXMgPSBzdWJ0eXBlc1tjLnRdLnRyYW5zZm9ybShjLm8sIG9jLm8sIHR5cGUpO1xuXG4gICAgICAgIGlmIChyZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIC8vIGNvbnZlcnQgYmFjayB0byBvbGQgc3RyaW5nIG9wc1xuICAgICAgICAgIGlmIChjLnNpICE9IG51bGwgfHwgYy5zZCAhPSBudWxsKSB7XG4gICAgICAgICAgICB2YXIgcCA9IGMucDtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgIGMubyA9IFtyZXNbaV1dO1xuICAgICAgICAgICAgICBjLnAgPSBwLnNsaWNlKCk7XG4gICAgICAgICAgICAgIGNvbnZlcnRUb1RleHQoYyk7XG4gICAgICAgICAgICAgIGpzb24uYXBwZW5kKGRlc3QsIGMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjLm8gPSByZXM7XG4gICAgICAgICAgICBqc29uLmFwcGVuZChkZXN0LCBjKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZGVzdDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB0cmFuc2Zvcm0gYmFzZWQgb24gb3RoZXJDXG4gICAgZWxzZSBpZiAob3RoZXJDLm5hICE9PSB2b2lkIDApIHtcbiAgICAgIC8vIHRoaXMgY2FzZSBpcyBoYW5kbGVkIGJlbG93XG4gICAgfSBlbHNlIGlmIChvdGhlckMubGkgIT09IHZvaWQgMCAmJiBvdGhlckMubGQgIT09IHZvaWQgMCkge1xuICAgICAgaWYgKG90aGVyQy5wW2NvbW1vbl0gPT09IGMucFtjb21tb25dKSB7XG4gICAgICAgIC8vIG5vb3BcblxuICAgICAgICBpZiAoIWNvbW1vbk9wZXJhbmQpIHtcbiAgICAgICAgICByZXR1cm4gZGVzdDtcbiAgICAgICAgfSBlbHNlIGlmIChjLmxkICE9PSB2b2lkIDApIHtcbiAgICAgICAgICAvLyB3ZSdyZSB0cnlpbmcgdG8gZGVsZXRlIHRoZSBzYW1lIGVsZW1lbnQsIC0+IG5vb3BcbiAgICAgICAgICBpZiAoYy5saSAhPT0gdm9pZCAwICYmIHR5cGUgPT09ICdsZWZ0Jykge1xuICAgICAgICAgICAgLy8gd2UncmUgYm90aCByZXBsYWNpbmcgb25lIGVsZW1lbnQgd2l0aCBhbm90aGVyLiBvbmx5IG9uZSBjYW4gc3Vydml2ZVxuICAgICAgICAgICAgYy5sZCA9IGNsb25lKG90aGVyQy5saSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBkZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAob3RoZXJDLmxpICE9PSB2b2lkIDApIHtcbiAgICAgIGlmIChjLmxpICE9PSB2b2lkIDAgJiYgYy5sZCA9PT0gdW5kZWZpbmVkICYmIGNvbW1vbk9wZXJhbmQgJiYgYy5wW2NvbW1vbl0gPT09IG90aGVyQy5wW2NvbW1vbl0pIHtcbiAgICAgICAgLy8gaW4gbGkgdnMuIGxpLCBsZWZ0IHdpbnMuXG4gICAgICAgIGlmICh0eXBlID09PSAncmlnaHQnKVxuICAgICAgICAgIGMucFtjb21tb25dKys7XG4gICAgICB9IGVsc2UgaWYgKG90aGVyQy5wW2NvbW1vbl0gPD0gYy5wW2NvbW1vbl0pIHtcbiAgICAgICAgYy5wW2NvbW1vbl0rKztcbiAgICAgIH1cblxuICAgICAgaWYgKGMubG0gIT09IHZvaWQgMCkge1xuICAgICAgICBpZiAoY29tbW9uT3BlcmFuZCkge1xuICAgICAgICAgIC8vIG90aGVyQyBlZGl0cyB0aGUgc2FtZSBsaXN0IHdlIGVkaXRcbiAgICAgICAgICBpZiAob3RoZXJDLnBbY29tbW9uXSA8PSBjLmxtKVxuICAgICAgICAgICAgYy5sbSsrO1xuICAgICAgICAgIC8vIGNoYW5naW5nIGMuZnJvbSBpcyBoYW5kbGVkIGFib3ZlLlxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChvdGhlckMubGQgIT09IHZvaWQgMCkge1xuICAgICAgaWYgKGMubG0gIT09IHZvaWQgMCkge1xuICAgICAgICBpZiAoY29tbW9uT3BlcmFuZCkge1xuICAgICAgICAgIGlmIChvdGhlckMucFtjb21tb25dID09PSBjLnBbY29tbW9uXSkge1xuICAgICAgICAgICAgLy8gdGhleSBkZWxldGVkIHRoZSB0aGluZyB3ZSdyZSB0cnlpbmcgdG8gbW92ZVxuICAgICAgICAgICAgcmV0dXJuIGRlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIG90aGVyQyBlZGl0cyB0aGUgc2FtZSBsaXN0IHdlIGVkaXRcbiAgICAgICAgICB2YXIgcCA9IG90aGVyQy5wW2NvbW1vbl07XG4gICAgICAgICAgdmFyIGZyb20gPSBjLnBbY29tbW9uXTtcbiAgICAgICAgICB2YXIgdG8gPSBjLmxtO1xuICAgICAgICAgIGlmIChwIDwgdG8gfHwgKHAgPT09IHRvICYmIGZyb20gPCB0bykpXG4gICAgICAgICAgICBjLmxtLS07XG5cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAob3RoZXJDLnBbY29tbW9uXSA8IGMucFtjb21tb25dKSB7XG4gICAgICAgIGMucFtjb21tb25dLS07XG4gICAgICB9IGVsc2UgaWYgKG90aGVyQy5wW2NvbW1vbl0gPT09IGMucFtjb21tb25dKSB7XG4gICAgICAgIGlmIChvdGhlckNwbGVuZ3RoIDwgY3BsZW5ndGgpIHtcbiAgICAgICAgICAvLyB3ZSdyZSBiZWxvdyB0aGUgZGVsZXRlZCBlbGVtZW50LCBzbyAtPiBub29wXG4gICAgICAgICAgcmV0dXJuIGRlc3Q7XG4gICAgICAgIH0gZWxzZSBpZiAoYy5sZCAhPT0gdm9pZCAwKSB7XG4gICAgICAgICAgaWYgKGMubGkgIT09IHZvaWQgMCkge1xuICAgICAgICAgICAgLy8gd2UncmUgcmVwbGFjaW5nLCB0aGV5J3JlIGRlbGV0aW5nLiB3ZSBiZWNvbWUgYW4gaW5zZXJ0LlxuICAgICAgICAgICAgZGVsZXRlIGMubGQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHdlJ3JlIHRyeWluZyB0byBkZWxldGUgdGhlIHNhbWUgZWxlbWVudCwgLT4gbm9vcFxuICAgICAgICAgICAgcmV0dXJuIGRlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICB9IGVsc2UgaWYgKG90aGVyQy5sbSAhPT0gdm9pZCAwKSB7XG4gICAgICBpZiAoYy5sbSAhPT0gdm9pZCAwICYmIGNwbGVuZ3RoID09PSBvdGhlckNwbGVuZ3RoKSB7XG4gICAgICAgIC8vIGxtIHZzIGxtLCBoZXJlIHdlIGdvIVxuICAgICAgICB2YXIgZnJvbSA9IGMucFtjb21tb25dO1xuICAgICAgICB2YXIgdG8gPSBjLmxtO1xuICAgICAgICB2YXIgb3RoZXJGcm9tID0gb3RoZXJDLnBbY29tbW9uXTtcbiAgICAgICAgdmFyIG90aGVyVG8gPSBvdGhlckMubG07XG4gICAgICAgIGlmIChvdGhlckZyb20gIT09IG90aGVyVG8pIHtcbiAgICAgICAgICAvLyBpZiBvdGhlckZyb20gPT0gb3RoZXJUbywgd2UgZG9uJ3QgbmVlZCB0byBjaGFuZ2Ugb3VyIG9wLlxuXG4gICAgICAgICAgLy8gd2hlcmUgZGlkIG15IHRoaW5nIGdvP1xuICAgICAgICAgIGlmIChmcm9tID09PSBvdGhlckZyb20pIHtcbiAgICAgICAgICAgIC8vIHRoZXkgbW92ZWQgaXQhIHRpZSBicmVhay5cbiAgICAgICAgICAgIGlmICh0eXBlID09PSAnbGVmdCcpIHtcbiAgICAgICAgICAgICAgYy5wW2NvbW1vbl0gPSBvdGhlclRvO1xuICAgICAgICAgICAgICBpZiAoZnJvbSA9PT0gdG8pIC8vIHVnaFxuICAgICAgICAgICAgICAgIGMubG0gPSBvdGhlclRvO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGRlc3Q7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHRoZXkgbW92ZWQgYXJvdW5kIGl0XG4gICAgICAgICAgICBpZiAoZnJvbSA+IG90aGVyRnJvbSkgYy5wW2NvbW1vbl0tLTtcbiAgICAgICAgICAgIGlmIChmcm9tID4gb3RoZXJUbykgYy5wW2NvbW1vbl0rKztcbiAgICAgICAgICAgIGVsc2UgaWYgKGZyb20gPT09IG90aGVyVG8pIHtcbiAgICAgICAgICAgICAgaWYgKG90aGVyRnJvbSA+IG90aGVyVG8pIHtcbiAgICAgICAgICAgICAgICBjLnBbY29tbW9uXSsrO1xuICAgICAgICAgICAgICAgIGlmIChmcm9tID09PSB0bykgLy8gdWdoLCBhZ2FpblxuICAgICAgICAgICAgICAgICAgYy5sbSsrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHN0ZXAgMjogd2hlcmUgYW0gaSBnb2luZyB0byBwdXQgaXQ/XG4gICAgICAgICAgICBpZiAodG8gPiBvdGhlckZyb20pIHtcbiAgICAgICAgICAgICAgYy5sbS0tO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0byA9PT0gb3RoZXJGcm9tKSB7XG4gICAgICAgICAgICAgIGlmICh0byA+IGZyb20pXG4gICAgICAgICAgICAgICAgYy5sbS0tO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRvID4gb3RoZXJUbykge1xuICAgICAgICAgICAgICBjLmxtKys7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRvID09PSBvdGhlclRvKSB7XG4gICAgICAgICAgICAgIC8vIGlmIHdlJ3JlIGJvdGggbW92aW5nIGluIHRoZSBzYW1lIGRpcmVjdGlvbiwgdGllIGJyZWFrXG4gICAgICAgICAgICAgIGlmICgob3RoZXJUbyA+IG90aGVyRnJvbSAmJiB0byA+IGZyb20pIHx8XG4gICAgICAgICAgICAgICAgICAob3RoZXJUbyA8IG90aGVyRnJvbSAmJiB0byA8IGZyb20pKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdyaWdodCcpIGMubG0rKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAodG8gPiBmcm9tKSBjLmxtKys7XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodG8gPT09IG90aGVyRnJvbSkgYy5sbS0tO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGMubGkgIT09IHZvaWQgMCAmJiBjLmxkID09PSB1bmRlZmluZWQgJiYgY29tbW9uT3BlcmFuZCkge1xuICAgICAgICAvLyBsaVxuICAgICAgICB2YXIgZnJvbSA9IG90aGVyQy5wW2NvbW1vbl07XG4gICAgICAgIHZhciB0byA9IG90aGVyQy5sbTtcbiAgICAgICAgcCA9IGMucFtjb21tb25dO1xuICAgICAgICBpZiAocCA+IGZyb20pIGMucFtjb21tb25dLS07XG4gICAgICAgIGlmIChwID4gdG8pIGMucFtjb21tb25dKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBsZCwgbGQrbGksIHNpLCBzZCwgbmEsIG9pLCBvZCwgb2krb2QsIGFueSBsaSBvbiBhbiBlbGVtZW50IGJlbmVhdGhcbiAgICAgICAgLy8gdGhlIGxtXG4gICAgICAgIC8vXG4gICAgICAgIC8vIGkuZS4gdGhpbmdzIGNhcmUgYWJvdXQgd2hlcmUgdGhlaXIgaXRlbSBpcyBhZnRlciB0aGUgbW92ZS5cbiAgICAgICAgdmFyIGZyb20gPSBvdGhlckMucFtjb21tb25dO1xuICAgICAgICB2YXIgdG8gPSBvdGhlckMubG07XG4gICAgICAgIHAgPSBjLnBbY29tbW9uXTtcbiAgICAgICAgaWYgKHAgPT09IGZyb20pIHtcbiAgICAgICAgICBjLnBbY29tbW9uXSA9IHRvO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChwID4gZnJvbSkgYy5wW2NvbW1vbl0tLTtcbiAgICAgICAgICBpZiAocCA+IHRvKSBjLnBbY29tbW9uXSsrO1xuICAgICAgICAgIGVsc2UgaWYgKHAgPT09IHRvICYmIGZyb20gPiB0bykgYy5wW2NvbW1vbl0rKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmIChvdGhlckMub2kgIT09IHZvaWQgMCAmJiBvdGhlckMub2QgIT09IHZvaWQgMCkge1xuICAgICAgaWYgKGMucFtjb21tb25dID09PSBvdGhlckMucFtjb21tb25dKSB7XG4gICAgICAgIGlmIChjLm9pICE9PSB2b2lkIDAgJiYgY29tbW9uT3BlcmFuZCkge1xuICAgICAgICAgIC8vIHdlIGluc2VydGVkIHdoZXJlIHNvbWVvbmUgZWxzZSByZXBsYWNlZFxuICAgICAgICAgIGlmICh0eXBlID09PSAncmlnaHQnKSB7XG4gICAgICAgICAgICAvLyBsZWZ0IHdpbnNcbiAgICAgICAgICAgIHJldHVybiBkZXN0O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyB3ZSB3aW4sIG1ha2Ugb3VyIG9wIHJlcGxhY2Ugd2hhdCB0aGV5IGluc2VydGVkXG4gICAgICAgICAgICBjLm9kID0gb3RoZXJDLm9pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyAtPiBub29wIGlmIHRoZSBvdGhlciBjb21wb25lbnQgaXMgZGVsZXRpbmcgdGhlIHNhbWUgb2JqZWN0IChvciBhbnkgcGFyZW50KVxuICAgICAgICAgIHJldHVybiBkZXN0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChvdGhlckMub2kgIT09IHZvaWQgMCkge1xuICAgICAgaWYgKGMub2kgIT09IHZvaWQgMCAmJiBjLnBbY29tbW9uXSA9PT0gb3RoZXJDLnBbY29tbW9uXSkge1xuICAgICAgICAvLyBsZWZ0IHdpbnMgaWYgd2UgdHJ5IHRvIGluc2VydCBhdCB0aGUgc2FtZSBwbGFjZVxuICAgICAgICBpZiAodHlwZSA9PT0gJ2xlZnQnKSB7XG4gICAgICAgICAganNvbi5hcHBlbmQoZGVzdCx7cDogYy5wLCBvZDpvdGhlckMub2l9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gZGVzdDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAob3RoZXJDLm9kICE9PSB2b2lkIDApIHtcbiAgICAgIGlmIChjLnBbY29tbW9uXSA9PSBvdGhlckMucFtjb21tb25dKSB7XG4gICAgICAgIGlmICghY29tbW9uT3BlcmFuZClcbiAgICAgICAgICByZXR1cm4gZGVzdDtcbiAgICAgICAgaWYgKGMub2kgIT09IHZvaWQgMCkge1xuICAgICAgICAgIGRlbGV0ZSBjLm9kO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBkZXN0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAganNvbi5hcHBlbmQoZGVzdCxjKTtcbiAgcmV0dXJuIGRlc3Q7XG59O1xuXG5yZXF1aXJlKCcuL2Jvb3RzdHJhcFRyYW5zZm9ybScpKGpzb24sIGpzb24udHJhbnNmb3JtQ29tcG9uZW50LCBqc29uLmNoZWNrVmFsaWRPcCwganNvbi5hcHBlbmQpO1xuXG4vKipcbiAqIFJlZ2lzdGVyIGEgc3VidHlwZSBmb3Igc3RyaW5nIG9wZXJhdGlvbnMsIHVzaW5nIHRoZSB0ZXh0MCB0eXBlLlxuICovXG52YXIgdGV4dCA9IHJlcXVpcmUoJy4vdGV4dDAnKTtcblxuanNvbi5yZWdpc3RlclN1YnR5cGUodGV4dCk7XG5tb2R1bGUuZXhwb3J0cyA9IGpzb247XG5cbiIsIi8vIERFUFJFQ0FURUQhXG4vL1xuLy8gVGhpcyB0eXBlIHdvcmtzLCBidXQgaXMgbm90IGV4cG9ydGVkLiBJdHMgaW5jbHVkZWQgaGVyZSBiZWNhdXNlIHRoZSBKU09OMFxuLy8gZW1iZWRkZWQgc3RyaW5nIG9wZXJhdGlvbnMgdXNlIHRoaXMgbGlicmFyeS5cblxuXG4vLyBBIHNpbXBsZSB0ZXh0IGltcGxlbWVudGF0aW9uXG4vL1xuLy8gT3BlcmF0aW9ucyBhcmUgbGlzdHMgb2YgY29tcG9uZW50cy4gRWFjaCBjb21wb25lbnQgZWl0aGVyIGluc2VydHMgb3IgZGVsZXRlc1xuLy8gYXQgYSBzcGVjaWZpZWQgcG9zaXRpb24gaW4gdGhlIGRvY3VtZW50LlxuLy9cbi8vIENvbXBvbmVudHMgYXJlIGVpdGhlcjpcbi8vICB7aTonc3RyJywgcDoxMDB9OiBJbnNlcnQgJ3N0cicgYXQgcG9zaXRpb24gMTAwIGluIHRoZSBkb2N1bWVudFxuLy8gIHtkOidzdHInLCBwOjEwMH06IERlbGV0ZSAnc3RyJyBhdCBwb3NpdGlvbiAxMDAgaW4gdGhlIGRvY3VtZW50XG4vL1xuLy8gQ29tcG9uZW50cyBpbiBhbiBvcGVyYXRpb24gYXJlIGV4ZWN1dGVkIHNlcXVlbnRpYWxseSwgc28gdGhlIHBvc2l0aW9uIG9mIGNvbXBvbmVudHNcbi8vIGFzc3VtZXMgcHJldmlvdXMgY29tcG9uZW50cyBoYXZlIGFscmVhZHkgZXhlY3V0ZWQuXG4vL1xuLy8gRWc6IFRoaXMgb3A6XG4vLyAgIFt7aTonYWJjJywgcDowfV1cbi8vIGlzIGVxdWl2YWxlbnQgdG8gdGhpcyBvcDpcbi8vICAgW3tpOidhJywgcDowfSwge2k6J2InLCBwOjF9LCB7aTonYycsIHA6Mn1dXG5cbnZhciB0ZXh0ID0gbW9kdWxlLmV4cG9ydHMgPSB7XG4gIG5hbWU6ICd0ZXh0MCcsXG4gIHVyaTogJ2h0dHA6Ly9zaGFyZWpzLm9yZy90eXBlcy90ZXh0djAnLFxuICBjcmVhdGU6IGZ1bmN0aW9uKGluaXRpYWwpIHtcbiAgICBpZiAoKGluaXRpYWwgIT0gbnVsbCkgJiYgdHlwZW9mIGluaXRpYWwgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0luaXRpYWwgZGF0YSBtdXN0IGJlIGEgc3RyaW5nJyk7XG4gICAgfVxuICAgIHJldHVybiBpbml0aWFsIHx8ICcnO1xuICB9XG59O1xuXG4vKiogSW5zZXJ0IHMyIGludG8gczEgYXQgcG9zLiAqL1xudmFyIHN0ckluamVjdCA9IGZ1bmN0aW9uKHMxLCBwb3MsIHMyKSB7XG4gIHJldHVybiBzMS5zbGljZSgwLCBwb3MpICsgczIgKyBzMS5zbGljZShwb3MpO1xufTtcblxuLyoqIENoZWNrIHRoYXQgYW4gb3BlcmF0aW9uIGNvbXBvbmVudCBpcyB2YWxpZC4gVGhyb3dzIGlmIGl0cyBpbnZhbGlkLiAqL1xudmFyIGNoZWNrVmFsaWRDb21wb25lbnQgPSBmdW5jdGlvbihjKSB7XG4gIGlmICh0eXBlb2YgYy5wICE9PSAnbnVtYmVyJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvbXBvbmVudCBtaXNzaW5nIHBvc2l0aW9uIGZpZWxkJyk7XG5cbiAgaWYgKCh0eXBlb2YgYy5pID09PSAnc3RyaW5nJykgPT09ICh0eXBlb2YgYy5kID09PSAnc3RyaW5nJykpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdjb21wb25lbnQgbmVlZHMgYW4gaSBvciBkIGZpZWxkJyk7XG5cbiAgaWYgKGMucCA8IDApXG4gICAgdGhyb3cgbmV3IEVycm9yKCdwb3NpdGlvbiBjYW5ub3QgYmUgbmVnYXRpdmUnKTtcbn07XG5cbi8qKiBDaGVjayB0aGF0IGFuIG9wZXJhdGlvbiBpcyB2YWxpZCAqL1xudmFyIGNoZWNrVmFsaWRPcCA9IGZ1bmN0aW9uKG9wKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICBjaGVja1ZhbGlkQ29tcG9uZW50KG9wW2ldKTtcbiAgfVxufTtcblxuLyoqIEFwcGx5IG9wIHRvIHNuYXBzaG90ICovXG50ZXh0LmFwcGx5ID0gZnVuY3Rpb24oc25hcHNob3QsIG9wKSB7XG4gIHZhciBkZWxldGVkO1xuXG4gIGNoZWNrVmFsaWRPcChvcCk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgY29tcG9uZW50ID0gb3BbaV07XG4gICAgaWYgKGNvbXBvbmVudC5pICE9IG51bGwpIHtcbiAgICAgIHNuYXBzaG90ID0gc3RySW5qZWN0KHNuYXBzaG90LCBjb21wb25lbnQucCwgY29tcG9uZW50LmkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGVkID0gc25hcHNob3Quc2xpY2UoY29tcG9uZW50LnAsIGNvbXBvbmVudC5wICsgY29tcG9uZW50LmQubGVuZ3RoKTtcbiAgICAgIGlmIChjb21wb25lbnQuZCAhPT0gZGVsZXRlZClcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRGVsZXRlIGNvbXBvbmVudCAnXCIgKyBjb21wb25lbnQuZCArIFwiJyBkb2VzIG5vdCBtYXRjaCBkZWxldGVkIHRleHQgJ1wiICsgZGVsZXRlZCArIFwiJ1wiKTtcblxuICAgICAgc25hcHNob3QgPSBzbmFwc2hvdC5zbGljZSgwLCBjb21wb25lbnQucCkgKyBzbmFwc2hvdC5zbGljZShjb21wb25lbnQucCArIGNvbXBvbmVudC5kLmxlbmd0aCk7XG4gICAgfVxuICB9XG4gIHJldHVybiBzbmFwc2hvdDtcbn07XG5cbi8qKlxuICogQXBwZW5kIGEgY29tcG9uZW50IHRvIHRoZSBlbmQgb2YgbmV3T3AuIEV4cG9ydGVkIGZvciB1c2UgYnkgdGhlIHJhbmRvbSBvcFxuICogZ2VuZXJhdG9yIGFuZCB0aGUgSlNPTjAgdHlwZS5cbiAqL1xudmFyIGFwcGVuZCA9IHRleHQuX2FwcGVuZCA9IGZ1bmN0aW9uKG5ld09wLCBjKSB7XG4gIGlmIChjLmkgPT09ICcnIHx8IGMuZCA9PT0gJycpIHJldHVybjtcblxuICBpZiAobmV3T3AubGVuZ3RoID09PSAwKSB7XG4gICAgbmV3T3AucHVzaChjKTtcbiAgfSBlbHNlIHtcbiAgICB2YXIgbGFzdCA9IG5ld09wW25ld09wLmxlbmd0aCAtIDFdO1xuXG4gICAgaWYgKGxhc3QuaSAhPSBudWxsICYmIGMuaSAhPSBudWxsICYmIGxhc3QucCA8PSBjLnAgJiYgYy5wIDw9IGxhc3QucCArIGxhc3QuaS5sZW5ndGgpIHtcbiAgICAgIC8vIENvbXBvc2UgdGhlIGluc2VydCBpbnRvIHRoZSBwcmV2aW91cyBpbnNlcnRcbiAgICAgIG5ld09wW25ld09wLmxlbmd0aCAtIDFdID0ge2k6c3RySW5qZWN0KGxhc3QuaSwgYy5wIC0gbGFzdC5wLCBjLmkpLCBwOmxhc3QucH07XG5cbiAgICB9IGVsc2UgaWYgKGxhc3QuZCAhPSBudWxsICYmIGMuZCAhPSBudWxsICYmIGMucCA8PSBsYXN0LnAgJiYgbGFzdC5wIDw9IGMucCArIGMuZC5sZW5ndGgpIHtcbiAgICAgIC8vIENvbXBvc2UgdGhlIGRlbGV0ZXMgdG9nZXRoZXJcbiAgICAgIG5ld09wW25ld09wLmxlbmd0aCAtIDFdID0ge2Q6c3RySW5qZWN0KGMuZCwgbGFzdC5wIC0gYy5wLCBsYXN0LmQpLCBwOmMucH07XG5cbiAgICB9IGVsc2Uge1xuICAgICAgbmV3T3AucHVzaChjKTtcbiAgICB9XG4gIH1cbn07XG5cbi8qKiBDb21wb3NlIG9wMSBhbmQgb3AyIHRvZ2V0aGVyICovXG50ZXh0LmNvbXBvc2UgPSBmdW5jdGlvbihvcDEsIG9wMikge1xuICBjaGVja1ZhbGlkT3Aob3AxKTtcbiAgY2hlY2tWYWxpZE9wKG9wMik7XG4gIHZhciBuZXdPcCA9IG9wMS5zbGljZSgpO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IG9wMi5sZW5ndGg7IGkrKykge1xuICAgIGFwcGVuZChuZXdPcCwgb3AyW2ldKTtcbiAgfVxuICByZXR1cm4gbmV3T3A7XG59O1xuXG4vKiogQ2xlYW4gdXAgYW4gb3AgKi9cbnRleHQubm9ybWFsaXplID0gZnVuY3Rpb24ob3ApIHtcbiAgdmFyIG5ld09wID0gW107XG5cbiAgLy8gTm9ybWFsaXplIHNob3VsZCBhbGxvdyBvcHMgd2hpY2ggYXJlIGEgc2luZ2xlICh1bndyYXBwZWQpIGNvbXBvbmVudDpcbiAgLy8ge2k6J2FzZGYnLCBwOjIzfS5cbiAgLy8gVGhlcmUncyBubyBnb29kIHdheSB0byB0ZXN0IGlmIHNvbWV0aGluZyBpcyBhbiBhcnJheTpcbiAgLy8gaHR0cDovL3BlcmZlY3Rpb25raWxscy5jb20vaW5zdGFuY2VvZi1jb25zaWRlcmVkLWhhcm1mdWwtb3ItaG93LXRvLXdyaXRlLWEtcm9idXN0LWlzYXJyYXkvXG4gIC8vIHNvIHRoaXMgaXMgcHJvYmFibHkgdGhlIGxlYXN0IGJhZCBzb2x1dGlvbi5cbiAgaWYgKG9wLmkgIT0gbnVsbCB8fCBvcC5wICE9IG51bGwpIG9wID0gW29wXTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IG9wLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGMgPSBvcFtpXTtcbiAgICBpZiAoYy5wID09IG51bGwpIGMucCA9IDA7XG5cbiAgICBhcHBlbmQobmV3T3AsIGMpO1xuICB9XG5cbiAgcmV0dXJuIG5ld09wO1xufTtcblxuLy8gVGhpcyBoZWxwZXIgbWV0aG9kIHRyYW5zZm9ybXMgYSBwb3NpdGlvbiBieSBhbiBvcCBjb21wb25lbnQuXG4vL1xuLy8gSWYgYyBpcyBhbiBpbnNlcnQsIGluc2VydEFmdGVyIHNwZWNpZmllcyB3aGV0aGVyIHRoZSB0cmFuc2Zvcm1cbi8vIGlzIHB1c2hlZCBhZnRlciB0aGUgaW5zZXJ0ICh0cnVlKSBvciBiZWZvcmUgaXQgKGZhbHNlKS5cbi8vXG4vLyBpbnNlcnRBZnRlciBpcyBvcHRpb25hbCBmb3IgZGVsZXRlcy5cbnZhciB0cmFuc2Zvcm1Qb3NpdGlvbiA9IGZ1bmN0aW9uKHBvcywgYywgaW5zZXJ0QWZ0ZXIpIHtcbiAgLy8gVGhpcyB3aWxsIGdldCBjb2xsYXBzZWQgaW50byBhIGdpYW50IHRlcm5hcnkgYnkgdWdsaWZ5LlxuICBpZiAoYy5pICE9IG51bGwpIHtcbiAgICBpZiAoYy5wIDwgcG9zIHx8IChjLnAgPT09IHBvcyAmJiBpbnNlcnRBZnRlcikpIHtcbiAgICAgIHJldHVybiBwb3MgKyBjLmkubGVuZ3RoO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcG9zO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBJIHRoaW5rIHRoaXMgY291bGQgYWxzbyBiZSB3cml0dGVuIGFzOiBNYXRoLm1pbihjLnAsIE1hdGgubWluKGMucCAtXG4gICAgLy8gb3RoZXJDLnAsIG90aGVyQy5kLmxlbmd0aCkpIGJ1dCBJIHRoaW5rIGl0cyBoYXJkZXIgdG8gcmVhZCB0aGF0IHdheSwgYW5kXG4gICAgLy8gaXQgY29tcGlsZXMgdXNpbmcgdGVybmFyeSBvcGVyYXRvcnMgYW55d2F5IHNvIGl0cyBubyBzbG93ZXIgd3JpdHRlbiBsaWtlXG4gICAgLy8gdGhpcy5cbiAgICBpZiAocG9zIDw9IGMucCkge1xuICAgICAgcmV0dXJuIHBvcztcbiAgICB9IGVsc2UgaWYgKHBvcyA8PSBjLnAgKyBjLmQubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gYy5wO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcG9zIC0gYy5kLmxlbmd0aDtcbiAgICB9XG4gIH1cbn07XG5cbi8vIEhlbHBlciBtZXRob2QgdG8gdHJhbnNmb3JtIGEgY3Vyc29yIHBvc2l0aW9uIGFzIGEgcmVzdWx0IG9mIGFuIG9wLlxuLy9cbi8vIExpa2UgdHJhbnNmb3JtUG9zaXRpb24gYWJvdmUsIGlmIGMgaXMgYW4gaW5zZXJ0LCBpbnNlcnRBZnRlciBzcGVjaWZpZXNcbi8vIHdoZXRoZXIgdGhlIGN1cnNvciBwb3NpdGlvbiBpcyBwdXNoZWQgYWZ0ZXIgYW4gaW5zZXJ0ICh0cnVlKSBvciBiZWZvcmUgaXRcbi8vIChmYWxzZSkuXG50ZXh0LnRyYW5zZm9ybUN1cnNvciA9IGZ1bmN0aW9uKHBvc2l0aW9uLCBvcCwgc2lkZSkge1xuICB2YXIgaW5zZXJ0QWZ0ZXIgPSBzaWRlID09PSAncmlnaHQnO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IG9wLmxlbmd0aDsgaSsrKSB7XG4gICAgcG9zaXRpb24gPSB0cmFuc2Zvcm1Qb3NpdGlvbihwb3NpdGlvbiwgb3BbaV0sIGluc2VydEFmdGVyKTtcbiAgfVxuXG4gIHJldHVybiBwb3NpdGlvbjtcbn07XG5cbi8vIFRyYW5zZm9ybSBhbiBvcCBjb21wb25lbnQgYnkgYW5vdGhlciBvcCBjb21wb25lbnQuIEFzeW1tZXRyaWMuXG4vLyBUaGUgcmVzdWx0IHdpbGwgYmUgYXBwZW5kZWQgdG8gZGVzdGluYXRpb24uXG4vL1xuLy8gZXhwb3J0ZWQgZm9yIHVzZSBpbiBKU09OIHR5cGVcbnZhciB0cmFuc2Zvcm1Db21wb25lbnQgPSB0ZXh0Ll90YyA9IGZ1bmN0aW9uKGRlc3QsIGMsIG90aGVyQywgc2lkZSkge1xuICAvL3ZhciBjSW50ZXJzZWN0LCBpbnRlcnNlY3RFbmQsIGludGVyc2VjdFN0YXJ0LCBuZXdDLCBvdGhlckludGVyc2VjdCwgcztcblxuICBjaGVja1ZhbGlkQ29tcG9uZW50KGMpO1xuICBjaGVja1ZhbGlkQ29tcG9uZW50KG90aGVyQyk7XG5cbiAgaWYgKGMuaSAhPSBudWxsKSB7XG4gICAgLy8gSW5zZXJ0LlxuICAgIGFwcGVuZChkZXN0LCB7aTpjLmksIHA6dHJhbnNmb3JtUG9zaXRpb24oYy5wLCBvdGhlckMsIHNpZGUgPT09ICdyaWdodCcpfSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gRGVsZXRlXG4gICAgaWYgKG90aGVyQy5pICE9IG51bGwpIHtcbiAgICAgIC8vIERlbGV0ZSB2cyBpbnNlcnRcbiAgICAgIHZhciBzID0gYy5kO1xuICAgICAgaWYgKGMucCA8IG90aGVyQy5wKSB7XG4gICAgICAgIGFwcGVuZChkZXN0LCB7ZDpzLnNsaWNlKDAsIG90aGVyQy5wIC0gYy5wKSwgcDpjLnB9KTtcbiAgICAgICAgcyA9IHMuc2xpY2Uob3RoZXJDLnAgLSBjLnApO1xuICAgICAgfVxuICAgICAgaWYgKHMgIT09ICcnKVxuICAgICAgICBhcHBlbmQoZGVzdCwge2Q6IHMsIHA6IGMucCArIG90aGVyQy5pLmxlbmd0aH0pO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERlbGV0ZSB2cyBkZWxldGVcbiAgICAgIGlmIChjLnAgPj0gb3RoZXJDLnAgKyBvdGhlckMuZC5sZW5ndGgpXG4gICAgICAgIGFwcGVuZChkZXN0LCB7ZDogYy5kLCBwOiBjLnAgLSBvdGhlckMuZC5sZW5ndGh9KTtcbiAgICAgIGVsc2UgaWYgKGMucCArIGMuZC5sZW5ndGggPD0gb3RoZXJDLnApXG4gICAgICAgIGFwcGVuZChkZXN0LCBjKTtcbiAgICAgIGVsc2Uge1xuICAgICAgICAvLyBUaGV5IG92ZXJsYXAgc29tZXdoZXJlLlxuICAgICAgICB2YXIgbmV3QyA9IHtkOiAnJywgcDogYy5wfTtcblxuICAgICAgICBpZiAoYy5wIDwgb3RoZXJDLnApXG4gICAgICAgICAgbmV3Qy5kID0gYy5kLnNsaWNlKDAsIG90aGVyQy5wIC0gYy5wKTtcblxuICAgICAgICBpZiAoYy5wICsgYy5kLmxlbmd0aCA+IG90aGVyQy5wICsgb3RoZXJDLmQubGVuZ3RoKVxuICAgICAgICAgIG5ld0MuZCArPSBjLmQuc2xpY2Uob3RoZXJDLnAgKyBvdGhlckMuZC5sZW5ndGggLSBjLnApO1xuXG4gICAgICAgIC8vIFRoaXMgaXMgZW50aXJlbHkgb3B0aW9uYWwgLSBJJ20ganVzdCBjaGVja2luZyB0aGUgZGVsZXRlZCB0ZXh0IGluXG4gICAgICAgIC8vIHRoZSB0d28gb3BzIG1hdGNoZXNcbiAgICAgICAgdmFyIGludGVyc2VjdFN0YXJ0ID0gTWF0aC5tYXgoYy5wLCBvdGhlckMucCk7XG4gICAgICAgIHZhciBpbnRlcnNlY3RFbmQgPSBNYXRoLm1pbihjLnAgKyBjLmQubGVuZ3RoLCBvdGhlckMucCArIG90aGVyQy5kLmxlbmd0aCk7XG4gICAgICAgIHZhciBjSW50ZXJzZWN0ID0gYy5kLnNsaWNlKGludGVyc2VjdFN0YXJ0IC0gYy5wLCBpbnRlcnNlY3RFbmQgLSBjLnApO1xuICAgICAgICB2YXIgb3RoZXJJbnRlcnNlY3QgPSBvdGhlckMuZC5zbGljZShpbnRlcnNlY3RTdGFydCAtIG90aGVyQy5wLCBpbnRlcnNlY3RFbmQgLSBvdGhlckMucCk7XG4gICAgICAgIGlmIChjSW50ZXJzZWN0ICE9PSBvdGhlckludGVyc2VjdClcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0RlbGV0ZSBvcHMgZGVsZXRlIGRpZmZlcmVudCB0ZXh0IGluIHRoZSBzYW1lIHJlZ2lvbiBvZiB0aGUgZG9jdW1lbnQnKTtcblxuICAgICAgICBpZiAobmV3Qy5kICE9PSAnJykge1xuICAgICAgICAgIG5ld0MucCA9IHRyYW5zZm9ybVBvc2l0aW9uKG5ld0MucCwgb3RoZXJDKTtcbiAgICAgICAgICBhcHBlbmQoZGVzdCwgbmV3Qyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gZGVzdDtcbn07XG5cbnZhciBpbnZlcnRDb21wb25lbnQgPSBmdW5jdGlvbihjKSB7XG4gIHJldHVybiAoYy5pICE9IG51bGwpID8ge2Q6Yy5pLCBwOmMucH0gOiB7aTpjLmQsIHA6Yy5wfTtcbn07XG5cbi8vIE5vIG5lZWQgdG8gdXNlIGFwcGVuZCBmb3IgaW52ZXJ0LCBiZWNhdXNlIHRoZSBjb21wb25lbnRzIHdvbid0IGJlIGFibGUgdG9cbi8vIGNhbmNlbCBvbmUgYW5vdGhlci5cbnRleHQuaW52ZXJ0ID0gZnVuY3Rpb24ob3ApIHtcbiAgLy8gU2hhbGxvdyBjb3B5ICYgcmV2ZXJzZSB0aGF0IHN1Y2thLlxuICBvcCA9IG9wLnNsaWNlKCkucmV2ZXJzZSgpO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IG9wLmxlbmd0aDsgaSsrKSB7XG4gICAgb3BbaV0gPSBpbnZlcnRDb21wb25lbnQob3BbaV0pO1xuICB9XG4gIHJldHVybiBvcDtcbn07XG5cbnJlcXVpcmUoJy4vYm9vdHN0cmFwVHJhbnNmb3JtJykodGV4dCwgdHJhbnNmb3JtQ29tcG9uZW50LCBjaGVja1ZhbGlkT3AsIGFwcGVuZCk7XG4iLCIvLyBUZXh0IGRvY3VtZW50IEFQSSBmb3IgdGhlICd0ZXh0JyB0eXBlLiBUaGlzIGltcGxlbWVudHMgc29tZSBzdGFuZGFyZCBBUElcbi8vIG1ldGhvZHMgZm9yIGFueSB0ZXh0LWxpa2UgdHlwZSwgc28geW91IGNhbiBlYXNpbHkgYmluZCBhIHRleHRhcmVhIG9yXG4vLyBzb21ldGhpbmcgd2l0aG91dCBiZWluZyBmdXNzeSBhYm91dCB0aGUgdW5kZXJseWluZyBPVCBpbXBsZW1lbnRhdGlvbi5cbi8vXG4vLyBUaGUgQVBJIGlzIGRlc2lnZW5kIGFzIGEgc2V0IG9mIGZ1bmN0aW9ucyB0byBiZSBtaXhlZCBpbiB0byBzb21lIGNvbnRleHRcbi8vIG9iamVjdCBhcyBwYXJ0IG9mIGl0cyBsaWZlY3ljbGUuIEl0IGV4cGVjdHMgdGhhdCBvYmplY3QgdG8gaGF2ZSBnZXRTbmFwc2hvdFxuLy8gYW5kIHN1Ym1pdE9wIG1ldGhvZHMsIGFuZCBjYWxsIF9vbk9wIHdoZW4gYW4gb3BlcmF0aW9uIGlzIHJlY2VpdmVkLlxuLy9cbi8vIFRoaXMgQVBJIGRlZmluZXM6XG4vL1xuLy8gLSBnZXRMZW5ndGgoKSByZXR1cm5zIHRoZSBsZW5ndGggb2YgdGhlIGRvY3VtZW50IGluIGNoYXJhY3RlcnNcbi8vIC0gZ2V0VGV4dCgpIHJldHVybnMgYSBzdHJpbmcgb2YgdGhlIGRvY3VtZW50XG4vLyAtIGluc2VydChwb3MsIHRleHQsIFtjYWxsYmFja10pIGluc2VydHMgdGV4dCBhdCBwb3NpdGlvbiBwb3MgaW4gdGhlIGRvY3VtZW50XG4vLyAtIHJlbW92ZShwb3MsIGxlbmd0aCwgW2NhbGxiYWNrXSkgcmVtb3ZlcyBsZW5ndGggY2hhcmFjdGVycyBhdCBwb3NpdGlvbiBwb3Ncbi8vXG4vLyBBIHVzZXIgY2FuIGRlZmluZTpcbi8vIC0gb25JbnNlcnQocG9zLCB0ZXh0KTogQ2FsbGVkIHdoZW4gdGV4dCBpcyBpbnNlcnRlZC5cbi8vIC0gb25SZW1vdmUocG9zLCBsZW5ndGgpOiBDYWxsZWQgd2hlbiB0ZXh0IGlzIHJlbW92ZWQuXG5cbm1vZHVsZS5leHBvcnRzID0gYXBpO1xuZnVuY3Rpb24gYXBpKGdldFNuYXBzaG90LCBzdWJtaXRPcCkge1xuICByZXR1cm4ge1xuICAgIC8vIFJldHVybnMgdGhlIHRleHQgY29udGVudCBvZiB0aGUgZG9jdW1lbnRcbiAgICBnZXQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gZ2V0U25hcHNob3QoKTsgfSxcblxuICAgIC8vIFJldHVybnMgdGhlIG51bWJlciBvZiBjaGFyYWN0ZXJzIGluIHRoZSBzdHJpbmdcbiAgICBnZXRMZW5ndGg6IGZ1bmN0aW9uKCkgeyByZXR1cm4gZ2V0U25hcHNob3QoKS5sZW5ndGg7IH0sXG5cbiAgICAvLyBJbnNlcnQgdGhlIHNwZWNpZmllZCB0ZXh0IGF0IHRoZSBnaXZlbiBwb3NpdGlvbiBpbiB0aGUgZG9jdW1lbnRcbiAgICBpbnNlcnQ6IGZ1bmN0aW9uKHBvcywgdGV4dCwgY2FsbGJhY2spIHtcbiAgICAgIHJldHVybiBzdWJtaXRPcChbcG9zLCB0ZXh0XSwgY2FsbGJhY2spO1xuICAgIH0sXG5cbiAgICByZW1vdmU6IGZ1bmN0aW9uKHBvcywgbGVuZ3RoLCBjYWxsYmFjaykge1xuICAgICAgcmV0dXJuIHN1Ym1pdE9wKFtwb3MsIHtkOmxlbmd0aH1dLCBjYWxsYmFjayk7XG4gICAgfSxcblxuICAgIC8vIFdoZW4geW91IHVzZSB0aGlzIEFQSSwgeW91IHNob3VsZCBpbXBsZW1lbnQgdGhlc2UgdHdvIG1ldGhvZHNcbiAgICAvLyBpbiB5b3VyIGVkaXRpbmcgY29udGV4dC5cbiAgICAvL29uSW5zZXJ0OiBmdW5jdGlvbihwb3MsIHRleHQpIHt9LFxuICAgIC8vb25SZW1vdmU6IGZ1bmN0aW9uKHBvcywgcmVtb3ZlZExlbmd0aCkge30sXG5cbiAgICBfb25PcDogZnVuY3Rpb24ob3ApIHtcbiAgICAgIHZhciBwb3MgPSAwO1xuICAgICAgdmFyIHNwb3MgPSAwO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY29tcG9uZW50ID0gb3BbaV07XG4gICAgICAgIHN3aXRjaCAodHlwZW9mIGNvbXBvbmVudCkge1xuICAgICAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAgICAgICBwb3MgKz0gY29tcG9uZW50O1xuICAgICAgICAgICAgc3BvcyArPSBjb21wb25lbnQ7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgaWYgKHRoaXMub25JbnNlcnQpIHRoaXMub25JbnNlcnQocG9zLCBjb21wb25lbnQpO1xuICAgICAgICAgICAgcG9zICs9IGNvbXBvbmVudC5sZW5ndGg7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICAgICAgaWYgKHRoaXMub25SZW1vdmUpIHRoaXMub25SZW1vdmUocG9zLCBjb21wb25lbnQuZCk7XG4gICAgICAgICAgICBzcG9zICs9IGNvbXBvbmVudC5kO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9O1xufTtcbmFwaS5wcm92aWRlcyA9IHt0ZXh0OiB0cnVlfTtcbiIsInZhciB0eXBlID0gcmVxdWlyZSgnLi90ZXh0Jyk7XG50eXBlLmFwaSA9IHJlcXVpcmUoJy4vYXBpJyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICB0eXBlOiB0eXBlXG59O1xuIiwiLyogVGV4dCBPVCFcbiAqXG4gKiBUaGlzIGlzIGFuIE9UIGltcGxlbWVudGF0aW9uIGZvciB0ZXh0LiBJdCBpcyB0aGUgc3RhbmRhcmQgaW1wbGVtZW50YXRpb24gb2ZcbiAqIHRleHQgdXNlZCBieSBTaGFyZUpTLlxuICpcbiAqIFRoaXMgdHlwZSBpcyBjb21wb3NhYmxlIGJ1dCBub24taW52ZXJ0YWJsZS4gSXRzIHNpbWlsYXIgdG8gU2hhcmVKUydzIG9sZFxuICogdGV4dC1jb21wb3NhYmxlIHR5cGUsIGJ1dCBpdHMgbm90IGludmVydGFibGUgYW5kIGl0cyB2ZXJ5IHNpbWlsYXIgdG8gdGhlXG4gKiB0ZXh0LXRwMiBpbXBsZW1lbnRhdGlvbiBidXQgaXQgZG9lc24ndCBzdXBwb3J0IHRvbWJzdG9uZXMgb3IgcHVyZ2luZy5cbiAqXG4gKiBPcHMgYXJlIGxpc3RzIG9mIGNvbXBvbmVudHMgd2hpY2ggaXRlcmF0ZSBvdmVyIHRoZSBkb2N1bWVudC5cbiAqIENvbXBvbmVudHMgYXJlIGVpdGhlcjpcbiAqICAgQSBudW1iZXIgTjogU2tpcCBOIGNoYXJhY3RlcnMgaW4gdGhlIG9yaWdpbmFsIGRvY3VtZW50XG4gKiAgIFwic3RyXCIgICAgIDogSW5zZXJ0IFwic3RyXCIgYXQgdGhlIGN1cnJlbnQgcG9zaXRpb24gaW4gdGhlIGRvY3VtZW50XG4gKiAgIHtkOk59ICAgICA6IERlbGV0ZSBOIGNoYXJhY3RlcnMgYXQgdGhlIGN1cnJlbnQgcG9zaXRpb24gaW4gdGhlIGRvY3VtZW50XG4gKlxuICogRWc6IFszLCAnaGknLCA1LCB7ZDo4fV1cbiAqXG4gKiBUaGUgb3BlcmF0aW9uIGRvZXMgbm90IGhhdmUgdG8gc2tpcCB0aGUgbGFzdCBjaGFyYWN0ZXJzIGluIHRoZSBkb2N1bWVudC5cbiAqXG4gKiBTbmFwc2hvdHMgYXJlIHN0cmluZ3MuXG4gKlxuICogQ3Vyc29ycyBhcmUgZWl0aGVyIGEgc2luZ2xlIG51bWJlciAod2hpY2ggaXMgdGhlIGN1cnNvciBwb3NpdGlvbikgb3IgYSBwYWlyIG9mXG4gKiBbYW5jaG9yLCBmb2N1c10gKGFrYSBbc3RhcnQsIGVuZF0pLiBCZSBhd2FyZSB0aGF0IGVuZCBjYW4gYmUgYmVmb3JlIHN0YXJ0LlxuICovXG5cbi8qKiBAbW9kdWxlIHRleHQgKi9cblxuZXhwb3J0cy5uYW1lID0gJ3RleHQnO1xuZXhwb3J0cy51cmkgPSAnaHR0cDovL3NoYXJlanMub3JnL3R5cGVzL3RleHR2MSc7XG5cbi8qKiBDcmVhdGUgYSBuZXcgdGV4dCBzbmFwc2hvdC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gaW5pdGlhbCAtIGluaXRpYWwgc25hcHNob3QgZGF0YS4gT3B0aW9uYWwuIERlZmF1bHRzIHRvICcnLlxuICovXG5leHBvcnRzLmNyZWF0ZSA9IGZ1bmN0aW9uKGluaXRpYWwpIHtcbiAgaWYgKChpbml0aWFsICE9IG51bGwpICYmIHR5cGVvZiBpbml0aWFsICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IEVycm9yKCdJbml0aWFsIGRhdGEgbXVzdCBiZSBhIHN0cmluZycpO1xuICB9XG4gIHJldHVybiBpbml0aWFsIHx8ICcnO1xufTtcblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uKG9iaikge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09IFwiW29iamVjdCBBcnJheV1cIjtcbn07XG5cbi8qKiBDaGVjayB0aGUgb3BlcmF0aW9uIGlzIHZhbGlkLiBUaHJvd3MgaWYgbm90IHZhbGlkLiAqL1xudmFyIGNoZWNrT3AgPSBmdW5jdGlvbihvcCkge1xuICBpZiAoIWlzQXJyYXkob3ApKSB0aHJvdyBFcnJvcignT3AgbXVzdCBiZSBhbiBhcnJheSBvZiBjb21wb25lbnRzJyk7XG5cbiAgdmFyIGxhc3QgPSBudWxsO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IG9wLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGMgPSBvcFtpXTtcbiAgICBzd2l0Y2ggKHR5cGVvZiBjKSB7XG4gICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICAvLyBUaGUgb25seSB2YWxpZCBvYmplY3RzIGFyZSB7ZDpYfSBmb3IgK2l2ZSB2YWx1ZXMgb2YgWC5cbiAgICAgICAgLy9pZiAoISh0eXBlb2YgYy5kID09PSAnbnVtYmVyJyAmJiBjLmQgPiAwKSkgdGhyb3cgRXJyb3IoJ09iamVjdCBjb21wb25lbnRzIG11c3QgYmUgZGVsZXRlcyBvZiBzaXplID4gMCcpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgIC8vIFN0cmluZ3MgYXJlIGluc2VydHMuXG4gICAgICAgIGlmICghKGMubGVuZ3RoID4gMCkpIHRocm93IEVycm9yKCdJbnNlcnRzIGNhbm5vdCBiZSBlbXB0eScpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAgIC8vIE51bWJlcnMgbXVzdCBiZSBza2lwcy4gVGhleSBoYXZlIHRvIGJlICtpdmUgbnVtYmVycy5cbiAgICAgICAgaWYgKCEoYyA+IDApKSB0aHJvdyBFcnJvcignU2tpcCBjb21wb25lbnRzIG11c3QgYmUgPjAnKTtcbiAgICAgICAgaWYgKHR5cGVvZiBsYXN0ID09PSAnbnVtYmVyJykgdGhyb3cgRXJyb3IoJ0FkamFjZW50IHNraXAgY29tcG9uZW50cyBzaG91bGQgYmUgY29tYmluZWQnKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGxhc3QgPSBjO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBsYXN0ID09PSAnbnVtYmVyJykgdGhyb3cgRXJyb3IoJ09wIGhhcyBhIHRyYWlsaW5nIHNraXAnKTtcbn07XG5cbi8qKiBDaGVjayB0aGF0IHRoZSBnaXZlbiBzZWxlY3Rpb24gcmFuZ2UgaXMgdmFsaWQuICovXG52YXIgY2hlY2tTZWxlY3Rpb24gPSBmdW5jdGlvbihzZWxlY3Rpb24pIHtcbiAgLy8gVGhpcyBtYXkgdGhyb3cgZnJvbSBzaW1wbHkgaW5zcGVjdGluZyBzZWxlY3Rpb25bMF0gLyBzZWxlY3Rpb25bMV0uIFRoYXRzXG4gIC8vIHNvcnQgb2Ygb2ssIHRob3VnaCBpdCdsbCBnZW5lcmF0ZSB0aGUgd3JvbmcgbWVzc2FnZS5cbiAgaWYgKHR5cGVvZiBzZWxlY3Rpb24gIT09ICdudW1iZXInXG4gICAgICAmJiAodHlwZW9mIHNlbGVjdGlvblswXSAhPT0gJ251bWJlcicgfHwgdHlwZW9mIHNlbGVjdGlvblsxXSAhPT0gJ251bWJlcicpKVxuICAgIHRocm93IEVycm9yKCdJbnZhbGlkIHNlbGVjdGlvbicpO1xufTtcblxuLyoqIE1ha2UgYSBmdW5jdGlvbiB0aGF0IGFwcGVuZHMgdG8gdGhlIGdpdmVuIG9wZXJhdGlvbi4gKi9cbnZhciBtYWtlQXBwZW5kID0gZnVuY3Rpb24ob3ApIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGNvbXBvbmVudCkge1xuICAgIGlmICghY29tcG9uZW50IHx8IGNvbXBvbmVudC5kID09PSAwKSB7XG4gICAgICAvLyBUaGUgY29tcG9uZW50IGlzIGEgbm8tb3AuIElnbm9yZSFcbiBcbiAgICB9IGVsc2UgaWYgKG9wLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG9wLnB1c2goY29tcG9uZW50KTtcblxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGNvbXBvbmVudCA9PT0gdHlwZW9mIG9wW29wLmxlbmd0aCAtIDFdKSB7XG4gICAgICBpZiAodHlwZW9mIGNvbXBvbmVudCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIG9wW29wLmxlbmd0aCAtIDFdLmQgKz0gY29tcG9uZW50LmQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gb3Bbb3AubGVuZ3RoIC0gMV0gKz0gY29tcG9uZW50O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gb3AucHVzaChjb21wb25lbnQpO1xuICAgIH1cbiAgfTtcbn07XG5cbi8qKiBNYWtlcyBhbmQgcmV0dXJucyB1dGlsaXR5IGZ1bmN0aW9ucyB0YWtlIGFuZCBwZWVrLiAqL1xudmFyIG1ha2VUYWtlID0gZnVuY3Rpb24ob3ApIHtcbiAgLy8gVGhlIGluZGV4IG9mIHRoZSBuZXh0IGNvbXBvbmVudCB0byB0YWtlXG4gIHZhciBpZHggPSAwO1xuICAvLyBUaGUgb2Zmc2V0IGludG8gdGhlIGNvbXBvbmVudFxuICB2YXIgb2Zmc2V0ID0gMDtcblxuICAvLyBUYWtlIHVwIHRvIGxlbmd0aCBuIGZyb20gdGhlIGZyb250IG9mIG9wLiBJZiBuIGlzIC0xLCB0YWtlIHRoZSBlbnRpcmUgbmV4dFxuICAvLyBvcCBjb21wb25lbnQuIElmIGluZGl2aXNhYmxlRmllbGQgPT0gJ2QnLCBkZWxldGUgY29tcG9uZW50cyB3b24ndCBiZSBzZXBhcmF0ZWQuXG4gIC8vIElmIGluZGl2aXNhYmxlRmllbGQgPT0gJ2knLCBpbnNlcnQgY29tcG9uZW50cyB3b24ndCBiZSBzZXBhcmF0ZWQuXG4gIHZhciB0YWtlID0gZnVuY3Rpb24obiwgaW5kaXZpc2FibGVGaWVsZCkge1xuICAgIC8vIFdlJ3JlIGF0IHRoZSBlbmQgb2YgdGhlIG9wZXJhdGlvbi4gVGhlIG9wIGhhcyBza2lwcywgZm9yZXZlci4gSW5maW5pdHlcbiAgICAvLyBtaWdodCBtYWtlIG1vcmUgc2Vuc2UgdGhhbiBudWxsIGhlcmUuXG4gICAgaWYgKGlkeCA9PT0gb3AubGVuZ3RoKVxuICAgICAgcmV0dXJuIG4gPT09IC0xID8gbnVsbCA6IG47XG5cbiAgICB2YXIgcGFydDtcbiAgICB2YXIgYyA9IG9wW2lkeF07XG4gICAgaWYgKHR5cGVvZiBjID09PSAnbnVtYmVyJykge1xuICAgICAgLy8gU2tpcFxuICAgICAgaWYgKG4gPT09IC0xIHx8IGMgLSBvZmZzZXQgPD0gbikge1xuICAgICAgICBwYXJ0ID0gYyAtIG9mZnNldDtcbiAgICAgICAgKytpZHg7XG4gICAgICAgIG9mZnNldCA9IDA7XG4gICAgICAgIHJldHVybiBwYXJ0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2Zmc2V0ICs9IG47XG4gICAgICAgIHJldHVybiBuO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBJbnNlcnRcbiAgICAgIGlmIChuID09PSAtMSB8fCBpbmRpdmlzYWJsZUZpZWxkID09PSAnaScgfHwgYy5sZW5ndGggLSBvZmZzZXQgPD0gbikge1xuICAgICAgICBwYXJ0ID0gYy5zbGljZShvZmZzZXQpO1xuICAgICAgICArK2lkeDtcbiAgICAgICAgb2Zmc2V0ID0gMDtcbiAgICAgICAgcmV0dXJuIHBhcnQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJ0ID0gYy5zbGljZShvZmZzZXQsIG9mZnNldCArIG4pO1xuICAgICAgICBvZmZzZXQgKz0gbjtcbiAgICAgICAgcmV0dXJuIHBhcnQ7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERlbGV0ZVxuICAgICAgaWYgKG4gPT09IC0xIHx8IGluZGl2aXNhYmxlRmllbGQgPT09ICdkJyB8fCBjLmQgLSBvZmZzZXQgPD0gbikge1xuICAgICAgICBwYXJ0ID0ge2Q6IGMuZCAtIG9mZnNldH07XG4gICAgICAgICsraWR4O1xuICAgICAgICBvZmZzZXQgPSAwO1xuICAgICAgICByZXR1cm4gcGFydDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9mZnNldCArPSBuO1xuICAgICAgICByZXR1cm4ge2Q6IG59O1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICAvLyBQZWVrIGF0IHRoZSBuZXh0IG9wIHRoYXQgd2lsbCBiZSByZXR1cm5lZC5cbiAgdmFyIHBlZWtUeXBlID0gZnVuY3Rpb24oKSB7IHJldHVybiBvcFtpZHhdOyB9O1xuXG4gIHJldHVybiBbdGFrZSwgcGVla1R5cGVdO1xufTtcblxuLyoqIEdldCB0aGUgbGVuZ3RoIG9mIGEgY29tcG9uZW50ICovXG52YXIgY29tcG9uZW50TGVuZ3RoID0gZnVuY3Rpb24oYykge1xuICAvLyBVZ2xpZnkgd2lsbCBjb21wcmVzcyB0aGlzIGRvd24gaW50byBhIHRlcm5hcnlcbiAgaWYgKHR5cGVvZiBjID09PSAnbnVtYmVyJykge1xuICAgIHJldHVybiBjO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBjLmxlbmd0aCB8fCBjLmQ7XG4gIH1cbn07XG5cbi8qKiBUcmltIGFueSBleGNlc3Mgc2tpcHMgZnJvbSB0aGUgZW5kIG9mIGFuIG9wZXJhdGlvbi5cbiAqXG4gKiBUaGVyZSBzaG91bGQgb25seSBiZSBhdCBtb3N0IG9uZSwgYmVjYXVzZSB0aGUgb3BlcmF0aW9uIHdhcyBtYWRlIHdpdGggYXBwZW5kLlxuICovXG52YXIgdHJpbSA9IGZ1bmN0aW9uKG9wKSB7XG4gIGlmIChvcC5sZW5ndGggPiAwICYmIHR5cGVvZiBvcFtvcC5sZW5ndGggLSAxXSA9PT0gJ251bWJlcicpIHtcbiAgICBvcC5wb3AoKTtcbiAgfVxuICByZXR1cm4gb3A7XG59O1xuXG5leHBvcnRzLm5vcm1hbGl6ZSA9IGZ1bmN0aW9uKG9wKSB7XG4gIHZhciBuZXdPcCA9IFtdO1xuICB2YXIgYXBwZW5kID0gbWFrZUFwcGVuZChuZXdPcCk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICBhcHBlbmQob3BbaV0pO1xuICB9XG4gIHJldHVybiB0cmltKG5ld09wKTtcbn07XG5cbi8qKiBBcHBseSBhbiBvcGVyYXRpb24gdG8gYSBkb2N1bWVudCBzbmFwc2hvdCAqL1xuZXhwb3J0cy5hcHBseSA9IGZ1bmN0aW9uKHN0ciwgb3ApIHtcbiAgaWYgKHR5cGVvZiBzdHIgIT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgRXJyb3IoJ1NuYXBzaG90IHNob3VsZCBiZSBhIHN0cmluZycpO1xuICB9XG4gIGNoZWNrT3Aob3ApO1xuXG4gIC8vIFdlJ2xsIGdhdGhlciB0aGUgbmV3IGRvY3VtZW50IGhlcmUgYW5kIGpvaW4gYXQgdGhlIGVuZC5cbiAgdmFyIG5ld0RvYyA9IFtdO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgY29tcG9uZW50ID0gb3BbaV07XG4gICAgc3dpdGNoICh0eXBlb2YgY29tcG9uZW50KSB7XG4gICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICBpZiAoY29tcG9uZW50ID4gc3RyLmxlbmd0aCkgdGhyb3cgRXJyb3IoJ1RoZSBvcCBpcyB0b28gbG9uZyBmb3IgdGhpcyBkb2N1bWVudCcpO1xuXG4gICAgICAgIG5ld0RvYy5wdXNoKHN0ci5zbGljZSgwLCBjb21wb25lbnQpKTtcbiAgICAgICAgLy8gVGhpcyBtaWdodCBiZSBzbG93IGZvciBiaWcgc3RyaW5ncy4gQ29uc2lkZXIgc3RvcmluZyB0aGUgb2Zmc2V0IGluXG4gICAgICAgIC8vIHN0ciBpbnN0ZWFkIG9mIHJld3JpdGluZyBpdCBlYWNoIHRpbWUuXG4gICAgICAgIHN0ciA9IHN0ci5zbGljZShjb21wb25lbnQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgIG5ld0RvYy5wdXNoKGNvbXBvbmVudCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgICAgc3RyID0gc3RyLnNsaWNlKGNvbXBvbmVudC5kKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5ld0RvYy5qb2luKCcnKSArIHN0cjtcbn07XG5cbi8qKiBUcmFuc2Zvcm0gb3AgYnkgb3RoZXJPcC5cbiAqXG4gKiBAcGFyYW0gb3AgLSBUaGUgb3BlcmF0aW9uIHRvIHRyYW5zZm9ybVxuICogQHBhcmFtIG90aGVyT3AgLSBPcGVyYXRpb24gdG8gdHJhbnNmb3JtIGl0IGJ5XG4gKiBAcGFyYW0gc2lkZSAtIEVpdGhlciAnbGVmdCcgb3IgJ3JpZ2h0J1xuICovXG5leHBvcnRzLnRyYW5zZm9ybSA9IGZ1bmN0aW9uKG9wLCBvdGhlck9wLCBzaWRlKSB7XG4gIGlmIChzaWRlICE9ICdsZWZ0JyAmJiBzaWRlICE9ICdyaWdodCcpIHRocm93IEVycm9yKFwic2lkZSAoXCIgKyBzaWRlICsgXCIpIG11c3QgYmUgJ2xlZnQnIG9yICdyaWdodCdcIik7XG5cbiAgY2hlY2tPcChvcCk7XG4gIGNoZWNrT3Aob3RoZXJPcCk7XG5cbiAgdmFyIG5ld09wID0gW107XG4gIHZhciBhcHBlbmQgPSBtYWtlQXBwZW5kKG5ld09wKTtcblxuICB2YXIgX2ZucyA9IG1ha2VUYWtlKG9wKTtcbiAgdmFyIHRha2UgPSBfZm5zWzBdLFxuICAgICAgcGVlayA9IF9mbnNbMV07XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvdGhlck9wLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGNvbXBvbmVudCA9IG90aGVyT3BbaV07XG5cbiAgICB2YXIgbGVuZ3RoLCBjaHVuaztcbiAgICBzd2l0Y2ggKHR5cGVvZiBjb21wb25lbnQpIHtcbiAgICAgIGNhc2UgJ251bWJlcic6IC8vIFNraXBcbiAgICAgICAgbGVuZ3RoID0gY29tcG9uZW50O1xuICAgICAgICB3aGlsZSAobGVuZ3RoID4gMCkge1xuICAgICAgICAgIGNodW5rID0gdGFrZShsZW5ndGgsICdpJyk7XG4gICAgICAgICAgYXBwZW5kKGNodW5rKTtcbiAgICAgICAgICBpZiAodHlwZW9mIGNodW5rICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgbGVuZ3RoIC09IGNvbXBvbmVudExlbmd0aChjaHVuayk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdzdHJpbmcnOiAvLyBJbnNlcnRcbiAgICAgICAgaWYgKHNpZGUgPT09ICdsZWZ0Jykge1xuICAgICAgICAgIC8vIFRoZSBsZWZ0IGluc2VydCBzaG91bGQgZ28gZmlyc3QuXG4gICAgICAgICAgaWYgKHR5cGVvZiBwZWVrKCkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBhcHBlbmQodGFrZSgtMSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE90aGVyd2lzZSBza2lwIHRoZSBpbnNlcnRlZCB0ZXh0LlxuICAgICAgICBhcHBlbmQoY29tcG9uZW50Lmxlbmd0aCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdvYmplY3QnOiAvLyBEZWxldGVcbiAgICAgICAgbGVuZ3RoID0gY29tcG9uZW50LmQ7XG4gICAgICAgIHdoaWxlIChsZW5ndGggPiAwKSB7XG4gICAgICAgICAgY2h1bmsgPSB0YWtlKGxlbmd0aCwgJ2knKTtcbiAgICAgICAgICBzd2l0Y2ggKHR5cGVvZiBjaHVuaykge1xuICAgICAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICAgICAgbGVuZ3RoIC09IGNodW5rO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgICAgIGFwcGVuZChjaHVuayk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgICAgICAgICAgLy8gVGhlIGRlbGV0ZSBpcyB1bm5lY2Vzc2FyeSBub3cgLSB0aGUgdGV4dCBoYXMgYWxyZWFkeSBiZWVuIGRlbGV0ZWQuXG4gICAgICAgICAgICAgIGxlbmd0aCAtPSBjaHVuay5kO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgXG4gIC8vIEFwcGVuZCBhbnkgZXh0cmEgZGF0YSBpbiBvcDEuXG4gIHdoaWxlICgoY29tcG9uZW50ID0gdGFrZSgtMSkpKVxuICAgIGFwcGVuZChjb21wb25lbnQpO1xuICBcbiAgcmV0dXJuIHRyaW0obmV3T3ApO1xufTtcblxuLyoqIENvbXBvc2Ugb3AxIGFuZCBvcDIgdG9nZXRoZXIgYW5kIHJldHVybiB0aGUgcmVzdWx0ICovXG5leHBvcnRzLmNvbXBvc2UgPSBmdW5jdGlvbihvcDEsIG9wMikge1xuICBjaGVja09wKG9wMSk7XG4gIGNoZWNrT3Aob3AyKTtcblxuICB2YXIgcmVzdWx0ID0gW107XG4gIHZhciBhcHBlbmQgPSBtYWtlQXBwZW5kKHJlc3VsdCk7XG4gIHZhciB0YWtlID0gbWFrZVRha2Uob3AxKVswXTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IG9wMi5sZW5ndGg7IGkrKykge1xuICAgIHZhciBjb21wb25lbnQgPSBvcDJbaV07XG4gICAgdmFyIGxlbmd0aCwgY2h1bms7XG4gICAgc3dpdGNoICh0eXBlb2YgY29tcG9uZW50KSB7XG4gICAgICBjYXNlICdudW1iZXInOiAvLyBTa2lwXG4gICAgICAgIGxlbmd0aCA9IGNvbXBvbmVudDtcbiAgICAgICAgd2hpbGUgKGxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjaHVuayA9IHRha2UobGVuZ3RoLCAnZCcpO1xuICAgICAgICAgIGFwcGVuZChjaHVuayk7XG4gICAgICAgICAgaWYgKHR5cGVvZiBjaHVuayAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGxlbmd0aCAtPSBjb21wb25lbnRMZW5ndGgoY2h1bmspO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnc3RyaW5nJzogLy8gSW5zZXJ0XG4gICAgICAgIGFwcGVuZChjb21wb25lbnQpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnb2JqZWN0JzogLy8gRGVsZXRlXG4gICAgICAgIGxlbmd0aCA9IGNvbXBvbmVudC5kO1xuXG4gICAgICAgIHdoaWxlIChsZW5ndGggPiAwKSB7XG4gICAgICAgICAgY2h1bmsgPSB0YWtlKGxlbmd0aCwgJ2QnKTtcblxuICAgICAgICAgIHN3aXRjaCAodHlwZW9mIGNodW5rKSB7XG4gICAgICAgICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICAgICAgICBhcHBlbmQoe2Q6IGNodW5rfSk7XG4gICAgICAgICAgICAgIGxlbmd0aCAtPSBjaHVuaztcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgICBsZW5ndGggLT0gY2h1bmsubGVuZ3RoO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgICAgICAgIGFwcGVuZChjaHVuayk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHdoaWxlICgoY29tcG9uZW50ID0gdGFrZSgtMSkpKVxuICAgIGFwcGVuZChjb21wb25lbnQpO1xuXG4gIHJldHVybiB0cmltKHJlc3VsdCk7XG59O1xuXG5cbnZhciB0cmFuc2Zvcm1Qb3NpdGlvbiA9IGZ1bmN0aW9uKGN1cnNvciwgb3ApIHtcbiAgdmFyIHBvcyA9IDA7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYyA9IG9wW2ldO1xuICAgIGlmIChjdXJzb3IgPD0gcG9zKSBicmVhaztcblxuICAgIC8vIEkgY291bGQgYWN0dWFsbHkgdXNlIHRoZSBvcF9pdGVyIHN0dWZmIGFib3ZlIC0gYnV0IEkgdGhpbmsgaXRzIHNpbXBsZXJcbiAgICAvLyBsaWtlIHRoaXMuXG4gICAgc3dpdGNoICh0eXBlb2YgYykge1xuICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgaWYgKGN1cnNvciA8PSBwb3MgKyBjKVxuICAgICAgICAgIHJldHVybiBjdXJzb3I7XG4gICAgICAgIHBvcyArPSBjO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgcG9zICs9IGMubGVuZ3RoO1xuICAgICAgICBjdXJzb3IgKz0gYy5sZW5ndGg7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICBjdXJzb3IgLT0gTWF0aC5taW4oYy5kLCBjdXJzb3IgLSBwb3MpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGN1cnNvcjtcbn07XG5cbmV4cG9ydHMudHJhbnNmb3JtU2VsZWN0aW9uID0gZnVuY3Rpb24oc2VsZWN0aW9uLCBvcCwgaXNPd25PcCkge1xuICB2YXIgcG9zID0gMDtcbiAgaWYgKGlzT3duT3ApIHtcbiAgICAvLyBKdXN0IHRyYWNrIHRoZSBwb3NpdGlvbi4gV2UnbGwgdGVsZXBvcnQgdGhlIGN1cnNvciB0byB0aGUgZW5kIGFueXdheS5cbiAgICAvLyBUaGlzIHdvcmtzIGJlY2F1c2UgdGV4dCBvcHMgZG9uJ3QgaGF2ZSBhbnkgdHJhaWxpbmcgc2tpcHMgYXQgdGhlIGVuZCAtIHNvIHRoZSBsYXN0XG4gICAgLy8gY29tcG9uZW50IGlzIHRoZSBsYXN0IHRoaW5nLlxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBjID0gb3BbaV07XG4gICAgICBzd2l0Y2ggKHR5cGVvZiBjKSB7XG4gICAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAgICAgcG9zICs9IGM7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgcG9zICs9IGMubGVuZ3RoO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvLyBKdXN0IGVhdCBkZWxldGVzLlxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcG9zO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB0eXBlb2Ygc2VsZWN0aW9uID09PSAnbnVtYmVyJyA/XG4gICAgICB0cmFuc2Zvcm1Qb3NpdGlvbihzZWxlY3Rpb24sIG9wKSA6IFt0cmFuc2Zvcm1Qb3NpdGlvbihzZWxlY3Rpb25bMF0sIG9wKSwgdHJhbnNmb3JtUG9zaXRpb24oc2VsZWN0aW9uWzFdLCBvcCldO1xuICB9XG59O1xuXG5leHBvcnRzLnNlbGVjdGlvbkVxID0gZnVuY3Rpb24oYzEsIGMyKSB7XG4gIGlmIChjMVswXSAhPSBudWxsICYmIGMxWzBdID09PSBjMVsxXSkgYzEgPSBjMVswXTtcbiAgaWYgKGMyWzBdICE9IG51bGwgJiYgYzJbMF0gPT09IGMyWzFdKSBjMiA9IGMyWzBdO1xuICByZXR1cm4gYzEgPT09IGMyIHx8IChjMVswXSAhPSBudWxsICYmIGMyWzBdICE9IG51bGwgJiYgYzFbMF0gPT09IGMyWzBdICYmIGMxWzFdID09IGMyWzFdKTtcbn07XG5cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCJnbG9iYWwuc2hhcmVkYj1yZXF1aXJlKFwiLi4vc2VydmVyL3ZlbmRvci9zaGFyZWRiL2xpYi9jbGllbnRcIilcbmdsb2JhbC5vdFRleHQgPSByZXF1aXJlKCdvdC10ZXh0Jyk7XG5zaGFyZWRiLnR5cGVzLnJlZ2lzdGVyKG90VGV4dC50eXBlKTtcblxuXG5zaGFyZWRiLnR5cGVzLm1hcFsnanNvbjAnXS5yZWdpc3RlclN1YnR5cGUob3RUZXh0LnR5cGUpO1xuIiwidmFyIERvYyA9IHJlcXVpcmUoJy4vZG9jJyk7XG52YXIgUXVlcnkgPSByZXF1aXJlKCcuL3F1ZXJ5Jyk7XG52YXIgZW1pdHRlciA9IHJlcXVpcmUoJy4uL2VtaXR0ZXInKTtcbnZhciBTaGFyZURCRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvcicpO1xudmFyIHR5cGVzID0gcmVxdWlyZSgnLi4vdHlwZXMnKTtcbnZhciB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuXG4vKipcbiAqIEhhbmRsZXMgY29tbXVuaWNhdGlvbiB3aXRoIHRoZSBzaGFyZWpzIHNlcnZlciBhbmQgcHJvdmlkZXMgcXVlcmllcyBhbmRcbiAqIGRvY3VtZW50cy5cbiAqXG4gKiBXZSBjcmVhdGUgYSBjb25uZWN0aW9uIHdpdGggYSBzb2NrZXQgb2JqZWN0XG4gKiAgIGNvbm5lY3Rpb24gPSBuZXcgc2hhcmVqcy5Db25uZWN0aW9uKHNvY2tzZXQpXG4gKiBUaGUgc29ja2V0IG1heSBiZSBhbnkgb2JqZWN0IGhhbmRsaW5nIHRoZSB3ZWJzb2NrZXQgcHJvdG9jb2wuIFNlZSB0aGVcbiAqIGRvY3VtZW50YXRpb24gb2YgYmluZFRvU29ja2V0KCkgZm9yIGRldGFpbHMuIFdlIHRoZW4gd2FpdCBmb3IgdGhlIGNvbm5lY3Rpb25cbiAqIHRvIGNvbm5lY3RcbiAqICAgY29ubmVjdGlvbi5vbignY29ubmVjdGVkJywgLi4uKVxuICogYW5kIGFyZSBmaW5hbGx5IGFibGUgdG8gd29yayB3aXRoIHNoYXJlZCBkb2N1bWVudHNcbiAqICAgY29ubmVjdGlvbi5nZXQoJ2Zvb2QnLCAnc3RlYWsnKSAvLyBEb2NcbiAqXG4gKiBAcGFyYW0gc29ja2V0IEBzZWUgYmluZFRvU29ja2V0XG4gKi9cbm1vZHVsZS5leHBvcnRzID0gQ29ubmVjdGlvbjtcbmZ1bmN0aW9uIENvbm5lY3Rpb24oc29ja2V0KSB7XG4gIGVtaXR0ZXIuRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG5cbiAgLy8gTWFwIG9mIGNvbGxlY3Rpb24gLT4gaWQgLT4gZG9jIG9iamVjdCBmb3IgY3JlYXRlZCBkb2N1bWVudHMuXG4gIC8vIChjcmVhdGVkIGRvY3VtZW50cyBNVVNUIEJFIFVOSVFVRSlcbiAgdGhpcy5jb2xsZWN0aW9ucyA9IHt9O1xuXG4gIC8vIEVhY2ggcXVlcnkgaXMgY3JlYXRlZCB3aXRoIGFuIGlkIHRoYXQgdGhlIHNlcnZlciB1c2VzIHdoZW4gaXQgc2VuZHMgdXNcbiAgLy8gaW5mbyBhYm91dCB0aGUgcXVlcnkgKHVwZGF0ZXMsIGV0YylcbiAgdGhpcy5uZXh0UXVlcnlJZCA9IDE7XG5cbiAgLy8gTWFwIGZyb20gcXVlcnkgSUQgLT4gcXVlcnkgb2JqZWN0LlxuICB0aGlzLnF1ZXJpZXMgPSB7fTtcblxuICAvLyBBIHVuaXF1ZSBtZXNzYWdlIG51bWJlciBmb3IgdGhlIGdpdmVuIGlkXG4gIHRoaXMuc2VxID0gMTtcblxuICAvLyBFcXVhbHMgYWdlbnQuY2xpZW50SWQgb24gdGhlIHNlcnZlclxuICB0aGlzLmlkID0gbnVsbDtcblxuICAvLyBUaGlzIGRpcmVjdCByZWZlcmVuY2UgZnJvbSBjb25uZWN0aW9uIHRvIGFnZW50IGlzIG5vdCB1c2VkIGludGVybmFsIHRvXG4gIC8vIFNoYXJlREIsIGJ1dCBpdCBpcyBoYW5keSBmb3Igc2VydmVyLXNpZGUgb25seSB1c2VyIGNvZGUgdGhhdCBtYXkgY2FjaGVcbiAgLy8gc3RhdGUgb24gdGhlIGFnZW50IGFuZCByZWFkIGl0IGluIG1pZGRsZXdhcmVcbiAgdGhpcy5hZ2VudCA9IG51bGw7XG5cbiAgdGhpcy5kZWJ1ZyA9IHRydWU7XG5cbiAgdGhpcy5iaW5kVG9Tb2NrZXQoc29ja2V0KTtcbn1cbmVtaXR0ZXIubWl4aW4oQ29ubmVjdGlvbik7XG5cblxuLyoqXG4gKiBVc2Ugc29ja2V0IHRvIGNvbW11bmljYXRlIHdpdGggc2VydmVyXG4gKlxuICogU29ja2V0IGlzIGFuIG9iamVjdCB0aGF0IGNhbiBoYW5kbGUgdGhlIHdlYnNvY2tldCBwcm90b2NvbC4gVGhpcyBtZXRob2RcbiAqIGluc3RhbGxzIHRoZSBvbm9wZW4sIG9uY2xvc2UsIG9ubWVzc2FnZSBhbmQgb25lcnJvciBoYW5kbGVycyBvbiB0aGUgc29ja2V0IHRvXG4gKiBoYW5kbGUgY29tbXVuaWNhdGlvbiBhbmQgc2VuZHMgbWVzc2FnZXMgYnkgY2FsbGluZyBzb2NrZXQuc2VuZChtZXNzYWdlKS4gVGhlXG4gKiBzb2NrZXRzIGByZWFkeVN0YXRlYCBwcm9wZXJ0eSBpcyB1c2VkIHRvIGRldGVybWluZSB0aGUgaW5pdGFpYWwgc3RhdGUuXG4gKlxuICogQHBhcmFtIHNvY2tldCBIYW5kbGVzIHRoZSB3ZWJzb2NrZXQgcHJvdG9jb2xcbiAqIEBwYXJhbSBzb2NrZXQucmVhZHlTdGF0ZVxuICogQHBhcmFtIHNvY2tldC5jbG9zZVxuICogQHBhcmFtIHNvY2tldC5zZW5kXG4gKiBAcGFyYW0gc29ja2V0Lm9ub3BlblxuICogQHBhcmFtIHNvY2tldC5vbmNsb3NlXG4gKiBAcGFyYW0gc29ja2V0Lm9ubWVzc2FnZVxuICogQHBhcmFtIHNvY2tldC5vbmVycm9yXG4gKi9cbkNvbm5lY3Rpb24ucHJvdG90eXBlLmJpbmRUb1NvY2tldCA9IGZ1bmN0aW9uKHNvY2tldCkge1xuICBpZiAodGhpcy5zb2NrZXQpIHtcbiAgICB0aGlzLnNvY2tldC5jbG9zZSgpO1xuICAgIHRoaXMuc29ja2V0Lm9ubWVzc2FnZSA9IG51bGw7XG4gICAgdGhpcy5zb2NrZXQub25vcGVuID0gbnVsbDtcbiAgICB0aGlzLnNvY2tldC5vbmVycm9yID0gbnVsbDtcbiAgICB0aGlzLnNvY2tldC5vbmNsb3NlID0gbnVsbDtcbiAgfVxuXG4gIHRoaXMuc29ja2V0ID0gc29ja2V0O1xuXG4gIC8vIFN0YXRlIG9mIHRoZSBjb25uZWN0aW9uLiBUaGUgY29ycmVzcG9kaW5nIGV2ZW50cyBhcmUgZW1taXRlZCB3aGVuIHRoaXMgY2hhbmdlc1xuICAvL1xuICAvLyAtICdjb25uZWN0aW5nJyAgIFRoZSBjb25uZWN0aW9uIGlzIHN0aWxsIGJlaW5nIGVzdGFibGlzaGVkLCBvciB3ZSBhcmUgc3RpbGxcbiAgLy8gICAgICAgICAgICAgICAgICAgIHdhaXRpbmcgb24gdGhlIHNlcnZlciB0byBzZW5kIHVzIHRoZSBpbml0aWFsaXphdGlvbiBtZXNzYWdlXG4gIC8vIC0gJ2Nvbm5lY3RlZCcgICAgVGhlIGNvbm5lY3Rpb24gaXMgb3BlbiBhbmQgd2UgaGF2ZSBjb25uZWN0ZWQgdG8gYSBzZXJ2ZXJcbiAgLy8gICAgICAgICAgICAgICAgICAgIGFuZCByZWNpZXZlZCB0aGUgaW5pdGlhbGl6YXRpb24gbWVzc2FnZVxuICAvLyAtICdkaXNjb25uZWN0ZWQnIENvbm5lY3Rpb24gaXMgY2xvc2VkLCBidXQgaXQgd2lsbCByZWNvbm5lY3QgYXV0b21hdGljYWxseVxuICAvLyAtICdjbG9zZWQnICAgICAgIFRoZSBjb25uZWN0aW9uIHdhcyBjbG9zZWQgYnkgdGhlIGNsaWVudCwgYW5kIHdpbGwgbm90IHJlY29ubmVjdFxuICAvLyAtICdzdG9wcGVkJyAgICAgIFRoZSBjb25uZWN0aW9uIHdhcyBjbG9zZWQgYnkgdGhlIHNlcnZlciwgYW5kIHdpbGwgbm90IHJlY29ubmVjdFxuICB0aGlzLnN0YXRlID0gKHNvY2tldC5yZWFkeVN0YXRlID09PSAwIHx8IHNvY2tldC5yZWFkeVN0YXRlID09PSAxKSA/ICdjb25uZWN0aW5nJyA6ICdkaXNjb25uZWN0ZWQnO1xuXG4gIC8vIFRoaXMgaXMgYSBoZWxwZXIgdmFyaWFibGUgdGhlIGRvY3VtZW50IHVzZXMgdG8gc2VlIHdoZXRoZXIgd2UncmVcbiAgLy8gY3VycmVudGx5IGluIGEgJ2xpdmUnIHN0YXRlLiBJdCBpcyB0cnVlIGlmIGFuZCBvbmx5IGlmIHdlJ3JlIGNvbm5lY3RlZFxuICB0aGlzLmNhblNlbmQgPSBmYWxzZTtcblxuICB2YXIgY29ubmVjdGlvbiA9IHRoaXM7XG5cbiAgc29ja2V0Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdHJ5IHtcbiAgICAgIHZhciBkYXRhID0gKHR5cGVvZiBldmVudC5kYXRhID09PSAnc3RyaW5nJykgP1xuICAgICAgICBKU09OLnBhcnNlKGV2ZW50LmRhdGEpIDogZXZlbnQuZGF0YTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUud2FybignRmFpbGVkIHRvIHBhcnNlIG1lc3NhZ2UnLCBldmVudCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGNvbm5lY3Rpb24uZGVidWcpIGNvbnNvbGUubG9nKCdSRUNWJywgSlNPTi5zdHJpbmdpZnkoZGF0YSkpO1xuXG4gICAgdmFyIHJlcXVlc3QgPSB7ZGF0YTogZGF0YX07XG4gICAgY29ubmVjdGlvbi5lbWl0KCdyZWNlaXZlJywgcmVxdWVzdCk7XG4gICAgaWYgKCFyZXF1ZXN0LmRhdGEpIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICBjb25uZWN0aW9uLmhhbmRsZU1lc3NhZ2UocmVxdWVzdC5kYXRhKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbm5lY3Rpb24uZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xuXG4gIHNvY2tldC5vbm9wZW4gPSBmdW5jdGlvbigpIHtcbiAgICBjb25uZWN0aW9uLl9zZXRTdGF0ZSgnY29ubmVjdGluZycpO1xuICB9O1xuXG4gIHNvY2tldC5vbmVycm9yID0gZnVuY3Rpb24oZXJyKSB7XG4gICAgLy8gVGhpcyBpc24ndCB0aGUgc2FtZSBhcyBhIHJlZ3VsYXIgZXJyb3IsIGJlY2F1c2UgaXQgd2lsbCBoYXBwZW4gbm9ybWFsbHlcbiAgICAvLyBmcm9tIHRpbWUgdG8gdGltZS4gWW91ciBjb25uZWN0aW9uIHNob3VsZCBwcm9iYWJseSBhdXRvbWF0aWNhbGx5XG4gICAgLy8gcmVjb25uZWN0IGFueXdheSwgYnV0IHRoYXQgc2hvdWxkIGJlIHRyaWdnZXJlZCBvZmYgb25jbG9zZSBub3Qgb25lcnJvci5cbiAgICAvLyAob25jbG9zZSBoYXBwZW5zIHdoZW4gb25lcnJvciBnZXRzIGNhbGxlZCBhbnl3YXkpLlxuICAgIGNvbm5lY3Rpb24uZW1pdCgnY29ubmVjdGlvbiBlcnJvcicsIGVycik7XG4gIH07XG5cbiAgc29ja2V0Lm9uY2xvc2UgPSBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAvLyBub2RlLWJyb3dzZXJjaGFubmVsIHJlYXNvbiB2YWx1ZXM6XG4gICAgLy8gICAnQ2xvc2VkJyAtIFRoZSBzb2NrZXQgd2FzIG1hbnVhbGx5IGNsb3NlZCBieSBjYWxsaW5nIHNvY2tldC5jbG9zZSgpXG4gICAgLy8gICAnU3RvcHBlZCBieSBzZXJ2ZXInIC0gVGhlIHNlcnZlciBzZW50IHRoZSBzdG9wIG1lc3NhZ2UgdG8gdGVsbCB0aGUgY2xpZW50IG5vdCB0byB0cnkgY29ubmVjdGluZ1xuICAgIC8vICAgJ1JlcXVlc3QgZmFpbGVkJyAtIFNlcnZlciBkaWRuJ3QgcmVzcG9uZCB0byByZXF1ZXN0ICh0ZW1wb3JhcnksIHVzdWFsbHkgb2ZmbGluZSlcbiAgICAvLyAgICdVbmtub3duIHNlc3Npb24gSUQnIC0gU2VydmVyIHNlc3Npb24gZm9yIGNsaWVudCBpcyBtaXNzaW5nICh0ZW1wb3JhcnksIHdpbGwgaW1tZWRpYXRlbHkgcmVlc3RhYmxpc2gpXG5cbiAgICBpZiAocmVhc29uID09PSAnY2xvc2VkJyB8fCByZWFzb24gPT09ICdDbG9zZWQnKSB7XG4gICAgICBjb25uZWN0aW9uLl9zZXRTdGF0ZSgnY2xvc2VkJywgcmVhc29uKTtcblxuICAgIH0gZWxzZSBpZiAocmVhc29uID09PSAnc3RvcHBlZCcgfHwgcmVhc29uID09PSAnU3RvcHBlZCBieSBzZXJ2ZXInKSB7XG4gICAgICBjb25uZWN0aW9uLl9zZXRTdGF0ZSgnc3RvcHBlZCcsIHJlYXNvbik7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgY29ubmVjdGlvbi5fc2V0U3RhdGUoJ2Rpc2Nvbm5lY3RlZCcsIHJlYXNvbik7XG4gICAgfVxuICB9O1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge29iamVjdH0gbWVzc2FnZVxuICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UuYSBhY3Rpb25cbiAqL1xuQ29ubmVjdGlvbi5wcm90b3R5cGUuaGFuZGxlTWVzc2FnZSA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgY29uc29sZS5sb2cobWVzc2FnZSlcbiAgdmFyIGVyciA9IG51bGw7XG4gIGlmIChtZXNzYWdlLmVycm9yKSB7XG4gICAgLy8gd3JhcCBpbiBFcnJvciBvYmplY3Qgc28gY2FuIGJlIHBhc3NlZCB0aHJvdWdoIGV2ZW50IGVtaXR0ZXJzXG4gICAgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UuZXJyb3IubWVzc2FnZSk7XG4gICAgZXJyLmNvZGUgPSBtZXNzYWdlLmVycm9yLmNvZGU7XG4gICAgLy8gQWRkIHRoZSBtZXNzYWdlIGRhdGEgdG8gdGhlIGVycm9yIG9iamVjdCBmb3IgbW9yZSBjb250ZXh0XG4gICAgZXJyLmRhdGEgPSBtZXNzYWdlO1xuICAgIGRlbGV0ZSBtZXNzYWdlLmVycm9yO1xuICB9XG4gIC8vIFN3aXRjaCBvbiB0aGUgbWVzc2FnZSBhY3Rpb24uIE1vc3QgbWVzc2FnZXMgYXJlIGZvciBkb2N1bWVudHMgYW5kIGFyZVxuICAvLyBoYW5kbGVkIGluIHRoZSBkb2MgY2xhc3MuXG4gIHN3aXRjaCAobWVzc2FnZS5hKSB7XG4gICAgY2FzZSAnaW5pdCc6XG4gICAgICAvLyBDbGllbnQgaW5pdGlhbGl6YXRpb24gcGFja2V0XG4gICAgICBpZiAobWVzc2FnZS5wcm90b2NvbCAhPT0gMSkge1xuICAgICAgICBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDQwMTksICdJbnZhbGlkIHByb3RvY29sIHZlcnNpb24nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVzLm1hcFttZXNzYWdlLnR5cGVdICE9PSB0eXBlcy5kZWZhdWx0VHlwZSkge1xuICAgICAgICBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDQwMjAsICdJbnZhbGlkIGRlZmF1bHQgdHlwZScpO1xuICAgICAgICByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIG1lc3NhZ2UuaWQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGVyciA9IG5ldyBTaGFyZURCRXJyb3IoNDAyMSwgJ0ludmFsaWQgY2xpZW50IGlkJyk7XG4gICAgICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuaWQgPSBtZXNzYWdlLmlkO1xuXG4gICAgICB0aGlzLl9zZXRTdGF0ZSgnY29ubmVjdGVkJyk7XG4gICAgICByZXR1cm47XG5cbiAgICBjYXNlICdxZic6XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbbWVzc2FnZS5pZF07XG4gICAgICBpZiAocXVlcnkpIHF1ZXJ5Ll9oYW5kbGVGZXRjaChlcnIsIG1lc3NhZ2UuZGF0YSwgbWVzc2FnZS5leHRyYSk7XG4gICAgICByZXR1cm47XG4gICAgY2FzZSAncXMnOlxuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW21lc3NhZ2UuaWRdO1xuICAgICAgaWYgKHF1ZXJ5KSBxdWVyeS5faGFuZGxlU3Vic2NyaWJlKGVyciwgbWVzc2FnZS5kYXRhLCBtZXNzYWdlLmV4dHJhKTtcbiAgICAgIHJldHVybjtcbiAgICBjYXNlICdxdSc6XG4gICAgICAvLyBRdWVyaWVzIGFyZSByZW1vdmVkIGltbWVkaWF0ZWx5IG9uIGNhbGxzIHRvIGRlc3Ryb3ksIHNvIHdlIGlnbm9yZVxuICAgICAgLy8gcmVwbGllcyB0byBxdWVyeSB1bnN1YnNjcmliZXMuIFBlcmhhcHMgdGhlcmUgc2hvdWxkIGJlIGEgY2FsbGJhY2sgZm9yXG4gICAgICAvLyBkZXN0cm95LCBidXQgdGhpcyBpcyBjdXJyZW50bHkgdW5pbXBsZW1lbnRlZFxuICAgICAgcmV0dXJuO1xuICAgIGNhc2UgJ3EnOlxuICAgICAgLy8gUXVlcnkgbWVzc2FnZS4gUGFzcyB0aGlzIHRvIHRoZSBhcHByb3ByaWF0ZSBxdWVyeSBvYmplY3QuXG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbbWVzc2FnZS5pZF07XG4gICAgICBpZiAoIXF1ZXJ5KSByZXR1cm47XG4gICAgICBpZiAoZXJyKSByZXR1cm4gcXVlcnkuX2hhbmRsZUVycm9yKGVycik7XG4gICAgICBpZiAobWVzc2FnZS5kaWZmKSBxdWVyeS5faGFuZGxlRGlmZihtZXNzYWdlLmRpZmYpO1xuICAgICAgaWYgKG1lc3NhZ2UuaGFzT3duUHJvcGVydHkoJ2V4dHJhJykpIHF1ZXJ5Ll9oYW5kbGVFeHRyYShtZXNzYWdlLmV4dHJhKTtcbiAgICAgIHJldHVybjtcblxuICAgIGNhc2UgJ2JmJzpcbiAgICAgIHJldHVybiB0aGlzLl9oYW5kbGVCdWxrTWVzc2FnZShtZXNzYWdlLCAnX2hhbmRsZUZldGNoJyk7XG4gICAgY2FzZSAnYnMnOlxuICAgICAgcmV0dXJuIHRoaXMuX2hhbmRsZUJ1bGtNZXNzYWdlKG1lc3NhZ2UsICdfaGFuZGxlU3Vic2NyaWJlJyk7XG4gICAgY2FzZSAnYnUnOlxuICAgICAgcmV0dXJuIHRoaXMuX2hhbmRsZUJ1bGtNZXNzYWdlKG1lc3NhZ2UsICdfaGFuZGxlVW5zdWJzY3JpYmUnKTtcblxuICAgIGNhc2UgJ2YnOlxuICAgICAgdmFyIGRvYyA9IHRoaXMuZ2V0RXhpc3RpbmcobWVzc2FnZS5jLCBtZXNzYWdlLmQpO1xuICAgICAgaWYgKGRvYykgZG9jLl9oYW5kbGVGZXRjaChlcnIsIG1lc3NhZ2UuZGF0YSk7XG4gICAgICByZXR1cm47XG4gICAgY2FzZSAncyc6XG4gICAgICB2YXIgZG9jID0gdGhpcy5nZXRFeGlzdGluZyhtZXNzYWdlLmMsIG1lc3NhZ2UuZCk7XG4gICAgICBpZiAoZG9jKSBkb2MuX2hhbmRsZVN1YnNjcmliZShlcnIsIG1lc3NhZ2UuZGF0YSk7XG4gICAgICByZXR1cm47XG4gICAgY2FzZSAndSc6XG4gICAgICB2YXIgZG9jID0gdGhpcy5nZXRFeGlzdGluZyhtZXNzYWdlLmMsIG1lc3NhZ2UuZCk7XG4gICAgICBpZiAoZG9jKSBkb2MuX2hhbmRsZVVuc3Vic2NyaWJlKGVycik7XG4gICAgICByZXR1cm47XG4gICAgY2FzZSAnb3AnOlxuICAgICAgdmFyIGRvYyA9IHRoaXMuZ2V0RXhpc3RpbmcobWVzc2FnZS5jLCBtZXNzYWdlLmQpO1xuICAgICAgaWYgKGRvYykgZG9jLl9oYW5kbGVPcChlcnIsIG1lc3NhZ2UpO1xuICAgICAgcmV0dXJuO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIGNvbnNvbGUud2FybignSWdub3JuaW5nIHVucmVjb2duaXplZCBtZXNzYWdlJywgbWVzc2FnZSk7XG4gIH1cbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLl9oYW5kbGVCdWxrTWVzc2FnZSA9IGZ1bmN0aW9uKG1lc3NhZ2UsIG1ldGhvZCkge1xuICBpZiAobWVzc2FnZS5kYXRhKSB7XG4gICAgZm9yICh2YXIgaWQgaW4gbWVzc2FnZS5kYXRhKSB7XG4gICAgICB2YXIgZG9jID0gdGhpcy5nZXRFeGlzdGluZyhtZXNzYWdlLmMsIGlkKTtcbiAgICAgIGlmIChkb2MpIGRvY1ttZXRob2RdKG1lc3NhZ2UuZXJyb3IsIG1lc3NhZ2UuZGF0YVtpZF0pO1xuICAgIH1cbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KG1lc3NhZ2UuYikpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1lc3NhZ2UuYi5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGlkID0gbWVzc2FnZS5iW2ldO1xuICAgICAgdmFyIGRvYyA9IHRoaXMuZ2V0RXhpc3RpbmcobWVzc2FnZS5jLCBpZCk7XG4gICAgICBpZiAoZG9jKSBkb2NbbWV0aG9kXShtZXNzYWdlLmVycm9yKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAobWVzc2FnZS5iKSB7XG4gICAgZm9yICh2YXIgaWQgaW4gbWVzc2FnZS5iKSB7XG4gICAgICB2YXIgZG9jID0gdGhpcy5nZXRFeGlzdGluZyhtZXNzYWdlLmMsIGlkKTtcbiAgICAgIGlmIChkb2MpIGRvY1ttZXRob2RdKG1lc3NhZ2UuZXJyb3IpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmVycm9yKCdJbnZhbGlkIGJ1bGsgbWVzc2FnZScsIG1lc3NhZ2UpO1xuICB9XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fcmVzZXQgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5zZXEgPSAxO1xuICB0aGlzLmlkID0gbnVsbDtcbiAgdGhpcy5hZ2VudCA9IG51bGw7XG59O1xuXG4vLyBTZXQgdGhlIGNvbm5lY3Rpb24ncyBzdGF0ZS4gVGhlIGNvbm5lY3Rpb24gaXMgYmFzaWNhbGx5IGEgc3RhdGUgbWFjaGluZS5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLl9zZXRTdGF0ZSA9IGZ1bmN0aW9uKG5ld1N0YXRlLCByZWFzb24pIHtcbiAgaWYgKHRoaXMuc3RhdGUgPT09IG5ld1N0YXRlKSByZXR1cm47XG5cbiAgLy8gSSBtYWRlIGEgc3RhdGUgZGlhZ3JhbS4gVGhlIG9ubHkgaW52YWxpZCB0cmFuc2l0aW9ucyBhcmUgZ2V0dGluZyB0b1xuICAvLyAnY29ubmVjdGluZycgZnJvbSBhbnl3aGVyZSBvdGhlciB0aGFuICdkaXNjb25uZWN0ZWQnIGFuZCBnZXR0aW5nIHRvXG4gIC8vICdjb25uZWN0ZWQnIGZyb20gYW55d2hlcmUgb3RoZXIgdGhhbiAnY29ubmVjdGluZycuXG4gIGlmIChcbiAgICAobmV3U3RhdGUgPT09ICdjb25uZWN0aW5nJyAmJiB0aGlzLnN0YXRlICE9PSAnZGlzY29ubmVjdGVkJyAmJiB0aGlzLnN0YXRlICE9PSAnc3RvcHBlZCcgJiYgdGhpcy5zdGF0ZSAhPT0gJ2Nsb3NlZCcpIHx8XG4gICAgKG5ld1N0YXRlID09PSAnY29ubmVjdGVkJyAmJiB0aGlzLnN0YXRlICE9PSAnY29ubmVjdGluZycpXG4gICkge1xuICAgIHZhciBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDUwMDcsICdDYW5ub3QgdHJhbnNpdGlvbiBkaXJlY3RseSBmcm9tICcgKyB0aGlzLnN0YXRlICsgJyB0byAnICsgbmV3U3RhdGUpO1xuICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgfVxuXG4gIHRoaXMuc3RhdGUgPSBuZXdTdGF0ZTtcbiAgdGhpcy5jYW5TZW5kID0gKG5ld1N0YXRlID09PSAnY29ubmVjdGVkJyk7XG5cbiAgaWYgKG5ld1N0YXRlID09PSAnZGlzY29ubmVjdGVkJyB8fCBuZXdTdGF0ZSA9PT0gJ3N0b3BwZWQnIHx8IG5ld1N0YXRlID09PSAnY2xvc2VkJykgdGhpcy5fcmVzZXQoKTtcblxuICAvLyBHcm91cCBzdWJzY3JpYmVzIHRvZ2V0aGVyIHRvIGhlbHAgc2VydmVyIG1ha2UgbW9yZSBlZmZpY2llbnQgY2FsbHNcbiAgdGhpcy5zdGFydEJ1bGsoKTtcbiAgLy8gRW1pdCB0aGUgZXZlbnQgdG8gYWxsIHF1ZXJpZXNcbiAgZm9yICh2YXIgaWQgaW4gdGhpcy5xdWVyaWVzKSB7XG4gICAgdmFyIHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW2lkXTtcbiAgICBxdWVyeS5fb25Db25uZWN0aW9uU3RhdGVDaGFuZ2VkKCk7XG4gIH1cbiAgLy8gRW1pdCB0aGUgZXZlbnQgdG8gYWxsIGRvY3VtZW50c1xuICBmb3IgKHZhciBjb2xsZWN0aW9uIGluIHRoaXMuY29sbGVjdGlvbnMpIHtcbiAgICB2YXIgZG9jcyA9IHRoaXMuY29sbGVjdGlvbnNbY29sbGVjdGlvbl07XG4gICAgZm9yICh2YXIgaWQgaW4gZG9jcykge1xuICAgICAgZG9jc1tpZF0uX29uQ29ubmVjdGlvblN0YXRlQ2hhbmdlZCgpO1xuICAgIH1cbiAgfVxuICB0aGlzLmVuZEJ1bGsoKTtcblxuICB0aGlzLmVtaXQobmV3U3RhdGUsIHJlYXNvbik7XG4gIHRoaXMuZW1pdCgnc3RhdGUnLCBuZXdTdGF0ZSwgcmVhc29uKTtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLnN0YXJ0QnVsayA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMuYnVsaykgdGhpcy5idWxrID0ge307XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5lbmRCdWxrID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLmJ1bGspIHtcbiAgICBmb3IgKHZhciBjb2xsZWN0aW9uIGluIHRoaXMuYnVsaykge1xuICAgICAgdmFyIGFjdGlvbnMgPSB0aGlzLmJ1bGtbY29sbGVjdGlvbl07XG4gICAgICB0aGlzLl9zZW5kQnVsaygnZicsIGNvbGxlY3Rpb24sIGFjdGlvbnMuZik7XG4gICAgICB0aGlzLl9zZW5kQnVsaygncycsIGNvbGxlY3Rpb24sIGFjdGlvbnMucyk7XG4gICAgICB0aGlzLl9zZW5kQnVsaygndScsIGNvbGxlY3Rpb24sIGFjdGlvbnMudSk7XG4gICAgfVxuICB9XG4gIHRoaXMuYnVsayA9IG51bGw7XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fc2VuZEJ1bGsgPSBmdW5jdGlvbihhY3Rpb24sIGNvbGxlY3Rpb24sIHZhbHVlcykge1xuICBpZiAoIXZhbHVlcykgcmV0dXJuO1xuICB2YXIgaWRzID0gW107XG4gIHZhciB2ZXJzaW9ucyA9IHt9O1xuICB2YXIgdmVyc2lvbnNDb3VudCA9IDA7XG4gIHZhciB2ZXJzaW9uSWQ7XG4gIGZvciAodmFyIGlkIGluIHZhbHVlcykge1xuICAgIHZhciB2YWx1ZSA9IHZhbHVlc1tpZF07XG4gICAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICAgIGlkcy5wdXNoKGlkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmVyc2lvbnNbaWRdID0gdmFsdWU7XG4gICAgICB2ZXJzaW9uSWQgPSBpZDtcbiAgICAgIHZlcnNpb25zQ291bnQrKztcbiAgICB9XG4gIH1cbiAgaWYgKGlkcy5sZW5ndGggPT09IDEpIHtcbiAgICB2YXIgaWQgPSBpZHNbMF07XG4gICAgdGhpcy5zZW5kKHthOiBhY3Rpb24sIGM6IGNvbGxlY3Rpb24sIGQ6IGlkfSk7XG4gIH0gZWxzZSBpZiAoaWRzLmxlbmd0aCkge1xuICAgIHRoaXMuc2VuZCh7YTogJ2InICsgYWN0aW9uLCBjOiBjb2xsZWN0aW9uLCBiOiBpZHN9KTtcbiAgfVxuICBpZiAodmVyc2lvbnNDb3VudCA9PT0gMSkge1xuICAgIHZhciB2ZXJzaW9uID0gdmVyc2lvbnNbdmVyc2lvbklkXTtcbiAgICB0aGlzLnNlbmQoe2E6IGFjdGlvbiwgYzogY29sbGVjdGlvbiwgZDogdmVyc2lvbklkLCB2OiB2ZXJzaW9ufSk7XG4gIH0gZWxzZSBpZiAodmVyc2lvbnNDb3VudCkge1xuICAgIHRoaXMuc2VuZCh7YTogJ2InICsgYWN0aW9uLCBjOiBjb2xsZWN0aW9uLCBiOiB2ZXJzaW9uc30pO1xuICB9XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fc2VuZEFjdGlvbiA9IGZ1bmN0aW9uKGFjdGlvbiwgZG9jLCB2ZXJzaW9uKSB7XG4gIC8vIEVuc3VyZSB0aGUgZG9jIGlzIHJlZ2lzdGVyZWQgc28gdGhhdCBpdCByZWNlaXZlcyB0aGUgcmVwbHkgbWVzc2FnZVxuICB0aGlzLl9hZGREb2MoZG9jKTtcbiAgaWYgKHRoaXMuYnVsaykge1xuICAgIC8vIEJ1bGsgc3Vic2NyaWJlXG4gICAgdmFyIGFjdGlvbnMgPSB0aGlzLmJ1bGtbZG9jLmNvbGxlY3Rpb25dIHx8ICh0aGlzLmJ1bGtbZG9jLmNvbGxlY3Rpb25dID0ge30pO1xuICAgIHZhciB2ZXJzaW9ucyA9IGFjdGlvbnNbYWN0aW9uXSB8fCAoYWN0aW9uc1thY3Rpb25dID0ge30pO1xuICAgIHZhciBpc0R1cGxpY2F0ZSA9IHZlcnNpb25zLmhhc093blByb3BlcnR5KGRvYy5pZCk7XG4gICAgdmVyc2lvbnNbZG9jLmlkXSA9IHZlcnNpb247XG4gICAgcmV0dXJuIGlzRHVwbGljYXRlO1xuICB9IGVsc2Uge1xuICAgIC8vIFNlbmQgc2luZ2xlIGRvYyBzdWJzY3JpYmUgbWVzc2FnZVxuICAgIHZhciBtZXNzYWdlID0ge2E6IGFjdGlvbiwgYzogZG9jLmNvbGxlY3Rpb24sIGQ6IGRvYy5pZCwgdjogdmVyc2lvbn07XG4gICAgdGhpcy5zZW5kKG1lc3NhZ2UpO1xuICB9XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5zZW5kRmV0Y2ggPSBmdW5jdGlvbihkb2MpIHtcbiAgcmV0dXJuIHRoaXMuX3NlbmRBY3Rpb24oJ2YnLCBkb2MsIGRvYy52ZXJzaW9uKTtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLnNlbmRTdWJzY3JpYmUgPSBmdW5jdGlvbihkb2MpIHtcbiAgcmV0dXJuIHRoaXMuX3NlbmRBY3Rpb24oJ3MnLCBkb2MsIGRvYy52ZXJzaW9uKTtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLnNlbmRVbnN1YnNjcmliZSA9IGZ1bmN0aW9uKGRvYykge1xuICByZXR1cm4gdGhpcy5fc2VuZEFjdGlvbigndScsIGRvYyk7XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5zZW5kT3AgPSBmdW5jdGlvbihkb2MsIG9wKSB7XG4gIC8vIEVuc3VyZSB0aGUgZG9jIGlzIHJlZ2lzdGVyZWQgc28gdGhhdCBpdCByZWNlaXZlcyB0aGUgcmVwbHkgbWVzc2FnZVxuICB0aGlzLl9hZGREb2MoZG9jKTtcbiAgdmFyIG1lc3NhZ2UgPSB7XG4gICAgYTogJ29wJyxcbiAgICBjOiBkb2MuY29sbGVjdGlvbixcbiAgICBkOiBkb2MuaWQsXG4gICAgdjogZG9jLnZlcnNpb24sXG4gICAgc3JjOiBvcC5zcmMsXG4gICAgc2VxOiBvcC5zZXFcbiAgfTtcbiAgaWYgKG9wLm9wKSBtZXNzYWdlLm9wID0gb3Aub3A7XG4gIGlmIChvcC5jcmVhdGUpIG1lc3NhZ2UuY3JlYXRlID0gb3AuY3JlYXRlO1xuICBpZiAob3AuZGVsKSBtZXNzYWdlLmRlbCA9IG9wLmRlbDtcbiAgdGhpcy5zZW5kKG1lc3NhZ2UpO1xufTtcblxuXG4vKipcbiAqIFNlbmRzIGEgbWVzc2FnZSBkb3duIHRoZSBzb2NrZXRcbiAqL1xuQ29ubmVjdGlvbi5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgaWYgKHRoaXMuZGVidWcpIGNvbnNvbGUubG9nKCdTRU5EJywgSlNPTi5zdHJpbmdpZnkobWVzc2FnZSkpO1xuXG4gIHRoaXMuZW1pdCgnc2VuZCcsIG1lc3NhZ2UpO1xuICB0aGlzLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpKTtcbn07XG5cblxuLyoqXG4gKiBDbG9zZXMgdGhlIHNvY2tldCBhbmQgZW1pdHMgJ2Nsb3NlZCdcbiAqL1xuQ29ubmVjdGlvbi5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5zb2NrZXQuY2xvc2UoKTtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLmdldEV4aXN0aW5nID0gZnVuY3Rpb24oY29sbGVjdGlvbiwgaWQpIHtcbiAgaWYgKHRoaXMuY29sbGVjdGlvbnNbY29sbGVjdGlvbl0pIHJldHVybiB0aGlzLmNvbGxlY3Rpb25zW2NvbGxlY3Rpb25dW2lkXTtcbn07XG5cblxuLyoqXG4gKiBHZXQgb3IgY3JlYXRlIGEgZG9jdW1lbnQuXG4gKlxuICogQHBhcmFtIGNvbGxlY3Rpb25cbiAqIEBwYXJhbSBpZFxuICogQHJldHVybiB7RG9jfVxuICovXG5Db25uZWN0aW9uLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihjb2xsZWN0aW9uLCBpZCkge1xuICB2YXIgZG9jcyA9IHRoaXMuY29sbGVjdGlvbnNbY29sbGVjdGlvbl0gfHxcbiAgICAodGhpcy5jb2xsZWN0aW9uc1tjb2xsZWN0aW9uXSA9IHt9KTtcblxuICB2YXIgZG9jID0gZG9jc1tpZF07XG4gIGlmICghZG9jKSB7XG4gICAgZG9jID0gZG9jc1tpZF0gPSBuZXcgRG9jKHRoaXMsIGNvbGxlY3Rpb24sIGlkKTtcbiAgICB0aGlzLmVtaXQoJ2RvYycsIGRvYyk7XG4gIH1cblxuICByZXR1cm4gZG9jO1xufTtcblxuXG4vKipcbiAqIFJlbW92ZSBkb2N1bWVudCBmcm9tIHRoaXMuY29sbGVjdGlvbnNcbiAqXG4gKiBAcHJpdmF0ZVxuICovXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fZGVzdHJveURvYyA9IGZ1bmN0aW9uKGRvYykge1xuICB2YXIgZG9jcyA9IHRoaXMuY29sbGVjdGlvbnNbZG9jLmNvbGxlY3Rpb25dO1xuICBpZiAoIWRvY3MpIHJldHVybjtcblxuICBkZWxldGUgZG9jc1tkb2MuaWRdO1xuXG4gIC8vIERlbGV0ZSB0aGUgY29sbGVjdGlvbiBjb250YWluZXIgaWYgaXRzIGVtcHR5LiBUaGlzIGNvdWxkIGJlIGEgc291cmNlIG9mXG4gIC8vIG1lbW9yeSBsZWFrcyBpZiB5b3Ugc2xvd2x5IG1ha2UgYSBiaWxsaW9uIGNvbGxlY3Rpb25zLCB3aGljaCB5b3UgcHJvYmFibHlcbiAgLy8gd29uJ3QgZG8gYW55d2F5LCBidXQgd2hhdGV2ZXIuXG4gIGlmICghdXRpbC5oYXNLZXlzKGRvY3MpKSB7XG4gICAgZGVsZXRlIHRoaXMuY29sbGVjdGlvbnNbZG9jLmNvbGxlY3Rpb25dO1xuICB9XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fYWRkRG9jID0gZnVuY3Rpb24oZG9jKSB7XG4gIHZhciBkb2NzID0gdGhpcy5jb2xsZWN0aW9uc1tkb2MuY29sbGVjdGlvbl07XG4gIGlmICghZG9jcykge1xuICAgIGRvY3MgPSB0aGlzLmNvbGxlY3Rpb25zW2RvYy5jb2xsZWN0aW9uXSA9IHt9O1xuICB9XG4gIGlmIChkb2NzW2RvYy5pZF0gIT09IGRvYykge1xuICAgIGRvY3NbZG9jLmlkXSA9IGRvYztcbiAgfVxufTtcblxuLy8gSGVscGVyIGZvciBjcmVhdGVGZXRjaFF1ZXJ5IGFuZCBjcmVhdGVTdWJzY3JpYmVRdWVyeSwgYmVsb3cuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fY3JlYXRlUXVlcnkgPSBmdW5jdGlvbihhY3Rpb24sIGNvbGxlY3Rpb24sIHEsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBpZCA9IHRoaXMubmV4dFF1ZXJ5SWQrKztcbiAgdmFyIHF1ZXJ5ID0gbmV3IFF1ZXJ5KGFjdGlvbiwgdGhpcywgaWQsIGNvbGxlY3Rpb24sIHEsIG9wdGlvbnMsIGNhbGxiYWNrKTtcbiAgdGhpcy5xdWVyaWVzW2lkXSA9IHF1ZXJ5O1xuICBxdWVyeS5zZW5kKCk7XG4gIHJldHVybiBxdWVyeTtcbn07XG5cbi8vIEludGVybmFsIGZ1bmN0aW9uLiBVc2UgcXVlcnkuZGVzdHJveSgpIHRvIHJlbW92ZSBxdWVyaWVzLlxuQ29ubmVjdGlvbi5wcm90b3R5cGUuX2Rlc3Ryb3lRdWVyeSA9IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gIGRlbGV0ZSB0aGlzLnF1ZXJpZXNbcXVlcnkuaWRdO1xufTtcblxuLy8gVGhlIHF1ZXJ5IG9wdGlvbnMgb2JqZWN0IGNhbiBjb250YWluIHRoZSBmb2xsb3dpbmcgZmllbGRzOlxuLy9cbi8vIGRiOiBOYW1lIG9mIHRoZSBkYiBmb3IgdGhlIHF1ZXJ5LiBZb3UgY2FuIGF0dGFjaCBleHRyYURicyB0byBTaGFyZURCIGFuZFxuLy8gICBwaWNrIHdoaWNoIG9uZSB0aGUgcXVlcnkgc2hvdWxkIGhpdCB1c2luZyB0aGlzIHBhcmFtZXRlci5cblxuLy8gQ3JlYXRlIGEgZmV0Y2ggcXVlcnkuIEZldGNoIHF1ZXJpZXMgYXJlIG9ubHkgaXNzdWVkIG9uY2UsIHJldHVybmluZyB0aGVcbi8vIHJlc3VsdHMgZGlyZWN0bHkgaW50byB0aGUgY2FsbGJhY2suXG4vL1xuLy8gVGhlIGNhbGxiYWNrIHNob3VsZCBoYXZlIHRoZSBzaWduYXR1cmUgZnVuY3Rpb24oZXJyb3IsIHJlc3VsdHMsIGV4dHJhKVxuLy8gd2hlcmUgcmVzdWx0cyBpcyBhIGxpc3Qgb2YgRG9jIG9iamVjdHMuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5jcmVhdGVGZXRjaFF1ZXJ5ID0gZnVuY3Rpb24oY29sbGVjdGlvbiwgcSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgcmV0dXJuIHRoaXMuX2NyZWF0ZVF1ZXJ5KCdxZicsIGNvbGxlY3Rpb24sIHEsIG9wdGlvbnMsIGNhbGxiYWNrKTtcbn07XG5cbi8vIENyZWF0ZSBhIHN1YnNjcmliZSBxdWVyeS4gU3Vic2NyaWJlIHF1ZXJpZXMgcmV0dXJuIHdpdGggdGhlIGluaXRpYWwgZGF0YVxuLy8gdGhyb3VnaCB0aGUgY2FsbGJhY2ssIHRoZW4gdXBkYXRlIHRoZW1zZWx2ZXMgd2hlbmV2ZXIgdGhlIHF1ZXJ5IHJlc3VsdCBzZXRcbi8vIGNoYW5nZXMgdmlhIHRoZWlyIG93biBldmVudCBlbWl0dGVyLlxuLy9cbi8vIElmIHByZXNlbnQsIHRoZSBjYWxsYmFjayBzaG91bGQgaGF2ZSB0aGUgc2lnbmF0dXJlIGZ1bmN0aW9uKGVycm9yLCByZXN1bHRzLCBleHRyYSlcbi8vIHdoZXJlIHJlc3VsdHMgaXMgYSBsaXN0IG9mIERvYyBvYmplY3RzLlxuQ29ubmVjdGlvbi5wcm90b3R5cGUuY3JlYXRlU3Vic2NyaWJlUXVlcnkgPSBmdW5jdGlvbihjb2xsZWN0aW9uLCBxLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICByZXR1cm4gdGhpcy5fY3JlYXRlUXVlcnkoJ3FzJywgY29sbGVjdGlvbiwgcSwgb3B0aW9ucywgY2FsbGJhY2spO1xufTtcblxuQ29ubmVjdGlvbi5wcm90b3R5cGUuaGFzUGVuZGluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gISEoXG4gICAgdGhpcy5fZmlyc3REb2MoaGFzUGVuZGluZykgfHxcbiAgICB0aGlzLl9maXJzdFF1ZXJ5KGhhc1BlbmRpbmcpXG4gICk7XG59O1xuZnVuY3Rpb24gaGFzUGVuZGluZyhvYmplY3QpIHtcbiAgcmV0dXJuIG9iamVjdC5oYXNQZW5kaW5nKCk7XG59XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLmhhc1dyaXRlUGVuZGluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gISF0aGlzLl9maXJzdERvYyhoYXNXcml0ZVBlbmRpbmcpO1xufTtcbmZ1bmN0aW9uIGhhc1dyaXRlUGVuZGluZyhvYmplY3QpIHtcbiAgcmV0dXJuIG9iamVjdC5oYXNXcml0ZVBlbmRpbmcoKTtcbn1cblxuQ29ubmVjdGlvbi5wcm90b3R5cGUud2hlbk5vdGhpbmdQZW5kaW5nID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgdmFyIGRvYyA9IHRoaXMuX2ZpcnN0RG9jKGhhc1BlbmRpbmcpO1xuICBpZiAoZG9jKSB7XG4gICAgLy8gSWYgYSBkb2N1bWVudCBpcyBmb3VuZCB3aXRoIGEgcGVuZGluZyBvcGVyYXRpb24sIHdhaXQgZm9yIGl0IHRvIGVtaXRcbiAgICAvLyB0aGF0IG5vdGhpbmcgaXMgcGVuZGluZyBhbnltb3JlLCBhbmQgdGhlbiByZWNoZWNrIGFsbCBkb2N1bWVudHMgYWdhaW4uXG4gICAgLy8gV2UgaGF2ZSB0byByZWNoZWNrIGFsbCBkb2N1bWVudHMsIGp1c3QgaW4gY2FzZSBhbm90aGVyIG11dGF0aW9uIGhhc1xuICAgIC8vIGJlZW4gbWFkZSBpbiB0aGUgbWVhbnRpbWUgYXMgYSByZXN1bHQgb2YgYW4gZXZlbnQgY2FsbGJhY2tcbiAgICBkb2Mub25jZSgnbm90aGluZyBwZW5kaW5nJywgdGhpcy5fbm90aGluZ1BlbmRpbmdSZXRyeShjYWxsYmFjaykpO1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgcXVlcnkgPSB0aGlzLl9maXJzdFF1ZXJ5KGhhc1BlbmRpbmcpO1xuICBpZiAocXVlcnkpIHtcbiAgICBxdWVyeS5vbmNlKCdyZWFkeScsIHRoaXMuX25vdGhpbmdQZW5kaW5nUmV0cnkoY2FsbGJhY2spKTtcbiAgICByZXR1cm47XG4gIH1cbiAgLy8gQ2FsbCBiYWNrIHdoZW4gbm8gcGVuZGluZyBvcGVyYXRpb25zXG4gIHByb2Nlc3MubmV4dFRpY2soY2FsbGJhY2spO1xufTtcbkNvbm5lY3Rpb24ucHJvdG90eXBlLl9ub3RoaW5nUGVuZGluZ1JldHJ5ID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgdmFyIGNvbm5lY3Rpb24gPSB0aGlzO1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICAgIGNvbm5lY3Rpb24ud2hlbk5vdGhpbmdQZW5kaW5nKGNhbGxiYWNrKTtcbiAgICB9KTtcbiAgfTtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLl9maXJzdERvYyA9IGZ1bmN0aW9uKGZuKSB7XG4gIGZvciAodmFyIGNvbGxlY3Rpb24gaW4gdGhpcy5jb2xsZWN0aW9ucykge1xuICAgIHZhciBkb2NzID0gdGhpcy5jb2xsZWN0aW9uc1tjb2xsZWN0aW9uXTtcbiAgICBmb3IgKHZhciBpZCBpbiBkb2NzKSB7XG4gICAgICB2YXIgZG9jID0gZG9jc1tpZF07XG4gICAgICBpZiAoZm4oZG9jKSkge1xuICAgICAgICByZXR1cm4gZG9jO1xuICAgICAgfVxuICAgIH1cbiAgfVxufTtcblxuQ29ubmVjdGlvbi5wcm90b3R5cGUuX2ZpcnN0UXVlcnkgPSBmdW5jdGlvbihmbikge1xuICBmb3IgKHZhciBpZCBpbiB0aGlzLnF1ZXJpZXMpIHtcbiAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbaWRdO1xuICAgIGlmIChmbihxdWVyeSkpIHtcbiAgICAgIHJldHVybiBxdWVyeTtcbiAgICB9XG4gIH1cbn07XG4iLCJ2YXIgZW1pdHRlciA9IHJlcXVpcmUoJy4uL2VtaXR0ZXInKTtcbnZhciBTaGFyZURCRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvcicpO1xudmFyIHR5cGVzID0gcmVxdWlyZSgnLi4vdHlwZXMnKTtcblxuLyoqXG4gKiBBIERvYyBpcyBhIGNsaWVudCdzIHZpZXcgb24gYSBzaGFyZWpzIGRvY3VtZW50LlxuICpcbiAqIEl0IGlzIGlzIHVuaXF1ZWx5IGlkZW50aWZpZWQgYnkgaXRzIGBpZGAgYW5kIGBjb2xsZWN0aW9uYC4gIERvY3VtZW50c1xuICogc2hvdWxkIG5vdCBiZSBjcmVhdGVkIGRpcmVjdGx5LiBDcmVhdGUgdGhlbSB3aXRoIGNvbm5lY3Rpb24uZ2V0KClcbiAqXG4gKlxuICogU3Vic2NyaXB0aW9uc1xuICogLS0tLS0tLS0tLS0tLVxuICpcbiAqIFdlIGNhbiBzdWJzY3JpYmUgYSBkb2N1bWVudCB0byBzdGF5IGluIHN5bmMgd2l0aCB0aGUgc2VydmVyLlxuICogICBkb2Muc3Vic2NyaWJlKGZ1bmN0aW9uKGVycm9yKSB7XG4gKiAgICAgZG9jLnN1YnNjcmliZWQgLy8gPSB0cnVlXG4gKiAgIH0pXG4gKiBUaGUgc2VydmVyIG5vdyBzZW5kcyB1cyBhbGwgY2hhbmdlcyBjb25jZXJuaW5nIHRoaXMgZG9jdW1lbnQgYW5kIHRoZXNlIGFyZVxuICogYXBwbGllZCB0byBvdXIgZGF0YS4gSWYgdGhlIHN1YnNjcmlwdGlvbiB3YXMgc3VjY2Vzc2Z1bCB0aGUgaW5pdGlhbFxuICogZGF0YSBhbmQgdmVyc2lvbiBzZW50IGJ5IHRoZSBzZXJ2ZXIgYXJlIGxvYWRlZCBpbnRvIHRoZSBkb2N1bWVudC5cbiAqXG4gKiBUbyBzdG9wIGxpc3RlbmluZyB0byB0aGUgY2hhbmdlcyB3ZSBjYWxsIGBkb2MudW5zdWJzY3JpYmUoKWAuXG4gKlxuICogSWYgd2UganVzdCB3YW50IHRvIGxvYWQgdGhlIGRhdGEgYnV0IG5vdCBzdGF5IHVwLXRvLWRhdGUsIHdlIGNhbGxcbiAqICAgZG9jLmZldGNoKGZ1bmN0aW9uKGVycm9yKSB7XG4gKiAgICAgZG9jLmRhdGEgLy8gc2VudCBieSBzZXJ2ZXJcbiAqICAgfSlcbiAqXG4gKlxuICogRXZlbnRzXG4gKiAtLS0tLS1cbiAqXG4gKiBZb3UgY2FuIHVzZSBkb2Mub24oZXZlbnROYW1lLCBjYWxsYmFjaykgdG8gc3Vic2NyaWJlIHRvIHRoZSBmb2xsb3dpbmcgZXZlbnRzOlxuICogLSBgYmVmb3JlIG9wIChvcCwgc291cmNlKWAgRmlyZWQgYmVmb3JlIGEgcGFydGlhbCBvcGVyYXRpb24gaXMgYXBwbGllZCB0byB0aGUgZGF0YS5cbiAqICAgSXQgbWF5IGJlIHVzZWQgdG8gcmVhZCB0aGUgb2xkIGRhdGEganVzdCBiZWZvcmUgYXBwbHlpbmcgYW4gb3BlcmF0aW9uXG4gKiAtIGBvcCAob3AsIHNvdXJjZSlgIEZpcmVkIGFmdGVyIGV2ZXJ5IHBhcnRpYWwgb3BlcmF0aW9uIHdpdGggdGhpcyBvcGVyYXRpb24gYXMgdGhlXG4gKiAgIGZpcnN0IGFyZ3VtZW50XG4gKiAtIGBjcmVhdGUgKHNvdXJjZSlgIFRoZSBkb2N1bWVudCB3YXMgY3JlYXRlZC4gVGhhdCBtZWFucyBpdHMgdHlwZSB3YXNcbiAqICAgc2V0IGFuZCBpdCBoYXMgc29tZSBpbml0aWFsIGRhdGEuXG4gKiAtIGBkZWwgKGRhdGEsIHNvdXJjZSlgIEZpcmVkIGFmdGVyIHRoZSBkb2N1bWVudCBpcyBkZWxldGVkLCB0aGF0IGlzXG4gKiAgIHRoZSBkYXRhIGlzIG51bGwuIEl0IGlzIHBhc3NlZCB0aGUgZGF0YSBiZWZvcmUgZGVsdGVpb24gYXMgYW5cbiAqICAgYXJndW1lbnRzXG4gKiAtIGBsb2FkICgpYCBGaXJlZCB3aGVuIGEgbmV3IHNuYXBzaG90IGlzIGluZ2VzdGVkIGZyb20gYSBmZXRjaCwgc3Vic2NyaWJlLCBvciBxdWVyeVxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gRG9jO1xuZnVuY3Rpb24gRG9jKGNvbm5lY3Rpb24sIGNvbGxlY3Rpb24sIGlkKSB7XG4gIGVtaXR0ZXIuRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG5cbiAgdGhpcy5jb25uZWN0aW9uID0gY29ubmVjdGlvbjtcblxuICB0aGlzLmNvbGxlY3Rpb24gPSBjb2xsZWN0aW9uO1xuICB0aGlzLmlkID0gaWQ7XG5cbiAgdGhpcy52ZXJzaW9uID0gbnVsbDtcbiAgdGhpcy50eXBlID0gbnVsbDtcbiAgdGhpcy5kYXRhID0gdW5kZWZpbmVkO1xuXG4gIC8vIEFycmF5IG9mIGNhbGxiYWNrcyBvciBudWxscyBhcyBwbGFjZWhvbGRlcnNcbiAgdGhpcy5pbmZsaWdodEZldGNoID0gW107XG4gIHRoaXMuaW5mbGlnaHRTdWJzY3JpYmUgPSBbXTtcbiAgdGhpcy5pbmZsaWdodFVuc3Vic2NyaWJlID0gW107XG4gIHRoaXMucGVuZGluZ0ZldGNoID0gW107XG5cbiAgLy8gV2hldGhlciB3ZSB0aGluayB3ZSBhcmUgc3Vic2NyaWJlZCBvbiB0aGUgc2VydmVyLiBTeW5jaHJvbm91c2x5IHNldCB0b1xuICAvLyBmYWxzZSBvbiBjYWxscyB0byB1bnN1YnNjcmliZSBhbmQgZGlzY29ubmVjdC4gU2hvdWxkIG5ldmVyIGJlIHRydWUgd2hlblxuICAvLyB0aGlzLndhbnRTdWJzY3JpYmUgaXMgZmFsc2VcbiAgdGhpcy5zdWJzY3JpYmVkID0gZmFsc2U7XG4gIC8vIFdoZXRoZXIgdG8gcmUtZXN0YWJsaXNoIHRoZSBzdWJzY3JpcHRpb24gb24gcmVjb25uZWN0XG4gIHRoaXMud2FudFN1YnNjcmliZSA9IGZhbHNlO1xuXG4gIC8vIFRoZSBvcCB0aGF0IGlzIGN1cnJlbnRseSByb3VuZHRyaXBwaW5nIHRvIHRoZSBzZXJ2ZXIsIG9yIG51bGwuXG4gIC8vXG4gIC8vIFdoZW4gdGhlIGNvbm5lY3Rpb24gcmVjb25uZWN0cywgdGhlIGluZmxpZ2h0IG9wIGlzIHJlc3VibWl0dGVkLlxuICAvL1xuICAvLyBUaGlzIGhhcyB0aGUgc2FtZSBmb3JtYXQgYXMgYW4gZW50cnkgaW4gcGVuZGluZ09wc1xuICB0aGlzLmluZmxpZ2h0T3AgPSBudWxsO1xuXG4gIC8vIEFsbCBvcHMgdGhhdCBhcmUgd2FpdGluZyBmb3IgdGhlIHNlcnZlciB0byBhY2tub3dsZWRnZSB0aGlzLmluZmxpZ2h0T3BcbiAgLy8gVGhpcyB1c2VkIHRvIGp1c3QgYmUgYSBzaW5nbGUgb3BlcmF0aW9uLCBidXQgY3JlYXRlcyAmIGRlbGV0ZXMgY2FuJ3QgYmVcbiAgLy8gY29tcG9zZWQgd2l0aCByZWd1bGFyIG9wZXJhdGlvbnMuXG4gIC8vXG4gIC8vIFRoaXMgaXMgYSBsaXN0IG9mIHtbY3JlYXRlOnsuLi59XSwgW2RlbDp0cnVlXSwgW29wOi4uLl0sIGNhbGxiYWNrczpbLi4uXX1cbiAgdGhpcy5wZW5kaW5nT3BzID0gW107XG5cbiAgLy8gVGhlIE9UIHR5cGUgb2YgdGhpcyBkb2N1bWVudC4gQW4gdW5jcmVhdGVkIGRvY3VtZW50IGhhcyB0eXBlIGBudWxsYFxuICB0aGlzLnR5cGUgPSBudWxsO1xuXG4gIC8vIFRoZSBhcHBseVN0YWNrIGVuYWJsZXMgdXMgdG8gdHJhY2sgYW55IG9wcyBzdWJtaXR0ZWQgd2hpbGUgd2UgYXJlXG4gIC8vIGFwcGx5aW5nIGFuIG9wIGluY3JlbWVudGFsbHkuIFRoaXMgdmFsdWUgaXMgYW4gYXJyYXkgd2hlbiB3ZSBhcmVcbiAgLy8gcGVyZm9ybWluZyBhbiBpbmNyZW1lbnRhbCBhcHBseSBhbmQgbnVsbCBvdGhlcndpc2UuIFdoZW4gaXQgaXMgYW4gYXJyYXksXG4gIC8vIGFsbCBzdWJtaXR0ZWQgb3BzIHNob3VsZCBiZSBwdXNoZWQgb250byBpdC4gVGhlIGBfb3RBcHBseWAgbWV0aG9kIHdpbGxcbiAgLy8gcmVzZXQgaXQgYmFjayB0byBudWxsIHdoZW4gYWxsIGluY3JlbWVudGFsIGFwcGx5IGxvb3BzIGFyZSBjb21wbGV0ZS5cbiAgdGhpcy5hcHBseVN0YWNrID0gbnVsbDtcblxuICAvLyBEaXNhYmxlIHRoZSBkZWZhdWx0IGJlaGF2aW9yIG9mIGNvbXBvc2luZyBzdWJtaXR0ZWQgb3BzLiBUaGlzIGlzIHJlYWQgYXRcbiAgLy8gdGhlIHRpbWUgb2Ygb3Agc3VibWl0LCBzbyBpdCBtYXkgYmUgdG9nZ2xlZCBvbiBiZWZvcmUgc3VibWl0dGluZyBhXG4gIC8vIHNwZWNpZmMgb3AgYW5kIHRvZ2dsZWQgb2ZmIGFmdGVyd2FyZFxuICB0aGlzLnByZXZlbnRDb21wb3NlID0gZmFsc2U7XG59XG5lbWl0dGVyLm1peGluKERvYyk7XG5cbkRvYy5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIHZhciBkb2MgPSB0aGlzO1xuICBkb2Mud2hlbk5vdGhpbmdQZW5kaW5nKGZ1bmN0aW9uKCkge1xuICAgIGRvYy5jb25uZWN0aW9uLl9kZXN0cm95RG9jKGRvYyk7XG4gICAgaWYgKGRvYy53YW50U3Vic2NyaWJlKSB7XG4gICAgICByZXR1cm4gZG9jLnVuc3Vic2NyaWJlKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjaygpO1xuICB9KTtcbn07XG5cblxuLy8gKioqKioqIE1hbmlwdWxhdGluZyB0aGUgZG9jdW1lbnQgZGF0YSwgdmVyc2lvbiBhbmQgdHlwZS5cblxuLy8gU2V0IHRoZSBkb2N1bWVudCdzIHR5cGUsIGFuZCBhc3NvY2lhdGVkIHByb3BlcnRpZXMuIE1vc3Qgb2YgdGhlIGxvZ2ljIGluXG4vLyB0aGlzIGZ1bmN0aW9uIGV4aXN0cyB0byB1cGRhdGUgdGhlIGRvY3VtZW50IGJhc2VkIG9uIGFueSBhZGRlZCAmIHJlbW92ZWQgQVBJXG4vLyBtZXRob2RzLlxuLy9cbi8vIEBwYXJhbSBuZXdUeXBlIE9UIHR5cGUgcHJvdmlkZWQgYnkgdGhlIG90dHlwZXMgbGlicmFyeSBvciBpdHMgbmFtZSBvciB1cmlcbkRvYy5wcm90b3R5cGUuX3NldFR5cGUgPSBmdW5jdGlvbihuZXdUeXBlKSB7XG4gIGlmICh0eXBlb2YgbmV3VHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICBuZXdUeXBlID0gdHlwZXMubWFwW25ld1R5cGVdO1xuICB9XG5cbiAgaWYgKG5ld1R5cGUpIHtcbiAgICB0aGlzLnR5cGUgPSBuZXdUeXBlO1xuXG4gIH0gZWxzZSBpZiAobmV3VHlwZSA9PT0gbnVsbCkge1xuICAgIHRoaXMudHlwZSA9IG5ld1R5cGU7XG4gICAgLy8gSWYgd2UgcmVtb3ZlZCB0aGUgdHlwZSBmcm9tIHRoZSBvYmplY3QsIGFsc28gcmVtb3ZlIGl0cyBkYXRhXG4gICAgdGhpcy5kYXRhID0gdW5kZWZpbmVkO1xuXG4gIH0gZWxzZSB7XG4gICAgdmFyIGVyciA9IG5ldyBTaGFyZURCRXJyb3IoNDAwOCwgJ01pc3NpbmcgdHlwZSAnICsgbmV3VHlwZSk7XG4gICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICB9XG59O1xuXG4vLyBJbmdlc3Qgc25hcHNob3QgZGF0YS4gVGhpcyBkYXRhIG11c3QgaW5jbHVkZSBhIHZlcnNpb24sIHNuYXBzaG90IGFuZCB0eXBlLlxuLy8gVGhpcyBpcyB1c2VkIGJvdGggdG8gaW5nZXN0IGRhdGEgdGhhdCB3YXMgZXhwb3J0ZWQgd2l0aCBhIHdlYnBhZ2UgYW5kIGRhdGFcbi8vIHRoYXQgd2FzIHJlY2VpdmVkIGZyb20gdGhlIHNlcnZlciBkdXJpbmcgYSBmZXRjaC5cbi8vXG4vLyBAcGFyYW0gc25hcHNob3QudiAgICB2ZXJzaW9uXG4vLyBAcGFyYW0gc25hcHNob3QuZGF0YVxuLy8gQHBhcmFtIHNuYXBzaG90LnR5cGVcbi8vIEBwYXJhbSBjYWxsYmFja1xuRG9jLnByb3RvdHlwZS5pbmdlc3RTbmFwc2hvdCA9IGZ1bmN0aW9uKHNuYXBzaG90LCBjYWxsYmFjaykge1xuICBpZiAoIXNuYXBzaG90KSByZXR1cm4gY2FsbGJhY2sgJiYgY2FsbGJhY2soKTtcblxuICBpZiAodHlwZW9mIHNuYXBzaG90LnYgIT09ICdudW1iZXInKSB7XG4gICAgdmFyIGVyciA9IG5ldyBTaGFyZURCRXJyb3IoNTAwOCwgJ01pc3NpbmcgdmVyc2lvbiBpbiBpbmdlc3RlZCBzbmFwc2hvdC4gJyArIHRoaXMuY29sbGVjdGlvbiArICcuJyArIHRoaXMuaWQpO1xuICAgIGlmIChjYWxsYmFjaykgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICB9XG5cbiAgLy8gSWYgdGhlIGRvYyBpcyBhbHJlYWR5IGNyZWF0ZWQgb3IgdGhlcmUgYXJlIG9wcyBwZW5kaW5nLCB3ZSBjYW5ub3QgdXNlIHRoZVxuICAvLyBpbmdlc3RlZCBzbmFwc2hvdCBhbmQgbmVlZCBvcHMgaW4gb3JkZXIgdG8gdXBkYXRlIHRoZSBkb2N1bWVudFxuICBpZiAodGhpcy50eXBlIHx8IHRoaXMuaGFzV3JpdGVQZW5kaW5nKCkpIHtcbiAgICAvLyBUaGUgdmVyc2lvbiBzaG91bGQgb25seSBiZSBudWxsIG9uIGEgY3JlYXRlZCBkb2N1bWVudCB3aGVuIGl0IHdhc1xuICAgIC8vIGNyZWF0ZWQgbG9jYWxseSB3aXRob3V0IGZldGNoaW5nXG4gICAgaWYgKHRoaXMudmVyc2lvbiA9PSBudWxsKSB7XG4gICAgICBpZiAodGhpcy5oYXNXcml0ZVBlbmRpbmcoKSkge1xuICAgICAgICAvLyBJZiB3ZSBoYXZlIHBlbmRpbmcgb3BzIGFuZCB3ZSBnZXQgYSBzbmFwc2hvdCBmb3IgYSBsb2NhbGx5IGNyZWF0ZWRcbiAgICAgICAgLy8gZG9jdW1lbnQsIHdlIGhhdmUgdG8gd2FpdCBmb3IgdGhlIHBlbmRpbmcgb3BzIHRvIGNvbXBsZXRlLCBiZWNhdXNlXG4gICAgICAgIC8vIHdlIGRvbid0IGtub3cgd2hhdCB2ZXJzaW9uIHRvIGZldGNoIG9wcyBmcm9tLiBJdCBpcyBwb3NzaWJsZSB0aGF0XG4gICAgICAgIC8vIHRoZSBzbmFwc2hvdCBjYW1lIGZyb20gb3VyIGxvY2FsIG9wLCBidXQgaXQgaXMgYWxzbyBwb3NzaWJsZSB0aGF0XG4gICAgICAgIC8vIHRoZSBkb2Mgd2FzIGNyZWF0ZWQgcmVtb3RlbHkgKHdoaWNoIHdvdWxkIGNvbmZsaWN0IGFuZCBiZSBhbiBlcnJvcilcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrICYmIHRoaXMub25jZSgnbm8gd3JpdGUgcGVuZGluZycsIGNhbGxiYWNrKTtcbiAgICAgIH1cbiAgICAgIC8vIE90aGVyd2lzZSwgd2UndmUgZW5jb3VudGVkIGFuIGVycm9yIHN0YXRlXG4gICAgICB2YXIgZXJyID0gbmV3IFNoYXJlREJFcnJvcig1MDA5LCAnQ2Fubm90IGluZ2VzdCBzbmFwc2hvdCBpbiBkb2Mgd2l0aCBudWxsIHZlcnNpb24uICcgKyB0aGlzLmNvbGxlY3Rpb24gKyAnLicgKyB0aGlzLmlkKTtcbiAgICAgIGlmIChjYWxsYmFjaykgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgfVxuICAgIC8vIElmIHdlIGdvdCBhIHNuYXBzaG90IGZvciBhIHZlcnNpb24gZnVydGhlciBhbG9uZyB0aGFuIHRoZSBkb2N1bWVudCBpc1xuICAgIC8vIGN1cnJlbnRseSwgaXNzdWUgYSBmZXRjaCB0byBnZXQgdGhlIGxhdGVzdCBvcHMgYW5kIGNhdGNoIHVzIHVwXG4gICAgaWYgKHNuYXBzaG90LnYgPiB0aGlzLnZlcnNpb24pIHJldHVybiB0aGlzLmZldGNoKGNhbGxiYWNrKTtcbiAgICByZXR1cm4gY2FsbGJhY2sgJiYgY2FsbGJhY2soKTtcbiAgfVxuXG4gIC8vIElnbm9yZSB0aGUgc25hcHNob3QgaWYgd2UgYXJlIGFscmVhZHkgYXQgYSBuZXdlciB2ZXJzaW9uLiBVbmRlciBub1xuICAvLyBjaXJjdW1zdGFuY2Ugc2hvdWxkIHdlIGV2ZXIgc2V0IHRoZSBjdXJyZW50IHZlcnNpb24gYmFja3dhcmRcbiAgaWYgKHRoaXMudmVyc2lvbiA+IHNuYXBzaG90LnYpIHJldHVybiBjYWxsYmFjayAmJiBjYWxsYmFjaygpO1xuXG4gIHRoaXMudmVyc2lvbiA9IHNuYXBzaG90LnY7XG4gIHZhciB0eXBlID0gKHNuYXBzaG90LnR5cGUgPT09IHVuZGVmaW5lZCkgPyB0eXBlcy5kZWZhdWx0VHlwZSA6IHNuYXBzaG90LnR5cGU7XG4gIHRoaXMuX3NldFR5cGUodHlwZSk7XG4gIHRoaXMuZGF0YSA9ICh0aGlzLnR5cGUgJiYgdGhpcy50eXBlLmRlc2VyaWFsaXplKSA/XG4gICAgdGhpcy50eXBlLmRlc2VyaWFsaXplKHNuYXBzaG90LmRhdGEpIDpcbiAgICBzbmFwc2hvdC5kYXRhO1xuICB0aGlzLmVtaXQoJ2xvYWQnKTtcbiAgY2FsbGJhY2sgJiYgY2FsbGJhY2soKTtcbn07XG5cbkRvYy5wcm90b3R5cGUud2hlbk5vdGhpbmdQZW5kaW5nID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgaWYgKHRoaXMuaGFzUGVuZGluZygpKSB7XG4gICAgdGhpcy5vbmNlKCdub3RoaW5nIHBlbmRpbmcnLCBjYWxsYmFjayk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNhbGxiYWNrKCk7XG59O1xuXG5Eb2MucHJvdG90eXBlLmhhc1BlbmRpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuICEhKFxuICAgIHRoaXMuaW5mbGlnaHRPcCB8fFxuICAgIHRoaXMucGVuZGluZ09wcy5sZW5ndGggfHxcbiAgICB0aGlzLmluZmxpZ2h0RmV0Y2gubGVuZ3RoIHx8XG4gICAgdGhpcy5pbmZsaWdodFN1YnNjcmliZS5sZW5ndGggfHxcbiAgICB0aGlzLmluZmxpZ2h0VW5zdWJzY3JpYmUubGVuZ3RoIHx8XG4gICAgdGhpcy5wZW5kaW5nRmV0Y2gubGVuZ3RoXG4gICk7XG59O1xuXG5Eb2MucHJvdG90eXBlLmhhc1dyaXRlUGVuZGluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gISEodGhpcy5pbmZsaWdodE9wIHx8IHRoaXMucGVuZGluZ09wcy5sZW5ndGgpO1xufTtcblxuRG9jLnByb3RvdHlwZS5fZW1pdE5vdGhpbmdQZW5kaW5nID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLmhhc1dyaXRlUGVuZGluZygpKSByZXR1cm47XG4gIHRoaXMuZW1pdCgnbm8gd3JpdGUgcGVuZGluZycpO1xuICBpZiAodGhpcy5oYXNQZW5kaW5nKCkpIHJldHVybjtcbiAgdGhpcy5lbWl0KCdub3RoaW5nIHBlbmRpbmcnKTtcbn07XG5cbi8vICoqKiogSGVscGVycyBmb3IgbmV0d29yayBtZXNzYWdlc1xuXG5Eb2MucHJvdG90eXBlLl9lbWl0UmVzcG9uc2VFcnJvciA9IGZ1bmN0aW9uKGVyciwgY2FsbGJhY2spIHtcbiAgaWYgKGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2soZXJyKTtcbiAgICB0aGlzLl9lbWl0Tm90aGluZ1BlbmRpbmcoKTtcbiAgICByZXR1cm47XG4gIH1cbiAgdGhpcy5fZW1pdE5vdGhpbmdQZW5kaW5nKCk7XG4gIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xufTtcblxuRG9jLnByb3RvdHlwZS5faGFuZGxlRmV0Y2ggPSBmdW5jdGlvbihlcnIsIHNuYXBzaG90KSB7XG4gIHZhciBjYWxsYmFjayA9IHRoaXMuaW5mbGlnaHRGZXRjaC5zaGlmdCgpO1xuICBpZiAoZXJyKSByZXR1cm4gdGhpcy5fZW1pdFJlc3BvbnNlRXJyb3IoZXJyLCBjYWxsYmFjayk7XG4gIHRoaXMuaW5nZXN0U25hcHNob3Qoc25hcHNob3QsIGNhbGxiYWNrKTtcbiAgdGhpcy5fZW1pdE5vdGhpbmdQZW5kaW5nKCk7XG59O1xuXG5Eb2MucHJvdG90eXBlLl9oYW5kbGVTdWJzY3JpYmUgPSBmdW5jdGlvbihlcnIsIHNuYXBzaG90KSB7XG4gIHZhciBjYWxsYmFjayA9IHRoaXMuaW5mbGlnaHRTdWJzY3JpYmUuc2hpZnQoKTtcbiAgaWYgKGVycikgcmV0dXJuIHRoaXMuX2VtaXRSZXNwb25zZUVycm9yKGVyciwgY2FsbGJhY2spO1xuICAvLyBJbmRpY2F0ZSB3ZSBhcmUgc3Vic2NyaWJlZCBvbmx5IGlmIHRoZSBjbGllbnQgc3RpbGwgd2FudHMgdG8gYmUuIEluIHRoZVxuICAvLyB0aW1lIHNpbmNlIGNhbGxpbmcgc3Vic2NyaWJlIGFuZCByZWNlaXZpbmcgYSByZXNwb25zZSBmcm9tIHRoZSBzZXJ2ZXIsXG4gIC8vIHVuc3Vic2NyaWJlIGNvdWxkIGhhdmUgYmVlbiBjYWxsZWQgYW5kIHdlIG1pZ2h0IGFscmVhZHkgYmUgdW5zdWJzY3JpYmVkXG4gIC8vIGJ1dCBub3QgaGF2ZSByZWNlaXZlZCB0aGUgcmVzcG9uc2UuIEFsc28sIGJlY2F1c2UgcmVxdWVzdHMgZnJvbSB0aGVcbiAgLy8gY2xpZW50IGFyZSBub3Qgc2VyaWFsaXplZCBhbmQgbWF5IHRha2UgZGlmZmVyZW50IGFzeW5jIHRpbWUgdG8gcHJvY2VzcyxcbiAgLy8gaXQgaXMgcG9zc2libGUgdGhhdCB3ZSBjb3VsZCBoZWFyIHJlc3BvbnNlcyBiYWNrIGluIGEgZGlmZmVyZW50IG9yZGVyXG4gIC8vIGZyb20gdGhlIG9yZGVyIG9yaWdpbmFsbHkgc2VudFxuICBpZiAodGhpcy53YW50U3Vic2NyaWJlKSB0aGlzLnN1YnNjcmliZWQgPSB0cnVlO1xuICB0aGlzLmluZ2VzdFNuYXBzaG90KHNuYXBzaG90LCBjYWxsYmFjayk7XG4gIHRoaXMuX2VtaXROb3RoaW5nUGVuZGluZygpO1xufTtcblxuRG9jLnByb3RvdHlwZS5faGFuZGxlVW5zdWJzY3JpYmUgPSBmdW5jdGlvbihlcnIpIHtcbiAgdmFyIGNhbGxiYWNrID0gdGhpcy5pbmZsaWdodFVuc3Vic2NyaWJlLnNoaWZ0KCk7XG4gIGlmIChlcnIpIHJldHVybiB0aGlzLl9lbWl0UmVzcG9uc2VFcnJvcihlcnIsIGNhbGxiYWNrKTtcbiAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjaygpO1xuICB0aGlzLl9lbWl0Tm90aGluZ1BlbmRpbmcoKTtcbn07XG5cbkRvYy5wcm90b3R5cGUuX2hhbmRsZU9wID0gZnVuY3Rpb24oZXJyLCBtZXNzYWdlKSB7XG4gIGlmIChlcnIpIHtcbiAgICBpZiAodGhpcy5pbmZsaWdodE9wKSB7XG4gICAgICAvLyBUaGUgc2VydmVyIGhhcyByZWplY3RlZCBzdWJtaXNzaW9uIG9mIHRoZSBjdXJyZW50IG9wZXJhdGlvbi4gSWYgd2UgZ2V0XG4gICAgICAvLyBhbiBlcnJvciBjb2RlIDQwMDIgXCJPcCBzdWJtaXQgcmVqZWN0ZWRcIiwgdGhpcyB3YXMgZG9uZSBpbnRlbnRpb25hbGx5XG4gICAgICAvLyBhbmQgd2Ugc2hvdWxkIHJvbGwgYmFjayBidXQgbm90IHJldHVybiBhbiBlcnJvciB0byB0aGUgdXNlci5cbiAgICAgIGlmIChlcnIuY29kZSA9PT0gNDAwMikgZXJyID0gbnVsbDtcbiAgICAgIHJldHVybiB0aGlzLl9yb2xsYmFjayhlcnIpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gIH1cblxuICBpZiAodGhpcy5pbmZsaWdodE9wICYmXG4gICAgICBtZXNzYWdlLnNyYyA9PT0gdGhpcy5pbmZsaWdodE9wLnNyYyAmJlxuICAgICAgbWVzc2FnZS5zZXEgPT09IHRoaXMuaW5mbGlnaHRPcC5zZXEpIHtcbiAgICAvLyBUaGUgb3AgaGFzIGFscmVhZHkgYmVlbiBhcHBsaWVkIGxvY2FsbHkuIEp1c3QgdXBkYXRlIHRoZSB2ZXJzaW9uXG4gICAgLy8gYW5kIHBlbmRpbmcgc3RhdGUgYXBwcm9wcmlhdGVseVxuICAgIHRoaXMuX29wQWNrbm93bGVkZ2VkKG1lc3NhZ2UpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmICh0aGlzLnZlcnNpb24gPT0gbnVsbCB8fCBtZXNzYWdlLnYgPiB0aGlzLnZlcnNpb24pIHtcbiAgICAvLyBUaGlzIHdpbGwgaGFwcGVuIGluIG5vcm1hbCBvcGVyYXRpb24gaWYgd2UgYmVjb21lIHN1YnNjcmliZWQgdG8gYVxuICAgIC8vIG5ldyBkb2N1bWVudCB2aWEgYSBxdWVyeS4gSXQgY2FuIGFsc28gaGFwcGVuIGlmIHdlIGdldCBhbiBvcCBmb3JcbiAgICAvLyBhIGZ1dHVyZSB2ZXJzaW9uIGJleW9uZCB0aGUgdmVyc2lvbiB3ZSBhcmUgZXhwZWN0aW5nIG5leHQuIFRoaXNcbiAgICAvLyBjb3VsZCBoYXBwZW4gaWYgdGhlIHNlcnZlciBkb2Vzbid0IHB1Ymxpc2ggYW4gb3AgZm9yIHdoYXRldmVyIHJlYXNvblxuICAgIC8vIG9yIGJlY2F1c2Ugb2YgYSByYWNlIGNvbmRpdGlvbi4gSW4gYW55IGNhc2UsIHdlIGNhbiBzZW5kIGEgZmV0Y2hcbiAgICAvLyBjb21tYW5kIHRvIGNhdGNoIGJhY2sgdXAuXG4gICAgLy9cbiAgICAvLyBGZXRjaCBvbmx5IHNlbmRzIGEgbmV3IGZldGNoIGNvbW1hbmQgaWYgbm8gZmV0Y2hlcyBhcmUgaW5mbGlnaHQsIHdoaWNoXG4gICAgLy8gd2lsbCBhY3QgYXMgYSBuYXR1cmFsIGRlYm91bmNpbmcgc28gd2UgZG9uJ3Qgc2VuZCBtdWx0aXBsZSBmZXRjaFxuICAgIC8vIHJlcXVlc3RzIGZvciBtYW55IG9wcyByZWNlaXZlZCBhdCBvbmNlLlxuICAgIHRoaXMuZmV0Y2goKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAobWVzc2FnZS52IDwgdGhpcy52ZXJzaW9uKSB7XG4gICAgLy8gV2UgY2FuIHNhZmVseSBpZ25vcmUgdGhlIG9sZCAoZHVwbGljYXRlKSBvcGVyYXRpb24uXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKHRoaXMuaW5mbGlnaHRPcCkge1xuICAgIHZhciB0cmFuc2Zvcm1FcnIgPSB0cmFuc2Zvcm1YKHRoaXMuaW5mbGlnaHRPcCwgbWVzc2FnZSk7XG4gICAgaWYgKHRyYW5zZm9ybUVycikgcmV0dXJuIHRoaXMuX2hhcmRSb2xsYmFjayh0cmFuc2Zvcm1FcnIpO1xuICB9XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnBlbmRpbmdPcHMubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgdHJhbnNmb3JtRXJyID0gdHJhbnNmb3JtWCh0aGlzLnBlbmRpbmdPcHNbaV0sIG1lc3NhZ2UpO1xuICAgIGlmICh0cmFuc2Zvcm1FcnIpIHJldHVybiB0aGlzLl9oYXJkUm9sbGJhY2sodHJhbnNmb3JtRXJyKTtcbiAgfVxuXG4gIHRoaXMudmVyc2lvbisrO1xuICB0aGlzLl9vdEFwcGx5KG1lc3NhZ2UsIGZhbHNlKTtcbiAgcmV0dXJuO1xufTtcblxuLy8gQ2FsbGVkIHdoZW5ldmVyICh5b3UgZ3Vlc3NlZCBpdCEpIHRoZSBjb25uZWN0aW9uIHN0YXRlIGNoYW5nZXMuIFRoaXMgd2lsbFxuLy8gaGFwcGVuIHdoZW4gd2UgZ2V0IGRpc2Nvbm5lY3RlZCAmIHJlY29ubmVjdC5cbkRvYy5wcm90b3R5cGUuX29uQ29ubmVjdGlvblN0YXRlQ2hhbmdlZCA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5jb25uZWN0aW9uLmNhblNlbmQpIHtcbiAgICB0aGlzLmZsdXNoKCk7XG4gICAgdGhpcy5fcmVzdWJzY3JpYmUoKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAodGhpcy5pbmZsaWdodE9wKSB7XG4gICAgICB0aGlzLnBlbmRpbmdPcHMudW5zaGlmdCh0aGlzLmluZmxpZ2h0T3ApO1xuICAgICAgdGhpcy5pbmZsaWdodE9wID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5zdWJzY3JpYmVkID0gZmFsc2U7XG4gICAgaWYgKHRoaXMuaW5mbGlnaHRGZXRjaC5sZW5ndGggfHwgdGhpcy5pbmZsaWdodFN1YnNjcmliZS5sZW5ndGgpIHtcbiAgICAgIHRoaXMucGVuZGluZ0ZldGNoID0gdGhpcy5wZW5kaW5nRmV0Y2guY29uY2F0KHRoaXMuaW5mbGlnaHRGZXRjaCwgdGhpcy5pbmZsaWdodFN1YnNjcmliZSk7XG4gICAgICB0aGlzLmluZmxpZ2h0RmV0Y2gubGVuZ3RoID0gMDtcbiAgICAgIHRoaXMuaW5mbGlnaHRTdWJzY3JpYmUubGVuZ3RoID0gMDtcbiAgICB9XG4gICAgaWYgKHRoaXMuaW5mbGlnaHRVbnN1YnNjcmliZS5sZW5ndGgpIHtcbiAgICAgIHZhciBjYWxsYmFja3MgPSB0aGlzLmluZmxpZ2h0VW5zdWJzY3JpYmU7XG4gICAgICB0aGlzLmluZmxpZ2h0VW5zdWJzY3JpYmUgPSBbXTtcbiAgICAgIGNhbGxFYWNoKGNhbGxiYWNrcyk7XG4gICAgfVxuICB9XG59O1xuXG5Eb2MucHJvdG90eXBlLl9yZXN1YnNjcmliZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgY2FsbGJhY2tzID0gdGhpcy5wZW5kaW5nRmV0Y2g7XG4gIHRoaXMucGVuZGluZ0ZldGNoID0gW107XG5cbiAgaWYgKHRoaXMud2FudFN1YnNjcmliZSkge1xuICAgIGlmIChjYWxsYmFja3MubGVuZ3RoKSB7XG4gICAgICB0aGlzLnN1YnNjcmliZShmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgY2FsbEVhY2goY2FsbGJhY2tzLCBlcnIpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuc3Vic2NyaWJlKCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKGNhbGxiYWNrcy5sZW5ndGgpIHtcbiAgICB0aGlzLmZldGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgY2FsbEVhY2goY2FsbGJhY2tzLCBlcnIpO1xuICAgIH0pO1xuICB9XG59O1xuXG4vLyBSZXF1ZXN0IHRoZSBjdXJyZW50IGRvY3VtZW50IHNuYXBzaG90IG9yIG9wcyB0aGF0IGJyaW5nIHVzIHVwIHRvIGRhdGVcbkRvYy5wcm90b3R5cGUuZmV0Y2ggPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICBpZiAodGhpcy5jb25uZWN0aW9uLmNhblNlbmQpIHtcbiAgICB2YXIgaXNEdXBsaWNhdGUgPSB0aGlzLmNvbm5lY3Rpb24uc2VuZEZldGNoKHRoaXMpO1xuICAgIHB1c2hBY3Rpb25DYWxsYmFjayh0aGlzLmluZmxpZ2h0RmV0Y2gsIGlzRHVwbGljYXRlLCBjYWxsYmFjayk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHRoaXMucGVuZGluZ0ZldGNoLnB1c2goY2FsbGJhY2spO1xufTtcblxuLy8gRmV0Y2ggdGhlIGluaXRpYWwgZG9jdW1lbnQgYW5kIGtlZXAgcmVjZWl2aW5nIHVwZGF0ZXNcbkRvYy5wcm90b3R5cGUuc3Vic2NyaWJlID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgdGhpcy53YW50U3Vic2NyaWJlID0gdHJ1ZTtcbiAgaWYgKHRoaXMuY29ubmVjdGlvbi5jYW5TZW5kKSB7XG4gICAgdmFyIGlzRHVwbGljYXRlID0gdGhpcy5jb25uZWN0aW9uLnNlbmRTdWJzY3JpYmUodGhpcyk7XG4gICAgcHVzaEFjdGlvbkNhbGxiYWNrKHRoaXMuaW5mbGlnaHRTdWJzY3JpYmUsIGlzRHVwbGljYXRlLCBjYWxsYmFjayk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHRoaXMucGVuZGluZ0ZldGNoLnB1c2goY2FsbGJhY2spO1xufTtcblxuLy8gVW5zdWJzY3JpYmUuIFRoZSBkYXRhIHdpbGwgc3RheSBhcm91bmQgaW4gbG9jYWwgbWVtb3J5LCBidXQgd2UnbGwgc3RvcFxuLy8gcmVjZWl2aW5nIHVwZGF0ZXNcbkRvYy5wcm90b3R5cGUudW5zdWJzY3JpYmUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICB0aGlzLndhbnRTdWJzY3JpYmUgPSBmYWxzZTtcbiAgLy8gVGhlIHN1YnNjcmliZWQgc3RhdGUgc2hvdWxkIGJlIGNvbnNlcnZhdGl2ZSBpbiBpbmRpY2F0aW5nIHdoZW4gd2UgYXJlXG4gIC8vIHN1YnNjcmliZWQgb24gdGhlIHNlcnZlci4gV2UnbGwgYWN0dWFsbHkgYmUgdW5zdWJzY3JpYmVkIHNvbWUgdGltZVxuICAvLyBiZXR3ZWVuIHNlbmRpbmcgdGhlIG1lc3NhZ2UgYW5kIGhlYXJpbmcgYmFjaywgYnV0IHdlIGNhbm5vdCBrbm93IGV4YWN0bHlcbiAgLy8gd2hlbi4gVGh1cywgaW1tZWRpYXRlbHkgbWFyayB1cyBhcyBub3Qgc3Vic2NyaWJlZFxuICB0aGlzLnN1YnNjcmliZWQgPSBmYWxzZTtcbiAgaWYgKHRoaXMuY29ubmVjdGlvbi5jYW5TZW5kKSB7XG4gICAgdmFyIGlzRHVwbGljYXRlID0gdGhpcy5jb25uZWN0aW9uLnNlbmRVbnN1YnNjcmliZSh0aGlzKTtcbiAgICBwdXNoQWN0aW9uQ2FsbGJhY2sodGhpcy5pbmZsaWdodFVuc3Vic2NyaWJlLCBpc0R1cGxpY2F0ZSwgY2FsbGJhY2spO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoY2FsbGJhY2spIHByb2Nlc3MubmV4dFRpY2soY2FsbGJhY2spO1xufTtcblxuZnVuY3Rpb24gcHVzaEFjdGlvbkNhbGxiYWNrKGluZmxpZ2h0LCBpc0R1cGxpY2F0ZSwgY2FsbGJhY2spIHtcbiAgaWYgKGlzRHVwbGljYXRlKSB7XG4gICAgdmFyIGxhc3RDYWxsYmFjayA9IGluZmxpZ2h0LnBvcCgpO1xuICAgIGluZmxpZ2h0LnB1c2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICBsYXN0Q2FsbGJhY2sgJiYgbGFzdENhbGxiYWNrKGVycik7XG4gICAgICBjYWxsYmFjayAmJiBjYWxsYmFjayhlcnIpO1xuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGluZmxpZ2h0LnB1c2goY2FsbGJhY2spO1xuICB9XG59XG5cblxuLy8gT3BlcmF0aW9ucyAvL1xuXG4vLyBTZW5kIHRoZSBuZXh0IHBlbmRpbmcgb3AgdG8gdGhlIHNlcnZlciwgaWYgd2UgY2FuLlxuLy9cbi8vIE9ubHkgb25lIG9wZXJhdGlvbiBjYW4gYmUgaW4tZmxpZ2h0IGF0IGEgdGltZS4gSWYgYW4gb3BlcmF0aW9uIGlzIGFscmVhZHkgb25cbi8vIGl0cyB3YXksIG9yIHdlJ3JlIG5vdCBjdXJyZW50bHkgY29ubmVjdGVkLCB0aGlzIG1ldGhvZCBkb2VzIG5vdGhpbmcuXG5Eb2MucHJvdG90eXBlLmZsdXNoID0gZnVuY3Rpb24oKSB7XG4gIC8vIElnbm9yZSBpZiB3ZSBjYW4ndCBzZW5kIG9yIHdlIGFyZSBhbHJlYWR5IHNlbmRpbmcgYW4gb3BcbiAgaWYgKCF0aGlzLmNvbm5lY3Rpb24uY2FuU2VuZCB8fCB0aGlzLmluZmxpZ2h0T3ApIHJldHVybjtcblxuICAvLyBTZW5kIGZpcnN0IHBlbmRpbmcgb3AgdW5sZXNzIHBhdXNlZFxuICBpZiAoIXRoaXMucGF1c2VkICYmIHRoaXMucGVuZGluZ09wcy5sZW5ndGgpIHtcbiAgICB0aGlzLl9zZW5kT3AoKTtcbiAgfVxufTtcblxuLy8gSGVscGVyIGZ1bmN0aW9uIHRvIHNldCBvcCB0byBjb250YWluIGEgbm8tb3AuXG5mdW5jdGlvbiBzZXROb09wKG9wKSB7XG4gIGRlbGV0ZSBvcC5vcDtcbiAgZGVsZXRlIG9wLmNyZWF0ZTtcbiAgZGVsZXRlIG9wLmRlbDtcbn1cblxuLy8gVHJhbnNmb3JtIHNlcnZlciBvcCBkYXRhIGJ5IGEgY2xpZW50IG9wLCBhbmQgdmljZSB2ZXJzYS4gT3BzIGFyZSBlZGl0ZWQgaW4gcGxhY2UuXG5mdW5jdGlvbiB0cmFuc2Zvcm1YKGNsaWVudCwgc2VydmVyKSB7XG4gIC8vIE9yZGVyIG9mIHN0YXRlbWVudHMgaW4gdGhpcyBmdW5jdGlvbiBtYXR0ZXJzLiBCZSBlc3BlY2lhbGx5IGNhcmVmdWwgaWZcbiAgLy8gcmVmYWN0b3JpbmcgdGhpcyBmdW5jdGlvblxuXG4gIC8vIEEgY2xpZW50IGRlbGV0ZSBvcCBzaG91bGQgZG9taW5hdGUgaWYgYm90aCB0aGUgc2VydmVyIGFuZCB0aGUgY2xpZW50XG4gIC8vIGRlbGV0ZSB0aGUgZG9jdW1lbnQuIFRodXMsIGFueSBvcHMgZm9sbG93aW5nIHRoZSBjbGllbnQgZGVsZXRlIChzdWNoIGFzIGFcbiAgLy8gc3Vic2VxdWVudCBjcmVhdGUpIHdpbGwgYmUgbWFpbnRhaW5lZCwgc2luY2UgdGhlIHNlcnZlciBvcCBpcyB0cmFuc2Zvcm1lZFxuICAvLyB0byBhIG5vLW9wXG4gIGlmIChjbGllbnQuZGVsKSByZXR1cm4gc2V0Tm9PcChzZXJ2ZXIpO1xuXG4gIGlmIChzZXJ2ZXIuZGVsKSB7XG4gICAgcmV0dXJuIG5ldyBTaGFyZURCRXJyb3IoNDAxNywgJ0RvY3VtZW50IHdhcyBkZWxldGVkJyk7XG4gIH1cbiAgaWYgKHNlcnZlci5jcmVhdGUpIHtcbiAgICByZXR1cm4gbmV3IFNoYXJlREJFcnJvcig0MDE4LCAnRG9jdW1lbnQgYWxyZWR5IGNyZWF0ZWQnKTtcbiAgfVxuXG4gIC8vIElnbm9yZSBuby1vcCBjb21pbmcgZnJvbSBzZXJ2ZXJcbiAgaWYgKCFzZXJ2ZXIub3ApIHJldHVybjtcblxuICAvLyBJIGJlbGlldmUgdGhhdCB0aGlzIHNob3VsZCBub3Qgb2NjdXIsIGJ1dCBjaGVjayBqdXN0IGluIGNhc2VcbiAgaWYgKGNsaWVudC5jcmVhdGUpIHtcbiAgICByZXR1cm4gbmV3IFNoYXJlREJFcnJvcig0MDE4LCAnRG9jdW1lbnQgYWxyZWFkeSBjcmVhdGVkJyk7XG4gIH1cblxuICAvLyBUaGV5IGJvdGggZWRpdGVkIHRoZSBkb2N1bWVudC4gVGhpcyBpcyB0aGUgbm9ybWFsIGNhc2UgZm9yIHRoaXMgZnVuY3Rpb24gLVxuICAvLyBhcyBpbiwgbW9zdCBvZiB0aGUgdGltZSB3ZSdsbCBlbmQgdXAgZG93biBoZXJlLlxuICAvL1xuICAvLyBZb3Ugc2hvdWxkIGJlIHdvbmRlcmluZyB3aHkgSSdtIHVzaW5nIGNsaWVudC50eXBlIGluc3RlYWQgb2YgdGhpcy50eXBlLlxuICAvLyBUaGUgcmVhc29uIGlzLCBpZiB3ZSBnZXQgb3BzIGF0IGFuIG9sZCB2ZXJzaW9uIG9mIHRoZSBkb2N1bWVudCwgdGhpcy50eXBlXG4gIC8vIG1pZ2h0IGJlIHVuZGVmaW5lZCBvciBhIHRvdGFsbHkgZGlmZmVyZW50IHR5cGUuIEJ5IHBpbm5pbmcgdGhlIHR5cGUgdG8gdGhlXG4gIC8vIG9wIGRhdGEsIHdlIG1ha2Ugc3VyZSB0aGUgcmlnaHQgdHlwZSBoYXMgaXRzIHRyYW5zZm9ybSBmdW5jdGlvbiBjYWxsZWQuXG4gIGlmIChjbGllbnQudHlwZS50cmFuc2Zvcm1YKSB7XG4gICAgdmFyIHJlc3VsdCA9IGNsaWVudC50eXBlLnRyYW5zZm9ybVgoY2xpZW50Lm9wLCBzZXJ2ZXIub3ApO1xuICAgIGNsaWVudC5vcCA9IHJlc3VsdFswXTtcbiAgICBzZXJ2ZXIub3AgPSByZXN1bHRbMV07XG4gIH0gZWxzZSB7XG4gICAgdmFyIGNsaWVudE9wID0gY2xpZW50LnR5cGUudHJhbnNmb3JtKGNsaWVudC5vcCwgc2VydmVyLm9wLCAnbGVmdCcpO1xuICAgIHZhciBzZXJ2ZXJPcCA9IGNsaWVudC50eXBlLnRyYW5zZm9ybShzZXJ2ZXIub3AsIGNsaWVudC5vcCwgJ3JpZ2h0Jyk7XG4gICAgY2xpZW50Lm9wID0gY2xpZW50T3A7XG4gICAgc2VydmVyLm9wID0gc2VydmVyT3A7XG4gIH1cbn07XG5cbi8qKlxuICogQXBwbGllcyB0aGUgb3BlcmF0aW9uIHRvIHRoZSBzbmFwc2hvdFxuICpcbiAqIElmIHRoZSBvcGVyYXRpb24gaXMgY3JlYXRlIG9yIGRlbGV0ZSBpdCBlbWl0cyBgY3JlYXRlYCBvciBgZGVsYC4gVGhlbiB0aGVcbiAqIG9wZXJhdGlvbiBpcyBhcHBsaWVkIHRvIHRoZSBzbmFwc2hvdCBhbmQgYG9wYCBhbmQgYGFmdGVyIG9wYCBhcmUgZW1pdHRlZC5cbiAqIElmIHRoZSB0eXBlIHN1cHBvcnRzIGluY3JlbWVudGFsIHVwZGF0ZXMgYW5kIGB0aGlzLmluY3JlbWVudGFsYCBpcyB0cnVlIHdlXG4gKiBmaXJlIGBvcGAgYWZ0ZXIgZXZlcnkgc21hbGwgb3BlcmF0aW9uLlxuICpcbiAqIFRoaXMgaXMgdGhlIG9ubHkgZnVuY3Rpb24gdG8gZmlyZSB0aGUgYWJvdmUgbWVudGlvbmVkIGV2ZW50cy5cbiAqXG4gKiBAcHJpdmF0ZVxuICovXG5Eb2MucHJvdG90eXBlLl9vdEFwcGx5ID0gZnVuY3Rpb24ob3AsIHNvdXJjZSkge1xuICBpZiAob3Aub3ApIHtcbiAgICBpZiAoIXRoaXMudHlwZSkge1xuICAgICAgdmFyIGVyciA9IG5ldyBTaGFyZURCRXJyb3IoNDAxNSwgJ0Nhbm5vdCBhcHBseSBvcCB0byB1bmNyZWF0ZWQgZG9jdW1lbnQuICcgKyB0aGlzLmNvbGxlY3Rpb24gKyAnLicgKyB0aGlzLmlkKTtcbiAgICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICB9XG5cbiAgICAvLyBJdGVyYXRpdmVseSBhcHBseSBtdWx0aS1jb21wb25lbnQgcmVtb3RlIG9wZXJhdGlvbnMgYW5kIHJvbGxiYWNrIG9wc1xuICAgIC8vIChzb3VyY2UgPT09IGZhbHNlKSBmb3IgdGhlIGRlZmF1bHQgSlNPTjAgT1QgdHlwZS4gSXQgY291bGQgdXNlXG4gICAgLy8gdHlwZS5zaGF0dGVyKCksIGJ1dCBzaW5jZSB0aGlzIGNvZGUgaXMgc28gc3BlY2lmaWMgdG8gdXNlIGNhc2VzIGZvciB0aGVcbiAgICAvLyBKU09OMCB0eXBlIGFuZCBTaGFyZURCIGV4cGxpY2l0bHkgYnVuZGxlcyB0aGUgZGVmYXVsdCB0eXBlLCB3ZSBtaWdodCBhc1xuICAgIC8vIHdlbGwgd3JpdGUgaXQgdGhpcyB3YXkgYW5kIHNhdmUgbmVlZGluZyB0byBpdGVyYXRlIHRocm91Z2ggdGhlIG9wXG4gICAgLy8gY29tcG9uZW50cyB0d2ljZS5cbiAgICAvL1xuICAgIC8vIElkZWFsbHksIHdlIHdvdWxkIG5vdCBuZWVkIHRoaXMgZXh0cmEgY29tcGxleGl0eS4gSG93ZXZlciwgaXQgaXNcbiAgICAvLyBoZWxwZnVsIGZvciBpbXBsZW1lbnRpbmcgYmluZGluZ3MgdGhhdCB1cGRhdGUgRE9NIG5vZGVzIGFuZCBvdGhlclxuICAgIC8vIHN0YXRlZnVsIG9iamVjdHMgYnkgdHJhbnNsYXRpbmcgb3AgZXZlbnRzIGRpcmVjdGx5IGludG8gY29ycmVzcG9uZGluZ1xuICAgIC8vIG11dGF0aW9ucy4gU3VjaCBiaW5kaW5ncyBhcmUgbW9zdCBlYXNpbHkgd3JpdHRlbiBhcyByZXNwb25kaW5nIHRvXG4gICAgLy8gaW5kaXZpZHVhbCBvcCBjb21wb25lbnRzIG9uZSBhdCBhIHRpbWUgaW4gb3JkZXIsIGFuZCBpdCBpcyBpbXBvcnRhbnRcbiAgICAvLyB0aGF0IHRoZSBzbmFwc2hvdCBvbmx5IGluY2x1ZGUgdXBkYXRlcyBmcm9tIHRoZSBwYXJ0aWN1bGFyIG9wIGNvbXBvbmVudFxuICAgIC8vIGF0IHRoZSB0aW1lIG9mIGVtaXNzaW9uLiBFbGltaW5hdGluZyB0aGlzIHdvdWxkIHJlcXVpcmUgcmV0aGlua2luZyBob3dcbiAgICAvLyBzdWNoIGV4dGVybmFsIGJpbmRpbmdzIGFyZSBpbXBsZW1lbnRlZC5cbiAgICBpZiAoIXNvdXJjZSAmJiB0aGlzLnR5cGUgPT09IHR5cGVzLmRlZmF1bHRUeXBlICYmIG9wLm9wLmxlbmd0aCA+IDEpIHtcbiAgICAgIGlmICghdGhpcy5hcHBseVN0YWNrKSB0aGlzLmFwcGx5U3RhY2sgPSBbXTtcbiAgICAgIHZhciBzdGFja0xlbmd0aCA9IHRoaXMuYXBwbHlTdGFjay5sZW5ndGg7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9wLm9wLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBjb21wb25lbnQgPSBvcC5vcFtpXTtcbiAgICAgICAgdmFyIGNvbXBvbmVudE9wID0ge29wOiBbY29tcG9uZW50XX07XG4gICAgICAgIC8vIFRyYW5zZm9ybSBjb21wb25lbnRPcCBhZ2FpbnN0IGFueSBvcHMgdGhhdCBoYXZlIGJlZW4gc3VibWl0dGVkXG4gICAgICAgIC8vIHN5Y2hyb25vdXNseSBpbnNpZGUgb2YgYW4gb3AgZXZlbnQgaGFuZGxlciBzaW5jZSB3ZSBiZWdhbiBhcHBseSBvZlxuICAgICAgICAvLyBvdXIgb3BlcmF0aW9uXG4gICAgICAgIGZvciAodmFyIGogPSBzdGFja0xlbmd0aDsgaiA8IHRoaXMuYXBwbHlTdGFjay5sZW5ndGg7IGorKykge1xuICAgICAgICAgIHZhciB0cmFuc2Zvcm1FcnIgPSB0cmFuc2Zvcm1YKHRoaXMuYXBwbHlTdGFja1tqXSwgY29tcG9uZW50T3ApO1xuICAgICAgICAgIGlmICh0cmFuc2Zvcm1FcnIpIHJldHVybiB0aGlzLl9oYXJkUm9sbGJhY2sodHJhbnNmb3JtRXJyKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBBcHBseSB0aGUgaW5kaXZpZHVhbCBvcCBjb21wb25lbnRcbiAgICAgICAgdGhpcy5lbWl0KCdiZWZvcmUgb3AnLCBjb21wb25lbnRPcC5vcCwgc291cmNlKTtcbiAgICAgICAgdGhpcy5kYXRhID0gdGhpcy50eXBlLmFwcGx5KHRoaXMuZGF0YSwgY29tcG9uZW50T3Aub3ApO1xuICAgICAgICB0aGlzLmVtaXQoJ29wJywgY29tcG9uZW50T3Aub3AsIHNvdXJjZSk7XG4gICAgICB9XG4gICAgICAvLyBQb3Agd2hhdGV2ZXIgd2FzIHN1Ym1pdHRlZCBzaW5jZSB3ZSBzdGFydGVkIGFwcGx5aW5nIHRoaXMgb3BcbiAgICAgIHRoaXMuX3BvcEFwcGx5U3RhY2soc3RhY2tMZW5ndGgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFRoZSAnYmVmb3JlIG9wJyBldmVudCBlbmFibGVzIGNsaWVudHMgdG8gcHVsbCBhbnkgbmVjZXNzYXJ5IGRhdGEgb3V0IG9mXG4gICAgLy8gdGhlIHNuYXBzaG90IGJlZm9yZSBpdCBnZXRzIGNoYW5nZWRcbiAgICB0aGlzLmVtaXQoJ2JlZm9yZSBvcCcsIG9wLm9wLCBzb3VyY2UpO1xuICAgIC8vIEFwcGx5IHRoZSBvcGVyYXRpb24gdG8gdGhlIGxvY2FsIGRhdGEsIG11dGF0aW5nIGl0IGluIHBsYWNlXG4gICAgdGhpcy5kYXRhID0gdGhpcy50eXBlLmFwcGx5KHRoaXMuZGF0YSwgb3Aub3ApO1xuICAgIC8vIEVtaXQgYW4gJ29wJyBldmVudCBvbmNlIHRoZSBsb2NhbCBkYXRhIGluY2x1ZGVzIHRoZSBjaGFuZ2VzIGZyb20gdGhlXG4gICAgLy8gb3AuIEZvciBsb2NhbGx5IHN1Ym1pdHRlZCBvcHMsIHRoaXMgd2lsbCBiZSBzeW5jaHJvbm91c2x5IHdpdGhcbiAgICAvLyBzdWJtaXNzaW9uIGFuZCBiZWZvcmUgdGhlIHNlcnZlciBvciBvdGhlciBjbGllbnRzIGhhdmUgcmVjZWl2ZWQgdGhlIG9wLlxuICAgIC8vIEZvciBvcHMgZnJvbSBvdGhlciBjbGllbnRzLCB0aGlzIHdpbGwgYmUgYWZ0ZXIgdGhlIG9wIGhhcyBiZWVuXG4gICAgLy8gY29tbWl0dGVkIHRvIHRoZSBkYXRhYmFzZSBhbmQgcHVibGlzaGVkXG4gICAgdGhpcy5lbWl0KCdvcCcsIG9wLm9wLCBzb3VyY2UpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChvcC5jcmVhdGUpIHtcbiAgICB0aGlzLl9zZXRUeXBlKG9wLmNyZWF0ZS50eXBlKTtcbiAgICB0aGlzLmRhdGEgPSAodGhpcy50eXBlLmRlc2VyaWFsaXplKSA/XG4gICAgICAodGhpcy50eXBlLmNyZWF0ZURlc2VyaWFsaXplZCkgP1xuICAgICAgICB0aGlzLnR5cGUuY3JlYXRlRGVzZXJpYWxpemVkKG9wLmNyZWF0ZS5kYXRhKSA6XG4gICAgICAgIHRoaXMudHlwZS5kZXNlcmlhbGl6ZSh0aGlzLnR5cGUuY3JlYXRlKG9wLmNyZWF0ZS5kYXRhKSkgOlxuICAgICAgdGhpcy50eXBlLmNyZWF0ZShvcC5jcmVhdGUuZGF0YSk7XG4gICAgdGhpcy5lbWl0KCdjcmVhdGUnLCBzb3VyY2UpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChvcC5kZWwpIHtcbiAgICB2YXIgb2xkRGF0YSA9IHRoaXMuZGF0YTtcbiAgICB0aGlzLl9zZXRUeXBlKG51bGwpO1xuICAgIHRoaXMuZW1pdCgnZGVsJywgb2xkRGF0YSwgc291cmNlKTtcbiAgICByZXR1cm47XG4gIH1cbn07XG5cblxuLy8gKioqKiogU2VuZGluZyBvcGVyYXRpb25zXG5cbi8vIEFjdHVhbGx5IHNlbmQgb3AgdG8gdGhlIHNlcnZlci5cbkRvYy5wcm90b3R5cGUuX3NlbmRPcCA9IGZ1bmN0aW9uKCkge1xuICAvLyBXYWl0IHVudGlsIHdlIGhhdmUgYSBzcmMgaWQgZnJvbSB0aGUgc2VydmVyXG4gIHZhciBzcmMgPSB0aGlzLmNvbm5lY3Rpb24uaWQ7XG4gIGlmICghc3JjKSByZXR1cm47XG5cbiAgLy8gV2hlbiB0aGVyZSBpcyBubyBpbmZsaWdodE9wLCBzZW5kIHRoZSBmaXJzdCBpdGVtIGluIHBlbmRpbmdPcHMuIElmXG4gIC8vIHRoZXJlIGlzIGluZmxpZ2h0T3AsIHRyeSBzZW5kaW5nIGl0IGFnYWluXG4gIGlmICghdGhpcy5pbmZsaWdodE9wKSB7XG4gICAgLy8gU2VuZCBmaXJzdCBwZW5kaW5nIG9wXG4gICAgdGhpcy5pbmZsaWdodE9wID0gdGhpcy5wZW5kaW5nT3BzLnNoaWZ0KCk7XG4gIH1cbiAgdmFyIG9wID0gdGhpcy5pbmZsaWdodE9wO1xuICBpZiAoIW9wKSB7XG4gICAgdmFyIGVyciA9IG5ldyBTaGFyZURCRXJyb3IoNTAxMCwgJ05vIG9wIHRvIHNlbmQgb24gY2FsbCB0byBfc2VuZE9wJyk7XG4gICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICB9XG5cbiAgLy8gVHJhY2sgZGF0YSBmb3IgcmV0cnlpbmcgb3BzXG4gIG9wLnNlbnRBdCA9IERhdGUubm93KCk7XG4gIG9wLnJldHJpZXMgPSAob3AucmV0cmllcyA9PSBudWxsKSA/IDAgOiBvcC5yZXRyaWVzICsgMTtcblxuICAvLyBUaGUgc3JjICsgc2VxIG51bWJlciBpcyBhIHVuaXF1ZSBJRCByZXByZXNlbnRpbmcgdGhpcyBvcGVyYXRpb24uIFRoaXMgdHVwbGVcbiAgLy8gaXMgdXNlZCBvbiB0aGUgc2VydmVyIHRvIGRldGVjdCB3aGVuIG9wcyBoYXZlIGJlZW4gc2VudCBtdWx0aXBsZSB0aW1lcyBhbmRcbiAgLy8gb24gdGhlIGNsaWVudCB0byBtYXRjaCBhY2tub3dsZWRnZW1lbnQgb2YgYW4gb3AgYmFjayB0byB0aGUgaW5mbGlnaHRPcC5cbiAgLy8gTm90ZSB0aGF0IHRoZSBzcmMgY291bGQgYmUgZGlmZmVyZW50IGZyb20gdGhpcy5jb25uZWN0aW9uLmlkIGFmdGVyIGFcbiAgLy8gcmVjb25uZWN0LCBzaW5jZSBhbiBvcCBtYXkgc3RpbGwgYmUgcGVuZGluZyBhZnRlciB0aGUgcmVjb25uZWN0aW9uIGFuZFxuICAvLyB0aGlzLmNvbm5lY3Rpb24uaWQgd2lsbCBjaGFuZ2UuIEluIGNhc2UgYW4gb3AgaXMgc2VudCBtdWx0aXBsZSB0aW1lcywgd2VcbiAgLy8gYWxzbyBuZWVkIHRvIGJlIGNhcmVmdWwgbm90IHRvIG92ZXJyaWRlIHRoZSBvcmlnaW5hbCBzZXEgdmFsdWUuXG4gIGlmIChvcC5zZXEgPT0gbnVsbCkgb3Auc2VxID0gdGhpcy5jb25uZWN0aW9uLnNlcSsrO1xuXG4gIHRoaXMuY29ubmVjdGlvbi5zZW5kT3AodGhpcywgb3ApO1xuXG4gIC8vIHNyYyBpc24ndCBuZWVkZWQgb24gdGhlIGZpcnN0IHRyeSwgc2luY2UgdGhlIHNlcnZlciBzZXNzaW9uIHdpbGwgaGF2ZSB0aGVcbiAgLy8gc2FtZSBpZCwgYnV0IGl0IG11c3QgYmUgc2V0IG9uIHRoZSBpbmZsaWdodE9wIGluIGNhc2UgaXQgaXMgc2VudCBhZ2FpblxuICAvLyBhZnRlciBhIHJlY29ubmVjdCBhbmQgdGhlIGNvbm5lY3Rpb24ncyBpZCBoYXMgY2hhbmdlZCBieSB0aGVuXG4gIGlmIChvcC5zcmMgPT0gbnVsbCkgb3Auc3JjID0gc3JjO1xufTtcblxuXG4vLyBRdWV1ZXMgdGhlIG9wZXJhdGlvbiBmb3Igc3VibWlzc2lvbiB0byB0aGUgc2VydmVyIGFuZCBhcHBsaWVzIGl0IGxvY2FsbHkuXG4vL1xuLy8gSW50ZXJuYWwgbWV0aG9kIGNhbGxlZCB0byBkbyB0aGUgYWN0dWFsIHdvcmsgZm9yIHN1Ym1pdCgpLCBjcmVhdGUoKSBhbmQgZGVsKCkuXG4vLyBAcHJpdmF0ZVxuLy9cbi8vIEBwYXJhbSBvcFxuLy8gQHBhcmFtIFtvcC5vcF1cbi8vIEBwYXJhbSBbb3AuZGVsXVxuLy8gQHBhcmFtIFtvcC5jcmVhdGVdXG4vLyBAcGFyYW0gW2NhbGxiYWNrXSBjYWxsZWQgd2hlbiBvcGVyYXRpb24gaXMgc3VibWl0dGVkXG5Eb2MucHJvdG90eXBlLl9zdWJtaXQgPSBmdW5jdGlvbihvcCwgc291cmNlLCBjYWxsYmFjaykge1xuICAvLyBMb2NhbGx5IHN1Ym1pdHRlZCBvcHMgbXVzdCBhbHdheXMgaGF2ZSBhIHRydXRoeSBzb3VyY2VcbiAgaWYgKCFzb3VyY2UpIHNvdXJjZSA9IHRydWU7XG5cbiAgLy8gVGhlIG9wIGNvbnRhaW5zIGVpdGhlciBvcCwgY3JlYXRlLCBkZWxldGUsIG9yIG5vbmUgb2YgdGhlIGFib3ZlIChhIG5vLW9wKS5cbiAgaWYgKG9wLm9wKSB7XG4gICAgaWYgKCF0aGlzLnR5cGUpIHtcbiAgICAgIHZhciBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDQwMTUsICdDYW5ub3Qgc3VibWl0IG9wLiBEb2N1bWVudCBoYXMgbm90IGJlZW4gY3JlYXRlZC4gJyArIHRoaXMuY29sbGVjdGlvbiArICcuJyArIHRoaXMuaWQpO1xuICAgICAgaWYgKGNhbGxiYWNrKSByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICB9XG4gICAgLy8gVHJ5IHRvIG5vcm1hbGl6ZSB0aGUgb3AuIFRoaXMgcmVtb3ZlcyB0cmFpbGluZyBza2lwOjAncyBhbmQgdGhpbmdzIGxpa2UgdGhhdC5cbiAgICBpZiAodGhpcy50eXBlLm5vcm1hbGl6ZSkgb3Aub3AgPSB0aGlzLnR5cGUubm9ybWFsaXplKG9wLm9wKTtcbiAgfVxuXG4gIHRoaXMuX3B1c2hPcChvcCwgY2FsbGJhY2spO1xuICB0aGlzLl9vdEFwcGx5KG9wLCBzb3VyY2UpO1xuXG4gIC8vIFRoZSBjYWxsIHRvIGZsdXNoIGlzIGRlbGF5ZWQgc28gaWYgc3VibWl0KCkgaXMgY2FsbGVkIG11bHRpcGxlIHRpbWVzXG4gIC8vIHN5bmNocm9ub3VzbHksIGFsbCB0aGUgb3BzIGFyZSBjb21iaW5lZCBiZWZvcmUgYmVpbmcgc2VudCB0byB0aGUgc2VydmVyLlxuICB2YXIgZG9jID0gdGhpcztcbiAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICBkb2MuZmx1c2goKTtcbiAgfSk7XG59O1xuXG5Eb2MucHJvdG90eXBlLl9wdXNoT3AgPSBmdW5jdGlvbihvcCwgY2FsbGJhY2spIHtcbiAgaWYgKHRoaXMuYXBwbHlTdGFjaykge1xuICAgIC8vIElmIHdlIGFyZSBpbiB0aGUgcHJvY2VzcyBvZiBpbmNyZW1lbnRhbGx5IGFwcGx5aW5nIGFuIG9wZXJhdGlvbiwgZG9uJ3RcbiAgICAvLyBjb21wb3NlIHRoZSBvcCBhbmQgcHVzaCBpdCBvbnRvIHRoZSBhcHBseVN0YWNrIHNvIGl0IGNhbiBiZSB0cmFuc2Zvcm1lZFxuICAgIC8vIGFnYWluc3Qgb3RoZXIgY29tcG9uZW50cyBmcm9tIHRoZSBvcCBvciBvcHMgYmVpbmcgYXBwbGllZFxuICAgIHRoaXMuYXBwbHlTdGFjay5wdXNoKG9wKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBJZiB0aGUgdHlwZSBzdXBwb3J0cyBjb21wb3NlcywgdHJ5IHRvIGNvbXBvc2UgdGhlIG9wZXJhdGlvbiBvbnRvIHRoZVxuICAgIC8vIGVuZCBvZiB0aGUgbGFzdCBwZW5kaW5nIG9wZXJhdGlvbi5cbiAgICB2YXIgY29tcG9zZWQgPSB0aGlzLl90cnlDb21wb3NlKG9wKTtcbiAgICBpZiAoY29tcG9zZWQpIHtcbiAgICAgIGNvbXBvc2VkLmNhbGxiYWNrcy5wdXNoKGNhbGxiYWNrKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cbiAgLy8gUHVzaCBvbiB0byB0aGUgcGVuZGluZ09wcyBxdWV1ZSBvZiBvcHMgdG8gc3VibWl0IGlmIHdlIGRpZG4ndCBjb21wb3NlXG4gIG9wLnR5cGUgPSB0aGlzLnR5cGU7XG4gIG9wLmNhbGxiYWNrcyA9IFtjYWxsYmFja107XG4gIHRoaXMucGVuZGluZ09wcy5wdXNoKG9wKTtcbn07XG5cbkRvYy5wcm90b3R5cGUuX3BvcEFwcGx5U3RhY2sgPSBmdW5jdGlvbih0bykge1xuICBpZiAodG8gPiAwKSB7XG4gICAgdGhpcy5hcHBseVN0YWNrLmxlbmd0aCA9IHRvO1xuICAgIHJldHVybjtcbiAgfVxuICAvLyBPbmNlIHdlIGhhdmUgY29tcGxldGVkIHRoZSBvdXRlcm1vc3QgYXBwbHkgbG9vcCwgcmVzZXQgdG8gbnVsbCBhbmQgbm9cbiAgLy8gbG9uZ2VyIGFkZCBvcHMgdG8gdGhlIGFwcGx5U3RhY2sgYXMgdGhleSBhcmUgc3VibWl0dGVkXG4gIHZhciBvcCA9IHRoaXMuYXBwbHlTdGFja1swXTtcbiAgdGhpcy5hcHBseVN0YWNrID0gbnVsbDtcbiAgaWYgKCFvcCkgcmV0dXJuO1xuICAvLyBDb21wb3NlIHRoZSBvcHMgYWRkZWQgc2luY2UgdGhlIGJlZ2lubmluZyBvZiB0aGUgYXBwbHkgc3RhY2ssIHNpbmNlIHdlXG4gIC8vIGhhZCB0byBza2lwIGNvbXBvc2Ugd2hlbiB0aGV5IHdlcmUgb3JpZ2luYWxseSBwdXNoZWRcbiAgdmFyIGkgPSB0aGlzLnBlbmRpbmdPcHMuaW5kZXhPZihvcCk7XG4gIGlmIChpID09PSAtMSkgcmV0dXJuO1xuICB2YXIgb3BzID0gdGhpcy5wZW5kaW5nT3BzLnNwbGljZShpKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcHMubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgb3AgPSBvcHNbaV07XG4gICAgdmFyIGNvbXBvc2VkID0gdGhpcy5fdHJ5Q29tcG9zZShvcCk7XG4gICAgaWYgKGNvbXBvc2VkKSB7XG4gICAgICBjb21wb3NlZC5jYWxsYmFja3MgPSBjb21wb3NlZC5jYWxsYmFja3MuY29uY2F0KG9wLmNhbGxiYWNrcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucGVuZGluZ09wcy5wdXNoKG9wKTtcbiAgICB9XG4gIH1cbn07XG5cbi8vIFRyeSB0byBjb21wb3NlIGEgc3VibWl0dGVkIG9wIGludG8gdGhlIGxhc3QgcGVuZGluZyBvcC4gUmV0dXJucyB0aGVcbi8vIGNvbXBvc2VkIG9wIGlmIGl0IHN1Y2NlZWRzLCB1bmRlZmluZWQgb3RoZXJ3aXNlXG5Eb2MucHJvdG90eXBlLl90cnlDb21wb3NlID0gZnVuY3Rpb24ob3ApIHtcbiAgaWYgKHRoaXMucHJldmVudENvbXBvc2UpIHJldHVybjtcblxuICAvLyBXZSBjYW4gb25seSBjb21wb3NlIGludG8gdGhlIGxhc3QgcGVuZGluZyBvcC4gSW5mbGlnaHQgb3BzIGhhdmUgYWxyZWFkeVxuICAvLyBiZWVuIHNlbnQgdG8gdGhlIHNlcnZlciwgc28gd2UgY2FuJ3QgbW9kaWZ5IHRoZW1cbiAgdmFyIGxhc3QgPSB0aGlzLnBlbmRpbmdPcHNbdGhpcy5wZW5kaW5nT3BzLmxlbmd0aCAtIDFdO1xuICBpZiAoIWxhc3QpIHJldHVybjtcblxuICAvLyBDb21wb3NlIGFuIG9wIGludG8gYSBjcmVhdGUgYnkgYXBwbHlpbmcgaXQuIFRoaXMgZWZmZWN0aXZlbHkgbWFrZXMgdGhlIG9wXG4gIC8vIGludmlzaWJsZSwgYXMgaWYgdGhlIGRvY3VtZW50IHdlcmUgY3JlYXRlZCBpbmNsdWRpbmcgdGhlIG9wIG9yaWdpbmFsbHlcbiAgaWYgKGxhc3QuY3JlYXRlICYmIG9wLm9wKSB7XG4gICAgbGFzdC5jcmVhdGUuZGF0YSA9IHRoaXMudHlwZS5hcHBseShsYXN0LmNyZWF0ZS5kYXRhLCBvcC5vcCk7XG4gICAgcmV0dXJuIGxhc3Q7XG4gIH1cblxuICAvLyBDb21wb3NlIHR3byBvcHMgaW50byBhIHNpbmdsZSBvcCBpZiBzdXBwb3J0ZWQgYnkgdGhlIHR5cGUuIFR5cGVzIHRoYXRcbiAgLy8gc3VwcG9ydCBjb21wb3NlIG11c3QgYmUgYWJsZSB0byBjb21wb3NlIGFueSB0d28gb3BzIHRvZ2V0aGVyXG4gIGlmIChsYXN0Lm9wICYmIG9wLm9wICYmIHRoaXMudHlwZS5jb21wb3NlKSB7XG4gICAgbGFzdC5vcCA9IHRoaXMudHlwZS5jb21wb3NlKGxhc3Qub3AsIG9wLm9wKTtcbiAgICByZXR1cm4gbGFzdDtcbiAgfVxufTtcblxuLy8gKioqIENsaWVudCBPVCBlbnRyeXBvaW50cy5cblxuLy8gU3VibWl0IGFuIG9wZXJhdGlvbiB0byB0aGUgZG9jdW1lbnQuXG4vL1xuLy8gQHBhcmFtIG9wZXJhdGlvbiBoYW5kbGVkIGJ5IHRoZSBPVCB0eXBlXG4vLyBAcGFyYW0gb3B0aW9ucyAge3NvdXJjZTogLi4ufVxuLy8gQHBhcmFtIFtjYWxsYmFja10gY2FsbGVkIGFmdGVyIG9wZXJhdGlvbiBzdWJtaXR0ZWRcbi8vXG4vLyBAZmlyZXMgYmVmb3JlIG9wLCBvcCwgYWZ0ZXIgb3BcbkRvYy5wcm90b3R5cGUuc3VibWl0T3AgPSBmdW5jdGlvbihjb21wb25lbnQsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICBvcHRpb25zID0gbnVsbDtcbiAgfVxuICB2YXIgb3AgPSB7b3A6IGNvbXBvbmVudH07XG4gIHZhciBzb3VyY2UgPSBvcHRpb25zICYmIG9wdGlvbnMuc291cmNlO1xuICB0aGlzLl9zdWJtaXQob3AsIHNvdXJjZSwgY2FsbGJhY2spO1xufTtcblxuLy8gQ3JlYXRlIHRoZSBkb2N1bWVudCwgd2hpY2ggaW4gU2hhcmVKUyBzZW1hbnRpY3MgbWVhbnMgdG8gc2V0IGl0cyB0eXBlLiBFdmVyeVxuLy8gb2JqZWN0IGltcGxpY2l0bHkgZXhpc3RzIGluIHRoZSBkYXRhYmFzZSBidXQgaGFzIG5vIGRhdGEgYW5kIG5vIHR5cGUuIENyZWF0ZVxuLy8gc2V0cyB0aGUgdHlwZSBvZiB0aGUgb2JqZWN0IGFuZCBjYW4gb3B0aW9uYWxseSBzZXQgc29tZSBpbml0aWFsIGRhdGEgb24gdGhlXG4vLyBvYmplY3QsIGRlcGVuZGluZyBvbiB0aGUgdHlwZS5cbi8vXG4vLyBAcGFyYW0gZGF0YSAgaW5pdGlhbFxuLy8gQHBhcmFtIHR5cGUgIE9UIHR5cGVcbi8vIEBwYXJhbSBvcHRpb25zICB7c291cmNlOiAuLi59XG4vLyBAcGFyYW0gY2FsbGJhY2sgIGNhbGxlZCB3aGVuIG9wZXJhdGlvbiBzdWJtaXR0ZWRcbkRvYy5wcm90b3R5cGUuY3JlYXRlID0gZnVuY3Rpb24oZGF0YSwgdHlwZSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgaWYgKHR5cGVvZiB0eXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY2FsbGJhY2sgPSB0eXBlO1xuICAgIG9wdGlvbnMgPSBudWxsO1xuICAgIHR5cGUgPSBudWxsO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgIG9wdGlvbnMgPSBudWxsO1xuICB9XG4gIGlmICghdHlwZSkge1xuICAgIHR5cGUgPSB0eXBlcy5kZWZhdWx0VHlwZS51cmk7XG4gIH1cbiAgaWYgKHRoaXMudHlwZSkge1xuICAgIHZhciBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDQwMTYsICdEb2N1bWVudCBhbHJlYWR5IGV4aXN0cycpO1xuICAgIGlmIChjYWxsYmFjaykgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICB9XG4gIHZhciBvcCA9IHtjcmVhdGU6IHt0eXBlOiB0eXBlLCBkYXRhOiBkYXRhfX07XG4gIHZhciBzb3VyY2UgPSBvcHRpb25zICYmIG9wdGlvbnMuc291cmNlO1xuICB0aGlzLl9zdWJtaXQob3AsIHNvdXJjZSwgY2FsbGJhY2spO1xufTtcblxuLy8gRGVsZXRlIHRoZSBkb2N1bWVudC4gVGhpcyBjcmVhdGVzIGFuZCBzdWJtaXRzIGEgZGVsZXRlIG9wZXJhdGlvbiB0byB0aGVcbi8vIHNlcnZlci4gRGVsZXRpbmcgcmVzZXRzIHRoZSBvYmplY3QncyB0eXBlIHRvIG51bGwgYW5kIGRlbGV0ZXMgaXRzIGRhdGEuIFRoZVxuLy8gZG9jdW1lbnQgc3RpbGwgZXhpc3RzLCBhbmQgc3RpbGwgaGFzIHRoZSB2ZXJzaW9uIGl0IHVzZWQgdG8gaGF2ZSBiZWZvcmUgeW91XG4vLyBkZWxldGVkIGl0ICh3ZWxsLCBvbGQgdmVyc2lvbiArMSkuXG4vL1xuLy8gQHBhcmFtIG9wdGlvbnMgIHtzb3VyY2U6IC4uLn1cbi8vIEBwYXJhbSBjYWxsYmFjayAgY2FsbGVkIHdoZW4gb3BlcmF0aW9uIHN1Ym1pdHRlZFxuRG9jLnByb3RvdHlwZS5kZWwgPSBmdW5jdGlvbihvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgb3B0aW9ucyA9IG51bGw7XG4gIH1cbiAgaWYgKCF0aGlzLnR5cGUpIHtcbiAgICB2YXIgZXJyID0gbmV3IFNoYXJlREJFcnJvcig0MDE1LCAnRG9jdW1lbnQgZG9lcyBub3QgZXhpc3QnKTtcbiAgICBpZiAoY2FsbGJhY2spIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgfVxuICB2YXIgb3AgPSB7ZGVsOiB0cnVlfTtcbiAgdmFyIHNvdXJjZSA9IG9wdGlvbnMgJiYgb3B0aW9ucy5zb3VyY2U7XG4gIHRoaXMuX3N1Ym1pdChvcCwgc291cmNlLCBjYWxsYmFjayk7XG59O1xuXG5cbi8vIFN0b3BzIHRoZSBkb2N1bWVudCBmcm9tIHNlbmRpbmcgYW55IG9wZXJhdGlvbnMgdG8gdGhlIHNlcnZlci5cbkRvYy5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5wYXVzZWQgPSB0cnVlO1xufTtcblxuLy8gQ29udGludWUgc2VuZGluZyBvcGVyYXRpb25zIHRvIHRoZSBzZXJ2ZXJcbkRvYy5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMucGF1c2VkID0gZmFsc2U7XG4gIHRoaXMuZmx1c2goKTtcbn07XG5cblxuLy8gKioqIFJlY2VpdmluZyBvcGVyYXRpb25zXG5cbi8vIFRoaXMgaXMgY2FsbGVkIHdoZW4gdGhlIHNlcnZlciBhY2tub3dsZWRnZXMgYW4gb3BlcmF0aW9uIGZyb20gdGhlIGNsaWVudC5cbkRvYy5wcm90b3R5cGUuX29wQWNrbm93bGVkZ2VkID0gZnVuY3Rpb24obWVzc2FnZSkge1xuICBpZiAodGhpcy5pbmZsaWdodE9wLmNyZWF0ZSkge1xuICAgIHRoaXMudmVyc2lvbiA9IG1lc3NhZ2UudjtcblxuICB9IGVsc2UgaWYgKG1lc3NhZ2UudiAhPT0gdGhpcy52ZXJzaW9uKSB7XG4gICAgLy8gV2Ugc2hvdWxkIGFscmVhZHkgYmUgYXQgdGhlIHNhbWUgdmVyc2lvbiwgYmVjYXVzZSB0aGUgc2VydmVyIHNob3VsZFxuICAgIC8vIGhhdmUgc2VudCBhbGwgdGhlIG9wcyB0aGF0IGhhdmUgaGFwcGVuZWQgYmVmb3JlIGFja25vd2xlZGdpbmcgb3VyIG9wXG4gICAgY29uc29sZS53YXJuKCdJbnZhbGlkIHZlcnNpb24gZnJvbSBzZXJ2ZXIuIEV4cGVjdGVkOiAnICsgdGhpcy52ZXJzaW9uICsgJyBSZWNlaXZlZDogJyArIG1lc3NhZ2UudiwgbWVzc2FnZSk7XG5cbiAgICAvLyBGZXRjaGluZyBzaG91bGQgZ2V0IHVzIGJhY2sgdG8gYSB3b3JraW5nIGRvY3VtZW50IHN0YXRlXG4gICAgcmV0dXJuIHRoaXMuZmV0Y2goKTtcbiAgfVxuXG4gIC8vIFRoZSBvcCB3YXMgY29tbWl0dGVkIHN1Y2Nlc3NmdWxseS4gSW5jcmVtZW50IHRoZSB2ZXJzaW9uIG51bWJlclxuICB0aGlzLnZlcnNpb24rKztcblxuICB0aGlzLl9jbGVhckluZmxpZ2h0T3AoKTtcbn07XG5cbkRvYy5wcm90b3R5cGUuX3JvbGxiYWNrID0gZnVuY3Rpb24oZXJyKSB7XG4gIC8vIFRoZSBzZXJ2ZXIgaGFzIHJlamVjdGVkIHN1Ym1pc3Npb24gb2YgdGhlIGN1cnJlbnQgb3BlcmF0aW9uLiBJbnZlcnQgYnlcbiAgLy8ganVzdCB0aGUgaW5mbGlnaHQgb3AgaWYgcG9zc2libGUuIElmIG5vdCBwb3NzaWJsZSB0byBpbnZlcnQsIGNhbmNlbCBhbGxcbiAgLy8gcGVuZGluZyBvcHMgYW5kIGZldGNoIHRoZSBsYXRlc3QgZnJvbSB0aGUgc2VydmVyIHRvIGdldCB1cyBiYWNrIGludG8gYVxuICAvLyB3b3JraW5nIHN0YXRlLCB0aGVuIGNhbGwgYmFja1xuICB2YXIgb3AgPSB0aGlzLmluZmxpZ2h0T3A7XG5cbiAgaWYgKG9wLm9wICYmIG9wLnR5cGUuaW52ZXJ0KSB7XG4gICAgb3Aub3AgPSBvcC50eXBlLmludmVydChvcC5vcCk7XG5cbiAgICAvLyBUcmFuc2Zvcm0gdGhlIHVuZG8gb3BlcmF0aW9uIGJ5IGFueSBwZW5kaW5nIG9wcy5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucGVuZGluZ09wcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHRyYW5zZm9ybUVyciA9IHRyYW5zZm9ybVgodGhpcy5wZW5kaW5nT3BzW2ldLCBvcCk7XG4gICAgICBpZiAodHJhbnNmb3JtRXJyKSByZXR1cm4gdGhpcy5faGFyZFJvbGxiYWNrKHRyYW5zZm9ybUVycik7XG4gICAgfVxuXG4gICAgLy8gLi4uIGFuZCBhcHBseSBpdCBsb2NhbGx5LCByZXZlcnRpbmcgdGhlIGNoYW5nZXMuXG4gICAgLy9cbiAgICAvLyBUaGlzIG9wZXJhdGlvbiBpcyBhcHBsaWVkIHRvIGxvb2sgbGlrZSBpdCBjb21lcyBmcm9tIGEgcmVtb3RlIHNvdXJjZS5cbiAgICAvLyBJJ20gc3RpbGwgbm90IDEwMCUgc3VyZSBhYm91dCB0aGlzIGZ1bmN0aW9uYWxpdHksIGJlY2F1c2UgaXRzIHJlYWxseSBhXG4gICAgLy8gbG9jYWwgb3AuIEJhc2ljYWxseSwgdGhlIHByb2JsZW0gaXMgdGhhdCBpZiB0aGUgY2xpZW50J3Mgb3AgaXMgcmVqZWN0ZWRcbiAgICAvLyBieSB0aGUgc2VydmVyLCB0aGUgZWRpdG9yIHdpbmRvdyBzaG91bGQgdXBkYXRlIHRvIHJlZmxlY3QgdGhlIHVuZG8uXG4gICAgdGhpcy5fb3RBcHBseShvcCwgZmFsc2UpO1xuXG4gICAgdGhpcy5fY2xlYXJJbmZsaWdodE9wKGVycik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhpcy5faGFyZFJvbGxiYWNrKGVycik7XG59O1xuXG5Eb2MucHJvdG90eXBlLl9oYXJkUm9sbGJhY2sgPSBmdW5jdGlvbihlcnIpIHtcbiAgLy8gQ2FuY2VsIGFsbCBwZW5kaW5nIG9wcyBhbmQgcmVzZXQgaWYgd2UgY2FuJ3QgaW52ZXJ0XG4gIHZhciBvcCA9IHRoaXMuaW5mbGlnaHRPcDtcbiAgdmFyIHBlbmRpbmcgPSB0aGlzLnBlbmRpbmdPcHM7XG4gIHRoaXMuX3NldFR5cGUobnVsbCk7XG4gIHRoaXMudmVyc2lvbiA9IG51bGw7XG4gIHRoaXMuaW5mbGlnaHRPcCA9IG51bGw7XG4gIHRoaXMucGVuZGluZ09wcyA9IFtdO1xuXG4gIC8vIEZldGNoIHRoZSBsYXRlc3QgZnJvbSB0aGUgc2VydmVyIHRvIGdldCB1cyBiYWNrIGludG8gYSB3b3JraW5nIHN0YXRlXG4gIHZhciBkb2MgPSB0aGlzO1xuICB0aGlzLmZldGNoKGZ1bmN0aW9uKCkge1xuICAgIHZhciBjYWxsZWQgPSBvcCAmJiBjYWxsRWFjaChvcC5jYWxsYmFja3MsIGVycik7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwZW5kaW5nLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjYWxsRWFjaChwZW5kaW5nW2ldLmNhbGxiYWNrcywgZXJyKTtcbiAgICB9XG4gICAgaWYgKGVyciAmJiAhY2FsbGVkKSByZXR1cm4gZG9jLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgfSk7XG59O1xuXG5Eb2MucHJvdG90eXBlLl9jbGVhckluZmxpZ2h0T3AgPSBmdW5jdGlvbihlcnIpIHtcbiAgdmFyIGNhbGxlZCA9IGNhbGxFYWNoKHRoaXMuaW5mbGlnaHRPcC5jYWxsYmFja3MsIGVycik7XG5cbiAgdGhpcy5pbmZsaWdodE9wID0gbnVsbDtcbiAgdGhpcy5mbHVzaCgpO1xuICB0aGlzLl9lbWl0Tm90aGluZ1BlbmRpbmcoKTtcblxuICBpZiAoZXJyICYmICFjYWxsZWQpIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbn07XG5cbmZ1bmN0aW9uIGNhbGxFYWNoKGNhbGxiYWNrcywgZXJyKSB7XG4gIHZhciBjYWxsZWQgPSBmYWxzZTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgY2FsbGJhY2sgPSBjYWxsYmFja3NbaV07XG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgY2FsbGVkID0gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNhbGxlZDtcbn1cbiIsImV4cG9ydHMuQ29ubmVjdGlvbiA9IHJlcXVpcmUoJy4vY29ubmVjdGlvbicpO1xuZXhwb3J0cy5Eb2MgPSByZXF1aXJlKCcuL2RvYycpO1xuZXhwb3J0cy5FcnJvciA9IHJlcXVpcmUoJy4uL2Vycm9yJyk7XG5leHBvcnRzLlF1ZXJ5ID0gcmVxdWlyZSgnLi9xdWVyeScpO1xuZXhwb3J0cy50eXBlcyA9IHJlcXVpcmUoJy4uL3R5cGVzJyk7XG4iLCJ2YXIgZW1pdHRlciA9IHJlcXVpcmUoJy4uL2VtaXR0ZXInKTtcblxuLy8gUXVlcmllcyBhcmUgbGl2ZSByZXF1ZXN0cyB0byB0aGUgZGF0YWJhc2UgZm9yIHBhcnRpY3VsYXIgc2V0cyBvZiBmaWVsZHMuXG4vL1xuLy8gVGhlIHNlcnZlciBhY3RpdmVseSB0ZWxscyB0aGUgY2xpZW50IHdoZW4gdGhlcmUncyBuZXcgZGF0YSB0aGF0IG1hdGNoZXNcbi8vIGEgc2V0IG9mIGNvbmRpdGlvbnMuXG5tb2R1bGUuZXhwb3J0cyA9IFF1ZXJ5O1xuZnVuY3Rpb24gUXVlcnkoYWN0aW9uLCBjb25uZWN0aW9uLCBpZCwgY29sbGVjdGlvbiwgcXVlcnksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIGVtaXR0ZXIuRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG5cbiAgLy8gJ3FmJyBvciAncXMnXG4gIHRoaXMuYWN0aW9uID0gYWN0aW9uO1xuXG4gIHRoaXMuY29ubmVjdGlvbiA9IGNvbm5lY3Rpb247XG4gIHRoaXMuaWQgPSBpZDtcbiAgdGhpcy5jb2xsZWN0aW9uID0gY29sbGVjdGlvbjtcblxuICAvLyBUaGUgcXVlcnkgaXRzZWxmLiBGb3IgbW9uZ28sIHRoaXMgc2hvdWxkIGxvb2sgc29tZXRoaW5nIGxpa2Uge1wiZGF0YS54XCI6NX1cbiAgdGhpcy5xdWVyeSA9IHF1ZXJ5O1xuXG4gIC8vIEEgbGlzdCBvZiByZXN1bHRpbmcgZG9jdW1lbnRzLiBUaGVzZSBhcmUgYWN0dWFsIGRvY3VtZW50cywgY29tcGxldGUgd2l0aFxuICAvLyBkYXRhIGFuZCBhbGwgdGhlIHJlc3QuIEl0IGlzIHBvc3NpYmxlIHRvIHBhc3MgaW4gYW4gaW5pdGlhbCByZXN1bHRzIHNldCxcbiAgLy8gc28gdGhhdCBhIHF1ZXJ5IGNhbiBiZSBzZXJpYWxpemVkIGFuZCB0aGVuIHJlLWVzdGFibGlzaGVkXG4gIHRoaXMucmVzdWx0cyA9IG51bGw7XG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMucmVzdWx0cykge1xuICAgIHRoaXMucmVzdWx0cyA9IG9wdGlvbnMucmVzdWx0cztcbiAgICBkZWxldGUgb3B0aW9ucy5yZXN1bHRzO1xuICB9XG4gIHRoaXMuZXh0cmEgPSB1bmRlZmluZWQ7XG5cbiAgLy8gT3B0aW9ucyB0byBwYXNzIHRocm91Z2ggd2l0aCB0aGUgcXVlcnlcbiAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcblxuICB0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2s7XG4gIHRoaXMucmVhZHkgPSBmYWxzZTtcbiAgdGhpcy5zZW50ID0gZmFsc2U7XG59XG5lbWl0dGVyLm1peGluKFF1ZXJ5KTtcblxuUXVlcnkucHJvdG90eXBlLmhhc1BlbmRpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuICF0aGlzLnJlYWR5O1xufTtcblxuLy8gSGVscGVyIGZvciBzdWJzY3JpYmUgJiBmZXRjaCwgc2luY2UgdGhleSBzaGFyZSB0aGUgc2FtZSBtZXNzYWdlIGZvcm1hdC5cbi8vXG4vLyBUaGlzIGZ1bmN0aW9uIGFjdHVhbGx5IGlzc3VlcyB0aGUgcXVlcnkuXG5RdWVyeS5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMuY29ubmVjdGlvbi5jYW5TZW5kKSByZXR1cm47XG5cbiAgdmFyIG1lc3NhZ2UgPSB7XG4gICAgYTogdGhpcy5hY3Rpb24sXG4gICAgaWQ6IHRoaXMuaWQsXG4gICAgYzogdGhpcy5jb2xsZWN0aW9uLFxuICAgIHE6IHRoaXMucXVlcnlcbiAgfTtcbiAgaWYgKHRoaXMub3B0aW9ucykge1xuICAgIG1lc3NhZ2UubyA9IHRoaXMub3B0aW9ucztcbiAgfVxuICBpZiAodGhpcy5yZXN1bHRzKSB7XG4gICAgLy8gQ29sbGVjdCB0aGUgdmVyc2lvbiBvZiBhbGwgdGhlIGRvY3VtZW50cyBpbiB0aGUgY3VycmVudCByZXN1bHQgc2V0IHNvIHdlXG4gICAgLy8gZG9uJ3QgbmVlZCB0byBiZSBzZW50IHRoZWlyIHNuYXBzaG90cyBhZ2Fpbi5cbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5yZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZG9jID0gdGhpcy5yZXN1bHRzW2ldO1xuICAgICAgcmVzdWx0cy5wdXNoKFtkb2MuaWQsIGRvYy52ZXJzaW9uXSk7XG4gICAgfVxuICAgIG1lc3NhZ2UuciA9IHJlc3VsdHM7XG4gIH1cblxuICB0aGlzLmNvbm5lY3Rpb24uc2VuZChtZXNzYWdlKTtcbiAgdGhpcy5zZW50ID0gdHJ1ZTtcbn07XG5cbi8vIERlc3Ryb3kgdGhlIHF1ZXJ5IG9iamVjdC4gQW55IHN1YnNlcXVlbnQgbWVzc2FnZXMgZm9yIHRoZSBxdWVyeSB3aWxsIGJlXG4vLyBpZ25vcmVkIGJ5IHRoZSBjb25uZWN0aW9uLlxuUXVlcnkucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICBpZiAodGhpcy5jb25uZWN0aW9uLmNhblNlbmQgJiYgdGhpcy5hY3Rpb24gPT09ICdxcycpIHtcbiAgICB0aGlzLmNvbm5lY3Rpb24uc2VuZCh7YTogJ3F1JywgaWQ6IHRoaXMuaWR9KTtcbiAgfVxuICB0aGlzLmNvbm5lY3Rpb24uX2Rlc3Ryb3lRdWVyeSh0aGlzKTtcbiAgLy8gVGhlcmUgaXMgYSBjYWxsYmFjayBmb3IgY29uc2lzdGVuY3ksIGJ1dCB3ZSBkb24ndCBhY3R1YWxseSB3YWl0IGZvciB0aGVcbiAgLy8gc2VydmVyJ3MgdW5zdWJzY3JpYmUgbWVzc2FnZSBjdXJyZW50bHlcbiAgaWYgKGNhbGxiYWNrKSBwcm9jZXNzLm5leHRUaWNrKGNhbGxiYWNrKTtcbn07XG5cblF1ZXJ5LnByb3RvdHlwZS5fb25Db25uZWN0aW9uU3RhdGVDaGFuZ2VkID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLmNvbm5lY3Rpb24uY2FuU2VuZCAmJiAhdGhpcy5zZW50KSB7XG4gICAgdGhpcy5zZW5kKCk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5zZW50ID0gZmFsc2U7XG4gIH1cbn07XG5cblF1ZXJ5LnByb3RvdHlwZS5faGFuZGxlRmV0Y2ggPSBmdW5jdGlvbihlcnIsIGRhdGEsIGV4dHJhKSB7XG4gIC8vIE9uY2UgYSBmZXRjaCBxdWVyeSBnZXRzIGl0cyBkYXRhLCBpdCBpcyBkZXN0cm95ZWQuXG4gIHRoaXMuY29ubmVjdGlvbi5fZGVzdHJveVF1ZXJ5KHRoaXMpO1xuICB0aGlzLl9oYW5kbGVSZXNwb25zZShlcnIsIGRhdGEsIGV4dHJhKTtcbn07XG5cblF1ZXJ5LnByb3RvdHlwZS5faGFuZGxlU3Vic2NyaWJlID0gZnVuY3Rpb24oZXJyLCBkYXRhLCBleHRyYSkge1xuICB0aGlzLl9oYW5kbGVSZXNwb25zZShlcnIsIGRhdGEsIGV4dHJhKTtcbn07XG5cblF1ZXJ5LnByb3RvdHlwZS5faGFuZGxlUmVzcG9uc2UgPSBmdW5jdGlvbihlcnIsIGRhdGEsIGV4dHJhKSB7XG4gIHZhciBjYWxsYmFjayA9IHRoaXMuY2FsbGJhY2s7XG4gIHRoaXMuY2FsbGJhY2sgPSBudWxsO1xuICBpZiAoZXJyKSByZXR1cm4gdGhpcy5fZmluaXNoUmVzcG9uc2UoZXJyLCBjYWxsYmFjayk7XG4gIGlmICghZGF0YSkgcmV0dXJuIHRoaXMuX2ZpbmlzaFJlc3BvbnNlKG51bGwsIGNhbGxiYWNrKTtcblxuICB2YXIgcXVlcnkgPSB0aGlzO1xuICB2YXIgd2FpdCA9IDE7XG4gIHZhciBmaW5pc2ggPSBmdW5jdGlvbihlcnIpIHtcbiAgICBpZiAoZXJyKSByZXR1cm4gcXVlcnkuX2ZpbmlzaFJlc3BvbnNlKGVyciwgY2FsbGJhY2spO1xuICAgIGlmICgtLXdhaXQpIHJldHVybjtcbiAgICBxdWVyeS5fZmluaXNoUmVzcG9uc2UobnVsbCwgY2FsbGJhY2spO1xuICB9O1xuXG4gIGlmIChBcnJheS5pc0FycmF5KGRhdGEpKSB7XG4gICAgd2FpdCArPSBkYXRhLmxlbmd0aDtcbiAgICB0aGlzLnJlc3VsdHMgPSB0aGlzLl9pbmdlc3RTbmFwc2hvdHMoZGF0YSwgZmluaXNoKTtcbiAgICB0aGlzLmV4dHJhID0gZXh0cmE7XG5cbiAgfSBlbHNlIHtcbiAgICBmb3IgKHZhciBpZCBpbiBkYXRhKSB7XG4gICAgICB3YWl0Kys7XG4gICAgICB2YXIgc25hcHNob3QgPSBkYXRhW2lkXTtcbiAgICAgIHZhciBkb2MgPSB0aGlzLmNvbm5lY3Rpb24uZ2V0KHNuYXBzaG90LmMgfHwgdGhpcy5jb2xsZWN0aW9uLCBpZCk7XG4gICAgICBkb2MuaW5nZXN0U25hcHNob3Qoc25hcHNob3QsIGZpbmlzaCk7XG4gICAgfVxuICB9XG5cbiAgZmluaXNoKCk7XG59O1xuXG5RdWVyeS5wcm90b3R5cGUuX2luZ2VzdFNuYXBzaG90cyA9IGZ1bmN0aW9uKHNuYXBzaG90cywgZmluaXNoKSB7XG4gIHZhciByZXN1bHRzID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc25hcHNob3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHNuYXBzaG90ID0gc25hcHNob3RzW2ldO1xuICAgIHZhciBkb2MgPSB0aGlzLmNvbm5lY3Rpb24uZ2V0KHNuYXBzaG90LmMgfHwgdGhpcy5jb2xsZWN0aW9uLCBzbmFwc2hvdC5kKTtcbiAgICBkb2MuaW5nZXN0U25hcHNob3Qoc25hcHNob3QsIGZpbmlzaCk7XG4gICAgcmVzdWx0cy5wdXNoKGRvYyk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdHM7XG59O1xuXG5RdWVyeS5wcm90b3R5cGUuX2ZpbmlzaFJlc3BvbnNlID0gZnVuY3Rpb24oZXJyLCBjYWxsYmFjaykge1xuICB0aGlzLmVtaXQoJ3JlYWR5Jyk7XG4gIHRoaXMucmVhZHkgPSB0cnVlO1xuICBpZiAoZXJyKSB7XG4gICAgdGhpcy5jb25uZWN0aW9uLl9kZXN0cm95UXVlcnkodGhpcyk7XG4gICAgaWYgKGNhbGxiYWNrKSByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gIH1cbiAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCB0aGlzLnJlc3VsdHMsIHRoaXMuZXh0cmEpO1xufTtcblxuUXVlcnkucHJvdG90eXBlLl9oYW5kbGVFcnJvciA9IGZ1bmN0aW9uKGVycikge1xuICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbn07XG5cblF1ZXJ5LnByb3RvdHlwZS5faGFuZGxlRGlmZiA9IGZ1bmN0aW9uKGRpZmYpIHtcbiAgLy8gV2UgbmVlZCB0byBnbyB0aHJvdWdoIHRoZSBsaXN0IHR3aWNlLiBGaXJzdCwgd2UnbGwgaW5nZXN0IGFsbCB0aGUgbmV3XG4gIC8vIGRvY3VtZW50cy4gQWZ0ZXIgdGhhdCB3ZSdsbCBlbWl0IGV2ZW50cyBhbmQgYWN0dWFsbHkgdXBkYXRlIG91ciBsaXN0LlxuICAvLyBUaGlzIGF2b2lkcyByYWNlIGNvbmRpdGlvbnMgYXJvdW5kIHNldHRpbmcgZG9jdW1lbnRzIHRvIGJlIHN1YnNjcmliZWQgJlxuICAvLyB1bnN1YnNjcmliaW5nIGRvY3VtZW50cyBpbiBldmVudCBjYWxsYmFja3MuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgZGlmZi5sZW5ndGg7IGkrKykge1xuICAgIHZhciBkID0gZGlmZltpXTtcbiAgICBpZiAoZC50eXBlID09PSAnaW5zZXJ0JykgZC52YWx1ZXMgPSB0aGlzLl9pbmdlc3RTbmFwc2hvdHMoZC52YWx1ZXMpO1xuICB9XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBkaWZmLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGQgPSBkaWZmW2ldO1xuICAgIHN3aXRjaCAoZC50eXBlKSB7XG4gICAgICBjYXNlICdpbnNlcnQnOlxuICAgICAgICB2YXIgbmV3RG9jcyA9IGQudmFsdWVzO1xuICAgICAgICBBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KHRoaXMucmVzdWx0cywgW2QuaW5kZXgsIDBdLmNvbmNhdChuZXdEb2NzKSk7XG4gICAgICAgIHRoaXMuZW1pdCgnaW5zZXJ0JywgbmV3RG9jcywgZC5pbmRleCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAncmVtb3ZlJzpcbiAgICAgICAgdmFyIGhvd01hbnkgPSBkLmhvd01hbnkgfHwgMTtcbiAgICAgICAgdmFyIHJlbW92ZWQgPSB0aGlzLnJlc3VsdHMuc3BsaWNlKGQuaW5kZXgsIGhvd01hbnkpO1xuICAgICAgICB0aGlzLmVtaXQoJ3JlbW92ZScsIHJlbW92ZWQsIGQuaW5kZXgpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ21vdmUnOlxuICAgICAgICB2YXIgaG93TWFueSA9IGQuaG93TWFueSB8fCAxO1xuICAgICAgICB2YXIgZG9jcyA9IHRoaXMucmVzdWx0cy5zcGxpY2UoZC5mcm9tLCBob3dNYW55KTtcbiAgICAgICAgQXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseSh0aGlzLnJlc3VsdHMsIFtkLnRvLCAwXS5jb25jYXQoZG9jcykpO1xuICAgICAgICB0aGlzLmVtaXQoJ21vdmUnLCBkb2NzLCBkLmZyb20sIGQudG8pO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICB0aGlzLmVtaXQoJ2NoYW5nZWQnLCB0aGlzLnJlc3VsdHMpO1xufTtcblxuUXVlcnkucHJvdG90eXBlLl9oYW5kbGVFeHRyYSA9IGZ1bmN0aW9uKGV4dHJhKSB7XG4gIHRoaXMuZXh0cmEgPSBleHRyYTtcbiAgdGhpcy5lbWl0KCdleHRyYScsIGV4dHJhKTtcbn07XG4iLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG5leHBvcnRzLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcbmV4cG9ydHMubWl4aW4gPSBtaXhpbjtcblxuZnVuY3Rpb24gbWl4aW4oQ29uc3RydWN0b3IpIHtcbiAgZm9yICh2YXIga2V5IGluIEV2ZW50RW1pdHRlci5wcm90b3R5cGUpIHtcbiAgICBDb25zdHJ1Y3Rvci5wcm90b3R5cGVba2V5XSA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGVba2V5XTtcbiAgfVxufVxuIiwidmFyIG1ha2VFcnJvciA9IHJlcXVpcmUoJ21ha2UtZXJyb3InKTtcblxuZnVuY3Rpb24gU2hhcmVEQkVycm9yKGNvZGUsIG1lc3NhZ2UpIHtcbiAgU2hhcmVEQkVycm9yLnN1cGVyLmNhbGwodGhpcywgbWVzc2FnZSk7XG4gIHRoaXMuY29kZSA9IGNvZGU7XG59XG5cbm1ha2VFcnJvcihTaGFyZURCRXJyb3IpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNoYXJlREJFcnJvcjtcbiIsIlxuZXhwb3J0cy5kZWZhdWx0VHlwZSA9IHJlcXVpcmUoJ290LWpzb24wJykudHlwZTtcblxuZXhwb3J0cy5tYXAgPSB7fTtcblxuZXhwb3J0cy5yZWdpc3RlciA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKHR5cGUubmFtZSkgZXhwb3J0cy5tYXBbdHlwZS5uYW1lXSA9IHR5cGU7XG4gIGlmICh0eXBlLnVyaSkgZXhwb3J0cy5tYXBbdHlwZS51cmldID0gdHlwZTtcbn07XG5cbmV4cG9ydHMucmVnaXN0ZXIoZXhwb3J0cy5kZWZhdWx0VHlwZSk7XG4iLCJcbmV4cG9ydHMuZG9Ob3RoaW5nID0gZG9Ob3RoaW5nO1xuZnVuY3Rpb24gZG9Ob3RoaW5nKCkge31cblxuZXhwb3J0cy5oYXNLZXlzID0gZnVuY3Rpb24ob2JqZWN0KSB7XG4gIGZvciAodmFyIGtleSBpbiBvYmplY3QpIHJldHVybiB0cnVlO1xuICByZXR1cm4gZmFsc2U7XG59O1xuIl19
