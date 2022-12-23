
//import request to trigger the tweet at certain intervals (scheduled function call)
//cron job
// const request = require('request');

// ----1
// 
// var data = JSON.stringify(
//   {
//     "version":"6359a0cab3ca6e4d3320c33d79096161208e9024d174b2311e5a21b6c7e1131c",
//     "input":
//       {
//         "prompt":"a photo of an astronaut riding a horse on mars"
//       }
//   });

// var config = {
//   method: 'post',
//   url: 'https://api.replicate.com/v1/predictions',
//   headers: { 
//     'Authorization': 'Token $REPLICATE_API_TOKEN', 
//     'Content-Type': 'application/json'
//   },
//   data : data
// };

// axios(config)
// .then(function (response) {
//   console.log(JSON.stringify(response.data));
// })
// .catch(function (error) {
//   console.log(error);
// });




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



// ----4 - old function triggered by the pub/sub event
// functions.logger.info('Got a pubsub message');
// const data = message.data ? await Buffer.from(message.data, 'base64').toString() : 'ERR'
// // functions.logger.info({ data })
// // functions.logger.info({ context })


// // call text-to-art API's
// const url1 = 'http://localhost:5001/gioconda-363212/us-central1/successCall'
// const url2 = 'http://localhost:5001/gioconda-363212/us-central1/failedCall'
// request(url1, function (error, response) {
//     if (error) throw new Error(error);
//     functions.logger.info("runing the job dawgggf");
//     functions.logger.info(response.body);
// }); 

// functions.logger.info('Got a pubsub Task Completed');

// return null // returns nothing
 

// ----5



// ----6



// ----7
