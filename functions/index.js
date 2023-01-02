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
const axios = require('axios');
const fs = require('fs');
const { Buffer } = require("buffer");
require('dotenv').config()

//reference to document in firestore db
admin.initializeApp();
const dbRef_token_v1 = admin.firestore().doc(process.env.DB_REFERENCE_AUTH1); 
const dbRef_token_v2 = admin.firestore().doc(process.env.DB_REFERENCE_AUTH2); 
const dbRef_tweets = admin.firestore().collection(process.env.DB_REFERENCE_TWEETS); 
const callbackURL_v1 = process.env.CALLBACK_URL_V1
const callbackURL = process.env.CALLBACK_URL

//init twitter api (using OAuth 2.0)
const TwitterApi = require("twitter-api-v2").default;
const twitterClient_v1 = new TwitterApi({ 
    appKey: process.env.API_KEY , 
    appSecret: process.env.API_SECRET
});
const twitterClient = new TwitterApi({
    clientId: process.env.CLIENT_ID ,
    clientSecret: process.env.CLIENT_SECRET,
}); 


// Authentication workflows for v1 & v2 twitterapi - https://github.com/PLhery/node-twitter-api-v2/blob/master/doc/auth.md#collect-temporary-access-tokens-and-get-persistent-tokens
// Auth URL Twitter V1
//generate authentication link
exports.auth1 = functions.https.onRequest(async (request,response) => {

    const authLink = await twitterClient_v1.generateAuthLink(
        callbackURL_v1,
        { linkMode: 'authorize' }
    );

    // Use URL generated
    const url = authLink.url;
    const oauth_token = authLink.oauth_token
    const oauth_token_secret = authLink.oauth_token_secret

    // store verifier in db
    await dbRef_token_v1.set({oauth_token,oauth_token_secret})

    response.redirect(url); //redirect to twitter

});

// Auth URL Twitter V2
//generate authentication link
exports.auth2 = functions.https.onRequest(async (request,response) => {
    const {url, codeVerifier, state} = twitterClient.generateOAuth2AuthLink(
        callbackURL,
        {scope: ["tweet.read", "tweet.write","users.read","offline.access"]}
    );
    //store verifier in db
    await dbRef_token_v2.set({codeVerifier,state})

    response.redirect(url); //redirect to twitter
});

// CALLBACK URL Twitter V1
// Verify callback code, store access_token 
exports.callbackv1 = functions.https.onRequest(async (request,response) => {

    // Extract tokens from query string
    const { oauth_token, oauth_verifier } = request.query;
    // Get the saved oauth_token_secret from session
    const{oauth_token_secret} = (await dbRef_token_v1.get()).data();


    if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
        return response.status(400).send('You denied the app or your session expired!');
    }

    // Obtain the persistent tokens
    // Create a client from temporary tokens
    const twitterClient_v1 = new TwitterApi({
        appKey: process.env.API_KEY,
        appSecret: process.env.API_SECRET,
        accessToken: oauth_token,
        accessSecret: oauth_token_secret,
      });

    // loggedClient is an authenticated client on behalf of some user
    const { 
    client: loggedClient, 
    accessToken, 
    accessSecret } 
    = await twitterClient_v1.login(oauth_verifier)


    // Store accessToken & accessSecret somewhere
    await dbRef_token_v1.set({v1_accessToken:accessToken,accessSecret})
    client = await loggedClient.currentUser(); // start using the client if you want


    response.send({msg:"finished execution"});
});

// CALLBACK URL Twitter V2
// Verify callback code, store access_token 
exports.callback = functions.https.onRequest(async (request,response) => {

    //grab state & code form url (url params)
    const {state, code} = request.query;

    // compare the state & code variables above to that stored in db
    const dbSnapshot = await dbRef_token_v2.get();
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

    await dbRef_token_v2.set({accessToken,refreshToken});

    const data = await loggedClient.v2.me(); // start using the client if you want

    response.send(data);

});

