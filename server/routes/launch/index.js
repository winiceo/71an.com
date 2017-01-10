module.exports = {
    init: function (app, middleware, backend, config) {

        app.get("/editor/scene/:d/launch",
            require("./list").bind(app, backend, config));

        app.get("/test/scene/:d/launch",
            require("./test").bind(app, backend, config));



    }
};
