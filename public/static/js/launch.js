/* utils.js */
var utils = { };


// utils.deepCopy
utils.deepCopy = function deepCopy(data) {
    if (data == null || typeof(data) !== 'object')
        return data;

    if (data instanceof Array) {
        var arr = [ ];
        for(var i = 0; i < data.length; i++) {
            arr[i] = deepCopy(data[i]);
        }
        return arr;
    } else {
        var obj = { };
        for(var key in data) {
            if (data.hasOwnProperty(key))
                obj[key] = deepCopy(data[key]);
        }
        return obj;
    }
};


// String.startsWith
if (! String.prototype.startsWith) {
    Object.defineProperty(String.prototype, 'startsWith', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: function(str) {
            var that = this;
            var ceil = str.length;
            for(var i = 0; i < ceil; i++)
                if(that[i] !== str[i]) return false;
            return true;
        }
    });
}

// String.endsWith polyfill
if (! String.prototype.endsWith) {
    Object.defineProperty(String.prototype, 'endsWith', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: function(str) {
            var that = this;
            for(var i = 0, ceil = str.length; i < ceil; i++)
                if (that[i + that.length - ceil] !== str[i])
                    return false;
            return true;
        }
    });
}

// element.classList.add polyfill
(function () {
    /*global DOMTokenList */
    var dummy  = document.createElement('div'),
        dtp    = DOMTokenList.prototype,
        toggle = dtp.toggle,
        add    = dtp.add,
        rem    = dtp.remove;

    dummy.classList.add('class1', 'class2');

    // Older versions of the HTMLElement.classList spec didn't allow multiple
    // arguments, easy to test for
    if (!dummy.classList.contains('class2')) {
        dtp.add    = function () {
            Array.prototype.forEach.call(arguments, add.bind(this));
        };
        dtp.remove = function () {
            Array.prototype.forEach.call(arguments, rem.bind(this));
        };
    }
})();

var bytesToHuman = function(bytes) {
    if (isNaN(bytes) || bytes === 0) return '0 B';
    var k = 1000;
    var sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
};


/* ajax.js */

function Ajax(args) {
    if (typeof(args) === 'string')
        args = { url: args };

    return new AjaxRequest(args);
};

Ajax.get = function(url) {
    return new AjaxRequest({
        url: url
    });
};

Ajax.post = function(url, data) {
    return new AjaxRequest({
        method: 'POST',
        url: url,
        data: data
    });
};

Ajax.put = function(url, data) {
    return new AjaxRequest({
        method: 'PUT',
        url: url,
        data: data
    });
};

Ajax.delete = function(url) {
    return new AjaxRequest({
        method: 'DELETE',
        url: url
    });
};

Ajax.params = { };

Ajax.param = function(name, value) {
    Ajax.params[name] = value;
};



function AjaxRequest(args) {
    if (! args)
        throw new Error('no arguments provided');

    Events.call(this);

    // progress
    this._progress = 0.0;
    this.emit('progress', this._progress);

    // xhr
    this._xhr = new XMLHttpRequest();

    // events
    this._xhr.addEventListener('load', this._onLoad.bind(this), false);
    // this._xhr.addEventListener('progress', this._onProgress.bind(this), false);
    this._xhr.upload.addEventListener('progress', this._onProgress.bind(this), false);
    this._xhr.addEventListener('error', this._onError.bind(this), false);
    this._xhr.addEventListener('abort', this._onAbort.bind(this), false);

    // url
    var url = args.url;

    // query
    if (args.query && Object.keys(args.query).length) {
        if (url.indexOf('?') === -1) {
            url += '?';
        }

        var query = [ ];
        for(var key in args.query) {
            query.push(key + '=' + args.query[key]);
        }

        url += query.join('&');
    }

    // templating
    var parts = url.split('{{');
    if (parts.length > 1) {
        for(var i = 1; i < parts.length; i++) {
            var ends = parts[i].indexOf('}}');
            var key = parts[i].slice(0, ends);

            if (Ajax.params[key] === undefined)
                continue;

            // replace
            parts[i] = Ajax.params[key] + parts[i].slice(ends + 2);
        }

        url = parts.join('');
    }

    // open request
    this._xhr.open(args.method || 'GET', url, true);

    this.notJson = args.notJson || false;

    // header for PUT/POST
    if (! args.ignoreContentType && (args.method === 'PUT' || args.method === 'POST' || args.method === 'DELETE'))
        this._xhr.setRequestHeader('Content-Type', 'application/json');

    if (args.auth && config.accessToken) {
        this._xhr.setRequestHeader('Authorization', 'Bearer ' + config.accessToken);
    }

    if (args.headers) {
        for (var key in args.headers)
            this._xhr.setRequestHeader(key, args.headers[key]);
    }

    // stringify data if needed
    if (args.data && typeof(args.data) !== 'string' && ! (args.data instanceof FormData)) {
        args.data = JSON.stringify(args.data);
    }

    // make request
    this._xhr.send(args.data || null);
};
AjaxRequest.prototype = Object.create(Events.prototype);


AjaxRequest.prototype._onLoad = function() {
    this._progress = 1.0;
    this.emit('progress', 1.0);

    if (this._xhr.status === 200 || this._xhr.status === 201) {
        if (this.notJson) {
            this.emit('load', this._xhr.status, this._xhr.responseText);
        } else {
            try {
                var json = JSON.parse(this._xhr.responseText);
            } catch(ex) {
                this.emit('error', this._xhr.status || 0, new Error('invalid json'));
                return;
            }
            this.emit('load', this._xhr.status, json);
        }
    } else {
        try {
            var json = JSON.parse(this._xhr.responseText);
            var msg = json.message;
            if (! msg) {
                msg = json.error || (json.response && json.response.error);
            }

            if (! msg) {
                msg = this._xhr.responseText;
            }

            this.emit('error', this._xhr.status, msg);
        } catch (ex) {
            this.emit('error', this._xhr.status);
        }
    }
};


AjaxRequest.prototype._onError = function(evt) {
    this.emit('error', 0, evt);
};


AjaxRequest.prototype._onAbort = function(evt) {
    this.emit('error', 0, evt);
};


AjaxRequest.prototype._onProgress = function(evt) {
    if (! evt.lengthComputable)
        return;

    var progress = evt.loaded / evt.total;

    if (progress !== this._progress) {
        this._progress = progress;
        this.emit('progress', this._progress);
    }
};


AjaxRequest.prototype.abort = function() {
    this._xhr.abort();
};


/* array.js */
Object.defineProperty(Array.prototype, 'equals', {
    enumerable: false,
    value: function(array) {
        if (! array)
            return false;

        if (this.length !== array.length)
            return false;

        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i] instanceof Array && array[i] instanceof Array) {
                if (! this[i].equals(array[i]))
                    return false;
            } else if (this[i] !== array[i]) {
                return false;
            }
        }
        return true;
    }
});

Object.defineProperty(Array.prototype, 'match', {
    enumerable: false,
    value: function(pattern) {
        if (this.length !== pattern.length)
            return;

        for(var i = 0, l = this.length; i < l; i++) {
            if (pattern[i] !== '*' && pattern[i] !== this[i])
                return false;
        }

        return true;
    }
});


Array.prototype.binaryIndexOf = function(b) {
    var min = 0;
    var max = this.length - 1;
    var cur;
    var a;

    while (min <= max) {
        cur = Math.floor((min + max) / 2);
        a = this[cur];

        if (a < b) {
            min = cur + 1;
        } else if (a > b) {
            max = cur - 1;
        } else {
            return cur;
        }
    }

    return -1;
};


/* observer.js */
"use strict";

function Observer(data, options) {
    Events.call(this);
    options = options || { };

    this._destroyed = false;
    this._path = '';
    this._keys = [ ];
    this._data = { };

    this.patch(data);

    this._parent = options.parent || null;
    this._parentPath = options.parentPath || '';
    this._parentField = options.parentField || null;
    this._parentKey = options.parentKey || null;

    this._silent = false;

    var propagate = function(evt) {
        return function(path, arg1, arg2, arg3) {
            if (! this._parent)
                return;

            var key = this._parentKey;
            if (! key && (this._parentField instanceof Array)) {
                key = this._parentField.indexOf(this);

                if (key === -1)
                    return;
            }

            path = this._parentPath + '.' + key + '.' + path;

            var state;
            if (this._silent)
                state = this._parent.silence();

            this._parent.emit(path + ':' + evt, arg1, arg2, arg3);
            this._parent.emit('*:' + evt, path, arg1, arg2, arg3);

            if (this._silent)
                this._parent.silenceRestore(state);
        }
    };

    // propagate set
    this.on('*:set', propagate('set'));
    this.on('*:unset', propagate('unset'));
    this.on('*:insert', propagate('insert'));
    this.on('*:remove', propagate('remove'));
    this.on('*:move', propagate('move'));
}
Observer.prototype = Object.create(Events.prototype);


Observer.prototype.silence = function() {
    this._silent = true;

    // history hook to prevent array values to be recorded
    var historyState = this.history && this.history.enabled;
    if (historyState)
        this.history.enabled = false;

    // sync hook to prevent array values to be recorded as array root already did
    var syncState = this.sync && this.sync.enabled;
    if (syncState)
        this.sync.enabled = false;

    return [ historyState, syncState ];
};


Observer.prototype.silenceRestore = function(state) {
    this._silent = false;

    if (state[0])
        this.history.enabled = true;

    if (state[1])
        this.sync.enabled = true;
};


Observer.prototype._prepare = function(target, key, value, silent) {
    var self = this;
    var state;
    var path = (target._path ? (target._path + '.') : '') + key;
    var type = typeof(value);

    target._keys.push(key);

    if (type === 'object' && (value instanceof Array)) {
        target._data[key] = value.slice(0);

        for(var i = 0; i < target._data[key].length; i++) {
            if (typeof(target._data[key][i]) === 'object' && target._data[key][i] !== null) {
                if (target._data[key][i] instanceof Array) {
                    target._data[key][i].slice(0);
                } else {
                    target._data[key][i] = new Observer(target._data[key][i], {
                        parent: this,
                        parentPath: path,
                        parentField: target._data[key],
                        parentKey: null
                    });
                }
            } else {
                state = this.silence();
                this.emit(path + '.' + i + ':set', target._data[key][i], null);
                this.emit('*:set', path + '.' + i, target._data[key][i], null);
                this.silenceRestore(state);
            }
        }

        if (silent)
            state = this.silence();

        this.emit(path + ':set', target._data[key], null);
        this.emit('*:set', path, target._data[key], null);

        if (silent)
            this.silenceRestore(state);
    } else if (type === 'object' && (value instanceof Object)) {
        if (typeof(target._data[key]) !== 'object') {
            target._data[key] = {
                _path: path,
                _keys: [ ],
                _data: { }
            };
        }

        for(var i in value) {
            if (typeof(value[i]) === 'object') {
                this._prepare(target._data[key], i, value[i], true);
            } else {
                state = this.silence();

                target._data[key]._data[i] = value[i];
                target._data[key]._keys.push(i);

                this.emit(path + '.' + i + ':set', value[i], null);
                this.emit('*:set', path + '.' + i, value[i], null);

                this.silenceRestore(state);
            }
        }

        if (silent)
            state = this.silence();

        this.emit(path + ':set', value);
        this.emit('*:set', path, value);

        if (silent)
            this.silenceRestore(state);
    } else {
        if (silent)
            state = this.silence();

        target._data[key] = value;

        this.emit(path + ':set', value);
        this.emit('*:set', path, value);

        if (silent)
            this.silenceRestore(state);
    }

    return true;
};


Observer.prototype.set = function(path, value, silent) {
    var keys = path.split('.');
    var key = keys[keys.length - 1];
    var node = this;
    var nodePath = '';
    var obj = this;
    var state;

    for(var i = 0; i < keys.length - 1; i++) {
        if (node instanceof Array) {
            node = node[keys[i]];

            if (node instanceof Observer) {
                path = keys.slice(i + 1).join('.');
                obj = node;
            }
        } else {
            if (i < keys.length && typeof(node._data[keys[i]]) !== 'object') {
                if (node._data[keys[i]])
                    obj.unset((node.__path ? node.__path + '.' : '') + keys[i]);

                node._data[keys[i]] = {
                    _path: path,
                    _keys: [ ],
                    _data: { }
                };
                node._keys.push(keys[i]);
            }

            if (i === keys.length - 1 && node.__path)
                nodePath = node.__path + '.' + keys[i];

            node = node._data[keys[i]];
        }
    }

    if (node instanceof Array) {
        var ind = parseInt(key, 10);
        if (node[ind] === value)
            return;

        var valueOld = node[ind];
        if (! (valueOld instanceof Observer))
            valueOld = obj.json(valueOld);

        node[ind] = value;

        if (value instanceof Observer) {
            value._parent = obj;
            value._parentPath = nodePath;
            value._parentField = node;
            value._parentKey = null;
        }

        if (silent)
            state = obj.silence();

        obj.emit(path + ':set', value, valueOld);
        obj.emit('*:set', path, value, valueOld);

        if (silent)
            obj.silenceRestore(state);

        return true;
    } else if (node._data && ! node._data.hasOwnProperty(key)) {
        if (typeof(value) === 'object') {
            return obj._prepare(node, key, value);
        } else {
            node._data[key] = value;
            node._keys.push(key);

            if (silent)
                state = obj.silence();

            obj.emit(path + ':set', value, null);
            obj.emit('*:set', path, value, null);

            if (silent)
                obj.silenceRestore(state);

            return true;
        }
    } else {
        if (typeof(value) === 'object' && (value instanceof Array)) {
            if (value.equals(node._data[key]))
                return false;

            var valueOld = node._data[key];
            if (! (valueOld instanceof Observer))
                valueOld = obj.json(valueOld);

            if (node._data[key] && node._data[key].length === value.length) {
                state = obj.silence();

                for(var i = 0; i < node._data[key].length; i++) {
                    if (node._data[key][i] instanceof Observer) {
                        node._data[key][i].patch(value[i]);
                    } else if (node._data[key][i] !== value[i]) {
                        node._data[key][i] = value[i];
                        obj.emit(path + '.' + i + ':set', node._data[key][i], valueOld[i] || null);
                        obj.emit('*:set', path + '.' + i, node._data[key][i], valueOld[i] || null);
                    }
                }

                obj.silenceRestore(state);
            } else {
                node._data[key] = value;

                state = obj.silence();
                for(var i = 0; i < node._data[key].length; i++) {
                    obj.emit(path + '.' + i + ':set', node._data[key][i], valueOld[i] || null);
                    obj.emit('*:set', path + '.' + i, node._data[key][i], valueOld[i] || null);
                }
                obj.silenceRestore(state);
            }

            if (silent)
                state = obj.silence();

            obj.emit(path + ':set', value, valueOld);
            obj.emit('*:set', path, value, valueOld);

            if (silent)
                obj.silenceRestore(state);

            return true;
        } else if (typeof(value) === 'object' && (value instanceof Object)) {
            var changed = false;
            var valueOld = node._data[key];
            if (! (valueOld instanceof Observer))
                valueOld = obj.json(valueOld);

            var keys = Object.keys(value);

            if (! node._data[key] || ! node._data[key]._data) {
                if (node._data[key])
                    obj.unset((node.__path ? node.__path + '.' : '') + key);

                node._data[key] = {
                    _path: path,
                    _keys: [ ],
                    _data: { }
                };
            }

            for(var n in node._data[key]._data) {
                if (! value.hasOwnProperty(n)) {
                    var c = obj.unset(path + '.' + n, true);
                    if (c) changed = true;
                } else if (node._data[key]._data.hasOwnProperty(n)) {
                    if (! obj._equals(node._data[key]._data[n], value[n])) {
                        var c = obj.set(path + '.' + n, value[n], true);
                        if (c) changed = true;
                    }
                } else {
                    var c = obj._prepare(node._data[key], n, value[n], true);
                    if (c) changed = true;
                }
            }

            for(var i = 0; i < keys.length; i++) {
                if (value[keys[i]] === undefined && node._data[key]._data.hasOwnProperty(keys[i])) {
                    var c = obj.unset(path + '.' + keys[i], true);
                    if (c) changed = true;
                } else if (typeof(value[keys[i]]) === 'object') {
                    if (node._data[key]._data.hasOwnProperty(keys[i])) {
                        var c = obj.set(path + '.' + keys[i], value[keys[i]], true);
                        if (c) changed = true;
                    } else {
                        var c = obj._prepare(node._data[key], keys[i], value[keys[i]], true);
                        if (c) changed = true;
                    }
                } else if (! obj._equals(node._data[key]._data[keys[i]], value[keys[i]])) {
                    if (typeof(value[keys[i]]) === 'object') {
                        var c = obj.set(node._data[key]._path + '.' + keys[i], value[keys[i]], true);
                        if (c) changed = true;
                    } else if (node._data[key]._data[keys[i]] !== value[keys[i]]) {
                        changed = true;

                        if (node._data[key]._keys.indexOf(keys[i]) === -1)
                            node._data[key]._keys.push(keys[i]);

                        node._data[key]._data[keys[i]] = value[keys[i]];

                        state = obj.silence();
                        obj.emit(node._data[key]._path + '.' + keys[i] + ':set', node._data[key]._data[keys[i]], null);
                        obj.emit('*:set', node._data[key]._path + '.' + keys[i], node._data[key]._data[keys[i]], null);
                        obj.silenceRestore(state);
                    }
                }
            }

            if (changed) {
                if (silent)
                    state = obj.silence();

                var val = obj.json(node._data[key]);

                obj.emit(node._data[key]._path + ':set', val, valueOld);
                obj.emit('*:set', node._data[key]._path, val, valueOld);

                if (silent)
                    obj.silenceRestore(state);

                return true;
            } else {
                return false;
            }
        } else {
            var data;
            if (! node.hasOwnProperty('_data') && node.hasOwnProperty(key)) {
                data = node;
            } else {
                data = node._data;
            }

            if (data[key] === value)
                return false;

            if (silent)
                state = obj.silence();

            var valueOld = data[key];
            if (! (valueOld instanceof Observer))
                valueOld = obj.json(valueOld);

            data[key] = value;

            obj.emit(path + ':set', value, valueOld);
            obj.emit('*:set', path, value, valueOld);

            if (silent)
                obj.silenceRestore(state);

            return true;
        }
    }

    return false;
};


