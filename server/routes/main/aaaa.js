/**
 * Created by leven on 17/1/9.
 */
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

//代码编辑

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




//

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



//




