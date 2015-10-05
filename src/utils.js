var jsc = require("./jsc");
var klass = require("./class");

jsc.Utils = {

	extendObject: function(dstObj, srcObj) {
		var propNames = Object.getOwnPropertyNames(srcObj);

		propNames.forEach(function(name) {
			Object.defineProperty(dstObj, name, Object.getOwnPropertyDescriptor(srcObj, name));
		});

		return dstObj;
	},
	
	cloneObject: function(srcObj) {
		return jsc.Utils.extendObject({}, srcObj);
	},

	createEnum: function(startValue, keys, destObj) {
		var obj = destObj || {};

		keys.forEach(function(k, i) {
			var value = startValue + i;
			
			Object.defineProperty(obj, k, {
				value: value,
				enumerable: true,
				configurable: false,
				writable: false
			})
		})
		
		return (obj === destObj ? obj : Object.freeze(obj));
	},
	
	createEnumFlags: function(keys, destObj, useZeroFlag) {
		var obj = destObj || {};
		
		useZeroFlag = jsc.Utils.valueOrDefault(useZeroFlag, true);

		keys.forEach(function(k, i) {
			var value = (useZeroFlag ? (i === 0 ? 0 : (1 << (i-1))) : 1 << i);
			
			Object.defineProperty(obj, k, {
				value: value,
				enumerable: true,
				configurable: false,
				writable: false
			})
		})
		
		return (obj === destObj ? obj : Object.freeze(obj));
	},
	
	format: function(str) {
		var utils = jsc.Utils;
		var i = 1;
		var args = arguments;
		var argsLen = args.length;
		
		var formatValue = function(value) {
			if(utils.isDate(value)) {
				return Date.prototype.toString.call(value);
			}
			else if(utils.isError(value)) {
				return Error.prototype.toString.call(value);
			}
			else if(utils.isFunction(value)) {
				return "[Function" + (value.name ? ": " + value.name : "") + "]";
			}
			else {
				return "" + value;
			}
		};
		
		
		if(!utils.isString(str)) {
			var objs = [];
			
			for(i = 0; i < argsLen; ++i) {
				objs.push(formatValue(args[i]));
			}
			
			return objs.join(" ");
		}

		str = String(str).replace(/%[sdijxX%]/g, function(m) {
			if(m === "%%") {
				return "%";
			}
			
			if(i >= argsLen) {
				return m;
			}

			switch(m) {
				case "%s":
					return String(args[i++]);
				case "%d":
					return Number(args[i++]);
				case "%i":
					return Math.floor(Number(args[i++]));
				case "%x":
					return "0x" + Number(args[i++]).toString(16);
				case "%X":
					return "0x" + Number(args[i++]).toString(16).toUpperCase();
				case "%j":
					try {
						return JSON.stringify(args[i++]);
					}
					catch(e) {
						void(e);
						return "[...]";
					}
				default:
					return m;
			}
		});

		var hasStyle = false;

		str = String(str).replace(/%[c]/g, function(m) {
			if(i >= argsLen) {
				return m;
			}

			switch(m) {
				case "%c":
				{
					var style = args[i++];
					var styleParams = [0];

					hasStyle = true;

					if(jsc.Utils.isNotNull(style) && jsc.Utils.isArray(style.params))
					{
						styleParams = style.params.filter(function(value) {
							return jsc.Utils.isInteger(value);
						});
					}

					return "\u001b[" + styleParams.join(';') + "m";
				}
				default:
					return m;
			}
		});
		
		for(var a = args[i]; i < argsLen; a = args[++i]) {
			str += " " + formatValue(a);
		}

		return str + (hasStyle ? "\u001b[0m" : "");
	},
	
	valueOrDefault: function(value, defaultValue) {
		return (jsc.Utils.isNullOrUndefined(value) ? defaultValue : value);
	},
	
	argumentOrDefault: function(args, index, defaultValue) {
		if(args && args.length > index)
			return jsc.Utils.valueOrDefault(args[index], defaultValue);
			
		return defaultValue;
	},
	
	toString: function(value) {
		return Object.prototype.toString.call(value);
	},

	toInt: function(value) {
		return (value>>0);
	},
	
	isUndefined: function(value) {
		return (value === void(0));
	},

	isNotUndefined: function(value) {
		return !jsc.Utils.isUndefined(value);
	},
	
	isNull: function(value, includeUndefined) {
		includeUndefined = jsc.Utils.valueOrDefault(includeUndefined, true);
		
		return (includeUndefined ? jsc.Utils.isNullOrUndefined(value) : value === null);
	},

	isNotNull: function(value, includeUndefined) {
		return !jsc.Utils.isNull(value, includeUndefined);
	},
	
	isNullOrUndefined: function(value) {
		return (value === null || jsc.Utils.isUndefined(value));
	},

	isNotNullOrUndefined: function(value) {
		return !jsc.Utils.isNullOrUndefined(value);
	},
	
	isStringNullOrEmpty: function(value) {
		return (jsc.Utils.isNullOrUndefined(value) || (jsc.Utils.isString(value) && value.length === 0));
	},

	isStringNotNullOrEmpty: function(value) {
		return !jsc.Utils.isStringNullOrEmpty(value);
	},

	isArray: function(value) {
		return Array.isArray(value);
	},
	
	isBoolean: function(value) {
		return (typeof value === "boolean");
	},
	
	isDate: function(value) {
		return (jsc.Utils.isObject(value) && jsc.Utils.toString(value) === "[object Date]");
	},
	
	isError: function(value) {
		return (jsc.Utils.isObject(value) && (jsc.Utils.toString(value) === "[object Error]" || value instanceof Error));
	},
	
	isFunction: function(value) {
		return (typeof value === "function");
	},
	
	isNumber: function(value) {
		return (typeof value === "number");
	},
	
	isInteger: function(value) {
		if(Number.isInteger)
			return Number.isInteger(value);
			
		return (jsc.Utils.isNumber(value) && isFinite(value) && value > -9007199254740992 && value < 9007199254740992 && Math.floor(value) === value);
	},
	
	isObject: function(value) {
		return (typeof value === "object" && !jsc.Utils.isNull(value));
	},
	
	isString: function(value) {
		return (typeof value === "string");
	}
};

