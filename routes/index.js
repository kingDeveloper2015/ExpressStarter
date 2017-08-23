var express = require('express');
var Oauth = require('../controller/oauth.js');
var Slack = require('../controller/slack.js');
var router = express.Router();

router.get('/', function(req, res) {
    var user_id = req.query.user_id;
    console.log(user_id);
    res.render('index', {user_id:user_id});
});

// This route handles get request to a /oauth endpoint. We'll use this endpoint for handling the logic of the Slack oAuth process behind our app.
router.get('/oauth', Oauth.oauth);

// Route the endpoint that our slash command will point to and send back a simple response to indicate that ngrok is working
router.post('/conference', Slack.onConference);
// router.post('/slack/actions', Slack.handleAction);

router.post('/initDevice', Slack.initDevice);
router.post('/voice', Slack.handleVoiceCall);
router.post('/voice_mute', Slack.handleVoiceCall_mute);
router.post('/recordingStatus', Slack.handleRecordingStatus);
router.post('/statusCallback',Slack.handleStatus);
router.get('/play', function (req, res) {
    var url = req.query.url;
    res.render('recordplay', {url:url});
})


module.exports = router;