Observer.prototype.has = function(path) {
    var keys = path.split('.');
    var node = this;
    for (var i = 0; i < keys.length; i++) {
        if (node == undefined)
            return undefined;

        if (node._data) {
            node = node._data[keys[i]];
        } else {
            node = node[keys[i]];
        }
    }

    return node !== undefined;
};


Observer.prototype.get = function(path, raw) {
    var keys = path.split('.');
    var node = this;
    for (var i = 0; i < keys.length; i++) {
        if (node == undefined)
            return undefined;

        if (node._data) {
            node = node._data[keys[i]];
        } else {
            node = node[keys[i]];
        }
    }

    if (raw)
        return node;

    if (node == null) {
        return null;
    } else {
        return this.json(node);
    }
};


Observer.prototype.getRaw = function(path) {
    return this.get(path, true);
};


Observer.prototype._equals = function(a, b) {
    if (a === b) {
        return true;
    } else if (a instanceof Array && b instanceof Array && a.equals(b)) {
        return true;
    } else {
        return false;
    }
};


Observer.prototype.unset = function(path, silent) {
    var keys = path.split('.');
    var key = keys[keys.length - 1];
    var node = this;
    var obj = this;

    for(var i = 0; i < keys.length - 1; i++) {
        if (node instanceof Array) {
            node = node[keys[i]];
            if (node instanceof Observer) {
                path = keys.slice(i + 1).join('.');
                obj = node;
            }
        } else {
            node = node._data[keys[i]];
        }
    }

    if (! node._data || ! node._data.hasOwnProperty(key))
        return false;

    var valueOld = node._data[key];
    if (! (valueOld instanceof Observer))
        valueOld = obj.json(valueOld);

    // recursive
    if (node._data[key] && node._data[key]._data) {
        for(var i = 0; i < node._data[key]._keys.length; i++) {
            obj.unset(path + '.' + node._data[key]._keys[i], true);
        }
    }

    node._keys.splice(node._keys.indexOf(key), 1);
    delete node._data[key];

    var state;
    if (silent)
        state = obj.silence();

    obj.emit(path + ':unset', valueOld);
    obj.emit('*:unset', path, valueOld);

    if (silent)
        obj.silenceRestore(state);

    return true;
};


Observer.prototype.remove = function(path, ind, silent) {
    var keys = path.split('.');
    var key = keys[keys.length - 1];
    var node = this;
    var obj = this;

    for(var i = 0; i < keys.length - 1; i++) {
        if (node instanceof Array) {
            node = node[parseInt(keys[i], 10)];
            if (node instanceof Observer) {
                path = keys.slice(i + 1).join('.');
                obj = node;
            }
        } else if (node._data && node._data.hasOwnProperty(keys[i])) {
            node = node._data[keys[i]];
        } else {
            return;
        }
    }

    if (! node._data || ! node._data.hasOwnProperty(key) || ! (node._data[key] instanceof Array))
        return;

    var arr = node._data[key];
    if (arr.length < ind)
        return;

    var value = arr[ind];
    if (value instanceof Observer) {
        value._parent = null;
    } else {
        value = obj.json(value);
    }

    arr.splice(ind, 1);

    var state;
    if (silent)
        state = obj.silence();

    obj.emit(path + ':remove', value, ind);
    obj.emit('*:remove', path, value, ind);

    if (silent)
        obj.silenceRestore(state);

    return true;
};


Observer.prototype.removeValue = function(path, value, silent) {
    var keys = path.split('.');
    var key = keys[keys.length - 1];
    var node = this;
    var obj = this;

    for(var i = 0; i < keys.length - 1; i++) {
        if (node instanceof Array) {
            node = node[parseInt(keys[i], 10)];
            if (node instanceof Observer) {
                path = keys.slice(i + 1).join('.');
                obj = node;
            }
        } else if (node._data && node._data.hasOwnProperty(keys[i])) {
            node = node._data[keys[i]];
        } else {
            return;
        }
    }

    if (! node._data || ! node._data.hasOwnProperty(key) || ! (node._data[key] instanceof Array))
        return;

    var arr = node._data[key];

    var ind = arr.indexOf(value);
    if (ind === -1)
        return;

    if (arr.length < ind)
        return;

    var value = arr[ind];
    if (value instanceof Observer) {
        value._parent = null;
    } else {
        value = obj.json(value);
    }

    arr.splice(ind, 1);

    var state;
    if (silent)
        state = obj.silence();

    obj.emit(path + ':remove', value, ind);
    obj.emit('*:remove', path, value, ind);

    if (silent)
        obj.silenceRestore(state);

    return true;
};


Observer.prototype.insert = function(path, value, ind, silent) {
    var keys = path.split('.');
    var key = keys[keys.length - 1];
    var node = this;
    var obj = this;

    for(var i = 0; i < keys.length - 1; i++) {
        if (node instanceof Array) {
            node = node[parseInt(keys[i], 10)];
            if (node instanceof Observer) {
                path = keys.slice(i + 1).join('.');
                obj = node;
            }
        } else if (node._data && node._data.hasOwnProperty(keys[i])) {
            node = node._data[keys[i]];
        } else {
            return;
        }
    }

    if (! node._data || ! node._data.hasOwnProperty(key) || ! (node._data[key] instanceof Array))
        return;

    var arr = node._data[key];

    if (typeof(value) === 'object' && ! (value instanceof Observer)) {
        if (value instanceof Array) {
            value = value.slice(0);
        } else {
            value = new Observer(value);
        }
    }

    if (arr.indexOf(value) !== -1)
        return;

    if (ind === undefined) {
        arr.push(value);
        ind = arr.length - 1;
    } else {
        arr.splice(ind, 0, value);
    }

    if (value instanceof Observer) {
        value._parent = obj;
        value._parentPath = node._path + '.' + key;
        value._parentField = arr;
        value._parentKey = null;
    } else {
        value = obj.json(value);
    }

    var state;
    if (silent)
        state = obj.silence();

    obj.emit(path + ':insert', value, ind);
    obj.emit('*:insert', path, value, ind);

    if (silent)
        obj.silenceRestore(state);

    return true;
};


Observer.prototype.move = function(path, indOld, indNew, silent) {
    var keys = path.split('.');
    var key = keys[keys.length - 1];
    var node = this;
    var obj = this;

    for(var i = 0; i < keys.length - 1; i++) {
        if (node instanceof Array) {
            node = node[parseInt(keys[i], 10)];
            if (node instanceof Observer) {
                path = keys.slice(i + 1).join('.');
                obj = node;
            }
        } else if (node._data && node._data.hasOwnProperty(keys[i])) {
            node = node._data[keys[i]];
        } else {
            return;
        }
    }

    if (! node._data || ! node._data.hasOwnProperty(key) || ! (node._data[key] instanceof Array))
        return;

    var arr = node._data[key];

    if (arr.length < indOld || arr.length < indNew || indOld === indNew)
        return;

    var value = arr[indOld];

    arr.splice(indOld, 1);

    if (indNew === -1)
        indNew = arr.length;

    arr.splice(indNew, 0, value);

    if (! (value instanceof Observer))
        value = obj.json(value);

    var state;
    if (silent)
        state = obj.silence();

    obj.emit(path + ':move', value, indNew, indOld);
    obj.emit('*:move', path, value, indNew, indOld);

    if (silent)
        obj.silenceRestore(state);

    return true;
};


Observer.prototype.patch = function(data) {
    if (typeof(data) !== 'object')
        return;

    for(var key in data) {
        if (typeof(data[key]) === 'object' && ! this._data.hasOwnProperty(key)) {
            this._prepare(this, key, data[key]);
        } else if (this._data[key] !== data[key]) {
            this.set(key, data[key]);
        }
    }
};


Observer.prototype.json = function(target) {
    var obj = { };
    var node = target === undefined ? this : target;

    if (node instanceof Object && node._keys) {
        for (var i = 0; i < node._keys.length; i++) {
            var key = node._keys[i];
            var value = node._data[key];
            var type = typeof(value);

            if (type === 'object' && (value instanceof Array)) {
                obj[key] = value.slice(0);

                for(var n = 0; n < obj[key].length; n++) {
                    if (typeof(obj[key][n]) === 'object')
                        obj[key][n] = this.json(obj[key][n]);
                }
            } else if (type === 'object' && (value instanceof Object)) {
                obj[key] = this.json(value);
            } else {
                obj[key] = value;
            }
        }
    } else {
        if (node === null) {
            return null;
        } else if (typeof(node) === 'object' && (node instanceof Array)) {
            obj = node.slice(0);

            for(var n = 0; n < obj.length; n++) {
                obj[n] = this.json(obj[n]);
            }
        } else if (typeof(node) === 'object') {
            for(var key in node) {
                if (node.hasOwnProperty(key))
                    obj[key] = node[key];
            }
        } else {
            obj = node;
        }
    }
    return obj;
};


Observer.prototype.forEach = function(fn, target, path) {
    var node = target || this;
    path = path || '';

    for (var i = 0; i < node._keys.length; i++) {
        var key = node._keys[i];
        var value = node._data[key];
        var type = (this.schema && this.schema.has(path + key) && this.schema.get(path + key).type.name.toLowerCase()) || typeof(value);

        if (type === 'object' && (value instanceof Array)) {
            fn(path + key, 'array', value, key);
        } else if (type === 'object' && (value instanceof Object)) {
            fn(path + key, 'object', value, key);
            this.forEach(fn, value, path + key + '.');
        } else {
            fn(path + key, type, value, key);
        }
    }
};


Observer.prototype.destroy = function() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.emit('destroy');
    this.unbind();
};


/* observer-list.js */
"use strict";

function ObserverList(options) {
    Events.call(this);
    options = options || { };

    this.data = [ ];
    this._indexed = { };
    this.sorted = options.sorted || null;
    this.index = options.index || null;
}

ObserverList.prototype = Object.create(Events.prototype);


Object.defineProperty(ObserverList.prototype, 'length', {
    get: function() {
        return this.data.length;
    }
});


ObserverList.prototype.get = function(index) {
    if (this.index) {
        return this._indexed[index] || null;
    } else {
        return this.data[index] || null;
    }
};


ObserverList.prototype.set = function(index, value) {
    if (this.index) {
        this._indexed[index] = value;
    } else {
        this.data[index] = value;
    }
};


ObserverList.prototype.indexOf = function(item) {
    if (this.index) {
        var index = (item instanceof Observer && item.get(this.index)) || item[this.index]
        return (this._indexed[index] && index) || null;
    } else {
        var ind = this.data.indexOf(item);
        return ind !== -1 ? ind : null;
    }
};


ObserverList.prototype.position = function(b, fn) {
    var l = this.data;
    var min = 0;
    var max = l.length - 1;
    var cur;
    var a, i;
    fn = fn || this.sorted;

    while (min <= max) {
        cur = Math.floor((min + max) / 2);
        a = l[cur];

        i = fn(a, b);

        if (i === 1) {
            max = cur - 1;
        } else if (i === -1) {
            min = cur + 1;
        } else {
            return cur;
        }
    }

    return -1;
};


ObserverList.prototype.positionNextClosest = function(b, fn) {
    var l = this.data;
    var min = 0;
    var max = l.length - 1;
    var cur;
    var a, i;
    fn = fn || this.sorted;

    if (l.length === 0)
        return -1;

    if (fn(l[0], b) === 0)
        return 0;

    while (min <= max) {
        cur = Math.floor((min + max) / 2);
        a = l[cur];

        i = fn(a, b);

        if (i === 1) {
            max = cur - 1;
        } else if (i === -1) {
            min = cur + 1;
        } else {
            return cur;
        }
    }

    if (fn(a, b) === 1)
        return cur;

    if ((cur + 1) === l.length)
        return -1;

    return cur + 1;
};


ObserverList.prototype.has = function(item) {
    if (this.index) {
        var index = (item instanceof Observer && item.get(this.index)) || item[this.index]
        return !! this._indexed[index];
    } else {
        return this.data.indexOf(item) !== -1;
    }
};


ObserverList.prototype.add = function(item) {
    if (this.has(item))
        return null;

    var index = this.data.length;
    if (this.index) {
        index = (item instanceof Observer && item.get(this.index)) || item[this.index];
        this._indexed[index] = item;
    }

    var pos = 0;

    if (this.sorted) {
        pos = this.positionNextClosest(item);
        if (pos !== -1) {
            this.data.splice(pos, 0, item);
        } else {
            this.data.push(item);
        }
    } else {
        this.data.push(item);
        pos = this.data.length - 1;
    }

    this.emit('add', item, index);

    return pos;
};


ObserverList.prototype.move = function(item, pos) {
    var ind = this.data.indexOf(item);
    this.data.splice(ind, 1);
    if (pos === -1) {
        this.data.push(item);
    } else {
        this.data.splice(pos, 0, item);
    }
};


ObserverList.prototype.remove = function(item) {
    if (! this.has(item))
        return;

    var ind = this.data.indexOf(item);

    var index = ind;
    if (this.index) {
        index = (item instanceof Observer && item.get(this.index)) || item[this.index];
        delete this._indexed[index];
    }

    this.data.splice(ind, 1);

    this.emit('remove', item, index);
};


ObserverList.prototype.removeByKey = function(index) {
    if (this.index) {
        var item = this._indexed[index];

        if (! item)
            return;

        var ind = this.data.indexOf(item);
        this.data.splice(ind, 1);

        delete this._indexed[index];

        this.emit('remove', item, ind);
    } else {
        if (this.data.length < index)
            return;

        var item = this.data[index];

        this.data.splice(index, 1);

        this.emit('remove', item, index);
    }
};


ObserverList.prototype.removeBy = function(fn) {
    var i = this.data.length;
    while(i--) {
        if (! fn(this.data[i]))
            continue;

        if (this.index) {
            delete this._indexed[this.data[i][this.index]];
        }
        this.data.splice(i, 1);

        this.emit('remove', this.data[i], i);
    }
};


ObserverList.prototype.clear = function() {
    var items = this.data.slice(0);

    this.data = [ ];
    this._indexed = { };

    var i = items.length;
    while(i--) {
        this.emit('remove', items[i], i);
    }
};


ObserverList.prototype.forEach = function(fn) {
    for(var i = 0; i < this.data.length; i++) {
        fn(this.data[i], (this.index && this.data[i][this.index]) || i);
    }
};


ObserverList.prototype.find = function(fn) {
    var items = [ ];
    for(var i = 0; i < this.data.length; i++) {
        if (! fn(this.data[i]))
            continue;

        var index = i;
        if (this.index)
            index = this.data[i][this.index];

        items.push([ index, this.data[i] ]);
    }
    return items;
};


ObserverList.prototype.findOne = function(fn) {
    for(var i = 0; i < this.data.length; i++) {
        if (! fn(this.data[i]))
            continue;

        var index = i;
        if (this.index)
            index = this.data[i][this.index];

        return [ index, this.data[i] ];
    }
    return null;
};


ObserverList.prototype.map = function(fn) {
    return this.data.map(fn);
};


ObserverList.prototype.sort = function(fn) {
    this.data.sort(fn);
};


ObserverList.prototype.array = function() {
    return this.data.slice(0);
};


ObserverList.prototype.json = function() {
    var items = this.array();
    for(var i = 0; i < items.length; i++) {
        if (items[i] instanceof Observer) {
            items[i] = items[i].json();
        }
    }
    return items;
};


/* observer-sync.js */
function ObserverSync(args) {
    Events.call(this);
    args = args || { };

    this.item = args.item;
    this._enabled = args.enabled || true;
    this._prefix = args.prefix || [ ];
    this._paths = args.paths || null;
    this._sync = args.sync || true;

    this._initialize();
}
ObserverSync.prototype = Object.create(Events.prototype);


