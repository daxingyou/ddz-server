/**
 * Created by edwardzhou on 13-12-2.
 */
var util = require('util');
var utils = require('../../util/utils');
var FilterBase = require('./filterBase');
var ErrorCode = require('../../consts/errorCode');

var CheckSeqNoFilter = function(opts) {
  FilterBase.call(this, opts);
};

util.inherits(CheckSeqNoFilter, FilterBase);

module.exports = CheckSeqNoFilter;

CheckSeqNoFilter.execute = function(params, cb) {

//  if (! this.super_.prototype.execute.call(this, params, cb))
//    return false;

  var action = params.action;
  var table = params.table;
  var player = params.player;
  var seqNo = params.seqNo;
  var pokeGame = table.pokeGame;
  var nextUserId = (!!pokeGame)? pokeGame.token.nextUserId : table.nextUserId;
  var currentSeqNo = (!!pokeGame)? pokeGame.token.currentSeqNo : table.currentSeqNo;

  if (player.userId != nextUserId || seqNo != currentSeqNo) {
    utils.invokeCallback(cb, {err: ErrorCode.NOT_IN_TURN});
    return false;
  }

  utils.invokeCallback(cb, null, params);
  return true;
};