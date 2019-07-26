const DEBUG_THIS = true;
const DEBUG_ALEXA_REMOTE2 = true;

const util = require('util');

function log(what, depth=10, width=80) {
	console.log(util.inspect(what, {
		depth: depth,
		colors: true,
		breakLength: width
	}));
}

function error(message, value) {
	const error = new Error(message);
	error.value = value;
	return error;
}

function nthIndexOf(string, search, n=0, i=0) {
	let count = 0;
	while(true) {
		i = string.indexOf(search, i);
		if(i === -1) return -1;
		if(count === n) return i;
		i++;
		count++;
    }
}

function keyToLabel(str) {
	const match = str.match(/(?:[A-Z]?[a-z]+)|[A-Z]|[0-9]+/g);
	if (match) str = match.map(s => s.slice(0, 1).toUpperCase() + s.slice(1)).join(' ');
	return str;
}

function alnumEqual(a,b) {
	[a,b] = [a,b].map(s => s.replace(/[^a-z0-9]/ig, '').toLowerCase());
	return a === b;
}

function isObject(x) {
	return typeof x == 'object' && x !== null && !Array.isArray(x);
}

function mapObject(obj, fun, depth = Infinity) {
	if(typeof obj !== 'object' || obj === null || depth === 0) return obj;

	for(key of Object.keys(obj)) {
		val = obj[key];
		mapObject(val, fun, depth - 1);
		res = fun(key, val);
		obj[key] = res;
		// if(val !== res) console.log(`[${key}] ${val} => ${res}`);
	}

	return obj;
}

// clones template object and applies source object properties if they are of the same type
function template(source, templ, depth = Infinity) {
	if(templ === undefined) {
		return source;
	}

	// are they different types?
	if (typeof templ !== typeof source || Array.isArray(templ) !== Array.isArray(source) || isObject(templ) !== isObject(source)) {
		return templ;
	}

	if (depth !== 0) {
		if (Array.isArray(templ)) {
			if (templ.length === 0) {
				return source;
			}

			const result = [];
			for (let i = 0; i < source.length; i++) {
				result[i] = template(source[i], templ[0], depth - 1);
			}
			return result;
		}

		if (isObject(templ)) {
			const result = {};
			for (const k of Object.keys(templ)) {
				result[k] = template(source[k], templ[k], depth - 1);
			}
			return result;
		}
	}

	return source;
}

function matches(source, templ, depth = Infinity) {
	//log({comparing: {source: source, templ:templ}});

	if(templ === undefined) {
		return true;
	}

	// are they different types?
	if(typeof templ !== typeof source || Array.isArray(templ) !== Array.isArray(source) || isObject(templ) !== isObject(source)) {
		//log({source: source, templ:templ, ts: typeof source, tt: typeof templ});
		return false;
	}

	if(depth !== 0) {
		if(Array.isArray(templ)) {
			if(templ.length === 0) {
				return true;
			}
			for (let i = 0; i < source.length; i++) {
				if(!matches(source[i], templ[0], depth - 1)) {
					log({source: source, templ:templ, i: i});
					return false;
				}
			}
			return true;
		}
	
		if(isObject(templ)) {
			for (const k of Object.keys(templ)) {
				if(!matches(source[k], templ[k], depth - 1)) {
					log({source: source, templ:templ, k: k});
					return false;
				}
			}
			return true;
		}
	}

	return true;
}

function typeEqual(a, b, depth = Infinity) {
	// are they different types?
	if(typeof a !== typeof b) {
		return false;
	}

	if(typeof a === 'object') {
		if(a === null) return b === null;	
		const nameSetA = new Set(Object.getOwnPropertyNames(a));
		const nameSetB = new Set(Object.getOwnPropertyNames(b));
		if(nameSetA.length !== nameSetB.length) return false;
		for(const nameA of nameSetA) if(!nameSetB.has(nameA)) return false;
		for(const nameA of nameSetA) {
			const propA = a[nameA];
			const propB = b[nameA];
			if(!typeEqual(propA, propB, depth - 1)) return false;
		}
	}

	return true;
}

function evaluateNodeProperty(RED, node, msg, value, type) {
	if(type === 'json' && !value) return undefined;
	const result = RED.util.evaluateNodeProperty(value, type, node, msg);
	return type === 'num' ? Number(result) : result;
}

function nodeEvaluateProperties(RED, node, msg, obj, depth = Infinity) {
	if(typeof obj !== 'object' || obj === null || depth === 0) {
		return obj;
	}

	if(Array.isArray(obj)) {
		return obj.map(val => nodeEvaluateProperties(RED, node, msg, val, depth - 1));
	}

	if(!typeEqual(obj, { type: '', value: '' })) {
		const clone = {};
		for(const key of Object.keys(obj)) {
			clone[key] = nodeEvaluateProperties(RED, node, msg, obj[key], depth - 1)
		}
		return clone;
	} 
			
	return evaluateNodeProperty(RED, node, msg, obj.value, obj.type);
}

