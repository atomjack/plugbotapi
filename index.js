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
  
    function PlugBotAPI(remember_token) {
      this.remember_token = remember_token;
      this.page = false;
      this.pageReady = false;
      this.ph = false;
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
          console.log("ERROR: ", msg);
          console.log("ERROR TRACE: ", trace);
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
          if(call == 'moderateAddDJ') {
            setTimeout(function() {
              callbackOrEmpty(callback, result);
            }, 1500);
          } else
            callbackOrEmpty(callback, result);
        }, {
          call: call,
          arg: arg
        });
      }
    };

    PlugBotAPI.prototype.createPage = function(room, callback) {
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

        if(typeof callback == 'function')
          callback(ph);
      });
    };

    PlugBotAPI.prototype.openPage = function(room) {
      var _this = this;
      this.ph.createPage(function(page) {
        _this.ph.addCookie('remember_token', _this.remember_token, 'plug.dj');

        page.open('http://plug.dj/' + room, function(status) {

          // Check for invalid login
          page.evaluate(function() {
            return $('#oauth_form').length == 0;
          }, function(loggedin) {
            if(!loggedin)
              _this.emit('invalidLogin');
          });

          var tries = 0;
          var loadInterval = setInterval(function() {
            page.evaluate(function() {
              return $('.app-header').length > 0;
            }, function(found) {
              tries++;
              if(found) {
                _this.pageReady = true;

                page.set('onConsoleMessage', function(msg) {
                  if(msg.match(/^API/)) {
                    _this.debug.logapi(msg);
                  } else {
                    _this.debug.logother(msg);
                  }
                  if (msg.match(/^error/) && _this.pageReady === false) {
                    _this.emit('connectionError', msg);
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

                // Setup events
                page.evaluate(function() {
                  // TODO: Verify these

                  // First, get rid of the playback div so we don't needlessly use up all that bandwidth
                  $('#playback').remove();
                  // Might as well get rid of these, perhaps lower cpu usage?
                  $('#audience').remove();
                  $('#dj-booth').remove();

                  var events = ['ADVANCE', 'CHAT', 'GRAB_UPDATE', 'HISTORY_UPDATE', 'MOD_SKIP',
                    'SCORE_UPDATE', 'USER_JOIN', 'USER_LEAVE', 'USER_SKIP', 'VOTE_UPDATE', 'WAIT_LIST_UPDATE'];
                  var foo = [];
                  for (var i in events) {
                    var thisEvent = events[i];
                    // First, let's turn off any listeners to the PlugAPI, in case we get disconnected and reconnected - we don't want these events to be duplicated.
                    var line = 'API.off(API.' + thisEvent + ');';
                    eval(line);
                    line = 'API.on(API.' + thisEvent + ', function(data) { data.fromID = data.fid; data.chatID = data.cid; console.log(\'API.' + thisEvent + ':\' + JSON.stringify(data)); }); ';
                    eval(line);
                    foo.push(line);
                  }
                  return {
                    ROLE: API.ROLE,
                    STATUS: API.STATUS,
                    BAN: API.BAN,
                    foo: foo
                  };
                }, function (result) {
                  _this.API.ROLE = result.ROLE;
                  _this.API.STATUS = result.STATUS;
                  _this.API.BAN = result.BAN;
                  setTimeout(function () {
                    _this.emit('roomJoin');
                  }, 1000);

                });



                clearInterval(loadInterval);
              } else if(tries > 15) {
                clearInterval(loadInterval);
                console.log("Sorry, I couldn't seem to connect.");
              }
            });
          }, 2000);
        });

        _this.page = page;
      });
    };

    PlugBotAPI.prototype.connect = function(room) {
      var _this = this;
      if(this.page === false) {
        // Need to create page
        this.createPage(room, function(ph) {
          _this.ph = ph;
          _this.openPage(room);
        });
      } else {
        this.openPage(room);
      }
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

      for(var i=1;i<arguments.length;i++) {
        if(typeof arguments[i] == 'function')
          callback = arguments[i];
        else if(typeof arguments[i] == 'number')
          duration = arguments[i];
        else if(typeof arguments[i] == 'string')
          reason = arguments[i];
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
      if(parseInt(position) == NaN) {
        callback({
          result: false,
          error: 'Invalid position'
        });
        return false;
      }
      this.apiCall('moderateMoveDJ', [userid, parseInt(position)], callback);
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