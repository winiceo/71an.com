

module.exports = {
  init: function(app, middleware,backend, config) {

      app.get("/editor/scene/:d",
          require("./scene/edit").bind(app, backend, config));

      app.get("/messages/info",
          require("./messages").bind(app, backend, config));





  }
};
