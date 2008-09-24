/*
albumist.js Initial Alpha Release
SEPT 24 2008
Project Homepage: http://hostilefork.com/albumist

This "simple" script (well, it started simple) is designed to let bands 
put their discography on their blog or website, using information from 
Freebase and LyricsWiki.  It's rough and cobbled together from these 
sources:

	http://www.json.org/json.js
	http://www.freebase.com/view/guid/9202a8c04000641f800000000544e139#fig-albumlist2
	http://mootools.net/
	http://www.e-magine.ro/web-dev-and-design/36/moodalbox/
	  ( itself derived from http://www.digitalia.be/software/slimbox )
	http://talk-on-tech.blogspot.com/2008/07/access-to-lyricwikiorgs-rest-api-with.html
	http://bytes.com/forum/thread498334.html
	http://pr0digy.com/sandbox/mootools/slide-effect/

I'd like to thank those authors for sharing their work and knowledge.  My 
additions--to the extent you can tease them out (?)--are released under the 
Creative Commons Attribution Licence 3.0.  My hope is that anyone will PLEASE
link to http://hostilefork.com/albumist clearly from any site using this
script.  That way, we have a hub for discussing improvements that everyone
can benefit from.

This script was initiated by the Legendary Pink Dots, in support of the new
launch of their website for their 2008 US tour.

	http://legendarypinkdots.org/music

I'm new to JavaScript and dealing with browser quirks, and this was a real
eye-opener as a project.  I hope that someone who has spent more time with css
and mootools can help improve it and make it look and work better in more
browsers.  If we do this well, perhaps more bands can leverage the work of the
community to organize and police their discographies on their own websites,
instead of being stuck with sites that interfere with their creative control
like Facebook and Myspace.

Best wishes,
"Hostile Fork"
http://hostilefork.com
*/
 
/* 
Note1: For people who, like me, are new to Mootools.  If you see $ signs
and wonder what that is about, it's just just a convenient way of manipulating
the DOM:

	http://blog.mootools.net/2007/10/31/mootools-foundations-natives-and-elements

Nice, but certain uses seemed to produce this problem in IE:

	http://forum.mootools.net/viewtopic.php?id=3749

Though I don't think there are any such problematic uses at the moment.
*/

/* 
Note2: I know this isn't "minified" and is full of comments and thus
will load a bit slower than it might.  That is up to you, but I prefer to run
it with the full source right now so I can track down problems without being
stuck with the non-debuggable version and then run the risk of not reproducing
the bug.  When it's out of alpha I might consider distributing a minimized 
version in the package.

Also, it is all one file because I wanted to minimize the number of scripts
that web pages had to include, as well as make sure that any page that was
already using these scripts would not run into conflicts.  This decision may
be revisited in the future.
*/

/*
Note3: Something happened somewhere along the way and the script stopped 
working in Internet Explorer with an "operation aborted" error.  This bug 
seems to come and go and be sensitive to changes in the code that I don't 
quite understand.  The most common cause is code that manipulates a div
that is not yet closed:

	http://clientside.cnet.com/code-snippets/manipulating-the-dom/ie-and-operation-aborted/
	http://support.microsoft.com/default.aspx/kb/927917

As far as I can tell, this is not what is going on.  In any case, it was
at one point running in IE so perhaps it will again soon.  For the moment,
it "alert()"s the user to use a different browser.
*/

/*
Note4: PLEASE make any proposed changes to this code validate against the 
JavaScript lint before submitting them:

	http://www.jslint.com/
	
If you get the perplexing "Missing 'new' prefix when invoking a constructor" 
that is because you named a function with a capital letter and it doesn't like
that.  Lowercase letters starting function and field names seems to be the
norm so I'm sticking to it.  Implied globals, e.g. mootools primitives this
file depends upon, must be declared using the comment directive "global" as
below.
*/

// JSLINT GLOBAL DECLARATIONS
/*global $E, Ajax, Element, Fx, Class */ // MOOTools exports
/*global document, window, navigator, alert */ // browser basics
/*global song*/ // LyricWiki JSON technique makes a "song" global variable

// Main namespace, see http://userjs.org/help/tutorials/avoiding-conflicts
var Albumist = {};

// Metaweb namespace, must be exposed so that result of mqlread can bind to it
var Metaweb = {};

///////////////////////////////////////////////////////////////////////////////
// MISC HELPER FUNCTIONS
///////////////////////////////////////////////////////////////////////////////

