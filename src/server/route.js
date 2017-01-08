/**
 * Created by leven on 17/1/4.
 */
var multer = require('multer')
var path = require("path")
var upload = multer({dest: path.join(__dirname, 'public/uploads/')})
var fs = require("fs")
const _ = require("lodash")

// var ShareDB = require('sharedb');

// var sharedb = new ShareDB();

const async = require("async")

var K = require("parse/node")
var config = {
    APP_NAME: 'keviocms',
    APP_ID: 'kevioapp',
    MASTER_KEY: 'pmker.com',
    SERVER_URL: 'http://71an.com/k/p/'
}
K.initialize(config.APP_ID, config.MASTER_KEY);
K.serverURL = config.SERVER_URL;
module.exports = (app, backend) => {
    //首页
    app.all("/", function (req, res) {


        //let project_id=parseInt(req.params.d)
        let model = backend.createModel()

        let query = model.query("projects", {})
        query.subscribe(function () {
            "use strict";

            var tmp = []

            _.each(query.get(), function (b) {


                tmp.push(b)
            })
            console.log(tmp)
            res.render("index.html", {projects: tmp})


        })

    })

    app.all("/editor/scene/:d", function (req, res) {
        let scene_id = req.params.d
        let config = {
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
                "api": "http://192.168.1.103:4444/api",
                "home": "http://192.168.1.103:4444",
                "realtime": {"http": "ws://192.168.1.103:4444/channel"},
                "messenger": {"http": "https://msg.playcanvas.com/", "ws": "https://msg.playcanvas.com/messages"},
                "engine": "http://192.168.1.103:4444/playcanvas-stable.js",
                "howdoi": "https://s3-eu-west-1.amazonaws.com/code.playcanvas.com/editor_howdoi.json",
                "static": "https://s3-eu-west-1.amazonaws.com/static.playcanvas.com",
                "images": "https://s3-eu-west-1.amazonaws.com/images.playcanvas.com"
            }
        };


        let model = backend.createModel()
        let $scenes = model.at('scenes.' + scene_id)

        console.log('scenes.' + scene_id)

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

                _.assign(config.project, project);


                res.render("3deditor.html", {config: (config)})

            });


        }


    })


    //演示
    app.all("/editor/scene/:d/launch", function (req, res) {


        let scene_id = req.params.d
        let config = {
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
                "api": "http://192.168.1.103:4444/api",
                "home": "http://192.168.1.103:4444",
                "realtime": {"http": "ws://192.168.1.103:4444/channel"},
                "messenger": {"http": "https://msg.playcanvas.com/", "ws": "https://msg.playcanvas.com/messages"},
                "engine": "https://code.playcanvas.com/playcanvas-stable.js",

                "physics": "https://code.playcanvas.com/ammo.dcab07b.js",
                "webvr": "https://code.playcanvas.com/webvr-polyfill.91fbc44.js"
            }

        };


        let model = backend.createModel()
        let $scenes = model.at('scenes.' + scene_id)

        console.log('scenes.' + scene_id)

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

                _.assign(config.project, project);


                res.render("launch.html", {config: (config)})

            });


        }

    })

    //代码编辑
    app.all("/editor/asset/:d", function (req, res) {
        let asset_id = req.params.d
        let config = {
            "self": {
                "id": 10695,
                "username": "leven"
            },
            "accessToken": "to52zxqwejzdbc67hdxahc5ja62royhe",
            "asset": {
                "id": "6253337",
                "name": "New Css",
                "type": "css",
                "scope": {
                    "type": "project",
                    "id": 449755
                }
            },
            "project": {
                "id": 449755,
                "name": "4444",
                "permissions": {
                    "admin": [
                        10695
                    ],
                    "write": [],
                    "read": []
                },
                "private": true,
                "repositories": {
                    "current": "directory"
                }
            },
            "file": {
                "error": false
            },
            "title": "New Css | Code Editor",
            "url": {
                "api": "http://192.168.1.103:4444/api",
                "home": "http://192.168.1.103:4444",
                "realtime": {"http": "ws://192.168.1.103:4444/channel"},

                "messenger": {
                    "http": "https://msg.playcanvas.com/",
                    "ws": "https://msg.playcanvas.com/messages"
                },
                "autocomplete": "https://s3-eu-west-1.amazonaws.com/code.playcanvas.com/tern-playcanvas.json"
            }
        };


        let model = backend.createModel()
        let $assets = model.at('assets.' + asset_id)


        $assets.subscribe(function (err) {
            if (err) return next(err);
            var assets = $assets.get();
            console.log(assets)
            _.assign(config.asset, assets);

            getProject(assets.project)

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


                }

                _.assign(config.project, project);


                res.render("code-editor.html", {config: (config)})

            });


        }


    })
