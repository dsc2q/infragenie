const pg = require('pg');
const redis = require('redis');

const dbUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;

const express = require('express');
const app = express();

app.get('/api/v1/users', (req, res) => {
  res.send('List of users');
});

app.post('/webhook/stripe-events', (req, res) => {
  res.send('Event received');
});

app.listen(3000, () => {
  console.log('App running on port 3000');
});
