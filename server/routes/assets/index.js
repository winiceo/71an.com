module.exports = {
    init: function (app, middleware, backend, config) {

        app.get("/api/projects/:d/assets",
            require("./list").bind(app, backend, config));

        app.get("/api/assets/:id/file/:name",
            require("./read").bind(app, backend, config));
        
        app.get("/api/assets/files/:folder/:name",
            require("./files").bind(app, backend, config));


        app.get("/api/assets/:id/download",
            require("./download").bind(app, backend, config));

        app.get("/api/assets/files/:asset",
            require("./files").bind(app, backend, config));


        app.get("/api/assets/files/scripts/:file",
            require("./static").bind(app, backend, config));

        app.post("/api/assets",
            middleware.keditorUpload,
            require("./create").bind(app, backend, config));


        app.get("/editor/asset/:d",

            require("./edit").bind(app, backend, config));


        app.get("/api/assets/:aid/thumbnail/:size",

            require("./thumbnail").bind(app, backend, config));


    }
};
