// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions

//import request to trigger the tweet at certain intervals (scheduled function call)
//cron job
// const request = require('request');

// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
require('dotenv').config()


// reference to document in firestore db
const dbRef = admin.firestore().doc(process.env.DB_REFERENCE);
const callbackURL = process.env.CALLBACK_URL

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

// STEP 3 - Refresh tokens and post tweets
// endpoint to do something with api data
exports.tweet = functions.https.onRequest(async (request,response)=>{
    const{refreshToken} = (await dbRef.get()).data();

    const{
        client: refreshedClient,
        accessToken,
        refreshToken: newRefreshToken,
    } = await twitterClient.refreshOAuth2Token(refreshToken);

    await dbRef.set({accessToken,refreshToken:newRefreshToken});

    const nextTweet = "hello world"

    // const { data } = await refreshedClient.v2.tweet(nextTweet);
    // https://developer.twitter.com/en/docs/twitter-api/tweets/lookup/api-reference/get-tweets#tab1
    const { data } = await refreshedClient.v2.tweets("1503335964067909632",
        {
            //A comma separated list of fields to expand.
            expansions: ["author_id"],

            //A comma separated list of User fields to display.
            "user.fields": ["created_at", "description", "name","username"],

            //A comma separated list of Tweet fields to display.
            "tweet.fields": ["created_at", "lang", "conversation_id"],
        })
    response.send(data);

});


    // try {
    //   const lookupTweetById = await twitterClient.tweets.findTweetById(
    //     //The ID of the Tweet
    //     "1460323737035677698",
    //     {
    //       //A comma separated list of fields to expand
    //       expansions: ["attachments.media_keys"],
  
    //       //A comma separated list of Media fields to display
    //       "media.fields": ["duration_ms", "type"],
    //     }
    //   );
    // }




