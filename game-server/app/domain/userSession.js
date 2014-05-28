/**
 * Created by edwardzhou on 14-2-11.
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var crypto = require('crypto');
var uuid = require('node-uuid');
var utils = require('../util/utils');

var userSessionSchema = new mongoose.Schema({
  userId: Number,
  sessionToken: {type:String, default: uuid.v1},
  sessionStart: {type:Date, default: Date.now},
  sessionData: {type: Schema.Types.Mixed, default: {_placeholder:0}},
  createdAt: {type: Date, default: Date.now},
  updatedAt: {type: Date, default: Date.now, expires: 60 * 60}
});

userSessionSchema.index({sessionToken: 1});

userSessionSchema.statics.createSession = function(userId, cb) {
  var newSession = new this();
  newSession.userId = userId;
  newSession.save(function(err, session) {
    utils.invokeCallback(cb, err, session);
  });
};

userSessionSchema.statics.getByToken = function(token, cb) {
  this.findOne({sessionToken: token}, function(err, userSession){
    utils.invokeCallback(cb, err, userSession);
  });
};

userSessionSchema.methods.sget = function(key) {
  return this.sessionData[key];
};

userSessionSchema.methods.sset = function(key, value) {
  this.sessionData[key] = value;
  this.updatedAt = Date.now();
  var updateFields = {};
  updateFields['sessionData.' + key] = value;
  updateFields['updatedAt'] = this.updatedAt;
  this.update(updateFields, function(err, affected) {
    console.log('update: ', err, affected);
  });
};

var UserSession = mongoose.model('UserSession', userSessionSchema);


module.exports = UserSession;