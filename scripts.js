'use strict';
var BattleshipsClass = function() {
    // events log management
    var debug = true,
    // battle boards axis Y legend
        axisY = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
    // battle boards axis X legend
        axisX = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    // whether the game has started
        gameStarted = false,
    // whether the game has ended
        gameEnded = false,
    // whether player started the game
        playerStarted = false,
    // which player's turn is now
        whoseTurn = 0,
    // battle boards
        $battleground = null,
    // we want a 100% of the grade :) <3 :*
        teacherMode = false;

    this.run = function() {
        $battleground = $('div:gt(0) div:not(:first-child)', 'div.board');
        $battleground.board = function(index) {
            return index === 0 ? $battleground.slice(0, 100) : $battleground.slice(100);
        };

        // board handling
        $battleground.on('click', battlegroundClickCallback);

        // starting the game
        $('#start').on('click', startClickCallback);

        // updating player's name
        $('.name_update')
            .on('click', nameUpdateClickCallback)
            .siblings(':text')
                .on({keyup: nameUpdateTextKeyupCallback, blur: nameUpdateTextBlurCallback});

        // starts new game
        $('#new_game').on('click', newGameClickCallback);

        // shoot randomly
        $('#random_shot').on('click', randomShot);

        // set ships randomly
        $('#random_ships').on('click', {retry: 2}, randomShips);
    };

    function battlegroundClickCallback() {
        var $field = $(this);
        // shoot
        if (gameStarted) {
            // either player and other board or the opposite
            if (!!whoseTurn === ($battleground.index($field) >= 100)) {
                alert('It\'s other player\'s turn');
                return false;
            }
            shot($field);
        // either started and other board or not started and player board
        } else if (playerStarted === ($battleground.index($field) >= 100)) {
            $field.toggleClass('ship');
        }
    }

    function startClickCallback() {
        if (gameStarted) {
            alert('You have already started the game');
            return false;
        }

        if (checkShips($battleground.board(whoseTurn)) === false) {
            alert('There is either not enough ships or they\'re set incorrectly');
            return false;
        }

        if (playerStarted) {
            gameStarted = true;
            $('#start').prop('disabled', true);
            $('#random_shot, #random_ships').toggle();
        } else {
            playerStarted = true;
        }

        $('div.board').eq(whoseTurn).addClass('hide_ships');
        setTurn(findWaitingPlayer());
    }

    function nameUpdateClickCallback() {
        $(this).hide().siblings(':text').show().select();
    }

    function nameUpdateTextKeyupCallback(event) {
        var $input, newName, $nameElement, nameClassSelector;

        // if pressed ESC - leave the input, if ENTER - process, if other - do nothing
        if (event.which !== 13) {
            if (event.which === 27) {
                $(this).blur();
            }

            return true;
        }

        $input = $(this);
        newName = $input.val();
        customLog({name: newName});

        if (newName === 'Teacher') {
            teacherMode = true;
            customLog('Teacher mode enabled :)');
        }

        $nameElement = $input.hide().siblings('span');
        nameClassSelector = $nameElement.hasClass('player_name') ? '.player_name' : '.other_name';
        $(nameClassSelector).text(newName);
        $nameElement.show();
    }

    function nameUpdateTextBlurCallback() {
        var newName;

        if ($(this).has(':visible')) {
            newName = $(this).siblings('span').text();
            $(this).hide().val(newName).siblings('span').show();
        }
    }

    function newGameClickCallback() {
        if (gameEnded || confirm('Are you sure you want to quit the current game?')) {
            $battleground.removeClass();
            gameStarted = false;
            gameEnded = false;
            playerStarted = false;

            setTurn(0);

            $('#start').prop('disabled', false);
            $('#random_shot').hide();
            $('#random_ships').show();
            $('div.board').removeClass('hide_ships');
        }
    }

    function shot($field) {
        var position,
            shotResult;

        if (!gameStarted) {
            alert('You can\'t shoot at the moment - game has not started');
            return;
        }

        if ($field.is('.miss, .hit')) {
            customLog('You either already shot this field, or no ship could be there');
            return;
        }

        position = new PositionClass(getPosition($field), findWaitingPlayer());
        shotResult = $field.hasClass('ship')
            ? (isSunk(position) ? 'sunk' : 'hit')
            : 'miss';
        customLog({shot: getCoords($field)});
        customLog(shotResult);

        markShot(position, shotResult);

        if (shotResult === 'miss') {
            setTurn(findWaitingPlayer());
        }

        if (shotResult === 'sunk') {
            checkGameEnd();
        }
    }

    /**
     * @param {Object} element
     * @return {Array}
     */
    function getCoords(element) {
        var index = $battleground.index(element),
            indexes, coordY, coordX;

        indexes = indexToArray(index);

        coordY = axisY[ indexes[1] ];
        coordX = axisX[ indexes[0] ];

        return [coordY, coordX];
    }

    /**
     * @param {PositionClass} position
     * @param {string} shotResult
     * @param {Number} [direction]
     */
    function markShot(position, shotResult, direction) {
        var markClass = '',
            missedPositions = [],
            $closeField,
            i;

        switch (shotResult) {
            case 'miss':
                markClass = 'miss';
                missedPositions.push(position);
                break;

            case 'hit':
                markClass = 'hit';
                missedPositions = position.getCornerPositions();
                break;

            case 'sunk':
                markClass = 'hit';
                missedPositions = position.getSurroundingPositions();
                break;
        }

        for (i = 0; i < missedPositions.length; i++) {
            var missedPosition = missedPositions[i];
            if (missedPosition === null || (direction !== undefined && direction !== i)) {
                continue;
            }

            $closeField = missedPosition.getField();
            if ($closeField.hasClass('hit') && shotResult === 'sunk') {
                markShot(missedPosition, shotResult, i);
            } else {
                $closeField.addClass('miss');
            }
        }

        if (direction === undefined) {
            position.getField().addClass(markClass);
        }
    }

    /**
     * @param {PositionClass} position
     * @param {Number} [direction]
     * @return {Boolean}
     */
    function isSunk(position, direction) {
        var sidePositions = position.getSidePositions(),
            sidePosition,
            $sideField,
            i;

        // @DRY - same as in mark_shot
        for (i = 0; i < sidePositions.length; i++) {
            sidePosition = sidePositions[i];
            if (sidePosition === null || (direction !== undefined && direction !== i)) {
                continue;
            }

            $sideField = sidePosition.getField();
            if ($sideField.hasClass('hit')) {
                if (isSunk(sidePosition, i) === false) {
                    return false;
                }
            } else if ($sideField.hasClass('ship')) {
                return false;
            }
        }

        return true;
    }

    function checkGameEnd() {
        if (gameEnded) {
            return;
        }

        if ($battleground.board(0).filter('.hit').length >= 20) {
            alert($('.other_name:first').text() + ' won');
            gameEnded = true;
        } else if ($battleground.board(1).filter('.hit').length >= 20) {
            alert($('.player_name:first').text() + ' won');
            gameEnded = true;
        }
    }

    /**
     * @param {Number} playerNumber
     */
    function setTurn(playerNumber) {
        whoseTurn = playerNumber;
        $('.board_menu:eq(' + whoseTurn + ') span').addClass('turn');
        $('.board_menu:eq(' + findWaitingPlayer() + ') span').removeClass('turn');
    }

    /**
     * @return {Number}
     */
    function findWaitingPlayer() {
        return whoseTurn === 0 ? 1 : 0;
    }

    /**
     * @param {Object} $board
     * @return {Boolean}
     */
    function checkShips($board) {
        var shipsArray,
            shipsLength = 20,
            shipsTypes = {1:0, 2:0, 3:0, 4:0},
            directionMultipliers = [1, 10],
            topRightCorner,
            bottomRightCorner,
            borderIndex,
            borderDistance,
            index,
            key,
            idx,
            i, j, k;

        shipsArray = $board.filter('.ship').map(function() {
            return $board.index(this);
        }).toArray();

        if (shipsArray.length !== shipsLength) {
            customLog('incorrect number of masts');
            return false;
        }

        // check if no edge connection
        for (i = 0; i < shipsArray.length; i++) {
            idx = indexToArray(shipsArray[i]);

            if (idx[0] === 9) {
                continue;
            }

            topRightCorner = (idx[1] > 0) && ($.inArray(shipsArray[i] + 9, shipsArray) !== -1);
            bottomRightCorner = (idx[1] < 9) && ($.inArray(shipsArray[i] + 11, shipsArray) !== -1);

            if (topRightCorner || bottomRightCorner) {
                customLog('edge connection');
                return false;
            }
        }

        // check if there are the right types of ships
        for (i = 0; i < shipsArray.length; i++) {
            // we ignore masts which have already been marked as a part of a ship
            if (shipsArray[i] === null) {
                continue;
            }

            idx = indexToArray(shipsArray[i]);

            for (j = 0; j < directionMultipliers.length; j++) {
                borderIndex = parseInt(j) === 1 ? 0 : 1;
                borderDistance = parseInt(idx[borderIndex]);

                k = 1;
                // battleground border
                while (borderDistance + k <= 9) {
                    index = shipsArray[i] + (k * directionMultipliers[j]);
                    key = $.inArray(index, shipsArray);

                    // no more masts
                    if (key === -1) {
                        break;
                    }

                    shipsArray[key] = null;

                    // ship is too long
                    if (++k > 4) {
                        customLog('ship is too long');
                        return false;
                    }
                }

                // if not last direction check and only one (otherwise in both direction at least 1 mast would be found)
                if ((k === 1) && ((j + 1) !== directionMultipliers.length)) {
                    continue;
                }

                break; // either k > 1 (so ship found) or last loop
            }

            shipsTypes[k]++;
        }

        // strange way to check if ships_types === {1:4, 2:3, 3:2, 4:1}
        for (i in shipsTypes) {
            if (parseInt(i) + shipsTypes[i] !== 5) {
                customLog('incorrect number of ships of this type');
                customLog(shipsTypes);
                return false;
            }
        }

        return true;
    }

    function randomShot() {
        var $emptyFields = $battleground.board(findWaitingPlayer()).not('.miss, .hit'),
            index, currentPlayerSelector;

        if (teacherMode) {
            currentPlayerSelector = whoseTurn === 0 ? 'player' : 'other';
            // In this case you always hit :)
            if ($('.' + currentPlayerSelector + '_name:first').text() === 'Teacher') {
                $emptyFields = $battleground.board(findWaitingPlayer()).filter('.ship').not('.hit');
            }
        }

        // random from 0 to the amount of empty fields - 1 (because first's index is 0)
        index = Math.floor(Math.random() * $emptyFields.length);
        $emptyFields.eq(index).trigger('click');
    }

    function randomShips(event) {
        var orientations = [0, 1], // 0 - vertical, 1 - horizontal
            directionMultipliers = [1, 10],
            shipsTypes = {1:4, 2:3, 3:2, 4:1},
            $board = $battleground.board(whoseTurn),
            numberOfShips,
            masts,
            orientation,
            $startFields,
            index,
            idx,
            j, k;

        if (gameStarted) {
            alert('You can\'t set ships - the game has already started');
            return false;
        }

        $board.filter('.ship').click();
        for (numberOfShips in shipsTypes) {
            masts = shipsTypes[numberOfShips];

            for (j = 0; j < numberOfShips; j++) {
                orientation = orientations[ Math.floor(Math.random() * orientations.length) ];
                markRestrictedStarts($board, masts, orientation);
                $startFields = $board.not('.restricted');

                index = Math.floor(Math.random() * $startFields.length);
                idx = $board.index( $startFields.eq(index) );
                for (k = 0; k < masts; k++) {
                    $board.eq(idx + k * directionMultipliers[orientation]).click();
                }
            }
        }

        if (checkShips($board) === false) {
            if (event.data && event.data.retry > 0) {
                $board.removeClass('ship');
                event.data.retry--;

                return randomShips(event);
            }

            return false;
        }

        $board.removeClass('restricted');

        return true;
    }

    function markRestrictedStarts($board, masts, orientation) {
        var directionMultipliers = [1, 10],
            marks,
            i;

        marks = $board.filter('.ship').map(function() {
            var index = $board.index(this),
                idx = indexToArray(index),
                borderDistance = parseInt(idx[Number(!orientation)]),
                mark = [index],
                safeIndex,
                safeIdx,
                k;

            if (idx[0] < 9) {
                mark.push(index + 10);
                if (idx[1] < 9) {
                    mark.push(index + 11);
                }
                if (idx[1] > 0) {
                    mark.push(index + 9);
                }
            }

            if (idx[0] > 0) {
                mark.push(index - 10);
                if (idx[1] < 9) {
                    mark.push(index - 9);
                }
                if (idx[1] > 0) {
                    mark.push(index - 11);
                }
            }

            if (idx[1] < 9) {
                mark.push(index + 1);
            }

            if (idx[1] > 0) {
                mark.push(index - 1);
            }

            for (k = 2; (borderDistance - k >= 0) && (k <= masts); k++) {
                safeIndex = index - (k * directionMultipliers[orientation]);
                safeIdx = indexToArray(safeIndex);
                mark.push(safeIndex);

                if (safeIdx[orientation] > 0) {
                    mark.push(safeIndex - directionMultipliers[Number(!orientation)]);
                }
                if (safeIdx[orientation] < 9) {
                    mark.push(safeIndex + directionMultipliers[Number(!orientation)]);
                }
            }

            return mark;
        }).toArray();

        $board.removeClass('restricted');

        for (i = 0; i < marks.length; i++) {
            $board.eq(marks[i]).addClass('restricted');
        }

        if (orientation === 0) {
            $board.filter('div:nth-child(n+' + (13 - masts) + ')').addClass('restricted');
        } else {
            $board.slice((11 - masts) * 10).addClass('restricted');
        }
    }

    /**
     * Convert: 1 -> [0,1], 12 -> [1,2], 167 -> [6,7]
     * @param {Number} index
     * @return Array
     */
    function indexToArray(index) {
        if (index >= 100) {
            index = index - 100;
        }

        return ((index < 10 ? '0' : '') + index).split('');
    }

    /**
     * @param {Object} $field
     * @returns {Array}
     */
    function getPosition($field) {
        var index = $battleground.index($field),
            indexes = indexToArray(index);

        return [parseInt(indexes[1]), parseInt(indexes[0])];
    }

    function customLog(log) {
        if (debug !== true) {
            return;
        }

        console.log(log);
    }

    /**
     * @param {Array} position
     * @param {Number} boardNumber
     * @constructor
     */
    var PositionClass = function(position, boardNumber) {

        this.getField = function() {
            // parseInt('08') -> 0
            var index = parseInt([position[1], position[0]].join(''), 10);

            return $battleground.board(boardNumber).eq(index);
        };

        this.getPositionY = function() {
            return position[0];
        };

        this.getPositionX = function() {
            return position[1];
        };

        this.getLeftPosition = function() {
            return position[1] > 0 ? new PositionClass([position[0], position[1] - 1], boardNumber) : null;
        };

        this.getRightPosition = function() {
            return position[1] < 9 ? new PositionClass([position[0], position[1] + 1], boardNumber) : null;
        };

        this.getTopPosition = function() {
            return position[0] > 0 ? new PositionClass([position[0] - 1, position[1]], boardNumber) : null;
        };

        this.getBottomPosition = function() {
            return position[0] < 9 ? new PositionClass([position[0] + 1, position[1]], boardNumber) : null;
        };

        this.getLeftTopPosition = function() {
            return (position[0] > 0 && position[1] > 0) ? new PositionClass([position[0] - 1, position[1] - 1], boardNumber) : null;
        };

        this.getRightTopPosition = function() {
            return (position[0] > 0 && position[1] < 9) ? new PositionClass([position[0] - 1, position[1] + 1], boardNumber) : null;
        };

        this.getLeftBottomPosition = function() {
            return (position[0] < 9 && position[1] > 0) ? new PositionClass([position[0] + 1, position[1] - 1], boardNumber) : null;
        };

        this.getRightBottomPosition = function() {
            return (position[0] < 9 && position[1] < 9) ? new PositionClass([position[0] + 1, position[1] + 1], boardNumber) : null;
        };

        this.getSurroundingPositions = function() {
            return [
                this.getLeftPosition(),
                this.getRightPosition(),
                this.getTopPosition(),
                this.getBottomPosition(),
                this.getLeftTopPosition(),
                this.getRightTopPosition(),
                this.getLeftBottomPosition(),
                this.getRightBottomPosition()
            ];
        };

        this.getSidePositions = function() {
            return [
                this.getLeftPosition(),
                this.getRightPosition(),
                this.getTopPosition(),
                this.getBottomPosition()
            ];
        };

        this.getCornerPositions = function() {
            return [
                this.getLeftTopPosition(),
                this.getRightTopPosition(),
                this.getLeftBottomPosition(),
                this.getRightBottomPosition()
            ];
        };
    };
};

var Battleships = new BattleshipsClass();
Battleships.run();