//代码编辑code
    app.all("/editor/asset1/:d", function (req, res) {
        let asset_id = req.params.d
        let config = {
            "self": {
                "id": 10695,
                "username": "leven"
            },
            "accessToken": "to52zxqwejzdbc67hdxahc5ja62royhe",
            "asset": {
                "id": "6253337",
                "name": "New Css",
                "type": "css",
                "scope": {
                    "type": "project",
                    "id": 449755
                }
            },
            "project": {
                "id": 449755,
                "name": "4444",
                "permissions": {
                    "admin": [
                        10695
                    ],
                    "write": [],
                    "read": []
                },
                "private": true,
                "repositories": {
                    "current": "directory"
                }
            },
            "file": {
                "error": false
            },
            "title": "New Css | Code Editor",
            "url": {
                "api": "http://192.168.1.103:4444/api",
                "home": "http://192.168.1.103:4444",
                "realtime": {"http": "ws://192.168.1.103:4444/channel"},

                "messenger": {
                    "http": "https://msg.playcanvas.com/",
                    "ws": "https://msg.playcanvas.com/messages"
                },
                "autocomplete": "https://s3-eu-west-1.amazonaws.com/code.playcanvas.com/tern-playcanvas.json"
            }
        };


        let model = backend.createModel()
        let $assets = model.at('assets.' + asset_id)


        $assets.subscribe(function (err) {
            if (err) return next(err);
            var assets = $assets.get();
            console.log(assets)
            _.assign(config.asset, assets);

            getProject(assets.project)

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


                }

                _.assign(config.project, project);


                res.render("code-editor1.html", {config: (config)})

            });


        }


    })


    app.all('/api/projects/:d/scenes', function (req, res, params) {

        let project_id = parseInt(req.params.d)
        let model = backend.createModel()
        console.log(project_id)
        let query = model.query("scenes", {"project_id": project_id})
        query.subscribe(function () {
            "use strict";

            var tmp = []

            _.each(query.get(), function (b) {

                delete(b.settings)
                delete(b.entities)
                delete(b.scene)
                tmp.push(b)
            })
            res.json({"result": tmp})

        })


    })
    app.all('/api/scenes/:d/designer_settings/:e', function (req, res, params) {
        var data = {
            "camera_far_clip": 1000.0,
            "icons_size": 0.2,
            "help": true,
            "local_server": "http://localhost:4444",
            "pack_id": req.params.d,
            "camera_near_clip": 0.1,
            "modified_at": "2017-01-04T15:09:29.140000",
            "camera_clear_color": [0.118, 0.118, 0.118, 1.0],
            "grid_divisions": 8,
            "grid_division_size": 1.0,
            "version": 1,
            "snap_increment": 1.0,
            "user_id": 10695,
            "_id": "586d1029fe30c41891959722",
            "created_at": "2017-01-04T15:09:29.140000"
        }

        console.log(req.params.d)
        res.json(data)
    })
