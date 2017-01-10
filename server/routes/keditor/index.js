

module.exports = {
  init: function(app, middleware,backend, config) {

      app.get("/editor/scene/:d",
          require("./scene/edit").bind(app, backend, config));

      app.get('/api/scenes/:d/designer_settings/:e',
          require("./scene/default_setting").bind(app, backend, config));






  }
};
