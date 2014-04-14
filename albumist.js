//
// albumist.js
// jQuery plugin for a MusicBrainz/Freebase powered discography widget
// Copyright (C) 2008-2014 HostileFork.com
//
// Creative Commons Attribution-ShareAlike 4.0 International Public License
// See LICENSE.TXT for details
//
// For more project information, see http://albumist.hostilefork.com
//


// Whole-script strict mode syntax
"use strict";


////////////////////////////////////////////////////////////////////////////////

	// REQUIREJS AND MODULE PATTERN FOR WIDGET
	//
	// Basic structure borrowed from:
	//
	// http://bgrins.github.io/ExpandingTextareas/

(function(factory) {
	// Add jQuery via AMD registration or browser globals
	if (typeof define === 'function' && define.amd) {
		define([ 'jquery'], factory);
	} else {
		factory(jQuery);
	}
}(function ($) {

	// We don't want to throw up alert boxes, but we want to know when
	// problems happen in the console for developers to debug
	function _warn(text) {
		if(window.console && console.warn) console.warn(text);
	}


////////////////////////////////////////////////////////////////////////////////


	//
	// FREEBASE INTERFACE CODE
	//
	
	var Freebase = {

		// The Freebase server
		HOST: "https://www.googleapis.com",

		// The service on that server
		QUERY_SERVICE: "/freebase/v1/mqlread",
		
		// Send query q to Freebase, pass result asynchronously to function f
		read: function(q, f) {

			// Serialize and encode the query object
			var querytext = encodeURIComponent(JSON.stringify(q));
		
			// Build the URL using encoded query text and the callback name
			var url = Freebase.HOST + Freebase.QUERY_SERVICE +  
				"?query=" + querytext + "&callback=?";

			$.ajax({
			   type: 'GET',
				url: url,
				async: false,
				jsonpCallback: 'jsonCallback',
				contentType: "application/json",
				dataType: 'jsonp',
				success: function(json) {
				   f(json.result);
				},
				error: function(e) {
				   _warn("Albumist: query failure to Freebase");
				}
			});	
		},
		
		// A utility function to return the year portion Freebase /type/datetime
		// From: http://www.freebase.com/view/mid/9202a8c04000641f800000000544e139#fig-albumlist2
		getYear: function(date) {
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
		},
	
		// Freebase stores track length times in seconds
		// This utility gives us Minutes and Seconds
		// From: http://www.freebase.com/view/mid/9202a8c04000641f800000000544e139#fig-albumlist2		
		toMinutesAndSeconds: function(totalSeconds) {
			var minutes = Math.floor(totalSeconds/60);
			var seconds = Math.floor(totalSeconds-(minutes*60));
			if (seconds <= 9) {
				seconds = "0" + seconds;
			}
			return minutes + ":" + seconds;
		},

	};


////////////////////////////////////////////////////////////////////////////////


	//
	// INSTANCE INITIALIZATION
	//
	// While there is a DOM element in the tree representing the
	// discography, there is also a separate object representing the
	// properties of a albumist instance attached to that div.  I'm
	// not entirely sure about the advantages or disadvantages of this vs.
	// using jQuery .data() attached to the element (is that always cleared
	// when you unplug an element from the DOM?) but it works.
	//
	// One of these objects is instantiated whenever you call something like
	// $el.albumist({option: value}); and the instance lasts until
	// you call $el.albumist("destroy");
	//

	var Albumist = function($div, opts) {
		Albumist._registry.push(this);

		$div.addClass("albumist");
		this.$div = $div;

		// can't specify both id AND bandName
		if (opts.bandName && opts.bandMid) {
			throw Error("Albumist: can't specify both a band name and ID in config");
		}
		this.bandName = opts.bandName;
		this.bandMid = opts.bandMid;

		this.thumbEdgeSize = opts.thumbEdgeSize;
		this.coverEdgeSize = opts.coverEdgeSize;
		this.albumsPerRow = opts.albumsPerRow;
		this.omitAlbums = opts.omitAlbums;
		this.buyAlbums = opts.buyAlbums;

		// We save some things from our initial album query to be used later
		// (such as the image URL for an album)
		this.cache = {};

		this.initializeAlbumGrid();
	};

	// Stores (active) `Albumist` instances
	// Destroyed instances are removed
	Albumist._registry = [];

	// Returns the `Albumist` instance given a DOM node
	Albumist.getAlbumistInstance = function(div) {
		var $divs = $.map(Albumist._registry, function(instance) {
			return instance.$div[0];
		}),
		index = $.inArray(div, $divs);
		return index > -1 ? Albumist._registry[index] : null;
	};


////////////////////////////////////////////////////////////////////////////////


	//
	// BEGIN MEMBER FUNCTIONS COMMON TO ALBUMIST INSTANCES
	//
	// These are functions that expect to be called with a "this" parameter
	// being the Albumist instance they are running on.  That way they
	// have access to the configuration data without having to go hunting
	// for the information associated with an element.
	//

	Albumist.prototype = {


////////////////////////////////////////////////////////////////////////////////


		// 
		// ALBUM GRID ROUTINES
		//
		// Calls Freebase to get the album list, and then a callback function
		// builds the table from the results. 
		//

		_buildAlbumTable: function(albumList) {		

			var instance = this;

			var $table = $("<table><tbody>");
			var $tbody = $("<tbody></tbody>");
			$table.append($tbody);

			// We want each column in the table to be the result of rounding
			// down the total width divided by albums per row.  Do width by
			// percentage so if the div is resized the columns will resize
			var colWidth = "" + Math.floor(100/this.albumsPerRow) + "%";

			var $row = null;
			// Loop through the albums, but we may omit some from the list; so
			// keep an index of albums we are actually using
			var albumIndex = 0;
			$.each(albumList, function(rawAlbumIndex, album) {

				if ($.inArray(album.mid, instance.omitAlbums) > -1) {
					return;
				}
				
				instance.cache[album.mid] = {};
				
				var musicbrainzId = album.key.length ? album.key[0].value : null;

				if (albumIndex % instance.albumsPerRow === 0) {
					$row = $("<tr></tr>");
					$tbody.append($row);
				}			

				var $column = $('<td></td>');
				$row.append($column);
				$column.css("width", colWidth);
				
				var $albumDiv = $('<div class="album"></div>');

				var $pictureDiv = $('<div class="album-picture"></div>');

				var $pictureLink = $("<a></a>", {
					href: "http://www.freebase.com/view" + album.mid,
					target: "_blank"
				});

				var $thumbImg = $("<img></img>", {
					width: instance.thumbEdgeSize,
					height: instance.thumbEdgeSize,
					border: 0
				});

				var unavailableLink = 
					"http://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/" +
					instance.thumbEdgeSize + "px-No_image_available.svg.png";

				if (musicbrainzId === null) {
					$thumbImg.attr("src", unavailableLink);
					instance.cache[album.mid].musicbrainzId = null;
				} else {
					instance.cache[album.mid].musicbrainzId = musicbrainzId;

					// http://api.jquery.com/error/
					$thumbImg.error(function() {
						// just because there's a MusicBrainz ID doesn't mean
						// there's artwork.  If we queried MusicBrainz directly
						// instead of going through Freebase we might have
						// enough info to not need this handler.
						$(this).attr("src", unavailableLink);
					}); 

					if (true) {
						$thumbImg.attr("src",
							'http://coverartarchive.org/release-group/' + 
							musicbrainzId + 
							'/front-250'
						);
					} else {
						// Freebase image links for old album covers still work,
						// but they are no longer accepting new covers.  They
						// have also disabled the image thumbnail services
						// and you can only say what the "max width" and
						// "max height" you'll accept are.  It's kind of beyond
						// the point because they aren't allowing uploads of
						// cover art anymore, but this sort of works for the
						// old art at last check.

						if (album["/common/topic/image"].length > 0) {
							$thumbImg.attr("src",
								'https://www.googleapis.com/freebase/v1/image' +
								album["/common/topic/image"][0].mid +
								'?maxwidth=' + 2000 + 
								'&maxheight=' + 2000
							);
						}
					}
				}
				
				var albumClickedListener = function(event) {
					instance.openAlbumDetails.call(instance, album.mid);
				
					return false; // signal do NOT open window to freebase...
				};
				$thumbImg.click(albumClickedListener);
			
				$pictureLink.append($thumbImg);
				$pictureDiv.append($pictureLink);
				
				$albumDiv.append($pictureDiv);

				var $titleDiv = $('<div class="album-title"></div>');

				var $titleLink = $("<div>" + album.name + "</div>", {
					href: "http://www.freebase.com/view" + album.mid,
					target: "_blank"
				});
				$titleDiv.append($titleLink);
				$albumDiv.append($titleDiv);
				
				$titleLink.click(albumClickedListener);

				var buyInfo = instance.buyAlbums[album.mid];
				if (buyInfo) {
					var $priceDiv = $('<div class="album-price"></div>');
					$priceDiv.html(
						'<a href="' + buyInfo.link + '" target="_blank">BUY: ' 
						+ buyInfo.price + '</a>'
					);
					$albumDiv.append($priceDiv);	
				}
				
				$column.append($albumDiv);
				
				albumIndex++;
			});

			this.$div.append($table);
		},

		initializeAlbumGrid: function() {
			
			// Currently we start by leaving whatever is in the div until
			// the load is finished or failed.
			
			// In the query, fields that are filled in are used for matching.
			// Fields that are left null represent the values we want filled in
			// Note that only one of bandName or bandMid can be null, and we
			// will thus be requesting to retrieve the null one in result
			var query = {
				type: "/music/artist",
				name: this.bandName,
				mid: this.bandMid,
				
				// An array containing patterns with null indicates we're
				// looking for a potential array of matches, each one filled
				// in with the properties we're requesting.  Hence this
				// album template is a way of asking for potentially several
				// matching albums in the album field of the result.
				album: [{
					"/common/topic/image" : [{
						mid: null,
						optional: true
					}],
					key: [{
						namespace: "/authority/musicbrainz",
						value: null
					}],
					
					mid: null,
					name: null,
					release_date: null,

					// Sort array by release date, minus reverses (newest first)
					sort: "-release_date"
				}]
			};
			
			var instance = this;

			// Issue the query and invoke the function below when it is done
			Freebase.read(query, function(result) {

				// At this point we erase whatever was initially in the div
				instance.$div.empty();

				// If no result, the band was unknown.
				if (!result || !result.album) {
					instance.$div.html(
						"<b><i>Unknown band: " + 
						this.bandName ? this.bandName : this.bandMid 
						+ "</i></b>"
					);
				} else {
					// Otherwise, the result object matches our query object,
					// but has album data filled in.  Though singular "album",
					// it's actually an array of album data.  Also have the
					// canonized ID but we don't currently use it for anything

					var bandURL = "http://www.freebase.com/view" + result.mid;

					instance._buildAlbumTable.call(instance, result.album);
				}
			});
		},


////////////////////////////////////////////////////////////////////////////////


		// 
		// ALBUM DETAILS VIEW
		//
		// This creates a SimpleModal dialog box that pops up for showing a
		// view of the album's tracks and a larger version of the cover
		//

		_createDetailsPopup: function(album, releaseList) {

			// We currently just take the first release in the array
			// (should probably at least mention/hyperlink the other releases
			// if there are any, or make a tab for each?)
			var release = releaseList[0];
			var trackList = release.track_list;
			
			var $containerDiv = $('<div class="container">');

			var unavailableLink = (
				'http://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/' +
				'No_image_available.svg/' + this.coverEdgeSize + 
				'px-No_image_available.svg.png'
			);
			
			var $detailsDiv = $('<div class="details"></div>');

			var $coverImg = $("<img></img>", {
				width: this.coverEdgeSize,
				height: this.coverEdgeSize
			});
			if (this.cache[album.mid].musicbrainzId) {
				// http://api.jquery.com/error/
				$coverImg.error(function() {
					// just because there's a MusicBrainz ID doesn't mean
					// there's artwork.  If we queried MusicBrainz directly
					// instead of going through Freebase we might have
					// enough info to not need this handler.
					$(this).attr("src", unavailableLink);
				}); 
				$coverImg.attr("src",
					'http://coverartarchive.org/release-group/' +
					this.cache[album.mid].musicbrainzId + '/front'
				);
			} else {
				$coverImg.attr("src", unavailableLink);
			}

			$detailsDiv.append($coverImg);
			var $linksDiv = $("<div></div>");

			// There was a visit Freebase URL link but it was taking up space
			/* var freebaseUrl = 'http://freebase.com/view' + album.mid; */

			var buyObject = this.buyAlbums[album.mid];
			var buyHtml = "";
			if (buyObject) {
				buyHtml =
					'<a href="' + buyObject.link + '" target="_blank">' +
					'Buy it now for ' + buyObject.price +
					'</a><br />'
				;
			}
			$linksDiv.html(buyHtml);
			$detailsDiv.append($linksDiv);
			
			$containerDiv.append($detailsDiv);

			var $tracksDiv = $('<div class="tracks"></div>');

			// Another CSS inconsistency
			// http://snipplr.com/view/2368/class-and-classname/
			var $headingEl = $("<div></div>", {
				class: "heading"
			});

			// Create HTML elements to display the album name and year.				
			var year = Freebase.getYear(release.release_date);
			var text = album.name + (year?(" ["+year+"]"):""); // name+year
			$headingEl.text(text);
			$tracksDiv.append($headingEl);

			var $tracksOl = $("<ol></ol>", {
				id: "vertical",
				class: "simple"
			});
			$tracksDiv.append($tracksOl);
			
			var collapsibles = [];
			var headings = [];
			
			// Build an array of track names + lengths
			$.each(trackList, function(i, track) {
				// Are track numbers ever not sequential to not use a 
				// numbered list?

				var $trackLi = $("<li></li>");
				var trackText = track.name;
				if (track.length) {
					trackText += " (" + Freebase.toMinutesAndSeconds(track.length) + ")";  
				} 
				$trackLi.text(trackText);
				$tracksOl.append($trackLi);
			});

			$containerDiv.append($tracksDiv);

			var $modalBox = $("<div id='basic-modal'></div>");

			var $modalContent = $("<div class='simplemodal-data'></div>");
			$modalContent.append($containerDiv);	

			$modalBox.append($modalContent);

			$modalBox.modal({
				// "Fixed" means the box will scroll with the page instead
				// of float as you scroll it in the same location it was
				// when it popped up.

				fixed: false
			});
		},

		openAlbumDetails: function(albumMid) {

			// We should probably create the modal box here and have a "Loading..."
			// However SimpleModal is unable to dynamically size content, so
			// creating the box while we're waiting for the data to fetch would
			// involve additional work.  Not impossible, just trying to get the
			// basics done first:
			//
			// http://stackoverflow.com/questions/1407059/

			// This is the MQL query we will issue
			// should some of these properties come from the config or this.cache?
			var query = {
				type: "/music/album",
				mid: albumMid, // machine ID (basically like a GUID)
				name: null,
				release_date: null,
				artist: null,
				releases: [{
					mid: null,
					release_date: null,
					track_list: [{
						mid: null,
						name: null,
						track_number: null,
						length: null
					}]
				}],
			};
			
			var instance = this;

			// Issue the query, invoke the nested function when the response arrives
			Freebase.read(query, function(result) {
				if (result && result.releases) {
					// to make things clearer, separate album and releaseList
					// pass the releaseList to the details popup vs. paring
					// down to a single album in case a UI is created for it
					var releaseList = result.releases;
					delete result.releases;
					var album = result;
					instance._createDetailsPopup.call(instance, album, releaseList);
				} else {
					throw Error("Albumist: Invalid album details retrieved");
				}
			});
		}


////////////////////////////////////////////////////////////////////////////////


	//
	// END OF MEMBER FUNCTIONS
	//

	};


////////////////////////////////////////////////////////////////////////////////


	//
	// JQUERY EXTENSION REGISTRATION
	//
	// This is the jQuery extension function which allows you to choose any
	// jQuery collection and run $(selector).albumist(...)
	//
	// Here the default options are set up.
	//

	$.albumist = $.extend({
		// Global options for the behavior of the albumist plugin
		cssInjected: false,

		// These are the per-instance options.  If there's a piece of state
		// or a hook that might be different between one div and another
		// then it needs to go in here.
		opts: {
			thumbEdgeSize: 120,
			coverEdgeSize: 300,
			albumsPerRow: 5,
			omitAlbums: null,
			buyAlbums: null,
			bandName: null,
			bandMid: null
		}
	}, $.albumist || {});

	//
	// GLOBAL FUNCTIONS
	//

	$.albumist.injectCss = function(cssPath) {
		// Albumist modification: set styles here so that you don't have to
		// touch the site's CSS if you're posting in a blog.  CSS cannot appear
		// in the body of your document according to the W3C spec.
		$('head').prepend($(
			'<link type="text/css" rel="stylesheet" href="' + 
			cssPath + '" media="screen">'
		));
	};

////////////////////////////////////////////////////////////////////////////////


	//
	// JQUERY ALBUMIST INSTANTIATOR + METHOD DISPATCHER
	//
	// This is the method dispatcher, and if a method is not detected then it
	// can initialize a new albumist discography on an element.
	//

	$.fn.albumist = function(o, arg1) {

		if (o === "destroy") {
			this.each(function() {
				var instance = Albumist.getAlbumistInstance(this);
				if (instance) instance.destroy();
			});
			return this;
		}

		// Injects the albumist CSS into the page header programmatically
		// as scripts can appear in the body but CSS must be in the HEAD
		if (o === "injectcss") {
			var cssPath 
			if (!arg1)
			return this;
		}

		var opts = $.extend({ }, $.albumist.opts, o);

		this.filter("div").each(function() {
			var initialized = Albumist.getAlbumistInstance(this);

			if (!initialized) new Albumist($(this), opts);
			else {
				if (initialized) {
					_warn("Albumist: attempt to initialize a div that already has been initialized.");
				}
			}
		});
		return this;
	};


////////////////////////////////////////////////////////////////////////////////

	
	//
	// GLOBAL PLUGIN INITIALIZATION CODE
	//
	// This is the code that runs only once at plugin initialization.
	//

	$(function () {
		// nothing needed yet...
	});


////////////////////////////////////////////////////////////////////////////////


	//
	// EXPOSED API
	//	
	// We don't export anything to RequireJS and probably won't ever, as
	// all the necessary functionality is available on the jQuery global
	// plugin methodology as $(element).albumist({...options...})
	//

	return null;

		
}));
