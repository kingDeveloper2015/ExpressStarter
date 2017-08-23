var Config = require('../config/config');

const express = require('express');
var request = require('request');
const WebClient = require('@slack/client').WebClient;
var twilio = require('twilio');
var awsSdk = require('aws-sdk');
var q = require('q');
// member list of team
var memberlist = {};
var moderator = {};
var moderator_token;
var channel = 'general'; ///conference command can be run only in this channel
var conference_channel = "";
var invite_ts = 0; //when end conference, Moderator will remove invite message
var conference_attend_original = 1110;
var conference_attend_id = conference_attend_original;

// Slack web client
const web = new WebClient(Config.S1 + Config.S2 + Config.S3 + Config.S4);
web.users.list(function (err, data) {
    if (err) {
        console.error('web.users.list Error:', err);
    } else {
        memberlist = data.members;
        moderator = memberlist.find(user => user.is_owner === true);

        //moderator_token = generateDeviceToken(moderator.name);
    }
})


/**
 * Checks if the given value is valid as phone number
 * @param {Number|String} number
 * @return {Boolean}
 */
function isAValidPhoneNumber(number) {
    return /^[\d\+\-\(\) ]+$/.test(number);
}

/************************************************************************************/
function generateDeviceToken(client_scope) {
    var ClientCapability = twilio.jwt.ClientCapability;
    var capability = new ClientCapability({
        accountSid: Config.TWILIO_SID,
        authToken: Config.TWILIO_AUTH_TOKEN
    });

    capability.addScope(
        new ClientCapability.OutgoingClientScope({
            applicationSid: Config.TWILLIO_APP_SID}));
    capability.addScope(
        new ClientCapability.IncomingClientScope(client_scope));

    return capability.toJwt();
}
exports.initDevice = function(req, res) {
    var user_id = req.body.user_id;
    var member = memberlist.find(user => user.id === user_id);
    var token = 0;

    //if (moderator.id != user_id)
    //     token = generateDeviceToken(member.name);
    //else
    //    token = moderator_token;

    token = generateDeviceToken(conference_attend_id ++);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ user_name:member.name, token: token}));
}
/************************************************************************************/
function agent_call() {
    console.log("agent call--------------");
    client = twilio(Config.TWILIO_SID, Config.TWILIO_AUTH_TOKEN);
    client.calls.create({
        url: Config.SERVER_BASEURL + "voice_mute",
        to: '+18572142025',
        from: '+18572144821'
    });
}
/***********************************************************************************/
// Handles incoming SMS to Twilio number
exports.onConference = function(req, res) {
    conference_channel = req.body.channel_id;
    var user_id = req.body.user_id;
    var response_url = req.body.response_url;
    console.log("Conference Command");
    console.log(req.body.channel_id);
    if (req.body.token != Config.SLACK_VERIFY_TOKEN){
        res.status(403).end("Access forbidden")
        return;
    }

    var message = {
        "response_type": "in_channel",
        "text": "Conference is created! You can join to this conference by calling to number +1 (857) 214-2025",
        "attachments": [
            {
                "title": "Standup Recording",
                "title_link": Config.SERVER_BASEURL_HTTPS + "?user_id=" + user_id,
                "color": "#3AA3E3"
            }
        ]
    }

    sendMessageToSlackResponseURL(response_url, message)
    res.status(200).send({"title_link" : Config.SERVER_BASEURL_HTTPS + "?user_id=" + user_id});
    //res.end();

};

/************************************************************************************/


//when end conference, Moderator will remove invite message
exports.removeInviteMessage = function (req, res) {
    res.status(200).end(); // best practice to respond with 200 status

    web.chat.delete(invite_ts, channel_id, {}, function (err, data) {
    if (err) {
        console.log(err);
    }
    else
        console.log("deleted");
});
}

/************************************************************************************/

exports.handleVoiceCall = function(request, response){
    console.log("Voice Call");
    console.log(request.body);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    // Use the Twilio Node.js SDK to build an XML response
    const twiml = new VoiceResponse();

    // Start with a <Dial> verb
    const dial = twiml.dial();

    dial.conference('My conference', {
        startConferenceOnEnter: true,
        endConferenceOnExit: false,
        recordingStatusCallback : Config.SERVER_BASEURL + 'recordingStatus',
        record: true,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: 'leave join',
        statusCallback : Config.SERVER_BASEURL + 'statusCallback'
    });

    // Render the response as XML in reply to the webhook request
    response.type('text/xml');
    response.send(twiml.toString());
};

/****************************** Status Callback **************************************/

exports.handleStatus = function ( req, res ) {
  console.log("----------- Status Call back -----------");

  var params = req.body;
  client = twilio(Config.TWILIO_SID, Config.TWILIO_AUTH_TOKEN);
  console.log(params.StatusCallbackEvent , ":" , params.SequenceNumber);
  if ( params.StatusCallbackEvent == 'participant-join' && params.SequenceNumber == 1) {
    // client.api.accounts(params.AccountSid)
    // .conferences(params.ConferenceSid)
    // .participants(params.CallSid)
    // .update({
    //   EndConferenceOnExit: false
    // })
    // .done();
    agent_call();
  }

  if ( params.StatusCallbackEvent == 'participant-leave') {
      console.log(params);
    getParticipantsCounts(params.ConferenceSid)
    .then(function(count){
        console.log(count);
      if ( count == 1) {

          console.log("Conference ended!");
          return endConference(params.ConferenceSid);
      }
    });
  }


  // console.log(params.StatusCallbackEvent,participants.ParticipantListInstance.list());
}
/*****************************End Conference *********************************/

