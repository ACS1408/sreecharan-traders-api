const serverless = require("serverless-http");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const User = require("./models/users");
const generateReferralId = require("./logic/generateReferralId");
const adminData = require("./models/admin");

const jwt = require("jsonwebtoken");

const app = express();

dotenv.config();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors());
app.options("*", cors());

const PORT = process.env.PORT || 8080;
const dbURI = process.env.MONGODB_URL;
mongoose
  .connect(dbURI)
  .then((result) =>
    app.listen(PORT, () => {
      console.log(`Server started on port ${PORT}`);
    })
  )
  .catch((err) => console.log(err));

// Authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token === null) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = { name: username };
  if (username === adminData?.username && password === adminData?.password) {
    const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET);
    res.json({ accessToken });
  } else {
    res.status(401).json({ message: "Invalid username or password" });
  }
});

// Get User
app.get("/api/users", authenticateToken, (req, res) => {
  User.find()
    .sort({ createdAt: -1 })
    .then((result) => {
      console.log(`fetch success: ${result?.length} results found`);
      res.json(result);
    })
    .catch((err) => console.log("fetch failed", err));
});

// Add User
app.post("/api/users", authenticateToken, (req, res) => {
  const updatedData = {
    referral_id: generateReferralId(req.body.name),
    ...req.body,
  };
  const newUser = new User(updatedData);
  newUser
    .save()
    .then((result) => {
      console.log(result, "post success");
      res.status(201).send(result);
    })
    .catch((err) => {
      console.log("post failed", err);
      res.status(500).send(err);
    });
});

// Delete User
app.delete("/api/users/:id", (req, res) => {
  const id = req.params.id;
  User.findByIdAndDelete(id)
    .then((result) => {
      if (!result) {
        return res.status(404).send({ message: "User not found" });
      }
      console.log(result, "delete success");
      res.status(200).send({
        message: "User successfully removed",
        transactionId: id,
      });
    })
    .catch((err) => {
      console.log("remove failed", err);
      res.status(500).send(err);
    });
});

// Update User
// app.put("/api/users/:id", (req, res) => {
//   const id = req.params.id;
//   User.findByIdAndUpdate(id, req.body, { new: true })
//     .then((result) => {
//       if (!result) {
//         return res.status(404).send({ message: "User not found" });
//       }
//       console.log(result, "update success");
//       res.status(200).send({
//         message: "User successfully updated",
//         transaction: result,
//       });
//     })
//     .catch((err) => {
//       console.log("update failed", err);
//       res.status(500).send(err);
//     });
// });

// Search referral id
app.get("/api/users/search/:referralId", async (req, res) => {
  try {
    const referralId = req.params.referralId;
    const searchedUser = await User.findOne({ referral_id: referralId });

    if (!searchedUser) {
      return res.status(404).send("Invalid Referral ID");
    }

    res.json(searchedUser);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

exports.handler = serverless(app);
