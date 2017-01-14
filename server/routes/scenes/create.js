"use strict";

let _=require("lodash")

let createScenes=require("../../common/scenes")
module.exports = function(backend,config, req, res, next) {
    var obj = req.body


    obj.id=obj.project_id
    obj.data={
        name:obj.name
    }
    if(obj.duplicate_from){

        duplicateScene()
    }
    createScenes(obj,backend, function (scene) {


        res.json(scene.data)

    })

    function duplicateScene(){

        var connection = backend.connect();

        let model = backend.createModel()

        let uid = model.id()

        var doc = connection.get('scenes', ""+obj.duplicate_from);
        let callback = function () {
            "use strict";


            let scenes=connection.get('scenes', ""+uid);
            scenes.fetch(function (err) {
                if (err) throw err;
                if (scenes.type === null) {
                    scenes.create(doc.data, function(){
                        res.send(scenes)

                    });

                }

            });

        }
        doc.fetch(function (err) {
            if (err) throw err;
            if (doc.type === null) {
                doc.create({data: ""}, callback);
                return;
            }
            callback();
        });

    }
};

