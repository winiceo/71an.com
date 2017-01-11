"use strict";

let _=require("lodash")
module.exports = function(backend,config, req, res, next) {

  let scene_id = req.params.d
  let options = {
    "self": {
      "id": 10695,
      "username": "leven",
      "betaTester": true,
      "superUser": true,
      "openedEditor": true,
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
      "id": 449755,
      "name": "4444",
      "description": "55555",
      "permissions": {
        "admin": [
          10695
        ],
        "write": [],
        "read": []
      },
      "private": false,
      "privateAssets": false,
      "primaryScene": 488384,
      "primaryApp": null,
      "playUrl": "https://playcanv.as/p/uA16mBxz/",
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
      "home": "http://192.168.1.103:3100",
      "realtime": {"http": "ws://192.168.1.103:3200"},
      "messenger": {"http": "https://msg.playcanvas.com/", "ws": "https://msg.playcanvas.com/messages"},
      "engine": "http://192.168.1.103:3100/playcanvas-stable.js",
      "howdoi": "https://s3-eu-west-1.amazonaws.com/code.playcanvas.com/editor_howdoi.json",
      "static": "https://s3-eu-west-1.amazonaws.com/static.playcanvas.com",
      "images": "https://s3-eu-west-1.amazonaws.com/images.playcanvas.com"
    }
  };


  let model = backend.createModel()
  let $scenes = model.at('scenes.' + scene_id)



  $scenes.subscribe(function (err) {
    if (err) return next(err);
    var scenes = $scenes.get();
    console.log(scenes)

    getProject(scenes.project_id)

  });
  let getProject = function (pid) {


    let $assets = model.at('projects.' + pid)

    $assets.subscribe(function (err) {
      if (err) return next(err);
      var assets = $assets.get();
      var project = {
        id: assets.id,
        name: assets.name,
        description: assets.description,
        primaryScene: scene_id,
        "private": true,
        "privateAssets": true
      }

      _.assign(options.project, project);


      res.render("editor/3deditor.html", {config: (options)})

    });


  }


};
