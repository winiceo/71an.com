/**
 * Created by leven on 17/1/9.
 */

let _=require("lodash")
module.exports= function(uid, backend,callback) {
    "use strict";


    let obj = {
        "accessed_at": "2017-01-03T08:53:18.360Z",
        "cameras": {
            "perspective": {
                "position": [111.68462371826172, 22.362058639526367, -35.30546951293945],
                "rotation": [-11.19999885559082, 88.7999267578125, -4.7605803388250933e-7],
                "focus": [-5.145729064941406, -0.7760467529296875, -37.752864837646484]
            },
            "top": {"position": [0, 1000, 0], "rotation": [-90, 0, 0], "focus": [0, 0, 0], "orthoHeight": 5},
            "bottom": {"position": [0, -1000, 0], "rotation": [90, 0, 0], "focus": [0, 0, 0], "orthoHeight": 5},
            "front": {"position": [0, 0, 1000], "rotation": [0, 0, 0], "focus": [0, 0, 0], "orthoHeight": 3.1587822596735524},
            "back": {"position": [0, 0, -1000], "rotation": [-180, 0, -180], "focus": [0, 0, 0], "orthoHeight": 5},
            "left": {"position": [-1000, 0, 0], "rotation": [0, -90, 0], "focus": [0, 0, 0], "orthoHeight": 5},
            "right": {"position": [1000, 0, 0], "rotation": [0, 90, 0], "focus": [0, 0, 0], "orthoHeight": 5}
        },
        "scene": 487210,
        "user": 10695
    }

    var connection = backend.connect();

    var doc = connection.get('user_data', uid+"_10695");
    var data = {

        scene:  uid
    }
    doc.fetch(function (err) {

        console.error(doc.data)

        if (err) throw err;
        if (doc.type === null) {
            doc.create(_.assign(obj, data), callback(doc));
            return;
        }


        callback(doc);
    });


}