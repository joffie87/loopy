/*
@TVN_META
role: standard
desc: Mouse
last_updated: 2026-02-10
@END_META
*/

window.Mouse = {};
Mouse.init = function(target){

	// Helper function to check if a point is within the sidebar
	var _isPointInSidebar = function(clientX, clientY){
		var sidebar = document.getElementById("sidebar");
		var toggle = document.getElementById("sidebar_toggle");

		// Check if sidebar is visible
		if(sidebar && sidebar.getAttribute("data-visible") === "yes"){
			var rect = sidebar.getBoundingClientRect();
			if(clientX >= rect.left && clientX <= rect.right &&
			   clientY >= rect.top && clientY <= rect.bottom){
				return true;
			}
		}

		// Check if click is on toggle button
		if(toggle){
			var toggleRect = toggle.getBoundingClientRect();
			if(clientX >= toggleRect.left && clientX <= toggleRect.right &&
			   clientY >= toggleRect.top && clientY <= toggleRect.bottom){
				return true;
			}
		}

		return false;
	};

	// Events!
	var _onmousedown = function(event){
		// Ignore clicks on sidebar or toggle
		var clientX = event.clientX || (event.touches && event.touches[0] ? event.touches[0].clientX : 0);
		var clientY = event.clientY || (event.touches && event.touches[0] ? event.touches[0].clientY : 0);

		if(_isPointInSidebar(clientX, clientY)){
			return;
		}

		Mouse.moved = false;
		Mouse.pressed = true;
		Mouse.startedOnTarget = true;
		publish("mousedown");
	};
	var _onmousemove = function(event){

		// DO THE INVERSE
		var canvasses = document.getElementById("canvasses");
		var tx = 0;
		var ty = 0;
		var s = 1/loopy.offsetScale;
		var CW = canvasses.clientWidth - _PADDING - _PADDING;
		var CH = canvasses.clientHeight - _PADDING_BOTTOM - _PADDING;

		if(loopy.embedded){
			tx -= _PADDING/2; // dunno why but this is needed
			ty -= _PADDING/2; // dunno why but this is needed
		}
		
		tx -= (CW+_PADDING)/2;
		ty -= (CH+_PADDING)/2;
		
		tx = s*tx;
		ty = s*ty;

		tx += (CW+_PADDING)/2;
		ty += (CH+_PADDING)/2;

		tx -= loopy.offsetX;
		ty -= loopy.offsetY;

		// Mutliply by Mouse vector
		var mx = event.x*s + tx;
		var my = event.y*s + ty;

		// Mouse!
		Mouse.x = mx;
		Mouse.y = my;

		Mouse.moved = true;
		publish("mousemove");

	};
	var _onmouseup = function(){
		Mouse.pressed = false;
		if(Mouse.startedOnTarget){
			publish("mouseup");
			if(!Mouse.moved) publish("mouseclick");
		}
		Mouse.moved = false;
		Mouse.startedOnTarget = false;
	};

	// Add mouse & touch events!
	_addMouseEvents(target, _onmousedown, _onmousemove, _onmouseup);

	// Cursor & Update
	Mouse.target = target;
	Mouse.showCursor = function(cursor){
		Mouse.target.style.cursor = cursor;
	};
	Mouse.update = function(){
		Mouse.showCursor("");
	};

};