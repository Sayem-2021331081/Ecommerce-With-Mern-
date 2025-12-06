const express = require('express');
const router = require('./src/routes/api');
const app = new express();

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');

const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const path = require("path");






let URI="mongodb+srv://sayem:12345@cluster0.jqx4voa.mongodb.net/MernEcommerce";
//let option={user:'Rup774827',pass:'Rup774827',autoIndex:true}
// let URI = "mongodb://localhost:27017/ecom4"
let option = { user: '', pass: "", autoIndex: true };
mongoose.connect(URI, option).then((res) => {
    console.log("Database Connected")
}).catch((err) => {
    console.log(err)
})


app.use(cookieParser());

const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
    origin: allowedOrigin,
    credentials: true
}))
app.use(helmet())
app.use(mongoSanitize())
app.use(xss())
app.use(hpp())

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 3000 })
app.use(limiter)

app.set('etag', false);
app.use("/api/v1", router)

app.use(express.static('client/dist'));

// Add React Front End Routing
app.get('*', function (req, res) {
    res.sendFile(path.resolve(__dirname, 'client', 'dist', 'index.html'))
})

module.exports = app;