ObserverSync.prototype._initialize = function() {
    var self = this;
    var item = this.item;

    // object/array set
    item.on('*:set', function(path, value, valueOld) {
        if (! self._enabled) return;

        // check if path is allowed
        if (self._paths) {
            var allowedPath = false;
            for(var i = 0; i < self._paths.length; i++) {
                if (path.indexOf(self._paths[i]) !== -1) {
                    allowedPath = true;
                    break;
                }
            }

            // path is not allowed
            if (! allowedPath)
                return;
        }

        // full path
        var p = self._prefix.concat(path.split('.'));

        // need jsonify
        if (value instanceof Observer || value instanceof ObserverList)
            value = value.json();

        // can be array value
        var ind = path.lastIndexOf('.');
        if (ind !== -1 && (this.get(path.slice(0, ind)) instanceof Array)) {
            // array index should be int
            p[p.length - 1] = parseInt(p[p.length - 1], 10);

            // emit operation: list item set
            self.emit('op', {
                p: p,
                li: value,
                ld: valueOld
            });
        } else {
            // emit operation: object item set
            var obj = {
                p: p,
                oi: value
            };

            if (valueOld !== undefined) {
                obj.od = valueOld;
            }

            self.emit('op', obj);
        }
    });

    // unset
    item.on('*:unset', function(path, value) {
        if (! self._enabled) return;

        self.emit('op', {
            p: self._prefix.concat(path.split('.')),
            od: null
        });
    });

    // list move
    item.on('*:move', function(path, value, ind, indOld) {
        if (! self._enabled) return;
        self.emit('op', {
            p: self._prefix.concat(path.split('.')).concat([ indOld ]),
            lm: ind
        });
    });

    // list remove
    item.on('*:remove', function(path, value, ind) {
        if (! self._enabled) return;

        // need jsonify
        if (value instanceof Observer || value instanceof ObserverList)
            value = value.json();

        self.emit('op', {
            p: self._prefix.concat(path.split('.')).concat([ ind ]),
            ld: value
        });
    });

    // list insert
    item.on('*:insert', function(path, value, ind) {
        if (! self._enabled) return;

        // need jsonify
        if (value instanceof Observer || value instanceof ObserverList)
            value = value.json();

        self.emit('op', {
            p: self._prefix.concat(path.split('.')).concat([ ind ]),
            li: value
        });
    });
};


ObserverSync.prototype.write = function(op) {
    // disable history if available
    var historyReEnable = false;
    if (this.item.history && this.item.history.enabled) {
        historyReEnable = true;
        this.item.history.enabled = false;
    }

    if (op.hasOwnProperty('oi')) {
        // set key value
        var path = op.p.slice(this._prefix.length).join('.');

        this._enabled = false;
        this.item.set(path, op.oi);
        this._enabled = true;


    } else if (op.hasOwnProperty('ld') && op.hasOwnProperty('li')) {
        // set array value
        var path = op.p.slice(this._prefix.length).join('.');

        this._enabled = false;
        this.item.set(path, op.li);
        this._enabled = true;


    } else if (op.hasOwnProperty('ld')) {
        // delete item
        var path = op.p.slice(this._prefix.length, -1).join('.');

        this._enabled = false;
        this.item.remove(path, op.p[op.p.length - 1]);
        this._enabled = true;


    } else if (op.hasOwnProperty('li')) {
        // add item
        var path = op.p.slice(this._prefix.length, -1).join('.');
        var ind = op.p[op.p.length - 1];

        this._enabled = false;
        this.item.insert(path, op.li, ind);
        this._enabled = true;


    } else if (op.hasOwnProperty('lm')) {
        // item moved
        var path = op.p.slice(this._prefix.length, -1).join('.');
        var indOld = op.p[op.p.length - 1];
        var ind = op.lm;

        this._enabled = false;
        this.item.move(path, indOld, ind);
        this._enabled = true;


    } else if (op.hasOwnProperty('od')) {
        // unset key value
        var path = op.p.slice(this._prefix.length).join('.');
        this._enabled = false;
        this.item.unset(path);
        this._enabled = true;


    } else {
        console.log('unknown operation', op);
    }

    // reenable history
    if (historyReEnable)
        this.item.history.enabled = true;

    this.emit('sync', op);
};

Object.defineProperty(ObserverSync.prototype, 'enabled', {
    get: function() {
        return this._enabled;
    },
    set: function(value) {
        this._enabled = !! value;
    }
});

Object.defineProperty(ObserverSync.prototype, 'prefix', {
    get: function() {
        return this._prefix;
    },
    set: function(value) {
        this._prefix = value || [ ];
    }
});

Object.defineProperty(ObserverSync.prototype, 'paths', {
    get: function() {
        return this._paths;
    },
    set: function(value) {
        this._paths = value || null;
    }
});


/* editor/editor.js */
(function() {
    'use strict';

    function Editor() {
        Events.call(this);

        this._hooks = { };
    }
    Editor.prototype = Object.create(Events.prototype);


    Editor.prototype.method = function(name, fn) {
        if (this._hooks[name] !== undefined) {
            throw new Error('can\'t override hook: ' + name);
        }
        this._hooks[name] = fn;
    };


    Editor.prototype.methodRemove = function(name) {
        delete this._hooks[name];
    };


    Editor.prototype.call = function(name) {
        if (this._hooks[name]) {
            var args = Array.prototype.slice.call(arguments, 1);

            try {
                return this._hooks[name].apply(null, args);
            } catch(ex) {
                console.info('%c%s %c(editor.method error)', 'color: #06f', name, 'color: #f00');
                console.log(ex.stack);
            }
        }
        return null;
    };


    // editor
    window.editor = new Editor();
})();


// config
(function() {
    'use strict';

    var applyConfig = function(path, value) {
        if (typeof(value) === 'object') {
            for(var key in value) {
                applyConfig((path ? path + '.' : '') + key, value[key]);
            }
        } else {
            Ajax.param(path, value);
        }
    };

    applyConfig('', config);
})();


/* launch/first-load.js */
(function() {
    'use strict';

    var visible = ! document.hidden;

    document.addEventListener('visibilitychange', function() {
        if (visible === ! document.hidden)
            return;

        visible = ! document.hidden;
        if (visible) {
            editor.emit('visible');
        } else {
            editor.emit('hidden');
        }
        editor.emit('visibility', visible);
    }, false);

    editor.method('visibility', function() {
        return visible;
    });

    // first load
    document.addEventListener('DOMContentLoaded', function() {
        editor.emit('load');
    }, false);
})();


/* launch/messenger.js */
editor.on('load', function() {
    'use strict';

    if (typeof(Messenger) === 'undefined')
        return;

    var messenger = new Messenger();

    messenger.connect(config.url.messenger.ws);

    messenger.on('connect', function() {
        this.authenticate(config.accessToken, 'designer');
    });

    messenger.on('welcome', function() {
        this.projectWatch(config.project.id);
    });

    messenger.on('message', function(evt) {
        editor.emit('messenger:' + evt.name, evt.data);
    });
});


/* launch/project-settings-sync.js */
editor.once('load', function() {
    'use strict';

    var settings = new Observer(config.project.settings);

    editor.method('project:settings', function () {
        return settings;
    });

    // handle changes by others
    editor.on('messenger:project.update', function (data) {
        for (var path in data) {
            if (! path.startsWith('settings.'))
                continue;

            var p = path.substring(9);

            var history = settings.history;
            settings.history = false;
            settings.set(p, data[path]);
            settings.history = history;
        }
    });
});


/* launch/viewport-loading.js */
editor.once('load', function () {
    'use strict';

    editor.method('viewport:loadingScreen', function () {
        pc.script.createLoadingScreen(function (app) {
            var showSplash = function () {
                // splash wrapper
                var wrapper = document.createElement('div');
                wrapper.id = 'application-splash-wrapper';
                document.body.appendChild(wrapper);

                // splash
                var splash = document.createElement('div');
                splash.id = 'application-splash';
                wrapper.appendChild(splash);
                splash.style.display = 'none';

                var logo = document.createElement('img');
                logo.src = 'https://s3-eu-west-1.amazonaws.com/static.playcanvas.com/images/play_text_252_white.png';
                splash.appendChild(logo);
                logo.onload = function () {
                    splash.style.display = 'block';
                };

                var container = document.createElement('div');
                container.id = 'progress-bar-container';
                splash.appendChild(container);

                var bar = document.createElement('div');
                bar.id = 'progress-bar';
                container.appendChild(bar);

            };

            var hideSplash = function () {
                var splash = document.getElementById('application-splash-wrapper');
                splash.parentElement.removeChild(splash);
            };

            var setProgress = function (value) {
                var bar = document.getElementById('progress-bar');
                if(bar) {
                    value = Math.min(1, Math.max(0, value));
                    bar.style.width = value * 100 + '%';
                }
            };

            var createCss = function () {
                var css = [
                    'body {',
                    '    background-color: #283538;',
                    '}',

                    '#application-splash-wrapper {',
                    '    position: absolute;',
                    '    top: 0;',
                    '    left: 0;',
                    '    height: 100%;',
                    '    width: 100%;',
                    '    background-color: #283538;',
                    '}',

                    '#application-splash {',
                    '    position: absolute;',
                    '    top: calc(50% - 28px);',
                    '    width: 264px;',
                    '    left: calc(50% - 132px);',
                    '}',

                    '#application-splash img {',
                    '    width: 100%;',
                    '}',

                    '#progress-bar-container {',
                    '    margin: 20px auto 0 auto;',
                    '    height: 2px;',
                    '    width: 100%;',
                    '    background-color: #1d292c;',
                    '}',

                    '#progress-bar {',
                    '    width: 0%;',
                    '    height: 100%;',
                    '    background-color: #f60;',
                    '}',
                    '@media (max-width: 480px) {',
                    '    #application-splash {',
                    '        width: 170px;',
                    '        left: calc(50% - 85px);',
                    '    }',
                    '}'

                ].join('\n');

                var style = document.createElement('style');
                style.type = 'text/css';
                if (style.styleSheet) {
                  style.styleSheet.cssText = css;
                } else {
                  style.appendChild(document.createTextNode(css));
                }

                document.head.appendChild(style);
            };


            createCss();

            showSplash();

            app.on('preload:end', function () {
                app.off('preload:progress');
            });
            app.on('preload:progress', setProgress);
            app.on('start', hideSplash);
        });

    });
});


/* launch/viewport.js */
editor.once('load', function() {
    'use strict';

    // Wait for assets, hierarchy and settings to load before initializing application and starting.
    var done = false;
    var hierarchy = false;
    var assets  = false;
    var settings = false;
    var sourcefiles = false;
    var libraries = false;
    var sceneData = null;
    var sceneSettings = null;
    var loadingScreen = false;
    var scriptList = [];
    var legacyScripts = editor.call('project:settings').get('use_legacy_scripts');

    // update progress bar
    var setProgress = function (value) {
        var bar = document.getElementById('progress-bar');
        value = Math.min(1, Math.max(0, value));
        bar.style.width = value * 100 + '%';
    };

    // respond to resize window
    var reflow = function () {
        var size = app.resizeCanvas(canvas.width, canvas.height);
        canvas.style.width = '';
        canvas.style.height = '';

        var fillMode = app._fillMode;

        if (fillMode == pc.fw.FillMode.NONE || fillMode == pc.fw.FillMode.KEEP_ASPECT) {
            if ((fillMode == pc.fw.FillMode.NONE && canvas.clientHeight < window.innerHeight) || (canvas.clientWidth / canvas.clientHeight >= window.innerWidth / window.innerHeight)) {
                canvas.style.marginTop = Math.floor((window.innerHeight - canvas.clientHeight) / 2) + 'px';
            } else {
                canvas.style.marginTop = '';
            }
        }
    };


    // try to start preload and initialization of application after load event
    var init = function () {
        if (!done && assets && hierarchy && settings && (! legacyScripts || sourcefiles) && libraries && loadingScreen) {
            // prevent multiple init calls during scene loading
            done = true;

            // load assets that are in the preload set
            app.preload(function (err) {
                // load scripts that are in the scene data
                app._preloadScripts(sceneData, function (err) {
                    if (err) {
                        console.error(err);
                    }

                    // create scene
                    app.scene = app.loader.open("scene", sceneData);
                    app.root.addChild(app.scene.root);

                    // update scene settings now that scene is loaded
                    app.applySceneSettings(sceneSettings);

                    // clear stored loading data
                    sceneData = null;
                    sceneSettings = null;
                    scriptList = null;

                    editor.call('entities:')
                    if (err) {
                        console.error(err);
                    }

                    app.start();
                });
            });
        }
    };

    var createCanvas = function () {
        var canvas = document.createElement('canvas');
        canvas.setAttribute('id', 'application-canvas');
        canvas.setAttribute('tabindex', 0);
        // canvas.style.visibility = 'hidden';

        // Disable I-bar cursor on click+drag
        canvas.onselectstart = function () { return false; };

        document.body.appendChild(canvas);

        return canvas;
    };

    var showSplash = function () {
        // splash
        var splash = document.createElement('div');
        splash.id = 'application-splash';
        document.body.appendChild(splash);

        // img
        var img = document.createElement('img');
        img.src = 'https://s3-eu-west-1.amazonaws.com/static.playcanvas.com/images/logo/PLAY_FLAT_ORANGE3.png'
        splash.appendChild(img);

        // progress bar
        var container = document.createElement('div');
        container.id = 'progress-container';
        splash.appendChild(container);

        var bar = document.createElement('div');
        bar.id = 'progress-bar';
        container.appendChild(bar);
    };

    var hideSplash = function () {
        var splash = document.getElementById('application-splash');
        splash.parentElement.removeChild(splash);
    };

    var createLoadingScreen = function () {

        var defaultLoadingScreen = function () {
            editor.call('viewport:loadingScreen');
            loadingScreen = true;
            init();
        };

        // if the project has a loading screen script then
        // download it and execute it
        if (config.project.settings.loading_screen_script) {
            var loadingScript = document.createElement('script');
            if (config.project.settings.use_legacy_scripts) {
                loadingScript.src = scriptPrefix + '/' + config.project.settings.loading_screen_script;
            } else {
                loadingScript.src = '/api/assets/' + config.project.settings.loading_screen_script + '/download';
            }

            //alert(loadingScript.src)

            loadingScript.onload = function() {
                loadingScreen = true;
                init();
            };

            loadingScript.onerror = function () {
                console.error("Could not load loading screen script: " + config.project.settings.loading_screen_script);
                defaultLoadingScreen();
            };

            var head = document.getElementsByTagName('head')[0];
            head.insertBefore(loadingScript, head.firstChild);
         }
         // no loading screen script so just use default splash screen
         else {
            defaultLoadingScreen();
         }
    };

    var canvas = createCanvas();

    // convert library properties into URLs
    var libraryUrls = [];
    if (config.project.settings.libraries) {
        for (var i = 0; i < config.project.settings.libraries.length; i++) {
            if (config.project.settings.libraries[i] === 'physics-engine-3d') {
                libraryUrls.push(config.url.physics);
            } else {
                libraryUrls.push(config.project.settings.libraries[i]);
            }
        }
    }

    if (config.project.settings.vr && !pc.VrManager.isSupported) {
        libraryUrls.push(config.url.webvr);
    }

    var queryParams = (new pc.URI(window.location.href)).getQuery();

    var scriptPrefix = config.project.scriptPrefix;

    // queryParams.local can be true or it can be a URL
    if (queryParams.local) {
        scriptPrefix = queryParams.local === 'true' ? 'http://localhost:51000' : queryParams.local;
    }

    // listen for project setting changes
    var projectSettings = editor.call('project:settings');

    // legacy scripts
    pc.script.legacy = projectSettings.get('use_legacy_scripts');

    // playcanvas app
    var app = new pc.Application(canvas, {
        mouse: new pc.input.Mouse(canvas),
        touch: !!('ontouchstart' in window) ? new pc.input.TouchDevice(canvas) : null,
        keyboard: new pc.input.Keyboard(window),
        gamepads: new pc.input.GamePads(),
        scriptPrefix: scriptPrefix,
        scriptsOrder: projectSettings.get('scripts') || [ ],
        assetPrefix: '/api',
        graphicsDeviceOptions: {
            antialias: config.project.settings.antiAlias === false ? false : true,
            alpha: config.project.settings.transparent_canvas === false ? false : true,
            preserveDrawingBuffer: !!config.project.settings.preserve_drawing_buffer
        }
    });

    if (canvas.classList) {
        canvas.classList.add('fill-mode-' + config.project.settings.fill_mode);
    }

    if (config.project.settings.use_device_pixel_ratio) {
        app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
    }

    app.setCanvasResolution(config.project.settings.resolution_mode, config.project.settings.width, config.project.settings.height);
    app.setCanvasFillMode(config.project.settings.fill_mode, config.project.settings.width, config.project.settings.height);

    app._loadLibraries(libraryUrls, function (err) {
        app._onVrChange(config.project.settings.vr);
        libraries = true;
        if (err) {
            console.error(err);
        }
        init();
    });

    var style = document.head.querySelector ? document.head.querySelector('style') : null;

    // append css to style
    var createCss = function () {
        if (! document.head.querySelector)
            return;

        if (! style)
            style = document.head.querySelector('style');

        // css media query for aspect ratio changes
        var css  = "@media screen and (min-aspect-ratio: " + config.project.settings.width + "/" + config.project.settings.height + ") {";
        css += "    #application-canvas.fill-mode-KEEP_ASPECT {";
        css += "        width: auto;";
        css += "        height: 100%;";
        css += "        margin: 0 auto;";
        css += "    }";
        css += "}";

        style.innerHTML = css;
    };

    createCss();

    var refreshResolutionProperties = function () {
        app.setCanvasResolution(config.project.settings.resolution_mode, config.project.settings.width, config.project.settings.height);
        app.setCanvasFillMode(config.project.settings.fill_mode, config.project.settings.width, config.project.settings.height);
        reflow();
    };

    projectSettings.on('width:set', function (value) {
        config.project.settings.width = value;
        createCss();
        refreshResolutionProperties();
    });
    projectSettings.on('height:set', function (value) {
        config.project.settings.height = value;
        createCss();
        refreshResolutionProperties();
    });

    projectSettings.on('fill_mode:set', function (value, oldValue) {
        config.project.settings.fill_mode = value;
        if (canvas.classList) {
            if (oldValue)
                canvas.classList.remove('fill-mode-' + oldValue);

            canvas.classList.add('fill-mode-' + value);
        }

        refreshResolutionProperties();
    });

    projectSettings.on('resolution_mode:set', function (value) {
        config.project.settings.resolution_mode = value;
        refreshResolutionProperties();
    });

    projectSettings.on('use_device_pixel_ratio:set', function (value) {
        config.project.settings.use_device_pixel_ratio = value;
        app.graphicsDevice.maxPixelRatio = value ? window.devicePixelRatio : 1;
    });

    window.addEventListener('resize', reflow, false);
    window.addEventListener('orientationchange', reflow, false);

    reflow();

    // get application
    editor.method('viewport:app', function() {
        return app;
    });

    editor.on('entities:load', function (data) {
        hierarchy = true;
        sceneData = data;
        init();
    });

    editor.on('assets:load', function () {
        assets = true;
        init();
    });

    editor.on('sceneSettings:load', function (data) {
        settings = true;
        sceneSettings = data.json();
        init();
    });

    if (legacyScripts) {
        editor.on('sourcefiles:load', function (scripts) {
            scriptList = scripts;
            sourcefiles = true;
            init();
        });
    }

    createLoadingScreen();
});