// only for simple types like json parse result
function clone(source, depth = Infinity) {
	if(typeof source !== 'object' || source === null || depth === 0) {
		return source;
	}

	if (Array.isArray(source)) {
		if(depth === 0) return source.slice();

		const result = new Array(source.length);
		for (let i = 0; i < source.length; i++) {
			result[i] = clone(source[i], depth - 1);
		}
		return result;
	}
	else /* is object */ {			
		const result = {};
		for (const k of Object.keys(source)) {
			result[k] = clone(source[k], depth - 1);
		}
		return result;
	}
}

function ellipse(str, len) {
	str = String(str);
	return str.length > len ? str.substring(0, len - 3) + "..." : str.substring(0, len);
}

function flatten(arr) {
	return arr.reduce(function (flat, toFlatten) {
		return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
	}, []);
}

function tryParseJson(json) {
	let obj = undefined;
		
	try {
		obj = JSON.parse(json);
		if (!obj || typeof obj !== "object") throw "not json";
	}
	catch (ex) {
		//console.log(ex);
	}
	return obj;
}

// assign properties of source objects to a destination object
// example: 
// let source_a = { foo: 1, bar: 2, unrelated_a: 'hihi' };
// let source_b = { bar: 'ignored', baz: 3, unrelated_b: 'hihi'};
// let dest = {};
// assign(dest, ['foo', 'bar', 'baz'], source_a, source_b)
// -> { foo: 1, bar: 2, baz: 3 }
function assignBase(callback, dest, keys) {
	if (Array.isArray(keys)) {
		const sources = [...arguments].slice(3);
		for (const key of keys) {
			for (const source of sources) {
				callback(dest, source, key);
			}
		}
	}
	else {
		// keys are omitted -> all keys are copied
		const sources = [...arguments].slice(2);
		for(const source of sources) {
			for(const key of Object.keys(source)) {
				callback(dest, source, key);
			}
		}
	}
	return dest;
}

function assign(dest, keys) {
	return assignBase((dst, src, key) => dst[key] = src[key], ...arguments);
}

function assignNode(RED, dest, keys) {
	return assignBase((dst, src, key) => dst[key] = RED.nodes.getNode(src[key]), ...[...arguments].slice(1));
}

function assignTyped(dest, keys) {
	return assignBase((dst, src, key) => {
		let val_key = `${key}_value`;
		let typ_key = `${key}_type`;

		let val = src[val_key];
		let typ = src[typ_key];

		dst[val_key] = val;
		dst[typ_key] = typ;
	}, 
	...arguments);
}

function assignEvalTyped(RED, node, msg, dest, keys) { 
	return assignBase((dst, src, key) => { 
		let val = src[`${key}_value`];
		let typ = src[`${key}_type`];

		dst[key] = RED.util.evaluateNodeProperty(val, typ, node, msg);
	}, 
	...[...arguments].slice(3));
}

function assignEvalTypedStruct(RED, node, msg, dest, keys) {
	return assignBase((dst, src, key) => {
		const inp = src[key];
		dst[key] = RED.util.evaluateNodeProperty(inp && inp.value, inp && inp.type, node, msg)
	},
	...[...arguments].slice(3));
}

function nodeSendMultiple(node, msgs, outputs = 1) {
	const count = msgs.length;
	const successCount = msgs.filter(m => m).length;

	// if there are too many msgs put them in the last output payload
	if(msgs.length > outputs) {
		const result = msgs.slice(0, outputs);
		const last = msgs.slice(outputs-1).filter(x => x);
		result[outputs-1] = { payload: last };
		msgs = result;
	}

	node.status({
		shape: 'dot',
		fill: successCount === count ? 'green' : successCount !== 0 ? 'yellow' : 'red',
		text: `${successCount}/${count} successful`
	});
	
	node.send(msgs);
}

function nodeErrVal(node, msg, err, val, text = '') {
	// filter out "no body" because it is a false positive
	if(!err || err.message === 'no body') {
		msg.payload = val;
		node.status({ shape: 'dot', fill: 'green', text: text || 'success' });
		node.send(msg);
	}
	else {
		// our own way to send warnings over err,val
		if(err.warning) {
			node.status({ shape: 'dot', fill: 'yellow', text: text || ellipse(err.message, 32) });
			node.warn(err);
		}
		else {
			msg.payload = val;
			node.status({ shape: 'dot', fill: 'red', text: text || ellipse(err.message, 32) });
			node.error(err, msg);
		}
	}
}

function nodeSend(node, msg, value, statusText = 'success') {
	if(typeof node.status !== 'function') return log(['send', 'wierdo', node], 2);
	msg.payload = value;
	node.status({ shape: 'dot', fill: 'green', text: ellipse(statusText, 32)});
	node.send(msg);
}

