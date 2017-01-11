/**
 * Created by leven on 17/1/9.
 */




let _=require("lodash")
module.exports = function(backend,config, req, res, next) {

    let asset_id = req.params.d
    let options = {
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
            "api": "http://192.168.1.103:3100/api",
            "home": "http://192.168.1.103:4444",
            "realtime": {"http": "ws://192.168.1.103:3200"},

            "messenger": {
                "http": "https://msg.playcanvas.com/",
                "ws": "https://msg.playcanvas.com/messages"
            },
            "autocomplete": "https://s3-eu-west-1.amazonaws.com/code.playcanvas.com/tern-playcanvas.json"
        }
    };
    var connection = backend.connect();
    var asset = connection.get('assets', asset_id);
    // let callback = function () {
    //     "use strict";
    //     res.send(doc.data)
    //
    // }
    asset.fetch(function (err) {
        if (err) throw err;

        var a=asset.data
        a.id=asset.id

        options.asset=_.assign(options.asset, a);





        
        getProject(asset.project)
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


            }

           options.project= _.assign(options.project, project);


            res.render("editor/code-editor.html", {config: (options)})


        });

        

    }

};
