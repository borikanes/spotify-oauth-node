// Code from https://github.com/bih/spotify-token-swap-service.git

const btoa = require("btoa"); // base64 encoder
const bodyParser = require("body-parser"); // allows us to take POST data in node
const axios = require("axios"); // http library
const qs = require("qs"); // querystring parsing
// const { encrypt, decrypt } = require("./crypto"); // encrypt/decrypt refresh_token
require('dotenv').config()

// express server
const express = require("express");
const app = express();

// environment variables
const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_CLIENT_CALLBACK_URL,
  ENCRYPTION_SECRET
} = process.env;
console.log(SPOTIFY_CLIENT_CALLBACK_URL)
// middleware
app.use(bodyParser.urlencoded({ extended: false }));

// accept form-urlencoded submissions
axios.interceptors.request.use(request => {
  console.log("In interceptors")
  if (request.data && request.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
    request.data = qs.stringify(request.data);
    console.log("QS STRINGIFIED-----------")
    console.log(request.data)
  }
  return request;
});

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", (_, response) => {
  response.set("Content-Type", "text/json");
  response.status(200).send("healthy as mug");
});

// POST /api/token
app.post("/api/token", async ({body: {code: authorization_code}}, response) => {
  console.log(authorization_code);
  const config = {
    method: "POST",
    url: "https://accounts.spotify.com/api/token",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + btoa(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET)
    },
    data: {
      grant_type: "authorization_code",
      redirect_uri: SPOTIFY_CLIENT_CALLBACK_URL,
      code: authorization_code
    }
  }
  try {
    let res = await axios(config);
    let data = res.data;
    console.log(data);
    response.set("Content-Type", "text/json").status(200).send(data);
  } catch(err) {
    console.log(err);
    console.log(err.data);
    response.set("Content-Type", "text/json").status(402).send(err.data);
  }
});

// POST /api/refresh_token
app.post("/api/refresh_token", async ({body: {refresh_token}}, response) => {
  console.log("-- Refresh token called-- ");
  const config = {
    method: "POST",
    url: "https://accounts.spotify.com/api/token",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + btoa(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET)
    },
    data: {
      grant_type: "refresh_token",
      // ▾▾▾ --- unencrypted code --- ▾▾▾
      refresh_token: refresh_token,

      // ▾▾▾ --- encrypted code --- ▾▾▾
      // refresh_token: decrypt(refresh_token, ENCRYPTION_SECRET),
    }
  }
  try {
    let res = await axios(config);
    let data = res.data;
    response.set("Content-Type", "text/json").status(200).send(data);
  } catch(err) {

    response.set("Content-Type", "text/json").status(402).send(err.data);
  }
});


// listen for requests :)
var listener = app.listen(8080, function () {
  console.log("Your app is listening on port " + listener.address().port);
});