function nodeWarn(node, error) {
	if(typeof node.status !== 'function') return log(['warn', 'wierdo', node], 2);
	const message = error instanceof Error ? error.message : String(error);
	node.status({shape: 'dot', fill: 'yellow', text: ellipse(message, 32)});
	node.warn(message);
}

function nodeError(node, error, value, statusText) {
	if(typeof node.status !== 'function') return log(['error', 'wierdo', node], 2);
	if(typeof error !== 'object') error = new Error(String(error));
	node.status({ shape: 'dot', fill: 'red', text: ellipse(statusText || error.message || 'oh no', 32)});
	node.error(error.message || 'oh no', {error: error, value: error.value || value});
	return error;
}

function nodeGetSendCb(node, msg, statusText) {
	return (value) => nodeSend(node, msg, value, statusText);
}

function nodeGetWarnCb(node) {
	return (error) => nodeWarn(node, error);
}

function nodeGetErrorCb(node, statusText) {
	return (error, value) => nodeError(node, error, value, statusText);
}

function nodeSetup(node, input, statusReport = false) {
	if(!node.account) {
		node.status({shape: 'dot', fill: 'red', text: 'Account missing!'});
		return false;
	}

	if(statusReport) {
		node.blinkState = false;

		node._stopBlinking = function() {
			if(this.blinkInterval) {
				clearInterval(this.blinkInterval);
				this.blinkInterval = null;
			}
			this.status({}); 
		}
		node._startBlinking = function(a, b) {
			this.blinkInterval = setInterval(() => {
				this.blinkState = !this.blinkState;
				this.status(this.blinkState ? a : b);
			}, 300);
		}
	
		node._onStatus = (code, message) => {
			node._stopBlinking(); 
			const text = typeof message === 'string' ? (message.includes(' in your browser') ? message : ellipse(message, 32)) : '';
			//console.log(`status: ${code} (${message}) [${node.id}]`);

			switch(code) {
				case 'INIT_PROXY': 		node.status({shape: 'ring', fill: 'grey', text: 'init with proxy' }); break;
				case 'INIT_COOKIE': 	node.status({shape: 'ring', fill: 'grey', text: 'init with cookie' }); break;
				case 'INIT_PASSWORD': 	node.status({shape: 'ring', fill: 'grey', text: 'init with password' }); break;
				case 'REFRESH': 		node.status({shape: 'ring', fill: 'blue', text: 'refreshing' }); break;
				case 'WAIT_PROXY': 		node._startBlinking({ shape: 'ring', fill: 'blue', text: text }, { shape: 'ring', fill: 'grey', text: text }); break;
				case 'READY': 			node.status({shape: 'ring', fill: 'green', text: 'ready'}); break;
				case 'ERROR':			node.status({shape: 'ring', fill: 'red', text: text}); break;
				case 'UNINITIALISED':	node.status({shape: 'ring', fill: 'grey', text: 'uninitialized' }); break;
				default: 				node.status({shape: 'ring', fill: 'yellow', text: 'unknown status' }); break;
			}
		}
	
		node.account.emitter.removeListener('state', node._onStatus);
		node.account.emitter.addListener('state', node._onStatus);
	
		// initial status update
		const {code, message} = node.account.state;
		node._onStatus(code, message);
	
		node.on('close', function () { 
			node.account.emitter.removeListener('state', node._onStatus);
			this._stopBlinking();
		});
	}

	return true;
}

function stringifyOmitCircular(arg) {
	const cache = new Set();
	return JSON.stringify(arg, (key, value) => {
		if(typeof value === 'object' && value !== null) {
			if(cache.has(value)) return;
			cache.add(value);
		}
		return value;
	});
}

module.exports = {
	DEBUG_THIS: DEBUG_THIS,
	DEBUG_ALEXA_REMOTE2: DEBUG_ALEXA_REMOTE2,
	log: log,
	alnumEqual: alnumEqual,
	nthIndexOf: nthIndexOf,
	keyToLabel: keyToLabel,
	error: error,
	isObject: isObject,
	clone: clone,
	matches: matches,
	typeEqual: typeEqual,
	template: template,
	ellipse: ellipse,
	flatten: flatten,
	tryParseJson: tryParseJson,
	stringifyOmitCircular: stringifyOmitCircular,
	mapObject: mapObject,

	assignBase: assignBase,
	assign: assign,
	assignNode:	assignNode,
	assignTyped: assignTyped,
	assignEvalTyped: assignEvalTyped,
	assignEvalTypedStruct: assignEvalTypedStruct,

	nodeSend: nodeSend,
	nodeWarn: nodeWarn,
	nodeError: nodeError,
	nodeGetWarnCb: nodeGetWarnCb,
	nodeGetErrorCb: nodeGetErrorCb,
	nodeGetSendCb: nodeGetSendCb,
	nodeSendMultiple: nodeSendMultiple,
	nodeSetup: nodeSetup,
	nodeErrVal: nodeErrVal,
	nodeEvaluateProperties: nodeEvaluateProperties,
};