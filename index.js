/*
 *
 *Primary file for API
 *
 */

//Dependencies
const express = require('express');
const app = express();
const port = 3001;
const cors = require('cors');
const db = require('./lib/db');
const helpers = require('./lib/helpers');
const _data = require('./lib/dataFs');
const bet = require('./lib/bet')

let session = []

app.use(cors());
app.use(express.static('public'));

//Required data: name, email, password
app.post('/register', (req, res) => {
  
  req.on('data', (data) => {
    let payload = Buffer.from(data).toString();
    const payloadObject = helpers.parseJsonToObject(payload);
    const name = typeof(payloadObject.name) == 'string' && payloadObject.name.trim().length > 0 ? payloadObject.name.trim() : false;
    const email = typeof(payloadObject.email) == 'string' && payloadObject.email.trim().length > 0  && /[\w+0-9._%+-]+@[\w+0-9.-]+\.[\w+]{2,3}/.test(payloadObject.email.trim()) ? payloadObject.email.trim() : false;
    const password = typeof(payloadObject.password) == 'string' && payloadObject.password.trim().length > 5 ? payloadObject.password.trim() : false;

    if (name && email && password) {

      db.read('user', 'email', email)
        .then(() => {
          helpers.response(res, 403, {'Error' : 'This email address is already exist'});
        })
        .catch(() => {
          const hashedPassword = helpers.hash(password);
          const userKey =  helpers.createRandomString(30);
          const date = Date.now();
          const user = {
            name,
            email,
            password : hashedPassword,
            ip : req.connection.remoteAddress,
            userKey,
            date
          }
          db.read('register', 'ip', user.ip)
            .then(data => {
              if (Array.isArray(data) && Date.now() - data[0].date < 10000) {
                helpers.response(res, 403, {'Message' : 'You must wait a moment'});
                
              } else {
                if (Array.isArray(data) && data[0]) {
                  db.delete('register', 'id', data[0].id).catch(data => console.log(data));
                  db.create('register', user)
                    .then(data => {
                      helpers.sendEmail(email, userKey);
                      helpers.response(res, 200, {'InsertId' : data.insertId});
                    })
                    .catch(data => {
                      helpers.response(res, 403, {'Error': data });
                    });
                  }
                  
                }
              })
              .catch(() => {
                db.create('register', user)
                .then(data => {
                  helpers.sendEmail(email, userKey);
                  helpers.response(res, 200, {'InsertId' : data.insertId});
                })
                .catch(data => {
                  helpers.response(res, 403, {'Error': data });
                });
            });
        });
      
    } else {
      helpers.response(res, 403, {'Error' : 'Missing required field(s)'});
    }
  });
});

//Adding user to db
app.get('/register/:key', (req, res) => {
  const key = req.params.key;
  db.read('register', 'userKey', key)
    .then(data => {
      const userObj = data[0];
      const registerId = userObj.id;
      delete userObj.userKey;
      delete userObj.id;
      userObj.access = 0;
      db.create('user', userObj)
      .then(() => {
          db.delete('register', 'id', registerId).catch(data => console.log(data));
          helpers.response(res, 200, { 'Info': `New user has been added` });
        })
        .catch(err => {
          helpers.response(res, 403, {'Error': err});
        });
      })
      .catch(() => {
      helpers.response(res, 403, {'Error': 'User key is not valid'});
    });
});

//Required data: email, password
app.post('/login', (req, res) => {
  req.on('data', data => {
    let payload = Buffer.from(data).toString();
    const payloadObject = helpers.parseJsonToObject(payload);
    const email = typeof(payloadObject.email) == 'string' && payloadObject.email.trim().length > 0  && /[\w+0-9._%+-]+@[\w+0-9.-]+\.[\w+]{2,3}/.test(payloadObject.email.trim()) ? payloadObject.email.trim() : false;
    const password = typeof(payloadObject.password) == 'string' && payloadObject.password.trim().length > 5 ? payloadObject.password.trim() : false;

    if (email && password) {
      db.read('user', 'email', email)
      .then(dataUser => {
        //Hash the send password and compare it to the password stored in the user object
        const hashedPassword = helpers.hash(password);
        if (hashedPassword === dataUser[0].password) {
          //If valid, create a new token with a random name. Set expiration date 1 hour in the future
          const tokenId = helpers.createRandomString(20);
          const expires = Date.now() + 1000 * 60 * 60;
          const tokenObject = {
            email,
            id : tokenId,
            expires,
            accessLevel: dataUser[0].access
          };

          //Store the token
          _data.create('tokens', tokenId, tokenObject, (err) => {
            if (!err) {
              helpers.response(res, 200, tokenObject);
            } else {
              helpers.response(res, 500, {'Error' : 'Could not create the new token'});
            }
          });
        } else {
          helpers.response(res, 400, {'Error' : 'Password did not match the specified user\'s stored password'});
        }
      })
      .catch(err => {
        helpers.response(res, 403, {'Error' : 'This email does not exist'});
      })
    } else {
      helpers.response(res, {'Error' : 'Missing required field(s)'});
    }
  });
});


app.all('/bet', (req, res) => {
  bet.start(req, res);
});


// app.get('/(\\w+)', (req, res) => {
//   helpers.response(res, 400, {'Error' : 'Not Found'})
// });




//Required data: token, email
app.get('/user', (req, res) => {
  const email = typeof (req.headers.email) == 'string' && req.headers.email.trim().length > 0  && /[\w+0-9._%+-]+@[\w+0-9.-]+\.[\w+]{2,3}/.test(req.headers.email.trim()) ? req.headers.email.trim() : false;

  if (email) {
    const token = typeof(req.headers.token) =='string' && req.headers.token.length == 20 ? req.headers.token : false;

    helpers.verifyToken(token, email, (tokenIsValid) => {
      if (tokenIsValid) {
        db.read('user', 'email', email)
        .then(dataUser => {
          const userObj = {
            'name' : dataUser[0].name,
            'email' : dataUser[0].email,
            'accessLevel' : dataUser[0].access
          }
          db.read('bet', 'id_user', dataUser[0].id)
          .then(betsData => {
            helpers.allMatch(betsData)
            .then(data => {
              userObj.bets = data
              helpers.response(res, 200, userObj)
            })
            .catch(err => console.log('err ' + err))
          })
          .catch(() => {
            userObj.bets = []
            helpers.response(res, 200, userObj)
          })
        })
        .catch(() => {
          helpers.response(res, 404)
        });
      } else {
        helpers.response(res, 403, {'Error' : 'Missing required token in header, or token is invalid'});
      }
    });
  } else {
    helpers.response(res, 403, {'Error' : 'Missing required field(s)'});
  }
});

//Get all competition
app.get('/competition', (req, res) => {
  db.read('competition')
  .then(compData => {
    helpers.response(res, 200, compData)
  })
  .catch((err) => {
    helpers.response(res, 403, err);
  })
});

app.get('/test/:id', (req, res) => {
  const id = req.params.id;
  
  db.read('competition', 'id', id)
    .then(data => {
      let objCompetition = data[0];
      db.read('match_', 'id_comp', id)
        .then((dataMatch) => {  
        objCompetition.matches = dataMatch;
        helpers.response(res, 200, objCompetition)
      })
      .catch(() => {
        objCompetition.matches = [];
        helpers.response(res, 200, objCompetition)
      });
    })
    .catch(err => {
      helpers.response(res, 404, err)
    })
});
app.listen(port, () => console.log(`Example app listening on port ${port}!`))