function endConference(conferenceSid) {

  // var responseURL = 'https://api.twilio.com/2010-04-01/Accounts/' + Config.TWILIO_SID + '/Conferences/' + conferenceSid + '.json';
  // console.log(responseURL);
  // var auth = "Basic " + new Buffer(Config.TWILIO_SID + ":" + Config.TWILIO_AUTH_TOKEN).toString("base64");
  // var postOptions = {
  //     uri: responseURL,
  //     method: 'POST',
  //     headers: {
  //         'Content-type': 'application/json',
  //         "Authorization" : auth
  //     }
  // };
  //
  // request(postOptions, function(error, response,body) {
  //     if ( error ) {
  //         console.log(err);
  //     } else {
  //         console.log(body);
  //         var status = JSON.parse(body);
  //         if ( status.status == "completed") {
  //             console.log("SuccessFully Completed");
  //         }
  //     }
  // });
  client = twilio(Config.TWILIO_SID, Config.TWILIO_AUTH_TOKEN);
  client.api.accounts(Config.TWILIO_SID)
  .conferences(conferenceSid)
  .participants.each( function ( participant) {
	console.log(participant);
	client.calls(participant.callSid).update({status: 'completed'});
//      client.conferences(conferenceSid).participants(participant.CallSid).remove(() => console.log(`deleted successfully.`))
//      .catch((err) => {
//        console.log(err.status);
//        throw err;
//      });
  })
 // client.conferences('CFbbe46ff1274e283f7e3ac1df0072ab39').update({status: 'completed'}).done();
/*    client.conferences.list({friendlyName : 'My conference'}, function ( err, data){
	console.log(data.conferences);
	var conferenceSid = data.conferences[0].sid;
	client.conferences(conferenceSid).participants.list(function(err,data){
	    data.participants.forEach(function(participant){
		client.calls(participant.callSid).update({status: 'completed'});
	    });
	});
    });*/
}

/*************************** Get Participants Counts ********************************/

function getParticipantsCounts(conferenceSid) {
    console.log(conferenceSid);
  var defer = q.defer();
  var count = 0;
  var responseURL = 'https://api.twilio.com/2010-04-01/Accounts/' + Config.TWILIO_SID + '/Conferences/' + conferenceSid + '/Participants.json';
  var auth = "Basic " + new Buffer(Config.TWILIO_SID + ":" + Config.TWILIO_AUTH_TOKEN).toString("base64");
  var postOptions = {
      uri: responseURL,
      method: 'GET',
      headers: {
          'Content-type': 'application/json',
          "Authorization" : auth
      }
  }

  request(postOptions, function(error, response, body) {
      if (error){
          console.log(err);
      } else {
        var participants_list = JSON.parse(body).participants;
        defer.resolve(participants_list.length);
      }
  })
  return defer.promise;
}

/************************************************************************************/

exports.handleVoiceCall_mute = function(request, response){
    console.log("Voice Call mute-------------");
    const VoiceResponse = twilio.twiml.VoiceResponse;
    // Use the Twilio Node.js SDK to build an XML response
    const twiml = new VoiceResponse();
    twiml.record();
    // Start with a <Dial> verb
    const dial = twiml.dial();
/*
    dial.conference('My conference', {
         startConferenceOnEnter: true,
         endConferenceOnExit: false,
         muted: true
     });


*/    // Render the response as XML in reply to the webhook request
    response.type('text/xml');
    console.log(twiml.toString());
    response.send(twiml.toString());
};

/************************************************************************************/
exports.handleRecordingStatus = function (request, response) {
    var RecordingUrl = request.body.RecordingUrl + ".mp3";

    console.log(RecordingUrl);
    var lambda = new awsSdk.Lambda({
        region: 'us-east-2',
        accessKeyId : 'AKIAI2JTXQXSOLQMCGIA',
        secretAccessKey : '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'
    });
    var pullParams = {
        FunctionName : 'conference',
        InvocationType: 'RequestResponse',
        LogType: 'None',
        Payload : JSON.stringify({
            url: RecordingUrl
        })

    };
    var pullResults;
    var $this = this;
    lambda.invoke(pullParams, function(error,data) {
        if ( error) {
            console.log( error );
        } else {
            pullResults = data.Payload;
            console.log(pullResults);
            var parse = JSON.parse(pullResults);

            console.log(parse.Location);
            sendMessage("Conference end!", conference_channel, { "attachments": [
                {
                    "title": "Record file",
                    "title_link": Config.SERVER_BASEURL + "play?url=" + parse.Location,
                    "color": "#3AA3E3"
                }
            ]})

        }
    });

    response.status(200).end();
}
/************************************************************************************/

function sendMessageToSlackResponseURL(responseURL, JSONmessage){
    var postOptions = {
        uri: responseURL,
        method: 'POST',
        headers: {
            'Content-type': 'application/json'
        },
        json: JSONmessage
    }

    request(postOptions, function(error, response, body) {
        if (error){
            console.log(err);
        }
    })
}

function sendMessage(text, channel, option) {
    console.log("send message to " + channel)
    // Send message using Slack Web Client
    web.chat.postMessage(channel, text, option, function(err, info) {
        if (err) {
            console.log(err);
        }
    });
}
