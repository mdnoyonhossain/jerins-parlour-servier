const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

const app = express();

// Midle Ware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.n3a0m.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
    try{
        const servicesProductCollection = client.db('jerinsParlor').collection('services');
        const bookingCollection = client.db('jerinsParlor').collection('bookings');
        const reviewCollection = client.db('jerinsParlor').collection('reviews');
        const usersCollection = client.db('jerinsParlor').collection('users');
        
        app.get('/services', async(req, res) => {
            const query = {};
            const services = await servicesProductCollection.find(query).toArray();
            res.send(services);
        });

        app.get('/homeServices', async(req, res) => {
            const query = {};
            const services = await servicesProductCollection.find(query).limit(3).toArray();
            res.send(services);
        });
        
        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const services = await servicesProductCollection.findOne(query);
            res.send(services);
        });

        app.get('/bookings', async (req, res) => {
            const email = req.query.email;
            const query = {email: email};
            const bookings = await bookingCollection.find(query).toArray();
            res.send(bookings);
        });

        app.post('/bookings', async(req, res) => {
            const booking = req.body;
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        });

        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        });

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = {email: email};
            const users = await usersCollection.findOne(query);
            if(users){
                const token = jwt.sign({email}, process.env.ACCESS_TOKEN, {expiresIn: '1h'});
                return res.send({accessToken: token});
            }
            res.status(401).send({accessToken: 'unAuthorized'});
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const users = await usersCollection.insertOne(user);
            res.send(users);
        });

    }
    finally{

    }
}
run().catch(console.log());

app.get('/', async (req, res) => {
    res.send('Jerins Parlour Server is Running');
})

app.listen(port, () => {
    console.log(`Jerins Parlour on Port ${port}`);
})