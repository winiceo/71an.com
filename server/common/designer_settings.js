/**
 * Created by leven on 17/1/9.
 */

let _=require("lodash")
module.exports= function(uid, backend,callback) {
    "use strict";


    let obj = {

            "camera_far_clip": 1000.0,
            "icons_size": 0.2,
            "help": true,
            "local_server": "http://localhost:51000",
            "pack_id": 489635,
            "camera_near_clip": 0.1,
            "modified_at": "2017-01-11T16:22:39.650000",
            "camera_clear_color": [
                0.118,
                0.118,
                0.118,
                1.0
            ],
            "grid_divisions": 8,
            "grid_division_size": 1.0,
            "version": 1,
            "snap_increment": 1.0,
            "user_id": 10695,

            "created_at": "2017-01-11T16:22:39.650000"

    }

    var connection = backend.connect();

    var doc = connection.get('designer_settings', uid+"_10695");
    var data = {
        pack_id:  uid
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