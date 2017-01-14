"use strict";

var request = require("request");
var querystring = require("querystring");

var HttpError = require("../../lib/http-error");


const _ = require("lodash")
module.exports = function (backend, config, req, res, next) {


    let scene_id = req.params.d
    let options =
    {
        "self": {
            "id": 10695,
            "username": "leven",
            "betaTester": true,
            "superUser": true,
            "openedEditor": true,
            "tips": {"store": true},
            "plan": {"id": 1, "type": "free"}
        },
        "accessToken": "to52zxqwejzdbc67hdxahc5ja62royhe",
        "project": {
            "id": 450909,
            "repositoryUrl": "/api/projects/450909/repositories/directory/sourcefiles",
            "scriptPrefix": "/api/files/code/450909/directory",
            "settings": {
                "loading_screen_script": null,
                "transparent_canvas": false,
                "use_device_pixel_ratio": true,
                "use_legacy_scripts": false,
                "preserve_drawing_buffer": false,
                "antiAlias": true,
                "height": 720,
                "libraries": [],
                "width": 1280,
                "vr": false,
                "scripts": [

                ],
                "fill_mode": "FILL_WINDOW",
                "resolution_mode": "AUTO"


            }
        },
        "scene": {
            "id": scene_id
        },
        "url": {

            "api": "http://192.168.1.103:3100/api",
            "home": "http://192.168.1.103:4444",
            "realtime": {"http": "ws://192.168.1.103:3200/channel"},
            "messenger": {"http": "https://msg.playcanvas.com/", "ws": "http://192.168.1.103:3300/messages"},
            "engine": "https://code.playcanvas.com/playcanvas-stable.js",

            "physics": "https://code.playcanvas.com/ammo.dcab07b.js",
            "webvr": "https://code.playcanvas.com/webvr-polyfill.91fbc44.js"



        }
    };





    var connection = backend.connect();
    var scenes = connection.get('scenes', scene_id);


    scenes.fetch(function (err) {
        if (err) throw err;

        //console.error(scenes)


        getProject(scenes.data.project_id)
    });


    let getProject = function (pid) {
        var connection = backend.connect();
        var project = connection.get('projects', pid);

        project.fetch(function (err) {
            if (err) throw err;

            //
            // var obj = {
            //     id: project.id,
            //     name: project.data.name,
            //     description: project.data.description,
            //     primaryScene: scene_id,
            //     "private": true,
            //     "privateAssets": true
            //     "settings":
            // }

            options.project = _.assign(options.project, project.data,{id:project.id});

            console.log(options)
            res.render("editor/launch.html", {config: (options)})


        });


    }


};

