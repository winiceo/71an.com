module.exports = {
    init: function (app, middleware, backend, config) {

        app.get("/api/projects/:d/assets",
            require("./list").bind(app, backend, config));

        app.get("/api/assets/:id/file/:name",
            require("./read").bind(app, backend, config));

        app.get("/api/assets/files/:asset",
            require("./files").bind(app, backend, config));

        app.post("/api/assets",
            middleware.keditorUpload,
            require("./create").bind(app, backend, config));


        app.get("/editor/asset/:d",

            require("./edit").bind(app, backend, config));



    }
};
