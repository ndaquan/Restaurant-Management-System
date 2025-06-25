require("dotenv").config();
const session = require("express-session");
const MongoStore = require("connect-mongo");

const dbUri = process.env.DB_URI;
const sessionSecret = process.env.SESSION_SECRET;
const ageSession = Number(process.env.AGE_SESSION);

const sessionMiddleware = session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: dbUri,
  }),
  cookie: {
    maxAge: ageSession,
  },
});

module.exports = sessionMiddleware;
