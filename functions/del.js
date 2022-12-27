
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


// function name(params) {
  // publish message to pubsub function with promt data 
  // publishes a pub/sub event
  // const pubsub = new PubSub()
  // await pubsub.topic('test-topic').publishMessage({
  //     json: { 
  //         id: tweet_id,
  //         text: promt
  //     },
  // })
// }

// https://blog.minimacode.com/publish-message-to-pubsub-emulator/
//function triggered by the pub/sub event
//function retry mechanism - https://firebase.google.com/docs/functions/retries
//MUST BE IDEMPOTENT
// exports.pubsubTriggeredFunction = functions.pubsub.topic('test-topic').onPublish((message, context) => {
// exports.pubsubTriggeredFunction = functions.runWith({failurePolicy: true}).pubsub.topic('test-topic').onPublish(async (message, context) => {
//     functions.logger.info('Got a pubsub message');
//     //keep state - how?


//     const data = message.data ? await Buffer.from(message.data, 'base64').toString() : 'ERR'
//     if (data == 'ERR'){
//         return null
//     }
//     const tweet_id = message.json.id
//     const promt = message.json.text

//     // call text-to-art API's - replicate
//     // replicate api doc - https://replicate.com/docs/reference/http
//     // replicate sd model - https://replicate.com/stability-ai/stable-diffusion/api#run
//     var param_data = JSON.stringify(
//     {
//         "version":"6359a0cab3ca6e4d3320c33d79096161208e9024d174b2311e5a21b6c7e1131c",
//         "input":
//         {
//             "prompt":promt
//         },
//         "webhook_completed": process.env.SD_CALLBACK_URL
//     });

//     var config = {
//     method: 'post',
//     url: 'https://api.replicate.com/v1/predictions',
//     headers: { 
//         'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`, 
//         'Content-Type': 'application/json'
//     },
//     data : param_data
//     };

//     const res = await axios(config)
//     functions.logger.info(res.data);

//     if (res == undefined){
//         return null
//     }
//     functions.logger.info(tweet_id,promt)
//     const sd_id = res.data.id

//     const snapshot = await dbRef2.where('id', '==', tweet_id).get();
//     // functions.logger.info(tweet_id,promt)


//     if (!(snapshot.empty)) {
//     // update its value for sd_url to the sd_id (temporarily until url is ready)
//     snapshot.forEach(async (doc) => {
//         functions.logger.info(doc.id, ' => ', doc.data());
//         const temp_doc_ref = await dbRef2.doc(doc.id);
//         await temp_doc_ref.update({sdUrl: sd_id});
//       });
//     }

//     return null // return nothing
// })



// ----6
//replicate a succesful api call
// exports.successCall = functions.https.onRequest(async (request,response)=>{ 
//     const data =  {
//             id: "123456",
//             text: "moving in the wind at 20000mph success call",
//             replied: false,
//             openAiUrl: '',
//             sdUrl: '',
//         }
//     response.send(data);
// });

// //replicate a failed api call
// exports.failedCall = functions.https.onRequest(async (request,response)=>{ 
//     const data =  undefined

//     response.status(503); //server down 
// });




// ----7
