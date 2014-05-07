plugbotapi
=======

An API for creating bots on plug.dj


## Installation
This API requires phantomjs version 2.0 or greater. The websockets stack in 1.9 and lower does not cooperate with plug.dj, therefore 2.0 MUST be used.

You can find information on how to compile and install 2.0 here: https://groups.google.com/forum/#!msg/phantomjs/iYyH6hF_xoQ/fTmVD8-NcFIJ

```
npm install plugbotapi
```

## How to use

```
var PlugBotAPI = require('plugbotapi');
 
PlugBotAPI.getAuth({
  username: 'xxxx', // twitter username
  password: 'xxxx' // twitter password
}, function(err, auth) {
 
  var plugbotapi = new PlugBotAPI(auth);
  var room = 'some-room';

 
 
  plugbotapi.connect(room);
   
  plugbotapi.on('roomJoin', function() {
    console.log("Connected!");

    plugbotapi.chat('Hello World');
    
    plugbotapi.getUsers(function(users) {
      console.log("Number of users in the room: " + users.length);
    });
    
    plugbotapi.hasPermission('52a648c496fba57878e8f809', 'API.ROLE.NONE', function(result) {
      console.log("permission: ", result);
    });
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

### Events
PlugBotAPI emits the following events. For documentation please refer to the official [Plug.dj API](http://support.plug.dj/hc/en-us/articles/201687377-Documentation#chat).

* chat
* userSkip
* userJoin
* userLeave
* userFan
* friendJoin
* fanJoin
* voteUpdate
* curateUpdate
* roomScoreUpdate
* djAdvance
* djUpdate
* waitListUpdate
* voteSkip
* modSkip
* chatCommand
* historyUpdate

Also emitted is the following:

* roomJoin: emitted when the bot has completed joining the room and is ready to send actions/receive events.
* invalidLogin: emitted when the bot is unable to login, possibly due to an invalid auth cookie.

## Actions

All data returned by actions is returned inside the callback that must be specified.

### connect: (roomName)

Connects to plug.dj and joins the specified room.

### chat: (message, callback)

Sends _message_ in chat.

### getUsers: (callback)

Returns (in the callback) an array of user objects for every user in the room.

### getWaitList: (callback)

Returns an Array of user objects of users currently on the wait list.

### getUser: (userid, callback)

Returns the user object of a specific user. If you do not pass a userID, it returns the user object of the bot.

### getDJ: (callback)

Returns a user object of the current DJ. If there is no DJ, returns undefined.

### getAudience: (callback)

Returns an Array of user objects of all the users in the audience (not including the DJ).

### getStaff: (callback)

Returns an Array of user objects of the room's staff members that are currently in the room.

### getAdmins: (callback)

Returns an Array of user objects of the Admins currently in the room.

### getAmbassadors: (callback)

Returns an Array of user objects of the Ambassadors currently in the room.

### getHost: (callback)

Returns the user object of the room host if they are currently in the room, undefined otherwise.

### getMedia: (callback)

Returns the media object of the current playing media.

### getRoomScore: (callback)

Returns a room score object with the properties positive, negative, curates, and score.

### getHistory: (callback)

Returns an Array of history objects of the Room History (once it's been loaded).

### hasPermission: (userid, role, callback)

Returns a Boolean whether the userID passed has permission of the passed role. If you pass undefined or null for userID, it checks the permission of the logged in user. Pass an API.ROLE constant:

* API.ROLE.NONE
* API.ROLE.RESIDENTDJ
* API.ROLE.BOUNCER
* API.ROLE.MANAGER
* API.ROLE.COHOST
* API.ROLE.HOST
* API.ROLE.AMBASSADOR
* API.ROLE.ADMIN

### djJoin: (callback)

Joins the booth or the wait list if the booth is full.

### djLeave: (callback)

Leaves the booth or wait list.

### getWaitListPosition: (userid, callback)

If the userID is in the wait list, it returns their position (0 index - so 0 means first position). Returns -1 if they're not in the wait list. If you do not pass a userID, it uses the logged in user ID.

### setStatus: (value, callback)

Sets the user status (Available, AFK, Working, Sleeping). Pass an API.STATUS constant:

* API.STATUS.AVAILABLE
* API.STATUS.AFK
* API.STATUS.WORKING
* API.STATUS.GAMING

Example:

```
plugbotapi.moderateBanUser('xxxxx', plugbotapi.API.STATUS.GAMING, function() {
// Done
});
```

### getNextMedia: (callback)

Returns the user's queued up media. This is an object with two properties, media and inHistory. media is the media object and inHistory is a Boolean if the media is in the room history.

### getTimeElapsed: (callback)

Returns how much time has elapsed for the currently playing media. If there is no media, it will return 0.

### getTimeRemaining: (callback)

Returns how much time is remaining for the currently playing media. If there is no media, it will return 0.

### moderateForceSkip: (callback)

Force skip the current DJ.

### moderateAddDJ: (userid, callback)

Adds a user to the dj booth or wait list by passing that user's id. Users who do not have an active playlist with one item in it cannot be added.

### moderateRemoveDJ: (userid, callback)

Removes a DJ from the booth or wait list by passing that user's id.

### moderateBanUser: (userid, [duration], [callback])

Bans a user from the room. If the bot is only a bouncer, permanent bans are not available. Specify the duration with one of the following constants:

* API.BAN.HOUR
* API.BAN.DAY
* API.BAN.PERMA

If you do not specify a duration, a permanent ban will be the default unless the bot is a bouncer, in which case the ban will be for an hour.

Example:

```
plugbotapi.moderateBanUser('xxxxx', plugbotapi.API.BAN.DAY, function() {
// Done
});
```

### moderateUnbanUser: (userid, callback)

If the bot is a manager, unbans a user.

### moderateDeleteChat: (chatid, callback)

Delete a chat message by its chatid.

### moderateSetRole: (userid, permission, callback)

If the bot is a manager or above, this sets another user's role. Use one of the following constants:

* API.ROLE.NONE
* API.ROLE.RESIDENTDJ
* API.ROLE.BOUNCER
* API.ROLE.MANAGER
* API.ROLE.COHOST

Example:
```
plugbotapi.moderateSetRole('xxxx', plugbotapi.API.ROLE.RESIDENTDJ);
```

### moderateMoveDJ: (userid, position, callback)

If the bot is a manager or above, move the specified user in the waitlist. Pass position 1 for the top of the list.

### moderateLockWaitList: (locked, removeAll, callback)

If the bot is a manager, lock/unlock the waitlist.

### woot: ()

Makes the bot woot the currently playing track. NOTE:There is no way to woot via the official Plug API, so this is and `meh` are sort of a hack - they appear to sporadically stop working.

### meh: ()

MAkes the bot meh the currently playing track. Same note as woot applies.


## Running multiple bots

If you want to run more than one bot at a time, you will have to specify an alternate port for phantomjs to run on for each bot (except for one, which will use the default of 12300):

```
var PlugBotAPI = require('./plugbotapi');
var plugbotapi = new PlugBotAPI(h);
plugbotapi.setPhantomPort(12301);
```

## Debugging

If you run into problems and would like some more visibility into what the virtual browser is doing, try this:

```
//plugbotapi.debug.SHOWAPI = false; // set this to false to hide the official Plug API events and actions that the virtual browser is sending and receiving. (default true)
//plugbotapi.debug.SHOWOTHER = false; // set this to false to hide any other messages the virtual browser is logging to its console. (default true)

// The API emits the 'debug' event:
plugbotapi.on('debug', function(text) {
    console.log(text);
});
```

