import { MongoClient, ObjectId } from 'mongodb';
import express from "express";
import "dotenv/config";
import cors from "cors"
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
const jobs = db.collection("jobs");
const applications = db.collection("applications");

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/users', async(req,res)=>{
    const result = await users.find({}).toArray();
    res.send(result);
});



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
app.post('/applications', async(req,res)=>{
  const applicationData = req.body;
  const result = await applications.insertOne(applicationData);
  res.send(result);
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});