/* launch/viewport-error-console.js */
editor.once('load', function() {
    'use strict';

    // console
    var panel = document.createElement('div');
    panel.id = 'application-console';
    panel.classList.add('hidden');
    document.body.appendChild(panel);

    // close button img
    var closeBtn = document.createElement('img');
    closeBtn.src = 'https://s3-eu-west-1.amazonaws.com/static.playcanvas.com/images/icons/fa/16x16/remove.png';
    panel.appendChild(closeBtn);

    closeBtn.addEventListener('click', function () {
        var i = panel.childNodes.length;
        while (i-- > 1) {
            panel.childNodes[i].parentElement.removeChild(panel.childNodes[i]);
        }

        panel.classList.add('hidden');
    });

    var logTimestamp = null;
    var stopLogs = false;

    var append = function (msg, cls) {
        if (stopLogs) return;

        // prevent too many log messages
        if (panel.childNodes.length <= 1) {
            logTimestamp = Date.now();
        } else if (panel.childNodes.length > 60) {
            if (Date.now() - logTimestamp < 2000) {
                stopLogs = true;
                msg = "Too many logs. Open the browser console to see more details.";
            }
        }

        // create new DOM element with the specified inner HTML
        var element = document.createElement('p');
        element.innerHTML = msg.replace(/\n/g, '<br/>');
        if (cls)
            element.classList.add(cls);

        var links = element.querySelectorAll('.code-link');
        for(var i = 0; i < links.length; i++) {
            links[i].addEventListener('click', function(evt) {
                evt.preventDefault();
                var scope = window;

                // TODO
                // possible only when launcher and editor are within same domain (HTTPS)
                // var scope = window.opener || window;

                scope.open(this.getAttribute('href') + this.getAttribute('query'), this.getAttribute('href')).focus();
            }, false);
        }

        panel.appendChild(element);

        panel.classList.remove('hidden');
        return element;
    }

    var onError = function(msg, url, line, col, e) {
        if (url) {
            // check if this is a playcanvas script
            var codeEditorUrl = '';
            var query = '';
            var target = null;

            // if this is a playcanvas script
            // then create a URL that will open the code editor
            // at that line and column
            if (url.indexOf('api/files/code') !== -1) {
                var parts = url.split('//')[1].split('/');

                target = '/editor/code/' + parts[4] + '/';
                if (parts.length > 9) {
                    target += parts.slice(9).join('/');
                } else {
                    target += parts.slice(6).join('/');
                }

                codeEditorUrl = 'https://' + window.location.host + target;
                query = '?line=' + line + '&col=' + col + '&error=true';
            } else if (! editor.call('project:settings').get('use_legacy_scripts') && url.indexOf('/api/assets/') !== -1 && url.indexOf('.js') !== -1) {
                var assetId = parseInt(url.match(/\/api\/assets\/files\/.+?id=([0-9]+)/)[1], 10);
                target = '/editor/asset/' + assetId;

                codeEditorUrl = 'https://' + window.location.host + target;
                query = '?line=' + line + '&col=' + col + '&error=true';
            } else {
                codeEditorUrl = url;
            }

            var slash = url.lastIndexOf('/');
            var relativeUrl = url.slice(slash + 1);

            append(pc.string.format('<a href="{0}" query="{1}" target="{2}" class="code-link">[{3}:{4}]</a>: {5}', codeEditorUrl, query, target, relativeUrl, line, msg), 'error');

            // append stacktrace as well
            if (e && e.stack)
                append(e.stack.replace(/ /g, '&nbsp;'), 'trace');
        } else {
            // Chrome only shows 'Script error.' if the error comes from
            // a different domain.
            if (msg && msg !== 'Script error.') {
                append(msg, 'error');
            } else {
                append('Error loading scripts. Open the browser console for details.', 'error');
            }
        }
    };

    // catch errors and show them to the console
    window.onerror = onError;

    // redirect console.error to the in-game console
    var consoleError = console.error;
    console.error = function(item) {
        var errorPassed = false;

        if (item instanceof Error) {
            consoleError.call(this, item.stack);

            var msg = item.message;
            var lines = item.stack.split('\n');
            if (lines.length >= 2) {
                var line = lines[1];
                var url = line.slice(line.indexOf('(') + 1);
                var m = url.match(/:[0-9]+:[0-9]+\)/);
                if (m) {
                    url = url.slice(0, m.index);
                    var parts = m[0].slice(1, -1).split(':');

                    if (parts.length === 2) {
                        var line = parseInt(parts[0], 10);
                        var col = parseInt(parts[1], 10);

                        onError(msg, url, line, col, item);
                        errorPassed = true;
                    }
                }
            }
        } else {
            consoleError.call(this, item);
        }

        if (item instanceof Error) {
            if (! errorPassed)
                append(item.message, 'error');
        } else {
            append(item.toString(), 'error');
        }
    };

});


/* launch/tools.js */
var now = function() {
    return performance.timing.navigationStart + performance.now();
};

if (! performance || ! performance.now || ! performance.timing)
    now = Date.now;

var start = now();

editor.once('load', function() {
    'use strict';

    // times
    var timeBeginning = performance.timing ? performance.timing.responseEnd : start;
    var timeNow = now() - timeBeginning;
    var timeHover = 0;

    var epoc = ! window.performance || ! performance.now || ! performance.timing;
    editor.method('tools:epoc', function() {
        return epoc;
    });

    editor.method('tools:time:now', function() { return now() - timeBeginning; });
    editor.method('tools:time:beginning', function() { return timeBeginning; });
    editor.method('tools:time:hover', function() { return timeHover; });

    editor.method('tools:time:toHuman', function(ms, precision) {
        var s = ms / 1000;
        var m = ('00' + Math.floor(s / 60)).slice(-2);
        if (precision) {
            s = ('00.0' + (s % 60).toFixed(precision)).slice(-4);
        } else {
            s = ('00' + Math.floor(s % 60)).slice(-2);
        }
        return m + ':' + s;
    });

    // root panel
    var root = document.createElement('div');
    root.id = 'dev-tools';
    root.style.display = 'none';
    document.body.appendChild(root);
    editor.method('tools:root', function() {
        return root;
    });

    // variabled
    var updateInterval;
    var enabled = false;

    if (location.search && location.search.indexOf('profile=true') !== -1)
        enabled = true;

    if (enabled)
        root.style.display = 'block';

    // view
    var scale = .2; // how many pixels in a ms
    var capacity = 0; // how many ms can fit
    var scroll = {
        time: 0, // how many ms start from
        auto: true, // auto scroll to the end
        drag: {
            x: 0,
            time: 0,
            bar: false,
            barTime: 0,
            barMove: false
        }
    };

    editor.method('tools:enabled', function() { return enabled; });

    editor.method('tools:enable', function() {
        if (enabled)
            return;

        enabled = true;
        root.style.display = 'block';
        resize();
        editor.emit('tools:clear');
        editor.emit('tools:state', true);

        updateInterval = setInterval(function() {
            update();
            editor.emit('tools:render');
        }, 1000 / 60);
    });

    editor.method('tools:disable', function() {
        if (! enabled)
            return;

        enabled = false;
        root.style.display = 'none';
        editor.emit('tools:clear');
        editor.emit('tools:state', false);
        clearInterval(updateInterval);
    });

    // methods to access view params
    editor.method('tools:time:capacity', function() { return capacity; });
    editor.method('tools:scroll:time', function() { return scroll.time; });

    // size
    var left = 300;
    var right = 0;
    var width = 0;
    var height = 0;
    // resizing
    var resize = function() {
        var rect = root.getBoundingClientRect();

        if (width === rect.width && height === rect.height)
            return;

        width = rect.width;
        height = rect.height;
        capacity = Math.floor((width - left - right) / scale);
        scroll.time = Math.max(0, Math.min(timeNow - capacity, Math.floor(scroll.time)));

        editor.emit('tools:resize', width, height);
    };
    window.addEventListener('resize', resize, false);
    window.addEventListener('orientationchange', resize, false);
    setInterval(resize, 500);
    resize();
    editor.method('tools:size:width', function() { return width; });
    editor.method('tools:size:height', function() { return height; });

    editor.on('tools:clear', function() {
        timeBeginning = now();
        timeNow = 0;
        timeHover = 0;
        scroll.time = 0;
        scroll.auto = true;
    });

    var mouse = {
        x: 0,
        y: 0,
        click: false,
        down: false,
        up: false,
        hover: false
    };

    var update = function() {
        timeNow = now() - timeBeginning;

        if (scroll.auto)
            scroll.time = Math.max(0, timeNow - capacity);

        if (mouse.click) {
            scroll.drag.x = mouse.x;
            scroll.drag.time = scroll.time;
            scroll.drag.bar = mouse.y < 23;
            if (scroll.drag.bar) {
                scroll.drag.barTime = ((mouse.x / (width - 300)) * timeNow) - scroll.time;
                scroll.drag.barMove = scroll.drag.barTime >= 0 && scroll.drag.barTime <= capacity;
            }
            scroll.auto = false;
            root.classList.add('dragging');
            editor.emit('tools:scroll:start');
        } else if (mouse.down) {
            if (scroll.drag.bar) {
                if (scroll.drag.barMove) {
                    scroll.time = ((mouse.x / (width - 300)) * timeNow) - scroll.drag.barTime;
                } else {
                    scroll.time = ((mouse.x / (width - 300)) * timeNow) - (capacity / 2);
                }
            } else {
                scroll.time = scroll.drag.time + ((scroll.drag.x - mouse.x) / scale);
            }
            scroll.time = Math.max(0, Math.min(timeNow - capacity, Math.floor(scroll.time)));
        } else if (mouse.up) {
            if (Math.abs((scroll.time + capacity) - timeNow) < 32)
                scroll.auto = true;

            root.classList.remove('dragging');
            editor.emit('tools:scroll:end');
        }

        if (mouse.hover && ! mouse.down) {
            if (mouse.y < 23) {
                timeHover = Math.floor((mouse.x / (width - 300)) * timeNow);
            } else if (mouse.y < 174) {
                timeHover = Math.floor(mouse.x / scale + scroll.time);
            } else {
                timeHover = 0;
            }
        } else {
            timeHover = 0;
        }

        flushMouse();
    };

    root.addEventListener('mousemove', function(evt) {
        evt.stopPropagation();

        var rect = root.getBoundingClientRect();
        mouse.x = evt.clientX - (rect.left + 300);
        mouse.y = evt.clientY - rect.top;
        mouse.hover = mouse.x > 0;
        if (mouse.y < 23) {
            timeHover = Math.floor((mouse.x / (width - 300)) * timeNow);
        } else {
            timeHover = Math.floor(mouse.x / scale + scroll.time);
        }
    }, false);

    root.addEventListener('mousedown', function(evt) {
        evt.stopPropagation();

        if (evt.button !== 0 || mouse.click || mouse.down || ! mouse.hover)
            return;

        mouse.click = true;
    }, false);

    root.addEventListener('mouseup', function(evt) {
        evt.stopPropagation();

        if (evt.button !== 0 || ! mouse.down)
            return;

        mouse.down = false;
        mouse.up = true;
    }, false);

    root.addEventListener('mouseleave', function(evt) {
        mouse.hover = false;
        timeHover = 0;
        if (! mouse.down)
            return;

        mouse.down = false;
        mouse.up = true;
    }, false);

    root.addEventListener('mousewheel', function(evt) {
        evt.stopPropagation();

        if (! mouse.hover)
            return;

        scroll.time = Math.max(0, Math.min(timeNow - capacity, Math.floor(scroll.time + evt.deltaX / scale)));
        if (evt.deltaX < 0) {
            scroll.auto = false;
        } else if (Math.abs((scroll.time + capacity) - timeNow) < 16) {
            scroll.auto = true;
        }
    }, false);

    // alt + t
    window.addEventListener('keydown', function(evt) {
        if (evt.keyCode === 84 && evt.altKey) {
            if (enabled) {
                editor.call('tools:disable');
            } else {
                editor.call('tools:enable');
            }
        }
    }, false);

    var flushMouse = function() {
        if (mouse.up)
            mouse.up = false;

        if (mouse.click) {
            mouse.click = false;
            mouse.down = true;
        }
    };

    if (enabled) {
        updateInterval = setInterval(function() {
            update();
            editor.emit('tools:render');
        }, 1000 / 60);
    }
});


