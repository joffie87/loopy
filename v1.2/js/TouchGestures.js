/**********************************

TOUCH GESTURES - Comprehensive Implementation

Only active when TouchMode.isTouchMode === true
Desktop behavior is completely unchanged.

Gestures supported:
- Pinch: zoom canvas
- Two-finger drag: pan canvas
- Single tap: select node/link or deselect
- Double tap on empty: create node
- Long press on node: move node
- Long press + drag to another node: create link

**********************************/

window.TouchGestures = {};
TouchGestures.init = function(loopy){

	// Early exit if dependencies not available
	if(typeof TouchMode === 'undefined'){
		console.warn('TouchGestures: TouchMode not available, skipping initialization');
		return;
	}

	var self = {};

	// Configuration
	var DOUBLE_TAP_DELAY = 300; // ms between taps
	var DOUBLE_TAP_DISTANCE = 40; // pixels
	var LONG_PRESS_DELAY = 400; // ms to trigger long press (reduced for responsiveness)
	var MOVEMENT_THRESHOLD = 40; // pixels before canceling long press (increased for natural wobble)
	var MIN_PINCH_DISTANCE = 40; // minimum distance between fingers for pinch

	// State tracking
	var lastTapTime = 0;
	var lastTapX = 0;
	var lastTapY = 0;
	var longPressTimer = null;
	var longPressStartX = 0;
	var longPressStartY = 0;
	var longPressTarget = null; // node or link being long-pressed

	// Edge dragging state
	var draggingEdge = null;
	var edgeDragOffsetX = 0;
	var edgeDragOffsetY = 0;

	// Pinch/pan state
	var initialPinchDistance = 0;
	var initialScale = 1;
	var lastPanX = 0;
	var lastPanY = 0;

	/**
	 * Get distance between two touch points
	 */
	var _getDistance = function(x1, y1, x2, y2){
		var dx = x2 - x1;
		var dy = y2 - y1;
		return Math.sqrt(dx*dx + dy*dy);
	};

	/**
	 * Get midpoint between two touch points
	 */
	var _getMidpoint = function(touch1, touch2){
		return {
			x: (touch1.clientX + touch2.clientX) / 2,
			y: (touch1.clientY + touch2.clientY) / 2
		};
	};

	/**
	 * Convert client coordinates to canvas coordinates
	 */
	var _clientToCanvas = function(clientX, clientY){
		var canvasses = document.getElementById("canvasses");
		if(!canvasses) return {x: 0, y: 0};

		var rect = canvasses.getBoundingClientRect();
		var x = clientX - rect.left;
		var y = clientY - rect.top;

		// Apply camera transforms
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

	/**
	 * Find node at given canvas coordinates
	 */
	var _getNodeAtPoint = function(canvasX, canvasY){
		return loopy.model.getNodeByPoint(canvasX, canvasY);
	};

	/**
	 * Find edge at given canvas coordinates
	 */
	var _getEdgeAtPoint = function(canvasX, canvasY){
		return loopy.model.getEdgeByPoint(canvasX, canvasY);
	};

	/**
	 * Update edge arc based on drag position (from Dragger.js logic)
	 */
	var _updateEdgeArc = function(edge, labelX, labelY){
		if(edge.from !== edge.to){
			// Regular edge between two different nodes
			var fx = edge.from.x, fy = edge.from.y;
			var tx = edge.to.x, ty = edge.to.y;
			var dx = tx - fx, dy = ty - fy;
			var a = Math.atan2(dy, dx);

			// Calculate arc from label position
			var points = [[labelX, labelY]];
			var translated = _translatePoints(points, -fx, -fy);
			var rotated = _rotatePoints(translated, -a);
			var newLabelPoint = rotated[0];

			// Update arc (negative because of coordinate system)
			edge.arc = -newLabelPoint[1];
		} else {
			// Self-arrow: get angle & magnitude from label position
			var dx = labelX - edge.from.x;
			var dy = labelY - edge.from.y;
			var a = Math.atan2(dy, dx);
			var mag = Math.sqrt(dx*dx + dy*dy);

			// Minimum magnitude
			var minimum = edge.from.radius + 25;
			if(mag < minimum) mag = minimum;

			// Update edge
			edge.arc = mag;
			edge.rotation = a * (360 / Math.TAU) + 90;
		}
	};

	/**
	 * Cancel any pending gestures
	 */
	var _cancelGestures = function(){
		if(longPressTimer){
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
		longPressTarget = null;
		draggingEdge = null;
	};

	/**
	 * Create node at position
	 */
	var _createNode = function(canvasX, canvasY){
		var config = {
			x: canvasX,
			y: canvasY
		};
		loopy.model.addNode(config);
		publish("model/changed");
		publish("mousemove"); // Trigger immediate redraw
	};

	/**
	 * Select a node or edge
	 */
	var _selectObject = function(obj){
		if(!obj) return;
		loopy.sidebar.edit(obj);
		TouchMode.setState(TouchMode.STATE.SELECTION_ACTIVE);
	};

	/**
	 * Deselect everything
	 */
	var _deselectAll = function(){
		loopy.sidebar.showPage("Edit");
		TouchMode.resetState();
	};

	// ========================================
	// TOUCH EVENT HANDLERS
	// ========================================

	var _onTouchStart = function(event){
		// Only handle when in touch mode
		if(!TouchMode.isTouchMode) return;

		var touches = event.touches;
		var now = Date.now();

		// TWO-FINGER GESTURES: Pinch zoom or pan
		if(touches.length === 2){
			_cancelGestures();

			var touch1 = touches[0];
			var touch2 = touches[1];
			var distance = _getDistance(touch1.clientX, touch1.clientY,
			                            touch2.clientX, touch2.clientY);

			if(distance > MIN_PINCH_DISTANCE){
				// Initialize pinch zoom
				initialPinchDistance = distance;
				initialScale = loopy.offsetScale;
				TouchMode.setState(TouchMode.STATE.ZOOMING_CANVAS);

				// Also track for potential pan
				var mid = _getMidpoint(touch1, touch2);
				lastPanX = mid.x;
				lastPanY = mid.y;
			}
			return;
		}

		// SINGLE-FINGER GESTURES
		if(touches.length === 1){
			var touch = touches[0];
			var coords = _clientToCanvas(touch.clientX, touch.clientY);

			// Check if tapping on an object
			var node = _getNodeAtPoint(coords.x, coords.y);
			var edge = !node ? _getEdgeAtPoint(coords.x, coords.y) : null;
			var target = node || edge;

			// Start long-press timer for nodes or edges
			if(node){
				longPressStartX = coords.x;
				longPressStartY = coords.y;
				longPressTarget = node;

				longPressTimer = setTimeout(function(){
					// Long press triggered - enter move mode
					longPressTimer = null; // Clear timer so movement isn't cancelled
					TouchMode.setState(TouchMode.STATE.MOVING_NODE);
					console.log('TouchGestures: Long press activated - now moving node:', longPressTarget);
				}, LONG_PRESS_DELAY);
			}
			else if(edge){
				longPressStartX = coords.x;
				longPressStartY = coords.y;
				longPressTarget = edge; // Store edge as target

				longPressTimer = setTimeout(function(){
					// Long press triggered - enter edge edit mode
					longPressTimer = null; // Clear timer so movement isn't cancelled
					draggingEdge = edge;
					edgeDragOffsetX = longPressStartX - edge.labelX;
					edgeDragOffsetY = longPressStartY - edge.labelY;
					TouchMode.setState(TouchMode.STATE.EDITING_EDGE);
					console.log('TouchGestures: Long press activated - now editing edge:', draggingEdge);
				}, LONG_PRESS_DELAY);
			}

			// Track for double-tap detection
			var timeSinceLastTap = now - lastTapTime;
			var distanceFromLastTap = _getDistance(touch.clientX, touch.clientY, lastTapX, lastTapY);

			if(timeSinceLastTap < DOUBLE_TAP_DELAY && distanceFromLastTap < DOUBLE_TAP_DISTANCE){
				// This is a double-tap!
				_cancelGestures();

				if(target){
					// Double-tap on object - treat as interaction (select)
					_selectObject(target);
				} else {
					// Double-tap on empty space - create node
					_createNode(coords.x, coords.y);
				}

				// Reset double-tap tracking
				lastTapTime = 0;
				lastTapX = 0;
				lastTapY = 0;
			} else {
				// First tap - record it
				lastTapTime = now;
				lastTapX = touch.clientX;
				lastTapY = touch.clientY;
			}
		}
	};

	var _onTouchMove = function(event){
		// Only handle when in touch mode
		if(!TouchMode.isTouchMode) return;

		var touches = event.touches;

		// TWO-FINGER: Pinch zoom and/or pan
		if(touches.length === 2){
			var touch1 = touches[0];
			var touch2 = touches[1];
			var distance = _getDistance(touch1.clientX, touch1.clientY,
			                            touch2.clientX, touch2.clientY);
			var mid = _getMidpoint(touch1, touch2);

			// Handle pinch zoom
			if(TouchMode.isState(TouchMode.STATE.ZOOMING_CANVAS) && initialPinchDistance > 0){
				var scale = (distance / initialPinchDistance) * initialScale;
				scale = Math.max(0.25, Math.min(4.0, scale)); // clamp
				loopy.offsetScale = scale;
			}

			// Handle two-finger pan
			if(TouchMode.isState(TouchMode.STATE.ZOOMING_CANVAS)){
				var deltaX = mid.x - lastPanX;
				var deltaY = mid.y - lastPanY;
				loopy.offsetX += deltaX;
				loopy.offsetY += deltaY;
				lastPanX = mid.x;
				lastPanY = mid.y;
			}

			// Trigger redraw
			publish("mousemove");

			event.preventDefault();
			return;
		}

		// SINGLE-FINGER: Move node, edit edge, or create link
		if(touches.length === 1){
			var touch = touches[0];
			var coords = _clientToCanvas(touch.clientX, touch.clientY);

			// If in EDITING_EDGE state, adjust the arc
			if(TouchMode.isState(TouchMode.STATE.EDITING_EDGE) && draggingEdge){
				var labelX = coords.x - edgeDragOffsetX;
				var labelY = coords.y - edgeDragOffsetY;
				_updateEdgeArc(draggingEdge, labelX, labelY);
				loopy.model.update();
				publish("model/changed");
				publish("mousemove"); // Trigger redraw
			}
			// If in MOVING_NODE state, move the node
			else if(TouchMode.isState(TouchMode.STATE.MOVING_NODE) && longPressTarget){
				longPressTarget.x = coords.x;
				longPressTarget.y = coords.y;
				publish("model/changed");
				publish("mousemove"); // Trigger redraw
			}
			// Check if we've moved enough to cancel long-press
			else if(longPressTimer){
				var dist = _getDistance(coords.x, coords.y, longPressStartX, longPressStartY);
				if(dist > MOVEMENT_THRESHOLD){
					console.log('TouchGestures: Movement exceeded threshold, canceling long-press');
					_cancelGestures();
				}
			}

			event.preventDefault();
		}
	};

	var _onTouchEnd = function(event){
		// Only handle when in touch mode
		if(!TouchMode.isTouchMode) return;

		var touches = event.touches;

		// If still touching with one finger after releasing another
		if(touches.length === 1){
			// Transition from two-finger back to one-finger
			_cancelGestures();
			TouchMode.resetState();
			return;
		}

		// All fingers lifted
		if(touches.length === 0){
			var changedTouch = event.changedTouches[0];
			var coords = _clientToCanvas(changedTouch.clientX, changedTouch.clientY);

			// If we were editing an edge, finalize it
			if(TouchMode.isState(TouchMode.STATE.EDITING_EDGE)){
				console.log('TouchGestures: Finished editing edge');
				publish("mousemove"); // Final redraw
				TouchMode.resetState();
				_cancelGestures();
				return;
			}

			// If we were moving a node, finalize it
			if(TouchMode.isState(TouchMode.STATE.MOVING_NODE)){
				console.log('TouchGestures: Finishing node move/link operation');
				// Check if we ended on another node (link creation)
				var targetNode = _getNodeAtPoint(coords.x, coords.y);
				console.log('TouchGestures: Target node at end:', targetNode, 'Source:', longPressTarget);

				if(targetNode && longPressTarget && targetNode !== longPressTarget){
					// Create link from longPressTarget to targetNode
					var edgeConfig = {
						from: longPressTarget.id,
						to: targetNode.id
					};
					console.log('TouchGestures: Creating link:', edgeConfig);
					loopy.model.addEdge(edgeConfig);
					publish("model/changed");
					publish("mousemove"); // Trigger redraw
					console.log('TouchGestures: Link created successfully!');
				} else {
					// Just moved a node - trigger final redraw
					console.log('TouchGestures: Just moved node (no link)');
					publish("mousemove");
				}
				TouchMode.resetState();
				_cancelGestures();
				return;
			}

			// If we were zooming/panning, just reset
			if(TouchMode.isState(TouchMode.STATE.ZOOMING_CANVAS)){
				TouchMode.resetState();
				initialPinchDistance = 0;
				publish("mousemove"); // Final redraw after zoom/pan
				return;
			}

			// If long-press timer still running, it was a quick tap
			if(longPressTimer){
				_cancelGestures();

				// Single tap - select or deselect
				var node = _getNodeAtPoint(coords.x, coords.y);
				var edge = !node ? _getEdgeAtPoint(coords.x, coords.y) : null;
				var target = node || edge;

				if(target){
					_selectObject(target);
				} else {
					_deselectAll();
				}
			}

			TouchMode.resetState();
			_cancelGestures();
		}
	};

	// Attach event listeners
	var canvasses = document.getElementById("canvasses");
	if(canvasses){
		// Use passive: false so we can preventDefault
		canvasses.addEventListener("touchstart", _onTouchStart, {passive: false});
		canvasses.addEventListener("touchmove", _onTouchMove, {passive: false});
		canvasses.addEventListener("touchend", _onTouchEnd, {passive: false});
		console.log('TouchGestures: Comprehensive touch mode initialized');
	} else {
		console.warn('TouchGestures: canvasses element not found');
	}

	return self;
};
