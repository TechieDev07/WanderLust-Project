const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log("GLOBAL KEY:", process.env.GEMINI_API_KEY);


// const fetch = require("node-fetch");
const express = require("express");
const app = express();
const mongoose = require("mongoose");
// const path = require("path");
const methodOverride = require("method-override")
const ejsMate = require("ejs-mate");
app.use(express.static(path.join(__dirname,"/public")));
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require('connect-mongo').default;
const flash = require("connect-flash"); 
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");


const dbUrl = process.env.ATLASDB_URL;

main()
   .then(() => {
    console.log("connected to DB");
    })
   .catch((err) => {
    console.log(err); 
    });


async function main() {
    await mongoose.connect(dbUrl)
}

app.engine('ejs', ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(methodOverride("_method"));

const store = MongoStore.create({
    mongoUrl: process.env.ATLASDB_URL,
    crypto: {
        secret: process.env.SECRET,
    },
    touchAfter: 24 * 3600,
});

store.on("error", () => {
    console.log("ERROR in MONGO SESSION STORE", err);
});

const sessionOptions = {
    store: store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    },
};

// app.get("/", (req, res) => {
//     res.send("Hi, I am root");
// }); 

app.use(session(sessionOptions));
app.use(flash()); 

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.success = req.flash("success"); 
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

app.get("/", (req, res) => {
    res.redirect("/listings");
});

app.use("/listings", listingRouter);  //as entire data of listing is in listing.js
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);

// ChatBot code
// app.post("/chat", async (req, res) => {
//     try {
//         console.log("BODY:", req.body);

//         const userMsg = req.body.message;

//         console.log("KEY:", process.env.GEMINI_API_KEY); // ✅ changed to GEMINI

//         const response = await fetch(
//             `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
//             {
//                 method: "POST",
//                 headers: {
//                     "Content-Type": "application/json" // ✅ removed x-api-key & anthropic-version (not needed for Gemini)
//                 },
//                 body: JSON.stringify({
//                     // ✅ removed claude model & max_tokens — Gemini uses different format
//                     systemInstruction: {
//                         parts: [{ text: "You are a helpful hotel booking assistant." }]
//                     },
//                     contents: [
//                         {
//                             role: "user",
//                             parts: [{ text: userMsg }] // ✅ Gemini uses parts[], not content
//                         }
//                     ]
//                 })
//             }
//         );

//         console.log("RAW RESPONSE STATUS:", response.status);

//         const data = await response.json();

//         console.log("API RESPONSE:", data);

//         if (!data.candidates) { // ✅ Gemini returns candidates[], not content[]
//             return res.json({
//                 reply: "Error: " + (data.error?.message || "Something went wrong")
//             });
//         }

//         res.json({
//             reply: data.candidates[0].content.parts[0].text // ✅ correct Gemini response path
//         });

//     } catch (err) {
//         console.log("ERROR:", err);
//         res.status(500).json({ reply: "Server error" });
//     }
// });


app.use((err, req, res, next) => {
    let {statusCode = 500, message = "Something went wrong!"} = err;
    res.status(statusCode).render("listings/error.ejs", { message });
    // res.status(statusCode).send(message);
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`server is listening on port ${PORT}`);
});