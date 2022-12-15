// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
// response codes adn errors:
// https://developer.twitter.com/en/support/twitter-api/error-troubleshooting

//import request to trigger the tweet at certain intervals (scheduled function call)
//cron job
// const request = require('request');


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

    //API SEARCH TWEET https://twittercommunity.com/t/from-a-query-resending-to-obtain-a-oembed-twitter-api-v2-electron-nodejs/164231
    // API SEARCH TWEET https://developer.twitter.com/en/docs/twitter-api/tweets/search/api-reference/get-tweets-search-recent
    // BUILD QUERY - https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/build-a-query#examples
    var res =  await refreshedClient.v2.search("in_reply_to_tweet_id:1603018284282138634 to:m1guelpf")

    list_of_tweets = []
    if (res.meta.next_token == undefined){
        response.send(res.data);
    }else{
        // using the next token for polling 
        //https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/paginate
        while (res.meta.next_token !== undefined) {
            //append data in res to list of tweets
            list_of_tweets.push(res.data)
            res = await refreshedClient.v2.get('tweets/search/recent', 
                { 
                    query: "in_reply_to_tweet_id:1603018284282138634 to:m1guelpf", 
                    max_results: 10,
                    next_token: res.meta.next_token,    
                });

        }
        response.send(list_of_tweets);
    }

    response.send("Completed")

});
