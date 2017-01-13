"use strict";

let _ = require("lodash")
const utils = require('utility');
let nunjucks = require("nunjucks");
module.exports = function (backend, config, req, res, next) {

    var data = req.body
    data.data=JSON.parse(data.data)
    var connection = backend.connect();
    let model = backend.createModel()

    let uid = model.id()


    var assets = connection.get('assets', "" + uid);


    let obj = {
        "scope": {
            "type": "project",
            "id": data.project
        },
        "user_id": 10695,
        "source_asset_id": null,
        "source": false,
        "tags": [],

        "revision": 1,
        "preload": true,
        "meta": null,
        "data": {
            "scripts": {},
            "loading": false
        },

        "file": {
            "filename": data.filename,
            "size": 1,
            "hash": utils.md5(uid)
        },
        "region": "eu-west-1",
        "path": [],
        "task": null,
        "project": data.project,
        "name": "mmmm.js",
        "type": "script",
        "filename": "mmmm.js"
    }
    let content = "\n"


    let callback = function () {
        "use strict";
        // res.send(doc.data)


        if (assets.data.type == 'script') {

            content = writeJs(assets.data.name)
        }

        if (assets.data.type == 'json') {

            content = "{ }"
        }
        createDocument();

        res.json({"asset": {"id": uid}})

    }
    assets.fetch(function (err) {
        if (err) throw err;
        if (assets.type === null) {
            assets.create(_.assign(obj, data), callback);
            return;
        }
        callback();
    });
    var createDocument = function () {
        var doc = connection.get('documents', "" + uid);

        doc.fetch(function (err) {
            if (err) throw err;
            if (doc.type === null) {

                doc.create(content, 'text');

                return;
            }
            ;
        });
    }


    function writeJs(name) {
        var reg = new RegExp('(.+)(.js)', "gmi");

        var className = name.replace(reg, "$1")


        return nunjucks.render(__dirname + '/js_template.html', {className: className});


    }


};



