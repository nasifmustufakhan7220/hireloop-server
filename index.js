import { MongoClient, ObjectId } from 'mongodb';
import express from "express";
import "dotenv/config";
import cors from "cors";
import  Stripe  from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = 5000;



app.use(cors());
app.use(express.json());


const client = new MongoClient(`mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@ac-uu7ruvv-shard-00-00.vwk5wcf.mongodb.net:27017,ac-uu7ruvv-shard-00-01.vwk5wcf.mongodb.net:27017,ac-uu7ruvv-shard-00-02.vwk5wcf.mongodb.net:27017/?ssl=true&replicaSet=atlas-1389v7-shard-0&authSource=admin`);


export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const connectMongoClient = await connectToMongoDB();
const db = connectMongoClient.db("hireloopDB");
const users = db.collection("user");
const sessions = db.collection("session");
const jobs = db.collection("jobs");
const applications = db.collection("applications");
const payments = db.collection("payments");

const verifyToken = async(req,res,next)=>{
  const authHeader = req.headers.authorization;
  if(!authHeader){
    res.status(401).send({message: "Unathourized"});
    return;
  }
  const token = authHeader.split(" ")[1];

  if(!token){
    res.status(401).send({message: "Unathourized"});
    return
  };


  const session = await sessions.findOne({token});

  if(!session){
    res.status(401).send({message: "Unathourized"});
    return
  };

  const user = await users.findOne({_id: new ObjectId(session.userId)});
  if(!user){
    res.status(401).send({message: "Unathourized"});
    return
  };

  req.user = user;
  next()
}

app.get('/', (req, res) => {
  res.send('Hello World!');
});
//users api
app.get('/users', async(req,res)=>{
    const result = await users.find({}).toArray();
    res.send(result);
});

app.get('/users/:id/premium', async(req,res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)};
  const result = await users.findOne(query, {projection: {premium: 1}});
  res.send(result);
})

app.patch('/users/:id/role', async(req,res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)};
  const updateRole = {
    $set:{
      role: req.body.role
    }
  }

  const result = await users.updateOne(query, updateRole);
  res.send(result);
})



app.get('/jobs', async (req,res)=>{
  const query = {};
  if(req.query){
    if(req.query.jobType){
      query.jobType = req.query.jobType;
    }

    if(req.query.remoteWork){
      query.remoteWork = req.query.remoteWork === 'true';
    }

    if(req.query.jobCategory){
      query.jobCategory = req.query.jobCategory;
    }

    if(req.query.recruiterId){
      query.recruiterId = req.query.recruiterId
    }

    if(req.query.search){
      query.$or=[
        {title: {$regex: req.query.search, $options: 'i'}},
        {responsibilities: {$regex: req.query.search, $options: 'i'}},
        {qualifications: {$regex: req.query.search, $options: 'i'}},
        {jobCategory: {$regex: req.query.search, $options: 'i'}},
        {companyName: {$regex: req.query.search, $options: 'i'}}
      ]
    }

  }
  const result = await jobs.find(query).toArray();
  res.send(result);
})

app.post('/jobs', async(req,res)=>{
  const job = req.body;
  const result = await jobs.insertOne(job);
  res.send(result); 
});

app.get('/jobs/:id', async(req,res)=>{
  const id = req.params.id;
  const result = await jobs.findOne({_id: new ObjectId(id)});
  res.send(result);
})
app.delete("/jobs/:id", async(req,res)=>{
  const {id} = req.params;
  const result = await jobs.deleteOne({_id: new ObjectId(id)});
  res.send(result);
});

app.patch("/jobs/:id", async(req,res)=>{
  const id = new ObjectId(req.params.id);
  const updateJob = req.body;
  const result = await jobs.updateOne({_id: id}, {$set: updateJob});
  res.send(result);
});




// application apis
app.get('/applications', verifyToken ,async(req,res)=>{
  const query = {};
  if(req.query.applicantId){
    query.applicantId = req.query.applicantId;
  }

  if(req.query.jobId){
    const jobsQuery = await jobs.findOne({_id: new ObjectId(req.query.jobId)});

    if(jobsQuery.recruiterId !== req.user._id.toString() && req.user.role !== "admin"){
      res.status(403).send({message: "Forbidden"});
      return
    }
    query.jobId = req.query.jobId
  }
  const result = await applications.find(query).toArray();
  res.send(result);
});

app.get("/applications/count", async(req,res)=>{
  const query = {};

  if(req.query.applicantId){
    query.applicantId = req.query.applicantId;
  }

  const result = await applications.countDocuments(query);

  res.send({count: result});
})

app.patch(`/applications/:id`, async(req,res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)};
  const updateStatus = req.body;
  const result = await applications.updateOne(query, {$set:updateStatus});
  res.send(result);
})

app.post('/applications', async(req,res)=>{
  const applicationData = req.body;
  const result = await applications.insertOne(applicationData);
  res.send(result);
});


//payments api

app.post(`/payments/checkout-verify`, async(req,res)=>{
  const {sessionId} = req.body;
  if(!sessionId){
    res.send({success: false, message: 'session Id is required'});
  }
  const {
    status,
    payment_status,
    customer_email,
    metadata,
    payment_intent,
    
  } = await stripe.checkout.sessions.retrieve(sessionId);

  if(status === "complete" && payment_status === "paid"){

    const sessionQuery = {sessionId};

    const exitingPayment = await payments.findOne(sessionQuery);

    if(exitingPayment){
      return res.send({success: false, message: 'Payment already verified'});
    }

    const payment = {
      sessionId,
      status,
      payment_status,
      customer_email,
      userId:metadata.userId,
      payment_intent,
      payment_date: new Date()
    }

    const result = await payments.insertOne(payment);

    const query = {_id: new ObjectId(metadata.userId)};

    const updatedDoc = {
      $set:{
        premium: true,
      }
    }

    const updatedResult = await users.updateOne(query, updatedDoc);

    res.send({success: true, result, updatedResult});
    return
  }

  res.send({success: false, message: 'Payment verification failed'});
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});