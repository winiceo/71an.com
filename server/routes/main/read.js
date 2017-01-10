"use strict";

let _=require("lodash")
module.exports = function(backend,config, req, res, next) {

    let model = backend.createModel()

    let query = model.query("scenes", {"project_id": req.params.pid})
    query.subscribe(function () {
        "use strict";

        var tmp = []

        _.each(query.idMap, function (b, key) {
            tmp.push(key)
        })
        res.send("<a href='/editor/scene/" + tmp[0] + "'>編辑</a>")

    })


};
