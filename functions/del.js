
//import request to trigger the tweet at certain intervals (scheduled function call)
//cron job
// const request = require('request');

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



// ----4 - get all data from db collection
  // //get all data from collection in database
    // const dbSnapshot = await dbRef2.get();
    // tweets = []

    // //map through results and call api with the text promts
    // dbSnapshot.docs.map(doc => 
    //     {
    //     //call api with doc.data().text
    //     tweets.push(doc.data())
    //     })




    // if (dbSnapshot !== undefined){
    //     response.send(tweets);
    // } else{
    //     response.send([]);
    // }
    
 

// ----5



// ----6



// ----7
