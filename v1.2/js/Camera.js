/**********************************

CAMERA SYSTEM
Handles zoom and pan for both desktop and mobile

- Desktop: Alt + wheel to zoom, Alt + middle-drag to pan
- Mobile: Pinch to zoom, 2-finger drag to pan

**********************************/

window.Camera = {};

// Camera configuration
Camera.config = {
	MIN_SCALE: 0.25,
	MAX_SCALE: 4.0,
	ZOOM_FACTOR: 1.1,          // Zoom multiplier per wheel step
	TOUCH_PAN_FINGERS: 2       // Number of fingers required for pan (2 or 3)
};

Camera.init = function(loopy, target){

	var self = Camera;
	self.loopy = loopy;
	self.target = target;

	// Middle mouse pan state
	self.isPanning = false;
	self.panStartX = 0;
	self.panStartY = 0;
	self.panButton = -1;

	// Touch state
	self.touches = [];
	self.initialPinchDistance = 0;
	self.initialScale = 1;
	self.initialTouchCentroid = {x: 0, y: 0};

	/////////////////////////
	// DESKTOP: WHEEL ZOOM //
	/////////////////////////

	/**
	 * Handle mouse wheel events for zoom
	 * Alt + Wheel = Zoom in/out (centered on cursor)
	 * Desktop only - disabled in touch mode
	 */
	self.onWheel = function(event){

		// Skip in touch mode (TouchGestures handles all touch input)
		if(typeof TouchMode !== 'undefined' && TouchMode.isTouchMode) return;

		// Only handle if Alt key is pressed
		if(!event.altKey) return;

		event.preventDefault();
		event.stopImmediatePropagation();

		// Get zoom direction
		var delta = event.deltaY || event.wheelDelta || event.detail;
		var zoomIn = delta < 0;

		// Calculate new scale
		var oldScale = self.loopy.offsetScale;
		var newScale = zoomIn
			? oldScale * self.config.ZOOM_FACTOR
			: oldScale / self.config.ZOOM_FACTOR;

		// Clamp scale
		newScale = Math.max(self.config.MIN_SCALE, Math.min(self.config.MAX_SCALE, newScale));

		// Get mouse position relative to canvas
		var canvasses = document.getElementById("canvasses");
		var rect = canvasses.getBoundingClientRect();
		var mouseX = event.clientX - rect.left;
		var mouseY = event.clientY - rect.top;

		// Zoom around mouse cursor
		self.zoomAroundPoint(mouseX, mouseY, oldScale, newScale);

		// Trigger redraw
		publish("mousemove");

	};

	///////////////////////////////////
	// DESKTOP: MIDDLE MOUSE PAN /////
	///////////////////////////////////

	/**
	 * Handle middle mouse button pan
	 * Alt + Middle-drag = Pan the canvas
	 * Desktop only - disabled in touch mode
	 */
	self.onMouseDown = function(event){

		// Skip in touch mode (TouchGestures handles all touch input)
		if(typeof TouchMode !== 'undefined' && TouchMode.isTouchMode) return;

		// Only handle if Alt key is pressed and middle button (button 1)
		if(!event.altKey) return;
		if(event.button !== 1) return; // Middle button

		event.preventDefault();
		event.stopImmediatePropagation(); // Prevent other handlers from firing

		self.isPanning = true;
		self.panButton = event.button;
		self.panStartX = event.clientX;
		self.panStartY = event.clientY;

		// Change cursor
		self.target.style.cursor = 'grabbing';

	};

	self.onMouseMove = function(event){

		if(!self.isPanning) return;
		if(!event.altKey){
			// Alt key released, cancel pan
			self.stopPanning();
			return;
		}

		event.preventDefault();
		event.stopImmediatePropagation();

		var dx = event.clientX - self.panStartX;
		var dy = event.clientY - self.panStartY;

		// Update offset (pan is in screen space, so no scale adjustment needed)
		self.loopy.offsetX += dx;
		self.loopy.offsetY += dy;

		self.panStartX = event.clientX;
		self.panStartY = event.clientY;

		// Trigger redraw
		publish("mousemove");

	};

	self.onMouseUp = function(event){

		if(!self.isPanning) return;
		if(event.button !== self.panButton) return;

		self.stopPanning();

	};

	self.stopPanning = function(){
		self.isPanning = false;
		self.panButton = -1;
		self.target.style.cursor = '';
	};

	/////////////////////////
	// TOUCH: PINCH ZOOM ///
	/////////////////////////

	/**
	 * Handle touch events for pinch zoom and multi-finger pan
	 * Fallback only - disabled when TouchMode is active
	 */
	self.onTouchStart = function(event){

		// Skip in touch mode (TouchGestures handles all touch input)
		if(typeof TouchMode !== 'undefined' && TouchMode.isTouchMode) return;

		// Store all active touches
		self.touches = Array.from(event.touches);

		if(self.touches.length === 2){
			// Two-finger gesture: prepare for pinch zoom or pan

			event.preventDefault();

			// Store initial pinch distance
			self.initialPinchDistance = self.getTouchDistance(self.touches[0], self.touches[1]);
			self.initialScale = self.loopy.offsetScale;

			// Store initial centroid for pan
			self.initialTouchCentroid = self.getTouchCentroid(self.touches);

		}

	};

	self.onTouchMove = function(event){

		// Skip in touch mode (TouchGestures handles all touch input)
		if(typeof TouchMode !== 'undefined' && TouchMode.isTouchMode) return;

		self.touches = Array.from(event.touches);

		if(self.touches.length === 2){
			// Two-finger gesture: pinch zoom + pan

			event.preventDefault();

			var touch0 = self.touches[0];
			var touch1 = self.touches[1];

			// ===== PINCH ZOOM =====

			var currentDistance = self.getTouchDistance(touch0, touch1);
			var distanceRatio = currentDistance / self.initialPinchDistance;

			// Calculate new scale
			var newScale = self.initialScale * distanceRatio;
			newScale = Math.max(self.config.MIN_SCALE, Math.min(self.config.MAX_SCALE, newScale));

			// Get current centroid in screen space
			var canvasses = document.getElementById("canvasses");
			var rect = canvasses.getBoundingClientRect();
			var centroid = self.getTouchCentroid(self.touches);
			var centroidX = centroid.x - rect.left;
			var centroidY = centroid.y - rect.top;

			// Zoom around centroid
			var oldScale = self.loopy.offsetScale;
			self.zoomAroundPoint(centroidX, centroidY, oldScale, newScale);

			// ===== PAN =====

			// Calculate centroid movement since last frame
			var dx = centroid.x - self.initialTouchCentroid.x;
			var dy = centroid.y - self.initialTouchCentroid.y;

			self.loopy.offsetX += dx;
			self.loopy.offsetY += dy;

			self.initialTouchCentroid = centroid;

			// Trigger redraw
			publish("mousemove");

		}else if(self.touches.length === self.config.TOUCH_PAN_FINGERS){
			// Multi-finger pan (fallback if not handled above)

			event.preventDefault();

			var centroid = self.getTouchCentroid(self.touches);
			var dx = centroid.x - self.initialTouchCentroid.x;
			var dy = centroid.y - self.initialTouchCentroid.y;

			self.loopy.offsetX += dx;
			self.loopy.offsetY += dy;

			self.initialTouchCentroid = centroid;

			// Trigger redraw
			publish("mousemove");

		}

	};

	self.onTouchEnd = function(event){

		// Skip in touch mode (TouchGestures handles all touch input)
		if(typeof TouchMode !== 'undefined' && TouchMode.isTouchMode) return;

		self.touches = Array.from(event.touches);

		if(self.touches.length < 2){
			// Reset pinch state
			self.initialPinchDistance = 0;
			self.initialScale = self.loopy.offsetScale;
		}

	};

	self.onTouchCancel = function(event){
		self.onTouchEnd(event);
	};

	/////////////////////////
	// HELPER METHODS //////
	/////////////////////////

	/**
	 * Zoom around a specific point in screen space
	 * This keeps the point under the cursor/finger stationary during zoom
	 */
	self.zoomAroundPoint = function(screenX, screenY, oldScale, newScale){

		// Convert screen point to world space (before zoom)
		var canvasses = document.getElementById("canvasses");
		var CW = canvasses.clientWidth - _PADDING - _PADDING;
		var CH = canvasses.clientHeight - _PADDING_BOTTOM - _PADDING;

		// Calculate the world position under the zoom point
		// This is a simplified version - the full transform is in Mouse.js
		var centerX = (CW + _PADDING) / 2;
		var centerY = (CH + _PADDING) / 2;

		var worldX = (screenX - centerX - self.loopy.offsetX) / oldScale + centerX;
		var worldY = (screenY - centerY - self.loopy.offsetY) / oldScale + centerY;

		// Update scale
		self.loopy.offsetScale = newScale;

		// Recalculate offset to keep world point under cursor
		self.loopy.offsetX = screenX - (worldX - centerX) * newScale - centerX;
		self.loopy.offsetY = screenY - (worldY - centerY) * newScale - centerY;

	};

	/**
	 * Calculate distance between two touch points
	 */
	self.getTouchDistance = function(touch0, touch1){
		var dx = touch1.clientX - touch0.clientX;
		var dy = touch1.clientY - touch0.clientY;
		return Math.sqrt(dx * dx + dy * dy);
	};

	/**
	 * Calculate centroid (average position) of all touches
	 */
	self.getTouchCentroid = function(touches){
		var x = 0;
		var y = 0;
		for(var i = 0; i < touches.length; i++){
			x += touches[i].clientX;
			y += touches[i].clientY;
		}
		return {
			x: x / touches.length,
			y: y / touches.length
		};
	};

	/////////////////////////
	// ATTACH LISTENERS ////
	/////////////////////////

	// Desktop: Wheel zoom
	target.addEventListener('wheel', self.onWheel, { passive: false });

	// Desktop: Middle mouse pan
	target.addEventListener('mousedown', self.onMouseDown, false);
	window.addEventListener('mousemove', self.onMouseMove, false);
	window.addEventListener('mouseup', self.onMouseUp, false);

	// Mobile: Touch gestures
	target.addEventListener('touchstart', self.onTouchStart, { passive: false });
	target.addEventListener('touchmove', self.onTouchMove, { passive: false });
	target.addEventListener('touchend', self.onTouchEnd, { passive: false });
	target.addEventListener('touchcancel', self.onTouchCancel, { passive: false });

	console.log('[Camera] Initialized with config:', self.config);

};

/**
 * Public API: Programmatically set zoom level
 */
Camera.setZoom = function(scale, centerX, centerY){
	var self = Camera;
	if(!self.loopy) return;

	var oldScale = self.loopy.offsetScale;
	scale = Math.max(self.config.MIN_SCALE, Math.min(self.config.MAX_SCALE, scale));

	// If no center point provided, zoom around canvas center
	if(centerX === undefined || centerY === undefined){
		var canvasses = document.getElementById("canvasses");
		centerX = canvasses.clientWidth / 2;
		centerY = canvasses.clientHeight / 2;
	}

	self.zoomAroundPoint(centerX, centerY, oldScale, scale);
	publish("mousemove");
};

/**
 * Public API: Reset camera to default
 */
Camera.reset = function(){
	var self = Camera;
	if(!self.loopy) return;

	self.loopy.offsetX = 0;
	self.loopy.offsetY = 0;
	self.loopy.offsetScale = 1;

	publish("mousemove");
};
