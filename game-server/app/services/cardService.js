var logger = require('pomelo-logger').getLogger('pomelo', __filename);
var util = require('util');
var utils = require('../util/utils');
var cardUtil = require('../util/cardUtil');
var GameRoom = require('../domain/gameRoom');
var GameTable = require('../domain/gameTable');
var Player = require('../domain/player');
var PlayerState = require('../consts/consts').PlayerState;
var GameEvent = require('../consts/consts').Event.GameEvent;
var messageService = require('./messageService');
var PokeCard = require('../domain/pokeCard');
var grabLordAction = require('./actions/grabLord');
var playCardAction = require('./actions/playCard');

var exp = module.exports;

var theApp = null;

exp.init = function (app) {
  theApp = app;
};

/**
 * 排序比较函数
 * @param p1
 * @param p2
 * @returns {number}
 * @private
 */
var _sortPokeCard = function(p1, p2) {
  return p1.pokeIndex - p2.pokeIndex;
};


var runAction = function(action, params, beforeFilters, afterFilters, cb) {
  var tasks = [];
  tasks.push(function(callback){
    callback(params);
  });

  if (!!beforeFilters) {
    for (var index in beforeFilters) {
      tasks.push(beforeFilters[index]);
    }
  }

  tasks.push(action);

  if (!!afterFilters) {
    for (var index in afterFilters) {
      tasks.push(afterFilters[index]);
    }
  }

  async.waterfall(tasks, function(err, result) {
    if (!!err) {
      utils.invokeCallback(cb, err);
    } else {
      utils.invokeCallback(cb, null, result);
    }
  });
};

var setupNextPlayerTimeout = function (table, func, seconds) {
  var pokeGame = table.pokeGame;
  var nextPlayer = pokeGame.getPlayerByUserId(pokeGame.token.nextUserId);
  var seqNo = pokeGame.token.currentSeqNo;
  var tm = seconds;
  if (!tm)
    tm = (!nextPlayer.isDelegating())? 35 : 3;

  pokeGame.actionTimeout = setTimeout(function(){
      func(table, nextPlayer, seqNo);
    }, tm * 1000);
};


exp.onPlayerReady = function (table, player, cb) {
  logger.info("onPlayerReady");
  messageService.pushTableMessage(table, "onPlayerJoin", table.toParams(), null );

  if ( (table.players.length == 3) &&
    table.players[0].isReady() && table.players[1].isReady() && table.players[2].isReady()) {
    exp.startGame(table);
  }
};

/**
 * 执行玩家就绪动作
 * @param table - 玩家所在的桌子
 * @param player - 就绪的玩家
 * @param cb
 */
exp.doPlayerReady = function(table, player, cb) {
  // 玩家状态设为 READY
  player.state = PlayerState.READY;
  // 通知同桌玩家
  messageService.pushTableMessage(table, GameEvent.playerReady, table.toParams(), null);

  // 如果3个玩家都已就绪，这开始牌局
  if (table.players.length == 3 &&
    table.players[0].isReady() &&
    table.players[1].isReady() &&
    table.players[2].isReady()) {
    process.nextTick(function() {
      exp.startGame(table);
    });
  }
}

/**
 * 开始牌局
 * @param table - 要开始牌局的桌子
 * @param cb
 */
exp.startGame = function (table, cb) {
  // 洗牌
  var pokeCards = PokeCard.shuffle();
  var pokeCards1 = [];
  var pokeCards2 = [];
  var pokeCards3 = [];

  // 派牌, 保留最后3张为地主牌
  while(pokeCards.length>3) {
    pokeCards1.push(pokeCards.shift());
    pokeCards2.push(pokeCards.shift());
    pokeCards3.push(pokeCards.shift());
  }

  // 把牌排序后分给各玩家
  table.players[0].setPokeCards(pokeCards1.sort(_sortPokeCard));
  table.players[1].setPokeCards(pokeCards2.sort(_sortPokeCard));
  table.players[2].setPokeCards(pokeCards3.sort(_sortPokeCard));

  // 保存地主牌
  table.lordPokeCards = pokeCards.sort(_sortPokeCard);

  // 创建新牌局
  var newPokeGame = PokeGame.newGame(table.room.getRoomId(), table.tableId, table.players);
  newPokeGame.lordPokeCards = cardUtil.pokeCardsToString(table.lordPokeCards);

  table.pokeGame = newPokeGame;

  newPokeGame.state = GameState.GRABBING_LORD;
  newPokeGame.grabbingLord = {lastUserId: null, lordValue: 0, nextUserId: null};

  // 随机指定第一个叫地主的用户
  var lordUserIndex = (new Date()).getTime() % 3;
  var lordUserId = table.players[lordUserIndex].userId;
  table.nextUserId = lordUserId;
  table.lastUserId = null;

  newPokeGame.grabbingLord.nextUserId = lordUserId;

  // 通知各玩家牌局开始
  for (var index=0; index<table.players.length; index ++) {
    var player = table.players[index];
    messageService.pushMessage(GameEvent.gameStart,
      {
//        player: player.toParams(),
        grabLord: (player.userId == lordUserId ? 1 : 0),
        pokeCards: player.pokeCardsString(),
        gameId: newPokeGame.gameId
      },
      [player.getUidSid()],
      null);
  }
};

