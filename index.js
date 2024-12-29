const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const port = process.env.PORT || 5000;

const corsOptions = {
  origin: ["http://localhost:5173"],
  credentials: true,
  optionSuccessStatus: 200,
};

//middleware
app.use(express.json());
app.use(cors(corsOptions));
app.use(cookieParser());

//custom middleware for verification token
const VerifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "Unauthorized Access" });

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gk0tgqc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    const jobsCollection = client.db("jobQuestDB").collection("allJobs");
    const appliedJobsCollection = client
      .db("jobQuestDB")
      .collection("appliedJobs");
    /***** Auth Related Api *****/
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      //Generate token
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    /***** clear cookie *****/
    app.get("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 0,
        })
        .send({ success: true });
    });

    /***** post a single job *****/
    app.post("/jobs", async (req, res) => {
      const job = req.body;
      const result = await jobsCollection.insertOne(job);
      res.send(result);
    });
    /***** post applied job *****/
    app.post("/applyJob", async (req, res) => {
      const appliedJob = req.body;
      const result = await appliedJobsCollection.insertOne(appliedJob);
      res.send(result);
    });

    /***** get all jobs *****/
    app.get("/jobs", async (req, res) => {
      const cursor = jobsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    /***** get all applied jobs *****/
    app.get("/appliedJobs/:email", VerifyToken, async (req, res) => {
      const email = req.params.email;
      const tokenEmail = req.user.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: "Not Authorized" });
      }
      const query = { applicantEmail: email };
      const cursor = appliedJobsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    /***** get all My posted jobs *****/
    app.get("/myJobs/:email", VerifyToken, async (req, res) => {
      const tokenEmail = req.user.email;
      const email = req.params.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: "Not Authorized" });
      }
      const query = { userEmail: email };
      const cursor = jobsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    //get a single data from db using job id
    app.get("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    /***** delete a sing job post *****/

    app.delete("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.deleteOne(query);
      res.send(result);
    });

    app.put("/job/:id", async (req, res) => {
      const id = req.params.id;
      const jobInfo = req.body;
      const query = { _id: new ObjectId(id) };
      const option = { upsert: true };
      const updateDoc = {
        $set: {
          jobTitle: jobInfo.jobTitle,
          photoURL: jobInfo.photoURL,
          jobCategory: jobInfo.jobCategory,
          salaryFrom: jobInfo.salaryFrom,
          salaryTo: jobInfo.salaryTo,
          deadline: jobInfo.deadline,
          jobDesc: jobInfo.jobDesc,
        },
      };
      const result = await jobsCollection.updateOne(query, updateDoc, option);
      res.send(result);
    });

    /***** increment applicant number *****/
    app.patch("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.updateOne(query, {
        $inc: {
          applicantsNumber: 1,
        },
      });
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.log);

app.get("/", (req, res) => {
  res.send("Job Quest server is running");
});

app.listen(port, () => {
  console.log(`Job Quest server is running on: ${port}`);
});