/* launch/tools-overview.js */
editor.once('load', function() {
    'use strict';

    // variables
    var enabled = editor.call('tools:enabled');
    var scale = .2;
    var events = [ ];
    var eventsIndex = { };

    // canvas
    var canvas = document.createElement('canvas');
    canvas.classList.add('overview');
    editor.call('tools:root').appendChild(canvas);

    // context
    var ctx = canvas.getContext('2d');

    // resize
    editor.on('tools:resize', function(width, height) {
        canvas.width = width - 300;
        canvas.height = 24;
        scale = canvas.width / editor.call('tools:capacity');
        ctx.font = '12px monospace';
        render();
    });
    canvas.width = editor.call('tools:size:width') - 300;
    canvas.height = 24;
    scale = canvas.width / editor.call('tools:capacity');

    editor.on('tools:clear', function() {
        events = [ ];
        eventsIndex = { };
    });

    editor.on('tools:timeline:add', function(item) {
        var found = false;

        // check if can extend existing event
        for(var i = 0; i < events.length; i++) {
            if (events[i].t2 !== null && events[i].k === item.k && (events[i].t - 1) <= item.t && (events[i].t2 === -1 || (events[i].t2 + 1) >= item.t)) {
                found = true;
                events[i].t2 = item.t2;
                eventsIndex[item.i] = events[i];
                break;
            }
        }

        if (! found) {
            var obj = {
                i: item.i,
                t: item.t,
                t2: item.t2,
                k: item.k
            };
            events.push(obj);
            eventsIndex[obj.i] = obj;
        }
    });

    editor.on('tools:timeline:update', function(item) {
        if (! enabled || ! eventsIndex[item.i])
            return;

        eventsIndex[item.i].t2 = item.t2;
    });

    var render = function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        var scaleMs = 1000 * scale;
        var now = editor.call('tools:time:now');
        var scrollTime = editor.call('tools:scroll:time');
        var capacity = editor.call('tools:time:capacity');
        var timeHover = editor.call('tools:time:hover');
        ctx.textBaseline = 'alphabetic';

        var startX = scrollTime / now * canvas.width;
        var endX = (Math.min(now, scrollTime + capacity)) / now * canvas.width;

        // view rect
        ctx.beginPath();
        ctx.rect(startX, 0, endX - startX, canvas.height);
        ctx.fillStyle = '#303030';
        ctx.fill();
        // line bottom
        ctx.beginPath();
        ctx.moveTo(startX, canvas.height - .5);
        ctx.lineTo(endX, canvas.height - .5);
        ctx.strokeStyle = '#2c2c2c';
        ctx.stroke();

        // events
        var x, x2, e;
        for(var i = 0; i < events.length; i++) {
            e = events[i];
            x = e.t / now * canvas.width;

            if (events[i].t2 !== null) {
                var t2 = e.t2;
                if (e.t2 === -1)
                    t2 = now;

                x2 = Math.max(t2 / now * canvas.width, x + 1);

                ctx.beginPath();
                ctx.rect(x, Math.floor((canvas.height - 8) / 2), x2 - x, 8);
                ctx.fillStyle = editor.call('tools:timeline:color', e.k);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.moveTo(x, 1);
                ctx.lineTo(x, canvas.height - 1);
                ctx.strokeStyle = editor.call('tools:timeline:color', e.k);
                ctx.stroke();
            }
        }

        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';

        // start/end text
        ctx.fillStyle = '#fff';
        // start time
        ctx.textAlign = 'left';
        ctx.strokeText('00:00.0', 2.5, canvas.height - 2.5);
        ctx.fillText('00:00.0', 2.5, canvas.height - 2.5);
        // now time
        ctx.textAlign = 'right';
        ctx.strokeText(editor.call('tools:time:toHuman', now, 1), canvas.width - 2.5, canvas.height - 2.5);
        ctx.fillText(editor.call('tools:time:toHuman', now, 1), canvas.width - 2.5, canvas.height - 2.5);

        var startTextWidth = 0;
        ctx.textBaseline = 'top';

        // view start
        if (scrollTime > 0) {
            var text = editor.call('tools:time:toHuman', scrollTime, 1);
            var measures = ctx.measureText(text);
            var offset = 2.5;
            if (startX + 2.5 + measures.width < endX - 2.5) {
                startTextWidth = measures.width;
                ctx.textAlign = 'left';
            } else {
                offset = -2.5;
                ctx.textAlign = 'right';
            }
            ctx.strokeText(text, startX + offset, 0);
            ctx.fillText(text, startX + offset, 0);
        }

        // view end
        if ((scrollTime + capacity) < now - 100) {
            var text = editor.call('tools:time:toHuman', Math.min(now, scrollTime + capacity), 1);
            var measures = ctx.measureText(text);
            var offset = 2.5;
            if (endX - 2.5 - measures.width - startTextWidth > startX + 2.5) {
                ctx.textAlign = 'right';
                offset = -2.5;
            } else {
                ctx.textAlign = 'left';
            }
            ctx.strokeText(text, endX + offset, 0);
            ctx.fillText(text, endX + offset, 0);
        }

        ctx.lineWidth = 1;
    };

    editor.on('tools:render', render);
});


/* launch/tools-timeline.js */
editor.once('load', function() {
    'use strict';

    // variables
    var enabled = editor.call('tools:enabled');
    var counter = 0;
    var scale = .2;
    var events = [ ];
    var cacheAssetLoading = { };
    var cacheShaderCompile = [ ];
    var cacheShaderCompileEvents = [ ];
    var cacheLightmapper = null;
    var cacheLightmapperEvent = null;
    var app = editor.call('viewport:app');

    // canvas
    var canvas = document.createElement('canvas');
    canvas.classList.add('timeline');
    editor.call('tools:root').appendChild(canvas);

    // context
    var ctx = canvas.getContext('2d');

    // resize
    editor.on('tools:resize', function(width, height) {
        canvas.width = width - 300;
        canvas.height = 275;
        scale = canvas.width / editor.call('tools:time:capacity');
        ctx.font = '12px monospace';
        render();
    });
    canvas.width = editor.call('tools:size:width') - 300;
    canvas.height = 275;
    scale = canvas.width / editor.call('tools:time:capacity');

    editor.on('tools:clear', function() {
        events = [ ];
        cacheAssetLoading = { };
        cacheShaderCompile = [ ];
        cacheShaderCompileEvents = [ ];
    });

    editor.on('tools:state', function(state) {
        enabled = state;
    });

    // colors for different kinds of events
    var kindColors = {
        '': '#ff0',
        'asset': '#6f6',
        'shader': '#f60',
        'update': '#06f',
        'render': '#07f',
        'physics': '#0ff',
        'lightmap': '#f6f'
    };
    editor.method('tools:timeline:color', function(kind) {
        return kindColors[kind] || '#fff';
    });

    // add event to history
    var addEvent = function(args) {
        if (! enabled) return;

        var e = {
            i: ++counter,
            t: args.time,
            t2: args.time2 || null,
            n: args.name || '',
            k: args.kind || ''
        };
        events.push(e);
        editor.emit('tools:timeline:add', e);
        return e;
    };
    editor.method('tools:timeline:add', addEvent);

    // subscribe to app reload start
    app.once('preload:start', function() {
        if (! enabled) return;

        addEvent({
            time: editor.call('tools:time:now'),
            name: 'preload'
        });
    });

    // subscribe to app start
    app.once('start', function() {
        if (! enabled) return;

        addEvent({
            time: editor.call('tools:time:now'),
            name: 'start'
        });
    });



    // render frames
    // app.on('frameEnd', function() {
    //     var e = addEvent(app.stats.frame.renderStart - editor.call('tools:time:beginning'), null, 'render');
    //     e.t2 = (app.stats.frame.renderStart - editor.call('tools:time:beginning')) + app.stats.frame.renderTime;
    // });

    // subscribe to asset loading start
    app.assets.on('load:start', function(asset) {
        if (! enabled) return;

        cacheAssetLoading[asset.id] = addEvent({
            time: editor.call('tools:time:now'),
            time2: -1,
            kind: 'asset'
        });
    });

    // subscribe to asset loading end
    app.assets.on('load', function(asset) {
        if (! enabled || ! cacheAssetLoading[asset.id])
            return;

        cacheAssetLoading[asset.id].t2 = editor.call('tools:time:now');
        editor.emit('tools:timeline:update', cacheAssetLoading[asset.id]);
        delete cacheAssetLoading[asset.id];
    });


    var onShaderStart = function(evt) {
        if (! enabled) return;

        var time = evt.timestamp;
        if (editor.call('tools:epoc'))
            time -= editor.call('tools:time:beginning');

        var item = addEvent({
            time: time,
            time2: -1,
            kind: 'shader'
        });

        cacheShaderCompile.push(evt.target);
        cacheShaderCompileEvents[cacheShaderCompile.length - 1] = item;
    };

    var onShaderEnd = function(evt) {
        if (! enabled) return;

        var ind = cacheShaderCompile.indexOf(evt.target);
        if (ind === -1)
            return;

        var time = evt.timestamp;
        if (editor.call('tools:epoc'))
            time -= editor.call('tools:time:beginning');

        cacheShaderCompileEvents[ind].t2 = time;
        editor.emit('tools:timeline:update', cacheShaderCompileEvents[ind]);
        cacheShaderCompile.splice(ind, 1);
        cacheShaderCompileEvents.splice(ind, 1);
    };

    var onLightmapperStart = function(evt) {
        if (! enabled) return;

        var time = evt.timestamp;
        if (editor.call('tools:epoc'))
            time -= editor.call('tools:time:beginning');

        var item = addEvent({
            time: time,
            time2: -1,
            kind: 'lightmap'
        });

        cacheLightmapper = evt.target;
        cacheLightmapperEvent = item;
    };

    var onLightmapperEnd = function(evt) {
        if (! enabled) return;

        if (cacheLightmapper !== evt.target)
            return;

        var time = evt.timestamp;
        if (editor.call('tools:epoc'))
            time -= editor.call('tools:time:beginning');

        cacheLightmapperEvent.t2 = time;
        editor.emit('tools:timeline:update', cacheLightmapperEvent);
        cacheLightmapper = null;
    };

    // subscribe to shader compile and linking
    app.graphicsDevice.on('shader:compile:start', onShaderStart);
    app.graphicsDevice.on('shader:link:start', onShaderStart);
    app.graphicsDevice.on('shader:compile:end', onShaderEnd);
    app.graphicsDevice.on('shader:link:end', onShaderEnd);

    // subscribe to lightmapper baking
    app.graphicsDevice.on('lightmapper:start', onLightmapperStart);
    app.graphicsDevice.on('lightmapper:end', onLightmapperEnd);

    // add performance.timing events if available
    if (performance.timing) {
        // dom interactive
        addEvent({
            time: performance.timing.domInteractive - editor.call('tools:time:beginning'),
            name: 'dom'
        });
        // document load
        addEvent({
            time: performance.timing.loadEventEnd - editor.call('tools:time:beginning'),
            name: 'load'
        });
    }

    var render = function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        var barMargin = 1;
        var barHeight = 8;
        var stack = [ ];
        var scaleMs = 1000 * scale;
        var now = editor.call('tools:time:now');
        var scrollTime = editor.call('tools:scroll:time');
        var timeHover = editor.call('tools:time:hover');
        ctx.textBaseline = 'alphabetic';

        // grid
        var secondsX = Math.floor(canvas.width * scale);
        ctx.strokeStyle = '#2c2c2c';
        ctx.fillStyle = '#989898';
        var offset = scaleMs - ((scrollTime * scale) % scaleMs) - scaleMs;
        for(var x = 0; x <= secondsX; x++) {
            var barX = Math.floor(x * scaleMs + offset) + .5;
            if (x > 0) {
                ctx.beginPath();
                ctx.moveTo(barX, 0);
                ctx.lineTo(barX, canvas.height);
                ctx.stroke();
            }

            var s = Math.floor(x + (scrollTime / 1000));
            var m = Math.floor(s / 60);
            s = s % 60;
            ctx.fillText((m ? m + 'm ' : '') + s + 's', barX + 2.5, canvas.height - 2.5);
        }

        // events
        var e, x = 0, x2 = 0, y;
        for(var i = 0; i < events.length; i++) {
            e = events[i];
            x = Math.floor((e.t - scrollTime) * scale);

            if (x > canvas.width)
                break;

            // time
            if (e.t2 !== null) {
                if (isNaN(e.t2)) {
                    console.log(e);
                    continue;
                }
                // range
                var t2 = e.t2 - scrollTime;
                if (e.t2 === -1)
                    t2 = now - scrollTime;


                x2 = Math.max(Math.floor(t2 * scale), x + 1);

                if (x2 < 0)
                    continue;

                y = 0;
                var foundY = false;
                for(var n = 0; n < stack.length; n++) {
                    if (stack[n] < e.t) {
                        stack[n] = t2 + scrollTime;
                        y = n * (barHeight + barMargin);
                        foundY = true;
                        break;
                    }
                }
                if (! foundY) {
                    y = stack.length * (barHeight + barMargin);
                    stack.push(t2 + scrollTime);
                }

                ctx.beginPath();
                ctx.rect(x + .5, y + 1, x2 - x + .5, barHeight);
                ctx.fillStyle = kindColors[e.k] || '#fff';
                ctx.fill();
            } else {
                if (x < 0)
                    continue;

                // single event
                ctx.beginPath();
                ctx.moveTo(x + .5, 1);
                ctx.lineTo(x + .5, canvas.height - 1);
                ctx.strokeStyle = kindColors[e.k] || '#fff';
                ctx.stroke();
            }
        }

        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';
        for(var i = 0; i < events.length; i++) {
            e = events[i];
            x = Math.floor((e.t - scrollTime) * scale);

            if (x > canvas.width)
                break;

            if (e.t2 !== null || x < 0)
                continue;

            // name
            if (e.n) {
                ctx.fillStyle = kindColors[e.k] || '#fff';
                ctx.strokeText(e.n, x + 2.5, canvas.height - 12.5);
                ctx.strokeText((e.t / 1000).toFixed(2) + 's', x + 2.5, canvas.height - 2.5);
                ctx.fillText(e.n, x + 2.5, canvas.height - 12.5);
                ctx.fillText((e.t / 1000).toFixed(2) + 's', x + 2.5, canvas.height - 2.5);
            }
        }
        ctx.lineWidth = 1;

        // now
        ctx.beginPath();
        ctx.moveTo(Math.floor((now - scrollTime) * scale) + .5, 0);
        ctx.lineTo(Math.floor((now - scrollTime) * scale) + .5, canvas.height);
        ctx.strokeStyle = '#989898';
        ctx.stroke();

        // hover
        if (timeHover > 0) {
            var x = (timeHover - scrollTime) * scale;
            ctx.beginPath();
            ctx.moveTo(Math.floor(x) + .5, 0);
            ctx.lineTo(Math.floor(x) + .5, canvas.height);
            ctx.strokeStyle = '#989898';
            ctx.stroke();

            ctx.beginPath();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#000';
            ctx.fillStyle = '#fff';
            ctx.strokeText((timeHover / 1000).toFixed(1) + 's', Math.floor(x) + 2.5, canvas.height - 22.5);
            ctx.fillText((timeHover / 1000).toFixed(1) + 's', Math.floor(x) + 2.5, canvas.height - 22.5);
            ctx.lineWidth = 1;
        }
    };

    editor.on('tools:render', render);
});


