/*
@TVN_META
role: standard
desc: Key
last_updated: 2026-02-10
@END_META
*/

(function(exports){

	// Singleton
	var Key = {};
	exports.Key = Key;

	// Keycodes to words mapping
	var KEY_CODES = {
		
		17: "control",
		91: "control", // macs
		13: "enter", // enter

		// TODO: Standardize the NAMING across files?!?!
		78: "ink", // Pe(n)cil
		86: "drag", // Mo(v)e
		69: "erase", // (E)rase
		84: "label", // (T)ext
		83: "save", // (S)ave

	};

	// Event Handling
	// TODO: cursors stay when click button? orrrrr switch over to fake-cursor.
	Key.onKeyDown = function(event){
		if(window.loopy && loopy.modal && loopy.modal.isShowing) return;

		// Skip if Ctrl/Cmd is pressed (allow copy/paste/cut shortcuts)
		var isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
		var isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;
		if(isCtrlOrCmd) return;

		var code = KEY_CODES[event.keyCode];
		if(code){ // Only handle recognized keys
			Key[code] = true;
			publish("key/"+code);
			event.stopPropagation();
			event.preventDefault();
		}
	}
	Key.onKeyUp = function(event){
		if(window.loopy && loopy.modal && loopy.modal.isShowing) return;

		// Skip if Ctrl/Cmd is pressed
		var isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
		var isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;
		if(isCtrlOrCmd) return;

		var code = KEY_CODES[event.keyCode];
		if(code){ // Only handle recognized keys
			Key[code] = false;
			event.stopPropagation();
			event.preventDefault();
		}
	}
	window.addEventListener("keydown",Key.onKeyDown,false);
	window.addEventListener("keyup",Key.onKeyUp,false);

})(window);