// Refresh tokens, poll tweets and add to db if not exisit using tweet id
// add invididual tweet to db just like how its added to list of tweets
// change structure to only store tweet id and data 
// before adding check if tweet id exists 
// do i need list of tweets or maybe i do and i can change it to a hashmap/hashset 
exports.poll = functions.https.onRequest(async (request,response)=>{

    //refresh token to call twitter api with cron job 
    const{refreshToken} = (await dbRef_token_v2.get()).data();

    const{
        client: refreshedClient,
        accessToken,
        refreshToken: newRefreshToken,
    } = await twitterClient.refreshOAuth2Token(refreshToken);

    // Store refreshed {accessToken} and {newRefreshToken} to replace the old ones
    await dbRef_token_v2.set({accessToken,refreshToken:newRefreshToken});


    //search for tweets that meet certain criteria
    //API SEARCH TWEET https://twittercommunity.com/t/from-a-query-resending-to-obtain-a-oembed-twitter-api-v2-electron-nodejs/164231
    // API SEARCH TWEET https://developer.twitter.com/en/docs/twitter-api/tweets/search/api-reference/get-tweets-search-recent
    // BUILD QUERY - https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/build-a-query#examples
    // var res =  await refreshedClient.v2.search("in_reply_to_tweet_id:1603018284282138634 to:m1guelpf")
   
    const tweet_id = "1609870460396634112"
    const author = "adey_of"
    var res = await refreshedClient.v2.get('tweets/search/recent', 
        { 
            // query: "in_reply_to_tweet_id:1603018284282138634 to:m1guelpf", 
            query: `in_reply_to_tweet_id:${tweet_id} to:${author}`, 
            max_results: 10, 
        });
    // functions.logger.info(res);
    
    if (res.data == undefined){
        functions.logger.info("res is undefiend");
        response.send({msg: "No data added as none meet search criteria"});

    }else if (res.meta.next_token == undefined){
        functions.logger.info("next token is undefiend");
        res.data.map(async item => {
            // check if tweet id already exists in db
            const snapshot = await dbRef_tweets.where('id', '==', item.id).get();
            functions.logger.info('Taking snapshot.');
            if (snapshot.empty) {
            functions.logger.info('No matching documents.');
            // push to db
            dbRef_tweets.add(
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
        response.send({msg: "Data polled and added to DB"});
    
    }else{
        functions.logger.info("next token is defiend");
        // using the next token for polling - https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/paginate
        while (res.meta.next_token !== undefined) {
            //add tweets from API result to database (check if they already exists in db before adding)
            res.data.map(async item => {

                // check if tweet id already exists in db
                const snapshot = await dbRef_tweets.where('id', '==', item.id).get();
                functions.logger.info('Taking snapshot.');
                if (snapshot.empty) {
                functions.logger.info('No matching documents.');
                // push to db
                dbRef_tweets.add(
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
                    // query: "in_reply_to_tweet_id:1603018284282138634 to:m1guelpf", 
                    query: `in_reply_to_tweet_id:${tweet_id} to:${author}`, 
                    max_results: 10,
                    next_token: res.meta.next_token,    
                });

        }
        response.send({msg: "Data polled and added to DB"});
    }
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
    
        const snapshot = await dbRef_tweets.where('id', '==', tweet_id).get();
        // functions.logger.info(tweet_id,promt)
    
    
        if (!(snapshot.empty)) {
        // update its value for sd_url to the sd_id (temporarily until url is ready)
        snapshot.forEach(async (doc) => {
            functions.logger.info(doc.id, ' => ', doc.data());
            const temp_doc_ref = await dbRef_tweets.doc(doc.id);
            await temp_doc_ref.update({sdUrl: sd_id});
          });
        }
    
        return null // return nothing

});



// STEP 5 - Use PubSub as Callback URL/Endpoint to recieve Image generated by SD - store image url in db
// Callback url from replicate, made posisble by using NGROX to create a https endpoint that forwards to this one 
// https://stackoverflow.com/questions/61614571/how-to-run-firebase-functions-emulator-on-https-instead-of-http
exports.sdCallback = functions.https.onRequest(async (request,response)=>{ 
    functions.logger.info("Finished prediction succesfully using webhook");
    // functions.logger.info(request.body);
    functions.logger.info(request.body.id);
    functions.logger.info(request.body.output[0]);

    const sd_id = request.body.id
    sd_url = request.body.output[0]


    //query stored id in db in place or sd url & replace with img url
    const snapshot = await dbRef_tweets.where('sdUrl', '==', sd_id).get();
    // functions.logger.info(sd_id,sd_url)

    var in_reply_to_tweet_id = undefined
    var promt_text = undefined
    if (!(snapshot.empty)) {
    // update its value for sd_url to the sd_url (url is ready)
    snapshot.forEach(async (doc) => {
        functions.logger.info(doc.id, ' => ', doc.data());
        functions.logger.info(doc.data().id);
        in_reply_to_tweet_id = doc.data().id;
        promt_text = doc.data().text;
        const temp_doc_ref = await dbRef_tweets.doc(doc.id);
        await temp_doc_ref.update({sdUrl: sd_url});
      });
    }

    functions.logger.info(in_reply_to_tweet_id);
    functions.logger.info(promt_text);

    
    //upload image to twitter 
    //client for v1
    const{v1_accessToken,accessSecret} = (await dbRef_token_v1.get()).data();

    const client = new TwitterApi({
        appKey: process.env.API_KEY,
        appSecret: process.env.API_SECRET,
        accessToken: v1_accessToken,
        accessSecret: accessSecret,
        });
    
    //refresh v2 tokens to create new client
    //refresh token to call twitter api with cron job 
    const{refreshToken} = (await dbRef_token_v2.get()).data();

    const{
        client: refreshedClient,
        accessToken,
        refreshToken: newRefreshToken,
    } = await twitterClient.refreshOAuth2Token(refreshToken);

    // Store refreshed {accessToken} and {newRefreshToken} to replace the old ones
    await dbRef_token_v2.set({accessToken,refreshToken:newRefreshToken});

    
    // const url = 'https://replicate.delivery/pbxt/YRk1vWdWAl5IJdCh4vhANlFCNflFaVFUEfoC5yMpOF0sG3MQA/out-0.png'
    const url = sd_url
    const imageResponse = await axios.get(url, {responseType: "arraybuffer"})
    const base64image = await new Buffer.from(imageResponse.data);
    // Through a Buffer
    const mediaId = await client.v1.uploadMedia(base64image, { mimeType:'png' });
    functions.logger.info(mediaId)
    
    const tweetText = 
    `
    🤖 Here's your AI-generated image!
    
    Prompt: ${promt_text}
    `

    // const nextTweet = {
    //     "text": tweetText, 
    //     media: 
    //     { media_ids: [mediaId] }, 
    //     reply:
    //     {in_reply_to_tweet_id: '1609870460396634112'},
        
    // }

    const nextTweet = {
        "text": tweetText, 
        media: 
        { media_ids: [mediaId] }, 
        reply:
        {in_reply_to_tweet_id: in_reply_to_tweet_id},
        
    }

    const { data } = await refreshedClient.v2.tweet(
        nextTweet
    );

    //tweet reply with image as media
    response.send({msg:'finished'});
});




//Testing:
// https://github.com/PLhery/node-twitter-api-v2/blob/master/doc/examples.md
exports.test = functions.https.onRequest(async (request,response)=>{ 

    //client for v1
    const{v1_accessToken,accessSecret} = (await dbRef_token_v1.get()).data();

    const client = new TwitterApi({
        appKey: process.env.API_KEY,
        appSecret: process.env.API_SECRET,
        accessToken: v1_accessToken,
        accessSecret: accessSecret,
      });

    //refresh v2 tokens to create new client
    //refresh token to call twitter api with cron job 
    const{refreshToken} = (await dbRef_token_v2.get()).data();

    const{
        client: refreshedClient,
        accessToken,
        refreshToken: newRefreshToken,
    } = await twitterClient.refreshOAuth2Token(refreshToken);

    // Store refreshed {accessToken} and {newRefreshToken} to replace the old ones
    await dbRef_token_v2.set({accessToken,refreshToken:newRefreshToken});



    const url = 'https://replicate.delivery/pbxt/YRk1vWdWAl5IJdCh4vhANlFCNflFaVFUEfoC5yMpOF0sG3MQA/out-0.png'
    const imageResponse = await axios.get(url, {responseType: "arraybuffer"})
    const base64image = await new Buffer.from(imageResponse.data);
    // Through a Buffer
    const mediaId = await client.v1.uploadMedia(base64image, { mimeType:'png' });
    functions.logger.info(mediaId)
    
    const tweetText = 
    `
    🤖 Here's your AI-generated image!

    Prompt: "PROMT_VAR"
    `

    const nextTweet = {
        "text": tweetText, 
        media: 
        { media_ids: [mediaId] }, 
        reply:
        {in_reply_to_tweet_id: '1609870460396634112'},
        
    }
    

    const { data } = await refreshedClient.v2.tweet(
        nextTweet
    );

    response.send({msg:'finished'});

  });
  

const dbRef_ends = admin.firestore().collection(process.env.DB_REFERENCE_ENDS); 
exports.test2 = functions.https.onRequest(async (request,response)=>{ 
//   add data to db 

// "21 savage but a cartoon"
    const title = 'new-tweet-one'
    dbRef_tweets.doc(title).set(
        {
            id: '1609870893773213698',
            text: "portrait photo of a asia old warrior chief, tribal panther make up, blue on red, side profile",
            replied: false,
            openAiUrl: '',
            sdUrl: '',
        }
    )

    response.send({msg:'finished'});

});



// Blockers:
//make sure id is text!!
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




// Upload the image to Twitter
// client.post('media/upload', {
//   media: imageData,
// }, (err, data, response) => {
//   if (err) {
//     console.log(err);
//   } else {
//     // Get the media ID of the uploaded image
//     const mediaId = data.media_id_string;

//     // Post a tweet reply with the media ID
//     client.post('statuses/update', {
//       status: 'Hello, world! This is my first tweet reply with media 📸',
//       media_ids: mediaId,
//       in_reply_to_status_id: '[TWEET_ID_TO_REPLY_TO]',
//     }, (err, data, response) => {
//       if (err) {
//         console.log(err);


    // add data to db 
    // dbRef2.add(
    //     {
    //         id: "123",
    //         text: "21 savage but a cartoon",
    //         replied: false,
    //         openAiUrl: '',
    //         sdUrl: '',
    //     }
    // )


// Proof i need v1 to upload img 
// https://twittercommunity.com/t/how-to-show-an-image-in-a-v2-api-tweet/163169
// https://twittercommunity.com/t/post-tweet-media-upload-in-v2/148590/16


// V1/V2 Github docs
// https://github.com/PLhery/node-twitter-api-v2
// https://github.com/PLhery/node-twitter-api-v2/blob/master/doc/examples.md
// https://github.com/PLhery/node-twitter-api-v2/blob/master/doc/examples.md#Withusercredentialsactasaloggeduser
// https://github.com/PLhery/node-twitter-api-v2/blob/master/doc/auth.md#collect-temporary-access-tokens-and-get-persistent-tokens



// ---

  // //refresh v1 tokens to call twitter api
   
    // const mediaId = await client.v1.uploadMedia('/Users/tobiadewunmi/Desktop/Gioconda/functions/src/test.png');
    // const mediaId = await v1Client.v1.uploadMedia('./src/test.png');

    // // Read the image from url and turn into a base64 image 
    // const url = 'https://replicate.delivery/pbxt/YRk1vWdWAl5IJdCh4vhANlFCNflFaVFUEfoC5yMpOF0sG3MQA/out-0.png'
    // const url2 = '/Users/tobiadewunmi/Desktop/Gioconda/functions/src/test.png'
    // // const imageResponse = await axios.get(url, {responseType: "arraybuffer"})
    // // const base64image = new Buffer.from(imageResponse.data).toString('base64');
    // // const rawBinImage = imageResponse.data;
    // // functions.logger.info(base64image);
    // // functions.logger.info(rawBinImage);

    // // //i already have elevated access
    // // //buid an auth1 workflow and all this client call the v1 endpoints 
    // // //rename the different clinets to v1 or v2 and implemtnet db docs to store their refresh tokens
    // // uploadClient.v1.tweet('twitter-api-v2 is awesome!');
    

    // const{accessToken,accessSecret} = (await dbRef_token_v1.get()).data();

    // const client = new TwitterApi({
    //     appKey: process.env.API_KEY,
    //     appSecret: process.env.API_SECRET,
    //     accessToken: accessToken,
    //     accessSecret: accessSecret,
    //   });

    
    // // await client.v1.tweet('Hello, this is a test.');

    // // You can upload media easily!
    // // const upload_res = await client.v1.uploadMedia({file:rawBinImage,type:'png'});
    // const upload_res = await client.v1.uploadMedia(url2);

    // // upload_res = await client.post('media/upload', 
    // // { 
    // //     media_data: base64image
    // // }, 
    // // (error, media, response)=> {
    // //     if (!error){
    // //         functions.logger.info("working");
    // //         functions.logger.info(media);

    // //     }else{
    // //         functions.logger.info("error");
    // //         functions.logger.error(error);
    // //         functions.logger.error(response);

    // //     }

    // // });

    // client.v1.get('account/verify_credentials', {}, function(error, data, response) {
    //     if (!error){
    //         functions.logger.info("working");
    //         functions.logger.info(data);

    //     }else{
    //         functions.logger.info("error");
    //         functions.logger.error(error);
    //         functions.logger.error(response);

    //     }
    //   });

    // // functions.logger.info(upload_res)

    // response.send({msg:'finished'});