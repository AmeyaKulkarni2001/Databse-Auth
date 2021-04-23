require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");


const app = express();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine","ejs");
app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


mongoose.connect("mongodb://localhost:27017/userDB", {useUnifiedTopology: true, useNewUrlParser: true, useCreateIndex: true })
    .then(console.log("mongodb connected successfully"));

const userSchema = new mongoose.Schema({
  secret: String,
  email: String,
  password: String,
  googleId: String
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

app.get("/",function(req,res){
  res.render("home");
});

app.get("/auth/google", passport.authenticate('google', {
    scope: ["profile"]
}));

app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/secrets');
  });

app.get("/login",function(req,res){
  res.render("login");
});

app.post("/login",function(req,res){
  const user = new User({
    username:req.body.username,
    password:req.body.password
  });
  req.login(user,function(err){
    if(!err){
      passport.authenticate("local")(req,res,function(){
        res.redirect("/secrets");
      });
    } else {
      console.log(err);
      res.redirect("/login")
    }
  })
});

app.get("/register",function(req,res){
  res.render("register");
});

app.post("/register",function(req,res){
  User.register({username: req.body.username}, req.body.password, function(err,user){
    if(!err){
      passport.authenticate("local")(req,res,function(){
        res.redirect("/secrets");
      });
    } else {
      console.log(err);
      res.redirect("/register");
    }
  })
});

app.get("/secrets",function(req,res){
  User.find({"secret": {$ne: null}}, function(err, foundUsers){
    if(!err){
      if(foundUsers){
        res.render("secrets",{usersWithSecrets: foundUsers})
      }
    } else {
      console.log(err);
    }
  });
});

app.get("/yourSecrets",function(req,res){
  const id = req.user._id;
  User.find({"_id": id} , function(err, foundUsers){
    if(!err){
      if(foundUsers){
        res.render("yourSecrets", {usersWithSecrets: foundUsers});
      }
    } else {
      console.log(err);
    }
  });
});

app.get("/logout",function(req,res){
  req.logout();
  res.redirect("/");
});

app.get("/submit",function(req,res){
  if(req.isAuthenticated()){
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.post("/submit",function(req,res){
  const submittedSecret = req.body.secret;
  User.findById(req.user.id, function(err,foundUser){
    if(!err){
      if(foundUser){
        foundUser.secret = submittedSecret;
        foundUser.save(function(){
          res.redirect("/secrets");
        });
      }
    } else {
      console.log(err);
      res.redirect("/submit");
    }
  });
});






app.listen(3000,function(req,res){
  console.log("Server started at port 3000");
})
