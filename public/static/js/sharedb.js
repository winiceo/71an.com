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
'use strict';

var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;

var isArray = function isArray(arr) {
	if (typeof Array.isArray === 'function') {
		return Array.isArray(arr);
	}

	return toStr.call(arr) === '[object Array]';
};

var isPlainObject = function isPlainObject(obj) {
	if (!obj || toStr.call(obj) !== '[object Object]') {
		return false;
	}

	var hasOwnConstructor = hasOwn.call(obj, 'constructor');
	var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {/**/}

	return typeof key === 'undefined' || hasOwn.call(obj, key);
};

module.exports = function extend() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === 'boolean') {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
		target = {};
	}

	for (; i < length; ++i) {
		options = arguments[i];
		// Only deal with non-null/undefined values
		if (options != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target !== copy) {
					// Recurse if we're merging plain objects or arrays
					if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
						if (copyIsArray) {
							copyIsArray = false;
							clone = src && isArray(src) ? src : [];
						} else {
							clone = src && isPlainObject(src) ? src : {};
						}

						// Never move original objects, clone them
						target[name] = extend(deep, clone, copy);

					// Don't bring in undefined values
					} else if (typeof copy !== 'undefined') {
						target[name] = copy;
					}
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],3:[function(require,module,exports){
/**
 * This library modifies the diff-patch-match library by Neil Fraser
 * by removing the patch and match functionality and certain advanced
 * options in the diff function. The original license is as follows:
 *
 * ===
 *
 * Diff Match and Patch
 *
 * Copyright 2006 Google Inc.
 * http://code.google.com/p/google-diff-match-patch/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


/**
 * The data structure representing a diff is an array of tuples:
 * [[DIFF_DELETE, 'Hello'], [DIFF_INSERT, 'Goodbye'], [DIFF_EQUAL, ' world.']]
 * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
 */
var DIFF_DELETE = -1;
var DIFF_INSERT = 1;
var DIFF_EQUAL = 0;


/**
 * Find the differences between two texts.  Simplifies the problem by stripping
 * any common prefix or suffix off the texts before diffing.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @param {Int} cursor_pos Expected edit position in text1 (optional)
 * @return {Array} Array of diff tuples.
 */
function diff_main(text1, text2, cursor_pos) {
  // Check for equality (speedup).
  if (text1 == text2) {
    if (text1) {
      return [[DIFF_EQUAL, text1]];
    }
    return [];
  }

  // Check cursor_pos within bounds
  if (cursor_pos < 0 || text1.length < cursor_pos) {
    cursor_pos = null;
  }

  // Trim off common prefix (speedup).
  var commonlength = diff_commonPrefix(text1, text2);
  var commonprefix = text1.substring(0, commonlength);
  text1 = text1.substring(commonlength);
  text2 = text2.substring(commonlength);

  // Trim off common suffix (speedup).
  commonlength = diff_commonSuffix(text1, text2);
  var commonsuffix = text1.substring(text1.length - commonlength);
  text1 = text1.substring(0, text1.length - commonlength);
  text2 = text2.substring(0, text2.length - commonlength);

  // Compute the diff on the middle block.
  var diffs = diff_compute_(text1, text2);

  // Restore the prefix and suffix.
  if (commonprefix) {
    diffs.unshift([DIFF_EQUAL, commonprefix]);
  }
  if (commonsuffix) {
    diffs.push([DIFF_EQUAL, commonsuffix]);
  }
  diff_cleanupMerge(diffs);
  if (cursor_pos != null) {
    diffs = fix_cursor(diffs, cursor_pos);
  }
  return diffs;
};


/**
 * Find the differences between two texts.  Assumes that the texts do not
 * have any common prefix or suffix.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @return {Array} Array of diff tuples.
 */
function diff_compute_(text1, text2) {
  var diffs;

  if (!text1) {
    // Just add some text (speedup).
    return [[DIFF_INSERT, text2]];
  }

  if (!text2) {
    // Just delete some text (speedup).
    return [[DIFF_DELETE, text1]];
  }

  var longtext = text1.length > text2.length ? text1 : text2;
  var shorttext = text1.length > text2.length ? text2 : text1;
  var i = longtext.indexOf(shorttext);
  if (i != -1) {
    // Shorter text is inside the longer text (speedup).
    diffs = [[DIFF_INSERT, longtext.substring(0, i)],
             [DIFF_EQUAL, shorttext],
             [DIFF_INSERT, longtext.substring(i + shorttext.length)]];
    // Swap insertions for deletions if diff is reversed.
    if (text1.length > text2.length) {
      diffs[0][0] = diffs[2][0] = DIFF_DELETE;
    }
    return diffs;
  }

  if (shorttext.length == 1) {
    // Single character string.
    // After the previous speedup, the character can't be an equality.
    return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]];
  }

  // Check to see if the problem can be split in two.
  var hm = diff_halfMatch_(text1, text2);
  if (hm) {
    // A half-match was found, sort out the return data.
    var text1_a = hm[0];
    var text1_b = hm[1];
    var text2_a = hm[2];
    var text2_b = hm[3];
    var mid_common = hm[4];
    // Send both pairs off for separate processing.
    var diffs_a = diff_main(text1_a, text2_a);
    var diffs_b = diff_main(text1_b, text2_b);
    // Merge the results.
    return diffs_a.concat([[DIFF_EQUAL, mid_common]], diffs_b);
  }

  return diff_bisect_(text1, text2);
};


/**
 * Find the 'middle snake' of a diff, split the problem in two
 * and return the recursively constructed diff.
 * See Myers 1986 paper: An O(ND) Difference Algorithm and Its Variations.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @return {Array} Array of diff tuples.
 * @private
 */
function diff_bisect_(text1, text2) {
  // Cache the text lengths to prevent multiple calls.
  var text1_length = text1.length;
  var text2_length = text2.length;
  var max_d = Math.ceil((text1_length + text2_length) / 2);
  var v_offset = max_d;
  var v_length = 2 * max_d;
  var v1 = new Array(v_length);
  var v2 = new Array(v_length);
  // Setting all elements to -1 is faster in Chrome & Firefox than mixing
  // integers and undefined.
  for (var x = 0; x < v_length; x++) {
    v1[x] = -1;
    v2[x] = -1;
  }
  v1[v_offset + 1] = 0;
  v2[v_offset + 1] = 0;
  var delta = text1_length - text2_length;
  // If the total number of characters is odd, then the front path will collide
  // with the reverse path.
  var front = (delta % 2 != 0);
  // Offsets for start and end of k loop.
  // Prevents mapping of space beyond the grid.
  var k1start = 0;
  var k1end = 0;
  var k2start = 0;
  var k2end = 0;
  for (var d = 0; d < max_d; d++) {
    // Walk the front path one step.
    for (var k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
      var k1_offset = v_offset + k1;
      var x1;
      if (k1 == -d || (k1 != d && v1[k1_offset - 1] < v1[k1_offset + 1])) {
        x1 = v1[k1_offset + 1];
      } else {
        x1 = v1[k1_offset - 1] + 1;
      }
      var y1 = x1 - k1;
      while (x1 < text1_length && y1 < text2_length &&
             text1.charAt(x1) == text2.charAt(y1)) {
        x1++;
        y1++;
      }
      v1[k1_offset] = x1;
      if (x1 > text1_length) {
        // Ran off the right of the graph.
        k1end += 2;
      } else if (y1 > text2_length) {
        // Ran off the bottom of the graph.
        k1start += 2;
      } else if (front) {
        var k2_offset = v_offset + delta - k1;
        if (k2_offset >= 0 && k2_offset < v_length && v2[k2_offset] != -1) {
          // Mirror x2 onto top-left coordinate system.
          var x2 = text1_length - v2[k2_offset];
          if (x1 >= x2) {
            // Overlap detected.
            return diff_bisectSplit_(text1, text2, x1, y1);
          }
        }
      }
    }

    // Walk the reverse path one step.
    for (var k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
      var k2_offset = v_offset + k2;
      var x2;
      if (k2 == -d || (k2 != d && v2[k2_offset - 1] < v2[k2_offset + 1])) {
        x2 = v2[k2_offset + 1];
      } else {
        x2 = v2[k2_offset - 1] + 1;
      }
      var y2 = x2 - k2;
      while (x2 < text1_length && y2 < text2_length &&
             text1.charAt(text1_length - x2 - 1) ==
             text2.charAt(text2_length - y2 - 1)) {
        x2++;
        y2++;
      }
      v2[k2_offset] = x2;
      if (x2 > text1_length) {
        // Ran off the left of the graph.
        k2end += 2;
      } else if (y2 > text2_length) {
        // Ran off the top of the graph.
        k2start += 2;
      } else if (!front) {
        var k1_offset = v_offset + delta - k2;
        if (k1_offset >= 0 && k1_offset < v_length && v1[k1_offset] != -1) {
          var x1 = v1[k1_offset];
          var y1 = v_offset + x1 - k1_offset;
          // Mirror x2 onto top-left coordinate system.
          x2 = text1_length - x2;
          if (x1 >= x2) {
            // Overlap detected.
            return diff_bisectSplit_(text1, text2, x1, y1);
          }
        }
      }
    }
  }
  // Diff took too long and hit the deadline or
  // number of diffs equals number of characters, no commonality at all.
  return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]];
};


/**
 * Given the location of the 'middle snake', split the diff in two parts
 * and recurse.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @param {number} x Index of split point in text1.
 * @param {number} y Index of split point in text2.
 * @return {Array} Array of diff tuples.
 */
function diff_bisectSplit_(text1, text2, x, y) {
  var text1a = text1.substring(0, x);
  var text2a = text2.substring(0, y);
  var text1b = text1.substring(x);
  var text2b = text2.substring(y);

  // Compute both diffs serially.
  var diffs = diff_main(text1a, text2a);
  var diffsb = diff_main(text1b, text2b);

  return diffs.concat(diffsb);
};


/**
 * Determine the common prefix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the start of each
 *     string.
 */
function diff_commonPrefix(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 || text1.charAt(0) != text2.charAt(0)) {
    return 0;
  }
  // Binary search.
  // Performance analysis: http://neil.fraser.name/news/2007/10/09/
  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerstart = 0;
  while (pointermin < pointermid) {
    if (text1.substring(pointerstart, pointermid) ==
        text2.substring(pointerstart, pointermid)) {
      pointermin = pointermid;
      pointerstart = pointermin;
    } else {
      pointermax = pointermid;
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }
  return pointermid;
};


/**
 * Determine the common suffix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the end of each string.
 */
function diff_commonSuffix(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 ||
      text1.charAt(text1.length - 1) != text2.charAt(text2.length - 1)) {
    return 0;
  }
  // Binary search.
  // Performance analysis: http://neil.fraser.name/news/2007/10/09/
  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerend = 0;
  while (pointermin < pointermid) {
    if (text1.substring(text1.length - pointermid, text1.length - pointerend) ==
        text2.substring(text2.length - pointermid, text2.length - pointerend)) {
      pointermin = pointermid;
      pointerend = pointermin;
    } else {
      pointermax = pointermid;
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }
  return pointermid;
};


/**
 * Do the two texts share a substring which is at least half the length of the
 * longer text?
 * This speedup can produce non-minimal diffs.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {Array.<string>} Five element Array, containing the prefix of
 *     text1, the suffix of text1, the prefix of text2, the suffix of
 *     text2 and the common middle.  Or null if there was no match.
 */
function diff_halfMatch_(text1, text2) {
  var longtext = text1.length > text2.length ? text1 : text2;
  var shorttext = text1.length > text2.length ? text2 : text1;
  if (longtext.length < 4 || shorttext.length * 2 < longtext.length) {
    return null;  // Pointless.
  }

  /**
   * Does a substring of shorttext exist within longtext such that the substring
   * is at least half the length of longtext?
   * Closure, but does not reference any external variables.
   * @param {string} longtext Longer string.
   * @param {string} shorttext Shorter string.
   * @param {number} i Start index of quarter length substring within longtext.
   * @return {Array.<string>} Five element Array, containing the prefix of
   *     longtext, the suffix of longtext, the prefix of shorttext, the suffix
   *     of shorttext and the common middle.  Or null if there was no match.
   * @private
   */
  function diff_halfMatchI_(longtext, shorttext, i) {
    // Start with a 1/4 length substring at position i as a seed.
    var seed = longtext.substring(i, i + Math.floor(longtext.length / 4));
    var j = -1;
    var best_common = '';
    var best_longtext_a, best_longtext_b, best_shorttext_a, best_shorttext_b;
    while ((j = shorttext.indexOf(seed, j + 1)) != -1) {
      var prefixLength = diff_commonPrefix(longtext.substring(i),
                                           shorttext.substring(j));
      var suffixLength = diff_commonSuffix(longtext.substring(0, i),
                                           shorttext.substring(0, j));
      if (best_common.length < suffixLength + prefixLength) {
        best_common = shorttext.substring(j - suffixLength, j) +
            shorttext.substring(j, j + prefixLength);
        best_longtext_a = longtext.substring(0, i - suffixLength);
        best_longtext_b = longtext.substring(i + prefixLength);
        best_shorttext_a = shorttext.substring(0, j - suffixLength);
        best_shorttext_b = shorttext.substring(j + prefixLength);
      }
    }
    if (best_common.length * 2 >= longtext.length) {
      return [best_longtext_a, best_longtext_b,
              best_shorttext_a, best_shorttext_b, best_common];
    } else {
      return null;
    }
  }

  // First check if the second quarter is the seed for a half-match.
  var hm1 = diff_halfMatchI_(longtext, shorttext,
                             Math.ceil(longtext.length / 4));
  // Check again based on the third quarter.
  var hm2 = diff_halfMatchI_(longtext, shorttext,
                             Math.ceil(longtext.length / 2));
  var hm;
  if (!hm1 && !hm2) {
    return null;
  } else if (!hm2) {
    hm = hm1;
  } else if (!hm1) {
    hm = hm2;
  } else {
    // Both matched.  Select the longest.
    hm = hm1[4].length > hm2[4].length ? hm1 : hm2;
  }

  // A half-match was found, sort out the return data.
  var text1_a, text1_b, text2_a, text2_b;
  if (text1.length > text2.length) {
    text1_a = hm[0];
    text1_b = hm[1];
    text2_a = hm[2];
    text2_b = hm[3];
  } else {
    text2_a = hm[0];
    text2_b = hm[1];
    text1_a = hm[2];
    text1_b = hm[3];
  }
  var mid_common = hm[4];
  return [text1_a, text1_b, text2_a, text2_b, mid_common];
};


/**
 * Reorder and merge like edit sections.  Merge equalities.
 * Any edit section can move as long as it doesn't cross an equality.
 * @param {Array} diffs Array of diff tuples.
 */
function diff_cleanupMerge(diffs) {
  diffs.push([DIFF_EQUAL, '']);  // Add a dummy entry at the end.
  var pointer = 0;
  var count_delete = 0;
  var count_insert = 0;
  var text_delete = '';
  var text_insert = '';
  var commonlength;
  while (pointer < diffs.length) {
    switch (diffs[pointer][0]) {
      case DIFF_INSERT:
        count_insert++;
        text_insert += diffs[pointer][1];
        pointer++;
        break;
      case DIFF_DELETE:
        count_delete++;
        text_delete += diffs[pointer][1];
        pointer++;
        break;
      case DIFF_EQUAL:
        // Upon reaching an equality, check for prior redundancies.
        if (count_delete + count_insert > 1) {
          if (count_delete !== 0 && count_insert !== 0) {
            // Factor out any common prefixies.
            commonlength = diff_commonPrefix(text_insert, text_delete);
            if (commonlength !== 0) {
              if ((pointer - count_delete - count_insert) > 0 &&
                  diffs[pointer - count_delete - count_insert - 1][0] ==
                  DIFF_EQUAL) {
                diffs[pointer - count_delete - count_insert - 1][1] +=
                    text_insert.substring(0, commonlength);
              } else {
                diffs.splice(0, 0, [DIFF_EQUAL,
                                    text_insert.substring(0, commonlength)]);
                pointer++;
              }
              text_insert = text_insert.substring(commonlength);
              text_delete = text_delete.substring(commonlength);
            }
            // Factor out any common suffixies.
            commonlength = diff_commonSuffix(text_insert, text_delete);
            if (commonlength !== 0) {
              diffs[pointer][1] = text_insert.substring(text_insert.length -
                  commonlength) + diffs[pointer][1];
              text_insert = text_insert.substring(0, text_insert.length -
                  commonlength);
              text_delete = text_delete.substring(0, text_delete.length -
                  commonlength);
            }
          }
          // Delete the offending records and add the merged ones.
          if (count_delete === 0) {
            diffs.splice(pointer - count_insert,
                count_delete + count_insert, [DIFF_INSERT, text_insert]);
          } else if (count_insert === 0) {
            diffs.splice(pointer - count_delete,
                count_delete + count_insert, [DIFF_DELETE, text_delete]);
          } else {
            diffs.splice(pointer - count_delete - count_insert,
                count_delete + count_insert, [DIFF_DELETE, text_delete],
                [DIFF_INSERT, text_insert]);
          }
          pointer = pointer - count_delete - count_insert +
                    (count_delete ? 1 : 0) + (count_insert ? 1 : 0) + 1;
        } else if (pointer !== 0 && diffs[pointer - 1][0] == DIFF_EQUAL) {
          // Merge this equality with the previous one.
          diffs[pointer - 1][1] += diffs[pointer][1];
          diffs.splice(pointer, 1);
        } else {
          pointer++;
        }
        count_insert = 0;
        count_delete = 0;
        text_delete = '';
        text_insert = '';
        break;
    }
  }
  if (diffs[diffs.length - 1][1] === '') {
    diffs.pop();  // Remove the dummy entry at the end.
  }

  // Second pass: look for single edits surrounded on both sides by equalities
  // which can be shifted sideways to eliminate an equality.
  // e.g: A<ins>BA</ins>C -> <ins>AB</ins>AC
  var changes = false;
  pointer = 1;
  // Intentionally ignore the first and last element (don't need checking).
  while (pointer < diffs.length - 1) {
    if (diffs[pointer - 1][0] == DIFF_EQUAL &&
        diffs[pointer + 1][0] == DIFF_EQUAL) {
      // This is a single edit surrounded by equalities.
      if (diffs[pointer][1].substring(diffs[pointer][1].length -
          diffs[pointer - 1][1].length) == diffs[pointer - 1][1]) {
        // Shift the edit over the previous equality.
        diffs[pointer][1] = diffs[pointer - 1][1] +
            diffs[pointer][1].substring(0, diffs[pointer][1].length -
                                        diffs[pointer - 1][1].length);
        diffs[pointer + 1][1] = diffs[pointer - 1][1] + diffs[pointer + 1][1];
        diffs.splice(pointer - 1, 1);
        changes = true;
      } else if (diffs[pointer][1].substring(0, diffs[pointer + 1][1].length) ==
          diffs[pointer + 1][1]) {
        // Shift the edit over the next equality.
        diffs[pointer - 1][1] += diffs[pointer + 1][1];
        diffs[pointer][1] =
            diffs[pointer][1].substring(diffs[pointer + 1][1].length) +
            diffs[pointer + 1][1];
        diffs.splice(pointer + 1, 1);
        changes = true;
      }
    }
    pointer++;
  }
  // If shifts were made, the diff needs reordering and another shift sweep.
  if (changes) {
    diff_cleanupMerge(diffs);
  }
};


var diff = diff_main;
diff.INSERT = DIFF_INSERT;
diff.DELETE = DIFF_DELETE;
diff.EQUAL = DIFF_EQUAL;

module.exports = diff;

/*
 * Modify a diff such that the cursor position points to the start of a change:
 * E.g.
 *   cursor_normalize_diff([[DIFF_EQUAL, 'abc']], 1)
 *     => [1, [[DIFF_EQUAL, 'a'], [DIFF_EQUAL, 'bc']]]
 *   cursor_normalize_diff([[DIFF_INSERT, 'new'], [DIFF_DELETE, 'xyz']], 2)
 *     => [2, [[DIFF_INSERT, 'new'], [DIFF_DELETE, 'xy'], [DIFF_DELETE, 'z']]]
 *
 * @param {Array} diffs Array of diff tuples
 * @param {Int} cursor_pos Suggested edit position. Must not be out of bounds!
 * @return {Array} A tuple [cursor location in the modified diff, modified diff]
 */
function cursor_normalize_diff (diffs, cursor_pos) {
  if (cursor_pos === 0) {
    return [DIFF_EQUAL, diffs];
  }
  for (var current_pos = 0, i = 0; i < diffs.length; i++) {
    var d = diffs[i];
    if (d[0] === DIFF_DELETE || d[0] === DIFF_EQUAL) {
      var next_pos = current_pos + d[1].length;
      if (cursor_pos === next_pos) {
        return [i + 1, diffs];
      } else if (cursor_pos < next_pos) {
        // copy to prevent side effects
        diffs = diffs.slice();
        // split d into two diff changes
        var split_pos = cursor_pos - current_pos;
        var d_left = [d[0], d[1].slice(0, split_pos)];
        var d_right = [d[0], d[1].slice(split_pos)];
        diffs.splice(i, 1, d_left, d_right);
        return [i + 1, diffs];
      } else {
        current_pos = next_pos;
      }
    }
  }
  throw new Error('cursor_pos is out of bounds!')
}

/*
 * Modify a diff such that the edit position is "shifted" to the proposed edit location (cursor_position).
 *
 * Case 1)
 *   Check if a naive shift is possible:
 *     [0, X], [ 1, Y] -> [ 1, Y], [0, X]    (if X + Y === Y + X)
 *     [0, X], [-1, Y] -> [-1, Y], [0, X]    (if X + Y === Y + X) - holds same result
 * Case 2)
 *   Check if the following shifts are possible:
 *     [0, 'pre'], [ 1, 'prefix'] -> [ 1, 'pre'], [0, 'pre'], [ 1, 'fix']
 *     [0, 'pre'], [-1, 'prefix'] -> [-1, 'pre'], [0, 'pre'], [-1, 'fix']
 *         ^            ^
 *         d          d_next
 *
 * @param {Array} diffs Array of diff tuples
 * @param {Int} cursor_pos Suggested edit position. Must not be out of bounds!
 * @return {Array} Array of diff tuples
 */
function fix_cursor (diffs, cursor_pos) {
  var norm = cursor_normalize_diff(diffs, cursor_pos);
  var ndiffs = norm[1];
  var cursor_pointer = norm[0];
  var d = ndiffs[cursor_pointer];
  var d_next = ndiffs[cursor_pointer + 1];

  if (d == null) {
    // Text was deleted from end of original string,
    // cursor is now out of bounds in new string
    return diffs;
  } else if (d[0] !== DIFF_EQUAL) {
    // A modification happened at the cursor location.
    // This is the expected outcome, so we can return the original diff.
    return diffs;
  } else {
    if (d_next != null && d[1] + d_next[1] === d_next[1] + d[1]) {
      // Case 1)
      // It is possible to perform a naive shift
      ndiffs.splice(cursor_pointer, 2, d_next, d)
      return merge_tuples(ndiffs, cursor_pointer, 2)
    } else if (d_next != null && d_next[1].indexOf(d[1]) === 0) {
      // Case 2)
      // d[1] is a prefix of d_next[1]
      // We can assume that d_next[0] !== 0, since d[0] === 0
      // Shift edit locations..
      ndiffs.splice(cursor_pointer, 2, [d_next[0], d[1]], [0, d[1]]);
      var suffix = d_next[1].slice(d[1].length);
      if (suffix.length > 0) {
        ndiffs.splice(cursor_pointer + 2, 0, [d_next[0], suffix]);
      }
      return merge_tuples(ndiffs, cursor_pointer, 3)
    } else {
      // Not possible to perform any modification
      return diffs;
    }
  }

}

/*
 * Try to merge tuples with their neigbors in a given range.
 * E.g. [0, 'a'], [0, 'b'] -> [0, 'ab']
 *
 * @param {Array} diffs Array of diff tuples.
 * @param {Int} start Position of the first element to merge (diffs[start] is also merged with diffs[start - 1]).
 * @param {Int} length Number of consecutive elements to check.
 * @return {Array} Array of merged diff tuples.
 */
function merge_tuples (diffs, start, length) {
  // Check from (start-1) to (start+length).
  for (var i = start + length - 1; i >= 0 && i >= start - 1; i--) {
    if (i + 1 < diffs.length) {
      var left_d = diffs[i];
      var right_d = diffs[i+1];
      if (left_d[0] === right_d[1]) {
        diffs.splice(i, 2, [left_d[0], left_d[1] + right_d[1]]);
      }
    }
  }
  return diffs;
}

},{}],4:[function(require,module,exports){
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

},{}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
// Only the JSON type is exported, because the text type is deprecated
// otherwise. (If you want to use it somewhere, you're welcome to pull it out
// into a separate module that json0 can depend on).

module.exports = {
  type: require('./json0')
};

},{"./json0":7}],7:[function(require,module,exports){
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


},{"./bootstrapTransform":5,"./text0":8}],8:[function(require,module,exports){
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

},{"./bootstrapTransform":5}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){
var type = require('./text');
type.api = require('./api');

module.exports = {
  type: type
};

},{"./api":9,"./text":11}],11:[function(require,module,exports){
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
    console.error(c)
    console.error(typeof c)
    switch (typeof c) {
      case 'object':
        // // The only valid objects are {d:X} for +ive values of X.
        // if (!(typeof c.d === 'number' && c.d > 0)) throw Error('Object components must be deletes of size > 0');
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


},{}],12:[function(require,module,exports){
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

},{}],13:[function(require,module,exports){
var diff = require('fast-diff');
var equal = require('deep-equal');
var extend = require('extend');
var op = require('./op');


var NULL_CHARACTER = String.fromCharCode(0);  // Placeholder char for embed in diff()


var Delta = function (ops) {
  // Assume we are given a well formed ops
  if (Array.isArray(ops)) {
    this.ops = ops;
  } else if (ops != null && Array.isArray(ops.ops)) {
    this.ops = ops.ops;
  } else {
    this.ops = [];
  }
};


Delta.prototype.insert = function (text, attributes) {
  var newOp = {};
  if (text.length === 0) return this;
  newOp.insert = text;
  if (attributes != null && typeof attributes === 'object' && Object.keys(attributes).length > 0) {
    newOp.attributes = attributes;
  }
  return this.push(newOp);
};

Delta.prototype['delete'] = function (length) {
  if (length <= 0) return this;
  return this.push({ 'delete': length });
};

Delta.prototype.retain = function (length, attributes) {
  if (length <= 0) return this;
  var newOp = { retain: length };
  if (attributes != null && typeof attributes === 'object' && Object.keys(attributes).length > 0) {
    newOp.attributes = attributes;
  }
  return this.push(newOp);
};

Delta.prototype.push = function (newOp) {
  var index = this.ops.length;
  var lastOp = this.ops[index - 1];
  newOp = extend(true, {}, newOp);
  if (typeof lastOp === 'object') {
    if (typeof newOp['delete'] === 'number' && typeof lastOp['delete'] === 'number') {
      this.ops[index - 1] = { 'delete': lastOp['delete'] + newOp['delete'] };
      return this;
    }
    // Since it does not matter if we insert before or after deleting at the same index,
    // always prefer to insert first
    if (typeof lastOp['delete'] === 'number' && newOp.insert != null) {
      index -= 1;
      lastOp = this.ops[index - 1];
      if (typeof lastOp !== 'object') {
        this.ops.unshift(newOp);
        return this;
      }
    }
    if (equal(newOp.attributes, lastOp.attributes)) {
      if (typeof newOp.insert === 'string' && typeof lastOp.insert === 'string') {
        this.ops[index - 1] = { insert: lastOp.insert + newOp.insert };
        if (typeof newOp.attributes === 'object') this.ops[index - 1].attributes = newOp.attributes
        return this;
      } else if (typeof newOp.retain === 'number' && typeof lastOp.retain === 'number') {
        this.ops[index - 1] = { retain: lastOp.retain + newOp.retain };
        if (typeof newOp.attributes === 'object') this.ops[index - 1].attributes = newOp.attributes
        return this;
      }
    }
  }
  if (index === this.ops.length) {
    this.ops.push(newOp);
  } else {
    this.ops.splice(index, 0, newOp);
  }
  return this;
};

Delta.prototype.filter = function (predicate) {
  return this.ops.filter(predicate);
};

Delta.prototype.forEach = function (predicate) {
  this.ops.forEach(predicate);
};

Delta.prototype.map = function (predicate) {
  return this.ops.map(predicate);
};

Delta.prototype.partition = function (predicate) {
  var passed = [], failed = [];
  this.forEach(function(op) {
    var target = predicate(op) ? passed : failed;
    target.push(op);
  });
  return [passed, failed];
};

Delta.prototype.reduce = function (predicate, initial) {
  return this.ops.reduce(predicate, initial);
};

Delta.prototype.chop = function () {
  var lastOp = this.ops[this.ops.length - 1];
  if (lastOp && lastOp.retain && !lastOp.attributes) {
    this.ops.pop();
  }
  return this;
};

Delta.prototype.length = function () {
  return this.reduce(function (length, elem) {
    return length + op.length(elem);
  }, 0);
};

Delta.prototype.slice = function (start, end) {
  start = start || 0;
  if (typeof end !== 'number') end = Infinity;
  var ops = [];
  var iter = op.iterator(this.ops);
  var index = 0;
  while (index < end && iter.hasNext()) {
    var nextOp;
    if (index < start) {
      nextOp = iter.next(start - index);
    } else {
      nextOp = iter.next(end - index);
      ops.push(nextOp);
    }
    index += op.length(nextOp);
  }
  return new Delta(ops);
};


Delta.prototype.compose = function (other) {
  var thisIter = op.iterator(this.ops);
  var otherIter = op.iterator(other.ops);
  var delta = new Delta();
  while (thisIter.hasNext() || otherIter.hasNext()) {
    if (otherIter.peekType() === 'insert') {
      delta.push(otherIter.next());
    } else if (thisIter.peekType() === 'delete') {
      delta.push(thisIter.next());
    } else {
      var length = Math.min(thisIter.peekLength(), otherIter.peekLength());
      var thisOp = thisIter.next(length);
      var otherOp = otherIter.next(length);
      if (typeof otherOp.retain === 'number') {
        var newOp = {};
        if (typeof thisOp.retain === 'number') {
          newOp.retain = length;
        } else {
          newOp.insert = thisOp.insert;
        }
        // Preserve null when composing with a retain, otherwise remove it for inserts
        var attributes = op.attributes.compose(thisOp.attributes, otherOp.attributes, typeof thisOp.retain === 'number');
        if (attributes) newOp.attributes = attributes;
        delta.push(newOp);
      // Other op should be delete, we could be an insert or retain
      // Insert + delete cancels out
      } else if (typeof otherOp['delete'] === 'number' && typeof thisOp.retain === 'number') {
        delta.push(otherOp);
      }
    }
  }
  return delta.chop();
};

Delta.prototype.concat = function (other) {
  var delta = new Delta(this.ops.slice());
  if (other.ops.length > 0) {
    delta.push(other.ops[0]);
    delta.ops = delta.ops.concat(other.ops.slice(1));
  }
  return delta;
};

Delta.prototype.diff = function (other, index) {
  if (this.ops === other.ops) {
    return new Delta();
  }
  var strings = [this, other].map(function (delta) {
    return delta.map(function (op) {
      if (op.insert != null) {
        return typeof op.insert === 'string' ? op.insert : NULL_CHARACTER;
      }
      var prep = (ops === other.ops) ? 'on' : 'with';
      throw new Error('diff() called ' + prep + ' non-document');
    }).join('');
  });
  var delta = new Delta();
  var diffResult = diff(strings[0], strings[1], index);
  var thisIter = op.iterator(this.ops);
  var otherIter = op.iterator(other.ops);
  diffResult.forEach(function (component) {
    var length = component[1].length;
    while (length > 0) {
      var opLength = 0;
      switch (component[0]) {
        case diff.INSERT:
          opLength = Math.min(otherIter.peekLength(), length);
          delta.push(otherIter.next(opLength));
          break;
        case diff.DELETE:
          opLength = Math.min(length, thisIter.peekLength());
          thisIter.next(opLength);
          delta['delete'](opLength);
          break;
        case diff.EQUAL:
          opLength = Math.min(thisIter.peekLength(), otherIter.peekLength(), length);
          var thisOp = thisIter.next(opLength);
          var otherOp = otherIter.next(opLength);
          if (equal(thisOp.insert, otherOp.insert)) {
            delta.retain(opLength, op.attributes.diff(thisOp.attributes, otherOp.attributes));
          } else {
            delta.push(otherOp)['delete'](opLength);
          }
          break;
      }
      length -= opLength;
    }
  });
  return delta.chop();
};

Delta.prototype.eachLine = function (predicate, newline) {
  newline = newline || '\n';
  var iter = op.iterator(this.ops);
  var line = new Delta();
  while (iter.hasNext()) {
    if (iter.peekType() !== 'insert') return;
    var thisOp = iter.peek();
    var start = op.length(thisOp) - iter.peekLength();
    var index = typeof thisOp.insert === 'string' ?
      thisOp.insert.indexOf(newline, start) - start : -1;
    if (index < 0) {
      line.push(iter.next());
    } else if (index > 0) {
      line.push(iter.next(index));
    } else {
      predicate(line, iter.next(1).attributes || {});
      line = new Delta();
    }
  }
  if (line.length() > 0) {
    predicate(line, {});
  }
};

Delta.prototype.transform = function (other, priority) {
  priority = !!priority;
  if (typeof other === 'number') {
    return this.transformPosition(other, priority);
  }
  var thisIter = op.iterator(this.ops);
  var otherIter = op.iterator(other.ops);
  var delta = new Delta();
  while (thisIter.hasNext() || otherIter.hasNext()) {
    if (thisIter.peekType() === 'insert' && (priority || otherIter.peekType() !== 'insert')) {
      delta.retain(op.length(thisIter.next()));
    } else if (otherIter.peekType() === 'insert') {
      delta.push(otherIter.next());
    } else {
      var length = Math.min(thisIter.peekLength(), otherIter.peekLength());
      var thisOp = thisIter.next(length);
      var otherOp = otherIter.next(length);
      if (thisOp['delete']) {
        // Our delete either makes their delete redundant or removes their retain
        continue;
      } else if (otherOp['delete']) {
        delta.push(otherOp);
      } else {
        // We retain either their retain or insert
        delta.retain(length, op.attributes.transform(thisOp.attributes, otherOp.attributes, priority));
      }
    }
  }
  return delta.chop();
};

Delta.prototype.transformPosition = function (index, priority) {
  priority = !!priority;
  var thisIter = op.iterator(this.ops);
  var offset = 0;
  while (thisIter.hasNext() && offset <= index) {
    var length = thisIter.peekLength();
    var nextType = thisIter.peekType();
    thisIter.next();
    if (nextType === 'delete') {
      index -= Math.min(length, index - offset);
      continue;
    } else if (nextType === 'insert' && (offset < index || !priority)) {
      index += length;
    }
    offset += length;
  }
  return index;
};


module.exports = Delta;

},{"./op":14,"deep-equal":15,"extend":2,"fast-diff":3}],14:[function(require,module,exports){
var equal = require('deep-equal');
var extend = require('extend');


var lib = {
  attributes: {
    compose: function (a, b, keepNull) {
      if (typeof a !== 'object') a = {};
      if (typeof b !== 'object') b = {};
      var attributes = extend(true, {}, b);
      if (!keepNull) {
        attributes = Object.keys(attributes).reduce(function (copy, key) {
          if (attributes[key] != null) {
            copy[key] = attributes[key];
          }
          return copy;
        }, {});
      }
      for (var key in a) {
        if (a[key] !== undefined && b[key] === undefined) {
          attributes[key] = a[key];
        }
      }
      return Object.keys(attributes).length > 0 ? attributes : undefined;
    },

    diff: function(a, b) {
      if (typeof a !== 'object') a = {};
      if (typeof b !== 'object') b = {};
      var attributes = Object.keys(a).concat(Object.keys(b)).reduce(function (attributes, key) {
        if (!equal(a[key], b[key])) {
          attributes[key] = b[key] === undefined ? null : b[key];
        }
        return attributes;
      }, {});
      return Object.keys(attributes).length > 0 ? attributes : undefined;
    },

    transform: function (a, b, priority) {
      if (typeof a !== 'object') return b;
      if (typeof b !== 'object') return undefined;
      if (!priority) return b;  // b simply overwrites us without priority
      var attributes = Object.keys(b).reduce(function (attributes, key) {
        if (a[key] === undefined) attributes[key] = b[key];  // null is a valid value
        return attributes;
      }, {});
      return Object.keys(attributes).length > 0 ? attributes : undefined;
    }
  },

  iterator: function (ops) {
    return new Iterator(ops);
  },

  length: function (op) {
    if (typeof op['delete'] === 'number') {
      return op['delete'];
    } else if (typeof op.retain === 'number') {
      return op.retain;
    } else {
      return typeof op.insert === 'string' ? op.insert.length : 1;
    }
  }
};


function Iterator(ops) {
  this.ops = ops;
  this.index = 0;
  this.offset = 0;
};

Iterator.prototype.hasNext = function () {
  return this.peekLength() < Infinity;
};

Iterator.prototype.next = function (length) {
  if (!length) length = Infinity;
  var nextOp = this.ops[this.index];
  if (nextOp) {
    var offset = this.offset;
    var opLength = lib.length(nextOp)
    if (length >= opLength - offset) {
      length = opLength - offset;
      this.index += 1;
      this.offset = 0;
    } else {
      this.offset += length;
    }
    if (typeof nextOp['delete'] === 'number') {
      return { 'delete': length };
    } else {
      var retOp = {};
      if (nextOp.attributes) {
        retOp.attributes = nextOp.attributes;
      }
      if (typeof nextOp.retain === 'number') {
        retOp.retain = length;
      } else if (typeof nextOp.insert === 'string') {
        retOp.insert = nextOp.insert.substr(offset, length);
      } else {
        // offset should === 0, length should === 1
        retOp.insert = nextOp.insert;
      }
      return retOp;
    }
  } else {
    return { retain: Infinity };
  }
};

Iterator.prototype.peek = function () {
  return this.ops[this.index];
};

Iterator.prototype.peekLength = function () {
  if (this.ops[this.index]) {
    // Should never return 0 if our index is being managed correctly
    return lib.length(this.ops[this.index]) - this.offset;
  } else {
    return Infinity;
  }
};

Iterator.prototype.peekType = function () {
  if (this.ops[this.index]) {
    if (typeof this.ops[this.index]['delete'] === 'number') {
      return 'delete';
    } else if (typeof this.ops[this.index].retain === 'number') {
      return 'retain';
    } else {
      return 'insert';
    }
  }
  return 'retain';
};


module.exports = lib;

},{"deep-equal":15,"extend":2}],15:[function(require,module,exports){
var pSlice = Array.prototype.slice;
var objectKeys = require('./lib/keys.js');
var isArguments = require('./lib/is_arguments.js');

var deepEqual = module.exports = function (actual, expected, opts) {
  if (!opts) opts = {};
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!actual || !expected || typeof actual != 'object' && typeof expected != 'object') {
    return opts.strict ? actual === expected : actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected, opts);
  }
}

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isBuffer (x) {
  if (!x || typeof x !== 'object' || typeof x.length !== 'number') return false;
  if (typeof x.copy !== 'function' || typeof x.slice !== 'function') {
    return false;
  }
  if (x.length > 0 && typeof x[0] !== 'number') return false;
  return true;
}

function objEquiv(a, b, opts) {
  var i, key;
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return deepEqual(a, b, opts);
  }
  if (isBuffer(a)) {
    if (!isBuffer(b)) {
      return false;
    }
    if (a.length !== b.length) return false;
    for (i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b);
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!deepEqual(a[key], b[key], opts)) return false;
  }
  return typeof a === typeof b;
}

},{"./lib/is_arguments.js":16,"./lib/keys.js":17}],16:[function(require,module,exports){
var supportsArgumentsClass = (function(){
  return Object.prototype.toString.call(arguments)
})() == '[object Arguments]';

exports = module.exports = supportsArgumentsClass ? supported : unsupported;

exports.supported = supported;
function supported(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
};

exports.unsupported = unsupported;
function unsupported(object){
  return object &&
    typeof object == 'object' &&
    typeof object.length == 'number' &&
    Object.prototype.hasOwnProperty.call(object, 'callee') &&
    !Object.prototype.propertyIsEnumerable.call(object, 'callee') ||
    false;
};

},{}],17:[function(require,module,exports){
exports = module.exports = typeof Object.keys === 'function'
  ? Object.keys : shim;

exports.shim = shim;
function shim (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}

},{}],18:[function(require,module,exports){
module.exports = require('./lib/type');

},{"./lib/type":19}],19:[function(require,module,exports){
var Delta = require('quill-delta');


module.exports = {
  Delta: Delta,
  type: {
    name: 'rich-text',
    uri: 'http://sharejs.org/types/rich-text/v1',

    create: function (initial) {
      return new Delta(initial);
    },

    apply: function (snapshot, delta) {
      snapshot = new Delta(snapshot);
      delta = new Delta(delta);
      return snapshot.compose(delta);
    },

    compose: function (delta1, delta2) {
      delta1 = new Delta(delta1);
      delta2 = new Delta(delta2);
      return delta1.compose(delta2);
    },

    diff: function (delta1, delta2) {
      delta1 = new Delta(delta1);
      delta2 = new Delta(delta2);
      return delta1.diff(delta2);
    },

    transform: function (delta1, delta2, side) {
      delta1 = new Delta(delta1);
      delta2 = new Delta(delta2);
      // Fuzzer specs is in opposite order of delta interface
      return delta2.transform(delta1, side === 'left');
    },

    transformCursor: function(cursor, delta, isOwnOp) {
      return delta.transformPosition(cursor, !isOwnOp);
    },

    normalize: function(delta) {
      return delta;   // quill-delta is already canonical
    },

    serialize: function(delta) {
      return delta.ops;
    },

    deserialize: function(ops) {
      return new Delta(ops);
    }
  }
};

},{"quill-delta":13}],20:[function(require,module,exports){
(function (global){
global.sharedb = require("../server/vendor/sharedb/lib/client")
global.otText = require('ot-text');
global.richText = require('rich-text');

sharedb.types.register(otText.type);
sharedb.types.register(richText.type);


sharedb.types.map['json0'].registerSubtype(otText.type);

sharedb.types.map['json0'].registerSubtype(richText.type);


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../server/vendor/sharedb/lib/client":23,"ot-text":10,"rich-text":18}],21:[function(require,module,exports){
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

},{"../emitter":25,"../error":26,"../types":27,"../util":28,"./doc":22,"./query":24,"_process":12}],22:[function(require,module,exports){
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

  console.log(types.map)
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

},{"../emitter":25,"../error":26,"../types":27,"_process":12}],23:[function(require,module,exports){
exports.Connection = require('./connection');
exports.Doc = require('./doc');
exports.Error = require('../error');
exports.Query = require('./query');
exports.types = require('../types');

},{"../error":26,"../types":27,"./connection":21,"./doc":22,"./query":24}],24:[function(require,module,exports){
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

},{"../emitter":25,"_process":12}],25:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter;

exports.EventEmitter = EventEmitter;
exports.mixin = mixin;

function mixin(Constructor) {
  for (var key in EventEmitter.prototype) {
    Constructor.prototype[key] = EventEmitter.prototype[key];
  }
}

},{"events":1}],26:[function(require,module,exports){
var makeError = require('make-error');

function ShareDBError(code, message) {
  ShareDBError.super.call(this, message);
  this.code = code;
}

makeError(ShareDBError);

module.exports = ShareDBError;

},{"make-error":4}],27:[function(require,module,exports){

exports.defaultType = require('ot-json0').type;

exports.map = {};

exports.register = function(type) {
  if (type.name) exports.map[type.name] = type;
  if (type.uri) exports.map[type.uri] = type;
};

exports.register(exports.defaultType);

},{"ot-json0":6}],28:[function(require,module,exports){

exports.doNothing = doNothing;
function doNothing() {}

exports.hasKeys = function(object) {
  for (var key in object) return true;
  return false;
};

},{}]},{},[20])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9leHRlbmQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZmFzdC1kaWZmL2RpZmYuanMiLCJub2RlX21vZHVsZXMvbWFrZS1lcnJvci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9vdC1qc29uMC9saWIvYm9vdHN0cmFwVHJhbnNmb3JtLmpzIiwibm9kZV9tb2R1bGVzL290LWpzb24wL2xpYi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9vdC1qc29uMC9saWIvanNvbjAuanMiLCJub2RlX21vZHVsZXMvb3QtanNvbjAvbGliL3RleHQwLmpzIiwibm9kZV9tb2R1bGVzL290LXRleHQvbGliL2FwaS5qcyIsIm5vZGVfbW9kdWxlcy9vdC10ZXh0L2xpYi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9vdC10ZXh0L2xpYi90ZXh0LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9xdWlsbC1kZWx0YS9saWIvZGVsdGEuanMiLCJub2RlX21vZHVsZXMvcXVpbGwtZGVsdGEvbGliL29wLmpzIiwibm9kZV9tb2R1bGVzL3F1aWxsLWRlbHRhL25vZGVfbW9kdWxlcy9kZWVwLWVxdWFsL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3F1aWxsLWRlbHRhL25vZGVfbW9kdWxlcy9kZWVwLWVxdWFsL2xpYi9pc19hcmd1bWVudHMuanMiLCJub2RlX21vZHVsZXMvcXVpbGwtZGVsdGEvbm9kZV9tb2R1bGVzL2RlZXAtZXF1YWwvbGliL2tleXMuanMiLCJub2RlX21vZHVsZXMvcmljaC10ZXh0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3JpY2gtdGV4dC9saWIvdHlwZS5qcyIsInNyYy9jbGllbnQvaW5kZXguanMiLCJzcmMvc2VydmVyL3ZlbmRvci9zaGFyZWRiL2xpYi9jbGllbnQvY29ubmVjdGlvbi5qcyIsInNyYy9zZXJ2ZXIvdmVuZG9yL3NoYXJlZGIvbGliL2NsaWVudC9kb2MuanMiLCJzcmMvc2VydmVyL3ZlbmRvci9zaGFyZWRiL2xpYi9jbGllbnQvaW5kZXguanMiLCJzcmMvc2VydmVyL3ZlbmRvci9zaGFyZWRiL2xpYi9jbGllbnQvcXVlcnkuanMiLCJzcmMvc2VydmVyL3ZlbmRvci9zaGFyZWRiL2xpYi9lbWl0dGVyLmpzIiwic3JjL3NlcnZlci92ZW5kb3Ivc2hhcmVkYi9saWIvZXJyb3IuanMiLCJzcmMvc2VydmVyL3ZlbmRvci9zaGFyZWRiL2xpYi90eXBlcy5qcyIsInNyYy9zZXJ2ZXIvdmVuZG9yL3NoYXJlZGIvbGliL3V0aWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwYUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdFRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDbmtCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2g1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDdk1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBBdCBsZWFzdCBnaXZlIHNvbWUga2luZCBvZiBjb250ZXh0IHRvIHRoZSB1c2VyXG4gICAgICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuICgnICsgZXIgKyAnKScpO1xuICAgICAgICBlcnIuY29udGV4dCA9IGVyO1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSBpZiAobGlzdGVuZXJzKSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24odHlwZSkge1xuICBpZiAodGhpcy5fZXZlbnRzKSB7XG4gICAgdmFyIGV2bGlzdGVuZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgICBpZiAoaXNGdW5jdGlvbihldmxpc3RlbmVyKSlcbiAgICAgIHJldHVybiAxO1xuICAgIGVsc2UgaWYgKGV2bGlzdGVuZXIpXG4gICAgICByZXR1cm4gZXZsaXN0ZW5lci5sZW5ndGg7XG4gIH1cbiAgcmV0dXJuIDA7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgcmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJDb3VudCh0eXBlKTtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgdG9TdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG52YXIgaXNBcnJheSA9IGZ1bmN0aW9uIGlzQXJyYXkoYXJyKSB7XG5cdGlmICh0eXBlb2YgQXJyYXkuaXNBcnJheSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdHJldHVybiBBcnJheS5pc0FycmF5KGFycik7XG5cdH1cblxuXHRyZXR1cm4gdG9TdHIuY2FsbChhcnIpID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcblxudmFyIGlzUGxhaW5PYmplY3QgPSBmdW5jdGlvbiBpc1BsYWluT2JqZWN0KG9iaikge1xuXHRpZiAoIW9iaiB8fCB0b1N0ci5jYWxsKG9iaikgIT09ICdbb2JqZWN0IE9iamVjdF0nKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0dmFyIGhhc093bkNvbnN0cnVjdG9yID0gaGFzT3duLmNhbGwob2JqLCAnY29uc3RydWN0b3InKTtcblx0dmFyIGhhc0lzUHJvdG90eXBlT2YgPSBvYmouY29uc3RydWN0b3IgJiYgb2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSAmJiBoYXNPd24uY2FsbChvYmouY29uc3RydWN0b3IucHJvdG90eXBlLCAnaXNQcm90b3R5cGVPZicpO1xuXHQvLyBOb3Qgb3duIGNvbnN0cnVjdG9yIHByb3BlcnR5IG11c3QgYmUgT2JqZWN0XG5cdGlmIChvYmouY29uc3RydWN0b3IgJiYgIWhhc093bkNvbnN0cnVjdG9yICYmICFoYXNJc1Byb3RvdHlwZU9mKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Ly8gT3duIHByb3BlcnRpZXMgYXJlIGVudW1lcmF0ZWQgZmlyc3RseSwgc28gdG8gc3BlZWQgdXAsXG5cdC8vIGlmIGxhc3Qgb25lIGlzIG93biwgdGhlbiBhbGwgcHJvcGVydGllcyBhcmUgb3duLlxuXHR2YXIga2V5O1xuXHRmb3IgKGtleSBpbiBvYmopIHsvKiovfVxuXG5cdHJldHVybiB0eXBlb2Yga2V5ID09PSAndW5kZWZpbmVkJyB8fCBoYXNPd24uY2FsbChvYmosIGtleSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCgpIHtcblx0dmFyIG9wdGlvbnMsIG5hbWUsIHNyYywgY29weSwgY29weUlzQXJyYXksIGNsb25lLFxuXHRcdHRhcmdldCA9IGFyZ3VtZW50c1swXSxcblx0XHRpID0gMSxcblx0XHRsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoLFxuXHRcdGRlZXAgPSBmYWxzZTtcblxuXHQvLyBIYW5kbGUgYSBkZWVwIGNvcHkgc2l0dWF0aW9uXG5cdGlmICh0eXBlb2YgdGFyZ2V0ID09PSAnYm9vbGVhbicpIHtcblx0XHRkZWVwID0gdGFyZ2V0O1xuXHRcdHRhcmdldCA9IGFyZ3VtZW50c1sxXSB8fCB7fTtcblx0XHQvLyBza2lwIHRoZSBib29sZWFuIGFuZCB0aGUgdGFyZ2V0XG5cdFx0aSA9IDI7XG5cdH0gZWxzZSBpZiAoKHR5cGVvZiB0YXJnZXQgIT09ICdvYmplY3QnICYmIHR5cGVvZiB0YXJnZXQgIT09ICdmdW5jdGlvbicpIHx8IHRhcmdldCA9PSBudWxsKSB7XG5cdFx0dGFyZ2V0ID0ge307XG5cdH1cblxuXHRmb3IgKDsgaSA8IGxlbmd0aDsgKytpKSB7XG5cdFx0b3B0aW9ucyA9IGFyZ3VtZW50c1tpXTtcblx0XHQvLyBPbmx5IGRlYWwgd2l0aCBub24tbnVsbC91bmRlZmluZWQgdmFsdWVzXG5cdFx0aWYgKG9wdGlvbnMgIT0gbnVsbCkge1xuXHRcdFx0Ly8gRXh0ZW5kIHRoZSBiYXNlIG9iamVjdFxuXHRcdFx0Zm9yIChuYW1lIGluIG9wdGlvbnMpIHtcblx0XHRcdFx0c3JjID0gdGFyZ2V0W25hbWVdO1xuXHRcdFx0XHRjb3B5ID0gb3B0aW9uc1tuYW1lXTtcblxuXHRcdFx0XHQvLyBQcmV2ZW50IG5ldmVyLWVuZGluZyBsb29wXG5cdFx0XHRcdGlmICh0YXJnZXQgIT09IGNvcHkpIHtcblx0XHRcdFx0XHQvLyBSZWN1cnNlIGlmIHdlJ3JlIG1lcmdpbmcgcGxhaW4gb2JqZWN0cyBvciBhcnJheXNcblx0XHRcdFx0XHRpZiAoZGVlcCAmJiBjb3B5ICYmIChpc1BsYWluT2JqZWN0KGNvcHkpIHx8IChjb3B5SXNBcnJheSA9IGlzQXJyYXkoY29weSkpKSkge1xuXHRcdFx0XHRcdFx0aWYgKGNvcHlJc0FycmF5KSB7XG5cdFx0XHRcdFx0XHRcdGNvcHlJc0FycmF5ID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdGNsb25lID0gc3JjICYmIGlzQXJyYXkoc3JjKSA/IHNyYyA6IFtdO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Y2xvbmUgPSBzcmMgJiYgaXNQbGFpbk9iamVjdChzcmMpID8gc3JjIDoge307XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8vIE5ldmVyIG1vdmUgb3JpZ2luYWwgb2JqZWN0cywgY2xvbmUgdGhlbVxuXHRcdFx0XHRcdFx0dGFyZ2V0W25hbWVdID0gZXh0ZW5kKGRlZXAsIGNsb25lLCBjb3B5KTtcblxuXHRcdFx0XHRcdC8vIERvbid0IGJyaW5nIGluIHVuZGVmaW5lZCB2YWx1ZXNcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBjb3B5ICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0XHRcdFx0dGFyZ2V0W25hbWVdID0gY29weTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBSZXR1cm4gdGhlIG1vZGlmaWVkIG9iamVjdFxuXHRyZXR1cm4gdGFyZ2V0O1xufTtcblxuIiwiLyoqXG4gKiBUaGlzIGxpYnJhcnkgbW9kaWZpZXMgdGhlIGRpZmYtcGF0Y2gtbWF0Y2ggbGlicmFyeSBieSBOZWlsIEZyYXNlclxuICogYnkgcmVtb3ZpbmcgdGhlIHBhdGNoIGFuZCBtYXRjaCBmdW5jdGlvbmFsaXR5IGFuZCBjZXJ0YWluIGFkdmFuY2VkXG4gKiBvcHRpb25zIGluIHRoZSBkaWZmIGZ1bmN0aW9uLiBUaGUgb3JpZ2luYWwgbGljZW5zZSBpcyBhcyBmb2xsb3dzOlxuICpcbiAqID09PVxuICpcbiAqIERpZmYgTWF0Y2ggYW5kIFBhdGNoXG4gKlxuICogQ29weXJpZ2h0IDIwMDYgR29vZ2xlIEluYy5cbiAqIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9nb29nbGUtZGlmZi1tYXRjaC1wYXRjaC9cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cblxuLyoqXG4gKiBUaGUgZGF0YSBzdHJ1Y3R1cmUgcmVwcmVzZW50aW5nIGEgZGlmZiBpcyBhbiBhcnJheSBvZiB0dXBsZXM6XG4gKiBbW0RJRkZfREVMRVRFLCAnSGVsbG8nXSwgW0RJRkZfSU5TRVJULCAnR29vZGJ5ZSddLCBbRElGRl9FUVVBTCwgJyB3b3JsZC4nXV1cbiAqIHdoaWNoIG1lYW5zOiBkZWxldGUgJ0hlbGxvJywgYWRkICdHb29kYnllJyBhbmQga2VlcCAnIHdvcmxkLidcbiAqL1xudmFyIERJRkZfREVMRVRFID0gLTE7XG52YXIgRElGRl9JTlNFUlQgPSAxO1xudmFyIERJRkZfRVFVQUwgPSAwO1xuXG5cbi8qKlxuICogRmluZCB0aGUgZGlmZmVyZW5jZXMgYmV0d2VlbiB0d28gdGV4dHMuICBTaW1wbGlmaWVzIHRoZSBwcm9ibGVtIGJ5IHN0cmlwcGluZ1xuICogYW55IGNvbW1vbiBwcmVmaXggb3Igc3VmZml4IG9mZiB0aGUgdGV4dHMgYmVmb3JlIGRpZmZpbmcuXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgT2xkIHN0cmluZyB0byBiZSBkaWZmZWQuXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgTmV3IHN0cmluZyB0byBiZSBkaWZmZWQuXG4gKiBAcGFyYW0ge0ludH0gY3Vyc29yX3BvcyBFeHBlY3RlZCBlZGl0IHBvc2l0aW9uIGluIHRleHQxIChvcHRpb25hbClcbiAqIEByZXR1cm4ge0FycmF5fSBBcnJheSBvZiBkaWZmIHR1cGxlcy5cbiAqL1xuZnVuY3Rpb24gZGlmZl9tYWluKHRleHQxLCB0ZXh0MiwgY3Vyc29yX3Bvcykge1xuICAvLyBDaGVjayBmb3IgZXF1YWxpdHkgKHNwZWVkdXApLlxuICBpZiAodGV4dDEgPT0gdGV4dDIpIHtcbiAgICBpZiAodGV4dDEpIHtcbiAgICAgIHJldHVybiBbW0RJRkZfRVFVQUwsIHRleHQxXV07XG4gICAgfVxuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIC8vIENoZWNrIGN1cnNvcl9wb3Mgd2l0aGluIGJvdW5kc1xuICBpZiAoY3Vyc29yX3BvcyA8IDAgfHwgdGV4dDEubGVuZ3RoIDwgY3Vyc29yX3Bvcykge1xuICAgIGN1cnNvcl9wb3MgPSBudWxsO1xuICB9XG5cbiAgLy8gVHJpbSBvZmYgY29tbW9uIHByZWZpeCAoc3BlZWR1cCkuXG4gIHZhciBjb21tb25sZW5ndGggPSBkaWZmX2NvbW1vblByZWZpeCh0ZXh0MSwgdGV4dDIpO1xuICB2YXIgY29tbW9ucHJlZml4ID0gdGV4dDEuc3Vic3RyaW5nKDAsIGNvbW1vbmxlbmd0aCk7XG4gIHRleHQxID0gdGV4dDEuc3Vic3RyaW5nKGNvbW1vbmxlbmd0aCk7XG4gIHRleHQyID0gdGV4dDIuc3Vic3RyaW5nKGNvbW1vbmxlbmd0aCk7XG5cbiAgLy8gVHJpbSBvZmYgY29tbW9uIHN1ZmZpeCAoc3BlZWR1cCkuXG4gIGNvbW1vbmxlbmd0aCA9IGRpZmZfY29tbW9uU3VmZml4KHRleHQxLCB0ZXh0Mik7XG4gIHZhciBjb21tb25zdWZmaXggPSB0ZXh0MS5zdWJzdHJpbmcodGV4dDEubGVuZ3RoIC0gY29tbW9ubGVuZ3RoKTtcbiAgdGV4dDEgPSB0ZXh0MS5zdWJzdHJpbmcoMCwgdGV4dDEubGVuZ3RoIC0gY29tbW9ubGVuZ3RoKTtcbiAgdGV4dDIgPSB0ZXh0Mi5zdWJzdHJpbmcoMCwgdGV4dDIubGVuZ3RoIC0gY29tbW9ubGVuZ3RoKTtcblxuICAvLyBDb21wdXRlIHRoZSBkaWZmIG9uIHRoZSBtaWRkbGUgYmxvY2suXG4gIHZhciBkaWZmcyA9IGRpZmZfY29tcHV0ZV8odGV4dDEsIHRleHQyKTtcblxuICAvLyBSZXN0b3JlIHRoZSBwcmVmaXggYW5kIHN1ZmZpeC5cbiAgaWYgKGNvbW1vbnByZWZpeCkge1xuICAgIGRpZmZzLnVuc2hpZnQoW0RJRkZfRVFVQUwsIGNvbW1vbnByZWZpeF0pO1xuICB9XG4gIGlmIChjb21tb25zdWZmaXgpIHtcbiAgICBkaWZmcy5wdXNoKFtESUZGX0VRVUFMLCBjb21tb25zdWZmaXhdKTtcbiAgfVxuICBkaWZmX2NsZWFudXBNZXJnZShkaWZmcyk7XG4gIGlmIChjdXJzb3JfcG9zICE9IG51bGwpIHtcbiAgICBkaWZmcyA9IGZpeF9jdXJzb3IoZGlmZnMsIGN1cnNvcl9wb3MpO1xuICB9XG4gIHJldHVybiBkaWZmcztcbn07XG5cblxuLyoqXG4gKiBGaW5kIHRoZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIHR3byB0ZXh0cy4gIEFzc3VtZXMgdGhhdCB0aGUgdGV4dHMgZG8gbm90XG4gKiBoYXZlIGFueSBjb21tb24gcHJlZml4IG9yIHN1ZmZpeC5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBPbGQgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAqIEByZXR1cm4ge0FycmF5fSBBcnJheSBvZiBkaWZmIHR1cGxlcy5cbiAqL1xuZnVuY3Rpb24gZGlmZl9jb21wdXRlXyh0ZXh0MSwgdGV4dDIpIHtcbiAgdmFyIGRpZmZzO1xuXG4gIGlmICghdGV4dDEpIHtcbiAgICAvLyBKdXN0IGFkZCBzb21lIHRleHQgKHNwZWVkdXApLlxuICAgIHJldHVybiBbW0RJRkZfSU5TRVJULCB0ZXh0Ml1dO1xuICB9XG5cbiAgaWYgKCF0ZXh0Mikge1xuICAgIC8vIEp1c3QgZGVsZXRlIHNvbWUgdGV4dCAoc3BlZWR1cCkuXG4gICAgcmV0dXJuIFtbRElGRl9ERUxFVEUsIHRleHQxXV07XG4gIH1cblxuICB2YXIgbG9uZ3RleHQgPSB0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGggPyB0ZXh0MSA6IHRleHQyO1xuICB2YXIgc2hvcnR0ZXh0ID0gdGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoID8gdGV4dDIgOiB0ZXh0MTtcbiAgdmFyIGkgPSBsb25ndGV4dC5pbmRleE9mKHNob3J0dGV4dCk7XG4gIGlmIChpICE9IC0xKSB7XG4gICAgLy8gU2hvcnRlciB0ZXh0IGlzIGluc2lkZSB0aGUgbG9uZ2VyIHRleHQgKHNwZWVkdXApLlxuICAgIGRpZmZzID0gW1tESUZGX0lOU0VSVCwgbG9uZ3RleHQuc3Vic3RyaW5nKDAsIGkpXSxcbiAgICAgICAgICAgICBbRElGRl9FUVVBTCwgc2hvcnR0ZXh0XSxcbiAgICAgICAgICAgICBbRElGRl9JTlNFUlQsIGxvbmd0ZXh0LnN1YnN0cmluZyhpICsgc2hvcnR0ZXh0Lmxlbmd0aCldXTtcbiAgICAvLyBTd2FwIGluc2VydGlvbnMgZm9yIGRlbGV0aW9ucyBpZiBkaWZmIGlzIHJldmVyc2VkLlxuICAgIGlmICh0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGgpIHtcbiAgICAgIGRpZmZzWzBdWzBdID0gZGlmZnNbMl1bMF0gPSBESUZGX0RFTEVURTtcbiAgICB9XG4gICAgcmV0dXJuIGRpZmZzO1xuICB9XG5cbiAgaWYgKHNob3J0dGV4dC5sZW5ndGggPT0gMSkge1xuICAgIC8vIFNpbmdsZSBjaGFyYWN0ZXIgc3RyaW5nLlxuICAgIC8vIEFmdGVyIHRoZSBwcmV2aW91cyBzcGVlZHVwLCB0aGUgY2hhcmFjdGVyIGNhbid0IGJlIGFuIGVxdWFsaXR5LlxuICAgIHJldHVybiBbW0RJRkZfREVMRVRFLCB0ZXh0MV0sIFtESUZGX0lOU0VSVCwgdGV4dDJdXTtcbiAgfVxuXG4gIC8vIENoZWNrIHRvIHNlZSBpZiB0aGUgcHJvYmxlbSBjYW4gYmUgc3BsaXQgaW4gdHdvLlxuICB2YXIgaG0gPSBkaWZmX2hhbGZNYXRjaF8odGV4dDEsIHRleHQyKTtcbiAgaWYgKGhtKSB7XG4gICAgLy8gQSBoYWxmLW1hdGNoIHdhcyBmb3VuZCwgc29ydCBvdXQgdGhlIHJldHVybiBkYXRhLlxuICAgIHZhciB0ZXh0MV9hID0gaG1bMF07XG4gICAgdmFyIHRleHQxX2IgPSBobVsxXTtcbiAgICB2YXIgdGV4dDJfYSA9IGhtWzJdO1xuICAgIHZhciB0ZXh0Ml9iID0gaG1bM107XG4gICAgdmFyIG1pZF9jb21tb24gPSBobVs0XTtcbiAgICAvLyBTZW5kIGJvdGggcGFpcnMgb2ZmIGZvciBzZXBhcmF0ZSBwcm9jZXNzaW5nLlxuICAgIHZhciBkaWZmc19hID0gZGlmZl9tYWluKHRleHQxX2EsIHRleHQyX2EpO1xuICAgIHZhciBkaWZmc19iID0gZGlmZl9tYWluKHRleHQxX2IsIHRleHQyX2IpO1xuICAgIC8vIE1lcmdlIHRoZSByZXN1bHRzLlxuICAgIHJldHVybiBkaWZmc19hLmNvbmNhdChbW0RJRkZfRVFVQUwsIG1pZF9jb21tb25dXSwgZGlmZnNfYik7XG4gIH1cblxuICByZXR1cm4gZGlmZl9iaXNlY3RfKHRleHQxLCB0ZXh0Mik7XG59O1xuXG5cbi8qKlxuICogRmluZCB0aGUgJ21pZGRsZSBzbmFrZScgb2YgYSBkaWZmLCBzcGxpdCB0aGUgcHJvYmxlbSBpbiB0d29cbiAqIGFuZCByZXR1cm4gdGhlIHJlY3Vyc2l2ZWx5IGNvbnN0cnVjdGVkIGRpZmYuXG4gKiBTZWUgTXllcnMgMTk4NiBwYXBlcjogQW4gTyhORCkgRGlmZmVyZW5jZSBBbGdvcml0aG0gYW5kIEl0cyBWYXJpYXRpb25zLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIE9sZCBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIE5ldyBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICogQHJldHVybiB7QXJyYXl9IEFycmF5IG9mIGRpZmYgdHVwbGVzLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gZGlmZl9iaXNlY3RfKHRleHQxLCB0ZXh0Mikge1xuICAvLyBDYWNoZSB0aGUgdGV4dCBsZW5ndGhzIHRvIHByZXZlbnQgbXVsdGlwbGUgY2FsbHMuXG4gIHZhciB0ZXh0MV9sZW5ndGggPSB0ZXh0MS5sZW5ndGg7XG4gIHZhciB0ZXh0Ml9sZW5ndGggPSB0ZXh0Mi5sZW5ndGg7XG4gIHZhciBtYXhfZCA9IE1hdGguY2VpbCgodGV4dDFfbGVuZ3RoICsgdGV4dDJfbGVuZ3RoKSAvIDIpO1xuICB2YXIgdl9vZmZzZXQgPSBtYXhfZDtcbiAgdmFyIHZfbGVuZ3RoID0gMiAqIG1heF9kO1xuICB2YXIgdjEgPSBuZXcgQXJyYXkodl9sZW5ndGgpO1xuICB2YXIgdjIgPSBuZXcgQXJyYXkodl9sZW5ndGgpO1xuICAvLyBTZXR0aW5nIGFsbCBlbGVtZW50cyB0byAtMSBpcyBmYXN0ZXIgaW4gQ2hyb21lICYgRmlyZWZveCB0aGFuIG1peGluZ1xuICAvLyBpbnRlZ2VycyBhbmQgdW5kZWZpbmVkLlxuICBmb3IgKHZhciB4ID0gMDsgeCA8IHZfbGVuZ3RoOyB4KyspIHtcbiAgICB2MVt4XSA9IC0xO1xuICAgIHYyW3hdID0gLTE7XG4gIH1cbiAgdjFbdl9vZmZzZXQgKyAxXSA9IDA7XG4gIHYyW3Zfb2Zmc2V0ICsgMV0gPSAwO1xuICB2YXIgZGVsdGEgPSB0ZXh0MV9sZW5ndGggLSB0ZXh0Ml9sZW5ndGg7XG4gIC8vIElmIHRoZSB0b3RhbCBudW1iZXIgb2YgY2hhcmFjdGVycyBpcyBvZGQsIHRoZW4gdGhlIGZyb250IHBhdGggd2lsbCBjb2xsaWRlXG4gIC8vIHdpdGggdGhlIHJldmVyc2UgcGF0aC5cbiAgdmFyIGZyb250ID0gKGRlbHRhICUgMiAhPSAwKTtcbiAgLy8gT2Zmc2V0cyBmb3Igc3RhcnQgYW5kIGVuZCBvZiBrIGxvb3AuXG4gIC8vIFByZXZlbnRzIG1hcHBpbmcgb2Ygc3BhY2UgYmV5b25kIHRoZSBncmlkLlxuICB2YXIgazFzdGFydCA9IDA7XG4gIHZhciBrMWVuZCA9IDA7XG4gIHZhciBrMnN0YXJ0ID0gMDtcbiAgdmFyIGsyZW5kID0gMDtcbiAgZm9yICh2YXIgZCA9IDA7IGQgPCBtYXhfZDsgZCsrKSB7XG4gICAgLy8gV2FsayB0aGUgZnJvbnQgcGF0aCBvbmUgc3RlcC5cbiAgICBmb3IgKHZhciBrMSA9IC1kICsgazFzdGFydDsgazEgPD0gZCAtIGsxZW5kOyBrMSArPSAyKSB7XG4gICAgICB2YXIgazFfb2Zmc2V0ID0gdl9vZmZzZXQgKyBrMTtcbiAgICAgIHZhciB4MTtcbiAgICAgIGlmIChrMSA9PSAtZCB8fCAoazEgIT0gZCAmJiB2MVtrMV9vZmZzZXQgLSAxXSA8IHYxW2sxX29mZnNldCArIDFdKSkge1xuICAgICAgICB4MSA9IHYxW2sxX29mZnNldCArIDFdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgeDEgPSB2MVtrMV9vZmZzZXQgLSAxXSArIDE7XG4gICAgICB9XG4gICAgICB2YXIgeTEgPSB4MSAtIGsxO1xuICAgICAgd2hpbGUgKHgxIDwgdGV4dDFfbGVuZ3RoICYmIHkxIDwgdGV4dDJfbGVuZ3RoICYmXG4gICAgICAgICAgICAgdGV4dDEuY2hhckF0KHgxKSA9PSB0ZXh0Mi5jaGFyQXQoeTEpKSB7XG4gICAgICAgIHgxKys7XG4gICAgICAgIHkxKys7XG4gICAgICB9XG4gICAgICB2MVtrMV9vZmZzZXRdID0geDE7XG4gICAgICBpZiAoeDEgPiB0ZXh0MV9sZW5ndGgpIHtcbiAgICAgICAgLy8gUmFuIG9mZiB0aGUgcmlnaHQgb2YgdGhlIGdyYXBoLlxuICAgICAgICBrMWVuZCArPSAyO1xuICAgICAgfSBlbHNlIGlmICh5MSA+IHRleHQyX2xlbmd0aCkge1xuICAgICAgICAvLyBSYW4gb2ZmIHRoZSBib3R0b20gb2YgdGhlIGdyYXBoLlxuICAgICAgICBrMXN0YXJ0ICs9IDI7XG4gICAgICB9IGVsc2UgaWYgKGZyb250KSB7XG4gICAgICAgIHZhciBrMl9vZmZzZXQgPSB2X29mZnNldCArIGRlbHRhIC0gazE7XG4gICAgICAgIGlmIChrMl9vZmZzZXQgPj0gMCAmJiBrMl9vZmZzZXQgPCB2X2xlbmd0aCAmJiB2MltrMl9vZmZzZXRdICE9IC0xKSB7XG4gICAgICAgICAgLy8gTWlycm9yIHgyIG9udG8gdG9wLWxlZnQgY29vcmRpbmF0ZSBzeXN0ZW0uXG4gICAgICAgICAgdmFyIHgyID0gdGV4dDFfbGVuZ3RoIC0gdjJbazJfb2Zmc2V0XTtcbiAgICAgICAgICBpZiAoeDEgPj0geDIpIHtcbiAgICAgICAgICAgIC8vIE92ZXJsYXAgZGV0ZWN0ZWQuXG4gICAgICAgICAgICByZXR1cm4gZGlmZl9iaXNlY3RTcGxpdF8odGV4dDEsIHRleHQyLCB4MSwgeTEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFdhbGsgdGhlIHJldmVyc2UgcGF0aCBvbmUgc3RlcC5cbiAgICBmb3IgKHZhciBrMiA9IC1kICsgazJzdGFydDsgazIgPD0gZCAtIGsyZW5kOyBrMiArPSAyKSB7XG4gICAgICB2YXIgazJfb2Zmc2V0ID0gdl9vZmZzZXQgKyBrMjtcbiAgICAgIHZhciB4MjtcbiAgICAgIGlmIChrMiA9PSAtZCB8fCAoazIgIT0gZCAmJiB2MltrMl9vZmZzZXQgLSAxXSA8IHYyW2syX29mZnNldCArIDFdKSkge1xuICAgICAgICB4MiA9IHYyW2syX29mZnNldCArIDFdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgeDIgPSB2MltrMl9vZmZzZXQgLSAxXSArIDE7XG4gICAgICB9XG4gICAgICB2YXIgeTIgPSB4MiAtIGsyO1xuICAgICAgd2hpbGUgKHgyIDwgdGV4dDFfbGVuZ3RoICYmIHkyIDwgdGV4dDJfbGVuZ3RoICYmXG4gICAgICAgICAgICAgdGV4dDEuY2hhckF0KHRleHQxX2xlbmd0aCAtIHgyIC0gMSkgPT1cbiAgICAgICAgICAgICB0ZXh0Mi5jaGFyQXQodGV4dDJfbGVuZ3RoIC0geTIgLSAxKSkge1xuICAgICAgICB4MisrO1xuICAgICAgICB5MisrO1xuICAgICAgfVxuICAgICAgdjJbazJfb2Zmc2V0XSA9IHgyO1xuICAgICAgaWYgKHgyID4gdGV4dDFfbGVuZ3RoKSB7XG4gICAgICAgIC8vIFJhbiBvZmYgdGhlIGxlZnQgb2YgdGhlIGdyYXBoLlxuICAgICAgICBrMmVuZCArPSAyO1xuICAgICAgfSBlbHNlIGlmICh5MiA+IHRleHQyX2xlbmd0aCkge1xuICAgICAgICAvLyBSYW4gb2ZmIHRoZSB0b3Agb2YgdGhlIGdyYXBoLlxuICAgICAgICBrMnN0YXJ0ICs9IDI7XG4gICAgICB9IGVsc2UgaWYgKCFmcm9udCkge1xuICAgICAgICB2YXIgazFfb2Zmc2V0ID0gdl9vZmZzZXQgKyBkZWx0YSAtIGsyO1xuICAgICAgICBpZiAoazFfb2Zmc2V0ID49IDAgJiYgazFfb2Zmc2V0IDwgdl9sZW5ndGggJiYgdjFbazFfb2Zmc2V0XSAhPSAtMSkge1xuICAgICAgICAgIHZhciB4MSA9IHYxW2sxX29mZnNldF07XG4gICAgICAgICAgdmFyIHkxID0gdl9vZmZzZXQgKyB4MSAtIGsxX29mZnNldDtcbiAgICAgICAgICAvLyBNaXJyb3IgeDIgb250byB0b3AtbGVmdCBjb29yZGluYXRlIHN5c3RlbS5cbiAgICAgICAgICB4MiA9IHRleHQxX2xlbmd0aCAtIHgyO1xuICAgICAgICAgIGlmICh4MSA+PSB4Mikge1xuICAgICAgICAgICAgLy8gT3ZlcmxhcCBkZXRlY3RlZC5cbiAgICAgICAgICAgIHJldHVybiBkaWZmX2Jpc2VjdFNwbGl0Xyh0ZXh0MSwgdGV4dDIsIHgxLCB5MSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8vIERpZmYgdG9vayB0b28gbG9uZyBhbmQgaGl0IHRoZSBkZWFkbGluZSBvclxuICAvLyBudW1iZXIgb2YgZGlmZnMgZXF1YWxzIG51bWJlciBvZiBjaGFyYWN0ZXJzLCBubyBjb21tb25hbGl0eSBhdCBhbGwuXG4gIHJldHVybiBbW0RJRkZfREVMRVRFLCB0ZXh0MV0sIFtESUZGX0lOU0VSVCwgdGV4dDJdXTtcbn07XG5cblxuLyoqXG4gKiBHaXZlbiB0aGUgbG9jYXRpb24gb2YgdGhlICdtaWRkbGUgc25ha2UnLCBzcGxpdCB0aGUgZGlmZiBpbiB0d28gcGFydHNcbiAqIGFuZCByZWN1cnNlLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIE9sZCBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIE5ldyBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICogQHBhcmFtIHtudW1iZXJ9IHggSW5kZXggb2Ygc3BsaXQgcG9pbnQgaW4gdGV4dDEuXG4gKiBAcGFyYW0ge251bWJlcn0geSBJbmRleCBvZiBzcGxpdCBwb2ludCBpbiB0ZXh0Mi5cbiAqIEByZXR1cm4ge0FycmF5fSBBcnJheSBvZiBkaWZmIHR1cGxlcy5cbiAqL1xuZnVuY3Rpb24gZGlmZl9iaXNlY3RTcGxpdF8odGV4dDEsIHRleHQyLCB4LCB5KSB7XG4gIHZhciB0ZXh0MWEgPSB0ZXh0MS5zdWJzdHJpbmcoMCwgeCk7XG4gIHZhciB0ZXh0MmEgPSB0ZXh0Mi5zdWJzdHJpbmcoMCwgeSk7XG4gIHZhciB0ZXh0MWIgPSB0ZXh0MS5zdWJzdHJpbmcoeCk7XG4gIHZhciB0ZXh0MmIgPSB0ZXh0Mi5zdWJzdHJpbmcoeSk7XG5cbiAgLy8gQ29tcHV0ZSBib3RoIGRpZmZzIHNlcmlhbGx5LlxuICB2YXIgZGlmZnMgPSBkaWZmX21haW4odGV4dDFhLCB0ZXh0MmEpO1xuICB2YXIgZGlmZnNiID0gZGlmZl9tYWluKHRleHQxYiwgdGV4dDJiKTtcblxuICByZXR1cm4gZGlmZnMuY29uY2F0KGRpZmZzYik7XG59O1xuXG5cbi8qKlxuICogRGV0ZXJtaW5lIHRoZSBjb21tb24gcHJlZml4IG9mIHR3byBzdHJpbmdzLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIEZpcnN0IHN0cmluZy5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBTZWNvbmQgc3RyaW5nLlxuICogQHJldHVybiB7bnVtYmVyfSBUaGUgbnVtYmVyIG9mIGNoYXJhY3RlcnMgY29tbW9uIHRvIHRoZSBzdGFydCBvZiBlYWNoXG4gKiAgICAgc3RyaW5nLlxuICovXG5mdW5jdGlvbiBkaWZmX2NvbW1vblByZWZpeCh0ZXh0MSwgdGV4dDIpIHtcbiAgLy8gUXVpY2sgY2hlY2sgZm9yIGNvbW1vbiBudWxsIGNhc2VzLlxuICBpZiAoIXRleHQxIHx8ICF0ZXh0MiB8fCB0ZXh0MS5jaGFyQXQoMCkgIT0gdGV4dDIuY2hhckF0KDApKSB7XG4gICAgcmV0dXJuIDA7XG4gIH1cbiAgLy8gQmluYXJ5IHNlYXJjaC5cbiAgLy8gUGVyZm9ybWFuY2UgYW5hbHlzaXM6IGh0dHA6Ly9uZWlsLmZyYXNlci5uYW1lL25ld3MvMjAwNy8xMC8wOS9cbiAgdmFyIHBvaW50ZXJtaW4gPSAwO1xuICB2YXIgcG9pbnRlcm1heCA9IE1hdGgubWluKHRleHQxLmxlbmd0aCwgdGV4dDIubGVuZ3RoKTtcbiAgdmFyIHBvaW50ZXJtaWQgPSBwb2ludGVybWF4O1xuICB2YXIgcG9pbnRlcnN0YXJ0ID0gMDtcbiAgd2hpbGUgKHBvaW50ZXJtaW4gPCBwb2ludGVybWlkKSB7XG4gICAgaWYgKHRleHQxLnN1YnN0cmluZyhwb2ludGVyc3RhcnQsIHBvaW50ZXJtaWQpID09XG4gICAgICAgIHRleHQyLnN1YnN0cmluZyhwb2ludGVyc3RhcnQsIHBvaW50ZXJtaWQpKSB7XG4gICAgICBwb2ludGVybWluID0gcG9pbnRlcm1pZDtcbiAgICAgIHBvaW50ZXJzdGFydCA9IHBvaW50ZXJtaW47XG4gICAgfSBlbHNlIHtcbiAgICAgIHBvaW50ZXJtYXggPSBwb2ludGVybWlkO1xuICAgIH1cbiAgICBwb2ludGVybWlkID0gTWF0aC5mbG9vcigocG9pbnRlcm1heCAtIHBvaW50ZXJtaW4pIC8gMiArIHBvaW50ZXJtaW4pO1xuICB9XG4gIHJldHVybiBwb2ludGVybWlkO1xufTtcblxuXG4vKipcbiAqIERldGVybWluZSB0aGUgY29tbW9uIHN1ZmZpeCBvZiB0d28gc3RyaW5ncy5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBGaXJzdCBzdHJpbmcuXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgU2Vjb25kIHN0cmluZy5cbiAqIEByZXR1cm4ge251bWJlcn0gVGhlIG51bWJlciBvZiBjaGFyYWN0ZXJzIGNvbW1vbiB0byB0aGUgZW5kIG9mIGVhY2ggc3RyaW5nLlxuICovXG5mdW5jdGlvbiBkaWZmX2NvbW1vblN1ZmZpeCh0ZXh0MSwgdGV4dDIpIHtcbiAgLy8gUXVpY2sgY2hlY2sgZm9yIGNvbW1vbiBudWxsIGNhc2VzLlxuICBpZiAoIXRleHQxIHx8ICF0ZXh0MiB8fFxuICAgICAgdGV4dDEuY2hhckF0KHRleHQxLmxlbmd0aCAtIDEpICE9IHRleHQyLmNoYXJBdCh0ZXh0Mi5sZW5ndGggLSAxKSkge1xuICAgIHJldHVybiAwO1xuICB9XG4gIC8vIEJpbmFyeSBzZWFyY2guXG4gIC8vIFBlcmZvcm1hbmNlIGFuYWx5c2lzOiBodHRwOi8vbmVpbC5mcmFzZXIubmFtZS9uZXdzLzIwMDcvMTAvMDkvXG4gIHZhciBwb2ludGVybWluID0gMDtcbiAgdmFyIHBvaW50ZXJtYXggPSBNYXRoLm1pbih0ZXh0MS5sZW5ndGgsIHRleHQyLmxlbmd0aCk7XG4gIHZhciBwb2ludGVybWlkID0gcG9pbnRlcm1heDtcbiAgdmFyIHBvaW50ZXJlbmQgPSAwO1xuICB3aGlsZSAocG9pbnRlcm1pbiA8IHBvaW50ZXJtaWQpIHtcbiAgICBpZiAodGV4dDEuc3Vic3RyaW5nKHRleHQxLmxlbmd0aCAtIHBvaW50ZXJtaWQsIHRleHQxLmxlbmd0aCAtIHBvaW50ZXJlbmQpID09XG4gICAgICAgIHRleHQyLnN1YnN0cmluZyh0ZXh0Mi5sZW5ndGggLSBwb2ludGVybWlkLCB0ZXh0Mi5sZW5ndGggLSBwb2ludGVyZW5kKSkge1xuICAgICAgcG9pbnRlcm1pbiA9IHBvaW50ZXJtaWQ7XG4gICAgICBwb2ludGVyZW5kID0gcG9pbnRlcm1pbjtcbiAgICB9IGVsc2Uge1xuICAgICAgcG9pbnRlcm1heCA9IHBvaW50ZXJtaWQ7XG4gICAgfVxuICAgIHBvaW50ZXJtaWQgPSBNYXRoLmZsb29yKChwb2ludGVybWF4IC0gcG9pbnRlcm1pbikgLyAyICsgcG9pbnRlcm1pbik7XG4gIH1cbiAgcmV0dXJuIHBvaW50ZXJtaWQ7XG59O1xuXG5cbi8qKlxuICogRG8gdGhlIHR3byB0ZXh0cyBzaGFyZSBhIHN1YnN0cmluZyB3aGljaCBpcyBhdCBsZWFzdCBoYWxmIHRoZSBsZW5ndGggb2YgdGhlXG4gKiBsb25nZXIgdGV4dD9cbiAqIFRoaXMgc3BlZWR1cCBjYW4gcHJvZHVjZSBub24tbWluaW1hbCBkaWZmcy5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBGaXJzdCBzdHJpbmcuXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgU2Vjb25kIHN0cmluZy5cbiAqIEByZXR1cm4ge0FycmF5LjxzdHJpbmc+fSBGaXZlIGVsZW1lbnQgQXJyYXksIGNvbnRhaW5pbmcgdGhlIHByZWZpeCBvZlxuICogICAgIHRleHQxLCB0aGUgc3VmZml4IG9mIHRleHQxLCB0aGUgcHJlZml4IG9mIHRleHQyLCB0aGUgc3VmZml4IG9mXG4gKiAgICAgdGV4dDIgYW5kIHRoZSBjb21tb24gbWlkZGxlLiAgT3IgbnVsbCBpZiB0aGVyZSB3YXMgbm8gbWF0Y2guXG4gKi9cbmZ1bmN0aW9uIGRpZmZfaGFsZk1hdGNoXyh0ZXh0MSwgdGV4dDIpIHtcbiAgdmFyIGxvbmd0ZXh0ID0gdGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoID8gdGV4dDEgOiB0ZXh0MjtcbiAgdmFyIHNob3J0dGV4dCA9IHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCA/IHRleHQyIDogdGV4dDE7XG4gIGlmIChsb25ndGV4dC5sZW5ndGggPCA0IHx8IHNob3J0dGV4dC5sZW5ndGggKiAyIDwgbG9uZ3RleHQubGVuZ3RoKSB7XG4gICAgcmV0dXJuIG51bGw7ICAvLyBQb2ludGxlc3MuXG4gIH1cblxuICAvKipcbiAgICogRG9lcyBhIHN1YnN0cmluZyBvZiBzaG9ydHRleHQgZXhpc3Qgd2l0aGluIGxvbmd0ZXh0IHN1Y2ggdGhhdCB0aGUgc3Vic3RyaW5nXG4gICAqIGlzIGF0IGxlYXN0IGhhbGYgdGhlIGxlbmd0aCBvZiBsb25ndGV4dD9cbiAgICogQ2xvc3VyZSwgYnV0IGRvZXMgbm90IHJlZmVyZW5jZSBhbnkgZXh0ZXJuYWwgdmFyaWFibGVzLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbG9uZ3RleHQgTG9uZ2VyIHN0cmluZy5cbiAgICogQHBhcmFtIHtzdHJpbmd9IHNob3J0dGV4dCBTaG9ydGVyIHN0cmluZy5cbiAgICogQHBhcmFtIHtudW1iZXJ9IGkgU3RhcnQgaW5kZXggb2YgcXVhcnRlciBsZW5ndGggc3Vic3RyaW5nIHdpdGhpbiBsb25ndGV4dC5cbiAgICogQHJldHVybiB7QXJyYXkuPHN0cmluZz59IEZpdmUgZWxlbWVudCBBcnJheSwgY29udGFpbmluZyB0aGUgcHJlZml4IG9mXG4gICAqICAgICBsb25ndGV4dCwgdGhlIHN1ZmZpeCBvZiBsb25ndGV4dCwgdGhlIHByZWZpeCBvZiBzaG9ydHRleHQsIHRoZSBzdWZmaXhcbiAgICogICAgIG9mIHNob3J0dGV4dCBhbmQgdGhlIGNvbW1vbiBtaWRkbGUuICBPciBudWxsIGlmIHRoZXJlIHdhcyBubyBtYXRjaC5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIGZ1bmN0aW9uIGRpZmZfaGFsZk1hdGNoSV8obG9uZ3RleHQsIHNob3J0dGV4dCwgaSkge1xuICAgIC8vIFN0YXJ0IHdpdGggYSAxLzQgbGVuZ3RoIHN1YnN0cmluZyBhdCBwb3NpdGlvbiBpIGFzIGEgc2VlZC5cbiAgICB2YXIgc2VlZCA9IGxvbmd0ZXh0LnN1YnN0cmluZyhpLCBpICsgTWF0aC5mbG9vcihsb25ndGV4dC5sZW5ndGggLyA0KSk7XG4gICAgdmFyIGogPSAtMTtcbiAgICB2YXIgYmVzdF9jb21tb24gPSAnJztcbiAgICB2YXIgYmVzdF9sb25ndGV4dF9hLCBiZXN0X2xvbmd0ZXh0X2IsIGJlc3Rfc2hvcnR0ZXh0X2EsIGJlc3Rfc2hvcnR0ZXh0X2I7XG4gICAgd2hpbGUgKChqID0gc2hvcnR0ZXh0LmluZGV4T2Yoc2VlZCwgaiArIDEpKSAhPSAtMSkge1xuICAgICAgdmFyIHByZWZpeExlbmd0aCA9IGRpZmZfY29tbW9uUHJlZml4KGxvbmd0ZXh0LnN1YnN0cmluZyhpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaG9ydHRleHQuc3Vic3RyaW5nKGopKTtcbiAgICAgIHZhciBzdWZmaXhMZW5ndGggPSBkaWZmX2NvbW1vblN1ZmZpeChsb25ndGV4dC5zdWJzdHJpbmcoMCwgaSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hvcnR0ZXh0LnN1YnN0cmluZygwLCBqKSk7XG4gICAgICBpZiAoYmVzdF9jb21tb24ubGVuZ3RoIDwgc3VmZml4TGVuZ3RoICsgcHJlZml4TGVuZ3RoKSB7XG4gICAgICAgIGJlc3RfY29tbW9uID0gc2hvcnR0ZXh0LnN1YnN0cmluZyhqIC0gc3VmZml4TGVuZ3RoLCBqKSArXG4gICAgICAgICAgICBzaG9ydHRleHQuc3Vic3RyaW5nKGosIGogKyBwcmVmaXhMZW5ndGgpO1xuICAgICAgICBiZXN0X2xvbmd0ZXh0X2EgPSBsb25ndGV4dC5zdWJzdHJpbmcoMCwgaSAtIHN1ZmZpeExlbmd0aCk7XG4gICAgICAgIGJlc3RfbG9uZ3RleHRfYiA9IGxvbmd0ZXh0LnN1YnN0cmluZyhpICsgcHJlZml4TGVuZ3RoKTtcbiAgICAgICAgYmVzdF9zaG9ydHRleHRfYSA9IHNob3J0dGV4dC5zdWJzdHJpbmcoMCwgaiAtIHN1ZmZpeExlbmd0aCk7XG4gICAgICAgIGJlc3Rfc2hvcnR0ZXh0X2IgPSBzaG9ydHRleHQuc3Vic3RyaW5nKGogKyBwcmVmaXhMZW5ndGgpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoYmVzdF9jb21tb24ubGVuZ3RoICogMiA+PSBsb25ndGV4dC5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBbYmVzdF9sb25ndGV4dF9hLCBiZXN0X2xvbmd0ZXh0X2IsXG4gICAgICAgICAgICAgIGJlc3Rfc2hvcnR0ZXh0X2EsIGJlc3Rfc2hvcnR0ZXh0X2IsIGJlc3RfY29tbW9uXTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gRmlyc3QgY2hlY2sgaWYgdGhlIHNlY29uZCBxdWFydGVyIGlzIHRoZSBzZWVkIGZvciBhIGhhbGYtbWF0Y2guXG4gIHZhciBobTEgPSBkaWZmX2hhbGZNYXRjaElfKGxvbmd0ZXh0LCBzaG9ydHRleHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGguY2VpbChsb25ndGV4dC5sZW5ndGggLyA0KSk7XG4gIC8vIENoZWNrIGFnYWluIGJhc2VkIG9uIHRoZSB0aGlyZCBxdWFydGVyLlxuICB2YXIgaG0yID0gZGlmZl9oYWxmTWF0Y2hJXyhsb25ndGV4dCwgc2hvcnR0ZXh0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLmNlaWwobG9uZ3RleHQubGVuZ3RoIC8gMikpO1xuICB2YXIgaG07XG4gIGlmICghaG0xICYmICFobTIpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSBlbHNlIGlmICghaG0yKSB7XG4gICAgaG0gPSBobTE7XG4gIH0gZWxzZSBpZiAoIWhtMSkge1xuICAgIGhtID0gaG0yO1xuICB9IGVsc2Uge1xuICAgIC8vIEJvdGggbWF0Y2hlZC4gIFNlbGVjdCB0aGUgbG9uZ2VzdC5cbiAgICBobSA9IGhtMVs0XS5sZW5ndGggPiBobTJbNF0ubGVuZ3RoID8gaG0xIDogaG0yO1xuICB9XG5cbiAgLy8gQSBoYWxmLW1hdGNoIHdhcyBmb3VuZCwgc29ydCBvdXQgdGhlIHJldHVybiBkYXRhLlxuICB2YXIgdGV4dDFfYSwgdGV4dDFfYiwgdGV4dDJfYSwgdGV4dDJfYjtcbiAgaWYgKHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCkge1xuICAgIHRleHQxX2EgPSBobVswXTtcbiAgICB0ZXh0MV9iID0gaG1bMV07XG4gICAgdGV4dDJfYSA9IGhtWzJdO1xuICAgIHRleHQyX2IgPSBobVszXTtcbiAgfSBlbHNlIHtcbiAgICB0ZXh0Ml9hID0gaG1bMF07XG4gICAgdGV4dDJfYiA9IGhtWzFdO1xuICAgIHRleHQxX2EgPSBobVsyXTtcbiAgICB0ZXh0MV9iID0gaG1bM107XG4gIH1cbiAgdmFyIG1pZF9jb21tb24gPSBobVs0XTtcbiAgcmV0dXJuIFt0ZXh0MV9hLCB0ZXh0MV9iLCB0ZXh0Ml9hLCB0ZXh0Ml9iLCBtaWRfY29tbW9uXTtcbn07XG5cblxuLyoqXG4gKiBSZW9yZGVyIGFuZCBtZXJnZSBsaWtlIGVkaXQgc2VjdGlvbnMuICBNZXJnZSBlcXVhbGl0aWVzLlxuICogQW55IGVkaXQgc2VjdGlvbiBjYW4gbW92ZSBhcyBsb25nIGFzIGl0IGRvZXNuJ3QgY3Jvc3MgYW4gZXF1YWxpdHkuXG4gKiBAcGFyYW0ge0FycmF5fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlcy5cbiAqL1xuZnVuY3Rpb24gZGlmZl9jbGVhbnVwTWVyZ2UoZGlmZnMpIHtcbiAgZGlmZnMucHVzaChbRElGRl9FUVVBTCwgJyddKTsgIC8vIEFkZCBhIGR1bW15IGVudHJ5IGF0IHRoZSBlbmQuXG4gIHZhciBwb2ludGVyID0gMDtcbiAgdmFyIGNvdW50X2RlbGV0ZSA9IDA7XG4gIHZhciBjb3VudF9pbnNlcnQgPSAwO1xuICB2YXIgdGV4dF9kZWxldGUgPSAnJztcbiAgdmFyIHRleHRfaW5zZXJ0ID0gJyc7XG4gIHZhciBjb21tb25sZW5ndGg7XG4gIHdoaWxlIChwb2ludGVyIDwgZGlmZnMubGVuZ3RoKSB7XG4gICAgc3dpdGNoIChkaWZmc1twb2ludGVyXVswXSkge1xuICAgICAgY2FzZSBESUZGX0lOU0VSVDpcbiAgICAgICAgY291bnRfaW5zZXJ0Kys7XG4gICAgICAgIHRleHRfaW5zZXJ0ICs9IGRpZmZzW3BvaW50ZXJdWzFdO1xuICAgICAgICBwb2ludGVyKys7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBESUZGX0RFTEVURTpcbiAgICAgICAgY291bnRfZGVsZXRlKys7XG4gICAgICAgIHRleHRfZGVsZXRlICs9IGRpZmZzW3BvaW50ZXJdWzFdO1xuICAgICAgICBwb2ludGVyKys7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBESUZGX0VRVUFMOlxuICAgICAgICAvLyBVcG9uIHJlYWNoaW5nIGFuIGVxdWFsaXR5LCBjaGVjayBmb3IgcHJpb3IgcmVkdW5kYW5jaWVzLlxuICAgICAgICBpZiAoY291bnRfZGVsZXRlICsgY291bnRfaW5zZXJ0ID4gMSkge1xuICAgICAgICAgIGlmIChjb3VudF9kZWxldGUgIT09IDAgJiYgY291bnRfaW5zZXJ0ICE9PSAwKSB7XG4gICAgICAgICAgICAvLyBGYWN0b3Igb3V0IGFueSBjb21tb24gcHJlZml4aWVzLlxuICAgICAgICAgICAgY29tbW9ubGVuZ3RoID0gZGlmZl9jb21tb25QcmVmaXgodGV4dF9pbnNlcnQsIHRleHRfZGVsZXRlKTtcbiAgICAgICAgICAgIGlmIChjb21tb25sZW5ndGggIT09IDApIHtcbiAgICAgICAgICAgICAgaWYgKChwb2ludGVyIC0gY291bnRfZGVsZXRlIC0gY291bnRfaW5zZXJ0KSA+IDAgJiZcbiAgICAgICAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSBjb3VudF9kZWxldGUgLSBjb3VudF9pbnNlcnQgLSAxXVswXSA9PVxuICAgICAgICAgICAgICAgICAgRElGRl9FUVVBTCkge1xuICAgICAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSBjb3VudF9kZWxldGUgLSBjb3VudF9pbnNlcnQgLSAxXVsxXSArPVxuICAgICAgICAgICAgICAgICAgICB0ZXh0X2luc2VydC5zdWJzdHJpbmcoMCwgY29tbW9ubGVuZ3RoKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkaWZmcy5zcGxpY2UoMCwgMCwgW0RJRkZfRVFVQUwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0X2luc2VydC5zdWJzdHJpbmcoMCwgY29tbW9ubGVuZ3RoKV0pO1xuICAgICAgICAgICAgICAgIHBvaW50ZXIrKztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB0ZXh0X2luc2VydCA9IHRleHRfaW5zZXJ0LnN1YnN0cmluZyhjb21tb25sZW5ndGgpO1xuICAgICAgICAgICAgICB0ZXh0X2RlbGV0ZSA9IHRleHRfZGVsZXRlLnN1YnN0cmluZyhjb21tb25sZW5ndGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gRmFjdG9yIG91dCBhbnkgY29tbW9uIHN1ZmZpeGllcy5cbiAgICAgICAgICAgIGNvbW1vbmxlbmd0aCA9IGRpZmZfY29tbW9uU3VmZml4KHRleHRfaW5zZXJ0LCB0ZXh0X2RlbGV0ZSk7XG4gICAgICAgICAgICBpZiAoY29tbW9ubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgICAgICAgIGRpZmZzW3BvaW50ZXJdWzFdID0gdGV4dF9pbnNlcnQuc3Vic3RyaW5nKHRleHRfaW5zZXJ0Lmxlbmd0aCAtXG4gICAgICAgICAgICAgICAgICBjb21tb25sZW5ndGgpICsgZGlmZnNbcG9pbnRlcl1bMV07XG4gICAgICAgICAgICAgIHRleHRfaW5zZXJ0ID0gdGV4dF9pbnNlcnQuc3Vic3RyaW5nKDAsIHRleHRfaW5zZXJ0Lmxlbmd0aCAtXG4gICAgICAgICAgICAgICAgICBjb21tb25sZW5ndGgpO1xuICAgICAgICAgICAgICB0ZXh0X2RlbGV0ZSA9IHRleHRfZGVsZXRlLnN1YnN0cmluZygwLCB0ZXh0X2RlbGV0ZS5sZW5ndGggLVxuICAgICAgICAgICAgICAgICAgY29tbW9ubGVuZ3RoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gRGVsZXRlIHRoZSBvZmZlbmRpbmcgcmVjb3JkcyBhbmQgYWRkIHRoZSBtZXJnZWQgb25lcy5cbiAgICAgICAgICBpZiAoY291bnRfZGVsZXRlID09PSAwKSB7XG4gICAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciAtIGNvdW50X2luc2VydCxcbiAgICAgICAgICAgICAgICBjb3VudF9kZWxldGUgKyBjb3VudF9pbnNlcnQsIFtESUZGX0lOU0VSVCwgdGV4dF9pbnNlcnRdKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGNvdW50X2luc2VydCA9PT0gMCkge1xuICAgICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgLSBjb3VudF9kZWxldGUsXG4gICAgICAgICAgICAgICAgY291bnRfZGVsZXRlICsgY291bnRfaW5zZXJ0LCBbRElGRl9ERUxFVEUsIHRleHRfZGVsZXRlXSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyIC0gY291bnRfZGVsZXRlIC0gY291bnRfaW5zZXJ0LFxuICAgICAgICAgICAgICAgIGNvdW50X2RlbGV0ZSArIGNvdW50X2luc2VydCwgW0RJRkZfREVMRVRFLCB0ZXh0X2RlbGV0ZV0sXG4gICAgICAgICAgICAgICAgW0RJRkZfSU5TRVJULCB0ZXh0X2luc2VydF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBwb2ludGVyID0gcG9pbnRlciAtIGNvdW50X2RlbGV0ZSAtIGNvdW50X2luc2VydCArXG4gICAgICAgICAgICAgICAgICAgIChjb3VudF9kZWxldGUgPyAxIDogMCkgKyAoY291bnRfaW5zZXJ0ID8gMSA6IDApICsgMTtcbiAgICAgICAgfSBlbHNlIGlmIChwb2ludGVyICE9PSAwICYmIGRpZmZzW3BvaW50ZXIgLSAxXVswXSA9PSBESUZGX0VRVUFMKSB7XG4gICAgICAgICAgLy8gTWVyZ2UgdGhpcyBlcXVhbGl0eSB3aXRoIHRoZSBwcmV2aW91cyBvbmUuXG4gICAgICAgICAgZGlmZnNbcG9pbnRlciAtIDFdWzFdICs9IGRpZmZzW3BvaW50ZXJdWzFdO1xuICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyLCAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwb2ludGVyKys7XG4gICAgICAgIH1cbiAgICAgICAgY291bnRfaW5zZXJ0ID0gMDtcbiAgICAgICAgY291bnRfZGVsZXRlID0gMDtcbiAgICAgICAgdGV4dF9kZWxldGUgPSAnJztcbiAgICAgICAgdGV4dF9pbnNlcnQgPSAnJztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIGlmIChkaWZmc1tkaWZmcy5sZW5ndGggLSAxXVsxXSA9PT0gJycpIHtcbiAgICBkaWZmcy5wb3AoKTsgIC8vIFJlbW92ZSB0aGUgZHVtbXkgZW50cnkgYXQgdGhlIGVuZC5cbiAgfVxuXG4gIC8vIFNlY29uZCBwYXNzOiBsb29rIGZvciBzaW5nbGUgZWRpdHMgc3Vycm91bmRlZCBvbiBib3RoIHNpZGVzIGJ5IGVxdWFsaXRpZXNcbiAgLy8gd2hpY2ggY2FuIGJlIHNoaWZ0ZWQgc2lkZXdheXMgdG8gZWxpbWluYXRlIGFuIGVxdWFsaXR5LlxuICAvLyBlLmc6IEE8aW5zPkJBPC9pbnM+QyAtPiA8aW5zPkFCPC9pbnM+QUNcbiAgdmFyIGNoYW5nZXMgPSBmYWxzZTtcbiAgcG9pbnRlciA9IDE7XG4gIC8vIEludGVudGlvbmFsbHkgaWdub3JlIHRoZSBmaXJzdCBhbmQgbGFzdCBlbGVtZW50IChkb24ndCBuZWVkIGNoZWNraW5nKS5cbiAgd2hpbGUgKHBvaW50ZXIgPCBkaWZmcy5sZW5ndGggLSAxKSB7XG4gICAgaWYgKGRpZmZzW3BvaW50ZXIgLSAxXVswXSA9PSBESUZGX0VRVUFMICYmXG4gICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVswXSA9PSBESUZGX0VRVUFMKSB7XG4gICAgICAvLyBUaGlzIGlzIGEgc2luZ2xlIGVkaXQgc3Vycm91bmRlZCBieSBlcXVhbGl0aWVzLlxuICAgICAgaWYgKGRpZmZzW3BvaW50ZXJdWzFdLnN1YnN0cmluZyhkaWZmc1twb2ludGVyXVsxXS5sZW5ndGggLVxuICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSAxXVsxXS5sZW5ndGgpID09IGRpZmZzW3BvaW50ZXIgLSAxXVsxXSkge1xuICAgICAgICAvLyBTaGlmdCB0aGUgZWRpdCBvdmVyIHRoZSBwcmV2aW91cyBlcXVhbGl0eS5cbiAgICAgICAgZGlmZnNbcG9pbnRlcl1bMV0gPSBkaWZmc1twb2ludGVyIC0gMV1bMV0gK1xuICAgICAgICAgICAgZGlmZnNbcG9pbnRlcl1bMV0uc3Vic3RyaW5nKDAsIGRpZmZzW3BvaW50ZXJdWzFdLmxlbmd0aCAtXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlmZnNbcG9pbnRlciAtIDFdWzFdLmxlbmd0aCk7XG4gICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVsxXSA9IGRpZmZzW3BvaW50ZXIgLSAxXVsxXSArIGRpZmZzW3BvaW50ZXIgKyAxXVsxXTtcbiAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgLSAxLCAxKTtcbiAgICAgICAgY2hhbmdlcyA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKGRpZmZzW3BvaW50ZXJdWzFdLnN1YnN0cmluZygwLCBkaWZmc1twb2ludGVyICsgMV1bMV0ubGVuZ3RoKSA9PVxuICAgICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVsxXSkge1xuICAgICAgICAvLyBTaGlmdCB0aGUgZWRpdCBvdmVyIHRoZSBuZXh0IGVxdWFsaXR5LlxuICAgICAgICBkaWZmc1twb2ludGVyIC0gMV1bMV0gKz0gZGlmZnNbcG9pbnRlciArIDFdWzFdO1xuICAgICAgICBkaWZmc1twb2ludGVyXVsxXSA9XG4gICAgICAgICAgICBkaWZmc1twb2ludGVyXVsxXS5zdWJzdHJpbmcoZGlmZnNbcG9pbnRlciArIDFdWzFdLmxlbmd0aCkgK1xuICAgICAgICAgICAgZGlmZnNbcG9pbnRlciArIDFdWzFdO1xuICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciArIDEsIDEpO1xuICAgICAgICBjaGFuZ2VzID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcG9pbnRlcisrO1xuICB9XG4gIC8vIElmIHNoaWZ0cyB3ZXJlIG1hZGUsIHRoZSBkaWZmIG5lZWRzIHJlb3JkZXJpbmcgYW5kIGFub3RoZXIgc2hpZnQgc3dlZXAuXG4gIGlmIChjaGFuZ2VzKSB7XG4gICAgZGlmZl9jbGVhbnVwTWVyZ2UoZGlmZnMpO1xuICB9XG59O1xuXG5cbnZhciBkaWZmID0gZGlmZl9tYWluO1xuZGlmZi5JTlNFUlQgPSBESUZGX0lOU0VSVDtcbmRpZmYuREVMRVRFID0gRElGRl9ERUxFVEU7XG5kaWZmLkVRVUFMID0gRElGRl9FUVVBTDtcblxubW9kdWxlLmV4cG9ydHMgPSBkaWZmO1xuXG4vKlxuICogTW9kaWZ5IGEgZGlmZiBzdWNoIHRoYXQgdGhlIGN1cnNvciBwb3NpdGlvbiBwb2ludHMgdG8gdGhlIHN0YXJ0IG9mIGEgY2hhbmdlOlxuICogRS5nLlxuICogICBjdXJzb3Jfbm9ybWFsaXplX2RpZmYoW1tESUZGX0VRVUFMLCAnYWJjJ11dLCAxKVxuICogICAgID0+IFsxLCBbW0RJRkZfRVFVQUwsICdhJ10sIFtESUZGX0VRVUFMLCAnYmMnXV1dXG4gKiAgIGN1cnNvcl9ub3JtYWxpemVfZGlmZihbW0RJRkZfSU5TRVJULCAnbmV3J10sIFtESUZGX0RFTEVURSwgJ3h5eiddXSwgMilcbiAqICAgICA9PiBbMiwgW1tESUZGX0lOU0VSVCwgJ25ldyddLCBbRElGRl9ERUxFVEUsICd4eSddLCBbRElGRl9ERUxFVEUsICd6J11dXVxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IGRpZmZzIEFycmF5IG9mIGRpZmYgdHVwbGVzXG4gKiBAcGFyYW0ge0ludH0gY3Vyc29yX3BvcyBTdWdnZXN0ZWQgZWRpdCBwb3NpdGlvbi4gTXVzdCBub3QgYmUgb3V0IG9mIGJvdW5kcyFcbiAqIEByZXR1cm4ge0FycmF5fSBBIHR1cGxlIFtjdXJzb3IgbG9jYXRpb24gaW4gdGhlIG1vZGlmaWVkIGRpZmYsIG1vZGlmaWVkIGRpZmZdXG4gKi9cbmZ1bmN0aW9uIGN1cnNvcl9ub3JtYWxpemVfZGlmZiAoZGlmZnMsIGN1cnNvcl9wb3MpIHtcbiAgaWYgKGN1cnNvcl9wb3MgPT09IDApIHtcbiAgICByZXR1cm4gW0RJRkZfRVFVQUwsIGRpZmZzXTtcbiAgfVxuICBmb3IgKHZhciBjdXJyZW50X3BvcyA9IDAsIGkgPSAwOyBpIDwgZGlmZnMubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgZCA9IGRpZmZzW2ldO1xuICAgIGlmIChkWzBdID09PSBESUZGX0RFTEVURSB8fCBkWzBdID09PSBESUZGX0VRVUFMKSB7XG4gICAgICB2YXIgbmV4dF9wb3MgPSBjdXJyZW50X3BvcyArIGRbMV0ubGVuZ3RoO1xuICAgICAgaWYgKGN1cnNvcl9wb3MgPT09IG5leHRfcG9zKSB7XG4gICAgICAgIHJldHVybiBbaSArIDEsIGRpZmZzXTtcbiAgICAgIH0gZWxzZSBpZiAoY3Vyc29yX3BvcyA8IG5leHRfcG9zKSB7XG4gICAgICAgIC8vIGNvcHkgdG8gcHJldmVudCBzaWRlIGVmZmVjdHNcbiAgICAgICAgZGlmZnMgPSBkaWZmcy5zbGljZSgpO1xuICAgICAgICAvLyBzcGxpdCBkIGludG8gdHdvIGRpZmYgY2hhbmdlc1xuICAgICAgICB2YXIgc3BsaXRfcG9zID0gY3Vyc29yX3BvcyAtIGN1cnJlbnRfcG9zO1xuICAgICAgICB2YXIgZF9sZWZ0ID0gW2RbMF0sIGRbMV0uc2xpY2UoMCwgc3BsaXRfcG9zKV07XG4gICAgICAgIHZhciBkX3JpZ2h0ID0gW2RbMF0sIGRbMV0uc2xpY2Uoc3BsaXRfcG9zKV07XG4gICAgICAgIGRpZmZzLnNwbGljZShpLCAxLCBkX2xlZnQsIGRfcmlnaHQpO1xuICAgICAgICByZXR1cm4gW2kgKyAxLCBkaWZmc107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjdXJyZW50X3BvcyA9IG5leHRfcG9zO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoJ2N1cnNvcl9wb3MgaXMgb3V0IG9mIGJvdW5kcyEnKVxufVxuXG4vKlxuICogTW9kaWZ5IGEgZGlmZiBzdWNoIHRoYXQgdGhlIGVkaXQgcG9zaXRpb24gaXMgXCJzaGlmdGVkXCIgdG8gdGhlIHByb3Bvc2VkIGVkaXQgbG9jYXRpb24gKGN1cnNvcl9wb3NpdGlvbikuXG4gKlxuICogQ2FzZSAxKVxuICogICBDaGVjayBpZiBhIG5haXZlIHNoaWZ0IGlzIHBvc3NpYmxlOlxuICogICAgIFswLCBYXSwgWyAxLCBZXSAtPiBbIDEsIFldLCBbMCwgWF0gICAgKGlmIFggKyBZID09PSBZICsgWClcbiAqICAgICBbMCwgWF0sIFstMSwgWV0gLT4gWy0xLCBZXSwgWzAsIFhdICAgIChpZiBYICsgWSA9PT0gWSArIFgpIC0gaG9sZHMgc2FtZSByZXN1bHRcbiAqIENhc2UgMilcbiAqICAgQ2hlY2sgaWYgdGhlIGZvbGxvd2luZyBzaGlmdHMgYXJlIHBvc3NpYmxlOlxuICogICAgIFswLCAncHJlJ10sIFsgMSwgJ3ByZWZpeCddIC0+IFsgMSwgJ3ByZSddLCBbMCwgJ3ByZSddLCBbIDEsICdmaXgnXVxuICogICAgIFswLCAncHJlJ10sIFstMSwgJ3ByZWZpeCddIC0+IFstMSwgJ3ByZSddLCBbMCwgJ3ByZSddLCBbLTEsICdmaXgnXVxuICogICAgICAgICBeICAgICAgICAgICAgXlxuICogICAgICAgICBkICAgICAgICAgIGRfbmV4dFxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IGRpZmZzIEFycmF5IG9mIGRpZmYgdHVwbGVzXG4gKiBAcGFyYW0ge0ludH0gY3Vyc29yX3BvcyBTdWdnZXN0ZWQgZWRpdCBwb3NpdGlvbi4gTXVzdCBub3QgYmUgb3V0IG9mIGJvdW5kcyFcbiAqIEByZXR1cm4ge0FycmF5fSBBcnJheSBvZiBkaWZmIHR1cGxlc1xuICovXG5mdW5jdGlvbiBmaXhfY3Vyc29yIChkaWZmcywgY3Vyc29yX3Bvcykge1xuICB2YXIgbm9ybSA9IGN1cnNvcl9ub3JtYWxpemVfZGlmZihkaWZmcywgY3Vyc29yX3Bvcyk7XG4gIHZhciBuZGlmZnMgPSBub3JtWzFdO1xuICB2YXIgY3Vyc29yX3BvaW50ZXIgPSBub3JtWzBdO1xuICB2YXIgZCA9IG5kaWZmc1tjdXJzb3JfcG9pbnRlcl07XG4gIHZhciBkX25leHQgPSBuZGlmZnNbY3Vyc29yX3BvaW50ZXIgKyAxXTtcblxuICBpZiAoZCA9PSBudWxsKSB7XG4gICAgLy8gVGV4dCB3YXMgZGVsZXRlZCBmcm9tIGVuZCBvZiBvcmlnaW5hbCBzdHJpbmcsXG4gICAgLy8gY3Vyc29yIGlzIG5vdyBvdXQgb2YgYm91bmRzIGluIG5ldyBzdHJpbmdcbiAgICByZXR1cm4gZGlmZnM7XG4gIH0gZWxzZSBpZiAoZFswXSAhPT0gRElGRl9FUVVBTCkge1xuICAgIC8vIEEgbW9kaWZpY2F0aW9uIGhhcHBlbmVkIGF0IHRoZSBjdXJzb3IgbG9jYXRpb24uXG4gICAgLy8gVGhpcyBpcyB0aGUgZXhwZWN0ZWQgb3V0Y29tZSwgc28gd2UgY2FuIHJldHVybiB0aGUgb3JpZ2luYWwgZGlmZi5cbiAgICByZXR1cm4gZGlmZnM7XG4gIH0gZWxzZSB7XG4gICAgaWYgKGRfbmV4dCAhPSBudWxsICYmIGRbMV0gKyBkX25leHRbMV0gPT09IGRfbmV4dFsxXSArIGRbMV0pIHtcbiAgICAgIC8vIENhc2UgMSlcbiAgICAgIC8vIEl0IGlzIHBvc3NpYmxlIHRvIHBlcmZvcm0gYSBuYWl2ZSBzaGlmdFxuICAgICAgbmRpZmZzLnNwbGljZShjdXJzb3JfcG9pbnRlciwgMiwgZF9uZXh0LCBkKVxuICAgICAgcmV0dXJuIG1lcmdlX3R1cGxlcyhuZGlmZnMsIGN1cnNvcl9wb2ludGVyLCAyKVxuICAgIH0gZWxzZSBpZiAoZF9uZXh0ICE9IG51bGwgJiYgZF9uZXh0WzFdLmluZGV4T2YoZFsxXSkgPT09IDApIHtcbiAgICAgIC8vIENhc2UgMilcbiAgICAgIC8vIGRbMV0gaXMgYSBwcmVmaXggb2YgZF9uZXh0WzFdXG4gICAgICAvLyBXZSBjYW4gYXNzdW1lIHRoYXQgZF9uZXh0WzBdICE9PSAwLCBzaW5jZSBkWzBdID09PSAwXG4gICAgICAvLyBTaGlmdCBlZGl0IGxvY2F0aW9ucy4uXG4gICAgICBuZGlmZnMuc3BsaWNlKGN1cnNvcl9wb2ludGVyLCAyLCBbZF9uZXh0WzBdLCBkWzFdXSwgWzAsIGRbMV1dKTtcbiAgICAgIHZhciBzdWZmaXggPSBkX25leHRbMV0uc2xpY2UoZFsxXS5sZW5ndGgpO1xuICAgICAgaWYgKHN1ZmZpeC5sZW5ndGggPiAwKSB7XG4gICAgICAgIG5kaWZmcy5zcGxpY2UoY3Vyc29yX3BvaW50ZXIgKyAyLCAwLCBbZF9uZXh0WzBdLCBzdWZmaXhdKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtZXJnZV90dXBsZXMobmRpZmZzLCBjdXJzb3JfcG9pbnRlciwgMylcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm90IHBvc3NpYmxlIHRvIHBlcmZvcm0gYW55IG1vZGlmaWNhdGlvblxuICAgICAgcmV0dXJuIGRpZmZzO1xuICAgIH1cbiAgfVxuXG59XG5cbi8qXG4gKiBUcnkgdG8gbWVyZ2UgdHVwbGVzIHdpdGggdGhlaXIgbmVpZ2JvcnMgaW4gYSBnaXZlbiByYW5nZS5cbiAqIEUuZy4gWzAsICdhJ10sIFswLCAnYiddIC0+IFswLCAnYWInXVxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IGRpZmZzIEFycmF5IG9mIGRpZmYgdHVwbGVzLlxuICogQHBhcmFtIHtJbnR9IHN0YXJ0IFBvc2l0aW9uIG9mIHRoZSBmaXJzdCBlbGVtZW50IHRvIG1lcmdlIChkaWZmc1tzdGFydF0gaXMgYWxzbyBtZXJnZWQgd2l0aCBkaWZmc1tzdGFydCAtIDFdKS5cbiAqIEBwYXJhbSB7SW50fSBsZW5ndGggTnVtYmVyIG9mIGNvbnNlY3V0aXZlIGVsZW1lbnRzIHRvIGNoZWNrLlxuICogQHJldHVybiB7QXJyYXl9IEFycmF5IG9mIG1lcmdlZCBkaWZmIHR1cGxlcy5cbiAqL1xuZnVuY3Rpb24gbWVyZ2VfdHVwbGVzIChkaWZmcywgc3RhcnQsIGxlbmd0aCkge1xuICAvLyBDaGVjayBmcm9tIChzdGFydC0xKSB0byAoc3RhcnQrbGVuZ3RoKS5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0ICsgbGVuZ3RoIC0gMTsgaSA+PSAwICYmIGkgPj0gc3RhcnQgLSAxOyBpLS0pIHtcbiAgICBpZiAoaSArIDEgPCBkaWZmcy5sZW5ndGgpIHtcbiAgICAgIHZhciBsZWZ0X2QgPSBkaWZmc1tpXTtcbiAgICAgIHZhciByaWdodF9kID0gZGlmZnNbaSsxXTtcbiAgICAgIGlmIChsZWZ0X2RbMF0gPT09IHJpZ2h0X2RbMV0pIHtcbiAgICAgICAgZGlmZnMuc3BsaWNlKGksIDIsIFtsZWZ0X2RbMF0sIGxlZnRfZFsxXSArIHJpZ2h0X2RbMV1dKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRpZmZzO1xufVxuIiwiLy8gSVNDIEAgSnVsaWVuIEZvbnRhbmV0XG5cbid1c2Ugc3RyaWN0J1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbnZhciBkZWZpbmVQcm9wZXJ0eSA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0eVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbnZhciBjYXB0dXJlU3RhY2tUcmFjZSA9IEVycm9yLmNhcHR1cmVTdGFja1RyYWNlXG5pZiAoIWNhcHR1cmVTdGFja1RyYWNlKSB7XG4gIGNhcHR1cmVTdGFja1RyYWNlID0gZnVuY3Rpb24gY2FwdHVyZVN0YWNrVHJhY2UgKGVycm9yKSB7XG4gICAgdmFyIGNvbnRhaW5lciA9IG5ldyBFcnJvcigpXG5cbiAgICBkZWZpbmVQcm9wZXJ0eShlcnJvciwgJ3N0YWNrJywge1xuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgZ2V0OiBmdW5jdGlvbiBnZXRTdGFjayAoKSB7XG4gICAgICAgIHZhciBzdGFjayA9IGNvbnRhaW5lci5zdGFja1xuXG4gICAgICAgIC8vIFJlcGxhY2UgcHJvcGVydHkgd2l0aCB2YWx1ZSBmb3IgZmFzdGVyIGZ1dHVyZSBhY2Nlc3Nlcy5cbiAgICAgICAgZGVmaW5lUHJvcGVydHkodGhpcywgJ3N0YWNrJywge1xuICAgICAgICAgIHZhbHVlOiBzdGFja1xuICAgICAgICB9KVxuXG4gICAgICAgIHJldHVybiBzdGFja1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24gc2V0U3RhY2sgKHN0YWNrKSB7XG4gICAgICAgIGRlZmluZVByb3BlcnR5KGVycm9yLCAnc3RhY2snLCB7XG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgIHZhbHVlOiBzdGFjayxcbiAgICAgICAgICB3cml0YWJsZTogdHJ1ZVxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH0pXG4gIH1cbn1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5mdW5jdGlvbiBCYXNlRXJyb3IgKG1lc3NhZ2UpIHtcbiAgaWYgKG1lc3NhZ2UpIHtcbiAgICBkZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbWVzc2FnZScsIHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIHZhbHVlOiBtZXNzYWdlLFxuICAgICAgd3JpdGFibGU6IHRydWVcbiAgICB9KVxuICB9XG5cbiAgdmFyIGNuYW1lID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXG4gIGlmIChcbiAgICBjbmFtZSAmJlxuICAgIGNuYW1lICE9PSB0aGlzLm5hbWVcbiAgKSB7XG4gICAgZGVmaW5lUHJvcGVydHkodGhpcywgJ25hbWUnLCB7XG4gICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICB2YWx1ZTogY25hbWUsXG4gICAgICB3cml0YWJsZTogdHJ1ZVxuICAgIH0pXG4gIH1cblxuICBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKVxufVxuXG5CYXNlRXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFcnJvci5wcm90b3R5cGUsIHtcbiAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vSnNDb21tdW5pdHkvbWFrZS1lcnJvci9pc3N1ZXMvNFxuICBjb25zdHJ1Y3Rvcjoge1xuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB2YWx1ZTogQmFzZUVycm9yLFxuICAgIHdyaXRhYmxlOiB0cnVlXG4gIH1cbn0pXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLy8gU2V0cyB0aGUgbmFtZSBvZiBhIGZ1bmN0aW9uIGlmIHBvc3NpYmxlIChkZXBlbmRzIG9mIHRoZSBKUyBlbmdpbmUpLlxudmFyIHNldEZ1bmN0aW9uTmFtZSA9IChmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIHNldEZ1bmN0aW9uTmFtZSAoZm4sIG5hbWUpIHtcbiAgICByZXR1cm4gZGVmaW5lUHJvcGVydHkoZm4sICduYW1lJywge1xuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgdmFsdWU6IG5hbWVcbiAgICB9KVxuICB9XG4gIHRyeSB7XG4gICAgdmFyIGYgPSBmdW5jdGlvbiAoKSB7fVxuICAgIHNldEZ1bmN0aW9uTmFtZShmLCAnZm9vJylcbiAgICBpZiAoZi5uYW1lID09PSAnZm9vJykge1xuICAgICAgcmV0dXJuIHNldEZ1bmN0aW9uTmFtZVxuICAgIH1cbiAgfSBjYXRjaCAoXykge31cbn0pKClcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5mdW5jdGlvbiBtYWtlRXJyb3IgKGNvbnN0cnVjdG9yLCBzdXBlcl8pIHtcbiAgaWYgKHN1cGVyXyA9PSBudWxsIHx8IHN1cGVyXyA9PT0gRXJyb3IpIHtcbiAgICBzdXBlcl8gPSBCYXNlRXJyb3JcbiAgfSBlbHNlIGlmICh0eXBlb2Ygc3VwZXJfICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignc3VwZXJfIHNob3VsZCBiZSBhIGZ1bmN0aW9uJylcbiAgfVxuXG4gIHZhciBuYW1lXG4gIGlmICh0eXBlb2YgY29uc3RydWN0b3IgPT09ICdzdHJpbmcnKSB7XG4gICAgbmFtZSA9IGNvbnN0cnVjdG9yXG4gICAgY29uc3RydWN0b3IgPSBmdW5jdGlvbiAoKSB7IHN1cGVyXy5hcHBseSh0aGlzLCBhcmd1bWVudHMpIH1cblxuICAgIC8vIElmIHRoZSBuYW1lIGNhbiBiZSBzZXQsIGRvIGl0IG9uY2UgYW5kIGZvciBhbGwuXG4gICAgaWYgKHNldEZ1bmN0aW9uTmFtZSkge1xuICAgICAgc2V0RnVuY3Rpb25OYW1lKGNvbnN0cnVjdG9yLCBuYW1lKVxuICAgICAgbmFtZSA9IG51bGxcbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZW9mIGNvbnN0cnVjdG9yICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignY29uc3RydWN0b3Igc2hvdWxkIGJlIGVpdGhlciBhIHN0cmluZyBvciBhIGZ1bmN0aW9uJylcbiAgfVxuXG4gIC8vIEFsc28gcmVnaXN0ZXIgdGhlIHN1cGVyIGNvbnN0cnVjdG9yIGFsc28gYXMgYGNvbnN0cnVjdG9yLnN1cGVyX2AganVzdFxuICAvLyBsaWtlIE5vZGUncyBgdXRpbC5pbmhlcml0cygpYC5cbiAgY29uc3RydWN0b3Iuc3VwZXJfID0gY29uc3RydWN0b3JbJ3N1cGVyJ10gPSBzdXBlcl9cblxuICB2YXIgcHJvcGVydGllcyA9IHtcbiAgICBjb25zdHJ1Y3Rvcjoge1xuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgdmFsdWU6IGNvbnN0cnVjdG9yLFxuICAgICAgd3JpdGFibGU6IHRydWVcbiAgICB9XG4gIH1cblxuICAvLyBJZiB0aGUgbmFtZSBjb3VsZCBub3QgYmUgc2V0IG9uIHRoZSBjb25zdHJ1Y3Rvciwgc2V0IGl0IG9uIHRoZVxuICAvLyBwcm90b3R5cGUuXG4gIGlmIChuYW1lICE9IG51bGwpIHtcbiAgICBwcm9wZXJ0aWVzLm5hbWUgPSB7XG4gICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICB2YWx1ZTogbmFtZSxcbiAgICAgIHdyaXRhYmxlOiB0cnVlXG4gICAgfVxuICB9XG4gIGNvbnN0cnVjdG9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJfLnByb3RvdHlwZSwgcHJvcGVydGllcylcblxuICByZXR1cm4gY29uc3RydWN0b3Jcbn1cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IG1ha2VFcnJvclxuZXhwb3J0cy5CYXNlRXJyb3IgPSBCYXNlRXJyb3JcbiIsIi8vIFRoZXNlIG1ldGhvZHMgbGV0IHlvdSBidWlsZCBhIHRyYW5zZm9ybSBmdW5jdGlvbiBmcm9tIGEgdHJhbnNmb3JtQ29tcG9uZW50XG4vLyBmdW5jdGlvbiBmb3IgT1QgdHlwZXMgbGlrZSBKU09OMCBpbiB3aGljaCBvcGVyYXRpb25zIGFyZSBsaXN0cyBvZiBjb21wb25lbnRzXG4vLyBhbmQgdHJhbnNmb3JtaW5nIHRoZW0gcmVxdWlyZXMgTl4yIHdvcmsuIEkgZmluZCBpdCBraW5kIG9mIG5hc3R5IHRoYXQgSSBuZWVkXG4vLyB0aGlzLCBidXQgSSdtIG5vdCByZWFsbHkgc3VyZSB3aGF0IGEgYmV0dGVyIHNvbHV0aW9uIGlzLiBNYXliZSBJIHNob3VsZCBkb1xuLy8gdGhpcyBhdXRvbWF0aWNhbGx5IHRvIHR5cGVzIHRoYXQgZG9uJ3QgaGF2ZSBhIGNvbXBvc2UgZnVuY3Rpb24gZGVmaW5lZC5cblxuLy8gQWRkIHRyYW5zZm9ybSBhbmQgdHJhbnNmb3JtWCBmdW5jdGlvbnMgZm9yIGFuIE9UIHR5cGUgd2hpY2ggaGFzXG4vLyB0cmFuc2Zvcm1Db21wb25lbnQgZGVmaW5lZC4gIHRyYW5zZm9ybUNvbXBvbmVudChkZXN0aW5hdGlvbiBhcnJheSxcbi8vIGNvbXBvbmVudCwgb3RoZXIgY29tcG9uZW50LCBzaWRlKVxubW9kdWxlLmV4cG9ydHMgPSBib290c3RyYXBUcmFuc2Zvcm1cbmZ1bmN0aW9uIGJvb3RzdHJhcFRyYW5zZm9ybSh0eXBlLCB0cmFuc2Zvcm1Db21wb25lbnQsIGNoZWNrVmFsaWRPcCwgYXBwZW5kKSB7XG4gIHZhciB0cmFuc2Zvcm1Db21wb25lbnRYID0gZnVuY3Rpb24obGVmdCwgcmlnaHQsIGRlc3RMZWZ0LCBkZXN0UmlnaHQpIHtcbiAgICB0cmFuc2Zvcm1Db21wb25lbnQoZGVzdExlZnQsIGxlZnQsIHJpZ2h0LCAnbGVmdCcpO1xuICAgIHRyYW5zZm9ybUNvbXBvbmVudChkZXN0UmlnaHQsIHJpZ2h0LCBsZWZ0LCAncmlnaHQnKTtcbiAgfTtcblxuICB2YXIgdHJhbnNmb3JtWCA9IHR5cGUudHJhbnNmb3JtWCA9IGZ1bmN0aW9uKGxlZnRPcCwgcmlnaHRPcCkge1xuICAgIGNoZWNrVmFsaWRPcChsZWZ0T3ApO1xuICAgIGNoZWNrVmFsaWRPcChyaWdodE9wKTtcbiAgICB2YXIgbmV3UmlnaHRPcCA9IFtdO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCByaWdodE9wLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcmlnaHRDb21wb25lbnQgPSByaWdodE9wW2ldO1xuXG4gICAgICAvLyBHZW5lcmF0ZSBuZXdMZWZ0T3AgYnkgY29tcG9zaW5nIGxlZnRPcCBieSByaWdodENvbXBvbmVudFxuICAgICAgdmFyIG5ld0xlZnRPcCA9IFtdO1xuICAgICAgdmFyIGsgPSAwO1xuICAgICAgd2hpbGUgKGsgPCBsZWZ0T3AubGVuZ3RoKSB7XG4gICAgICAgIHZhciBuZXh0QyA9IFtdO1xuICAgICAgICB0cmFuc2Zvcm1Db21wb25lbnRYKGxlZnRPcFtrXSwgcmlnaHRDb21wb25lbnQsIG5ld0xlZnRPcCwgbmV4dEMpO1xuICAgICAgICBrKys7XG5cbiAgICAgICAgaWYgKG5leHRDLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIHJpZ2h0Q29tcG9uZW50ID0gbmV4dENbMF07XG4gICAgICAgIH0gZWxzZSBpZiAobmV4dEMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgZm9yICh2YXIgaiA9IGs7IGogPCBsZWZ0T3AubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIGFwcGVuZChuZXdMZWZ0T3AsIGxlZnRPcFtqXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJpZ2h0Q29tcG9uZW50ID0gbnVsbDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBSZWN1cnNlLlxuICAgICAgICAgIHZhciBwYWlyID0gdHJhbnNmb3JtWChsZWZ0T3Auc2xpY2UoayksIG5leHRDKTtcbiAgICAgICAgICBmb3IgKHZhciBsID0gMDsgbCA8IHBhaXJbMF0ubGVuZ3RoOyBsKyspIHtcbiAgICAgICAgICAgIGFwcGVuZChuZXdMZWZ0T3AsIHBhaXJbMF1bbF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgKHZhciByID0gMDsgciA8IHBhaXJbMV0ubGVuZ3RoOyByKyspIHtcbiAgICAgICAgICAgIGFwcGVuZChuZXdSaWdodE9wLCBwYWlyWzFdW3JdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmlnaHRDb21wb25lbnQgPSBudWxsO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChyaWdodENvbXBvbmVudCAhPSBudWxsKSB7XG4gICAgICAgIGFwcGVuZChuZXdSaWdodE9wLCByaWdodENvbXBvbmVudCk7XG4gICAgICB9XG4gICAgICBsZWZ0T3AgPSBuZXdMZWZ0T3A7XG4gICAgfVxuICAgIHJldHVybiBbbGVmdE9wLCBuZXdSaWdodE9wXTtcbiAgfTtcblxuICAvLyBUcmFuc2Zvcm1zIG9wIHdpdGggc3BlY2lmaWVkIHR5cGUgKCdsZWZ0JyBvciAncmlnaHQnKSBieSBvdGhlck9wLlxuICB0eXBlLnRyYW5zZm9ybSA9IGZ1bmN0aW9uKG9wLCBvdGhlck9wLCB0eXBlKSB7XG4gICAgaWYgKCEodHlwZSA9PT0gJ2xlZnQnIHx8IHR5cGUgPT09ICdyaWdodCcpKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwidHlwZSBtdXN0IGJlICdsZWZ0JyBvciAncmlnaHQnXCIpO1xuXG4gICAgaWYgKG90aGVyT3AubGVuZ3RoID09PSAwKSByZXR1cm4gb3A7XG5cbiAgICBpZiAob3AubGVuZ3RoID09PSAxICYmIG90aGVyT3AubGVuZ3RoID09PSAxKVxuICAgICAgcmV0dXJuIHRyYW5zZm9ybUNvbXBvbmVudChbXSwgb3BbMF0sIG90aGVyT3BbMF0sIHR5cGUpO1xuXG4gICAgaWYgKHR5cGUgPT09ICdsZWZ0JylcbiAgICAgIHJldHVybiB0cmFuc2Zvcm1YKG9wLCBvdGhlck9wKVswXTtcbiAgICBlbHNlXG4gICAgICByZXR1cm4gdHJhbnNmb3JtWChvdGhlck9wLCBvcClbMV07XG4gIH07XG59O1xuIiwiLy8gT25seSB0aGUgSlNPTiB0eXBlIGlzIGV4cG9ydGVkLCBiZWNhdXNlIHRoZSB0ZXh0IHR5cGUgaXMgZGVwcmVjYXRlZFxuLy8gb3RoZXJ3aXNlLiAoSWYgeW91IHdhbnQgdG8gdXNlIGl0IHNvbWV3aGVyZSwgeW91J3JlIHdlbGNvbWUgdG8gcHVsbCBpdCBvdXRcbi8vIGludG8gYSBzZXBhcmF0ZSBtb2R1bGUgdGhhdCBqc29uMCBjYW4gZGVwZW5kIG9uKS5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHR5cGU6IHJlcXVpcmUoJy4vanNvbjAnKVxufTtcbiIsIi8qXG4gVGhpcyBpcyB0aGUgaW1wbGVtZW50YXRpb24gb2YgdGhlIEpTT04gT1QgdHlwZS5cblxuIFNwZWMgaXMgaGVyZTogaHR0cHM6Ly9naXRodWIuY29tL2pvc2VwaGcvU2hhcmVKUy93aWtpL0pTT04tT3BlcmF0aW9uc1xuXG4gTm90ZTogVGhpcyBpcyBiZWluZyBtYWRlIG9ic29sZXRlLiBJdCB3aWxsIHNvb24gYmUgcmVwbGFjZWQgYnkgdGhlIEpTT04yIHR5cGUuXG4qL1xuXG4vKipcbiAqIFVUSUxJVFkgRlVOQ1RJT05TXG4gKi9cblxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIHBhc3NlZCBvYmplY3QgaXMgYW4gQXJyYXkgaW5zdGFuY2UuIENhbid0IHVzZSBBcnJheS5pc0FycmF5XG4gKiB5ZXQgYmVjYXVzZSBpdHMgbm90IHN1cHBvcnRlZCBvbiBJRTguXG4gKlxuICogQHBhcmFtIG9ialxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbnZhciBpc0FycmF5ID0gZnVuY3Rpb24ob2JqKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PSAnW29iamVjdCBBcnJheV0nO1xufTtcblxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIHBhc3NlZCBvYmplY3QgaXMgYW4gT2JqZWN0IGluc3RhbmNlLlxuICogTm8gZnVuY3Rpb24gY2FsbCAoZmFzdCkgdmVyc2lvblxuICpcbiAqIEBwYXJhbSBvYmpcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG52YXIgaXNPYmplY3QgPSBmdW5jdGlvbihvYmopIHtcbiAgcmV0dXJuICghIW9iaikgJiYgKG9iai5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0KTtcbn07XG5cbi8qKlxuICogQ2xvbmVzIHRoZSBwYXNzZWQgb2JqZWN0IHVzaW5nIEpTT04gc2VyaWFsaXphdGlvbiAod2hpY2ggaXMgc2xvdykuXG4gKlxuICogaGF4LCBjb3BpZWQgZnJvbSB0ZXN0L3R5cGVzL2pzb24uIEFwcGFyZW50bHkgdGhpcyBpcyBzdGlsbCB0aGUgZmFzdGVzdCB3YXlcbiAqIHRvIGRlZXAgY2xvbmUgYW4gb2JqZWN0LCBhc3N1bWluZyB3ZSBoYXZlIGJyb3dzZXIgc3VwcG9ydCBmb3IgSlNPTi4gIEBzZWVcbiAqIGh0dHA6Ly9qc3BlcmYuY29tL2Nsb25pbmctYW4tb2JqZWN0LzEyXG4gKi9cbnZhciBjbG9uZSA9IGZ1bmN0aW9uKG8pIHtcbiAgcmV0dXJuIEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkobykpO1xufTtcblxuLyoqXG4gKiBKU09OIE9UIFR5cGVcbiAqIEB0eXBlIHsqfVxuICovXG52YXIganNvbiA9IHtcbiAgbmFtZTogJ2pzb24wJyxcbiAgdXJpOiAnaHR0cDovL3NoYXJlanMub3JnL3R5cGVzL0pTT052MCdcbn07XG5cbi8vIFlvdSBjYW4gcmVnaXN0ZXIgYW5vdGhlciBPVCB0eXBlIGFzIGEgc3VidHlwZSBpbiBhIEpTT04gZG9jdW1lbnQgdXNpbmdcbi8vIHRoZSBmb2xsb3dpbmcgZnVuY3Rpb24uIFRoaXMgYWxsb3dzIGFub3RoZXIgdHlwZSB0byBoYW5kbGUgY2VydGFpblxuLy8gb3BlcmF0aW9ucyBpbnN0ZWFkIG9mIHRoZSBidWlsdGluIEpTT04gdHlwZS5cbnZhciBzdWJ0eXBlcyA9IHt9O1xuanNvbi5yZWdpc3RlclN1YnR5cGUgPSBmdW5jdGlvbihzdWJ0eXBlKSB7XG4gIHN1YnR5cGVzW3N1YnR5cGUubmFtZV0gPSBzdWJ0eXBlO1xufTtcblxuanNvbi5jcmVhdGUgPSBmdW5jdGlvbihkYXRhKSB7XG4gIC8vIE51bGwgaW5zdGVhZCBvZiB1bmRlZmluZWQgaWYgeW91IGRvbid0IHBhc3MgYW4gYXJndW1lbnQuXG4gIHJldHVybiBkYXRhID09PSB1bmRlZmluZWQgPyBudWxsIDogY2xvbmUoZGF0YSk7XG59O1xuXG5qc29uLmludmVydENvbXBvbmVudCA9IGZ1bmN0aW9uKGMpIHtcbiAgdmFyIGNfID0ge3A6IGMucH07XG5cbiAgLy8gaGFuZGxlIHN1YnR5cGUgb3BzXG4gIGlmIChjLnQgJiYgc3VidHlwZXNbYy50XSkge1xuICAgIGNfLnQgPSBjLnQ7XG4gICAgY18ubyA9IHN1YnR5cGVzW2MudF0uaW52ZXJ0KGMubyk7XG4gIH1cblxuICBpZiAoYy5zaSAhPT0gdm9pZCAwKSBjXy5zZCA9IGMuc2k7XG4gIGlmIChjLnNkICE9PSB2b2lkIDApIGNfLnNpID0gYy5zZDtcbiAgaWYgKGMub2kgIT09IHZvaWQgMCkgY18ub2QgPSBjLm9pO1xuICBpZiAoYy5vZCAhPT0gdm9pZCAwKSBjXy5vaSA9IGMub2Q7XG4gIGlmIChjLmxpICE9PSB2b2lkIDApIGNfLmxkID0gYy5saTtcbiAgaWYgKGMubGQgIT09IHZvaWQgMCkgY18ubGkgPSBjLmxkO1xuICBpZiAoYy5uYSAhPT0gdm9pZCAwKSBjXy5uYSA9IC1jLm5hO1xuXG4gIGlmIChjLmxtICE9PSB2b2lkIDApIHtcbiAgICBjXy5sbSA9IGMucFtjLnAubGVuZ3RoLTFdO1xuICAgIGNfLnAgPSBjLnAuc2xpY2UoMCxjLnAubGVuZ3RoLTEpLmNvbmNhdChbYy5sbV0pO1xuICB9XG5cbiAgcmV0dXJuIGNfO1xufTtcblxuanNvbi5pbnZlcnQgPSBmdW5jdGlvbihvcCkge1xuICB2YXIgb3BfID0gb3Auc2xpY2UoKS5yZXZlcnNlKCk7XG4gIHZhciBpb3AgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcF8ubGVuZ3RoOyBpKyspIHtcbiAgICBpb3AucHVzaChqc29uLmludmVydENvbXBvbmVudChvcF9baV0pKTtcbiAgfVxuICByZXR1cm4gaW9wO1xufTtcblxuanNvbi5jaGVja1ZhbGlkT3AgPSBmdW5jdGlvbihvcCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IG9wLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKCFpc0FycmF5KG9wW2ldLnApKSB0aHJvdyBuZXcgRXJyb3IoJ01pc3NpbmcgcGF0aCcpO1xuICB9XG59O1xuXG5qc29uLmNoZWNrTGlzdCA9IGZ1bmN0aW9uKGVsZW0pIHtcbiAgaWYgKCFpc0FycmF5KGVsZW0pKVxuICAgIHRocm93IG5ldyBFcnJvcignUmVmZXJlbmNlZCBlbGVtZW50IG5vdCBhIGxpc3QnKTtcbn07XG5cbmpzb24uY2hlY2tPYmogPSBmdW5jdGlvbihlbGVtKSB7XG4gIGlmICghaXNPYmplY3QoZWxlbSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJSZWZlcmVuY2VkIGVsZW1lbnQgbm90IGFuIG9iamVjdCAoaXQgd2FzIFwiICsgSlNPTi5zdHJpbmdpZnkoZWxlbSkgKyBcIilcIik7XG4gIH1cbn07XG5cbi8vIGhlbHBlciBmdW5jdGlvbnMgdG8gY29udmVydCBvbGQgc3RyaW5nIG9wcyB0byBhbmQgZnJvbSBzdWJ0eXBlIG9wc1xuZnVuY3Rpb24gY29udmVydEZyb21UZXh0KGMpIHtcbiAgYy50ID0gJ3RleHQwJztcbiAgdmFyIG8gPSB7cDogYy5wLnBvcCgpfTtcbiAgaWYgKGMuc2kgIT0gbnVsbCkgby5pID0gYy5zaTtcbiAgaWYgKGMuc2QgIT0gbnVsbCkgby5kID0gYy5zZDtcbiAgYy5vID0gW29dO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0VG9UZXh0KGMpIHtcbiAgYy5wLnB1c2goYy5vWzBdLnApO1xuICBpZiAoYy5vWzBdLmkgIT0gbnVsbCkgYy5zaSA9IGMub1swXS5pO1xuICBpZiAoYy5vWzBdLmQgIT0gbnVsbCkgYy5zZCA9IGMub1swXS5kO1xuICBkZWxldGUgYy50O1xuICBkZWxldGUgYy5vO1xufVxuXG5qc29uLmFwcGx5ID0gZnVuY3Rpb24oc25hcHNob3QsIG9wKSB7XG4gIGpzb24uY2hlY2tWYWxpZE9wKG9wKTtcblxuICBvcCA9IGNsb25lKG9wKTtcblxuICB2YXIgY29udGFpbmVyID0ge1xuICAgIGRhdGE6IHNuYXBzaG90XG4gIH07XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBjID0gb3BbaV07XG5cbiAgICAvLyBjb252ZXJ0IG9sZCBzdHJpbmcgb3BzIHRvIHVzZSBzdWJ0eXBlIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eVxuICAgIGlmIChjLnNpICE9IG51bGwgfHwgYy5zZCAhPSBudWxsKVxuICAgICAgY29udmVydEZyb21UZXh0KGMpO1xuXG4gICAgdmFyIHBhcmVudCA9IG51bGw7XG4gICAgdmFyIHBhcmVudEtleSA9IG51bGw7XG4gICAgdmFyIGVsZW0gPSBjb250YWluZXI7XG4gICAgdmFyIGtleSA9ICdkYXRhJztcblxuICAgIGZvciAodmFyIGogPSAwOyBqIDwgYy5wLmxlbmd0aDsgaisrKSB7XG4gICAgICB2YXIgcCA9IGMucFtqXTtcblxuICAgICAgcGFyZW50ID0gZWxlbTtcbiAgICAgIHBhcmVudEtleSA9IGtleTtcbiAgICAgIGVsZW0gPSBlbGVtW2tleV07XG4gICAgICBrZXkgPSBwO1xuXG4gICAgICBpZiAocGFyZW50ID09IG51bGwpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignUGF0aCBpbnZhbGlkJyk7XG4gICAgfVxuXG4gICAgLy8gaGFuZGxlIHN1YnR5cGUgb3BzXG4gICAgaWYgKGMudCAmJiBjLm8gIT09IHZvaWQgMCAmJiBzdWJ0eXBlc1tjLnRdKSB7XG4gICAgICBlbGVtW2tleV0gPSBzdWJ0eXBlc1tjLnRdLmFwcGx5KGVsZW1ba2V5XSwgYy5vKTtcblxuICAgIC8vIE51bWJlciBhZGRcbiAgICB9IGVsc2UgaWYgKGMubmEgIT09IHZvaWQgMCkge1xuICAgICAgaWYgKHR5cGVvZiBlbGVtW2tleV0gIT0gJ251bWJlcicpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignUmVmZXJlbmNlZCBlbGVtZW50IG5vdCBhIG51bWJlcicpO1xuXG4gICAgICBlbGVtW2tleV0gKz0gYy5uYTtcbiAgICB9XG5cbiAgICAvLyBMaXN0IHJlcGxhY2VcbiAgICBlbHNlIGlmIChjLmxpICE9PSB2b2lkIDAgJiYgYy5sZCAhPT0gdm9pZCAwKSB7XG4gICAgICBqc29uLmNoZWNrTGlzdChlbGVtKTtcbiAgICAgIC8vIFNob3VsZCBjaGVjayB0aGUgbGlzdCBlbGVtZW50IG1hdGNoZXMgYy5sZFxuICAgICAgZWxlbVtrZXldID0gYy5saTtcbiAgICB9XG5cbiAgICAvLyBMaXN0IGluc2VydFxuICAgIGVsc2UgaWYgKGMubGkgIT09IHZvaWQgMCkge1xuICAgICAganNvbi5jaGVja0xpc3QoZWxlbSk7XG4gICAgICBlbGVtLnNwbGljZShrZXksMCwgYy5saSk7XG4gICAgfVxuXG4gICAgLy8gTGlzdCBkZWxldGVcbiAgICBlbHNlIGlmIChjLmxkICE9PSB2b2lkIDApIHtcbiAgICAgIGpzb24uY2hlY2tMaXN0KGVsZW0pO1xuICAgICAgLy8gU2hvdWxkIGNoZWNrIHRoZSBsaXN0IGVsZW1lbnQgbWF0Y2hlcyBjLmxkIGhlcmUgdG9vLlxuICAgICAgZWxlbS5zcGxpY2Uoa2V5LDEpO1xuICAgIH1cblxuICAgIC8vIExpc3QgbW92ZVxuICAgIGVsc2UgaWYgKGMubG0gIT09IHZvaWQgMCkge1xuICAgICAganNvbi5jaGVja0xpc3QoZWxlbSk7XG4gICAgICBpZiAoYy5sbSAhPSBrZXkpIHtcbiAgICAgICAgdmFyIGUgPSBlbGVtW2tleV07XG4gICAgICAgIC8vIFJlbW92ZSBpdC4uLlxuICAgICAgICBlbGVtLnNwbGljZShrZXksMSk7XG4gICAgICAgIC8vIEFuZCBpbnNlcnQgaXQgYmFjay5cbiAgICAgICAgZWxlbS5zcGxpY2UoYy5sbSwwLGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE9iamVjdCBpbnNlcnQgLyByZXBsYWNlXG4gICAgZWxzZSBpZiAoYy5vaSAhPT0gdm9pZCAwKSB7XG4gICAgICBqc29uLmNoZWNrT2JqKGVsZW0pO1xuXG4gICAgICAvLyBTaG91bGQgY2hlY2sgdGhhdCBlbGVtW2tleV0gPT0gYy5vZFxuICAgICAgZWxlbVtrZXldID0gYy5vaTtcbiAgICB9XG5cbiAgICAvLyBPYmplY3QgZGVsZXRlXG4gICAgZWxzZSBpZiAoYy5vZCAhPT0gdm9pZCAwKSB7XG4gICAgICBqc29uLmNoZWNrT2JqKGVsZW0pO1xuXG4gICAgICAvLyBTaG91bGQgY2hlY2sgdGhhdCBlbGVtW2tleV0gPT0gYy5vZFxuICAgICAgZGVsZXRlIGVsZW1ba2V5XTtcbiAgICB9XG5cbiAgICBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCAvIG1pc3NpbmcgaW5zdHJ1Y3Rpb24gaW4gb3AnKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gY29udGFpbmVyLmRhdGE7XG59O1xuXG4vLyBIZWxwZXIgdG8gYnJlYWsgYW4gb3BlcmF0aW9uIHVwIGludG8gYSBidW5jaCBvZiBzbWFsbCBvcHMuXG5qc29uLnNoYXR0ZXIgPSBmdW5jdGlvbihvcCkge1xuICB2YXIgcmVzdWx0cyA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IG9wLmxlbmd0aDsgaSsrKSB7XG4gICAgcmVzdWx0cy5wdXNoKFtvcFtpXV0pO1xuICB9XG4gIHJldHVybiByZXN1bHRzO1xufTtcblxuLy8gSGVscGVyIGZvciBpbmNyZW1lbnRhbGx5IGFwcGx5aW5nIGFuIG9wZXJhdGlvbiB0byBhIHNuYXBzaG90LiBDYWxscyB5aWVsZFxuLy8gYWZ0ZXIgZWFjaCBvcCBjb21wb25lbnQgaGFzIGJlZW4gYXBwbGllZC5cbmpzb24uaW5jcmVtZW50YWxBcHBseSA9IGZ1bmN0aW9uKHNuYXBzaG90LCBvcCwgX3lpZWxkKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgc21hbGxPcCA9IFtvcFtpXV07XG4gICAgc25hcHNob3QgPSBqc29uLmFwcGx5KHNuYXBzaG90LCBzbWFsbE9wKTtcbiAgICAvLyBJJ2QganVzdCBjYWxsIHRoaXMgeWllbGQsIGJ1dCB0aGF0cyBhIHJlc2VydmVkIGtleXdvcmQuIEJhaCFcbiAgICBfeWllbGQoc21hbGxPcCwgc25hcHNob3QpO1xuICB9XG5cbiAgcmV0dXJuIHNuYXBzaG90O1xufTtcblxuLy8gQ2hlY2tzIGlmIHR3byBwYXRocywgcDEgYW5kIHAyIG1hdGNoLlxudmFyIHBhdGhNYXRjaGVzID0ganNvbi5wYXRoTWF0Y2hlcyA9IGZ1bmN0aW9uKHAxLCBwMiwgaWdub3JlTGFzdCkge1xuICBpZiAocDEubGVuZ3RoICE9IHAyLmxlbmd0aClcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBwMS5sZW5ndGg7IGkrKykge1xuICAgIGlmIChwMVtpXSAhPT0gcDJbaV0gJiYgKCFpZ25vcmVMYXN0IHx8IGkgIT09IHAxLmxlbmd0aCAtIDEpKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5qc29uLmFwcGVuZCA9IGZ1bmN0aW9uKGRlc3QsYykge1xuICBjID0gY2xvbmUoYyk7XG5cbiAgaWYgKGRlc3QubGVuZ3RoID09PSAwKSB7XG4gICAgZGVzdC5wdXNoKGMpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBsYXN0ID0gZGVzdFtkZXN0Lmxlbmd0aCAtIDFdO1xuXG4gIC8vIGNvbnZlcnQgb2xkIHN0cmluZyBvcHMgdG8gdXNlIHN1YnR5cGUgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5XG4gIGlmICgoYy5zaSAhPSBudWxsIHx8IGMuc2QgIT0gbnVsbCkgJiYgKGxhc3Quc2kgIT0gbnVsbCB8fCBsYXN0LnNkICE9IG51bGwpKSB7XG4gICAgY29udmVydEZyb21UZXh0KGMpO1xuICAgIGNvbnZlcnRGcm9tVGV4dChsYXN0KTtcbiAgfVxuXG4gIGlmIChwYXRoTWF0Y2hlcyhjLnAsIGxhc3QucCkpIHtcbiAgICAvLyBoYW5kbGUgc3VidHlwZSBvcHNcbiAgICBpZiAoYy50ICYmIGxhc3QudCAmJiBjLnQgPT09IGxhc3QudCAmJiBzdWJ0eXBlc1tjLnRdKSB7XG4gICAgICBsYXN0Lm8gPSBzdWJ0eXBlc1tjLnRdLmNvbXBvc2UobGFzdC5vLCBjLm8pO1xuXG4gICAgICAvLyBjb252ZXJ0IGJhY2sgdG8gb2xkIHN0cmluZyBvcHNcbiAgICAgIGlmIChjLnNpICE9IG51bGwgfHwgYy5zZCAhPSBudWxsKSB7XG4gICAgICAgIHZhciBwID0gYy5wO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxhc3Quby5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICBjLm8gPSBbbGFzdC5vLnBvcCgpXTtcbiAgICAgICAgICBjLnAgPSBwLnNsaWNlKCk7XG4gICAgICAgICAgY29udmVydFRvVGV4dChjKTtcbiAgICAgICAgICBkZXN0LnB1c2goYyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb252ZXJ0VG9UZXh0KGxhc3QpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobGFzdC5uYSAhPSBudWxsICYmIGMubmEgIT0gbnVsbCkge1xuICAgICAgZGVzdFtkZXN0Lmxlbmd0aCAtIDFdID0ge3A6IGxhc3QucCwgbmE6IGxhc3QubmEgKyBjLm5hfTtcbiAgICB9IGVsc2UgaWYgKGxhc3QubGkgIT09IHVuZGVmaW5lZCAmJiBjLmxpID09PSB1bmRlZmluZWQgJiYgYy5sZCA9PT0gbGFzdC5saSkge1xuICAgICAgLy8gaW5zZXJ0IGltbWVkaWF0ZWx5IGZvbGxvd2VkIGJ5IGRlbGV0ZSBiZWNvbWVzIGEgbm9vcC5cbiAgICAgIGlmIChsYXN0LmxkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gbGVhdmUgdGhlIGRlbGV0ZSBwYXJ0IG9mIHRoZSByZXBsYWNlXG4gICAgICAgIGRlbGV0ZSBsYXN0LmxpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVzdC5wb3AoKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGxhc3Qub2QgIT09IHVuZGVmaW5lZCAmJiBsYXN0Lm9pID09PSB1bmRlZmluZWQgJiYgYy5vaSAhPT0gdW5kZWZpbmVkICYmIGMub2QgPT09IHVuZGVmaW5lZCkge1xuICAgICAgbGFzdC5vaSA9IGMub2k7XG4gICAgfSBlbHNlIGlmIChsYXN0Lm9pICE9PSB1bmRlZmluZWQgJiYgYy5vZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBUaGUgbGFzdCBwYXRoIGNvbXBvbmVudCBpbnNlcnRlZCBzb21ldGhpbmcgdGhhdCB0aGUgbmV3IGNvbXBvbmVudCBkZWxldGVzIChvciByZXBsYWNlcykuXG4gICAgICAvLyBKdXN0IG1lcmdlIHRoZW0uXG4gICAgICBpZiAoYy5vaSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGxhc3Qub2kgPSBjLm9pO1xuICAgICAgfSBlbHNlIGlmIChsYXN0Lm9kICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZGVsZXRlIGxhc3Qub2k7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBBbiBpbnNlcnQgZGlyZWN0bHkgZm9sbG93ZWQgYnkgYSBkZWxldGUgdHVybnMgaW50byBhIG5vLW9wIGFuZCBjYW4gYmUgcmVtb3ZlZC5cbiAgICAgICAgZGVzdC5wb3AoKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGMubG0gIT09IHVuZGVmaW5lZCAmJiBjLnBbYy5wLmxlbmd0aCAtIDFdID09PSBjLmxtKSB7XG4gICAgICAvLyBkb24ndCBkbyBhbnl0aGluZ1xuICAgIH0gZWxzZSB7XG4gICAgICBkZXN0LnB1c2goYyk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIGNvbnZlcnQgc3RyaW5nIG9wcyBiYWNrXG4gICAgaWYgKChjLnNpICE9IG51bGwgfHwgYy5zZCAhPSBudWxsKSAmJiAobGFzdC5zaSAhPSBudWxsIHx8IGxhc3Quc2QgIT0gbnVsbCkpIHtcbiAgICAgIGNvbnZlcnRUb1RleHQoYyk7XG4gICAgICBjb252ZXJ0VG9UZXh0KGxhc3QpO1xuICAgIH1cblxuICAgIGRlc3QucHVzaChjKTtcbiAgfVxufTtcblxuanNvbi5jb21wb3NlID0gZnVuY3Rpb24ob3AxLG9wMikge1xuICBqc29uLmNoZWNrVmFsaWRPcChvcDEpO1xuICBqc29uLmNoZWNrVmFsaWRPcChvcDIpO1xuXG4gIHZhciBuZXdPcCA9IGNsb25lKG9wMSk7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcDIubGVuZ3RoOyBpKyspIHtcbiAgICBqc29uLmFwcGVuZChuZXdPcCxvcDJbaV0pO1xuICB9XG5cbiAgcmV0dXJuIG5ld09wO1xufTtcblxuanNvbi5ub3JtYWxpemUgPSBmdW5jdGlvbihvcCkge1xuICB2YXIgbmV3T3AgPSBbXTtcblxuICBvcCA9IGlzQXJyYXkob3ApID8gb3AgOiBbb3BdO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYyA9IG9wW2ldO1xuICAgIGlmIChjLnAgPT0gbnVsbCkgYy5wID0gW107XG5cbiAgICBqc29uLmFwcGVuZChuZXdPcCxjKTtcbiAgfVxuXG4gIHJldHVybiBuZXdPcDtcbn07XG5cbi8vIFJldHVybnMgdGhlIGNvbW1vbiBsZW5ndGggb2YgdGhlIHBhdGhzIG9mIG9wcyBhIGFuZCBiXG5qc29uLmNvbW1vbkxlbmd0aEZvck9wcyA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgdmFyIGFsZW4gPSBhLnAubGVuZ3RoO1xuICB2YXIgYmxlbiA9IGIucC5sZW5ndGg7XG4gIGlmIChhLm5hICE9IG51bGwgfHwgYS50KVxuICAgIGFsZW4rKztcblxuICBpZiAoYi5uYSAhPSBudWxsIHx8IGIudClcbiAgICBibGVuKys7XG5cbiAgaWYgKGFsZW4gPT09IDApIHJldHVybiAtMTtcbiAgaWYgKGJsZW4gPT09IDApIHJldHVybiBudWxsO1xuXG4gIGFsZW4tLTtcbiAgYmxlbi0tO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYWxlbjsgaSsrKSB7XG4gICAgdmFyIHAgPSBhLnBbaV07XG4gICAgaWYgKGkgPj0gYmxlbiB8fCBwICE9PSBiLnBbaV0pXG4gICAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBhbGVuO1xufTtcblxuLy8gUmV0dXJucyB0cnVlIGlmIGFuIG9wIGNhbiBhZmZlY3QgdGhlIGdpdmVuIHBhdGhcbmpzb24uY2FuT3BBZmZlY3RQYXRoID0gZnVuY3Rpb24ob3AsIHBhdGgpIHtcbiAgcmV0dXJuIGpzb24uY29tbW9uTGVuZ3RoRm9yT3BzKHtwOnBhdGh9LCBvcCkgIT0gbnVsbDtcbn07XG5cbi8vIHRyYW5zZm9ybSBjIHNvIGl0IGFwcGxpZXMgdG8gYSBkb2N1bWVudCB3aXRoIG90aGVyQyBhcHBsaWVkLlxuanNvbi50cmFuc2Zvcm1Db21wb25lbnQgPSBmdW5jdGlvbihkZXN0LCBjLCBvdGhlckMsIHR5cGUpIHtcbiAgYyA9IGNsb25lKGMpO1xuXG4gIHZhciBjb21tb24gPSBqc29uLmNvbW1vbkxlbmd0aEZvck9wcyhvdGhlckMsIGMpO1xuICB2YXIgY29tbW9uMiA9IGpzb24uY29tbW9uTGVuZ3RoRm9yT3BzKGMsIG90aGVyQyk7XG4gIHZhciBjcGxlbmd0aCA9IGMucC5sZW5ndGg7XG4gIHZhciBvdGhlckNwbGVuZ3RoID0gb3RoZXJDLnAubGVuZ3RoO1xuXG4gIGlmIChjLm5hICE9IG51bGwgfHwgYy50KVxuICAgIGNwbGVuZ3RoKys7XG5cbiAgaWYgKG90aGVyQy5uYSAhPSBudWxsIHx8IG90aGVyQy50KVxuICAgIG90aGVyQ3BsZW5ndGgrKztcblxuICAvLyBpZiBjIGlzIGRlbGV0aW5nIHNvbWV0aGluZywgYW5kIHRoYXQgdGhpbmcgaXMgY2hhbmdlZCBieSBvdGhlckMsIHdlIG5lZWQgdG9cbiAgLy8gdXBkYXRlIGMgdG8gcmVmbGVjdCB0aGF0IGNoYW5nZSBmb3IgaW52ZXJ0aWJpbGl0eS5cbiAgaWYgKGNvbW1vbjIgIT0gbnVsbCAmJiBvdGhlckNwbGVuZ3RoID4gY3BsZW5ndGggJiYgYy5wW2NvbW1vbjJdID09IG90aGVyQy5wW2NvbW1vbjJdKSB7XG4gICAgaWYgKGMubGQgIT09IHZvaWQgMCkge1xuICAgICAgdmFyIG9jID0gY2xvbmUob3RoZXJDKTtcbiAgICAgIG9jLnAgPSBvYy5wLnNsaWNlKGNwbGVuZ3RoKTtcbiAgICAgIGMubGQgPSBqc29uLmFwcGx5KGNsb25lKGMubGQpLFtvY10pO1xuICAgIH0gZWxzZSBpZiAoYy5vZCAhPT0gdm9pZCAwKSB7XG4gICAgICB2YXIgb2MgPSBjbG9uZShvdGhlckMpO1xuICAgICAgb2MucCA9IG9jLnAuc2xpY2UoY3BsZW5ndGgpO1xuICAgICAgYy5vZCA9IGpzb24uYXBwbHkoY2xvbmUoYy5vZCksW29jXSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKGNvbW1vbiAhPSBudWxsKSB7XG4gICAgdmFyIGNvbW1vbk9wZXJhbmQgPSBjcGxlbmd0aCA9PSBvdGhlckNwbGVuZ3RoO1xuXG4gICAgLy8gYmFja3dhcmQgY29tcGF0aWJpbGl0eSBmb3Igb2xkIHN0cmluZyBvcHNcbiAgICB2YXIgb2MgPSBvdGhlckM7XG4gICAgaWYgKChjLnNpICE9IG51bGwgfHwgYy5zZCAhPSBudWxsKSAmJiAob3RoZXJDLnNpICE9IG51bGwgfHwgb3RoZXJDLnNkICE9IG51bGwpKSB7XG4gICAgICBjb252ZXJ0RnJvbVRleHQoYyk7XG4gICAgICBvYyA9IGNsb25lKG90aGVyQyk7XG4gICAgICBjb252ZXJ0RnJvbVRleHQob2MpO1xuICAgIH1cblxuICAgIC8vIGhhbmRsZSBzdWJ0eXBlIG9wc1xuICAgIGlmIChvYy50ICYmIHN1YnR5cGVzW29jLnRdKSB7XG4gICAgICBpZiAoYy50ICYmIGMudCA9PT0gb2MudCkge1xuICAgICAgICB2YXIgcmVzID0gc3VidHlwZXNbYy50XS50cmFuc2Zvcm0oYy5vLCBvYy5vLCB0eXBlKTtcblxuICAgICAgICBpZiAocmVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAvLyBjb252ZXJ0IGJhY2sgdG8gb2xkIHN0cmluZyBvcHNcbiAgICAgICAgICBpZiAoYy5zaSAhPSBudWxsIHx8IGMuc2QgIT0gbnVsbCkge1xuICAgICAgICAgICAgdmFyIHAgPSBjLnA7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBjLm8gPSBbcmVzW2ldXTtcbiAgICAgICAgICAgICAgYy5wID0gcC5zbGljZSgpO1xuICAgICAgICAgICAgICBjb252ZXJ0VG9UZXh0KGMpO1xuICAgICAgICAgICAgICBqc29uLmFwcGVuZChkZXN0LCBjKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYy5vID0gcmVzO1xuICAgICAgICAgICAganNvbi5hcHBlbmQoZGVzdCwgYyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGRlc3Q7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gdHJhbnNmb3JtIGJhc2VkIG9uIG90aGVyQ1xuICAgIGVsc2UgaWYgKG90aGVyQy5uYSAhPT0gdm9pZCAwKSB7XG4gICAgICAvLyB0aGlzIGNhc2UgaXMgaGFuZGxlZCBiZWxvd1xuICAgIH0gZWxzZSBpZiAob3RoZXJDLmxpICE9PSB2b2lkIDAgJiYgb3RoZXJDLmxkICE9PSB2b2lkIDApIHtcbiAgICAgIGlmIChvdGhlckMucFtjb21tb25dID09PSBjLnBbY29tbW9uXSkge1xuICAgICAgICAvLyBub29wXG5cbiAgICAgICAgaWYgKCFjb21tb25PcGVyYW5kKSB7XG4gICAgICAgICAgcmV0dXJuIGRlc3Q7XG4gICAgICAgIH0gZWxzZSBpZiAoYy5sZCAhPT0gdm9pZCAwKSB7XG4gICAgICAgICAgLy8gd2UncmUgdHJ5aW5nIHRvIGRlbGV0ZSB0aGUgc2FtZSBlbGVtZW50LCAtPiBub29wXG4gICAgICAgICAgaWYgKGMubGkgIT09IHZvaWQgMCAmJiB0eXBlID09PSAnbGVmdCcpIHtcbiAgICAgICAgICAgIC8vIHdlJ3JlIGJvdGggcmVwbGFjaW5nIG9uZSBlbGVtZW50IHdpdGggYW5vdGhlci4gb25seSBvbmUgY2FuIHN1cnZpdmVcbiAgICAgICAgICAgIGMubGQgPSBjbG9uZShvdGhlckMubGkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZGVzdDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG90aGVyQy5saSAhPT0gdm9pZCAwKSB7XG4gICAgICBpZiAoYy5saSAhPT0gdm9pZCAwICYmIGMubGQgPT09IHVuZGVmaW5lZCAmJiBjb21tb25PcGVyYW5kICYmIGMucFtjb21tb25dID09PSBvdGhlckMucFtjb21tb25dKSB7XG4gICAgICAgIC8vIGluIGxpIHZzLiBsaSwgbGVmdCB3aW5zLlxuICAgICAgICBpZiAodHlwZSA9PT0gJ3JpZ2h0JylcbiAgICAgICAgICBjLnBbY29tbW9uXSsrO1xuICAgICAgfSBlbHNlIGlmIChvdGhlckMucFtjb21tb25dIDw9IGMucFtjb21tb25dKSB7XG4gICAgICAgIGMucFtjb21tb25dKys7XG4gICAgICB9XG5cbiAgICAgIGlmIChjLmxtICE9PSB2b2lkIDApIHtcbiAgICAgICAgaWYgKGNvbW1vbk9wZXJhbmQpIHtcbiAgICAgICAgICAvLyBvdGhlckMgZWRpdHMgdGhlIHNhbWUgbGlzdCB3ZSBlZGl0XG4gICAgICAgICAgaWYgKG90aGVyQy5wW2NvbW1vbl0gPD0gYy5sbSlcbiAgICAgICAgICAgIGMubG0rKztcbiAgICAgICAgICAvLyBjaGFuZ2luZyBjLmZyb20gaXMgaGFuZGxlZCBhYm92ZS5cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAob3RoZXJDLmxkICE9PSB2b2lkIDApIHtcbiAgICAgIGlmIChjLmxtICE9PSB2b2lkIDApIHtcbiAgICAgICAgaWYgKGNvbW1vbk9wZXJhbmQpIHtcbiAgICAgICAgICBpZiAob3RoZXJDLnBbY29tbW9uXSA9PT0gYy5wW2NvbW1vbl0pIHtcbiAgICAgICAgICAgIC8vIHRoZXkgZGVsZXRlZCB0aGUgdGhpbmcgd2UncmUgdHJ5aW5nIHRvIG1vdmVcbiAgICAgICAgICAgIHJldHVybiBkZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBvdGhlckMgZWRpdHMgdGhlIHNhbWUgbGlzdCB3ZSBlZGl0XG4gICAgICAgICAgdmFyIHAgPSBvdGhlckMucFtjb21tb25dO1xuICAgICAgICAgIHZhciBmcm9tID0gYy5wW2NvbW1vbl07XG4gICAgICAgICAgdmFyIHRvID0gYy5sbTtcbiAgICAgICAgICBpZiAocCA8IHRvIHx8IChwID09PSB0byAmJiBmcm9tIDwgdG8pKVxuICAgICAgICAgICAgYy5sbS0tO1xuXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKG90aGVyQy5wW2NvbW1vbl0gPCBjLnBbY29tbW9uXSkge1xuICAgICAgICBjLnBbY29tbW9uXS0tO1xuICAgICAgfSBlbHNlIGlmIChvdGhlckMucFtjb21tb25dID09PSBjLnBbY29tbW9uXSkge1xuICAgICAgICBpZiAob3RoZXJDcGxlbmd0aCA8IGNwbGVuZ3RoKSB7XG4gICAgICAgICAgLy8gd2UncmUgYmVsb3cgdGhlIGRlbGV0ZWQgZWxlbWVudCwgc28gLT4gbm9vcFxuICAgICAgICAgIHJldHVybiBkZXN0O1xuICAgICAgICB9IGVsc2UgaWYgKGMubGQgIT09IHZvaWQgMCkge1xuICAgICAgICAgIGlmIChjLmxpICE9PSB2b2lkIDApIHtcbiAgICAgICAgICAgIC8vIHdlJ3JlIHJlcGxhY2luZywgdGhleSdyZSBkZWxldGluZy4gd2UgYmVjb21lIGFuIGluc2VydC5cbiAgICAgICAgICAgIGRlbGV0ZSBjLmxkO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyB3ZSdyZSB0cnlpbmcgdG8gZGVsZXRlIHRoZSBzYW1lIGVsZW1lbnQsIC0+IG5vb3BcbiAgICAgICAgICAgIHJldHVybiBkZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgfSBlbHNlIGlmIChvdGhlckMubG0gIT09IHZvaWQgMCkge1xuICAgICAgaWYgKGMubG0gIT09IHZvaWQgMCAmJiBjcGxlbmd0aCA9PT0gb3RoZXJDcGxlbmd0aCkge1xuICAgICAgICAvLyBsbSB2cyBsbSwgaGVyZSB3ZSBnbyFcbiAgICAgICAgdmFyIGZyb20gPSBjLnBbY29tbW9uXTtcbiAgICAgICAgdmFyIHRvID0gYy5sbTtcbiAgICAgICAgdmFyIG90aGVyRnJvbSA9IG90aGVyQy5wW2NvbW1vbl07XG4gICAgICAgIHZhciBvdGhlclRvID0gb3RoZXJDLmxtO1xuICAgICAgICBpZiAob3RoZXJGcm9tICE9PSBvdGhlclRvKSB7XG4gICAgICAgICAgLy8gaWYgb3RoZXJGcm9tID09IG90aGVyVG8sIHdlIGRvbid0IG5lZWQgdG8gY2hhbmdlIG91ciBvcC5cblxuICAgICAgICAgIC8vIHdoZXJlIGRpZCBteSB0aGluZyBnbz9cbiAgICAgICAgICBpZiAoZnJvbSA9PT0gb3RoZXJGcm9tKSB7XG4gICAgICAgICAgICAvLyB0aGV5IG1vdmVkIGl0ISB0aWUgYnJlYWsuXG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2xlZnQnKSB7XG4gICAgICAgICAgICAgIGMucFtjb21tb25dID0gb3RoZXJUbztcbiAgICAgICAgICAgICAgaWYgKGZyb20gPT09IHRvKSAvLyB1Z2hcbiAgICAgICAgICAgICAgICBjLmxtID0gb3RoZXJUbztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiBkZXN0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyB0aGV5IG1vdmVkIGFyb3VuZCBpdFxuICAgICAgICAgICAgaWYgKGZyb20gPiBvdGhlckZyb20pIGMucFtjb21tb25dLS07XG4gICAgICAgICAgICBpZiAoZnJvbSA+IG90aGVyVG8pIGMucFtjb21tb25dKys7XG4gICAgICAgICAgICBlbHNlIGlmIChmcm9tID09PSBvdGhlclRvKSB7XG4gICAgICAgICAgICAgIGlmIChvdGhlckZyb20gPiBvdGhlclRvKSB7XG4gICAgICAgICAgICAgICAgYy5wW2NvbW1vbl0rKztcbiAgICAgICAgICAgICAgICBpZiAoZnJvbSA9PT0gdG8pIC8vIHVnaCwgYWdhaW5cbiAgICAgICAgICAgICAgICAgIGMubG0rKztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzdGVwIDI6IHdoZXJlIGFtIGkgZ29pbmcgdG8gcHV0IGl0P1xuICAgICAgICAgICAgaWYgKHRvID4gb3RoZXJGcm9tKSB7XG4gICAgICAgICAgICAgIGMubG0tLTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodG8gPT09IG90aGVyRnJvbSkge1xuICAgICAgICAgICAgICBpZiAodG8gPiBmcm9tKVxuICAgICAgICAgICAgICAgIGMubG0tLTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0byA+IG90aGVyVG8pIHtcbiAgICAgICAgICAgICAgYy5sbSsrO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0byA9PT0gb3RoZXJUbykge1xuICAgICAgICAgICAgICAvLyBpZiB3ZSdyZSBib3RoIG1vdmluZyBpbiB0aGUgc2FtZSBkaXJlY3Rpb24sIHRpZSBicmVha1xuICAgICAgICAgICAgICBpZiAoKG90aGVyVG8gPiBvdGhlckZyb20gJiYgdG8gPiBmcm9tKSB8fFxuICAgICAgICAgICAgICAgICAgKG90aGVyVG8gPCBvdGhlckZyb20gJiYgdG8gPCBmcm9tKSkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlID09PSAncmlnaHQnKSBjLmxtKys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKHRvID4gZnJvbSkgYy5sbSsrO1xuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRvID09PSBvdGhlckZyb20pIGMubG0tLTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChjLmxpICE9PSB2b2lkIDAgJiYgYy5sZCA9PT0gdW5kZWZpbmVkICYmIGNvbW1vbk9wZXJhbmQpIHtcbiAgICAgICAgLy8gbGlcbiAgICAgICAgdmFyIGZyb20gPSBvdGhlckMucFtjb21tb25dO1xuICAgICAgICB2YXIgdG8gPSBvdGhlckMubG07XG4gICAgICAgIHAgPSBjLnBbY29tbW9uXTtcbiAgICAgICAgaWYgKHAgPiBmcm9tKSBjLnBbY29tbW9uXS0tO1xuICAgICAgICBpZiAocCA+IHRvKSBjLnBbY29tbW9uXSsrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gbGQsIGxkK2xpLCBzaSwgc2QsIG5hLCBvaSwgb2QsIG9pK29kLCBhbnkgbGkgb24gYW4gZWxlbWVudCBiZW5lYXRoXG4gICAgICAgIC8vIHRoZSBsbVxuICAgICAgICAvL1xuICAgICAgICAvLyBpLmUuIHRoaW5ncyBjYXJlIGFib3V0IHdoZXJlIHRoZWlyIGl0ZW0gaXMgYWZ0ZXIgdGhlIG1vdmUuXG4gICAgICAgIHZhciBmcm9tID0gb3RoZXJDLnBbY29tbW9uXTtcbiAgICAgICAgdmFyIHRvID0gb3RoZXJDLmxtO1xuICAgICAgICBwID0gYy5wW2NvbW1vbl07XG4gICAgICAgIGlmIChwID09PSBmcm9tKSB7XG4gICAgICAgICAgYy5wW2NvbW1vbl0gPSB0bztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAocCA+IGZyb20pIGMucFtjb21tb25dLS07XG4gICAgICAgICAgaWYgKHAgPiB0bykgYy5wW2NvbW1vbl0rKztcbiAgICAgICAgICBlbHNlIGlmIChwID09PSB0byAmJiBmcm9tID4gdG8pIGMucFtjb21tb25dKys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAob3RoZXJDLm9pICE9PSB2b2lkIDAgJiYgb3RoZXJDLm9kICE9PSB2b2lkIDApIHtcbiAgICAgIGlmIChjLnBbY29tbW9uXSA9PT0gb3RoZXJDLnBbY29tbW9uXSkge1xuICAgICAgICBpZiAoYy5vaSAhPT0gdm9pZCAwICYmIGNvbW1vbk9wZXJhbmQpIHtcbiAgICAgICAgICAvLyB3ZSBpbnNlcnRlZCB3aGVyZSBzb21lb25lIGVsc2UgcmVwbGFjZWRcbiAgICAgICAgICBpZiAodHlwZSA9PT0gJ3JpZ2h0Jykge1xuICAgICAgICAgICAgLy8gbGVmdCB3aW5zXG4gICAgICAgICAgICByZXR1cm4gZGVzdDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gd2Ugd2luLCBtYWtlIG91ciBvcCByZXBsYWNlIHdoYXQgdGhleSBpbnNlcnRlZFxuICAgICAgICAgICAgYy5vZCA9IG90aGVyQy5vaTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gLT4gbm9vcCBpZiB0aGUgb3RoZXIgY29tcG9uZW50IGlzIGRlbGV0aW5nIHRoZSBzYW1lIG9iamVjdCAob3IgYW55IHBhcmVudClcbiAgICAgICAgICByZXR1cm4gZGVzdDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAob3RoZXJDLm9pICE9PSB2b2lkIDApIHtcbiAgICAgIGlmIChjLm9pICE9PSB2b2lkIDAgJiYgYy5wW2NvbW1vbl0gPT09IG90aGVyQy5wW2NvbW1vbl0pIHtcbiAgICAgICAgLy8gbGVmdCB3aW5zIGlmIHdlIHRyeSB0byBpbnNlcnQgYXQgdGhlIHNhbWUgcGxhY2VcbiAgICAgICAgaWYgKHR5cGUgPT09ICdsZWZ0Jykge1xuICAgICAgICAgIGpzb24uYXBwZW5kKGRlc3Qse3A6IGMucCwgb2Q6b3RoZXJDLm9pfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGRlc3Q7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG90aGVyQy5vZCAhPT0gdm9pZCAwKSB7XG4gICAgICBpZiAoYy5wW2NvbW1vbl0gPT0gb3RoZXJDLnBbY29tbW9uXSkge1xuICAgICAgICBpZiAoIWNvbW1vbk9wZXJhbmQpXG4gICAgICAgICAgcmV0dXJuIGRlc3Q7XG4gICAgICAgIGlmIChjLm9pICE9PSB2b2lkIDApIHtcbiAgICAgICAgICBkZWxldGUgYy5vZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gZGVzdDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGpzb24uYXBwZW5kKGRlc3QsYyk7XG4gIHJldHVybiBkZXN0O1xufTtcblxucmVxdWlyZSgnLi9ib290c3RyYXBUcmFuc2Zvcm0nKShqc29uLCBqc29uLnRyYW5zZm9ybUNvbXBvbmVudCwganNvbi5jaGVja1ZhbGlkT3AsIGpzb24uYXBwZW5kKTtcblxuLyoqXG4gKiBSZWdpc3RlciBhIHN1YnR5cGUgZm9yIHN0cmluZyBvcGVyYXRpb25zLCB1c2luZyB0aGUgdGV4dDAgdHlwZS5cbiAqL1xudmFyIHRleHQgPSByZXF1aXJlKCcuL3RleHQwJyk7XG5cbmpzb24ucmVnaXN0ZXJTdWJ0eXBlKHRleHQpO1xubW9kdWxlLmV4cG9ydHMgPSBqc29uO1xuXG4iLCIvLyBERVBSRUNBVEVEIVxuLy9cbi8vIFRoaXMgdHlwZSB3b3JrcywgYnV0IGlzIG5vdCBleHBvcnRlZC4gSXRzIGluY2x1ZGVkIGhlcmUgYmVjYXVzZSB0aGUgSlNPTjBcbi8vIGVtYmVkZGVkIHN0cmluZyBvcGVyYXRpb25zIHVzZSB0aGlzIGxpYnJhcnkuXG5cblxuLy8gQSBzaW1wbGUgdGV4dCBpbXBsZW1lbnRhdGlvblxuLy9cbi8vIE9wZXJhdGlvbnMgYXJlIGxpc3RzIG9mIGNvbXBvbmVudHMuIEVhY2ggY29tcG9uZW50IGVpdGhlciBpbnNlcnRzIG9yIGRlbGV0ZXNcbi8vIGF0IGEgc3BlY2lmaWVkIHBvc2l0aW9uIGluIHRoZSBkb2N1bWVudC5cbi8vXG4vLyBDb21wb25lbnRzIGFyZSBlaXRoZXI6XG4vLyAge2k6J3N0cicsIHA6MTAwfTogSW5zZXJ0ICdzdHInIGF0IHBvc2l0aW9uIDEwMCBpbiB0aGUgZG9jdW1lbnRcbi8vICB7ZDonc3RyJywgcDoxMDB9OiBEZWxldGUgJ3N0cicgYXQgcG9zaXRpb24gMTAwIGluIHRoZSBkb2N1bWVudFxuLy9cbi8vIENvbXBvbmVudHMgaW4gYW4gb3BlcmF0aW9uIGFyZSBleGVjdXRlZCBzZXF1ZW50aWFsbHksIHNvIHRoZSBwb3NpdGlvbiBvZiBjb21wb25lbnRzXG4vLyBhc3N1bWVzIHByZXZpb3VzIGNvbXBvbmVudHMgaGF2ZSBhbHJlYWR5IGV4ZWN1dGVkLlxuLy9cbi8vIEVnOiBUaGlzIG9wOlxuLy8gICBbe2k6J2FiYycsIHA6MH1dXG4vLyBpcyBlcXVpdmFsZW50IHRvIHRoaXMgb3A6XG4vLyAgIFt7aTonYScsIHA6MH0sIHtpOidiJywgcDoxfSwge2k6J2MnLCBwOjJ9XVxuXG52YXIgdGV4dCA9IG1vZHVsZS5leHBvcnRzID0ge1xuICBuYW1lOiAndGV4dDAnLFxuICB1cmk6ICdodHRwOi8vc2hhcmVqcy5vcmcvdHlwZXMvdGV4dHYwJyxcbiAgY3JlYXRlOiBmdW5jdGlvbihpbml0aWFsKSB7XG4gICAgaWYgKChpbml0aWFsICE9IG51bGwpICYmIHR5cGVvZiBpbml0aWFsICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbml0aWFsIGRhdGEgbXVzdCBiZSBhIHN0cmluZycpO1xuICAgIH1cbiAgICByZXR1cm4gaW5pdGlhbCB8fCAnJztcbiAgfVxufTtcblxuLyoqIEluc2VydCBzMiBpbnRvIHMxIGF0IHBvcy4gKi9cbnZhciBzdHJJbmplY3QgPSBmdW5jdGlvbihzMSwgcG9zLCBzMikge1xuICByZXR1cm4gczEuc2xpY2UoMCwgcG9zKSArIHMyICsgczEuc2xpY2UocG9zKTtcbn07XG5cbi8qKiBDaGVjayB0aGF0IGFuIG9wZXJhdGlvbiBjb21wb25lbnQgaXMgdmFsaWQuIFRocm93cyBpZiBpdHMgaW52YWxpZC4gKi9cbnZhciBjaGVja1ZhbGlkQ29tcG9uZW50ID0gZnVuY3Rpb24oYykge1xuICBpZiAodHlwZW9mIGMucCAhPT0gJ251bWJlcicpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdjb21wb25lbnQgbWlzc2luZyBwb3NpdGlvbiBmaWVsZCcpO1xuXG4gIGlmICgodHlwZW9mIGMuaSA9PT0gJ3N0cmluZycpID09PSAodHlwZW9mIGMuZCA9PT0gJ3N0cmluZycpKVxuICAgIHRocm93IG5ldyBFcnJvcignY29tcG9uZW50IG5lZWRzIGFuIGkgb3IgZCBmaWVsZCcpO1xuXG4gIGlmIChjLnAgPCAwKVxuICAgIHRocm93IG5ldyBFcnJvcigncG9zaXRpb24gY2Fubm90IGJlIG5lZ2F0aXZlJyk7XG59O1xuXG4vKiogQ2hlY2sgdGhhdCBhbiBvcGVyYXRpb24gaXMgdmFsaWQgKi9cbnZhciBjaGVja1ZhbGlkT3AgPSBmdW5jdGlvbihvcCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IG9wLmxlbmd0aDsgaSsrKSB7XG4gICAgY2hlY2tWYWxpZENvbXBvbmVudChvcFtpXSk7XG4gIH1cbn07XG5cbi8qKiBBcHBseSBvcCB0byBzbmFwc2hvdCAqL1xudGV4dC5hcHBseSA9IGZ1bmN0aW9uKHNuYXBzaG90LCBvcCkge1xuICB2YXIgZGVsZXRlZDtcblxuICBjaGVja1ZhbGlkT3Aob3ApO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IG9wLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGNvbXBvbmVudCA9IG9wW2ldO1xuICAgIGlmIChjb21wb25lbnQuaSAhPSBudWxsKSB7XG4gICAgICBzbmFwc2hvdCA9IHN0ckluamVjdChzbmFwc2hvdCwgY29tcG9uZW50LnAsIGNvbXBvbmVudC5pKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVsZXRlZCA9IHNuYXBzaG90LnNsaWNlKGNvbXBvbmVudC5wLCBjb21wb25lbnQucCArIGNvbXBvbmVudC5kLmxlbmd0aCk7XG4gICAgICBpZiAoY29tcG9uZW50LmQgIT09IGRlbGV0ZWQpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkRlbGV0ZSBjb21wb25lbnQgJ1wiICsgY29tcG9uZW50LmQgKyBcIicgZG9lcyBub3QgbWF0Y2ggZGVsZXRlZCB0ZXh0ICdcIiArIGRlbGV0ZWQgKyBcIidcIik7XG5cbiAgICAgIHNuYXBzaG90ID0gc25hcHNob3Quc2xpY2UoMCwgY29tcG9uZW50LnApICsgc25hcHNob3Quc2xpY2UoY29tcG9uZW50LnAgKyBjb21wb25lbnQuZC5sZW5ndGgpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gc25hcHNob3Q7XG59O1xuXG4vKipcbiAqIEFwcGVuZCBhIGNvbXBvbmVudCB0byB0aGUgZW5kIG9mIG5ld09wLiBFeHBvcnRlZCBmb3IgdXNlIGJ5IHRoZSByYW5kb20gb3BcbiAqIGdlbmVyYXRvciBhbmQgdGhlIEpTT04wIHR5cGUuXG4gKi9cbnZhciBhcHBlbmQgPSB0ZXh0Ll9hcHBlbmQgPSBmdW5jdGlvbihuZXdPcCwgYykge1xuICBpZiAoYy5pID09PSAnJyB8fCBjLmQgPT09ICcnKSByZXR1cm47XG5cbiAgaWYgKG5ld09wLmxlbmd0aCA9PT0gMCkge1xuICAgIG5ld09wLnB1c2goYyk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGxhc3QgPSBuZXdPcFtuZXdPcC5sZW5ndGggLSAxXTtcblxuICAgIGlmIChsYXN0LmkgIT0gbnVsbCAmJiBjLmkgIT0gbnVsbCAmJiBsYXN0LnAgPD0gYy5wICYmIGMucCA8PSBsYXN0LnAgKyBsYXN0LmkubGVuZ3RoKSB7XG4gICAgICAvLyBDb21wb3NlIHRoZSBpbnNlcnQgaW50byB0aGUgcHJldmlvdXMgaW5zZXJ0XG4gICAgICBuZXdPcFtuZXdPcC5sZW5ndGggLSAxXSA9IHtpOnN0ckluamVjdChsYXN0LmksIGMucCAtIGxhc3QucCwgYy5pKSwgcDpsYXN0LnB9O1xuXG4gICAgfSBlbHNlIGlmIChsYXN0LmQgIT0gbnVsbCAmJiBjLmQgIT0gbnVsbCAmJiBjLnAgPD0gbGFzdC5wICYmIGxhc3QucCA8PSBjLnAgKyBjLmQubGVuZ3RoKSB7XG4gICAgICAvLyBDb21wb3NlIHRoZSBkZWxldGVzIHRvZ2V0aGVyXG4gICAgICBuZXdPcFtuZXdPcC5sZW5ndGggLSAxXSA9IHtkOnN0ckluamVjdChjLmQsIGxhc3QucCAtIGMucCwgbGFzdC5kKSwgcDpjLnB9O1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIG5ld09wLnB1c2goYyk7XG4gICAgfVxuICB9XG59O1xuXG4vKiogQ29tcG9zZSBvcDEgYW5kIG9wMiB0b2dldGhlciAqL1xudGV4dC5jb21wb3NlID0gZnVuY3Rpb24ob3AxLCBvcDIpIHtcbiAgY2hlY2tWYWxpZE9wKG9wMSk7XG4gIGNoZWNrVmFsaWRPcChvcDIpO1xuICB2YXIgbmV3T3AgPSBvcDEuc2xpY2UoKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcDIubGVuZ3RoOyBpKyspIHtcbiAgICBhcHBlbmQobmV3T3AsIG9wMltpXSk7XG4gIH1cbiAgcmV0dXJuIG5ld09wO1xufTtcblxuLyoqIENsZWFuIHVwIGFuIG9wICovXG50ZXh0Lm5vcm1hbGl6ZSA9IGZ1bmN0aW9uKG9wKSB7XG4gIHZhciBuZXdPcCA9IFtdO1xuXG4gIC8vIE5vcm1hbGl6ZSBzaG91bGQgYWxsb3cgb3BzIHdoaWNoIGFyZSBhIHNpbmdsZSAodW53cmFwcGVkKSBjb21wb25lbnQ6XG4gIC8vIHtpOidhc2RmJywgcDoyM30uXG4gIC8vIFRoZXJlJ3Mgbm8gZ29vZCB3YXkgdG8gdGVzdCBpZiBzb21ldGhpbmcgaXMgYW4gYXJyYXk6XG4gIC8vIGh0dHA6Ly9wZXJmZWN0aW9ua2lsbHMuY29tL2luc3RhbmNlb2YtY29uc2lkZXJlZC1oYXJtZnVsLW9yLWhvdy10by13cml0ZS1hLXJvYnVzdC1pc2FycmF5L1xuICAvLyBzbyB0aGlzIGlzIHByb2JhYmx5IHRoZSBsZWFzdCBiYWQgc29sdXRpb24uXG4gIGlmIChvcC5pICE9IG51bGwgfHwgb3AucCAhPSBudWxsKSBvcCA9IFtvcF07XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBjID0gb3BbaV07XG4gICAgaWYgKGMucCA9PSBudWxsKSBjLnAgPSAwO1xuXG4gICAgYXBwZW5kKG5ld09wLCBjKTtcbiAgfVxuXG4gIHJldHVybiBuZXdPcDtcbn07XG5cbi8vIFRoaXMgaGVscGVyIG1ldGhvZCB0cmFuc2Zvcm1zIGEgcG9zaXRpb24gYnkgYW4gb3AgY29tcG9uZW50LlxuLy9cbi8vIElmIGMgaXMgYW4gaW5zZXJ0LCBpbnNlcnRBZnRlciBzcGVjaWZpZXMgd2hldGhlciB0aGUgdHJhbnNmb3JtXG4vLyBpcyBwdXNoZWQgYWZ0ZXIgdGhlIGluc2VydCAodHJ1ZSkgb3IgYmVmb3JlIGl0IChmYWxzZSkuXG4vL1xuLy8gaW5zZXJ0QWZ0ZXIgaXMgb3B0aW9uYWwgZm9yIGRlbGV0ZXMuXG52YXIgdHJhbnNmb3JtUG9zaXRpb24gPSBmdW5jdGlvbihwb3MsIGMsIGluc2VydEFmdGVyKSB7XG4gIC8vIFRoaXMgd2lsbCBnZXQgY29sbGFwc2VkIGludG8gYSBnaWFudCB0ZXJuYXJ5IGJ5IHVnbGlmeS5cbiAgaWYgKGMuaSAhPSBudWxsKSB7XG4gICAgaWYgKGMucCA8IHBvcyB8fCAoYy5wID09PSBwb3MgJiYgaW5zZXJ0QWZ0ZXIpKSB7XG4gICAgICByZXR1cm4gcG9zICsgYy5pLmxlbmd0aDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHBvcztcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gSSB0aGluayB0aGlzIGNvdWxkIGFsc28gYmUgd3JpdHRlbiBhczogTWF0aC5taW4oYy5wLCBNYXRoLm1pbihjLnAgLVxuICAgIC8vIG90aGVyQy5wLCBvdGhlckMuZC5sZW5ndGgpKSBidXQgSSB0aGluayBpdHMgaGFyZGVyIHRvIHJlYWQgdGhhdCB3YXksIGFuZFxuICAgIC8vIGl0IGNvbXBpbGVzIHVzaW5nIHRlcm5hcnkgb3BlcmF0b3JzIGFueXdheSBzbyBpdHMgbm8gc2xvd2VyIHdyaXR0ZW4gbGlrZVxuICAgIC8vIHRoaXMuXG4gICAgaWYgKHBvcyA8PSBjLnApIHtcbiAgICAgIHJldHVybiBwb3M7XG4gICAgfSBlbHNlIGlmIChwb3MgPD0gYy5wICsgYy5kLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGMucDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHBvcyAtIGMuZC5sZW5ndGg7XG4gICAgfVxuICB9XG59O1xuXG4vLyBIZWxwZXIgbWV0aG9kIHRvIHRyYW5zZm9ybSBhIGN1cnNvciBwb3NpdGlvbiBhcyBhIHJlc3VsdCBvZiBhbiBvcC5cbi8vXG4vLyBMaWtlIHRyYW5zZm9ybVBvc2l0aW9uIGFib3ZlLCBpZiBjIGlzIGFuIGluc2VydCwgaW5zZXJ0QWZ0ZXIgc3BlY2lmaWVzXG4vLyB3aGV0aGVyIHRoZSBjdXJzb3IgcG9zaXRpb24gaXMgcHVzaGVkIGFmdGVyIGFuIGluc2VydCAodHJ1ZSkgb3IgYmVmb3JlIGl0XG4vLyAoZmFsc2UpLlxudGV4dC50cmFuc2Zvcm1DdXJzb3IgPSBmdW5jdGlvbihwb3NpdGlvbiwgb3AsIHNpZGUpIHtcbiAgdmFyIGluc2VydEFmdGVyID0gc2lkZSA9PT0gJ3JpZ2h0JztcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5sZW5ndGg7IGkrKykge1xuICAgIHBvc2l0aW9uID0gdHJhbnNmb3JtUG9zaXRpb24ocG9zaXRpb24sIG9wW2ldLCBpbnNlcnRBZnRlcik7XG4gIH1cblxuICByZXR1cm4gcG9zaXRpb247XG59O1xuXG4vLyBUcmFuc2Zvcm0gYW4gb3AgY29tcG9uZW50IGJ5IGFub3RoZXIgb3AgY29tcG9uZW50LiBBc3ltbWV0cmljLlxuLy8gVGhlIHJlc3VsdCB3aWxsIGJlIGFwcGVuZGVkIHRvIGRlc3RpbmF0aW9uLlxuLy9cbi8vIGV4cG9ydGVkIGZvciB1c2UgaW4gSlNPTiB0eXBlXG52YXIgdHJhbnNmb3JtQ29tcG9uZW50ID0gdGV4dC5fdGMgPSBmdW5jdGlvbihkZXN0LCBjLCBvdGhlckMsIHNpZGUpIHtcbiAgLy92YXIgY0ludGVyc2VjdCwgaW50ZXJzZWN0RW5kLCBpbnRlcnNlY3RTdGFydCwgbmV3Qywgb3RoZXJJbnRlcnNlY3QsIHM7XG5cbiAgY2hlY2tWYWxpZENvbXBvbmVudChjKTtcbiAgY2hlY2tWYWxpZENvbXBvbmVudChvdGhlckMpO1xuXG4gIGlmIChjLmkgIT0gbnVsbCkge1xuICAgIC8vIEluc2VydC5cbiAgICBhcHBlbmQoZGVzdCwge2k6Yy5pLCBwOnRyYW5zZm9ybVBvc2l0aW9uKGMucCwgb3RoZXJDLCBzaWRlID09PSAncmlnaHQnKX0pO1xuICB9IGVsc2Uge1xuICAgIC8vIERlbGV0ZVxuICAgIGlmIChvdGhlckMuaSAhPSBudWxsKSB7XG4gICAgICAvLyBEZWxldGUgdnMgaW5zZXJ0XG4gICAgICB2YXIgcyA9IGMuZDtcbiAgICAgIGlmIChjLnAgPCBvdGhlckMucCkge1xuICAgICAgICBhcHBlbmQoZGVzdCwge2Q6cy5zbGljZSgwLCBvdGhlckMucCAtIGMucCksIHA6Yy5wfSk7XG4gICAgICAgIHMgPSBzLnNsaWNlKG90aGVyQy5wIC0gYy5wKTtcbiAgICAgIH1cbiAgICAgIGlmIChzICE9PSAnJylcbiAgICAgICAgYXBwZW5kKGRlc3QsIHtkOiBzLCBwOiBjLnAgKyBvdGhlckMuaS5sZW5ndGh9KTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBEZWxldGUgdnMgZGVsZXRlXG4gICAgICBpZiAoYy5wID49IG90aGVyQy5wICsgb3RoZXJDLmQubGVuZ3RoKVxuICAgICAgICBhcHBlbmQoZGVzdCwge2Q6IGMuZCwgcDogYy5wIC0gb3RoZXJDLmQubGVuZ3RofSk7XG4gICAgICBlbHNlIGlmIChjLnAgKyBjLmQubGVuZ3RoIDw9IG90aGVyQy5wKVxuICAgICAgICBhcHBlbmQoZGVzdCwgYyk7XG4gICAgICBlbHNlIHtcbiAgICAgICAgLy8gVGhleSBvdmVybGFwIHNvbWV3aGVyZS5cbiAgICAgICAgdmFyIG5ld0MgPSB7ZDogJycsIHA6IGMucH07XG5cbiAgICAgICAgaWYgKGMucCA8IG90aGVyQy5wKVxuICAgICAgICAgIG5ld0MuZCA9IGMuZC5zbGljZSgwLCBvdGhlckMucCAtIGMucCk7XG5cbiAgICAgICAgaWYgKGMucCArIGMuZC5sZW5ndGggPiBvdGhlckMucCArIG90aGVyQy5kLmxlbmd0aClcbiAgICAgICAgICBuZXdDLmQgKz0gYy5kLnNsaWNlKG90aGVyQy5wICsgb3RoZXJDLmQubGVuZ3RoIC0gYy5wKTtcblxuICAgICAgICAvLyBUaGlzIGlzIGVudGlyZWx5IG9wdGlvbmFsIC0gSSdtIGp1c3QgY2hlY2tpbmcgdGhlIGRlbGV0ZWQgdGV4dCBpblxuICAgICAgICAvLyB0aGUgdHdvIG9wcyBtYXRjaGVzXG4gICAgICAgIHZhciBpbnRlcnNlY3RTdGFydCA9IE1hdGgubWF4KGMucCwgb3RoZXJDLnApO1xuICAgICAgICB2YXIgaW50ZXJzZWN0RW5kID0gTWF0aC5taW4oYy5wICsgYy5kLmxlbmd0aCwgb3RoZXJDLnAgKyBvdGhlckMuZC5sZW5ndGgpO1xuICAgICAgICB2YXIgY0ludGVyc2VjdCA9IGMuZC5zbGljZShpbnRlcnNlY3RTdGFydCAtIGMucCwgaW50ZXJzZWN0RW5kIC0gYy5wKTtcbiAgICAgICAgdmFyIG90aGVySW50ZXJzZWN0ID0gb3RoZXJDLmQuc2xpY2UoaW50ZXJzZWN0U3RhcnQgLSBvdGhlckMucCwgaW50ZXJzZWN0RW5kIC0gb3RoZXJDLnApO1xuICAgICAgICBpZiAoY0ludGVyc2VjdCAhPT0gb3RoZXJJbnRlcnNlY3QpXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdEZWxldGUgb3BzIGRlbGV0ZSBkaWZmZXJlbnQgdGV4dCBpbiB0aGUgc2FtZSByZWdpb24gb2YgdGhlIGRvY3VtZW50Jyk7XG5cbiAgICAgICAgaWYgKG5ld0MuZCAhPT0gJycpIHtcbiAgICAgICAgICBuZXdDLnAgPSB0cmFuc2Zvcm1Qb3NpdGlvbihuZXdDLnAsIG90aGVyQyk7XG4gICAgICAgICAgYXBwZW5kKGRlc3QsIG5ld0MpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGRlc3Q7XG59O1xuXG52YXIgaW52ZXJ0Q29tcG9uZW50ID0gZnVuY3Rpb24oYykge1xuICByZXR1cm4gKGMuaSAhPSBudWxsKSA/IHtkOmMuaSwgcDpjLnB9IDoge2k6Yy5kLCBwOmMucH07XG59O1xuXG4vLyBObyBuZWVkIHRvIHVzZSBhcHBlbmQgZm9yIGludmVydCwgYmVjYXVzZSB0aGUgY29tcG9uZW50cyB3b24ndCBiZSBhYmxlIHRvXG4vLyBjYW5jZWwgb25lIGFub3RoZXIuXG50ZXh0LmludmVydCA9IGZ1bmN0aW9uKG9wKSB7XG4gIC8vIFNoYWxsb3cgY29weSAmIHJldmVyc2UgdGhhdCBzdWNrYS5cbiAgb3AgPSBvcC5zbGljZSgpLnJldmVyc2UoKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5sZW5ndGg7IGkrKykge1xuICAgIG9wW2ldID0gaW52ZXJ0Q29tcG9uZW50KG9wW2ldKTtcbiAgfVxuICByZXR1cm4gb3A7XG59O1xuXG5yZXF1aXJlKCcuL2Jvb3RzdHJhcFRyYW5zZm9ybScpKHRleHQsIHRyYW5zZm9ybUNvbXBvbmVudCwgY2hlY2tWYWxpZE9wLCBhcHBlbmQpO1xuIiwiLy8gVGV4dCBkb2N1bWVudCBBUEkgZm9yIHRoZSAndGV4dCcgdHlwZS4gVGhpcyBpbXBsZW1lbnRzIHNvbWUgc3RhbmRhcmQgQVBJXG4vLyBtZXRob2RzIGZvciBhbnkgdGV4dC1saWtlIHR5cGUsIHNvIHlvdSBjYW4gZWFzaWx5IGJpbmQgYSB0ZXh0YXJlYSBvclxuLy8gc29tZXRoaW5nIHdpdGhvdXQgYmVpbmcgZnVzc3kgYWJvdXQgdGhlIHVuZGVybHlpbmcgT1QgaW1wbGVtZW50YXRpb24uXG4vL1xuLy8gVGhlIEFQSSBpcyBkZXNpZ2VuZCBhcyBhIHNldCBvZiBmdW5jdGlvbnMgdG8gYmUgbWl4ZWQgaW4gdG8gc29tZSBjb250ZXh0XG4vLyBvYmplY3QgYXMgcGFydCBvZiBpdHMgbGlmZWN5Y2xlLiBJdCBleHBlY3RzIHRoYXQgb2JqZWN0IHRvIGhhdmUgZ2V0U25hcHNob3Rcbi8vIGFuZCBzdWJtaXRPcCBtZXRob2RzLCBhbmQgY2FsbCBfb25PcCB3aGVuIGFuIG9wZXJhdGlvbiBpcyByZWNlaXZlZC5cbi8vXG4vLyBUaGlzIEFQSSBkZWZpbmVzOlxuLy9cbi8vIC0gZ2V0TGVuZ3RoKCkgcmV0dXJucyB0aGUgbGVuZ3RoIG9mIHRoZSBkb2N1bWVudCBpbiBjaGFyYWN0ZXJzXG4vLyAtIGdldFRleHQoKSByZXR1cm5zIGEgc3RyaW5nIG9mIHRoZSBkb2N1bWVudFxuLy8gLSBpbnNlcnQocG9zLCB0ZXh0LCBbY2FsbGJhY2tdKSBpbnNlcnRzIHRleHQgYXQgcG9zaXRpb24gcG9zIGluIHRoZSBkb2N1bWVudFxuLy8gLSByZW1vdmUocG9zLCBsZW5ndGgsIFtjYWxsYmFja10pIHJlbW92ZXMgbGVuZ3RoIGNoYXJhY3RlcnMgYXQgcG9zaXRpb24gcG9zXG4vL1xuLy8gQSB1c2VyIGNhbiBkZWZpbmU6XG4vLyAtIG9uSW5zZXJ0KHBvcywgdGV4dCk6IENhbGxlZCB3aGVuIHRleHQgaXMgaW5zZXJ0ZWQuXG4vLyAtIG9uUmVtb3ZlKHBvcywgbGVuZ3RoKTogQ2FsbGVkIHdoZW4gdGV4dCBpcyByZW1vdmVkLlxuXG5tb2R1bGUuZXhwb3J0cyA9IGFwaTtcbmZ1bmN0aW9uIGFwaShnZXRTbmFwc2hvdCwgc3VibWl0T3ApIHtcbiAgcmV0dXJuIHtcbiAgICAvLyBSZXR1cm5zIHRoZSB0ZXh0IGNvbnRlbnQgb2YgdGhlIGRvY3VtZW50XG4gICAgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIGdldFNuYXBzaG90KCk7IH0sXG5cbiAgICAvLyBSZXR1cm5zIHRoZSBudW1iZXIgb2YgY2hhcmFjdGVycyBpbiB0aGUgc3RyaW5nXG4gICAgZ2V0TGVuZ3RoOiBmdW5jdGlvbigpIHsgcmV0dXJuIGdldFNuYXBzaG90KCkubGVuZ3RoOyB9LFxuXG4gICAgLy8gSW5zZXJ0IHRoZSBzcGVjaWZpZWQgdGV4dCBhdCB0aGUgZ2l2ZW4gcG9zaXRpb24gaW4gdGhlIGRvY3VtZW50XG4gICAgaW5zZXJ0OiBmdW5jdGlvbihwb3MsIHRleHQsIGNhbGxiYWNrKSB7XG4gICAgICByZXR1cm4gc3VibWl0T3AoW3BvcywgdGV4dF0sIGNhbGxiYWNrKTtcbiAgICB9LFxuXG4gICAgcmVtb3ZlOiBmdW5jdGlvbihwb3MsIGxlbmd0aCwgY2FsbGJhY2spIHtcbiAgICAgIHJldHVybiBzdWJtaXRPcChbcG9zLCB7ZDpsZW5ndGh9XSwgY2FsbGJhY2spO1xuICAgIH0sXG5cbiAgICAvLyBXaGVuIHlvdSB1c2UgdGhpcyBBUEksIHlvdSBzaG91bGQgaW1wbGVtZW50IHRoZXNlIHR3byBtZXRob2RzXG4gICAgLy8gaW4geW91ciBlZGl0aW5nIGNvbnRleHQuXG4gICAgLy9vbkluc2VydDogZnVuY3Rpb24ocG9zLCB0ZXh0KSB7fSxcbiAgICAvL29uUmVtb3ZlOiBmdW5jdGlvbihwb3MsIHJlbW92ZWRMZW5ndGgpIHt9LFxuXG4gICAgX29uT3A6IGZ1bmN0aW9uKG9wKSB7XG4gICAgICB2YXIgcG9zID0gMDtcbiAgICAgIHZhciBzcG9zID0gMDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGNvbXBvbmVudCA9IG9wW2ldO1xuICAgICAgICBzd2l0Y2ggKHR5cGVvZiBjb21wb25lbnQpIHtcbiAgICAgICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICAgICAgcG9zICs9IGNvbXBvbmVudDtcbiAgICAgICAgICAgIHNwb3MgKz0gY29tcG9uZW50O1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgICAgIGlmICh0aGlzLm9uSW5zZXJ0KSB0aGlzLm9uSW5zZXJ0KHBvcywgY29tcG9uZW50KTtcbiAgICAgICAgICAgIHBvcyArPSBjb21wb25lbnQubGVuZ3RoO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgICAgICAgIGlmICh0aGlzLm9uUmVtb3ZlKSB0aGlzLm9uUmVtb3ZlKHBvcywgY29tcG9uZW50LmQpO1xuICAgICAgICAgICAgc3BvcyArPSBjb21wb25lbnQuZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfTtcbn07XG5hcGkucHJvdmlkZXMgPSB7dGV4dDogdHJ1ZX07XG4iLCJ2YXIgdHlwZSA9IHJlcXVpcmUoJy4vdGV4dCcpO1xudHlwZS5hcGkgPSByZXF1aXJlKCcuL2FwaScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgdHlwZTogdHlwZVxufTtcbiIsIi8qIFRleHQgT1QhXG4gKlxuICogVGhpcyBpcyBhbiBPVCBpbXBsZW1lbnRhdGlvbiBmb3IgdGV4dC4gSXQgaXMgdGhlIHN0YW5kYXJkIGltcGxlbWVudGF0aW9uIG9mXG4gKiB0ZXh0IHVzZWQgYnkgU2hhcmVKUy5cbiAqXG4gKiBUaGlzIHR5cGUgaXMgY29tcG9zYWJsZSBidXQgbm9uLWludmVydGFibGUuIEl0cyBzaW1pbGFyIHRvIFNoYXJlSlMncyBvbGRcbiAqIHRleHQtY29tcG9zYWJsZSB0eXBlLCBidXQgaXRzIG5vdCBpbnZlcnRhYmxlIGFuZCBpdHMgdmVyeSBzaW1pbGFyIHRvIHRoZVxuICogdGV4dC10cDIgaW1wbGVtZW50YXRpb24gYnV0IGl0IGRvZXNuJ3Qgc3VwcG9ydCB0b21ic3RvbmVzIG9yIHB1cmdpbmcuXG4gKlxuICogT3BzIGFyZSBsaXN0cyBvZiBjb21wb25lbnRzIHdoaWNoIGl0ZXJhdGUgb3ZlciB0aGUgZG9jdW1lbnQuXG4gKiBDb21wb25lbnRzIGFyZSBlaXRoZXI6XG4gKiAgIEEgbnVtYmVyIE46IFNraXAgTiBjaGFyYWN0ZXJzIGluIHRoZSBvcmlnaW5hbCBkb2N1bWVudFxuICogICBcInN0clwiICAgICA6IEluc2VydCBcInN0clwiIGF0IHRoZSBjdXJyZW50IHBvc2l0aW9uIGluIHRoZSBkb2N1bWVudFxuICogICB7ZDpOfSAgICAgOiBEZWxldGUgTiBjaGFyYWN0ZXJzIGF0IHRoZSBjdXJyZW50IHBvc2l0aW9uIGluIHRoZSBkb2N1bWVudFxuICpcbiAqIEVnOiBbMywgJ2hpJywgNSwge2Q6OH1dXG4gKlxuICogVGhlIG9wZXJhdGlvbiBkb2VzIG5vdCBoYXZlIHRvIHNraXAgdGhlIGxhc3QgY2hhcmFjdGVycyBpbiB0aGUgZG9jdW1lbnQuXG4gKlxuICogU25hcHNob3RzIGFyZSBzdHJpbmdzLlxuICpcbiAqIEN1cnNvcnMgYXJlIGVpdGhlciBhIHNpbmdsZSBudW1iZXIgKHdoaWNoIGlzIHRoZSBjdXJzb3IgcG9zaXRpb24pIG9yIGEgcGFpciBvZlxuICogW2FuY2hvciwgZm9jdXNdIChha2EgW3N0YXJ0LCBlbmRdKS4gQmUgYXdhcmUgdGhhdCBlbmQgY2FuIGJlIGJlZm9yZSBzdGFydC5cbiAqL1xuXG4vKiogQG1vZHVsZSB0ZXh0ICovXG5cbmV4cG9ydHMubmFtZSA9ICd0ZXh0JztcbmV4cG9ydHMudXJpID0gJ2h0dHA6Ly9zaGFyZWpzLm9yZy90eXBlcy90ZXh0djEnO1xuXG4vKiogQ3JlYXRlIGEgbmV3IHRleHQgc25hcHNob3QuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IGluaXRpYWwgLSBpbml0aWFsIHNuYXBzaG90IGRhdGEuIE9wdGlvbmFsLiBEZWZhdWx0cyB0byAnJy5cbiAqL1xuZXhwb3J0cy5jcmVhdGUgPSBmdW5jdGlvbihpbml0aWFsKSB7XG4gIGlmICgoaW5pdGlhbCAhPSBudWxsKSAmJiB0eXBlb2YgaW5pdGlhbCAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBFcnJvcignSW5pdGlhbCBkYXRhIG11c3QgYmUgYSBzdHJpbmcnKTtcbiAgfVxuICByZXR1cm4gaW5pdGlhbCB8fCAnJztcbn07XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbihvYmopIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09PSBcIltvYmplY3QgQXJyYXldXCI7XG59O1xuXG4vKiogQ2hlY2sgdGhlIG9wZXJhdGlvbiBpcyB2YWxpZC4gVGhyb3dzIGlmIG5vdCB2YWxpZC4gKi9cbnZhciBjaGVja09wID0gZnVuY3Rpb24ob3ApIHtcbiAgaWYgKCFpc0FycmF5KG9wKSkgdGhyb3cgRXJyb3IoJ09wIG11c3QgYmUgYW4gYXJyYXkgb2YgY29tcG9uZW50cycpO1xuXG4gIHZhciBsYXN0ID0gbnVsbDtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IG9wLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGMgPSBvcFtpXTtcbiAgICBjb25zb2xlLmVycm9yKGMpXG4gICAgY29uc29sZS5lcnJvcih0eXBlb2YgYylcbiAgICBzd2l0Y2ggKHR5cGVvZiBjKSB7XG4gICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICAvLyAvLyBUaGUgb25seSB2YWxpZCBvYmplY3RzIGFyZSB7ZDpYfSBmb3IgK2l2ZSB2YWx1ZXMgb2YgWC5cbiAgICAgICAgLy8gaWYgKCEodHlwZW9mIGMuZCA9PT0gJ251bWJlcicgJiYgYy5kID4gMCkpIHRocm93IEVycm9yKCdPYmplY3QgY29tcG9uZW50cyBtdXN0IGJlIGRlbGV0ZXMgb2Ygc2l6ZSA+IDAnKTtcbiAgICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgLy8gU3RyaW5ncyBhcmUgaW5zZXJ0cy5cbiAgICAgICAgaWYgKCEoYy5sZW5ndGggPiAwKSkgdGhyb3cgRXJyb3IoJ0luc2VydHMgY2Fubm90IGJlIGVtcHR5Jyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgLy8gTnVtYmVycyBtdXN0IGJlIHNraXBzLiBUaGV5IGhhdmUgdG8gYmUgK2l2ZSBudW1iZXJzLlxuICAgICAgICBpZiAoIShjID4gMCkpIHRocm93IEVycm9yKCdTa2lwIGNvbXBvbmVudHMgbXVzdCBiZSA+MCcpO1xuICAgICAgICBpZiAodHlwZW9mIGxhc3QgPT09ICdudW1iZXInKSB0aHJvdyBFcnJvcignQWRqYWNlbnQgc2tpcCBjb21wb25lbnRzIHNob3VsZCBiZSBjb21iaW5lZCcpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgbGFzdCA9IGM7XG4gIH1cblxuICBpZiAodHlwZW9mIGxhc3QgPT09ICdudW1iZXInKSB0aHJvdyBFcnJvcignT3AgaGFzIGEgdHJhaWxpbmcgc2tpcCcpO1xufTtcblxuLyoqIENoZWNrIHRoYXQgdGhlIGdpdmVuIHNlbGVjdGlvbiByYW5nZSBpcyB2YWxpZC4gKi9cbnZhciBjaGVja1NlbGVjdGlvbiA9IGZ1bmN0aW9uKHNlbGVjdGlvbikge1xuICAvLyBUaGlzIG1heSB0aHJvdyBmcm9tIHNpbXBseSBpbnNwZWN0aW5nIHNlbGVjdGlvblswXSAvIHNlbGVjdGlvblsxXS4gVGhhdHNcbiAgLy8gc29ydCBvZiBvaywgdGhvdWdoIGl0J2xsIGdlbmVyYXRlIHRoZSB3cm9uZyBtZXNzYWdlLlxuICBpZiAodHlwZW9mIHNlbGVjdGlvbiAhPT0gJ251bWJlcidcbiAgICAgICYmICh0eXBlb2Ygc2VsZWN0aW9uWzBdICE9PSAnbnVtYmVyJyB8fCB0eXBlb2Ygc2VsZWN0aW9uWzFdICE9PSAnbnVtYmVyJykpXG4gICAgdGhyb3cgRXJyb3IoJ0ludmFsaWQgc2VsZWN0aW9uJyk7XG59O1xuXG4vKiogTWFrZSBhIGZ1bmN0aW9uIHRoYXQgYXBwZW5kcyB0byB0aGUgZ2l2ZW4gb3BlcmF0aW9uLiAqL1xudmFyIG1ha2VBcHBlbmQgPSBmdW5jdGlvbihvcCkge1xuICByZXR1cm4gZnVuY3Rpb24oY29tcG9uZW50KSB7XG4gICAgaWYgKCFjb21wb25lbnQgfHwgY29tcG9uZW50LmQgPT09IDApIHtcbiAgICAgIC8vIFRoZSBjb21wb25lbnQgaXMgYSBuby1vcC4gSWdub3JlIVxuIFxuICAgIH0gZWxzZSBpZiAob3AubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gb3AucHVzaChjb21wb25lbnQpO1xuXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgY29tcG9uZW50ID09PSB0eXBlb2Ygb3Bbb3AubGVuZ3RoIC0gMV0pIHtcbiAgICAgIGlmICh0eXBlb2YgY29tcG9uZW50ID09PSAnb2JqZWN0Jykge1xuICAgICAgICByZXR1cm4gb3Bbb3AubGVuZ3RoIC0gMV0uZCArPSBjb21wb25lbnQuZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBvcFtvcC5sZW5ndGggLSAxXSArPSBjb21wb25lbnQ7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBvcC5wdXNoKGNvbXBvbmVudCk7XG4gICAgfVxuICB9O1xufTtcblxuLyoqIE1ha2VzIGFuZCByZXR1cm5zIHV0aWxpdHkgZnVuY3Rpb25zIHRha2UgYW5kIHBlZWsuICovXG52YXIgbWFrZVRha2UgPSBmdW5jdGlvbihvcCkge1xuICAvLyBUaGUgaW5kZXggb2YgdGhlIG5leHQgY29tcG9uZW50IHRvIHRha2VcbiAgdmFyIGlkeCA9IDA7XG4gIC8vIFRoZSBvZmZzZXQgaW50byB0aGUgY29tcG9uZW50XG4gIHZhciBvZmZzZXQgPSAwO1xuXG4gIC8vIFRha2UgdXAgdG8gbGVuZ3RoIG4gZnJvbSB0aGUgZnJvbnQgb2Ygb3AuIElmIG4gaXMgLTEsIHRha2UgdGhlIGVudGlyZSBuZXh0XG4gIC8vIG9wIGNvbXBvbmVudC4gSWYgaW5kaXZpc2FibGVGaWVsZCA9PSAnZCcsIGRlbGV0ZSBjb21wb25lbnRzIHdvbid0IGJlIHNlcGFyYXRlZC5cbiAgLy8gSWYgaW5kaXZpc2FibGVGaWVsZCA9PSAnaScsIGluc2VydCBjb21wb25lbnRzIHdvbid0IGJlIHNlcGFyYXRlZC5cbiAgdmFyIHRha2UgPSBmdW5jdGlvbihuLCBpbmRpdmlzYWJsZUZpZWxkKSB7XG4gICAgLy8gV2UncmUgYXQgdGhlIGVuZCBvZiB0aGUgb3BlcmF0aW9uLiBUaGUgb3AgaGFzIHNraXBzLCBmb3JldmVyLiBJbmZpbml0eVxuICAgIC8vIG1pZ2h0IG1ha2UgbW9yZSBzZW5zZSB0aGFuIG51bGwgaGVyZS5cbiAgICBpZiAoaWR4ID09PSBvcC5sZW5ndGgpXG4gICAgICByZXR1cm4gbiA9PT0gLTEgPyBudWxsIDogbjtcblxuICAgIHZhciBwYXJ0O1xuICAgIHZhciBjID0gb3BbaWR4XTtcbiAgICBpZiAodHlwZW9mIGMgPT09ICdudW1iZXInKSB7XG4gICAgICAvLyBTa2lwXG4gICAgICBpZiAobiA9PT0gLTEgfHwgYyAtIG9mZnNldCA8PSBuKSB7XG4gICAgICAgIHBhcnQgPSBjIC0gb2Zmc2V0O1xuICAgICAgICArK2lkeDtcbiAgICAgICAgb2Zmc2V0ID0gMDtcbiAgICAgICAgcmV0dXJuIHBhcnQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvZmZzZXQgKz0gbjtcbiAgICAgICAgcmV0dXJuIG47XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgYyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIEluc2VydFxuICAgICAgaWYgKG4gPT09IC0xIHx8IGluZGl2aXNhYmxlRmllbGQgPT09ICdpJyB8fCBjLmxlbmd0aCAtIG9mZnNldCA8PSBuKSB7XG4gICAgICAgIHBhcnQgPSBjLnNsaWNlKG9mZnNldCk7XG4gICAgICAgICsraWR4O1xuICAgICAgICBvZmZzZXQgPSAwO1xuICAgICAgICByZXR1cm4gcGFydDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBhcnQgPSBjLnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgbik7XG4gICAgICAgIG9mZnNldCArPSBuO1xuICAgICAgICByZXR1cm4gcGFydDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGVsZXRlXG4gICAgICBpZiAobiA9PT0gLTEgfHwgaW5kaXZpc2FibGVGaWVsZCA9PT0gJ2QnIHx8IGMuZCAtIG9mZnNldCA8PSBuKSB7XG4gICAgICAgIHBhcnQgPSB7ZDogYy5kIC0gb2Zmc2V0fTtcbiAgICAgICAgKytpZHg7XG4gICAgICAgIG9mZnNldCA9IDA7XG4gICAgICAgIHJldHVybiBwYXJ0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2Zmc2V0ICs9IG47XG4gICAgICAgIHJldHVybiB7ZDogbn07XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIC8vIFBlZWsgYXQgdGhlIG5leHQgb3AgdGhhdCB3aWxsIGJlIHJldHVybmVkLlxuICB2YXIgcGVla1R5cGUgPSBmdW5jdGlvbigpIHsgcmV0dXJuIG9wW2lkeF07IH07XG5cbiAgcmV0dXJuIFt0YWtlLCBwZWVrVHlwZV07XG59O1xuXG4vKiogR2V0IHRoZSBsZW5ndGggb2YgYSBjb21wb25lbnQgKi9cbnZhciBjb21wb25lbnRMZW5ndGggPSBmdW5jdGlvbihjKSB7XG4gIC8vIFVnbGlmeSB3aWxsIGNvbXByZXNzIHRoaXMgZG93biBpbnRvIGEgdGVybmFyeVxuICBpZiAodHlwZW9mIGMgPT09ICdudW1iZXInKSB7XG4gICAgcmV0dXJuIGM7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGMubGVuZ3RoIHx8IGMuZDtcbiAgfVxufTtcblxuLyoqIFRyaW0gYW55IGV4Y2VzcyBza2lwcyBmcm9tIHRoZSBlbmQgb2YgYW4gb3BlcmF0aW9uLlxuICpcbiAqIFRoZXJlIHNob3VsZCBvbmx5IGJlIGF0IG1vc3Qgb25lLCBiZWNhdXNlIHRoZSBvcGVyYXRpb24gd2FzIG1hZGUgd2l0aCBhcHBlbmQuXG4gKi9cbnZhciB0cmltID0gZnVuY3Rpb24ob3ApIHtcbiAgaWYgKG9wLmxlbmd0aCA+IDAgJiYgdHlwZW9mIG9wW29wLmxlbmd0aCAtIDFdID09PSAnbnVtYmVyJykge1xuICAgIG9wLnBvcCgpO1xuICB9XG4gIHJldHVybiBvcDtcbn07XG5cbmV4cG9ydHMubm9ybWFsaXplID0gZnVuY3Rpb24ob3ApIHtcbiAgdmFyIG5ld09wID0gW107XG4gIHZhciBhcHBlbmQgPSBtYWtlQXBwZW5kKG5ld09wKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5sZW5ndGg7IGkrKykge1xuICAgIGFwcGVuZChvcFtpXSk7XG4gIH1cbiAgcmV0dXJuIHRyaW0obmV3T3ApO1xufTtcblxuLyoqIEFwcGx5IGFuIG9wZXJhdGlvbiB0byBhIGRvY3VtZW50IHNuYXBzaG90ICovXG5leHBvcnRzLmFwcGx5ID0gZnVuY3Rpb24oc3RyLCBvcCkge1xuICBpZiAodHlwZW9mIHN0ciAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBFcnJvcignU25hcHNob3Qgc2hvdWxkIGJlIGEgc3RyaW5nJyk7XG4gIH1cbiAgY2hlY2tPcChvcCk7XG5cbiAgLy8gV2UnbGwgZ2F0aGVyIHRoZSBuZXcgZG9jdW1lbnQgaGVyZSBhbmQgam9pbiBhdCB0aGUgZW5kLlxuICB2YXIgbmV3RG9jID0gW107XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBjb21wb25lbnQgPSBvcFtpXTtcbiAgICBzd2l0Y2ggKHR5cGVvZiBjb21wb25lbnQpIHtcbiAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAgIGlmIChjb21wb25lbnQgPiBzdHIubGVuZ3RoKSB0aHJvdyBFcnJvcignVGhlIG9wIGlzIHRvbyBsb25nIGZvciB0aGlzIGRvY3VtZW50Jyk7XG5cbiAgICAgICAgbmV3RG9jLnB1c2goc3RyLnNsaWNlKDAsIGNvbXBvbmVudCkpO1xuICAgICAgICAvLyBUaGlzIG1pZ2h0IGJlIHNsb3cgZm9yIGJpZyBzdHJpbmdzLiBDb25zaWRlciBzdG9yaW5nIHRoZSBvZmZzZXQgaW5cbiAgICAgICAgLy8gc3RyIGluc3RlYWQgb2YgcmV3cml0aW5nIGl0IGVhY2ggdGltZS5cbiAgICAgICAgc3RyID0gc3RyLnNsaWNlKGNvbXBvbmVudCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgbmV3RG9jLnB1c2goY29tcG9uZW50KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICBzdHIgPSBzdHIuc2xpY2UoY29tcG9uZW50LmQpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmV3RG9jLmpvaW4oJycpICsgc3RyO1xufTtcblxuLyoqIFRyYW5zZm9ybSBvcCBieSBvdGhlck9wLlxuICpcbiAqIEBwYXJhbSBvcCAtIFRoZSBvcGVyYXRpb24gdG8gdHJhbnNmb3JtXG4gKiBAcGFyYW0gb3RoZXJPcCAtIE9wZXJhdGlvbiB0byB0cmFuc2Zvcm0gaXQgYnlcbiAqIEBwYXJhbSBzaWRlIC0gRWl0aGVyICdsZWZ0JyBvciAncmlnaHQnXG4gKi9cbmV4cG9ydHMudHJhbnNmb3JtID0gZnVuY3Rpb24ob3AsIG90aGVyT3AsIHNpZGUpIHtcbiAgaWYgKHNpZGUgIT0gJ2xlZnQnICYmIHNpZGUgIT0gJ3JpZ2h0JykgdGhyb3cgRXJyb3IoXCJzaWRlIChcIiArIHNpZGUgKyBcIikgbXVzdCBiZSAnbGVmdCcgb3IgJ3JpZ2h0J1wiKTtcblxuICBjaGVja09wKG9wKTtcbiAgY2hlY2tPcChvdGhlck9wKTtcblxuICB2YXIgbmV3T3AgPSBbXTtcbiAgdmFyIGFwcGVuZCA9IG1ha2VBcHBlbmQobmV3T3ApO1xuXG4gIHZhciBfZm5zID0gbWFrZVRha2Uob3ApO1xuICB2YXIgdGFrZSA9IF9mbnNbMF0sXG4gICAgICBwZWVrID0gX2Zuc1sxXTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IG90aGVyT3AubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgY29tcG9uZW50ID0gb3RoZXJPcFtpXTtcblxuICAgIHZhciBsZW5ndGgsIGNodW5rO1xuICAgIHN3aXRjaCAodHlwZW9mIGNvbXBvbmVudCkge1xuICAgICAgY2FzZSAnbnVtYmVyJzogLy8gU2tpcFxuICAgICAgICBsZW5ndGggPSBjb21wb25lbnQ7XG4gICAgICAgIHdoaWxlIChsZW5ndGggPiAwKSB7XG4gICAgICAgICAgY2h1bmsgPSB0YWtlKGxlbmd0aCwgJ2knKTtcbiAgICAgICAgICBhcHBlbmQoY2h1bmspO1xuICAgICAgICAgIGlmICh0eXBlb2YgY2h1bmsgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBsZW5ndGggLT0gY29tcG9uZW50TGVuZ3RoKGNodW5rKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ3N0cmluZyc6IC8vIEluc2VydFxuICAgICAgICBpZiAoc2lkZSA9PT0gJ2xlZnQnKSB7XG4gICAgICAgICAgLy8gVGhlIGxlZnQgaW5zZXJ0IHNob3VsZCBnbyBmaXJzdC5cbiAgICAgICAgICBpZiAodHlwZW9mIHBlZWsoKSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGFwcGVuZCh0YWtlKC0xKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gT3RoZXJ3aXNlIHNraXAgdGhlIGluc2VydGVkIHRleHQuXG4gICAgICAgIGFwcGVuZChjb21wb25lbnQubGVuZ3RoKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ29iamVjdCc6IC8vIERlbGV0ZVxuICAgICAgICBsZW5ndGggPSBjb21wb25lbnQuZDtcbiAgICAgICAgd2hpbGUgKGxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjaHVuayA9IHRha2UobGVuZ3RoLCAnaScpO1xuICAgICAgICAgIHN3aXRjaCAodHlwZW9mIGNodW5rKSB7XG4gICAgICAgICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICAgICAgICBsZW5ndGggLT0gY2h1bms7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgICAgICAgYXBwZW5kKGNodW5rKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICAgICAgICAvLyBUaGUgZGVsZXRlIGlzIHVubmVjZXNzYXJ5IG5vdyAtIHRoZSB0ZXh0IGhhcyBhbHJlYWR5IGJlZW4gZGVsZXRlZC5cbiAgICAgICAgICAgICAgbGVuZ3RoIC09IGNodW5rLmQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICBcbiAgLy8gQXBwZW5kIGFueSBleHRyYSBkYXRhIGluIG9wMS5cbiAgd2hpbGUgKChjb21wb25lbnQgPSB0YWtlKC0xKSkpXG4gICAgYXBwZW5kKGNvbXBvbmVudCk7XG4gIFxuICByZXR1cm4gdHJpbShuZXdPcCk7XG59O1xuXG4vKiogQ29tcG9zZSBvcDEgYW5kIG9wMiB0b2dldGhlciBhbmQgcmV0dXJuIHRoZSByZXN1bHQgKi9cbmV4cG9ydHMuY29tcG9zZSA9IGZ1bmN0aW9uKG9wMSwgb3AyKSB7XG4gIGNoZWNrT3Aob3AxKTtcbiAgY2hlY2tPcChvcDIpO1xuXG4gIHZhciByZXN1bHQgPSBbXTtcbiAgdmFyIGFwcGVuZCA9IG1ha2VBcHBlbmQocmVzdWx0KTtcbiAgdmFyIHRha2UgPSBtYWtlVGFrZShvcDEpWzBdO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AyLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGNvbXBvbmVudCA9IG9wMltpXTtcbiAgICB2YXIgbGVuZ3RoLCBjaHVuaztcbiAgICBzd2l0Y2ggKHR5cGVvZiBjb21wb25lbnQpIHtcbiAgICAgIGNhc2UgJ251bWJlcic6IC8vIFNraXBcbiAgICAgICAgbGVuZ3RoID0gY29tcG9uZW50O1xuICAgICAgICB3aGlsZSAobGVuZ3RoID4gMCkge1xuICAgICAgICAgIGNodW5rID0gdGFrZShsZW5ndGgsICdkJyk7XG4gICAgICAgICAgYXBwZW5kKGNodW5rKTtcbiAgICAgICAgICBpZiAodHlwZW9mIGNodW5rICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgbGVuZ3RoIC09IGNvbXBvbmVudExlbmd0aChjaHVuayk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdzdHJpbmcnOiAvLyBJbnNlcnRcbiAgICAgICAgYXBwZW5kKGNvbXBvbmVudCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdvYmplY3QnOiAvLyBEZWxldGVcbiAgICAgICAgbGVuZ3RoID0gY29tcG9uZW50LmQ7XG5cbiAgICAgICAgd2hpbGUgKGxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjaHVuayA9IHRha2UobGVuZ3RoLCAnZCcpO1xuXG4gICAgICAgICAgc3dpdGNoICh0eXBlb2YgY2h1bmspIHtcbiAgICAgICAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAgICAgICAgIGFwcGVuZCh7ZDogY2h1bmt9KTtcbiAgICAgICAgICAgICAgbGVuZ3RoIC09IGNodW5rO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgICAgIGxlbmd0aCAtPSBjaHVuay5sZW5ndGg7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgICAgICAgICAgYXBwZW5kKGNodW5rKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgd2hpbGUgKChjb21wb25lbnQgPSB0YWtlKC0xKSkpXG4gICAgYXBwZW5kKGNvbXBvbmVudCk7XG5cbiAgcmV0dXJuIHRyaW0ocmVzdWx0KTtcbn07XG5cblxudmFyIHRyYW5zZm9ybVBvc2l0aW9uID0gZnVuY3Rpb24oY3Vyc29yLCBvcCkge1xuICB2YXIgcG9zID0gMDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBjID0gb3BbaV07XG4gICAgaWYgKGN1cnNvciA8PSBwb3MpIGJyZWFrO1xuXG4gICAgLy8gSSBjb3VsZCBhY3R1YWxseSB1c2UgdGhlIG9wX2l0ZXIgc3R1ZmYgYWJvdmUgLSBidXQgSSB0aGluayBpdHMgc2ltcGxlclxuICAgIC8vIGxpa2UgdGhpcy5cbiAgICBzd2l0Y2ggKHR5cGVvZiBjKSB7XG4gICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICBpZiAoY3Vyc29yIDw9IHBvcyArIGMpXG4gICAgICAgICAgcmV0dXJuIGN1cnNvcjtcbiAgICAgICAgcG9zICs9IGM7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICBwb3MgKz0gYy5sZW5ndGg7XG4gICAgICAgIGN1cnNvciArPSBjLmxlbmd0aDtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgIGN1cnNvciAtPSBNYXRoLm1pbihjLmQsIGN1cnNvciAtIHBvcyk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gY3Vyc29yO1xufTtcblxuZXhwb3J0cy50cmFuc2Zvcm1TZWxlY3Rpb24gPSBmdW5jdGlvbihzZWxlY3Rpb24sIG9wLCBpc093bk9wKSB7XG4gIHZhciBwb3MgPSAwO1xuICBpZiAoaXNPd25PcCkge1xuICAgIC8vIEp1c3QgdHJhY2sgdGhlIHBvc2l0aW9uLiBXZSdsbCB0ZWxlcG9ydCB0aGUgY3Vyc29yIHRvIHRoZSBlbmQgYW55d2F5LlxuICAgIC8vIFRoaXMgd29ya3MgYmVjYXVzZSB0ZXh0IG9wcyBkb24ndCBoYXZlIGFueSB0cmFpbGluZyBza2lwcyBhdCB0aGUgZW5kIC0gc28gdGhlIGxhc3RcbiAgICAvLyBjb21wb25lbnQgaXMgdGhlIGxhc3QgdGhpbmcuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGMgPSBvcFtpXTtcbiAgICAgIHN3aXRjaCAodHlwZW9mIGMpIHtcbiAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICBwb3MgKz0gYztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgICBwb3MgKz0gYy5sZW5ndGg7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vIEp1c3QgZWF0IGRlbGV0ZXMuXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBwb3M7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHR5cGVvZiBzZWxlY3Rpb24gPT09ICdudW1iZXInID9cbiAgICAgIHRyYW5zZm9ybVBvc2l0aW9uKHNlbGVjdGlvbiwgb3ApIDogW3RyYW5zZm9ybVBvc2l0aW9uKHNlbGVjdGlvblswXSwgb3ApLCB0cmFuc2Zvcm1Qb3NpdGlvbihzZWxlY3Rpb25bMV0sIG9wKV07XG4gIH1cbn07XG5cbmV4cG9ydHMuc2VsZWN0aW9uRXEgPSBmdW5jdGlvbihjMSwgYzIpIHtcbiAgaWYgKGMxWzBdICE9IG51bGwgJiYgYzFbMF0gPT09IGMxWzFdKSBjMSA9IGMxWzBdO1xuICBpZiAoYzJbMF0gIT0gbnVsbCAmJiBjMlswXSA9PT0gYzJbMV0pIGMyID0gYzJbMF07XG4gIHJldHVybiBjMSA9PT0gYzIgfHwgKGMxWzBdICE9IG51bGwgJiYgYzJbMF0gIT0gbnVsbCAmJiBjMVswXSA9PT0gYzJbMF0gJiYgYzFbMV0gPT0gYzJbMV0pO1xufTtcblxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXRUaW1vdXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG5mdW5jdGlvbiBkZWZhdWx0Q2xlYXJUaW1lb3V0ICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGNsZWFyVGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICB9XG59ICgpKVxuZnVuY3Rpb24gcnVuVGltZW91dChmdW4pIHtcbiAgICBpZiAoY2FjaGVkU2V0VGltZW91dCA9PT0gc2V0VGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgLy8gaWYgc2V0VGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZFNldFRpbWVvdXQgPT09IGRlZmF1bHRTZXRUaW1vdXQgfHwgIWNhY2hlZFNldFRpbWVvdXQpICYmIHNldFRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9IGNhdGNoKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0IHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKG51bGwsIGZ1biwgMCk7XG4gICAgICAgIH0gY2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbCh0aGlzLCBmdW4sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn1cbmZ1bmN0aW9uIHJ1bkNsZWFyVGltZW91dChtYXJrZXIpIHtcbiAgICBpZiAoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgLy8gaWYgY2xlYXJUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBkZWZhdWx0Q2xlYXJUaW1lb3V0IHx8ICFjYWNoZWRDbGVhclRpbWVvdXQpICYmIGNsZWFyVGltZW91dCkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfSBjYXRjaCAoZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgIHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwobnVsbCwgbWFya2VyKTtcbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvci5cbiAgICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgSS5FLiBoYXZlIGRpZmZlcmVudCBydWxlcyBmb3IgY2xlYXJUaW1lb3V0IHZzIHNldFRpbWVvdXRcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbCh0aGlzLCBtYXJrZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cblxufVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gcnVuVGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgcnVuQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgcnVuVGltZW91dChkcmFpblF1ZXVlKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsInZhciBkaWZmID0gcmVxdWlyZSgnZmFzdC1kaWZmJyk7XG52YXIgZXF1YWwgPSByZXF1aXJlKCdkZWVwLWVxdWFsJyk7XG52YXIgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyk7XG52YXIgb3AgPSByZXF1aXJlKCcuL29wJyk7XG5cblxudmFyIE5VTExfQ0hBUkFDVEVSID0gU3RyaW5nLmZyb21DaGFyQ29kZSgwKTsgIC8vIFBsYWNlaG9sZGVyIGNoYXIgZm9yIGVtYmVkIGluIGRpZmYoKVxuXG5cbnZhciBEZWx0YSA9IGZ1bmN0aW9uIChvcHMpIHtcbiAgLy8gQXNzdW1lIHdlIGFyZSBnaXZlbiBhIHdlbGwgZm9ybWVkIG9wc1xuICBpZiAoQXJyYXkuaXNBcnJheShvcHMpKSB7XG4gICAgdGhpcy5vcHMgPSBvcHM7XG4gIH0gZWxzZSBpZiAob3BzICE9IG51bGwgJiYgQXJyYXkuaXNBcnJheShvcHMub3BzKSkge1xuICAgIHRoaXMub3BzID0gb3BzLm9wcztcbiAgfSBlbHNlIHtcbiAgICB0aGlzLm9wcyA9IFtdO1xuICB9XG59O1xuXG5cbkRlbHRhLnByb3RvdHlwZS5pbnNlcnQgPSBmdW5jdGlvbiAodGV4dCwgYXR0cmlidXRlcykge1xuICB2YXIgbmV3T3AgPSB7fTtcbiAgaWYgKHRleHQubGVuZ3RoID09PSAwKSByZXR1cm4gdGhpcztcbiAgbmV3T3AuaW5zZXJ0ID0gdGV4dDtcbiAgaWYgKGF0dHJpYnV0ZXMgIT0gbnVsbCAmJiB0eXBlb2YgYXR0cmlidXRlcyA9PT0gJ29iamVjdCcgJiYgT2JqZWN0LmtleXMoYXR0cmlidXRlcykubGVuZ3RoID4gMCkge1xuICAgIG5ld09wLmF0dHJpYnV0ZXMgPSBhdHRyaWJ1dGVzO1xuICB9XG4gIHJldHVybiB0aGlzLnB1c2gobmV3T3ApO1xufTtcblxuRGVsdGEucHJvdG90eXBlWydkZWxldGUnXSA9IGZ1bmN0aW9uIChsZW5ndGgpIHtcbiAgaWYgKGxlbmd0aCA8PSAwKSByZXR1cm4gdGhpcztcbiAgcmV0dXJuIHRoaXMucHVzaCh7ICdkZWxldGUnOiBsZW5ndGggfSk7XG59O1xuXG5EZWx0YS5wcm90b3R5cGUucmV0YWluID0gZnVuY3Rpb24gKGxlbmd0aCwgYXR0cmlidXRlcykge1xuICBpZiAobGVuZ3RoIDw9IDApIHJldHVybiB0aGlzO1xuICB2YXIgbmV3T3AgPSB7IHJldGFpbjogbGVuZ3RoIH07XG4gIGlmIChhdHRyaWJ1dGVzICE9IG51bGwgJiYgdHlwZW9mIGF0dHJpYnV0ZXMgPT09ICdvYmplY3QnICYmIE9iamVjdC5rZXlzKGF0dHJpYnV0ZXMpLmxlbmd0aCA+IDApIHtcbiAgICBuZXdPcC5hdHRyaWJ1dGVzID0gYXR0cmlidXRlcztcbiAgfVxuICByZXR1cm4gdGhpcy5wdXNoKG5ld09wKTtcbn07XG5cbkRlbHRhLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24gKG5ld09wKSB7XG4gIHZhciBpbmRleCA9IHRoaXMub3BzLmxlbmd0aDtcbiAgdmFyIGxhc3RPcCA9IHRoaXMub3BzW2luZGV4IC0gMV07XG4gIG5ld09wID0gZXh0ZW5kKHRydWUsIHt9LCBuZXdPcCk7XG4gIGlmICh0eXBlb2YgbGFzdE9wID09PSAnb2JqZWN0Jykge1xuICAgIGlmICh0eXBlb2YgbmV3T3BbJ2RlbGV0ZSddID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgbGFzdE9wWydkZWxldGUnXSA9PT0gJ251bWJlcicpIHtcbiAgICAgIHRoaXMub3BzW2luZGV4IC0gMV0gPSB7ICdkZWxldGUnOiBsYXN0T3BbJ2RlbGV0ZSddICsgbmV3T3BbJ2RlbGV0ZSddIH07XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgLy8gU2luY2UgaXQgZG9lcyBub3QgbWF0dGVyIGlmIHdlIGluc2VydCBiZWZvcmUgb3IgYWZ0ZXIgZGVsZXRpbmcgYXQgdGhlIHNhbWUgaW5kZXgsXG4gICAgLy8gYWx3YXlzIHByZWZlciB0byBpbnNlcnQgZmlyc3RcbiAgICBpZiAodHlwZW9mIGxhc3RPcFsnZGVsZXRlJ10gPT09ICdudW1iZXInICYmIG5ld09wLmluc2VydCAhPSBudWxsKSB7XG4gICAgICBpbmRleCAtPSAxO1xuICAgICAgbGFzdE9wID0gdGhpcy5vcHNbaW5kZXggLSAxXTtcbiAgICAgIGlmICh0eXBlb2YgbGFzdE9wICE9PSAnb2JqZWN0Jykge1xuICAgICAgICB0aGlzLm9wcy51bnNoaWZ0KG5ld09wKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChlcXVhbChuZXdPcC5hdHRyaWJ1dGVzLCBsYXN0T3AuYXR0cmlidXRlcykpIHtcbiAgICAgIGlmICh0eXBlb2YgbmV3T3AuaW5zZXJ0ID09PSAnc3RyaW5nJyAmJiB0eXBlb2YgbGFzdE9wLmluc2VydCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5vcHNbaW5kZXggLSAxXSA9IHsgaW5zZXJ0OiBsYXN0T3AuaW5zZXJ0ICsgbmV3T3AuaW5zZXJ0IH07XG4gICAgICAgIGlmICh0eXBlb2YgbmV3T3AuYXR0cmlidXRlcyA9PT0gJ29iamVjdCcpIHRoaXMub3BzW2luZGV4IC0gMV0uYXR0cmlidXRlcyA9IG5ld09wLmF0dHJpYnV0ZXNcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBuZXdPcC5yZXRhaW4gPT09ICdudW1iZXInICYmIHR5cGVvZiBsYXN0T3AucmV0YWluID09PSAnbnVtYmVyJykge1xuICAgICAgICB0aGlzLm9wc1tpbmRleCAtIDFdID0geyByZXRhaW46IGxhc3RPcC5yZXRhaW4gKyBuZXdPcC5yZXRhaW4gfTtcbiAgICAgICAgaWYgKHR5cGVvZiBuZXdPcC5hdHRyaWJ1dGVzID09PSAnb2JqZWN0JykgdGhpcy5vcHNbaW5kZXggLSAxXS5hdHRyaWJ1dGVzID0gbmV3T3AuYXR0cmlidXRlc1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKGluZGV4ID09PSB0aGlzLm9wcy5sZW5ndGgpIHtcbiAgICB0aGlzLm9wcy5wdXNoKG5ld09wKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLm9wcy5zcGxpY2UoaW5kZXgsIDAsIG5ld09wKTtcbiAgfVxuICByZXR1cm4gdGhpcztcbn07XG5cbkRlbHRhLnByb3RvdHlwZS5maWx0ZXIgPSBmdW5jdGlvbiAocHJlZGljYXRlKSB7XG4gIHJldHVybiB0aGlzLm9wcy5maWx0ZXIocHJlZGljYXRlKTtcbn07XG5cbkRlbHRhLnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24gKHByZWRpY2F0ZSkge1xuICB0aGlzLm9wcy5mb3JFYWNoKHByZWRpY2F0ZSk7XG59O1xuXG5EZWx0YS5wcm90b3R5cGUubWFwID0gZnVuY3Rpb24gKHByZWRpY2F0ZSkge1xuICByZXR1cm4gdGhpcy5vcHMubWFwKHByZWRpY2F0ZSk7XG59O1xuXG5EZWx0YS5wcm90b3R5cGUucGFydGl0aW9uID0gZnVuY3Rpb24gKHByZWRpY2F0ZSkge1xuICB2YXIgcGFzc2VkID0gW10sIGZhaWxlZCA9IFtdO1xuICB0aGlzLmZvckVhY2goZnVuY3Rpb24ob3ApIHtcbiAgICB2YXIgdGFyZ2V0ID0gcHJlZGljYXRlKG9wKSA/IHBhc3NlZCA6IGZhaWxlZDtcbiAgICB0YXJnZXQucHVzaChvcCk7XG4gIH0pO1xuICByZXR1cm4gW3Bhc3NlZCwgZmFpbGVkXTtcbn07XG5cbkRlbHRhLnByb3RvdHlwZS5yZWR1Y2UgPSBmdW5jdGlvbiAocHJlZGljYXRlLCBpbml0aWFsKSB7XG4gIHJldHVybiB0aGlzLm9wcy5yZWR1Y2UocHJlZGljYXRlLCBpbml0aWFsKTtcbn07XG5cbkRlbHRhLnByb3RvdHlwZS5jaG9wID0gZnVuY3Rpb24gKCkge1xuICB2YXIgbGFzdE9wID0gdGhpcy5vcHNbdGhpcy5vcHMubGVuZ3RoIC0gMV07XG4gIGlmIChsYXN0T3AgJiYgbGFzdE9wLnJldGFpbiAmJiAhbGFzdE9wLmF0dHJpYnV0ZXMpIHtcbiAgICB0aGlzLm9wcy5wb3AoKTtcbiAgfVxuICByZXR1cm4gdGhpcztcbn07XG5cbkRlbHRhLnByb3RvdHlwZS5sZW5ndGggPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLnJlZHVjZShmdW5jdGlvbiAobGVuZ3RoLCBlbGVtKSB7XG4gICAgcmV0dXJuIGxlbmd0aCArIG9wLmxlbmd0aChlbGVtKTtcbiAgfSwgMCk7XG59O1xuXG5EZWx0YS5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCkge1xuICBzdGFydCA9IHN0YXJ0IHx8IDA7XG4gIGlmICh0eXBlb2YgZW5kICE9PSAnbnVtYmVyJykgZW5kID0gSW5maW5pdHk7XG4gIHZhciBvcHMgPSBbXTtcbiAgdmFyIGl0ZXIgPSBvcC5pdGVyYXRvcih0aGlzLm9wcyk7XG4gIHZhciBpbmRleCA9IDA7XG4gIHdoaWxlIChpbmRleCA8IGVuZCAmJiBpdGVyLmhhc05leHQoKSkge1xuICAgIHZhciBuZXh0T3A7XG4gICAgaWYgKGluZGV4IDwgc3RhcnQpIHtcbiAgICAgIG5leHRPcCA9IGl0ZXIubmV4dChzdGFydCAtIGluZGV4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV4dE9wID0gaXRlci5uZXh0KGVuZCAtIGluZGV4KTtcbiAgICAgIG9wcy5wdXNoKG5leHRPcCk7XG4gICAgfVxuICAgIGluZGV4ICs9IG9wLmxlbmd0aChuZXh0T3ApO1xuICB9XG4gIHJldHVybiBuZXcgRGVsdGEob3BzKTtcbn07XG5cblxuRGVsdGEucHJvdG90eXBlLmNvbXBvc2UgPSBmdW5jdGlvbiAob3RoZXIpIHtcbiAgdmFyIHRoaXNJdGVyID0gb3AuaXRlcmF0b3IodGhpcy5vcHMpO1xuICB2YXIgb3RoZXJJdGVyID0gb3AuaXRlcmF0b3Iob3RoZXIub3BzKTtcbiAgdmFyIGRlbHRhID0gbmV3IERlbHRhKCk7XG4gIHdoaWxlICh0aGlzSXRlci5oYXNOZXh0KCkgfHwgb3RoZXJJdGVyLmhhc05leHQoKSkge1xuICAgIGlmIChvdGhlckl0ZXIucGVla1R5cGUoKSA9PT0gJ2luc2VydCcpIHtcbiAgICAgIGRlbHRhLnB1c2gob3RoZXJJdGVyLm5leHQoKSk7XG4gICAgfSBlbHNlIGlmICh0aGlzSXRlci5wZWVrVHlwZSgpID09PSAnZGVsZXRlJykge1xuICAgICAgZGVsdGEucHVzaCh0aGlzSXRlci5uZXh0KCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgbGVuZ3RoID0gTWF0aC5taW4odGhpc0l0ZXIucGVla0xlbmd0aCgpLCBvdGhlckl0ZXIucGVla0xlbmd0aCgpKTtcbiAgICAgIHZhciB0aGlzT3AgPSB0aGlzSXRlci5uZXh0KGxlbmd0aCk7XG4gICAgICB2YXIgb3RoZXJPcCA9IG90aGVySXRlci5uZXh0KGxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIG90aGVyT3AucmV0YWluID09PSAnbnVtYmVyJykge1xuICAgICAgICB2YXIgbmV3T3AgPSB7fTtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzT3AucmV0YWluID09PSAnbnVtYmVyJykge1xuICAgICAgICAgIG5ld09wLnJldGFpbiA9IGxlbmd0aDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdPcC5pbnNlcnQgPSB0aGlzT3AuaW5zZXJ0O1xuICAgICAgICB9XG4gICAgICAgIC8vIFByZXNlcnZlIG51bGwgd2hlbiBjb21wb3Npbmcgd2l0aCBhIHJldGFpbiwgb3RoZXJ3aXNlIHJlbW92ZSBpdCBmb3IgaW5zZXJ0c1xuICAgICAgICB2YXIgYXR0cmlidXRlcyA9IG9wLmF0dHJpYnV0ZXMuY29tcG9zZSh0aGlzT3AuYXR0cmlidXRlcywgb3RoZXJPcC5hdHRyaWJ1dGVzLCB0eXBlb2YgdGhpc09wLnJldGFpbiA9PT0gJ251bWJlcicpO1xuICAgICAgICBpZiAoYXR0cmlidXRlcykgbmV3T3AuYXR0cmlidXRlcyA9IGF0dHJpYnV0ZXM7XG4gICAgICAgIGRlbHRhLnB1c2gobmV3T3ApO1xuICAgICAgLy8gT3RoZXIgb3Agc2hvdWxkIGJlIGRlbGV0ZSwgd2UgY291bGQgYmUgYW4gaW5zZXJ0IG9yIHJldGFpblxuICAgICAgLy8gSW5zZXJ0ICsgZGVsZXRlIGNhbmNlbHMgb3V0XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBvdGhlck9wWydkZWxldGUnXSA9PT0gJ251bWJlcicgJiYgdHlwZW9mIHRoaXNPcC5yZXRhaW4gPT09ICdudW1iZXInKSB7XG4gICAgICAgIGRlbHRhLnB1c2gob3RoZXJPcCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBkZWx0YS5jaG9wKCk7XG59O1xuXG5EZWx0YS5wcm90b3R5cGUuY29uY2F0ID0gZnVuY3Rpb24gKG90aGVyKSB7XG4gIHZhciBkZWx0YSA9IG5ldyBEZWx0YSh0aGlzLm9wcy5zbGljZSgpKTtcbiAgaWYgKG90aGVyLm9wcy5sZW5ndGggPiAwKSB7XG4gICAgZGVsdGEucHVzaChvdGhlci5vcHNbMF0pO1xuICAgIGRlbHRhLm9wcyA9IGRlbHRhLm9wcy5jb25jYXQob3RoZXIub3BzLnNsaWNlKDEpKTtcbiAgfVxuICByZXR1cm4gZGVsdGE7XG59O1xuXG5EZWx0YS5wcm90b3R5cGUuZGlmZiA9IGZ1bmN0aW9uIChvdGhlciwgaW5kZXgpIHtcbiAgaWYgKHRoaXMub3BzID09PSBvdGhlci5vcHMpIHtcbiAgICByZXR1cm4gbmV3IERlbHRhKCk7XG4gIH1cbiAgdmFyIHN0cmluZ3MgPSBbdGhpcywgb3RoZXJdLm1hcChmdW5jdGlvbiAoZGVsdGEpIHtcbiAgICByZXR1cm4gZGVsdGEubWFwKGZ1bmN0aW9uIChvcCkge1xuICAgICAgaWYgKG9wLmluc2VydCAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2Ygb3AuaW5zZXJ0ID09PSAnc3RyaW5nJyA/IG9wLmluc2VydCA6IE5VTExfQ0hBUkFDVEVSO1xuICAgICAgfVxuICAgICAgdmFyIHByZXAgPSAob3BzID09PSBvdGhlci5vcHMpID8gJ29uJyA6ICd3aXRoJztcbiAgICAgIHRocm93IG5ldyBFcnJvcignZGlmZigpIGNhbGxlZCAnICsgcHJlcCArICcgbm9uLWRvY3VtZW50Jyk7XG4gICAgfSkuam9pbignJyk7XG4gIH0pO1xuICB2YXIgZGVsdGEgPSBuZXcgRGVsdGEoKTtcbiAgdmFyIGRpZmZSZXN1bHQgPSBkaWZmKHN0cmluZ3NbMF0sIHN0cmluZ3NbMV0sIGluZGV4KTtcbiAgdmFyIHRoaXNJdGVyID0gb3AuaXRlcmF0b3IodGhpcy5vcHMpO1xuICB2YXIgb3RoZXJJdGVyID0gb3AuaXRlcmF0b3Iob3RoZXIub3BzKTtcbiAgZGlmZlJlc3VsdC5mb3JFYWNoKGZ1bmN0aW9uIChjb21wb25lbnQpIHtcbiAgICB2YXIgbGVuZ3RoID0gY29tcG9uZW50WzFdLmxlbmd0aDtcbiAgICB3aGlsZSAobGVuZ3RoID4gMCkge1xuICAgICAgdmFyIG9wTGVuZ3RoID0gMDtcbiAgICAgIHN3aXRjaCAoY29tcG9uZW50WzBdKSB7XG4gICAgICAgIGNhc2UgZGlmZi5JTlNFUlQ6XG4gICAgICAgICAgb3BMZW5ndGggPSBNYXRoLm1pbihvdGhlckl0ZXIucGVla0xlbmd0aCgpLCBsZW5ndGgpO1xuICAgICAgICAgIGRlbHRhLnB1c2gob3RoZXJJdGVyLm5leHQob3BMZW5ndGgpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBkaWZmLkRFTEVURTpcbiAgICAgICAgICBvcExlbmd0aCA9IE1hdGgubWluKGxlbmd0aCwgdGhpc0l0ZXIucGVla0xlbmd0aCgpKTtcbiAgICAgICAgICB0aGlzSXRlci5uZXh0KG9wTGVuZ3RoKTtcbiAgICAgICAgICBkZWx0YVsnZGVsZXRlJ10ob3BMZW5ndGgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIGRpZmYuRVFVQUw6XG4gICAgICAgICAgb3BMZW5ndGggPSBNYXRoLm1pbih0aGlzSXRlci5wZWVrTGVuZ3RoKCksIG90aGVySXRlci5wZWVrTGVuZ3RoKCksIGxlbmd0aCk7XG4gICAgICAgICAgdmFyIHRoaXNPcCA9IHRoaXNJdGVyLm5leHQob3BMZW5ndGgpO1xuICAgICAgICAgIHZhciBvdGhlck9wID0gb3RoZXJJdGVyLm5leHQob3BMZW5ndGgpO1xuICAgICAgICAgIGlmIChlcXVhbCh0aGlzT3AuaW5zZXJ0LCBvdGhlck9wLmluc2VydCkpIHtcbiAgICAgICAgICAgIGRlbHRhLnJldGFpbihvcExlbmd0aCwgb3AuYXR0cmlidXRlcy5kaWZmKHRoaXNPcC5hdHRyaWJ1dGVzLCBvdGhlck9wLmF0dHJpYnV0ZXMpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVsdGEucHVzaChvdGhlck9wKVsnZGVsZXRlJ10ob3BMZW5ndGgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGxlbmd0aCAtPSBvcExlbmd0aDtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gZGVsdGEuY2hvcCgpO1xufTtcblxuRGVsdGEucHJvdG90eXBlLmVhY2hMaW5lID0gZnVuY3Rpb24gKHByZWRpY2F0ZSwgbmV3bGluZSkge1xuICBuZXdsaW5lID0gbmV3bGluZSB8fCAnXFxuJztcbiAgdmFyIGl0ZXIgPSBvcC5pdGVyYXRvcih0aGlzLm9wcyk7XG4gIHZhciBsaW5lID0gbmV3IERlbHRhKCk7XG4gIHdoaWxlIChpdGVyLmhhc05leHQoKSkge1xuICAgIGlmIChpdGVyLnBlZWtUeXBlKCkgIT09ICdpbnNlcnQnKSByZXR1cm47XG4gICAgdmFyIHRoaXNPcCA9IGl0ZXIucGVlaygpO1xuICAgIHZhciBzdGFydCA9IG9wLmxlbmd0aCh0aGlzT3ApIC0gaXRlci5wZWVrTGVuZ3RoKCk7XG4gICAgdmFyIGluZGV4ID0gdHlwZW9mIHRoaXNPcC5pbnNlcnQgPT09ICdzdHJpbmcnID9cbiAgICAgIHRoaXNPcC5pbnNlcnQuaW5kZXhPZihuZXdsaW5lLCBzdGFydCkgLSBzdGFydCA6IC0xO1xuICAgIGlmIChpbmRleCA8IDApIHtcbiAgICAgIGxpbmUucHVzaChpdGVyLm5leHQoKSk7XG4gICAgfSBlbHNlIGlmIChpbmRleCA+IDApIHtcbiAgICAgIGxpbmUucHVzaChpdGVyLm5leHQoaW5kZXgpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcHJlZGljYXRlKGxpbmUsIGl0ZXIubmV4dCgxKS5hdHRyaWJ1dGVzIHx8IHt9KTtcbiAgICAgIGxpbmUgPSBuZXcgRGVsdGEoKTtcbiAgICB9XG4gIH1cbiAgaWYgKGxpbmUubGVuZ3RoKCkgPiAwKSB7XG4gICAgcHJlZGljYXRlKGxpbmUsIHt9KTtcbiAgfVxufTtcblxuRGVsdGEucHJvdG90eXBlLnRyYW5zZm9ybSA9IGZ1bmN0aW9uIChvdGhlciwgcHJpb3JpdHkpIHtcbiAgcHJpb3JpdHkgPSAhIXByaW9yaXR5O1xuICBpZiAodHlwZW9mIG90aGVyID09PSAnbnVtYmVyJykge1xuICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybVBvc2l0aW9uKG90aGVyLCBwcmlvcml0eSk7XG4gIH1cbiAgdmFyIHRoaXNJdGVyID0gb3AuaXRlcmF0b3IodGhpcy5vcHMpO1xuICB2YXIgb3RoZXJJdGVyID0gb3AuaXRlcmF0b3Iob3RoZXIub3BzKTtcbiAgdmFyIGRlbHRhID0gbmV3IERlbHRhKCk7XG4gIHdoaWxlICh0aGlzSXRlci5oYXNOZXh0KCkgfHwgb3RoZXJJdGVyLmhhc05leHQoKSkge1xuICAgIGlmICh0aGlzSXRlci5wZWVrVHlwZSgpID09PSAnaW5zZXJ0JyAmJiAocHJpb3JpdHkgfHwgb3RoZXJJdGVyLnBlZWtUeXBlKCkgIT09ICdpbnNlcnQnKSkge1xuICAgICAgZGVsdGEucmV0YWluKG9wLmxlbmd0aCh0aGlzSXRlci5uZXh0KCkpKTtcbiAgICB9IGVsc2UgaWYgKG90aGVySXRlci5wZWVrVHlwZSgpID09PSAnaW5zZXJ0Jykge1xuICAgICAgZGVsdGEucHVzaChvdGhlckl0ZXIubmV4dCgpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGxlbmd0aCA9IE1hdGgubWluKHRoaXNJdGVyLnBlZWtMZW5ndGgoKSwgb3RoZXJJdGVyLnBlZWtMZW5ndGgoKSk7XG4gICAgICB2YXIgdGhpc09wID0gdGhpc0l0ZXIubmV4dChsZW5ndGgpO1xuICAgICAgdmFyIG90aGVyT3AgPSBvdGhlckl0ZXIubmV4dChsZW5ndGgpO1xuICAgICAgaWYgKHRoaXNPcFsnZGVsZXRlJ10pIHtcbiAgICAgICAgLy8gT3VyIGRlbGV0ZSBlaXRoZXIgbWFrZXMgdGhlaXIgZGVsZXRlIHJlZHVuZGFudCBvciByZW1vdmVzIHRoZWlyIHJldGFpblxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH0gZWxzZSBpZiAob3RoZXJPcFsnZGVsZXRlJ10pIHtcbiAgICAgICAgZGVsdGEucHVzaChvdGhlck9wKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFdlIHJldGFpbiBlaXRoZXIgdGhlaXIgcmV0YWluIG9yIGluc2VydFxuICAgICAgICBkZWx0YS5yZXRhaW4obGVuZ3RoLCBvcC5hdHRyaWJ1dGVzLnRyYW5zZm9ybSh0aGlzT3AuYXR0cmlidXRlcywgb3RoZXJPcC5hdHRyaWJ1dGVzLCBwcmlvcml0eSkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gZGVsdGEuY2hvcCgpO1xufTtcblxuRGVsdGEucHJvdG90eXBlLnRyYW5zZm9ybVBvc2l0aW9uID0gZnVuY3Rpb24gKGluZGV4LCBwcmlvcml0eSkge1xuICBwcmlvcml0eSA9ICEhcHJpb3JpdHk7XG4gIHZhciB0aGlzSXRlciA9IG9wLml0ZXJhdG9yKHRoaXMub3BzKTtcbiAgdmFyIG9mZnNldCA9IDA7XG4gIHdoaWxlICh0aGlzSXRlci5oYXNOZXh0KCkgJiYgb2Zmc2V0IDw9IGluZGV4KSB7XG4gICAgdmFyIGxlbmd0aCA9IHRoaXNJdGVyLnBlZWtMZW5ndGgoKTtcbiAgICB2YXIgbmV4dFR5cGUgPSB0aGlzSXRlci5wZWVrVHlwZSgpO1xuICAgIHRoaXNJdGVyLm5leHQoKTtcbiAgICBpZiAobmV4dFR5cGUgPT09ICdkZWxldGUnKSB7XG4gICAgICBpbmRleCAtPSBNYXRoLm1pbihsZW5ndGgsIGluZGV4IC0gb2Zmc2V0KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH0gZWxzZSBpZiAobmV4dFR5cGUgPT09ICdpbnNlcnQnICYmIChvZmZzZXQgPCBpbmRleCB8fCAhcHJpb3JpdHkpKSB7XG4gICAgICBpbmRleCArPSBsZW5ndGg7XG4gICAgfVxuICAgIG9mZnNldCArPSBsZW5ndGg7XG4gIH1cbiAgcmV0dXJuIGluZGV4O1xufTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IERlbHRhO1xuIiwidmFyIGVxdWFsID0gcmVxdWlyZSgnZGVlcC1lcXVhbCcpO1xudmFyIGV4dGVuZCA9IHJlcXVpcmUoJ2V4dGVuZCcpO1xuXG5cbnZhciBsaWIgPSB7XG4gIGF0dHJpYnV0ZXM6IHtcbiAgICBjb21wb3NlOiBmdW5jdGlvbiAoYSwgYiwga2VlcE51bGwpIHtcbiAgICAgIGlmICh0eXBlb2YgYSAhPT0gJ29iamVjdCcpIGEgPSB7fTtcbiAgICAgIGlmICh0eXBlb2YgYiAhPT0gJ29iamVjdCcpIGIgPSB7fTtcbiAgICAgIHZhciBhdHRyaWJ1dGVzID0gZXh0ZW5kKHRydWUsIHt9LCBiKTtcbiAgICAgIGlmICgha2VlcE51bGwpIHtcbiAgICAgICAgYXR0cmlidXRlcyA9IE9iamVjdC5rZXlzKGF0dHJpYnV0ZXMpLnJlZHVjZShmdW5jdGlvbiAoY29weSwga2V5KSB7XG4gICAgICAgICAgaWYgKGF0dHJpYnV0ZXNba2V5XSAhPSBudWxsKSB7XG4gICAgICAgICAgICBjb3B5W2tleV0gPSBhdHRyaWJ1dGVzW2tleV07XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBjb3B5O1xuICAgICAgICB9LCB7fSk7XG4gICAgICB9XG4gICAgICBmb3IgKHZhciBrZXkgaW4gYSkge1xuICAgICAgICBpZiAoYVtrZXldICE9PSB1bmRlZmluZWQgJiYgYltrZXldID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBhdHRyaWJ1dGVzW2tleV0gPSBhW2tleV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyhhdHRyaWJ1dGVzKS5sZW5ndGggPiAwID8gYXR0cmlidXRlcyA6IHVuZGVmaW5lZDtcbiAgICB9LFxuXG4gICAgZGlmZjogZnVuY3Rpb24oYSwgYikge1xuICAgICAgaWYgKHR5cGVvZiBhICE9PSAnb2JqZWN0JykgYSA9IHt9O1xuICAgICAgaWYgKHR5cGVvZiBiICE9PSAnb2JqZWN0JykgYiA9IHt9O1xuICAgICAgdmFyIGF0dHJpYnV0ZXMgPSBPYmplY3Qua2V5cyhhKS5jb25jYXQoT2JqZWN0LmtleXMoYikpLnJlZHVjZShmdW5jdGlvbiAoYXR0cmlidXRlcywga2V5KSB7XG4gICAgICAgIGlmICghZXF1YWwoYVtrZXldLCBiW2tleV0pKSB7XG4gICAgICAgICAgYXR0cmlidXRlc1trZXldID0gYltrZXldID09PSB1bmRlZmluZWQgPyBudWxsIDogYltrZXldO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhdHRyaWJ1dGVzO1xuICAgICAgfSwge30pO1xuICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKGF0dHJpYnV0ZXMpLmxlbmd0aCA+IDAgPyBhdHRyaWJ1dGVzIDogdW5kZWZpbmVkO1xuICAgIH0sXG5cbiAgICB0cmFuc2Zvcm06IGZ1bmN0aW9uIChhLCBiLCBwcmlvcml0eSkge1xuICAgICAgaWYgKHR5cGVvZiBhICE9PSAnb2JqZWN0JykgcmV0dXJuIGI7XG4gICAgICBpZiAodHlwZW9mIGIgIT09ICdvYmplY3QnKSByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgaWYgKCFwcmlvcml0eSkgcmV0dXJuIGI7ICAvLyBiIHNpbXBseSBvdmVyd3JpdGVzIHVzIHdpdGhvdXQgcHJpb3JpdHlcbiAgICAgIHZhciBhdHRyaWJ1dGVzID0gT2JqZWN0LmtleXMoYikucmVkdWNlKGZ1bmN0aW9uIChhdHRyaWJ1dGVzLCBrZXkpIHtcbiAgICAgICAgaWYgKGFba2V5XSA9PT0gdW5kZWZpbmVkKSBhdHRyaWJ1dGVzW2tleV0gPSBiW2tleV07ICAvLyBudWxsIGlzIGEgdmFsaWQgdmFsdWVcbiAgICAgICAgcmV0dXJuIGF0dHJpYnV0ZXM7XG4gICAgICB9LCB7fSk7XG4gICAgICByZXR1cm4gT2JqZWN0LmtleXMoYXR0cmlidXRlcykubGVuZ3RoID4gMCA/IGF0dHJpYnV0ZXMgOiB1bmRlZmluZWQ7XG4gICAgfVxuICB9LFxuXG4gIGl0ZXJhdG9yOiBmdW5jdGlvbiAob3BzKSB7XG4gICAgcmV0dXJuIG5ldyBJdGVyYXRvcihvcHMpO1xuICB9LFxuXG4gIGxlbmd0aDogZnVuY3Rpb24gKG9wKSB7XG4gICAgaWYgKHR5cGVvZiBvcFsnZGVsZXRlJ10gPT09ICdudW1iZXInKSB7XG4gICAgICByZXR1cm4gb3BbJ2RlbGV0ZSddO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG9wLnJldGFpbiA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiBvcC5yZXRhaW47XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0eXBlb2Ygb3AuaW5zZXJ0ID09PSAnc3RyaW5nJyA/IG9wLmluc2VydC5sZW5ndGggOiAxO1xuICAgIH1cbiAgfVxufTtcblxuXG5mdW5jdGlvbiBJdGVyYXRvcihvcHMpIHtcbiAgdGhpcy5vcHMgPSBvcHM7XG4gIHRoaXMuaW5kZXggPSAwO1xuICB0aGlzLm9mZnNldCA9IDA7XG59O1xuXG5JdGVyYXRvci5wcm90b3R5cGUuaGFzTmV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMucGVla0xlbmd0aCgpIDwgSW5maW5pdHk7XG59O1xuXG5JdGVyYXRvci5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uIChsZW5ndGgpIHtcbiAgaWYgKCFsZW5ndGgpIGxlbmd0aCA9IEluZmluaXR5O1xuICB2YXIgbmV4dE9wID0gdGhpcy5vcHNbdGhpcy5pbmRleF07XG4gIGlmIChuZXh0T3ApIHtcbiAgICB2YXIgb2Zmc2V0ID0gdGhpcy5vZmZzZXQ7XG4gICAgdmFyIG9wTGVuZ3RoID0gbGliLmxlbmd0aChuZXh0T3ApXG4gICAgaWYgKGxlbmd0aCA+PSBvcExlbmd0aCAtIG9mZnNldCkge1xuICAgICAgbGVuZ3RoID0gb3BMZW5ndGggLSBvZmZzZXQ7XG4gICAgICB0aGlzLmluZGV4ICs9IDE7XG4gICAgICB0aGlzLm9mZnNldCA9IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub2Zmc2V0ICs9IGxlbmd0aDtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBuZXh0T3BbJ2RlbGV0ZSddID09PSAnbnVtYmVyJykge1xuICAgICAgcmV0dXJuIHsgJ2RlbGV0ZSc6IGxlbmd0aCB9O1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgcmV0T3AgPSB7fTtcbiAgICAgIGlmIChuZXh0T3AuYXR0cmlidXRlcykge1xuICAgICAgICByZXRPcC5hdHRyaWJ1dGVzID0gbmV4dE9wLmF0dHJpYnV0ZXM7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIG5leHRPcC5yZXRhaW4gPT09ICdudW1iZXInKSB7XG4gICAgICAgIHJldE9wLnJldGFpbiA9IGxlbmd0aDtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIG5leHRPcC5pbnNlcnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldE9wLmluc2VydCA9IG5leHRPcC5pbnNlcnQuc3Vic3RyKG9mZnNldCwgbGVuZ3RoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIG9mZnNldCBzaG91bGQgPT09IDAsIGxlbmd0aCBzaG91bGQgPT09IDFcbiAgICAgICAgcmV0T3AuaW5zZXJ0ID0gbmV4dE9wLmluc2VydDtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXRPcDtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHsgcmV0YWluOiBJbmZpbml0eSB9O1xuICB9XG59O1xuXG5JdGVyYXRvci5wcm90b3R5cGUucGVlayA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMub3BzW3RoaXMuaW5kZXhdO1xufTtcblxuSXRlcmF0b3IucHJvdG90eXBlLnBlZWtMZW5ndGggPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLm9wc1t0aGlzLmluZGV4XSkge1xuICAgIC8vIFNob3VsZCBuZXZlciByZXR1cm4gMCBpZiBvdXIgaW5kZXggaXMgYmVpbmcgbWFuYWdlZCBjb3JyZWN0bHlcbiAgICByZXR1cm4gbGliLmxlbmd0aCh0aGlzLm9wc1t0aGlzLmluZGV4XSkgLSB0aGlzLm9mZnNldDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gSW5maW5pdHk7XG4gIH1cbn07XG5cbkl0ZXJhdG9yLnByb3RvdHlwZS5wZWVrVHlwZSA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMub3BzW3RoaXMuaW5kZXhdKSB7XG4gICAgaWYgKHR5cGVvZiB0aGlzLm9wc1t0aGlzLmluZGV4XVsnZGVsZXRlJ10gPT09ICdudW1iZXInKSB7XG4gICAgICByZXR1cm4gJ2RlbGV0ZSc7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdGhpcy5vcHNbdGhpcy5pbmRleF0ucmV0YWluID09PSAnbnVtYmVyJykge1xuICAgICAgcmV0dXJuICdyZXRhaW4nO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gJ2luc2VydCc7XG4gICAgfVxuICB9XG4gIHJldHVybiAncmV0YWluJztcbn07XG5cblxubW9kdWxlLmV4cG9ydHMgPSBsaWI7XG4iLCJ2YXIgcFNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xudmFyIG9iamVjdEtleXMgPSByZXF1aXJlKCcuL2xpYi9rZXlzLmpzJyk7XG52YXIgaXNBcmd1bWVudHMgPSByZXF1aXJlKCcuL2xpYi9pc19hcmd1bWVudHMuanMnKTtcblxudmFyIGRlZXBFcXVhbCA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG9wdHMpIHtcbiAgaWYgKCFvcHRzKSBvcHRzID0ge307XG4gIC8vIDcuMS4gQWxsIGlkZW50aWNhbCB2YWx1ZXMgYXJlIGVxdWl2YWxlbnQsIGFzIGRldGVybWluZWQgYnkgPT09LlxuICBpZiAoYWN0dWFsID09PSBleHBlY3RlZCkge1xuICAgIHJldHVybiB0cnVlO1xuXG4gIH0gZWxzZSBpZiAoYWN0dWFsIGluc3RhbmNlb2YgRGF0ZSAmJiBleHBlY3RlZCBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICByZXR1cm4gYWN0dWFsLmdldFRpbWUoKSA9PT0gZXhwZWN0ZWQuZ2V0VGltZSgpO1xuXG4gIC8vIDcuMy4gT3RoZXIgcGFpcnMgdGhhdCBkbyBub3QgYm90aCBwYXNzIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyxcbiAgLy8gZXF1aXZhbGVuY2UgaXMgZGV0ZXJtaW5lZCBieSA9PS5cbiAgfSBlbHNlIGlmICghYWN0dWFsIHx8ICFleHBlY3RlZCB8fCB0eXBlb2YgYWN0dWFsICE9ICdvYmplY3QnICYmIHR5cGVvZiBleHBlY3RlZCAhPSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBvcHRzLnN0cmljdCA/IGFjdHVhbCA9PT0gZXhwZWN0ZWQgOiBhY3R1YWwgPT0gZXhwZWN0ZWQ7XG5cbiAgLy8gNy40LiBGb3IgYWxsIG90aGVyIE9iamVjdCBwYWlycywgaW5jbHVkaW5nIEFycmF5IG9iamVjdHMsIGVxdWl2YWxlbmNlIGlzXG4gIC8vIGRldGVybWluZWQgYnkgaGF2aW5nIHRoZSBzYW1lIG51bWJlciBvZiBvd25lZCBwcm9wZXJ0aWVzIChhcyB2ZXJpZmllZFxuICAvLyB3aXRoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCksIHRoZSBzYW1lIHNldCBvZiBrZXlzXG4gIC8vIChhbHRob3VnaCBub3QgbmVjZXNzYXJpbHkgdGhlIHNhbWUgb3JkZXIpLCBlcXVpdmFsZW50IHZhbHVlcyBmb3IgZXZlcnlcbiAgLy8gY29ycmVzcG9uZGluZyBrZXksIGFuZCBhbiBpZGVudGljYWwgJ3Byb3RvdHlwZScgcHJvcGVydHkuIE5vdGU6IHRoaXNcbiAgLy8gYWNjb3VudHMgZm9yIGJvdGggbmFtZWQgYW5kIGluZGV4ZWQgcHJvcGVydGllcyBvbiBBcnJheXMuXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG9iakVxdWl2KGFjdHVhbCwgZXhwZWN0ZWQsIG9wdHMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkT3JOdWxsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBpc0J1ZmZlciAoeCkge1xuICBpZiAoIXggfHwgdHlwZW9mIHggIT09ICdvYmplY3QnIHx8IHR5cGVvZiB4Lmxlbmd0aCAhPT0gJ251bWJlcicpIHJldHVybiBmYWxzZTtcbiAgaWYgKHR5cGVvZiB4LmNvcHkgIT09ICdmdW5jdGlvbicgfHwgdHlwZW9mIHguc2xpY2UgIT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKHgubGVuZ3RoID4gMCAmJiB0eXBlb2YgeFswXSAhPT0gJ251bWJlcicpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIG9iakVxdWl2KGEsIGIsIG9wdHMpIHtcbiAgdmFyIGksIGtleTtcbiAgaWYgKGlzVW5kZWZpbmVkT3JOdWxsKGEpIHx8IGlzVW5kZWZpbmVkT3JOdWxsKGIpKVxuICAgIHJldHVybiBmYWxzZTtcbiAgLy8gYW4gaWRlbnRpY2FsICdwcm90b3R5cGUnIHByb3BlcnR5LlxuICBpZiAoYS5wcm90b3R5cGUgIT09IGIucHJvdG90eXBlKSByZXR1cm4gZmFsc2U7XG4gIC8vfn5+SSd2ZSBtYW5hZ2VkIHRvIGJyZWFrIE9iamVjdC5rZXlzIHRocm91Z2ggc2NyZXd5IGFyZ3VtZW50cyBwYXNzaW5nLlxuICAvLyAgIENvbnZlcnRpbmcgdG8gYXJyYXkgc29sdmVzIHRoZSBwcm9ibGVtLlxuICBpZiAoaXNBcmd1bWVudHMoYSkpIHtcbiAgICBpZiAoIWlzQXJndW1lbnRzKGIpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGEgPSBwU2xpY2UuY2FsbChhKTtcbiAgICBiID0gcFNsaWNlLmNhbGwoYik7XG4gICAgcmV0dXJuIGRlZXBFcXVhbChhLCBiLCBvcHRzKTtcbiAgfVxuICBpZiAoaXNCdWZmZXIoYSkpIHtcbiAgICBpZiAoIWlzQnVmZmVyKGIpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFbaV0gIT09IGJbaV0pIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgdHJ5IHtcbiAgICB2YXIga2EgPSBvYmplY3RLZXlzKGEpLFxuICAgICAgICBrYiA9IG9iamVjdEtleXMoYik7XG4gIH0gY2F0Y2ggKGUpIHsvL2hhcHBlbnMgd2hlbiBvbmUgaXMgYSBzdHJpbmcgbGl0ZXJhbCBhbmQgdGhlIG90aGVyIGlzbid0XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIC8vIGhhdmluZyB0aGUgc2FtZSBudW1iZXIgb2Ygb3duZWQgcHJvcGVydGllcyAoa2V5cyBpbmNvcnBvcmF0ZXNcbiAgLy8gaGFzT3duUHJvcGVydHkpXG4gIGlmIChrYS5sZW5ndGggIT0ga2IubGVuZ3RoKVxuICAgIHJldHVybiBmYWxzZTtcbiAgLy90aGUgc2FtZSBzZXQgb2Yga2V5cyAoYWx0aG91Z2ggbm90IG5lY2Vzc2FyaWx5IHRoZSBzYW1lIG9yZGVyKSxcbiAga2Euc29ydCgpO1xuICBrYi5zb3J0KCk7XG4gIC8vfn5+Y2hlYXAga2V5IHRlc3RcbiAgZm9yIChpID0ga2EubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBpZiAoa2FbaV0gIT0ga2JbaV0pXG4gICAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgLy9lcXVpdmFsZW50IHZhbHVlcyBmb3IgZXZlcnkgY29ycmVzcG9uZGluZyBrZXksIGFuZFxuICAvL35+fnBvc3NpYmx5IGV4cGVuc2l2ZSBkZWVwIHRlc3RcbiAgZm9yIChpID0ga2EubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBrZXkgPSBrYVtpXTtcbiAgICBpZiAoIWRlZXBFcXVhbChhW2tleV0sIGJba2V5XSwgb3B0cykpIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHlwZW9mIGEgPT09IHR5cGVvZiBiO1xufVxuIiwidmFyIHN1cHBvcnRzQXJndW1lbnRzQ2xhc3MgPSAoZnVuY3Rpb24oKXtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhcmd1bWVudHMpXG59KSgpID09ICdbb2JqZWN0IEFyZ3VtZW50c10nO1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBzdXBwb3J0c0FyZ3VtZW50c0NsYXNzID8gc3VwcG9ydGVkIDogdW5zdXBwb3J0ZWQ7XG5cbmV4cG9ydHMuc3VwcG9ydGVkID0gc3VwcG9ydGVkO1xuZnVuY3Rpb24gc3VwcG9ydGVkKG9iamVjdCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iamVjdCkgPT0gJ1tvYmplY3QgQXJndW1lbnRzXSc7XG59O1xuXG5leHBvcnRzLnVuc3VwcG9ydGVkID0gdW5zdXBwb3J0ZWQ7XG5mdW5jdGlvbiB1bnN1cHBvcnRlZChvYmplY3Qpe1xuICByZXR1cm4gb2JqZWN0ICYmXG4gICAgdHlwZW9mIG9iamVjdCA9PSAnb2JqZWN0JyAmJlxuICAgIHR5cGVvZiBvYmplY3QubGVuZ3RoID09ICdudW1iZXInICYmXG4gICAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgJ2NhbGxlZScpICYmXG4gICAgIU9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChvYmplY3QsICdjYWxsZWUnKSB8fFxuICAgIGZhbHNlO1xufTtcbiIsImV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHR5cGVvZiBPYmplY3Qua2V5cyA9PT0gJ2Z1bmN0aW9uJ1xuICA/IE9iamVjdC5rZXlzIDogc2hpbTtcblxuZXhwb3J0cy5zaGltID0gc2hpbTtcbmZ1bmN0aW9uIHNoaW0gKG9iaikge1xuICB2YXIga2V5cyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSBrZXlzLnB1c2goa2V5KTtcbiAgcmV0dXJuIGtleXM7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL3R5cGUnKTtcbiIsInZhciBEZWx0YSA9IHJlcXVpcmUoJ3F1aWxsLWRlbHRhJyk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIERlbHRhOiBEZWx0YSxcbiAgdHlwZToge1xuICAgIG5hbWU6ICdyaWNoLXRleHQnLFxuICAgIHVyaTogJ2h0dHA6Ly9zaGFyZWpzLm9yZy90eXBlcy9yaWNoLXRleHQvdjEnLFxuXG4gICAgY3JlYXRlOiBmdW5jdGlvbiAoaW5pdGlhbCkge1xuICAgICAgcmV0dXJuIG5ldyBEZWx0YShpbml0aWFsKTtcbiAgICB9LFxuXG4gICAgYXBwbHk6IGZ1bmN0aW9uIChzbmFwc2hvdCwgZGVsdGEpIHtcbiAgICAgIHNuYXBzaG90ID0gbmV3IERlbHRhKHNuYXBzaG90KTtcbiAgICAgIGRlbHRhID0gbmV3IERlbHRhKGRlbHRhKTtcbiAgICAgIHJldHVybiBzbmFwc2hvdC5jb21wb3NlKGRlbHRhKTtcbiAgICB9LFxuXG4gICAgY29tcG9zZTogZnVuY3Rpb24gKGRlbHRhMSwgZGVsdGEyKSB7XG4gICAgICBkZWx0YTEgPSBuZXcgRGVsdGEoZGVsdGExKTtcbiAgICAgIGRlbHRhMiA9IG5ldyBEZWx0YShkZWx0YTIpO1xuICAgICAgcmV0dXJuIGRlbHRhMS5jb21wb3NlKGRlbHRhMik7XG4gICAgfSxcblxuICAgIGRpZmY6IGZ1bmN0aW9uIChkZWx0YTEsIGRlbHRhMikge1xuICAgICAgZGVsdGExID0gbmV3IERlbHRhKGRlbHRhMSk7XG4gICAgICBkZWx0YTIgPSBuZXcgRGVsdGEoZGVsdGEyKTtcbiAgICAgIHJldHVybiBkZWx0YTEuZGlmZihkZWx0YTIpO1xuICAgIH0sXG5cbiAgICB0cmFuc2Zvcm06IGZ1bmN0aW9uIChkZWx0YTEsIGRlbHRhMiwgc2lkZSkge1xuICAgICAgZGVsdGExID0gbmV3IERlbHRhKGRlbHRhMSk7XG4gICAgICBkZWx0YTIgPSBuZXcgRGVsdGEoZGVsdGEyKTtcbiAgICAgIC8vIEZ1enplciBzcGVjcyBpcyBpbiBvcHBvc2l0ZSBvcmRlciBvZiBkZWx0YSBpbnRlcmZhY2VcbiAgICAgIHJldHVybiBkZWx0YTIudHJhbnNmb3JtKGRlbHRhMSwgc2lkZSA9PT0gJ2xlZnQnKTtcbiAgICB9LFxuXG4gICAgdHJhbnNmb3JtQ3Vyc29yOiBmdW5jdGlvbihjdXJzb3IsIGRlbHRhLCBpc093bk9wKSB7XG4gICAgICByZXR1cm4gZGVsdGEudHJhbnNmb3JtUG9zaXRpb24oY3Vyc29yLCAhaXNPd25PcCk7XG4gICAgfSxcblxuICAgIG5vcm1hbGl6ZTogZnVuY3Rpb24oZGVsdGEpIHtcbiAgICAgIHJldHVybiBkZWx0YTsgICAvLyBxdWlsbC1kZWx0YSBpcyBhbHJlYWR5IGNhbm9uaWNhbFxuICAgIH0sXG5cbiAgICBzZXJpYWxpemU6IGZ1bmN0aW9uKGRlbHRhKSB7XG4gICAgICByZXR1cm4gZGVsdGEub3BzO1xuICAgIH0sXG5cbiAgICBkZXNlcmlhbGl6ZTogZnVuY3Rpb24ob3BzKSB7XG4gICAgICByZXR1cm4gbmV3IERlbHRhKG9wcyk7XG4gICAgfVxuICB9XG59O1xuIiwiZ2xvYmFsLnNoYXJlZGIgPSByZXF1aXJlKFwiLi4vc2VydmVyL3ZlbmRvci9zaGFyZWRiL2xpYi9jbGllbnRcIilcbmdsb2JhbC5vdFRleHQgPSByZXF1aXJlKCdvdC10ZXh0Jyk7XG5nbG9iYWwucmljaFRleHQgPSByZXF1aXJlKCdyaWNoLXRleHQnKTtcblxuc2hhcmVkYi50eXBlcy5yZWdpc3RlcihvdFRleHQudHlwZSk7XG5zaGFyZWRiLnR5cGVzLnJlZ2lzdGVyKHJpY2hUZXh0LnR5cGUpO1xuXG5cbnNoYXJlZGIudHlwZXMubWFwWydqc29uMCddLnJlZ2lzdGVyU3VidHlwZShvdFRleHQudHlwZSk7XG5cbnNoYXJlZGIudHlwZXMubWFwWydqc29uMCddLnJlZ2lzdGVyU3VidHlwZShyaWNoVGV4dC50eXBlKTtcblxuIiwidmFyIERvYyA9IHJlcXVpcmUoJy4vZG9jJyk7XG52YXIgUXVlcnkgPSByZXF1aXJlKCcuL3F1ZXJ5Jyk7XG52YXIgZW1pdHRlciA9IHJlcXVpcmUoJy4uL2VtaXR0ZXInKTtcbnZhciBTaGFyZURCRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvcicpO1xudmFyIHR5cGVzID0gcmVxdWlyZSgnLi4vdHlwZXMnKTtcbnZhciB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuXG4vKipcbiAqIEhhbmRsZXMgY29tbXVuaWNhdGlvbiB3aXRoIHRoZSBzaGFyZWpzIHNlcnZlciBhbmQgcHJvdmlkZXMgcXVlcmllcyBhbmRcbiAqIGRvY3VtZW50cy5cbiAqXG4gKiBXZSBjcmVhdGUgYSBjb25uZWN0aW9uIHdpdGggYSBzb2NrZXQgb2JqZWN0XG4gKiAgIGNvbm5lY3Rpb24gPSBuZXcgc2hhcmVqcy5Db25uZWN0aW9uKHNvY2tzZXQpXG4gKiBUaGUgc29ja2V0IG1heSBiZSBhbnkgb2JqZWN0IGhhbmRsaW5nIHRoZSB3ZWJzb2NrZXQgcHJvdG9jb2wuIFNlZSB0aGVcbiAqIGRvY3VtZW50YXRpb24gb2YgYmluZFRvU29ja2V0KCkgZm9yIGRldGFpbHMuIFdlIHRoZW4gd2FpdCBmb3IgdGhlIGNvbm5lY3Rpb25cbiAqIHRvIGNvbm5lY3RcbiAqICAgY29ubmVjdGlvbi5vbignY29ubmVjdGVkJywgLi4uKVxuICogYW5kIGFyZSBmaW5hbGx5IGFibGUgdG8gd29yayB3aXRoIHNoYXJlZCBkb2N1bWVudHNcbiAqICAgY29ubmVjdGlvbi5nZXQoJ2Zvb2QnLCAnc3RlYWsnKSAvLyBEb2NcbiAqXG4gKiBAcGFyYW0gc29ja2V0IEBzZWUgYmluZFRvU29ja2V0XG4gKi9cbm1vZHVsZS5leHBvcnRzID0gQ29ubmVjdGlvbjtcbmZ1bmN0aW9uIENvbm5lY3Rpb24oc29ja2V0KSB7XG4gIGVtaXR0ZXIuRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG5cbiAgLy8gTWFwIG9mIGNvbGxlY3Rpb24gLT4gaWQgLT4gZG9jIG9iamVjdCBmb3IgY3JlYXRlZCBkb2N1bWVudHMuXG4gIC8vIChjcmVhdGVkIGRvY3VtZW50cyBNVVNUIEJFIFVOSVFVRSlcbiAgdGhpcy5jb2xsZWN0aW9ucyA9IHt9O1xuXG4gIC8vIEVhY2ggcXVlcnkgaXMgY3JlYXRlZCB3aXRoIGFuIGlkIHRoYXQgdGhlIHNlcnZlciB1c2VzIHdoZW4gaXQgc2VuZHMgdXNcbiAgLy8gaW5mbyBhYm91dCB0aGUgcXVlcnkgKHVwZGF0ZXMsIGV0YylcbiAgdGhpcy5uZXh0UXVlcnlJZCA9IDE7XG5cbiAgLy8gTWFwIGZyb20gcXVlcnkgSUQgLT4gcXVlcnkgb2JqZWN0LlxuICB0aGlzLnF1ZXJpZXMgPSB7fTtcblxuICAvLyBBIHVuaXF1ZSBtZXNzYWdlIG51bWJlciBmb3IgdGhlIGdpdmVuIGlkXG4gIHRoaXMuc2VxID0gMTtcblxuICAvLyBFcXVhbHMgYWdlbnQuY2xpZW50SWQgb24gdGhlIHNlcnZlclxuICB0aGlzLmlkID0gbnVsbDtcblxuICAvLyBUaGlzIGRpcmVjdCByZWZlcmVuY2UgZnJvbSBjb25uZWN0aW9uIHRvIGFnZW50IGlzIG5vdCB1c2VkIGludGVybmFsIHRvXG4gIC8vIFNoYXJlREIsIGJ1dCBpdCBpcyBoYW5keSBmb3Igc2VydmVyLXNpZGUgb25seSB1c2VyIGNvZGUgdGhhdCBtYXkgY2FjaGVcbiAgLy8gc3RhdGUgb24gdGhlIGFnZW50IGFuZCByZWFkIGl0IGluIG1pZGRsZXdhcmVcbiAgdGhpcy5hZ2VudCA9IG51bGw7XG5cbiAgdGhpcy5kZWJ1ZyA9IHRydWU7XG5cbiAgdGhpcy5iaW5kVG9Tb2NrZXQoc29ja2V0KTtcbn1cbmVtaXR0ZXIubWl4aW4oQ29ubmVjdGlvbik7XG5cblxuLyoqXG4gKiBVc2Ugc29ja2V0IHRvIGNvbW11bmljYXRlIHdpdGggc2VydmVyXG4gKlxuICogU29ja2V0IGlzIGFuIG9iamVjdCB0aGF0IGNhbiBoYW5kbGUgdGhlIHdlYnNvY2tldCBwcm90b2NvbC4gVGhpcyBtZXRob2RcbiAqIGluc3RhbGxzIHRoZSBvbm9wZW4sIG9uY2xvc2UsIG9ubWVzc2FnZSBhbmQgb25lcnJvciBoYW5kbGVycyBvbiB0aGUgc29ja2V0IHRvXG4gKiBoYW5kbGUgY29tbXVuaWNhdGlvbiBhbmQgc2VuZHMgbWVzc2FnZXMgYnkgY2FsbGluZyBzb2NrZXQuc2VuZChtZXNzYWdlKS4gVGhlXG4gKiBzb2NrZXRzIGByZWFkeVN0YXRlYCBwcm9wZXJ0eSBpcyB1c2VkIHRvIGRldGVybWluZSB0aGUgaW5pdGFpYWwgc3RhdGUuXG4gKlxuICogQHBhcmFtIHNvY2tldCBIYW5kbGVzIHRoZSB3ZWJzb2NrZXQgcHJvdG9jb2xcbiAqIEBwYXJhbSBzb2NrZXQucmVhZHlTdGF0ZVxuICogQHBhcmFtIHNvY2tldC5jbG9zZVxuICogQHBhcmFtIHNvY2tldC5zZW5kXG4gKiBAcGFyYW0gc29ja2V0Lm9ub3BlblxuICogQHBhcmFtIHNvY2tldC5vbmNsb3NlXG4gKiBAcGFyYW0gc29ja2V0Lm9ubWVzc2FnZVxuICogQHBhcmFtIHNvY2tldC5vbmVycm9yXG4gKi9cbkNvbm5lY3Rpb24ucHJvdG90eXBlLmJpbmRUb1NvY2tldCA9IGZ1bmN0aW9uKHNvY2tldCkge1xuICBpZiAodGhpcy5zb2NrZXQpIHtcbiAgICB0aGlzLnNvY2tldC5jbG9zZSgpO1xuICAgIHRoaXMuc29ja2V0Lm9ubWVzc2FnZSA9IG51bGw7XG4gICAgdGhpcy5zb2NrZXQub25vcGVuID0gbnVsbDtcbiAgICB0aGlzLnNvY2tldC5vbmVycm9yID0gbnVsbDtcbiAgICB0aGlzLnNvY2tldC5vbmNsb3NlID0gbnVsbDtcbiAgfVxuXG4gIHRoaXMuc29ja2V0ID0gc29ja2V0O1xuXG4gIC8vIFN0YXRlIG9mIHRoZSBjb25uZWN0aW9uLiBUaGUgY29ycmVzcG9kaW5nIGV2ZW50cyBhcmUgZW1taXRlZCB3aGVuIHRoaXMgY2hhbmdlc1xuICAvL1xuICAvLyAtICdjb25uZWN0aW5nJyAgIFRoZSBjb25uZWN0aW9uIGlzIHN0aWxsIGJlaW5nIGVzdGFibGlzaGVkLCBvciB3ZSBhcmUgc3RpbGxcbiAgLy8gICAgICAgICAgICAgICAgICAgIHdhaXRpbmcgb24gdGhlIHNlcnZlciB0byBzZW5kIHVzIHRoZSBpbml0aWFsaXphdGlvbiBtZXNzYWdlXG4gIC8vIC0gJ2Nvbm5lY3RlZCcgICAgVGhlIGNvbm5lY3Rpb24gaXMgb3BlbiBhbmQgd2UgaGF2ZSBjb25uZWN0ZWQgdG8gYSBzZXJ2ZXJcbiAgLy8gICAgICAgICAgICAgICAgICAgIGFuZCByZWNpZXZlZCB0aGUgaW5pdGlhbGl6YXRpb24gbWVzc2FnZVxuICAvLyAtICdkaXNjb25uZWN0ZWQnIENvbm5lY3Rpb24gaXMgY2xvc2VkLCBidXQgaXQgd2lsbCByZWNvbm5lY3QgYXV0b21hdGljYWxseVxuICAvLyAtICdjbG9zZWQnICAgICAgIFRoZSBjb25uZWN0aW9uIHdhcyBjbG9zZWQgYnkgdGhlIGNsaWVudCwgYW5kIHdpbGwgbm90IHJlY29ubmVjdFxuICAvLyAtICdzdG9wcGVkJyAgICAgIFRoZSBjb25uZWN0aW9uIHdhcyBjbG9zZWQgYnkgdGhlIHNlcnZlciwgYW5kIHdpbGwgbm90IHJlY29ubmVjdFxuICB0aGlzLnN0YXRlID0gKHNvY2tldC5yZWFkeVN0YXRlID09PSAwIHx8IHNvY2tldC5yZWFkeVN0YXRlID09PSAxKSA/ICdjb25uZWN0aW5nJyA6ICdkaXNjb25uZWN0ZWQnO1xuXG4gIC8vIFRoaXMgaXMgYSBoZWxwZXIgdmFyaWFibGUgdGhlIGRvY3VtZW50IHVzZXMgdG8gc2VlIHdoZXRoZXIgd2UncmVcbiAgLy8gY3VycmVudGx5IGluIGEgJ2xpdmUnIHN0YXRlLiBJdCBpcyB0cnVlIGlmIGFuZCBvbmx5IGlmIHdlJ3JlIGNvbm5lY3RlZFxuICB0aGlzLmNhblNlbmQgPSBmYWxzZTtcblxuICB2YXIgY29ubmVjdGlvbiA9IHRoaXM7XG5cbiAgc29ja2V0Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdHJ5IHtcbiAgICAgIHZhciBkYXRhID0gKHR5cGVvZiBldmVudC5kYXRhID09PSAnc3RyaW5nJykgP1xuICAgICAgICBKU09OLnBhcnNlKGV2ZW50LmRhdGEpIDogZXZlbnQuZGF0YTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUud2FybignRmFpbGVkIHRvIHBhcnNlIG1lc3NhZ2UnLCBldmVudCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGNvbm5lY3Rpb24uZGVidWcpIGNvbnNvbGUubG9nKCdSRUNWJywgSlNPTi5zdHJpbmdpZnkoZGF0YSkpO1xuXG4gICAgdmFyIHJlcXVlc3QgPSB7ZGF0YTogZGF0YX07XG4gICAgY29ubmVjdGlvbi5lbWl0KCdyZWNlaXZlJywgcmVxdWVzdCk7XG4gICAgaWYgKCFyZXF1ZXN0LmRhdGEpIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICBjb25uZWN0aW9uLmhhbmRsZU1lc3NhZ2UocmVxdWVzdC5kYXRhKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbm5lY3Rpb24uZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xuXG4gIHNvY2tldC5vbm9wZW4gPSBmdW5jdGlvbigpIHtcbiAgICBjb25uZWN0aW9uLl9zZXRTdGF0ZSgnY29ubmVjdGluZycpO1xuICB9O1xuXG4gIHNvY2tldC5vbmVycm9yID0gZnVuY3Rpb24oZXJyKSB7XG4gICAgLy8gVGhpcyBpc24ndCB0aGUgc2FtZSBhcyBhIHJlZ3VsYXIgZXJyb3IsIGJlY2F1c2UgaXQgd2lsbCBoYXBwZW4gbm9ybWFsbHlcbiAgICAvLyBmcm9tIHRpbWUgdG8gdGltZS4gWW91ciBjb25uZWN0aW9uIHNob3VsZCBwcm9iYWJseSBhdXRvbWF0aWNhbGx5XG4gICAgLy8gcmVjb25uZWN0IGFueXdheSwgYnV0IHRoYXQgc2hvdWxkIGJlIHRyaWdnZXJlZCBvZmYgb25jbG9zZSBub3Qgb25lcnJvci5cbiAgICAvLyAob25jbG9zZSBoYXBwZW5zIHdoZW4gb25lcnJvciBnZXRzIGNhbGxlZCBhbnl3YXkpLlxuICAgIGNvbm5lY3Rpb24uZW1pdCgnY29ubmVjdGlvbiBlcnJvcicsIGVycik7XG4gIH07XG5cbiAgc29ja2V0Lm9uY2xvc2UgPSBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAvLyBub2RlLWJyb3dzZXJjaGFubmVsIHJlYXNvbiB2YWx1ZXM6XG4gICAgLy8gICAnQ2xvc2VkJyAtIFRoZSBzb2NrZXQgd2FzIG1hbnVhbGx5IGNsb3NlZCBieSBjYWxsaW5nIHNvY2tldC5jbG9zZSgpXG4gICAgLy8gICAnU3RvcHBlZCBieSBzZXJ2ZXInIC0gVGhlIHNlcnZlciBzZW50IHRoZSBzdG9wIG1lc3NhZ2UgdG8gdGVsbCB0aGUgY2xpZW50IG5vdCB0byB0cnkgY29ubmVjdGluZ1xuICAgIC8vICAgJ1JlcXVlc3QgZmFpbGVkJyAtIFNlcnZlciBkaWRuJ3QgcmVzcG9uZCB0byByZXF1ZXN0ICh0ZW1wb3JhcnksIHVzdWFsbHkgb2ZmbGluZSlcbiAgICAvLyAgICdVbmtub3duIHNlc3Npb24gSUQnIC0gU2VydmVyIHNlc3Npb24gZm9yIGNsaWVudCBpcyBtaXNzaW5nICh0ZW1wb3JhcnksIHdpbGwgaW1tZWRpYXRlbHkgcmVlc3RhYmxpc2gpXG5cbiAgICBpZiAocmVhc29uID09PSAnY2xvc2VkJyB8fCByZWFzb24gPT09ICdDbG9zZWQnKSB7XG4gICAgICBjb25uZWN0aW9uLl9zZXRTdGF0ZSgnY2xvc2VkJywgcmVhc29uKTtcblxuICAgIH0gZWxzZSBpZiAocmVhc29uID09PSAnc3RvcHBlZCcgfHwgcmVhc29uID09PSAnU3RvcHBlZCBieSBzZXJ2ZXInKSB7XG4gICAgICBjb25uZWN0aW9uLl9zZXRTdGF0ZSgnc3RvcHBlZCcsIHJlYXNvbik7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgY29ubmVjdGlvbi5fc2V0U3RhdGUoJ2Rpc2Nvbm5lY3RlZCcsIHJlYXNvbik7XG4gICAgfVxuICB9O1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge29iamVjdH0gbWVzc2FnZVxuICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UuYSBhY3Rpb25cbiAqL1xuQ29ubmVjdGlvbi5wcm90b3R5cGUuaGFuZGxlTWVzc2FnZSA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgY29uc29sZS5sb2cobWVzc2FnZSlcbiAgdmFyIGVyciA9IG51bGw7XG4gIGlmIChtZXNzYWdlLmVycm9yKSB7XG4gICAgLy8gd3JhcCBpbiBFcnJvciBvYmplY3Qgc28gY2FuIGJlIHBhc3NlZCB0aHJvdWdoIGV2ZW50IGVtaXR0ZXJzXG4gICAgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UuZXJyb3IubWVzc2FnZSk7XG4gICAgZXJyLmNvZGUgPSBtZXNzYWdlLmVycm9yLmNvZGU7XG4gICAgLy8gQWRkIHRoZSBtZXNzYWdlIGRhdGEgdG8gdGhlIGVycm9yIG9iamVjdCBmb3IgbW9yZSBjb250ZXh0XG4gICAgZXJyLmRhdGEgPSBtZXNzYWdlO1xuICAgIGRlbGV0ZSBtZXNzYWdlLmVycm9yO1xuICB9XG4gIC8vIFN3aXRjaCBvbiB0aGUgbWVzc2FnZSBhY3Rpb24uIE1vc3QgbWVzc2FnZXMgYXJlIGZvciBkb2N1bWVudHMgYW5kIGFyZVxuICAvLyBoYW5kbGVkIGluIHRoZSBkb2MgY2xhc3MuXG4gIHN3aXRjaCAobWVzc2FnZS5hKSB7XG4gICAgY2FzZSAnaW5pdCc6XG4gICAgICAvLyBDbGllbnQgaW5pdGlhbGl6YXRpb24gcGFja2V0XG4gICAgICBpZiAobWVzc2FnZS5wcm90b2NvbCAhPT0gMSkge1xuICAgICAgICBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDQwMTksICdJbnZhbGlkIHByb3RvY29sIHZlcnNpb24nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVzLm1hcFttZXNzYWdlLnR5cGVdICE9PSB0eXBlcy5kZWZhdWx0VHlwZSkge1xuICAgICAgICBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDQwMjAsICdJbnZhbGlkIGRlZmF1bHQgdHlwZScpO1xuICAgICAgICByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIG1lc3NhZ2UuaWQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGVyciA9IG5ldyBTaGFyZURCRXJyb3IoNDAyMSwgJ0ludmFsaWQgY2xpZW50IGlkJyk7XG4gICAgICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuaWQgPSBtZXNzYWdlLmlkO1xuXG4gICAgICB0aGlzLl9zZXRTdGF0ZSgnY29ubmVjdGVkJyk7XG4gICAgICByZXR1cm47XG5cbiAgICBjYXNlICdxZic6XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbbWVzc2FnZS5pZF07XG4gICAgICBpZiAocXVlcnkpIHF1ZXJ5Ll9oYW5kbGVGZXRjaChlcnIsIG1lc3NhZ2UuZGF0YSwgbWVzc2FnZS5leHRyYSk7XG4gICAgICByZXR1cm47XG4gICAgY2FzZSAncXMnOlxuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW21lc3NhZ2UuaWRdO1xuICAgICAgaWYgKHF1ZXJ5KSBxdWVyeS5faGFuZGxlU3Vic2NyaWJlKGVyciwgbWVzc2FnZS5kYXRhLCBtZXNzYWdlLmV4dHJhKTtcbiAgICAgIHJldHVybjtcbiAgICBjYXNlICdxdSc6XG4gICAgICAvLyBRdWVyaWVzIGFyZSByZW1vdmVkIGltbWVkaWF0ZWx5IG9uIGNhbGxzIHRvIGRlc3Ryb3ksIHNvIHdlIGlnbm9yZVxuICAgICAgLy8gcmVwbGllcyB0byBxdWVyeSB1bnN1YnNjcmliZXMuIFBlcmhhcHMgdGhlcmUgc2hvdWxkIGJlIGEgY2FsbGJhY2sgZm9yXG4gICAgICAvLyBkZXN0cm95LCBidXQgdGhpcyBpcyBjdXJyZW50bHkgdW5pbXBsZW1lbnRlZFxuICAgICAgcmV0dXJuO1xuICAgIGNhc2UgJ3EnOlxuICAgICAgLy8gUXVlcnkgbWVzc2FnZS4gUGFzcyB0aGlzIHRvIHRoZSBhcHByb3ByaWF0ZSBxdWVyeSBvYmplY3QuXG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbbWVzc2FnZS5pZF07XG4gICAgICBpZiAoIXF1ZXJ5KSByZXR1cm47XG4gICAgICBpZiAoZXJyKSByZXR1cm4gcXVlcnkuX2hhbmRsZUVycm9yKGVycik7XG4gICAgICBpZiAobWVzc2FnZS5kaWZmKSBxdWVyeS5faGFuZGxlRGlmZihtZXNzYWdlLmRpZmYpO1xuICAgICAgaWYgKG1lc3NhZ2UuaGFzT3duUHJvcGVydHkoJ2V4dHJhJykpIHF1ZXJ5Ll9oYW5kbGVFeHRyYShtZXNzYWdlLmV4dHJhKTtcbiAgICAgIHJldHVybjtcblxuICAgIGNhc2UgJ2JmJzpcbiAgICAgIHJldHVybiB0aGlzLl9oYW5kbGVCdWxrTWVzc2FnZShtZXNzYWdlLCAnX2hhbmRsZUZldGNoJyk7XG4gICAgY2FzZSAnYnMnOlxuICAgICAgcmV0dXJuIHRoaXMuX2hhbmRsZUJ1bGtNZXNzYWdlKG1lc3NhZ2UsICdfaGFuZGxlU3Vic2NyaWJlJyk7XG4gICAgY2FzZSAnYnUnOlxuICAgICAgcmV0dXJuIHRoaXMuX2hhbmRsZUJ1bGtNZXNzYWdlKG1lc3NhZ2UsICdfaGFuZGxlVW5zdWJzY3JpYmUnKTtcblxuICAgIGNhc2UgJ2YnOlxuICAgICAgdmFyIGRvYyA9IHRoaXMuZ2V0RXhpc3RpbmcobWVzc2FnZS5jLCBtZXNzYWdlLmQpO1xuICAgICAgaWYgKGRvYykgZG9jLl9oYW5kbGVGZXRjaChlcnIsIG1lc3NhZ2UuZGF0YSk7XG4gICAgICByZXR1cm47XG4gICAgY2FzZSAncyc6XG4gICAgICB2YXIgZG9jID0gdGhpcy5nZXRFeGlzdGluZyhtZXNzYWdlLmMsIG1lc3NhZ2UuZCk7XG4gICAgICBpZiAoZG9jKSBkb2MuX2hhbmRsZVN1YnNjcmliZShlcnIsIG1lc3NhZ2UuZGF0YSk7XG4gICAgICByZXR1cm47XG4gICAgY2FzZSAndSc6XG4gICAgICB2YXIgZG9jID0gdGhpcy5nZXRFeGlzdGluZyhtZXNzYWdlLmMsIG1lc3NhZ2UuZCk7XG4gICAgICBpZiAoZG9jKSBkb2MuX2hhbmRsZVVuc3Vic2NyaWJlKGVycik7XG4gICAgICByZXR1cm47XG4gICAgY2FzZSAnb3AnOlxuICAgICAgdmFyIGRvYyA9IHRoaXMuZ2V0RXhpc3RpbmcobWVzc2FnZS5jLCBtZXNzYWdlLmQpO1xuICAgICAgaWYgKGRvYykgZG9jLl9oYW5kbGVPcChlcnIsIG1lc3NhZ2UpO1xuICAgICAgcmV0dXJuO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIGNvbnNvbGUud2FybignSWdub3JuaW5nIHVucmVjb2duaXplZCBtZXNzYWdlJywgbWVzc2FnZSk7XG4gIH1cbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLl9oYW5kbGVCdWxrTWVzc2FnZSA9IGZ1bmN0aW9uKG1lc3NhZ2UsIG1ldGhvZCkge1xuICBpZiAobWVzc2FnZS5kYXRhKSB7XG4gICAgZm9yICh2YXIgaWQgaW4gbWVzc2FnZS5kYXRhKSB7XG4gICAgICB2YXIgZG9jID0gdGhpcy5nZXRFeGlzdGluZyhtZXNzYWdlLmMsIGlkKTtcbiAgICAgIGlmIChkb2MpIGRvY1ttZXRob2RdKG1lc3NhZ2UuZXJyb3IsIG1lc3NhZ2UuZGF0YVtpZF0pO1xuICAgIH1cbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KG1lc3NhZ2UuYikpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1lc3NhZ2UuYi5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGlkID0gbWVzc2FnZS5iW2ldO1xuICAgICAgdmFyIGRvYyA9IHRoaXMuZ2V0RXhpc3RpbmcobWVzc2FnZS5jLCBpZCk7XG4gICAgICBpZiAoZG9jKSBkb2NbbWV0aG9kXShtZXNzYWdlLmVycm9yKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAobWVzc2FnZS5iKSB7XG4gICAgZm9yICh2YXIgaWQgaW4gbWVzc2FnZS5iKSB7XG4gICAgICB2YXIgZG9jID0gdGhpcy5nZXRFeGlzdGluZyhtZXNzYWdlLmMsIGlkKTtcbiAgICAgIGlmIChkb2MpIGRvY1ttZXRob2RdKG1lc3NhZ2UuZXJyb3IpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmVycm9yKCdJbnZhbGlkIGJ1bGsgbWVzc2FnZScsIG1lc3NhZ2UpO1xuICB9XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fcmVzZXQgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5zZXEgPSAxO1xuICB0aGlzLmlkID0gbnVsbDtcbiAgdGhpcy5hZ2VudCA9IG51bGw7XG59O1xuXG4vLyBTZXQgdGhlIGNvbm5lY3Rpb24ncyBzdGF0ZS4gVGhlIGNvbm5lY3Rpb24gaXMgYmFzaWNhbGx5IGEgc3RhdGUgbWFjaGluZS5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLl9zZXRTdGF0ZSA9IGZ1bmN0aW9uKG5ld1N0YXRlLCByZWFzb24pIHtcbiAgaWYgKHRoaXMuc3RhdGUgPT09IG5ld1N0YXRlKSByZXR1cm47XG5cbiAgLy8gSSBtYWRlIGEgc3RhdGUgZGlhZ3JhbS4gVGhlIG9ubHkgaW52YWxpZCB0cmFuc2l0aW9ucyBhcmUgZ2V0dGluZyB0b1xuICAvLyAnY29ubmVjdGluZycgZnJvbSBhbnl3aGVyZSBvdGhlciB0aGFuICdkaXNjb25uZWN0ZWQnIGFuZCBnZXR0aW5nIHRvXG4gIC8vICdjb25uZWN0ZWQnIGZyb20gYW55d2hlcmUgb3RoZXIgdGhhbiAnY29ubmVjdGluZycuXG4gIGlmIChcbiAgICAobmV3U3RhdGUgPT09ICdjb25uZWN0aW5nJyAmJiB0aGlzLnN0YXRlICE9PSAnZGlzY29ubmVjdGVkJyAmJiB0aGlzLnN0YXRlICE9PSAnc3RvcHBlZCcgJiYgdGhpcy5zdGF0ZSAhPT0gJ2Nsb3NlZCcpIHx8XG4gICAgKG5ld1N0YXRlID09PSAnY29ubmVjdGVkJyAmJiB0aGlzLnN0YXRlICE9PSAnY29ubmVjdGluZycpXG4gICkge1xuICAgIHZhciBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDUwMDcsICdDYW5ub3QgdHJhbnNpdGlvbiBkaXJlY3RseSBmcm9tICcgKyB0aGlzLnN0YXRlICsgJyB0byAnICsgbmV3U3RhdGUpO1xuICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgfVxuXG4gIHRoaXMuc3RhdGUgPSBuZXdTdGF0ZTtcbiAgdGhpcy5jYW5TZW5kID0gKG5ld1N0YXRlID09PSAnY29ubmVjdGVkJyk7XG5cbiAgaWYgKG5ld1N0YXRlID09PSAnZGlzY29ubmVjdGVkJyB8fCBuZXdTdGF0ZSA9PT0gJ3N0b3BwZWQnIHx8IG5ld1N0YXRlID09PSAnY2xvc2VkJykgdGhpcy5fcmVzZXQoKTtcblxuICAvLyBHcm91cCBzdWJzY3JpYmVzIHRvZ2V0aGVyIHRvIGhlbHAgc2VydmVyIG1ha2UgbW9yZSBlZmZpY2llbnQgY2FsbHNcbiAgdGhpcy5zdGFydEJ1bGsoKTtcbiAgLy8gRW1pdCB0aGUgZXZlbnQgdG8gYWxsIHF1ZXJpZXNcbiAgZm9yICh2YXIgaWQgaW4gdGhpcy5xdWVyaWVzKSB7XG4gICAgdmFyIHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW2lkXTtcbiAgICBxdWVyeS5fb25Db25uZWN0aW9uU3RhdGVDaGFuZ2VkKCk7XG4gIH1cbiAgLy8gRW1pdCB0aGUgZXZlbnQgdG8gYWxsIGRvY3VtZW50c1xuICBmb3IgKHZhciBjb2xsZWN0aW9uIGluIHRoaXMuY29sbGVjdGlvbnMpIHtcbiAgICB2YXIgZG9jcyA9IHRoaXMuY29sbGVjdGlvbnNbY29sbGVjdGlvbl07XG4gICAgZm9yICh2YXIgaWQgaW4gZG9jcykge1xuICAgICAgZG9jc1tpZF0uX29uQ29ubmVjdGlvblN0YXRlQ2hhbmdlZCgpO1xuICAgIH1cbiAgfVxuICB0aGlzLmVuZEJ1bGsoKTtcblxuICB0aGlzLmVtaXQobmV3U3RhdGUsIHJlYXNvbik7XG4gIHRoaXMuZW1pdCgnc3RhdGUnLCBuZXdTdGF0ZSwgcmVhc29uKTtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLnN0YXJ0QnVsayA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMuYnVsaykgdGhpcy5idWxrID0ge307XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5lbmRCdWxrID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLmJ1bGspIHtcbiAgICBmb3IgKHZhciBjb2xsZWN0aW9uIGluIHRoaXMuYnVsaykge1xuICAgICAgdmFyIGFjdGlvbnMgPSB0aGlzLmJ1bGtbY29sbGVjdGlvbl07XG4gICAgICB0aGlzLl9zZW5kQnVsaygnZicsIGNvbGxlY3Rpb24sIGFjdGlvbnMuZik7XG4gICAgICB0aGlzLl9zZW5kQnVsaygncycsIGNvbGxlY3Rpb24sIGFjdGlvbnMucyk7XG4gICAgICB0aGlzLl9zZW5kQnVsaygndScsIGNvbGxlY3Rpb24sIGFjdGlvbnMudSk7XG4gICAgfVxuICB9XG4gIHRoaXMuYnVsayA9IG51bGw7XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fc2VuZEJ1bGsgPSBmdW5jdGlvbihhY3Rpb24sIGNvbGxlY3Rpb24sIHZhbHVlcykge1xuICBpZiAoIXZhbHVlcykgcmV0dXJuO1xuICB2YXIgaWRzID0gW107XG4gIHZhciB2ZXJzaW9ucyA9IHt9O1xuICB2YXIgdmVyc2lvbnNDb3VudCA9IDA7XG4gIHZhciB2ZXJzaW9uSWQ7XG4gIGZvciAodmFyIGlkIGluIHZhbHVlcykge1xuICAgIHZhciB2YWx1ZSA9IHZhbHVlc1tpZF07XG4gICAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICAgIGlkcy5wdXNoKGlkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmVyc2lvbnNbaWRdID0gdmFsdWU7XG4gICAgICB2ZXJzaW9uSWQgPSBpZDtcbiAgICAgIHZlcnNpb25zQ291bnQrKztcbiAgICB9XG4gIH1cbiAgaWYgKGlkcy5sZW5ndGggPT09IDEpIHtcbiAgICB2YXIgaWQgPSBpZHNbMF07XG4gICAgdGhpcy5zZW5kKHthOiBhY3Rpb24sIGM6IGNvbGxlY3Rpb24sIGQ6IGlkfSk7XG4gIH0gZWxzZSBpZiAoaWRzLmxlbmd0aCkge1xuICAgIHRoaXMuc2VuZCh7YTogJ2InICsgYWN0aW9uLCBjOiBjb2xsZWN0aW9uLCBiOiBpZHN9KTtcbiAgfVxuICBpZiAodmVyc2lvbnNDb3VudCA9PT0gMSkge1xuICAgIHZhciB2ZXJzaW9uID0gdmVyc2lvbnNbdmVyc2lvbklkXTtcbiAgICB0aGlzLnNlbmQoe2E6IGFjdGlvbiwgYzogY29sbGVjdGlvbiwgZDogdmVyc2lvbklkLCB2OiB2ZXJzaW9ufSk7XG4gIH0gZWxzZSBpZiAodmVyc2lvbnNDb3VudCkge1xuICAgIHRoaXMuc2VuZCh7YTogJ2InICsgYWN0aW9uLCBjOiBjb2xsZWN0aW9uLCBiOiB2ZXJzaW9uc30pO1xuICB9XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fc2VuZEFjdGlvbiA9IGZ1bmN0aW9uKGFjdGlvbiwgZG9jLCB2ZXJzaW9uKSB7XG4gIC8vIEVuc3VyZSB0aGUgZG9jIGlzIHJlZ2lzdGVyZWQgc28gdGhhdCBpdCByZWNlaXZlcyB0aGUgcmVwbHkgbWVzc2FnZVxuICB0aGlzLl9hZGREb2MoZG9jKTtcbiAgaWYgKHRoaXMuYnVsaykge1xuICAgIC8vIEJ1bGsgc3Vic2NyaWJlXG4gICAgdmFyIGFjdGlvbnMgPSB0aGlzLmJ1bGtbZG9jLmNvbGxlY3Rpb25dIHx8ICh0aGlzLmJ1bGtbZG9jLmNvbGxlY3Rpb25dID0ge30pO1xuICAgIHZhciB2ZXJzaW9ucyA9IGFjdGlvbnNbYWN0aW9uXSB8fCAoYWN0aW9uc1thY3Rpb25dID0ge30pO1xuICAgIHZhciBpc0R1cGxpY2F0ZSA9IHZlcnNpb25zLmhhc093blByb3BlcnR5KGRvYy5pZCk7XG4gICAgdmVyc2lvbnNbZG9jLmlkXSA9IHZlcnNpb247XG4gICAgcmV0dXJuIGlzRHVwbGljYXRlO1xuICB9IGVsc2Uge1xuICAgIC8vIFNlbmQgc2luZ2xlIGRvYyBzdWJzY3JpYmUgbWVzc2FnZVxuICAgIHZhciBtZXNzYWdlID0ge2E6IGFjdGlvbiwgYzogZG9jLmNvbGxlY3Rpb24sIGQ6IGRvYy5pZCwgdjogdmVyc2lvbn07XG4gICAgdGhpcy5zZW5kKG1lc3NhZ2UpO1xuICB9XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5zZW5kRmV0Y2ggPSBmdW5jdGlvbihkb2MpIHtcbiAgcmV0dXJuIHRoaXMuX3NlbmRBY3Rpb24oJ2YnLCBkb2MsIGRvYy52ZXJzaW9uKTtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLnNlbmRTdWJzY3JpYmUgPSBmdW5jdGlvbihkb2MpIHtcbiAgcmV0dXJuIHRoaXMuX3NlbmRBY3Rpb24oJ3MnLCBkb2MsIGRvYy52ZXJzaW9uKTtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLnNlbmRVbnN1YnNjcmliZSA9IGZ1bmN0aW9uKGRvYykge1xuICByZXR1cm4gdGhpcy5fc2VuZEFjdGlvbigndScsIGRvYyk7XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5zZW5kT3AgPSBmdW5jdGlvbihkb2MsIG9wKSB7XG4gIC8vIEVuc3VyZSB0aGUgZG9jIGlzIHJlZ2lzdGVyZWQgc28gdGhhdCBpdCByZWNlaXZlcyB0aGUgcmVwbHkgbWVzc2FnZVxuICB0aGlzLl9hZGREb2MoZG9jKTtcbiAgdmFyIG1lc3NhZ2UgPSB7XG4gICAgYTogJ29wJyxcbiAgICBjOiBkb2MuY29sbGVjdGlvbixcbiAgICBkOiBkb2MuaWQsXG4gICAgdjogZG9jLnZlcnNpb24sXG4gICAgc3JjOiBvcC5zcmMsXG4gICAgc2VxOiBvcC5zZXFcbiAgfTtcbiAgaWYgKG9wLm9wKSBtZXNzYWdlLm9wID0gb3Aub3A7XG4gIGlmIChvcC5jcmVhdGUpIG1lc3NhZ2UuY3JlYXRlID0gb3AuY3JlYXRlO1xuICBpZiAob3AuZGVsKSBtZXNzYWdlLmRlbCA9IG9wLmRlbDtcbiAgdGhpcy5zZW5kKG1lc3NhZ2UpO1xufTtcblxuXG4vKipcbiAqIFNlbmRzIGEgbWVzc2FnZSBkb3duIHRoZSBzb2NrZXRcbiAqL1xuQ29ubmVjdGlvbi5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgaWYgKHRoaXMuZGVidWcpIGNvbnNvbGUubG9nKCdTRU5EJywgSlNPTi5zdHJpbmdpZnkobWVzc2FnZSkpO1xuXG4gIHRoaXMuZW1pdCgnc2VuZCcsIG1lc3NhZ2UpO1xuICB0aGlzLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpKTtcbn07XG5cblxuLyoqXG4gKiBDbG9zZXMgdGhlIHNvY2tldCBhbmQgZW1pdHMgJ2Nsb3NlZCdcbiAqL1xuQ29ubmVjdGlvbi5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5zb2NrZXQuY2xvc2UoKTtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLmdldEV4aXN0aW5nID0gZnVuY3Rpb24oY29sbGVjdGlvbiwgaWQpIHtcbiAgaWYgKHRoaXMuY29sbGVjdGlvbnNbY29sbGVjdGlvbl0pIHJldHVybiB0aGlzLmNvbGxlY3Rpb25zW2NvbGxlY3Rpb25dW2lkXTtcbn07XG5cblxuLyoqXG4gKiBHZXQgb3IgY3JlYXRlIGEgZG9jdW1lbnQuXG4gKlxuICogQHBhcmFtIGNvbGxlY3Rpb25cbiAqIEBwYXJhbSBpZFxuICogQHJldHVybiB7RG9jfVxuICovXG5Db25uZWN0aW9uLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihjb2xsZWN0aW9uLCBpZCkge1xuICB2YXIgZG9jcyA9IHRoaXMuY29sbGVjdGlvbnNbY29sbGVjdGlvbl0gfHxcbiAgICAodGhpcy5jb2xsZWN0aW9uc1tjb2xsZWN0aW9uXSA9IHt9KTtcblxuICB2YXIgZG9jID0gZG9jc1tpZF07XG4gIGlmICghZG9jKSB7XG4gICAgZG9jID0gZG9jc1tpZF0gPSBuZXcgRG9jKHRoaXMsIGNvbGxlY3Rpb24sIGlkKTtcbiAgICB0aGlzLmVtaXQoJ2RvYycsIGRvYyk7XG4gIH1cblxuICByZXR1cm4gZG9jO1xufTtcblxuXG4vKipcbiAqIFJlbW92ZSBkb2N1bWVudCBmcm9tIHRoaXMuY29sbGVjdGlvbnNcbiAqXG4gKiBAcHJpdmF0ZVxuICovXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fZGVzdHJveURvYyA9IGZ1bmN0aW9uKGRvYykge1xuICB2YXIgZG9jcyA9IHRoaXMuY29sbGVjdGlvbnNbZG9jLmNvbGxlY3Rpb25dO1xuICBpZiAoIWRvY3MpIHJldHVybjtcblxuICBkZWxldGUgZG9jc1tkb2MuaWRdO1xuXG4gIC8vIERlbGV0ZSB0aGUgY29sbGVjdGlvbiBjb250YWluZXIgaWYgaXRzIGVtcHR5LiBUaGlzIGNvdWxkIGJlIGEgc291cmNlIG9mXG4gIC8vIG1lbW9yeSBsZWFrcyBpZiB5b3Ugc2xvd2x5IG1ha2UgYSBiaWxsaW9uIGNvbGxlY3Rpb25zLCB3aGljaCB5b3UgcHJvYmFibHlcbiAgLy8gd29uJ3QgZG8gYW55d2F5LCBidXQgd2hhdGV2ZXIuXG4gIGlmICghdXRpbC5oYXNLZXlzKGRvY3MpKSB7XG4gICAgZGVsZXRlIHRoaXMuY29sbGVjdGlvbnNbZG9jLmNvbGxlY3Rpb25dO1xuICB9XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fYWRkRG9jID0gZnVuY3Rpb24oZG9jKSB7XG4gIHZhciBkb2NzID0gdGhpcy5jb2xsZWN0aW9uc1tkb2MuY29sbGVjdGlvbl07XG4gIGlmICghZG9jcykge1xuICAgIGRvY3MgPSB0aGlzLmNvbGxlY3Rpb25zW2RvYy5jb2xsZWN0aW9uXSA9IHt9O1xuICB9XG4gIGlmIChkb2NzW2RvYy5pZF0gIT09IGRvYykge1xuICAgIGRvY3NbZG9jLmlkXSA9IGRvYztcbiAgfVxufTtcblxuLy8gSGVscGVyIGZvciBjcmVhdGVGZXRjaFF1ZXJ5IGFuZCBjcmVhdGVTdWJzY3JpYmVRdWVyeSwgYmVsb3cuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fY3JlYXRlUXVlcnkgPSBmdW5jdGlvbihhY3Rpb24sIGNvbGxlY3Rpb24sIHEsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBpZCA9IHRoaXMubmV4dFF1ZXJ5SWQrKztcbiAgdmFyIHF1ZXJ5ID0gbmV3IFF1ZXJ5KGFjdGlvbiwgdGhpcywgaWQsIGNvbGxlY3Rpb24sIHEsIG9wdGlvbnMsIGNhbGxiYWNrKTtcbiAgdGhpcy5xdWVyaWVzW2lkXSA9IHF1ZXJ5O1xuICBxdWVyeS5zZW5kKCk7XG4gIHJldHVybiBxdWVyeTtcbn07XG5cbi8vIEludGVybmFsIGZ1bmN0aW9uLiBVc2UgcXVlcnkuZGVzdHJveSgpIHRvIHJlbW92ZSBxdWVyaWVzLlxuQ29ubmVjdGlvbi5wcm90b3R5cGUuX2Rlc3Ryb3lRdWVyeSA9IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gIGRlbGV0ZSB0aGlzLnF1ZXJpZXNbcXVlcnkuaWRdO1xufTtcblxuLy8gVGhlIHF1ZXJ5IG9wdGlvbnMgb2JqZWN0IGNhbiBjb250YWluIHRoZSBmb2xsb3dpbmcgZmllbGRzOlxuLy9cbi8vIGRiOiBOYW1lIG9mIHRoZSBkYiBmb3IgdGhlIHF1ZXJ5LiBZb3UgY2FuIGF0dGFjaCBleHRyYURicyB0byBTaGFyZURCIGFuZFxuLy8gICBwaWNrIHdoaWNoIG9uZSB0aGUgcXVlcnkgc2hvdWxkIGhpdCB1c2luZyB0aGlzIHBhcmFtZXRlci5cblxuLy8gQ3JlYXRlIGEgZmV0Y2ggcXVlcnkuIEZldGNoIHF1ZXJpZXMgYXJlIG9ubHkgaXNzdWVkIG9uY2UsIHJldHVybmluZyB0aGVcbi8vIHJlc3VsdHMgZGlyZWN0bHkgaW50byB0aGUgY2FsbGJhY2suXG4vL1xuLy8gVGhlIGNhbGxiYWNrIHNob3VsZCBoYXZlIHRoZSBzaWduYXR1cmUgZnVuY3Rpb24oZXJyb3IsIHJlc3VsdHMsIGV4dHJhKVxuLy8gd2hlcmUgcmVzdWx0cyBpcyBhIGxpc3Qgb2YgRG9jIG9iamVjdHMuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5jcmVhdGVGZXRjaFF1ZXJ5ID0gZnVuY3Rpb24oY29sbGVjdGlvbiwgcSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgcmV0dXJuIHRoaXMuX2NyZWF0ZVF1ZXJ5KCdxZicsIGNvbGxlY3Rpb24sIHEsIG9wdGlvbnMsIGNhbGxiYWNrKTtcbn07XG5cbi8vIENyZWF0ZSBhIHN1YnNjcmliZSBxdWVyeS4gU3Vic2NyaWJlIHF1ZXJpZXMgcmV0dXJuIHdpdGggdGhlIGluaXRpYWwgZGF0YVxuLy8gdGhyb3VnaCB0aGUgY2FsbGJhY2ssIHRoZW4gdXBkYXRlIHRoZW1zZWx2ZXMgd2hlbmV2ZXIgdGhlIHF1ZXJ5IHJlc3VsdCBzZXRcbi8vIGNoYW5nZXMgdmlhIHRoZWlyIG93biBldmVudCBlbWl0dGVyLlxuLy9cbi8vIElmIHByZXNlbnQsIHRoZSBjYWxsYmFjayBzaG91bGQgaGF2ZSB0aGUgc2lnbmF0dXJlIGZ1bmN0aW9uKGVycm9yLCByZXN1bHRzLCBleHRyYSlcbi8vIHdoZXJlIHJlc3VsdHMgaXMgYSBsaXN0IG9mIERvYyBvYmplY3RzLlxuQ29ubmVjdGlvbi5wcm90b3R5cGUuY3JlYXRlU3Vic2NyaWJlUXVlcnkgPSBmdW5jdGlvbihjb2xsZWN0aW9uLCBxLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICByZXR1cm4gdGhpcy5fY3JlYXRlUXVlcnkoJ3FzJywgY29sbGVjdGlvbiwgcSwgb3B0aW9ucywgY2FsbGJhY2spO1xufTtcblxuQ29ubmVjdGlvbi5wcm90b3R5cGUuaGFzUGVuZGluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gISEoXG4gICAgdGhpcy5fZmlyc3REb2MoaGFzUGVuZGluZykgfHxcbiAgICB0aGlzLl9maXJzdFF1ZXJ5KGhhc1BlbmRpbmcpXG4gICk7XG59O1xuZnVuY3Rpb24gaGFzUGVuZGluZyhvYmplY3QpIHtcbiAgcmV0dXJuIG9iamVjdC5oYXNQZW5kaW5nKCk7XG59XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLmhhc1dyaXRlUGVuZGluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gISF0aGlzLl9maXJzdERvYyhoYXNXcml0ZVBlbmRpbmcpO1xufTtcbmZ1bmN0aW9uIGhhc1dyaXRlUGVuZGluZyhvYmplY3QpIHtcbiAgcmV0dXJuIG9iamVjdC5oYXNXcml0ZVBlbmRpbmcoKTtcbn1cblxuQ29ubmVjdGlvbi5wcm90b3R5cGUud2hlbk5vdGhpbmdQZW5kaW5nID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgdmFyIGRvYyA9IHRoaXMuX2ZpcnN0RG9jKGhhc1BlbmRpbmcpO1xuICBpZiAoZG9jKSB7XG4gICAgLy8gSWYgYSBkb2N1bWVudCBpcyBmb3VuZCB3aXRoIGEgcGVuZGluZyBvcGVyYXRpb24sIHdhaXQgZm9yIGl0IHRvIGVtaXRcbiAgICAvLyB0aGF0IG5vdGhpbmcgaXMgcGVuZGluZyBhbnltb3JlLCBhbmQgdGhlbiByZWNoZWNrIGFsbCBkb2N1bWVudHMgYWdhaW4uXG4gICAgLy8gV2UgaGF2ZSB0byByZWNoZWNrIGFsbCBkb2N1bWVudHMsIGp1c3QgaW4gY2FzZSBhbm90aGVyIG11dGF0aW9uIGhhc1xuICAgIC8vIGJlZW4gbWFkZSBpbiB0aGUgbWVhbnRpbWUgYXMgYSByZXN1bHQgb2YgYW4gZXZlbnQgY2FsbGJhY2tcbiAgICBkb2Mub25jZSgnbm90aGluZyBwZW5kaW5nJywgdGhpcy5fbm90aGluZ1BlbmRpbmdSZXRyeShjYWxsYmFjaykpO1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgcXVlcnkgPSB0aGlzLl9maXJzdFF1ZXJ5KGhhc1BlbmRpbmcpO1xuICBpZiAocXVlcnkpIHtcbiAgICBxdWVyeS5vbmNlKCdyZWFkeScsIHRoaXMuX25vdGhpbmdQZW5kaW5nUmV0cnkoY2FsbGJhY2spKTtcbiAgICByZXR1cm47XG4gIH1cbiAgLy8gQ2FsbCBiYWNrIHdoZW4gbm8gcGVuZGluZyBvcGVyYXRpb25zXG4gIHByb2Nlc3MubmV4dFRpY2soY2FsbGJhY2spO1xufTtcbkNvbm5lY3Rpb24ucHJvdG90eXBlLl9ub3RoaW5nUGVuZGluZ1JldHJ5ID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgdmFyIGNvbm5lY3Rpb24gPSB0aGlzO1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICAgIGNvbm5lY3Rpb24ud2hlbk5vdGhpbmdQZW5kaW5nKGNhbGxiYWNrKTtcbiAgICB9KTtcbiAgfTtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLl9maXJzdERvYyA9IGZ1bmN0aW9uKGZuKSB7XG4gIGZvciAodmFyIGNvbGxlY3Rpb24gaW4gdGhpcy5jb2xsZWN0aW9ucykge1xuICAgIHZhciBkb2NzID0gdGhpcy5jb2xsZWN0aW9uc1tjb2xsZWN0aW9uXTtcbiAgICBmb3IgKHZhciBpZCBpbiBkb2NzKSB7XG4gICAgICB2YXIgZG9jID0gZG9jc1tpZF07XG4gICAgICBpZiAoZm4oZG9jKSkge1xuICAgICAgICByZXR1cm4gZG9jO1xuICAgICAgfVxuICAgIH1cbiAgfVxufTtcblxuQ29ubmVjdGlvbi5wcm90b3R5cGUuX2ZpcnN0UXVlcnkgPSBmdW5jdGlvbihmbikge1xuICBmb3IgKHZhciBpZCBpbiB0aGlzLnF1ZXJpZXMpIHtcbiAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbaWRdO1xuICAgIGlmIChmbihxdWVyeSkpIHtcbiAgICAgIHJldHVybiBxdWVyeTtcbiAgICB9XG4gIH1cbn07XG4iLCJ2YXIgZW1pdHRlciA9IHJlcXVpcmUoJy4uL2VtaXR0ZXInKTtcbnZhciBTaGFyZURCRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvcicpO1xudmFyIHR5cGVzID0gcmVxdWlyZSgnLi4vdHlwZXMnKTtcblxuLyoqXG4gKiBBIERvYyBpcyBhIGNsaWVudCdzIHZpZXcgb24gYSBzaGFyZWpzIGRvY3VtZW50LlxuICpcbiAqIEl0IGlzIGlzIHVuaXF1ZWx5IGlkZW50aWZpZWQgYnkgaXRzIGBpZGAgYW5kIGBjb2xsZWN0aW9uYC4gIERvY3VtZW50c1xuICogc2hvdWxkIG5vdCBiZSBjcmVhdGVkIGRpcmVjdGx5LiBDcmVhdGUgdGhlbSB3aXRoIGNvbm5lY3Rpb24uZ2V0KClcbiAqXG4gKlxuICogU3Vic2NyaXB0aW9uc1xuICogLS0tLS0tLS0tLS0tLVxuICpcbiAqIFdlIGNhbiBzdWJzY3JpYmUgYSBkb2N1bWVudCB0byBzdGF5IGluIHN5bmMgd2l0aCB0aGUgc2VydmVyLlxuICogICBkb2Muc3Vic2NyaWJlKGZ1bmN0aW9uKGVycm9yKSB7XG4gKiAgICAgZG9jLnN1YnNjcmliZWQgLy8gPSB0cnVlXG4gKiAgIH0pXG4gKiBUaGUgc2VydmVyIG5vdyBzZW5kcyB1cyBhbGwgY2hhbmdlcyBjb25jZXJuaW5nIHRoaXMgZG9jdW1lbnQgYW5kIHRoZXNlIGFyZVxuICogYXBwbGllZCB0byBvdXIgZGF0YS4gSWYgdGhlIHN1YnNjcmlwdGlvbiB3YXMgc3VjY2Vzc2Z1bCB0aGUgaW5pdGlhbFxuICogZGF0YSBhbmQgdmVyc2lvbiBzZW50IGJ5IHRoZSBzZXJ2ZXIgYXJlIGxvYWRlZCBpbnRvIHRoZSBkb2N1bWVudC5cbiAqXG4gKiBUbyBzdG9wIGxpc3RlbmluZyB0byB0aGUgY2hhbmdlcyB3ZSBjYWxsIGBkb2MudW5zdWJzY3JpYmUoKWAuXG4gKlxuICogSWYgd2UganVzdCB3YW50IHRvIGxvYWQgdGhlIGRhdGEgYnV0IG5vdCBzdGF5IHVwLXRvLWRhdGUsIHdlIGNhbGxcbiAqICAgZG9jLmZldGNoKGZ1bmN0aW9uKGVycm9yKSB7XG4gKiAgICAgZG9jLmRhdGEgLy8gc2VudCBieSBzZXJ2ZXJcbiAqICAgfSlcbiAqXG4gKlxuICogRXZlbnRzXG4gKiAtLS0tLS1cbiAqXG4gKiBZb3UgY2FuIHVzZSBkb2Mub24oZXZlbnROYW1lLCBjYWxsYmFjaykgdG8gc3Vic2NyaWJlIHRvIHRoZSBmb2xsb3dpbmcgZXZlbnRzOlxuICogLSBgYmVmb3JlIG9wIChvcCwgc291cmNlKWAgRmlyZWQgYmVmb3JlIGEgcGFydGlhbCBvcGVyYXRpb24gaXMgYXBwbGllZCB0byB0aGUgZGF0YS5cbiAqICAgSXQgbWF5IGJlIHVzZWQgdG8gcmVhZCB0aGUgb2xkIGRhdGEganVzdCBiZWZvcmUgYXBwbHlpbmcgYW4gb3BlcmF0aW9uXG4gKiAtIGBvcCAob3AsIHNvdXJjZSlgIEZpcmVkIGFmdGVyIGV2ZXJ5IHBhcnRpYWwgb3BlcmF0aW9uIHdpdGggdGhpcyBvcGVyYXRpb24gYXMgdGhlXG4gKiAgIGZpcnN0IGFyZ3VtZW50XG4gKiAtIGBjcmVhdGUgKHNvdXJjZSlgIFRoZSBkb2N1bWVudCB3YXMgY3JlYXRlZC4gVGhhdCBtZWFucyBpdHMgdHlwZSB3YXNcbiAqICAgc2V0IGFuZCBpdCBoYXMgc29tZSBpbml0aWFsIGRhdGEuXG4gKiAtIGBkZWwgKGRhdGEsIHNvdXJjZSlgIEZpcmVkIGFmdGVyIHRoZSBkb2N1bWVudCBpcyBkZWxldGVkLCB0aGF0IGlzXG4gKiAgIHRoZSBkYXRhIGlzIG51bGwuIEl0IGlzIHBhc3NlZCB0aGUgZGF0YSBiZWZvcmUgZGVsdGVpb24gYXMgYW5cbiAqICAgYXJndW1lbnRzXG4gKiAtIGBsb2FkICgpYCBGaXJlZCB3aGVuIGEgbmV3IHNuYXBzaG90IGlzIGluZ2VzdGVkIGZyb20gYSBmZXRjaCwgc3Vic2NyaWJlLCBvciBxdWVyeVxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gRG9jO1xuZnVuY3Rpb24gRG9jKGNvbm5lY3Rpb24sIGNvbGxlY3Rpb24sIGlkKSB7XG4gIGVtaXR0ZXIuRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG5cbiAgdGhpcy5jb25uZWN0aW9uID0gY29ubmVjdGlvbjtcblxuICB0aGlzLmNvbGxlY3Rpb24gPSBjb2xsZWN0aW9uO1xuICB0aGlzLmlkID0gaWQ7XG5cbiAgdGhpcy52ZXJzaW9uID0gbnVsbDtcbiAgdGhpcy50eXBlID0gbnVsbDtcbiAgdGhpcy5kYXRhID0gdW5kZWZpbmVkO1xuXG4gIC8vIEFycmF5IG9mIGNhbGxiYWNrcyBvciBudWxscyBhcyBwbGFjZWhvbGRlcnNcbiAgdGhpcy5pbmZsaWdodEZldGNoID0gW107XG4gIHRoaXMuaW5mbGlnaHRTdWJzY3JpYmUgPSBbXTtcbiAgdGhpcy5pbmZsaWdodFVuc3Vic2NyaWJlID0gW107XG4gIHRoaXMucGVuZGluZ0ZldGNoID0gW107XG5cbiAgLy8gV2hldGhlciB3ZSB0aGluayB3ZSBhcmUgc3Vic2NyaWJlZCBvbiB0aGUgc2VydmVyLiBTeW5jaHJvbm91c2x5IHNldCB0b1xuICAvLyBmYWxzZSBvbiBjYWxscyB0byB1bnN1YnNjcmliZSBhbmQgZGlzY29ubmVjdC4gU2hvdWxkIG5ldmVyIGJlIHRydWUgd2hlblxuICAvLyB0aGlzLndhbnRTdWJzY3JpYmUgaXMgZmFsc2VcbiAgdGhpcy5zdWJzY3JpYmVkID0gZmFsc2U7XG4gIC8vIFdoZXRoZXIgdG8gcmUtZXN0YWJsaXNoIHRoZSBzdWJzY3JpcHRpb24gb24gcmVjb25uZWN0XG4gIHRoaXMud2FudFN1YnNjcmliZSA9IGZhbHNlO1xuXG4gIC8vIFRoZSBvcCB0aGF0IGlzIGN1cnJlbnRseSByb3VuZHRyaXBwaW5nIHRvIHRoZSBzZXJ2ZXIsIG9yIG51bGwuXG4gIC8vXG4gIC8vIFdoZW4gdGhlIGNvbm5lY3Rpb24gcmVjb25uZWN0cywgdGhlIGluZmxpZ2h0IG9wIGlzIHJlc3VibWl0dGVkLlxuICAvL1xuICAvLyBUaGlzIGhhcyB0aGUgc2FtZSBmb3JtYXQgYXMgYW4gZW50cnkgaW4gcGVuZGluZ09wc1xuICB0aGlzLmluZmxpZ2h0T3AgPSBudWxsO1xuXG4gIC8vIEFsbCBvcHMgdGhhdCBhcmUgd2FpdGluZyBmb3IgdGhlIHNlcnZlciB0byBhY2tub3dsZWRnZSB0aGlzLmluZmxpZ2h0T3BcbiAgLy8gVGhpcyB1c2VkIHRvIGp1c3QgYmUgYSBzaW5nbGUgb3BlcmF0aW9uLCBidXQgY3JlYXRlcyAmIGRlbGV0ZXMgY2FuJ3QgYmVcbiAgLy8gY29tcG9zZWQgd2l0aCByZWd1bGFyIG9wZXJhdGlvbnMuXG4gIC8vXG4gIC8vIFRoaXMgaXMgYSBsaXN0IG9mIHtbY3JlYXRlOnsuLi59XSwgW2RlbDp0cnVlXSwgW29wOi4uLl0sIGNhbGxiYWNrczpbLi4uXX1cbiAgdGhpcy5wZW5kaW5nT3BzID0gW107XG5cbiAgLy8gVGhlIE9UIHR5cGUgb2YgdGhpcyBkb2N1bWVudC4gQW4gdW5jcmVhdGVkIGRvY3VtZW50IGhhcyB0eXBlIGBudWxsYFxuICB0aGlzLnR5cGUgPSBudWxsO1xuXG4gIC8vIFRoZSBhcHBseVN0YWNrIGVuYWJsZXMgdXMgdG8gdHJhY2sgYW55IG9wcyBzdWJtaXR0ZWQgd2hpbGUgd2UgYXJlXG4gIC8vIGFwcGx5aW5nIGFuIG9wIGluY3JlbWVudGFsbHkuIFRoaXMgdmFsdWUgaXMgYW4gYXJyYXkgd2hlbiB3ZSBhcmVcbiAgLy8gcGVyZm9ybWluZyBhbiBpbmNyZW1lbnRhbCBhcHBseSBhbmQgbnVsbCBvdGhlcndpc2UuIFdoZW4gaXQgaXMgYW4gYXJyYXksXG4gIC8vIGFsbCBzdWJtaXR0ZWQgb3BzIHNob3VsZCBiZSBwdXNoZWQgb250byBpdC4gVGhlIGBfb3RBcHBseWAgbWV0aG9kIHdpbGxcbiAgLy8gcmVzZXQgaXQgYmFjayB0byBudWxsIHdoZW4gYWxsIGluY3JlbWVudGFsIGFwcGx5IGxvb3BzIGFyZSBjb21wbGV0ZS5cbiAgdGhpcy5hcHBseVN0YWNrID0gbnVsbDtcblxuICAvLyBEaXNhYmxlIHRoZSBkZWZhdWx0IGJlaGF2aW9yIG9mIGNvbXBvc2luZyBzdWJtaXR0ZWQgb3BzLiBUaGlzIGlzIHJlYWQgYXRcbiAgLy8gdGhlIHRpbWUgb2Ygb3Agc3VibWl0LCBzbyBpdCBtYXkgYmUgdG9nZ2xlZCBvbiBiZWZvcmUgc3VibWl0dGluZyBhXG4gIC8vIHNwZWNpZmMgb3AgYW5kIHRvZ2dsZWQgb2ZmIGFmdGVyd2FyZFxuICB0aGlzLnByZXZlbnRDb21wb3NlID0gZmFsc2U7XG59XG5lbWl0dGVyLm1peGluKERvYyk7XG5cbkRvYy5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIHZhciBkb2MgPSB0aGlzO1xuICBkb2Mud2hlbk5vdGhpbmdQZW5kaW5nKGZ1bmN0aW9uKCkge1xuICAgIGRvYy5jb25uZWN0aW9uLl9kZXN0cm95RG9jKGRvYyk7XG4gICAgaWYgKGRvYy53YW50U3Vic2NyaWJlKSB7XG4gICAgICByZXR1cm4gZG9jLnVuc3Vic2NyaWJlKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjaygpO1xuICB9KTtcbn07XG5cblxuLy8gKioqKioqIE1hbmlwdWxhdGluZyB0aGUgZG9jdW1lbnQgZGF0YSwgdmVyc2lvbiBhbmQgdHlwZS5cblxuLy8gU2V0IHRoZSBkb2N1bWVudCdzIHR5cGUsIGFuZCBhc3NvY2lhdGVkIHByb3BlcnRpZXMuIE1vc3Qgb2YgdGhlIGxvZ2ljIGluXG4vLyB0aGlzIGZ1bmN0aW9uIGV4aXN0cyB0byB1cGRhdGUgdGhlIGRvY3VtZW50IGJhc2VkIG9uIGFueSBhZGRlZCAmIHJlbW92ZWQgQVBJXG4vLyBtZXRob2RzLlxuLy9cbi8vIEBwYXJhbSBuZXdUeXBlIE9UIHR5cGUgcHJvdmlkZWQgYnkgdGhlIG90dHlwZXMgbGlicmFyeSBvciBpdHMgbmFtZSBvciB1cmlcbkRvYy5wcm90b3R5cGUuX3NldFR5cGUgPSBmdW5jdGlvbihuZXdUeXBlKSB7XG5cbiAgY29uc29sZS5sb2codHlwZXMubWFwKVxuICBpZiAodHlwZW9mIG5ld1R5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgbmV3VHlwZSA9IHR5cGVzLm1hcFtuZXdUeXBlXTtcbiAgfVxuXG4gIGlmIChuZXdUeXBlKSB7XG4gICAgdGhpcy50eXBlID0gbmV3VHlwZTtcblxuICB9IGVsc2UgaWYgKG5ld1R5cGUgPT09IG51bGwpIHtcbiAgICB0aGlzLnR5cGUgPSBuZXdUeXBlO1xuICAgIC8vIElmIHdlIHJlbW92ZWQgdGhlIHR5cGUgZnJvbSB0aGUgb2JqZWN0LCBhbHNvIHJlbW92ZSBpdHMgZGF0YVxuICAgIHRoaXMuZGF0YSA9IHVuZGVmaW5lZDtcblxuICB9IGVsc2Uge1xuICAgIHZhciBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDQwMDgsICdNaXNzaW5nIHR5cGUgJyArIG5ld1R5cGUpO1xuICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgfVxufTtcblxuLy8gSW5nZXN0IHNuYXBzaG90IGRhdGEuIFRoaXMgZGF0YSBtdXN0IGluY2x1ZGUgYSB2ZXJzaW9uLCBzbmFwc2hvdCBhbmQgdHlwZS5cbi8vIFRoaXMgaXMgdXNlZCBib3RoIHRvIGluZ2VzdCBkYXRhIHRoYXQgd2FzIGV4cG9ydGVkIHdpdGggYSB3ZWJwYWdlIGFuZCBkYXRhXG4vLyB0aGF0IHdhcyByZWNlaXZlZCBmcm9tIHRoZSBzZXJ2ZXIgZHVyaW5nIGEgZmV0Y2guXG4vL1xuLy8gQHBhcmFtIHNuYXBzaG90LnYgICAgdmVyc2lvblxuLy8gQHBhcmFtIHNuYXBzaG90LmRhdGFcbi8vIEBwYXJhbSBzbmFwc2hvdC50eXBlXG4vLyBAcGFyYW0gY2FsbGJhY2tcbkRvYy5wcm90b3R5cGUuaW5nZXN0U25hcHNob3QgPSBmdW5jdGlvbihzbmFwc2hvdCwgY2FsbGJhY2spIHtcbiAgaWYgKCFzbmFwc2hvdCkgcmV0dXJuIGNhbGxiYWNrICYmIGNhbGxiYWNrKCk7XG5cbiAgaWYgKHR5cGVvZiBzbmFwc2hvdC52ICE9PSAnbnVtYmVyJykge1xuICAgIHZhciBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDUwMDgsICdNaXNzaW5nIHZlcnNpb24gaW4gaW5nZXN0ZWQgc25hcHNob3QuICcgKyB0aGlzLmNvbGxlY3Rpb24gKyAnLicgKyB0aGlzLmlkKTtcbiAgICBpZiAoY2FsbGJhY2spIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgfVxuXG4gIC8vIElmIHRoZSBkb2MgaXMgYWxyZWFkeSBjcmVhdGVkIG9yIHRoZXJlIGFyZSBvcHMgcGVuZGluZywgd2UgY2Fubm90IHVzZSB0aGVcbiAgLy8gaW5nZXN0ZWQgc25hcHNob3QgYW5kIG5lZWQgb3BzIGluIG9yZGVyIHRvIHVwZGF0ZSB0aGUgZG9jdW1lbnRcbiAgaWYgKHRoaXMudHlwZSB8fCB0aGlzLmhhc1dyaXRlUGVuZGluZygpKSB7XG4gICAgLy8gVGhlIHZlcnNpb24gc2hvdWxkIG9ubHkgYmUgbnVsbCBvbiBhIGNyZWF0ZWQgZG9jdW1lbnQgd2hlbiBpdCB3YXNcbiAgICAvLyBjcmVhdGVkIGxvY2FsbHkgd2l0aG91dCBmZXRjaGluZ1xuICAgIGlmICh0aGlzLnZlcnNpb24gPT0gbnVsbCkge1xuICAgICAgaWYgKHRoaXMuaGFzV3JpdGVQZW5kaW5nKCkpIHtcbiAgICAgICAgLy8gSWYgd2UgaGF2ZSBwZW5kaW5nIG9wcyBhbmQgd2UgZ2V0IGEgc25hcHNob3QgZm9yIGEgbG9jYWxseSBjcmVhdGVkXG4gICAgICAgIC8vIGRvY3VtZW50LCB3ZSBoYXZlIHRvIHdhaXQgZm9yIHRoZSBwZW5kaW5nIG9wcyB0byBjb21wbGV0ZSwgYmVjYXVzZVxuICAgICAgICAvLyB3ZSBkb24ndCBrbm93IHdoYXQgdmVyc2lvbiB0byBmZXRjaCBvcHMgZnJvbS4gSXQgaXMgcG9zc2libGUgdGhhdFxuICAgICAgICAvLyB0aGUgc25hcHNob3QgY2FtZSBmcm9tIG91ciBsb2NhbCBvcCwgYnV0IGl0IGlzIGFsc28gcG9zc2libGUgdGhhdFxuICAgICAgICAvLyB0aGUgZG9jIHdhcyBjcmVhdGVkIHJlbW90ZWx5ICh3aGljaCB3b3VsZCBjb25mbGljdCBhbmQgYmUgYW4gZXJyb3IpXG4gICAgICAgIHJldHVybiBjYWxsYmFjayAmJiB0aGlzLm9uY2UoJ25vIHdyaXRlIHBlbmRpbmcnLCBjYWxsYmFjayk7XG4gICAgICB9XG4gICAgICAvLyBPdGhlcndpc2UsIHdlJ3ZlIGVuY291bnRlZCBhbiBlcnJvciBzdGF0ZVxuICAgICAgdmFyIGVyciA9IG5ldyBTaGFyZURCRXJyb3IoNTAwOSwgJ0Nhbm5vdCBpbmdlc3Qgc25hcHNob3QgaW4gZG9jIHdpdGggbnVsbCB2ZXJzaW9uLiAnICsgdGhpcy5jb2xsZWN0aW9uICsgJy4nICsgdGhpcy5pZCk7XG4gICAgICBpZiAoY2FsbGJhY2spIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgIH1cbiAgICAvLyBJZiB3ZSBnb3QgYSBzbmFwc2hvdCBmb3IgYSB2ZXJzaW9uIGZ1cnRoZXIgYWxvbmcgdGhhbiB0aGUgZG9jdW1lbnQgaXNcbiAgICAvLyBjdXJyZW50bHksIGlzc3VlIGEgZmV0Y2ggdG8gZ2V0IHRoZSBsYXRlc3Qgb3BzIGFuZCBjYXRjaCB1cyB1cFxuICAgIGlmIChzbmFwc2hvdC52ID4gdGhpcy52ZXJzaW9uKSByZXR1cm4gdGhpcy5mZXRjaChjYWxsYmFjayk7XG4gICAgcmV0dXJuIGNhbGxiYWNrICYmIGNhbGxiYWNrKCk7XG4gIH1cblxuICAvLyBJZ25vcmUgdGhlIHNuYXBzaG90IGlmIHdlIGFyZSBhbHJlYWR5IGF0IGEgbmV3ZXIgdmVyc2lvbi4gVW5kZXIgbm9cbiAgLy8gY2lyY3Vtc3RhbmNlIHNob3VsZCB3ZSBldmVyIHNldCB0aGUgY3VycmVudCB2ZXJzaW9uIGJhY2t3YXJkXG4gIGlmICh0aGlzLnZlcnNpb24gPiBzbmFwc2hvdC52KSByZXR1cm4gY2FsbGJhY2sgJiYgY2FsbGJhY2soKTtcblxuICB0aGlzLnZlcnNpb24gPSBzbmFwc2hvdC52O1xuICB2YXIgdHlwZSA9IChzbmFwc2hvdC50eXBlID09PSB1bmRlZmluZWQpID8gdHlwZXMuZGVmYXVsdFR5cGUgOiBzbmFwc2hvdC50eXBlO1xuICB0aGlzLl9zZXRUeXBlKHR5cGUpO1xuICB0aGlzLmRhdGEgPSAodGhpcy50eXBlICYmIHRoaXMudHlwZS5kZXNlcmlhbGl6ZSkgP1xuICAgIHRoaXMudHlwZS5kZXNlcmlhbGl6ZShzbmFwc2hvdC5kYXRhKSA6XG4gICAgc25hcHNob3QuZGF0YTtcbiAgdGhpcy5lbWl0KCdsb2FkJyk7XG4gIGNhbGxiYWNrICYmIGNhbGxiYWNrKCk7XG59O1xuXG5Eb2MucHJvdG90eXBlLndoZW5Ob3RoaW5nUGVuZGluZyA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIGlmICh0aGlzLmhhc1BlbmRpbmcoKSkge1xuICAgIHRoaXMub25jZSgnbm90aGluZyBwZW5kaW5nJywgY2FsbGJhY2spO1xuICAgIHJldHVybjtcbiAgfVxuICBjYWxsYmFjaygpO1xufTtcblxuRG9jLnByb3RvdHlwZS5oYXNQZW5kaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiAhIShcbiAgICB0aGlzLmluZmxpZ2h0T3AgfHxcbiAgICB0aGlzLnBlbmRpbmdPcHMubGVuZ3RoIHx8XG4gICAgdGhpcy5pbmZsaWdodEZldGNoLmxlbmd0aCB8fFxuICAgIHRoaXMuaW5mbGlnaHRTdWJzY3JpYmUubGVuZ3RoIHx8XG4gICAgdGhpcy5pbmZsaWdodFVuc3Vic2NyaWJlLmxlbmd0aCB8fFxuICAgIHRoaXMucGVuZGluZ0ZldGNoLmxlbmd0aFxuICApO1xufTtcblxuRG9jLnByb3RvdHlwZS5oYXNXcml0ZVBlbmRpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuICEhKHRoaXMuaW5mbGlnaHRPcCB8fCB0aGlzLnBlbmRpbmdPcHMubGVuZ3RoKTtcbn07XG5cbkRvYy5wcm90b3R5cGUuX2VtaXROb3RoaW5nUGVuZGluZyA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5oYXNXcml0ZVBlbmRpbmcoKSkgcmV0dXJuO1xuICB0aGlzLmVtaXQoJ25vIHdyaXRlIHBlbmRpbmcnKTtcbiAgaWYgKHRoaXMuaGFzUGVuZGluZygpKSByZXR1cm47XG4gIHRoaXMuZW1pdCgnbm90aGluZyBwZW5kaW5nJyk7XG59O1xuXG4vLyAqKioqIEhlbHBlcnMgZm9yIG5ldHdvcmsgbWVzc2FnZXNcblxuRG9jLnByb3RvdHlwZS5fZW1pdFJlc3BvbnNlRXJyb3IgPSBmdW5jdGlvbihlcnIsIGNhbGxiYWNrKSB7XG4gIGlmIChjYWxsYmFjaykge1xuICAgIGNhbGxiYWNrKGVycik7XG4gICAgdGhpcy5fZW1pdE5vdGhpbmdQZW5kaW5nKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHRoaXMuX2VtaXROb3RoaW5nUGVuZGluZygpO1xuICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbn07XG5cbkRvYy5wcm90b3R5cGUuX2hhbmRsZUZldGNoID0gZnVuY3Rpb24oZXJyLCBzbmFwc2hvdCkge1xuICB2YXIgY2FsbGJhY2sgPSB0aGlzLmluZmxpZ2h0RmV0Y2guc2hpZnQoKTtcbiAgaWYgKGVycikgcmV0dXJuIHRoaXMuX2VtaXRSZXNwb25zZUVycm9yKGVyciwgY2FsbGJhY2spO1xuICB0aGlzLmluZ2VzdFNuYXBzaG90KHNuYXBzaG90LCBjYWxsYmFjayk7XG4gIHRoaXMuX2VtaXROb3RoaW5nUGVuZGluZygpO1xufTtcblxuRG9jLnByb3RvdHlwZS5faGFuZGxlU3Vic2NyaWJlID0gZnVuY3Rpb24oZXJyLCBzbmFwc2hvdCkge1xuICB2YXIgY2FsbGJhY2sgPSB0aGlzLmluZmxpZ2h0U3Vic2NyaWJlLnNoaWZ0KCk7XG4gIGlmIChlcnIpIHJldHVybiB0aGlzLl9lbWl0UmVzcG9uc2VFcnJvcihlcnIsIGNhbGxiYWNrKTtcbiAgLy8gSW5kaWNhdGUgd2UgYXJlIHN1YnNjcmliZWQgb25seSBpZiB0aGUgY2xpZW50IHN0aWxsIHdhbnRzIHRvIGJlLiBJbiB0aGVcbiAgLy8gdGltZSBzaW5jZSBjYWxsaW5nIHN1YnNjcmliZSBhbmQgcmVjZWl2aW5nIGEgcmVzcG9uc2UgZnJvbSB0aGUgc2VydmVyLFxuICAvLyB1bnN1YnNjcmliZSBjb3VsZCBoYXZlIGJlZW4gY2FsbGVkIGFuZCB3ZSBtaWdodCBhbHJlYWR5IGJlIHVuc3Vic2NyaWJlZFxuICAvLyBidXQgbm90IGhhdmUgcmVjZWl2ZWQgdGhlIHJlc3BvbnNlLiBBbHNvLCBiZWNhdXNlIHJlcXVlc3RzIGZyb20gdGhlXG4gIC8vIGNsaWVudCBhcmUgbm90IHNlcmlhbGl6ZWQgYW5kIG1heSB0YWtlIGRpZmZlcmVudCBhc3luYyB0aW1lIHRvIHByb2Nlc3MsXG4gIC8vIGl0IGlzIHBvc3NpYmxlIHRoYXQgd2UgY291bGQgaGVhciByZXNwb25zZXMgYmFjayBpbiBhIGRpZmZlcmVudCBvcmRlclxuICAvLyBmcm9tIHRoZSBvcmRlciBvcmlnaW5hbGx5IHNlbnRcbiAgaWYgKHRoaXMud2FudFN1YnNjcmliZSkgdGhpcy5zdWJzY3JpYmVkID0gdHJ1ZTtcbiAgdGhpcy5pbmdlc3RTbmFwc2hvdChzbmFwc2hvdCwgY2FsbGJhY2spO1xuICB0aGlzLl9lbWl0Tm90aGluZ1BlbmRpbmcoKTtcbn07XG5cbkRvYy5wcm90b3R5cGUuX2hhbmRsZVVuc3Vic2NyaWJlID0gZnVuY3Rpb24oZXJyKSB7XG4gIHZhciBjYWxsYmFjayA9IHRoaXMuaW5mbGlnaHRVbnN1YnNjcmliZS5zaGlmdCgpO1xuICBpZiAoZXJyKSByZXR1cm4gdGhpcy5fZW1pdFJlc3BvbnNlRXJyb3IoZXJyLCBjYWxsYmFjayk7XG4gIGlmIChjYWxsYmFjaykgY2FsbGJhY2soKTtcbiAgdGhpcy5fZW1pdE5vdGhpbmdQZW5kaW5nKCk7XG59O1xuXG5Eb2MucHJvdG90eXBlLl9oYW5kbGVPcCA9IGZ1bmN0aW9uKGVyciwgbWVzc2FnZSkge1xuICBpZiAoZXJyKSB7XG4gICAgaWYgKHRoaXMuaW5mbGlnaHRPcCkge1xuICAgICAgLy8gVGhlIHNlcnZlciBoYXMgcmVqZWN0ZWQgc3VibWlzc2lvbiBvZiB0aGUgY3VycmVudCBvcGVyYXRpb24uIElmIHdlIGdldFxuICAgICAgLy8gYW4gZXJyb3IgY29kZSA0MDAyIFwiT3Agc3VibWl0IHJlamVjdGVkXCIsIHRoaXMgd2FzIGRvbmUgaW50ZW50aW9uYWxseVxuICAgICAgLy8gYW5kIHdlIHNob3VsZCByb2xsIGJhY2sgYnV0IG5vdCByZXR1cm4gYW4gZXJyb3IgdG8gdGhlIHVzZXIuXG4gICAgICBpZiAoZXJyLmNvZGUgPT09IDQwMDIpIGVyciA9IG51bGw7XG4gICAgICByZXR1cm4gdGhpcy5fcm9sbGJhY2soZXJyKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICB9XG5cbiAgaWYgKHRoaXMuaW5mbGlnaHRPcCAmJlxuICAgICAgbWVzc2FnZS5zcmMgPT09IHRoaXMuaW5mbGlnaHRPcC5zcmMgJiZcbiAgICAgIG1lc3NhZ2Uuc2VxID09PSB0aGlzLmluZmxpZ2h0T3Auc2VxKSB7XG4gICAgLy8gVGhlIG9wIGhhcyBhbHJlYWR5IGJlZW4gYXBwbGllZCBsb2NhbGx5LiBKdXN0IHVwZGF0ZSB0aGUgdmVyc2lvblxuICAgIC8vIGFuZCBwZW5kaW5nIHN0YXRlIGFwcHJvcHJpYXRlbHlcbiAgICB0aGlzLl9vcEFja25vd2xlZGdlZChtZXNzYWdlKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAodGhpcy52ZXJzaW9uID09IG51bGwgfHwgbWVzc2FnZS52ID4gdGhpcy52ZXJzaW9uKSB7XG4gICAgLy8gVGhpcyB3aWxsIGhhcHBlbiBpbiBub3JtYWwgb3BlcmF0aW9uIGlmIHdlIGJlY29tZSBzdWJzY3JpYmVkIHRvIGFcbiAgICAvLyBuZXcgZG9jdW1lbnQgdmlhIGEgcXVlcnkuIEl0IGNhbiBhbHNvIGhhcHBlbiBpZiB3ZSBnZXQgYW4gb3AgZm9yXG4gICAgLy8gYSBmdXR1cmUgdmVyc2lvbiBiZXlvbmQgdGhlIHZlcnNpb24gd2UgYXJlIGV4cGVjdGluZyBuZXh0LiBUaGlzXG4gICAgLy8gY291bGQgaGFwcGVuIGlmIHRoZSBzZXJ2ZXIgZG9lc24ndCBwdWJsaXNoIGFuIG9wIGZvciB3aGF0ZXZlciByZWFzb25cbiAgICAvLyBvciBiZWNhdXNlIG9mIGEgcmFjZSBjb25kaXRpb24uIEluIGFueSBjYXNlLCB3ZSBjYW4gc2VuZCBhIGZldGNoXG4gICAgLy8gY29tbWFuZCB0byBjYXRjaCBiYWNrIHVwLlxuICAgIC8vXG4gICAgLy8gRmV0Y2ggb25seSBzZW5kcyBhIG5ldyBmZXRjaCBjb21tYW5kIGlmIG5vIGZldGNoZXMgYXJlIGluZmxpZ2h0LCB3aGljaFxuICAgIC8vIHdpbGwgYWN0IGFzIGEgbmF0dXJhbCBkZWJvdW5jaW5nIHNvIHdlIGRvbid0IHNlbmQgbXVsdGlwbGUgZmV0Y2hcbiAgICAvLyByZXF1ZXN0cyBmb3IgbWFueSBvcHMgcmVjZWl2ZWQgYXQgb25jZS5cbiAgICB0aGlzLmZldGNoKCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKG1lc3NhZ2UudiA8IHRoaXMudmVyc2lvbikge1xuICAgIC8vIFdlIGNhbiBzYWZlbHkgaWdub3JlIHRoZSBvbGQgKGR1cGxpY2F0ZSkgb3BlcmF0aW9uLlxuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmICh0aGlzLmluZmxpZ2h0T3ApIHtcbiAgICB2YXIgdHJhbnNmb3JtRXJyID0gdHJhbnNmb3JtWCh0aGlzLmluZmxpZ2h0T3AsIG1lc3NhZ2UpO1xuICAgIGlmICh0cmFuc2Zvcm1FcnIpIHJldHVybiB0aGlzLl9oYXJkUm9sbGJhY2sodHJhbnNmb3JtRXJyKTtcbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5wZW5kaW5nT3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHRyYW5zZm9ybUVyciA9IHRyYW5zZm9ybVgodGhpcy5wZW5kaW5nT3BzW2ldLCBtZXNzYWdlKTtcbiAgICBpZiAodHJhbnNmb3JtRXJyKSByZXR1cm4gdGhpcy5faGFyZFJvbGxiYWNrKHRyYW5zZm9ybUVycik7XG4gIH1cblxuICB0aGlzLnZlcnNpb24rKztcbiAgdGhpcy5fb3RBcHBseShtZXNzYWdlLCBmYWxzZSk7XG4gIHJldHVybjtcbn07XG5cbi8vIENhbGxlZCB3aGVuZXZlciAoeW91IGd1ZXNzZWQgaXQhKSB0aGUgY29ubmVjdGlvbiBzdGF0ZSBjaGFuZ2VzLiBUaGlzIHdpbGxcbi8vIGhhcHBlbiB3aGVuIHdlIGdldCBkaXNjb25uZWN0ZWQgJiByZWNvbm5lY3QuXG5Eb2MucHJvdG90eXBlLl9vbkNvbm5lY3Rpb25TdGF0ZUNoYW5nZWQgPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMuY29ubmVjdGlvbi5jYW5TZW5kKSB7XG4gICAgdGhpcy5mbHVzaCgpO1xuICAgIHRoaXMuX3Jlc3Vic2NyaWJlKCk7XG4gIH0gZWxzZSB7XG4gICAgaWYgKHRoaXMuaW5mbGlnaHRPcCkge1xuICAgICAgdGhpcy5wZW5kaW5nT3BzLnVuc2hpZnQodGhpcy5pbmZsaWdodE9wKTtcbiAgICAgIHRoaXMuaW5mbGlnaHRPcCA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuc3Vic2NyaWJlZCA9IGZhbHNlO1xuICAgIGlmICh0aGlzLmluZmxpZ2h0RmV0Y2gubGVuZ3RoIHx8IHRoaXMuaW5mbGlnaHRTdWJzY3JpYmUubGVuZ3RoKSB7XG4gICAgICB0aGlzLnBlbmRpbmdGZXRjaCA9IHRoaXMucGVuZGluZ0ZldGNoLmNvbmNhdCh0aGlzLmluZmxpZ2h0RmV0Y2gsIHRoaXMuaW5mbGlnaHRTdWJzY3JpYmUpO1xuICAgICAgdGhpcy5pbmZsaWdodEZldGNoLmxlbmd0aCA9IDA7XG4gICAgICB0aGlzLmluZmxpZ2h0U3Vic2NyaWJlLmxlbmd0aCA9IDA7XG4gICAgfVxuICAgIGlmICh0aGlzLmluZmxpZ2h0VW5zdWJzY3JpYmUubGVuZ3RoKSB7XG4gICAgICB2YXIgY2FsbGJhY2tzID0gdGhpcy5pbmZsaWdodFVuc3Vic2NyaWJlO1xuICAgICAgdGhpcy5pbmZsaWdodFVuc3Vic2NyaWJlID0gW107XG4gICAgICBjYWxsRWFjaChjYWxsYmFja3MpO1xuICAgIH1cbiAgfVxufTtcblxuRG9jLnByb3RvdHlwZS5fcmVzdWJzY3JpYmUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGNhbGxiYWNrcyA9IHRoaXMucGVuZGluZ0ZldGNoO1xuICB0aGlzLnBlbmRpbmdGZXRjaCA9IFtdO1xuXG4gIGlmICh0aGlzLndhbnRTdWJzY3JpYmUpIHtcbiAgICBpZiAoY2FsbGJhY2tzLmxlbmd0aCkge1xuICAgICAgdGhpcy5zdWJzY3JpYmUoZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGNhbGxFYWNoKGNhbGxiYWNrcywgZXJyKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLnN1YnNjcmliZSgpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChjYWxsYmFja3MubGVuZ3RoKSB7XG4gICAgdGhpcy5mZXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgIGNhbGxFYWNoKGNhbGxiYWNrcywgZXJyKTtcbiAgICB9KTtcbiAgfVxufTtcblxuLy8gUmVxdWVzdCB0aGUgY3VycmVudCBkb2N1bWVudCBzbmFwc2hvdCBvciBvcHMgdGhhdCBicmluZyB1cyB1cCB0byBkYXRlXG5Eb2MucHJvdG90eXBlLmZldGNoID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgaWYgKHRoaXMuY29ubmVjdGlvbi5jYW5TZW5kKSB7XG4gICAgdmFyIGlzRHVwbGljYXRlID0gdGhpcy5jb25uZWN0aW9uLnNlbmRGZXRjaCh0aGlzKTtcbiAgICBwdXNoQWN0aW9uQ2FsbGJhY2sodGhpcy5pbmZsaWdodEZldGNoLCBpc0R1cGxpY2F0ZSwgY2FsbGJhY2spO1xuICAgIHJldHVybjtcbiAgfVxuICB0aGlzLnBlbmRpbmdGZXRjaC5wdXNoKGNhbGxiYWNrKTtcbn07XG5cbi8vIEZldGNoIHRoZSBpbml0aWFsIGRvY3VtZW50IGFuZCBrZWVwIHJlY2VpdmluZyB1cGRhdGVzXG5Eb2MucHJvdG90eXBlLnN1YnNjcmliZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIHRoaXMud2FudFN1YnNjcmliZSA9IHRydWU7XG4gIGlmICh0aGlzLmNvbm5lY3Rpb24uY2FuU2VuZCkge1xuICAgIHZhciBpc0R1cGxpY2F0ZSA9IHRoaXMuY29ubmVjdGlvbi5zZW5kU3Vic2NyaWJlKHRoaXMpO1xuICAgIHB1c2hBY3Rpb25DYWxsYmFjayh0aGlzLmluZmxpZ2h0U3Vic2NyaWJlLCBpc0R1cGxpY2F0ZSwgY2FsbGJhY2spO1xuICAgIHJldHVybjtcbiAgfVxuICB0aGlzLnBlbmRpbmdGZXRjaC5wdXNoKGNhbGxiYWNrKTtcbn07XG5cbi8vIFVuc3Vic2NyaWJlLiBUaGUgZGF0YSB3aWxsIHN0YXkgYXJvdW5kIGluIGxvY2FsIG1lbW9yeSwgYnV0IHdlJ2xsIHN0b3Bcbi8vIHJlY2VpdmluZyB1cGRhdGVzXG5Eb2MucHJvdG90eXBlLnVuc3Vic2NyaWJlID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgdGhpcy53YW50U3Vic2NyaWJlID0gZmFsc2U7XG4gIC8vIFRoZSBzdWJzY3JpYmVkIHN0YXRlIHNob3VsZCBiZSBjb25zZXJ2YXRpdmUgaW4gaW5kaWNhdGluZyB3aGVuIHdlIGFyZVxuICAvLyBzdWJzY3JpYmVkIG9uIHRoZSBzZXJ2ZXIuIFdlJ2xsIGFjdHVhbGx5IGJlIHVuc3Vic2NyaWJlZCBzb21lIHRpbWVcbiAgLy8gYmV0d2VlbiBzZW5kaW5nIHRoZSBtZXNzYWdlIGFuZCBoZWFyaW5nIGJhY2ssIGJ1dCB3ZSBjYW5ub3Qga25vdyBleGFjdGx5XG4gIC8vIHdoZW4uIFRodXMsIGltbWVkaWF0ZWx5IG1hcmsgdXMgYXMgbm90IHN1YnNjcmliZWRcbiAgdGhpcy5zdWJzY3JpYmVkID0gZmFsc2U7XG4gIGlmICh0aGlzLmNvbm5lY3Rpb24uY2FuU2VuZCkge1xuICAgIHZhciBpc0R1cGxpY2F0ZSA9IHRoaXMuY29ubmVjdGlvbi5zZW5kVW5zdWJzY3JpYmUodGhpcyk7XG4gICAgcHVzaEFjdGlvbkNhbGxiYWNrKHRoaXMuaW5mbGlnaHRVbnN1YnNjcmliZSwgaXNEdXBsaWNhdGUsIGNhbGxiYWNrKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGNhbGxiYWNrKSBwcm9jZXNzLm5leHRUaWNrKGNhbGxiYWNrKTtcbn07XG5cbmZ1bmN0aW9uIHB1c2hBY3Rpb25DYWxsYmFjayhpbmZsaWdodCwgaXNEdXBsaWNhdGUsIGNhbGxiYWNrKSB7XG4gIGlmIChpc0R1cGxpY2F0ZSkge1xuICAgIHZhciBsYXN0Q2FsbGJhY2sgPSBpbmZsaWdodC5wb3AoKTtcbiAgICBpbmZsaWdodC5wdXNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgbGFzdENhbGxiYWNrICYmIGxhc3RDYWxsYmFjayhlcnIpO1xuICAgICAgY2FsbGJhY2sgJiYgY2FsbGJhY2soZXJyKTtcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBpbmZsaWdodC5wdXNoKGNhbGxiYWNrKTtcbiAgfVxufVxuXG5cbi8vIE9wZXJhdGlvbnMgLy9cblxuLy8gU2VuZCB0aGUgbmV4dCBwZW5kaW5nIG9wIHRvIHRoZSBzZXJ2ZXIsIGlmIHdlIGNhbi5cbi8vXG4vLyBPbmx5IG9uZSBvcGVyYXRpb24gY2FuIGJlIGluLWZsaWdodCBhdCBhIHRpbWUuIElmIGFuIG9wZXJhdGlvbiBpcyBhbHJlYWR5IG9uXG4vLyBpdHMgd2F5LCBvciB3ZSdyZSBub3QgY3VycmVudGx5IGNvbm5lY3RlZCwgdGhpcyBtZXRob2QgZG9lcyBub3RoaW5nLlxuRG9jLnByb3RvdHlwZS5mbHVzaCA9IGZ1bmN0aW9uKCkge1xuICAvLyBJZ25vcmUgaWYgd2UgY2FuJ3Qgc2VuZCBvciB3ZSBhcmUgYWxyZWFkeSBzZW5kaW5nIGFuIG9wXG4gIGlmICghdGhpcy5jb25uZWN0aW9uLmNhblNlbmQgfHwgdGhpcy5pbmZsaWdodE9wKSByZXR1cm47XG5cbiAgLy8gU2VuZCBmaXJzdCBwZW5kaW5nIG9wIHVubGVzcyBwYXVzZWRcbiAgaWYgKCF0aGlzLnBhdXNlZCAmJiB0aGlzLnBlbmRpbmdPcHMubGVuZ3RoKSB7XG4gICAgdGhpcy5fc2VuZE9wKCk7XG4gIH1cbn07XG5cbi8vIEhlbHBlciBmdW5jdGlvbiB0byBzZXQgb3AgdG8gY29udGFpbiBhIG5vLW9wLlxuZnVuY3Rpb24gc2V0Tm9PcChvcCkge1xuICBkZWxldGUgb3Aub3A7XG4gIGRlbGV0ZSBvcC5jcmVhdGU7XG4gIGRlbGV0ZSBvcC5kZWw7XG59XG5cbi8vIFRyYW5zZm9ybSBzZXJ2ZXIgb3AgZGF0YSBieSBhIGNsaWVudCBvcCwgYW5kIHZpY2UgdmVyc2EuIE9wcyBhcmUgZWRpdGVkIGluIHBsYWNlLlxuZnVuY3Rpb24gdHJhbnNmb3JtWChjbGllbnQsIHNlcnZlcikge1xuICAvLyBPcmRlciBvZiBzdGF0ZW1lbnRzIGluIHRoaXMgZnVuY3Rpb24gbWF0dGVycy4gQmUgZXNwZWNpYWxseSBjYXJlZnVsIGlmXG4gIC8vIHJlZmFjdG9yaW5nIHRoaXMgZnVuY3Rpb25cblxuICAvLyBBIGNsaWVudCBkZWxldGUgb3Agc2hvdWxkIGRvbWluYXRlIGlmIGJvdGggdGhlIHNlcnZlciBhbmQgdGhlIGNsaWVudFxuICAvLyBkZWxldGUgdGhlIGRvY3VtZW50LiBUaHVzLCBhbnkgb3BzIGZvbGxvd2luZyB0aGUgY2xpZW50IGRlbGV0ZSAoc3VjaCBhcyBhXG4gIC8vIHN1YnNlcXVlbnQgY3JlYXRlKSB3aWxsIGJlIG1haW50YWluZWQsIHNpbmNlIHRoZSBzZXJ2ZXIgb3AgaXMgdHJhbnNmb3JtZWRcbiAgLy8gdG8gYSBuby1vcFxuICBpZiAoY2xpZW50LmRlbCkgcmV0dXJuIHNldE5vT3Aoc2VydmVyKTtcblxuICBpZiAoc2VydmVyLmRlbCkge1xuICAgIHJldHVybiBuZXcgU2hhcmVEQkVycm9yKDQwMTcsICdEb2N1bWVudCB3YXMgZGVsZXRlZCcpO1xuICB9XG4gIGlmIChzZXJ2ZXIuY3JlYXRlKSB7XG4gICAgcmV0dXJuIG5ldyBTaGFyZURCRXJyb3IoNDAxOCwgJ0RvY3VtZW50IGFscmVkeSBjcmVhdGVkJyk7XG4gIH1cblxuICAvLyBJZ25vcmUgbm8tb3AgY29taW5nIGZyb20gc2VydmVyXG4gIGlmICghc2VydmVyLm9wKSByZXR1cm47XG5cbiAgLy8gSSBiZWxpZXZlIHRoYXQgdGhpcyBzaG91bGQgbm90IG9jY3VyLCBidXQgY2hlY2sganVzdCBpbiBjYXNlXG4gIGlmIChjbGllbnQuY3JlYXRlKSB7XG4gICAgcmV0dXJuIG5ldyBTaGFyZURCRXJyb3IoNDAxOCwgJ0RvY3VtZW50IGFscmVhZHkgY3JlYXRlZCcpO1xuICB9XG5cbiAgLy8gVGhleSBib3RoIGVkaXRlZCB0aGUgZG9jdW1lbnQuIFRoaXMgaXMgdGhlIG5vcm1hbCBjYXNlIGZvciB0aGlzIGZ1bmN0aW9uIC1cbiAgLy8gYXMgaW4sIG1vc3Qgb2YgdGhlIHRpbWUgd2UnbGwgZW5kIHVwIGRvd24gaGVyZS5cbiAgLy9cbiAgLy8gWW91IHNob3VsZCBiZSB3b25kZXJpbmcgd2h5IEknbSB1c2luZyBjbGllbnQudHlwZSBpbnN0ZWFkIG9mIHRoaXMudHlwZS5cbiAgLy8gVGhlIHJlYXNvbiBpcywgaWYgd2UgZ2V0IG9wcyBhdCBhbiBvbGQgdmVyc2lvbiBvZiB0aGUgZG9jdW1lbnQsIHRoaXMudHlwZVxuICAvLyBtaWdodCBiZSB1bmRlZmluZWQgb3IgYSB0b3RhbGx5IGRpZmZlcmVudCB0eXBlLiBCeSBwaW5uaW5nIHRoZSB0eXBlIHRvIHRoZVxuICAvLyBvcCBkYXRhLCB3ZSBtYWtlIHN1cmUgdGhlIHJpZ2h0IHR5cGUgaGFzIGl0cyB0cmFuc2Zvcm0gZnVuY3Rpb24gY2FsbGVkLlxuICBpZiAoY2xpZW50LnR5cGUudHJhbnNmb3JtWCkge1xuICAgIHZhciByZXN1bHQgPSBjbGllbnQudHlwZS50cmFuc2Zvcm1YKGNsaWVudC5vcCwgc2VydmVyLm9wKTtcbiAgICBjbGllbnQub3AgPSByZXN1bHRbMF07XG4gICAgc2VydmVyLm9wID0gcmVzdWx0WzFdO1xuICB9IGVsc2Uge1xuICAgIHZhciBjbGllbnRPcCA9IGNsaWVudC50eXBlLnRyYW5zZm9ybShjbGllbnQub3AsIHNlcnZlci5vcCwgJ2xlZnQnKTtcbiAgICB2YXIgc2VydmVyT3AgPSBjbGllbnQudHlwZS50cmFuc2Zvcm0oc2VydmVyLm9wLCBjbGllbnQub3AsICdyaWdodCcpO1xuICAgIGNsaWVudC5vcCA9IGNsaWVudE9wO1xuICAgIHNlcnZlci5vcCA9IHNlcnZlck9wO1xuICB9XG59O1xuXG4vKipcbiAqIEFwcGxpZXMgdGhlIG9wZXJhdGlvbiB0byB0aGUgc25hcHNob3RcbiAqXG4gKiBJZiB0aGUgb3BlcmF0aW9uIGlzIGNyZWF0ZSBvciBkZWxldGUgaXQgZW1pdHMgYGNyZWF0ZWAgb3IgYGRlbGAuIFRoZW4gdGhlXG4gKiBvcGVyYXRpb24gaXMgYXBwbGllZCB0byB0aGUgc25hcHNob3QgYW5kIGBvcGAgYW5kIGBhZnRlciBvcGAgYXJlIGVtaXR0ZWQuXG4gKiBJZiB0aGUgdHlwZSBzdXBwb3J0cyBpbmNyZW1lbnRhbCB1cGRhdGVzIGFuZCBgdGhpcy5pbmNyZW1lbnRhbGAgaXMgdHJ1ZSB3ZVxuICogZmlyZSBgb3BgIGFmdGVyIGV2ZXJ5IHNtYWxsIG9wZXJhdGlvbi5cbiAqXG4gKiBUaGlzIGlzIHRoZSBvbmx5IGZ1bmN0aW9uIHRvIGZpcmUgdGhlIGFib3ZlIG1lbnRpb25lZCBldmVudHMuXG4gKlxuICogQHByaXZhdGVcbiAqL1xuRG9jLnByb3RvdHlwZS5fb3RBcHBseSA9IGZ1bmN0aW9uKG9wLCBzb3VyY2UpIHtcbiAgaWYgKG9wLm9wKSB7XG4gICAgaWYgKCF0aGlzLnR5cGUpIHtcbiAgICAgIHZhciBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDQwMTUsICdDYW5ub3QgYXBwbHkgb3AgdG8gdW5jcmVhdGVkIGRvY3VtZW50LiAnICsgdGhpcy5jb2xsZWN0aW9uICsgJy4nICsgdGhpcy5pZCk7XG4gICAgICByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgfVxuXG4gICAgLy8gSXRlcmF0aXZlbHkgYXBwbHkgbXVsdGktY29tcG9uZW50IHJlbW90ZSBvcGVyYXRpb25zIGFuZCByb2xsYmFjayBvcHNcbiAgICAvLyAoc291cmNlID09PSBmYWxzZSkgZm9yIHRoZSBkZWZhdWx0IEpTT04wIE9UIHR5cGUuIEl0IGNvdWxkIHVzZVxuICAgIC8vIHR5cGUuc2hhdHRlcigpLCBidXQgc2luY2UgdGhpcyBjb2RlIGlzIHNvIHNwZWNpZmljIHRvIHVzZSBjYXNlcyBmb3IgdGhlXG4gICAgLy8gSlNPTjAgdHlwZSBhbmQgU2hhcmVEQiBleHBsaWNpdGx5IGJ1bmRsZXMgdGhlIGRlZmF1bHQgdHlwZSwgd2UgbWlnaHQgYXNcbiAgICAvLyB3ZWxsIHdyaXRlIGl0IHRoaXMgd2F5IGFuZCBzYXZlIG5lZWRpbmcgdG8gaXRlcmF0ZSB0aHJvdWdoIHRoZSBvcFxuICAgIC8vIGNvbXBvbmVudHMgdHdpY2UuXG4gICAgLy9cbiAgICAvLyBJZGVhbGx5LCB3ZSB3b3VsZCBub3QgbmVlZCB0aGlzIGV4dHJhIGNvbXBsZXhpdHkuIEhvd2V2ZXIsIGl0IGlzXG4gICAgLy8gaGVscGZ1bCBmb3IgaW1wbGVtZW50aW5nIGJpbmRpbmdzIHRoYXQgdXBkYXRlIERPTSBub2RlcyBhbmQgb3RoZXJcbiAgICAvLyBzdGF0ZWZ1bCBvYmplY3RzIGJ5IHRyYW5zbGF0aW5nIG9wIGV2ZW50cyBkaXJlY3RseSBpbnRvIGNvcnJlc3BvbmRpbmdcbiAgICAvLyBtdXRhdGlvbnMuIFN1Y2ggYmluZGluZ3MgYXJlIG1vc3QgZWFzaWx5IHdyaXR0ZW4gYXMgcmVzcG9uZGluZyB0b1xuICAgIC8vIGluZGl2aWR1YWwgb3AgY29tcG9uZW50cyBvbmUgYXQgYSB0aW1lIGluIG9yZGVyLCBhbmQgaXQgaXMgaW1wb3J0YW50XG4gICAgLy8gdGhhdCB0aGUgc25hcHNob3Qgb25seSBpbmNsdWRlIHVwZGF0ZXMgZnJvbSB0aGUgcGFydGljdWxhciBvcCBjb21wb25lbnRcbiAgICAvLyBhdCB0aGUgdGltZSBvZiBlbWlzc2lvbi4gRWxpbWluYXRpbmcgdGhpcyB3b3VsZCByZXF1aXJlIHJldGhpbmtpbmcgaG93XG4gICAgLy8gc3VjaCBleHRlcm5hbCBiaW5kaW5ncyBhcmUgaW1wbGVtZW50ZWQuXG4gICAgaWYgKCFzb3VyY2UgJiYgdGhpcy50eXBlID09PSB0eXBlcy5kZWZhdWx0VHlwZSAmJiBvcC5vcC5sZW5ndGggPiAxKSB7XG4gICAgICBpZiAoIXRoaXMuYXBwbHlTdGFjaykgdGhpcy5hcHBseVN0YWNrID0gW107XG4gICAgICB2YXIgc3RhY2tMZW5ndGggPSB0aGlzLmFwcGx5U3RhY2subGVuZ3RoO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5vcC5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY29tcG9uZW50ID0gb3Aub3BbaV07XG4gICAgICAgIHZhciBjb21wb25lbnRPcCA9IHtvcDogW2NvbXBvbmVudF19O1xuICAgICAgICAvLyBUcmFuc2Zvcm0gY29tcG9uZW50T3AgYWdhaW5zdCBhbnkgb3BzIHRoYXQgaGF2ZSBiZWVuIHN1Ym1pdHRlZFxuICAgICAgICAvLyBzeWNocm9ub3VzbHkgaW5zaWRlIG9mIGFuIG9wIGV2ZW50IGhhbmRsZXIgc2luY2Ugd2UgYmVnYW4gYXBwbHkgb2ZcbiAgICAgICAgLy8gb3VyIG9wZXJhdGlvblxuICAgICAgICBmb3IgKHZhciBqID0gc3RhY2tMZW5ndGg7IGogPCB0aGlzLmFwcGx5U3RhY2subGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICB2YXIgdHJhbnNmb3JtRXJyID0gdHJhbnNmb3JtWCh0aGlzLmFwcGx5U3RhY2tbal0sIGNvbXBvbmVudE9wKTtcbiAgICAgICAgICBpZiAodHJhbnNmb3JtRXJyKSByZXR1cm4gdGhpcy5faGFyZFJvbGxiYWNrKHRyYW5zZm9ybUVycik7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQXBwbHkgdGhlIGluZGl2aWR1YWwgb3AgY29tcG9uZW50XG4gICAgICAgIHRoaXMuZW1pdCgnYmVmb3JlIG9wJywgY29tcG9uZW50T3Aub3AsIHNvdXJjZSk7XG4gICAgICAgIHRoaXMuZGF0YSA9IHRoaXMudHlwZS5hcHBseSh0aGlzLmRhdGEsIGNvbXBvbmVudE9wLm9wKTtcbiAgICAgICAgdGhpcy5lbWl0KCdvcCcsIGNvbXBvbmVudE9wLm9wLCBzb3VyY2UpO1xuICAgICAgfVxuICAgICAgLy8gUG9wIHdoYXRldmVyIHdhcyBzdWJtaXR0ZWQgc2luY2Ugd2Ugc3RhcnRlZCBhcHBseWluZyB0aGlzIG9wXG4gICAgICB0aGlzLl9wb3BBcHBseVN0YWNrKHN0YWNrTGVuZ3RoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBUaGUgJ2JlZm9yZSBvcCcgZXZlbnQgZW5hYmxlcyBjbGllbnRzIHRvIHB1bGwgYW55IG5lY2Vzc2FyeSBkYXRhIG91dCBvZlxuICAgIC8vIHRoZSBzbmFwc2hvdCBiZWZvcmUgaXQgZ2V0cyBjaGFuZ2VkXG4gICAgdGhpcy5lbWl0KCdiZWZvcmUgb3AnLCBvcC5vcCwgc291cmNlKTtcbiAgICAvLyBBcHBseSB0aGUgb3BlcmF0aW9uIHRvIHRoZSBsb2NhbCBkYXRhLCBtdXRhdGluZyBpdCBpbiBwbGFjZVxuICAgIHRoaXMuZGF0YSA9IHRoaXMudHlwZS5hcHBseSh0aGlzLmRhdGEsIG9wLm9wKTtcbiAgICAvLyBFbWl0IGFuICdvcCcgZXZlbnQgb25jZSB0aGUgbG9jYWwgZGF0YSBpbmNsdWRlcyB0aGUgY2hhbmdlcyBmcm9tIHRoZVxuICAgIC8vIG9wLiBGb3IgbG9jYWxseSBzdWJtaXR0ZWQgb3BzLCB0aGlzIHdpbGwgYmUgc3luY2hyb25vdXNseSB3aXRoXG4gICAgLy8gc3VibWlzc2lvbiBhbmQgYmVmb3JlIHRoZSBzZXJ2ZXIgb3Igb3RoZXIgY2xpZW50cyBoYXZlIHJlY2VpdmVkIHRoZSBvcC5cbiAgICAvLyBGb3Igb3BzIGZyb20gb3RoZXIgY2xpZW50cywgdGhpcyB3aWxsIGJlIGFmdGVyIHRoZSBvcCBoYXMgYmVlblxuICAgIC8vIGNvbW1pdHRlZCB0byB0aGUgZGF0YWJhc2UgYW5kIHB1Ymxpc2hlZFxuICAgIHRoaXMuZW1pdCgnb3AnLCBvcC5vcCwgc291cmNlKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAob3AuY3JlYXRlKSB7XG4gICAgdGhpcy5fc2V0VHlwZShvcC5jcmVhdGUudHlwZSk7XG4gICAgdGhpcy5kYXRhID0gKHRoaXMudHlwZS5kZXNlcmlhbGl6ZSkgP1xuICAgICAgKHRoaXMudHlwZS5jcmVhdGVEZXNlcmlhbGl6ZWQpID9cbiAgICAgICAgdGhpcy50eXBlLmNyZWF0ZURlc2VyaWFsaXplZChvcC5jcmVhdGUuZGF0YSkgOlxuICAgICAgICB0aGlzLnR5cGUuZGVzZXJpYWxpemUodGhpcy50eXBlLmNyZWF0ZShvcC5jcmVhdGUuZGF0YSkpIDpcbiAgICAgIHRoaXMudHlwZS5jcmVhdGUob3AuY3JlYXRlLmRhdGEpO1xuICAgIHRoaXMuZW1pdCgnY3JlYXRlJywgc291cmNlKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAob3AuZGVsKSB7XG4gICAgdmFyIG9sZERhdGEgPSB0aGlzLmRhdGE7XG4gICAgdGhpcy5fc2V0VHlwZShudWxsKTtcbiAgICB0aGlzLmVtaXQoJ2RlbCcsIG9sZERhdGEsIHNvdXJjZSk7XG4gICAgcmV0dXJuO1xuICB9XG59O1xuXG5cbi8vICoqKioqIFNlbmRpbmcgb3BlcmF0aW9uc1xuXG4vLyBBY3R1YWxseSBzZW5kIG9wIHRvIHRoZSBzZXJ2ZXIuXG5Eb2MucHJvdG90eXBlLl9zZW5kT3AgPSBmdW5jdGlvbigpIHtcbiAgLy8gV2FpdCB1bnRpbCB3ZSBoYXZlIGEgc3JjIGlkIGZyb20gdGhlIHNlcnZlclxuICB2YXIgc3JjID0gdGhpcy5jb25uZWN0aW9uLmlkO1xuICBpZiAoIXNyYykgcmV0dXJuO1xuXG4gIC8vIFdoZW4gdGhlcmUgaXMgbm8gaW5mbGlnaHRPcCwgc2VuZCB0aGUgZmlyc3QgaXRlbSBpbiBwZW5kaW5nT3BzLiBJZlxuICAvLyB0aGVyZSBpcyBpbmZsaWdodE9wLCB0cnkgc2VuZGluZyBpdCBhZ2FpblxuICBpZiAoIXRoaXMuaW5mbGlnaHRPcCkge1xuICAgIC8vIFNlbmQgZmlyc3QgcGVuZGluZyBvcFxuICAgIHRoaXMuaW5mbGlnaHRPcCA9IHRoaXMucGVuZGluZ09wcy5zaGlmdCgpO1xuICB9XG4gIHZhciBvcCA9IHRoaXMuaW5mbGlnaHRPcDtcbiAgaWYgKCFvcCkge1xuICAgIHZhciBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDUwMTAsICdObyBvcCB0byBzZW5kIG9uIGNhbGwgdG8gX3NlbmRPcCcpO1xuICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgfVxuXG4gIC8vIFRyYWNrIGRhdGEgZm9yIHJldHJ5aW5nIG9wc1xuICBvcC5zZW50QXQgPSBEYXRlLm5vdygpO1xuICBvcC5yZXRyaWVzID0gKG9wLnJldHJpZXMgPT0gbnVsbCkgPyAwIDogb3AucmV0cmllcyArIDE7XG5cbiAgLy8gVGhlIHNyYyArIHNlcSBudW1iZXIgaXMgYSB1bmlxdWUgSUQgcmVwcmVzZW50aW5nIHRoaXMgb3BlcmF0aW9uLiBUaGlzIHR1cGxlXG4gIC8vIGlzIHVzZWQgb24gdGhlIHNlcnZlciB0byBkZXRlY3Qgd2hlbiBvcHMgaGF2ZSBiZWVuIHNlbnQgbXVsdGlwbGUgdGltZXMgYW5kXG4gIC8vIG9uIHRoZSBjbGllbnQgdG8gbWF0Y2ggYWNrbm93bGVkZ2VtZW50IG9mIGFuIG9wIGJhY2sgdG8gdGhlIGluZmxpZ2h0T3AuXG4gIC8vIE5vdGUgdGhhdCB0aGUgc3JjIGNvdWxkIGJlIGRpZmZlcmVudCBmcm9tIHRoaXMuY29ubmVjdGlvbi5pZCBhZnRlciBhXG4gIC8vIHJlY29ubmVjdCwgc2luY2UgYW4gb3AgbWF5IHN0aWxsIGJlIHBlbmRpbmcgYWZ0ZXIgdGhlIHJlY29ubmVjdGlvbiBhbmRcbiAgLy8gdGhpcy5jb25uZWN0aW9uLmlkIHdpbGwgY2hhbmdlLiBJbiBjYXNlIGFuIG9wIGlzIHNlbnQgbXVsdGlwbGUgdGltZXMsIHdlXG4gIC8vIGFsc28gbmVlZCB0byBiZSBjYXJlZnVsIG5vdCB0byBvdmVycmlkZSB0aGUgb3JpZ2luYWwgc2VxIHZhbHVlLlxuICBpZiAob3Auc2VxID09IG51bGwpIG9wLnNlcSA9IHRoaXMuY29ubmVjdGlvbi5zZXErKztcblxuICB0aGlzLmNvbm5lY3Rpb24uc2VuZE9wKHRoaXMsIG9wKTtcblxuICAvLyBzcmMgaXNuJ3QgbmVlZGVkIG9uIHRoZSBmaXJzdCB0cnksIHNpbmNlIHRoZSBzZXJ2ZXIgc2Vzc2lvbiB3aWxsIGhhdmUgdGhlXG4gIC8vIHNhbWUgaWQsIGJ1dCBpdCBtdXN0IGJlIHNldCBvbiB0aGUgaW5mbGlnaHRPcCBpbiBjYXNlIGl0IGlzIHNlbnQgYWdhaW5cbiAgLy8gYWZ0ZXIgYSByZWNvbm5lY3QgYW5kIHRoZSBjb25uZWN0aW9uJ3MgaWQgaGFzIGNoYW5nZWQgYnkgdGhlblxuICBpZiAob3Auc3JjID09IG51bGwpIG9wLnNyYyA9IHNyYztcbn07XG5cblxuLy8gUXVldWVzIHRoZSBvcGVyYXRpb24gZm9yIHN1Ym1pc3Npb24gdG8gdGhlIHNlcnZlciBhbmQgYXBwbGllcyBpdCBsb2NhbGx5LlxuLy9cbi8vIEludGVybmFsIG1ldGhvZCBjYWxsZWQgdG8gZG8gdGhlIGFjdHVhbCB3b3JrIGZvciBzdWJtaXQoKSwgY3JlYXRlKCkgYW5kIGRlbCgpLlxuLy8gQHByaXZhdGVcbi8vXG4vLyBAcGFyYW0gb3Bcbi8vIEBwYXJhbSBbb3Aub3BdXG4vLyBAcGFyYW0gW29wLmRlbF1cbi8vIEBwYXJhbSBbb3AuY3JlYXRlXVxuLy8gQHBhcmFtIFtjYWxsYmFja10gY2FsbGVkIHdoZW4gb3BlcmF0aW9uIGlzIHN1Ym1pdHRlZFxuRG9jLnByb3RvdHlwZS5fc3VibWl0ID0gZnVuY3Rpb24ob3AsIHNvdXJjZSwgY2FsbGJhY2spIHtcbiAgLy8gTG9jYWxseSBzdWJtaXR0ZWQgb3BzIG11c3QgYWx3YXlzIGhhdmUgYSB0cnV0aHkgc291cmNlXG4gIGlmICghc291cmNlKSBzb3VyY2UgPSB0cnVlO1xuXG4gIC8vIFRoZSBvcCBjb250YWlucyBlaXRoZXIgb3AsIGNyZWF0ZSwgZGVsZXRlLCBvciBub25lIG9mIHRoZSBhYm92ZSAoYSBuby1vcCkuXG4gIGlmIChvcC5vcCkge1xuICAgIGlmICghdGhpcy50eXBlKSB7XG4gICAgICB2YXIgZXJyID0gbmV3IFNoYXJlREJFcnJvcig0MDE1LCAnQ2Fubm90IHN1Ym1pdCBvcC4gRG9jdW1lbnQgaGFzIG5vdCBiZWVuIGNyZWF0ZWQuICcgKyB0aGlzLmNvbGxlY3Rpb24gKyAnLicgKyB0aGlzLmlkKTtcbiAgICAgIGlmIChjYWxsYmFjaykgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgfVxuICAgIC8vIFRyeSB0byBub3JtYWxpemUgdGhlIG9wLiBUaGlzIHJlbW92ZXMgdHJhaWxpbmcgc2tpcDowJ3MgYW5kIHRoaW5ncyBsaWtlIHRoYXQuXG4gICAgaWYgKHRoaXMudHlwZS5ub3JtYWxpemUpIG9wLm9wID0gdGhpcy50eXBlLm5vcm1hbGl6ZShvcC5vcCk7XG4gIH1cblxuICB0aGlzLl9wdXNoT3Aob3AsIGNhbGxiYWNrKTtcbiAgdGhpcy5fb3RBcHBseShvcCwgc291cmNlKTtcblxuICAvLyBUaGUgY2FsbCB0byBmbHVzaCBpcyBkZWxheWVkIHNvIGlmIHN1Ym1pdCgpIGlzIGNhbGxlZCBtdWx0aXBsZSB0aW1lc1xuICAvLyBzeW5jaHJvbm91c2x5LCBhbGwgdGhlIG9wcyBhcmUgY29tYmluZWQgYmVmb3JlIGJlaW5nIHNlbnQgdG8gdGhlIHNlcnZlci5cbiAgdmFyIGRvYyA9IHRoaXM7XG4gIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgZG9jLmZsdXNoKCk7XG4gIH0pO1xufTtcblxuRG9jLnByb3RvdHlwZS5fcHVzaE9wID0gZnVuY3Rpb24ob3AsIGNhbGxiYWNrKSB7XG4gIGlmICh0aGlzLmFwcGx5U3RhY2spIHtcbiAgICAvLyBJZiB3ZSBhcmUgaW4gdGhlIHByb2Nlc3Mgb2YgaW5jcmVtZW50YWxseSBhcHBseWluZyBhbiBvcGVyYXRpb24sIGRvbid0XG4gICAgLy8gY29tcG9zZSB0aGUgb3AgYW5kIHB1c2ggaXQgb250byB0aGUgYXBwbHlTdGFjayBzbyBpdCBjYW4gYmUgdHJhbnNmb3JtZWRcbiAgICAvLyBhZ2FpbnN0IG90aGVyIGNvbXBvbmVudHMgZnJvbSB0aGUgb3Agb3Igb3BzIGJlaW5nIGFwcGxpZWRcbiAgICB0aGlzLmFwcGx5U3RhY2sucHVzaChvcCk7XG4gIH0gZWxzZSB7XG4gICAgLy8gSWYgdGhlIHR5cGUgc3VwcG9ydHMgY29tcG9zZXMsIHRyeSB0byBjb21wb3NlIHRoZSBvcGVyYXRpb24gb250byB0aGVcbiAgICAvLyBlbmQgb2YgdGhlIGxhc3QgcGVuZGluZyBvcGVyYXRpb24uXG4gICAgdmFyIGNvbXBvc2VkID0gdGhpcy5fdHJ5Q29tcG9zZShvcCk7XG4gICAgaWYgKGNvbXBvc2VkKSB7XG4gICAgICBjb21wb3NlZC5jYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG4gIC8vIFB1c2ggb24gdG8gdGhlIHBlbmRpbmdPcHMgcXVldWUgb2Ygb3BzIHRvIHN1Ym1pdCBpZiB3ZSBkaWRuJ3QgY29tcG9zZVxuICBvcC50eXBlID0gdGhpcy50eXBlO1xuICBvcC5jYWxsYmFja3MgPSBbY2FsbGJhY2tdO1xuICB0aGlzLnBlbmRpbmdPcHMucHVzaChvcCk7XG59O1xuXG5Eb2MucHJvdG90eXBlLl9wb3BBcHBseVN0YWNrID0gZnVuY3Rpb24odG8pIHtcbiAgaWYgKHRvID4gMCkge1xuICAgIHRoaXMuYXBwbHlTdGFjay5sZW5ndGggPSB0bztcbiAgICByZXR1cm47XG4gIH1cbiAgLy8gT25jZSB3ZSBoYXZlIGNvbXBsZXRlZCB0aGUgb3V0ZXJtb3N0IGFwcGx5IGxvb3AsIHJlc2V0IHRvIG51bGwgYW5kIG5vXG4gIC8vIGxvbmdlciBhZGQgb3BzIHRvIHRoZSBhcHBseVN0YWNrIGFzIHRoZXkgYXJlIHN1Ym1pdHRlZFxuICB2YXIgb3AgPSB0aGlzLmFwcGx5U3RhY2tbMF07XG4gIHRoaXMuYXBwbHlTdGFjayA9IG51bGw7XG4gIGlmICghb3ApIHJldHVybjtcbiAgLy8gQ29tcG9zZSB0aGUgb3BzIGFkZGVkIHNpbmNlIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGFwcGx5IHN0YWNrLCBzaW5jZSB3ZVxuICAvLyBoYWQgdG8gc2tpcCBjb21wb3NlIHdoZW4gdGhleSB3ZXJlIG9yaWdpbmFsbHkgcHVzaGVkXG4gIHZhciBpID0gdGhpcy5wZW5kaW5nT3BzLmluZGV4T2Yob3ApO1xuICBpZiAoaSA9PT0gLTEpIHJldHVybjtcbiAgdmFyIG9wcyA9IHRoaXMucGVuZGluZ09wcy5zcGxpY2UoaSk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIG9wID0gb3BzW2ldO1xuICAgIHZhciBjb21wb3NlZCA9IHRoaXMuX3RyeUNvbXBvc2Uob3ApO1xuICAgIGlmIChjb21wb3NlZCkge1xuICAgICAgY29tcG9zZWQuY2FsbGJhY2tzID0gY29tcG9zZWQuY2FsbGJhY2tzLmNvbmNhdChvcC5jYWxsYmFja3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnBlbmRpbmdPcHMucHVzaChvcCk7XG4gICAgfVxuICB9XG59O1xuXG4vLyBUcnkgdG8gY29tcG9zZSBhIHN1Ym1pdHRlZCBvcCBpbnRvIHRoZSBsYXN0IHBlbmRpbmcgb3AuIFJldHVybnMgdGhlXG4vLyBjb21wb3NlZCBvcCBpZiBpdCBzdWNjZWVkcywgdW5kZWZpbmVkIG90aGVyd2lzZVxuRG9jLnByb3RvdHlwZS5fdHJ5Q29tcG9zZSA9IGZ1bmN0aW9uKG9wKSB7XG4gIGlmICh0aGlzLnByZXZlbnRDb21wb3NlKSByZXR1cm47XG5cbiAgLy8gV2UgY2FuIG9ubHkgY29tcG9zZSBpbnRvIHRoZSBsYXN0IHBlbmRpbmcgb3AuIEluZmxpZ2h0IG9wcyBoYXZlIGFscmVhZHlcbiAgLy8gYmVlbiBzZW50IHRvIHRoZSBzZXJ2ZXIsIHNvIHdlIGNhbid0IG1vZGlmeSB0aGVtXG4gIHZhciBsYXN0ID0gdGhpcy5wZW5kaW5nT3BzW3RoaXMucGVuZGluZ09wcy5sZW5ndGggLSAxXTtcbiAgaWYgKCFsYXN0KSByZXR1cm47XG5cbiAgLy8gQ29tcG9zZSBhbiBvcCBpbnRvIGEgY3JlYXRlIGJ5IGFwcGx5aW5nIGl0LiBUaGlzIGVmZmVjdGl2ZWx5IG1ha2VzIHRoZSBvcFxuICAvLyBpbnZpc2libGUsIGFzIGlmIHRoZSBkb2N1bWVudCB3ZXJlIGNyZWF0ZWQgaW5jbHVkaW5nIHRoZSBvcCBvcmlnaW5hbGx5XG4gIGlmIChsYXN0LmNyZWF0ZSAmJiBvcC5vcCkge1xuICAgIGxhc3QuY3JlYXRlLmRhdGEgPSB0aGlzLnR5cGUuYXBwbHkobGFzdC5jcmVhdGUuZGF0YSwgb3Aub3ApO1xuICAgIHJldHVybiBsYXN0O1xuICB9XG5cbiAgLy8gQ29tcG9zZSB0d28gb3BzIGludG8gYSBzaW5nbGUgb3AgaWYgc3VwcG9ydGVkIGJ5IHRoZSB0eXBlLiBUeXBlcyB0aGF0XG4gIC8vIHN1cHBvcnQgY29tcG9zZSBtdXN0IGJlIGFibGUgdG8gY29tcG9zZSBhbnkgdHdvIG9wcyB0b2dldGhlclxuICBpZiAobGFzdC5vcCAmJiBvcC5vcCAmJiB0aGlzLnR5cGUuY29tcG9zZSkge1xuICAgIGxhc3Qub3AgPSB0aGlzLnR5cGUuY29tcG9zZShsYXN0Lm9wLCBvcC5vcCk7XG4gICAgcmV0dXJuIGxhc3Q7XG4gIH1cbn07XG5cbi8vICoqKiBDbGllbnQgT1QgZW50cnlwb2ludHMuXG5cbi8vIFN1Ym1pdCBhbiBvcGVyYXRpb24gdG8gdGhlIGRvY3VtZW50LlxuLy9cbi8vIEBwYXJhbSBvcGVyYXRpb24gaGFuZGxlZCBieSB0aGUgT1QgdHlwZVxuLy8gQHBhcmFtIG9wdGlvbnMgIHtzb3VyY2U6IC4uLn1cbi8vIEBwYXJhbSBbY2FsbGJhY2tdIGNhbGxlZCBhZnRlciBvcGVyYXRpb24gc3VibWl0dGVkXG4vL1xuLy8gQGZpcmVzIGJlZm9yZSBvcCwgb3AsIGFmdGVyIG9wXG5Eb2MucHJvdG90eXBlLnN1Ym1pdE9wID0gZnVuY3Rpb24oY29tcG9uZW50LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgb3B0aW9ucyA9IG51bGw7XG4gIH1cbiAgdmFyIG9wID0ge29wOiBjb21wb25lbnR9O1xuICB2YXIgc291cmNlID0gb3B0aW9ucyAmJiBvcHRpb25zLnNvdXJjZTtcbiAgdGhpcy5fc3VibWl0KG9wLCBzb3VyY2UsIGNhbGxiYWNrKTtcbn07XG5cbi8vIENyZWF0ZSB0aGUgZG9jdW1lbnQsIHdoaWNoIGluIFNoYXJlSlMgc2VtYW50aWNzIG1lYW5zIHRvIHNldCBpdHMgdHlwZS4gRXZlcnlcbi8vIG9iamVjdCBpbXBsaWNpdGx5IGV4aXN0cyBpbiB0aGUgZGF0YWJhc2UgYnV0IGhhcyBubyBkYXRhIGFuZCBubyB0eXBlLiBDcmVhdGVcbi8vIHNldHMgdGhlIHR5cGUgb2YgdGhlIG9iamVjdCBhbmQgY2FuIG9wdGlvbmFsbHkgc2V0IHNvbWUgaW5pdGlhbCBkYXRhIG9uIHRoZVxuLy8gb2JqZWN0LCBkZXBlbmRpbmcgb24gdGhlIHR5cGUuXG4vL1xuLy8gQHBhcmFtIGRhdGEgIGluaXRpYWxcbi8vIEBwYXJhbSB0eXBlICBPVCB0eXBlXG4vLyBAcGFyYW0gb3B0aW9ucyAge3NvdXJjZTogLi4ufVxuLy8gQHBhcmFtIGNhbGxiYWNrICBjYWxsZWQgd2hlbiBvcGVyYXRpb24gc3VibWl0dGVkXG5Eb2MucHJvdG90eXBlLmNyZWF0ZSA9IGZ1bmN0aW9uKGRhdGEsIHR5cGUsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2YgdHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNhbGxiYWNrID0gdHlwZTtcbiAgICBvcHRpb25zID0gbnVsbDtcbiAgICB0eXBlID0gbnVsbDtcbiAgfSBlbHNlIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICBvcHRpb25zID0gbnVsbDtcbiAgfVxuICBpZiAoIXR5cGUpIHtcbiAgICB0eXBlID0gdHlwZXMuZGVmYXVsdFR5cGUudXJpO1xuICB9XG4gIGlmICh0aGlzLnR5cGUpIHtcbiAgICB2YXIgZXJyID0gbmV3IFNoYXJlREJFcnJvcig0MDE2LCAnRG9jdW1lbnQgYWxyZWFkeSBleGlzdHMnKTtcbiAgICBpZiAoY2FsbGJhY2spIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgfVxuICB2YXIgb3AgPSB7Y3JlYXRlOiB7dHlwZTogdHlwZSwgZGF0YTogZGF0YX19O1xuICB2YXIgc291cmNlID0gb3B0aW9ucyAmJiBvcHRpb25zLnNvdXJjZTtcbiAgdGhpcy5fc3VibWl0KG9wLCBzb3VyY2UsIGNhbGxiYWNrKTtcbn07XG5cbi8vIERlbGV0ZSB0aGUgZG9jdW1lbnQuIFRoaXMgY3JlYXRlcyBhbmQgc3VibWl0cyBhIGRlbGV0ZSBvcGVyYXRpb24gdG8gdGhlXG4vLyBzZXJ2ZXIuIERlbGV0aW5nIHJlc2V0cyB0aGUgb2JqZWN0J3MgdHlwZSB0byBudWxsIGFuZCBkZWxldGVzIGl0cyBkYXRhLiBUaGVcbi8vIGRvY3VtZW50IHN0aWxsIGV4aXN0cywgYW5kIHN0aWxsIGhhcyB0aGUgdmVyc2lvbiBpdCB1c2VkIHRvIGhhdmUgYmVmb3JlIHlvdVxuLy8gZGVsZXRlZCBpdCAod2VsbCwgb2xkIHZlcnNpb24gKzEpLlxuLy9cbi8vIEBwYXJhbSBvcHRpb25zICB7c291cmNlOiAuLi59XG4vLyBAcGFyYW0gY2FsbGJhY2sgIGNhbGxlZCB3aGVuIG9wZXJhdGlvbiBzdWJtaXR0ZWRcbkRvYy5wcm90b3R5cGUuZGVsID0gZnVuY3Rpb24ob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgIG9wdGlvbnMgPSBudWxsO1xuICB9XG4gIGlmICghdGhpcy50eXBlKSB7XG4gICAgdmFyIGVyciA9IG5ldyBTaGFyZURCRXJyb3IoNDAxNSwgJ0RvY3VtZW50IGRvZXMgbm90IGV4aXN0Jyk7XG4gICAgaWYgKGNhbGxiYWNrKSByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gIH1cbiAgdmFyIG9wID0ge2RlbDogdHJ1ZX07XG4gIHZhciBzb3VyY2UgPSBvcHRpb25zICYmIG9wdGlvbnMuc291cmNlO1xuICB0aGlzLl9zdWJtaXQob3AsIHNvdXJjZSwgY2FsbGJhY2spO1xufTtcblxuXG4vLyBTdG9wcyB0aGUgZG9jdW1lbnQgZnJvbSBzZW5kaW5nIGFueSBvcGVyYXRpb25zIHRvIHRoZSBzZXJ2ZXIuXG5Eb2MucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMucGF1c2VkID0gdHJ1ZTtcbn07XG5cbi8vIENvbnRpbnVlIHNlbmRpbmcgb3BlcmF0aW9ucyB0byB0aGUgc2VydmVyXG5Eb2MucHJvdG90eXBlLnJlc3VtZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLnBhdXNlZCA9IGZhbHNlO1xuICB0aGlzLmZsdXNoKCk7XG59O1xuXG5cbi8vICoqKiBSZWNlaXZpbmcgb3BlcmF0aW9uc1xuXG4vLyBUaGlzIGlzIGNhbGxlZCB3aGVuIHRoZSBzZXJ2ZXIgYWNrbm93bGVkZ2VzIGFuIG9wZXJhdGlvbiBmcm9tIHRoZSBjbGllbnQuXG5Eb2MucHJvdG90eXBlLl9vcEFja25vd2xlZGdlZCA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgaWYgKHRoaXMuaW5mbGlnaHRPcC5jcmVhdGUpIHtcbiAgICB0aGlzLnZlcnNpb24gPSBtZXNzYWdlLnY7XG5cbiAgfSBlbHNlIGlmIChtZXNzYWdlLnYgIT09IHRoaXMudmVyc2lvbikge1xuICAgIC8vIFdlIHNob3VsZCBhbHJlYWR5IGJlIGF0IHRoZSBzYW1lIHZlcnNpb24sIGJlY2F1c2UgdGhlIHNlcnZlciBzaG91bGRcbiAgICAvLyBoYXZlIHNlbnQgYWxsIHRoZSBvcHMgdGhhdCBoYXZlIGhhcHBlbmVkIGJlZm9yZSBhY2tub3dsZWRnaW5nIG91ciBvcFxuICAgIGNvbnNvbGUud2FybignSW52YWxpZCB2ZXJzaW9uIGZyb20gc2VydmVyLiBFeHBlY3RlZDogJyArIHRoaXMudmVyc2lvbiArICcgUmVjZWl2ZWQ6ICcgKyBtZXNzYWdlLnYsIG1lc3NhZ2UpO1xuXG4gICAgLy8gRmV0Y2hpbmcgc2hvdWxkIGdldCB1cyBiYWNrIHRvIGEgd29ya2luZyBkb2N1bWVudCBzdGF0ZVxuICAgIHJldHVybiB0aGlzLmZldGNoKCk7XG4gIH1cblxuICAvLyBUaGUgb3Agd2FzIGNvbW1pdHRlZCBzdWNjZXNzZnVsbHkuIEluY3JlbWVudCB0aGUgdmVyc2lvbiBudW1iZXJcbiAgdGhpcy52ZXJzaW9uKys7XG5cbiAgdGhpcy5fY2xlYXJJbmZsaWdodE9wKCk7XG59O1xuXG5Eb2MucHJvdG90eXBlLl9yb2xsYmFjayA9IGZ1bmN0aW9uKGVycikge1xuICAvLyBUaGUgc2VydmVyIGhhcyByZWplY3RlZCBzdWJtaXNzaW9uIG9mIHRoZSBjdXJyZW50IG9wZXJhdGlvbi4gSW52ZXJ0IGJ5XG4gIC8vIGp1c3QgdGhlIGluZmxpZ2h0IG9wIGlmIHBvc3NpYmxlLiBJZiBub3QgcG9zc2libGUgdG8gaW52ZXJ0LCBjYW5jZWwgYWxsXG4gIC8vIHBlbmRpbmcgb3BzIGFuZCBmZXRjaCB0aGUgbGF0ZXN0IGZyb20gdGhlIHNlcnZlciB0byBnZXQgdXMgYmFjayBpbnRvIGFcbiAgLy8gd29ya2luZyBzdGF0ZSwgdGhlbiBjYWxsIGJhY2tcbiAgdmFyIG9wID0gdGhpcy5pbmZsaWdodE9wO1xuXG4gIGlmIChvcC5vcCAmJiBvcC50eXBlLmludmVydCkge1xuICAgIG9wLm9wID0gb3AudHlwZS5pbnZlcnQob3Aub3ApO1xuXG4gICAgLy8gVHJhbnNmb3JtIHRoZSB1bmRvIG9wZXJhdGlvbiBieSBhbnkgcGVuZGluZyBvcHMuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnBlbmRpbmdPcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciB0cmFuc2Zvcm1FcnIgPSB0cmFuc2Zvcm1YKHRoaXMucGVuZGluZ09wc1tpXSwgb3ApO1xuICAgICAgaWYgKHRyYW5zZm9ybUVycikgcmV0dXJuIHRoaXMuX2hhcmRSb2xsYmFjayh0cmFuc2Zvcm1FcnIpO1xuICAgIH1cblxuICAgIC8vIC4uLiBhbmQgYXBwbHkgaXQgbG9jYWxseSwgcmV2ZXJ0aW5nIHRoZSBjaGFuZ2VzLlxuICAgIC8vXG4gICAgLy8gVGhpcyBvcGVyYXRpb24gaXMgYXBwbGllZCB0byBsb29rIGxpa2UgaXQgY29tZXMgZnJvbSBhIHJlbW90ZSBzb3VyY2UuXG4gICAgLy8gSSdtIHN0aWxsIG5vdCAxMDAlIHN1cmUgYWJvdXQgdGhpcyBmdW5jdGlvbmFsaXR5LCBiZWNhdXNlIGl0cyByZWFsbHkgYVxuICAgIC8vIGxvY2FsIG9wLiBCYXNpY2FsbHksIHRoZSBwcm9ibGVtIGlzIHRoYXQgaWYgdGhlIGNsaWVudCdzIG9wIGlzIHJlamVjdGVkXG4gICAgLy8gYnkgdGhlIHNlcnZlciwgdGhlIGVkaXRvciB3aW5kb3cgc2hvdWxkIHVwZGF0ZSB0byByZWZsZWN0IHRoZSB1bmRvLlxuICAgIHRoaXMuX290QXBwbHkob3AsIGZhbHNlKTtcblxuICAgIHRoaXMuX2NsZWFySW5mbGlnaHRPcChlcnIpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHRoaXMuX2hhcmRSb2xsYmFjayhlcnIpO1xufTtcblxuRG9jLnByb3RvdHlwZS5faGFyZFJvbGxiYWNrID0gZnVuY3Rpb24oZXJyKSB7XG4gIC8vIENhbmNlbCBhbGwgcGVuZGluZyBvcHMgYW5kIHJlc2V0IGlmIHdlIGNhbid0IGludmVydFxuICB2YXIgb3AgPSB0aGlzLmluZmxpZ2h0T3A7XG4gIHZhciBwZW5kaW5nID0gdGhpcy5wZW5kaW5nT3BzO1xuICB0aGlzLl9zZXRUeXBlKG51bGwpO1xuICB0aGlzLnZlcnNpb24gPSBudWxsO1xuICB0aGlzLmluZmxpZ2h0T3AgPSBudWxsO1xuICB0aGlzLnBlbmRpbmdPcHMgPSBbXTtcblxuICAvLyBGZXRjaCB0aGUgbGF0ZXN0IGZyb20gdGhlIHNlcnZlciB0byBnZXQgdXMgYmFjayBpbnRvIGEgd29ya2luZyBzdGF0ZVxuICB2YXIgZG9jID0gdGhpcztcbiAgdGhpcy5mZXRjaChmdW5jdGlvbigpIHtcbiAgICB2YXIgY2FsbGVkID0gb3AgJiYgY2FsbEVhY2gob3AuY2FsbGJhY2tzLCBlcnIpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGVuZGluZy5sZW5ndGg7IGkrKykge1xuICAgICAgY2FsbEVhY2gocGVuZGluZ1tpXS5jYWxsYmFja3MsIGVycik7XG4gICAgfVxuICAgIGlmIChlcnIgJiYgIWNhbGxlZCkgcmV0dXJuIGRvYy5lbWl0KCdlcnJvcicsIGVycik7XG4gIH0pO1xufTtcblxuRG9jLnByb3RvdHlwZS5fY2xlYXJJbmZsaWdodE9wID0gZnVuY3Rpb24oZXJyKSB7XG4gIHZhciBjYWxsZWQgPSBjYWxsRWFjaCh0aGlzLmluZmxpZ2h0T3AuY2FsbGJhY2tzLCBlcnIpO1xuXG4gIHRoaXMuaW5mbGlnaHRPcCA9IG51bGw7XG4gIHRoaXMuZmx1c2goKTtcbiAgdGhpcy5fZW1pdE5vdGhpbmdQZW5kaW5nKCk7XG5cbiAgaWYgKGVyciAmJiAhY2FsbGVkKSByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG59O1xuXG5mdW5jdGlvbiBjYWxsRWFjaChjYWxsYmFja3MsIGVycikge1xuICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgY2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGNhbGxiYWNrID0gY2FsbGJhY2tzW2ldO1xuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBjYWxsZWQ7XG59XG4iLCJleHBvcnRzLkNvbm5lY3Rpb24gPSByZXF1aXJlKCcuL2Nvbm5lY3Rpb24nKTtcbmV4cG9ydHMuRG9jID0gcmVxdWlyZSgnLi9kb2MnKTtcbmV4cG9ydHMuRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvcicpO1xuZXhwb3J0cy5RdWVyeSA9IHJlcXVpcmUoJy4vcXVlcnknKTtcbmV4cG9ydHMudHlwZXMgPSByZXF1aXJlKCcuLi90eXBlcycpO1xuIiwidmFyIGVtaXR0ZXIgPSByZXF1aXJlKCcuLi9lbWl0dGVyJyk7XG5cbi8vIFF1ZXJpZXMgYXJlIGxpdmUgcmVxdWVzdHMgdG8gdGhlIGRhdGFiYXNlIGZvciBwYXJ0aWN1bGFyIHNldHMgb2YgZmllbGRzLlxuLy9cbi8vIFRoZSBzZXJ2ZXIgYWN0aXZlbHkgdGVsbHMgdGhlIGNsaWVudCB3aGVuIHRoZXJlJ3MgbmV3IGRhdGEgdGhhdCBtYXRjaGVzXG4vLyBhIHNldCBvZiBjb25kaXRpb25zLlxubW9kdWxlLmV4cG9ydHMgPSBRdWVyeTtcbmZ1bmN0aW9uIFF1ZXJ5KGFjdGlvbiwgY29ubmVjdGlvbiwgaWQsIGNvbGxlY3Rpb24sIHF1ZXJ5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBlbWl0dGVyLkV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuXG4gIC8vICdxZicgb3IgJ3FzJ1xuICB0aGlzLmFjdGlvbiA9IGFjdGlvbjtcblxuICB0aGlzLmNvbm5lY3Rpb24gPSBjb25uZWN0aW9uO1xuICB0aGlzLmlkID0gaWQ7XG4gIHRoaXMuY29sbGVjdGlvbiA9IGNvbGxlY3Rpb247XG5cbiAgLy8gVGhlIHF1ZXJ5IGl0c2VsZi4gRm9yIG1vbmdvLCB0aGlzIHNob3VsZCBsb29rIHNvbWV0aGluZyBsaWtlIHtcImRhdGEueFwiOjV9XG4gIHRoaXMucXVlcnkgPSBxdWVyeTtcblxuICAvLyBBIGxpc3Qgb2YgcmVzdWx0aW5nIGRvY3VtZW50cy4gVGhlc2UgYXJlIGFjdHVhbCBkb2N1bWVudHMsIGNvbXBsZXRlIHdpdGhcbiAgLy8gZGF0YSBhbmQgYWxsIHRoZSByZXN0LiBJdCBpcyBwb3NzaWJsZSB0byBwYXNzIGluIGFuIGluaXRpYWwgcmVzdWx0cyBzZXQsXG4gIC8vIHNvIHRoYXQgYSBxdWVyeSBjYW4gYmUgc2VyaWFsaXplZCBhbmQgdGhlbiByZS1lc3RhYmxpc2hlZFxuICB0aGlzLnJlc3VsdHMgPSBudWxsO1xuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnJlc3VsdHMpIHtcbiAgICB0aGlzLnJlc3VsdHMgPSBvcHRpb25zLnJlc3VsdHM7XG4gICAgZGVsZXRlIG9wdGlvbnMucmVzdWx0cztcbiAgfVxuICB0aGlzLmV4dHJhID0gdW5kZWZpbmVkO1xuXG4gIC8vIE9wdGlvbnMgdG8gcGFzcyB0aHJvdWdoIHdpdGggdGhlIHF1ZXJ5XG4gIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cbiAgdGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xuICB0aGlzLnJlYWR5ID0gZmFsc2U7XG4gIHRoaXMuc2VudCA9IGZhbHNlO1xufVxuZW1pdHRlci5taXhpbihRdWVyeSk7XG5cblF1ZXJ5LnByb3RvdHlwZS5oYXNQZW5kaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiAhdGhpcy5yZWFkeTtcbn07XG5cbi8vIEhlbHBlciBmb3Igc3Vic2NyaWJlICYgZmV0Y2gsIHNpbmNlIHRoZXkgc2hhcmUgdGhlIHNhbWUgbWVzc2FnZSBmb3JtYXQuXG4vL1xuLy8gVGhpcyBmdW5jdGlvbiBhY3R1YWxseSBpc3N1ZXMgdGhlIHF1ZXJ5LlxuUXVlcnkucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCF0aGlzLmNvbm5lY3Rpb24uY2FuU2VuZCkgcmV0dXJuO1xuXG4gIHZhciBtZXNzYWdlID0ge1xuICAgIGE6IHRoaXMuYWN0aW9uLFxuICAgIGlkOiB0aGlzLmlkLFxuICAgIGM6IHRoaXMuY29sbGVjdGlvbixcbiAgICBxOiB0aGlzLnF1ZXJ5XG4gIH07XG4gIGlmICh0aGlzLm9wdGlvbnMpIHtcbiAgICBtZXNzYWdlLm8gPSB0aGlzLm9wdGlvbnM7XG4gIH1cbiAgaWYgKHRoaXMucmVzdWx0cykge1xuICAgIC8vIENvbGxlY3QgdGhlIHZlcnNpb24gb2YgYWxsIHRoZSBkb2N1bWVudHMgaW4gdGhlIGN1cnJlbnQgcmVzdWx0IHNldCBzbyB3ZVxuICAgIC8vIGRvbid0IG5lZWQgdG8gYmUgc2VudCB0aGVpciBzbmFwc2hvdHMgYWdhaW4uXG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucmVzdWx0cy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGRvYyA9IHRoaXMucmVzdWx0c1tpXTtcbiAgICAgIHJlc3VsdHMucHVzaChbZG9jLmlkLCBkb2MudmVyc2lvbl0pO1xuICAgIH1cbiAgICBtZXNzYWdlLnIgPSByZXN1bHRzO1xuICB9XG5cbiAgdGhpcy5jb25uZWN0aW9uLnNlbmQobWVzc2FnZSk7XG4gIHRoaXMuc2VudCA9IHRydWU7XG59O1xuXG4vLyBEZXN0cm95IHRoZSBxdWVyeSBvYmplY3QuIEFueSBzdWJzZXF1ZW50IG1lc3NhZ2VzIGZvciB0aGUgcXVlcnkgd2lsbCBiZVxuLy8gaWdub3JlZCBieSB0aGUgY29ubmVjdGlvbi5cblF1ZXJ5LnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgaWYgKHRoaXMuY29ubmVjdGlvbi5jYW5TZW5kICYmIHRoaXMuYWN0aW9uID09PSAncXMnKSB7XG4gICAgdGhpcy5jb25uZWN0aW9uLnNlbmQoe2E6ICdxdScsIGlkOiB0aGlzLmlkfSk7XG4gIH1cbiAgdGhpcy5jb25uZWN0aW9uLl9kZXN0cm95UXVlcnkodGhpcyk7XG4gIC8vIFRoZXJlIGlzIGEgY2FsbGJhY2sgZm9yIGNvbnNpc3RlbmN5LCBidXQgd2UgZG9uJ3QgYWN0dWFsbHkgd2FpdCBmb3IgdGhlXG4gIC8vIHNlcnZlcidzIHVuc3Vic2NyaWJlIG1lc3NhZ2UgY3VycmVudGx5XG4gIGlmIChjYWxsYmFjaykgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjayk7XG59O1xuXG5RdWVyeS5wcm90b3R5cGUuX29uQ29ubmVjdGlvblN0YXRlQ2hhbmdlZCA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5jb25uZWN0aW9uLmNhblNlbmQgJiYgIXRoaXMuc2VudCkge1xuICAgIHRoaXMuc2VuZCgpO1xuICB9IGVsc2Uge1xuICAgIHRoaXMuc2VudCA9IGZhbHNlO1xuICB9XG59O1xuXG5RdWVyeS5wcm90b3R5cGUuX2hhbmRsZUZldGNoID0gZnVuY3Rpb24oZXJyLCBkYXRhLCBleHRyYSkge1xuICAvLyBPbmNlIGEgZmV0Y2ggcXVlcnkgZ2V0cyBpdHMgZGF0YSwgaXQgaXMgZGVzdHJveWVkLlxuICB0aGlzLmNvbm5lY3Rpb24uX2Rlc3Ryb3lRdWVyeSh0aGlzKTtcbiAgdGhpcy5faGFuZGxlUmVzcG9uc2UoZXJyLCBkYXRhLCBleHRyYSk7XG59O1xuXG5RdWVyeS5wcm90b3R5cGUuX2hhbmRsZVN1YnNjcmliZSA9IGZ1bmN0aW9uKGVyciwgZGF0YSwgZXh0cmEpIHtcbiAgdGhpcy5faGFuZGxlUmVzcG9uc2UoZXJyLCBkYXRhLCBleHRyYSk7XG59O1xuXG5RdWVyeS5wcm90b3R5cGUuX2hhbmRsZVJlc3BvbnNlID0gZnVuY3Rpb24oZXJyLCBkYXRhLCBleHRyYSkge1xuICB2YXIgY2FsbGJhY2sgPSB0aGlzLmNhbGxiYWNrO1xuICB0aGlzLmNhbGxiYWNrID0gbnVsbDtcbiAgaWYgKGVycikgcmV0dXJuIHRoaXMuX2ZpbmlzaFJlc3BvbnNlKGVyciwgY2FsbGJhY2spO1xuICBpZiAoIWRhdGEpIHJldHVybiB0aGlzLl9maW5pc2hSZXNwb25zZShudWxsLCBjYWxsYmFjayk7XG5cbiAgdmFyIHF1ZXJ5ID0gdGhpcztcbiAgdmFyIHdhaXQgPSAxO1xuICB2YXIgZmluaXNoID0gZnVuY3Rpb24oZXJyKSB7XG4gICAgaWYgKGVycikgcmV0dXJuIHF1ZXJ5Ll9maW5pc2hSZXNwb25zZShlcnIsIGNhbGxiYWNrKTtcbiAgICBpZiAoLS13YWl0KSByZXR1cm47XG4gICAgcXVlcnkuX2ZpbmlzaFJlc3BvbnNlKG51bGwsIGNhbGxiYWNrKTtcbiAgfTtcblxuICBpZiAoQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgIHdhaXQgKz0gZGF0YS5sZW5ndGg7XG4gICAgdGhpcy5yZXN1bHRzID0gdGhpcy5faW5nZXN0U25hcHNob3RzKGRhdGEsIGZpbmlzaCk7XG4gICAgdGhpcy5leHRyYSA9IGV4dHJhO1xuXG4gIH0gZWxzZSB7XG4gICAgZm9yICh2YXIgaWQgaW4gZGF0YSkge1xuICAgICAgd2FpdCsrO1xuICAgICAgdmFyIHNuYXBzaG90ID0gZGF0YVtpZF07XG4gICAgICB2YXIgZG9jID0gdGhpcy5jb25uZWN0aW9uLmdldChzbmFwc2hvdC5jIHx8IHRoaXMuY29sbGVjdGlvbiwgaWQpO1xuICAgICAgZG9jLmluZ2VzdFNuYXBzaG90KHNuYXBzaG90LCBmaW5pc2gpO1xuICAgIH1cbiAgfVxuXG4gIGZpbmlzaCgpO1xufTtcblxuUXVlcnkucHJvdG90eXBlLl9pbmdlc3RTbmFwc2hvdHMgPSBmdW5jdGlvbihzbmFwc2hvdHMsIGZpbmlzaCkge1xuICB2YXIgcmVzdWx0cyA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHNuYXBzaG90cy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBzbmFwc2hvdCA9IHNuYXBzaG90c1tpXTtcbiAgICB2YXIgZG9jID0gdGhpcy5jb25uZWN0aW9uLmdldChzbmFwc2hvdC5jIHx8IHRoaXMuY29sbGVjdGlvbiwgc25hcHNob3QuZCk7XG4gICAgZG9jLmluZ2VzdFNuYXBzaG90KHNuYXBzaG90LCBmaW5pc2gpO1xuICAgIHJlc3VsdHMucHVzaChkb2MpO1xuICB9XG4gIHJldHVybiByZXN1bHRzO1xufTtcblxuUXVlcnkucHJvdG90eXBlLl9maW5pc2hSZXNwb25zZSA9IGZ1bmN0aW9uKGVyciwgY2FsbGJhY2spIHtcbiAgdGhpcy5lbWl0KCdyZWFkeScpO1xuICB0aGlzLnJlYWR5ID0gdHJ1ZTtcbiAgaWYgKGVycikge1xuICAgIHRoaXMuY29ubmVjdGlvbi5fZGVzdHJveVF1ZXJ5KHRoaXMpO1xuICAgIGlmIChjYWxsYmFjaykgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICB9XG4gIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgdGhpcy5yZXN1bHRzLCB0aGlzLmV4dHJhKTtcbn07XG5cblF1ZXJ5LnByb3RvdHlwZS5faGFuZGxlRXJyb3IgPSBmdW5jdGlvbihlcnIpIHtcbiAgdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG59O1xuXG5RdWVyeS5wcm90b3R5cGUuX2hhbmRsZURpZmYgPSBmdW5jdGlvbihkaWZmKSB7XG4gIC8vIFdlIG5lZWQgdG8gZ28gdGhyb3VnaCB0aGUgbGlzdCB0d2ljZS4gRmlyc3QsIHdlJ2xsIGluZ2VzdCBhbGwgdGhlIG5ld1xuICAvLyBkb2N1bWVudHMuIEFmdGVyIHRoYXQgd2UnbGwgZW1pdCBldmVudHMgYW5kIGFjdHVhbGx5IHVwZGF0ZSBvdXIgbGlzdC5cbiAgLy8gVGhpcyBhdm9pZHMgcmFjZSBjb25kaXRpb25zIGFyb3VuZCBzZXR0aW5nIGRvY3VtZW50cyB0byBiZSBzdWJzY3JpYmVkICZcbiAgLy8gdW5zdWJzY3JpYmluZyBkb2N1bWVudHMgaW4gZXZlbnQgY2FsbGJhY2tzLlxuICBmb3IgKHZhciBpID0gMDsgaSA8IGRpZmYubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgZCA9IGRpZmZbaV07XG4gICAgaWYgKGQudHlwZSA9PT0gJ2luc2VydCcpIGQudmFsdWVzID0gdGhpcy5faW5nZXN0U25hcHNob3RzKGQudmFsdWVzKTtcbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgZGlmZi5sZW5ndGg7IGkrKykge1xuICAgIHZhciBkID0gZGlmZltpXTtcbiAgICBzd2l0Y2ggKGQudHlwZSkge1xuICAgICAgY2FzZSAnaW5zZXJ0JzpcbiAgICAgICAgdmFyIG5ld0RvY3MgPSBkLnZhbHVlcztcbiAgICAgICAgQXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseSh0aGlzLnJlc3VsdHMsIFtkLmluZGV4LCAwXS5jb25jYXQobmV3RG9jcykpO1xuICAgICAgICB0aGlzLmVtaXQoJ2luc2VydCcsIG5ld0RvY3MsIGQuaW5kZXgpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3JlbW92ZSc6XG4gICAgICAgIHZhciBob3dNYW55ID0gZC5ob3dNYW55IHx8IDE7XG4gICAgICAgIHZhciByZW1vdmVkID0gdGhpcy5yZXN1bHRzLnNwbGljZShkLmluZGV4LCBob3dNYW55KTtcbiAgICAgICAgdGhpcy5lbWl0KCdyZW1vdmUnLCByZW1vdmVkLCBkLmluZGV4KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdtb3ZlJzpcbiAgICAgICAgdmFyIGhvd01hbnkgPSBkLmhvd01hbnkgfHwgMTtcbiAgICAgICAgdmFyIGRvY3MgPSB0aGlzLnJlc3VsdHMuc3BsaWNlKGQuZnJvbSwgaG93TWFueSk7XG4gICAgICAgIEFycmF5LnByb3RvdHlwZS5zcGxpY2UuYXBwbHkodGhpcy5yZXN1bHRzLCBbZC50bywgMF0uY29uY2F0KGRvY3MpKTtcbiAgICAgICAgdGhpcy5lbWl0KCdtb3ZlJywgZG9jcywgZC5mcm9tLCBkLnRvKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgdGhpcy5lbWl0KCdjaGFuZ2VkJywgdGhpcy5yZXN1bHRzKTtcbn07XG5cblF1ZXJ5LnByb3RvdHlwZS5faGFuZGxlRXh0cmEgPSBmdW5jdGlvbihleHRyYSkge1xuICB0aGlzLmV4dHJhID0gZXh0cmE7XG4gIHRoaXMuZW1pdCgnZXh0cmEnLCBleHRyYSk7XG59O1xuIiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuZXhwb3J0cy5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5leHBvcnRzLm1peGluID0gbWl4aW47XG5cbmZ1bmN0aW9uIG1peGluKENvbnN0cnVjdG9yKSB7XG4gIGZvciAodmFyIGtleSBpbiBFdmVudEVtaXR0ZXIucHJvdG90eXBlKSB7XG4gICAgQ29uc3RydWN0b3IucHJvdG90eXBlW2tleV0gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlW2tleV07XG4gIH1cbn1cbiIsInZhciBtYWtlRXJyb3IgPSByZXF1aXJlKCdtYWtlLWVycm9yJyk7XG5cbmZ1bmN0aW9uIFNoYXJlREJFcnJvcihjb2RlLCBtZXNzYWdlKSB7XG4gIFNoYXJlREJFcnJvci5zdXBlci5jYWxsKHRoaXMsIG1lc3NhZ2UpO1xuICB0aGlzLmNvZGUgPSBjb2RlO1xufVxuXG5tYWtlRXJyb3IoU2hhcmVEQkVycm9yKTtcblxubW9kdWxlLmV4cG9ydHMgPSBTaGFyZURCRXJyb3I7XG4iLCJcbmV4cG9ydHMuZGVmYXVsdFR5cGUgPSByZXF1aXJlKCdvdC1qc29uMCcpLnR5cGU7XG5cbmV4cG9ydHMubWFwID0ge307XG5cbmV4cG9ydHMucmVnaXN0ZXIgPSBmdW5jdGlvbih0eXBlKSB7XG4gIGlmICh0eXBlLm5hbWUpIGV4cG9ydHMubWFwW3R5cGUubmFtZV0gPSB0eXBlO1xuICBpZiAodHlwZS51cmkpIGV4cG9ydHMubWFwW3R5cGUudXJpXSA9IHR5cGU7XG59O1xuXG5leHBvcnRzLnJlZ2lzdGVyKGV4cG9ydHMuZGVmYXVsdFR5cGUpO1xuIiwiXG5leHBvcnRzLmRvTm90aGluZyA9IGRvTm90aGluZztcbmZ1bmN0aW9uIGRvTm90aGluZygpIHt9XG5cbmV4cG9ydHMuaGFzS2V5cyA9IGZ1bmN0aW9uKG9iamVjdCkge1xuICBmb3IgKHZhciBrZXkgaW4gb2JqZWN0KSByZXR1cm4gdHJ1ZTtcbiAgcmV0dXJuIGZhbHNlO1xufTtcbiJdfQ==