/**
 * 玩家叫地主
 * @param table - 玩家所在的桌子
 * @param player - 玩家
 * @param lordValue - 地主分数 (0 - 不叫, 1 - 1分， 2 - 2分， 3 - 3分)
 * @param cb
 */
exp.grabLord = function(table, player, lordValue, seqNo, cb) {
//  grabLordAction.doGrabLord(table, player, lordValue, function(err, gameTable, msgBack) {
//    // 有错误
//    if (err != null) {
//      utils.invokeCallback(cb, err);
//      return;
//    }
//
//    var gameEvent = GameEvent.grabLord;
//    if (gameTable.pokeGame == null) {
//      // 流局
//      gameEvent = GameEvent.gameAbandonded;
//    }
//
//    // 回调请求结果
//    utils.invokeCallback(cb, {resultCode:0});
//
//    // 通知叫地主结果
//    process.nextTick(function() {
//      messageService.pushTableMessage(gameTable, gameEvent, msgBack, null);
//    });
//  });

  var params = {table: table, player: player, seqNo: seqNo};
  var actionResult = null;
  var action = function(params, callback) {
    grabLordAction.doGrabLord(table, player, lordValue, function(err, result) {
      actionResult = result;
      callback(err, params);
    });
  };

  runAction(action, params, exp.beforeFilters, exp.afterFilters, function(err, result) {
    if (!!err) {
      utils.invokeCallback(cb, err);
    } else {
      utils.invokeCallback(cb, {resultCode:0});

      var pokeGame = table.pokeGame;
      var eventName = GameEvent.grabLord;
      var gameAbandoned = (pokeGame == null);
      if (gameAbandoned) {
        eventName = GameEvent.gameAbandonded;
      }

      messageService.pushTableMessage(table,
        eventName,
        actionResult,
        null );

      if (!gameAbandoned) {
        var nextPlayer = pokeGame.getPlayerByUserId(pokeGame.token.nextUserId);
        var seqNo = pokeGame.token.currentSeqNo;
        var tm = (!nextPlayer.isDelegating())? 35 : 3;

        pokeGame.actionTimeout = setTimeout(function(){
          exp.playCard(table, nextPlayer, '', seqNo, true, null);
        }, tm * 1000);
      }
    }
  });


};

/**
 * 出牌
 * @param table
 * @param player
 * @param pokeChars
 * @param cb
 */
exp.playCard = function(table, player, pokeChars, seqNo, isTimeout, cb) {

  var params = {table: table, player: player, seqNo: seqNo};
  var actionResult = null;
  var action = function(params, callback) {
    playCardAction.doPlayerCard(table, player, pokeChars, function(err, result){
      actionResult = result;
      callback(err, params);
    });
  };

  runAction(action, params, exp.beforeFilters, exp.afterFilters, function(err, result) {
    if (!!err) {
      utils.invokeCallback(cb, err);
    } else {
      utils.invokeCallback(cb, {resultCode:0});

      var pokeGame = table.pokeGame;
      var eventName = GameEvent.playCard;

      messageService.pushTableMessage(table,
        eventName,
        {
          playerId: player.userId,
          pokeChars: pokeChars,
          nextUserId: pokeGame.token.nextUserId,
          currentSeqNo: pokeGame.token.currentSeqNo
        },
        null );

      setupNextPlayerTimeout(table, function(table, player, seqNo) {
          exp.playCard(table, player, '', seqNo, true, null);
        });
    }
  });

//  playerCardAction.doPlayCard(table, player, pokeChars, function(err, gameTable, gamePlayer) {
//    if (err) {
//      utils.invokeCallback(cb, err);
//      return;
//    }
//
//    var gameEvent = GameEvent.playCard;
//    utils.invokeCallback(cb, {resultCode: 0});
//
//    messageService.pushTableMessage(table, gameEvent, {playerId: player.userId, pokeChars: pokeChars}, null);
//  });
};