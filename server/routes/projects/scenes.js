/**
 * Created by leven on 17/1/9.
 */

"use strict";

let _=require("lodash")
module.exports = function(backend,config, req, res, next) {



    var connection = backend.connect()

    var doc = connection.createSubscribeQuery('scenes', {
        "project_id": req.params.d
    }, {}, function(err) {



        var tmp = []
        _.each(doc.results, function(scene) {
            var b=scene.data


            delete(b.settings)
            delete(b.entities)
            delete(b.scene)

            b.id=scene.id

            tmp.push(b)
        })

        res.json({"result": tmp})

    });

};
