module.exports = {
    init: function (app, middleware, backend, config) {

        app.post("/api/scenes",
            require("./create").bind(app, backend, config));

        app.delete("/api/scenes/:sid",
            require("./delete").bind(app, backend, config));


        app.get('/api/scenes/:did/designer_settings/:uid',
            require("./default_setting").bind(app, backend, config));



    }
};