(function () {

	function userRunningIE() { // used to be called "UserNeedsABetterBrowser"
		/* return Browser.Engine.trident; */ // not part of "Core" mootools 
		return navigator.appName == "Microsoft Internet Explorer";
	}

	// Cannot use the onclick/onClick for dynamically created table elements
	// in IE.  Sigh.
	//		http://forums.asp.net/t/1042666.aspx
	function setOnClickFunctionString(el,functionString) {
		if(userRunningIE()) {
			/* 
			// Capital C in onClick deprecated but IE needs it.
			//		http://www.webdeveloper.com/forum/showthread.php?t=172761
			el.onClick = Function(functionString); 
			*/
			el.setAttribute("onclick", functionString);
		} else {
			var createFunctionAlias = Function; // JSLint hates caps
			el.onclick = createFunctionAlias(functionString);
		}
	}
	
	// "window.getScrollTop() Is Incorrect with IE7 !! (also with IE6 in strict 
	// mode)" -- "getScrollTop() implementation is not cross browser style, no 
	// matter what doctype is given."
	//		http://dev.mootools.net/ticket/117 (Google Cache)
	function getViewportScrollTopWorkaround(hacksForNonstandardIE) {
		if (hacksForNonstandardIE && userRunningIE()) {
			return document.body.scrollTop;
		} else {
			return window.getScrollTop();
		}
	}
	
	// IE also doesn't work properly with this.  Amazing.
	//		http://www.webdeveloper.com/forum/showthread.php?t=166118
	//		http://andylangton.co.uk/articles/javascript/get-viewport-size-javascript/
	function getViewportHeightWorkaround(hacksForNonstandardIE) {
 		// the more standards compliant browsers (mozilla/netscape/opera/IE7) 
 		// use window.innerWidth and window.innerHeight
		if (typeof window.innerHeight != 'undefined') {
      		return window.innerHeight;
 		}
 
		// IE6 in standards compliant mode (i.e. with a valid doctype as the first line in the document)
		if (typeof document.documentElement != 'undefined' && typeof document.documentElement.clientHeight != 'undefined' && document.documentElement.clientHeight !== 0) {
       		return document.documentElement.clientHeight;
 		}
 
 		// older versions of IE
        return document.getElementsByTagName('body')[0].clientHeight;
 	}
 	
	function getViewportWidthWorkaround(hacksForNonstandardIE) {
		// the more standards compliant browsers (mozilla/netscape/opera/IE7) use window.innerWidth and window.innerHeight
		if (typeof window.innerWidth != 'undefined') {
      		return window.innerWidth;
 		}
 
		// IE6 in standards compliant mode (i.e. with a valid doctype as the first line in the document)
		if (typeof document.documentElement != 'undefined' && typeof document.documentElement.clientWidth != 'undefined' && document.documentElement.clientWidth !== 0) {
       		return document.documentElement.clientWidth;
 		}
 
 		// older versions of IE
        return document.getElementsByTagName('body')[0].clientWidth;
 	}
		
	var cssWasInjected = false;
	
///////////////////////////////////////////////////////////////////////////////
// FREEBASE INTERFACE CODE
///////////////////////////////////////////////////////////////////////////////

// We don't seem to use JSON.parse for anything at the moment.
// and the way it is written makes jslint very angry

	/**
	 * BEGIN: json.js
	 * This file defines functions JSON.parse() and JSON.serialize()
	 * for decoding and encoding JavaScript objects and arrays from and to
	 * application/json format.
	 * 
	 * The JSON.parse() function is a safe parser: it uses eval() for
	 * efficiency but first ensures that its argument contains only legal
	 * JSON literals rather than unrestricted JavaScript code.
	 *
	 * This code is derived from the code at http://www.json.org/json.js
	 * which was written and placed in the public domain by Douglas Crockford.
	 * 
	 **/
	
	var JSON = {}; // This object holds our parse and serialize functions
	
	// Our JSON.serialize() function requires a number of helper functions.
	// They are all defined within this anonymous function so that they remain
	// private and do not pollute the global namespace.
	(function () {
		
		// The parse function is short but the validation code is complex.
		// See http://www.ietf.org/rfc/rfc4627.txt
	/*	JSON.parse = function(s) {
			try {
				return !(/[^,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]/.test(
										   s.replace(/"(\\.|[^"\\])*"/g, ''))) &&
					eval('(' + s + ')'); 
			}
			catch (e) {
				return false;
			}
		}; */
	
		var m = {  // A character conversion map
				'\b': '\\b', '\t': '\\t',  '\n': '\\n', '\f': '\\f',
				'\r': '\\r', '"' : '\\"',  '\\': '\\\\'
			},
			s = { // Map type names to functions for serializing those types
				'boolean': function (x) { return String(x); },
				'null': function (x) { return "null"; },
				number: function (x) { return isFinite(x) ? String(x) : 'null'; },
				string: function (x) {
					if (/["\\\x00-\x1f]/.test(x)) {
						x = x.replace(/([\x00-\x1f\\"])/g, function(a, b) {
							var c = m[b];
							if (c) {
								return c;
							}
							c = b.charCodeAt();
							return '\\u00' +
								Math.floor(c / 16).toString(16) +
								(c % 16).toString(16);
						});
					}
					return '"' + x + '"';
				},
				array: function (x) {
					var a = ['['], b, f, i, l = x.length, v;
					for (i = 0; i < l; i += 1) {
						v = x[i];
						f = s[typeof v];
						if (f) {
							v = f(v);
							if (typeof v == 'string') {
								if (b) {
									a[a.length] = ',';
								}
								a[a.length] = v;
								b = true;
							}
						}
					}
					a[a.length] = ']';
					return a.join('');
				},
				object: function (x) {
					if (x) {
						if (x instanceof Array) {
							return s.array(x);
						}
						var a = ['{'], b, f, i, v;
						for (i in x) {
							if (true) { // JSlint wants us to do this
								v = x[i];
								f = s[typeof v];
								if (f) {
									v = f(v);
									if (typeof v == 'string') {
										if (b) {
											a[a.length] = ',';
										}
										a.push(s.string(i), ':', v);
										b = true;
									}
								}
							}
						}
						a[a.length] = '}';
						return a.join('');
					}
					return 'null';
				}
			};
	
		// Export our serialize function outside of this anonymous function
		JSON.serialize = function(o) { return s.object(o); };
		
	})(); // Invoke the anonymous function once to define JSON.serialize()
	
	/* END: json.js */
	
	/**
	 * metaweb.js: 
	 *
	 * This file implements a Metaweb.read() utility function using a <script>
	 * tag to generate the HTTP request and the URL callback parameter to
	 * route the response to a specified JavaScript function.
	 **/
	
	(function () {
		Metaweb.HOST = "http://www.freebase.com";	   // The Metaweb server
		Metaweb.QUERY_SERVICE = "/api/service/mqlread"; // The service on that server
		Metaweb.counter = 0;							// For unique function names
		
		// Send query q to Metaweb, and pass the result asynchronously to function f
		Metaweb.read = function(q, f) {
			// Define a unique function name
			var callbackName = "_" + Metaweb.counter++;
		
			var script; // make a forward declaration so jslint doesn't gripe
			
			// Create a function by that name in the Metaweb namespace.
			// This function expects to be passed the outer query envelope.
			// If the query fails, this function throws an exception.  Since it
			// is invoked asynchronously, we can't catch the exception, but it serves
			// to report the error to the JavaScript console.
			Metaweb[callbackName] = function(outerEnvelope) {
				var innerEnvelope = outerEnvelope.qname;		 // Open outer envelope
				// Make sure the query was successful.
				if (innerEnvelope.code.indexOf("/api/status/ok") !== 0) {  // Check for errors
				  var error = innerEnvelope.messages[0];		  // Get error message
				  throw error.code + ": " + error.message;	  // And throw it!
				}
				var result = innerEnvelope.result;   // Get result from inner envelope
				var foo = script;
				document.body.removeChild(script);   // Clean up <script> tag
				delete Metaweb[callbackName];		// Delete this function
				f(result);						   // Pass result to user function
			};
		
			// Put the query in inner and outer envelopes
			// NOTE: Original source made this global, that seems unnecessary
			var envelope = {qname: {query: q}};
		
			// Serialize and encode the query object
			var querytext = encodeURIComponent(JSON.serialize(envelope));
		
			// Build the URL using encoded query text and the callback name
			var url = Metaweb.HOST + Metaweb.QUERY_SERVICE +  
				"?queries=" + querytext + "&callback=Metaweb." + callbackName;
		
			// Create a script tag, set its src attribute and add it to the document
			// This triggers the HTTP request and submits the query
			script = new Element("script", {src: url});
			script.inject(document.body);
		};
		
	/**
	 * end metaweb.js: 
	 **/
	 
		// A utility function to return the year portion Metaweb /type/datetime
		// From: http://www.freebase.com/view/guid/9202a8c04000641f800000000544e139#fig-albumlist2
		Metaweb.getYear = function(date) {
			if (!date) {
				return null;
			}
			if (date.length == 4) {
				return date;
			}
			if (date.match(/^\d{4}-/)) {
				return date.substring(0,4);
			}
			return null;
		};
	
		// Freebase stores track length times in seconds
		// This utility gives us Minutes and Seconds
		// From: http://www.freebase.com/view/guid/9202a8c04000641f800000000544e139#fig-albumlist2		
		Metaweb.toMinutesAndSeconds = function(totalSeconds) {
			var minutes = Math.floor(totalSeconds/60);
			var seconds = Math.floor(totalSeconds-(minutes*60));
			if (seconds <= 9) {
				seconds = "0" + seconds;
			}
			return minutes + ":" + seconds;
		};

	 	// Helper function for matching arrays the user has specified which are 
	 	// supposed to specify objects for certain Freebase ids or guids
		Metaweb.matchEntryByFreebaseIdOrGuid = function(result, entryList) {
			if (!entryList) {
				return null;
			}
			for (var entryIndex = 0; entryIndex < entryList.length; entryIndex++) {
				if (!result.guid) {
					alert("GUID required in query for MatchEntryByFreebaseIdOrGuid");
				}
				if (!result.id) {
					alert("Freebase ID required in query for MatchEntryByFreebaseIdOrGuid");
				}
				var entry = entryList[entryIndex];
				if (entry.id && (entry.id == result.id)) {
					return entry;
				}
				if (entry.guid && (entry.guid == result.guid)) {
					return entry;
				}
			} 
			return null;
		};

	})(); // Invoke the anonymous function once to define Metaweb API
	
///////////////////////////////////////////////////////////////////////////////
// MODAL DIALOG BOX
///////////////////////////////////////////////////////////////////////////////

	/******************************************************************/
	/* This section derived from	MOOdalBox 1.2.1						 */
	/* A modal box (inline popup), used to display remote content	 */
	/* loaded using AJAX, written for the mootools framework		  */
	/*		 by Razvan Brates, razvan [at] e-magine.ro			  */
	/******************************************************************/
	/*			   http://www.e-magine.ro/moodalbox				 */
	/******************************************************************/
	/*																*/
	/* MIT style license:											 */
	/* http://en.wikipedia.org/wiki/MIT_License					   */
	/*																*/
	/* mootools found at:											 */
	/* http://mootools.net/										   */
	/*																*/
	/* Original code based on "Slimbox", by Christophe Beyls:		 */
	/* http://www.digitalia.be/software/slimbox					   */
	/******************************************************************/
	
	// Constants defined here can be changed for easy config / translation
	// (defined as vars, because of MSIE's lack of support for const)
	
	var _ERROR_MESSAGE = "Oops.. there was a problem with your request.<br /><br />" +
						"Please try again.<br /><br />" +
						"<em>Click anywhere to close.</em>"; // the error message displayed when the request has a problem
	var _RESIZE_DURATION 		= 400; 		// Duration of height and width resizing (ms)
	var _INITIAL_WIDTH			= 250;		// Initial width of the box (px)
	var _INITIAL_HEIGHT			= 250;		// Initial height of the box (px)
	var _CONTENTS_WIDTH 		= 500;		// Actual width of the box (px)
	var _CONTENTS_HEIGHT		= 400;		// Actual height of the box (px)
	var _DEF_CONTENTS_WIDTH		= 500;		// Default width of the box (px) - used for resetting when a different setting was used
	var _DEF_CONTENTS_HEIGHT	= 400;		// Default height of the box (px) - used for resetting when a different setting was used
	var _DEF_FULLSCREEN_WIDTH	= 0.95;		// Default fullscreen width (%)
	var _DEF_FULLSCREEN_HEIGHT	= 0.8;		// Default fullscreen height (%)

	var _ANIMATE_CAPTION		= true;		// Enable/Disable caption animation
	var _EVAL_SCRIPTS			= false;	// Option to evaluate scripts in the response text
	var _EVAL_RESPONSE			= false;	// Option to evaluate the whole response text
	
	// The MOOdalBox object in its beauty
	var MOOdalBox = {
			
			// If we are doing a DHTML fake "popup" we need to freeze the scroll bars
		// on the underlying window
		//		http://bytes.com/forum/thread498334.html
		// This method is fairly gross, it just resets us if we try to scroll.
		// Should I reconsider, and is is lightbox-style popup a "bad" thing despite 
		// being somewhat in vogue?
		ScrollFreeze: /*2843293230303620532E4368616C6D657273*/ { // a cookie?
			propFlag : true,
			Ydisp : 0,
			Xdisp : 0,

			setXY : function() {
				window.scrollTo( this.Xdisp, this.Ydisp );
			},
	
			on : function() {
				if(this.getProp()) {
					var thisBound = this;
					window.onscroll= function() {
						thisBound.setXY();
					};
				}
			},
	
			off : function() {
				window.onscroll = null;
			},
	
			getProp : function() {
				if( typeof window.pageYOffset != 'undefined' ) {
					this.Ydisp=window.pageYOffset;
					this.Xdisp=window.pageXOffset;
				} else if(document.documentElement) {
					this.Ydisp=document.documentElement.scrollTop;
					this.Xdisp=document.documentElement.scrollLeft;
				} else if(document.body && typeof document.body.scrollTop != 'undefined') {
					this.Ydisp=document.body.scrollTop;
					this.Xdisp=document.body.scrollLeft;
				} else {
					this.propFlag=false;
				}
	
				return this.propFlag;
			}
		},
		
		// init the MOOdalBox
		init: function (options) {
			
			// init default options
			this.options = Object.extend({
				resizeDuration: 	_RESIZE_DURATION,
				initialWidth: 		_INITIAL_WIDTH,	
				initialHeight: 		_INITIAL_HEIGHT,
				contentsWidth: 		_CONTENTS_WIDTH,
				contentsHeight: 	_CONTENTS_HEIGHT,
				defContentsWidth: 	_DEF_CONTENTS_WIDTH,
				defContentsHeight: 	_DEF_CONTENTS_HEIGHT,
				defFullscreenWidth:	_DEF_FULLSCREEN_WIDTH,
				defFullscreenHeight:_DEF_FULLSCREEN_HEIGHT,
				animateCaption: 	_ANIMATE_CAPTION,
				evalScripts: 		_EVAL_SCRIPTS,
				evalResponse: 		_EVAL_RESPONSE
			}, options || {});
					
			// add event listeners
			this.eventKeyDown = this.keyboardListener.bindWithEvent(this);
			this.eventPosition = this.position.bind(this);
			
			// init the HTML elements
			// the overlay (clickable to close)
			this.overlay = new Element('div').setProperty('id', 'mb_overlay').injectInside(document.body);
			// the center element
			this.center = new Element('div').setProperty('id', 'mb_center').setStyles({width: this.options.initialWidth+'px', height: this.options.initialHeight+'px', marginLeft: '-'+(this.options.initialWidth/2)+'px', display: 'none'}).injectInside(document.body);
			// the actual page contents
			this.contents = new Element('div').setProperty('id', 'mb_contents').injectInside(this.center);
			
			// the bottom part (caption / close)
			this.bottom = new Element('div').setProperty('id', 'mb_bottom').setStyle('display', 'none').injectInside(document.body);
			this.closelink = new Element('a').setProperties({id: 'mb_close_link', href: '#'}).injectInside(this.bottom);
			this.caption = new Element('div').setProperty('id', 'mb_caption').injectInside(this.bottom);
			var clearEl = new Element('div');
			clearEl.setStyle('clear', 'both').injectInside(this.bottom);
			
			this.error = new Element('div').setProperty('id', 'mb_error').setHTML(_ERROR_MESSAGE);
			
			// attach the close event to the close button / the overlay
			this.closelink.onclick = this.overlay.onclick = this.close.bind(this);
			
			// init the effects
			var nextEffect = this.nextEffect.bind(this);
			this.fx = {
				overlay: 	this.overlay.effect('opacity', { duration: 500 }).hide(),
				resize: 	this.center.effects({ duration: this.options.resizeDuration, onComplete: nextEffect }),
				contents: 	this.contents.effect('opacity', { duration: 500, onComplete: nextEffect }),
				bottom: 	this.bottom.effects({ duration: 400, onComplete: nextEffect })
			};
			
			this.ajaxRequest = Class.empty;
		},
		
		click: function(link) {
			return this.open (link.href, link.title, link.rel);
		},
		
		openCore: function(contentsWidth, contentsHeight, hacksForNonstandardIE) {	
			this.position(hacksForNonstandardIE);
			this.setup(true);
			this.ScrollFreeze.on();
			this.top = getViewportScrollTopWorkaround(hacksForNonstandardIE) + (getViewportHeightWorkaround(hacksForNonstandardIE) / 15);
			this.center.setStyles({top: this.top+'px', display: ''});
			this.fx.overlay.custom(0.8);
			
			// Believe it or not, IE7 does not support opacity unless you have the right doctype.
			//    http://www.west-wind.com/WebLog/posts/7223.aspx
			// If you're unlucky enough to be running Internet Explorer
			// there will be no overlay animation, it goes straight to 0.8
			if (hacksForNonstandardIE && userRunningIE()) {
				this.overlay.setStyles({filter: 'alpha(opacity=80);', width: getViewportWidthWorkaround(hacksForNonstandardIE), height: getViewportHeightWorkaround(hacksForNonstandardIE)});
			}
			
			this.options.contentsWidth = contentsWidth ? contentsWidth : this.options.defContentsWidth;
			this.options.contentsHeight = contentsHeight ? contentsHeight : this.options.defContentsHeight;
							
			this.bottom.setStyles({opacity: '0', height: '0px', display: 'none'});
			this.center.className = 'mb_loading';
			
			this.fx.contents.hide();
		},
			
		// The functionality of just being able to initiate a MOOdalBox and then
		// later supply it with content in DOM form was not in the original MOOdalBox.
		// so I had to add it, which I did a bit haphazardly
		openAsyncStart: function(contentsWidth, contentsHeight, hacksForNonstandardIE) {
			if(this.step) {
				return false;
			}
			this.step = 1;
			
			this.openCore(contentsWidth, contentsHeight, hacksForNonstandardIE);
			this.nextEffect();
			return true;
		},
		
		openLink: function(sLinkHref, sLinkTitle, sLinkRel) {
			this.href = sLinkHref;
			this.title = sLinkTitle;
			this.rel = sLinkRel;
			
			// check to see if there are specified dimensions
			// if not, fall back to default values
			var aDim = this.rel.match(/[0-9]+/g);
			this.openCore((aDim && (aDim[0] > 0)) ? aDim[0] : null, (aDim && (aDim[1] > 0)) ? aDim[1] : null, false);
			return this.loadContents(sLinkHref);
		},
		
		position: function(hacksForNonstandardIE) {
			if (hacksForNonstandardIE) {
				this.overlay.setStyles({top: getViewportScrollTopWorkaround(hacksForNonstandardIE) /*+'px'*/, height: getViewportHeightWorkaround(hacksForNonstandardIE)/*+'px'*/, width: getViewportWidthWorkaround(hacksForNonstandardIE) });
			} else {
				this.overlay.setStyles({top: getViewportScrollTopWorkaround(hacksForNonstandardIE) + 'px', height: getViewportHeightWorkaround(hacksForNonstandardIE) + 'px'});
			}
		},
		
		setup: function(open) {
			var fn = open ? 'addEvent' : 'removeEvent';
			window[fn]('scroll', this.eventPosition)[fn]('resize', this.eventPosition);
			document[fn]('keydown', this.eventKeyDown);
			this.step = 0;
			
			// Wasn't in the original... 
			this.center.setStyles({width: this.options.initialWidth+'px', height: this.options.initialHeight+'px', marginLeft: '-'+(this.options.initialWidth/2)+'px', display: 'none'});
			this.contents.setHTML("");
		},
		
		openAsyncFinish: function(el, hacksForNonstandardIE) {	
			el.inject(this.contents);
			this.options.contentsWidth 	= this.options.defFullscreenWidth*getViewportWidthWorkaround(hacksForNonstandardIE);
			this.options.contentsHeight = this.options.defFullscreenHeight*getViewportHeightWorkaround(hacksForNonstandardIE);

			this.nextEffect();
		},
	
				
		nextEffect: function() {
			// changed to a do-while instead of using the fallthrough technique
			// this appeased jslint, which doesn't like fallthrough
			var stepDuringLoop;
			do {
				stepDuringLoop = this.step;
				switch(this.step) {
				case 1:
					// remove previous styling from the elements 
					// (e.g. styling applied in case of an error)
					this.center.className = '';
					this.center.setStyle('cursor', 'default');
					this.bottom.setStyle('cursor', 'default');
					this.center.onclick = this.bottom.onclick = '';
					this.caption.setHTML(this.title);
					
					this.contents.setStyles ({width: this.options.contentsWidth + "px", height: this.options.contentsHeight + "px"});
					
					if(this.center.clientHeight != this.contents.offsetHeight) {
						this.fx.resize.custom({height: [this.center.clientHeight, this.contents.offsetHeight]});
						break;
					}
					this.step++;
					break;
							
				case 2:
					if(this.center.clientWidth != this.contents.offsetWidth) {
						this.fx.resize.custom({width: [this.center.clientWidth, this.contents.offsetWidth], marginLeft: [-this.center.clientWidth/2, -this.contents.offsetWidth/2]});
						break;
					}
					this.step++;
					break;
				
				case 3:
					this.bottom.setStyles({top: (this.top + this.center.clientHeight)+'px', width: this.contents.style.width, marginLeft: this.center.style.marginLeft, display: ''});
					this.fx.contents.custom(0,1);
					break;
				
				case 4:
					if(this.options.animateCaption) {
						this.fx.bottom.custom({opacity: [0, 1], height: [0, this.bottom.scrollHeight]});
						break;
					}
					this.bottom.setStyles({opacity: '1', height: this.bottom.scrollHeight+'px'});
					this.step = 0;
					return;
				
				case 5:
					this.step = 0;
					return;
				}
				stepDuringLoop++;
				this.step++;
			} while (stepDuringLoop != this.step);
		},

		failToOpen: function (){
			this.contents.setHTML('');
			this.error.clone().injectInside(this.contents);
			this.nextEffect();
			this.center.setStyle('cursor', 'pointer');
			this.bottom.setStyle('cursor', 'pointer');
			this.center.onclick = this.bottom.onclick = this.close.bind(this);		
		},

		loadContents: function() {		
			if(this.step) {
				return false;
			}
			this.step = 1;
			
			// AJAX call here
			var nextEffect = this.nextEffect.bind(this);
			var ajaxFailure = this.failToOpen.bind(this);
			var ajaxOptions = {
				method: 		'get',
				update: 		this.contents, 
				evalScripts: 	this.options.evalScripts,
				evalResponse: 	this.options.evalResponse,
				onComplete: 	this.nextEffect, 
				onFailure: 		this.failToOpen
				};
			this.ajaxRequest = new Ajax(this.href, ajaxOptions).request();
					
			return false;
		},
		
		keyboardListener: function(event) {
			// close the MOOdalBox when the user presses CTRL + W, CTRL + X, ESC
			if ((event.control && event.key == 'w') || (event.control && event.key == 'x') || (event.key == 'esc')) {
				this.close();
				event.stop();
			}		
		},
		
		close: function() {
			if(this.step < 0) { 
				return;
			}
			this.ScrollFreeze.off();
			this.step = -1;
			for(var f in this.fx) {
				if (true) { // to appease JSlint, for (i in x) needs wrapping
					this.fx[f].clearTimer();
				}
			}
			this.center.style.display = this.bottom.style.display = 'none';
			this.center.className = 'mb_loading';
			this.fx.overlay.chain(this.setup.pass(false, this)).custom(0);
			return false;
		}
			
	};	
	// startup
	window.onDomReady(MOOdalBox.init.bind(MOOdalBox));
	
	/* End MOOdalBox derivation code */

///////////////////////////////////////////////////////////////////////////////
// LYRICWIKI.ORG INTERFACE
///////////////////////////////////////////////////////////////////////////////

	// Try to guess LyricWiki page name from track name, but support the
	// ability to manually override via the config
	//
	//	http://lyricwiki.org/LyricWiki:Page_names
	function reformatStringForLyricWiki(str) {
		var result = "";
		var startOfWord = true;
		var i = 0;
		for(i = 0; i < str.length; i++) {
			var cur = str.substring(i, i+1).toLowerCase(); // uppercase/lowercase functions operate on STRINGS.
			if (cur == " ") {
				result += "_";
				startOfWord = true;
			} else if ((cur >= "a") && (cur <= "z")) {
				if (startOfWord) {
					result += cur.toUpperCase();
				} else {
					result += cur;
				}
				startOfWord = false;
			} else {
				startOfWord = false; // Hm, what if the song name was "Joe&Me" with no spaces.  This makes Joe&me.
				result += cur;
			}
		}
		return result;
	}
	function reformatBandNameForLyricWiki(bandName, config) {
		if (config.bandNameOnLyricWiki) {
			return config.bandNameOnLyricWiki;
		} else {
			return reformatStringForLyricWiki(bandName);
		}
	}
	function reformatTrackNameForLyricWiki(track, config) {
		// I am not sure why on Firefox config.trackNamesOnLyricWiki
		// is generating a "trackNamesOnLyricWiki is undefined".  Works
		// in other browsers, and the notations are supposed to be 
		// equivalent.  I think it is a bug in Firefox.
		var propertyString = "trackNamesOnLyricWiki"; // to keep JSlint from complaining
		var trackObject = Metaweb.matchEntryByFreebaseIdOrGuid(track, config[propertyString]);
		if (trackObject) {
			return trackObject.name;
		}
		// If no exception made, just use the default
		return reformatStringForLyricWiki(track.name);
	}
	
	// URL to view lyrics, e.g. http://lyricwiki.org/Michael_Penn:Walter_Reed
	function getViewUrlForLyricWiki(bandName, track, config) {
		var bandNameOnLyricWiki = reformatBandNameForLyricWiki(bandName, config);
		var trackNameOnLyricWiki = reformatTrackNameForLyricWiki(track, config); 
		return 'http://lyricwiki.org/' + encodeURIComponent(bandNameOnLyricWiki) + ':' + encodeURIComponent(trackNameOnLyricWiki);	
	}
	
	// URL to edit lyrics
	// e.g. http://lyricwiki.org/index.php?title=A-Ha:Analogue_%28All_I_Want%29&action=edit
	function getEditUrlForLyricWiki(bandName, track, config) {
		var bandNameOnLyricWiki = reformatBandNameForLyricWiki(bandName, config);
		var trackNameOnLyricWiki = reformatTrackNameForLyricWiki(track, config); 
		return 'http://lyricwiki.org/index.php?title=' + encodeURIComponent(bandNameOnLyricWiki) + 
			':' + encodeURIComponent(trackNameOnLyricWiki) + '&action=edit';
	}
	
	/* 
	 * BEGIN DERIVATION of lyricwiki.js
	 * http://talk-on-tech.blogspot.com/2008/07/access-to-lyricwikiorgs-rest-api-with.html
	 *
	 * 1 July 2008, Stefan Fussenegger
	 * Public Domain Dedication
	 * http://creativecommons.org/licenses/publicdomain/
	 *
	 */
	
	// JSON Request comes back as
	// song = {
	// 'artist':'The Rolling Stones',
	// 'song':'19th Nervous Breakdown',
	// 'lyrics':'You\'re the kind of person\nYou meet at certain dismal, dull affairs\n (...)',
	// 'url':'http://lyricwiki.org/The_Rolling_Stones:19th_Nervous_Breakdown'
	// }
	
	// last script node
	var script = undefined;
	
	// callback function will receive the lyrics as a parameter, or null if they can't be gotten
	function loadLyricsAsync(bandName, track, config, callback) {
		var bandNameOnLyricWiki = reformatBandNameForLyricWiki(bandName, config);
		var trackNameOnLyricWiki = reformatTrackNameForLyricWiki(track, config); 
		var url = "http://lyricwiki.org/api.php?artist=" + encodeURIComponent(bandNameOnLyricWiki) + "&song=" + encodeURIComponent(trackNameOnLyricWiki) + "&fmt=json";
		
		var head = document.getElementsByTagName('head')[0];
		
		var callbackClosure = function() {
			// song is a global variable in the JSON
			// anything that can be done about that?
			if (song.lyrics == 'Not found') { // not a good way to return an error code!
				return callback(null);
			} else {
				return callback(song.lyrics.replace(/\n/g, "<br />"));
			}
		};
		
		if (script) {
			script.onReadyStateChange = null;
			head.removeChild(script);
		}
		
		script = new Element("script", {type: "text/javascript", src: url, charset: "utf-8"});
		script.inject(head);
		
		if (script.addEventListener) {
			// firefox and opera
			script.addEventListener("load", callbackClosure, false);
		} else if (document.all && !window.opera) {
			// IE
			script.onreadystatechange = function() {
				if (script.readyState == "loaded") {
					callback();
					script.onReadyStateChange = null;
				}
			};
		}
	}
	
///////////////////////////////////////////////////////////////////////////////
// SINGLE ALBUM VIEW FUNCTIONALITY
///////////////////////////////////////////////////////////////////////////////

	// http://pr0digy.com/sandbox/mootools/slide-effect/
	// return the "collapsible" effect
	function initializeCollapsibleItem(heading, collapse, content, bandName, track, config) {

		// Dynamic content is a problem in Firefox
		// (If you do not do this, the collapse region measures the contained
		// element while it's empty and the never revisits the size.)
		content.setStyle('height', 'auto');

		var collapsible = new Fx.Slide(collapse, { 
			duration: 500, 
			transition: Fx.Transitions.linear,
			onComplete: function(request){ 
				// this wasn't working so well in the pop up window
				// it scrolled to a weird place
				// review this later

				/*var open = request.getStyle('margin-top').toInt();
				if(open >= 0) new Fx.Scroll(window).toElement(heading);*/ 
			}
		});
	
		// Note: why does this work in IE without SetOnClickFunctionString?			
		heading.onclick = function(){
			var span = $E('span', heading);

			if (!content.innerHTML) {

				loadLyricsAsync(bandName, track, config, function(html) {
					var freebaseHtml = '<img src="' + config.basePath + 'freebase.png"> <a href="http://freebase.com/view' + track.id + '" target="_blank">Visit Song Page on Freebase</a><br />';
					var editLyricsHtml = '<img src="' + config.basePath + 'lyricwiki.png"> <a href="' + 
						getEditUrlForLyricWiki(bandName, track, config) + 
						'" target="_blank">' + (html ? 'Edit on LyricWiki' : 'Add to LyricWiki') + '</a><br />';
					if (html) {
						content.setHTML('<div class="no_margin">' + editLyricsHtml + freebaseHtml + '</div><br />' + '<div class="no_margin">' + html + '</p><br />');
					} else {
						content.setHTML('<div class="no_margin">' + editLyricsHtml + freebaseHtml + '</div><br />' + '<div class="no_margin"><i>This song is not on LyricWiki yet, at least not under the URL ' + getViewUrlForLyricWiki(bandName, track, config) + '<br />You can <a href="http://lyricwiki.org/Special:Search" target="_blank">Search LyricWiki</a> to see if it is there under a different name, and either change the track name in Freebase or in LyricWiki to match.  If not, you can add it yourself under this name.</i></div><br />');
					}
					collapsible.toggle();
					if(span){
						var newHTML = span.innerHTML == '+' ? '-' : '+';
						span.setHTML(newHTML);
					}
				});
			} else {
				collapsible.toggle();
				if(span){
					var newHTML = span.innerHTML == '+' ? '-' : '+';
					span.setHTML(newHTML);
				}
			}				
			
			return false;
		};
		
		collapsible.hide();
	
	return collapsible;
	}
	
	// This is the core openAlbum function
	// Each Albumist instance on the page must have its own specialization of this function
	function openAlbumCore(id, config, cache) {
		MOOdalBox.openAsyncStart(null, null, config.hacksForNonstandardIE);
		
		// This is the MQL query we will issue
		// should some of these properties come from the config or cache?
		var query = {
			type: "/music/album",
			id: id,
			guid: null,
			name: null,
			release_date: null,
			artist: null,
			// Get track names and lengths, sorted by index
			track: [{
				name: null,
				id: null,
				guid: null, 
				length: null, 
				index: null, 
				sort: "index",
				"optional" : true
			}]
		};
		
		var processTracklistResult = function(result) {
			if (result && result.track) {
				
				var imageURL;
				if (cache[id].coverId) { 
					imageURL = 'http://www.freebase.com/api/trans/image_thumb' + cache[id].coverId + '?maxwidth=' + config.coverEdgeSize + '&maxheight=' + config.coverEdgeSize;
				} else {
					imageURL = 'http://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/' + config.coverEdgeSize + 'px-No_image_available.svg.png';
				}
				
				var slideEffectEl = new Element("div", {id: "slide-effect"});
				var containerEl = new Element("div", {id: "container"});
				containerEl.inject(slideEffectEl);
				
				var imageEl = new Element("img", {src: imageURL});
				imageEl.inject(containerEl);
				var linksEl = new Element("div", {className: "no_margin"});
				var freebaseHtml = '<img src="' + config.basePath + 'freebase.png"> <a href="http://freebase.com/view' + result.id + '" target="_blank">Visit Album Page on Freebase</a><br />';
				var buyObject = Metaweb.matchEntryByFreebaseIdOrGuid(result, config.buyAlbums);
				var buyHtml = buyObject ? '<a href="' + buyObject.link + '" target="_blank">Buy it now for ' + buyObject.price + '</a><br />' : "";
				linksEl.setHTML(freebaseHtml + buyHtml);
				linksEl.inject(containerEl);
				
				var breakEl = new Element("br");
				breakEl.inject(containerEl);
				
				// Another CSS inconsistency
				// http://snipplr.com/view/2368/class-and-classname/
				var headingEl = new Element("div", {className: "heading"});
				headingEl.inject(containerEl);

				// Create HTML elements to display the album name and year.				
				var albumTitleEl = new Element("h2");
				var year = Metaweb.getYear(result.release_date);
				var text = result.name + (year?(" ["+year+"]"):""); // name+year
				albumTitleEl.setHTML(text /*+ '<a id="expand-all" href="#" title="Expand all">expand all</a> | <a id="collapse-all" href="#" title="Collapse all">collapse all</a>'*/);
				albumTitleEl.inject(headingEl);
				
				var listEl = new Element("ol", {id: "vertical", className: "simple"});
				listEl.inject(containerEl);
				
				var collapsibles = [];
				var headings = [];
				
				// Build an array of track names + lengths
				for(var i = 0; i < result.track.length; i++) {
					var listItemEl = new Element("li");
					var headerEl = new Element("h3");
					headerEl.inject(listItemEl);
					var html = '[<a href="#"><span>+</span></a>] ' + (i + 1) + ". " + result.track[i].name + " (" + Metaweb.toMinutesAndSeconds(result.track[i].length)+")";
					headerEl.setHTML(html);
					
					var collapseEl = new Element("div", {className: "collapse"});
					var collapseContainerEl = new Element("div", {className: "collapse-container"});
					collapseContainerEl.inject(collapseEl);
					collapseEl.inject(listItemEl);
					listItemEl.inject(listEl);
					
					collapsibles[i] = initializeCollapsibleItem(headerEl, collapseEl, collapseContainerEl, result.artist, result.track[i], config);
					headings[i] = headerEl;
				}
				
				var noticeMissingEl = new Element("div", {className: "no_margin"});
				noticeMissingEl.setHTML('<hr><i>Is this information incomplete, or incorrect?<br />You can visit Freebase and easily edit tracks and cover art.<br />Then reload this page and you will have the option to add lyrics as well!</i>');
				noticeMissingEl.inject(containerEl);
				
				MOOdalBox.openAsyncFinish(slideEffectEl, config.hacksForNonstandardIE);
			
				// Revisit, looks bad in the layout.
					
/*				var collapseAllEl = $('collapse-all');
				if (collapseAllEl)
				collapseAllEl.onclick = function(){
					headings.each( function(heading, i) {
						collapsibles[i].hide();
						var span = $E('span', heading);
						if(span) span.setHTML('+');
					});
					return false;
				}
				
				var expandAllEl = $('expand-all')
				if (expandAllEl)
				expandAllEl.onclick = function(){
					headings.each( function(heading, i) {
						collapsibles[i].show();
						var span = $E('span', heading);
						if(span) span.setHTML('-');
					});
					return false;
				}*/
			
			
			}
			else {
				// If empty result display error message
				MOOdalBox.failToOpen();
			}
		};
		
		// Issue the query, invoke the nested function when the response arrives
		Metaweb.read(query, processTracklistResult);
				
		return false; // signal do NOT open window to freebase...
	}

///////////////////////////////////////////////////////////////////////////////
// ALBUM GRID VIEW FUNCTIONALITY
///////////////////////////////////////////////////////////////////////////////

	// Main Display Routine
	// Calls Freebase to get the album list, and then a callback function builds the
	// table from the results
	// Derived from: http://www.freebase.com/view/guid/9202a8c04000641f800000000544e139#fig-albumlist2
	function displayCore(element, bandId, bandName, configParam) {

		var config;
		if (!configParam) {
			config = new Albumist.Config();
		} else {
			config = configParam;
		}
			
		// can't specify both id AND bandName
		if (bandName && bandId) {
			throw "Albumist Error: cannot have both bandName and id properties set to non-null values";
		}
		
		// Albumist modification: set styles here so that you don't have to touch
		// the site's CSS if you're posting in a blog.  CSS cannot appear in the
		// body of your document according to the W3C spec.
		if (config.injectCss && !cssWasInjected) {
			var headID = document.getElementsByTagName("head")[0];		 
			var cssNode = new Element('link', {type: 'text/css', rel: 'stylesheet', href: config.basePath + "albumist.css", media: 'screen'});
			cssNode.inject(headID);
			cssWasInjected = true;
		}
		
		// We save some things from our initial album query to be used later
		// (such as the image URL for an album)
		var cache = {};
		
		// Find the document elements we need to insert content into 
		var albumlist = document.getElementById(element);
		var loadingEl = new Element("p");
		loadingEl.injectInside(albumlist); // Album list is coming... */
		if (userRunningIE()) {
			alert('Sorry, Internet Explorer is currently not supported for browsing the discography and lyrics database.  We are working on it!  In the meantime, please consider using Chrome, Firefox, or Safari.');
			return;	
		} else {
			loadingEl.setHTML("<b><i>Loading...</i></b>");
		}

		
		var query = {					  // This is our MQL query 
			type: "/music/artist",		 // Find a band
			name: bandName,					// With the specified name
			id: bandId,						// want the ID of the band to link to their Freebase page
			
			album: [{					  // We want to know about albums
				"/common/topic/image" : [{
					id: null,
					optional: true
				}],
				
				id: null,
				guid: null,
				name: null, // Return album names
				release_date: null, // And release dates
				sort: "-release_date" // Order by release date, minus reverses the sort (newest first)
			}]
		};
				
		// This function is invoked when we get the result of our MQL query
		function buildAlbumTable(result) {		
			// If no result, the band was unknown.
			if (!result || !result.album) {
				albumlist.setHTML("<b><i>Unknown band: " + config.bandName ? config.bandName : config.bandId + "</i></b>");
				return;
			}
			
			// Otherwise, the result object matches our query object, 
			// but has album data filled in.  
			var albums = result.album;  // the array of album data
					 
			// Erase the "Loading..." message we displayed earlier
			var tableEl = new Element("table", {border: "0", width: '"' + config.tableWidth + '"'}); 
			loadingEl.replaceWith(tableEl);
			
			// "Note: Internet Explorer requires that you create a tBody element 
			// and insert it into the table when using the DOM. Since you are 
			// manipulating the document tree directly, Internet Explorer does 
			// not create the tBody, which is automatically implied when using HTML."
			//   http://msdn.microsoft.com/en-us/library/ms532998.aspx
			var tbodyEl = new Element("tbody");
			tbodyEl.inject(tableEl);
			
			// regarding innerHTML, Mozilla says:
			// "It should never be used to write parts of a table--
			// --W3C DOM methods should be used for that—-though 
			// it can be used to write an entire table or the contents of a cell."
			// http://developer.mozilla.org/En/DOM:element.innerHTML
			// (basically, it's too flaky to use for rows or columns)
			var headerEl = new Element("tr");
			var headerColumnEl = new Element("td", {colspan: config.albumsPerRow});
			headerEl.appendChild(headerColumnEl);
			var bandFreebaseURL = "http://www.freebase.com/view" + result.id;
			headerColumnEl.setHTML('<div id="hd" style="background-color:#DDDDDD;"><p style="text-align:center;">Discography pulled from <a href="' + bandFreebaseURL + '" target="_blank">Freebase</a> <img src="' + config.basePath + 'freebase.png' + '" style="vertical-align: middle;" /> using <a href="http://hostilefork.com/albumist" target="_blank">"Albumist"</a> by <a href="http://hostilefork.com">Hostile Fork</a> <img src="' + config.basePath + 'hostilefork.png' + '" width="16" height="16" style="vertical-align: middle;" /></p></div>');				
			headerColumnEl.injectInside(headerEl);			
			headerEl.injectInside(tbodyEl);
								
			var rowEl = null;
			// Loop through the albums, but we may omit some from the greed, so keep an
			// index of albums we are actually using separate from our raw array index
			var albumIndex = 0;
			for(var rawAlbumIndex = 0; rawAlbumIndex < albums.length; rawAlbumIndex++) {
				var album = albums[rawAlbumIndex];

				if (Metaweb.matchEntryByFreebaseIdOrGuid(album, config.omitAlbums)) {
					continue;
				}
				
				cache[album.id] = {};
				
				var image = album["/common/topic/image"].length > 0 ? album["/common/topic/image"][0] : null;
				
				if (albumIndex % config.albumsPerRow === 0) {
					rowEl = new Element("tr");
					tbodyEl.appendChild(rowEl);
				}			

				// Can't inherit or put vertical-align on the row, must be on the cell
				// http://www.gtalbot.org/BrowserBugsSection/Opera9Bugs/VerticalAlignTableRow.html
				// Note: round width of column down to make all columns equal width and never exceed table size				
				var columnEl = new Element("td", {style: "vertical-align:top;", width: Math.floor(config.tableWidth/config.albumsPerRow)});
				rowEl.appendChild(columnEl);
				
				var albumDiv = new Element("div");
				albumDiv.className = "album"; 
				
				var pictureDiv = new Element("div", {className: "album-picture", style: "text-align: center; display:block;"});
				
				var pictureLink = new Element("a", {href: "http://www.freebase.com/view" + album.id, target: "_blank"});				
				var pictureImg = new Element("img", {width: '"' + config.thumbEdgeSize + '"', height: '"' + config.thumbEdgeSize + '"', border: '"0"'});
												
				if (image === null) {
					pictureImg.setAttribute("src", "http://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/" + config.thumbEdgeSize + "px-No_image_available.svg.png");
 					cache[album.id].coverId = null;
				} else {
 					cache[album.id].coverId = image.id;
				   	pictureImg.setAttribute("src", "http://www.freebase.com/api/trans/image_thumb" + image.id + "?maxwidth=" + config.thumbEdgeSize + "&maxheight=" + config.thumbEdgeSize);
				}
				
				// The openAlbum we hang on the element is a closure which gives us
				// access to the config and the cache of names/etc.  Must use a string
				// because of IE quirk that you can't attach function objects to the
				// onclick event for dynamic objects unless they are done as strings.
				var	functionString = 'return' + ' ' + ('document.getElementById("' + element + '").openAlbum') + '(' + '"' + album.id + '"' + ');';
				
				// Intercept links if we can.  If not, they will default to Freebase
				setOnClickFunctionString(pictureImg, functionString);
				
				pictureImg.inject(pictureLink);
				pictureLink.inject(pictureDiv);
				
				pictureDiv.inject(albumDiv);
				
				var titleDiv = new Element("div", {className: "album-title", style: "text-align: right; font-size: 10px;"});
				var titleLink = new Element("a", {href: "http://www.freebase.com/view" + album.id, target: "_blank"});
				titleLink.setHTML(album.name);
				titleLink.inject(titleDiv);
				titleDiv.inject(albumDiv);
				
				setOnClickFunctionString(titleLink, functionString);
				
				var buyInfo = Metaweb.matchEntryByFreebaseIdOrGuid(album, config.buyAlbums);
				if (buyInfo) {
					var priceDiv = new Element("div");
					priceDiv.className = "album-price";
					priceDiv.setAttribute("style", "text-align: right; font-size: 12px; margin-right: 12px; margin-bottom: 12px;");
					priceDiv.setHTML('<a href="' + buyInfo.link + '" target="_blank">BUY: ' + buyInfo.price + '</a>');
					albumDiv.appendChild(priceDiv);
					
					titleDiv.setAttribute("style", "text-align: right; font-size: 10px;");
				} else {
					titleDiv.setAttribute("style", "text-align: right; font-size: 10px; margin-bottom: 12px;");
				}
				
				columnEl.appendChild(albumDiv);
				
			 	albumIndex++;
			}
			
			var footerEl = new Element('tr');
			var footerColumnEl = new Element('td', {colspan: config.albumsPerRow});
			var footerDiv = new Element('div', {id: "ft", style: "background-color:#DDDDDD;"});
			footerColumnEl.setHTML('<div id="hd" style="background-color:#DDDDDD;"><p style="text-align:center;"><a href="http://hostilefork.com/albumist" target="_blank">"Albumist"</a> is released under the <a href="http://creativecommons.org/licenses/by/3.0/" target="_blank">Creative Commons Attribution 3.0 License</a></p></div>');				
			footerColumnEl.inject(footerEl);
			footerEl.inject(tbodyEl);
			
			// Internet Explorer Bug Workaround.
			// Clicking on albums doesn't work unless you do this.
			// http://forums.asp.net/t/1042666.aspx		
			if(userRunningIE()) {
				albumlist.innerHTML = tableEl.outerHTML;
			}
			
			// Create special closure so that openAlbum calls can access this config
			// Attach the event to the div so we have a place to keep it
			albumlist.openAlbum = function(id) { return openAlbumCore(id, config, cache); };
		}
			
		// Issue the query and invoke the function below when it is done
		Metaweb.read(query, buildAlbumTable);
	}

///////////////////////////////////////////////////////////////////////////////
// EXPOSED API
///////////////////////////////////////////////////////////////////////////////

	// Default configuration generator
	// Read about what the config settings do on http://hostilefork.com/albumist
	Albumist.Config = function() {
		this.thumbEdgeSize = 120;
		this.coverEdgeSize = 300;
		this.albumsPerRow = 5;
		this.tableWidth = 700;
		this.bandNameOnLyricWiki = null;
		this.trackNamesOnLyricWiki = null;
		this.injectCss = true;
		this.basePath = "";
		this.hacksForNonstandardIE = false; // if the doctype isn't set...
	};
	
	// If you're too lazy to look in Freebase for the unambiguous ID (?)
	// Then use this, bandName is a string e.g. "The Legendary Pink Dots"
	Albumist.displayByBandName = function(element, bandName, configParam) {
		return displayCore(element, null, bandName, configParam);
	};
	
	// Proper way to unambiguously specify a band is to use a Freebase ID
	// for instance: "/en/the_legendary_pink_dots"
	Albumist.displayByFreebaseId = function(element, bandId, configParam) {
		return displayCore(element, bandId, null, configParam);
	};
		
})();