//var Assets = K.Object.extend("assets");

    app.all('/api/projects/:d/assets', function (req, res, params) {

        let model = backend.createModel()
        //let results=model.query("assets", {project:req.params.d})


        let query = model.query("assets", {"project": {$eq: req.params.d}}).fetch(function () {
            "use strict";
            let results = []
            _.mapKeys(query.idMap, function (key, value) {
                results.push({id: value})

            })
            res.json(results)


            console.log(query.idMap)
        })


        var connection = backend.connect();
        connection.createFetchQuery('assets', {"project": {$eq: req.params.d}}, {}, function (err, results) {
            if (err) {
                throw err;
            }

            // Populate with a set of starting documents, but this is currently
            // empty. See below for some sample data.
            //
            if (results.length === 0) {
                var shapes = [];

                // shapes.forEach(function (shape, index) {
                //     var doc = connection.get('shapes', shape.attrs.id);
                //     // {
                //     //   key: uuid,
                //     //   attrs: props of shape,
                //     //   className: type of shape
                //     // }
                //
                //     var data = {
                //         key: shape.attrs.id,
                //         attrs: shape.attrs,
                //         className: shape.className
                //     };
                //     doc.create(data);
                // });
            }
        });


        // console.log(results)
        //   res.json({results:""})
        // var query = new K.Query(Assets);
        // query.equalTo("project", req.params.d );
        // //query.equalTo("project", "448674");
        // console.log(req.params.d)
        //
        // query.find({
        //     success: function (result) {
        //         console.log(result)
        //         var aa=[]
        //         _.each(result,function(n){
        //             aa.push({"id":n.id})
        //         })
        //         //res.json(aa)
        //
        //     },
        //     error: function (error) {
        //
        //         console.log("Error: " + error.code + " " + error.message);
        //     }
        // });

    })

    app.all('/api/assets/:id/file/:name', function (req, res, params) {
        var connection = backend.connect();
        var doc = connection.get('assets', req.param.id);
        let callback = function () {
            "use strict";
            res.send(doc.data)

        }
        doc.fetch(function (err) {
            if (err) throw err;
            if (doc.type === null) {
                doc.create({data: ""}, callback);
                return;
            }
            callback();
        });
    })


    app.all('/api/assets/files/:asset', function (req, res, params) {
        var connection = backend.connect();

        var doc = connection.get('assets', req.query.id);
        let callback = function () {
            "use strict";
            console.error(doc.data.data)
            res.send((doc.data.data))

        }
        doc.fetch(function (err) {
            if (err) throw err;
            if (doc.type === null) {
                doc.create({data: ""}, callback);
                return;
            }
            callback();
        });

    })

    //
    app.all('/project/:pid/overview/:name', function (req, res, params) {
        var connection = backend.connect();

        // var doc = connection.get('projects', req.params.pid);
        // let callback=function(){
        //     "use strict";
        //     console.error(doc.data.data)
        //     res.send((doc.data.data))
        //
        // }
        // doc.fetch(function(err) {
        //     if (err) throw err;
        //     if (doc.type === null) {
        //         doc.create({data:""} , callback);
        //         return;
        //     }
        //     callback();
        // });


        let model = backend.createModel()

        let query = model.query("scenes", {"project_id": req.params.pid})
        query.subscribe(function () {
            "use strict";

            var tmp = []
            console.log(query.idMap)
            _.each(query.idMap, function (b, key) {
                tmp.push(key)
            })
            res.send("<a href='/editor/scene/" + tmp[0] + "'>編辑</a>")

        })


    })
