plugapi
=======

An API for creating bots on plug.dj


## Installation
This API requires phantomjs version 2.0+. Do not try using 1.9 with it because it will not work due to the websockets stack used in 1.9. You can find information on how to compile and install 2.0 here: https://groups.google.com/forum/#!msg/phantomjs/iYyH6hF_xoQ/fTmVD8-NcFIJ

## How to use

More documentation will soon follow, but this will get you started. Check the source to see a list of all action methods (like chat, moderateForceSkip, etc)

```
var PlugBotAPI = require('./plugbotapi');
 
PlugBotAPI.getAuth({
  username: 'xxxx', // twitter username
  password: 'xxxx' // twitter password
}, function(err, auth) {
 
  var plugbotapi = new PlugBotAPI(auth);
  var room = 'some-room';

 
 
  plugbotapi.connect(room);
   
  plugbotapi.on('roomJoin', function(data) {
    console.log("ready!");
    //plugbotapi.chat('hmm');
    //plugbotapi.getUsers(function(users) {
    //  console.log("users: " + users.length);
    //});
    //plugbotapi.hasPermission('52a648c496fba57878e8f809', 'API.ROLE.NONE', function(result) {
    //  console.log("permission: ", result);
    //});
  });
   
  // A few sample events
  plugbotapi.on('chat', function(data) {
    console.log("got chat: ", data);
  });
   
  plugbotapi.on('djAdvance', function(data) {
    console.log("dj advance: ", data);
  });
   
  plugbotapi.on('voteUpdate', function(data) {
    console.log("vote update: ", data);
  });
});
```