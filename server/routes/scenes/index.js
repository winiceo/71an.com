module.exports = {
    init: function (app, middleware, backend, config) {

        app.post("/api/scenes",
            require("./create").bind(app, backend, config));

        // app.get("/api/assets/:id/file/:name",
        //     require("./read").bind(app, backend, config));
        //
        // app.get("/api/assets/files/:asset",
        //     require("./files").bind(app, backend, config));
        //
        // app.get("/api/assets",
        //     middleware.keditorUpload,
        //     require("./files").bind(app, backend, config));
        // //app.post('', upload.single('file'), function (req, res, next) {
        //

    }
};
