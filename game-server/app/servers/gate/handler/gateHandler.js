var Code = require('../../../../../shared/code');
var dispatcher = require('../../../util/dispatcher');
var logger = require('pomelo-logger').getLogger('pomelo', __filename);

/**
 * Gate handler that dispatch user to connectors.
 */
module.exports = function(app) {
  return new Handler(app);
};

var Handler = function(app) {
  this.app = app;
};

Handler.prototype.authConn = function(msg, session, next) {
  session.set('connAuthed', true);
  session.push('connAuthed');
  logger.info('Connection authed~');
  next(null, {});
};

Handler.prototype.queryEntry = function(msg, session, next) {
  var uid = msg.uid;
  if(!uid) {
    next(null, {code: Code.FAIL});
    return;
  }

  var connectors = this.app.getServersByType('connector');
  if(!connectors || connectors.length === 0) {
    next(null, {code: Code.GATE.NO_SERVER_AVAILABLE});
    return;
  }

  var res = dispatcher.dispatch(uid, connectors);
  next(null, {code: Code.OK, host: res.host, port: res.clientPort});
  // next(null, {code: Code.OK, host: res.pubHost, port: res.clientPort});
};

Handler.prototype.auth = function(msg, session, next) {
  var username = msg.username;
  var pwd = msg.pwd;
  var handsetInfo = msg.handsetInfo;
  var appInfo = msg.appInfo;

  var loginInfo = {};
  loginInfo.userId = msg.username;
  loginInfo.authToken = msg.authToken;
  loginInfo.handset = msg.handset;

  userDao.signIn()

};