/* launch/tools-frame.js */
editor.once('load', function() {
    'use strict';

    var enabled = editor.call('tools:enabled');
    var app = editor.call('viewport:app');

    editor.on('tools:state', function(state) {
        enabled = state;
    });

    var panel = document.createElement('div');
    panel.classList.add('frame');
    editor.call('tools:root').appendChild(panel);

    var addPanel = function(args) {
        var element = document.createElement('div');
        element.classList.add('panel');
        panel.appendChild(element);

        element._header = document.createElement('div');
        element._header.classList.add('header');
        element._header.textContent = args.title;
        element.appendChild(element._header);

        element._header.addEventListener('click', function() {
            if (element.classList.contains('folded')) {
                element.classList.remove('folded');
            } else {
                element.classList.add('folded');
            }
        }, false);

        return element;
    };

    var addField = function(args) {
        var row = document.createElement('div');
        row.classList.add('row');

        row._title = document.createElement('div');
        row._title.classList.add('title');
        row._title.textContent = args.title || '';
        row.appendChild(row._title);

        row._field = document.createElement('div');
        row._field.classList.add('field');
        row._field.textContent = args.value || '-';
        row.appendChild(row._field);

        Object.defineProperty(row, 'value', {
            set: function(value) {
                this._field.textContent = value !== undefined ? value : '';
            }
        });

        return row;
    };
    editor.method('tools:frame:field:add', function(name, title, value) {
        var field = addField({
            title: title,
            value: value
        });
        fieldsCustom[name] = field;
        panelGame.appendChild(field);
    });
    editor.method('tools:frame:field:value', function(name, value) {
        if (! fieldsCustom[name])
            return;

        fieldsCustom[name].value = value;
    });


    // convert number of bytes to human form
    var bytesToHuman = function(bytes) {
        if (isNaN(bytes) || bytes === 0) return '0 B';
        var k = 1000;
        var sizes = ['b', 'Kb', 'Mb', 'Gb', 'Tb', 'Pb', 'Eb', 'Zb', 'Yb'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
    };


    // frame
    var panelFrame = addPanel({
        title: 'Frame'
    });
    // scene
    var panelScene = addPanel({
        title: 'Scene'
    });
    // drawCalls
    var panelDrawCalls = addPanel({
        title: 'Draw Calls'
    });
    // particles
    var panelParticles = addPanel({
        title: 'Particles'
    });
    // shaders
    var panelShaders = addPanel({
        title: 'Shaders'
    });
    // lightmapper
    var panelLightmap = addPanel({
        title: 'Lightmapper'
    });
    // vram
    var panelVram = addPanel({
        title: 'VRAM'
    });
    // game
    var panelGame = addPanel({
        title: 'Game'
    });


    var fieldsCustom = { };

    var fields = [{
        key: [ 'frame', 'fps' ],
        panel: panelFrame,
        title: 'FPS',
        update: false
    }, {
        key: [ 'frame', 'ms' ],
        panel: panelFrame,
        title: 'MS',
        format: function(value) {
            return value.toFixed(2);
        }
    }, {
        key: [ 'frame', 'cameras' ],
        title: 'Cameras',
        panel: panelFrame
    }, {
        key: [ 'frame', 'cullTime' ],
        title: 'Cull Time',
        panel: panelFrame,
        format: function(value) {
            return value.toFixed(3);
        }
    }, {
        key: [ 'frame', 'sortTime' ],
        title: 'Sort Time',
        panel: panelFrame,
        format: function(value) {
            return value.toFixed(3);
        }
    }, {
        key: [ 'frame', 'shaders' ],
        title: 'Shaders',
        panel: panelFrame
    }, {
        key: [ 'frame', 'materials' ],
        title: 'Materials',
        panel: panelFrame
    }, {
        key: [ 'frame', 'triangles' ],
        title: 'Triangles',
        panel: panelFrame,
        format: function(value) {
            return value.toLocaleString();
        }
    }, {
        key: [ 'frame', 'otherPrimitives' ],
        title: 'Other Primitives',
        panel: panelFrame
    }, {
        key: [ 'frame', 'shadowMapUpdates' ],
        title: 'ShadowMaps Updates',
        panel: panelFrame
    }, {
        key: [ 'frame', 'shadowMapTime' ],
        title: 'ShadowMaps Time',
        panel: panelFrame,
        format: function(value) {
            return value.toFixed(2);
        }
    }, {
        key: [ 'frame', 'updateTime' ],
        title: 'Update Time',
        panel: panelFrame,
        format: function(value) {
            return value.toFixed(2);
        }
    }, {
        key: [ 'frame', 'physicsTime' ],
        title: 'Physics Time',
        panel: panelFrame,
        format: function(value) {
            return value.toFixed(2);
        }
    }, {
        key: [ 'frame', 'renderTime' ],
        title: 'Render Time',
        panel: panelFrame,
        format: function(value) {
            return value.toFixed(2);
        }
    }, {
        key: [ 'frame', 'forwardTime' ],
        title: 'Forward Time',
        panel: panelFrame,
        format: function(value) {
            return value.toFixed(2);
        }
    }, {
        key: [ 'scene', 'meshInstances' ],
        title: 'Mesh Instances',
        panel: panelScene
    }, {
        key: [ 'scene', 'drawCalls' ],
        title: 'Draw Calls (potential)',
        panel: panelScene
    }, {
        key: [ 'scene', 'lights' ],
        title: 'Lights',
        panel: panelScene
    }, {
        key: [ 'scene', 'dynamicLights' ],
        title: 'Lights (Dynamic)',
        panel: panelScene
    }, {
        key: [ 'scene', 'bakedLights' ],
        title: 'Lights (Baked)',
        panel: panelScene
    }, {
        key: [ 'drawCalls', 'total' ],
        title: 'Total',
        panel: panelDrawCalls,
        format: function(value) {
            return value.toLocaleString();
        }
    }, {
        key: [ 'drawCalls', 'forward' ],
        title: 'Forward',
        panel: panelDrawCalls,
        format: function(value) {
            return value.toLocaleString();
        }
    }, {
        key: [ 'drawCalls', 'skinned' ],
        title: 'Skinned',
        panel: panelDrawCalls,
        format: function(value) {
            return value.toLocaleString();
        }
    }, {
        key: [ 'drawCalls', 'shadow' ],
        title: 'Shadow',
        panel: panelDrawCalls,
        format: function(value) {
            return value.toLocaleString();
        }
    }, {
        key: [ 'drawCalls', 'depth' ],
        title: 'Depth',
        panel: panelDrawCalls,
        format: function(value) {
            return value.toLocaleString();
        }
    }, {
        key: [ 'drawCalls', 'instanced' ],
        title: 'Instanced',
        panel: panelDrawCalls,
        format: function(value) {
            return value.toLocaleString();
        }
    }, {
        key: [ 'drawCalls', 'removedByInstancing' ],
        title: 'Instancing Benefit',
        panel: panelDrawCalls,
        format: function(value) {
            return '-' + value.toLocaleString();
        }
    }, {
        key: [ 'drawCalls', 'immediate' ],
        title: 'Immediate',
        panel: panelDrawCalls,
        format: function(value) {
            return value.toLocaleString();
        }
    }, {
        key: [ 'drawCalls', 'misc' ],
        title: 'Misc',
        panel: panelDrawCalls,
        format: function(value) {
            return value.toLocaleString();
        }
    }, {
        key: [ 'particles', 'updatesPerFrame' ],
        title: 'Updates',
        panel: panelParticles
    }, {
        key: [ 'particles', 'frameTime' ],
        title: 'Update Time',
        panel: panelParticles,
        format: function(value) {
            return value.toLocaleString();
        }
    }, {
        key: [ 'shaders', 'linked' ],
        title: 'Linked',
        panel: panelShaders,
        format: function(value) {
            return value.toLocaleString();
        }
    }, {
        key: [ 'shaders', 'vsCompiled' ],
        title: 'Compiled VS',
        panel: panelShaders,
        format: function(value) {
            return value.toLocaleString();
        }
    }, {
        key: [ 'shaders', 'fsCompiled' ],
        title: 'Compiled FS',
        panel: panelShaders,
        format: function(value) {
            return value.toLocaleString();
        }
    }, {
        key: [ 'shaders', 'materialShaders' ],
        title: 'Materials',
        panel: panelShaders,
        format: function(value) {
            return value.toLocaleString();
        }
    }, {
        key: [ 'shaders', 'compileTime' ],
        title: 'Compile Time',
        panel: panelShaders,
        format: function(value) {
            return value.toFixed(3);
        }
    }, {
        key: [ 'lightmapper', 'renderPasses' ],
        title: 'Render Passes',
        panel: panelLightmap,
        format: function(value) {
            return value.toLocaleString();
        }
    }, {
        key: [ 'lightmapper', 'lightmapCount' ],
        title: 'Textures',
        panel: panelLightmap,
        format: function(value) {
            return value.toLocaleString();
        }
    }, {
        key: [ 'lightmapper', 'shadersLinked' ],
        title: 'Shaders Linked',
        panel: panelLightmap,
        format: function(value) {
            return value.toLocaleString();
        }
    }, {
        key: [ 'lightmapper', 'totalRenderTime' ],
        title: 'Total Render Time',
        panel: panelLightmap,
        format: function(value) {
            return value.toFixed(3);
        }
    }, {
        key: [ 'lightmapper', 'forwardTime' ],
        title: 'Forward Time',
        panel: panelLightmap,
        format: function(value) {
            return value.toFixed(3);
        }
    }, {
        key: [ 'lightmapper', 'fboTime' ],
        title: 'FBO Time',
        panel: panelLightmap,
        format: function(value) {
            return value.toFixed(3);
        }
    }, {
        key: [ 'lightmapper', 'shadowMapTime' ],
        title: 'ShadowMap Time',
        panel: panelLightmap,
        format: function(value) {
            return value.toFixed(3);
        }
    }, {
        key: [ 'lightmapper', 'compileTime' ],
        title: 'Shader Compile Time',
        panel: panelLightmap,
        format: function(value) {
            return value.toFixed(3);
        }
    }, {
        key: [ 'vram', 'ib' ],
        title: 'Index Buffers',
        panel: panelVram,
        format: bytesToHuman
    }, {
        key: [ 'vram', 'vb' ],
        title: 'Vertex Buffers',
        panel: panelVram,
        format: bytesToHuman
    }, {
        key: [ 'vram', 'texShadow' ],
        title: 'Shadowmaps',
        panel: panelVram,
        format: bytesToHuman
    }, {
        key: [ 'vram', 'texLightmap' ],
        title: 'Lightmaps',
        panel: panelVram,
        format: bytesToHuman
    }, {
        key: [ 'vram', 'texAsset' ],
        title: 'Texture Assets',
        panel: panelVram,
        format: bytesToHuman
    }, {
        key: [ 'vram', 'tex' ],
        title: 'Textures Other',
        panel: panelVram,
        format: function(bytes) {
            return bytesToHuman(bytes - (app.stats.vram.texLightmap + app.stats.vram.texShadow + app.stats.vram.texAsset));
        }
    }, {
        key: [ 'vram', 'tex' ],
        title: 'Textures Total',
        panel: panelVram,
        format: bytesToHuman
    }, {
        key: [ 'vram', 'totalUsed' ],
        title: 'Total',
        panel: panelVram,
        format: bytesToHuman
    }]

    // create fields
    for(var i = 0; i < fields.length; i++) {
        fields[i].field = addField({
            title: fields[i].title || fields[i].key[1]
        });
        fields[i].panel.appendChild(fields[i].field);

        if (fields[i].custom)
            fieldsCustom[fields[i].custom] = fields[i].field;
    }

    // update frame fields
    app.on('frameEnd', function() {
        if (! enabled)
            return;

        for(var i = 0; i < fields.length; i++) {
            if (fields[i].ignore)
                continue;

            if (! app.stats.hasOwnProperty(fields[i].key[0]) || ! app.stats[fields[i].key[0]].hasOwnProperty(fields[i].key[1]))
                continue;

            var value = app.stats[fields[i].key[0]][fields[i].key[1]];

            if (fields[i].format)
                value = fields[i].format(value);

            fields[i].field.value = value;
        }
    });
});


/* launch/entities.js */
editor.once('load', function() {
    'use strict';

    var entities = new ObserverList({
        index: 'resource_id'
    });

    // on adding
    entities.on('add', function(obj) {
        editor.emit('entities:add', obj);
    });

    editor.method('entities:add', function (obj) {
        entities.add(obj);
    });

    // on removing
    entities.on('remove', function(obj) {
        editor.emit('entities:remove', obj);
    });

    editor.method('entities:remove', function (obj) {
        entities.remove(obj);
    });

    // remove all entities
    editor.method('entities:clear', function () {
        entities.clear();
    });

    // Get entity by resource id
    editor.method('entities:get', function (resourceId) {
        return entities.get(resourceId);
    });

    editor.once('scene:raw', function(data) {
        for(var key in data.entities) {
            entities.add(new Observer(data.entities[key]));
        }

        editor.emit('entities:load', data);
    });
});


/* launch/entities-sync.js */
editor.once('load', function() {
    'use strict';

    var syncPaths = [
        'name',
        'parent',
        'children',
        'position',
        'rotation',
        'scale',
        'enabled',
        'components'
    ];


    editor.on('entities:add', function(entity) {
        if (entity.sync)
            return;

        entity.sync = new ObserverSync({
            item: entity,
            prefix: [ 'entities', entity.get('resource_id') ],
            paths: syncPaths
        });
    });


    // server > client
    editor.on('realtime:op:entities', function(op) {
        var entity = null;
        if (op.p[1])
            entity = editor.call('entities:get', op.p[1]);

        if (op.p.length === 2) {
            if (op.hasOwnProperty('od')) {
                // delete entity
                if (entity) {
                    editor.call('entities:remove', entity);
                } else {
                    console.log('delete operation entity not found', op);
                }
            } else if (op.hasOwnProperty('oi')) {
                // new entity
                editor.call('entities:add', new Observer(op.oi));
            } else {
                console.log('unknown operation', op);
            }
        } else if (entity) {
            // write operation
            entity.sync.write(op);
        } else {
            console.log('unknown operation', op);
        }
    });
});


/* editor/components/components-schema.js */
editor.once('load', function() {
    'use strict';

    var projectSettings = editor.call('project:settings');

    var schema = {
        animation: {
            title: 'Animation',
            default: {
                enabled: true,
                assets: [ ],
                speed: 1,
                loop: true,
                activate: true
            }
        },

        light: {
            title: 'Light',
            default: {
                enabled: true,
                type: 'directional',
                isStatic: false,
                bake: false,
                affectDynamic: true,
                affectLightMapped: false,
                color: [ 1, 1, 1 ],
                intensity: 1,
                castShadows: false,
                shadowType: 0,
                shadowDistance: 16,
                shadowResolution: 1024,
                shadowBias: 0.04,
                normalOffsetBias: 0.04,
                vsmBlurMode: 1,
                vsmBlurSize: 11,
                vsmBias: 0.01,
                range: 8,
                falloffMode: 0,
                innerConeAngle: 40,
                outerConeAngle: 45,
                cookieAsset: null,
                cookieIntensity: 1.0,
                cookieFalloff: true,
                cookieChannel: 'rgb',
                cookieAngle: 0.0,
                cookieOffset: [ 0.0, 0.0 ],
                cookieScale: [ 1.0, 1.0 ]
            },
            types: {
                color: 'rgb',
                cookieOffset: 'vec2',
                cookieScale: 'vec2'
            }
        },

        audiolistener: {
            title: 'Audio Listener',
            default: {
                enabled: true
            }
        },

        audiosource: {
            title: 'Audio Source',
            default: {
                enabled: true,
                assets: [],
                volume: 1,
                pitch: 1,
                loop: false,
                activate: true,
                '3d': true,
                minDistance: 1,
                maxDistance: 10000,
                rollOffFactor: 1
            }
        },

        sound: {
            title: 'Sound',
            default: {
                enabled: true,
                volume: 1,
                pitch: 1,
                positional: true,
                refDistance: 1,
                maxDistance: 10000,
                rollOffFactor: 1,
                distanceModel: 'linear',
                slots: {
                    '1': {
                        name: 'Slot 1',
                        loop: false,
                        autoPlay: false,
                        overlap: false,
                        asset: null,
                        startTime: 0,
                        duration: null,
                        volume: 1,
                        pitch: 1
                    }
                }
            }
        },

        camera: {
            title: 'Camera',
            default: {
                enabled: true,
                clearColorBuffer: true,
                clearColor: [0.118, 0.118, 0.118, 1],
                clearDepthBuffer: true,
                projection: 0,
                fov: 45,
                frustumCulling: true,
                orthoHeight: 4,
                nearClip: 0.1,
                farClip: 1000,
                priority: 0,
                rect: [0, 0, 1, 1]
            },
            types: {
                clearColor: 'rgb',
                rect: 'vec4'
            }
        },

        collision: {
            title: 'Collision',
            default: {
                enabled: true,
                type: 'box',
                halfExtents: [0.5,  0.5, 0.5],
                radius: 0.5,
                axis: 1,
                height: 2,
                asset: null
            },
            types: {
                halfExtents: 'vec3'
            }
        },

        model: {
            title: 'Model',
            default: {
                enabled: true,
                isStatic: false,
                type: 'asset',
                asset: null,
                materialAsset: null,
                castShadows: true,
                castShadowsLightmap: true,
                receiveShadows: true,
                lightMapped: false,
                lightMapSizeMultiplier: 1.0
            }
        },

        particlesystem: {
            title: 'Particle System',
            default: {
                enabled: true,
                autoPlay: true,
                numParticles: 30,
                lifetime: 5,
                rate: 0.1,
                rate2: 0.1,
                startAngle: 0,
                startAngle2: 0,
                loop: true,
                preWarm: false,
                lighting: false,
                halfLambert: false,
                intensity: 1,
                depthWrite: false,
                depthSoftening: 0,
                sort: 0,
                blendType: 2,
                stretch: 0,
                alignToMotion: false,
                emitterShape: 0,
                emitterExtents: [0, 0, 0],
                emitterRadius: 0,
                initialVelocity: 0,
                animTilesX: 1,
                animTilesY: 1,
                animNumFrames: 1,
                animSpeed: 1,
                animLoop: true,
                wrap: false,
                wrapBounds: [0,0,0],
                colorMapAsset: null,
                normalMapAsset: null,
                mesh: null,
                localVelocityGraph: {
                    type: 1,
                    keys: [[0, 0], [0, 0], [0, 0]],
                    betweenCurves: false
                },
                localVelocityGraph2: {
                    type: 1,
                    keys: [[0, 0], [0, 0], [0, 0]]
                },
                velocityGraph: {
                    type: 1,
                    keys: [[0, -1], [0, -1], [0, -1]],
                    betweenCurves: true
                },
                velocityGraph2: {
                    type: 1,
                    keys: [[0, 1], [0, 1], [0, 1]]
                },
                rotationSpeedGraph: {
                    type: 1,
                    keys: [0, 0],
                    betweenCurves: false
                },
                rotationSpeedGraph2: {
                    type: 1,
                    keys: [0, 0]
                },
                scaleGraph: {
                    type: 1,
                    keys: [0, 0.1],
                    betweenCurves: false
                },
                scaleGraph2: {
                    type: 1,
                    keys: [0, 0.1]
                },
                colorGraph: {
                    type: 1,
                    keys: [[0, 1], [0, 1], [0, 1]],
                    betweenCurves: false
                },
                alphaGraph: {
                    type: 1,
                    keys: [0, 1],
                    betweenCurves: false
                },
                alphaGraph2: {
                    type: 1,
                    keys: [0, 1]
                }
            },
            types: {
                emitterExtents: 'vec3',
                localVelocityGraph: 'curveset',
                localVelocityGraph2: 'curveset',
                velocityGraph: 'curveset',
                velocityGraph2: 'curveset',
                rotationSpeedGraph: 'curve',
                rotationSpeedGraph2: 'curve',
                scaleGraph: 'curve',
                scaleGraph2: 'curve',
                colorGraph: 'curveset',
                alphaGraph: 'curve',
                alphaGraph2: 'curve'
            }
        },

        rigidbody: {
            title: 'Rigid Body',
            default: {
                enabled: true,
                type: 'static',
                mass: 1,
                linearDamping: 0,
                angularDamping: 0,
                linearFactor: [1, 1, 1],
                angularFactor: [1, 1, 1],
                friction: 0.5,
                restitution: 0.5
            },
            types: {
                linearFactor: 'vec3',
                angularFactor: 'vec3'
            }
        },

        script: {
            title: 'Script',
            default: {
                enabled: true,
                order: [ ],
                scripts: null
            }
        },

        zone: {
            title: 'Zone',
            default: {
                enabled: true,
                size: [ 1, 1, 1 ]
            }
        },

        screen: {
            title: 'Screen',
            default: {
                enabled: true,
                resolution: [640, 320],
                referenceResolution: [640, 320],
                screenSpace: true,
                scaleMode: 'blend',
                scaleBlend: 0.5
            },
            types: {
                resolution: 'vec2',
                referenceResolution: 'vec2'
            }
        },

        element: {
            title: 'Element',
            default: {
                enabled: true,
                type: 'text',
                anchor: [0.5, 0.5, 0.5, 0.5],
                pivot: [0.5, 0.5],
                text: '',
                fontAsset: null,
                fontSize: 32,
                lineHeight: 32,
                spacing: 1,
                color: [1, 1, 1],
                opacity: 1,
                textureAsset: null,
                width: 32,
                height: 32,
                rect: [0, 0, 1, 1],
                materialAsset: null
            },
            types: {
                anchor: 'vec4',
                pivot: 'vec2',
                color: 'rgb',
                rect: 'vec4'
            }
        }
    };

    // Paths in components that represent
    // assets. Used when copy pasting. Does not include
    // asset script attributes
    var assetPaths = [
        'components.animation.assets',
        'components.light.cookieAsset',
        'components.model.asset',
        'components.model.materialAsset',
        'components.audiosource.assets',
        'components.sound.slots.*.asset',
        'components.collision.asset',
        'components.particlesystem.colorMapAsset',
        'components.particlesystem.normalMapAsset',
        'components.particlesystem.mesh',
        'components.element.fontAsset',
        'components.element.textureAsset',
        'components.element.materialAsset'
    ];

    editor.method('components:assetPaths', function () {
        return assetPaths;
    });

    if (editor.call('project:settings').get('use_legacy_scripts')) {
        schema.script.default.scripts = [ ];
        delete schema.script.default.order;
    } else {
        schema.script.default.scripts = { };
    }

    var list = Object.keys(schema).sort(function(a, b) {
        if (a > b) {
            return 1;
        } else if (a < b) {
            return -1;
        } else {
            return 0;
        }
    });

    editor.method('components:convertValue', function (component, property, value) {
        var result = value;

        if (value) {
            var data = schema[component];
            if (data && data.types) {
                var type = data.types[property];
                switch (type) {
                    case 'rgb':
                        result = new pc.Color(value[0], value[1], value[2]);
                        break;
                    case 'rgba':
                        result = new pc.Color(value[0], value[1], value[2], value[3]);
                        break;
                    case 'vec2':
                        result = new pc.Vec2(value[0], value[1]);
                        break;
                    case 'vec3':
                        result = new pc.Vec3(value[0], value[1], value[2]);
                        break;
                    case 'vec4':
                        result = new pc.Vec4(value[0], value[1], value[2], value[3]);
                        break;
                    case 'curveset':
                        result = new pc.CurveSet(value.keys);
                        result.type = value.type;
                        break;
                    case 'curve':
                        result = new pc.Curve(value.keys);
                        result.type = value.type;
                        break;
                }
            }
        }

        return result;
    });

    editor.method('components:list', function () {
        var result = list.slice(0);
        if (! config.self.superUser && !config.self.uiTester) {
            result.splice(result.indexOf('screen'), 1);
            result.splice(result.indexOf('element'), 1);
        }
        return result;
    });

    editor.method('components:schema', function () {
        return schema;
    });

    editor.method('components:getDefault', function (component) {
        var result = utils.deepCopy(schema[component].default);

        // default resolution to project resolution for screen components
        if (component === 'screen') {
            result.resolution[0] = projectSettings.get('width');
            result.resolution[1] = projectSettings.get('height');

            result.referenceResolution[0] = result.resolution[0];
            result.referenceResolution[1] = result.resolution[1];
        }

        return result;
    });

});


/* launch/viewport-binding-entities.js */
editor.once('load', function() {
    'use strict';

    var app = editor.call('viewport:app');

    var initialEntitiesLoaded = false;

    // entities awaiting parent
    var awaitingParent = { };

    // queue for hierarchy resync
    var awaitingResyncHierarchy = false;

    var resyncHierarchy = function() {
        awaitingResyncHierarchy = false;

        // sync hierarchy
        app.root.syncHierarchy();
    };

    var createEntity = function (obj) {
        var entity = new pc.Entity();

        entity.setName(obj.get('name'));
        entity.setGuid(obj.get('resource_id'));
        entity.setLocalPosition(obj.get('position.0'), obj.get('position.1'), obj.get('position.2'));
        entity.setLocalEulerAngles(obj.get('rotation.0'), obj.get('rotation.1'), obj.get('rotation.2'));
        entity.setLocalScale(obj.get('scale.0'), obj.get('scale.1'), obj.get('scale.2'));
        entity._enabled = obj.has('enabled') ? obj.get('enabled') : true;

        if (obj.has('labels')) {
            obj.get('labels').forEach(function (label) {
                entity.addLabel(label);
            });
        }

        entity.template = obj.get('template');

        return entity;
    };

    var processEntity = function (obj) {
        // create entity
        var entity = createEntity(obj);

        // add components
        var components = obj.json().components;
        for(var key in components)
            app.systems[key].addComponent(entity, components[key]);

        // parenting
        if (! obj.get('parent')) {
            // root
            app.root.addChild(entity);

        } else {
            // get parent
            var parent = editor.call('entities:get', obj.get('parent'));
            if (parent) {
                parent = app.root.findByGuid(parent.get('resource_id'));
            }

            if (! parent) {
                // if parent not available, then await
                if (! awaitingParent[obj.get('parent')])
                    awaitingParent[obj.get('parent')] = [ ];

                // add to awaiting children
                awaitingParent[obj.get('parent')].push(obj);
            } else {
                // if parent available, addChild
                parent.addChild(entity);
            }
        }

        // check if there are awaiting children
        if (awaitingParent[obj.get('resource_id')]) {
            // add all awaiting children
            for(var i = 0; i < awaitingParent[obj.get('resource_id')].length; i++) {
                var awaiting = awaitingParent[obj.get('resource_id')][i];
                //原来是这个，有问题。
                entity.addChild(app.root.getByGuid(awaiting.get('resource_id')));

                //var awaitEntity=createEntity(awaiting);
                //entity.addChild(awaitEntity);
            }

            // delete awaiting queue
            delete awaitingParent[obj.get('resource_id')];
        }

        // queue resync hierarchy
        // done on timeout to allow bulk entity creation
        // without sync after each entity
        if (! awaitingResyncHierarchy) {
            awaitingResyncHierarchy = true;
            setTimeout(resyncHierarchy, 0);
        }

        return entity;
    };

    editor.on('entities:add', function (obj) {
       
        var sceneLoading = editor.call("isLoadingScene");

        //console.log([ app.root.findByGuid(obj.get('resource_id')) ,sceneLoading])
        if (! app.root.findByGuid(obj.get('resource_id')) && !sceneLoading) {
            // create entity if it does not exist and all initial entities have loaded
             
            processEntity(obj);
        }
        
        // subscribe to changes
        obj.on('*:set', function(path, value) {
            var entity = app.root.findByGuid(obj.get('resource_id'));
            if (! entity)
                return;

            if (path === 'name') {
                entity.setName(obj.get('name'));

            } else if (path.startsWith('position')) {
                resetPhysics(entity);

            } else if (path.startsWith('rotation')) {
                resetPhysics(entity);

            } else if (path.startsWith('scale')) {
                resetPhysics(entity);

            } else if (path.startsWith('enabled')) {
                entity.enabled = obj.get('enabled');

            } else if (path.startsWith('parent')) {
                var parent = editor.call('entities:get', obj.get('parent'));
                if (parent && parent.entity)
                    entity.reparent(parent.entity);
            } else if (path === 'components.model.type' && value === 'asset') {
                // WORKAROUND
                // entity deletes asset when switching to primitive, restore it
                // do this in a timeout to allow the model type to change first
                setTimeout(function () {
                    var assetId = obj.get('components.model.asset');
                    if (assetId)
                        entity.model.asset = assetId;
                });
            }
        });

        var resetPhysics = function (entity) {
            var pos = obj.get('position');
            var rot = obj.get('rotation');
            var scale = obj.get('scale');

            entity.setLocalPosition(pos[0], pos[1], pos[2]);
            entity.setLocalEulerAngles(rot[0], rot[1], rot[2]);
            entity.setLocalScale(scale[0], scale[1], scale[2]);

            if (entity.enabled) {
                if (entity.rigidbody && entity.rigidbody.enabled) {
                    entity.rigidbody.syncEntityToBody();

                    // Reset velocities
                    entity.rigidbody.linearVelocity = pc.Vec3.ZERO;
                    entity.rigidbody.angularVelocity = pc.Vec3.ZERO;
                }
            }
        };

        var reparent = function (child, index) {
            var childEntity = editor.call('entities:get', child);
            if (!childEntity)
                return;

            childEntity = app.root.findByGuid(childEntity.get('resource_id'));
            var parentEntity = app.root.findByGuid(obj.get('resource_id'));

            if (childEntity && parentEntity) {
                childEntity.reparent(parentEntity, index);
            }
        };

        obj.on('children:insert', reparent);
        obj.on('children:move', reparent);
    });

    editor.on('entities:remove', function (obj) {
        var entity = app.root.findByGuid(obj.get('resource_id'));
        if (entity) {
            entity.destroy();
            editor.call('viewport:render');
        }
    });

    editor.on('entities:load', function () {
        initialEntitiesLoaded = true;
    });
});


/* launch/viewport-binding-components.js */
editor.once('load', function() {
    'use strict';

    var app = editor.call('viewport:app');

    // converts the data to runtime types
    var runtimeComponentData = function (component, data) {
        var result = {};
        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                result[key] = editor.call('components:convertValue', component, key, data[key]);
            }
        }

        return result;
    };

    editor.on('entities:add', function (obj) {
        // subscribe to changes
        obj.on('*:set', function(path, value) {
            if (obj._silent || ! path.startsWith('components'))
                return;

            var entity = app.root.findByGuid(obj.get('resource_id'));
            if (! entity)
                return;

            var parts = path.split('.');
            var component = parts[1];
            var property = parts[2];

            if (!entity[component]) {
                if (!property) {
                    // add component
                    var data = runtimeComponentData(component, value);
                    app.systems[component].addComponent(entity, data);

                    // render
                    editor.call('viewport:render');
                }
            } else if (property) {
                // edit component property
                if (component === 'script' && property === 'scripts' && !editor.call('project:settings').get('use_legacy_scripts')) {
                    if (parts.length <= 3)
                        return;

                    var script = entity.script[parts[3]];

                    if (parts.length === 4) {
                        // new script
                        var data = obj.get('components.script.scripts.' + parts[3]);
                        entity.script.create(parts[3], data);
                    } else if (script && parts.length === 5 && parts[4] === 'enabled') {
                        // enabled
                        script.enabled = value;
                    } else if (script && parts.length === 6 && parts[4] === 'attributes' && ! pc.createScript.reservedAttributes[parts[5]]) {
                        // set attribute
                        script[parts[5]] = value;
                        // TODO scripts2
                        // check if attribute is new
                    } else if (script && parts.length > 6 && parts[4] === 'attributes' && ! pc.createScript.reservedAttributes[parts[5]]) {
                        // update attribute
                        script[parts[5]] = obj.get('components.script.scripts.' + parts[3] + '.attributes.' + parts[5]);
                    }
                } else {
                    value = obj.get('components.' + component + '.' + property);
                    entity[component][property] = editor.call('components:convertValue', component, property, value);
                }
            }
        });


        obj.on('*:unset', function (path) {
            if (obj._silent || ! path.startsWith('components'))
                return;

            var entity = app.root.findByGuid(obj.get('resource_id'));
            if (! entity) return;

            var parts = path.split('.');
            var component = parts[1];
            var property = parts[2];

            if (property) {
                if (component === 'script' && property === 'scripts' && ! editor.call('project:settings').get('use_legacy_scripts')) {
                    if (! entity.script || parts.length <= 3)
                        return;

                    var script = entity.script[parts[3]];
                    if (! script)
                        return;

                    if (parts.length === 4) {
                        // remove script
                        entity.script.destroy(parts[3]);
                    } else if (parts.length === 6 && parts[4] === 'attributes' && ! pc.createScript.reservedAttributes[parts[5]]) {
                        // unset attribute
                        delete script[parts[5]];
                        delete script.__attributes[parts[5]];
                    } else if (parts.length > 6 && parts[4] === 'attributes' && ! pc.createScript.reservedAttributes[parts[5]]) {
                        // update attribute
                        script[parts[5]] = obj.get('components.script.scripts.' + parts[3] + '.attributes.' + parts[5]);
                    }
                } else {
                    // edit component property
                    var value = obj.get('components.' + component + '.' + property);
                    entity[component][property] = editor.call('components:convertValue', component, property, value);
                }
            } else if (entity[component]) {
                // remove component
                app.systems[component].removeComponent(entity);
            }
        });

        var setComponentProperty = function (path, value, ind) {
            if (obj._silent || ! path.startsWith('components'))
                return;

            var entity = app.root.findByGuid(obj.get('resource_id'));
            if (! entity) return;

            var parts = path.split('.');
            var component = parts[1];
            var property = parts[2];

            if (property) {
                if (component === 'script') {
                    if (property === 'order') {
                        // update script order
                        entity.script.move(value, ind);
                    } else if (property === 'scripts') {
                        if (! entity.script || parts.length <= 3)
                            return;

                        var script = entity.script[parts[3]];
                        if (! script)
                            return;

                        if (parts.length > 6 && parts[4] === 'attributes' && ! pc.createScript.reservedAttributes[parts[5]]) {
                            // update attribute
                            script[parts[5]] = obj.get('components.script.scripts.' + parts[3] + '.attributes.' + parts[5]);
                        }
                    }
                } else {
                    // edit component property
                    value = obj.get('components.' + component + '.' + property);
                    entity[component][property] = editor.call('components:convertValue', component, property, value);
                }
            }
        };

        obj.on('*:insert', setComponentProperty);
        obj.on('*:remove', setComponentProperty);
        obj.on('*:move', setComponentProperty);
    });
});


