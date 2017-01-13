/**
 * Created by leven on 17/1/9.
 */

let _=require("lodash")
module.exports= function(uid, backend,callback) {
    "use strict";


    let obj = {
        "accessed_at": "2017-01-12T13:29:20.823Z",
        "cameras": {
            "perspective": {
                "position": [
                    9.199999809265137,
                    7,
                    9
                ],
                "rotation": [
                    -25,
                    44.999996185302734,
                    0
                ],
                "focus": [
                    -0.2167806625366211,
                    0.7900228500366211,
                    -0.4167804718017578
                ]
            },
            "top": {
                "position": [
                    0,
                    1000,
                    0
                ],
                "rotation": [
                    -90,
                    0,
                    0
                ],
                "focus": [
                    0,
                    0,
                    0
                ],
                "orthoHeight": 5
            },
            "bottom": {
                "position": [
                    0,
                    -1000,
                    0
                ],
                "rotation": [
                    90,
                    0,
                    0
                ],
                "focus": [
                    0,
                    0,
                    0
                ],
                "orthoHeight": 5
            },
            "front": {
                "position": [
                    0,
                    0,
                    1000
                ],
                "rotation": [
                    0,
                    0,
                    0
                ],
                "focus": [
                    0,
                    0,
                    0
                ],
                "orthoHeight": 5
            },
            "back": {
                "position": [
                    0,
                    0,
                    -1000
                ],
                "rotation": [
                    -180,
                    0,
                    -180
                ],
                "focus": [
                    0,
                    0,
                    0
                ],
                "orthoHeight": 5
            },
            "left": {
                "position": [
                    -1000,
                    0,
                    0
                ],
                "rotation": [
                    0,
                    -90,
                    0
                ],
                "focus": [
                    0,
                    0,
                    0
                ],
                "orthoHeight": 5
            },
            "right": {
                "position": [
                    1000,
                    0,
                    0
                ],
                "rotation": [
                    0,
                    90,
                    0
                ],
                "focus": [
                    0,
                    0,
                    0
                ],
                "orthoHeight": 5
            }
        },
        "scene": 489902,
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