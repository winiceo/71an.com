module.exports = {
    init: function (app, middleware, backend, config) {

        app.get("/projects",
            require("./list").bind(app, backend, config));

        app.get("/project/:pid/overview/:name",
            require("./read").bind(app, backend, config));

        app.post("/api/projects",
            require("./create").bind(app, backend, config));
        app.get("/api/projects/:d/scenes",
            require("./scenes").bind(app, backend, config));


    }
};
