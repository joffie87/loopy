/**********************************

TOUCH GESTURES
- Double tap to create node
- Double tap + hold to start drawing

**********************************/

window.TouchGestures = {};
TouchGestures.init = function(loopy){

	var self = {};

	// Configuration
	var DOUBLE_TAP_DELAY = 300; // ms between taps
	var DOUBLE_TAP_DISTANCE = 40; // pixels between tap positions
	var LONG_PRESS_DELAY = 400; // ms to hold for long press
	var MOVEMENT_THRESHOLD = 20; // pixels before canceling

	// State tracking
	var lastTapTime = 0;
	var lastTapX = 0;
	var lastTapY = 0;
	var longPressTimer = null;
	var isLongPressActive = false;
	var touchStartX = 0;
	var touchStartY = 0;
	var isDrawingFromLongPress = false;

	// Helper: Check if in pen mode
	var _isInPenMode = function(){
		return loopy.mode === Loopy.MODE_EDIT && loopy.tool === Loopy.TOOL_INK;
	};

	// Helper: Get distance between two points
	var _getDistance = function(x1, y1, x2, y2){
		var dx = x2 - x1;
		var dy = y2 - y1;
		return Math.sqrt(dx*dx + dy*dy);
	};

	// Helper: Convert touch to canvas coordinates
	var _getTouchCanvasCoords = function(touch){
		var canvasses = document.getElementById("canvasses");
		var offset = _getTotalOffset(canvasses);
		var x = touch.clientX - offset.left;
		var y = touch.clientY - offset.top;

		// Apply camera transforms (same as Mouse.js)
		var tx = 0;
		var ty = 0;
		var s = 1/loopy.offsetScale;
		var CW = canvasses.clientWidth - _PADDING - _PADDING;
		var CH = canvasses.clientHeight - _PADDING_BOTTOM - _PADDING;

		if(loopy.embedded){
			tx -= _PADDING/2;
			ty -= _PADDING/2;
		}

		tx -= (CW+_PADDING)/2;
		ty -= (CH+_PADDING)/2;

		tx = s*tx;
		ty = s*ty;

		tx += (CW+_PADDING)/2;
		ty += (CH+_PADDING)/2;

		tx -= loopy.offsetX;
		ty -= loopy.offsetY;

		return {
			x: x*s + tx,
			y: y*s + ty
		};
	};

	// Cancel any pending timers
	var _cancelGestures = function(){
		if(longPressTimer){
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
		isLongPressActive = false;
		isDrawingFromLongPress = false;
	};

	// Create a node at the given position
	var _createNodeAtPosition = function(x, y){
		var config = {
			x: x,
			y: y
		};
		loopy.model.addNode(config);
		publish("model/changed");
	};

	// Start drawing from long press
	var _startDrawingFromLongPress = function(x, y){
		isDrawingFromLongPress = true;

		// Simulate mousedown for ink tool
		Mouse.x = x;
		Mouse.y = y;
		Mouse.pressed = true;
		Mouse.moved = false;
		Mouse.startedOnTarget = true;

		// Initialize ink stroke
		if(loopy.ink){
			loopy.ink.strokeData = [];
			loopy.ink.strokeData.push([x, y]);
			loopy.ink.drawInk();
		}
	};

	// Handle touch start
	var _onTouchStart = function(event){
		// Only handle in pen mode
		if(!_isInPenMode()) return;

		// Ignore multi-touch (let camera handle it)
		if(event.touches.length !== 1) return;

		var touch = event.touches[0];
		var coords = _getTouchCanvasCoords(touch);
		var now = Date.now();

		touchStartX = coords.x;
		touchStartY = coords.y;

		// Check if this is a second tap (potential double tap)
		var timeSinceLastTap = now - lastTapTime;
		var distanceFromLastTap = _getDistance(coords.x, coords.y, lastTapX, lastTapY);

		if(timeSinceLastTap < DOUBLE_TAP_DELAY && distanceFromLastTap < DOUBLE_TAP_DISTANCE){
			// This is the second tap of a double tap
			// Start long press timer
			longPressTimer = setTimeout(function(){
				isLongPressActive = true;
				_startDrawingFromLongPress(coords.x, coords.y);
			}, LONG_PRESS_DELAY);

			// Reset double tap tracking
			lastTapTime = 0;
			lastTapX = 0;
			lastTapY = 0;
		} else {
			// This is a first tap
			lastTapTime = now;
			lastTapX = coords.x;
			lastTapY = coords.y;
		}
	};

	// Handle touch move
	var _onTouchMove = function(event){
		// Only handle in pen mode
		if(!_isInPenMode()) return;

		// Ignore multi-touch
		if(event.touches.length !== 1){
			_cancelGestures();
			return;
		}

		var touch = event.touches[0];
		var coords = _getTouchCanvasCoords(touch);

		// If we're drawing from long press, update the stroke
		if(isDrawingFromLongPress){
			Mouse.x = coords.x;
			Mouse.y = coords.y;
			Mouse.moved = true;

			if(loopy.ink){
				loopy.ink.drawInk();
			}
			return;
		}

		// If waiting for long press, check if movement cancels it
		if(longPressTimer){
			var distance = _getDistance(coords.x, coords.y, touchStartX, touchStartY);
			if(distance > MOVEMENT_THRESHOLD){
				_cancelGestures();
			}
		}
	};

	// Handle touch end
	var _onTouchEnd = function(event){
		// Only handle in pen mode
		if(!_isInPenMode()) return;

		var coords = null;
		if(event.changedTouches && event.changedTouches[0]){
			coords = _getTouchCanvasCoords(event.changedTouches[0]);
		}

		// If we were drawing from long press, finalize the stroke
		if(isDrawingFromLongPress){
			Mouse.pressed = false;
			Mouse.startedOnTarget = false;

			// Finalize the ink stroke (trigger mouseup logic)
			if(loopy.ink && loopy.ink.strokeData.length >= 2 && Mouse.moved){
				publish("mouseup");
			}

			_cancelGestures();
			return;
		}

		// If long press timer is still running, it means finger lifted before long press
		// This is a plain double tap - create a node
		if(longPressTimer){
			clearTimeout(longPressTimer);
			longPressTimer = null;

			if(coords){
				_createNodeAtPosition(coords.x, coords.y);
			}
			return;
		}

		// Clean up
		_cancelGestures();
	};

	// Attach listeners to canvasses element
	var canvasses = document.getElementById("canvasses");
	if(canvasses){
		canvasses.addEventListener("touchstart", _onTouchStart, {passive: true});
		canvasses.addEventListener("touchmove", _onTouchMove, {passive: true});
		canvasses.addEventListener("touchend", _onTouchEnd, {passive: true});
	}

	return self;
};
