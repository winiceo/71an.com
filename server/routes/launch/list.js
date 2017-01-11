"use strict";

var request = require("request");
var querystring = require("querystring");

var HttpError = require("../../lib/http-error");


const _=require("lodash")
module.exports = function(backend,config, req, res, next) {


  let scene_id = req.params.d
  let options = {
    "self": {
      "id": 10695,
      "username": "leven",
      "betaTester": false,
      "superUser": false,
      "openedEditor": false,
      "tips": {"store": true},
      "plan": {"id": 1, "type": "free"}
    },
    "owner": {
      "id": 10695,
      "username": "leven",
      "plan": {"id": 1, "type": "free"},
      "size": 20871079,
      "diskAllowance": 200000000
    },
    "accessToken": "to52zxqwejzdbc67hdxahc5ja62royhe",
    "project": {
      "id": 449204,
      "name": "levengame",
      "description": "game once",
      "permissions": {"admin": [10695], "write": [], "read": []},
      "private": false,
      "privateAssets": false,
      "primaryScene": 487784,
      "primaryApp": null,
      "playUrl": "https://playcanv.as/p/Lf5P46O0/",
      "settings": {
        "loading_screen_script": null,
        "transparent_canvas": false,
        "use_device_pixel_ratio": false,
        "use_legacy_scripts": false,
        "resolution_mode": "AUTO",
        "antiAlias": true,
        "height": 720,
        "libraries": [],
        "width": 1280,
        "vr": false,
        "scripts": [],
        "fill_mode": "FILL_WINDOW",
        "preserve_drawing_buffer": false
      },
      "privateSettings": {},
      "thumbnails": {}
    },
    "scene": {"id": scene_id},
    "url": {
      "api": "http://192.168.1.103:3100/api",
      "home": "http://192.168.1.103:4444",
      "realtime": {"http": "ws://192.168.1.103:3200/channel"},
      "messenger": {"http": "https://msg.playcanvas.com/", "ws": "https://msg.playcanvas.com/messages"},
      "engine": "https://code.playcanvas.com/playcanvas-stable.js",

      "physics": "https://code.playcanvas.com/ammo.dcab07b.js",
      "webvr": "https://code.playcanvas.com/webvr-polyfill.91fbc44.js"
    }

  };


  var connection = backend.connect();
    var scenes = connection.get('scenes', scene_id);
     
     
    scenes.fetch(function (err) {
        if (err) throw err;

        // var a=asset.data
        // a.id=asset.id

        // options.asset=_.assign(options.asset, a);





        
        getProject(scenes.project_id)
    });

    
    let getProject = function (pid) {
        var connection = backend.connect();
        var doc = connection.get('projects', pid);

        doc.fetch(function (err) {
            if (err) throw err;


            var project = {
              id: doc.id,
              name: doc.name,
              description: doc.description,
              primaryScene: scene_id,
              "private": true,
              "privateAssets": true
            }
           options.project= _.assign(options.project, project); 
           res.render("editor/launch.html", {config: (options)})

            


        });

        

    }

 


};

