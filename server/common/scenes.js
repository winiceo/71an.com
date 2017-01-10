/**
 * Created by leven on 17/1/9.
 */

let _=require("lodash")
let createUserData=require("./user_data")
module.exports= function(project, backend,callback) {
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

    var doc = connection.get('scenes', uid);
    var data = {
        "project_id": project.id,
        name:project.name,
        scene: uid
    }
    doc.fetch(function (err) {



        if (err) throw err;
        if (doc.type === null) {
            doc.create(_.assign(obj, data), callback(doc));

            createUserData(uid,backend,function(){})
            return;
        }



        callback(doc);
    });


}