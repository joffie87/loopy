/**********************************

SELECTION MANAGER
Handles multi-select and copy/paste functionality

Desktop only:
- Shift+click to toggle selection
- Ctrl/Cmd+C to copy
- Ctrl/Cmd+V to paste

**********************************/

window.SelectionManager = (function(){

	var self = {};

	// Selection state
	self.selectedNodes = new Set(); // Set of node IDs
	self.selectedEdges = new Set(); // Set of edge IDs
	self.primarySelection = {
		type: null, // 'node', 'edge', or null
		id: null
	};

	// Clipboard
	var clipboard = {
		nodes: [],
		edges: []
	};

	// Reference to loopy model (set during init)
	var loopy = null;

	/**
	 * Initialize SelectionManager
	 */
	self.init = function(loopyInstance){
		loopy = loopyInstance;

		// Add keyboard shortcuts for copy/paste (desktop only)
		window.addEventListener('keydown', function(event){
			// Skip if modal is showing or in touch mode
			if(loopy.modal && loopy.modal.isShowing) return;
			if(typeof TouchMode !== 'undefined' && TouchMode.isTouchMode) return;

			var isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
			var isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

			// Debug logging
			if(isCtrlOrCmd){
				console.log('SelectionManager: Key pressed with Ctrl/Cmd:', event.keyCode, 'Key:', event.key);
			}

			// Ctrl/Cmd + C = Copy
			if(isCtrlOrCmd && event.keyCode === 67){ // C
				console.log('SelectionManager: Copy triggered');
				event.preventDefault();
				event.stopPropagation();
				self.copy();
			}

			// Ctrl/Cmd + X = Cut
			if(isCtrlOrCmd && event.keyCode === 88){ // X
				console.log('SelectionManager: Cut triggered');
				event.preventDefault();
				event.stopPropagation();
				self.cut();
			}

			// Ctrl/Cmd + V = Paste
			if(isCtrlOrCmd && event.keyCode === 86){ // V
				console.log('SelectionManager: Paste triggered');
				event.preventDefault();
				event.stopPropagation();
				self.paste();
			}
		}, false);

		console.log('SelectionManager: Initialized with keyboard shortcuts');
	};

	/**
	 * Select a single object (clears previous selection)
	 */
	self.selectSingle = function(obj){
		if(!obj) return;

		console.log('SelectionManager: selectSingle called for', obj._CLASS_, obj.id || obj);

		self.clearSelection();

		if(obj._CLASS_ === 'Node'){
			self.selectedNodes.add(obj.id);
			self.primarySelection = { type: 'node', id: obj.id };
			console.log('SelectionManager: Selected node', obj.id, '- total selected:', self.selectedNodes.size);
		} else if(obj._CLASS_ === 'Edge'){
			self.selectedEdges.add(obj.id);
			self.primarySelection = { type: 'edge', id: obj.id };
			console.log('SelectionManager: Selected edge', obj.id, '- total selected:', self.selectedEdges.size);
		} else if(obj._CLASS_ === 'Label'){
			// Labels don't participate in multi-select yet
			self.primarySelection = { type: 'label', id: obj };
			console.log('SelectionManager: Selected label');
		}

		publish('selection/changed');
	};

	/**
	 * Toggle object in selection (for Shift+click)
	 */
	self.toggleSelection = function(obj){
		if(!obj) return;

		console.log('SelectionManager: toggleSelection called for', obj._CLASS_, obj.id);

		if(obj._CLASS_ === 'Node'){
			if(self.selectedNodes.has(obj.id)){
				// Remove from selection
				self.selectedNodes.delete(obj.id);
				console.log('SelectionManager: Removed node', obj.id, 'from selection - total:', self.selectedNodes.size);

				// Update primary selection if needed
				if(self.primarySelection.type === 'node' && self.primarySelection.id === obj.id){
					self._choosePrimaryFromSet();
				}
			} else {
				// Add to selection
				self.selectedNodes.add(obj.id);
				self.primarySelection = { type: 'node', id: obj.id };
				console.log('SelectionManager: Added node', obj.id, 'to selection - total:', self.selectedNodes.size);
			}
		} else if(obj._CLASS_ === 'Edge'){
			if(self.selectedEdges.has(obj.id)){
				// Remove from selection
				self.selectedEdges.delete(obj.id);
				console.log('SelectionManager: Removed edge', obj.id, 'from selection - total:', self.selectedEdges.size);

				// Update primary selection if needed
				if(self.primarySelection.type === 'edge' && self.primarySelection.id === obj.id){
					self._choosePrimaryFromSet();
				}
			} else {
				// Add to selection
				self.selectedEdges.add(obj.id);
				self.primarySelection = { type: 'edge', id: obj.id };
				console.log('SelectionManager: Added edge', obj.id, 'to selection - total:', self.selectedEdges.size);
			}
		}

		publish('selection/changed');
	};

	/**
	 * Clear all selections
	 */
	self.clearSelection = function(){
		self.selectedNodes.clear();
		self.selectedEdges.clear();
		self.primarySelection = { type: null, id: null };
		publish('selection/changed');
	};

	/**
	 * Choose a new primary selection from the current sets
	 */
	self._choosePrimaryFromSet = function(){
		// Try nodes first
		if(self.selectedNodes.size > 0){
			var firstNodeId = self.selectedNodes.values().next().value;
			self.primarySelection = { type: 'node', id: firstNodeId };
		}
		// Then edges
		else if(self.selectedEdges.size > 0){
			var firstEdgeId = self.selectedEdges.values().next().value;
			self.primarySelection = { type: 'edge', id: firstEdgeId };
		}
		// Nothing selected
		else {
			self.primarySelection = { type: null, id: null };
		}
	};

	/**
	 * Get the primary selection object
	 */
	self.getPrimaryObject = function(){
		if(!loopy) return null;

		if(self.primarySelection.type === 'node'){
			return loopy.model.getNode(self.primarySelection.id);
		} else if(self.primarySelection.type === 'edge'){
			return loopy.model.getEdge(self.primarySelection.id);
		} else if(self.primarySelection.type === 'label'){
			return self.primarySelection.id; // Label object itself
		}
		return null;
	};

	/**
	 * Get total selection count
	 */
	self.getSelectionCount = function(){
		return self.selectedNodes.size + self.selectedEdges.size;
	};

	/**
	 * Copy selected nodes and edges to clipboard
	 */
	self.copy = function(){
		if(!loopy) {
			console.log('SelectionManager: Copy - no loopy instance');
			return;
		}
		if(self.selectedNodes.size === 0) {
			console.log('SelectionManager: Copy - no nodes selected (selectedNodes.size:', self.selectedNodes.size, ')');
			return; // Nothing to copy
		}

		console.log('SelectionManager: Copying', self.selectedNodes.size, 'nodes');

		// Gather all selected nodes
		var nodesToCopy = [];
		self.selectedNodes.forEach(function(nodeId){
			var node = loopy.model.getNode(nodeId);
			if(node){
				// Copy node data (exclude methods, keep data only)
				nodesToCopy.push({
					x: node.x,
					y: node.y,
					label: node.label,
					init: node.init,
					hue: node.hue,
					// Don't copy: id (will generate new), isSubtitle (manual only)
					originalId: node.id // temporary for edge mapping
				});
			}
		});

		// Gather all edges whose endpoints are both in selection
		var edgesToCopy = [];
		loopy.model.edges.forEach(function(edge){
			var fromSelected = self.selectedNodes.has(edge.from.id);
			var toSelected = self.selectedNodes.has(edge.to.id);

			if(fromSelected && toSelected){
				edgesToCopy.push({
					fromOriginalId: edge.from.id,
					toOriginalId: edge.to.id,
					arc: edge.arc,
					rotation: edge.rotation,
					strength: edge.strength
				});
			}
		});

		// Store in clipboard
		clipboard = {
			nodes: nodesToCopy,
			edges: edgesToCopy
		};

		console.log('SelectionManager: Copied', nodesToCopy.length, 'nodes and', edgesToCopy.length, 'edges');
	};

	/**
	 * Cut selected nodes and edges to clipboard (copy + delete)
	 */
	self.cut = function(){
		if(!loopy) return;
		if(self.selectedNodes.size === 0) return; // Nothing to cut

		console.log('SelectionManager: Cutting', self.selectedNodes.size, 'nodes');

		// First, copy to clipboard
		self.copy();

		// Collect nodes and edges to delete
		var nodesToDelete = [];
		self.selectedNodes.forEach(function(nodeId){
			var node = loopy.model.getNode(nodeId);
			if(node) nodesToDelete.push(node);
		});

		var edgesToDelete = [];
		self.selectedEdges.forEach(function(edgeId){
			var edge = loopy.model.getEdge(edgeId);
			if(edge) edgesToDelete.push(edge);
		});

		// Clear selection before deleting
		self.clearSelection();

		// Delete nodes (this will also kill connected edges)
		nodesToDelete.forEach(function(node){
			node.kill();
		});

		// Delete edges that weren't already killed
		edgesToDelete.forEach(function(edge){
			if(loopy.model.edges.indexOf(edge) >= 0){ // Still exists
				edge.kill();
			}
		});

		// Go back to main edit page
		loopy.sidebar.showPage("Edit");

		// Trigger updates
		publish('model/changed');
		publish('mousemove');

		console.log('SelectionManager: Cut complete - deleted', nodesToDelete.length, 'nodes and', edgesToDelete.length, 'edges');
	};

	/**
	 * Paste clipboard contents with offset
	 */
	self.paste = function(){
		if(!loopy) return;
		if(clipboard.nodes.length === 0) return; // Nothing to paste

		console.log('SelectionManager: Pasting', clipboard.nodes.length, 'nodes');

		var PASTE_OFFSET_X = 40;
		var PASTE_OFFSET_Y = 40;

		// Clear current selection
		self.clearSelection();

		// Map old IDs to new IDs
		var idMap = {};

		// Create new nodes
		clipboard.nodes.forEach(function(nodeData){
			var newNode = loopy.model.addNode({
				x: nodeData.x + PASTE_OFFSET_X,
				y: nodeData.y + PASTE_OFFSET_Y,
				label: nodeData.label,
				init: nodeData.init,
				hue: nodeData.hue
			});

			// Map old ID to new ID
			idMap[nodeData.originalId] = newNode.id;

			// Add to selection
			self.selectedNodes.add(newNode.id);
		});

		// Create new edges (with remapped IDs)
		clipboard.edges.forEach(function(edgeData){
			var newFromId = idMap[edgeData.fromOriginalId];
			var newToId = idMap[edgeData.toOriginalId];

			if(newFromId && newToId){
				var newEdge = loopy.model.addEdge({
					from: newFromId,
					to: newToId,
					arc: edgeData.arc,
					rotation: edgeData.rotation,
					strength: edgeData.strength
				});

				// Add to selection
				self.selectedEdges.add(newEdge.id);
			}
		});

		// Set primary selection to first new node
		if(self.selectedNodes.size > 0){
			var firstNodeId = self.selectedNodes.values().next().value;
			self.primarySelection = { type: 'node', id: firstNodeId };

			// Edit the primary selection in sidebar
			var primaryNode = loopy.model.getNode(firstNodeId);
			if(primaryNode){
				loopy.sidebar.edit(primaryNode);
			}
		}

		// Trigger updates
		publish('selection/changed');
		publish('model/changed');
		publish('mousemove');

		console.log('SelectionManager: Pasted and selected', self.selectedNodes.size, 'nodes and', self.selectedEdges.size, 'edges');
	};

	/**
	 * Check if an object is selected
	 */
	self.isSelected = function(obj){
		if(!obj) return false;

		if(obj._CLASS_ === 'Node'){
			return self.selectedNodes.has(obj.id);
		} else if(obj._CLASS_ === 'Edge'){
			return self.selectedEdges.has(obj.id);
		}
		return false;
	};

	return self;

})();