jsc.Utils.HashMap = klass.Create({
	initialize: function() {
		this.entries = {};
		this.count = 0;
	},
	
	get length() {
		return this.count;
	},
	
	get keys() {
		return Object.keys(this.entries).map(function(key) {
			return this.entries[key][0];
		}, this);
	},
	
	get values() {		
		return Object.keys(this.entries).map(function(key) {
			return this.entries[key][1];
		}, this);
	},
	
	get: function(key) {
		var p = this.entries[this.hash(key)];
		
		return p && p[1];
	},

	set: function(key, value) {
		var keyHash = this.hash(key);
		var isNew = !(keyHash in this.entries);

		this.entries[keyHash] = [key, jsc.Utils.isNull(value) ? null : value];
		
		if(!isNew)
			return false;

		this.count++;

		return true;
	},
	
	remove: function(key) {
		if(!this.exists(key))
			return false;

		delete this.entries[this.hash(key)];
		this.count--;

		return true;
	},
	
	clear: function() {
		this.count = 0;
		this.entries = {};
	},
	
	exists: function(key) {
		return (this.hash(key) in this.entries);
	},
	
	hash: function(key) {
		if(jsc.Utils.isString(key))
			return "\u25CF" + key;
			
		return key + "";
	},

	copyTo: function(other) {
		var keys = this.keys;

		keys.forEach(function(k) {
			other.set(k, this.get(k));
		}, this);
	}
});

jsc.Utils.Format = {
	Reset: 0,

	Bold: 1,
	Underline: 4,

	Color: {
		Black: 0,
		Red: 1,
		Green: 2,
		Yellow: 3,
		Blue: 4,
		Magenta: 5,
		Cyan: 6,
		White: 7,
		Default: 9,

		Normal: {
			Foreground: 30,
			Background: 40
		},

		Light: {
			Foreground: 90,
			Background: 100
		}
	}
};

jsc.Utils.FormatStyle = {
	append: function(param) {
		var obj = Object.create(jsc.Utils.FormatStyle, {
			params: { writable: true, enumerable: true, value: (this.params ? this.params.slice() : []) }
		});

		obj.params.push(param);

		return obj;
	},

	setColor: function(color, asBackground, asLightColor) {
		asBackground = jsc.Utils.valueOrDefault(asBackground, false);
		asLightColor = jsc.Utils.valueOrDefault(asLightColor, false);

		if(asBackground)
			return this.append((asLightColor ? jsc.Utils.Format.Color.Light.Background : jsc.Utils.Format.Color.Normal.Background) + color);

		return this.append((asLightColor ? jsc.Utils.Format.Color.Light.Foreground : jsc.Utils.Format.Color.Normal.Foreground) + color);
	},

	get Reset() {
		return this.append(jsc.Utils.Format.Reset);
	},

	get Bold() {
		return this.append(jsc.Utils.Format.Bold);
	},

	get Underline() {
		return this.append(jsc.Utils.Format.Underline);
	},

	Black: function(asBackground, asLightColor) {
		return this.setColor(jsc.Utils.Format.Color.Black, asBackground, asLightColor);
	},

	Red: function(asBackground, asLightColor) {
		return this.setColor(jsc.Utils.Format.Color.Red, asBackground, asLightColor);
	},

	Green: function(asBackground, asLightColor) {
		return this.setColor(jsc.Utils.Format.Color.Green, asBackground, asLightColor);
	},

	Yellow: function(asBackground, asLightColor) {
		return this.setColor(jsc.Utils.Format.Color.Yellow, asBackground, asLightColor);
	},

	Blue: function(asBackground, asLightColor) {
		return this.setColor(jsc.Utils.Format.Color.Blue, asBackground, asLightColor);
	},

	Magenta: function(asBackground, asLightColor) {
		return this.setColor(jsc.Utils.Format.Color.Magenta, asBackground, asLightColor);
	},

	Cyan: function(asBackground, asLightColor) {
		return this.setColor(jsc.Utils.Format.Color.Cyan, asBackground, asLightColor);
	},

	White: function(asBackground, asLightColor) {
		return this.setColor(jsc.Utils.Format.Color.White, asBackground, asLightColor);
	}
};

(function() {
	
	jsc.Utils.extendObject(Object, {
		extend: jsc.Utils.extendObject,
		clone: jsc.Utils.cloneObject,
		define: klass.Create
	});
	
})();

module.exports = jsc.Utils;
