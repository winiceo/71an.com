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
    switch (typeof c) {
      case 'object':
        // The only valid objects are {d:X} for +ive values of X.
        if (!(typeof c.d === 'number' && c.d > 0)) throw Error('Object components must be deletes of size > 0');
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

sharedb.Doc.prototype.createContext = function() {
  var type = this.type;
  if (!type) throw new Error('Missing type ' + this.collection + ' ' + this.name);

  // I could use the prototype chain to do this instead, but Object.create
  // isn't defined on old browsers. This will be fine.
  var doc = this;
  
  var context = {
    getSnapshot: function() {
      return doc.snapshot;
    },

    submitOp: function(op, callback) {
      doc.submitOp(op, context, callback);
    },
    destroy: function() {
      if (this.detach) {
        this.detach();
        // Don't double-detach.
        delete this.detach;
      }
      // It will be removed from the actual editingContexts list next time
      // we receive an op on the document (and the list is iterated through).
      //
      // This is potentially dodgy, allowing a memory leak if you create &
      // destroy a whole bunch of contexts without receiving or sending any ops
      // to the document.
      //
      // NOTE Why can't we destroy contexts immediately?
      delete this._onOp;
      this.shouldBeRemoved = true;
    },

    // This is dangerous, but really really useful for debugging. I hope people
    // don't depend on it.
    _doc: this,
  };
  //context=Object.assign(context,this.type)
  
  if (type.api) {
    var api=type.api(context.snapshot,context.submitOp)
    // Copy everything else from the type's API into the editing context.
    for (var k in api) {
       
      context[k] = api[k];
    }
  } else {
    context.provides = {};
  }


  //this.editingContexts.push(context);

  return context;
};


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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9leHRlbmQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZmFzdC1kaWZmL2RpZmYuanMiLCJub2RlX21vZHVsZXMvbWFrZS1lcnJvci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9vdC1qc29uMC9saWIvYm9vdHN0cmFwVHJhbnNmb3JtLmpzIiwibm9kZV9tb2R1bGVzL290LWpzb24wL2xpYi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9vdC1qc29uMC9saWIvanNvbjAuanMiLCJub2RlX21vZHVsZXMvb3QtanNvbjAvbGliL3RleHQwLmpzIiwibm9kZV9tb2R1bGVzL290LXRleHQvbGliL2FwaS5qcyIsIm5vZGVfbW9kdWxlcy9vdC10ZXh0L2xpYi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9vdC10ZXh0L2xpYi90ZXh0LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9xdWlsbC1kZWx0YS9saWIvZGVsdGEuanMiLCJub2RlX21vZHVsZXMvcXVpbGwtZGVsdGEvbGliL29wLmpzIiwibm9kZV9tb2R1bGVzL3F1aWxsLWRlbHRhL25vZGVfbW9kdWxlcy9kZWVwLWVxdWFsL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3F1aWxsLWRlbHRhL25vZGVfbW9kdWxlcy9kZWVwLWVxdWFsL2xpYi9pc19hcmd1bWVudHMuanMiLCJub2RlX21vZHVsZXMvcXVpbGwtZGVsdGEvbm9kZV9tb2R1bGVzL2RlZXAtZXF1YWwvbGliL2tleXMuanMiLCJub2RlX21vZHVsZXMvcmljaC10ZXh0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3JpY2gtdGV4dC9saWIvdHlwZS5qcyIsInNyYy9jbGllbnQvaW5kZXguanMiLCJzcmMvc2VydmVyL3ZlbmRvci9zaGFyZWRiL2xpYi9jbGllbnQvY29ubmVjdGlvbi5qcyIsInNyYy9zZXJ2ZXIvdmVuZG9yL3NoYXJlZGIvbGliL2NsaWVudC9kb2MuanMiLCJzcmMvc2VydmVyL3ZlbmRvci9zaGFyZWRiL2xpYi9jbGllbnQvaW5kZXguanMiLCJzcmMvc2VydmVyL3ZlbmRvci9zaGFyZWRiL2xpYi9jbGllbnQvcXVlcnkuanMiLCJzcmMvc2VydmVyL3ZlbmRvci9zaGFyZWRiL2xpYi9lbWl0dGVyLmpzIiwic3JjL3NlcnZlci92ZW5kb3Ivc2hhcmVkYi9saWIvZXJyb3IuanMiLCJzcmMvc2VydmVyL3ZlbmRvci9zaGFyZWRiL2xpYi90eXBlcy5qcyIsInNyYy9zZXJ2ZXIvdmVuZG9yL3NoYXJlZGIvbGliL3V0aWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqYUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdFRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ25rQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3ZNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQXQgbGVhc3QgZ2l2ZSBzb21lIGtpbmQgb2YgY29udGV4dCB0byB0aGUgdXNlclxuICAgICAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LiAoJyArIGVyICsgJyknKTtcbiAgICAgICAgZXJyLmNvbnRleHQgPSBlcjtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2UgaWYgKGxpc3RlbmVycykge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKHRoaXMuX2V2ZW50cykge1xuICAgIHZhciBldmxpc3RlbmVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpXG4gICAgICByZXR1cm4gMTtcbiAgICBlbHNlIGlmIChldmxpc3RlbmVyKVxuICAgICAgcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RoO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSk7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIHRvU3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxudmFyIGlzQXJyYXkgPSBmdW5jdGlvbiBpc0FycmF5KGFycikge1xuXHRpZiAodHlwZW9mIEFycmF5LmlzQXJyYXkgPT09ICdmdW5jdGlvbicpIHtcblx0XHRyZXR1cm4gQXJyYXkuaXNBcnJheShhcnIpO1xuXHR9XG5cblx0cmV0dXJuIHRvU3RyLmNhbGwoYXJyKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG5cbnZhciBpc1BsYWluT2JqZWN0ID0gZnVuY3Rpb24gaXNQbGFpbk9iamVjdChvYmopIHtcblx0aWYgKCFvYmogfHwgdG9TdHIuY2FsbChvYmopICE9PSAnW29iamVjdCBPYmplY3RdJykge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHZhciBoYXNPd25Db25zdHJ1Y3RvciA9IGhhc093bi5jYWxsKG9iaiwgJ2NvbnN0cnVjdG9yJyk7XG5cdHZhciBoYXNJc1Byb3RvdHlwZU9mID0gb2JqLmNvbnN0cnVjdG9yICYmIG9iai5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgJiYgaGFzT3duLmNhbGwob2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSwgJ2lzUHJvdG90eXBlT2YnKTtcblx0Ly8gTm90IG93biBjb25zdHJ1Y3RvciBwcm9wZXJ0eSBtdXN0IGJlIE9iamVjdFxuXHRpZiAob2JqLmNvbnN0cnVjdG9yICYmICFoYXNPd25Db25zdHJ1Y3RvciAmJiAhaGFzSXNQcm90b3R5cGVPZikge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8vIE93biBwcm9wZXJ0aWVzIGFyZSBlbnVtZXJhdGVkIGZpcnN0bHksIHNvIHRvIHNwZWVkIHVwLFxuXHQvLyBpZiBsYXN0IG9uZSBpcyBvd24sIHRoZW4gYWxsIHByb3BlcnRpZXMgYXJlIG93bi5cblx0dmFyIGtleTtcblx0Zm9yIChrZXkgaW4gb2JqKSB7LyoqL31cblxuXHRyZXR1cm4gdHlwZW9mIGtleSA9PT0gJ3VuZGVmaW5lZCcgfHwgaGFzT3duLmNhbGwob2JqLCBrZXkpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBleHRlbmQoKSB7XG5cdHZhciBvcHRpb25zLCBuYW1lLCBzcmMsIGNvcHksIGNvcHlJc0FycmF5LCBjbG9uZSxcblx0XHR0YXJnZXQgPSBhcmd1bWVudHNbMF0sXG5cdFx0aSA9IDEsXG5cdFx0bGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aCxcblx0XHRkZWVwID0gZmFsc2U7XG5cblx0Ly8gSGFuZGxlIGEgZGVlcCBjb3B5IHNpdHVhdGlvblxuXHRpZiAodHlwZW9mIHRhcmdldCA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0ZGVlcCA9IHRhcmdldDtcblx0XHR0YXJnZXQgPSBhcmd1bWVudHNbMV0gfHwge307XG5cdFx0Ly8gc2tpcCB0aGUgYm9vbGVhbiBhbmQgdGhlIHRhcmdldFxuXHRcdGkgPSAyO1xuXHR9IGVsc2UgaWYgKCh0eXBlb2YgdGFyZ2V0ICE9PSAnb2JqZWN0JyAmJiB0eXBlb2YgdGFyZ2V0ICE9PSAnZnVuY3Rpb24nKSB8fCB0YXJnZXQgPT0gbnVsbCkge1xuXHRcdHRhcmdldCA9IHt9O1xuXHR9XG5cblx0Zm9yICg7IGkgPCBsZW5ndGg7ICsraSkge1xuXHRcdG9wdGlvbnMgPSBhcmd1bWVudHNbaV07XG5cdFx0Ly8gT25seSBkZWFsIHdpdGggbm9uLW51bGwvdW5kZWZpbmVkIHZhbHVlc1xuXHRcdGlmIChvcHRpb25zICE9IG51bGwpIHtcblx0XHRcdC8vIEV4dGVuZCB0aGUgYmFzZSBvYmplY3Rcblx0XHRcdGZvciAobmFtZSBpbiBvcHRpb25zKSB7XG5cdFx0XHRcdHNyYyA9IHRhcmdldFtuYW1lXTtcblx0XHRcdFx0Y29weSA9IG9wdGlvbnNbbmFtZV07XG5cblx0XHRcdFx0Ly8gUHJldmVudCBuZXZlci1lbmRpbmcgbG9vcFxuXHRcdFx0XHRpZiAodGFyZ2V0ICE9PSBjb3B5KSB7XG5cdFx0XHRcdFx0Ly8gUmVjdXJzZSBpZiB3ZSdyZSBtZXJnaW5nIHBsYWluIG9iamVjdHMgb3IgYXJyYXlzXG5cdFx0XHRcdFx0aWYgKGRlZXAgJiYgY29weSAmJiAoaXNQbGFpbk9iamVjdChjb3B5KSB8fCAoY29weUlzQXJyYXkgPSBpc0FycmF5KGNvcHkpKSkpIHtcblx0XHRcdFx0XHRcdGlmIChjb3B5SXNBcnJheSkge1xuXHRcdFx0XHRcdFx0XHRjb3B5SXNBcnJheSA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRjbG9uZSA9IHNyYyAmJiBpc0FycmF5KHNyYykgPyBzcmMgOiBbXTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGNsb25lID0gc3JjICYmIGlzUGxhaW5PYmplY3Qoc3JjKSA/IHNyYyA6IHt9O1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBOZXZlciBtb3ZlIG9yaWdpbmFsIG9iamVjdHMsIGNsb25lIHRoZW1cblx0XHRcdFx0XHRcdHRhcmdldFtuYW1lXSA9IGV4dGVuZChkZWVwLCBjbG9uZSwgY29weSk7XG5cblx0XHRcdFx0XHQvLyBEb24ndCBicmluZyBpbiB1bmRlZmluZWQgdmFsdWVzXG5cdFx0XHRcdFx0fSBlbHNlIGlmICh0eXBlb2YgY29weSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0XHRcdHRhcmdldFtuYW1lXSA9IGNvcHk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gUmV0dXJuIHRoZSBtb2RpZmllZCBvYmplY3Rcblx0cmV0dXJuIHRhcmdldDtcbn07XG5cbiIsIi8qKlxuICogVGhpcyBsaWJyYXJ5IG1vZGlmaWVzIHRoZSBkaWZmLXBhdGNoLW1hdGNoIGxpYnJhcnkgYnkgTmVpbCBGcmFzZXJcbiAqIGJ5IHJlbW92aW5nIHRoZSBwYXRjaCBhbmQgbWF0Y2ggZnVuY3Rpb25hbGl0eSBhbmQgY2VydGFpbiBhZHZhbmNlZFxuICogb3B0aW9ucyBpbiB0aGUgZGlmZiBmdW5jdGlvbi4gVGhlIG9yaWdpbmFsIGxpY2Vuc2UgaXMgYXMgZm9sbG93czpcbiAqXG4gKiA9PT1cbiAqXG4gKiBEaWZmIE1hdGNoIGFuZCBQYXRjaFxuICpcbiAqIENvcHlyaWdodCAyMDA2IEdvb2dsZSBJbmMuXG4gKiBodHRwOi8vY29kZS5nb29nbGUuY29tL3AvZ29vZ2xlLWRpZmYtbWF0Y2gtcGF0Y2gvXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG5cbi8qKlxuICogVGhlIGRhdGEgc3RydWN0dXJlIHJlcHJlc2VudGluZyBhIGRpZmYgaXMgYW4gYXJyYXkgb2YgdHVwbGVzOlxuICogW1tESUZGX0RFTEVURSwgJ0hlbGxvJ10sIFtESUZGX0lOU0VSVCwgJ0dvb2RieWUnXSwgW0RJRkZfRVFVQUwsICcgd29ybGQuJ11dXG4gKiB3aGljaCBtZWFuczogZGVsZXRlICdIZWxsbycsIGFkZCAnR29vZGJ5ZScgYW5kIGtlZXAgJyB3b3JsZC4nXG4gKi9cbnZhciBESUZGX0RFTEVURSA9IC0xO1xudmFyIERJRkZfSU5TRVJUID0gMTtcbnZhciBESUZGX0VRVUFMID0gMDtcblxuXG4vKipcbiAqIEZpbmQgdGhlIGRpZmZlcmVuY2VzIGJldHdlZW4gdHdvIHRleHRzLiAgU2ltcGxpZmllcyB0aGUgcHJvYmxlbSBieSBzdHJpcHBpbmdcbiAqIGFueSBjb21tb24gcHJlZml4IG9yIHN1ZmZpeCBvZmYgdGhlIHRleHRzIGJlZm9yZSBkaWZmaW5nLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIE9sZCBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIE5ldyBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICogQHBhcmFtIHtJbnR9IGN1cnNvcl9wb3MgRXhwZWN0ZWQgZWRpdCBwb3NpdGlvbiBpbiB0ZXh0MSAob3B0aW9uYWwpXG4gKiBAcmV0dXJuIHtBcnJheX0gQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG4gKi9cbmZ1bmN0aW9uIGRpZmZfbWFpbih0ZXh0MSwgdGV4dDIsIGN1cnNvcl9wb3MpIHtcbiAgLy8gQ2hlY2sgZm9yIGVxdWFsaXR5IChzcGVlZHVwKS5cbiAgaWYgKHRleHQxID09IHRleHQyKSB7XG4gICAgaWYgKHRleHQxKSB7XG4gICAgICByZXR1cm4gW1tESUZGX0VRVUFMLCB0ZXh0MV1dO1xuICAgIH1cbiAgICByZXR1cm4gW107XG4gIH1cblxuICAvLyBDaGVjayBjdXJzb3JfcG9zIHdpdGhpbiBib3VuZHNcbiAgaWYgKGN1cnNvcl9wb3MgPCAwIHx8IHRleHQxLmxlbmd0aCA8IGN1cnNvcl9wb3MpIHtcbiAgICBjdXJzb3JfcG9zID0gbnVsbDtcbiAgfVxuXG4gIC8vIFRyaW0gb2ZmIGNvbW1vbiBwcmVmaXggKHNwZWVkdXApLlxuICB2YXIgY29tbW9ubGVuZ3RoID0gZGlmZl9jb21tb25QcmVmaXgodGV4dDEsIHRleHQyKTtcbiAgdmFyIGNvbW1vbnByZWZpeCA9IHRleHQxLnN1YnN0cmluZygwLCBjb21tb25sZW5ndGgpO1xuICB0ZXh0MSA9IHRleHQxLnN1YnN0cmluZyhjb21tb25sZW5ndGgpO1xuICB0ZXh0MiA9IHRleHQyLnN1YnN0cmluZyhjb21tb25sZW5ndGgpO1xuXG4gIC8vIFRyaW0gb2ZmIGNvbW1vbiBzdWZmaXggKHNwZWVkdXApLlxuICBjb21tb25sZW5ndGggPSBkaWZmX2NvbW1vblN1ZmZpeCh0ZXh0MSwgdGV4dDIpO1xuICB2YXIgY29tbW9uc3VmZml4ID0gdGV4dDEuc3Vic3RyaW5nKHRleHQxLmxlbmd0aCAtIGNvbW1vbmxlbmd0aCk7XG4gIHRleHQxID0gdGV4dDEuc3Vic3RyaW5nKDAsIHRleHQxLmxlbmd0aCAtIGNvbW1vbmxlbmd0aCk7XG4gIHRleHQyID0gdGV4dDIuc3Vic3RyaW5nKDAsIHRleHQyLmxlbmd0aCAtIGNvbW1vbmxlbmd0aCk7XG5cbiAgLy8gQ29tcHV0ZSB0aGUgZGlmZiBvbiB0aGUgbWlkZGxlIGJsb2NrLlxuICB2YXIgZGlmZnMgPSBkaWZmX2NvbXB1dGVfKHRleHQxLCB0ZXh0Mik7XG5cbiAgLy8gUmVzdG9yZSB0aGUgcHJlZml4IGFuZCBzdWZmaXguXG4gIGlmIChjb21tb25wcmVmaXgpIHtcbiAgICBkaWZmcy51bnNoaWZ0KFtESUZGX0VRVUFMLCBjb21tb25wcmVmaXhdKTtcbiAgfVxuICBpZiAoY29tbW9uc3VmZml4KSB7XG4gICAgZGlmZnMucHVzaChbRElGRl9FUVVBTCwgY29tbW9uc3VmZml4XSk7XG4gIH1cbiAgZGlmZl9jbGVhbnVwTWVyZ2UoZGlmZnMpO1xuICBpZiAoY3Vyc29yX3BvcyAhPSBudWxsKSB7XG4gICAgZGlmZnMgPSBmaXhfY3Vyc29yKGRpZmZzLCBjdXJzb3JfcG9zKTtcbiAgfVxuICByZXR1cm4gZGlmZnM7XG59O1xuXG5cbi8qKlxuICogRmluZCB0aGUgZGlmZmVyZW5jZXMgYmV0d2VlbiB0d28gdGV4dHMuICBBc3N1bWVzIHRoYXQgdGhlIHRleHRzIGRvIG5vdFxuICogaGF2ZSBhbnkgY29tbW9uIHByZWZpeCBvciBzdWZmaXguXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgT2xkIHN0cmluZyB0byBiZSBkaWZmZWQuXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgTmV3IHN0cmluZyB0byBiZSBkaWZmZWQuXG4gKiBAcmV0dXJuIHtBcnJheX0gQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG4gKi9cbmZ1bmN0aW9uIGRpZmZfY29tcHV0ZV8odGV4dDEsIHRleHQyKSB7XG4gIHZhciBkaWZmcztcblxuICBpZiAoIXRleHQxKSB7XG4gICAgLy8gSnVzdCBhZGQgc29tZSB0ZXh0IChzcGVlZHVwKS5cbiAgICByZXR1cm4gW1tESUZGX0lOU0VSVCwgdGV4dDJdXTtcbiAgfVxuXG4gIGlmICghdGV4dDIpIHtcbiAgICAvLyBKdXN0IGRlbGV0ZSBzb21lIHRleHQgKHNwZWVkdXApLlxuICAgIHJldHVybiBbW0RJRkZfREVMRVRFLCB0ZXh0MV1dO1xuICB9XG5cbiAgdmFyIGxvbmd0ZXh0ID0gdGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoID8gdGV4dDEgOiB0ZXh0MjtcbiAgdmFyIHNob3J0dGV4dCA9IHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCA/IHRleHQyIDogdGV4dDE7XG4gIHZhciBpID0gbG9uZ3RleHQuaW5kZXhPZihzaG9ydHRleHQpO1xuICBpZiAoaSAhPSAtMSkge1xuICAgIC8vIFNob3J0ZXIgdGV4dCBpcyBpbnNpZGUgdGhlIGxvbmdlciB0ZXh0IChzcGVlZHVwKS5cbiAgICBkaWZmcyA9IFtbRElGRl9JTlNFUlQsIGxvbmd0ZXh0LnN1YnN0cmluZygwLCBpKV0sXG4gICAgICAgICAgICAgW0RJRkZfRVFVQUwsIHNob3J0dGV4dF0sXG4gICAgICAgICAgICAgW0RJRkZfSU5TRVJULCBsb25ndGV4dC5zdWJzdHJpbmcoaSArIHNob3J0dGV4dC5sZW5ndGgpXV07XG4gICAgLy8gU3dhcCBpbnNlcnRpb25zIGZvciBkZWxldGlvbnMgaWYgZGlmZiBpcyByZXZlcnNlZC5cbiAgICBpZiAodGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoKSB7XG4gICAgICBkaWZmc1swXVswXSA9IGRpZmZzWzJdWzBdID0gRElGRl9ERUxFVEU7XG4gICAgfVxuICAgIHJldHVybiBkaWZmcztcbiAgfVxuXG4gIGlmIChzaG9ydHRleHQubGVuZ3RoID09IDEpIHtcbiAgICAvLyBTaW5nbGUgY2hhcmFjdGVyIHN0cmluZy5cbiAgICAvLyBBZnRlciB0aGUgcHJldmlvdXMgc3BlZWR1cCwgdGhlIGNoYXJhY3RlciBjYW4ndCBiZSBhbiBlcXVhbGl0eS5cbiAgICByZXR1cm4gW1tESUZGX0RFTEVURSwgdGV4dDFdLCBbRElGRl9JTlNFUlQsIHRleHQyXV07XG4gIH1cblxuICAvLyBDaGVjayB0byBzZWUgaWYgdGhlIHByb2JsZW0gY2FuIGJlIHNwbGl0IGluIHR3by5cbiAgdmFyIGhtID0gZGlmZl9oYWxmTWF0Y2hfKHRleHQxLCB0ZXh0Mik7XG4gIGlmIChobSkge1xuICAgIC8vIEEgaGFsZi1tYXRjaCB3YXMgZm91bmQsIHNvcnQgb3V0IHRoZSByZXR1cm4gZGF0YS5cbiAgICB2YXIgdGV4dDFfYSA9IGhtWzBdO1xuICAgIHZhciB0ZXh0MV9iID0gaG1bMV07XG4gICAgdmFyIHRleHQyX2EgPSBobVsyXTtcbiAgICB2YXIgdGV4dDJfYiA9IGhtWzNdO1xuICAgIHZhciBtaWRfY29tbW9uID0gaG1bNF07XG4gICAgLy8gU2VuZCBib3RoIHBhaXJzIG9mZiBmb3Igc2VwYXJhdGUgcHJvY2Vzc2luZy5cbiAgICB2YXIgZGlmZnNfYSA9IGRpZmZfbWFpbih0ZXh0MV9hLCB0ZXh0Ml9hKTtcbiAgICB2YXIgZGlmZnNfYiA9IGRpZmZfbWFpbih0ZXh0MV9iLCB0ZXh0Ml9iKTtcbiAgICAvLyBNZXJnZSB0aGUgcmVzdWx0cy5cbiAgICByZXR1cm4gZGlmZnNfYS5jb25jYXQoW1tESUZGX0VRVUFMLCBtaWRfY29tbW9uXV0sIGRpZmZzX2IpO1xuICB9XG5cbiAgcmV0dXJuIGRpZmZfYmlzZWN0Xyh0ZXh0MSwgdGV4dDIpO1xufTtcblxuXG4vKipcbiAqIEZpbmQgdGhlICdtaWRkbGUgc25ha2UnIG9mIGEgZGlmZiwgc3BsaXQgdGhlIHByb2JsZW0gaW4gdHdvXG4gKiBhbmQgcmV0dXJuIHRoZSByZWN1cnNpdmVseSBjb25zdHJ1Y3RlZCBkaWZmLlxuICogU2VlIE15ZXJzIDE5ODYgcGFwZXI6IEFuIE8oTkQpIERpZmZlcmVuY2UgQWxnb3JpdGhtIGFuZCBJdHMgVmFyaWF0aW9ucy5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBPbGQgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAqIEByZXR1cm4ge0FycmF5fSBBcnJheSBvZiBkaWZmIHR1cGxlcy5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGRpZmZfYmlzZWN0Xyh0ZXh0MSwgdGV4dDIpIHtcbiAgLy8gQ2FjaGUgdGhlIHRleHQgbGVuZ3RocyB0byBwcmV2ZW50IG11bHRpcGxlIGNhbGxzLlxuICB2YXIgdGV4dDFfbGVuZ3RoID0gdGV4dDEubGVuZ3RoO1xuICB2YXIgdGV4dDJfbGVuZ3RoID0gdGV4dDIubGVuZ3RoO1xuICB2YXIgbWF4X2QgPSBNYXRoLmNlaWwoKHRleHQxX2xlbmd0aCArIHRleHQyX2xlbmd0aCkgLyAyKTtcbiAgdmFyIHZfb2Zmc2V0ID0gbWF4X2Q7XG4gIHZhciB2X2xlbmd0aCA9IDIgKiBtYXhfZDtcbiAgdmFyIHYxID0gbmV3IEFycmF5KHZfbGVuZ3RoKTtcbiAgdmFyIHYyID0gbmV3IEFycmF5KHZfbGVuZ3RoKTtcbiAgLy8gU2V0dGluZyBhbGwgZWxlbWVudHMgdG8gLTEgaXMgZmFzdGVyIGluIENocm9tZSAmIEZpcmVmb3ggdGhhbiBtaXhpbmdcbiAgLy8gaW50ZWdlcnMgYW5kIHVuZGVmaW5lZC5cbiAgZm9yICh2YXIgeCA9IDA7IHggPCB2X2xlbmd0aDsgeCsrKSB7XG4gICAgdjFbeF0gPSAtMTtcbiAgICB2Mlt4XSA9IC0xO1xuICB9XG4gIHYxW3Zfb2Zmc2V0ICsgMV0gPSAwO1xuICB2Mlt2X29mZnNldCArIDFdID0gMDtcbiAgdmFyIGRlbHRhID0gdGV4dDFfbGVuZ3RoIC0gdGV4dDJfbGVuZ3RoO1xuICAvLyBJZiB0aGUgdG90YWwgbnVtYmVyIG9mIGNoYXJhY3RlcnMgaXMgb2RkLCB0aGVuIHRoZSBmcm9udCBwYXRoIHdpbGwgY29sbGlkZVxuICAvLyB3aXRoIHRoZSByZXZlcnNlIHBhdGguXG4gIHZhciBmcm9udCA9IChkZWx0YSAlIDIgIT0gMCk7XG4gIC8vIE9mZnNldHMgZm9yIHN0YXJ0IGFuZCBlbmQgb2YgayBsb29wLlxuICAvLyBQcmV2ZW50cyBtYXBwaW5nIG9mIHNwYWNlIGJleW9uZCB0aGUgZ3JpZC5cbiAgdmFyIGsxc3RhcnQgPSAwO1xuICB2YXIgazFlbmQgPSAwO1xuICB2YXIgazJzdGFydCA9IDA7XG4gIHZhciBrMmVuZCA9IDA7XG4gIGZvciAodmFyIGQgPSAwOyBkIDwgbWF4X2Q7IGQrKykge1xuICAgIC8vIFdhbGsgdGhlIGZyb250IHBhdGggb25lIHN0ZXAuXG4gICAgZm9yICh2YXIgazEgPSAtZCArIGsxc3RhcnQ7IGsxIDw9IGQgLSBrMWVuZDsgazEgKz0gMikge1xuICAgICAgdmFyIGsxX29mZnNldCA9IHZfb2Zmc2V0ICsgazE7XG4gICAgICB2YXIgeDE7XG4gICAgICBpZiAoazEgPT0gLWQgfHwgKGsxICE9IGQgJiYgdjFbazFfb2Zmc2V0IC0gMV0gPCB2MVtrMV9vZmZzZXQgKyAxXSkpIHtcbiAgICAgICAgeDEgPSB2MVtrMV9vZmZzZXQgKyAxXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHgxID0gdjFbazFfb2Zmc2V0IC0gMV0gKyAxO1xuICAgICAgfVxuICAgICAgdmFyIHkxID0geDEgLSBrMTtcbiAgICAgIHdoaWxlICh4MSA8IHRleHQxX2xlbmd0aCAmJiB5MSA8IHRleHQyX2xlbmd0aCAmJlxuICAgICAgICAgICAgIHRleHQxLmNoYXJBdCh4MSkgPT0gdGV4dDIuY2hhckF0KHkxKSkge1xuICAgICAgICB4MSsrO1xuICAgICAgICB5MSsrO1xuICAgICAgfVxuICAgICAgdjFbazFfb2Zmc2V0XSA9IHgxO1xuICAgICAgaWYgKHgxID4gdGV4dDFfbGVuZ3RoKSB7XG4gICAgICAgIC8vIFJhbiBvZmYgdGhlIHJpZ2h0IG9mIHRoZSBncmFwaC5cbiAgICAgICAgazFlbmQgKz0gMjtcbiAgICAgIH0gZWxzZSBpZiAoeTEgPiB0ZXh0Ml9sZW5ndGgpIHtcbiAgICAgICAgLy8gUmFuIG9mZiB0aGUgYm90dG9tIG9mIHRoZSBncmFwaC5cbiAgICAgICAgazFzdGFydCArPSAyO1xuICAgICAgfSBlbHNlIGlmIChmcm9udCkge1xuICAgICAgICB2YXIgazJfb2Zmc2V0ID0gdl9vZmZzZXQgKyBkZWx0YSAtIGsxO1xuICAgICAgICBpZiAoazJfb2Zmc2V0ID49IDAgJiYgazJfb2Zmc2V0IDwgdl9sZW5ndGggJiYgdjJbazJfb2Zmc2V0XSAhPSAtMSkge1xuICAgICAgICAgIC8vIE1pcnJvciB4MiBvbnRvIHRvcC1sZWZ0IGNvb3JkaW5hdGUgc3lzdGVtLlxuICAgICAgICAgIHZhciB4MiA9IHRleHQxX2xlbmd0aCAtIHYyW2syX29mZnNldF07XG4gICAgICAgICAgaWYgKHgxID49IHgyKSB7XG4gICAgICAgICAgICAvLyBPdmVybGFwIGRldGVjdGVkLlxuICAgICAgICAgICAgcmV0dXJuIGRpZmZfYmlzZWN0U3BsaXRfKHRleHQxLCB0ZXh0MiwgeDEsIHkxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBXYWxrIHRoZSByZXZlcnNlIHBhdGggb25lIHN0ZXAuXG4gICAgZm9yICh2YXIgazIgPSAtZCArIGsyc3RhcnQ7IGsyIDw9IGQgLSBrMmVuZDsgazIgKz0gMikge1xuICAgICAgdmFyIGsyX29mZnNldCA9IHZfb2Zmc2V0ICsgazI7XG4gICAgICB2YXIgeDI7XG4gICAgICBpZiAoazIgPT0gLWQgfHwgKGsyICE9IGQgJiYgdjJbazJfb2Zmc2V0IC0gMV0gPCB2MltrMl9vZmZzZXQgKyAxXSkpIHtcbiAgICAgICAgeDIgPSB2MltrMl9vZmZzZXQgKyAxXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHgyID0gdjJbazJfb2Zmc2V0IC0gMV0gKyAxO1xuICAgICAgfVxuICAgICAgdmFyIHkyID0geDIgLSBrMjtcbiAgICAgIHdoaWxlICh4MiA8IHRleHQxX2xlbmd0aCAmJiB5MiA8IHRleHQyX2xlbmd0aCAmJlxuICAgICAgICAgICAgIHRleHQxLmNoYXJBdCh0ZXh0MV9sZW5ndGggLSB4MiAtIDEpID09XG4gICAgICAgICAgICAgdGV4dDIuY2hhckF0KHRleHQyX2xlbmd0aCAtIHkyIC0gMSkpIHtcbiAgICAgICAgeDIrKztcbiAgICAgICAgeTIrKztcbiAgICAgIH1cbiAgICAgIHYyW2syX29mZnNldF0gPSB4MjtcbiAgICAgIGlmICh4MiA+IHRleHQxX2xlbmd0aCkge1xuICAgICAgICAvLyBSYW4gb2ZmIHRoZSBsZWZ0IG9mIHRoZSBncmFwaC5cbiAgICAgICAgazJlbmQgKz0gMjtcbiAgICAgIH0gZWxzZSBpZiAoeTIgPiB0ZXh0Ml9sZW5ndGgpIHtcbiAgICAgICAgLy8gUmFuIG9mZiB0aGUgdG9wIG9mIHRoZSBncmFwaC5cbiAgICAgICAgazJzdGFydCArPSAyO1xuICAgICAgfSBlbHNlIGlmICghZnJvbnQpIHtcbiAgICAgICAgdmFyIGsxX29mZnNldCA9IHZfb2Zmc2V0ICsgZGVsdGEgLSBrMjtcbiAgICAgICAgaWYgKGsxX29mZnNldCA+PSAwICYmIGsxX29mZnNldCA8IHZfbGVuZ3RoICYmIHYxW2sxX29mZnNldF0gIT0gLTEpIHtcbiAgICAgICAgICB2YXIgeDEgPSB2MVtrMV9vZmZzZXRdO1xuICAgICAgICAgIHZhciB5MSA9IHZfb2Zmc2V0ICsgeDEgLSBrMV9vZmZzZXQ7XG4gICAgICAgICAgLy8gTWlycm9yIHgyIG9udG8gdG9wLWxlZnQgY29vcmRpbmF0ZSBzeXN0ZW0uXG4gICAgICAgICAgeDIgPSB0ZXh0MV9sZW5ndGggLSB4MjtcbiAgICAgICAgICBpZiAoeDEgPj0geDIpIHtcbiAgICAgICAgICAgIC8vIE92ZXJsYXAgZGV0ZWN0ZWQuXG4gICAgICAgICAgICByZXR1cm4gZGlmZl9iaXNlY3RTcGxpdF8odGV4dDEsIHRleHQyLCB4MSwgeTEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICAvLyBEaWZmIHRvb2sgdG9vIGxvbmcgYW5kIGhpdCB0aGUgZGVhZGxpbmUgb3JcbiAgLy8gbnVtYmVyIG9mIGRpZmZzIGVxdWFscyBudW1iZXIgb2YgY2hhcmFjdGVycywgbm8gY29tbW9uYWxpdHkgYXQgYWxsLlxuICByZXR1cm4gW1tESUZGX0RFTEVURSwgdGV4dDFdLCBbRElGRl9JTlNFUlQsIHRleHQyXV07XG59O1xuXG5cbi8qKlxuICogR2l2ZW4gdGhlIGxvY2F0aW9uIG9mIHRoZSAnbWlkZGxlIHNuYWtlJywgc3BsaXQgdGhlIGRpZmYgaW4gdHdvIHBhcnRzXG4gKiBhbmQgcmVjdXJzZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBPbGQgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAqIEBwYXJhbSB7bnVtYmVyfSB4IEluZGV4IG9mIHNwbGl0IHBvaW50IGluIHRleHQxLlxuICogQHBhcmFtIHtudW1iZXJ9IHkgSW5kZXggb2Ygc3BsaXQgcG9pbnQgaW4gdGV4dDIuXG4gKiBAcmV0dXJuIHtBcnJheX0gQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG4gKi9cbmZ1bmN0aW9uIGRpZmZfYmlzZWN0U3BsaXRfKHRleHQxLCB0ZXh0MiwgeCwgeSkge1xuICB2YXIgdGV4dDFhID0gdGV4dDEuc3Vic3RyaW5nKDAsIHgpO1xuICB2YXIgdGV4dDJhID0gdGV4dDIuc3Vic3RyaW5nKDAsIHkpO1xuICB2YXIgdGV4dDFiID0gdGV4dDEuc3Vic3RyaW5nKHgpO1xuICB2YXIgdGV4dDJiID0gdGV4dDIuc3Vic3RyaW5nKHkpO1xuXG4gIC8vIENvbXB1dGUgYm90aCBkaWZmcyBzZXJpYWxseS5cbiAgdmFyIGRpZmZzID0gZGlmZl9tYWluKHRleHQxYSwgdGV4dDJhKTtcbiAgdmFyIGRpZmZzYiA9IGRpZmZfbWFpbih0ZXh0MWIsIHRleHQyYik7XG5cbiAgcmV0dXJuIGRpZmZzLmNvbmNhdChkaWZmc2IpO1xufTtcblxuXG4vKipcbiAqIERldGVybWluZSB0aGUgY29tbW9uIHByZWZpeCBvZiB0d28gc3RyaW5ncy5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBGaXJzdCBzdHJpbmcuXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgU2Vjb25kIHN0cmluZy5cbiAqIEByZXR1cm4ge251bWJlcn0gVGhlIG51bWJlciBvZiBjaGFyYWN0ZXJzIGNvbW1vbiB0byB0aGUgc3RhcnQgb2YgZWFjaFxuICogICAgIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gZGlmZl9jb21tb25QcmVmaXgodGV4dDEsIHRleHQyKSB7XG4gIC8vIFF1aWNrIGNoZWNrIGZvciBjb21tb24gbnVsbCBjYXNlcy5cbiAgaWYgKCF0ZXh0MSB8fCAhdGV4dDIgfHwgdGV4dDEuY2hhckF0KDApICE9IHRleHQyLmNoYXJBdCgwKSkge1xuICAgIHJldHVybiAwO1xuICB9XG4gIC8vIEJpbmFyeSBzZWFyY2guXG4gIC8vIFBlcmZvcm1hbmNlIGFuYWx5c2lzOiBodHRwOi8vbmVpbC5mcmFzZXIubmFtZS9uZXdzLzIwMDcvMTAvMDkvXG4gIHZhciBwb2ludGVybWluID0gMDtcbiAgdmFyIHBvaW50ZXJtYXggPSBNYXRoLm1pbih0ZXh0MS5sZW5ndGgsIHRleHQyLmxlbmd0aCk7XG4gIHZhciBwb2ludGVybWlkID0gcG9pbnRlcm1heDtcbiAgdmFyIHBvaW50ZXJzdGFydCA9IDA7XG4gIHdoaWxlIChwb2ludGVybWluIDwgcG9pbnRlcm1pZCkge1xuICAgIGlmICh0ZXh0MS5zdWJzdHJpbmcocG9pbnRlcnN0YXJ0LCBwb2ludGVybWlkKSA9PVxuICAgICAgICB0ZXh0Mi5zdWJzdHJpbmcocG9pbnRlcnN0YXJ0LCBwb2ludGVybWlkKSkge1xuICAgICAgcG9pbnRlcm1pbiA9IHBvaW50ZXJtaWQ7XG4gICAgICBwb2ludGVyc3RhcnQgPSBwb2ludGVybWluO1xuICAgIH0gZWxzZSB7XG4gICAgICBwb2ludGVybWF4ID0gcG9pbnRlcm1pZDtcbiAgICB9XG4gICAgcG9pbnRlcm1pZCA9IE1hdGguZmxvb3IoKHBvaW50ZXJtYXggLSBwb2ludGVybWluKSAvIDIgKyBwb2ludGVybWluKTtcbiAgfVxuICByZXR1cm4gcG9pbnRlcm1pZDtcbn07XG5cblxuLyoqXG4gKiBEZXRlcm1pbmUgdGhlIGNvbW1vbiBzdWZmaXggb2YgdHdvIHN0cmluZ3MuXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgRmlyc3Qgc3RyaW5nLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIFNlY29uZCBzdHJpbmcuXG4gKiBAcmV0dXJuIHtudW1iZXJ9IFRoZSBudW1iZXIgb2YgY2hhcmFjdGVycyBjb21tb24gdG8gdGhlIGVuZCBvZiBlYWNoIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gZGlmZl9jb21tb25TdWZmaXgodGV4dDEsIHRleHQyKSB7XG4gIC8vIFF1aWNrIGNoZWNrIGZvciBjb21tb24gbnVsbCBjYXNlcy5cbiAgaWYgKCF0ZXh0MSB8fCAhdGV4dDIgfHxcbiAgICAgIHRleHQxLmNoYXJBdCh0ZXh0MS5sZW5ndGggLSAxKSAhPSB0ZXh0Mi5jaGFyQXQodGV4dDIubGVuZ3RoIC0gMSkpIHtcbiAgICByZXR1cm4gMDtcbiAgfVxuICAvLyBCaW5hcnkgc2VhcmNoLlxuICAvLyBQZXJmb3JtYW5jZSBhbmFseXNpczogaHR0cDovL25laWwuZnJhc2VyLm5hbWUvbmV3cy8yMDA3LzEwLzA5L1xuICB2YXIgcG9pbnRlcm1pbiA9IDA7XG4gIHZhciBwb2ludGVybWF4ID0gTWF0aC5taW4odGV4dDEubGVuZ3RoLCB0ZXh0Mi5sZW5ndGgpO1xuICB2YXIgcG9pbnRlcm1pZCA9IHBvaW50ZXJtYXg7XG4gIHZhciBwb2ludGVyZW5kID0gMDtcbiAgd2hpbGUgKHBvaW50ZXJtaW4gPCBwb2ludGVybWlkKSB7XG4gICAgaWYgKHRleHQxLnN1YnN0cmluZyh0ZXh0MS5sZW5ndGggLSBwb2ludGVybWlkLCB0ZXh0MS5sZW5ndGggLSBwb2ludGVyZW5kKSA9PVxuICAgICAgICB0ZXh0Mi5zdWJzdHJpbmcodGV4dDIubGVuZ3RoIC0gcG9pbnRlcm1pZCwgdGV4dDIubGVuZ3RoIC0gcG9pbnRlcmVuZCkpIHtcbiAgICAgIHBvaW50ZXJtaW4gPSBwb2ludGVybWlkO1xuICAgICAgcG9pbnRlcmVuZCA9IHBvaW50ZXJtaW47XG4gICAgfSBlbHNlIHtcbiAgICAgIHBvaW50ZXJtYXggPSBwb2ludGVybWlkO1xuICAgIH1cbiAgICBwb2ludGVybWlkID0gTWF0aC5mbG9vcigocG9pbnRlcm1heCAtIHBvaW50ZXJtaW4pIC8gMiArIHBvaW50ZXJtaW4pO1xuICB9XG4gIHJldHVybiBwb2ludGVybWlkO1xufTtcblxuXG4vKipcbiAqIERvIHRoZSB0d28gdGV4dHMgc2hhcmUgYSBzdWJzdHJpbmcgd2hpY2ggaXMgYXQgbGVhc3QgaGFsZiB0aGUgbGVuZ3RoIG9mIHRoZVxuICogbG9uZ2VyIHRleHQ/XG4gKiBUaGlzIHNwZWVkdXAgY2FuIHByb2R1Y2Ugbm9uLW1pbmltYWwgZGlmZnMuXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgRmlyc3Qgc3RyaW5nLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIFNlY29uZCBzdHJpbmcuXG4gKiBAcmV0dXJuIHtBcnJheS48c3RyaW5nPn0gRml2ZSBlbGVtZW50IEFycmF5LCBjb250YWluaW5nIHRoZSBwcmVmaXggb2ZcbiAqICAgICB0ZXh0MSwgdGhlIHN1ZmZpeCBvZiB0ZXh0MSwgdGhlIHByZWZpeCBvZiB0ZXh0MiwgdGhlIHN1ZmZpeCBvZlxuICogICAgIHRleHQyIGFuZCB0aGUgY29tbW9uIG1pZGRsZS4gIE9yIG51bGwgaWYgdGhlcmUgd2FzIG5vIG1hdGNoLlxuICovXG5mdW5jdGlvbiBkaWZmX2hhbGZNYXRjaF8odGV4dDEsIHRleHQyKSB7XG4gIHZhciBsb25ndGV4dCA9IHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCA/IHRleHQxIDogdGV4dDI7XG4gIHZhciBzaG9ydHRleHQgPSB0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGggPyB0ZXh0MiA6IHRleHQxO1xuICBpZiAobG9uZ3RleHQubGVuZ3RoIDwgNCB8fCBzaG9ydHRleHQubGVuZ3RoICogMiA8IGxvbmd0ZXh0Lmxlbmd0aCkge1xuICAgIHJldHVybiBudWxsOyAgLy8gUG9pbnRsZXNzLlxuICB9XG5cbiAgLyoqXG4gICAqIERvZXMgYSBzdWJzdHJpbmcgb2Ygc2hvcnR0ZXh0IGV4aXN0IHdpdGhpbiBsb25ndGV4dCBzdWNoIHRoYXQgdGhlIHN1YnN0cmluZ1xuICAgKiBpcyBhdCBsZWFzdCBoYWxmIHRoZSBsZW5ndGggb2YgbG9uZ3RleHQ/XG4gICAqIENsb3N1cmUsIGJ1dCBkb2VzIG5vdCByZWZlcmVuY2UgYW55IGV4dGVybmFsIHZhcmlhYmxlcy5cbiAgICogQHBhcmFtIHtzdHJpbmd9IGxvbmd0ZXh0IExvbmdlciBzdHJpbmcuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBzaG9ydHRleHQgU2hvcnRlciBzdHJpbmcuXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBpIFN0YXJ0IGluZGV4IG9mIHF1YXJ0ZXIgbGVuZ3RoIHN1YnN0cmluZyB3aXRoaW4gbG9uZ3RleHQuXG4gICAqIEByZXR1cm4ge0FycmF5LjxzdHJpbmc+fSBGaXZlIGVsZW1lbnQgQXJyYXksIGNvbnRhaW5pbmcgdGhlIHByZWZpeCBvZlxuICAgKiAgICAgbG9uZ3RleHQsIHRoZSBzdWZmaXggb2YgbG9uZ3RleHQsIHRoZSBwcmVmaXggb2Ygc2hvcnR0ZXh0LCB0aGUgc3VmZml4XG4gICAqICAgICBvZiBzaG9ydHRleHQgYW5kIHRoZSBjb21tb24gbWlkZGxlLiAgT3IgbnVsbCBpZiB0aGVyZSB3YXMgbm8gbWF0Y2guXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBmdW5jdGlvbiBkaWZmX2hhbGZNYXRjaElfKGxvbmd0ZXh0LCBzaG9ydHRleHQsIGkpIHtcbiAgICAvLyBTdGFydCB3aXRoIGEgMS80IGxlbmd0aCBzdWJzdHJpbmcgYXQgcG9zaXRpb24gaSBhcyBhIHNlZWQuXG4gICAgdmFyIHNlZWQgPSBsb25ndGV4dC5zdWJzdHJpbmcoaSwgaSArIE1hdGguZmxvb3IobG9uZ3RleHQubGVuZ3RoIC8gNCkpO1xuICAgIHZhciBqID0gLTE7XG4gICAgdmFyIGJlc3RfY29tbW9uID0gJyc7XG4gICAgdmFyIGJlc3RfbG9uZ3RleHRfYSwgYmVzdF9sb25ndGV4dF9iLCBiZXN0X3Nob3J0dGV4dF9hLCBiZXN0X3Nob3J0dGV4dF9iO1xuICAgIHdoaWxlICgoaiA9IHNob3J0dGV4dC5pbmRleE9mKHNlZWQsIGogKyAxKSkgIT0gLTEpIHtcbiAgICAgIHZhciBwcmVmaXhMZW5ndGggPSBkaWZmX2NvbW1vblByZWZpeChsb25ndGV4dC5zdWJzdHJpbmcoaSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hvcnR0ZXh0LnN1YnN0cmluZyhqKSk7XG4gICAgICB2YXIgc3VmZml4TGVuZ3RoID0gZGlmZl9jb21tb25TdWZmaXgobG9uZ3RleHQuc3Vic3RyaW5nKDAsIGkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNob3J0dGV4dC5zdWJzdHJpbmcoMCwgaikpO1xuICAgICAgaWYgKGJlc3RfY29tbW9uLmxlbmd0aCA8IHN1ZmZpeExlbmd0aCArIHByZWZpeExlbmd0aCkge1xuICAgICAgICBiZXN0X2NvbW1vbiA9IHNob3J0dGV4dC5zdWJzdHJpbmcoaiAtIHN1ZmZpeExlbmd0aCwgaikgK1xuICAgICAgICAgICAgc2hvcnR0ZXh0LnN1YnN0cmluZyhqLCBqICsgcHJlZml4TGVuZ3RoKTtcbiAgICAgICAgYmVzdF9sb25ndGV4dF9hID0gbG9uZ3RleHQuc3Vic3RyaW5nKDAsIGkgLSBzdWZmaXhMZW5ndGgpO1xuICAgICAgICBiZXN0X2xvbmd0ZXh0X2IgPSBsb25ndGV4dC5zdWJzdHJpbmcoaSArIHByZWZpeExlbmd0aCk7XG4gICAgICAgIGJlc3Rfc2hvcnR0ZXh0X2EgPSBzaG9ydHRleHQuc3Vic3RyaW5nKDAsIGogLSBzdWZmaXhMZW5ndGgpO1xuICAgICAgICBiZXN0X3Nob3J0dGV4dF9iID0gc2hvcnR0ZXh0LnN1YnN0cmluZyhqICsgcHJlZml4TGVuZ3RoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGJlc3RfY29tbW9uLmxlbmd0aCAqIDIgPj0gbG9uZ3RleHQubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gW2Jlc3RfbG9uZ3RleHRfYSwgYmVzdF9sb25ndGV4dF9iLFxuICAgICAgICAgICAgICBiZXN0X3Nob3J0dGV4dF9hLCBiZXN0X3Nob3J0dGV4dF9iLCBiZXN0X2NvbW1vbl07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8vIEZpcnN0IGNoZWNrIGlmIHRoZSBzZWNvbmQgcXVhcnRlciBpcyB0aGUgc2VlZCBmb3IgYSBoYWxmLW1hdGNoLlxuICB2YXIgaG0xID0gZGlmZl9oYWxmTWF0Y2hJXyhsb25ndGV4dCwgc2hvcnR0ZXh0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLmNlaWwobG9uZ3RleHQubGVuZ3RoIC8gNCkpO1xuICAvLyBDaGVjayBhZ2FpbiBiYXNlZCBvbiB0aGUgdGhpcmQgcXVhcnRlci5cbiAgdmFyIGhtMiA9IGRpZmZfaGFsZk1hdGNoSV8obG9uZ3RleHQsIHNob3J0dGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5jZWlsKGxvbmd0ZXh0Lmxlbmd0aCAvIDIpKTtcbiAgdmFyIGhtO1xuICBpZiAoIWhtMSAmJiAhaG0yKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0gZWxzZSBpZiAoIWhtMikge1xuICAgIGhtID0gaG0xO1xuICB9IGVsc2UgaWYgKCFobTEpIHtcbiAgICBobSA9IGhtMjtcbiAgfSBlbHNlIHtcbiAgICAvLyBCb3RoIG1hdGNoZWQuICBTZWxlY3QgdGhlIGxvbmdlc3QuXG4gICAgaG0gPSBobTFbNF0ubGVuZ3RoID4gaG0yWzRdLmxlbmd0aCA/IGhtMSA6IGhtMjtcbiAgfVxuXG4gIC8vIEEgaGFsZi1tYXRjaCB3YXMgZm91bmQsIHNvcnQgb3V0IHRoZSByZXR1cm4gZGF0YS5cbiAgdmFyIHRleHQxX2EsIHRleHQxX2IsIHRleHQyX2EsIHRleHQyX2I7XG4gIGlmICh0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGgpIHtcbiAgICB0ZXh0MV9hID0gaG1bMF07XG4gICAgdGV4dDFfYiA9IGhtWzFdO1xuICAgIHRleHQyX2EgPSBobVsyXTtcbiAgICB0ZXh0Ml9iID0gaG1bM107XG4gIH0gZWxzZSB7XG4gICAgdGV4dDJfYSA9IGhtWzBdO1xuICAgIHRleHQyX2IgPSBobVsxXTtcbiAgICB0ZXh0MV9hID0gaG1bMl07XG4gICAgdGV4dDFfYiA9IGhtWzNdO1xuICB9XG4gIHZhciBtaWRfY29tbW9uID0gaG1bNF07XG4gIHJldHVybiBbdGV4dDFfYSwgdGV4dDFfYiwgdGV4dDJfYSwgdGV4dDJfYiwgbWlkX2NvbW1vbl07XG59O1xuXG5cbi8qKlxuICogUmVvcmRlciBhbmQgbWVyZ2UgbGlrZSBlZGl0IHNlY3Rpb25zLiAgTWVyZ2UgZXF1YWxpdGllcy5cbiAqIEFueSBlZGl0IHNlY3Rpb24gY2FuIG1vdmUgYXMgbG9uZyBhcyBpdCBkb2Vzbid0IGNyb3NzIGFuIGVxdWFsaXR5LlxuICogQHBhcmFtIHtBcnJheX0gZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG4gKi9cbmZ1bmN0aW9uIGRpZmZfY2xlYW51cE1lcmdlKGRpZmZzKSB7XG4gIGRpZmZzLnB1c2goW0RJRkZfRVFVQUwsICcnXSk7ICAvLyBBZGQgYSBkdW1teSBlbnRyeSBhdCB0aGUgZW5kLlxuICB2YXIgcG9pbnRlciA9IDA7XG4gIHZhciBjb3VudF9kZWxldGUgPSAwO1xuICB2YXIgY291bnRfaW5zZXJ0ID0gMDtcbiAgdmFyIHRleHRfZGVsZXRlID0gJyc7XG4gIHZhciB0ZXh0X2luc2VydCA9ICcnO1xuICB2YXIgY29tbW9ubGVuZ3RoO1xuICB3aGlsZSAocG9pbnRlciA8IGRpZmZzLmxlbmd0aCkge1xuICAgIHN3aXRjaCAoZGlmZnNbcG9pbnRlcl1bMF0pIHtcbiAgICAgIGNhc2UgRElGRl9JTlNFUlQ6XG4gICAgICAgIGNvdW50X2luc2VydCsrO1xuICAgICAgICB0ZXh0X2luc2VydCArPSBkaWZmc1twb2ludGVyXVsxXTtcbiAgICAgICAgcG9pbnRlcisrO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRElGRl9ERUxFVEU6XG4gICAgICAgIGNvdW50X2RlbGV0ZSsrO1xuICAgICAgICB0ZXh0X2RlbGV0ZSArPSBkaWZmc1twb2ludGVyXVsxXTtcbiAgICAgICAgcG9pbnRlcisrO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRElGRl9FUVVBTDpcbiAgICAgICAgLy8gVXBvbiByZWFjaGluZyBhbiBlcXVhbGl0eSwgY2hlY2sgZm9yIHByaW9yIHJlZHVuZGFuY2llcy5cbiAgICAgICAgaWYgKGNvdW50X2RlbGV0ZSArIGNvdW50X2luc2VydCA+IDEpIHtcbiAgICAgICAgICBpZiAoY291bnRfZGVsZXRlICE9PSAwICYmIGNvdW50X2luc2VydCAhPT0gMCkge1xuICAgICAgICAgICAgLy8gRmFjdG9yIG91dCBhbnkgY29tbW9uIHByZWZpeGllcy5cbiAgICAgICAgICAgIGNvbW1vbmxlbmd0aCA9IGRpZmZfY29tbW9uUHJlZml4KHRleHRfaW5zZXJ0LCB0ZXh0X2RlbGV0ZSk7XG4gICAgICAgICAgICBpZiAoY29tbW9ubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgICAgICAgIGlmICgocG9pbnRlciAtIGNvdW50X2RlbGV0ZSAtIGNvdW50X2luc2VydCkgPiAwICYmXG4gICAgICAgICAgICAgICAgICBkaWZmc1twb2ludGVyIC0gY291bnRfZGVsZXRlIC0gY291bnRfaW5zZXJ0IC0gMV1bMF0gPT1cbiAgICAgICAgICAgICAgICAgIERJRkZfRVFVQUwpIHtcbiAgICAgICAgICAgICAgICBkaWZmc1twb2ludGVyIC0gY291bnRfZGVsZXRlIC0gY291bnRfaW5zZXJ0IC0gMV1bMV0gKz1cbiAgICAgICAgICAgICAgICAgICAgdGV4dF9pbnNlcnQuc3Vic3RyaW5nKDAsIGNvbW1vbmxlbmd0aCk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGlmZnMuc3BsaWNlKDAsIDAsIFtESUZGX0VRVUFMLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4dF9pbnNlcnQuc3Vic3RyaW5nKDAsIGNvbW1vbmxlbmd0aCldKTtcbiAgICAgICAgICAgICAgICBwb2ludGVyKys7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdGV4dF9pbnNlcnQgPSB0ZXh0X2luc2VydC5zdWJzdHJpbmcoY29tbW9ubGVuZ3RoKTtcbiAgICAgICAgICAgICAgdGV4dF9kZWxldGUgPSB0ZXh0X2RlbGV0ZS5zdWJzdHJpbmcoY29tbW9ubGVuZ3RoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEZhY3RvciBvdXQgYW55IGNvbW1vbiBzdWZmaXhpZXMuXG4gICAgICAgICAgICBjb21tb25sZW5ndGggPSBkaWZmX2NvbW1vblN1ZmZpeCh0ZXh0X2luc2VydCwgdGV4dF9kZWxldGUpO1xuICAgICAgICAgICAgaWYgKGNvbW1vbmxlbmd0aCAhPT0gMCkge1xuICAgICAgICAgICAgICBkaWZmc1twb2ludGVyXVsxXSA9IHRleHRfaW5zZXJ0LnN1YnN0cmluZyh0ZXh0X2luc2VydC5sZW5ndGggLVxuICAgICAgICAgICAgICAgICAgY29tbW9ubGVuZ3RoKSArIGRpZmZzW3BvaW50ZXJdWzFdO1xuICAgICAgICAgICAgICB0ZXh0X2luc2VydCA9IHRleHRfaW5zZXJ0LnN1YnN0cmluZygwLCB0ZXh0X2luc2VydC5sZW5ndGggLVxuICAgICAgICAgICAgICAgICAgY29tbW9ubGVuZ3RoKTtcbiAgICAgICAgICAgICAgdGV4dF9kZWxldGUgPSB0ZXh0X2RlbGV0ZS5zdWJzdHJpbmcoMCwgdGV4dF9kZWxldGUubGVuZ3RoIC1cbiAgICAgICAgICAgICAgICAgIGNvbW1vbmxlbmd0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIERlbGV0ZSB0aGUgb2ZmZW5kaW5nIHJlY29yZHMgYW5kIGFkZCB0aGUgbWVyZ2VkIG9uZXMuXG4gICAgICAgICAgaWYgKGNvdW50X2RlbGV0ZSA9PT0gMCkge1xuICAgICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgLSBjb3VudF9pbnNlcnQsXG4gICAgICAgICAgICAgICAgY291bnRfZGVsZXRlICsgY291bnRfaW5zZXJ0LCBbRElGRl9JTlNFUlQsIHRleHRfaW5zZXJ0XSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChjb3VudF9pbnNlcnQgPT09IDApIHtcbiAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyIC0gY291bnRfZGVsZXRlLFxuICAgICAgICAgICAgICAgIGNvdW50X2RlbGV0ZSArIGNvdW50X2luc2VydCwgW0RJRkZfREVMRVRFLCB0ZXh0X2RlbGV0ZV0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciAtIGNvdW50X2RlbGV0ZSAtIGNvdW50X2luc2VydCxcbiAgICAgICAgICAgICAgICBjb3VudF9kZWxldGUgKyBjb3VudF9pbnNlcnQsIFtESUZGX0RFTEVURSwgdGV4dF9kZWxldGVdLFxuICAgICAgICAgICAgICAgIFtESUZGX0lOU0VSVCwgdGV4dF9pbnNlcnRdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcG9pbnRlciA9IHBvaW50ZXIgLSBjb3VudF9kZWxldGUgLSBjb3VudF9pbnNlcnQgK1xuICAgICAgICAgICAgICAgICAgICAoY291bnRfZGVsZXRlID8gMSA6IDApICsgKGNvdW50X2luc2VydCA/IDEgOiAwKSArIDE7XG4gICAgICAgIH0gZWxzZSBpZiAocG9pbnRlciAhPT0gMCAmJiBkaWZmc1twb2ludGVyIC0gMV1bMF0gPT0gRElGRl9FUVVBTCkge1xuICAgICAgICAgIC8vIE1lcmdlIHRoaXMgZXF1YWxpdHkgd2l0aCB0aGUgcHJldmlvdXMgb25lLlxuICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSAxXVsxXSArPSBkaWZmc1twb2ludGVyXVsxXTtcbiAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciwgMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcG9pbnRlcisrO1xuICAgICAgICB9XG4gICAgICAgIGNvdW50X2luc2VydCA9IDA7XG4gICAgICAgIGNvdW50X2RlbGV0ZSA9IDA7XG4gICAgICAgIHRleHRfZGVsZXRlID0gJyc7XG4gICAgICAgIHRleHRfaW5zZXJ0ID0gJyc7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICBpZiAoZGlmZnNbZGlmZnMubGVuZ3RoIC0gMV1bMV0gPT09ICcnKSB7XG4gICAgZGlmZnMucG9wKCk7ICAvLyBSZW1vdmUgdGhlIGR1bW15IGVudHJ5IGF0IHRoZSBlbmQuXG4gIH1cblxuICAvLyBTZWNvbmQgcGFzczogbG9vayBmb3Igc2luZ2xlIGVkaXRzIHN1cnJvdW5kZWQgb24gYm90aCBzaWRlcyBieSBlcXVhbGl0aWVzXG4gIC8vIHdoaWNoIGNhbiBiZSBzaGlmdGVkIHNpZGV3YXlzIHRvIGVsaW1pbmF0ZSBhbiBlcXVhbGl0eS5cbiAgLy8gZS5nOiBBPGlucz5CQTwvaW5zPkMgLT4gPGlucz5BQjwvaW5zPkFDXG4gIHZhciBjaGFuZ2VzID0gZmFsc2U7XG4gIHBvaW50ZXIgPSAxO1xuICAvLyBJbnRlbnRpb25hbGx5IGlnbm9yZSB0aGUgZmlyc3QgYW5kIGxhc3QgZWxlbWVudCAoZG9uJ3QgbmVlZCBjaGVja2luZykuXG4gIHdoaWxlIChwb2ludGVyIDwgZGlmZnMubGVuZ3RoIC0gMSkge1xuICAgIGlmIChkaWZmc1twb2ludGVyIC0gMV1bMF0gPT0gRElGRl9FUVVBTCAmJlxuICAgICAgICBkaWZmc1twb2ludGVyICsgMV1bMF0gPT0gRElGRl9FUVVBTCkge1xuICAgICAgLy8gVGhpcyBpcyBhIHNpbmdsZSBlZGl0IHN1cnJvdW5kZWQgYnkgZXF1YWxpdGllcy5cbiAgICAgIGlmIChkaWZmc1twb2ludGVyXVsxXS5zdWJzdHJpbmcoZGlmZnNbcG9pbnRlcl1bMV0ubGVuZ3RoIC1cbiAgICAgICAgICBkaWZmc1twb2ludGVyIC0gMV1bMV0ubGVuZ3RoKSA9PSBkaWZmc1twb2ludGVyIC0gMV1bMV0pIHtcbiAgICAgICAgLy8gU2hpZnQgdGhlIGVkaXQgb3ZlciB0aGUgcHJldmlvdXMgZXF1YWxpdHkuXG4gICAgICAgIGRpZmZzW3BvaW50ZXJdWzFdID0gZGlmZnNbcG9pbnRlciAtIDFdWzFdICtcbiAgICAgICAgICAgIGRpZmZzW3BvaW50ZXJdWzFdLnN1YnN0cmluZygwLCBkaWZmc1twb2ludGVyXVsxXS5sZW5ndGggLVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSAxXVsxXS5sZW5ndGgpO1xuICAgICAgICBkaWZmc1twb2ludGVyICsgMV1bMV0gPSBkaWZmc1twb2ludGVyIC0gMV1bMV0gKyBkaWZmc1twb2ludGVyICsgMV1bMV07XG4gICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyIC0gMSwgMSk7XG4gICAgICAgIGNoYW5nZXMgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChkaWZmc1twb2ludGVyXVsxXS5zdWJzdHJpbmcoMCwgZGlmZnNbcG9pbnRlciArIDFdWzFdLmxlbmd0aCkgPT1cbiAgICAgICAgICBkaWZmc1twb2ludGVyICsgMV1bMV0pIHtcbiAgICAgICAgLy8gU2hpZnQgdGhlIGVkaXQgb3ZlciB0aGUgbmV4dCBlcXVhbGl0eS5cbiAgICAgICAgZGlmZnNbcG9pbnRlciAtIDFdWzFdICs9IGRpZmZzW3BvaW50ZXIgKyAxXVsxXTtcbiAgICAgICAgZGlmZnNbcG9pbnRlcl1bMV0gPVxuICAgICAgICAgICAgZGlmZnNbcG9pbnRlcl1bMV0uc3Vic3RyaW5nKGRpZmZzW3BvaW50ZXIgKyAxXVsxXS5sZW5ndGgpICtcbiAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVsxXTtcbiAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgKyAxLCAxKTtcbiAgICAgICAgY2hhbmdlcyA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHBvaW50ZXIrKztcbiAgfVxuICAvLyBJZiBzaGlmdHMgd2VyZSBtYWRlLCB0aGUgZGlmZiBuZWVkcyByZW9yZGVyaW5nIGFuZCBhbm90aGVyIHNoaWZ0IHN3ZWVwLlxuICBpZiAoY2hhbmdlcykge1xuICAgIGRpZmZfY2xlYW51cE1lcmdlKGRpZmZzKTtcbiAgfVxufTtcblxuXG52YXIgZGlmZiA9IGRpZmZfbWFpbjtcbmRpZmYuSU5TRVJUID0gRElGRl9JTlNFUlQ7XG5kaWZmLkRFTEVURSA9IERJRkZfREVMRVRFO1xuZGlmZi5FUVVBTCA9IERJRkZfRVFVQUw7XG5cbm1vZHVsZS5leHBvcnRzID0gZGlmZjtcblxuLypcbiAqIE1vZGlmeSBhIGRpZmYgc3VjaCB0aGF0IHRoZSBjdXJzb3IgcG9zaXRpb24gcG9pbnRzIHRvIHRoZSBzdGFydCBvZiBhIGNoYW5nZTpcbiAqIEUuZy5cbiAqICAgY3Vyc29yX25vcm1hbGl6ZV9kaWZmKFtbRElGRl9FUVVBTCwgJ2FiYyddXSwgMSlcbiAqICAgICA9PiBbMSwgW1tESUZGX0VRVUFMLCAnYSddLCBbRElGRl9FUVVBTCwgJ2JjJ11dXVxuICogICBjdXJzb3Jfbm9ybWFsaXplX2RpZmYoW1tESUZGX0lOU0VSVCwgJ25ldyddLCBbRElGRl9ERUxFVEUsICd4eXonXV0sIDIpXG4gKiAgICAgPT4gWzIsIFtbRElGRl9JTlNFUlQsICduZXcnXSwgW0RJRkZfREVMRVRFLCAneHknXSwgW0RJRkZfREVMRVRFLCAneiddXV1cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlc1xuICogQHBhcmFtIHtJbnR9IGN1cnNvcl9wb3MgU3VnZ2VzdGVkIGVkaXQgcG9zaXRpb24uIE11c3Qgbm90IGJlIG91dCBvZiBib3VuZHMhXG4gKiBAcmV0dXJuIHtBcnJheX0gQSB0dXBsZSBbY3Vyc29yIGxvY2F0aW9uIGluIHRoZSBtb2RpZmllZCBkaWZmLCBtb2RpZmllZCBkaWZmXVxuICovXG5mdW5jdGlvbiBjdXJzb3Jfbm9ybWFsaXplX2RpZmYgKGRpZmZzLCBjdXJzb3JfcG9zKSB7XG4gIGlmIChjdXJzb3JfcG9zID09PSAwKSB7XG4gICAgcmV0dXJuIFtESUZGX0VRVUFMLCBkaWZmc107XG4gIH1cbiAgZm9yICh2YXIgY3VycmVudF9wb3MgPSAwLCBpID0gMDsgaSA8IGRpZmZzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGQgPSBkaWZmc1tpXTtcbiAgICBpZiAoZFswXSA9PT0gRElGRl9ERUxFVEUgfHwgZFswXSA9PT0gRElGRl9FUVVBTCkge1xuICAgICAgdmFyIG5leHRfcG9zID0gY3VycmVudF9wb3MgKyBkWzFdLmxlbmd0aDtcbiAgICAgIGlmIChjdXJzb3JfcG9zID09PSBuZXh0X3Bvcykge1xuICAgICAgICByZXR1cm4gW2kgKyAxLCBkaWZmc107XG4gICAgICB9IGVsc2UgaWYgKGN1cnNvcl9wb3MgPCBuZXh0X3Bvcykge1xuICAgICAgICAvLyBjb3B5IHRvIHByZXZlbnQgc2lkZSBlZmZlY3RzXG4gICAgICAgIGRpZmZzID0gZGlmZnMuc2xpY2UoKTtcbiAgICAgICAgLy8gc3BsaXQgZCBpbnRvIHR3byBkaWZmIGNoYW5nZXNcbiAgICAgICAgdmFyIHNwbGl0X3BvcyA9IGN1cnNvcl9wb3MgLSBjdXJyZW50X3BvcztcbiAgICAgICAgdmFyIGRfbGVmdCA9IFtkWzBdLCBkWzFdLnNsaWNlKDAsIHNwbGl0X3BvcyldO1xuICAgICAgICB2YXIgZF9yaWdodCA9IFtkWzBdLCBkWzFdLnNsaWNlKHNwbGl0X3BvcyldO1xuICAgICAgICBkaWZmcy5zcGxpY2UoaSwgMSwgZF9sZWZ0LCBkX3JpZ2h0KTtcbiAgICAgICAgcmV0dXJuIFtpICsgMSwgZGlmZnNdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3VycmVudF9wb3MgPSBuZXh0X3BvcztcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKCdjdXJzb3JfcG9zIGlzIG91dCBvZiBib3VuZHMhJylcbn1cblxuLypcbiAqIE1vZGlmeSBhIGRpZmYgc3VjaCB0aGF0IHRoZSBlZGl0IHBvc2l0aW9uIGlzIFwic2hpZnRlZFwiIHRvIHRoZSBwcm9wb3NlZCBlZGl0IGxvY2F0aW9uIChjdXJzb3JfcG9zaXRpb24pLlxuICpcbiAqIENhc2UgMSlcbiAqICAgQ2hlY2sgaWYgYSBuYWl2ZSBzaGlmdCBpcyBwb3NzaWJsZTpcbiAqICAgICBbMCwgWF0sIFsgMSwgWV0gLT4gWyAxLCBZXSwgWzAsIFhdICAgIChpZiBYICsgWSA9PT0gWSArIFgpXG4gKiAgICAgWzAsIFhdLCBbLTEsIFldIC0+IFstMSwgWV0sIFswLCBYXSAgICAoaWYgWCArIFkgPT09IFkgKyBYKSAtIGhvbGRzIHNhbWUgcmVzdWx0XG4gKiBDYXNlIDIpXG4gKiAgIENoZWNrIGlmIHRoZSBmb2xsb3dpbmcgc2hpZnRzIGFyZSBwb3NzaWJsZTpcbiAqICAgICBbMCwgJ3ByZSddLCBbIDEsICdwcmVmaXgnXSAtPiBbIDEsICdwcmUnXSwgWzAsICdwcmUnXSwgWyAxLCAnZml4J11cbiAqICAgICBbMCwgJ3ByZSddLCBbLTEsICdwcmVmaXgnXSAtPiBbLTEsICdwcmUnXSwgWzAsICdwcmUnXSwgWy0xLCAnZml4J11cbiAqICAgICAgICAgXiAgICAgICAgICAgIF5cbiAqICAgICAgICAgZCAgICAgICAgICBkX25leHRcbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlc1xuICogQHBhcmFtIHtJbnR9IGN1cnNvcl9wb3MgU3VnZ2VzdGVkIGVkaXQgcG9zaXRpb24uIE11c3Qgbm90IGJlIG91dCBvZiBib3VuZHMhXG4gKiBAcmV0dXJuIHtBcnJheX0gQXJyYXkgb2YgZGlmZiB0dXBsZXNcbiAqL1xuZnVuY3Rpb24gZml4X2N1cnNvciAoZGlmZnMsIGN1cnNvcl9wb3MpIHtcbiAgdmFyIG5vcm0gPSBjdXJzb3Jfbm9ybWFsaXplX2RpZmYoZGlmZnMsIGN1cnNvcl9wb3MpO1xuICB2YXIgbmRpZmZzID0gbm9ybVsxXTtcbiAgdmFyIGN1cnNvcl9wb2ludGVyID0gbm9ybVswXTtcbiAgdmFyIGQgPSBuZGlmZnNbY3Vyc29yX3BvaW50ZXJdO1xuICB2YXIgZF9uZXh0ID0gbmRpZmZzW2N1cnNvcl9wb2ludGVyICsgMV07XG5cbiAgaWYgKGQgPT0gbnVsbCkge1xuICAgIC8vIFRleHQgd2FzIGRlbGV0ZWQgZnJvbSBlbmQgb2Ygb3JpZ2luYWwgc3RyaW5nLFxuICAgIC8vIGN1cnNvciBpcyBub3cgb3V0IG9mIGJvdW5kcyBpbiBuZXcgc3RyaW5nXG4gICAgcmV0dXJuIGRpZmZzO1xuICB9IGVsc2UgaWYgKGRbMF0gIT09IERJRkZfRVFVQUwpIHtcbiAgICAvLyBBIG1vZGlmaWNhdGlvbiBoYXBwZW5lZCBhdCB0aGUgY3Vyc29yIGxvY2F0aW9uLlxuICAgIC8vIFRoaXMgaXMgdGhlIGV4cGVjdGVkIG91dGNvbWUsIHNvIHdlIGNhbiByZXR1cm4gdGhlIG9yaWdpbmFsIGRpZmYuXG4gICAgcmV0dXJuIGRpZmZzO1xuICB9IGVsc2Uge1xuICAgIGlmIChkX25leHQgIT0gbnVsbCAmJiBkWzFdICsgZF9uZXh0WzFdID09PSBkX25leHRbMV0gKyBkWzFdKSB7XG4gICAgICAvLyBDYXNlIDEpXG4gICAgICAvLyBJdCBpcyBwb3NzaWJsZSB0byBwZXJmb3JtIGEgbmFpdmUgc2hpZnRcbiAgICAgIG5kaWZmcy5zcGxpY2UoY3Vyc29yX3BvaW50ZXIsIDIsIGRfbmV4dCwgZClcbiAgICAgIHJldHVybiBtZXJnZV90dXBsZXMobmRpZmZzLCBjdXJzb3JfcG9pbnRlciwgMilcbiAgICB9IGVsc2UgaWYgKGRfbmV4dCAhPSBudWxsICYmIGRfbmV4dFsxXS5pbmRleE9mKGRbMV0pID09PSAwKSB7XG4gICAgICAvLyBDYXNlIDIpXG4gICAgICAvLyBkWzFdIGlzIGEgcHJlZml4IG9mIGRfbmV4dFsxXVxuICAgICAgLy8gV2UgY2FuIGFzc3VtZSB0aGF0IGRfbmV4dFswXSAhPT0gMCwgc2luY2UgZFswXSA9PT0gMFxuICAgICAgLy8gU2hpZnQgZWRpdCBsb2NhdGlvbnMuLlxuICAgICAgbmRpZmZzLnNwbGljZShjdXJzb3JfcG9pbnRlciwgMiwgW2RfbmV4dFswXSwgZFsxXV0sIFswLCBkWzFdXSk7XG4gICAgICB2YXIgc3VmZml4ID0gZF9uZXh0WzFdLnNsaWNlKGRbMV0ubGVuZ3RoKTtcbiAgICAgIGlmIChzdWZmaXgubGVuZ3RoID4gMCkge1xuICAgICAgICBuZGlmZnMuc3BsaWNlKGN1cnNvcl9wb2ludGVyICsgMiwgMCwgW2RfbmV4dFswXSwgc3VmZml4XSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWVyZ2VfdHVwbGVzKG5kaWZmcywgY3Vyc29yX3BvaW50ZXIsIDMpXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vdCBwb3NzaWJsZSB0byBwZXJmb3JtIGFueSBtb2RpZmljYXRpb25cbiAgICAgIHJldHVybiBkaWZmcztcbiAgICB9XG4gIH1cblxufVxuXG4vKlxuICogVHJ5IHRvIG1lcmdlIHR1cGxlcyB3aXRoIHRoZWlyIG5laWdib3JzIGluIGEgZ2l2ZW4gcmFuZ2UuXG4gKiBFLmcuIFswLCAnYSddLCBbMCwgJ2InXSAtPiBbMCwgJ2FiJ11cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlcy5cbiAqIEBwYXJhbSB7SW50fSBzdGFydCBQb3NpdGlvbiBvZiB0aGUgZmlyc3QgZWxlbWVudCB0byBtZXJnZSAoZGlmZnNbc3RhcnRdIGlzIGFsc28gbWVyZ2VkIHdpdGggZGlmZnNbc3RhcnQgLSAxXSkuXG4gKiBAcGFyYW0ge0ludH0gbGVuZ3RoIE51bWJlciBvZiBjb25zZWN1dGl2ZSBlbGVtZW50cyB0byBjaGVjay5cbiAqIEByZXR1cm4ge0FycmF5fSBBcnJheSBvZiBtZXJnZWQgZGlmZiB0dXBsZXMuXG4gKi9cbmZ1bmN0aW9uIG1lcmdlX3R1cGxlcyAoZGlmZnMsIHN0YXJ0LCBsZW5ndGgpIHtcbiAgLy8gQ2hlY2sgZnJvbSAoc3RhcnQtMSkgdG8gKHN0YXJ0K2xlbmd0aCkuXG4gIGZvciAodmFyIGkgPSBzdGFydCArIGxlbmd0aCAtIDE7IGkgPj0gMCAmJiBpID49IHN0YXJ0IC0gMTsgaS0tKSB7XG4gICAgaWYgKGkgKyAxIDwgZGlmZnMubGVuZ3RoKSB7XG4gICAgICB2YXIgbGVmdF9kID0gZGlmZnNbaV07XG4gICAgICB2YXIgcmlnaHRfZCA9IGRpZmZzW2krMV07XG4gICAgICBpZiAobGVmdF9kWzBdID09PSByaWdodF9kWzFdKSB7XG4gICAgICAgIGRpZmZzLnNwbGljZShpLCAyLCBbbGVmdF9kWzBdLCBsZWZ0X2RbMV0gKyByaWdodF9kWzFdXSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBkaWZmcztcbn1cbiIsIi8vIElTQyBAIEp1bGllbiBGb250YW5ldFxuXG4ndXNlIHN0cmljdCdcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG52YXIgZGVmaW5lUHJvcGVydHkgPSBPYmplY3QuZGVmaW5lUHJvcGVydHlcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG52YXIgY2FwdHVyZVN0YWNrVHJhY2UgPSBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZVxuaWYgKCFjYXB0dXJlU3RhY2tUcmFjZSkge1xuICBjYXB0dXJlU3RhY2tUcmFjZSA9IGZ1bmN0aW9uIGNhcHR1cmVTdGFja1RyYWNlIChlcnJvcikge1xuICAgIHZhciBjb250YWluZXIgPSBuZXcgRXJyb3IoKVxuXG4gICAgZGVmaW5lUHJvcGVydHkoZXJyb3IsICdzdGFjaycsIHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIGdldDogZnVuY3Rpb24gZ2V0U3RhY2sgKCkge1xuICAgICAgICB2YXIgc3RhY2sgPSBjb250YWluZXIuc3RhY2tcblxuICAgICAgICAvLyBSZXBsYWNlIHByb3BlcnR5IHdpdGggdmFsdWUgZm9yIGZhc3RlciBmdXR1cmUgYWNjZXNzZXMuXG4gICAgICAgIGRlZmluZVByb3BlcnR5KHRoaXMsICdzdGFjaycsIHtcbiAgICAgICAgICB2YWx1ZTogc3RhY2tcbiAgICAgICAgfSlcblxuICAgICAgICByZXR1cm4gc3RhY2tcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uIHNldFN0YWNrIChzdGFjaykge1xuICAgICAgICBkZWZpbmVQcm9wZXJ0eShlcnJvciwgJ3N0YWNrJywge1xuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICB2YWx1ZTogc3RhY2ssXG4gICAgICAgICAgd3JpdGFibGU6IHRydWVcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9KVxuICB9XG59XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZnVuY3Rpb24gQmFzZUVycm9yIChtZXNzYWdlKSB7XG4gIGlmIChtZXNzYWdlKSB7XG4gICAgZGVmaW5lUHJvcGVydHkodGhpcywgJ21lc3NhZ2UnLCB7XG4gICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICB2YWx1ZTogbWVzc2FnZSxcbiAgICAgIHdyaXRhYmxlOiB0cnVlXG4gICAgfSlcbiAgfVxuXG4gIHZhciBjbmFtZSA9IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICBpZiAoXG4gICAgY25hbWUgJiZcbiAgICBjbmFtZSAhPT0gdGhpcy5uYW1lXG4gICkge1xuICAgIGRlZmluZVByb3BlcnR5KHRoaXMsICduYW1lJywge1xuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgdmFsdWU6IGNuYW1lLFxuICAgICAgd3JpdGFibGU6IHRydWVcbiAgICB9KVxuICB9XG5cbiAgY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgdGhpcy5jb25zdHJ1Y3Rvcilcbn1cblxuQmFzZUVycm9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXJyb3IucHJvdG90eXBlLCB7XG4gIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL0pzQ29tbXVuaXR5L21ha2UtZXJyb3IvaXNzdWVzLzRcbiAgY29uc3RydWN0b3I6IHtcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgdmFsdWU6IEJhc2VFcnJvcixcbiAgICB3cml0YWJsZTogdHJ1ZVxuICB9XG59KVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8vIFNldHMgdGhlIG5hbWUgb2YgYSBmdW5jdGlvbiBpZiBwb3NzaWJsZSAoZGVwZW5kcyBvZiB0aGUgSlMgZW5naW5lKS5cbnZhciBzZXRGdW5jdGlvbk5hbWUgPSAoZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBzZXRGdW5jdGlvbk5hbWUgKGZuLCBuYW1lKSB7XG4gICAgcmV0dXJuIGRlZmluZVByb3BlcnR5KGZuLCAnbmFtZScsIHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIHZhbHVlOiBuYW1lXG4gICAgfSlcbiAgfVxuICB0cnkge1xuICAgIHZhciBmID0gZnVuY3Rpb24gKCkge31cbiAgICBzZXRGdW5jdGlvbk5hbWUoZiwgJ2ZvbycpXG4gICAgaWYgKGYubmFtZSA9PT0gJ2ZvbycpIHtcbiAgICAgIHJldHVybiBzZXRGdW5jdGlvbk5hbWVcbiAgICB9XG4gIH0gY2F0Y2ggKF8pIHt9XG59KSgpXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZnVuY3Rpb24gbWFrZUVycm9yIChjb25zdHJ1Y3Rvciwgc3VwZXJfKSB7XG4gIGlmIChzdXBlcl8gPT0gbnVsbCB8fCBzdXBlcl8gPT09IEVycm9yKSB7XG4gICAgc3VwZXJfID0gQmFzZUVycm9yXG4gIH0gZWxzZSBpZiAodHlwZW9mIHN1cGVyXyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3N1cGVyXyBzaG91bGQgYmUgYSBmdW5jdGlvbicpXG4gIH1cblxuICB2YXIgbmFtZVxuICBpZiAodHlwZW9mIGNvbnN0cnVjdG9yID09PSAnc3RyaW5nJykge1xuICAgIG5hbWUgPSBjb25zdHJ1Y3RvclxuICAgIGNvbnN0cnVjdG9yID0gZnVuY3Rpb24gKCkgeyBzdXBlcl8uYXBwbHkodGhpcywgYXJndW1lbnRzKSB9XG5cbiAgICAvLyBJZiB0aGUgbmFtZSBjYW4gYmUgc2V0LCBkbyBpdCBvbmNlIGFuZCBmb3IgYWxsLlxuICAgIGlmIChzZXRGdW5jdGlvbk5hbWUpIHtcbiAgICAgIHNldEZ1bmN0aW9uTmFtZShjb25zdHJ1Y3RvciwgbmFtZSlcbiAgICAgIG5hbWUgPSBudWxsXG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGVvZiBjb25zdHJ1Y3RvciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2NvbnN0cnVjdG9yIHNob3VsZCBiZSBlaXRoZXIgYSBzdHJpbmcgb3IgYSBmdW5jdGlvbicpXG4gIH1cblxuICAvLyBBbHNvIHJlZ2lzdGVyIHRoZSBzdXBlciBjb25zdHJ1Y3RvciBhbHNvIGFzIGBjb25zdHJ1Y3Rvci5zdXBlcl9gIGp1c3RcbiAgLy8gbGlrZSBOb2RlJ3MgYHV0aWwuaW5oZXJpdHMoKWAuXG4gIGNvbnN0cnVjdG9yLnN1cGVyXyA9IGNvbnN0cnVjdG9yWydzdXBlciddID0gc3VwZXJfXG5cbiAgdmFyIHByb3BlcnRpZXMgPSB7XG4gICAgY29uc3RydWN0b3I6IHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIHZhbHVlOiBjb25zdHJ1Y3RvcixcbiAgICAgIHdyaXRhYmxlOiB0cnVlXG4gICAgfVxuICB9XG5cbiAgLy8gSWYgdGhlIG5hbWUgY291bGQgbm90IGJlIHNldCBvbiB0aGUgY29uc3RydWN0b3IsIHNldCBpdCBvbiB0aGVcbiAgLy8gcHJvdG90eXBlLlxuICBpZiAobmFtZSAhPSBudWxsKSB7XG4gICAgcHJvcGVydGllcy5uYW1lID0ge1xuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgdmFsdWU6IG5hbWUsXG4gICAgICB3cml0YWJsZTogdHJ1ZVxuICAgIH1cbiAgfVxuICBjb25zdHJ1Y3Rvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyXy5wcm90b3R5cGUsIHByb3BlcnRpZXMpXG5cbiAgcmV0dXJuIGNvbnN0cnVjdG9yXG59XG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBtYWtlRXJyb3JcbmV4cG9ydHMuQmFzZUVycm9yID0gQmFzZUVycm9yXG4iLCIvLyBUaGVzZSBtZXRob2RzIGxldCB5b3UgYnVpbGQgYSB0cmFuc2Zvcm0gZnVuY3Rpb24gZnJvbSBhIHRyYW5zZm9ybUNvbXBvbmVudFxuLy8gZnVuY3Rpb24gZm9yIE9UIHR5cGVzIGxpa2UgSlNPTjAgaW4gd2hpY2ggb3BlcmF0aW9ucyBhcmUgbGlzdHMgb2YgY29tcG9uZW50c1xuLy8gYW5kIHRyYW5zZm9ybWluZyB0aGVtIHJlcXVpcmVzIE5eMiB3b3JrLiBJIGZpbmQgaXQga2luZCBvZiBuYXN0eSB0aGF0IEkgbmVlZFxuLy8gdGhpcywgYnV0IEknbSBub3QgcmVhbGx5IHN1cmUgd2hhdCBhIGJldHRlciBzb2x1dGlvbiBpcy4gTWF5YmUgSSBzaG91bGQgZG9cbi8vIHRoaXMgYXV0b21hdGljYWxseSB0byB0eXBlcyB0aGF0IGRvbid0IGhhdmUgYSBjb21wb3NlIGZ1bmN0aW9uIGRlZmluZWQuXG5cbi8vIEFkZCB0cmFuc2Zvcm0gYW5kIHRyYW5zZm9ybVggZnVuY3Rpb25zIGZvciBhbiBPVCB0eXBlIHdoaWNoIGhhc1xuLy8gdHJhbnNmb3JtQ29tcG9uZW50IGRlZmluZWQuICB0cmFuc2Zvcm1Db21wb25lbnQoZGVzdGluYXRpb24gYXJyYXksXG4vLyBjb21wb25lbnQsIG90aGVyIGNvbXBvbmVudCwgc2lkZSlcbm1vZHVsZS5leHBvcnRzID0gYm9vdHN0cmFwVHJhbnNmb3JtXG5mdW5jdGlvbiBib290c3RyYXBUcmFuc2Zvcm0odHlwZSwgdHJhbnNmb3JtQ29tcG9uZW50LCBjaGVja1ZhbGlkT3AsIGFwcGVuZCkge1xuICB2YXIgdHJhbnNmb3JtQ29tcG9uZW50WCA9IGZ1bmN0aW9uKGxlZnQsIHJpZ2h0LCBkZXN0TGVmdCwgZGVzdFJpZ2h0KSB7XG4gICAgdHJhbnNmb3JtQ29tcG9uZW50KGRlc3RMZWZ0LCBsZWZ0LCByaWdodCwgJ2xlZnQnKTtcbiAgICB0cmFuc2Zvcm1Db21wb25lbnQoZGVzdFJpZ2h0LCByaWdodCwgbGVmdCwgJ3JpZ2h0Jyk7XG4gIH07XG5cbiAgdmFyIHRyYW5zZm9ybVggPSB0eXBlLnRyYW5zZm9ybVggPSBmdW5jdGlvbihsZWZ0T3AsIHJpZ2h0T3ApIHtcbiAgICBjaGVja1ZhbGlkT3AobGVmdE9wKTtcbiAgICBjaGVja1ZhbGlkT3AocmlnaHRPcCk7XG4gICAgdmFyIG5ld1JpZ2h0T3AgPSBbXTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmlnaHRPcC5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHJpZ2h0Q29tcG9uZW50ID0gcmlnaHRPcFtpXTtcblxuICAgICAgLy8gR2VuZXJhdGUgbmV3TGVmdE9wIGJ5IGNvbXBvc2luZyBsZWZ0T3AgYnkgcmlnaHRDb21wb25lbnRcbiAgICAgIHZhciBuZXdMZWZ0T3AgPSBbXTtcbiAgICAgIHZhciBrID0gMDtcbiAgICAgIHdoaWxlIChrIDwgbGVmdE9wLmxlbmd0aCkge1xuICAgICAgICB2YXIgbmV4dEMgPSBbXTtcbiAgICAgICAgdHJhbnNmb3JtQ29tcG9uZW50WChsZWZ0T3Bba10sIHJpZ2h0Q29tcG9uZW50LCBuZXdMZWZ0T3AsIG5leHRDKTtcbiAgICAgICAgaysrO1xuXG4gICAgICAgIGlmIChuZXh0Qy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICByaWdodENvbXBvbmVudCA9IG5leHRDWzBdO1xuICAgICAgICB9IGVsc2UgaWYgKG5leHRDLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGZvciAodmFyIGogPSBrOyBqIDwgbGVmdE9wLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBhcHBlbmQobmV3TGVmdE9wLCBsZWZ0T3Bbal0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByaWdodENvbXBvbmVudCA9IG51bGw7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gUmVjdXJzZS5cbiAgICAgICAgICB2YXIgcGFpciA9IHRyYW5zZm9ybVgobGVmdE9wLnNsaWNlKGspLCBuZXh0Qyk7XG4gICAgICAgICAgZm9yICh2YXIgbCA9IDA7IGwgPCBwYWlyWzBdLmxlbmd0aDsgbCsrKSB7XG4gICAgICAgICAgICBhcHBlbmQobmV3TGVmdE9wLCBwYWlyWzBdW2xdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yICh2YXIgciA9IDA7IHIgPCBwYWlyWzFdLmxlbmd0aDsgcisrKSB7XG4gICAgICAgICAgICBhcHBlbmQobmV3UmlnaHRPcCwgcGFpclsxXVtyXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJpZ2h0Q29tcG9uZW50ID0gbnVsbDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAocmlnaHRDb21wb25lbnQgIT0gbnVsbCkge1xuICAgICAgICBhcHBlbmQobmV3UmlnaHRPcCwgcmlnaHRDb21wb25lbnQpO1xuICAgICAgfVxuICAgICAgbGVmdE9wID0gbmV3TGVmdE9wO1xuICAgIH1cbiAgICByZXR1cm4gW2xlZnRPcCwgbmV3UmlnaHRPcF07XG4gIH07XG5cbiAgLy8gVHJhbnNmb3JtcyBvcCB3aXRoIHNwZWNpZmllZCB0eXBlICgnbGVmdCcgb3IgJ3JpZ2h0JykgYnkgb3RoZXJPcC5cbiAgdHlwZS50cmFuc2Zvcm0gPSBmdW5jdGlvbihvcCwgb3RoZXJPcCwgdHlwZSkge1xuICAgIGlmICghKHR5cGUgPT09ICdsZWZ0JyB8fCB0eXBlID09PSAncmlnaHQnKSlcbiAgICAgIHRocm93IG5ldyBFcnJvcihcInR5cGUgbXVzdCBiZSAnbGVmdCcgb3IgJ3JpZ2h0J1wiKTtcblxuICAgIGlmIChvdGhlck9wLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG9wO1xuXG4gICAgaWYgKG9wLmxlbmd0aCA9PT0gMSAmJiBvdGhlck9wLmxlbmd0aCA9PT0gMSlcbiAgICAgIHJldHVybiB0cmFuc2Zvcm1Db21wb25lbnQoW10sIG9wWzBdLCBvdGhlck9wWzBdLCB0eXBlKTtcblxuICAgIGlmICh0eXBlID09PSAnbGVmdCcpXG4gICAgICByZXR1cm4gdHJhbnNmb3JtWChvcCwgb3RoZXJPcClbMF07XG4gICAgZWxzZVxuICAgICAgcmV0dXJuIHRyYW5zZm9ybVgob3RoZXJPcCwgb3ApWzFdO1xuICB9O1xufTtcbiIsIi8vIE9ubHkgdGhlIEpTT04gdHlwZSBpcyBleHBvcnRlZCwgYmVjYXVzZSB0aGUgdGV4dCB0eXBlIGlzIGRlcHJlY2F0ZWRcbi8vIG90aGVyd2lzZS4gKElmIHlvdSB3YW50IHRvIHVzZSBpdCBzb21ld2hlcmUsIHlvdSdyZSB3ZWxjb21lIHRvIHB1bGwgaXQgb3V0XG4vLyBpbnRvIGEgc2VwYXJhdGUgbW9kdWxlIHRoYXQganNvbjAgY2FuIGRlcGVuZCBvbikuXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICB0eXBlOiByZXF1aXJlKCcuL2pzb24wJylcbn07XG4iLCIvKlxuIFRoaXMgaXMgdGhlIGltcGxlbWVudGF0aW9uIG9mIHRoZSBKU09OIE9UIHR5cGUuXG5cbiBTcGVjIGlzIGhlcmU6IGh0dHBzOi8vZ2l0aHViLmNvbS9qb3NlcGhnL1NoYXJlSlMvd2lraS9KU09OLU9wZXJhdGlvbnNcblxuIE5vdGU6IFRoaXMgaXMgYmVpbmcgbWFkZSBvYnNvbGV0ZS4gSXQgd2lsbCBzb29uIGJlIHJlcGxhY2VkIGJ5IHRoZSBKU09OMiB0eXBlLlxuKi9cblxuLyoqXG4gKiBVVElMSVRZIEZVTkNUSU9OU1xuICovXG5cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSBwYXNzZWQgb2JqZWN0IGlzIGFuIEFycmF5IGluc3RhbmNlLiBDYW4ndCB1c2UgQXJyYXkuaXNBcnJheVxuICogeWV0IGJlY2F1c2UgaXRzIG5vdCBzdXBwb3J0ZWQgb24gSUU4LlxuICpcbiAqIEBwYXJhbSBvYmpcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG52YXIgaXNBcnJheSA9IGZ1bmN0aW9uKG9iaikge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG5cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSBwYXNzZWQgb2JqZWN0IGlzIGFuIE9iamVjdCBpbnN0YW5jZS5cbiAqIE5vIGZ1bmN0aW9uIGNhbGwgKGZhc3QpIHZlcnNpb25cbiAqXG4gKiBAcGFyYW0gb2JqXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xudmFyIGlzT2JqZWN0ID0gZnVuY3Rpb24ob2JqKSB7XG4gIHJldHVybiAoISFvYmopICYmIChvYmouY29uc3RydWN0b3IgPT09IE9iamVjdCk7XG59O1xuXG4vKipcbiAqIENsb25lcyB0aGUgcGFzc2VkIG9iamVjdCB1c2luZyBKU09OIHNlcmlhbGl6YXRpb24gKHdoaWNoIGlzIHNsb3cpLlxuICpcbiAqIGhheCwgY29waWVkIGZyb20gdGVzdC90eXBlcy9qc29uLiBBcHBhcmVudGx5IHRoaXMgaXMgc3RpbGwgdGhlIGZhc3Rlc3Qgd2F5XG4gKiB0byBkZWVwIGNsb25lIGFuIG9iamVjdCwgYXNzdW1pbmcgd2UgaGF2ZSBicm93c2VyIHN1cHBvcnQgZm9yIEpTT04uICBAc2VlXG4gKiBodHRwOi8vanNwZXJmLmNvbS9jbG9uaW5nLWFuLW9iamVjdC8xMlxuICovXG52YXIgY2xvbmUgPSBmdW5jdGlvbihvKSB7XG4gIHJldHVybiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KG8pKTtcbn07XG5cbi8qKlxuICogSlNPTiBPVCBUeXBlXG4gKiBAdHlwZSB7Kn1cbiAqL1xudmFyIGpzb24gPSB7XG4gIG5hbWU6ICdqc29uMCcsXG4gIHVyaTogJ2h0dHA6Ly9zaGFyZWpzLm9yZy90eXBlcy9KU09OdjAnXG59O1xuXG4vLyBZb3UgY2FuIHJlZ2lzdGVyIGFub3RoZXIgT1QgdHlwZSBhcyBhIHN1YnR5cGUgaW4gYSBKU09OIGRvY3VtZW50IHVzaW5nXG4vLyB0aGUgZm9sbG93aW5nIGZ1bmN0aW9uLiBUaGlzIGFsbG93cyBhbm90aGVyIHR5cGUgdG8gaGFuZGxlIGNlcnRhaW5cbi8vIG9wZXJhdGlvbnMgaW5zdGVhZCBvZiB0aGUgYnVpbHRpbiBKU09OIHR5cGUuXG52YXIgc3VidHlwZXMgPSB7fTtcbmpzb24ucmVnaXN0ZXJTdWJ0eXBlID0gZnVuY3Rpb24oc3VidHlwZSkge1xuICBzdWJ0eXBlc1tzdWJ0eXBlLm5hbWVdID0gc3VidHlwZTtcbn07XG5cbmpzb24uY3JlYXRlID0gZnVuY3Rpb24oZGF0YSkge1xuICAvLyBOdWxsIGluc3RlYWQgb2YgdW5kZWZpbmVkIGlmIHlvdSBkb24ndCBwYXNzIGFuIGFyZ3VtZW50LlxuICByZXR1cm4gZGF0YSA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IGNsb25lKGRhdGEpO1xufTtcblxuanNvbi5pbnZlcnRDb21wb25lbnQgPSBmdW5jdGlvbihjKSB7XG4gIHZhciBjXyA9IHtwOiBjLnB9O1xuXG4gIC8vIGhhbmRsZSBzdWJ0eXBlIG9wc1xuICBpZiAoYy50ICYmIHN1YnR5cGVzW2MudF0pIHtcbiAgICBjXy50ID0gYy50O1xuICAgIGNfLm8gPSBzdWJ0eXBlc1tjLnRdLmludmVydChjLm8pO1xuICB9XG5cbiAgaWYgKGMuc2kgIT09IHZvaWQgMCkgY18uc2QgPSBjLnNpO1xuICBpZiAoYy5zZCAhPT0gdm9pZCAwKSBjXy5zaSA9IGMuc2Q7XG4gIGlmIChjLm9pICE9PSB2b2lkIDApIGNfLm9kID0gYy5vaTtcbiAgaWYgKGMub2QgIT09IHZvaWQgMCkgY18ub2kgPSBjLm9kO1xuICBpZiAoYy5saSAhPT0gdm9pZCAwKSBjXy5sZCA9IGMubGk7XG4gIGlmIChjLmxkICE9PSB2b2lkIDApIGNfLmxpID0gYy5sZDtcbiAgaWYgKGMubmEgIT09IHZvaWQgMCkgY18ubmEgPSAtYy5uYTtcblxuICBpZiAoYy5sbSAhPT0gdm9pZCAwKSB7XG4gICAgY18ubG0gPSBjLnBbYy5wLmxlbmd0aC0xXTtcbiAgICBjXy5wID0gYy5wLnNsaWNlKDAsYy5wLmxlbmd0aC0xKS5jb25jYXQoW2MubG1dKTtcbiAgfVxuXG4gIHJldHVybiBjXztcbn07XG5cbmpzb24uaW52ZXJ0ID0gZnVuY3Rpb24ob3ApIHtcbiAgdmFyIG9wXyA9IG9wLnNsaWNlKCkucmV2ZXJzZSgpO1xuICB2YXIgaW9wID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3BfLmxlbmd0aDsgaSsrKSB7XG4gICAgaW9wLnB1c2goanNvbi5pbnZlcnRDb21wb25lbnQob3BfW2ldKSk7XG4gIH1cbiAgcmV0dXJuIGlvcDtcbn07XG5cbmpzb24uY2hlY2tWYWxpZE9wID0gZnVuY3Rpb24ob3ApIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5sZW5ndGg7IGkrKykge1xuICAgIGlmICghaXNBcnJheShvcFtpXS5wKSkgdGhyb3cgbmV3IEVycm9yKCdNaXNzaW5nIHBhdGgnKTtcbiAgfVxufTtcblxuanNvbi5jaGVja0xpc3QgPSBmdW5jdGlvbihlbGVtKSB7XG4gIGlmICghaXNBcnJheShlbGVtKSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1JlZmVyZW5jZWQgZWxlbWVudCBub3QgYSBsaXN0Jyk7XG59O1xuXG5qc29uLmNoZWNrT2JqID0gZnVuY3Rpb24oZWxlbSkge1xuICBpZiAoIWlzT2JqZWN0KGVsZW0pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiUmVmZXJlbmNlZCBlbGVtZW50IG5vdCBhbiBvYmplY3QgKGl0IHdhcyBcIiArIEpTT04uc3RyaW5naWZ5KGVsZW0pICsgXCIpXCIpO1xuICB9XG59O1xuXG4vLyBoZWxwZXIgZnVuY3Rpb25zIHRvIGNvbnZlcnQgb2xkIHN0cmluZyBvcHMgdG8gYW5kIGZyb20gc3VidHlwZSBvcHNcbmZ1bmN0aW9uIGNvbnZlcnRGcm9tVGV4dChjKSB7XG4gIGMudCA9ICd0ZXh0MCc7XG4gIHZhciBvID0ge3A6IGMucC5wb3AoKX07XG4gIGlmIChjLnNpICE9IG51bGwpIG8uaSA9IGMuc2k7XG4gIGlmIChjLnNkICE9IG51bGwpIG8uZCA9IGMuc2Q7XG4gIGMubyA9IFtvXTtcbn1cblxuZnVuY3Rpb24gY29udmVydFRvVGV4dChjKSB7XG4gIGMucC5wdXNoKGMub1swXS5wKTtcbiAgaWYgKGMub1swXS5pICE9IG51bGwpIGMuc2kgPSBjLm9bMF0uaTtcbiAgaWYgKGMub1swXS5kICE9IG51bGwpIGMuc2QgPSBjLm9bMF0uZDtcbiAgZGVsZXRlIGMudDtcbiAgZGVsZXRlIGMubztcbn1cblxuanNvbi5hcHBseSA9IGZ1bmN0aW9uKHNuYXBzaG90LCBvcCkge1xuICBqc29uLmNoZWNrVmFsaWRPcChvcCk7XG5cbiAgb3AgPSBjbG9uZShvcCk7XG5cbiAgdmFyIGNvbnRhaW5lciA9IHtcbiAgICBkYXRhOiBzbmFwc2hvdFxuICB9O1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYyA9IG9wW2ldO1xuXG4gICAgLy8gY29udmVydCBvbGQgc3RyaW5nIG9wcyB0byB1c2Ugc3VidHlwZSBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHlcbiAgICBpZiAoYy5zaSAhPSBudWxsIHx8IGMuc2QgIT0gbnVsbClcbiAgICAgIGNvbnZlcnRGcm9tVGV4dChjKTtcblxuICAgIHZhciBwYXJlbnQgPSBudWxsO1xuICAgIHZhciBwYXJlbnRLZXkgPSBudWxsO1xuICAgIHZhciBlbGVtID0gY29udGFpbmVyO1xuICAgIHZhciBrZXkgPSAnZGF0YSc7XG5cbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IGMucC5sZW5ndGg7IGorKykge1xuICAgICAgdmFyIHAgPSBjLnBbal07XG5cbiAgICAgIHBhcmVudCA9IGVsZW07XG4gICAgICBwYXJlbnRLZXkgPSBrZXk7XG4gICAgICBlbGVtID0gZWxlbVtrZXldO1xuICAgICAga2V5ID0gcDtcblxuICAgICAgaWYgKHBhcmVudCA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1BhdGggaW52YWxpZCcpO1xuICAgIH1cblxuICAgIC8vIGhhbmRsZSBzdWJ0eXBlIG9wc1xuICAgIGlmIChjLnQgJiYgYy5vICE9PSB2b2lkIDAgJiYgc3VidHlwZXNbYy50XSkge1xuICAgICAgZWxlbVtrZXldID0gc3VidHlwZXNbYy50XS5hcHBseShlbGVtW2tleV0sIGMubyk7XG5cbiAgICAvLyBOdW1iZXIgYWRkXG4gICAgfSBlbHNlIGlmIChjLm5hICE9PSB2b2lkIDApIHtcbiAgICAgIGlmICh0eXBlb2YgZWxlbVtrZXldICE9ICdudW1iZXInKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JlZmVyZW5jZWQgZWxlbWVudCBub3QgYSBudW1iZXInKTtcblxuICAgICAgZWxlbVtrZXldICs9IGMubmE7XG4gICAgfVxuXG4gICAgLy8gTGlzdCByZXBsYWNlXG4gICAgZWxzZSBpZiAoYy5saSAhPT0gdm9pZCAwICYmIGMubGQgIT09IHZvaWQgMCkge1xuICAgICAganNvbi5jaGVja0xpc3QoZWxlbSk7XG4gICAgICAvLyBTaG91bGQgY2hlY2sgdGhlIGxpc3QgZWxlbWVudCBtYXRjaGVzIGMubGRcbiAgICAgIGVsZW1ba2V5XSA9IGMubGk7XG4gICAgfVxuXG4gICAgLy8gTGlzdCBpbnNlcnRcbiAgICBlbHNlIGlmIChjLmxpICE9PSB2b2lkIDApIHtcbiAgICAgIGpzb24uY2hlY2tMaXN0KGVsZW0pO1xuICAgICAgZWxlbS5zcGxpY2Uoa2V5LDAsIGMubGkpO1xuICAgIH1cblxuICAgIC8vIExpc3QgZGVsZXRlXG4gICAgZWxzZSBpZiAoYy5sZCAhPT0gdm9pZCAwKSB7XG4gICAgICBqc29uLmNoZWNrTGlzdChlbGVtKTtcbiAgICAgIC8vIFNob3VsZCBjaGVjayB0aGUgbGlzdCBlbGVtZW50IG1hdGNoZXMgYy5sZCBoZXJlIHRvby5cbiAgICAgIGVsZW0uc3BsaWNlKGtleSwxKTtcbiAgICB9XG5cbiAgICAvLyBMaXN0IG1vdmVcbiAgICBlbHNlIGlmIChjLmxtICE9PSB2b2lkIDApIHtcbiAgICAgIGpzb24uY2hlY2tMaXN0KGVsZW0pO1xuICAgICAgaWYgKGMubG0gIT0ga2V5KSB7XG4gICAgICAgIHZhciBlID0gZWxlbVtrZXldO1xuICAgICAgICAvLyBSZW1vdmUgaXQuLi5cbiAgICAgICAgZWxlbS5zcGxpY2Uoa2V5LDEpO1xuICAgICAgICAvLyBBbmQgaW5zZXJ0IGl0IGJhY2suXG4gICAgICAgIGVsZW0uc3BsaWNlKGMubG0sMCxlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBPYmplY3QgaW5zZXJ0IC8gcmVwbGFjZVxuICAgIGVsc2UgaWYgKGMub2kgIT09IHZvaWQgMCkge1xuICAgICAganNvbi5jaGVja09iaihlbGVtKTtcblxuICAgICAgLy8gU2hvdWxkIGNoZWNrIHRoYXQgZWxlbVtrZXldID09IGMub2RcbiAgICAgIGVsZW1ba2V5XSA9IGMub2k7XG4gICAgfVxuXG4gICAgLy8gT2JqZWN0IGRlbGV0ZVxuICAgIGVsc2UgaWYgKGMub2QgIT09IHZvaWQgMCkge1xuICAgICAganNvbi5jaGVja09iaihlbGVtKTtcblxuICAgICAgLy8gU2hvdWxkIGNoZWNrIHRoYXQgZWxlbVtrZXldID09IGMub2RcbiAgICAgIGRlbGV0ZSBlbGVtW2tleV07XG4gICAgfVxuXG4gICAgZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgLyBtaXNzaW5nIGluc3RydWN0aW9uIGluIG9wJyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGNvbnRhaW5lci5kYXRhO1xufTtcblxuLy8gSGVscGVyIHRvIGJyZWFrIGFuIG9wZXJhdGlvbiB1cCBpbnRvIGEgYnVuY2ggb2Ygc21hbGwgb3BzLlxuanNvbi5zaGF0dGVyID0gZnVuY3Rpb24ob3ApIHtcbiAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5sZW5ndGg7IGkrKykge1xuICAgIHJlc3VsdHMucHVzaChbb3BbaV1dKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0cztcbn07XG5cbi8vIEhlbHBlciBmb3IgaW5jcmVtZW50YWxseSBhcHBseWluZyBhbiBvcGVyYXRpb24gdG8gYSBzbmFwc2hvdC4gQ2FsbHMgeWllbGRcbi8vIGFmdGVyIGVhY2ggb3AgY29tcG9uZW50IGhhcyBiZWVuIGFwcGxpZWQuXG5qc29uLmluY3JlbWVudGFsQXBwbHkgPSBmdW5jdGlvbihzbmFwc2hvdCwgb3AsIF95aWVsZCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IG9wLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHNtYWxsT3AgPSBbb3BbaV1dO1xuICAgIHNuYXBzaG90ID0ganNvbi5hcHBseShzbmFwc2hvdCwgc21hbGxPcCk7XG4gICAgLy8gSSdkIGp1c3QgY2FsbCB0aGlzIHlpZWxkLCBidXQgdGhhdHMgYSByZXNlcnZlZCBrZXl3b3JkLiBCYWghXG4gICAgX3lpZWxkKHNtYWxsT3AsIHNuYXBzaG90KTtcbiAgfVxuXG4gIHJldHVybiBzbmFwc2hvdDtcbn07XG5cbi8vIENoZWNrcyBpZiB0d28gcGF0aHMsIHAxIGFuZCBwMiBtYXRjaC5cbnZhciBwYXRoTWF0Y2hlcyA9IGpzb24ucGF0aE1hdGNoZXMgPSBmdW5jdGlvbihwMSwgcDIsIGlnbm9yZUxhc3QpIHtcbiAgaWYgKHAxLmxlbmd0aCAhPSBwMi5sZW5ndGgpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcDEubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAocDFbaV0gIT09IHAyW2ldICYmICghaWdub3JlTGFzdCB8fCBpICE9PSBwMS5sZW5ndGggLSAxKSlcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuanNvbi5hcHBlbmQgPSBmdW5jdGlvbihkZXN0LGMpIHtcbiAgYyA9IGNsb25lKGMpO1xuXG4gIGlmIChkZXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIGRlc3QucHVzaChjKTtcbiAgICByZXR1cm47XG4gIH1cblxuICB2YXIgbGFzdCA9IGRlc3RbZGVzdC5sZW5ndGggLSAxXTtcblxuICAvLyBjb252ZXJ0IG9sZCBzdHJpbmcgb3BzIHRvIHVzZSBzdWJ0eXBlIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eVxuICBpZiAoKGMuc2kgIT0gbnVsbCB8fCBjLnNkICE9IG51bGwpICYmIChsYXN0LnNpICE9IG51bGwgfHwgbGFzdC5zZCAhPSBudWxsKSkge1xuICAgIGNvbnZlcnRGcm9tVGV4dChjKTtcbiAgICBjb252ZXJ0RnJvbVRleHQobGFzdCk7XG4gIH1cblxuICBpZiAocGF0aE1hdGNoZXMoYy5wLCBsYXN0LnApKSB7XG4gICAgLy8gaGFuZGxlIHN1YnR5cGUgb3BzXG4gICAgaWYgKGMudCAmJiBsYXN0LnQgJiYgYy50ID09PSBsYXN0LnQgJiYgc3VidHlwZXNbYy50XSkge1xuICAgICAgbGFzdC5vID0gc3VidHlwZXNbYy50XS5jb21wb3NlKGxhc3QubywgYy5vKTtcblxuICAgICAgLy8gY29udmVydCBiYWNrIHRvIG9sZCBzdHJpbmcgb3BzXG4gICAgICBpZiAoYy5zaSAhPSBudWxsIHx8IGMuc2QgIT0gbnVsbCkge1xuICAgICAgICB2YXIgcCA9IGMucDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsYXN0Lm8ubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgICAgYy5vID0gW2xhc3Quby5wb3AoKV07XG4gICAgICAgICAgYy5wID0gcC5zbGljZSgpO1xuICAgICAgICAgIGNvbnZlcnRUb1RleHQoYyk7XG4gICAgICAgICAgZGVzdC5wdXNoKGMpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29udmVydFRvVGV4dChsYXN0KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGxhc3QubmEgIT0gbnVsbCAmJiBjLm5hICE9IG51bGwpIHtcbiAgICAgIGRlc3RbZGVzdC5sZW5ndGggLSAxXSA9IHtwOiBsYXN0LnAsIG5hOiBsYXN0Lm5hICsgYy5uYX07XG4gICAgfSBlbHNlIGlmIChsYXN0LmxpICE9PSB1bmRlZmluZWQgJiYgYy5saSA9PT0gdW5kZWZpbmVkICYmIGMubGQgPT09IGxhc3QubGkpIHtcbiAgICAgIC8vIGluc2VydCBpbW1lZGlhdGVseSBmb2xsb3dlZCBieSBkZWxldGUgYmVjb21lcyBhIG5vb3AuXG4gICAgICBpZiAobGFzdC5sZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIGxlYXZlIHRoZSBkZWxldGUgcGFydCBvZiB0aGUgcmVwbGFjZVxuICAgICAgICBkZWxldGUgbGFzdC5saTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlc3QucG9wKCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChsYXN0Lm9kICE9PSB1bmRlZmluZWQgJiYgbGFzdC5vaSA9PT0gdW5kZWZpbmVkICYmIGMub2kgIT09IHVuZGVmaW5lZCAmJiBjLm9kID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGxhc3Qub2kgPSBjLm9pO1xuICAgIH0gZWxzZSBpZiAobGFzdC5vaSAhPT0gdW5kZWZpbmVkICYmIGMub2QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gVGhlIGxhc3QgcGF0aCBjb21wb25lbnQgaW5zZXJ0ZWQgc29tZXRoaW5nIHRoYXQgdGhlIG5ldyBjb21wb25lbnQgZGVsZXRlcyAob3IgcmVwbGFjZXMpLlxuICAgICAgLy8gSnVzdCBtZXJnZSB0aGVtLlxuICAgICAgaWYgKGMub2kgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBsYXN0Lm9pID0gYy5vaTtcbiAgICAgIH0gZWxzZSBpZiAobGFzdC5vZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGRlbGV0ZSBsYXN0Lm9pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQW4gaW5zZXJ0IGRpcmVjdGx5IGZvbGxvd2VkIGJ5IGEgZGVsZXRlIHR1cm5zIGludG8gYSBuby1vcCBhbmQgY2FuIGJlIHJlbW92ZWQuXG4gICAgICAgIGRlc3QucG9wKCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjLmxtICE9PSB1bmRlZmluZWQgJiYgYy5wW2MucC5sZW5ndGggLSAxXSA9PT0gYy5sbSkge1xuICAgICAgLy8gZG9uJ3QgZG8gYW55dGhpbmdcbiAgICB9IGVsc2Uge1xuICAgICAgZGVzdC5wdXNoKGMpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBjb252ZXJ0IHN0cmluZyBvcHMgYmFja1xuICAgIGlmICgoYy5zaSAhPSBudWxsIHx8IGMuc2QgIT0gbnVsbCkgJiYgKGxhc3Quc2kgIT0gbnVsbCB8fCBsYXN0LnNkICE9IG51bGwpKSB7XG4gICAgICBjb252ZXJ0VG9UZXh0KGMpO1xuICAgICAgY29udmVydFRvVGV4dChsYXN0KTtcbiAgICB9XG5cbiAgICBkZXN0LnB1c2goYyk7XG4gIH1cbn07XG5cbmpzb24uY29tcG9zZSA9IGZ1bmN0aW9uKG9wMSxvcDIpIHtcbiAganNvbi5jaGVja1ZhbGlkT3Aob3AxKTtcbiAganNvbi5jaGVja1ZhbGlkT3Aob3AyKTtcblxuICB2YXIgbmV3T3AgPSBjbG9uZShvcDEpO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AyLmxlbmd0aDsgaSsrKSB7XG4gICAganNvbi5hcHBlbmQobmV3T3Asb3AyW2ldKTtcbiAgfVxuXG4gIHJldHVybiBuZXdPcDtcbn07XG5cbmpzb24ubm9ybWFsaXplID0gZnVuY3Rpb24ob3ApIHtcbiAgdmFyIG5ld09wID0gW107XG5cbiAgb3AgPSBpc0FycmF5KG9wKSA/IG9wIDogW29wXTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IG9wLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGMgPSBvcFtpXTtcbiAgICBpZiAoYy5wID09IG51bGwpIGMucCA9IFtdO1xuXG4gICAganNvbi5hcHBlbmQobmV3T3AsYyk7XG4gIH1cblxuICByZXR1cm4gbmV3T3A7XG59O1xuXG4vLyBSZXR1cm5zIHRoZSBjb21tb24gbGVuZ3RoIG9mIHRoZSBwYXRocyBvZiBvcHMgYSBhbmQgYlxuanNvbi5jb21tb25MZW5ndGhGb3JPcHMgPSBmdW5jdGlvbihhLCBiKSB7XG4gIHZhciBhbGVuID0gYS5wLmxlbmd0aDtcbiAgdmFyIGJsZW4gPSBiLnAubGVuZ3RoO1xuICBpZiAoYS5uYSAhPSBudWxsIHx8IGEudClcbiAgICBhbGVuKys7XG5cbiAgaWYgKGIubmEgIT0gbnVsbCB8fCBiLnQpXG4gICAgYmxlbisrO1xuXG4gIGlmIChhbGVuID09PSAwKSByZXR1cm4gLTE7XG4gIGlmIChibGVuID09PSAwKSByZXR1cm4gbnVsbDtcblxuICBhbGVuLS07XG4gIGJsZW4tLTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGFsZW47IGkrKykge1xuICAgIHZhciBwID0gYS5wW2ldO1xuICAgIGlmIChpID49IGJsZW4gfHwgcCAhPT0gYi5wW2ldKVxuICAgICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gYWxlbjtcbn07XG5cbi8vIFJldHVybnMgdHJ1ZSBpZiBhbiBvcCBjYW4gYWZmZWN0IHRoZSBnaXZlbiBwYXRoXG5qc29uLmNhbk9wQWZmZWN0UGF0aCA9IGZ1bmN0aW9uKG9wLCBwYXRoKSB7XG4gIHJldHVybiBqc29uLmNvbW1vbkxlbmd0aEZvck9wcyh7cDpwYXRofSwgb3ApICE9IG51bGw7XG59O1xuXG4vLyB0cmFuc2Zvcm0gYyBzbyBpdCBhcHBsaWVzIHRvIGEgZG9jdW1lbnQgd2l0aCBvdGhlckMgYXBwbGllZC5cbmpzb24udHJhbnNmb3JtQ29tcG9uZW50ID0gZnVuY3Rpb24oZGVzdCwgYywgb3RoZXJDLCB0eXBlKSB7XG4gIGMgPSBjbG9uZShjKTtcblxuICB2YXIgY29tbW9uID0ganNvbi5jb21tb25MZW5ndGhGb3JPcHMob3RoZXJDLCBjKTtcbiAgdmFyIGNvbW1vbjIgPSBqc29uLmNvbW1vbkxlbmd0aEZvck9wcyhjLCBvdGhlckMpO1xuICB2YXIgY3BsZW5ndGggPSBjLnAubGVuZ3RoO1xuICB2YXIgb3RoZXJDcGxlbmd0aCA9IG90aGVyQy5wLmxlbmd0aDtcblxuICBpZiAoYy5uYSAhPSBudWxsIHx8IGMudClcbiAgICBjcGxlbmd0aCsrO1xuXG4gIGlmIChvdGhlckMubmEgIT0gbnVsbCB8fCBvdGhlckMudClcbiAgICBvdGhlckNwbGVuZ3RoKys7XG5cbiAgLy8gaWYgYyBpcyBkZWxldGluZyBzb21ldGhpbmcsIGFuZCB0aGF0IHRoaW5nIGlzIGNoYW5nZWQgYnkgb3RoZXJDLCB3ZSBuZWVkIHRvXG4gIC8vIHVwZGF0ZSBjIHRvIHJlZmxlY3QgdGhhdCBjaGFuZ2UgZm9yIGludmVydGliaWxpdHkuXG4gIGlmIChjb21tb24yICE9IG51bGwgJiYgb3RoZXJDcGxlbmd0aCA+IGNwbGVuZ3RoICYmIGMucFtjb21tb24yXSA9PSBvdGhlckMucFtjb21tb24yXSkge1xuICAgIGlmIChjLmxkICE9PSB2b2lkIDApIHtcbiAgICAgIHZhciBvYyA9IGNsb25lKG90aGVyQyk7XG4gICAgICBvYy5wID0gb2MucC5zbGljZShjcGxlbmd0aCk7XG4gICAgICBjLmxkID0ganNvbi5hcHBseShjbG9uZShjLmxkKSxbb2NdKTtcbiAgICB9IGVsc2UgaWYgKGMub2QgIT09IHZvaWQgMCkge1xuICAgICAgdmFyIG9jID0gY2xvbmUob3RoZXJDKTtcbiAgICAgIG9jLnAgPSBvYy5wLnNsaWNlKGNwbGVuZ3RoKTtcbiAgICAgIGMub2QgPSBqc29uLmFwcGx5KGNsb25lKGMub2QpLFtvY10pO1xuICAgIH1cbiAgfVxuXG4gIGlmIChjb21tb24gIT0gbnVsbCkge1xuICAgIHZhciBjb21tb25PcGVyYW5kID0gY3BsZW5ndGggPT0gb3RoZXJDcGxlbmd0aDtcblxuICAgIC8vIGJhY2t3YXJkIGNvbXBhdGliaWxpdHkgZm9yIG9sZCBzdHJpbmcgb3BzXG4gICAgdmFyIG9jID0gb3RoZXJDO1xuICAgIGlmICgoYy5zaSAhPSBudWxsIHx8IGMuc2QgIT0gbnVsbCkgJiYgKG90aGVyQy5zaSAhPSBudWxsIHx8IG90aGVyQy5zZCAhPSBudWxsKSkge1xuICAgICAgY29udmVydEZyb21UZXh0KGMpO1xuICAgICAgb2MgPSBjbG9uZShvdGhlckMpO1xuICAgICAgY29udmVydEZyb21UZXh0KG9jKTtcbiAgICB9XG5cbiAgICAvLyBoYW5kbGUgc3VidHlwZSBvcHNcbiAgICBpZiAob2MudCAmJiBzdWJ0eXBlc1tvYy50XSkge1xuICAgICAgaWYgKGMudCAmJiBjLnQgPT09IG9jLnQpIHtcbiAgICAgICAgdmFyIHJlcyA9IHN1YnR5cGVzW2MudF0udHJhbnNmb3JtKGMubywgb2MubywgdHlwZSk7XG5cbiAgICAgICAgaWYgKHJlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgLy8gY29udmVydCBiYWNrIHRvIG9sZCBzdHJpbmcgb3BzXG4gICAgICAgICAgaWYgKGMuc2kgIT0gbnVsbCB8fCBjLnNkICE9IG51bGwpIHtcbiAgICAgICAgICAgIHZhciBwID0gYy5wO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgYy5vID0gW3Jlc1tpXV07XG4gICAgICAgICAgICAgIGMucCA9IHAuc2xpY2UoKTtcbiAgICAgICAgICAgICAgY29udmVydFRvVGV4dChjKTtcbiAgICAgICAgICAgICAganNvbi5hcHBlbmQoZGVzdCwgYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGMubyA9IHJlcztcbiAgICAgICAgICAgIGpzb24uYXBwZW5kKGRlc3QsIGMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkZXN0O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHRyYW5zZm9ybSBiYXNlZCBvbiBvdGhlckNcbiAgICBlbHNlIGlmIChvdGhlckMubmEgIT09IHZvaWQgMCkge1xuICAgICAgLy8gdGhpcyBjYXNlIGlzIGhhbmRsZWQgYmVsb3dcbiAgICB9IGVsc2UgaWYgKG90aGVyQy5saSAhPT0gdm9pZCAwICYmIG90aGVyQy5sZCAhPT0gdm9pZCAwKSB7XG4gICAgICBpZiAob3RoZXJDLnBbY29tbW9uXSA9PT0gYy5wW2NvbW1vbl0pIHtcbiAgICAgICAgLy8gbm9vcFxuXG4gICAgICAgIGlmICghY29tbW9uT3BlcmFuZCkge1xuICAgICAgICAgIHJldHVybiBkZXN0O1xuICAgICAgICB9IGVsc2UgaWYgKGMubGQgIT09IHZvaWQgMCkge1xuICAgICAgICAgIC8vIHdlJ3JlIHRyeWluZyB0byBkZWxldGUgdGhlIHNhbWUgZWxlbWVudCwgLT4gbm9vcFxuICAgICAgICAgIGlmIChjLmxpICE9PSB2b2lkIDAgJiYgdHlwZSA9PT0gJ2xlZnQnKSB7XG4gICAgICAgICAgICAvLyB3ZSdyZSBib3RoIHJlcGxhY2luZyBvbmUgZWxlbWVudCB3aXRoIGFub3RoZXIuIG9ubHkgb25lIGNhbiBzdXJ2aXZlXG4gICAgICAgICAgICBjLmxkID0gY2xvbmUob3RoZXJDLmxpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGRlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChvdGhlckMubGkgIT09IHZvaWQgMCkge1xuICAgICAgaWYgKGMubGkgIT09IHZvaWQgMCAmJiBjLmxkID09PSB1bmRlZmluZWQgJiYgY29tbW9uT3BlcmFuZCAmJiBjLnBbY29tbW9uXSA9PT0gb3RoZXJDLnBbY29tbW9uXSkge1xuICAgICAgICAvLyBpbiBsaSB2cy4gbGksIGxlZnQgd2lucy5cbiAgICAgICAgaWYgKHR5cGUgPT09ICdyaWdodCcpXG4gICAgICAgICAgYy5wW2NvbW1vbl0rKztcbiAgICAgIH0gZWxzZSBpZiAob3RoZXJDLnBbY29tbW9uXSA8PSBjLnBbY29tbW9uXSkge1xuICAgICAgICBjLnBbY29tbW9uXSsrO1xuICAgICAgfVxuXG4gICAgICBpZiAoYy5sbSAhPT0gdm9pZCAwKSB7XG4gICAgICAgIGlmIChjb21tb25PcGVyYW5kKSB7XG4gICAgICAgICAgLy8gb3RoZXJDIGVkaXRzIHRoZSBzYW1lIGxpc3Qgd2UgZWRpdFxuICAgICAgICAgIGlmIChvdGhlckMucFtjb21tb25dIDw9IGMubG0pXG4gICAgICAgICAgICBjLmxtKys7XG4gICAgICAgICAgLy8gY2hhbmdpbmcgYy5mcm9tIGlzIGhhbmRsZWQgYWJvdmUuXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG90aGVyQy5sZCAhPT0gdm9pZCAwKSB7XG4gICAgICBpZiAoYy5sbSAhPT0gdm9pZCAwKSB7XG4gICAgICAgIGlmIChjb21tb25PcGVyYW5kKSB7XG4gICAgICAgICAgaWYgKG90aGVyQy5wW2NvbW1vbl0gPT09IGMucFtjb21tb25dKSB7XG4gICAgICAgICAgICAvLyB0aGV5IGRlbGV0ZWQgdGhlIHRoaW5nIHdlJ3JlIHRyeWluZyB0byBtb3ZlXG4gICAgICAgICAgICByZXR1cm4gZGVzdDtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gb3RoZXJDIGVkaXRzIHRoZSBzYW1lIGxpc3Qgd2UgZWRpdFxuICAgICAgICAgIHZhciBwID0gb3RoZXJDLnBbY29tbW9uXTtcbiAgICAgICAgICB2YXIgZnJvbSA9IGMucFtjb21tb25dO1xuICAgICAgICAgIHZhciB0byA9IGMubG07XG4gICAgICAgICAgaWYgKHAgPCB0byB8fCAocCA9PT0gdG8gJiYgZnJvbSA8IHRvKSlcbiAgICAgICAgICAgIGMubG0tLTtcblxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChvdGhlckMucFtjb21tb25dIDwgYy5wW2NvbW1vbl0pIHtcbiAgICAgICAgYy5wW2NvbW1vbl0tLTtcbiAgICAgIH0gZWxzZSBpZiAob3RoZXJDLnBbY29tbW9uXSA9PT0gYy5wW2NvbW1vbl0pIHtcbiAgICAgICAgaWYgKG90aGVyQ3BsZW5ndGggPCBjcGxlbmd0aCkge1xuICAgICAgICAgIC8vIHdlJ3JlIGJlbG93IHRoZSBkZWxldGVkIGVsZW1lbnQsIHNvIC0+IG5vb3BcbiAgICAgICAgICByZXR1cm4gZGVzdDtcbiAgICAgICAgfSBlbHNlIGlmIChjLmxkICE9PSB2b2lkIDApIHtcbiAgICAgICAgICBpZiAoYy5saSAhPT0gdm9pZCAwKSB7XG4gICAgICAgICAgICAvLyB3ZSdyZSByZXBsYWNpbmcsIHRoZXkncmUgZGVsZXRpbmcuIHdlIGJlY29tZSBhbiBpbnNlcnQuXG4gICAgICAgICAgICBkZWxldGUgYy5sZDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gd2UncmUgdHJ5aW5nIHRvIGRlbGV0ZSB0aGUgc2FtZSBlbGVtZW50LCAtPiBub29wXG4gICAgICAgICAgICByZXR1cm4gZGVzdDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgIH0gZWxzZSBpZiAob3RoZXJDLmxtICE9PSB2b2lkIDApIHtcbiAgICAgIGlmIChjLmxtICE9PSB2b2lkIDAgJiYgY3BsZW5ndGggPT09IG90aGVyQ3BsZW5ndGgpIHtcbiAgICAgICAgLy8gbG0gdnMgbG0sIGhlcmUgd2UgZ28hXG4gICAgICAgIHZhciBmcm9tID0gYy5wW2NvbW1vbl07XG4gICAgICAgIHZhciB0byA9IGMubG07XG4gICAgICAgIHZhciBvdGhlckZyb20gPSBvdGhlckMucFtjb21tb25dO1xuICAgICAgICB2YXIgb3RoZXJUbyA9IG90aGVyQy5sbTtcbiAgICAgICAgaWYgKG90aGVyRnJvbSAhPT0gb3RoZXJUbykge1xuICAgICAgICAgIC8vIGlmIG90aGVyRnJvbSA9PSBvdGhlclRvLCB3ZSBkb24ndCBuZWVkIHRvIGNoYW5nZSBvdXIgb3AuXG5cbiAgICAgICAgICAvLyB3aGVyZSBkaWQgbXkgdGhpbmcgZ28/XG4gICAgICAgICAgaWYgKGZyb20gPT09IG90aGVyRnJvbSkge1xuICAgICAgICAgICAgLy8gdGhleSBtb3ZlZCBpdCEgdGllIGJyZWFrLlxuICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdsZWZ0Jykge1xuICAgICAgICAgICAgICBjLnBbY29tbW9uXSA9IG90aGVyVG87XG4gICAgICAgICAgICAgIGlmIChmcm9tID09PSB0bykgLy8gdWdoXG4gICAgICAgICAgICAgICAgYy5sbSA9IG90aGVyVG87XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gZGVzdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdGhleSBtb3ZlZCBhcm91bmQgaXRcbiAgICAgICAgICAgIGlmIChmcm9tID4gb3RoZXJGcm9tKSBjLnBbY29tbW9uXS0tO1xuICAgICAgICAgICAgaWYgKGZyb20gPiBvdGhlclRvKSBjLnBbY29tbW9uXSsrO1xuICAgICAgICAgICAgZWxzZSBpZiAoZnJvbSA9PT0gb3RoZXJUbykge1xuICAgICAgICAgICAgICBpZiAob3RoZXJGcm9tID4gb3RoZXJUbykge1xuICAgICAgICAgICAgICAgIGMucFtjb21tb25dKys7XG4gICAgICAgICAgICAgICAgaWYgKGZyb20gPT09IHRvKSAvLyB1Z2gsIGFnYWluXG4gICAgICAgICAgICAgICAgICBjLmxtKys7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc3RlcCAyOiB3aGVyZSBhbSBpIGdvaW5nIHRvIHB1dCBpdD9cbiAgICAgICAgICAgIGlmICh0byA+IG90aGVyRnJvbSkge1xuICAgICAgICAgICAgICBjLmxtLS07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRvID09PSBvdGhlckZyb20pIHtcbiAgICAgICAgICAgICAgaWYgKHRvID4gZnJvbSlcbiAgICAgICAgICAgICAgICBjLmxtLS07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodG8gPiBvdGhlclRvKSB7XG4gICAgICAgICAgICAgIGMubG0rKztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodG8gPT09IG90aGVyVG8pIHtcbiAgICAgICAgICAgICAgLy8gaWYgd2UncmUgYm90aCBtb3ZpbmcgaW4gdGhlIHNhbWUgZGlyZWN0aW9uLCB0aWUgYnJlYWtcbiAgICAgICAgICAgICAgaWYgKChvdGhlclRvID4gb3RoZXJGcm9tICYmIHRvID4gZnJvbSkgfHxcbiAgICAgICAgICAgICAgICAgIChvdGhlclRvIDwgb3RoZXJGcm9tICYmIHRvIDwgZnJvbSkpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZSA9PT0gJ3JpZ2h0JykgYy5sbSsrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0byA+IGZyb20pIGMubG0rKztcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0byA9PT0gb3RoZXJGcm9tKSBjLmxtLS07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoYy5saSAhPT0gdm9pZCAwICYmIGMubGQgPT09IHVuZGVmaW5lZCAmJiBjb21tb25PcGVyYW5kKSB7XG4gICAgICAgIC8vIGxpXG4gICAgICAgIHZhciBmcm9tID0gb3RoZXJDLnBbY29tbW9uXTtcbiAgICAgICAgdmFyIHRvID0gb3RoZXJDLmxtO1xuICAgICAgICBwID0gYy5wW2NvbW1vbl07XG4gICAgICAgIGlmIChwID4gZnJvbSkgYy5wW2NvbW1vbl0tLTtcbiAgICAgICAgaWYgKHAgPiB0bykgYy5wW2NvbW1vbl0rKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGxkLCBsZCtsaSwgc2ksIHNkLCBuYSwgb2ksIG9kLCBvaStvZCwgYW55IGxpIG9uIGFuIGVsZW1lbnQgYmVuZWF0aFxuICAgICAgICAvLyB0aGUgbG1cbiAgICAgICAgLy9cbiAgICAgICAgLy8gaS5lLiB0aGluZ3MgY2FyZSBhYm91dCB3aGVyZSB0aGVpciBpdGVtIGlzIGFmdGVyIHRoZSBtb3ZlLlxuICAgICAgICB2YXIgZnJvbSA9IG90aGVyQy5wW2NvbW1vbl07XG4gICAgICAgIHZhciB0byA9IG90aGVyQy5sbTtcbiAgICAgICAgcCA9IGMucFtjb21tb25dO1xuICAgICAgICBpZiAocCA9PT0gZnJvbSkge1xuICAgICAgICAgIGMucFtjb21tb25dID0gdG87XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHAgPiBmcm9tKSBjLnBbY29tbW9uXS0tO1xuICAgICAgICAgIGlmIChwID4gdG8pIGMucFtjb21tb25dKys7XG4gICAgICAgICAgZWxzZSBpZiAocCA9PT0gdG8gJiYgZnJvbSA+IHRvKSBjLnBbY29tbW9uXSsrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2UgaWYgKG90aGVyQy5vaSAhPT0gdm9pZCAwICYmIG90aGVyQy5vZCAhPT0gdm9pZCAwKSB7XG4gICAgICBpZiAoYy5wW2NvbW1vbl0gPT09IG90aGVyQy5wW2NvbW1vbl0pIHtcbiAgICAgICAgaWYgKGMub2kgIT09IHZvaWQgMCAmJiBjb21tb25PcGVyYW5kKSB7XG4gICAgICAgICAgLy8gd2UgaW5zZXJ0ZWQgd2hlcmUgc29tZW9uZSBlbHNlIHJlcGxhY2VkXG4gICAgICAgICAgaWYgKHR5cGUgPT09ICdyaWdodCcpIHtcbiAgICAgICAgICAgIC8vIGxlZnQgd2luc1xuICAgICAgICAgICAgcmV0dXJuIGRlc3Q7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHdlIHdpbiwgbWFrZSBvdXIgb3AgcmVwbGFjZSB3aGF0IHRoZXkgaW5zZXJ0ZWRcbiAgICAgICAgICAgIGMub2QgPSBvdGhlckMub2k7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIC0+IG5vb3AgaWYgdGhlIG90aGVyIGNvbXBvbmVudCBpcyBkZWxldGluZyB0aGUgc2FtZSBvYmplY3QgKG9yIGFueSBwYXJlbnQpXG4gICAgICAgICAgcmV0dXJuIGRlc3Q7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG90aGVyQy5vaSAhPT0gdm9pZCAwKSB7XG4gICAgICBpZiAoYy5vaSAhPT0gdm9pZCAwICYmIGMucFtjb21tb25dID09PSBvdGhlckMucFtjb21tb25dKSB7XG4gICAgICAgIC8vIGxlZnQgd2lucyBpZiB3ZSB0cnkgdG8gaW5zZXJ0IGF0IHRoZSBzYW1lIHBsYWNlXG4gICAgICAgIGlmICh0eXBlID09PSAnbGVmdCcpIHtcbiAgICAgICAgICBqc29uLmFwcGVuZChkZXN0LHtwOiBjLnAsIG9kOm90aGVyQy5vaX0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBkZXN0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChvdGhlckMub2QgIT09IHZvaWQgMCkge1xuICAgICAgaWYgKGMucFtjb21tb25dID09IG90aGVyQy5wW2NvbW1vbl0pIHtcbiAgICAgICAgaWYgKCFjb21tb25PcGVyYW5kKVxuICAgICAgICAgIHJldHVybiBkZXN0O1xuICAgICAgICBpZiAoYy5vaSAhPT0gdm9pZCAwKSB7XG4gICAgICAgICAgZGVsZXRlIGMub2Q7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGRlc3Q7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBqc29uLmFwcGVuZChkZXN0LGMpO1xuICByZXR1cm4gZGVzdDtcbn07XG5cbnJlcXVpcmUoJy4vYm9vdHN0cmFwVHJhbnNmb3JtJykoanNvbiwganNvbi50cmFuc2Zvcm1Db21wb25lbnQsIGpzb24uY2hlY2tWYWxpZE9wLCBqc29uLmFwcGVuZCk7XG5cbi8qKlxuICogUmVnaXN0ZXIgYSBzdWJ0eXBlIGZvciBzdHJpbmcgb3BlcmF0aW9ucywgdXNpbmcgdGhlIHRleHQwIHR5cGUuXG4gKi9cbnZhciB0ZXh0ID0gcmVxdWlyZSgnLi90ZXh0MCcpO1xuXG5qc29uLnJlZ2lzdGVyU3VidHlwZSh0ZXh0KTtcbm1vZHVsZS5leHBvcnRzID0ganNvbjtcblxuIiwiLy8gREVQUkVDQVRFRCFcbi8vXG4vLyBUaGlzIHR5cGUgd29ya3MsIGJ1dCBpcyBub3QgZXhwb3J0ZWQuIEl0cyBpbmNsdWRlZCBoZXJlIGJlY2F1c2UgdGhlIEpTT04wXG4vLyBlbWJlZGRlZCBzdHJpbmcgb3BlcmF0aW9ucyB1c2UgdGhpcyBsaWJyYXJ5LlxuXG5cbi8vIEEgc2ltcGxlIHRleHQgaW1wbGVtZW50YXRpb25cbi8vXG4vLyBPcGVyYXRpb25zIGFyZSBsaXN0cyBvZiBjb21wb25lbnRzLiBFYWNoIGNvbXBvbmVudCBlaXRoZXIgaW5zZXJ0cyBvciBkZWxldGVzXG4vLyBhdCBhIHNwZWNpZmllZCBwb3NpdGlvbiBpbiB0aGUgZG9jdW1lbnQuXG4vL1xuLy8gQ29tcG9uZW50cyBhcmUgZWl0aGVyOlxuLy8gIHtpOidzdHInLCBwOjEwMH06IEluc2VydCAnc3RyJyBhdCBwb3NpdGlvbiAxMDAgaW4gdGhlIGRvY3VtZW50XG4vLyAge2Q6J3N0cicsIHA6MTAwfTogRGVsZXRlICdzdHInIGF0IHBvc2l0aW9uIDEwMCBpbiB0aGUgZG9jdW1lbnRcbi8vXG4vLyBDb21wb25lbnRzIGluIGFuIG9wZXJhdGlvbiBhcmUgZXhlY3V0ZWQgc2VxdWVudGlhbGx5LCBzbyB0aGUgcG9zaXRpb24gb2YgY29tcG9uZW50c1xuLy8gYXNzdW1lcyBwcmV2aW91cyBjb21wb25lbnRzIGhhdmUgYWxyZWFkeSBleGVjdXRlZC5cbi8vXG4vLyBFZzogVGhpcyBvcDpcbi8vICAgW3tpOidhYmMnLCBwOjB9XVxuLy8gaXMgZXF1aXZhbGVudCB0byB0aGlzIG9wOlxuLy8gICBbe2k6J2EnLCBwOjB9LCB7aTonYicsIHA6MX0sIHtpOidjJywgcDoyfV1cblxudmFyIHRleHQgPSBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgbmFtZTogJ3RleHQwJyxcbiAgdXJpOiAnaHR0cDovL3NoYXJlanMub3JnL3R5cGVzL3RleHR2MCcsXG4gIGNyZWF0ZTogZnVuY3Rpb24oaW5pdGlhbCkge1xuICAgIGlmICgoaW5pdGlhbCAhPSBudWxsKSAmJiB0eXBlb2YgaW5pdGlhbCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW5pdGlhbCBkYXRhIG11c3QgYmUgYSBzdHJpbmcnKTtcbiAgICB9XG4gICAgcmV0dXJuIGluaXRpYWwgfHwgJyc7XG4gIH1cbn07XG5cbi8qKiBJbnNlcnQgczIgaW50byBzMSBhdCBwb3MuICovXG52YXIgc3RySW5qZWN0ID0gZnVuY3Rpb24oczEsIHBvcywgczIpIHtcbiAgcmV0dXJuIHMxLnNsaWNlKDAsIHBvcykgKyBzMiArIHMxLnNsaWNlKHBvcyk7XG59O1xuXG4vKiogQ2hlY2sgdGhhdCBhbiBvcGVyYXRpb24gY29tcG9uZW50IGlzIHZhbGlkLiBUaHJvd3MgaWYgaXRzIGludmFsaWQuICovXG52YXIgY2hlY2tWYWxpZENvbXBvbmVudCA9IGZ1bmN0aW9uKGMpIHtcbiAgaWYgKHR5cGVvZiBjLnAgIT09ICdudW1iZXInKVxuICAgIHRocm93IG5ldyBFcnJvcignY29tcG9uZW50IG1pc3NpbmcgcG9zaXRpb24gZmllbGQnKTtcblxuICBpZiAoKHR5cGVvZiBjLmkgPT09ICdzdHJpbmcnKSA9PT0gKHR5cGVvZiBjLmQgPT09ICdzdHJpbmcnKSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvbXBvbmVudCBuZWVkcyBhbiBpIG9yIGQgZmllbGQnKTtcblxuICBpZiAoYy5wIDwgMClcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Bvc2l0aW9uIGNhbm5vdCBiZSBuZWdhdGl2ZScpO1xufTtcblxuLyoqIENoZWNrIHRoYXQgYW4gb3BlcmF0aW9uIGlzIHZhbGlkICovXG52YXIgY2hlY2tWYWxpZE9wID0gZnVuY3Rpb24ob3ApIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5sZW5ndGg7IGkrKykge1xuICAgIGNoZWNrVmFsaWRDb21wb25lbnQob3BbaV0pO1xuICB9XG59O1xuXG4vKiogQXBwbHkgb3AgdG8gc25hcHNob3QgKi9cbnRleHQuYXBwbHkgPSBmdW5jdGlvbihzbmFwc2hvdCwgb3ApIHtcbiAgdmFyIGRlbGV0ZWQ7XG5cbiAgY2hlY2tWYWxpZE9wKG9wKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBjb21wb25lbnQgPSBvcFtpXTtcbiAgICBpZiAoY29tcG9uZW50LmkgIT0gbnVsbCkge1xuICAgICAgc25hcHNob3QgPSBzdHJJbmplY3Qoc25hcHNob3QsIGNvbXBvbmVudC5wLCBjb21wb25lbnQuaSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlbGV0ZWQgPSBzbmFwc2hvdC5zbGljZShjb21wb25lbnQucCwgY29tcG9uZW50LnAgKyBjb21wb25lbnQuZC5sZW5ndGgpO1xuICAgICAgaWYgKGNvbXBvbmVudC5kICE9PSBkZWxldGVkKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJEZWxldGUgY29tcG9uZW50ICdcIiArIGNvbXBvbmVudC5kICsgXCInIGRvZXMgbm90IG1hdGNoIGRlbGV0ZWQgdGV4dCAnXCIgKyBkZWxldGVkICsgXCInXCIpO1xuXG4gICAgICBzbmFwc2hvdCA9IHNuYXBzaG90LnNsaWNlKDAsIGNvbXBvbmVudC5wKSArIHNuYXBzaG90LnNsaWNlKGNvbXBvbmVudC5wICsgY29tcG9uZW50LmQubGVuZ3RoKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHNuYXBzaG90O1xufTtcblxuLyoqXG4gKiBBcHBlbmQgYSBjb21wb25lbnQgdG8gdGhlIGVuZCBvZiBuZXdPcC4gRXhwb3J0ZWQgZm9yIHVzZSBieSB0aGUgcmFuZG9tIG9wXG4gKiBnZW5lcmF0b3IgYW5kIHRoZSBKU09OMCB0eXBlLlxuICovXG52YXIgYXBwZW5kID0gdGV4dC5fYXBwZW5kID0gZnVuY3Rpb24obmV3T3AsIGMpIHtcbiAgaWYgKGMuaSA9PT0gJycgfHwgYy5kID09PSAnJykgcmV0dXJuO1xuXG4gIGlmIChuZXdPcC5sZW5ndGggPT09IDApIHtcbiAgICBuZXdPcC5wdXNoKGMpO1xuICB9IGVsc2Uge1xuICAgIHZhciBsYXN0ID0gbmV3T3BbbmV3T3AubGVuZ3RoIC0gMV07XG5cbiAgICBpZiAobGFzdC5pICE9IG51bGwgJiYgYy5pICE9IG51bGwgJiYgbGFzdC5wIDw9IGMucCAmJiBjLnAgPD0gbGFzdC5wICsgbGFzdC5pLmxlbmd0aCkge1xuICAgICAgLy8gQ29tcG9zZSB0aGUgaW5zZXJ0IGludG8gdGhlIHByZXZpb3VzIGluc2VydFxuICAgICAgbmV3T3BbbmV3T3AubGVuZ3RoIC0gMV0gPSB7aTpzdHJJbmplY3QobGFzdC5pLCBjLnAgLSBsYXN0LnAsIGMuaSksIHA6bGFzdC5wfTtcblxuICAgIH0gZWxzZSBpZiAobGFzdC5kICE9IG51bGwgJiYgYy5kICE9IG51bGwgJiYgYy5wIDw9IGxhc3QucCAmJiBsYXN0LnAgPD0gYy5wICsgYy5kLmxlbmd0aCkge1xuICAgICAgLy8gQ29tcG9zZSB0aGUgZGVsZXRlcyB0b2dldGhlclxuICAgICAgbmV3T3BbbmV3T3AubGVuZ3RoIC0gMV0gPSB7ZDpzdHJJbmplY3QoYy5kLCBsYXN0LnAgLSBjLnAsIGxhc3QuZCksIHA6Yy5wfTtcblxuICAgIH0gZWxzZSB7XG4gICAgICBuZXdPcC5wdXNoKGMpO1xuICAgIH1cbiAgfVxufTtcblxuLyoqIENvbXBvc2Ugb3AxIGFuZCBvcDIgdG9nZXRoZXIgKi9cbnRleHQuY29tcG9zZSA9IGZ1bmN0aW9uKG9wMSwgb3AyKSB7XG4gIGNoZWNrVmFsaWRPcChvcDEpO1xuICBjaGVja1ZhbGlkT3Aob3AyKTtcbiAgdmFyIG5ld09wID0gb3AxLnNsaWNlKCk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AyLmxlbmd0aDsgaSsrKSB7XG4gICAgYXBwZW5kKG5ld09wLCBvcDJbaV0pO1xuICB9XG4gIHJldHVybiBuZXdPcDtcbn07XG5cbi8qKiBDbGVhbiB1cCBhbiBvcCAqL1xudGV4dC5ub3JtYWxpemUgPSBmdW5jdGlvbihvcCkge1xuICB2YXIgbmV3T3AgPSBbXTtcblxuICAvLyBOb3JtYWxpemUgc2hvdWxkIGFsbG93IG9wcyB3aGljaCBhcmUgYSBzaW5nbGUgKHVud3JhcHBlZCkgY29tcG9uZW50OlxuICAvLyB7aTonYXNkZicsIHA6MjN9LlxuICAvLyBUaGVyZSdzIG5vIGdvb2Qgd2F5IHRvIHRlc3QgaWYgc29tZXRoaW5nIGlzIGFuIGFycmF5OlxuICAvLyBodHRwOi8vcGVyZmVjdGlvbmtpbGxzLmNvbS9pbnN0YW5jZW9mLWNvbnNpZGVyZWQtaGFybWZ1bC1vci1ob3ctdG8td3JpdGUtYS1yb2J1c3QtaXNhcnJheS9cbiAgLy8gc28gdGhpcyBpcyBwcm9iYWJseSB0aGUgbGVhc3QgYmFkIHNvbHV0aW9uLlxuICBpZiAob3AuaSAhPSBudWxsIHx8IG9wLnAgIT0gbnVsbCkgb3AgPSBbb3BdO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYyA9IG9wW2ldO1xuICAgIGlmIChjLnAgPT0gbnVsbCkgYy5wID0gMDtcblxuICAgIGFwcGVuZChuZXdPcCwgYyk7XG4gIH1cblxuICByZXR1cm4gbmV3T3A7XG59O1xuXG4vLyBUaGlzIGhlbHBlciBtZXRob2QgdHJhbnNmb3JtcyBhIHBvc2l0aW9uIGJ5IGFuIG9wIGNvbXBvbmVudC5cbi8vXG4vLyBJZiBjIGlzIGFuIGluc2VydCwgaW5zZXJ0QWZ0ZXIgc3BlY2lmaWVzIHdoZXRoZXIgdGhlIHRyYW5zZm9ybVxuLy8gaXMgcHVzaGVkIGFmdGVyIHRoZSBpbnNlcnQgKHRydWUpIG9yIGJlZm9yZSBpdCAoZmFsc2UpLlxuLy9cbi8vIGluc2VydEFmdGVyIGlzIG9wdGlvbmFsIGZvciBkZWxldGVzLlxudmFyIHRyYW5zZm9ybVBvc2l0aW9uID0gZnVuY3Rpb24ocG9zLCBjLCBpbnNlcnRBZnRlcikge1xuICAvLyBUaGlzIHdpbGwgZ2V0IGNvbGxhcHNlZCBpbnRvIGEgZ2lhbnQgdGVybmFyeSBieSB1Z2xpZnkuXG4gIGlmIChjLmkgIT0gbnVsbCkge1xuICAgIGlmIChjLnAgPCBwb3MgfHwgKGMucCA9PT0gcG9zICYmIGluc2VydEFmdGVyKSkge1xuICAgICAgcmV0dXJuIHBvcyArIGMuaS5sZW5ndGg7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBwb3M7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIEkgdGhpbmsgdGhpcyBjb3VsZCBhbHNvIGJlIHdyaXR0ZW4gYXM6IE1hdGgubWluKGMucCwgTWF0aC5taW4oYy5wIC1cbiAgICAvLyBvdGhlckMucCwgb3RoZXJDLmQubGVuZ3RoKSkgYnV0IEkgdGhpbmsgaXRzIGhhcmRlciB0byByZWFkIHRoYXQgd2F5LCBhbmRcbiAgICAvLyBpdCBjb21waWxlcyB1c2luZyB0ZXJuYXJ5IG9wZXJhdG9ycyBhbnl3YXkgc28gaXRzIG5vIHNsb3dlciB3cml0dGVuIGxpa2VcbiAgICAvLyB0aGlzLlxuICAgIGlmIChwb3MgPD0gYy5wKSB7XG4gICAgICByZXR1cm4gcG9zO1xuICAgIH0gZWxzZSBpZiAocG9zIDw9IGMucCArIGMuZC5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBjLnA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBwb3MgLSBjLmQubGVuZ3RoO1xuICAgIH1cbiAgfVxufTtcblxuLy8gSGVscGVyIG1ldGhvZCB0byB0cmFuc2Zvcm0gYSBjdXJzb3IgcG9zaXRpb24gYXMgYSByZXN1bHQgb2YgYW4gb3AuXG4vL1xuLy8gTGlrZSB0cmFuc2Zvcm1Qb3NpdGlvbiBhYm92ZSwgaWYgYyBpcyBhbiBpbnNlcnQsIGluc2VydEFmdGVyIHNwZWNpZmllc1xuLy8gd2hldGhlciB0aGUgY3Vyc29yIHBvc2l0aW9uIGlzIHB1c2hlZCBhZnRlciBhbiBpbnNlcnQgKHRydWUpIG9yIGJlZm9yZSBpdFxuLy8gKGZhbHNlKS5cbnRleHQudHJhbnNmb3JtQ3Vyc29yID0gZnVuY3Rpb24ocG9zaXRpb24sIG9wLCBzaWRlKSB7XG4gIHZhciBpbnNlcnRBZnRlciA9IHNpZGUgPT09ICdyaWdodCc7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICBwb3NpdGlvbiA9IHRyYW5zZm9ybVBvc2l0aW9uKHBvc2l0aW9uLCBvcFtpXSwgaW5zZXJ0QWZ0ZXIpO1xuICB9XG5cbiAgcmV0dXJuIHBvc2l0aW9uO1xufTtcblxuLy8gVHJhbnNmb3JtIGFuIG9wIGNvbXBvbmVudCBieSBhbm90aGVyIG9wIGNvbXBvbmVudC4gQXN5bW1ldHJpYy5cbi8vIFRoZSByZXN1bHQgd2lsbCBiZSBhcHBlbmRlZCB0byBkZXN0aW5hdGlvbi5cbi8vXG4vLyBleHBvcnRlZCBmb3IgdXNlIGluIEpTT04gdHlwZVxudmFyIHRyYW5zZm9ybUNvbXBvbmVudCA9IHRleHQuX3RjID0gZnVuY3Rpb24oZGVzdCwgYywgb3RoZXJDLCBzaWRlKSB7XG4gIC8vdmFyIGNJbnRlcnNlY3QsIGludGVyc2VjdEVuZCwgaW50ZXJzZWN0U3RhcnQsIG5ld0MsIG90aGVySW50ZXJzZWN0LCBzO1xuXG4gIGNoZWNrVmFsaWRDb21wb25lbnQoYyk7XG4gIGNoZWNrVmFsaWRDb21wb25lbnQob3RoZXJDKTtcblxuICBpZiAoYy5pICE9IG51bGwpIHtcbiAgICAvLyBJbnNlcnQuXG4gICAgYXBwZW5kKGRlc3QsIHtpOmMuaSwgcDp0cmFuc2Zvcm1Qb3NpdGlvbihjLnAsIG90aGVyQywgc2lkZSA9PT0gJ3JpZ2h0Jyl9KTtcbiAgfSBlbHNlIHtcbiAgICAvLyBEZWxldGVcbiAgICBpZiAob3RoZXJDLmkgIT0gbnVsbCkge1xuICAgICAgLy8gRGVsZXRlIHZzIGluc2VydFxuICAgICAgdmFyIHMgPSBjLmQ7XG4gICAgICBpZiAoYy5wIDwgb3RoZXJDLnApIHtcbiAgICAgICAgYXBwZW5kKGRlc3QsIHtkOnMuc2xpY2UoMCwgb3RoZXJDLnAgLSBjLnApLCBwOmMucH0pO1xuICAgICAgICBzID0gcy5zbGljZShvdGhlckMucCAtIGMucCk7XG4gICAgICB9XG4gICAgICBpZiAocyAhPT0gJycpXG4gICAgICAgIGFwcGVuZChkZXN0LCB7ZDogcywgcDogYy5wICsgb3RoZXJDLmkubGVuZ3RofSk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGVsZXRlIHZzIGRlbGV0ZVxuICAgICAgaWYgKGMucCA+PSBvdGhlckMucCArIG90aGVyQy5kLmxlbmd0aClcbiAgICAgICAgYXBwZW5kKGRlc3QsIHtkOiBjLmQsIHA6IGMucCAtIG90aGVyQy5kLmxlbmd0aH0pO1xuICAgICAgZWxzZSBpZiAoYy5wICsgYy5kLmxlbmd0aCA8PSBvdGhlckMucClcbiAgICAgICAgYXBwZW5kKGRlc3QsIGMpO1xuICAgICAgZWxzZSB7XG4gICAgICAgIC8vIFRoZXkgb3ZlcmxhcCBzb21ld2hlcmUuXG4gICAgICAgIHZhciBuZXdDID0ge2Q6ICcnLCBwOiBjLnB9O1xuXG4gICAgICAgIGlmIChjLnAgPCBvdGhlckMucClcbiAgICAgICAgICBuZXdDLmQgPSBjLmQuc2xpY2UoMCwgb3RoZXJDLnAgLSBjLnApO1xuXG4gICAgICAgIGlmIChjLnAgKyBjLmQubGVuZ3RoID4gb3RoZXJDLnAgKyBvdGhlckMuZC5sZW5ndGgpXG4gICAgICAgICAgbmV3Qy5kICs9IGMuZC5zbGljZShvdGhlckMucCArIG90aGVyQy5kLmxlbmd0aCAtIGMucCk7XG5cbiAgICAgICAgLy8gVGhpcyBpcyBlbnRpcmVseSBvcHRpb25hbCAtIEknbSBqdXN0IGNoZWNraW5nIHRoZSBkZWxldGVkIHRleHQgaW5cbiAgICAgICAgLy8gdGhlIHR3byBvcHMgbWF0Y2hlc1xuICAgICAgICB2YXIgaW50ZXJzZWN0U3RhcnQgPSBNYXRoLm1heChjLnAsIG90aGVyQy5wKTtcbiAgICAgICAgdmFyIGludGVyc2VjdEVuZCA9IE1hdGgubWluKGMucCArIGMuZC5sZW5ndGgsIG90aGVyQy5wICsgb3RoZXJDLmQubGVuZ3RoKTtcbiAgICAgICAgdmFyIGNJbnRlcnNlY3QgPSBjLmQuc2xpY2UoaW50ZXJzZWN0U3RhcnQgLSBjLnAsIGludGVyc2VjdEVuZCAtIGMucCk7XG4gICAgICAgIHZhciBvdGhlckludGVyc2VjdCA9IG90aGVyQy5kLnNsaWNlKGludGVyc2VjdFN0YXJ0IC0gb3RoZXJDLnAsIGludGVyc2VjdEVuZCAtIG90aGVyQy5wKTtcbiAgICAgICAgaWYgKGNJbnRlcnNlY3QgIT09IG90aGVySW50ZXJzZWN0KVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRGVsZXRlIG9wcyBkZWxldGUgZGlmZmVyZW50IHRleHQgaW4gdGhlIHNhbWUgcmVnaW9uIG9mIHRoZSBkb2N1bWVudCcpO1xuXG4gICAgICAgIGlmIChuZXdDLmQgIT09ICcnKSB7XG4gICAgICAgICAgbmV3Qy5wID0gdHJhbnNmb3JtUG9zaXRpb24obmV3Qy5wLCBvdGhlckMpO1xuICAgICAgICAgIGFwcGVuZChkZXN0LCBuZXdDKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBkZXN0O1xufTtcblxudmFyIGludmVydENvbXBvbmVudCA9IGZ1bmN0aW9uKGMpIHtcbiAgcmV0dXJuIChjLmkgIT0gbnVsbCkgPyB7ZDpjLmksIHA6Yy5wfSA6IHtpOmMuZCwgcDpjLnB9O1xufTtcblxuLy8gTm8gbmVlZCB0byB1c2UgYXBwZW5kIGZvciBpbnZlcnQsIGJlY2F1c2UgdGhlIGNvbXBvbmVudHMgd29uJ3QgYmUgYWJsZSB0b1xuLy8gY2FuY2VsIG9uZSBhbm90aGVyLlxudGV4dC5pbnZlcnQgPSBmdW5jdGlvbihvcCkge1xuICAvLyBTaGFsbG93IGNvcHkgJiByZXZlcnNlIHRoYXQgc3Vja2EuXG4gIG9wID0gb3Auc2xpY2UoKS5yZXZlcnNlKCk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICBvcFtpXSA9IGludmVydENvbXBvbmVudChvcFtpXSk7XG4gIH1cbiAgcmV0dXJuIG9wO1xufTtcblxucmVxdWlyZSgnLi9ib290c3RyYXBUcmFuc2Zvcm0nKSh0ZXh0LCB0cmFuc2Zvcm1Db21wb25lbnQsIGNoZWNrVmFsaWRPcCwgYXBwZW5kKTtcbiIsIi8vIFRleHQgZG9jdW1lbnQgQVBJIGZvciB0aGUgJ3RleHQnIHR5cGUuIFRoaXMgaW1wbGVtZW50cyBzb21lIHN0YW5kYXJkIEFQSVxuLy8gbWV0aG9kcyBmb3IgYW55IHRleHQtbGlrZSB0eXBlLCBzbyB5b3UgY2FuIGVhc2lseSBiaW5kIGEgdGV4dGFyZWEgb3Jcbi8vIHNvbWV0aGluZyB3aXRob3V0IGJlaW5nIGZ1c3N5IGFib3V0IHRoZSB1bmRlcmx5aW5nIE9UIGltcGxlbWVudGF0aW9uLlxuLy9cbi8vIFRoZSBBUEkgaXMgZGVzaWdlbmQgYXMgYSBzZXQgb2YgZnVuY3Rpb25zIHRvIGJlIG1peGVkIGluIHRvIHNvbWUgY29udGV4dFxuLy8gb2JqZWN0IGFzIHBhcnQgb2YgaXRzIGxpZmVjeWNsZS4gSXQgZXhwZWN0cyB0aGF0IG9iamVjdCB0byBoYXZlIGdldFNuYXBzaG90XG4vLyBhbmQgc3VibWl0T3AgbWV0aG9kcywgYW5kIGNhbGwgX29uT3Agd2hlbiBhbiBvcGVyYXRpb24gaXMgcmVjZWl2ZWQuXG4vL1xuLy8gVGhpcyBBUEkgZGVmaW5lczpcbi8vXG4vLyAtIGdldExlbmd0aCgpIHJldHVybnMgdGhlIGxlbmd0aCBvZiB0aGUgZG9jdW1lbnQgaW4gY2hhcmFjdGVyc1xuLy8gLSBnZXRUZXh0KCkgcmV0dXJucyBhIHN0cmluZyBvZiB0aGUgZG9jdW1lbnRcbi8vIC0gaW5zZXJ0KHBvcywgdGV4dCwgW2NhbGxiYWNrXSkgaW5zZXJ0cyB0ZXh0IGF0IHBvc2l0aW9uIHBvcyBpbiB0aGUgZG9jdW1lbnRcbi8vIC0gcmVtb3ZlKHBvcywgbGVuZ3RoLCBbY2FsbGJhY2tdKSByZW1vdmVzIGxlbmd0aCBjaGFyYWN0ZXJzIGF0IHBvc2l0aW9uIHBvc1xuLy9cbi8vIEEgdXNlciBjYW4gZGVmaW5lOlxuLy8gLSBvbkluc2VydChwb3MsIHRleHQpOiBDYWxsZWQgd2hlbiB0ZXh0IGlzIGluc2VydGVkLlxuLy8gLSBvblJlbW92ZShwb3MsIGxlbmd0aCk6IENhbGxlZCB3aGVuIHRleHQgaXMgcmVtb3ZlZC5cblxubW9kdWxlLmV4cG9ydHMgPSBhcGk7XG5mdW5jdGlvbiBhcGkoZ2V0U25hcHNob3QsIHN1Ym1pdE9wKSB7XG4gIHJldHVybiB7XG4gICAgLy8gUmV0dXJucyB0aGUgdGV4dCBjb250ZW50IG9mIHRoZSBkb2N1bWVudFxuICAgIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBnZXRTbmFwc2hvdCgpOyB9LFxuXG4gICAgLy8gUmV0dXJucyB0aGUgbnVtYmVyIG9mIGNoYXJhY3RlcnMgaW4gdGhlIHN0cmluZ1xuICAgIGdldExlbmd0aDogZnVuY3Rpb24oKSB7IHJldHVybiBnZXRTbmFwc2hvdCgpLmxlbmd0aDsgfSxcblxuICAgIC8vIEluc2VydCB0aGUgc3BlY2lmaWVkIHRleHQgYXQgdGhlIGdpdmVuIHBvc2l0aW9uIGluIHRoZSBkb2N1bWVudFxuICAgIGluc2VydDogZnVuY3Rpb24ocG9zLCB0ZXh0LCBjYWxsYmFjaykge1xuICAgICAgcmV0dXJuIHN1Ym1pdE9wKFtwb3MsIHRleHRdLCBjYWxsYmFjayk7XG4gICAgfSxcblxuICAgIHJlbW92ZTogZnVuY3Rpb24ocG9zLCBsZW5ndGgsIGNhbGxiYWNrKSB7XG4gICAgICByZXR1cm4gc3VibWl0T3AoW3Bvcywge2Q6bGVuZ3RofV0sIGNhbGxiYWNrKTtcbiAgICB9LFxuXG4gICAgLy8gV2hlbiB5b3UgdXNlIHRoaXMgQVBJLCB5b3Ugc2hvdWxkIGltcGxlbWVudCB0aGVzZSB0d28gbWV0aG9kc1xuICAgIC8vIGluIHlvdXIgZWRpdGluZyBjb250ZXh0LlxuICAgIC8vb25JbnNlcnQ6IGZ1bmN0aW9uKHBvcywgdGV4dCkge30sXG4gICAgLy9vblJlbW92ZTogZnVuY3Rpb24ocG9zLCByZW1vdmVkTGVuZ3RoKSB7fSxcblxuICAgIF9vbk9wOiBmdW5jdGlvbihvcCkge1xuICAgICAgdmFyIHBvcyA9IDA7XG4gICAgICB2YXIgc3BvcyA9IDA7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9wLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBjb21wb25lbnQgPSBvcFtpXTtcbiAgICAgICAgc3dpdGNoICh0eXBlb2YgY29tcG9uZW50KSB7XG4gICAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICAgIHBvcyArPSBjb21wb25lbnQ7XG4gICAgICAgICAgICBzcG9zICs9IGNvbXBvbmVudDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgICBpZiAodGhpcy5vbkluc2VydCkgdGhpcy5vbkluc2VydChwb3MsIGNvbXBvbmVudCk7XG4gICAgICAgICAgICBwb3MgKz0gY29tcG9uZW50Lmxlbmd0aDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgICAgICBpZiAodGhpcy5vblJlbW92ZSkgdGhpcy5vblJlbW92ZShwb3MsIGNvbXBvbmVudC5kKTtcbiAgICAgICAgICAgIHNwb3MgKz0gY29tcG9uZW50LmQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH07XG59O1xuYXBpLnByb3ZpZGVzID0ge3RleHQ6IHRydWV9O1xuIiwidmFyIHR5cGUgPSByZXF1aXJlKCcuL3RleHQnKTtcbnR5cGUuYXBpID0gcmVxdWlyZSgnLi9hcGknKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHR5cGU6IHR5cGVcbn07XG4iLCIvKiBUZXh0IE9UIVxuICpcbiAqIFRoaXMgaXMgYW4gT1QgaW1wbGVtZW50YXRpb24gZm9yIHRleHQuIEl0IGlzIHRoZSBzdGFuZGFyZCBpbXBsZW1lbnRhdGlvbiBvZlxuICogdGV4dCB1c2VkIGJ5IFNoYXJlSlMuXG4gKlxuICogVGhpcyB0eXBlIGlzIGNvbXBvc2FibGUgYnV0IG5vbi1pbnZlcnRhYmxlLiBJdHMgc2ltaWxhciB0byBTaGFyZUpTJ3Mgb2xkXG4gKiB0ZXh0LWNvbXBvc2FibGUgdHlwZSwgYnV0IGl0cyBub3QgaW52ZXJ0YWJsZSBhbmQgaXRzIHZlcnkgc2ltaWxhciB0byB0aGVcbiAqIHRleHQtdHAyIGltcGxlbWVudGF0aW9uIGJ1dCBpdCBkb2Vzbid0IHN1cHBvcnQgdG9tYnN0b25lcyBvciBwdXJnaW5nLlxuICpcbiAqIE9wcyBhcmUgbGlzdHMgb2YgY29tcG9uZW50cyB3aGljaCBpdGVyYXRlIG92ZXIgdGhlIGRvY3VtZW50LlxuICogQ29tcG9uZW50cyBhcmUgZWl0aGVyOlxuICogICBBIG51bWJlciBOOiBTa2lwIE4gY2hhcmFjdGVycyBpbiB0aGUgb3JpZ2luYWwgZG9jdW1lbnRcbiAqICAgXCJzdHJcIiAgICAgOiBJbnNlcnQgXCJzdHJcIiBhdCB0aGUgY3VycmVudCBwb3NpdGlvbiBpbiB0aGUgZG9jdW1lbnRcbiAqICAge2Q6Tn0gICAgIDogRGVsZXRlIE4gY2hhcmFjdGVycyBhdCB0aGUgY3VycmVudCBwb3NpdGlvbiBpbiB0aGUgZG9jdW1lbnRcbiAqXG4gKiBFZzogWzMsICdoaScsIDUsIHtkOjh9XVxuICpcbiAqIFRoZSBvcGVyYXRpb24gZG9lcyBub3QgaGF2ZSB0byBza2lwIHRoZSBsYXN0IGNoYXJhY3RlcnMgaW4gdGhlIGRvY3VtZW50LlxuICpcbiAqIFNuYXBzaG90cyBhcmUgc3RyaW5ncy5cbiAqXG4gKiBDdXJzb3JzIGFyZSBlaXRoZXIgYSBzaW5nbGUgbnVtYmVyICh3aGljaCBpcyB0aGUgY3Vyc29yIHBvc2l0aW9uKSBvciBhIHBhaXIgb2ZcbiAqIFthbmNob3IsIGZvY3VzXSAoYWthIFtzdGFydCwgZW5kXSkuIEJlIGF3YXJlIHRoYXQgZW5kIGNhbiBiZSBiZWZvcmUgc3RhcnQuXG4gKi9cblxuLyoqIEBtb2R1bGUgdGV4dCAqL1xuXG5leHBvcnRzLm5hbWUgPSAndGV4dCc7XG5leHBvcnRzLnVyaSA9ICdodHRwOi8vc2hhcmVqcy5vcmcvdHlwZXMvdGV4dHYxJztcblxuLyoqIENyZWF0ZSBhIG5ldyB0ZXh0IHNuYXBzaG90LlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBpbml0aWFsIC0gaW5pdGlhbCBzbmFwc2hvdCBkYXRhLiBPcHRpb25hbC4gRGVmYXVsdHMgdG8gJycuXG4gKi9cbmV4cG9ydHMuY3JlYXRlID0gZnVuY3Rpb24oaW5pdGlhbCkge1xuICBpZiAoKGluaXRpYWwgIT0gbnVsbCkgJiYgdHlwZW9mIGluaXRpYWwgIT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgRXJyb3IoJ0luaXRpYWwgZGF0YSBtdXN0IGJlIGEgc3RyaW5nJyk7XG4gIH1cbiAgcmV0dXJuIGluaXRpYWwgfHwgJyc7XG59O1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24ob2JqKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiO1xufTtcblxuLyoqIENoZWNrIHRoZSBvcGVyYXRpb24gaXMgdmFsaWQuIFRocm93cyBpZiBub3QgdmFsaWQuICovXG52YXIgY2hlY2tPcCA9IGZ1bmN0aW9uKG9wKSB7XG4gIGlmICghaXNBcnJheShvcCkpIHRocm93IEVycm9yKCdPcCBtdXN0IGJlIGFuIGFycmF5IG9mIGNvbXBvbmVudHMnKTtcblxuICB2YXIgbGFzdCA9IG51bGw7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYyA9IG9wW2ldO1xuICAgIHN3aXRjaCAodHlwZW9mIGMpIHtcbiAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgIC8vIFRoZSBvbmx5IHZhbGlkIG9iamVjdHMgYXJlIHtkOlh9IGZvciAraXZlIHZhbHVlcyBvZiBYLlxuICAgICAgICBpZiAoISh0eXBlb2YgYy5kID09PSAnbnVtYmVyJyAmJiBjLmQgPiAwKSkgdGhyb3cgRXJyb3IoJ09iamVjdCBjb21wb25lbnRzIG11c3QgYmUgZGVsZXRlcyBvZiBzaXplID4gMCcpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgIC8vIFN0cmluZ3MgYXJlIGluc2VydHMuXG4gICAgICAgIGlmICghKGMubGVuZ3RoID4gMCkpIHRocm93IEVycm9yKCdJbnNlcnRzIGNhbm5vdCBiZSBlbXB0eScpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAgIC8vIE51bWJlcnMgbXVzdCBiZSBza2lwcy4gVGhleSBoYXZlIHRvIGJlICtpdmUgbnVtYmVycy5cbiAgICAgICAgaWYgKCEoYyA+IDApKSB0aHJvdyBFcnJvcignU2tpcCBjb21wb25lbnRzIG11c3QgYmUgPjAnKTtcbiAgICAgICAgaWYgKHR5cGVvZiBsYXN0ID09PSAnbnVtYmVyJykgdGhyb3cgRXJyb3IoJ0FkamFjZW50IHNraXAgY29tcG9uZW50cyBzaG91bGQgYmUgY29tYmluZWQnKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGxhc3QgPSBjO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBsYXN0ID09PSAnbnVtYmVyJykgdGhyb3cgRXJyb3IoJ09wIGhhcyBhIHRyYWlsaW5nIHNraXAnKTtcbn07XG5cbi8qKiBDaGVjayB0aGF0IHRoZSBnaXZlbiBzZWxlY3Rpb24gcmFuZ2UgaXMgdmFsaWQuICovXG52YXIgY2hlY2tTZWxlY3Rpb24gPSBmdW5jdGlvbihzZWxlY3Rpb24pIHtcbiAgLy8gVGhpcyBtYXkgdGhyb3cgZnJvbSBzaW1wbHkgaW5zcGVjdGluZyBzZWxlY3Rpb25bMF0gLyBzZWxlY3Rpb25bMV0uIFRoYXRzXG4gIC8vIHNvcnQgb2Ygb2ssIHRob3VnaCBpdCdsbCBnZW5lcmF0ZSB0aGUgd3JvbmcgbWVzc2FnZS5cbiAgaWYgKHR5cGVvZiBzZWxlY3Rpb24gIT09ICdudW1iZXInXG4gICAgICAmJiAodHlwZW9mIHNlbGVjdGlvblswXSAhPT0gJ251bWJlcicgfHwgdHlwZW9mIHNlbGVjdGlvblsxXSAhPT0gJ251bWJlcicpKVxuICAgIHRocm93IEVycm9yKCdJbnZhbGlkIHNlbGVjdGlvbicpO1xufTtcblxuLyoqIE1ha2UgYSBmdW5jdGlvbiB0aGF0IGFwcGVuZHMgdG8gdGhlIGdpdmVuIG9wZXJhdGlvbi4gKi9cbnZhciBtYWtlQXBwZW5kID0gZnVuY3Rpb24ob3ApIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGNvbXBvbmVudCkge1xuICAgIGlmICghY29tcG9uZW50IHx8IGNvbXBvbmVudC5kID09PSAwKSB7XG4gICAgICAvLyBUaGUgY29tcG9uZW50IGlzIGEgbm8tb3AuIElnbm9yZSFcbiBcbiAgICB9IGVsc2UgaWYgKG9wLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG9wLnB1c2goY29tcG9uZW50KTtcblxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGNvbXBvbmVudCA9PT0gdHlwZW9mIG9wW29wLmxlbmd0aCAtIDFdKSB7XG4gICAgICBpZiAodHlwZW9mIGNvbXBvbmVudCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIG9wW29wLmxlbmd0aCAtIDFdLmQgKz0gY29tcG9uZW50LmQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gb3Bbb3AubGVuZ3RoIC0gMV0gKz0gY29tcG9uZW50O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gb3AucHVzaChjb21wb25lbnQpO1xuICAgIH1cbiAgfTtcbn07XG5cbi8qKiBNYWtlcyBhbmQgcmV0dXJucyB1dGlsaXR5IGZ1bmN0aW9ucyB0YWtlIGFuZCBwZWVrLiAqL1xudmFyIG1ha2VUYWtlID0gZnVuY3Rpb24ob3ApIHtcbiAgLy8gVGhlIGluZGV4IG9mIHRoZSBuZXh0IGNvbXBvbmVudCB0byB0YWtlXG4gIHZhciBpZHggPSAwO1xuICAvLyBUaGUgb2Zmc2V0IGludG8gdGhlIGNvbXBvbmVudFxuICB2YXIgb2Zmc2V0ID0gMDtcblxuICAvLyBUYWtlIHVwIHRvIGxlbmd0aCBuIGZyb20gdGhlIGZyb250IG9mIG9wLiBJZiBuIGlzIC0xLCB0YWtlIHRoZSBlbnRpcmUgbmV4dFxuICAvLyBvcCBjb21wb25lbnQuIElmIGluZGl2aXNhYmxlRmllbGQgPT0gJ2QnLCBkZWxldGUgY29tcG9uZW50cyB3b24ndCBiZSBzZXBhcmF0ZWQuXG4gIC8vIElmIGluZGl2aXNhYmxlRmllbGQgPT0gJ2knLCBpbnNlcnQgY29tcG9uZW50cyB3b24ndCBiZSBzZXBhcmF0ZWQuXG4gIHZhciB0YWtlID0gZnVuY3Rpb24obiwgaW5kaXZpc2FibGVGaWVsZCkge1xuICAgIC8vIFdlJ3JlIGF0IHRoZSBlbmQgb2YgdGhlIG9wZXJhdGlvbi4gVGhlIG9wIGhhcyBza2lwcywgZm9yZXZlci4gSW5maW5pdHlcbiAgICAvLyBtaWdodCBtYWtlIG1vcmUgc2Vuc2UgdGhhbiBudWxsIGhlcmUuXG4gICAgaWYgKGlkeCA9PT0gb3AubGVuZ3RoKVxuICAgICAgcmV0dXJuIG4gPT09IC0xID8gbnVsbCA6IG47XG5cbiAgICB2YXIgcGFydDtcbiAgICB2YXIgYyA9IG9wW2lkeF07XG4gICAgaWYgKHR5cGVvZiBjID09PSAnbnVtYmVyJykge1xuICAgICAgLy8gU2tpcFxuICAgICAgaWYgKG4gPT09IC0xIHx8IGMgLSBvZmZzZXQgPD0gbikge1xuICAgICAgICBwYXJ0ID0gYyAtIG9mZnNldDtcbiAgICAgICAgKytpZHg7XG4gICAgICAgIG9mZnNldCA9IDA7XG4gICAgICAgIHJldHVybiBwYXJ0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2Zmc2V0ICs9IG47XG4gICAgICAgIHJldHVybiBuO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBJbnNlcnRcbiAgICAgIGlmIChuID09PSAtMSB8fCBpbmRpdmlzYWJsZUZpZWxkID09PSAnaScgfHwgYy5sZW5ndGggLSBvZmZzZXQgPD0gbikge1xuICAgICAgICBwYXJ0ID0gYy5zbGljZShvZmZzZXQpO1xuICAgICAgICArK2lkeDtcbiAgICAgICAgb2Zmc2V0ID0gMDtcbiAgICAgICAgcmV0dXJuIHBhcnQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJ0ID0gYy5zbGljZShvZmZzZXQsIG9mZnNldCArIG4pO1xuICAgICAgICBvZmZzZXQgKz0gbjtcbiAgICAgICAgcmV0dXJuIHBhcnQ7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERlbGV0ZVxuICAgICAgaWYgKG4gPT09IC0xIHx8IGluZGl2aXNhYmxlRmllbGQgPT09ICdkJyB8fCBjLmQgLSBvZmZzZXQgPD0gbikge1xuICAgICAgICBwYXJ0ID0ge2Q6IGMuZCAtIG9mZnNldH07XG4gICAgICAgICsraWR4O1xuICAgICAgICBvZmZzZXQgPSAwO1xuICAgICAgICByZXR1cm4gcGFydDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9mZnNldCArPSBuO1xuICAgICAgICByZXR1cm4ge2Q6IG59O1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICAvLyBQZWVrIGF0IHRoZSBuZXh0IG9wIHRoYXQgd2lsbCBiZSByZXR1cm5lZC5cbiAgdmFyIHBlZWtUeXBlID0gZnVuY3Rpb24oKSB7IHJldHVybiBvcFtpZHhdOyB9O1xuXG4gIHJldHVybiBbdGFrZSwgcGVla1R5cGVdO1xufTtcblxuLyoqIEdldCB0aGUgbGVuZ3RoIG9mIGEgY29tcG9uZW50ICovXG52YXIgY29tcG9uZW50TGVuZ3RoID0gZnVuY3Rpb24oYykge1xuICAvLyBVZ2xpZnkgd2lsbCBjb21wcmVzcyB0aGlzIGRvd24gaW50byBhIHRlcm5hcnlcbiAgaWYgKHR5cGVvZiBjID09PSAnbnVtYmVyJykge1xuICAgIHJldHVybiBjO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBjLmxlbmd0aCB8fCBjLmQ7XG4gIH1cbn07XG5cbi8qKiBUcmltIGFueSBleGNlc3Mgc2tpcHMgZnJvbSB0aGUgZW5kIG9mIGFuIG9wZXJhdGlvbi5cbiAqXG4gKiBUaGVyZSBzaG91bGQgb25seSBiZSBhdCBtb3N0IG9uZSwgYmVjYXVzZSB0aGUgb3BlcmF0aW9uIHdhcyBtYWRlIHdpdGggYXBwZW5kLlxuICovXG52YXIgdHJpbSA9IGZ1bmN0aW9uKG9wKSB7XG4gIGlmIChvcC5sZW5ndGggPiAwICYmIHR5cGVvZiBvcFtvcC5sZW5ndGggLSAxXSA9PT0gJ251bWJlcicpIHtcbiAgICBvcC5wb3AoKTtcbiAgfVxuICByZXR1cm4gb3A7XG59O1xuXG5leHBvcnRzLm5vcm1hbGl6ZSA9IGZ1bmN0aW9uKG9wKSB7XG4gIHZhciBuZXdPcCA9IFtdO1xuICB2YXIgYXBwZW5kID0gbWFrZUFwcGVuZChuZXdPcCk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICBhcHBlbmQob3BbaV0pO1xuICB9XG4gIHJldHVybiB0cmltKG5ld09wKTtcbn07XG5cbi8qKiBBcHBseSBhbiBvcGVyYXRpb24gdG8gYSBkb2N1bWVudCBzbmFwc2hvdCAqL1xuZXhwb3J0cy5hcHBseSA9IGZ1bmN0aW9uKHN0ciwgb3ApIHtcbiAgaWYgKHR5cGVvZiBzdHIgIT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgRXJyb3IoJ1NuYXBzaG90IHNob3VsZCBiZSBhIHN0cmluZycpO1xuICB9XG4gIGNoZWNrT3Aob3ApO1xuXG4gIC8vIFdlJ2xsIGdhdGhlciB0aGUgbmV3IGRvY3VtZW50IGhlcmUgYW5kIGpvaW4gYXQgdGhlIGVuZC5cbiAgdmFyIG5ld0RvYyA9IFtdO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgY29tcG9uZW50ID0gb3BbaV07XG4gICAgc3dpdGNoICh0eXBlb2YgY29tcG9uZW50KSB7XG4gICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICBpZiAoY29tcG9uZW50ID4gc3RyLmxlbmd0aCkgdGhyb3cgRXJyb3IoJ1RoZSBvcCBpcyB0b28gbG9uZyBmb3IgdGhpcyBkb2N1bWVudCcpO1xuXG4gICAgICAgIG5ld0RvYy5wdXNoKHN0ci5zbGljZSgwLCBjb21wb25lbnQpKTtcbiAgICAgICAgLy8gVGhpcyBtaWdodCBiZSBzbG93IGZvciBiaWcgc3RyaW5ncy4gQ29uc2lkZXIgc3RvcmluZyB0aGUgb2Zmc2V0IGluXG4gICAgICAgIC8vIHN0ciBpbnN0ZWFkIG9mIHJld3JpdGluZyBpdCBlYWNoIHRpbWUuXG4gICAgICAgIHN0ciA9IHN0ci5zbGljZShjb21wb25lbnQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgIG5ld0RvYy5wdXNoKGNvbXBvbmVudCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgICAgc3RyID0gc3RyLnNsaWNlKGNvbXBvbmVudC5kKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5ld0RvYy5qb2luKCcnKSArIHN0cjtcbn07XG5cbi8qKiBUcmFuc2Zvcm0gb3AgYnkgb3RoZXJPcC5cbiAqXG4gKiBAcGFyYW0gb3AgLSBUaGUgb3BlcmF0aW9uIHRvIHRyYW5zZm9ybVxuICogQHBhcmFtIG90aGVyT3AgLSBPcGVyYXRpb24gdG8gdHJhbnNmb3JtIGl0IGJ5XG4gKiBAcGFyYW0gc2lkZSAtIEVpdGhlciAnbGVmdCcgb3IgJ3JpZ2h0J1xuICovXG5leHBvcnRzLnRyYW5zZm9ybSA9IGZ1bmN0aW9uKG9wLCBvdGhlck9wLCBzaWRlKSB7XG4gIGlmIChzaWRlICE9ICdsZWZ0JyAmJiBzaWRlICE9ICdyaWdodCcpIHRocm93IEVycm9yKFwic2lkZSAoXCIgKyBzaWRlICsgXCIpIG11c3QgYmUgJ2xlZnQnIG9yICdyaWdodCdcIik7XG5cbiAgY2hlY2tPcChvcCk7XG4gIGNoZWNrT3Aob3RoZXJPcCk7XG5cbiAgdmFyIG5ld09wID0gW107XG4gIHZhciBhcHBlbmQgPSBtYWtlQXBwZW5kKG5ld09wKTtcblxuICB2YXIgX2ZucyA9IG1ha2VUYWtlKG9wKTtcbiAgdmFyIHRha2UgPSBfZm5zWzBdLFxuICAgICAgcGVlayA9IF9mbnNbMV07XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvdGhlck9wLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGNvbXBvbmVudCA9IG90aGVyT3BbaV07XG5cbiAgICB2YXIgbGVuZ3RoLCBjaHVuaztcbiAgICBzd2l0Y2ggKHR5cGVvZiBjb21wb25lbnQpIHtcbiAgICAgIGNhc2UgJ251bWJlcic6IC8vIFNraXBcbiAgICAgICAgbGVuZ3RoID0gY29tcG9uZW50O1xuICAgICAgICB3aGlsZSAobGVuZ3RoID4gMCkge1xuICAgICAgICAgIGNodW5rID0gdGFrZShsZW5ndGgsICdpJyk7XG4gICAgICAgICAgYXBwZW5kKGNodW5rKTtcbiAgICAgICAgICBpZiAodHlwZW9mIGNodW5rICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgbGVuZ3RoIC09IGNvbXBvbmVudExlbmd0aChjaHVuayk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdzdHJpbmcnOiAvLyBJbnNlcnRcbiAgICAgICAgaWYgKHNpZGUgPT09ICdsZWZ0Jykge1xuICAgICAgICAgIC8vIFRoZSBsZWZ0IGluc2VydCBzaG91bGQgZ28gZmlyc3QuXG4gICAgICAgICAgaWYgKHR5cGVvZiBwZWVrKCkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBhcHBlbmQodGFrZSgtMSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE90aGVyd2lzZSBza2lwIHRoZSBpbnNlcnRlZCB0ZXh0LlxuICAgICAgICBhcHBlbmQoY29tcG9uZW50Lmxlbmd0aCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdvYmplY3QnOiAvLyBEZWxldGVcbiAgICAgICAgbGVuZ3RoID0gY29tcG9uZW50LmQ7XG4gICAgICAgIHdoaWxlIChsZW5ndGggPiAwKSB7XG4gICAgICAgICAgY2h1bmsgPSB0YWtlKGxlbmd0aCwgJ2knKTtcbiAgICAgICAgICBzd2l0Y2ggKHR5cGVvZiBjaHVuaykge1xuICAgICAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICAgICAgbGVuZ3RoIC09IGNodW5rO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgICAgIGFwcGVuZChjaHVuayk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgICAgICAgICAgLy8gVGhlIGRlbGV0ZSBpcyB1bm5lY2Vzc2FyeSBub3cgLSB0aGUgdGV4dCBoYXMgYWxyZWFkeSBiZWVuIGRlbGV0ZWQuXG4gICAgICAgICAgICAgIGxlbmd0aCAtPSBjaHVuay5kO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgXG4gIC8vIEFwcGVuZCBhbnkgZXh0cmEgZGF0YSBpbiBvcDEuXG4gIHdoaWxlICgoY29tcG9uZW50ID0gdGFrZSgtMSkpKVxuICAgIGFwcGVuZChjb21wb25lbnQpO1xuICBcbiAgcmV0dXJuIHRyaW0obmV3T3ApO1xufTtcblxuLyoqIENvbXBvc2Ugb3AxIGFuZCBvcDIgdG9nZXRoZXIgYW5kIHJldHVybiB0aGUgcmVzdWx0ICovXG5leHBvcnRzLmNvbXBvc2UgPSBmdW5jdGlvbihvcDEsIG9wMikge1xuICBjaGVja09wKG9wMSk7XG4gIGNoZWNrT3Aob3AyKTtcblxuICB2YXIgcmVzdWx0ID0gW107XG4gIHZhciBhcHBlbmQgPSBtYWtlQXBwZW5kKHJlc3VsdCk7XG4gIHZhciB0YWtlID0gbWFrZVRha2Uob3AxKVswXTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IG9wMi5sZW5ndGg7IGkrKykge1xuICAgIHZhciBjb21wb25lbnQgPSBvcDJbaV07XG4gICAgdmFyIGxlbmd0aCwgY2h1bms7XG4gICAgc3dpdGNoICh0eXBlb2YgY29tcG9uZW50KSB7XG4gICAgICBjYXNlICdudW1iZXInOiAvLyBTa2lwXG4gICAgICAgIGxlbmd0aCA9IGNvbXBvbmVudDtcbiAgICAgICAgd2hpbGUgKGxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjaHVuayA9IHRha2UobGVuZ3RoLCAnZCcpO1xuICAgICAgICAgIGFwcGVuZChjaHVuayk7XG4gICAgICAgICAgaWYgKHR5cGVvZiBjaHVuayAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGxlbmd0aCAtPSBjb21wb25lbnRMZW5ndGgoY2h1bmspO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnc3RyaW5nJzogLy8gSW5zZXJ0XG4gICAgICAgIGFwcGVuZChjb21wb25lbnQpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnb2JqZWN0JzogLy8gRGVsZXRlXG4gICAgICAgIGxlbmd0aCA9IGNvbXBvbmVudC5kO1xuXG4gICAgICAgIHdoaWxlIChsZW5ndGggPiAwKSB7XG4gICAgICAgICAgY2h1bmsgPSB0YWtlKGxlbmd0aCwgJ2QnKTtcblxuICAgICAgICAgIHN3aXRjaCAodHlwZW9mIGNodW5rKSB7XG4gICAgICAgICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICAgICAgICBhcHBlbmQoe2Q6IGNodW5rfSk7XG4gICAgICAgICAgICAgIGxlbmd0aCAtPSBjaHVuaztcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgICBsZW5ndGggLT0gY2h1bmsubGVuZ3RoO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgICAgICAgIGFwcGVuZChjaHVuayk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHdoaWxlICgoY29tcG9uZW50ID0gdGFrZSgtMSkpKVxuICAgIGFwcGVuZChjb21wb25lbnQpO1xuXG4gIHJldHVybiB0cmltKHJlc3VsdCk7XG59O1xuXG5cbnZhciB0cmFuc2Zvcm1Qb3NpdGlvbiA9IGZ1bmN0aW9uKGN1cnNvciwgb3ApIHtcbiAgdmFyIHBvcyA9IDA7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYyA9IG9wW2ldO1xuICAgIGlmIChjdXJzb3IgPD0gcG9zKSBicmVhaztcblxuICAgIC8vIEkgY291bGQgYWN0dWFsbHkgdXNlIHRoZSBvcF9pdGVyIHN0dWZmIGFib3ZlIC0gYnV0IEkgdGhpbmsgaXRzIHNpbXBsZXJcbiAgICAvLyBsaWtlIHRoaXMuXG4gICAgc3dpdGNoICh0eXBlb2YgYykge1xuICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgaWYgKGN1cnNvciA8PSBwb3MgKyBjKVxuICAgICAgICAgIHJldHVybiBjdXJzb3I7XG4gICAgICAgIHBvcyArPSBjO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgcG9zICs9IGMubGVuZ3RoO1xuICAgICAgICBjdXJzb3IgKz0gYy5sZW5ndGg7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICBjdXJzb3IgLT0gTWF0aC5taW4oYy5kLCBjdXJzb3IgLSBwb3MpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGN1cnNvcjtcbn07XG5cbmV4cG9ydHMudHJhbnNmb3JtU2VsZWN0aW9uID0gZnVuY3Rpb24oc2VsZWN0aW9uLCBvcCwgaXNPd25PcCkge1xuICB2YXIgcG9zID0gMDtcbiAgaWYgKGlzT3duT3ApIHtcbiAgICAvLyBKdXN0IHRyYWNrIHRoZSBwb3NpdGlvbi4gV2UnbGwgdGVsZXBvcnQgdGhlIGN1cnNvciB0byB0aGUgZW5kIGFueXdheS5cbiAgICAvLyBUaGlzIHdvcmtzIGJlY2F1c2UgdGV4dCBvcHMgZG9uJ3QgaGF2ZSBhbnkgdHJhaWxpbmcgc2tpcHMgYXQgdGhlIGVuZCAtIHNvIHRoZSBsYXN0XG4gICAgLy8gY29tcG9uZW50IGlzIHRoZSBsYXN0IHRoaW5nLlxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3AubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBjID0gb3BbaV07XG4gICAgICBzd2l0Y2ggKHR5cGVvZiBjKSB7XG4gICAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAgICAgcG9zICs9IGM7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgcG9zICs9IGMubGVuZ3RoO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvLyBKdXN0IGVhdCBkZWxldGVzLlxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcG9zO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB0eXBlb2Ygc2VsZWN0aW9uID09PSAnbnVtYmVyJyA/XG4gICAgICB0cmFuc2Zvcm1Qb3NpdGlvbihzZWxlY3Rpb24sIG9wKSA6IFt0cmFuc2Zvcm1Qb3NpdGlvbihzZWxlY3Rpb25bMF0sIG9wKSwgdHJhbnNmb3JtUG9zaXRpb24oc2VsZWN0aW9uWzFdLCBvcCldO1xuICB9XG59O1xuXG5leHBvcnRzLnNlbGVjdGlvbkVxID0gZnVuY3Rpb24oYzEsIGMyKSB7XG4gIGlmIChjMVswXSAhPSBudWxsICYmIGMxWzBdID09PSBjMVsxXSkgYzEgPSBjMVswXTtcbiAgaWYgKGMyWzBdICE9IG51bGwgJiYgYzJbMF0gPT09IGMyWzFdKSBjMiA9IGMyWzBdO1xuICByZXR1cm4gYzEgPT09IGMyIHx8IChjMVswXSAhPSBudWxsICYmIGMyWzBdICE9IG51bGwgJiYgYzFbMF0gPT09IGMyWzBdICYmIGMxWzFdID09IGMyWzFdKTtcbn07XG5cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCJ2YXIgZGlmZiA9IHJlcXVpcmUoJ2Zhc3QtZGlmZicpO1xudmFyIGVxdWFsID0gcmVxdWlyZSgnZGVlcC1lcXVhbCcpO1xudmFyIGV4dGVuZCA9IHJlcXVpcmUoJ2V4dGVuZCcpO1xudmFyIG9wID0gcmVxdWlyZSgnLi9vcCcpO1xuXG5cbnZhciBOVUxMX0NIQVJBQ1RFUiA9IFN0cmluZy5mcm9tQ2hhckNvZGUoMCk7ICAvLyBQbGFjZWhvbGRlciBjaGFyIGZvciBlbWJlZCBpbiBkaWZmKClcblxuXG52YXIgRGVsdGEgPSBmdW5jdGlvbiAob3BzKSB7XG4gIC8vIEFzc3VtZSB3ZSBhcmUgZ2l2ZW4gYSB3ZWxsIGZvcm1lZCBvcHNcbiAgaWYgKEFycmF5LmlzQXJyYXkob3BzKSkge1xuICAgIHRoaXMub3BzID0gb3BzO1xuICB9IGVsc2UgaWYgKG9wcyAhPSBudWxsICYmIEFycmF5LmlzQXJyYXkob3BzLm9wcykpIHtcbiAgICB0aGlzLm9wcyA9IG9wcy5vcHM7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5vcHMgPSBbXTtcbiAgfVxufTtcblxuXG5EZWx0YS5wcm90b3R5cGUuaW5zZXJ0ID0gZnVuY3Rpb24gKHRleHQsIGF0dHJpYnV0ZXMpIHtcbiAgdmFyIG5ld09wID0ge307XG4gIGlmICh0ZXh0Lmxlbmd0aCA9PT0gMCkgcmV0dXJuIHRoaXM7XG4gIG5ld09wLmluc2VydCA9IHRleHQ7XG4gIGlmIChhdHRyaWJ1dGVzICE9IG51bGwgJiYgdHlwZW9mIGF0dHJpYnV0ZXMgPT09ICdvYmplY3QnICYmIE9iamVjdC5rZXlzKGF0dHJpYnV0ZXMpLmxlbmd0aCA+IDApIHtcbiAgICBuZXdPcC5hdHRyaWJ1dGVzID0gYXR0cmlidXRlcztcbiAgfVxuICByZXR1cm4gdGhpcy5wdXNoKG5ld09wKTtcbn07XG5cbkRlbHRhLnByb3RvdHlwZVsnZGVsZXRlJ10gPSBmdW5jdGlvbiAobGVuZ3RoKSB7XG4gIGlmIChsZW5ndGggPD0gMCkgcmV0dXJuIHRoaXM7XG4gIHJldHVybiB0aGlzLnB1c2goeyAnZGVsZXRlJzogbGVuZ3RoIH0pO1xufTtcblxuRGVsdGEucHJvdG90eXBlLnJldGFpbiA9IGZ1bmN0aW9uIChsZW5ndGgsIGF0dHJpYnV0ZXMpIHtcbiAgaWYgKGxlbmd0aCA8PSAwKSByZXR1cm4gdGhpcztcbiAgdmFyIG5ld09wID0geyByZXRhaW46IGxlbmd0aCB9O1xuICBpZiAoYXR0cmlidXRlcyAhPSBudWxsICYmIHR5cGVvZiBhdHRyaWJ1dGVzID09PSAnb2JqZWN0JyAmJiBPYmplY3Qua2V5cyhhdHRyaWJ1dGVzKS5sZW5ndGggPiAwKSB7XG4gICAgbmV3T3AuYXR0cmlidXRlcyA9IGF0dHJpYnV0ZXM7XG4gIH1cbiAgcmV0dXJuIHRoaXMucHVzaChuZXdPcCk7XG59O1xuXG5EZWx0YS5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIChuZXdPcCkge1xuICB2YXIgaW5kZXggPSB0aGlzLm9wcy5sZW5ndGg7XG4gIHZhciBsYXN0T3AgPSB0aGlzLm9wc1tpbmRleCAtIDFdO1xuICBuZXdPcCA9IGV4dGVuZCh0cnVlLCB7fSwgbmV3T3ApO1xuICBpZiAodHlwZW9mIGxhc3RPcCA9PT0gJ29iamVjdCcpIHtcbiAgICBpZiAodHlwZW9mIG5ld09wWydkZWxldGUnXSA9PT0gJ251bWJlcicgJiYgdHlwZW9mIGxhc3RPcFsnZGVsZXRlJ10gPT09ICdudW1iZXInKSB7XG4gICAgICB0aGlzLm9wc1tpbmRleCAtIDFdID0geyAnZGVsZXRlJzogbGFzdE9wWydkZWxldGUnXSArIG5ld09wWydkZWxldGUnXSB9O1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIC8vIFNpbmNlIGl0IGRvZXMgbm90IG1hdHRlciBpZiB3ZSBpbnNlcnQgYmVmb3JlIG9yIGFmdGVyIGRlbGV0aW5nIGF0IHRoZSBzYW1lIGluZGV4LFxuICAgIC8vIGFsd2F5cyBwcmVmZXIgdG8gaW5zZXJ0IGZpcnN0XG4gICAgaWYgKHR5cGVvZiBsYXN0T3BbJ2RlbGV0ZSddID09PSAnbnVtYmVyJyAmJiBuZXdPcC5pbnNlcnQgIT0gbnVsbCkge1xuICAgICAgaW5kZXggLT0gMTtcbiAgICAgIGxhc3RPcCA9IHRoaXMub3BzW2luZGV4IC0gMV07XG4gICAgICBpZiAodHlwZW9mIGxhc3RPcCAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgdGhpcy5vcHMudW5zaGlmdChuZXdPcCk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZXF1YWwobmV3T3AuYXR0cmlidXRlcywgbGFzdE9wLmF0dHJpYnV0ZXMpKSB7XG4gICAgICBpZiAodHlwZW9mIG5ld09wLmluc2VydCA9PT0gJ3N0cmluZycgJiYgdHlwZW9mIGxhc3RPcC5pbnNlcnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMub3BzW2luZGV4IC0gMV0gPSB7IGluc2VydDogbGFzdE9wLmluc2VydCArIG5ld09wLmluc2VydCB9O1xuICAgICAgICBpZiAodHlwZW9mIG5ld09wLmF0dHJpYnV0ZXMgPT09ICdvYmplY3QnKSB0aGlzLm9wc1tpbmRleCAtIDFdLmF0dHJpYnV0ZXMgPSBuZXdPcC5hdHRyaWJ1dGVzXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgbmV3T3AucmV0YWluID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgbGFzdE9wLnJldGFpbiA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhpcy5vcHNbaW5kZXggLSAxXSA9IHsgcmV0YWluOiBsYXN0T3AucmV0YWluICsgbmV3T3AucmV0YWluIH07XG4gICAgICAgIGlmICh0eXBlb2YgbmV3T3AuYXR0cmlidXRlcyA9PT0gJ29iamVjdCcpIHRoaXMub3BzW2luZGV4IC0gMV0uYXR0cmlidXRlcyA9IG5ld09wLmF0dHJpYnV0ZXNcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChpbmRleCA9PT0gdGhpcy5vcHMubGVuZ3RoKSB7XG4gICAgdGhpcy5vcHMucHVzaChuZXdPcCk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5vcHMuc3BsaWNlKGluZGV4LCAwLCBuZXdPcCk7XG4gIH1cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5EZWx0YS5wcm90b3R5cGUuZmlsdGVyID0gZnVuY3Rpb24gKHByZWRpY2F0ZSkge1xuICByZXR1cm4gdGhpcy5vcHMuZmlsdGVyKHByZWRpY2F0ZSk7XG59O1xuXG5EZWx0YS5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uIChwcmVkaWNhdGUpIHtcbiAgdGhpcy5vcHMuZm9yRWFjaChwcmVkaWNhdGUpO1xufTtcblxuRGVsdGEucHJvdG90eXBlLm1hcCA9IGZ1bmN0aW9uIChwcmVkaWNhdGUpIHtcbiAgcmV0dXJuIHRoaXMub3BzLm1hcChwcmVkaWNhdGUpO1xufTtcblxuRGVsdGEucHJvdG90eXBlLnBhcnRpdGlvbiA9IGZ1bmN0aW9uIChwcmVkaWNhdGUpIHtcbiAgdmFyIHBhc3NlZCA9IFtdLCBmYWlsZWQgPSBbXTtcbiAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKG9wKSB7XG4gICAgdmFyIHRhcmdldCA9IHByZWRpY2F0ZShvcCkgPyBwYXNzZWQgOiBmYWlsZWQ7XG4gICAgdGFyZ2V0LnB1c2gob3ApO1xuICB9KTtcbiAgcmV0dXJuIFtwYXNzZWQsIGZhaWxlZF07XG59O1xuXG5EZWx0YS5wcm90b3R5cGUucmVkdWNlID0gZnVuY3Rpb24gKHByZWRpY2F0ZSwgaW5pdGlhbCkge1xuICByZXR1cm4gdGhpcy5vcHMucmVkdWNlKHByZWRpY2F0ZSwgaW5pdGlhbCk7XG59O1xuXG5EZWx0YS5wcm90b3R5cGUuY2hvcCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGxhc3RPcCA9IHRoaXMub3BzW3RoaXMub3BzLmxlbmd0aCAtIDFdO1xuICBpZiAobGFzdE9wICYmIGxhc3RPcC5yZXRhaW4gJiYgIWxhc3RPcC5hdHRyaWJ1dGVzKSB7XG4gICAgdGhpcy5vcHMucG9wKCk7XG4gIH1cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5EZWx0YS5wcm90b3R5cGUubGVuZ3RoID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5yZWR1Y2UoZnVuY3Rpb24gKGxlbmd0aCwgZWxlbSkge1xuICAgIHJldHVybiBsZW5ndGggKyBvcC5sZW5ndGgoZWxlbSk7XG4gIH0sIDApO1xufTtcblxuRGVsdGEucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQpIHtcbiAgc3RhcnQgPSBzdGFydCB8fCAwO1xuICBpZiAodHlwZW9mIGVuZCAhPT0gJ251bWJlcicpIGVuZCA9IEluZmluaXR5O1xuICB2YXIgb3BzID0gW107XG4gIHZhciBpdGVyID0gb3AuaXRlcmF0b3IodGhpcy5vcHMpO1xuICB2YXIgaW5kZXggPSAwO1xuICB3aGlsZSAoaW5kZXggPCBlbmQgJiYgaXRlci5oYXNOZXh0KCkpIHtcbiAgICB2YXIgbmV4dE9wO1xuICAgIGlmIChpbmRleCA8IHN0YXJ0KSB7XG4gICAgICBuZXh0T3AgPSBpdGVyLm5leHQoc3RhcnQgLSBpbmRleCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHRPcCA9IGl0ZXIubmV4dChlbmQgLSBpbmRleCk7XG4gICAgICBvcHMucHVzaChuZXh0T3ApO1xuICAgIH1cbiAgICBpbmRleCArPSBvcC5sZW5ndGgobmV4dE9wKTtcbiAgfVxuICByZXR1cm4gbmV3IERlbHRhKG9wcyk7XG59O1xuXG5cbkRlbHRhLnByb3RvdHlwZS5jb21wb3NlID0gZnVuY3Rpb24gKG90aGVyKSB7XG4gIHZhciB0aGlzSXRlciA9IG9wLml0ZXJhdG9yKHRoaXMub3BzKTtcbiAgdmFyIG90aGVySXRlciA9IG9wLml0ZXJhdG9yKG90aGVyLm9wcyk7XG4gIHZhciBkZWx0YSA9IG5ldyBEZWx0YSgpO1xuICB3aGlsZSAodGhpc0l0ZXIuaGFzTmV4dCgpIHx8IG90aGVySXRlci5oYXNOZXh0KCkpIHtcbiAgICBpZiAob3RoZXJJdGVyLnBlZWtUeXBlKCkgPT09ICdpbnNlcnQnKSB7XG4gICAgICBkZWx0YS5wdXNoKG90aGVySXRlci5uZXh0KCkpO1xuICAgIH0gZWxzZSBpZiAodGhpc0l0ZXIucGVla1R5cGUoKSA9PT0gJ2RlbGV0ZScpIHtcbiAgICAgIGRlbHRhLnB1c2godGhpc0l0ZXIubmV4dCgpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGxlbmd0aCA9IE1hdGgubWluKHRoaXNJdGVyLnBlZWtMZW5ndGgoKSwgb3RoZXJJdGVyLnBlZWtMZW5ndGgoKSk7XG4gICAgICB2YXIgdGhpc09wID0gdGhpc0l0ZXIubmV4dChsZW5ndGgpO1xuICAgICAgdmFyIG90aGVyT3AgPSBvdGhlckl0ZXIubmV4dChsZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBvdGhlck9wLnJldGFpbiA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgdmFyIG5ld09wID0ge307XG4gICAgICAgIGlmICh0eXBlb2YgdGhpc09wLnJldGFpbiA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICBuZXdPcC5yZXRhaW4gPSBsZW5ndGg7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3T3AuaW5zZXJ0ID0gdGhpc09wLmluc2VydDtcbiAgICAgICAgfVxuICAgICAgICAvLyBQcmVzZXJ2ZSBudWxsIHdoZW4gY29tcG9zaW5nIHdpdGggYSByZXRhaW4sIG90aGVyd2lzZSByZW1vdmUgaXQgZm9yIGluc2VydHNcbiAgICAgICAgdmFyIGF0dHJpYnV0ZXMgPSBvcC5hdHRyaWJ1dGVzLmNvbXBvc2UodGhpc09wLmF0dHJpYnV0ZXMsIG90aGVyT3AuYXR0cmlidXRlcywgdHlwZW9mIHRoaXNPcC5yZXRhaW4gPT09ICdudW1iZXInKTtcbiAgICAgICAgaWYgKGF0dHJpYnV0ZXMpIG5ld09wLmF0dHJpYnV0ZXMgPSBhdHRyaWJ1dGVzO1xuICAgICAgICBkZWx0YS5wdXNoKG5ld09wKTtcbiAgICAgIC8vIE90aGVyIG9wIHNob3VsZCBiZSBkZWxldGUsIHdlIGNvdWxkIGJlIGFuIGluc2VydCBvciByZXRhaW5cbiAgICAgIC8vIEluc2VydCArIGRlbGV0ZSBjYW5jZWxzIG91dFxuICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygb3RoZXJPcFsnZGVsZXRlJ10gPT09ICdudW1iZXInICYmIHR5cGVvZiB0aGlzT3AucmV0YWluID09PSAnbnVtYmVyJykge1xuICAgICAgICBkZWx0YS5wdXNoKG90aGVyT3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gZGVsdGEuY2hvcCgpO1xufTtcblxuRGVsdGEucHJvdG90eXBlLmNvbmNhdCA9IGZ1bmN0aW9uIChvdGhlcikge1xuICB2YXIgZGVsdGEgPSBuZXcgRGVsdGEodGhpcy5vcHMuc2xpY2UoKSk7XG4gIGlmIChvdGhlci5vcHMubGVuZ3RoID4gMCkge1xuICAgIGRlbHRhLnB1c2gob3RoZXIub3BzWzBdKTtcbiAgICBkZWx0YS5vcHMgPSBkZWx0YS5vcHMuY29uY2F0KG90aGVyLm9wcy5zbGljZSgxKSk7XG4gIH1cbiAgcmV0dXJuIGRlbHRhO1xufTtcblxuRGVsdGEucHJvdG90eXBlLmRpZmYgPSBmdW5jdGlvbiAob3RoZXIsIGluZGV4KSB7XG4gIGlmICh0aGlzLm9wcyA9PT0gb3RoZXIub3BzKSB7XG4gICAgcmV0dXJuIG5ldyBEZWx0YSgpO1xuICB9XG4gIHZhciBzdHJpbmdzID0gW3RoaXMsIG90aGVyXS5tYXAoZnVuY3Rpb24gKGRlbHRhKSB7XG4gICAgcmV0dXJuIGRlbHRhLm1hcChmdW5jdGlvbiAob3ApIHtcbiAgICAgIGlmIChvcC5pbnNlcnQgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdHlwZW9mIG9wLmluc2VydCA9PT0gJ3N0cmluZycgPyBvcC5pbnNlcnQgOiBOVUxMX0NIQVJBQ1RFUjtcbiAgICAgIH1cbiAgICAgIHZhciBwcmVwID0gKG9wcyA9PT0gb3RoZXIub3BzKSA/ICdvbicgOiAnd2l0aCc7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2RpZmYoKSBjYWxsZWQgJyArIHByZXAgKyAnIG5vbi1kb2N1bWVudCcpO1xuICAgIH0pLmpvaW4oJycpO1xuICB9KTtcbiAgdmFyIGRlbHRhID0gbmV3IERlbHRhKCk7XG4gIHZhciBkaWZmUmVzdWx0ID0gZGlmZihzdHJpbmdzWzBdLCBzdHJpbmdzWzFdLCBpbmRleCk7XG4gIHZhciB0aGlzSXRlciA9IG9wLml0ZXJhdG9yKHRoaXMub3BzKTtcbiAgdmFyIG90aGVySXRlciA9IG9wLml0ZXJhdG9yKG90aGVyLm9wcyk7XG4gIGRpZmZSZXN1bHQuZm9yRWFjaChmdW5jdGlvbiAoY29tcG9uZW50KSB7XG4gICAgdmFyIGxlbmd0aCA9IGNvbXBvbmVudFsxXS5sZW5ndGg7XG4gICAgd2hpbGUgKGxlbmd0aCA+IDApIHtcbiAgICAgIHZhciBvcExlbmd0aCA9IDA7XG4gICAgICBzd2l0Y2ggKGNvbXBvbmVudFswXSkge1xuICAgICAgICBjYXNlIGRpZmYuSU5TRVJUOlxuICAgICAgICAgIG9wTGVuZ3RoID0gTWF0aC5taW4ob3RoZXJJdGVyLnBlZWtMZW5ndGgoKSwgbGVuZ3RoKTtcbiAgICAgICAgICBkZWx0YS5wdXNoKG90aGVySXRlci5uZXh0KG9wTGVuZ3RoKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgZGlmZi5ERUxFVEU6XG4gICAgICAgICAgb3BMZW5ndGggPSBNYXRoLm1pbihsZW5ndGgsIHRoaXNJdGVyLnBlZWtMZW5ndGgoKSk7XG4gICAgICAgICAgdGhpc0l0ZXIubmV4dChvcExlbmd0aCk7XG4gICAgICAgICAgZGVsdGFbJ2RlbGV0ZSddKG9wTGVuZ3RoKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBkaWZmLkVRVUFMOlxuICAgICAgICAgIG9wTGVuZ3RoID0gTWF0aC5taW4odGhpc0l0ZXIucGVla0xlbmd0aCgpLCBvdGhlckl0ZXIucGVla0xlbmd0aCgpLCBsZW5ndGgpO1xuICAgICAgICAgIHZhciB0aGlzT3AgPSB0aGlzSXRlci5uZXh0KG9wTGVuZ3RoKTtcbiAgICAgICAgICB2YXIgb3RoZXJPcCA9IG90aGVySXRlci5uZXh0KG9wTGVuZ3RoKTtcbiAgICAgICAgICBpZiAoZXF1YWwodGhpc09wLmluc2VydCwgb3RoZXJPcC5pbnNlcnQpKSB7XG4gICAgICAgICAgICBkZWx0YS5yZXRhaW4ob3BMZW5ndGgsIG9wLmF0dHJpYnV0ZXMuZGlmZih0aGlzT3AuYXR0cmlidXRlcywgb3RoZXJPcC5hdHRyaWJ1dGVzKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRlbHRhLnB1c2gob3RoZXJPcClbJ2RlbGV0ZSddKG9wTGVuZ3RoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBsZW5ndGggLT0gb3BMZW5ndGg7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGRlbHRhLmNob3AoKTtcbn07XG5cbkRlbHRhLnByb3RvdHlwZS5lYWNoTGluZSA9IGZ1bmN0aW9uIChwcmVkaWNhdGUsIG5ld2xpbmUpIHtcbiAgbmV3bGluZSA9IG5ld2xpbmUgfHwgJ1xcbic7XG4gIHZhciBpdGVyID0gb3AuaXRlcmF0b3IodGhpcy5vcHMpO1xuICB2YXIgbGluZSA9IG5ldyBEZWx0YSgpO1xuICB3aGlsZSAoaXRlci5oYXNOZXh0KCkpIHtcbiAgICBpZiAoaXRlci5wZWVrVHlwZSgpICE9PSAnaW5zZXJ0JykgcmV0dXJuO1xuICAgIHZhciB0aGlzT3AgPSBpdGVyLnBlZWsoKTtcbiAgICB2YXIgc3RhcnQgPSBvcC5sZW5ndGgodGhpc09wKSAtIGl0ZXIucGVla0xlbmd0aCgpO1xuICAgIHZhciBpbmRleCA9IHR5cGVvZiB0aGlzT3AuaW5zZXJ0ID09PSAnc3RyaW5nJyA/XG4gICAgICB0aGlzT3AuaW5zZXJ0LmluZGV4T2YobmV3bGluZSwgc3RhcnQpIC0gc3RhcnQgOiAtMTtcbiAgICBpZiAoaW5kZXggPCAwKSB7XG4gICAgICBsaW5lLnB1c2goaXRlci5uZXh0KCkpO1xuICAgIH0gZWxzZSBpZiAoaW5kZXggPiAwKSB7XG4gICAgICBsaW5lLnB1c2goaXRlci5uZXh0KGluZGV4KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHByZWRpY2F0ZShsaW5lLCBpdGVyLm5leHQoMSkuYXR0cmlidXRlcyB8fCB7fSk7XG4gICAgICBsaW5lID0gbmV3IERlbHRhKCk7XG4gICAgfVxuICB9XG4gIGlmIChsaW5lLmxlbmd0aCgpID4gMCkge1xuICAgIHByZWRpY2F0ZShsaW5lLCB7fSk7XG4gIH1cbn07XG5cbkRlbHRhLnByb3RvdHlwZS50cmFuc2Zvcm0gPSBmdW5jdGlvbiAob3RoZXIsIHByaW9yaXR5KSB7XG4gIHByaW9yaXR5ID0gISFwcmlvcml0eTtcbiAgaWYgKHR5cGVvZiBvdGhlciA9PT0gJ251bWJlcicpIHtcbiAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1Qb3NpdGlvbihvdGhlciwgcHJpb3JpdHkpO1xuICB9XG4gIHZhciB0aGlzSXRlciA9IG9wLml0ZXJhdG9yKHRoaXMub3BzKTtcbiAgdmFyIG90aGVySXRlciA9IG9wLml0ZXJhdG9yKG90aGVyLm9wcyk7XG4gIHZhciBkZWx0YSA9IG5ldyBEZWx0YSgpO1xuICB3aGlsZSAodGhpc0l0ZXIuaGFzTmV4dCgpIHx8IG90aGVySXRlci5oYXNOZXh0KCkpIHtcbiAgICBpZiAodGhpc0l0ZXIucGVla1R5cGUoKSA9PT0gJ2luc2VydCcgJiYgKHByaW9yaXR5IHx8IG90aGVySXRlci5wZWVrVHlwZSgpICE9PSAnaW5zZXJ0JykpIHtcbiAgICAgIGRlbHRhLnJldGFpbihvcC5sZW5ndGgodGhpc0l0ZXIubmV4dCgpKSk7XG4gICAgfSBlbHNlIGlmIChvdGhlckl0ZXIucGVla1R5cGUoKSA9PT0gJ2luc2VydCcpIHtcbiAgICAgIGRlbHRhLnB1c2gob3RoZXJJdGVyLm5leHQoKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBsZW5ndGggPSBNYXRoLm1pbih0aGlzSXRlci5wZWVrTGVuZ3RoKCksIG90aGVySXRlci5wZWVrTGVuZ3RoKCkpO1xuICAgICAgdmFyIHRoaXNPcCA9IHRoaXNJdGVyLm5leHQobGVuZ3RoKTtcbiAgICAgIHZhciBvdGhlck9wID0gb3RoZXJJdGVyLm5leHQobGVuZ3RoKTtcbiAgICAgIGlmICh0aGlzT3BbJ2RlbGV0ZSddKSB7XG4gICAgICAgIC8vIE91ciBkZWxldGUgZWl0aGVyIG1ha2VzIHRoZWlyIGRlbGV0ZSByZWR1bmRhbnQgb3IgcmVtb3ZlcyB0aGVpciByZXRhaW5cbiAgICAgICAgY29udGludWU7XG4gICAgICB9IGVsc2UgaWYgKG90aGVyT3BbJ2RlbGV0ZSddKSB7XG4gICAgICAgIGRlbHRhLnB1c2gob3RoZXJPcCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBXZSByZXRhaW4gZWl0aGVyIHRoZWlyIHJldGFpbiBvciBpbnNlcnRcbiAgICAgICAgZGVsdGEucmV0YWluKGxlbmd0aCwgb3AuYXR0cmlidXRlcy50cmFuc2Zvcm0odGhpc09wLmF0dHJpYnV0ZXMsIG90aGVyT3AuYXR0cmlidXRlcywgcHJpb3JpdHkpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRlbHRhLmNob3AoKTtcbn07XG5cbkRlbHRhLnByb3RvdHlwZS50cmFuc2Zvcm1Qb3NpdGlvbiA9IGZ1bmN0aW9uIChpbmRleCwgcHJpb3JpdHkpIHtcbiAgcHJpb3JpdHkgPSAhIXByaW9yaXR5O1xuICB2YXIgdGhpc0l0ZXIgPSBvcC5pdGVyYXRvcih0aGlzLm9wcyk7XG4gIHZhciBvZmZzZXQgPSAwO1xuICB3aGlsZSAodGhpc0l0ZXIuaGFzTmV4dCgpICYmIG9mZnNldCA8PSBpbmRleCkge1xuICAgIHZhciBsZW5ndGggPSB0aGlzSXRlci5wZWVrTGVuZ3RoKCk7XG4gICAgdmFyIG5leHRUeXBlID0gdGhpc0l0ZXIucGVla1R5cGUoKTtcbiAgICB0aGlzSXRlci5uZXh0KCk7XG4gICAgaWYgKG5leHRUeXBlID09PSAnZGVsZXRlJykge1xuICAgICAgaW5kZXggLT0gTWF0aC5taW4obGVuZ3RoLCBpbmRleCAtIG9mZnNldCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9IGVsc2UgaWYgKG5leHRUeXBlID09PSAnaW5zZXJ0JyAmJiAob2Zmc2V0IDwgaW5kZXggfHwgIXByaW9yaXR5KSkge1xuICAgICAgaW5kZXggKz0gbGVuZ3RoO1xuICAgIH1cbiAgICBvZmZzZXQgKz0gbGVuZ3RoO1xuICB9XG4gIHJldHVybiBpbmRleDtcbn07XG5cblxubW9kdWxlLmV4cG9ydHMgPSBEZWx0YTtcbiIsInZhciBlcXVhbCA9IHJlcXVpcmUoJ2RlZXAtZXF1YWwnKTtcbnZhciBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKTtcblxuXG52YXIgbGliID0ge1xuICBhdHRyaWJ1dGVzOiB7XG4gICAgY29tcG9zZTogZnVuY3Rpb24gKGEsIGIsIGtlZXBOdWxsKSB7XG4gICAgICBpZiAodHlwZW9mIGEgIT09ICdvYmplY3QnKSBhID0ge307XG4gICAgICBpZiAodHlwZW9mIGIgIT09ICdvYmplY3QnKSBiID0ge307XG4gICAgICB2YXIgYXR0cmlidXRlcyA9IGV4dGVuZCh0cnVlLCB7fSwgYik7XG4gICAgICBpZiAoIWtlZXBOdWxsKSB7XG4gICAgICAgIGF0dHJpYnV0ZXMgPSBPYmplY3Qua2V5cyhhdHRyaWJ1dGVzKS5yZWR1Y2UoZnVuY3Rpb24gKGNvcHksIGtleSkge1xuICAgICAgICAgIGlmIChhdHRyaWJ1dGVzW2tleV0gIT0gbnVsbCkge1xuICAgICAgICAgICAgY29weVtrZXldID0gYXR0cmlidXRlc1trZXldO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gY29weTtcbiAgICAgICAgfSwge30pO1xuICAgICAgfVxuICAgICAgZm9yICh2YXIga2V5IGluIGEpIHtcbiAgICAgICAgaWYgKGFba2V5XSAhPT0gdW5kZWZpbmVkICYmIGJba2V5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgYXR0cmlidXRlc1trZXldID0gYVtrZXldO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gT2JqZWN0LmtleXMoYXR0cmlidXRlcykubGVuZ3RoID4gMCA/IGF0dHJpYnV0ZXMgOiB1bmRlZmluZWQ7XG4gICAgfSxcblxuICAgIGRpZmY6IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgIGlmICh0eXBlb2YgYSAhPT0gJ29iamVjdCcpIGEgPSB7fTtcbiAgICAgIGlmICh0eXBlb2YgYiAhPT0gJ29iamVjdCcpIGIgPSB7fTtcbiAgICAgIHZhciBhdHRyaWJ1dGVzID0gT2JqZWN0LmtleXMoYSkuY29uY2F0KE9iamVjdC5rZXlzKGIpKS5yZWR1Y2UoZnVuY3Rpb24gKGF0dHJpYnV0ZXMsIGtleSkge1xuICAgICAgICBpZiAoIWVxdWFsKGFba2V5XSwgYltrZXldKSkge1xuICAgICAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IGJba2V5XSA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IGJba2V5XTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXR0cmlidXRlcztcbiAgICAgIH0sIHt9KTtcbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyhhdHRyaWJ1dGVzKS5sZW5ndGggPiAwID8gYXR0cmlidXRlcyA6IHVuZGVmaW5lZDtcbiAgICB9LFxuXG4gICAgdHJhbnNmb3JtOiBmdW5jdGlvbiAoYSwgYiwgcHJpb3JpdHkpIHtcbiAgICAgIGlmICh0eXBlb2YgYSAhPT0gJ29iamVjdCcpIHJldHVybiBiO1xuICAgICAgaWYgKHR5cGVvZiBiICE9PSAnb2JqZWN0JykgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIGlmICghcHJpb3JpdHkpIHJldHVybiBiOyAgLy8gYiBzaW1wbHkgb3ZlcndyaXRlcyB1cyB3aXRob3V0IHByaW9yaXR5XG4gICAgICB2YXIgYXR0cmlidXRlcyA9IE9iamVjdC5rZXlzKGIpLnJlZHVjZShmdW5jdGlvbiAoYXR0cmlidXRlcywga2V5KSB7XG4gICAgICAgIGlmIChhW2tleV0gPT09IHVuZGVmaW5lZCkgYXR0cmlidXRlc1trZXldID0gYltrZXldOyAgLy8gbnVsbCBpcyBhIHZhbGlkIHZhbHVlXG4gICAgICAgIHJldHVybiBhdHRyaWJ1dGVzO1xuICAgICAgfSwge30pO1xuICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKGF0dHJpYnV0ZXMpLmxlbmd0aCA+IDAgPyBhdHRyaWJ1dGVzIDogdW5kZWZpbmVkO1xuICAgIH1cbiAgfSxcblxuICBpdGVyYXRvcjogZnVuY3Rpb24gKG9wcykge1xuICAgIHJldHVybiBuZXcgSXRlcmF0b3Iob3BzKTtcbiAgfSxcblxuICBsZW5ndGg6IGZ1bmN0aW9uIChvcCkge1xuICAgIGlmICh0eXBlb2Ygb3BbJ2RlbGV0ZSddID09PSAnbnVtYmVyJykge1xuICAgICAgcmV0dXJuIG9wWydkZWxldGUnXTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBvcC5yZXRhaW4gPT09ICdudW1iZXInKSB7XG4gICAgICByZXR1cm4gb3AucmV0YWluO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdHlwZW9mIG9wLmluc2VydCA9PT0gJ3N0cmluZycgPyBvcC5pbnNlcnQubGVuZ3RoIDogMTtcbiAgICB9XG4gIH1cbn07XG5cblxuZnVuY3Rpb24gSXRlcmF0b3Iob3BzKSB7XG4gIHRoaXMub3BzID0gb3BzO1xuICB0aGlzLmluZGV4ID0gMDtcbiAgdGhpcy5vZmZzZXQgPSAwO1xufTtcblxuSXRlcmF0b3IucHJvdG90eXBlLmhhc05leHQgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLnBlZWtMZW5ndGgoKSA8IEluZmluaXR5O1xufTtcblxuSXRlcmF0b3IucHJvdG90eXBlLm5leHQgPSBmdW5jdGlvbiAobGVuZ3RoKSB7XG4gIGlmICghbGVuZ3RoKSBsZW5ndGggPSBJbmZpbml0eTtcbiAgdmFyIG5leHRPcCA9IHRoaXMub3BzW3RoaXMuaW5kZXhdO1xuICBpZiAobmV4dE9wKSB7XG4gICAgdmFyIG9mZnNldCA9IHRoaXMub2Zmc2V0O1xuICAgIHZhciBvcExlbmd0aCA9IGxpYi5sZW5ndGgobmV4dE9wKVxuICAgIGlmIChsZW5ndGggPj0gb3BMZW5ndGggLSBvZmZzZXQpIHtcbiAgICAgIGxlbmd0aCA9IG9wTGVuZ3RoIC0gb2Zmc2V0O1xuICAgICAgdGhpcy5pbmRleCArPSAxO1xuICAgICAgdGhpcy5vZmZzZXQgPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9mZnNldCArPSBsZW5ndGg7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgbmV4dE9wWydkZWxldGUnXSA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiB7ICdkZWxldGUnOiBsZW5ndGggfTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHJldE9wID0ge307XG4gICAgICBpZiAobmV4dE9wLmF0dHJpYnV0ZXMpIHtcbiAgICAgICAgcmV0T3AuYXR0cmlidXRlcyA9IG5leHRPcC5hdHRyaWJ1dGVzO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBuZXh0T3AucmV0YWluID09PSAnbnVtYmVyJykge1xuICAgICAgICByZXRPcC5yZXRhaW4gPSBsZW5ndGg7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBuZXh0T3AuaW5zZXJ0ID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXRPcC5pbnNlcnQgPSBuZXh0T3AuaW5zZXJ0LnN1YnN0cihvZmZzZXQsIGxlbmd0aCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBvZmZzZXQgc2hvdWxkID09PSAwLCBsZW5ndGggc2hvdWxkID09PSAxXG4gICAgICAgIHJldE9wLmluc2VydCA9IG5leHRPcC5pbnNlcnQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmV0T3A7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHJldHVybiB7IHJldGFpbjogSW5maW5pdHkgfTtcbiAgfVxufTtcblxuSXRlcmF0b3IucHJvdG90eXBlLnBlZWsgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLm9wc1t0aGlzLmluZGV4XTtcbn07XG5cbkl0ZXJhdG9yLnByb3RvdHlwZS5wZWVrTGVuZ3RoID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5vcHNbdGhpcy5pbmRleF0pIHtcbiAgICAvLyBTaG91bGQgbmV2ZXIgcmV0dXJuIDAgaWYgb3VyIGluZGV4IGlzIGJlaW5nIG1hbmFnZWQgY29ycmVjdGx5XG4gICAgcmV0dXJuIGxpYi5sZW5ndGgodGhpcy5vcHNbdGhpcy5pbmRleF0pIC0gdGhpcy5vZmZzZXQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIEluZmluaXR5O1xuICB9XG59O1xuXG5JdGVyYXRvci5wcm90b3R5cGUucGVla1R5cGUgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLm9wc1t0aGlzLmluZGV4XSkge1xuICAgIGlmICh0eXBlb2YgdGhpcy5vcHNbdGhpcy5pbmRleF1bJ2RlbGV0ZSddID09PSAnbnVtYmVyJykge1xuICAgICAgcmV0dXJuICdkZWxldGUnO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHRoaXMub3BzW3RoaXMuaW5kZXhdLnJldGFpbiA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiAncmV0YWluJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICdpbnNlcnQnO1xuICAgIH1cbiAgfVxuICByZXR1cm4gJ3JldGFpbic7XG59O1xuXG5cbm1vZHVsZS5leHBvcnRzID0gbGliO1xuIiwidmFyIHBTbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcbnZhciBvYmplY3RLZXlzID0gcmVxdWlyZSgnLi9saWIva2V5cy5qcycpO1xudmFyIGlzQXJndW1lbnRzID0gcmVxdWlyZSgnLi9saWIvaXNfYXJndW1lbnRzLmpzJyk7XG5cbnZhciBkZWVwRXF1YWwgPSBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBvcHRzKSB7XG4gIGlmICghb3B0cykgb3B0cyA9IHt9O1xuICAvLyA3LjEuIEFsbCBpZGVudGljYWwgdmFsdWVzIGFyZSBlcXVpdmFsZW50LCBhcyBkZXRlcm1pbmVkIGJ5ID09PS5cbiAgaWYgKGFjdHVhbCA9PT0gZXhwZWN0ZWQpIHtcbiAgICByZXR1cm4gdHJ1ZTtcblxuICB9IGVsc2UgaWYgKGFjdHVhbCBpbnN0YW5jZW9mIERhdGUgJiYgZXhwZWN0ZWQgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgcmV0dXJuIGFjdHVhbC5nZXRUaW1lKCkgPT09IGV4cGVjdGVkLmdldFRpbWUoKTtcblxuICAvLyA3LjMuIE90aGVyIHBhaXJzIHRoYXQgZG8gbm90IGJvdGggcGFzcyB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCcsXG4gIC8vIGVxdWl2YWxlbmNlIGlzIGRldGVybWluZWQgYnkgPT0uXG4gIH0gZWxzZSBpZiAoIWFjdHVhbCB8fCAhZXhwZWN0ZWQgfHwgdHlwZW9mIGFjdHVhbCAhPSAnb2JqZWN0JyAmJiB0eXBlb2YgZXhwZWN0ZWQgIT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gb3B0cy5zdHJpY3QgPyBhY3R1YWwgPT09IGV4cGVjdGVkIDogYWN0dWFsID09IGV4cGVjdGVkO1xuXG4gIC8vIDcuNC4gRm9yIGFsbCBvdGhlciBPYmplY3QgcGFpcnMsIGluY2x1ZGluZyBBcnJheSBvYmplY3RzLCBlcXVpdmFsZW5jZSBpc1xuICAvLyBkZXRlcm1pbmVkIGJ5IGhhdmluZyB0aGUgc2FtZSBudW1iZXIgb2Ygb3duZWQgcHJvcGVydGllcyAoYXMgdmVyaWZpZWRcbiAgLy8gd2l0aCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwpLCB0aGUgc2FtZSBzZXQgb2Yga2V5c1xuICAvLyAoYWx0aG91Z2ggbm90IG5lY2Vzc2FyaWx5IHRoZSBzYW1lIG9yZGVyKSwgZXF1aXZhbGVudCB2YWx1ZXMgZm9yIGV2ZXJ5XG4gIC8vIGNvcnJlc3BvbmRpbmcga2V5LCBhbmQgYW4gaWRlbnRpY2FsICdwcm90b3R5cGUnIHByb3BlcnR5LiBOb3RlOiB0aGlzXG4gIC8vIGFjY291bnRzIGZvciBib3RoIG5hbWVkIGFuZCBpbmRleGVkIHByb3BlcnRpZXMgb24gQXJyYXlzLlxuICB9IGVsc2Uge1xuICAgIHJldHVybiBvYmpFcXVpdihhY3R1YWwsIGV4cGVjdGVkLCBvcHRzKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZE9yTnVsbCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gaXNCdWZmZXIgKHgpIHtcbiAgaWYgKCF4IHx8IHR5cGVvZiB4ICE9PSAnb2JqZWN0JyB8fCB0eXBlb2YgeC5sZW5ndGggIT09ICdudW1iZXInKSByZXR1cm4gZmFsc2U7XG4gIGlmICh0eXBlb2YgeC5jb3B5ICE9PSAnZnVuY3Rpb24nIHx8IHR5cGVvZiB4LnNsaWNlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICh4Lmxlbmd0aCA+IDAgJiYgdHlwZW9mIHhbMF0gIT09ICdudW1iZXInKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBvYmpFcXVpdihhLCBiLCBvcHRzKSB7XG4gIHZhciBpLCBrZXk7XG4gIGlmIChpc1VuZGVmaW5lZE9yTnVsbChhKSB8fCBpc1VuZGVmaW5lZE9yTnVsbChiKSlcbiAgICByZXR1cm4gZmFsc2U7XG4gIC8vIGFuIGlkZW50aWNhbCAncHJvdG90eXBlJyBwcm9wZXJ0eS5cbiAgaWYgKGEucHJvdG90eXBlICE9PSBiLnByb3RvdHlwZSkgcmV0dXJuIGZhbHNlO1xuICAvL35+fkkndmUgbWFuYWdlZCB0byBicmVhayBPYmplY3Qua2V5cyB0aHJvdWdoIHNjcmV3eSBhcmd1bWVudHMgcGFzc2luZy5cbiAgLy8gICBDb252ZXJ0aW5nIHRvIGFycmF5IHNvbHZlcyB0aGUgcHJvYmxlbS5cbiAgaWYgKGlzQXJndW1lbnRzKGEpKSB7XG4gICAgaWYgKCFpc0FyZ3VtZW50cyhiKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBhID0gcFNsaWNlLmNhbGwoYSk7XG4gICAgYiA9IHBTbGljZS5jYWxsKGIpO1xuICAgIHJldHVybiBkZWVwRXF1YWwoYSwgYiwgb3B0cyk7XG4gIH1cbiAgaWYgKGlzQnVmZmVyKGEpKSB7XG4gICAgaWYgKCFpc0J1ZmZlcihiKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG4gICAgZm9yIChpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhW2ldICE9PSBiW2ldKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHRyeSB7XG4gICAgdmFyIGthID0gb2JqZWN0S2V5cyhhKSxcbiAgICAgICAga2IgPSBvYmplY3RLZXlzKGIpO1xuICB9IGNhdGNoIChlKSB7Ly9oYXBwZW5zIHdoZW4gb25lIGlzIGEgc3RyaW5nIGxpdGVyYWwgYW5kIHRoZSBvdGhlciBpc24ndFxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICAvLyBoYXZpbmcgdGhlIHNhbWUgbnVtYmVyIG9mIG93bmVkIHByb3BlcnRpZXMgKGtleXMgaW5jb3Jwb3JhdGVzXG4gIC8vIGhhc093blByb3BlcnR5KVxuICBpZiAoa2EubGVuZ3RoICE9IGtiLmxlbmd0aClcbiAgICByZXR1cm4gZmFsc2U7XG4gIC8vdGhlIHNhbWUgc2V0IG9mIGtleXMgKGFsdGhvdWdoIG5vdCBuZWNlc3NhcmlseSB0aGUgc2FtZSBvcmRlciksXG4gIGthLnNvcnQoKTtcbiAga2Iuc29ydCgpO1xuICAvL35+fmNoZWFwIGtleSB0ZXN0XG4gIGZvciAoaSA9IGthLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgaWYgKGthW2ldICE9IGtiW2ldKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIC8vZXF1aXZhbGVudCB2YWx1ZXMgZm9yIGV2ZXJ5IGNvcnJlc3BvbmRpbmcga2V5LCBhbmRcbiAgLy9+fn5wb3NzaWJseSBleHBlbnNpdmUgZGVlcCB0ZXN0XG4gIGZvciAoaSA9IGthLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAga2V5ID0ga2FbaV07XG4gICAgaWYgKCFkZWVwRXF1YWwoYVtrZXldLCBiW2tleV0sIG9wdHMpKSByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHR5cGVvZiBhID09PSB0eXBlb2YgYjtcbn1cbiIsInZhciBzdXBwb3J0c0FyZ3VtZW50c0NsYXNzID0gKGZ1bmN0aW9uKCl7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYXJndW1lbnRzKVxufSkoKSA9PSAnW29iamVjdCBBcmd1bWVudHNdJztcblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gc3VwcG9ydHNBcmd1bWVudHNDbGFzcyA/IHN1cHBvcnRlZCA6IHVuc3VwcG9ydGVkO1xuXG5leHBvcnRzLnN1cHBvcnRlZCA9IHN1cHBvcnRlZDtcbmZ1bmN0aW9uIHN1cHBvcnRlZChvYmplY3QpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmplY3QpID09ICdbb2JqZWN0IEFyZ3VtZW50c10nO1xufTtcblxuZXhwb3J0cy51bnN1cHBvcnRlZCA9IHVuc3VwcG9ydGVkO1xuZnVuY3Rpb24gdW5zdXBwb3J0ZWQob2JqZWN0KXtcbiAgcmV0dXJuIG9iamVjdCAmJlxuICAgIHR5cGVvZiBvYmplY3QgPT0gJ29iamVjdCcgJiZcbiAgICB0eXBlb2Ygb2JqZWN0Lmxlbmd0aCA9PSAnbnVtYmVyJyAmJlxuICAgIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsICdjYWxsZWUnKSAmJlxuICAgICFPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwob2JqZWN0LCAnY2FsbGVlJykgfHxcbiAgICBmYWxzZTtcbn07XG4iLCJleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSB0eXBlb2YgT2JqZWN0LmtleXMgPT09ICdmdW5jdGlvbidcbiAgPyBPYmplY3Qua2V5cyA6IHNoaW07XG5cbmV4cG9ydHMuc2hpbSA9IHNoaW07XG5mdW5jdGlvbiBzaGltIChvYmopIHtcbiAgdmFyIGtleXMgPSBbXTtcbiAgZm9yICh2YXIga2V5IGluIG9iaikga2V5cy5wdXNoKGtleSk7XG4gIHJldHVybiBrZXlzO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi90eXBlJyk7XG4iLCJ2YXIgRGVsdGEgPSByZXF1aXJlKCdxdWlsbC1kZWx0YScpO1xuXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBEZWx0YTogRGVsdGEsXG4gIHR5cGU6IHtcbiAgICBuYW1lOiAncmljaC10ZXh0JyxcbiAgICB1cmk6ICdodHRwOi8vc2hhcmVqcy5vcmcvdHlwZXMvcmljaC10ZXh0L3YxJyxcblxuICAgIGNyZWF0ZTogZnVuY3Rpb24gKGluaXRpYWwpIHtcbiAgICAgIHJldHVybiBuZXcgRGVsdGEoaW5pdGlhbCk7XG4gICAgfSxcblxuICAgIGFwcGx5OiBmdW5jdGlvbiAoc25hcHNob3QsIGRlbHRhKSB7XG4gICAgICBzbmFwc2hvdCA9IG5ldyBEZWx0YShzbmFwc2hvdCk7XG4gICAgICBkZWx0YSA9IG5ldyBEZWx0YShkZWx0YSk7XG4gICAgICByZXR1cm4gc25hcHNob3QuY29tcG9zZShkZWx0YSk7XG4gICAgfSxcblxuICAgIGNvbXBvc2U6IGZ1bmN0aW9uIChkZWx0YTEsIGRlbHRhMikge1xuICAgICAgZGVsdGExID0gbmV3IERlbHRhKGRlbHRhMSk7XG4gICAgICBkZWx0YTIgPSBuZXcgRGVsdGEoZGVsdGEyKTtcbiAgICAgIHJldHVybiBkZWx0YTEuY29tcG9zZShkZWx0YTIpO1xuICAgIH0sXG5cbiAgICBkaWZmOiBmdW5jdGlvbiAoZGVsdGExLCBkZWx0YTIpIHtcbiAgICAgIGRlbHRhMSA9IG5ldyBEZWx0YShkZWx0YTEpO1xuICAgICAgZGVsdGEyID0gbmV3IERlbHRhKGRlbHRhMik7XG4gICAgICByZXR1cm4gZGVsdGExLmRpZmYoZGVsdGEyKTtcbiAgICB9LFxuXG4gICAgdHJhbnNmb3JtOiBmdW5jdGlvbiAoZGVsdGExLCBkZWx0YTIsIHNpZGUpIHtcbiAgICAgIGRlbHRhMSA9IG5ldyBEZWx0YShkZWx0YTEpO1xuICAgICAgZGVsdGEyID0gbmV3IERlbHRhKGRlbHRhMik7XG4gICAgICAvLyBGdXp6ZXIgc3BlY3MgaXMgaW4gb3Bwb3NpdGUgb3JkZXIgb2YgZGVsdGEgaW50ZXJmYWNlXG4gICAgICByZXR1cm4gZGVsdGEyLnRyYW5zZm9ybShkZWx0YTEsIHNpZGUgPT09ICdsZWZ0Jyk7XG4gICAgfSxcblxuICAgIHRyYW5zZm9ybUN1cnNvcjogZnVuY3Rpb24oY3Vyc29yLCBkZWx0YSwgaXNPd25PcCkge1xuICAgICAgcmV0dXJuIGRlbHRhLnRyYW5zZm9ybVBvc2l0aW9uKGN1cnNvciwgIWlzT3duT3ApO1xuICAgIH0sXG5cbiAgICBub3JtYWxpemU6IGZ1bmN0aW9uKGRlbHRhKSB7XG4gICAgICByZXR1cm4gZGVsdGE7ICAgLy8gcXVpbGwtZGVsdGEgaXMgYWxyZWFkeSBjYW5vbmljYWxcbiAgICB9LFxuXG4gICAgc2VyaWFsaXplOiBmdW5jdGlvbihkZWx0YSkge1xuICAgICAgcmV0dXJuIGRlbHRhLm9wcztcbiAgICB9LFxuXG4gICAgZGVzZXJpYWxpemU6IGZ1bmN0aW9uKG9wcykge1xuICAgICAgcmV0dXJuIG5ldyBEZWx0YShvcHMpO1xuICAgIH1cbiAgfVxufTtcbiIsImdsb2JhbC5zaGFyZWRiID0gcmVxdWlyZShcIi4uL3NlcnZlci92ZW5kb3Ivc2hhcmVkYi9saWIvY2xpZW50XCIpXG5nbG9iYWwub3RUZXh0ID0gcmVxdWlyZSgnb3QtdGV4dCcpO1xuZ2xvYmFsLnJpY2hUZXh0ID0gcmVxdWlyZSgncmljaC10ZXh0Jyk7XG5cbnNoYXJlZGIudHlwZXMucmVnaXN0ZXIob3RUZXh0LnR5cGUpO1xuc2hhcmVkYi50eXBlcy5yZWdpc3RlcihyaWNoVGV4dC50eXBlKTtcblxuc2hhcmVkYi5Eb2MucHJvdG90eXBlLmNyZWF0ZUNvbnRleHQgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHR5cGUgPSB0aGlzLnR5cGU7XG4gIGlmICghdHlwZSkgdGhyb3cgbmV3IEVycm9yKCdNaXNzaW5nIHR5cGUgJyArIHRoaXMuY29sbGVjdGlvbiArICcgJyArIHRoaXMubmFtZSk7XG5cbiAgLy8gSSBjb3VsZCB1c2UgdGhlIHByb3RvdHlwZSBjaGFpbiB0byBkbyB0aGlzIGluc3RlYWQsIGJ1dCBPYmplY3QuY3JlYXRlXG4gIC8vIGlzbid0IGRlZmluZWQgb24gb2xkIGJyb3dzZXJzLiBUaGlzIHdpbGwgYmUgZmluZS5cbiAgdmFyIGRvYyA9IHRoaXM7XG4gIFxuICB2YXIgY29udGV4dCA9IHtcbiAgICBnZXRTbmFwc2hvdDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gZG9jLnNuYXBzaG90O1xuICAgIH0sXG5cbiAgICBzdWJtaXRPcDogZnVuY3Rpb24ob3AsIGNhbGxiYWNrKSB7XG4gICAgICBkb2Muc3VibWl0T3Aob3AsIGNvbnRleHQsIGNhbGxiYWNrKTtcbiAgICB9LFxuICAgIGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuZGV0YWNoKSB7XG4gICAgICAgIHRoaXMuZGV0YWNoKCk7XG4gICAgICAgIC8vIERvbid0IGRvdWJsZS1kZXRhY2guXG4gICAgICAgIGRlbGV0ZSB0aGlzLmRldGFjaDtcbiAgICAgIH1cbiAgICAgIC8vIEl0IHdpbGwgYmUgcmVtb3ZlZCBmcm9tIHRoZSBhY3R1YWwgZWRpdGluZ0NvbnRleHRzIGxpc3QgbmV4dCB0aW1lXG4gICAgICAvLyB3ZSByZWNlaXZlIGFuIG9wIG9uIHRoZSBkb2N1bWVudCAoYW5kIHRoZSBsaXN0IGlzIGl0ZXJhdGVkIHRocm91Z2gpLlxuICAgICAgLy9cbiAgICAgIC8vIFRoaXMgaXMgcG90ZW50aWFsbHkgZG9kZ3ksIGFsbG93aW5nIGEgbWVtb3J5IGxlYWsgaWYgeW91IGNyZWF0ZSAmXG4gICAgICAvLyBkZXN0cm95IGEgd2hvbGUgYnVuY2ggb2YgY29udGV4dHMgd2l0aG91dCByZWNlaXZpbmcgb3Igc2VuZGluZyBhbnkgb3BzXG4gICAgICAvLyB0byB0aGUgZG9jdW1lbnQuXG4gICAgICAvL1xuICAgICAgLy8gTk9URSBXaHkgY2FuJ3Qgd2UgZGVzdHJveSBjb250ZXh0cyBpbW1lZGlhdGVseT9cbiAgICAgIGRlbGV0ZSB0aGlzLl9vbk9wO1xuICAgICAgdGhpcy5zaG91bGRCZVJlbW92ZWQgPSB0cnVlO1xuICAgIH0sXG5cbiAgICAvLyBUaGlzIGlzIGRhbmdlcm91cywgYnV0IHJlYWxseSByZWFsbHkgdXNlZnVsIGZvciBkZWJ1Z2dpbmcuIEkgaG9wZSBwZW9wbGVcbiAgICAvLyBkb24ndCBkZXBlbmQgb24gaXQuXG4gICAgX2RvYzogdGhpcyxcbiAgfTtcbiAgLy9jb250ZXh0PU9iamVjdC5hc3NpZ24oY29udGV4dCx0aGlzLnR5cGUpXG4gIFxuICBpZiAodHlwZS5hcGkpIHtcbiAgICB2YXIgYXBpPXR5cGUuYXBpKGNvbnRleHQuc25hcHNob3QsY29udGV4dC5zdWJtaXRPcClcbiAgICAvLyBDb3B5IGV2ZXJ5dGhpbmcgZWxzZSBmcm9tIHRoZSB0eXBlJ3MgQVBJIGludG8gdGhlIGVkaXRpbmcgY29udGV4dC5cbiAgICBmb3IgKHZhciBrIGluIGFwaSkge1xuICAgICAgIFxuICAgICAgY29udGV4dFtrXSA9IGFwaVtrXTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgY29udGV4dC5wcm92aWRlcyA9IHt9O1xuICB9XG5cblxuICAvL3RoaXMuZWRpdGluZ0NvbnRleHRzLnB1c2goY29udGV4dCk7XG5cbiAgcmV0dXJuIGNvbnRleHQ7XG59O1xuXG5cbnNoYXJlZGIudHlwZXMubWFwWydqc29uMCddLnJlZ2lzdGVyU3VidHlwZShvdFRleHQudHlwZSk7XG5cbnNoYXJlZGIudHlwZXMubWFwWydqc29uMCddLnJlZ2lzdGVyU3VidHlwZShyaWNoVGV4dC50eXBlKTtcblxuIiwidmFyIERvYyA9IHJlcXVpcmUoJy4vZG9jJyk7XG52YXIgUXVlcnkgPSByZXF1aXJlKCcuL3F1ZXJ5Jyk7XG52YXIgZW1pdHRlciA9IHJlcXVpcmUoJy4uL2VtaXR0ZXInKTtcbnZhciBTaGFyZURCRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvcicpO1xudmFyIHR5cGVzID0gcmVxdWlyZSgnLi4vdHlwZXMnKTtcbnZhciB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuXG4vKipcbiAqIEhhbmRsZXMgY29tbXVuaWNhdGlvbiB3aXRoIHRoZSBzaGFyZWpzIHNlcnZlciBhbmQgcHJvdmlkZXMgcXVlcmllcyBhbmRcbiAqIGRvY3VtZW50cy5cbiAqXG4gKiBXZSBjcmVhdGUgYSBjb25uZWN0aW9uIHdpdGggYSBzb2NrZXQgb2JqZWN0XG4gKiAgIGNvbm5lY3Rpb24gPSBuZXcgc2hhcmVqcy5Db25uZWN0aW9uKHNvY2tzZXQpXG4gKiBUaGUgc29ja2V0IG1heSBiZSBhbnkgb2JqZWN0IGhhbmRsaW5nIHRoZSB3ZWJzb2NrZXQgcHJvdG9jb2wuIFNlZSB0aGVcbiAqIGRvY3VtZW50YXRpb24gb2YgYmluZFRvU29ja2V0KCkgZm9yIGRldGFpbHMuIFdlIHRoZW4gd2FpdCBmb3IgdGhlIGNvbm5lY3Rpb25cbiAqIHRvIGNvbm5lY3RcbiAqICAgY29ubmVjdGlvbi5vbignY29ubmVjdGVkJywgLi4uKVxuICogYW5kIGFyZSBmaW5hbGx5IGFibGUgdG8gd29yayB3aXRoIHNoYXJlZCBkb2N1bWVudHNcbiAqICAgY29ubmVjdGlvbi5nZXQoJ2Zvb2QnLCAnc3RlYWsnKSAvLyBEb2NcbiAqXG4gKiBAcGFyYW0gc29ja2V0IEBzZWUgYmluZFRvU29ja2V0XG4gKi9cbm1vZHVsZS5leHBvcnRzID0gQ29ubmVjdGlvbjtcbmZ1bmN0aW9uIENvbm5lY3Rpb24oc29ja2V0KSB7XG4gIGVtaXR0ZXIuRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG5cbiAgLy8gTWFwIG9mIGNvbGxlY3Rpb24gLT4gaWQgLT4gZG9jIG9iamVjdCBmb3IgY3JlYXRlZCBkb2N1bWVudHMuXG4gIC8vIChjcmVhdGVkIGRvY3VtZW50cyBNVVNUIEJFIFVOSVFVRSlcbiAgdGhpcy5jb2xsZWN0aW9ucyA9IHt9O1xuXG4gIC8vIEVhY2ggcXVlcnkgaXMgY3JlYXRlZCB3aXRoIGFuIGlkIHRoYXQgdGhlIHNlcnZlciB1c2VzIHdoZW4gaXQgc2VuZHMgdXNcbiAgLy8gaW5mbyBhYm91dCB0aGUgcXVlcnkgKHVwZGF0ZXMsIGV0YylcbiAgdGhpcy5uZXh0UXVlcnlJZCA9IDE7XG5cbiAgLy8gTWFwIGZyb20gcXVlcnkgSUQgLT4gcXVlcnkgb2JqZWN0LlxuICB0aGlzLnF1ZXJpZXMgPSB7fTtcblxuICAvLyBBIHVuaXF1ZSBtZXNzYWdlIG51bWJlciBmb3IgdGhlIGdpdmVuIGlkXG4gIHRoaXMuc2VxID0gMTtcblxuICAvLyBFcXVhbHMgYWdlbnQuY2xpZW50SWQgb24gdGhlIHNlcnZlclxuICB0aGlzLmlkID0gbnVsbDtcblxuICAvLyBUaGlzIGRpcmVjdCByZWZlcmVuY2UgZnJvbSBjb25uZWN0aW9uIHRvIGFnZW50IGlzIG5vdCB1c2VkIGludGVybmFsIHRvXG4gIC8vIFNoYXJlREIsIGJ1dCBpdCBpcyBoYW5keSBmb3Igc2VydmVyLXNpZGUgb25seSB1c2VyIGNvZGUgdGhhdCBtYXkgY2FjaGVcbiAgLy8gc3RhdGUgb24gdGhlIGFnZW50IGFuZCByZWFkIGl0IGluIG1pZGRsZXdhcmVcbiAgdGhpcy5hZ2VudCA9IG51bGw7XG5cbiAgdGhpcy5kZWJ1ZyA9IHRydWU7XG5cbiAgdGhpcy5iaW5kVG9Tb2NrZXQoc29ja2V0KTtcbn1cbmVtaXR0ZXIubWl4aW4oQ29ubmVjdGlvbik7XG5cblxuLyoqXG4gKiBVc2Ugc29ja2V0IHRvIGNvbW11bmljYXRlIHdpdGggc2VydmVyXG4gKlxuICogU29ja2V0IGlzIGFuIG9iamVjdCB0aGF0IGNhbiBoYW5kbGUgdGhlIHdlYnNvY2tldCBwcm90b2NvbC4gVGhpcyBtZXRob2RcbiAqIGluc3RhbGxzIHRoZSBvbm9wZW4sIG9uY2xvc2UsIG9ubWVzc2FnZSBhbmQgb25lcnJvciBoYW5kbGVycyBvbiB0aGUgc29ja2V0IHRvXG4gKiBoYW5kbGUgY29tbXVuaWNhdGlvbiBhbmQgc2VuZHMgbWVzc2FnZXMgYnkgY2FsbGluZyBzb2NrZXQuc2VuZChtZXNzYWdlKS4gVGhlXG4gKiBzb2NrZXRzIGByZWFkeVN0YXRlYCBwcm9wZXJ0eSBpcyB1c2VkIHRvIGRldGVybWluZSB0aGUgaW5pdGFpYWwgc3RhdGUuXG4gKlxuICogQHBhcmFtIHNvY2tldCBIYW5kbGVzIHRoZSB3ZWJzb2NrZXQgcHJvdG9jb2xcbiAqIEBwYXJhbSBzb2NrZXQucmVhZHlTdGF0ZVxuICogQHBhcmFtIHNvY2tldC5jbG9zZVxuICogQHBhcmFtIHNvY2tldC5zZW5kXG4gKiBAcGFyYW0gc29ja2V0Lm9ub3BlblxuICogQHBhcmFtIHNvY2tldC5vbmNsb3NlXG4gKiBAcGFyYW0gc29ja2V0Lm9ubWVzc2FnZVxuICogQHBhcmFtIHNvY2tldC5vbmVycm9yXG4gKi9cbkNvbm5lY3Rpb24ucHJvdG90eXBlLmJpbmRUb1NvY2tldCA9IGZ1bmN0aW9uKHNvY2tldCkge1xuICBpZiAodGhpcy5zb2NrZXQpIHtcbiAgICB0aGlzLnNvY2tldC5jbG9zZSgpO1xuICAgIHRoaXMuc29ja2V0Lm9ubWVzc2FnZSA9IG51bGw7XG4gICAgdGhpcy5zb2NrZXQub25vcGVuID0gbnVsbDtcbiAgICB0aGlzLnNvY2tldC5vbmVycm9yID0gbnVsbDtcbiAgICB0aGlzLnNvY2tldC5vbmNsb3NlID0gbnVsbDtcbiAgfVxuXG4gIHRoaXMuc29ja2V0ID0gc29ja2V0O1xuXG4gIC8vIFN0YXRlIG9mIHRoZSBjb25uZWN0aW9uLiBUaGUgY29ycmVzcG9kaW5nIGV2ZW50cyBhcmUgZW1taXRlZCB3aGVuIHRoaXMgY2hhbmdlc1xuICAvL1xuICAvLyAtICdjb25uZWN0aW5nJyAgIFRoZSBjb25uZWN0aW9uIGlzIHN0aWxsIGJlaW5nIGVzdGFibGlzaGVkLCBvciB3ZSBhcmUgc3RpbGxcbiAgLy8gICAgICAgICAgICAgICAgICAgIHdhaXRpbmcgb24gdGhlIHNlcnZlciB0byBzZW5kIHVzIHRoZSBpbml0aWFsaXphdGlvbiBtZXNzYWdlXG4gIC8vIC0gJ2Nvbm5lY3RlZCcgICAgVGhlIGNvbm5lY3Rpb24gaXMgb3BlbiBhbmQgd2UgaGF2ZSBjb25uZWN0ZWQgdG8gYSBzZXJ2ZXJcbiAgLy8gICAgICAgICAgICAgICAgICAgIGFuZCByZWNpZXZlZCB0aGUgaW5pdGlhbGl6YXRpb24gbWVzc2FnZVxuICAvLyAtICdkaXNjb25uZWN0ZWQnIENvbm5lY3Rpb24gaXMgY2xvc2VkLCBidXQgaXQgd2lsbCByZWNvbm5lY3QgYXV0b21hdGljYWxseVxuICAvLyAtICdjbG9zZWQnICAgICAgIFRoZSBjb25uZWN0aW9uIHdhcyBjbG9zZWQgYnkgdGhlIGNsaWVudCwgYW5kIHdpbGwgbm90IHJlY29ubmVjdFxuICAvLyAtICdzdG9wcGVkJyAgICAgIFRoZSBjb25uZWN0aW9uIHdhcyBjbG9zZWQgYnkgdGhlIHNlcnZlciwgYW5kIHdpbGwgbm90IHJlY29ubmVjdFxuICB0aGlzLnN0YXRlID0gKHNvY2tldC5yZWFkeVN0YXRlID09PSAwIHx8IHNvY2tldC5yZWFkeVN0YXRlID09PSAxKSA/ICdjb25uZWN0aW5nJyA6ICdkaXNjb25uZWN0ZWQnO1xuXG4gIC8vIFRoaXMgaXMgYSBoZWxwZXIgdmFyaWFibGUgdGhlIGRvY3VtZW50IHVzZXMgdG8gc2VlIHdoZXRoZXIgd2UncmVcbiAgLy8gY3VycmVudGx5IGluIGEgJ2xpdmUnIHN0YXRlLiBJdCBpcyB0cnVlIGlmIGFuZCBvbmx5IGlmIHdlJ3JlIGNvbm5lY3RlZFxuICB0aGlzLmNhblNlbmQgPSBmYWxzZTtcblxuICB2YXIgY29ubmVjdGlvbiA9IHRoaXM7XG5cbiAgc29ja2V0Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdHJ5IHtcbiAgICAgIHZhciBkYXRhID0gKHR5cGVvZiBldmVudC5kYXRhID09PSAnc3RyaW5nJykgP1xuICAgICAgICBKU09OLnBhcnNlKGV2ZW50LmRhdGEpIDogZXZlbnQuZGF0YTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUud2FybignRmFpbGVkIHRvIHBhcnNlIG1lc3NhZ2UnLCBldmVudCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGNvbm5lY3Rpb24uZGVidWcpIGNvbnNvbGUubG9nKCdSRUNWJywgSlNPTi5zdHJpbmdpZnkoZGF0YSkpO1xuXG4gICAgdmFyIHJlcXVlc3QgPSB7ZGF0YTogZGF0YX07XG4gICAgY29ubmVjdGlvbi5lbWl0KCdyZWNlaXZlJywgcmVxdWVzdCk7XG4gICAgaWYgKCFyZXF1ZXN0LmRhdGEpIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICBjb25uZWN0aW9uLmhhbmRsZU1lc3NhZ2UocmVxdWVzdC5kYXRhKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbm5lY3Rpb24uZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xuXG4gIHNvY2tldC5vbm9wZW4gPSBmdW5jdGlvbigpIHtcbiAgICBjb25uZWN0aW9uLl9zZXRTdGF0ZSgnY29ubmVjdGluZycpO1xuICB9O1xuXG4gIHNvY2tldC5vbmVycm9yID0gZnVuY3Rpb24oZXJyKSB7XG4gICAgLy8gVGhpcyBpc24ndCB0aGUgc2FtZSBhcyBhIHJlZ3VsYXIgZXJyb3IsIGJlY2F1c2UgaXQgd2lsbCBoYXBwZW4gbm9ybWFsbHlcbiAgICAvLyBmcm9tIHRpbWUgdG8gdGltZS4gWW91ciBjb25uZWN0aW9uIHNob3VsZCBwcm9iYWJseSBhdXRvbWF0aWNhbGx5XG4gICAgLy8gcmVjb25uZWN0IGFueXdheSwgYnV0IHRoYXQgc2hvdWxkIGJlIHRyaWdnZXJlZCBvZmYgb25jbG9zZSBub3Qgb25lcnJvci5cbiAgICAvLyAob25jbG9zZSBoYXBwZW5zIHdoZW4gb25lcnJvciBnZXRzIGNhbGxlZCBhbnl3YXkpLlxuICAgIGNvbm5lY3Rpb24uZW1pdCgnY29ubmVjdGlvbiBlcnJvcicsIGVycik7XG4gIH07XG5cbiAgc29ja2V0Lm9uY2xvc2UgPSBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAvLyBub2RlLWJyb3dzZXJjaGFubmVsIHJlYXNvbiB2YWx1ZXM6XG4gICAgLy8gICAnQ2xvc2VkJyAtIFRoZSBzb2NrZXQgd2FzIG1hbnVhbGx5IGNsb3NlZCBieSBjYWxsaW5nIHNvY2tldC5jbG9zZSgpXG4gICAgLy8gICAnU3RvcHBlZCBieSBzZXJ2ZXInIC0gVGhlIHNlcnZlciBzZW50IHRoZSBzdG9wIG1lc3NhZ2UgdG8gdGVsbCB0aGUgY2xpZW50IG5vdCB0byB0cnkgY29ubmVjdGluZ1xuICAgIC8vICAgJ1JlcXVlc3QgZmFpbGVkJyAtIFNlcnZlciBkaWRuJ3QgcmVzcG9uZCB0byByZXF1ZXN0ICh0ZW1wb3JhcnksIHVzdWFsbHkgb2ZmbGluZSlcbiAgICAvLyAgICdVbmtub3duIHNlc3Npb24gSUQnIC0gU2VydmVyIHNlc3Npb24gZm9yIGNsaWVudCBpcyBtaXNzaW5nICh0ZW1wb3JhcnksIHdpbGwgaW1tZWRpYXRlbHkgcmVlc3RhYmxpc2gpXG5cbiAgICBpZiAocmVhc29uID09PSAnY2xvc2VkJyB8fCByZWFzb24gPT09ICdDbG9zZWQnKSB7XG4gICAgICBjb25uZWN0aW9uLl9zZXRTdGF0ZSgnY2xvc2VkJywgcmVhc29uKTtcblxuICAgIH0gZWxzZSBpZiAocmVhc29uID09PSAnc3RvcHBlZCcgfHwgcmVhc29uID09PSAnU3RvcHBlZCBieSBzZXJ2ZXInKSB7XG4gICAgICBjb25uZWN0aW9uLl9zZXRTdGF0ZSgnc3RvcHBlZCcsIHJlYXNvbik7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgY29ubmVjdGlvbi5fc2V0U3RhdGUoJ2Rpc2Nvbm5lY3RlZCcsIHJlYXNvbik7XG4gICAgfVxuICB9O1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge29iamVjdH0gbWVzc2FnZVxuICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UuYSBhY3Rpb25cbiAqL1xuQ29ubmVjdGlvbi5wcm90b3R5cGUuaGFuZGxlTWVzc2FnZSA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgY29uc29sZS5sb2cobWVzc2FnZSlcbiAgdmFyIGVyciA9IG51bGw7XG4gIGlmIChtZXNzYWdlLmVycm9yKSB7XG4gICAgLy8gd3JhcCBpbiBFcnJvciBvYmplY3Qgc28gY2FuIGJlIHBhc3NlZCB0aHJvdWdoIGV2ZW50IGVtaXR0ZXJzXG4gICAgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UuZXJyb3IubWVzc2FnZSk7XG4gICAgZXJyLmNvZGUgPSBtZXNzYWdlLmVycm9yLmNvZGU7XG4gICAgLy8gQWRkIHRoZSBtZXNzYWdlIGRhdGEgdG8gdGhlIGVycm9yIG9iamVjdCBmb3IgbW9yZSBjb250ZXh0XG4gICAgZXJyLmRhdGEgPSBtZXNzYWdlO1xuICAgIGRlbGV0ZSBtZXNzYWdlLmVycm9yO1xuICB9XG4gIC8vIFN3aXRjaCBvbiB0aGUgbWVzc2FnZSBhY3Rpb24uIE1vc3QgbWVzc2FnZXMgYXJlIGZvciBkb2N1bWVudHMgYW5kIGFyZVxuICAvLyBoYW5kbGVkIGluIHRoZSBkb2MgY2xhc3MuXG4gIHN3aXRjaCAobWVzc2FnZS5hKSB7XG4gICAgY2FzZSAnaW5pdCc6XG4gICAgICAvLyBDbGllbnQgaW5pdGlhbGl6YXRpb24gcGFja2V0XG4gICAgICBpZiAobWVzc2FnZS5wcm90b2NvbCAhPT0gMSkge1xuICAgICAgICBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDQwMTksICdJbnZhbGlkIHByb3RvY29sIHZlcnNpb24nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVzLm1hcFttZXNzYWdlLnR5cGVdICE9PSB0eXBlcy5kZWZhdWx0VHlwZSkge1xuICAgICAgICBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDQwMjAsICdJbnZhbGlkIGRlZmF1bHQgdHlwZScpO1xuICAgICAgICByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIG1lc3NhZ2UuaWQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGVyciA9IG5ldyBTaGFyZURCRXJyb3IoNDAyMSwgJ0ludmFsaWQgY2xpZW50IGlkJyk7XG4gICAgICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuaWQgPSBtZXNzYWdlLmlkO1xuXG4gICAgICB0aGlzLl9zZXRTdGF0ZSgnY29ubmVjdGVkJyk7XG4gICAgICByZXR1cm47XG5cbiAgICBjYXNlICdxZic6XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbbWVzc2FnZS5pZF07XG4gICAgICBpZiAocXVlcnkpIHF1ZXJ5Ll9oYW5kbGVGZXRjaChlcnIsIG1lc3NhZ2UuZGF0YSwgbWVzc2FnZS5leHRyYSk7XG4gICAgICByZXR1cm47XG4gICAgY2FzZSAncXMnOlxuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW21lc3NhZ2UuaWRdO1xuICAgICAgaWYgKHF1ZXJ5KSBxdWVyeS5faGFuZGxlU3Vic2NyaWJlKGVyciwgbWVzc2FnZS5kYXRhLCBtZXNzYWdlLmV4dHJhKTtcbiAgICAgIHJldHVybjtcbiAgICBjYXNlICdxdSc6XG4gICAgICAvLyBRdWVyaWVzIGFyZSByZW1vdmVkIGltbWVkaWF0ZWx5IG9uIGNhbGxzIHRvIGRlc3Ryb3ksIHNvIHdlIGlnbm9yZVxuICAgICAgLy8gcmVwbGllcyB0byBxdWVyeSB1bnN1YnNjcmliZXMuIFBlcmhhcHMgdGhlcmUgc2hvdWxkIGJlIGEgY2FsbGJhY2sgZm9yXG4gICAgICAvLyBkZXN0cm95LCBidXQgdGhpcyBpcyBjdXJyZW50bHkgdW5pbXBsZW1lbnRlZFxuICAgICAgcmV0dXJuO1xuICAgIGNhc2UgJ3EnOlxuICAgICAgLy8gUXVlcnkgbWVzc2FnZS4gUGFzcyB0aGlzIHRvIHRoZSBhcHByb3ByaWF0ZSBxdWVyeSBvYmplY3QuXG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbbWVzc2FnZS5pZF07XG4gICAgICBpZiAoIXF1ZXJ5KSByZXR1cm47XG4gICAgICBpZiAoZXJyKSByZXR1cm4gcXVlcnkuX2hhbmRsZUVycm9yKGVycik7XG4gICAgICBpZiAobWVzc2FnZS5kaWZmKSBxdWVyeS5faGFuZGxlRGlmZihtZXNzYWdlLmRpZmYpO1xuICAgICAgaWYgKG1lc3NhZ2UuaGFzT3duUHJvcGVydHkoJ2V4dHJhJykpIHF1ZXJ5Ll9oYW5kbGVFeHRyYShtZXNzYWdlLmV4dHJhKTtcbiAgICAgIHJldHVybjtcblxuICAgIGNhc2UgJ2JmJzpcbiAgICAgIHJldHVybiB0aGlzLl9oYW5kbGVCdWxrTWVzc2FnZShtZXNzYWdlLCAnX2hhbmRsZUZldGNoJyk7XG4gICAgY2FzZSAnYnMnOlxuICAgICAgcmV0dXJuIHRoaXMuX2hhbmRsZUJ1bGtNZXNzYWdlKG1lc3NhZ2UsICdfaGFuZGxlU3Vic2NyaWJlJyk7XG4gICAgY2FzZSAnYnUnOlxuICAgICAgcmV0dXJuIHRoaXMuX2hhbmRsZUJ1bGtNZXNzYWdlKG1lc3NhZ2UsICdfaGFuZGxlVW5zdWJzY3JpYmUnKTtcblxuICAgIGNhc2UgJ2YnOlxuICAgICAgdmFyIGRvYyA9IHRoaXMuZ2V0RXhpc3RpbmcobWVzc2FnZS5jLCBtZXNzYWdlLmQpO1xuICAgICAgaWYgKGRvYykgZG9jLl9oYW5kbGVGZXRjaChlcnIsIG1lc3NhZ2UuZGF0YSk7XG4gICAgICByZXR1cm47XG4gICAgY2FzZSAncyc6XG4gICAgICB2YXIgZG9jID0gdGhpcy5nZXRFeGlzdGluZyhtZXNzYWdlLmMsIG1lc3NhZ2UuZCk7XG4gICAgICBpZiAoZG9jKSBkb2MuX2hhbmRsZVN1YnNjcmliZShlcnIsIG1lc3NhZ2UuZGF0YSk7XG4gICAgICByZXR1cm47XG4gICAgY2FzZSAndSc6XG4gICAgICB2YXIgZG9jID0gdGhpcy5nZXRFeGlzdGluZyhtZXNzYWdlLmMsIG1lc3NhZ2UuZCk7XG4gICAgICBpZiAoZG9jKSBkb2MuX2hhbmRsZVVuc3Vic2NyaWJlKGVycik7XG4gICAgICByZXR1cm47XG4gICAgY2FzZSAnb3AnOlxuICAgICAgdmFyIGRvYyA9IHRoaXMuZ2V0RXhpc3RpbmcobWVzc2FnZS5jLCBtZXNzYWdlLmQpO1xuICAgICAgaWYgKGRvYykgZG9jLl9oYW5kbGVPcChlcnIsIG1lc3NhZ2UpO1xuICAgICAgcmV0dXJuO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIGNvbnNvbGUud2FybignSWdub3JuaW5nIHVucmVjb2duaXplZCBtZXNzYWdlJywgbWVzc2FnZSk7XG4gIH1cbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLl9oYW5kbGVCdWxrTWVzc2FnZSA9IGZ1bmN0aW9uKG1lc3NhZ2UsIG1ldGhvZCkge1xuICBpZiAobWVzc2FnZS5kYXRhKSB7XG4gICAgZm9yICh2YXIgaWQgaW4gbWVzc2FnZS5kYXRhKSB7XG4gICAgICB2YXIgZG9jID0gdGhpcy5nZXRFeGlzdGluZyhtZXNzYWdlLmMsIGlkKTtcbiAgICAgIGlmIChkb2MpIGRvY1ttZXRob2RdKG1lc3NhZ2UuZXJyb3IsIG1lc3NhZ2UuZGF0YVtpZF0pO1xuICAgIH1cbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KG1lc3NhZ2UuYikpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1lc3NhZ2UuYi5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGlkID0gbWVzc2FnZS5iW2ldO1xuICAgICAgdmFyIGRvYyA9IHRoaXMuZ2V0RXhpc3RpbmcobWVzc2FnZS5jLCBpZCk7XG4gICAgICBpZiAoZG9jKSBkb2NbbWV0aG9kXShtZXNzYWdlLmVycm9yKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAobWVzc2FnZS5iKSB7XG4gICAgZm9yICh2YXIgaWQgaW4gbWVzc2FnZS5iKSB7XG4gICAgICB2YXIgZG9jID0gdGhpcy5nZXRFeGlzdGluZyhtZXNzYWdlLmMsIGlkKTtcbiAgICAgIGlmIChkb2MpIGRvY1ttZXRob2RdKG1lc3NhZ2UuZXJyb3IpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmVycm9yKCdJbnZhbGlkIGJ1bGsgbWVzc2FnZScsIG1lc3NhZ2UpO1xuICB9XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fcmVzZXQgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5zZXEgPSAxO1xuICB0aGlzLmlkID0gbnVsbDtcbiAgdGhpcy5hZ2VudCA9IG51bGw7XG59O1xuXG4vLyBTZXQgdGhlIGNvbm5lY3Rpb24ncyBzdGF0ZS4gVGhlIGNvbm5lY3Rpb24gaXMgYmFzaWNhbGx5IGEgc3RhdGUgbWFjaGluZS5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLl9zZXRTdGF0ZSA9IGZ1bmN0aW9uKG5ld1N0YXRlLCByZWFzb24pIHtcbiAgaWYgKHRoaXMuc3RhdGUgPT09IG5ld1N0YXRlKSByZXR1cm47XG5cbiAgLy8gSSBtYWRlIGEgc3RhdGUgZGlhZ3JhbS4gVGhlIG9ubHkgaW52YWxpZCB0cmFuc2l0aW9ucyBhcmUgZ2V0dGluZyB0b1xuICAvLyAnY29ubmVjdGluZycgZnJvbSBhbnl3aGVyZSBvdGhlciB0aGFuICdkaXNjb25uZWN0ZWQnIGFuZCBnZXR0aW5nIHRvXG4gIC8vICdjb25uZWN0ZWQnIGZyb20gYW55d2hlcmUgb3RoZXIgdGhhbiAnY29ubmVjdGluZycuXG4gIGlmIChcbiAgICAobmV3U3RhdGUgPT09ICdjb25uZWN0aW5nJyAmJiB0aGlzLnN0YXRlICE9PSAnZGlzY29ubmVjdGVkJyAmJiB0aGlzLnN0YXRlICE9PSAnc3RvcHBlZCcgJiYgdGhpcy5zdGF0ZSAhPT0gJ2Nsb3NlZCcpIHx8XG4gICAgKG5ld1N0YXRlID09PSAnY29ubmVjdGVkJyAmJiB0aGlzLnN0YXRlICE9PSAnY29ubmVjdGluZycpXG4gICkge1xuICAgIHZhciBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDUwMDcsICdDYW5ub3QgdHJhbnNpdGlvbiBkaXJlY3RseSBmcm9tICcgKyB0aGlzLnN0YXRlICsgJyB0byAnICsgbmV3U3RhdGUpO1xuICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgfVxuXG4gIHRoaXMuc3RhdGUgPSBuZXdTdGF0ZTtcbiAgdGhpcy5jYW5TZW5kID0gKG5ld1N0YXRlID09PSAnY29ubmVjdGVkJyk7XG5cbiAgaWYgKG5ld1N0YXRlID09PSAnZGlzY29ubmVjdGVkJyB8fCBuZXdTdGF0ZSA9PT0gJ3N0b3BwZWQnIHx8IG5ld1N0YXRlID09PSAnY2xvc2VkJykgdGhpcy5fcmVzZXQoKTtcblxuICAvLyBHcm91cCBzdWJzY3JpYmVzIHRvZ2V0aGVyIHRvIGhlbHAgc2VydmVyIG1ha2UgbW9yZSBlZmZpY2llbnQgY2FsbHNcbiAgdGhpcy5zdGFydEJ1bGsoKTtcbiAgLy8gRW1pdCB0aGUgZXZlbnQgdG8gYWxsIHF1ZXJpZXNcbiAgZm9yICh2YXIgaWQgaW4gdGhpcy5xdWVyaWVzKSB7XG4gICAgdmFyIHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW2lkXTtcbiAgICBxdWVyeS5fb25Db25uZWN0aW9uU3RhdGVDaGFuZ2VkKCk7XG4gIH1cbiAgLy8gRW1pdCB0aGUgZXZlbnQgdG8gYWxsIGRvY3VtZW50c1xuICBmb3IgKHZhciBjb2xsZWN0aW9uIGluIHRoaXMuY29sbGVjdGlvbnMpIHtcbiAgICB2YXIgZG9jcyA9IHRoaXMuY29sbGVjdGlvbnNbY29sbGVjdGlvbl07XG4gICAgZm9yICh2YXIgaWQgaW4gZG9jcykge1xuICAgICAgZG9jc1tpZF0uX29uQ29ubmVjdGlvblN0YXRlQ2hhbmdlZCgpO1xuICAgIH1cbiAgfVxuICB0aGlzLmVuZEJ1bGsoKTtcblxuICB0aGlzLmVtaXQobmV3U3RhdGUsIHJlYXNvbik7XG4gIHRoaXMuZW1pdCgnc3RhdGUnLCBuZXdTdGF0ZSwgcmVhc29uKTtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLnN0YXJ0QnVsayA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMuYnVsaykgdGhpcy5idWxrID0ge307XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5lbmRCdWxrID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLmJ1bGspIHtcbiAgICBmb3IgKHZhciBjb2xsZWN0aW9uIGluIHRoaXMuYnVsaykge1xuICAgICAgdmFyIGFjdGlvbnMgPSB0aGlzLmJ1bGtbY29sbGVjdGlvbl07XG4gICAgICB0aGlzLl9zZW5kQnVsaygnZicsIGNvbGxlY3Rpb24sIGFjdGlvbnMuZik7XG4gICAgICB0aGlzLl9zZW5kQnVsaygncycsIGNvbGxlY3Rpb24sIGFjdGlvbnMucyk7XG4gICAgICB0aGlzLl9zZW5kQnVsaygndScsIGNvbGxlY3Rpb24sIGFjdGlvbnMudSk7XG4gICAgfVxuICB9XG4gIHRoaXMuYnVsayA9IG51bGw7XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fc2VuZEJ1bGsgPSBmdW5jdGlvbihhY3Rpb24sIGNvbGxlY3Rpb24sIHZhbHVlcykge1xuICBpZiAoIXZhbHVlcykgcmV0dXJuO1xuICB2YXIgaWRzID0gW107XG4gIHZhciB2ZXJzaW9ucyA9IHt9O1xuICB2YXIgdmVyc2lvbnNDb3VudCA9IDA7XG4gIHZhciB2ZXJzaW9uSWQ7XG4gIGZvciAodmFyIGlkIGluIHZhbHVlcykge1xuICAgIHZhciB2YWx1ZSA9IHZhbHVlc1tpZF07XG4gICAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICAgIGlkcy5wdXNoKGlkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmVyc2lvbnNbaWRdID0gdmFsdWU7XG4gICAgICB2ZXJzaW9uSWQgPSBpZDtcbiAgICAgIHZlcnNpb25zQ291bnQrKztcbiAgICB9XG4gIH1cbiAgaWYgKGlkcy5sZW5ndGggPT09IDEpIHtcbiAgICB2YXIgaWQgPSBpZHNbMF07XG4gICAgdGhpcy5zZW5kKHthOiBhY3Rpb24sIGM6IGNvbGxlY3Rpb24sIGQ6IGlkfSk7XG4gIH0gZWxzZSBpZiAoaWRzLmxlbmd0aCkge1xuICAgIHRoaXMuc2VuZCh7YTogJ2InICsgYWN0aW9uLCBjOiBjb2xsZWN0aW9uLCBiOiBpZHN9KTtcbiAgfVxuICBpZiAodmVyc2lvbnNDb3VudCA9PT0gMSkge1xuICAgIHZhciB2ZXJzaW9uID0gdmVyc2lvbnNbdmVyc2lvbklkXTtcbiAgICB0aGlzLnNlbmQoe2E6IGFjdGlvbiwgYzogY29sbGVjdGlvbiwgZDogdmVyc2lvbklkLCB2OiB2ZXJzaW9ufSk7XG4gIH0gZWxzZSBpZiAodmVyc2lvbnNDb3VudCkge1xuICAgIHRoaXMuc2VuZCh7YTogJ2InICsgYWN0aW9uLCBjOiBjb2xsZWN0aW9uLCBiOiB2ZXJzaW9uc30pO1xuICB9XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fc2VuZEFjdGlvbiA9IGZ1bmN0aW9uKGFjdGlvbiwgZG9jLCB2ZXJzaW9uKSB7XG4gIC8vIEVuc3VyZSB0aGUgZG9jIGlzIHJlZ2lzdGVyZWQgc28gdGhhdCBpdCByZWNlaXZlcyB0aGUgcmVwbHkgbWVzc2FnZVxuICB0aGlzLl9hZGREb2MoZG9jKTtcbiAgaWYgKHRoaXMuYnVsaykge1xuICAgIC8vIEJ1bGsgc3Vic2NyaWJlXG4gICAgdmFyIGFjdGlvbnMgPSB0aGlzLmJ1bGtbZG9jLmNvbGxlY3Rpb25dIHx8ICh0aGlzLmJ1bGtbZG9jLmNvbGxlY3Rpb25dID0ge30pO1xuICAgIHZhciB2ZXJzaW9ucyA9IGFjdGlvbnNbYWN0aW9uXSB8fCAoYWN0aW9uc1thY3Rpb25dID0ge30pO1xuICAgIHZhciBpc0R1cGxpY2F0ZSA9IHZlcnNpb25zLmhhc093blByb3BlcnR5KGRvYy5pZCk7XG4gICAgdmVyc2lvbnNbZG9jLmlkXSA9IHZlcnNpb247XG4gICAgcmV0dXJuIGlzRHVwbGljYXRlO1xuICB9IGVsc2Uge1xuICAgIC8vIFNlbmQgc2luZ2xlIGRvYyBzdWJzY3JpYmUgbWVzc2FnZVxuICAgIHZhciBtZXNzYWdlID0ge2E6IGFjdGlvbiwgYzogZG9jLmNvbGxlY3Rpb24sIGQ6IGRvYy5pZCwgdjogdmVyc2lvbn07XG4gICAgdGhpcy5zZW5kKG1lc3NhZ2UpO1xuICB9XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5zZW5kRmV0Y2ggPSBmdW5jdGlvbihkb2MpIHtcbiAgcmV0dXJuIHRoaXMuX3NlbmRBY3Rpb24oJ2YnLCBkb2MsIGRvYy52ZXJzaW9uKTtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLnNlbmRTdWJzY3JpYmUgPSBmdW5jdGlvbihkb2MpIHtcbiAgcmV0dXJuIHRoaXMuX3NlbmRBY3Rpb24oJ3MnLCBkb2MsIGRvYy52ZXJzaW9uKTtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLnNlbmRVbnN1YnNjcmliZSA9IGZ1bmN0aW9uKGRvYykge1xuICByZXR1cm4gdGhpcy5fc2VuZEFjdGlvbigndScsIGRvYyk7XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5zZW5kT3AgPSBmdW5jdGlvbihkb2MsIG9wKSB7XG4gIC8vIEVuc3VyZSB0aGUgZG9jIGlzIHJlZ2lzdGVyZWQgc28gdGhhdCBpdCByZWNlaXZlcyB0aGUgcmVwbHkgbWVzc2FnZVxuICB0aGlzLl9hZGREb2MoZG9jKTtcbiAgdmFyIG1lc3NhZ2UgPSB7XG4gICAgYTogJ29wJyxcbiAgICBjOiBkb2MuY29sbGVjdGlvbixcbiAgICBkOiBkb2MuaWQsXG4gICAgdjogZG9jLnZlcnNpb24sXG4gICAgc3JjOiBvcC5zcmMsXG4gICAgc2VxOiBvcC5zZXFcbiAgfTtcbiAgaWYgKG9wLm9wKSBtZXNzYWdlLm9wID0gb3Aub3A7XG4gIGlmIChvcC5jcmVhdGUpIG1lc3NhZ2UuY3JlYXRlID0gb3AuY3JlYXRlO1xuICBpZiAob3AuZGVsKSBtZXNzYWdlLmRlbCA9IG9wLmRlbDtcbiAgdGhpcy5zZW5kKG1lc3NhZ2UpO1xufTtcblxuXG4vKipcbiAqIFNlbmRzIGEgbWVzc2FnZSBkb3duIHRoZSBzb2NrZXRcbiAqL1xuQ29ubmVjdGlvbi5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgaWYgKHRoaXMuZGVidWcpIGNvbnNvbGUubG9nKCdTRU5EJywgSlNPTi5zdHJpbmdpZnkobWVzc2FnZSkpO1xuXG4gIHRoaXMuZW1pdCgnc2VuZCcsIG1lc3NhZ2UpO1xuICB0aGlzLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpKTtcbn07XG5cblxuLyoqXG4gKiBDbG9zZXMgdGhlIHNvY2tldCBhbmQgZW1pdHMgJ2Nsb3NlZCdcbiAqL1xuQ29ubmVjdGlvbi5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5zb2NrZXQuY2xvc2UoKTtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLmdldEV4aXN0aW5nID0gZnVuY3Rpb24oY29sbGVjdGlvbiwgaWQpIHtcbiAgaWYgKHRoaXMuY29sbGVjdGlvbnNbY29sbGVjdGlvbl0pIHJldHVybiB0aGlzLmNvbGxlY3Rpb25zW2NvbGxlY3Rpb25dW2lkXTtcbn07XG5cblxuLyoqXG4gKiBHZXQgb3IgY3JlYXRlIGEgZG9jdW1lbnQuXG4gKlxuICogQHBhcmFtIGNvbGxlY3Rpb25cbiAqIEBwYXJhbSBpZFxuICogQHJldHVybiB7RG9jfVxuICovXG5Db25uZWN0aW9uLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihjb2xsZWN0aW9uLCBpZCkge1xuICB2YXIgZG9jcyA9IHRoaXMuY29sbGVjdGlvbnNbY29sbGVjdGlvbl0gfHxcbiAgICAodGhpcy5jb2xsZWN0aW9uc1tjb2xsZWN0aW9uXSA9IHt9KTtcblxuICB2YXIgZG9jID0gZG9jc1tpZF07XG4gIGlmICghZG9jKSB7XG4gICAgZG9jID0gZG9jc1tpZF0gPSBuZXcgRG9jKHRoaXMsIGNvbGxlY3Rpb24sIGlkKTtcbiAgICB0aGlzLmVtaXQoJ2RvYycsIGRvYyk7XG4gIH1cblxuICByZXR1cm4gZG9jO1xufTtcblxuXG4vKipcbiAqIFJlbW92ZSBkb2N1bWVudCBmcm9tIHRoaXMuY29sbGVjdGlvbnNcbiAqXG4gKiBAcHJpdmF0ZVxuICovXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fZGVzdHJveURvYyA9IGZ1bmN0aW9uKGRvYykge1xuICB2YXIgZG9jcyA9IHRoaXMuY29sbGVjdGlvbnNbZG9jLmNvbGxlY3Rpb25dO1xuICBpZiAoIWRvY3MpIHJldHVybjtcblxuICBkZWxldGUgZG9jc1tkb2MuaWRdO1xuXG4gIC8vIERlbGV0ZSB0aGUgY29sbGVjdGlvbiBjb250YWluZXIgaWYgaXRzIGVtcHR5LiBUaGlzIGNvdWxkIGJlIGEgc291cmNlIG9mXG4gIC8vIG1lbW9yeSBsZWFrcyBpZiB5b3Ugc2xvd2x5IG1ha2UgYSBiaWxsaW9uIGNvbGxlY3Rpb25zLCB3aGljaCB5b3UgcHJvYmFibHlcbiAgLy8gd29uJ3QgZG8gYW55d2F5LCBidXQgd2hhdGV2ZXIuXG4gIGlmICghdXRpbC5oYXNLZXlzKGRvY3MpKSB7XG4gICAgZGVsZXRlIHRoaXMuY29sbGVjdGlvbnNbZG9jLmNvbGxlY3Rpb25dO1xuICB9XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fYWRkRG9jID0gZnVuY3Rpb24oZG9jKSB7XG4gIHZhciBkb2NzID0gdGhpcy5jb2xsZWN0aW9uc1tkb2MuY29sbGVjdGlvbl07XG4gIGlmICghZG9jcykge1xuICAgIGRvY3MgPSB0aGlzLmNvbGxlY3Rpb25zW2RvYy5jb2xsZWN0aW9uXSA9IHt9O1xuICB9XG4gIGlmIChkb2NzW2RvYy5pZF0gIT09IGRvYykge1xuICAgIGRvY3NbZG9jLmlkXSA9IGRvYztcbiAgfVxufTtcblxuLy8gSGVscGVyIGZvciBjcmVhdGVGZXRjaFF1ZXJ5IGFuZCBjcmVhdGVTdWJzY3JpYmVRdWVyeSwgYmVsb3cuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5fY3JlYXRlUXVlcnkgPSBmdW5jdGlvbihhY3Rpb24sIGNvbGxlY3Rpb24sIHEsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBpZCA9IHRoaXMubmV4dFF1ZXJ5SWQrKztcbiAgdmFyIHF1ZXJ5ID0gbmV3IFF1ZXJ5KGFjdGlvbiwgdGhpcywgaWQsIGNvbGxlY3Rpb24sIHEsIG9wdGlvbnMsIGNhbGxiYWNrKTtcbiAgdGhpcy5xdWVyaWVzW2lkXSA9IHF1ZXJ5O1xuICBxdWVyeS5zZW5kKCk7XG4gIHJldHVybiBxdWVyeTtcbn07XG5cbi8vIEludGVybmFsIGZ1bmN0aW9uLiBVc2UgcXVlcnkuZGVzdHJveSgpIHRvIHJlbW92ZSBxdWVyaWVzLlxuQ29ubmVjdGlvbi5wcm90b3R5cGUuX2Rlc3Ryb3lRdWVyeSA9IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gIGRlbGV0ZSB0aGlzLnF1ZXJpZXNbcXVlcnkuaWRdO1xufTtcblxuLy8gVGhlIHF1ZXJ5IG9wdGlvbnMgb2JqZWN0IGNhbiBjb250YWluIHRoZSBmb2xsb3dpbmcgZmllbGRzOlxuLy9cbi8vIGRiOiBOYW1lIG9mIHRoZSBkYiBmb3IgdGhlIHF1ZXJ5LiBZb3UgY2FuIGF0dGFjaCBleHRyYURicyB0byBTaGFyZURCIGFuZFxuLy8gICBwaWNrIHdoaWNoIG9uZSB0aGUgcXVlcnkgc2hvdWxkIGhpdCB1c2luZyB0aGlzIHBhcmFtZXRlci5cblxuLy8gQ3JlYXRlIGEgZmV0Y2ggcXVlcnkuIEZldGNoIHF1ZXJpZXMgYXJlIG9ubHkgaXNzdWVkIG9uY2UsIHJldHVybmluZyB0aGVcbi8vIHJlc3VsdHMgZGlyZWN0bHkgaW50byB0aGUgY2FsbGJhY2suXG4vL1xuLy8gVGhlIGNhbGxiYWNrIHNob3VsZCBoYXZlIHRoZSBzaWduYXR1cmUgZnVuY3Rpb24oZXJyb3IsIHJlc3VsdHMsIGV4dHJhKVxuLy8gd2hlcmUgcmVzdWx0cyBpcyBhIGxpc3Qgb2YgRG9jIG9iamVjdHMuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5jcmVhdGVGZXRjaFF1ZXJ5ID0gZnVuY3Rpb24oY29sbGVjdGlvbiwgcSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgcmV0dXJuIHRoaXMuX2NyZWF0ZVF1ZXJ5KCdxZicsIGNvbGxlY3Rpb24sIHEsIG9wdGlvbnMsIGNhbGxiYWNrKTtcbn07XG5cbi8vIENyZWF0ZSBhIHN1YnNjcmliZSBxdWVyeS4gU3Vic2NyaWJlIHF1ZXJpZXMgcmV0dXJuIHdpdGggdGhlIGluaXRpYWwgZGF0YVxuLy8gdGhyb3VnaCB0aGUgY2FsbGJhY2ssIHRoZW4gdXBkYXRlIHRoZW1zZWx2ZXMgd2hlbmV2ZXIgdGhlIHF1ZXJ5IHJlc3VsdCBzZXRcbi8vIGNoYW5nZXMgdmlhIHRoZWlyIG93biBldmVudCBlbWl0dGVyLlxuLy9cbi8vIElmIHByZXNlbnQsIHRoZSBjYWxsYmFjayBzaG91bGQgaGF2ZSB0aGUgc2lnbmF0dXJlIGZ1bmN0aW9uKGVycm9yLCByZXN1bHRzLCBleHRyYSlcbi8vIHdoZXJlIHJlc3VsdHMgaXMgYSBsaXN0IG9mIERvYyBvYmplY3RzLlxuQ29ubmVjdGlvbi5wcm90b3R5cGUuY3JlYXRlU3Vic2NyaWJlUXVlcnkgPSBmdW5jdGlvbihjb2xsZWN0aW9uLCBxLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICByZXR1cm4gdGhpcy5fY3JlYXRlUXVlcnkoJ3FzJywgY29sbGVjdGlvbiwgcSwgb3B0aW9ucywgY2FsbGJhY2spO1xufTtcblxuQ29ubmVjdGlvbi5wcm90b3R5cGUuaGFzUGVuZGluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gISEoXG4gICAgdGhpcy5fZmlyc3REb2MoaGFzUGVuZGluZykgfHxcbiAgICB0aGlzLl9maXJzdFF1ZXJ5KGhhc1BlbmRpbmcpXG4gICk7XG59O1xuZnVuY3Rpb24gaGFzUGVuZGluZyhvYmplY3QpIHtcbiAgcmV0dXJuIG9iamVjdC5oYXNQZW5kaW5nKCk7XG59XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLmhhc1dyaXRlUGVuZGluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gISF0aGlzLl9maXJzdERvYyhoYXNXcml0ZVBlbmRpbmcpO1xufTtcbmZ1bmN0aW9uIGhhc1dyaXRlUGVuZGluZyhvYmplY3QpIHtcbiAgcmV0dXJuIG9iamVjdC5oYXNXcml0ZVBlbmRpbmcoKTtcbn1cblxuQ29ubmVjdGlvbi5wcm90b3R5cGUud2hlbk5vdGhpbmdQZW5kaW5nID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgdmFyIGRvYyA9IHRoaXMuX2ZpcnN0RG9jKGhhc1BlbmRpbmcpO1xuICBpZiAoZG9jKSB7XG4gICAgLy8gSWYgYSBkb2N1bWVudCBpcyBmb3VuZCB3aXRoIGEgcGVuZGluZyBvcGVyYXRpb24sIHdhaXQgZm9yIGl0IHRvIGVtaXRcbiAgICAvLyB0aGF0IG5vdGhpbmcgaXMgcGVuZGluZyBhbnltb3JlLCBhbmQgdGhlbiByZWNoZWNrIGFsbCBkb2N1bWVudHMgYWdhaW4uXG4gICAgLy8gV2UgaGF2ZSB0byByZWNoZWNrIGFsbCBkb2N1bWVudHMsIGp1c3QgaW4gY2FzZSBhbm90aGVyIG11dGF0aW9uIGhhc1xuICAgIC8vIGJlZW4gbWFkZSBpbiB0aGUgbWVhbnRpbWUgYXMgYSByZXN1bHQgb2YgYW4gZXZlbnQgY2FsbGJhY2tcbiAgICBkb2Mub25jZSgnbm90aGluZyBwZW5kaW5nJywgdGhpcy5fbm90aGluZ1BlbmRpbmdSZXRyeShjYWxsYmFjaykpO1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgcXVlcnkgPSB0aGlzLl9maXJzdFF1ZXJ5KGhhc1BlbmRpbmcpO1xuICBpZiAocXVlcnkpIHtcbiAgICBxdWVyeS5vbmNlKCdyZWFkeScsIHRoaXMuX25vdGhpbmdQZW5kaW5nUmV0cnkoY2FsbGJhY2spKTtcbiAgICByZXR1cm47XG4gIH1cbiAgLy8gQ2FsbCBiYWNrIHdoZW4gbm8gcGVuZGluZyBvcGVyYXRpb25zXG4gIHByb2Nlc3MubmV4dFRpY2soY2FsbGJhY2spO1xufTtcbkNvbm5lY3Rpb24ucHJvdG90eXBlLl9ub3RoaW5nUGVuZGluZ1JldHJ5ID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgdmFyIGNvbm5lY3Rpb24gPSB0aGlzO1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICAgIGNvbm5lY3Rpb24ud2hlbk5vdGhpbmdQZW5kaW5nKGNhbGxiYWNrKTtcbiAgICB9KTtcbiAgfTtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLl9maXJzdERvYyA9IGZ1bmN0aW9uKGZuKSB7XG4gIGZvciAodmFyIGNvbGxlY3Rpb24gaW4gdGhpcy5jb2xsZWN0aW9ucykge1xuICAgIHZhciBkb2NzID0gdGhpcy5jb2xsZWN0aW9uc1tjb2xsZWN0aW9uXTtcbiAgICBmb3IgKHZhciBpZCBpbiBkb2NzKSB7XG4gICAgICB2YXIgZG9jID0gZG9jc1tpZF07XG4gICAgICBpZiAoZm4oZG9jKSkge1xuICAgICAgICByZXR1cm4gZG9jO1xuICAgICAgfVxuICAgIH1cbiAgfVxufTtcblxuQ29ubmVjdGlvbi5wcm90b3R5cGUuX2ZpcnN0UXVlcnkgPSBmdW5jdGlvbihmbikge1xuICBmb3IgKHZhciBpZCBpbiB0aGlzLnF1ZXJpZXMpIHtcbiAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbaWRdO1xuICAgIGlmIChmbihxdWVyeSkpIHtcbiAgICAgIHJldHVybiBxdWVyeTtcbiAgICB9XG4gIH1cbn07XG4iLCJ2YXIgZW1pdHRlciA9IHJlcXVpcmUoJy4uL2VtaXR0ZXInKTtcbnZhciBTaGFyZURCRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvcicpO1xudmFyIHR5cGVzID0gcmVxdWlyZSgnLi4vdHlwZXMnKTtcblxuLyoqXG4gKiBBIERvYyBpcyBhIGNsaWVudCdzIHZpZXcgb24gYSBzaGFyZWpzIGRvY3VtZW50LlxuICpcbiAqIEl0IGlzIGlzIHVuaXF1ZWx5IGlkZW50aWZpZWQgYnkgaXRzIGBpZGAgYW5kIGBjb2xsZWN0aW9uYC4gIERvY3VtZW50c1xuICogc2hvdWxkIG5vdCBiZSBjcmVhdGVkIGRpcmVjdGx5LiBDcmVhdGUgdGhlbSB3aXRoIGNvbm5lY3Rpb24uZ2V0KClcbiAqXG4gKlxuICogU3Vic2NyaXB0aW9uc1xuICogLS0tLS0tLS0tLS0tLVxuICpcbiAqIFdlIGNhbiBzdWJzY3JpYmUgYSBkb2N1bWVudCB0byBzdGF5IGluIHN5bmMgd2l0aCB0aGUgc2VydmVyLlxuICogICBkb2Muc3Vic2NyaWJlKGZ1bmN0aW9uKGVycm9yKSB7XG4gKiAgICAgZG9jLnN1YnNjcmliZWQgLy8gPSB0cnVlXG4gKiAgIH0pXG4gKiBUaGUgc2VydmVyIG5vdyBzZW5kcyB1cyBhbGwgY2hhbmdlcyBjb25jZXJuaW5nIHRoaXMgZG9jdW1lbnQgYW5kIHRoZXNlIGFyZVxuICogYXBwbGllZCB0byBvdXIgZGF0YS4gSWYgdGhlIHN1YnNjcmlwdGlvbiB3YXMgc3VjY2Vzc2Z1bCB0aGUgaW5pdGlhbFxuICogZGF0YSBhbmQgdmVyc2lvbiBzZW50IGJ5IHRoZSBzZXJ2ZXIgYXJlIGxvYWRlZCBpbnRvIHRoZSBkb2N1bWVudC5cbiAqXG4gKiBUbyBzdG9wIGxpc3RlbmluZyB0byB0aGUgY2hhbmdlcyB3ZSBjYWxsIGBkb2MudW5zdWJzY3JpYmUoKWAuXG4gKlxuICogSWYgd2UganVzdCB3YW50IHRvIGxvYWQgdGhlIGRhdGEgYnV0IG5vdCBzdGF5IHVwLXRvLWRhdGUsIHdlIGNhbGxcbiAqICAgZG9jLmZldGNoKGZ1bmN0aW9uKGVycm9yKSB7XG4gKiAgICAgZG9jLmRhdGEgLy8gc2VudCBieSBzZXJ2ZXJcbiAqICAgfSlcbiAqXG4gKlxuICogRXZlbnRzXG4gKiAtLS0tLS1cbiAqXG4gKiBZb3UgY2FuIHVzZSBkb2Mub24oZXZlbnROYW1lLCBjYWxsYmFjaykgdG8gc3Vic2NyaWJlIHRvIHRoZSBmb2xsb3dpbmcgZXZlbnRzOlxuICogLSBgYmVmb3JlIG9wIChvcCwgc291cmNlKWAgRmlyZWQgYmVmb3JlIGEgcGFydGlhbCBvcGVyYXRpb24gaXMgYXBwbGllZCB0byB0aGUgZGF0YS5cbiAqICAgSXQgbWF5IGJlIHVzZWQgdG8gcmVhZCB0aGUgb2xkIGRhdGEganVzdCBiZWZvcmUgYXBwbHlpbmcgYW4gb3BlcmF0aW9uXG4gKiAtIGBvcCAob3AsIHNvdXJjZSlgIEZpcmVkIGFmdGVyIGV2ZXJ5IHBhcnRpYWwgb3BlcmF0aW9uIHdpdGggdGhpcyBvcGVyYXRpb24gYXMgdGhlXG4gKiAgIGZpcnN0IGFyZ3VtZW50XG4gKiAtIGBjcmVhdGUgKHNvdXJjZSlgIFRoZSBkb2N1bWVudCB3YXMgY3JlYXRlZC4gVGhhdCBtZWFucyBpdHMgdHlwZSB3YXNcbiAqICAgc2V0IGFuZCBpdCBoYXMgc29tZSBpbml0aWFsIGRhdGEuXG4gKiAtIGBkZWwgKGRhdGEsIHNvdXJjZSlgIEZpcmVkIGFmdGVyIHRoZSBkb2N1bWVudCBpcyBkZWxldGVkLCB0aGF0IGlzXG4gKiAgIHRoZSBkYXRhIGlzIG51bGwuIEl0IGlzIHBhc3NlZCB0aGUgZGF0YSBiZWZvcmUgZGVsdGVpb24gYXMgYW5cbiAqICAgYXJndW1lbnRzXG4gKiAtIGBsb2FkICgpYCBGaXJlZCB3aGVuIGEgbmV3IHNuYXBzaG90IGlzIGluZ2VzdGVkIGZyb20gYSBmZXRjaCwgc3Vic2NyaWJlLCBvciBxdWVyeVxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gRG9jO1xuZnVuY3Rpb24gRG9jKGNvbm5lY3Rpb24sIGNvbGxlY3Rpb24sIGlkKSB7XG4gIGVtaXR0ZXIuRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG5cbiAgdGhpcy5jb25uZWN0aW9uID0gY29ubmVjdGlvbjtcblxuICB0aGlzLmNvbGxlY3Rpb24gPSBjb2xsZWN0aW9uO1xuICB0aGlzLmlkID0gaWQ7XG5cbiAgdGhpcy52ZXJzaW9uID0gbnVsbDtcbiAgdGhpcy50eXBlID0gbnVsbDtcbiAgdGhpcy5kYXRhID0gdW5kZWZpbmVkO1xuXG4gIC8vIEFycmF5IG9mIGNhbGxiYWNrcyBvciBudWxscyBhcyBwbGFjZWhvbGRlcnNcbiAgdGhpcy5pbmZsaWdodEZldGNoID0gW107XG4gIHRoaXMuaW5mbGlnaHRTdWJzY3JpYmUgPSBbXTtcbiAgdGhpcy5pbmZsaWdodFVuc3Vic2NyaWJlID0gW107XG4gIHRoaXMucGVuZGluZ0ZldGNoID0gW107XG5cbiAgLy8gV2hldGhlciB3ZSB0aGluayB3ZSBhcmUgc3Vic2NyaWJlZCBvbiB0aGUgc2VydmVyLiBTeW5jaHJvbm91c2x5IHNldCB0b1xuICAvLyBmYWxzZSBvbiBjYWxscyB0byB1bnN1YnNjcmliZSBhbmQgZGlzY29ubmVjdC4gU2hvdWxkIG5ldmVyIGJlIHRydWUgd2hlblxuICAvLyB0aGlzLndhbnRTdWJzY3JpYmUgaXMgZmFsc2VcbiAgdGhpcy5zdWJzY3JpYmVkID0gZmFsc2U7XG4gIC8vIFdoZXRoZXIgdG8gcmUtZXN0YWJsaXNoIHRoZSBzdWJzY3JpcHRpb24gb24gcmVjb25uZWN0XG4gIHRoaXMud2FudFN1YnNjcmliZSA9IGZhbHNlO1xuXG4gIC8vIFRoZSBvcCB0aGF0IGlzIGN1cnJlbnRseSByb3VuZHRyaXBwaW5nIHRvIHRoZSBzZXJ2ZXIsIG9yIG51bGwuXG4gIC8vXG4gIC8vIFdoZW4gdGhlIGNvbm5lY3Rpb24gcmVjb25uZWN0cywgdGhlIGluZmxpZ2h0IG9wIGlzIHJlc3VibWl0dGVkLlxuICAvL1xuICAvLyBUaGlzIGhhcyB0aGUgc2FtZSBmb3JtYXQgYXMgYW4gZW50cnkgaW4gcGVuZGluZ09wc1xuICB0aGlzLmluZmxpZ2h0T3AgPSBudWxsO1xuXG4gIC8vIEFsbCBvcHMgdGhhdCBhcmUgd2FpdGluZyBmb3IgdGhlIHNlcnZlciB0byBhY2tub3dsZWRnZSB0aGlzLmluZmxpZ2h0T3BcbiAgLy8gVGhpcyB1c2VkIHRvIGp1c3QgYmUgYSBzaW5nbGUgb3BlcmF0aW9uLCBidXQgY3JlYXRlcyAmIGRlbGV0ZXMgY2FuJ3QgYmVcbiAgLy8gY29tcG9zZWQgd2l0aCByZWd1bGFyIG9wZXJhdGlvbnMuXG4gIC8vXG4gIC8vIFRoaXMgaXMgYSBsaXN0IG9mIHtbY3JlYXRlOnsuLi59XSwgW2RlbDp0cnVlXSwgW29wOi4uLl0sIGNhbGxiYWNrczpbLi4uXX1cbiAgdGhpcy5wZW5kaW5nT3BzID0gW107XG5cbiAgLy8gVGhlIE9UIHR5cGUgb2YgdGhpcyBkb2N1bWVudC4gQW4gdW5jcmVhdGVkIGRvY3VtZW50IGhhcyB0eXBlIGBudWxsYFxuICB0aGlzLnR5cGUgPSBudWxsO1xuXG4gIC8vIFRoZSBhcHBseVN0YWNrIGVuYWJsZXMgdXMgdG8gdHJhY2sgYW55IG9wcyBzdWJtaXR0ZWQgd2hpbGUgd2UgYXJlXG4gIC8vIGFwcGx5aW5nIGFuIG9wIGluY3JlbWVudGFsbHkuIFRoaXMgdmFsdWUgaXMgYW4gYXJyYXkgd2hlbiB3ZSBhcmVcbiAgLy8gcGVyZm9ybWluZyBhbiBpbmNyZW1lbnRhbCBhcHBseSBhbmQgbnVsbCBvdGhlcndpc2UuIFdoZW4gaXQgaXMgYW4gYXJyYXksXG4gIC8vIGFsbCBzdWJtaXR0ZWQgb3BzIHNob3VsZCBiZSBwdXNoZWQgb250byBpdC4gVGhlIGBfb3RBcHBseWAgbWV0aG9kIHdpbGxcbiAgLy8gcmVzZXQgaXQgYmFjayB0byBudWxsIHdoZW4gYWxsIGluY3JlbWVudGFsIGFwcGx5IGxvb3BzIGFyZSBjb21wbGV0ZS5cbiAgdGhpcy5hcHBseVN0YWNrID0gbnVsbDtcblxuICAvLyBEaXNhYmxlIHRoZSBkZWZhdWx0IGJlaGF2aW9yIG9mIGNvbXBvc2luZyBzdWJtaXR0ZWQgb3BzLiBUaGlzIGlzIHJlYWQgYXRcbiAgLy8gdGhlIHRpbWUgb2Ygb3Agc3VibWl0LCBzbyBpdCBtYXkgYmUgdG9nZ2xlZCBvbiBiZWZvcmUgc3VibWl0dGluZyBhXG4gIC8vIHNwZWNpZmMgb3AgYW5kIHRvZ2dsZWQgb2ZmIGFmdGVyd2FyZFxuICB0aGlzLnByZXZlbnRDb21wb3NlID0gZmFsc2U7XG59XG5lbWl0dGVyLm1peGluKERvYyk7XG5cbkRvYy5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIHZhciBkb2MgPSB0aGlzO1xuICBkb2Mud2hlbk5vdGhpbmdQZW5kaW5nKGZ1bmN0aW9uKCkge1xuICAgIGRvYy5jb25uZWN0aW9uLl9kZXN0cm95RG9jKGRvYyk7XG4gICAgaWYgKGRvYy53YW50U3Vic2NyaWJlKSB7XG4gICAgICByZXR1cm4gZG9jLnVuc3Vic2NyaWJlKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjaygpO1xuICB9KTtcbn07XG5cblxuLy8gKioqKioqIE1hbmlwdWxhdGluZyB0aGUgZG9jdW1lbnQgZGF0YSwgdmVyc2lvbiBhbmQgdHlwZS5cblxuLy8gU2V0IHRoZSBkb2N1bWVudCdzIHR5cGUsIGFuZCBhc3NvY2lhdGVkIHByb3BlcnRpZXMuIE1vc3Qgb2YgdGhlIGxvZ2ljIGluXG4vLyB0aGlzIGZ1bmN0aW9uIGV4aXN0cyB0byB1cGRhdGUgdGhlIGRvY3VtZW50IGJhc2VkIG9uIGFueSBhZGRlZCAmIHJlbW92ZWQgQVBJXG4vLyBtZXRob2RzLlxuLy9cbi8vIEBwYXJhbSBuZXdUeXBlIE9UIHR5cGUgcHJvdmlkZWQgYnkgdGhlIG90dHlwZXMgbGlicmFyeSBvciBpdHMgbmFtZSBvciB1cmlcbkRvYy5wcm90b3R5cGUuX3NldFR5cGUgPSBmdW5jdGlvbihuZXdUeXBlKSB7XG5cblxuICBpZiAodHlwZW9mIG5ld1R5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgbmV3VHlwZSA9IHR5cGVzLm1hcFtuZXdUeXBlXTtcbiAgfVxuXG4gIGlmIChuZXdUeXBlKSB7XG4gICAgdGhpcy50eXBlID0gbmV3VHlwZTtcblxuICB9IGVsc2UgaWYgKG5ld1R5cGUgPT09IG51bGwpIHtcbiAgICB0aGlzLnR5cGUgPSBuZXdUeXBlO1xuICAgIC8vIElmIHdlIHJlbW92ZWQgdGhlIHR5cGUgZnJvbSB0aGUgb2JqZWN0LCBhbHNvIHJlbW92ZSBpdHMgZGF0YVxuICAgIHRoaXMuZGF0YSA9IHVuZGVmaW5lZDtcblxuICB9IGVsc2Uge1xuICAgIHZhciBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDQwMDgsICdNaXNzaW5nIHR5cGUgJyArIG5ld1R5cGUpO1xuICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgfVxufTtcblxuLy8gSW5nZXN0IHNuYXBzaG90IGRhdGEuIFRoaXMgZGF0YSBtdXN0IGluY2x1ZGUgYSB2ZXJzaW9uLCBzbmFwc2hvdCBhbmQgdHlwZS5cbi8vIFRoaXMgaXMgdXNlZCBib3RoIHRvIGluZ2VzdCBkYXRhIHRoYXQgd2FzIGV4cG9ydGVkIHdpdGggYSB3ZWJwYWdlIGFuZCBkYXRhXG4vLyB0aGF0IHdhcyByZWNlaXZlZCBmcm9tIHRoZSBzZXJ2ZXIgZHVyaW5nIGEgZmV0Y2guXG4vL1xuLy8gQHBhcmFtIHNuYXBzaG90LnYgICAgdmVyc2lvblxuLy8gQHBhcmFtIHNuYXBzaG90LmRhdGFcbi8vIEBwYXJhbSBzbmFwc2hvdC50eXBlXG4vLyBAcGFyYW0gY2FsbGJhY2tcbkRvYy5wcm90b3R5cGUuaW5nZXN0U25hcHNob3QgPSBmdW5jdGlvbihzbmFwc2hvdCwgY2FsbGJhY2spIHtcbiAgaWYgKCFzbmFwc2hvdCkgcmV0dXJuIGNhbGxiYWNrICYmIGNhbGxiYWNrKCk7XG5cbiAgaWYgKHR5cGVvZiBzbmFwc2hvdC52ICE9PSAnbnVtYmVyJykge1xuICAgIHZhciBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDUwMDgsICdNaXNzaW5nIHZlcnNpb24gaW4gaW5nZXN0ZWQgc25hcHNob3QuICcgKyB0aGlzLmNvbGxlY3Rpb24gKyAnLicgKyB0aGlzLmlkKTtcbiAgICBpZiAoY2FsbGJhY2spIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgfVxuXG4gIC8vIElmIHRoZSBkb2MgaXMgYWxyZWFkeSBjcmVhdGVkIG9yIHRoZXJlIGFyZSBvcHMgcGVuZGluZywgd2UgY2Fubm90IHVzZSB0aGVcbiAgLy8gaW5nZXN0ZWQgc25hcHNob3QgYW5kIG5lZWQgb3BzIGluIG9yZGVyIHRvIHVwZGF0ZSB0aGUgZG9jdW1lbnRcbiAgaWYgKHRoaXMudHlwZSB8fCB0aGlzLmhhc1dyaXRlUGVuZGluZygpKSB7XG4gICAgLy8gVGhlIHZlcnNpb24gc2hvdWxkIG9ubHkgYmUgbnVsbCBvbiBhIGNyZWF0ZWQgZG9jdW1lbnQgd2hlbiBpdCB3YXNcbiAgICAvLyBjcmVhdGVkIGxvY2FsbHkgd2l0aG91dCBmZXRjaGluZ1xuICAgIGlmICh0aGlzLnZlcnNpb24gPT0gbnVsbCkge1xuICAgICAgaWYgKHRoaXMuaGFzV3JpdGVQZW5kaW5nKCkpIHtcbiAgICAgICAgLy8gSWYgd2UgaGF2ZSBwZW5kaW5nIG9wcyBhbmQgd2UgZ2V0IGEgc25hcHNob3QgZm9yIGEgbG9jYWxseSBjcmVhdGVkXG4gICAgICAgIC8vIGRvY3VtZW50LCB3ZSBoYXZlIHRvIHdhaXQgZm9yIHRoZSBwZW5kaW5nIG9wcyB0byBjb21wbGV0ZSwgYmVjYXVzZVxuICAgICAgICAvLyB3ZSBkb24ndCBrbm93IHdoYXQgdmVyc2lvbiB0byBmZXRjaCBvcHMgZnJvbS4gSXQgaXMgcG9zc2libGUgdGhhdFxuICAgICAgICAvLyB0aGUgc25hcHNob3QgY2FtZSBmcm9tIG91ciBsb2NhbCBvcCwgYnV0IGl0IGlzIGFsc28gcG9zc2libGUgdGhhdFxuICAgICAgICAvLyB0aGUgZG9jIHdhcyBjcmVhdGVkIHJlbW90ZWx5ICh3aGljaCB3b3VsZCBjb25mbGljdCBhbmQgYmUgYW4gZXJyb3IpXG4gICAgICAgIHJldHVybiBjYWxsYmFjayAmJiB0aGlzLm9uY2UoJ25vIHdyaXRlIHBlbmRpbmcnLCBjYWxsYmFjayk7XG4gICAgICB9XG4gICAgICAvLyBPdGhlcndpc2UsIHdlJ3ZlIGVuY291bnRlZCBhbiBlcnJvciBzdGF0ZVxuICAgICAgdmFyIGVyciA9IG5ldyBTaGFyZURCRXJyb3IoNTAwOSwgJ0Nhbm5vdCBpbmdlc3Qgc25hcHNob3QgaW4gZG9jIHdpdGggbnVsbCB2ZXJzaW9uLiAnICsgdGhpcy5jb2xsZWN0aW9uICsgJy4nICsgdGhpcy5pZCk7XG4gICAgICBpZiAoY2FsbGJhY2spIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgIH1cbiAgICAvLyBJZiB3ZSBnb3QgYSBzbmFwc2hvdCBmb3IgYSB2ZXJzaW9uIGZ1cnRoZXIgYWxvbmcgdGhhbiB0aGUgZG9jdW1lbnQgaXNcbiAgICAvLyBjdXJyZW50bHksIGlzc3VlIGEgZmV0Y2ggdG8gZ2V0IHRoZSBsYXRlc3Qgb3BzIGFuZCBjYXRjaCB1cyB1cFxuICAgIGlmIChzbmFwc2hvdC52ID4gdGhpcy52ZXJzaW9uKSByZXR1cm4gdGhpcy5mZXRjaChjYWxsYmFjayk7XG4gICAgcmV0dXJuIGNhbGxiYWNrICYmIGNhbGxiYWNrKCk7XG4gIH1cblxuICAvLyBJZ25vcmUgdGhlIHNuYXBzaG90IGlmIHdlIGFyZSBhbHJlYWR5IGF0IGEgbmV3ZXIgdmVyc2lvbi4gVW5kZXIgbm9cbiAgLy8gY2lyY3Vtc3RhbmNlIHNob3VsZCB3ZSBldmVyIHNldCB0aGUgY3VycmVudCB2ZXJzaW9uIGJhY2t3YXJkXG4gIGlmICh0aGlzLnZlcnNpb24gPiBzbmFwc2hvdC52KSByZXR1cm4gY2FsbGJhY2sgJiYgY2FsbGJhY2soKTtcblxuICB0aGlzLnZlcnNpb24gPSBzbmFwc2hvdC52O1xuICB2YXIgdHlwZSA9IChzbmFwc2hvdC50eXBlID09PSB1bmRlZmluZWQpID8gdHlwZXMuZGVmYXVsdFR5cGUgOiBzbmFwc2hvdC50eXBlO1xuICB0aGlzLl9zZXRUeXBlKHR5cGUpO1xuICB0aGlzLmRhdGEgPSAodGhpcy50eXBlICYmIHRoaXMudHlwZS5kZXNlcmlhbGl6ZSkgP1xuICAgIHRoaXMudHlwZS5kZXNlcmlhbGl6ZShzbmFwc2hvdC5kYXRhKSA6XG4gICAgc25hcHNob3QuZGF0YTtcbiAgdGhpcy5lbWl0KCdsb2FkJyk7XG4gIGNhbGxiYWNrICYmIGNhbGxiYWNrKCk7XG59O1xuXG5Eb2MucHJvdG90eXBlLndoZW5Ob3RoaW5nUGVuZGluZyA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIGlmICh0aGlzLmhhc1BlbmRpbmcoKSkge1xuICAgIHRoaXMub25jZSgnbm90aGluZyBwZW5kaW5nJywgY2FsbGJhY2spO1xuICAgIHJldHVybjtcbiAgfVxuICBjYWxsYmFjaygpO1xufTtcblxuRG9jLnByb3RvdHlwZS5oYXNQZW5kaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiAhIShcbiAgICB0aGlzLmluZmxpZ2h0T3AgfHxcbiAgICB0aGlzLnBlbmRpbmdPcHMubGVuZ3RoIHx8XG4gICAgdGhpcy5pbmZsaWdodEZldGNoLmxlbmd0aCB8fFxuICAgIHRoaXMuaW5mbGlnaHRTdWJzY3JpYmUubGVuZ3RoIHx8XG4gICAgdGhpcy5pbmZsaWdodFVuc3Vic2NyaWJlLmxlbmd0aCB8fFxuICAgIHRoaXMucGVuZGluZ0ZldGNoLmxlbmd0aFxuICApO1xufTtcblxuRG9jLnByb3RvdHlwZS5oYXNXcml0ZVBlbmRpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuICEhKHRoaXMuaW5mbGlnaHRPcCB8fCB0aGlzLnBlbmRpbmdPcHMubGVuZ3RoKTtcbn07XG5cbkRvYy5wcm90b3R5cGUuX2VtaXROb3RoaW5nUGVuZGluZyA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5oYXNXcml0ZVBlbmRpbmcoKSkgcmV0dXJuO1xuICB0aGlzLmVtaXQoJ25vIHdyaXRlIHBlbmRpbmcnKTtcbiAgaWYgKHRoaXMuaGFzUGVuZGluZygpKSByZXR1cm47XG4gIHRoaXMuZW1pdCgnbm90aGluZyBwZW5kaW5nJyk7XG59O1xuXG4vLyAqKioqIEhlbHBlcnMgZm9yIG5ldHdvcmsgbWVzc2FnZXNcblxuRG9jLnByb3RvdHlwZS5fZW1pdFJlc3BvbnNlRXJyb3IgPSBmdW5jdGlvbihlcnIsIGNhbGxiYWNrKSB7XG4gIGlmIChjYWxsYmFjaykge1xuICAgIGNhbGxiYWNrKGVycik7XG4gICAgdGhpcy5fZW1pdE5vdGhpbmdQZW5kaW5nKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHRoaXMuX2VtaXROb3RoaW5nUGVuZGluZygpO1xuICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbn07XG5cbkRvYy5wcm90b3R5cGUuX2hhbmRsZUZldGNoID0gZnVuY3Rpb24oZXJyLCBzbmFwc2hvdCkge1xuICB2YXIgY2FsbGJhY2sgPSB0aGlzLmluZmxpZ2h0RmV0Y2guc2hpZnQoKTtcbiAgaWYgKGVycikgcmV0dXJuIHRoaXMuX2VtaXRSZXNwb25zZUVycm9yKGVyciwgY2FsbGJhY2spO1xuICB0aGlzLmluZ2VzdFNuYXBzaG90KHNuYXBzaG90LCBjYWxsYmFjayk7XG4gIHRoaXMuX2VtaXROb3RoaW5nUGVuZGluZygpO1xufTtcblxuRG9jLnByb3RvdHlwZS5faGFuZGxlU3Vic2NyaWJlID0gZnVuY3Rpb24oZXJyLCBzbmFwc2hvdCkge1xuICB2YXIgY2FsbGJhY2sgPSB0aGlzLmluZmxpZ2h0U3Vic2NyaWJlLnNoaWZ0KCk7XG4gIGlmIChlcnIpIHJldHVybiB0aGlzLl9lbWl0UmVzcG9uc2VFcnJvcihlcnIsIGNhbGxiYWNrKTtcbiAgLy8gSW5kaWNhdGUgd2UgYXJlIHN1YnNjcmliZWQgb25seSBpZiB0aGUgY2xpZW50IHN0aWxsIHdhbnRzIHRvIGJlLiBJbiB0aGVcbiAgLy8gdGltZSBzaW5jZSBjYWxsaW5nIHN1YnNjcmliZSBhbmQgcmVjZWl2aW5nIGEgcmVzcG9uc2UgZnJvbSB0aGUgc2VydmVyLFxuICAvLyB1bnN1YnNjcmliZSBjb3VsZCBoYXZlIGJlZW4gY2FsbGVkIGFuZCB3ZSBtaWdodCBhbHJlYWR5IGJlIHVuc3Vic2NyaWJlZFxuICAvLyBidXQgbm90IGhhdmUgcmVjZWl2ZWQgdGhlIHJlc3BvbnNlLiBBbHNvLCBiZWNhdXNlIHJlcXVlc3RzIGZyb20gdGhlXG4gIC8vIGNsaWVudCBhcmUgbm90IHNlcmlhbGl6ZWQgYW5kIG1heSB0YWtlIGRpZmZlcmVudCBhc3luYyB0aW1lIHRvIHByb2Nlc3MsXG4gIC8vIGl0IGlzIHBvc3NpYmxlIHRoYXQgd2UgY291bGQgaGVhciByZXNwb25zZXMgYmFjayBpbiBhIGRpZmZlcmVudCBvcmRlclxuICAvLyBmcm9tIHRoZSBvcmRlciBvcmlnaW5hbGx5IHNlbnRcbiAgaWYgKHRoaXMud2FudFN1YnNjcmliZSkgdGhpcy5zdWJzY3JpYmVkID0gdHJ1ZTtcbiAgdGhpcy5pbmdlc3RTbmFwc2hvdChzbmFwc2hvdCwgY2FsbGJhY2spO1xuICB0aGlzLl9lbWl0Tm90aGluZ1BlbmRpbmcoKTtcbn07XG5cbkRvYy5wcm90b3R5cGUuX2hhbmRsZVVuc3Vic2NyaWJlID0gZnVuY3Rpb24oZXJyKSB7XG4gIHZhciBjYWxsYmFjayA9IHRoaXMuaW5mbGlnaHRVbnN1YnNjcmliZS5zaGlmdCgpO1xuICBpZiAoZXJyKSByZXR1cm4gdGhpcy5fZW1pdFJlc3BvbnNlRXJyb3IoZXJyLCBjYWxsYmFjayk7XG4gIGlmIChjYWxsYmFjaykgY2FsbGJhY2soKTtcbiAgdGhpcy5fZW1pdE5vdGhpbmdQZW5kaW5nKCk7XG59O1xuXG5Eb2MucHJvdG90eXBlLl9oYW5kbGVPcCA9IGZ1bmN0aW9uKGVyciwgbWVzc2FnZSkge1xuICBpZiAoZXJyKSB7XG4gICAgaWYgKHRoaXMuaW5mbGlnaHRPcCkge1xuICAgICAgLy8gVGhlIHNlcnZlciBoYXMgcmVqZWN0ZWQgc3VibWlzc2lvbiBvZiB0aGUgY3VycmVudCBvcGVyYXRpb24uIElmIHdlIGdldFxuICAgICAgLy8gYW4gZXJyb3IgY29kZSA0MDAyIFwiT3Agc3VibWl0IHJlamVjdGVkXCIsIHRoaXMgd2FzIGRvbmUgaW50ZW50aW9uYWxseVxuICAgICAgLy8gYW5kIHdlIHNob3VsZCByb2xsIGJhY2sgYnV0IG5vdCByZXR1cm4gYW4gZXJyb3IgdG8gdGhlIHVzZXIuXG4gICAgICBpZiAoZXJyLmNvZGUgPT09IDQwMDIpIGVyciA9IG51bGw7XG4gICAgICByZXR1cm4gdGhpcy5fcm9sbGJhY2soZXJyKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICB9XG5cbiAgaWYgKHRoaXMuaW5mbGlnaHRPcCAmJlxuICAgICAgbWVzc2FnZS5zcmMgPT09IHRoaXMuaW5mbGlnaHRPcC5zcmMgJiZcbiAgICAgIG1lc3NhZ2Uuc2VxID09PSB0aGlzLmluZmxpZ2h0T3Auc2VxKSB7XG4gICAgLy8gVGhlIG9wIGhhcyBhbHJlYWR5IGJlZW4gYXBwbGllZCBsb2NhbGx5LiBKdXN0IHVwZGF0ZSB0aGUgdmVyc2lvblxuICAgIC8vIGFuZCBwZW5kaW5nIHN0YXRlIGFwcHJvcHJpYXRlbHlcbiAgICB0aGlzLl9vcEFja25vd2xlZGdlZChtZXNzYWdlKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAodGhpcy52ZXJzaW9uID09IG51bGwgfHwgbWVzc2FnZS52ID4gdGhpcy52ZXJzaW9uKSB7XG4gICAgLy8gVGhpcyB3aWxsIGhhcHBlbiBpbiBub3JtYWwgb3BlcmF0aW9uIGlmIHdlIGJlY29tZSBzdWJzY3JpYmVkIHRvIGFcbiAgICAvLyBuZXcgZG9jdW1lbnQgdmlhIGEgcXVlcnkuIEl0IGNhbiBhbHNvIGhhcHBlbiBpZiB3ZSBnZXQgYW4gb3AgZm9yXG4gICAgLy8gYSBmdXR1cmUgdmVyc2lvbiBiZXlvbmQgdGhlIHZlcnNpb24gd2UgYXJlIGV4cGVjdGluZyBuZXh0LiBUaGlzXG4gICAgLy8gY291bGQgaGFwcGVuIGlmIHRoZSBzZXJ2ZXIgZG9lc24ndCBwdWJsaXNoIGFuIG9wIGZvciB3aGF0ZXZlciByZWFzb25cbiAgICAvLyBvciBiZWNhdXNlIG9mIGEgcmFjZSBjb25kaXRpb24uIEluIGFueSBjYXNlLCB3ZSBjYW4gc2VuZCBhIGZldGNoXG4gICAgLy8gY29tbWFuZCB0byBjYXRjaCBiYWNrIHVwLlxuICAgIC8vXG4gICAgLy8gRmV0Y2ggb25seSBzZW5kcyBhIG5ldyBmZXRjaCBjb21tYW5kIGlmIG5vIGZldGNoZXMgYXJlIGluZmxpZ2h0LCB3aGljaFxuICAgIC8vIHdpbGwgYWN0IGFzIGEgbmF0dXJhbCBkZWJvdW5jaW5nIHNvIHdlIGRvbid0IHNlbmQgbXVsdGlwbGUgZmV0Y2hcbiAgICAvLyByZXF1ZXN0cyBmb3IgbWFueSBvcHMgcmVjZWl2ZWQgYXQgb25jZS5cbiAgICB0aGlzLmZldGNoKCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKG1lc3NhZ2UudiA8IHRoaXMudmVyc2lvbikge1xuICAgIC8vIFdlIGNhbiBzYWZlbHkgaWdub3JlIHRoZSBvbGQgKGR1cGxpY2F0ZSkgb3BlcmF0aW9uLlxuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmICh0aGlzLmluZmxpZ2h0T3ApIHtcbiAgICB2YXIgdHJhbnNmb3JtRXJyID0gdHJhbnNmb3JtWCh0aGlzLmluZmxpZ2h0T3AsIG1lc3NhZ2UpO1xuICAgIGlmICh0cmFuc2Zvcm1FcnIpIHJldHVybiB0aGlzLl9oYXJkUm9sbGJhY2sodHJhbnNmb3JtRXJyKTtcbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5wZW5kaW5nT3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHRyYW5zZm9ybUVyciA9IHRyYW5zZm9ybVgodGhpcy5wZW5kaW5nT3BzW2ldLCBtZXNzYWdlKTtcbiAgICBpZiAodHJhbnNmb3JtRXJyKSByZXR1cm4gdGhpcy5faGFyZFJvbGxiYWNrKHRyYW5zZm9ybUVycik7XG4gIH1cblxuICB0aGlzLnZlcnNpb24rKztcbiAgdGhpcy5fb3RBcHBseShtZXNzYWdlLCBmYWxzZSk7XG4gIHJldHVybjtcbn07XG5cbi8vIENhbGxlZCB3aGVuZXZlciAoeW91IGd1ZXNzZWQgaXQhKSB0aGUgY29ubmVjdGlvbiBzdGF0ZSBjaGFuZ2VzLiBUaGlzIHdpbGxcbi8vIGhhcHBlbiB3aGVuIHdlIGdldCBkaXNjb25uZWN0ZWQgJiByZWNvbm5lY3QuXG5Eb2MucHJvdG90eXBlLl9vbkNvbm5lY3Rpb25TdGF0ZUNoYW5nZWQgPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMuY29ubmVjdGlvbi5jYW5TZW5kKSB7XG4gICAgdGhpcy5mbHVzaCgpO1xuICAgIHRoaXMuX3Jlc3Vic2NyaWJlKCk7XG4gIH0gZWxzZSB7XG4gICAgaWYgKHRoaXMuaW5mbGlnaHRPcCkge1xuICAgICAgdGhpcy5wZW5kaW5nT3BzLnVuc2hpZnQodGhpcy5pbmZsaWdodE9wKTtcbiAgICAgIHRoaXMuaW5mbGlnaHRPcCA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuc3Vic2NyaWJlZCA9IGZhbHNlO1xuICAgIGlmICh0aGlzLmluZmxpZ2h0RmV0Y2gubGVuZ3RoIHx8IHRoaXMuaW5mbGlnaHRTdWJzY3JpYmUubGVuZ3RoKSB7XG4gICAgICB0aGlzLnBlbmRpbmdGZXRjaCA9IHRoaXMucGVuZGluZ0ZldGNoLmNvbmNhdCh0aGlzLmluZmxpZ2h0RmV0Y2gsIHRoaXMuaW5mbGlnaHRTdWJzY3JpYmUpO1xuICAgICAgdGhpcy5pbmZsaWdodEZldGNoLmxlbmd0aCA9IDA7XG4gICAgICB0aGlzLmluZmxpZ2h0U3Vic2NyaWJlLmxlbmd0aCA9IDA7XG4gICAgfVxuICAgIGlmICh0aGlzLmluZmxpZ2h0VW5zdWJzY3JpYmUubGVuZ3RoKSB7XG4gICAgICB2YXIgY2FsbGJhY2tzID0gdGhpcy5pbmZsaWdodFVuc3Vic2NyaWJlO1xuICAgICAgdGhpcy5pbmZsaWdodFVuc3Vic2NyaWJlID0gW107XG4gICAgICBjYWxsRWFjaChjYWxsYmFja3MpO1xuICAgIH1cbiAgfVxufTtcblxuRG9jLnByb3RvdHlwZS5fcmVzdWJzY3JpYmUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGNhbGxiYWNrcyA9IHRoaXMucGVuZGluZ0ZldGNoO1xuICB0aGlzLnBlbmRpbmdGZXRjaCA9IFtdO1xuXG4gIGlmICh0aGlzLndhbnRTdWJzY3JpYmUpIHtcbiAgICBpZiAoY2FsbGJhY2tzLmxlbmd0aCkge1xuICAgICAgdGhpcy5zdWJzY3JpYmUoZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGNhbGxFYWNoKGNhbGxiYWNrcywgZXJyKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLnN1YnNjcmliZSgpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChjYWxsYmFja3MubGVuZ3RoKSB7XG4gICAgdGhpcy5mZXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgIGNhbGxFYWNoKGNhbGxiYWNrcywgZXJyKTtcbiAgICB9KTtcbiAgfVxufTtcblxuLy8gUmVxdWVzdCB0aGUgY3VycmVudCBkb2N1bWVudCBzbmFwc2hvdCBvciBvcHMgdGhhdCBicmluZyB1cyB1cCB0byBkYXRlXG5Eb2MucHJvdG90eXBlLmZldGNoID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgaWYgKHRoaXMuY29ubmVjdGlvbi5jYW5TZW5kKSB7XG4gICAgdmFyIGlzRHVwbGljYXRlID0gdGhpcy5jb25uZWN0aW9uLnNlbmRGZXRjaCh0aGlzKTtcbiAgICBwdXNoQWN0aW9uQ2FsbGJhY2sodGhpcy5pbmZsaWdodEZldGNoLCBpc0R1cGxpY2F0ZSwgY2FsbGJhY2spO1xuICAgIHJldHVybjtcbiAgfVxuICB0aGlzLnBlbmRpbmdGZXRjaC5wdXNoKGNhbGxiYWNrKTtcbn07XG5cbi8vIEZldGNoIHRoZSBpbml0aWFsIGRvY3VtZW50IGFuZCBrZWVwIHJlY2VpdmluZyB1cGRhdGVzXG5Eb2MucHJvdG90eXBlLnN1YnNjcmliZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIHRoaXMud2FudFN1YnNjcmliZSA9IHRydWU7XG4gIGlmICh0aGlzLmNvbm5lY3Rpb24uY2FuU2VuZCkge1xuICAgIHZhciBpc0R1cGxpY2F0ZSA9IHRoaXMuY29ubmVjdGlvbi5zZW5kU3Vic2NyaWJlKHRoaXMpO1xuICAgIHB1c2hBY3Rpb25DYWxsYmFjayh0aGlzLmluZmxpZ2h0U3Vic2NyaWJlLCBpc0R1cGxpY2F0ZSwgY2FsbGJhY2spO1xuICAgIHJldHVybjtcbiAgfVxuICB0aGlzLnBlbmRpbmdGZXRjaC5wdXNoKGNhbGxiYWNrKTtcbn07XG5cbi8vIFVuc3Vic2NyaWJlLiBUaGUgZGF0YSB3aWxsIHN0YXkgYXJvdW5kIGluIGxvY2FsIG1lbW9yeSwgYnV0IHdlJ2xsIHN0b3Bcbi8vIHJlY2VpdmluZyB1cGRhdGVzXG5Eb2MucHJvdG90eXBlLnVuc3Vic2NyaWJlID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgdGhpcy53YW50U3Vic2NyaWJlID0gZmFsc2U7XG4gIC8vIFRoZSBzdWJzY3JpYmVkIHN0YXRlIHNob3VsZCBiZSBjb25zZXJ2YXRpdmUgaW4gaW5kaWNhdGluZyB3aGVuIHdlIGFyZVxuICAvLyBzdWJzY3JpYmVkIG9uIHRoZSBzZXJ2ZXIuIFdlJ2xsIGFjdHVhbGx5IGJlIHVuc3Vic2NyaWJlZCBzb21lIHRpbWVcbiAgLy8gYmV0d2VlbiBzZW5kaW5nIHRoZSBtZXNzYWdlIGFuZCBoZWFyaW5nIGJhY2ssIGJ1dCB3ZSBjYW5ub3Qga25vdyBleGFjdGx5XG4gIC8vIHdoZW4uIFRodXMsIGltbWVkaWF0ZWx5IG1hcmsgdXMgYXMgbm90IHN1YnNjcmliZWRcbiAgdGhpcy5zdWJzY3JpYmVkID0gZmFsc2U7XG4gIGlmICh0aGlzLmNvbm5lY3Rpb24uY2FuU2VuZCkge1xuICAgIHZhciBpc0R1cGxpY2F0ZSA9IHRoaXMuY29ubmVjdGlvbi5zZW5kVW5zdWJzY3JpYmUodGhpcyk7XG4gICAgcHVzaEFjdGlvbkNhbGxiYWNrKHRoaXMuaW5mbGlnaHRVbnN1YnNjcmliZSwgaXNEdXBsaWNhdGUsIGNhbGxiYWNrKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGNhbGxiYWNrKSBwcm9jZXNzLm5leHRUaWNrKGNhbGxiYWNrKTtcbn07XG5cbmZ1bmN0aW9uIHB1c2hBY3Rpb25DYWxsYmFjayhpbmZsaWdodCwgaXNEdXBsaWNhdGUsIGNhbGxiYWNrKSB7XG4gIGlmIChpc0R1cGxpY2F0ZSkge1xuICAgIHZhciBsYXN0Q2FsbGJhY2sgPSBpbmZsaWdodC5wb3AoKTtcbiAgICBpbmZsaWdodC5wdXNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgbGFzdENhbGxiYWNrICYmIGxhc3RDYWxsYmFjayhlcnIpO1xuICAgICAgY2FsbGJhY2sgJiYgY2FsbGJhY2soZXJyKTtcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBpbmZsaWdodC5wdXNoKGNhbGxiYWNrKTtcbiAgfVxufVxuXG5cbi8vIE9wZXJhdGlvbnMgLy9cblxuLy8gU2VuZCB0aGUgbmV4dCBwZW5kaW5nIG9wIHRvIHRoZSBzZXJ2ZXIsIGlmIHdlIGNhbi5cbi8vXG4vLyBPbmx5IG9uZSBvcGVyYXRpb24gY2FuIGJlIGluLWZsaWdodCBhdCBhIHRpbWUuIElmIGFuIG9wZXJhdGlvbiBpcyBhbHJlYWR5IG9uXG4vLyBpdHMgd2F5LCBvciB3ZSdyZSBub3QgY3VycmVudGx5IGNvbm5lY3RlZCwgdGhpcyBtZXRob2QgZG9lcyBub3RoaW5nLlxuRG9jLnByb3RvdHlwZS5mbHVzaCA9IGZ1bmN0aW9uKCkge1xuICAvLyBJZ25vcmUgaWYgd2UgY2FuJ3Qgc2VuZCBvciB3ZSBhcmUgYWxyZWFkeSBzZW5kaW5nIGFuIG9wXG4gIGlmICghdGhpcy5jb25uZWN0aW9uLmNhblNlbmQgfHwgdGhpcy5pbmZsaWdodE9wKSByZXR1cm47XG5cbiAgLy8gU2VuZCBmaXJzdCBwZW5kaW5nIG9wIHVubGVzcyBwYXVzZWRcbiAgaWYgKCF0aGlzLnBhdXNlZCAmJiB0aGlzLnBlbmRpbmdPcHMubGVuZ3RoKSB7XG4gICAgdGhpcy5fc2VuZE9wKCk7XG4gIH1cbn07XG5cbi8vIEhlbHBlciBmdW5jdGlvbiB0byBzZXQgb3AgdG8gY29udGFpbiBhIG5vLW9wLlxuZnVuY3Rpb24gc2V0Tm9PcChvcCkge1xuICBkZWxldGUgb3Aub3A7XG4gIGRlbGV0ZSBvcC5jcmVhdGU7XG4gIGRlbGV0ZSBvcC5kZWw7XG59XG5cbi8vIFRyYW5zZm9ybSBzZXJ2ZXIgb3AgZGF0YSBieSBhIGNsaWVudCBvcCwgYW5kIHZpY2UgdmVyc2EuIE9wcyBhcmUgZWRpdGVkIGluIHBsYWNlLlxuZnVuY3Rpb24gdHJhbnNmb3JtWChjbGllbnQsIHNlcnZlcikge1xuICAvLyBPcmRlciBvZiBzdGF0ZW1lbnRzIGluIHRoaXMgZnVuY3Rpb24gbWF0dGVycy4gQmUgZXNwZWNpYWxseSBjYXJlZnVsIGlmXG4gIC8vIHJlZmFjdG9yaW5nIHRoaXMgZnVuY3Rpb25cblxuICAvLyBBIGNsaWVudCBkZWxldGUgb3Agc2hvdWxkIGRvbWluYXRlIGlmIGJvdGggdGhlIHNlcnZlciBhbmQgdGhlIGNsaWVudFxuICAvLyBkZWxldGUgdGhlIGRvY3VtZW50LiBUaHVzLCBhbnkgb3BzIGZvbGxvd2luZyB0aGUgY2xpZW50IGRlbGV0ZSAoc3VjaCBhcyBhXG4gIC8vIHN1YnNlcXVlbnQgY3JlYXRlKSB3aWxsIGJlIG1haW50YWluZWQsIHNpbmNlIHRoZSBzZXJ2ZXIgb3AgaXMgdHJhbnNmb3JtZWRcbiAgLy8gdG8gYSBuby1vcFxuICBpZiAoY2xpZW50LmRlbCkgcmV0dXJuIHNldE5vT3Aoc2VydmVyKTtcblxuICBpZiAoc2VydmVyLmRlbCkge1xuICAgIHJldHVybiBuZXcgU2hhcmVEQkVycm9yKDQwMTcsICdEb2N1bWVudCB3YXMgZGVsZXRlZCcpO1xuICB9XG4gIGlmIChzZXJ2ZXIuY3JlYXRlKSB7XG4gICAgcmV0dXJuIG5ldyBTaGFyZURCRXJyb3IoNDAxOCwgJ0RvY3VtZW50IGFscmVkeSBjcmVhdGVkJyk7XG4gIH1cblxuICAvLyBJZ25vcmUgbm8tb3AgY29taW5nIGZyb20gc2VydmVyXG4gIGlmICghc2VydmVyLm9wKSByZXR1cm47XG5cbiAgLy8gSSBiZWxpZXZlIHRoYXQgdGhpcyBzaG91bGQgbm90IG9jY3VyLCBidXQgY2hlY2sganVzdCBpbiBjYXNlXG4gIGlmIChjbGllbnQuY3JlYXRlKSB7XG4gICAgcmV0dXJuIG5ldyBTaGFyZURCRXJyb3IoNDAxOCwgJ0RvY3VtZW50IGFscmVhZHkgY3JlYXRlZCcpO1xuICB9XG5cbiAgLy8gVGhleSBib3RoIGVkaXRlZCB0aGUgZG9jdW1lbnQuIFRoaXMgaXMgdGhlIG5vcm1hbCBjYXNlIGZvciB0aGlzIGZ1bmN0aW9uIC1cbiAgLy8gYXMgaW4sIG1vc3Qgb2YgdGhlIHRpbWUgd2UnbGwgZW5kIHVwIGRvd24gaGVyZS5cbiAgLy9cbiAgLy8gWW91IHNob3VsZCBiZSB3b25kZXJpbmcgd2h5IEknbSB1c2luZyBjbGllbnQudHlwZSBpbnN0ZWFkIG9mIHRoaXMudHlwZS5cbiAgLy8gVGhlIHJlYXNvbiBpcywgaWYgd2UgZ2V0IG9wcyBhdCBhbiBvbGQgdmVyc2lvbiBvZiB0aGUgZG9jdW1lbnQsIHRoaXMudHlwZVxuICAvLyBtaWdodCBiZSB1bmRlZmluZWQgb3IgYSB0b3RhbGx5IGRpZmZlcmVudCB0eXBlLiBCeSBwaW5uaW5nIHRoZSB0eXBlIHRvIHRoZVxuICAvLyBvcCBkYXRhLCB3ZSBtYWtlIHN1cmUgdGhlIHJpZ2h0IHR5cGUgaGFzIGl0cyB0cmFuc2Zvcm0gZnVuY3Rpb24gY2FsbGVkLlxuICBpZiAoY2xpZW50LnR5cGUudHJhbnNmb3JtWCkge1xuICAgIHZhciByZXN1bHQgPSBjbGllbnQudHlwZS50cmFuc2Zvcm1YKGNsaWVudC5vcCwgc2VydmVyLm9wKTtcbiAgICBjbGllbnQub3AgPSByZXN1bHRbMF07XG4gICAgc2VydmVyLm9wID0gcmVzdWx0WzFdO1xuICB9IGVsc2Uge1xuICAgIHZhciBjbGllbnRPcCA9IGNsaWVudC50eXBlLnRyYW5zZm9ybShjbGllbnQub3AsIHNlcnZlci5vcCwgJ2xlZnQnKTtcbiAgICB2YXIgc2VydmVyT3AgPSBjbGllbnQudHlwZS50cmFuc2Zvcm0oc2VydmVyLm9wLCBjbGllbnQub3AsICdyaWdodCcpO1xuICAgIGNsaWVudC5vcCA9IGNsaWVudE9wO1xuICAgIHNlcnZlci5vcCA9IHNlcnZlck9wO1xuICB9XG59O1xuXG4vKipcbiAqIEFwcGxpZXMgdGhlIG9wZXJhdGlvbiB0byB0aGUgc25hcHNob3RcbiAqXG4gKiBJZiB0aGUgb3BlcmF0aW9uIGlzIGNyZWF0ZSBvciBkZWxldGUgaXQgZW1pdHMgYGNyZWF0ZWAgb3IgYGRlbGAuIFRoZW4gdGhlXG4gKiBvcGVyYXRpb24gaXMgYXBwbGllZCB0byB0aGUgc25hcHNob3QgYW5kIGBvcGAgYW5kIGBhZnRlciBvcGAgYXJlIGVtaXR0ZWQuXG4gKiBJZiB0aGUgdHlwZSBzdXBwb3J0cyBpbmNyZW1lbnRhbCB1cGRhdGVzIGFuZCBgdGhpcy5pbmNyZW1lbnRhbGAgaXMgdHJ1ZSB3ZVxuICogZmlyZSBgb3BgIGFmdGVyIGV2ZXJ5IHNtYWxsIG9wZXJhdGlvbi5cbiAqXG4gKiBUaGlzIGlzIHRoZSBvbmx5IGZ1bmN0aW9uIHRvIGZpcmUgdGhlIGFib3ZlIG1lbnRpb25lZCBldmVudHMuXG4gKlxuICogQHByaXZhdGVcbiAqL1xuRG9jLnByb3RvdHlwZS5fb3RBcHBseSA9IGZ1bmN0aW9uKG9wLCBzb3VyY2UpIHtcbiAgaWYgKG9wLm9wKSB7XG4gICAgaWYgKCF0aGlzLnR5cGUpIHtcbiAgICAgIHZhciBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDQwMTUsICdDYW5ub3QgYXBwbHkgb3AgdG8gdW5jcmVhdGVkIGRvY3VtZW50LiAnICsgdGhpcy5jb2xsZWN0aW9uICsgJy4nICsgdGhpcy5pZCk7XG4gICAgICByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgfVxuXG4gICAgLy8gSXRlcmF0aXZlbHkgYXBwbHkgbXVsdGktY29tcG9uZW50IHJlbW90ZSBvcGVyYXRpb25zIGFuZCByb2xsYmFjayBvcHNcbiAgICAvLyAoc291cmNlID09PSBmYWxzZSkgZm9yIHRoZSBkZWZhdWx0IEpTT04wIE9UIHR5cGUuIEl0IGNvdWxkIHVzZVxuICAgIC8vIHR5cGUuc2hhdHRlcigpLCBidXQgc2luY2UgdGhpcyBjb2RlIGlzIHNvIHNwZWNpZmljIHRvIHVzZSBjYXNlcyBmb3IgdGhlXG4gICAgLy8gSlNPTjAgdHlwZSBhbmQgU2hhcmVEQiBleHBsaWNpdGx5IGJ1bmRsZXMgdGhlIGRlZmF1bHQgdHlwZSwgd2UgbWlnaHQgYXNcbiAgICAvLyB3ZWxsIHdyaXRlIGl0IHRoaXMgd2F5IGFuZCBzYXZlIG5lZWRpbmcgdG8gaXRlcmF0ZSB0aHJvdWdoIHRoZSBvcFxuICAgIC8vIGNvbXBvbmVudHMgdHdpY2UuXG4gICAgLy9cbiAgICAvLyBJZGVhbGx5LCB3ZSB3b3VsZCBub3QgbmVlZCB0aGlzIGV4dHJhIGNvbXBsZXhpdHkuIEhvd2V2ZXIsIGl0IGlzXG4gICAgLy8gaGVscGZ1bCBmb3IgaW1wbGVtZW50aW5nIGJpbmRpbmdzIHRoYXQgdXBkYXRlIERPTSBub2RlcyBhbmQgb3RoZXJcbiAgICAvLyBzdGF0ZWZ1bCBvYmplY3RzIGJ5IHRyYW5zbGF0aW5nIG9wIGV2ZW50cyBkaXJlY3RseSBpbnRvIGNvcnJlc3BvbmRpbmdcbiAgICAvLyBtdXRhdGlvbnMuIFN1Y2ggYmluZGluZ3MgYXJlIG1vc3QgZWFzaWx5IHdyaXR0ZW4gYXMgcmVzcG9uZGluZyB0b1xuICAgIC8vIGluZGl2aWR1YWwgb3AgY29tcG9uZW50cyBvbmUgYXQgYSB0aW1lIGluIG9yZGVyLCBhbmQgaXQgaXMgaW1wb3J0YW50XG4gICAgLy8gdGhhdCB0aGUgc25hcHNob3Qgb25seSBpbmNsdWRlIHVwZGF0ZXMgZnJvbSB0aGUgcGFydGljdWxhciBvcCBjb21wb25lbnRcbiAgICAvLyBhdCB0aGUgdGltZSBvZiBlbWlzc2lvbi4gRWxpbWluYXRpbmcgdGhpcyB3b3VsZCByZXF1aXJlIHJldGhpbmtpbmcgaG93XG4gICAgLy8gc3VjaCBleHRlcm5hbCBiaW5kaW5ncyBhcmUgaW1wbGVtZW50ZWQuXG4gICAgaWYgKCFzb3VyY2UgJiYgdGhpcy50eXBlID09PSB0eXBlcy5kZWZhdWx0VHlwZSAmJiBvcC5vcC5sZW5ndGggPiAxKSB7XG4gICAgICBpZiAoIXRoaXMuYXBwbHlTdGFjaykgdGhpcy5hcHBseVN0YWNrID0gW107XG4gICAgICB2YXIgc3RhY2tMZW5ndGggPSB0aGlzLmFwcGx5U3RhY2subGVuZ3RoO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5vcC5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY29tcG9uZW50ID0gb3Aub3BbaV07XG4gICAgICAgIHZhciBjb21wb25lbnRPcCA9IHtvcDogW2NvbXBvbmVudF19O1xuICAgICAgICAvLyBUcmFuc2Zvcm0gY29tcG9uZW50T3AgYWdhaW5zdCBhbnkgb3BzIHRoYXQgaGF2ZSBiZWVuIHN1Ym1pdHRlZFxuICAgICAgICAvLyBzeWNocm9ub3VzbHkgaW5zaWRlIG9mIGFuIG9wIGV2ZW50IGhhbmRsZXIgc2luY2Ugd2UgYmVnYW4gYXBwbHkgb2ZcbiAgICAgICAgLy8gb3VyIG9wZXJhdGlvblxuICAgICAgICBmb3IgKHZhciBqID0gc3RhY2tMZW5ndGg7IGogPCB0aGlzLmFwcGx5U3RhY2subGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICB2YXIgdHJhbnNmb3JtRXJyID0gdHJhbnNmb3JtWCh0aGlzLmFwcGx5U3RhY2tbal0sIGNvbXBvbmVudE9wKTtcbiAgICAgICAgICBpZiAodHJhbnNmb3JtRXJyKSByZXR1cm4gdGhpcy5faGFyZFJvbGxiYWNrKHRyYW5zZm9ybUVycik7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQXBwbHkgdGhlIGluZGl2aWR1YWwgb3AgY29tcG9uZW50XG4gICAgICAgIHRoaXMuZW1pdCgnYmVmb3JlIG9wJywgY29tcG9uZW50T3Aub3AsIHNvdXJjZSk7XG4gICAgICAgIHRoaXMuZGF0YSA9IHRoaXMudHlwZS5hcHBseSh0aGlzLmRhdGEsIGNvbXBvbmVudE9wLm9wKTtcbiAgICAgICAgdGhpcy5lbWl0KCdvcCcsIGNvbXBvbmVudE9wLm9wLCBzb3VyY2UpO1xuICAgICAgfVxuICAgICAgLy8gUG9wIHdoYXRldmVyIHdhcyBzdWJtaXR0ZWQgc2luY2Ugd2Ugc3RhcnRlZCBhcHBseWluZyB0aGlzIG9wXG4gICAgICB0aGlzLl9wb3BBcHBseVN0YWNrKHN0YWNrTGVuZ3RoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBUaGUgJ2JlZm9yZSBvcCcgZXZlbnQgZW5hYmxlcyBjbGllbnRzIHRvIHB1bGwgYW55IG5lY2Vzc2FyeSBkYXRhIG91dCBvZlxuICAgIC8vIHRoZSBzbmFwc2hvdCBiZWZvcmUgaXQgZ2V0cyBjaGFuZ2VkXG4gICAgdGhpcy5lbWl0KCdiZWZvcmUgb3AnLCBvcC5vcCwgc291cmNlKTtcbiAgICAvLyBBcHBseSB0aGUgb3BlcmF0aW9uIHRvIHRoZSBsb2NhbCBkYXRhLCBtdXRhdGluZyBpdCBpbiBwbGFjZVxuICAgIHRoaXMuZGF0YSA9IHRoaXMudHlwZS5hcHBseSh0aGlzLmRhdGEsIG9wLm9wKTtcbiAgICAvLyBFbWl0IGFuICdvcCcgZXZlbnQgb25jZSB0aGUgbG9jYWwgZGF0YSBpbmNsdWRlcyB0aGUgY2hhbmdlcyBmcm9tIHRoZVxuICAgIC8vIG9wLiBGb3IgbG9jYWxseSBzdWJtaXR0ZWQgb3BzLCB0aGlzIHdpbGwgYmUgc3luY2hyb25vdXNseSB3aXRoXG4gICAgLy8gc3VibWlzc2lvbiBhbmQgYmVmb3JlIHRoZSBzZXJ2ZXIgb3Igb3RoZXIgY2xpZW50cyBoYXZlIHJlY2VpdmVkIHRoZSBvcC5cbiAgICAvLyBGb3Igb3BzIGZyb20gb3RoZXIgY2xpZW50cywgdGhpcyB3aWxsIGJlIGFmdGVyIHRoZSBvcCBoYXMgYmVlblxuICAgIC8vIGNvbW1pdHRlZCB0byB0aGUgZGF0YWJhc2UgYW5kIHB1Ymxpc2hlZFxuICAgIHRoaXMuZW1pdCgnb3AnLCBvcC5vcCwgc291cmNlKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAob3AuY3JlYXRlKSB7XG4gICAgdGhpcy5fc2V0VHlwZShvcC5jcmVhdGUudHlwZSk7XG4gICAgdGhpcy5kYXRhID0gKHRoaXMudHlwZS5kZXNlcmlhbGl6ZSkgP1xuICAgICAgKHRoaXMudHlwZS5jcmVhdGVEZXNlcmlhbGl6ZWQpID9cbiAgICAgICAgdGhpcy50eXBlLmNyZWF0ZURlc2VyaWFsaXplZChvcC5jcmVhdGUuZGF0YSkgOlxuICAgICAgICB0aGlzLnR5cGUuZGVzZXJpYWxpemUodGhpcy50eXBlLmNyZWF0ZShvcC5jcmVhdGUuZGF0YSkpIDpcbiAgICAgIHRoaXMudHlwZS5jcmVhdGUob3AuY3JlYXRlLmRhdGEpO1xuICAgIHRoaXMuZW1pdCgnY3JlYXRlJywgc291cmNlKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAob3AuZGVsKSB7XG4gICAgdmFyIG9sZERhdGEgPSB0aGlzLmRhdGE7XG4gICAgdGhpcy5fc2V0VHlwZShudWxsKTtcbiAgICB0aGlzLmVtaXQoJ2RlbCcsIG9sZERhdGEsIHNvdXJjZSk7XG4gICAgcmV0dXJuO1xuICB9XG59O1xuXG5cbi8vICoqKioqIFNlbmRpbmcgb3BlcmF0aW9uc1xuXG4vLyBBY3R1YWxseSBzZW5kIG9wIHRvIHRoZSBzZXJ2ZXIuXG5Eb2MucHJvdG90eXBlLl9zZW5kT3AgPSBmdW5jdGlvbigpIHtcbiAgLy8gV2FpdCB1bnRpbCB3ZSBoYXZlIGEgc3JjIGlkIGZyb20gdGhlIHNlcnZlclxuICB2YXIgc3JjID0gdGhpcy5jb25uZWN0aW9uLmlkO1xuICBpZiAoIXNyYykgcmV0dXJuO1xuXG4gIC8vIFdoZW4gdGhlcmUgaXMgbm8gaW5mbGlnaHRPcCwgc2VuZCB0aGUgZmlyc3QgaXRlbSBpbiBwZW5kaW5nT3BzLiBJZlxuICAvLyB0aGVyZSBpcyBpbmZsaWdodE9wLCB0cnkgc2VuZGluZyBpdCBhZ2FpblxuICBpZiAoIXRoaXMuaW5mbGlnaHRPcCkge1xuICAgIC8vIFNlbmQgZmlyc3QgcGVuZGluZyBvcFxuICAgIHRoaXMuaW5mbGlnaHRPcCA9IHRoaXMucGVuZGluZ09wcy5zaGlmdCgpO1xuICB9XG4gIHZhciBvcCA9IHRoaXMuaW5mbGlnaHRPcDtcbiAgaWYgKCFvcCkge1xuICAgIHZhciBlcnIgPSBuZXcgU2hhcmVEQkVycm9yKDUwMTAsICdObyBvcCB0byBzZW5kIG9uIGNhbGwgdG8gX3NlbmRPcCcpO1xuICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgfVxuXG4gIC8vIFRyYWNrIGRhdGEgZm9yIHJldHJ5aW5nIG9wc1xuICBvcC5zZW50QXQgPSBEYXRlLm5vdygpO1xuICBvcC5yZXRyaWVzID0gKG9wLnJldHJpZXMgPT0gbnVsbCkgPyAwIDogb3AucmV0cmllcyArIDE7XG5cbiAgLy8gVGhlIHNyYyArIHNlcSBudW1iZXIgaXMgYSB1bmlxdWUgSUQgcmVwcmVzZW50aW5nIHRoaXMgb3BlcmF0aW9uLiBUaGlzIHR1cGxlXG4gIC8vIGlzIHVzZWQgb24gdGhlIHNlcnZlciB0byBkZXRlY3Qgd2hlbiBvcHMgaGF2ZSBiZWVuIHNlbnQgbXVsdGlwbGUgdGltZXMgYW5kXG4gIC8vIG9uIHRoZSBjbGllbnQgdG8gbWF0Y2ggYWNrbm93bGVkZ2VtZW50IG9mIGFuIG9wIGJhY2sgdG8gdGhlIGluZmxpZ2h0T3AuXG4gIC8vIE5vdGUgdGhhdCB0aGUgc3JjIGNvdWxkIGJlIGRpZmZlcmVudCBmcm9tIHRoaXMuY29ubmVjdGlvbi5pZCBhZnRlciBhXG4gIC8vIHJlY29ubmVjdCwgc2luY2UgYW4gb3AgbWF5IHN0aWxsIGJlIHBlbmRpbmcgYWZ0ZXIgdGhlIHJlY29ubmVjdGlvbiBhbmRcbiAgLy8gdGhpcy5jb25uZWN0aW9uLmlkIHdpbGwgY2hhbmdlLiBJbiBjYXNlIGFuIG9wIGlzIHNlbnQgbXVsdGlwbGUgdGltZXMsIHdlXG4gIC8vIGFsc28gbmVlZCB0byBiZSBjYXJlZnVsIG5vdCB0byBvdmVycmlkZSB0aGUgb3JpZ2luYWwgc2VxIHZhbHVlLlxuICBpZiAob3Auc2VxID09IG51bGwpIG9wLnNlcSA9IHRoaXMuY29ubmVjdGlvbi5zZXErKztcblxuICB0aGlzLmNvbm5lY3Rpb24uc2VuZE9wKHRoaXMsIG9wKTtcblxuICAvLyBzcmMgaXNuJ3QgbmVlZGVkIG9uIHRoZSBmaXJzdCB0cnksIHNpbmNlIHRoZSBzZXJ2ZXIgc2Vzc2lvbiB3aWxsIGhhdmUgdGhlXG4gIC8vIHNhbWUgaWQsIGJ1dCBpdCBtdXN0IGJlIHNldCBvbiB0aGUgaW5mbGlnaHRPcCBpbiBjYXNlIGl0IGlzIHNlbnQgYWdhaW5cbiAgLy8gYWZ0ZXIgYSByZWNvbm5lY3QgYW5kIHRoZSBjb25uZWN0aW9uJ3MgaWQgaGFzIGNoYW5nZWQgYnkgdGhlblxuICBpZiAob3Auc3JjID09IG51bGwpIG9wLnNyYyA9IHNyYztcbn07XG5cblxuLy8gUXVldWVzIHRoZSBvcGVyYXRpb24gZm9yIHN1Ym1pc3Npb24gdG8gdGhlIHNlcnZlciBhbmQgYXBwbGllcyBpdCBsb2NhbGx5LlxuLy9cbi8vIEludGVybmFsIG1ldGhvZCBjYWxsZWQgdG8gZG8gdGhlIGFjdHVhbCB3b3JrIGZvciBzdWJtaXQoKSwgY3JlYXRlKCkgYW5kIGRlbCgpLlxuLy8gQHByaXZhdGVcbi8vXG4vLyBAcGFyYW0gb3Bcbi8vIEBwYXJhbSBbb3Aub3BdXG4vLyBAcGFyYW0gW29wLmRlbF1cbi8vIEBwYXJhbSBbb3AuY3JlYXRlXVxuLy8gQHBhcmFtIFtjYWxsYmFja10gY2FsbGVkIHdoZW4gb3BlcmF0aW9uIGlzIHN1Ym1pdHRlZFxuRG9jLnByb3RvdHlwZS5fc3VibWl0ID0gZnVuY3Rpb24ob3AsIHNvdXJjZSwgY2FsbGJhY2spIHtcbiAgLy8gTG9jYWxseSBzdWJtaXR0ZWQgb3BzIG11c3QgYWx3YXlzIGhhdmUgYSB0cnV0aHkgc291cmNlXG4gIGlmICghc291cmNlKSBzb3VyY2UgPSB0cnVlO1xuXG4gIC8vIFRoZSBvcCBjb250YWlucyBlaXRoZXIgb3AsIGNyZWF0ZSwgZGVsZXRlLCBvciBub25lIG9mIHRoZSBhYm92ZSAoYSBuby1vcCkuXG4gIGlmIChvcC5vcCkge1xuICAgIGlmICghdGhpcy50eXBlKSB7XG4gICAgICB2YXIgZXJyID0gbmV3IFNoYXJlREJFcnJvcig0MDE1LCAnQ2Fubm90IHN1Ym1pdCBvcC4gRG9jdW1lbnQgaGFzIG5vdCBiZWVuIGNyZWF0ZWQuICcgKyB0aGlzLmNvbGxlY3Rpb24gKyAnLicgKyB0aGlzLmlkKTtcbiAgICAgIGlmIChjYWxsYmFjaykgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgfVxuICAgIC8vIFRyeSB0byBub3JtYWxpemUgdGhlIG9wLiBUaGlzIHJlbW92ZXMgdHJhaWxpbmcgc2tpcDowJ3MgYW5kIHRoaW5ncyBsaWtlIHRoYXQuXG4gICAgaWYgKHRoaXMudHlwZS5ub3JtYWxpemUpIG9wLm9wID0gdGhpcy50eXBlLm5vcm1hbGl6ZShvcC5vcCk7XG4gIH1cblxuICB0aGlzLl9wdXNoT3Aob3AsIGNhbGxiYWNrKTtcbiAgdGhpcy5fb3RBcHBseShvcCwgc291cmNlKTtcblxuICAvLyBUaGUgY2FsbCB0byBmbHVzaCBpcyBkZWxheWVkIHNvIGlmIHN1Ym1pdCgpIGlzIGNhbGxlZCBtdWx0aXBsZSB0aW1lc1xuICAvLyBzeW5jaHJvbm91c2x5LCBhbGwgdGhlIG9wcyBhcmUgY29tYmluZWQgYmVmb3JlIGJlaW5nIHNlbnQgdG8gdGhlIHNlcnZlci5cbiAgdmFyIGRvYyA9IHRoaXM7XG4gIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgZG9jLmZsdXNoKCk7XG4gIH0pO1xufTtcblxuRG9jLnByb3RvdHlwZS5fcHVzaE9wID0gZnVuY3Rpb24ob3AsIGNhbGxiYWNrKSB7XG4gIGlmICh0aGlzLmFwcGx5U3RhY2spIHtcbiAgICAvLyBJZiB3ZSBhcmUgaW4gdGhlIHByb2Nlc3Mgb2YgaW5jcmVtZW50YWxseSBhcHBseWluZyBhbiBvcGVyYXRpb24sIGRvbid0XG4gICAgLy8gY29tcG9zZSB0aGUgb3AgYW5kIHB1c2ggaXQgb250byB0aGUgYXBwbHlTdGFjayBzbyBpdCBjYW4gYmUgdHJhbnNmb3JtZWRcbiAgICAvLyBhZ2FpbnN0IG90aGVyIGNvbXBvbmVudHMgZnJvbSB0aGUgb3Agb3Igb3BzIGJlaW5nIGFwcGxpZWRcbiAgICB0aGlzLmFwcGx5U3RhY2sucHVzaChvcCk7XG4gIH0gZWxzZSB7XG4gICAgLy8gSWYgdGhlIHR5cGUgc3VwcG9ydHMgY29tcG9zZXMsIHRyeSB0byBjb21wb3NlIHRoZSBvcGVyYXRpb24gb250byB0aGVcbiAgICAvLyBlbmQgb2YgdGhlIGxhc3QgcGVuZGluZyBvcGVyYXRpb24uXG4gICAgdmFyIGNvbXBvc2VkID0gdGhpcy5fdHJ5Q29tcG9zZShvcCk7XG4gICAgaWYgKGNvbXBvc2VkKSB7XG4gICAgICBjb21wb3NlZC5jYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG4gIC8vIFB1c2ggb24gdG8gdGhlIHBlbmRpbmdPcHMgcXVldWUgb2Ygb3BzIHRvIHN1Ym1pdCBpZiB3ZSBkaWRuJ3QgY29tcG9zZVxuICBvcC50eXBlID0gdGhpcy50eXBlO1xuICBvcC5jYWxsYmFja3MgPSBbY2FsbGJhY2tdO1xuICB0aGlzLnBlbmRpbmdPcHMucHVzaChvcCk7XG59O1xuXG5Eb2MucHJvdG90eXBlLl9wb3BBcHBseVN0YWNrID0gZnVuY3Rpb24odG8pIHtcbiAgaWYgKHRvID4gMCkge1xuICAgIHRoaXMuYXBwbHlTdGFjay5sZW5ndGggPSB0bztcbiAgICByZXR1cm47XG4gIH1cbiAgLy8gT25jZSB3ZSBoYXZlIGNvbXBsZXRlZCB0aGUgb3V0ZXJtb3N0IGFwcGx5IGxvb3AsIHJlc2V0IHRvIG51bGwgYW5kIG5vXG4gIC8vIGxvbmdlciBhZGQgb3BzIHRvIHRoZSBhcHBseVN0YWNrIGFzIHRoZXkgYXJlIHN1Ym1pdHRlZFxuICB2YXIgb3AgPSB0aGlzLmFwcGx5U3RhY2tbMF07XG4gIHRoaXMuYXBwbHlTdGFjayA9IG51bGw7XG4gIGlmICghb3ApIHJldHVybjtcbiAgLy8gQ29tcG9zZSB0aGUgb3BzIGFkZGVkIHNpbmNlIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGFwcGx5IHN0YWNrLCBzaW5jZSB3ZVxuICAvLyBoYWQgdG8gc2tpcCBjb21wb3NlIHdoZW4gdGhleSB3ZXJlIG9yaWdpbmFsbHkgcHVzaGVkXG4gIHZhciBpID0gdGhpcy5wZW5kaW5nT3BzLmluZGV4T2Yob3ApO1xuICBpZiAoaSA9PT0gLTEpIHJldHVybjtcbiAgdmFyIG9wcyA9IHRoaXMucGVuZGluZ09wcy5zcGxpY2UoaSk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIG9wID0gb3BzW2ldO1xuICAgIHZhciBjb21wb3NlZCA9IHRoaXMuX3RyeUNvbXBvc2Uob3ApO1xuICAgIGlmIChjb21wb3NlZCkge1xuICAgICAgY29tcG9zZWQuY2FsbGJhY2tzID0gY29tcG9zZWQuY2FsbGJhY2tzLmNvbmNhdChvcC5jYWxsYmFja3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnBlbmRpbmdPcHMucHVzaChvcCk7XG4gICAgfVxuICB9XG59O1xuXG4vLyBUcnkgdG8gY29tcG9zZSBhIHN1Ym1pdHRlZCBvcCBpbnRvIHRoZSBsYXN0IHBlbmRpbmcgb3AuIFJldHVybnMgdGhlXG4vLyBjb21wb3NlZCBvcCBpZiBpdCBzdWNjZWVkcywgdW5kZWZpbmVkIG90aGVyd2lzZVxuRG9jLnByb3RvdHlwZS5fdHJ5Q29tcG9zZSA9IGZ1bmN0aW9uKG9wKSB7XG4gIGlmICh0aGlzLnByZXZlbnRDb21wb3NlKSByZXR1cm47XG5cbiAgLy8gV2UgY2FuIG9ubHkgY29tcG9zZSBpbnRvIHRoZSBsYXN0IHBlbmRpbmcgb3AuIEluZmxpZ2h0IG9wcyBoYXZlIGFscmVhZHlcbiAgLy8gYmVlbiBzZW50IHRvIHRoZSBzZXJ2ZXIsIHNvIHdlIGNhbid0IG1vZGlmeSB0aGVtXG4gIHZhciBsYXN0ID0gdGhpcy5wZW5kaW5nT3BzW3RoaXMucGVuZGluZ09wcy5sZW5ndGggLSAxXTtcbiAgaWYgKCFsYXN0KSByZXR1cm47XG5cbiAgLy8gQ29tcG9zZSBhbiBvcCBpbnRvIGEgY3JlYXRlIGJ5IGFwcGx5aW5nIGl0LiBUaGlzIGVmZmVjdGl2ZWx5IG1ha2VzIHRoZSBvcFxuICAvLyBpbnZpc2libGUsIGFzIGlmIHRoZSBkb2N1bWVudCB3ZXJlIGNyZWF0ZWQgaW5jbHVkaW5nIHRoZSBvcCBvcmlnaW5hbGx5XG4gIGlmIChsYXN0LmNyZWF0ZSAmJiBvcC5vcCkge1xuICAgIGxhc3QuY3JlYXRlLmRhdGEgPSB0aGlzLnR5cGUuYXBwbHkobGFzdC5jcmVhdGUuZGF0YSwgb3Aub3ApO1xuICAgIHJldHVybiBsYXN0O1xuICB9XG5cbiAgLy8gQ29tcG9zZSB0d28gb3BzIGludG8gYSBzaW5nbGUgb3AgaWYgc3VwcG9ydGVkIGJ5IHRoZSB0eXBlLiBUeXBlcyB0aGF0XG4gIC8vIHN1cHBvcnQgY29tcG9zZSBtdXN0IGJlIGFibGUgdG8gY29tcG9zZSBhbnkgdHdvIG9wcyB0b2dldGhlclxuICBpZiAobGFzdC5vcCAmJiBvcC5vcCAmJiB0aGlzLnR5cGUuY29tcG9zZSkge1xuICAgIGxhc3Qub3AgPSB0aGlzLnR5cGUuY29tcG9zZShsYXN0Lm9wLCBvcC5vcCk7XG4gICAgcmV0dXJuIGxhc3Q7XG4gIH1cbn07XG5cbi8vICoqKiBDbGllbnQgT1QgZW50cnlwb2ludHMuXG5cbi8vIFN1Ym1pdCBhbiBvcGVyYXRpb24gdG8gdGhlIGRvY3VtZW50LlxuLy9cbi8vIEBwYXJhbSBvcGVyYXRpb24gaGFuZGxlZCBieSB0aGUgT1QgdHlwZVxuLy8gQHBhcmFtIG9wdGlvbnMgIHtzb3VyY2U6IC4uLn1cbi8vIEBwYXJhbSBbY2FsbGJhY2tdIGNhbGxlZCBhZnRlciBvcGVyYXRpb24gc3VibWl0dGVkXG4vL1xuLy8gQGZpcmVzIGJlZm9yZSBvcCwgb3AsIGFmdGVyIG9wXG5Eb2MucHJvdG90eXBlLnN1Ym1pdE9wID0gZnVuY3Rpb24oY29tcG9uZW50LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgb3B0aW9ucyA9IG51bGw7XG4gIH1cbiAgdmFyIG9wID0ge29wOiBjb21wb25lbnR9O1xuICB2YXIgc291cmNlID0gb3B0aW9ucyAmJiBvcHRpb25zLnNvdXJjZTtcbiAgdGhpcy5fc3VibWl0KG9wLCBzb3VyY2UsIGNhbGxiYWNrKTtcbn07XG5cbi8vIENyZWF0ZSB0aGUgZG9jdW1lbnQsIHdoaWNoIGluIFNoYXJlSlMgc2VtYW50aWNzIG1lYW5zIHRvIHNldCBpdHMgdHlwZS4gRXZlcnlcbi8vIG9iamVjdCBpbXBsaWNpdGx5IGV4aXN0cyBpbiB0aGUgZGF0YWJhc2UgYnV0IGhhcyBubyBkYXRhIGFuZCBubyB0eXBlLiBDcmVhdGVcbi8vIHNldHMgdGhlIHR5cGUgb2YgdGhlIG9iamVjdCBhbmQgY2FuIG9wdGlvbmFsbHkgc2V0IHNvbWUgaW5pdGlhbCBkYXRhIG9uIHRoZVxuLy8gb2JqZWN0LCBkZXBlbmRpbmcgb24gdGhlIHR5cGUuXG4vL1xuLy8gQHBhcmFtIGRhdGEgIGluaXRpYWxcbi8vIEBwYXJhbSB0eXBlICBPVCB0eXBlXG4vLyBAcGFyYW0gb3B0aW9ucyAge3NvdXJjZTogLi4ufVxuLy8gQHBhcmFtIGNhbGxiYWNrICBjYWxsZWQgd2hlbiBvcGVyYXRpb24gc3VibWl0dGVkXG5Eb2MucHJvdG90eXBlLmNyZWF0ZSA9IGZ1bmN0aW9uKGRhdGEsIHR5cGUsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2YgdHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNhbGxiYWNrID0gdHlwZTtcbiAgICBvcHRpb25zID0gbnVsbDtcbiAgICB0eXBlID0gbnVsbDtcbiAgfSBlbHNlIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICBvcHRpb25zID0gbnVsbDtcbiAgfVxuICBpZiAoIXR5cGUpIHtcbiAgICB0eXBlID0gdHlwZXMuZGVmYXVsdFR5cGUudXJpO1xuICB9XG4gIGlmICh0aGlzLnR5cGUpIHtcbiAgICB2YXIgZXJyID0gbmV3IFNoYXJlREJFcnJvcig0MDE2LCAnRG9jdW1lbnQgYWxyZWFkeSBleGlzdHMnKTtcbiAgICBpZiAoY2FsbGJhY2spIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgfVxuICB2YXIgb3AgPSB7Y3JlYXRlOiB7dHlwZTogdHlwZSwgZGF0YTogZGF0YX19O1xuICB2YXIgc291cmNlID0gb3B0aW9ucyAmJiBvcHRpb25zLnNvdXJjZTtcbiAgdGhpcy5fc3VibWl0KG9wLCBzb3VyY2UsIGNhbGxiYWNrKTtcbn07XG5cbi8vIERlbGV0ZSB0aGUgZG9jdW1lbnQuIFRoaXMgY3JlYXRlcyBhbmQgc3VibWl0cyBhIGRlbGV0ZSBvcGVyYXRpb24gdG8gdGhlXG4vLyBzZXJ2ZXIuIERlbGV0aW5nIHJlc2V0cyB0aGUgb2JqZWN0J3MgdHlwZSB0byBudWxsIGFuZCBkZWxldGVzIGl0cyBkYXRhLiBUaGVcbi8vIGRvY3VtZW50IHN0aWxsIGV4aXN0cywgYW5kIHN0aWxsIGhhcyB0aGUgdmVyc2lvbiBpdCB1c2VkIHRvIGhhdmUgYmVmb3JlIHlvdVxuLy8gZGVsZXRlZCBpdCAod2VsbCwgb2xkIHZlcnNpb24gKzEpLlxuLy9cbi8vIEBwYXJhbSBvcHRpb25zICB7c291cmNlOiAuLi59XG4vLyBAcGFyYW0gY2FsbGJhY2sgIGNhbGxlZCB3aGVuIG9wZXJhdGlvbiBzdWJtaXR0ZWRcbkRvYy5wcm90b3R5cGUuZGVsID0gZnVuY3Rpb24ob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgIG9wdGlvbnMgPSBudWxsO1xuICB9XG4gIGlmICghdGhpcy50eXBlKSB7XG4gICAgdmFyIGVyciA9IG5ldyBTaGFyZURCRXJyb3IoNDAxNSwgJ0RvY3VtZW50IGRvZXMgbm90IGV4aXN0Jyk7XG4gICAgaWYgKGNhbGxiYWNrKSByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gIH1cbiAgdmFyIG9wID0ge2RlbDogdHJ1ZX07XG4gIHZhciBzb3VyY2UgPSBvcHRpb25zICYmIG9wdGlvbnMuc291cmNlO1xuICB0aGlzLl9zdWJtaXQob3AsIHNvdXJjZSwgY2FsbGJhY2spO1xufTtcblxuXG4vLyBTdG9wcyB0aGUgZG9jdW1lbnQgZnJvbSBzZW5kaW5nIGFueSBvcGVyYXRpb25zIHRvIHRoZSBzZXJ2ZXIuXG5Eb2MucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMucGF1c2VkID0gdHJ1ZTtcbn07XG5cbi8vIENvbnRpbnVlIHNlbmRpbmcgb3BlcmF0aW9ucyB0byB0aGUgc2VydmVyXG5Eb2MucHJvdG90eXBlLnJlc3VtZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLnBhdXNlZCA9IGZhbHNlO1xuICB0aGlzLmZsdXNoKCk7XG59O1xuXG5cbi8vICoqKiBSZWNlaXZpbmcgb3BlcmF0aW9uc1xuXG4vLyBUaGlzIGlzIGNhbGxlZCB3aGVuIHRoZSBzZXJ2ZXIgYWNrbm93bGVkZ2VzIGFuIG9wZXJhdGlvbiBmcm9tIHRoZSBjbGllbnQuXG5Eb2MucHJvdG90eXBlLl9vcEFja25vd2xlZGdlZCA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgaWYgKHRoaXMuaW5mbGlnaHRPcC5jcmVhdGUpIHtcbiAgICB0aGlzLnZlcnNpb24gPSBtZXNzYWdlLnY7XG5cbiAgfSBlbHNlIGlmIChtZXNzYWdlLnYgIT09IHRoaXMudmVyc2lvbikge1xuICAgIC8vIFdlIHNob3VsZCBhbHJlYWR5IGJlIGF0IHRoZSBzYW1lIHZlcnNpb24sIGJlY2F1c2UgdGhlIHNlcnZlciBzaG91bGRcbiAgICAvLyBoYXZlIHNlbnQgYWxsIHRoZSBvcHMgdGhhdCBoYXZlIGhhcHBlbmVkIGJlZm9yZSBhY2tub3dsZWRnaW5nIG91ciBvcFxuICAgIGNvbnNvbGUud2FybignSW52YWxpZCB2ZXJzaW9uIGZyb20gc2VydmVyLiBFeHBlY3RlZDogJyArIHRoaXMudmVyc2lvbiArICcgUmVjZWl2ZWQ6ICcgKyBtZXNzYWdlLnYsIG1lc3NhZ2UpO1xuXG4gICAgLy8gRmV0Y2hpbmcgc2hvdWxkIGdldCB1cyBiYWNrIHRvIGEgd29ya2luZyBkb2N1bWVudCBzdGF0ZVxuICAgIHJldHVybiB0aGlzLmZldGNoKCk7XG4gIH1cblxuICAvLyBUaGUgb3Agd2FzIGNvbW1pdHRlZCBzdWNjZXNzZnVsbHkuIEluY3JlbWVudCB0aGUgdmVyc2lvbiBudW1iZXJcbiAgdGhpcy52ZXJzaW9uKys7XG5cbiAgdGhpcy5fY2xlYXJJbmZsaWdodE9wKCk7XG59O1xuXG5Eb2MucHJvdG90eXBlLl9yb2xsYmFjayA9IGZ1bmN0aW9uKGVycikge1xuICAvLyBUaGUgc2VydmVyIGhhcyByZWplY3RlZCBzdWJtaXNzaW9uIG9mIHRoZSBjdXJyZW50IG9wZXJhdGlvbi4gSW52ZXJ0IGJ5XG4gIC8vIGp1c3QgdGhlIGluZmxpZ2h0IG9wIGlmIHBvc3NpYmxlLiBJZiBub3QgcG9zc2libGUgdG8gaW52ZXJ0LCBjYW5jZWwgYWxsXG4gIC8vIHBlbmRpbmcgb3BzIGFuZCBmZXRjaCB0aGUgbGF0ZXN0IGZyb20gdGhlIHNlcnZlciB0byBnZXQgdXMgYmFjayBpbnRvIGFcbiAgLy8gd29ya2luZyBzdGF0ZSwgdGhlbiBjYWxsIGJhY2tcbiAgdmFyIG9wID0gdGhpcy5pbmZsaWdodE9wO1xuXG4gIGlmIChvcC5vcCAmJiBvcC50eXBlLmludmVydCkge1xuICAgIG9wLm9wID0gb3AudHlwZS5pbnZlcnQob3Aub3ApO1xuXG4gICAgLy8gVHJhbnNmb3JtIHRoZSB1bmRvIG9wZXJhdGlvbiBieSBhbnkgcGVuZGluZyBvcHMuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnBlbmRpbmdPcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciB0cmFuc2Zvcm1FcnIgPSB0cmFuc2Zvcm1YKHRoaXMucGVuZGluZ09wc1tpXSwgb3ApO1xuICAgICAgaWYgKHRyYW5zZm9ybUVycikgcmV0dXJuIHRoaXMuX2hhcmRSb2xsYmFjayh0cmFuc2Zvcm1FcnIpO1xuICAgIH1cblxuICAgIC8vIC4uLiBhbmQgYXBwbHkgaXQgbG9jYWxseSwgcmV2ZXJ0aW5nIHRoZSBjaGFuZ2VzLlxuICAgIC8vXG4gICAgLy8gVGhpcyBvcGVyYXRpb24gaXMgYXBwbGllZCB0byBsb29rIGxpa2UgaXQgY29tZXMgZnJvbSBhIHJlbW90ZSBzb3VyY2UuXG4gICAgLy8gSSdtIHN0aWxsIG5vdCAxMDAlIHN1cmUgYWJvdXQgdGhpcyBmdW5jdGlvbmFsaXR5LCBiZWNhdXNlIGl0cyByZWFsbHkgYVxuICAgIC8vIGxvY2FsIG9wLiBCYXNpY2FsbHksIHRoZSBwcm9ibGVtIGlzIHRoYXQgaWYgdGhlIGNsaWVudCdzIG9wIGlzIHJlamVjdGVkXG4gICAgLy8gYnkgdGhlIHNlcnZlciwgdGhlIGVkaXRvciB3aW5kb3cgc2hvdWxkIHVwZGF0ZSB0byByZWZsZWN0IHRoZSB1bmRvLlxuICAgIHRoaXMuX290QXBwbHkob3AsIGZhbHNlKTtcblxuICAgIHRoaXMuX2NsZWFySW5mbGlnaHRPcChlcnIpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHRoaXMuX2hhcmRSb2xsYmFjayhlcnIpO1xufTtcblxuRG9jLnByb3RvdHlwZS5faGFyZFJvbGxiYWNrID0gZnVuY3Rpb24oZXJyKSB7XG4gIC8vIENhbmNlbCBhbGwgcGVuZGluZyBvcHMgYW5kIHJlc2V0IGlmIHdlIGNhbid0IGludmVydFxuICB2YXIgb3AgPSB0aGlzLmluZmxpZ2h0T3A7XG4gIHZhciBwZW5kaW5nID0gdGhpcy5wZW5kaW5nT3BzO1xuICB0aGlzLl9zZXRUeXBlKG51bGwpO1xuICB0aGlzLnZlcnNpb24gPSBudWxsO1xuICB0aGlzLmluZmxpZ2h0T3AgPSBudWxsO1xuICB0aGlzLnBlbmRpbmdPcHMgPSBbXTtcblxuICAvLyBGZXRjaCB0aGUgbGF0ZXN0IGZyb20gdGhlIHNlcnZlciB0byBnZXQgdXMgYmFjayBpbnRvIGEgd29ya2luZyBzdGF0ZVxuICB2YXIgZG9jID0gdGhpcztcbiAgdGhpcy5mZXRjaChmdW5jdGlvbigpIHtcbiAgICB2YXIgY2FsbGVkID0gb3AgJiYgY2FsbEVhY2gob3AuY2FsbGJhY2tzLCBlcnIpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGVuZGluZy5sZW5ndGg7IGkrKykge1xuICAgICAgY2FsbEVhY2gocGVuZGluZ1tpXS5jYWxsYmFja3MsIGVycik7XG4gICAgfVxuICAgIGlmIChlcnIgJiYgIWNhbGxlZCkgcmV0dXJuIGRvYy5lbWl0KCdlcnJvcicsIGVycik7XG4gIH0pO1xufTtcblxuRG9jLnByb3RvdHlwZS5fY2xlYXJJbmZsaWdodE9wID0gZnVuY3Rpb24oZXJyKSB7XG4gIHZhciBjYWxsZWQgPSBjYWxsRWFjaCh0aGlzLmluZmxpZ2h0T3AuY2FsbGJhY2tzLCBlcnIpO1xuXG4gIHRoaXMuaW5mbGlnaHRPcCA9IG51bGw7XG4gIHRoaXMuZmx1c2goKTtcbiAgdGhpcy5fZW1pdE5vdGhpbmdQZW5kaW5nKCk7XG5cbiAgaWYgKGVyciAmJiAhY2FsbGVkKSByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG59O1xuXG5mdW5jdGlvbiBjYWxsRWFjaChjYWxsYmFja3MsIGVycikge1xuICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgY2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGNhbGxiYWNrID0gY2FsbGJhY2tzW2ldO1xuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBjYWxsZWQ7XG59XG4iLCJleHBvcnRzLkNvbm5lY3Rpb24gPSByZXF1aXJlKCcuL2Nvbm5lY3Rpb24nKTtcbmV4cG9ydHMuRG9jID0gcmVxdWlyZSgnLi9kb2MnKTtcbmV4cG9ydHMuRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvcicpO1xuZXhwb3J0cy5RdWVyeSA9IHJlcXVpcmUoJy4vcXVlcnknKTtcbmV4cG9ydHMudHlwZXMgPSByZXF1aXJlKCcuLi90eXBlcycpO1xuIiwidmFyIGVtaXR0ZXIgPSByZXF1aXJlKCcuLi9lbWl0dGVyJyk7XG5cbi8vIFF1ZXJpZXMgYXJlIGxpdmUgcmVxdWVzdHMgdG8gdGhlIGRhdGFiYXNlIGZvciBwYXJ0aWN1bGFyIHNldHMgb2YgZmllbGRzLlxuLy9cbi8vIFRoZSBzZXJ2ZXIgYWN0aXZlbHkgdGVsbHMgdGhlIGNsaWVudCB3aGVuIHRoZXJlJ3MgbmV3IGRhdGEgdGhhdCBtYXRjaGVzXG4vLyBhIHNldCBvZiBjb25kaXRpb25zLlxubW9kdWxlLmV4cG9ydHMgPSBRdWVyeTtcbmZ1bmN0aW9uIFF1ZXJ5KGFjdGlvbiwgY29ubmVjdGlvbiwgaWQsIGNvbGxlY3Rpb24sIHF1ZXJ5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICBlbWl0dGVyLkV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuXG4gIC8vICdxZicgb3IgJ3FzJ1xuICB0aGlzLmFjdGlvbiA9IGFjdGlvbjtcblxuICB0aGlzLmNvbm5lY3Rpb24gPSBjb25uZWN0aW9uO1xuICB0aGlzLmlkID0gaWQ7XG4gIHRoaXMuY29sbGVjdGlvbiA9IGNvbGxlY3Rpb247XG5cbiAgLy8gVGhlIHF1ZXJ5IGl0c2VsZi4gRm9yIG1vbmdvLCB0aGlzIHNob3VsZCBsb29rIHNvbWV0aGluZyBsaWtlIHtcImRhdGEueFwiOjV9XG4gIHRoaXMucXVlcnkgPSBxdWVyeTtcblxuICAvLyBBIGxpc3Qgb2YgcmVzdWx0aW5nIGRvY3VtZW50cy4gVGhlc2UgYXJlIGFjdHVhbCBkb2N1bWVudHMsIGNvbXBsZXRlIHdpdGhcbiAgLy8gZGF0YSBhbmQgYWxsIHRoZSByZXN0LiBJdCBpcyBwb3NzaWJsZSB0byBwYXNzIGluIGFuIGluaXRpYWwgcmVzdWx0cyBzZXQsXG4gIC8vIHNvIHRoYXQgYSBxdWVyeSBjYW4gYmUgc2VyaWFsaXplZCBhbmQgdGhlbiByZS1lc3RhYmxpc2hlZFxuICB0aGlzLnJlc3VsdHMgPSBudWxsO1xuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnJlc3VsdHMpIHtcbiAgICB0aGlzLnJlc3VsdHMgPSBvcHRpb25zLnJlc3VsdHM7XG4gICAgZGVsZXRlIG9wdGlvbnMucmVzdWx0cztcbiAgfVxuICB0aGlzLmV4dHJhID0gdW5kZWZpbmVkO1xuXG4gIC8vIE9wdGlvbnMgdG8gcGFzcyB0aHJvdWdoIHdpdGggdGhlIHF1ZXJ5XG4gIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cbiAgdGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xuICB0aGlzLnJlYWR5ID0gZmFsc2U7XG4gIHRoaXMuc2VudCA9IGZhbHNlO1xufVxuZW1pdHRlci5taXhpbihRdWVyeSk7XG5cblF1ZXJ5LnByb3RvdHlwZS5oYXNQZW5kaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiAhdGhpcy5yZWFkeTtcbn07XG5cbi8vIEhlbHBlciBmb3Igc3Vic2NyaWJlICYgZmV0Y2gsIHNpbmNlIHRoZXkgc2hhcmUgdGhlIHNhbWUgbWVzc2FnZSBmb3JtYXQuXG4vL1xuLy8gVGhpcyBmdW5jdGlvbiBhY3R1YWxseSBpc3N1ZXMgdGhlIHF1ZXJ5LlxuUXVlcnkucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCF0aGlzLmNvbm5lY3Rpb24uY2FuU2VuZCkgcmV0dXJuO1xuXG4gIHZhciBtZXNzYWdlID0ge1xuICAgIGE6IHRoaXMuYWN0aW9uLFxuICAgIGlkOiB0aGlzLmlkLFxuICAgIGM6IHRoaXMuY29sbGVjdGlvbixcbiAgICBxOiB0aGlzLnF1ZXJ5XG4gIH07XG4gIGlmICh0aGlzLm9wdGlvbnMpIHtcbiAgICBtZXNzYWdlLm8gPSB0aGlzLm9wdGlvbnM7XG4gIH1cbiAgaWYgKHRoaXMucmVzdWx0cykge1xuICAgIC8vIENvbGxlY3QgdGhlIHZlcnNpb24gb2YgYWxsIHRoZSBkb2N1bWVudHMgaW4gdGhlIGN1cnJlbnQgcmVzdWx0IHNldCBzbyB3ZVxuICAgIC8vIGRvbid0IG5lZWQgdG8gYmUgc2VudCB0aGVpciBzbmFwc2hvdHMgYWdhaW4uXG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucmVzdWx0cy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGRvYyA9IHRoaXMucmVzdWx0c1tpXTtcbiAgICAgIHJlc3VsdHMucHVzaChbZG9jLmlkLCBkb2MudmVyc2lvbl0pO1xuICAgIH1cbiAgICBtZXNzYWdlLnIgPSByZXN1bHRzO1xuICB9XG5cbiAgdGhpcy5jb25uZWN0aW9uLnNlbmQobWVzc2FnZSk7XG4gIHRoaXMuc2VudCA9IHRydWU7XG59O1xuXG4vLyBEZXN0cm95IHRoZSBxdWVyeSBvYmplY3QuIEFueSBzdWJzZXF1ZW50IG1lc3NhZ2VzIGZvciB0aGUgcXVlcnkgd2lsbCBiZVxuLy8gaWdub3JlZCBieSB0aGUgY29ubmVjdGlvbi5cblF1ZXJ5LnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgaWYgKHRoaXMuY29ubmVjdGlvbi5jYW5TZW5kICYmIHRoaXMuYWN0aW9uID09PSAncXMnKSB7XG4gICAgdGhpcy5jb25uZWN0aW9uLnNlbmQoe2E6ICdxdScsIGlkOiB0aGlzLmlkfSk7XG4gIH1cbiAgdGhpcy5jb25uZWN0aW9uLl9kZXN0cm95UXVlcnkodGhpcyk7XG4gIC8vIFRoZXJlIGlzIGEgY2FsbGJhY2sgZm9yIGNvbnNpc3RlbmN5LCBidXQgd2UgZG9uJ3QgYWN0dWFsbHkgd2FpdCBmb3IgdGhlXG4gIC8vIHNlcnZlcidzIHVuc3Vic2NyaWJlIG1lc3NhZ2UgY3VycmVudGx5XG4gIGlmIChjYWxsYmFjaykgcHJvY2Vzcy5uZXh0VGljayhjYWxsYmFjayk7XG59O1xuXG5RdWVyeS5wcm90b3R5cGUuX29uQ29ubmVjdGlvblN0YXRlQ2hhbmdlZCA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5jb25uZWN0aW9uLmNhblNlbmQgJiYgIXRoaXMuc2VudCkge1xuICAgIHRoaXMuc2VuZCgpO1xuICB9IGVsc2Uge1xuICAgIHRoaXMuc2VudCA9IGZhbHNlO1xuICB9XG59O1xuXG5RdWVyeS5wcm90b3R5cGUuX2hhbmRsZUZldGNoID0gZnVuY3Rpb24oZXJyLCBkYXRhLCBleHRyYSkge1xuICAvLyBPbmNlIGEgZmV0Y2ggcXVlcnkgZ2V0cyBpdHMgZGF0YSwgaXQgaXMgZGVzdHJveWVkLlxuICB0aGlzLmNvbm5lY3Rpb24uX2Rlc3Ryb3lRdWVyeSh0aGlzKTtcbiAgdGhpcy5faGFuZGxlUmVzcG9uc2UoZXJyLCBkYXRhLCBleHRyYSk7XG59O1xuXG5RdWVyeS5wcm90b3R5cGUuX2hhbmRsZVN1YnNjcmliZSA9IGZ1bmN0aW9uKGVyciwgZGF0YSwgZXh0cmEpIHtcbiAgdGhpcy5faGFuZGxlUmVzcG9uc2UoZXJyLCBkYXRhLCBleHRyYSk7XG59O1xuXG5RdWVyeS5wcm90b3R5cGUuX2hhbmRsZVJlc3BvbnNlID0gZnVuY3Rpb24oZXJyLCBkYXRhLCBleHRyYSkge1xuICB2YXIgY2FsbGJhY2sgPSB0aGlzLmNhbGxiYWNrO1xuICB0aGlzLmNhbGxiYWNrID0gbnVsbDtcbiAgaWYgKGVycikgcmV0dXJuIHRoaXMuX2ZpbmlzaFJlc3BvbnNlKGVyciwgY2FsbGJhY2spO1xuICBpZiAoIWRhdGEpIHJldHVybiB0aGlzLl9maW5pc2hSZXNwb25zZShudWxsLCBjYWxsYmFjayk7XG5cbiAgdmFyIHF1ZXJ5ID0gdGhpcztcbiAgdmFyIHdhaXQgPSAxO1xuICB2YXIgZmluaXNoID0gZnVuY3Rpb24oZXJyKSB7XG4gICAgaWYgKGVycikgcmV0dXJuIHF1ZXJ5Ll9maW5pc2hSZXNwb25zZShlcnIsIGNhbGxiYWNrKTtcbiAgICBpZiAoLS13YWl0KSByZXR1cm47XG4gICAgcXVlcnkuX2ZpbmlzaFJlc3BvbnNlKG51bGwsIGNhbGxiYWNrKTtcbiAgfTtcblxuICBpZiAoQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgIHdhaXQgKz0gZGF0YS5sZW5ndGg7XG4gICAgdGhpcy5yZXN1bHRzID0gdGhpcy5faW5nZXN0U25hcHNob3RzKGRhdGEsIGZpbmlzaCk7XG4gICAgdGhpcy5leHRyYSA9IGV4dHJhO1xuXG4gIH0gZWxzZSB7XG4gICAgZm9yICh2YXIgaWQgaW4gZGF0YSkge1xuICAgICAgd2FpdCsrO1xuICAgICAgdmFyIHNuYXBzaG90ID0gZGF0YVtpZF07XG4gICAgICB2YXIgZG9jID0gdGhpcy5jb25uZWN0aW9uLmdldChzbmFwc2hvdC5jIHx8IHRoaXMuY29sbGVjdGlvbiwgaWQpO1xuICAgICAgZG9jLmluZ2VzdFNuYXBzaG90KHNuYXBzaG90LCBmaW5pc2gpO1xuICAgIH1cbiAgfVxuXG4gIGZpbmlzaCgpO1xufTtcblxuUXVlcnkucHJvdG90eXBlLl9pbmdlc3RTbmFwc2hvdHMgPSBmdW5jdGlvbihzbmFwc2hvdHMsIGZpbmlzaCkge1xuICB2YXIgcmVzdWx0cyA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHNuYXBzaG90cy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBzbmFwc2hvdCA9IHNuYXBzaG90c1tpXTtcbiAgICB2YXIgZG9jID0gdGhpcy5jb25uZWN0aW9uLmdldChzbmFwc2hvdC5jIHx8IHRoaXMuY29sbGVjdGlvbiwgc25hcHNob3QuZCk7XG4gICAgZG9jLmluZ2VzdFNuYXBzaG90KHNuYXBzaG90LCBmaW5pc2gpO1xuICAgIHJlc3VsdHMucHVzaChkb2MpO1xuICB9XG4gIHJldHVybiByZXN1bHRzO1xufTtcblxuUXVlcnkucHJvdG90eXBlLl9maW5pc2hSZXNwb25zZSA9IGZ1bmN0aW9uKGVyciwgY2FsbGJhY2spIHtcbiAgdGhpcy5lbWl0KCdyZWFkeScpO1xuICB0aGlzLnJlYWR5ID0gdHJ1ZTtcbiAgaWYgKGVycikge1xuICAgIHRoaXMuY29ubmVjdGlvbi5fZGVzdHJveVF1ZXJ5KHRoaXMpO1xuICAgIGlmIChjYWxsYmFjaykgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICB9XG4gIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgdGhpcy5yZXN1bHRzLCB0aGlzLmV4dHJhKTtcbn07XG5cblF1ZXJ5LnByb3RvdHlwZS5faGFuZGxlRXJyb3IgPSBmdW5jdGlvbihlcnIpIHtcbiAgdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG59O1xuXG5RdWVyeS5wcm90b3R5cGUuX2hhbmRsZURpZmYgPSBmdW5jdGlvbihkaWZmKSB7XG4gIC8vIFdlIG5lZWQgdG8gZ28gdGhyb3VnaCB0aGUgbGlzdCB0d2ljZS4gRmlyc3QsIHdlJ2xsIGluZ2VzdCBhbGwgdGhlIG5ld1xuICAvLyBkb2N1bWVudHMuIEFmdGVyIHRoYXQgd2UnbGwgZW1pdCBldmVudHMgYW5kIGFjdHVhbGx5IHVwZGF0ZSBvdXIgbGlzdC5cbiAgLy8gVGhpcyBhdm9pZHMgcmFjZSBjb25kaXRpb25zIGFyb3VuZCBzZXR0aW5nIGRvY3VtZW50cyB0byBiZSBzdWJzY3JpYmVkICZcbiAgLy8gdW5zdWJzY3JpYmluZyBkb2N1bWVudHMgaW4gZXZlbnQgY2FsbGJhY2tzLlxuICBmb3IgKHZhciBpID0gMDsgaSA8IGRpZmYubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgZCA9IGRpZmZbaV07XG4gICAgaWYgKGQudHlwZSA9PT0gJ2luc2VydCcpIGQudmFsdWVzID0gdGhpcy5faW5nZXN0U25hcHNob3RzKGQudmFsdWVzKTtcbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgZGlmZi5sZW5ndGg7IGkrKykge1xuICAgIHZhciBkID0gZGlmZltpXTtcbiAgICBzd2l0Y2ggKGQudHlwZSkge1xuICAgICAgY2FzZSAnaW5zZXJ0JzpcbiAgICAgICAgdmFyIG5ld0RvY3MgPSBkLnZhbHVlcztcbiAgICAgICAgQXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseSh0aGlzLnJlc3VsdHMsIFtkLmluZGV4LCAwXS5jb25jYXQobmV3RG9jcykpO1xuICAgICAgICB0aGlzLmVtaXQoJ2luc2VydCcsIG5ld0RvY3MsIGQuaW5kZXgpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3JlbW92ZSc6XG4gICAgICAgIHZhciBob3dNYW55ID0gZC5ob3dNYW55IHx8IDE7XG4gICAgICAgIHZhciByZW1vdmVkID0gdGhpcy5yZXN1bHRzLnNwbGljZShkLmluZGV4LCBob3dNYW55KTtcbiAgICAgICAgdGhpcy5lbWl0KCdyZW1vdmUnLCByZW1vdmVkLCBkLmluZGV4KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdtb3ZlJzpcbiAgICAgICAgdmFyIGhvd01hbnkgPSBkLmhvd01hbnkgfHwgMTtcbiAgICAgICAgdmFyIGRvY3MgPSB0aGlzLnJlc3VsdHMuc3BsaWNlKGQuZnJvbSwgaG93TWFueSk7XG4gICAgICAgIEFycmF5LnByb3RvdHlwZS5zcGxpY2UuYXBwbHkodGhpcy5yZXN1bHRzLCBbZC50bywgMF0uY29uY2F0KGRvY3MpKTtcbiAgICAgICAgdGhpcy5lbWl0KCdtb3ZlJywgZG9jcywgZC5mcm9tLCBkLnRvKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgdGhpcy5lbWl0KCdjaGFuZ2VkJywgdGhpcy5yZXN1bHRzKTtcbn07XG5cblF1ZXJ5LnByb3RvdHlwZS5faGFuZGxlRXh0cmEgPSBmdW5jdGlvbihleHRyYSkge1xuICB0aGlzLmV4dHJhID0gZXh0cmE7XG4gIHRoaXMuZW1pdCgnZXh0cmEnLCBleHRyYSk7XG59O1xuIiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuZXhwb3J0cy5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5leHBvcnRzLm1peGluID0gbWl4aW47XG5cbmZ1bmN0aW9uIG1peGluKENvbnN0cnVjdG9yKSB7XG4gIGZvciAodmFyIGtleSBpbiBFdmVudEVtaXR0ZXIucHJvdG90eXBlKSB7XG4gICAgQ29uc3RydWN0b3IucHJvdG90eXBlW2tleV0gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlW2tleV07XG4gIH1cbn1cbiIsInZhciBtYWtlRXJyb3IgPSByZXF1aXJlKCdtYWtlLWVycm9yJyk7XG5cbmZ1bmN0aW9uIFNoYXJlREJFcnJvcihjb2RlLCBtZXNzYWdlKSB7XG4gIFNoYXJlREJFcnJvci5zdXBlci5jYWxsKHRoaXMsIG1lc3NhZ2UpO1xuICB0aGlzLmNvZGUgPSBjb2RlO1xufVxuXG5tYWtlRXJyb3IoU2hhcmVEQkVycm9yKTtcblxubW9kdWxlLmV4cG9ydHMgPSBTaGFyZURCRXJyb3I7XG4iLCJcbmV4cG9ydHMuZGVmYXVsdFR5cGUgPSByZXF1aXJlKCdvdC1qc29uMCcpLnR5cGU7XG5cbmV4cG9ydHMubWFwID0ge307XG5cbmV4cG9ydHMucmVnaXN0ZXIgPSBmdW5jdGlvbih0eXBlKSB7XG4gIGlmICh0eXBlLm5hbWUpIGV4cG9ydHMubWFwW3R5cGUubmFtZV0gPSB0eXBlO1xuICBpZiAodHlwZS51cmkpIGV4cG9ydHMubWFwW3R5cGUudXJpXSA9IHR5cGU7XG59O1xuXG5leHBvcnRzLnJlZ2lzdGVyKGV4cG9ydHMuZGVmYXVsdFR5cGUpO1xuIiwiXG5leHBvcnRzLmRvTm90aGluZyA9IGRvTm90aGluZztcbmZ1bmN0aW9uIGRvTm90aGluZygpIHt9XG5cbmV4cG9ydHMuaGFzS2V5cyA9IGZ1bmN0aW9uKG9iamVjdCkge1xuICBmb3IgKHZhciBrZXkgaW4gb2JqZWN0KSByZXR1cm4gdHJ1ZTtcbiAgcmV0dXJuIGZhbHNlO1xufTtcbiJdfQ==
