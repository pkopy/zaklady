/*
 *
 * Server React-related task
 * 
 */


//Dependencies
const express = require('express');
const path = require('path');
const app = express();

const reactServer = {}

app.use(express.static(path.join(__dirname, '/../build')));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '/../build', 'index.html'));
});
app.get('/info', function (req, res) {
  res.sendFile(path.join(__dirname, '/../build', 'index.html'));
});


//Init script
reactServer.init = () => {
  app.listen(5100, () => console.log(`React listening on port 5100!`))
}
//Export the module
module.exports = reactServer;
