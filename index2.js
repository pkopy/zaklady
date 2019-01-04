/*
 *
 *Primary file for API
 *
 */


//Dependencies
const server = require('./lib/server');

//Declare the app
const app = {};


//Init function
app.init = () => {
  //Start the server
  server.init();

  //Start the workers
  workers.init();

  
};

//Execute
app.init();

//Export the app

module.exports = app;