/* launch/viewport-binding-assets.js */
editor.once('load', function() {
    'use strict';

    var app = editor.call('viewport:app');

    var attachSetHandler = function (asset) {
        // do only for target assets
        if (asset.get('source'))
            return;

        var timeout;
        var updatedFields = { };

        var onChange = function(path, value) {
            var realtimeAsset = app.assets.get(asset.get('id'));
            var parts = path.split('.');

            updatedFields[parts[0]] = true;
            if (timeout)
                clearTimeout(timeout);

            // do the update in a timeout to avoid rapid
            // updates to the same fields
            timeout = setTimeout(function () {
                for (var key in updatedFields) {
                    var raw = asset.get(key);

                    // this will trigger the 'update' event on the asset in the engine
                    // handling all resource loading automatically
                    realtimeAsset[key] = raw;
                }

                timeout = null;
            });
        };

        // attach update handler
        asset.on('*:set', onChange);
        asset.on('*:unset', onChange);

        // tags add
        asset.on('tags:insert', function(tag) {
            app.assets.get(asset.get('id')).tags.add(tag);
        });
        // tags remove
        asset.on('tags:remove', function(tag) {
            app.assets.get(asset.get('id')).tags.remove(tag);
        });
    };

    // after all initial assets are loaded...
    editor.on('assets:load', function () {
        var assets = editor.call('assets:list');
        assets.forEach(attachSetHandler);

        // add assets to asset registry
        editor.on('assets:add', function (asset) {

            console.error(asset)
            // do only for target assets
            if (asset.get('source'))
                return;

            // raw json data
            var assetJson = asset.json();

            // engine data
            var data = {
                id: parseInt(assetJson.id, 10),
                name: assetJson.name,
                tags: assetJson.tags,
                file: assetJson.file ? {
                    filename: assetJson.file.filename,
                    url: assetJson.file.url,
                    hash: assetJson.file.hash,
                    size: assetJson.file.size,
                    variants: assetJson.file.variants || null
                } : null,
                data: assetJson.data,
                type: assetJson.type
            };

            // create and add to registry
            var newAsset = new pc.Asset(data.name, data.type, data.file, data.data);
            newAsset.id = parseInt(assetJson.id, 10);
            app.assets.add(newAsset);
            // tags
            newAsset.tags.add(data.tags);

            attachSetHandler(asset);
        });

        // remove assets from asset registry
        editor.on('assets:remove', function (asset) {
            var realtimeAsset = app.assets.get(asset.get('id'));
            if (realtimeAsset)
                app.assets.remove(realtimeAsset);
        });
    });
});


