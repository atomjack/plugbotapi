(function() {
  var __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };
  var phantom = require('phantom');
  var EventEmitter = require('events').EventEmitter;
  var __hasProp = {}.hasOwnProperty;
  var http = require('http');
  var net = require('net');
  var util = require('util');

  PlugBotAPI = (function(_super) {
  
    __extends(PlugBotAPI, _super);
  
    function PlugBotAPI(auth) {
      this.auth = auth;
      this.page = false;
      this.pageReady = false;
      this.phantomPort = 12300; // default phantom port
      this.API = {}; // Plug constants
      this.debug.plugbotapi = this;
    }

    PlugBotAPI.prototype.debug = {
      SHOWAPI: true,
      SHOWOTHER: true,
      logapi: function() {
        if(this.SHOWAPI === true)
          this.log(util.format.apply(null, arguments));
      },
      logother: function() {
        if(this.SHOWOTHER === true)
          this.log(util.format.apply(null, arguments));
      },
      log: function(text) {
        this.plugbotapi.emit('debug', text);
      }
    };
    
    PlugBotAPI.prototype.setPhantomPort = function(port) {
      this.phantomPort = port;
    };
    
    PlugBotAPI.prototype.apiCall = function(call, arg, callback) {
      if (this.pageReady === true) {
        this.page.set('onError', function (msg, trace) {
          console.log("ERROR: " + msg);
        });
        this.page.evaluate(function(obj) {
          var args = '';
          if (obj.arg != null) {
            if (!Array.isArray(obj.arg))
              obj.arg = [obj.arg];
            for(var i=0;i<obj.arg.length;i++) {
              if (typeof obj.arg[i] == 'string')
                 obj.arg[i] = "'" + obj.arg[i].replace(/\'/g, "\\'") + "'";
            }
            args = obj.arg.join(', ');
          }
          var result;
          var line = 'result = API.' + obj.call + '(' + args + ');';
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
      phantom.create({ port: _this.phantomPort }, function(ph) {

        ph.get('version', function(result) {
          if(result.major < 2) {
            var version = result.major + "." + result.minor + "." + result.patch;
            console.log("Sorry, but PlugBotAPI requires phantomjs version >= 2.0.0. You are running version " + version + ".");
            ph.exit();
            process.exit(1);
          }
        });
        ph.createPage(function(page) {
          ph.addCookie('usr', _this.auth, 'plug.dj');

          page.open('http://plug.dj/' + room, function(status) {

            page.set('onConsoleMessage', function(msg) {

              // this will appear once we're ready
              if (msg.match(/^sio join/)) {
                _this.debug.logother(msg);
                _this.pageReady = true;

                // Setup events
                page.evaluate(function() {
                  // First, get rid of the playback div so we don't needlessly use up all that bandwidth
                  $('#playback').remove();
                  // Might as well get rid of these, perhaps lower cpu usage?
                  $('#audience').remove();
                  $('#dj-booth').remove();

                  var events = ['CHAT', 'USER_SKIP', 'USER_JOIN', 'USER_LEAVE', 'USER_FAN', 'FRIEND_JOIN', 'FAN_JOIN', 'VOTE_UPDATE', 'CURATE_UPDATE', 'ROOM_SCORE_UPDATE', 'DJ_ADVANCE', 'DJ_UPDATE', 'WAIT_LIST_UPDATE', 'VOTE_SKIP', 'MOD_SKIP', 'CHAT_COMMAND', 'HISTORY_UPDATE'];
                  for (var i in events) {
                    var thisEvent = events[i];
                    // First, let's turn off any listeners to the PlugAPI, in case we get disconnected and reconnected - we don't want these events to be duplicated.
                    var line = 'API.off(API.' + thisEvent + ');';
                    eval(line);
                    line = 'API.on(API.' + thisEvent + ', function(data) { console.log(\'API.' + thisEvent + ':\' + JSON.stringify(data)); }); ';
                    eval(line);
                  }
                  return {
                    ROLE: API.ROLE,
                    STATUS: API.STATUS,
                    BAN: API.BAN
                  };
                }, function (result) {
                  _this.API.ROLE = result.ROLE;
                  _this.API.STATUS = result.STATUS;
                  _this.API.BAN = result.BAN;
                  setTimeout(function () {
                    _this.emit('roomJoin');
                  }, 1000);

                });
              } else if(msg.match(/^API/)) {
                _this.debug.logapi(msg);
              } else if (msg.match(/^(sio disconnect|sio connect failed|sio an unknown error occurred|sessionClose received)/)) {
                _this.emit('connectionError', msg);
              } else {
                _this.debug.logother(msg);
              }



              var apiRegexp = /^API.([^:]+):(.*)/g;
              var matches = apiRegexp.exec(msg);

              if (matches != null) {
                //console.log(matches[1] + ":" + matches[2]);
                // matches[1] = which event
                // matches[2] = json representation of data

                // Rename event to be camelCase
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
    
    PlugBotAPI.prototype.listen = function(port, address) {
      var self = this;
      var querystring = require('querystring');
      http.createServer(function (req, res) {
        var dataStr = '';
        req.on('data', function (chunk) {
					dataStr += chunk.toString();
        });
        req.on('end', function () {
					var data = querystring.parse(dataStr);
					req._POST = data;
					self.emit('httpRequest', req, res);
        });
      }).listen(port, address);
    };
    
    PlugBotAPI.prototype.tcpListen = function(port, address) {
      var self = this;
      net.createServer(function (socket) {
        socket.on('connect', function () {
					self.emit('tcpConnect', socket);
        });
        socket.on('data', function (data) {
					var msg = data.toString();
					if (msg[msg.length - 1] == '\n') {
						self.emit('tcpMessage', socket, msg.substr(0, msg.length-1), port);
					}
        });
        socket.on('end', function () {
					self.emit('tcpEnd', socket);
        });
      }).listen(port, address);
    };
    
    // Actions
    PlugBotAPI.prototype.chat = function(msg, callback) {
      this.apiCall('sendChat', msg, callback);
    };
    
    PlugBotAPI.prototype.speak = function(msg, callback) {
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
    
    PlugBotAPI.prototype.getDJ = function(callback) {
      this.apiCall('getDJ', null, callback);
    };
    
    PlugBotAPI.prototype.getAudience = function(callback) {
      this.apiCall('getAudience', null, callback);
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
    
    PlugBotAPI.prototype.getWaitListPosition = function(userid, callback) {
      this.apiCall('getWaitListPosition', userid, callback);
    };
    
    PlugBotAPI.prototype.setStatus = function(value, callback) {
      this.apiCall('setStatus', value, callback);
    };
    
    PlugBotAPI.prototype.getNextMedia = function(callback) {
      this.apiCall('getNextMedia', null, callback);
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
    
    PlugBotAPI.prototype.moderateBanUser = function() {
      var userid = arguments[0];
      var duration = this.API.BAN.PERMA;
      var callback;
      if(typeof arguments[1] == 'function')
          callback = arguments[1];
      else {
          duration = arguments[1];
          callback = arguments[2];
      }
      this.apiCall('moderateBanUser', [userid, 'a', duration], callback);
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

    PlugBotAPI.prototype.woot = function() {
      this.vote('woot');
    };

    PlugBotAPI.prototype.meh = function() {
      this.vote('meh');
    };

    PlugBotAPI.prototype.vote = function(which) {
      if (this.pageReady === true) {
        var _this = this;
        _this.page.evaluate(function (which) {
          if(which == 'woot')
            $('#woot').click();
          else if(which == 'meh') {
            $('#meh').click();
          }
        }, function () {
        }, which);
      }
    };
    
    
    
    return PlugBotAPI;
    
  })(EventEmitter);

  module.exports = PlugBotAPI;

}).call(this);

function callbackOrEmpty(callback, arg) {
  if (typeof callback == 'function') {
    callback(arg);
  }
}