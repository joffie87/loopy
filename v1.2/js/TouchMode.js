/**********************************

TOUCH MODE DETECTION & STATE MANAGEMENT

Non-negotiable: Desktop mode must remain unchanged.
Touch mode is additive and only activates when touch input is detected.

**********************************/

window.TouchMode = (function(){

	var self = {};

	// State flags
	self.isTouchMode = false;
	self.hasDetectedTouch = false;

	// Touch interaction states (mutually exclusive)
	self.STATE = {
		IDLE: 'idle',
		SELECTION_ACTIVE: 'selection_active',
		MOVING_NODE: 'moving_node',
		CREATING_LINK: 'creating_link',
		PANNING_CANVAS: 'panning_canvas',
		ZOOMING_CANVAS: 'zooming_canvas'
	};

	self.currentState = self.STATE.IDLE;

	// User preference override (stored in localStorage)
	var PREF_KEY = 'loopy_force_mode';
	var forceMode = null; // null, 'touch', or 'desktop'

	/**
	 * Initialize touch mode detection
	 */
	self.init = function(){
		// Check for user preference override
		try {
			var saved = localStorage.getItem(PREF_KEY);
			if(saved === 'touch' || saved === 'desktop'){
				forceMode = saved;
			}
		} catch(e) {
			console.warn('TouchMode: Could not access localStorage', e);
		}

		// Detect initial mode
		self.updateMode();

		// Listen for first touch interaction
		document.addEventListener('touchstart', function(){
			if(!self.hasDetectedTouch){
				self.hasDetectedTouch = true;
				self.updateMode();
				console.log('TouchMode: Touch input detected, switching to touch mode');
			}
		}, {once: false, passive: true});

		// Listen for window resize (viewport changes)
		window.addEventListener('resize', function(){
			self.updateMode();
		});

		console.log('TouchMode: Initialized. Mode:', self.isTouchMode ? 'TOUCH' : 'DESKTOP');
	};

	/**
	 * Update the current mode based on detection criteria
	 */
	self.updateMode = function(){
		var wasTouchMode = self.isTouchMode;

		// Check user preference override first
		if(forceMode === 'touch'){
			self.isTouchMode = true;
		} else if(forceMode === 'desktop'){
			self.isTouchMode = false;
		} else {
			// Auto-detect based on:
			// 1. Has user touched the screen?
			// 2. Is this a touch-capable device?
			// 3. Is viewport narrow (phone/tablet)?
			var hasTouchCapability = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
			var isNarrowViewport = window.innerWidth < 1024; // tablet/phone breakpoint

			self.isTouchMode = hasTouchCapability && (self.hasDetectedTouch || isNarrowViewport);
		}

		// Update body class for CSS styling
		if(self.isTouchMode){
			document.body.classList.add('touch-mode');
		} else {
			document.body.classList.remove('touch-mode');
		}

		// Notify if mode changed
		if(wasTouchMode !== self.isTouchMode){
			publish('touchmode/changed', self.isTouchMode);
			console.log('TouchMode: Mode changed to', self.isTouchMode ? 'TOUCH' : 'DESKTOP');
		}
	};

	/**
	 * Set user preference to force a specific mode
	 */
	self.setForceMode = function(mode){
		if(mode !== 'touch' && mode !== 'desktop' && mode !== null){
			console.error('TouchMode: Invalid force mode', mode);
			return;
		}

		forceMode = mode;
		try {
			if(mode === null){
				localStorage.removeItem(PREF_KEY);
			} else {
				localStorage.setItem(PREF_KEY, mode);
			}
		} catch(e) {
			console.warn('TouchMode: Could not save preference', e);
		}

		self.updateMode();
	};

	/**
	 * Change current interaction state
	 * Enforces mutual exclusivity
	 */
	self.setState = function(newState){
		if(!Object.values(self.STATE).includes(newState)){
			console.error('TouchMode: Invalid state', newState);
			return;
		}

		if(self.currentState !== newState){
			console.log('TouchMode: State change:', self.currentState, '→', newState);
			self.currentState = newState;
			publish('touchmode/statechange', newState);
		}
	};

	/**
	 * Reset to idle state
	 */
	self.resetState = function(){
		self.setState(self.STATE.IDLE);
	};

	/**
	 * Check if we're in a specific state
	 */
	self.isState = function(state){
		return self.currentState === state;
	};

	/**
	 * Check if any interaction is in progress
	 */
	self.isBusy = function(){
		return self.currentState !== self.STATE.IDLE;
	};

	return self;

})();
