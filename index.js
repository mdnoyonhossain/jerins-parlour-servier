const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.SECRET_STRIP_KEY);
const port = process.env.PORT || 5000;

const app = express();

// Midle Ware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.n3a0m.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function veryfyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('UnAuthorized Access');
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden Access' });
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        const servicesProductCollection = client.db('jerinsParlor').collection('services');
        const bookingCollection = client.db('jerinsParlor').collection('bookings');
        const reviewCollection = client.db('jerinsParlor').collection('reviews');
        const usersCollection = client.db('jerinsParlor').collection('users');
        const paymentsCollection = client.db('jerinsParlor').collection('payment');

        app.get('/services', async (req, res) => {
            const query = {};
            const services = await servicesProductCollection.find(query).toArray();
            res.send(services);
        });

        app.get('/homeServices', async (req, res) => {
            const query = {};
            const services = await servicesProductCollection.find(query).limit(3).toArray();
            res.send(services);
        });

        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const services = await servicesProductCollection.findOne(query);
            res.send(services);
        });

        app.post('/services', async (req, res) => {
            const service = req.body;
            const result = await servicesProductCollection.insertOne(service);
            res.send(result);
        });

        app.put('/services/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const service = req.body;
            const option = { upsert: true };
            const updatedDoc = {
                $set: {
                    productName: service.productName,
                    price: service.price,
                    productDescription: service.productDescription
                }
            }
            const result = await servicesProductCollection.updateOne(filter, updatedDoc, option);
            res.send(result);
        });

        app.delete('/services/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const result = await servicesProductCollection.deleteOne(filter);
            res.send(result);
        })

        app.get('/bookings', veryfyJWT, async (req, res) => {
            const email = req.query.email;
            const decodeEmail = req.decoded.email;
            if (email !== decodeEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            const query = { email: email };
            const bookings = await bookingCollection.find(query).toArray();
            res.send(bookings);
        });

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        });

        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.bookingId
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedResult = await bookingCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })

        app.get('/reviews', async (req, res) => {
            const query = {};
            const result = await reviewCollection.find(query).limit(3).toArray();
            res.send(result)
        });

        app.get('/more-testimonials', async (req, res) => {
            const query = {};
            const result = await reviewCollection.find(query).toArray();
            res.send(result)
        });
 
        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        });

        app.delete('/reviews/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const result = await reviewCollection.deleteOne(filter);
            res.send(result)
        })

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const users = await usersCollection.findOne(query);
            if (users) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1d' });
                return res.send({ accessToken: token });
            }
            res.status(401).send({ accessToken: 'unAuthorized' });
        });

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const users = await usersCollection.findOne(query);
            res.send({ isAdmin: users?.role === 'admin' });
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const users = await usersCollection.insertOne(user);
            res.send(users);
        });

        app.put('/users/admin', veryfyJWT, async (req, res) => {
            // email Query Role Check
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const userRole = await usersCollection.findOne(query);
            if (userRole?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' });
            }

            // email Query user
            const email = req.query.email;
            const filter = { email: email };
            const users = await usersCollection.findOne(filter);
            if (!users) {
                return res.status(401).send({ message: 'Email Not Exist !' })
            }

            const optios = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, optios);
            res.send(result);
        });

        app.get('/admin/book/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const book = await bookingCollection.findOne(query);
            res.send(book)
        })

        app.get('/admin/orders', async (req, res) => {
            const query = {};
            const orders = await bookingCollection.find(query).toArray();
            res.send(orders);
        });

        app.put('/admin/orders/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const status = req.body;
            const option = { upsert: true };
            const updatedDoc = {
                $set: {
                    status: status.status
                }
            }
            const result = await bookingCollection.updateOne(filter, updatedDoc, option);
            res.send(result);
        });

        app.delete('/admin/order/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const result = await bookingCollection.deleteOne(filter);
            res.send(result);
        })

    }
    finally {

    }
}
run().catch(console.log());

app.get('/', async (req, res) => {
    res.send('Jerins Parlour Server is Running');
})

app.listen(port, () => {
    console.log(`Jerins Parlour on Port ${port}`);
})