/* launch/viewport-binding-scene.js */
editor.once('load', function() {
    'use strict';

    editor.on('sceneSettings:load', function (sceneSettings) {
        var app = editor.call('viewport:app');
        var updating;

        // queue settings apply
        var queueApplySettings = function() {
            if (updating)
                return;

            updating = true;

            setTimeout(applySettings, 1000 / 30);
        };

        // apply settings
        var applySettings = function() {
            updating = false;

            app.applySceneSettings(sceneSettings.json());
        };

        // on settings change
        sceneSettings.on('*:set', queueApplySettings);

        // initialize
        queueApplySettings();
    });

});


/* launch/viewport-scene-handler.js */
editor.once('load', function() {
    'use strict';

    var app = editor.call('viewport:app');
    app.loader.removeHandler("scene");
    app.loader.removeHandler("hierarchy");
    app.loader.removeHandler("scenesettings");

    var SharedSceneHandler = function (app, handler) {
        this._app = app;
        this._handler = handler;
    };

    SharedSceneHandler.prototype = {
        load: function (url, callback, settingsOnly) {
            var id = parseInt(url.replace(".json", ""));

            if (typeof(id) === "number") {
                editor.call('loadScene', id, function (err, scene) {
                    callback(err, scene);
                }, settingsOnly);
            } else {
                this._handler.load(url, callback);
            }
        },

        open: function (url, data) {
            return this._handler.open(url, data);
        },

        patch: function (asset, assets) {
            return this._handler.patch(asset, assets);
        }
    };
    app.loader.addHandler("scene", new SharedSceneHandler(app, new pc.SceneHandler(app)));


    var SharedHierarchyHandler = function (app, handler) {
        this._app = app;
        this._handler = handler;
    };

    SharedHierarchyHandler.prototype = {
        load: function (url, callback, settingsOnly) {
            var id = parseInt(url.replace("/api/", "").replace(".json", ""));
            if (typeof(id) === "number") {
                editor.call('loadScene', id, function (err, scene) {
                    callback(err, scene);
                }, settingsOnly);
            } else {
                // callback("Invalid URL: can't extract scene id.")
                this._handler.load(url, callback);
            }
        },

        open: function (url, data) {
            return this._handler.open(url, data);
        },

        patch: function (asset, assets) {
            return this._handler.patch(asset, assets);
        }
    };
    app.loader.addHandler("hierarchy", new SharedHierarchyHandler(app, new pc.HierarchyHandler(app)));

    var SharedSceneSettingsHandler = function (app, handler) {
        this._app = app;
        this._handler = handler;
    };

    SharedSceneSettingsHandler.prototype = {
        load: function (url, callback) {
            var id = parseInt(url.replace(".json", ""));
            if (typeof(id) === "number") {
                editor.call('loadScene', id, function (err, scene) {
                    callback(err, scene);
                }, true);
            } else {
                // callback("Invalid URL: can't extract scene id.")
                this._handler.load(url, callback);
            }
        },

        open: function (url, data) {
            return this._handler.open(url, data);
        },

        patch: function (asset, assets) {
            return this._handler.patch(asset, assets);
        }
    };
    app.loader.addHandler("scenesettings", new SharedSceneSettingsHandler(app, new pc.SceneSettingsHandler(app)));
});


/* launch/viewport-connection.js */
editor.once('load', function() {
    'use strict';

    var timeout;

    var icon = document.createElement('img');
    icon.classList.add('connecting');
    icon.src = 'https://s3-eu-west-1.amazonaws.com/static.playcanvas.com/platform/images/loader_transparent.gif';
    icon.width=32;
    icon.height=32;

    var hidden = true;

    editor.on('realtime:connected', function () {
        if (!hidden) {
            document.body.removeChild(icon);
            hidden = true;
        }
    });

    editor.on('realtime:disconnected', function () {
        if (hidden) {
            document.body.appendChild(icon);
            hidden = false;
        }
    });
});


/* launch/assets.js */
editor.once('load', function() {
    'use strict';

    var assets = new ObserverList({
        index: 'id'
    });

    // list assets
    editor.method('assets:list', function () {
        return assets.array();
    });

    // allow adding assets
    editor.method('assets:add', function(asset) {
        assets.add(asset);
    });

    // allow removing assets
    editor.method('assets:remove', function(asset) {
        assets.remove(asset);
        asset.destroy();
    });

    // remove all assets
    editor.method('assets:clear', function () {
        assets.clear();
    });

    // get asset by id
    editor.method('assets:get', function(id) {
        return assets.get(id);
    });

    // find assets by function
    editor.method('assets:find', function(fn) {
        return assets.find(fn);
    });

    // find one asset by function
    editor.method('assets:findOne', function(fn) {
        return assets.findOne(fn);
    });

    // publish added asset
    assets.on('add', function(asset) {
        editor.emit('assets:add[' + asset.get('id') + ']', asset);
        editor.emit('assets:add', asset);
    });

    // publish remove asset
    assets.on('remove', function(asset) {
        editor.emit('assets:remove', asset);
    });
});


/* launch/assets-sync.js */
editor.once('load', function() {
    'use strict';

    var app = editor.call('viewport:app');
    var settings = editor.call('project:settings');
    var docs = { };

    editor.method('loadAsset', function (id, callback) {
        var connection = editor.call('realtime:connection');

        var doc = connection.get('assets', '' + id);

        docs[id] = doc;

        // error
        doc.on('error', function (err) {
            if (connection.state === 'connected') {
                console.log(err);
                return;
            }

            editor.emit('realtime:assets:error', err);
        });

        // ready to sync
        doc.on('load', function () {
            var assetData = doc.data;
            if (! assetData) {
                console.error('Could not load asset: ' + id);
                doc.destroy();
                return callback && callback();
            }

            // notify of operations
            doc.on('op', function (ops, local) {
                if (local) return;

                for (var i = 0; i < ops.length; i++) {
                    editor.emit('realtime:op:assets', ops[i], id);
                }
            });

            // notify of asset load
            assetData.id = id;



            if (assetData.file) {
                assetData.file.url = getFileUrl(assetData.path, assetData.id, assetData.revision, assetData.file.filename);
 
                if (assetData.file.variants) {
                    for(var key in assetData.file.variants) {
                        assetData.file.variants[key].url = getFileUrl(assetData.path, assetData.id, assetData.revision, assetData.file.variants[key].filename);
                    }
                }
            }
             
            var asset = editor.call('assets:get', id);

           
            // asset can exist if we are reconnecting to c3
            var assetExists = !!asset;

            if (!assetExists) {
                asset = new Observer(assetData);
                editor.call('assets:add', asset);

                var _asset = asset.asset = new pc.Asset(assetData.name, assetData.type, assetData.file, assetData.data);
                _asset.id = parseInt(assetData.id);
                _asset.preload = assetData.preload ? assetData.preload : false;

                // tags
                _asset.tags.add(assetData['tags']);

                if (asset.get('type') !== 'script')
                    app.assets.add(_asset);
            } else {
                for (var key in assetData)
                    asset.set(key, assetData[key]);
            }

            if (callback)
                callback(asset);
        });

        // subscribe for realtime events
        doc.subscribe();
    });

    var onLoad = function(data) {
        editor.call('assets:progress', .5);

        var count = 0;
        var scripts = { };

        var legacyScripts = settings.get('use_legacy_scripts');

        var loadScripts = function() {
            var order = settings.get('scripts');

            for(var i = 0; i < order.length; i++) {
                if (! scripts[order[i]])
                    continue;

                app.assets.add(scripts[order[i]].asset);
            }
        };

        var load = function (id) {
            editor.call('loadAsset', id, function (asset) {
                count++;
                editor.call('assets:progress', (count / data.length) * .5 + .5);

                if (! legacyScripts && asset && asset.get('type') === 'script')
                    scripts[asset.get('id')] = asset;

                if (count >= data.length) {
                    if (! legacyScripts)
                        loadScripts();

                    editor.call('assets:progress', 1);
                    editor.emit('assets:load');
                }
            });
        };

        if (data.length) {

            var connection = editor.call('realtime:connection');

            // do bulk subsribe in batches of 'batchSize' assets
            var batchSize = 256;
            var startBatch = 0;
            var total = data.length;

            while (startBatch < total) {
                // start bulk subscribe
                connection.startBulk();
                for(var i = startBatch; i < startBatch + batchSize && i < total; i++) {
                    load(data[i].id);
                }
                // end bulk subscribe and send message to server
                connection.endBulk();

                startBatch += batchSize;
            }
        } else {
            editor.call('assets:progress', 1);
            editor.emit('assets:load');
        }
    };

    // load all assets
    editor.on('realtime:authenticated', function() {

         
        Ajax({
            url: '{{url.api}}/projects/{{project.id}}/assets?view=launcher',
            auth: true
        })
        .on('load', function(status, data) {
            onLoad(data);
        })
        .on('progress', function(progress) {
            editor.call('assets:progress', .1 + progress * .4);
        })
        .on('error', function(status, evt) {
            console.log(status, evt);
        });
    });

    editor.call('assets:progress', .1);

    editor.on('assets:remove', function (asset) {
        var id = asset.get('id');
        if (docs[id]) {
            docs[id].destroy();
            delete docs[id];
        }
    });

    var getFileUrl = function (folders, id, revision, filename) {
        var path = '';
        for(var i = 0; i < folders.length; i++) {
            var folder = editor.call('assets:get', folders[i]);
            if (folder) {
                path += encodeURIComponent(folder.get('name')) + '/';
            } else {
                path += 'unknown/';
            }
        }
        return '/assets/files/' + path + encodeURIComponent(filename) + '?id=' + id;
    };

    // hook sync to new assets
    editor.on('assets:add', function(asset) {
        if (asset.sync)
            return;

        asset.sync = new ObserverSync({
            item: asset
        });

        var setting = false;

        asset.on('*:set', function(path, value) {
            if (setting || ! path.startsWith('file') || path.endsWith('.url') || ! asset.get('file'))
                return;

            setting = true;

            var parts = path.split('.');

            if ((parts.length === 1 || parts.length === 2) && parts[1] !== 'variants') {
                asset.set('file.url', getFileUrl(asset.get('path'), asset.get('id'), asset.get('revision'), asset.get('file.filename')));
            } else if (parts.length >= 3 && parts[1] === 'variants') {
                var format = parts[2];
                asset.set('file.variants.' + format + '.url', getFileUrl(asset.get('path'), asset.get('id'), asset.get('revision'), asset.get('file.variants.' + format + '.filename')));
            }

            setting = false;
        });
    });

    // server > client
    editor.on('realtime:op:assets', function(op, id) {
        var asset = editor.call('assets:get', id);
        if (asset) {
            asset.sync.write(op);
        } else {
            console.error('realtime operation on missing asset: ' + op.p[1]);
        }
    });
});


/* launch/assets-messenger.js */
editor.once('load', function() {
    'use strict';

    var validRuntimeAssets = {
        'material': 1, 'model': 1, 'cubemap': 1, 'text': 1, 'json': 1, 'html': 1, 'css': 1, 'script': 1
    };

    var create = function(data) {
        var assetId = null;

        if (data.asset.source || data.asset.status !== 'complete' && ! validRuntimeAssets.hasOwnProperty(data.asset.type))
            return;

        assetId = data.asset.id;
        if (! assetId)
            return;

        editor.call('loadAsset', assetId);
    };

    // create or update
    editor.on('messenger:asset.new', create);

    // remove
    editor.on('messenger:asset.delete', function(data) {
        var asset = editor.call('assets:get', data.asset.id);

        if (! asset)
            return;

        editor.call('assets:remove', asset);
    });
});


/* launch/scene-settings.js */
editor.once('load', function() {
    'use strict';

    var sceneSettings = new Observer();

    editor.once('scene:raw', function(data) {
        sceneSettings.patch(data.settings);

        editor.emit("sceneSettings:load", sceneSettings);
    });

    editor.method('sceneSettings', function () {
        return sceneSettings;
    });
});


/* launch/scene-settings-sync.js */
editor.once('load', function() {
    'use strict';

    editor.on('sceneSettings:load', function(settings) {
        settings.sync = new ObserverSync({
            item: settings,
            prefix: [ 'settings' ]
        });

        // client > server
        settings.sync.on('op', function(op) {
            editor.call('realtime:op', op);
        });

        // server > client
        editor.on('realtime:op:settings', function(op) {
            settings.sync.write(op);
        });
    });
});


/* launch/sourcefiles.js */
editor.once('load', function() {
    'use strict';

    if (! editor.call('project:settings').get('use_legacy_scripts'))
        return;


    var onLoad = function (data) {
        var i = 0;
        var l = data.result.length;

        var filenames = data.result.map(function (item) {
            return item.filename;
        });

        editor.emit("sourcefiles:load", filenames);
    };

    // load scripts
    Ajax({
        url: '{{url.home}}{{project.repositoryUrl}}',
        auth: true
    })
    .on('load', function(status, data) {
        onLoad(data);
    })
    .on('error', function(status, evt) {
        console.log(status, evt);
        editor.emit("sourcefiles:load", []);
    });
});


/* launch/load.js */
editor.once('load', function() {
    'use strict';

    var auth = false;
    var socket, connection;
    var data;
    var reconnectAttempts = 0;
    var reconnectInterval = 1;

    editor.method('realtime:connection', function () {
        return connection;
    });

    var connect = function () {
        if (reconnectAttempts > 8) {
            editor.emit('realtime:cannotConnect');
            return;
        }

        reconnectAttempts++;
        editor.emit('realtime:connecting', reconnectAttempts);

        var sharejsMessage = connection.socket.onmessage;

        connection.socket.onmessage = function(msg) {
            try {
                if (msg.data.startsWith('auth')) {
                    if (!auth) {
                        auth = true;
                        data = JSON.parse(msg.data.slice(4));

                        editor.emit('realtime:authenticated');
                    }
                } else if (! msg.data.startsWith('permissions') && ! msg.data.startsWith('chat') && ! msg.data.startsWith('selection') && ! msg.data.startsWith('whoisonline') && ! msg.data.startsWith('fs:')) {
                    sharejsMessage(msg);
                }
            } catch (e) {
                console.error(e);
            }

        };

        connection.on('connected', function() {
            reconnectAttempts = 0;
            reconnectInterval = 1;

            this.socket.send('auth' + JSON.stringify({
                accessToken: config.accessToken,
                timeout: false
            }));

            editor.emit('realtime:connected');
        });

        connection.on('error', function(msg) {
            editor.emit('realtime:error', msg);
        });

        var onConnectionClosed = connection.socket.onclose;
        connection.socket.onclose = function (reason) {
            auth = false;

            editor.emit('realtime:disconnected', reason);
            onConnectionClosed(reason);

            // try to reconnect after a while
            editor.emit('realtime:nextAttempt', reconnectInterval);

            if (editor.call('visibility')) {
                setTimeout(reconnect, reconnectInterval * 1000);
            } else {
                editor.once('visible', reconnect);
            }

            reconnectInterval++;
        };
    };

    var reconnect = function () {
        // create new socket...
        socket = new WebSocket(config.url.realtime.http);
        // ... and new sharejs connection
        connection = new sharedb.Connection(socket);
        // connect again
        connect();
    };

    if (editor.call('visibility')) {
        reconnect();
    } else {
        editor.once('visible', reconnect);
    }
});


/* launch/scene-loading.js */
editor.once('load', function() {
    'use strict';

    // cache
    var loaded = {};
    var isLoading = false;
    var loadScene = function(id, callback, settingsOnly) {
        if (loaded[id]) {
            if (callback)
                callback(null, loaded[id].data);

            return;
        }

        isLoading = true;

        var connection = editor.call('realtime:connection');
        var scene = connection.get('scenes', '' + id);

        // error
        scene.on('error', function(err) {
            if (callback)
                callback(new Error(err));
        });

        // ready to sync
        scene.on('load', function() {
            // cache loaded scene for any subsequent load requests
            loaded[id] = scene;

            // notify of operations
            scene.on('op', function(ops, local) {
                if (local)
                    return;

                for (var i = 0; i < ops.length; i++) {
                    var op = ops[i];

                    // console.log('in: [ ' + Object.keys(op).filter(function(i) { return i !== 'p' }).join(', ') + ' ]', op.p.join('.'));

                    if (op.p[0]) {
                        editor.emit('realtime:op:' + op.p[0], op);
                    }
                }
            });

            // notify of scene load
            var snapshot = scene.data;
             // todo
             //isLoading = false;//??
             //console.log(snapshot)
            if (settingsOnly !== true) {
                editor.emit('scene:raw', snapshot);
            }
            if (callback) {
                callback(null, snapshot);
            }
             

            isLoading = false;
        });

        // subscribe for realtime events
        scene.subscribe();
    };

    editor.method('loadScene', loadScene);
    editor.method('isLoadingScene', function () {
        return isLoading;
    });

    editor.on('realtime:authenticated', function () {
        var startedLoading = false;

        // if we are reconnecting try to reload
        // all scenes that we've already loaded
        for (var id in loaded) {
            startedLoading = true;
            loaded[id].destroy();
            delete loaded[id];

            editor.call('loadScene', id);
        }

        // if no scenes have been loaded at
        // all then we are initializing
        // for the first time so load the main scene
        if (! startedLoading) {
            editor.call('loadScene', config.scene.id);
        }
    });
});