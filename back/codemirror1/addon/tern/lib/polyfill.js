/* codemirror/addon/tern/lib/polyfill.js */
// Shims to fill in enough of ECMAScript 5 to make Tern run. Does not
// supply standard-compliant methods, in that some functionality is
// left out (such as second argument to Object.create, self args in
// array methods, etc). WILL clash with other ECMA5 polyfills in a
// probably disruptive way.

(function() {
  Object.create = Object.create || (function() {
    if (!({__proto__: null} instanceof Object))
      return function(base) { return {__proto__: base}; };
    function ctor() {}
    var frame = document.body.appendChild(document.createElement("iframe"));
    frame.src = "javascript:";
    var empty = frame.contentWindow.Object.prototype;
    delete empty.hasOwnProperty;
    delete empty.isPrototypeOf;
    delete empty.propertyIsEnumerable;
    delete empty.valueOf;
    delete empty.toString;
    delete empty.toLocaleString;
    delete empty.constructor;
    return function(base) { ctor.prototype = base || empty; return new ctor(); };
  })();

  // Array methods

  var AP = Array.prototype;

  AP.some = AP.some || function(pred) {
    for (var i = 0; i < this.length; ++i) if (pred(this[i], i)) return true;
  };

  AP.forEach = AP.forEach || function(f) {
    for (var i = 0; i < this.length; ++i) f(this[i], i);
  };

  AP.indexOf = AP.indexOf || function(x, start) {
    for (var i = start || 0; i < this.length; ++i) if (this[i] === x) return i;
    return -1;
  };

  AP.lastIndexOf = AP.lastIndexOf || function(x, start) {
    for (var i = start == null ? this.length - 1 : start; i >= 0; ++i) if (this[i] === x) return i;
    return -1;
  };

  AP.map = AP.map || function(f) {
    for (var r = [], i = 0; i < this.length; ++i) r.push(f(this[i], i));
    return r;
  };

  Array.isArray = Array.isArray || function(v) {
    return Object.prototype.toString.call(v) == "[object Array]";
  };

  String.prototype.trim = String.prototype.trim || function() {
    var from = 0, to = this.length;
    while (/\s/.test(this.charAt(from))) ++from;
    while (/\s/.test(this.charAt(to - 1))) --to;
    return this.slice(from, to);
  };
