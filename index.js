import { MongoClient } from 'mongodb';
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

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/users', async(req,res)=>{
    const result = await users.find({}).toArray();
    res.send(result);
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});