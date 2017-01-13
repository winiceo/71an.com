"use strict";

var request = require("request");
var querystring = require("querystring");

var HttpError = require("../../lib/http-error");
let _ = require("lodash")
let createScenes = require("../../common/scenes")
module.exports = function (backend, config, req, res, next) {

    var data = req.body
    // console.log(data)
    // return res.json(data)
    let model = backend.createModel()
    // let createNull
    let uid = model.id()
    var connection = backend.connect();

    var doc = connection.get('projects', "" + uid);

    let obj = {
        "primary_pack": 488291,
        "new_owner": null,
        "private": false,
        "engine_version": "stable",
        "last_post_id": null,
        "owner": "leven",
        "watched": 0,

        "plays": 0,
        "private_settings": {},
        "access_level": "admin",
        "size": {
            "code": 0,
            "total": 0,
            "apps": 0,
            "assets": 0
        },
        "owner_id": 10695,
        "website": "",
        "fork_from": null,
        "hash": "cw4SvI7U",
        "description": data.description,
        "views": 0,
        "private_source_assets": false,
        "last_post_date": null,
        "tags": [],
        "permissions": {
            "admin": [
                "leven"
            ],
            "write": [],
            "read": []
        },
        "locked": false,
        "name": data.name,
        "settings": {
            "loading_screen_script": null,
            "transparent_canvas": false,
            "use_device_pixel_ratio": false,
            "use_legacy_scripts": false,
            "preserve_drawing_buffer": false,
            "antiAlias": true,
            "height": 720,
            "libraries": [],
            "width": 1280,
            "vr": false,
            "scripts": [],
            "fill_mode": "FILL_WINDOW",
            "resolution_mode": "AUTO"
        },
        "created": "2017-01-06T10:03:19.393000",
        "repositories": {
            "current": "directory",
            "directory": {
                "state": {
                    "status": "ready"
                },
                "modified": "2017-01-06T10:03:19.393000",
                "created": "2017-01-06T10:03:19.393000"
            }
        },
        "modified": "2017-01-06T10:03:19.393000",
        "flags": {},
        "activity": {
            "level": 0
        },
        "primary_app": null,
        "starred": 0
    }


    doc.fetch(function (err) {
        if (err) throw err;
        if (doc.type === null) {

            doc.create(obj,function(err,project){



                createScenes(doc, backend, function (scence) {
                    //res.json($assets.get())

                    res.send(scence.data)

                })

            });
        }


    });
}

