/**
 * AUTHOR - TOBI
 * Create and Deploy Your First Cloud Functions - https://firebase.google.com/docs/functions/write-firebase-functions
 * Twitter API Response codes & Errors - https://developer.twitter.com/en/support/twitter-api/error-troubleshooting
 * API REFERENCE INDEX - https://developer.twitter.com/en/docs/api-reference-index
 * 
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { PubSub } = require("@google-cloud/pubsub");
//import request to trigger the tweet at certain intervals (scheduled function call)
const request = require('request');
var axios = require('axios');
require('dotenv').config()

//reference to document in firestore db
admin.initializeApp();
const dbRef = admin.firestore().doc(process.env.DB_REFERENCE); // rename tokenRef
const dbRef2 = admin.firestore().collection(process.env.DB_REFERENCE2); //rename tweetsRef
const callbackURL = process.env.CALLBACK_URL
// const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN

//init twitter api (using OAuth 2.0)
const TwitterApi = require("twitter-api-v2").default;
const twitterClient = new TwitterApi({
    clientId: process.env.CLIENT_ID ,
    clientSecret: process.env.CLIENT_SECRET,
}); 


// STEP 1 - Auth URL
//generate authentication link
exports.auth = functions.https.onRequest(async (request,response) => {
    
    const {url, codeVerifier, state} = twitterClient.generateOAuth2AuthLink(
        callbackURL,
        {scope: ["tweet.read", "tweet.write","users.read","offline.access"]}
    );

    //store verifier in db
    await dbRef.set({codeVerifier,state })

    response.redirect(url); //redirect to twitter
});

// STEP 2 - Verify callback code, store access_token 
// callback url
exports.callback = functions.https.onRequest(async (request,response) => {

    //grab state & code form url (url params)
    const {state, code} = request.query;

    // compare the state & code variables above to that stored in db
    const dbSnapshot = await dbRef.get();
    const {codeVerifier, state:storedState} = dbSnapshot.data();

    if (state !== storedState) {
        return response.status(400).send("Stored tokens do not match!")
    }

    const {
        client:loggedClient,
        accessToken,
        refreshToken,
    } = await twitterClient.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: callbackURL,
    });

    await dbRef.set({accessToken,refreshToken});

    const { data } = await loggedClient.v2.me(); // start using the client if you want

    response.send(data);

});

// STEP 3 - Refresh tokens, poll tweets and add to db if not exisit using tweet id
// add invididual tweet to db just like how its added to list of tweets
// change structure to only store tweet id and data 
// before adding check if tweet id exists 
// do i need list of tweets or maybe i do and i can change it to a hashmap/hashset 
exports.poll = functions.https.onRequest(async (request,response)=>{

    //refresh token to call twitter api with cron job 
    const{refreshToken} = (await dbRef.get()).data();

    const{
        client: refreshedClient,
        accessToken,
        refreshToken: newRefreshToken,
    } = await twitterClient.refreshOAuth2Token(refreshToken);

    await dbRef.set({accessToken,refreshToken:newRefreshToken});


    //search for tweets that meet certain criteria
    //API SEARCH TWEET https://twittercommunity.com/t/from-a-query-resending-to-obtain-a-oembed-twitter-api-v2-electron-nodejs/164231
    // API SEARCH TWEET https://developer.twitter.com/en/docs/twitter-api/tweets/search/api-reference/get-tweets-search-recent
    // BUILD QUERY - https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/build-a-query#examples
    // var res =  await refreshedClient.v2.search("in_reply_to_tweet_id:1603018284282138634 to:m1guelpf")
    var res = await refreshedClient.v2.get('tweets/search/recent', 
        { 
            query: "in_reply_to_tweet_id:1603018284282138634 to:m1guelpf", 
            max_results: 10, 
        });

    if (res.meta.next_token == undefined){
        functions.logger.info("next token is undefiend");
        res.data.map(async item => {
            // check if tweet id already exists in db
            const snapshot = await dbRef2.where('id', '==', item.id).get();
            functions.logger.info('Taking snapshot.');
            if (snapshot.empty) {
            functions.logger.info('No matching documents.');
            // push to db
            dbRef2.add(
                {
                    id: item.id,
                    text: item.text,
                    replied: false,
                    openAiUrl: '',
                    sdUrl: '',
                }
            )
            } 
        })
    }else{
        functions.logger.info("next token is defiend");
        // using the next token for polling - https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/paginate
        while (res.meta.next_token !== undefined) {
            //add tweets from API result to database (check if they already exists in db before adding)
            res.data.map(async item => {

                // check if tweet id already exists in db
                const snapshot = await dbRef2.where('id', '==', item.id).get();
                functions.logger.info('Taking snapshot.');
                if (snapshot.empty) {
                functions.logger.info('No matching documents.');
                // push to db
                dbRef2.add(
                    {
                        id: item.id,
                        text: item.text,
                        replied: false,
                        openAiUrl: '',
                        sdUrl: '',
                    }
                )

                //sleep for 5 seconds
                } 
            })
            // get the next 10 tweets using the next token (still insilde while loop)
            res = await refreshedClient.v2.get('tweets/search/recent', 
                { 
                    query: "in_reply_to_tweet_id:1603018284282138634 to:m1guelpf", 
                    max_results: 10,
                    next_token: res.meta.next_token,    
                });

        }
    }
    response.send({msg: "Data polled and added to DB"});
});


// STEP 4 - Trigger event (on addition to DB)- calling AI APIS with prompt text
// https://firebase.google.com/docs/functions/firestore-events
exports.callAPI = functions.firestore.document('tweets/{id}')
.onCreate(async (snap,context)=>{

    const newValue = snap.data();
    const tweet_id = newValue.id;
    const promt = newValue.text;

    // perform desired operations ...
    functions.logger.info('New data added to db');
    functions.logger.info(tweet_id);
    functions.logger.info(promt);

    // call text-to-art API's - replicate
    // replicate api doc - https://replicate.com/docs/reference/http
    // replicate sd model - https://replicate.com/stability-ai/stable-diffusion/api#run
    var param_data = JSON.stringify(
        {
            "version":"6359a0cab3ca6e4d3320c33d79096161208e9024d174b2311e5a21b6c7e1131c",
            "input":
            {
                "prompt":promt
            },
            "webhook_completed": process.env.SD_CALLBACK_URL
        });
    
        var config = {
        method: 'post',
        url: 'https://api.replicate.com/v1/predictions',
        headers: { 
            'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`, 
            'Content-Type': 'application/json'
        },
        data : param_data
        };
    
        const res = await axios(config)
        functions.logger.info(res.data);
    
        if (res == undefined){
            return null
        }
        functions.logger.info(tweet_id,promt)
        const sd_id = res.data.id
    
        const snapshot = await dbRef2.where('id', '==', tweet_id).get();
        // functions.logger.info(tweet_id,promt)
    
    
        if (!(snapshot.empty)) {
        // update its value for sd_url to the sd_id (temporarily until url is ready)
        snapshot.forEach(async (doc) => {
            functions.logger.info(doc.id, ' => ', doc.data());
            const temp_doc_ref = await dbRef2.doc(doc.id);
            await temp_doc_ref.update({sdUrl: sd_id});
          });
        }
    
        return null // return nothing

});



// STEP 5 - Use PubSub as Callback URL/Endpoint to recieve Image generated by SD - store image url in db
// Callback url from replicate, made posisble by using NGROX to create a https endpoint that forwards to this one 
// https://stackoverflow.com/questions/61614571/how-to-run-firebase-functions-emulator-on-https-instead-of-http
exports.sdCallback = functions.https.onRequest(async (request,response)=>{ 
    functions.logger.info("Finished prediction succesfully useing webhook");
    // functions.logger.info(request.body);
    functions.logger.info(request.body.id);
    functions.logger.info(request.body.output[0]);

    const sd_id = request.body.id
    sd_url = request.body.output[0]


    //query stored id in db in place or sd url & replace with img url
    const snapshot = await dbRef2.where('sdUrl', '==', sd_id).get();
    // functions.logger.info(sd_id,sd_url)


    if (!(snapshot.empty)) {
    // update its value for sd_url to the sd_url (url is ready)
    snapshot.forEach(async (doc) => {
        functions.logger.info(doc.id, ' => ', doc.data());
        const temp_doc_ref = await dbRef2.doc(doc.id);
        await temp_doc_ref.update({sdUrl: sd_url});
      });
    }

    //tweet image to twitter
    const tweetText = 
    `
    🤖 Here's your AI-generated image!

    Prompt: "PROMT_VAR"
    `

    const nextTweet = {
        "text": tweetText, 
        "media": 
            {"media_ids": ["1455952740635586573"]}}

    const { data } = await refreshedClient.v2.tweet(
        nextTweet
    );

    // response.send(data);
    functions.logger.info(`Tweeted data ${data}`);

    response.send({msg:'finished'});
});



//Testing:
exports.test = functions.https.onRequest(async (request,response)=>{ 
    // add data to db 
    dbRef2.add(
        {
            id: "123",
            text: "21 savage but a cartoon",
            replied: false,
            openAiUrl: '',
            sdUrl: '',
        }
    )

    response.send({msg:"For testing purposes"});
});


// Blockers:
// can't succesfully setup & test retry mechanism for function triggered by the pub/sub event - handle when api server is down. SQS type mechanism

//todo:
//set completed to true and check this before tweeting to make sure no duplciate replies/tweets
// cron job 
// tweet with media 
// remove @ mention and validate text
//validate data meets criteria -  user is following, 
//When adding Dalee2 in the future - Check both tweets have image urls before tweeting as reply to original tweet reply & set completed = True


// cron job - for polling tweets
// https://stackoverflow.com/questions/54323163/how-to-trigger-function-when-date-stored-in-firestore-database-is-todays-date
//https://www.youtube.com/watch?v=h79xrJZAQ6I


// -------
// exports.getAllData = functions.https.onRequest(async (request,response)=>{ 
//   //get all data from collection in database
//     const dbSnapshot = await dbRef2.get();
//     tweets = []

//     // map through results and call api with the text promts
//     dbSnapshot.docs.map(doc => 
//         {
//         //call api with doc.data().text
//         tweets.push(doc.data())
//         })

//     if (dbSnapshot !== undefined){
//         response.send(tweets);
//     } else{
//         response.send([]);
//     }

// });



// exports.pollHourly = functions.pubsub
//     .schedule("* * * * *") //every minute
//     .onRun((context) =>{
//         console.log("This new cron job is srating!");
//         functions.logger.info("Hello logs!");
//         const options = {
//         'method': 'GET',
//         'url': process.env.TWEET_FUNCTION_TRIGGER,
//         'headers': {
//         }
//         };
//         request(options, function (error, response) {
//             if (error) throw new Error(error);
//             console.log(response.body);
//             });

//         return null;
//     })