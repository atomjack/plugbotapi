(function() {
  var __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };
  var phantom = require('phantom');
  var EventEmitter = require('events').EventEmitter;
  var __hasProp = {}.hasOwnProperty;
  
  PlugBotAPI = (function(_super) {
  
    __extends(PlugBotAPI, _super);
  
    function PlugBotAPI(auth) {
      this.auth = auth;
      this.page = false;
      this.pageReady = false;
      
    }
    
    PlugBotAPI.prototype.apiCall = function(call, arg, callback) {
      if (this.pageReady === true) {
        this.page.set('onError', function (msg, trace) {
          console.log("ERROR: " + msg);
        });
        this.page.evaluate(function(obj) {
          var args = '';
          if (obj.arg != null) {
            if (!Array.isArray([obj.arg]))
              obj.arg = [obj.arg];
            var newArgs = [];
            for(var i=0;i<obj.arg.length;i++) {
              if (obj.arg[i].match(/^API\.(ROLE|STATUS|BAN)/)) {
                newArgs.push(obj.arg[i]);
              } else {
                newArgs.push("'" + obj.arg[i] + "'");
              }
            }
            args = newArgs.join(", ");
          }
          var line = 'var result = API.' + obj.call + '(' + args + ');';
          eval(line);
          return result;
        }, function(result) {
          callbackOrEmpty(callback, result);
        }, {
          call: call,
          arg: arg
        });
      }
    };
    
    PlugBotAPI.prototype.connect = function(room) {
      var _this = this;
      phantom.create(function(ph) {
    
      ph.createPage(function(page) {
        ph.addCookie('usr', _this.auth, 'plug.dj');
        
        page.open('http://plug.dj/' + room, function(status) {
          
          page.set('onConsoleMessage', function(msg) {
            //console.log("msg: ", msg);
            
            // this will appear once we're ready
            if (msg.match(/^sio join/)) {
              _this.pageReady = true;
              
              // Sample api call
              //_this.apiCall('getAudience', null, function(result) {
              //  console.log("audience: ", result.length);
              //});
              
              // Setup events
              page.evaluate(function() {
                var events = ['CHAT', 'USER_SKIP', 'USER_JOIN', 'USER_LEAVE', 'USER_FAN', 'FRIEND_JOIN', 'FAN_JOIN', 'VOTE_UPDATE', 'CURATE_UPDATE', 'ROOM_SCORE_UPDATE', 'DJ_ADVANCE', 'DJ_UPDATE', 'WAIT_LIST_UPDATE', 'VOTE_SKIP', 'MOD_SKIP', 'CHAT_COMMAND', 'HISTORY_UPDATE'];
                for(var i in events) {
                  var thisEvent = events[i];
                  var line = 'API.on(API.' + thisEvent + ', function(data) { console.log(\'API.' + thisEvent + ':\' + JSON.stringify(data)); }); ';
                  eval(line);
                }
                
              });
              
              _this.emit('roomJoin');
            } else if (msg.match(/^debug:/)) {
              console.log(msg);
            }
            var apiRegexp = /^API.([^:]+):(.*)/g;
            var matches = apiRegexp.exec(msg);
            
            if (matches != null) {
              //console.log(matches[1] + ":" + matches[2]);
              // matches[1] = which event
              // matches[2] = json representation of data
              var event = matches[1].toLowerCase().replace(/_([a-z])/g, function(a) {
                return a.replace('_', '').toUpperCase();
              });
              var data = JSON.parse(matches[2]);
              
              // emit this event out to the PlugBotAPI, for a bot to receive
              _this.emit(event, data);
            }
          });
        });
        
        _this.page = page;
        });
      });
    };
    
    PlugBotAPI.getAuth = function(creds, callback) {
      var plugLogin = require('plug-dj-login');
      plugLogin(creds, function(err, cookie) {
        if(err) {
          if(typeof callback == 'function')
            callback(err, null);
          return;
        }

        var cookieVal = cookie.value;
        cookieVal = cookieVal.replace(/^\"/, "").replace(/\"$/, "");
        if(typeof callback == 'function') {
          callback(err, cookieVal);
        }
      });
    };
    
    // Actions
    PlugBotAPI.prototype.chat = function(msg, callback) {
      this.apiCall('sendChat', msg, callback);
    };
    
    PlugBotAPI.prototype.getUsers = function(callback) {
      this.apiCall('getUsers', null, callback);
    };
    
    PlugBotAPI.prototype.getWaitList = function(callback) {
      this.apiCall('getWaitList', null, callback);
    };
    
    PlugBotAPI.prototype.getUser = function(userid, callback) {
      this.apiCall('getUser', userid, callback);
    };
    
    PlugBotAPI.prototype.getStaff = function(callback) {
      this.apiCall('getStaff', null, callback);
    };
    
    PlugBotAPI.prototype.getAdmins = function(callback) {
      this.apiCall('getAdmins', null, callback);
    };
    
    PlugBotAPI.prototype.getAmbassadors = function(callback) {
      this.apiCall('getAmbassadors', null, callback);
    };
    
    PlugBotAPI.prototype.getHost = function(callback) {
      this.apiCall('getHost', null, callback);
    };
    
    PlugBotAPI.prototype.getMedia = function(callback) {
      this.apiCall('getMedia', null, callback);
    };
    
    PlugBotAPI.prototype.getRoomScore = function(callback) {
      this.apiCall('getRoomScore', null, callback);
    };
    
    PlugBotAPI.prototype.getHistory = function(callback) {
      this.apiCall('getHistory', null, callback);
    };
    
    // TODO:make sure this works
    PlugBotAPI.prototype.hasPermission = function(userid, role, callback) {
      this.apiCall('hasPermission', [userid, role], callback);
    };
    
    PlugBotAPI.prototype.djJoin = function(callback) {
      this.apiCall('djJoin', null, callback);
    };
    
    PlugBotAPI.prototype.djLeave = function(callback) {
      this.apiCall('djLeave', null, callback);
    };
    
    PlugBotAPI.prototype.getVolume = function(callback) {
      this.apiCall('getVolume', null, callback);
    };
    
    PlugBotAPI.prototype.setVolume = function(value, callback) {
      this.apiCall('setVolume', value, callback);
    };
    
    PlugBotAPI.prototype.getWaitListPosition = function(userid, callback) {
      this.apiCall('getWaitListPosition', userid, callback);
    };
    
    PlugBotAPI.prototype.setStatus = function(value, callback) {
      this.apiCall('setStatus', value, callback);
    };
    
    PlugBotAPI.prototype.getNextMedia = function(callback) {
      this.apiCall('getNextMedia', null, callback);
    };
    
    PlugBotAPI.prototype.getBannedUsers = function(callback) {
      this.apiCall('getBannedUsers', null, callback);
    };
    
    PlugBotAPI.prototype.getTimeElapsed = function(callback) {
      this.apiCall('getTimeElapsed', null, callback);
    };
    
    PlugBotAPI.prototype.getTimeRemaining = function(callback) {
      this.apiCall('getTimeRemaining', null, callback);
    };
    
    PlugBotAPI.prototype.moderateForceSkip = function(callback) {
      this.apiCall('moderateForceSkip', null, callback);
    };
    
    PlugBotAPI.prototype.moderateAddDJ = function(userid, callback) {
      this.apiCall('moderateAddDJ', userid, callback);
    };
    
    PlugBotAPI.prototype.moderateRemoveDJ = function(userid, callback) {
      this.apiCall('moderateRemoveDJ', userid, callback);
    };
    
    // TODO: Make sure this works
    PlugBotAPI.prototype.moderateBanUser = function(userid, reason, duration, callback) {
      this.apiCall('moderateBanUser', [userid, reason, duration], callback);
    };
    
    PlugBotAPI.prototype.moderateUnbanUser = function(userid, callback) {
      this.apiCall('moderateUnbanUser', userid, callback);
    };
    
    PlugBotAPI.prototype.moderateDeleteChat = function(chatid, callback) {
      this.apiCall('moderateDeleteChat', chatid, callback);
    };
    
    PlugBotAPI.prototype.moderateSetRole = function(userid, permission, callback) {
      this.apiCall('moderateSetRole', [userid, permission], callback);
    };
    
    PlugBotAPI.prototype.moderateMoveDJ = function(userid, position, callback) {
      this.apiCall('moderateMoveDJ', [userid, position], callback);
    };
    
    PlugBotAPI.prototype.moderateLockWaitList = function(locked, removeAll, callback) {
      this.apiCall('moderateLockWaitList', [locked, removeAll], callback);
    };
    
    //PlugBotAPI.prototype. = function(callback) {
    //  this.apiCall('', null, callback);
    //};
    
    
    
    return PlugBotAPI;
    
  })(EventEmitter);

  module.exports = PlugBotAPI;

}).call(this);

function callbackOrEmpty(callback, arg) {
  if (typeof callback == 'function') {
    callback(arg);
  }
}