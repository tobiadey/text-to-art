
//import request to trigger the tweet at certain intervals (scheduled function call)
//cron job
// const request = require('request');

const citiesRef = db.collection('cities');
const snapshot = await citiesRef.where('capital', '==', true).get();
if (snapshot.empty) {
  console.log('No matching documents.');
  return;
}  

snapshot.forEach(doc => {
  console.log(doc.id, '=>', doc.data());
});index.js

// ----1
// conversation_id:1334987486343299072



// ----2
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });



// ----3
// const { data } = await refreshedClient.v2.tweet(nextTweet);
// https://developer.twitter.com/en/docs/twitter-api/tweets/lookup/api-reference/get-tweets#tab1
// const { data } = await refreshedClient.v2.tweets("1503335964067909632",
//     {
//         //A comma separated list of fields to expand.
//         expansions: ["author_id"],

//         //A comma separated list of User fields to display.
//         "user.fields": ["created_at", "description", "name","username"],

//         //A comma separated list of Tweet fields to display.
//         "tweet.fields": ["created_at", "lang", "conversation_id"],
//     })



// ----4
 

// ----5



// ----6



// ----7