//  app.all('/api/users/:d', function (req, res, params) {
//     var data={"username":"leven","email_hash":"40352887d9d92e6a981739e6cdbdb90a","hash":"Kxixh8In","organizations":[],"plan_type":"free","tokens":[],"plan":"free","full_name":"Leven Zhao","vat_number":null,"id":10695,"size":{"total":0,"code":0,"apps":0,"assets":0},"public_key":"ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDR/X3WP15OZ3CaDV3iCsnRjPCuXxXp/ybCn8n4twnuxrAsk5IWLmCHhivJQfqmB50UQRktLywyEiXbK1Z346YgyTY0k4GdiQ5IeL3iFhebPFFJW+EPiklHQQb+o3rwDJpC2CTxlAc1NCSNIKD2DILN2xOr+3gs234pcYURilF2gBRidEqVDP0i/xUdkijdrmFKneYjkGnZXMfHZRBz8hG1xZfOWGT0asi9ubxnHS/zhoi3WDEyhH//KDN6Gc4e6xl7LOkH0D67XU7NTRmfOAxZeY6kOvYv7u0fEV4To1+CloCwDOtYWfNp7h51Cbza0uYBN6hk9/SSVXa7n75/LWU3 \"leven@playcanvas\"\n","active_promo":null,"preferences":{"email":{"organizations":true,"users":true,"followed_projects":true,"comments":true,"general":true,"store":true,"stars":true,"projects":true}},"limits":{"max_public_projects":-1,"disk_allowance":200,"max_private_projects":0},"skills":["coder","designer","musician","artist"],"created_at":"2014-07-04T07:57:00Z","super_user":false,"flags":{"opened_designer":false},"organization":false,"email":"leven.zsh@gmail.com","last_seen":"2017-01-02T10:59:56Z"}
//     res.json(data)
// })
//     var upload = multer()
//     var bodyParser = require('body-parser');
//     var bytes=require("bytes")
//
//     app.use(bodyParser.json({limit: '1mb'}));
//     app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));
//     app.use(require('method-override')());
//
//     var busboy = require('connect-busboy');
//
//     app.use(busboy({
//         limits: {
//             fileSize: bytes(1024000)
//         }
//     }));
// // default options, no immediate parsing
//
//     var ShareDB = require('sharedb');
//     var db1 = require('sharedb-mongo')('mongodb://localhost:27017/playcanvas');
//
//     var bass = ShareDB({db: db1});
//     var cc = bass.connect();
//
//     var uuid = require('node-uuid');
    app.post('/api/assets', upload.single('file'), function (req, res, next) {
        var data = req.body
        // console.log(data)
        // return res.json(data)
        let model = backend.createModel()
        // let createNull
        let uid = model.id()

        let $assets = model.at('assets.' + uid)

        $assets.subscribe(function (err) {
            if (err) return next(err);
            var assets = $assets.get();

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
                "data": null,

                "file": {
                    "filename": data.filename,
                    "size": 1,
                    "hash": "68b329da9893e34099c7d8ad5cb9c940"
                },
                "region": "eu-west-1",
                "path": [],
                "task": null
            }


            // If the room doesn't exist yet, we need to create it
            $assets.createNull(_.assign(obj, data));

             var connection = backend.connect();
            
            var doc = connection.get('documents', "" + uid);
            let callback = function () {
                "use strict";
                console.log(doc)
            }
            doc.fetch(function (err) {
                if (err) throw err;
                if (doc.type === null) {
                    doc.create("\n", 'text', callback);

                    // [{insert: 'Hi!'}], 'rich-text'
                    // doc.create({data:"\n"}, callback);
                    return;
                }
                callback();
            });
            res.json({"asset": {"id": uid}})

        });


        // model.fetch(assets, () => {
        //     let cb=function(){
        //         "use strict";
        //         let as=assets.get()
        //
        //         console.log(as)
        //         res.json(as)
        //     }
        //     async.series([ (cb) => {
        //         if (assets.get() == null) {
        //             assets.add(uid,data, cb)
        //         } else {
        //            cb()
        //         }
        //     }])
        //     model.close()
        //
        // })


        console.log(data)
        console.log(data)

        // var project_id=data.project_id;
        // var uid=Date.now().toString();
        // var doc=cc.get("assets",uid)
        //
        // doc.fetch(function(err) {
        //     if (err) throw err;
        //     if (doc.type === null) {
        //
        //         doc.create( data, function(err) {
        //             res.json({"asset":{"id":parseInt(uid)}})
        //         })
        //
        //         return;
        //     }
        //
        // });
        // doc.on("create",function(){
        //     console.log(arguments)
        // })


        //  var connection = backend.connect();
        // var doc = connection.get('assets', "");
        // doc.create(
        // {"data":data} );

        // var GameScore = K.Object.extend("assets");
        //   var kobj = new GameScore();

        //       // 设置名称

        //  kobj.set(data);
        //   kobj.save(null,{
        //       success:function(aa){
        //           console.log(aa)
        //           var data={"asset":{"id":aa.id}}
        //           res.json(data)
        //       }
        //   })


    })


    //
    app.post('/api/projects', function (req, res, next) {
        var data = req.body
        // console.log(data)
        // return res.json(data)
        let model = backend.createModel()
        // let createNull
        let uid = model.id()

        let $assets = model.at('projects.' + uid)

        $assets.subscribe(function (err) {
            if (err) return next(err);
            var assets = $assets.get();

            let obj = {
                "primary_pack": 488291,
                "new_owner": null,
                "private": false,
                "engine_version": "stable",
                "last_post_id": null,
                "owner": "leven",
                "watched": 0,
                "id": 449678,
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
                "description": "asdfasdf",
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
                "name": "aafasdfasdf",
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


            // If the room doesn't exist yet, we need to create it
            $assets.createNull(_.assign(obj, data), function () {
                "use strict";
                createScenes($assets.get(), function () {
                    res.json($assets.get())

                })


            });


        });
    })


    function createScenes(project, callback) {
        "use strict";
        let model = backend.createModel()

        let uid = model.id()

        var obj = {
            "name": "Untitled",
            "created": "2017-01-06T10:03:19.412Z",
            "settings": {
                "physics": {
                    "gravity": [
                        0,
                        -9.8,
                        0
                    ]
                },
                "render": {
                    "fog_end": 1000,
                    "tonemapping": 0,
                    "skybox": null,
                    "fog_density": 0.01,
                    "gamma_correction": 1,
                    "exposure": 1,
                    "fog_start": 1,
                    "global_ambient": [
                        0.2,
                        0.2,
                        0.2
                    ],
                    "skyboxIntensity": 1,
                    "fog_color": [
                        0,
                        0,
                        0
                    ],
                    "lightmapMode": 1,
                    "fog": "none",
                    "lightmapMaxResolution": 2048,
                    "skyboxMip": 0,
                    "lightmapSizeMultiplier": 16
                }
            },
            "scene": 488291,
            "entities": {
                "598c73d4-d3f7-11e6-89b2-22000ac481df": {
                    "position": [
                        0,
                        0,
                        0
                    ],
                    "scale": [
                        8,
                        1,
                        8
                    ],
                    "name": "Plane",
                    "parent": "598c6cc2-d3f7-11e6-89b2-22000ac481df",
                    "resource_id": "598c73d4-d3f7-11e6-89b2-22000ac481df",
                    "components": {
                        "model": {
                            "lightMapSizeMultiplier": 1,
                            "castShadows": true,
                            "castShadowsLightmap": true,
                            "lightmapped": false,
                            "materialAsset": null,
                            "receiveShadows": true,
                            "enabled": true,
                            "castShadowsLightMap": false,
                            "asset": null,
                            "lightmapSizeMultiplier": 1,
                            "type": "plane",
                            "lightMapped": false
                        }
                    },
                    "rotation": [
                        0,
                        0,
                        0
                    ],
                    "enabled": true,
                    "children": []
                },
                "598c6cc2-d3f7-11e6-89b2-22000ac481df": {
                    "position": [
                        0,
                        0,
                        0
                    ],
                    "scale": [
                        1,
                        1,
                        1
                    ],
                    "name": "Root",
                    "parent": null,
                    "resource_id": "598c6cc2-d3f7-11e6-89b2-22000ac481df",
                    "components": {},
                    "rotation": [
                        0,
                        0,
                        0
                    ],
                    "enabled": true,
                    "children": [
                        "598c6eca-d3f7-11e6-89b2-22000ac481df",
                        "598c708c-d3f7-11e6-89b2-22000ac481df",
                        "598c723a-d3f7-11e6-89b2-22000ac481df",
                        "598c73d4-d3f7-11e6-89b2-22000ac481df"
                    ]
                },
                "598c723a-d3f7-11e6-89b2-22000ac481df": {
                    "position": [
                        0,
                        0.5,
                        0
                    ],
                    "scale": [
                        1,
                        1,
                        1
                    ],
                    "name": "Box",
                    "parent": "598c6cc2-d3f7-11e6-89b2-22000ac481df",
                    "resource_id": "598c723a-d3f7-11e6-89b2-22000ac481df",
                    "components": {
                        "model": {
                            "lightMapSizeMultiplier": 1,
                            "castShadows": true,
                            "castShadowsLightmap": true,
                            "lightmapped": false,
                            "materialAsset": null,
                            "receiveShadows": true,
                            "enabled": true,
                            "castShadowsLightMap": false,
                            "asset": null,
                            "lightmapSizeMultiplier": 1,
                            "type": "box",
                            "lightMapped": false
                        }
                    },
                    "rotation": [
                        0,
                        0,
                        0
                    ],
                    "enabled": true,
                    "children": []
                },
                "598c708c-d3f7-11e6-89b2-22000ac481df": {
                    "position": [
                        2,
                        2,
                        -2
                    ],
                    "scale": [
                        1,
                        1,
                        1
                    ],
                    "name": "Light",
                    "parent": "598c6cc2-d3f7-11e6-89b2-22000ac481df",
                    "resource_id": "598c708c-d3f7-11e6-89b2-22000ac481df",
                    "components": {
                        "light": {
                            "castShadows": true,
                            "shadowDistance": 16,
                            "vsmBlurSize": 11,
                            "shadowUpdateMode": 2,
                            "normalOffsetBias": 0.04,
                            "color": [
                                1,
                                1,
                                1
                            ],
                            "falloffMode": 0,
                            "shadowResolution": 1024,
                            "outerConeAngle": 45,
                            "enabled": true,
                            "range": 8,
                            "affectDynamic": true,
                            "intensity": 1,
                            "affectLightmapped": false,
                            "vsmBlurMode": 1,
                            "innerConeAngle": 40,
                            "shadowBias": 0.04,
                            "bake": false,
                            "type": "directional",
                            "shadowType": 0,
                            "vsmBias": 0.01
                        }
                    },
                    "rotation": [
                        45,
                        135,
                        0
                    ],
                    "enabled": true,
                    "children": []
                },
                "598c6eca-d3f7-11e6-89b2-22000ac481df": {
                    "position": [
                        4,
                        3.5,
                        4
                    ],
                    "scale": [
                        1,
                        1,
                        1
                    ],
                    "name": "Camera",
                    "parent": "598c6cc2-d3f7-11e6-89b2-22000ac481df",
                    "resource_id": "598c6eca-d3f7-11e6-89b2-22000ac481df",
                    "components": {
                        "camera": {
                            "projection": 0,
                            "farClip": 1000,
                            "clearColorBuffer": true,
                            "priority": 0,
                            "fov": 45,
                            "clearDepthBuffer": true,
                            "frustumCulling": true,
                            "clearColor": [
                                0.118,
                                0.118,
                                0.118,
                                1
                            ],
                            "enabled": true,
                            "orthoHeight": 4,
                            "nearClip": 0.1,
                            "rect": [
                                0,
                                0,
                                1,
                                1
                            ]
                        }
                    },
                    "rotation": [
                        -30,
                        45,
                        0
                    ],
                    "enabled": true,
                    "children": []
                }
            },
            "project_id": 449678
        }

        var connection = backend.connect();
        console.log(project)
        var doc = connection.get('scenes', uid);
        var data = {
            "project_id": project.id,
            scene: uid
        }
        doc.fetch(function (err) {
            if (err) throw err;
            if (doc.type === null) {
                doc.create(_.assign(obj, data), callback);
                return;
            }
            callback();
        });


    }

    app.get("/test", function (req, res) {
        res.json({
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
                "size": {"code": 0, "total": 0, "apps": 0, "assets": 0},
                "owner_id": 10695,
                "website": "",
                "fork_from": null,
                "hash": "cw4SvI7U",
                "description": "你日不着啊",
                "views": 0,
                "private_source_assets": false,
                "last_post_date": null,
                "tags": [],
                "permissions": {"admin": ["leven"], "write": [], "read": []},
                "locked": false,
                "name": "我日啊",
                "settings": {"use_legacy_scripts": false, "vr": false},
                "created": "2017-01-06T10:03:19.393000",
                "repositories": {
                    "current": "directory",
                    "directory": {
                        "state": {"status": "ready"},
                        "modified": "2017-01-06T10:03:19.393000",
                        "created": "2017-01-06T10:03:19.393000"
                    }
                },
                "modified": "2017-01-06T10:03:19.393000",
                "flags": {},
                "activity": {"level": 0},
                "primary_app": null,
                "starred": 0,
                "id": "42a27ef9-ae07-46b9-ad6b-58b175473119"
            },
            "scene": {"id": "b8beebd6-f0c7-4cbe-bc2e-ab186d5034d7"},
            "url": {
                "api": "http://192.168.1.103:4444/api",
                "home": "http://192.168.1.103:4444",
                "realtime": {"http": "ws://192.168.1.103:4444/channel"},
                "messenger": {"http": "https://msg.playcanvas.com/", "ws": "https://msg.playcanvas.com/messages"},
                "engine": "https://code.playcanvas.com/playcanvas-stable.js",
                "physics": "https://code.playcanvas.com/ammo.dcab07b.js",
                "webvr": "https://code.playcanvas.com/webvr-polyfill.91fbc44.js"
            }
        })
    })
    app.post('/api/scenes', function (req, res, next) {
        var data = req.body
        let model = backend.createModel()
        // let createNull
        let uid = model.id()

        let obj = {
            "project_id": 449204,
            "name": " asjdfkasj\uff1b\u57ce",
            "settings": {
                "physics": {
                    "gravity": [
                        0.0,
                        -9.8,
                        0.0
                    ]
                },
                "render": {
                    "fog_end": 1000.0,
                    "fog_start": 1.0,
                    "skyboxIntensity": 1,
                    "global_ambient": [
                        0.2,
                        0.2,
                        0.2
                    ],
                    "tonemapping": 0,
                    "fog_color": [
                        0.0,
                        0.0,
                        0.0
                    ],
                    "lightmapMode": 1,
                    "skyboxMip": 0,
                    "fog": "none",
                    "lightmapMaxResolution": 2048,
                    "skybox": null,
                    "fog_density": 0.01,
                    "gamma_correction": 1,
                    "lightmapSizeMultiplier": 16,
                    "exposure": 1.0
                }
            },
            "scene": 488048,
            "modified": "2017-01-05T12:53:46.528416",
            "entities": {
                "fef8a994-d345-11e6-89b2-22000ac481df": {
                    "scale": [
                        1,
                        1,
                        1
                    ],
                    "name": "Root",
                    "parent": null,
                    "resource_id": "fef8a994-d345-11e6-89b2-22000ac481df",
                    "enabled": true,
                    "components": {},
                    "position": [
                        0,
                        0,
                        0
                    ],
                    "rotation": [
                        0,
                        0,
                        0
                    ],
                    "children": [
                        "fef8ac50-d345-11e6-89b2-22000ac481df",
                        "fef8ae1c-d345-11e6-89b2-22000ac481df",
                        "fef8afd4-d345-11e6-89b2-22000ac481df",
                        "fef8b182-d345-11e6-89b2-22000ac481df"
                    ]
                },
                "fef8ae1c-d345-11e6-89b2-22000ac481df": {
                    "scale": [
                        1,
                        1,
                        1
                    ],
                    "name": "Light",
                    "parent": "fef8a994-d345-11e6-89b2-22000ac481df",
                    "resource_id": "fef8ae1c-d345-11e6-89b2-22000ac481df",
                    "enabled": true,
                    "components": {
                        "light": {
                            "bake": false,
                            "vsmBlurSize": 11,
                            "shadowUpdateMode": 2,
                            "normalOffsetBias": 0.04,
                            "color": [
                                1,
                                1,
                                1
                            ],
                            "type": "directional",
                            "shadowResolution": 1024,
                            "outerConeAngle": 45,
                            "enabled": true,
                            "intensity": 1,
                            "castShadows": true,
                            "innerConeAngle": 40,
                            "range": 8,
                            "affectLightmapped": false,
                            "vsmBlurMode": 1,
                            "affectDynamic": true,
                            "shadowBias": 0.04,
                            "shadowDistance": 16.0,
                            "falloffMode": 0,
                            "shadowType": 0,
                            "vsmBias": 0.01
                        }
                    },
                    "position": [
                        2,
                        2,
                        -2
                    ],
                    "rotation": [
                        45,
                        135,
                        0
                    ],
                    "children": []
                },
                "fef8b182-d345-11e6-89b2-22000ac481df": {
                    "scale": [
                        8,
                        1,
                        8
                    ],
                    "name": "Plane",
                    "parent": "fef8a994-d345-11e6-89b2-22000ac481df",
                    "resource_id": "fef8b182-d345-11e6-89b2-22000ac481df",
                    "enabled": true,
                    "components": {
                        "model": {
                            "materialAsset": null,
                            "lightMapped": false,
                            "receiveShadows": true,
                            "castShadowsLightMap": false,
                            "enabled": true,
                            "castShadows": true,
                            "castShadowsLightmap": true,
                            "lightMapSizeMultiplier": 1,
                            "lightmapSizeMultiplier": 1,
                            "type": "plane",
                            "lightmapped": false,
                            "asset": null
                        }
                    },
                    "position": [
                        0,
                        0,
                        0
                    ],
                    "rotation": [
                        0,
                        0,
                        0
                    ],
                    "children": []
                },
                "fef8ac50-d345-11e6-89b2-22000ac481df": {
                    "scale": [
                        1,
                        1,
                        1
                    ],
                    "name": "Camera",
                    "parent": "fef8a994-d345-11e6-89b2-22000ac481df",
                    "resource_id": "fef8ac50-d345-11e6-89b2-22000ac481df",
                    "enabled": true,
                    "components": {
                        "camera": {
                            "orthoHeight": 4,
                            "fov": 45,
                            "clearDepthBuffer": true,
                            "projection": 0,
                            "frustumCulling": true,
                            "clearColor": [
                                0.118,
                                0.118,
                                0.118,
                                1.0
                            ],
                            "enabled": true,
                            "priority": 0,
                            "farClip": 1000,
                            "nearClip": 0.1,
                            "rect": [
                                0,
                                0,
                                1,
                                1
                            ],
                            "clearColorBuffer": true
                        }
                    },
                    "position": [
                        4,
                        3.5,
                        4
                    ],
                    "rotation": [
                        -30,
                        45,
                        0
                    ],
                    "children": []
                },
                "fef8afd4-d345-11e6-89b2-22000ac481df": {
                    "scale": [
                        1,
                        1,
                        1
                    ],
                    "name": "Box",
                    "parent": "fef8a994-d345-11e6-89b2-22000ac481df",
                    "resource_id": "fef8afd4-d345-11e6-89b2-22000ac481df",
                    "enabled": true,
                    "components": {
                        "model": {
                            "materialAsset": null,
                            "lightMapped": false,
                            "receiveShadows": true,
                            "castShadowsLightMap": false,
                            "enabled": true,
                            "castShadows": true,
                            "castShadowsLightmap": true,
                            "lightMapSizeMultiplier": 1,
                            "lightmapSizeMultiplier": 1,
                            "type": "box",
                            "lightmapped": false,
                            "asset": null
                        }
                    },
                    "position": [
                        0,
                        0.5,
                        0
                    ],
                    "rotation": [
                        0,
                        0,
                        0
                    ],
                    "children": []
                }
            },

            "id": 488048
        }


        var connection = backend.connect();

        var doc = connection.get('scenes', uid);
        let callback = function () {
            //console.log(doc.data)
            res.json(doc.data)
        }
        doc.fetch(function (err) {
            if (err) throw err;
            if (doc.type === null) {
                doc.create(_.assign(obj, data), callback);
                return;
            }
            callback();
        });

    })


}
