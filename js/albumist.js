//
// albumist.js
// Copyright (C) 2008 HostileFork.com
//
// This script was released September 24th 2008, and was more or less my
// first JavaScript program.  It was written to be embedded in a Joomla 1.5
// website, which used mootools.  
//
// It was initially conceived as a tool which could help the
// Legendary Pink Dots manage their large discography on their website:
//
// http://en.wikipedia.org/wiki/The_Legendary_Pink_Dots
//
// The goal was to let fans use publicly-editable databases.  The most
// structured and advanced one with an API I knew of at the time was Freebase,
// which was synchronized to MusicBrainz but had a more flexible graph API
// and decent editing facilities for a Wikipedia-like experience.  I also
// added LyricWiki support in the "mash up" to drill down into song lyrics
// if they were available.
//
// That was 6 years ago, today it's 2014.  In the meantime:
//
// * Joomla has undergone many versions and now deprecates mootools for jQuery
//
// * Freebase was acquired by Google and now won't allow adding new cover art
//   (and has seemingly abandoned the user-friendly editing DB to be a
//    somewhat internal tool)
//
// * LyricWiki somehow decided that even a band that is willing to have their
//   lyrics offered on a wiki that a blanket agreement with record labels to
//   offer only excerpts for independent artists is okay-by-them
//
// Not super-optimism-inducing for the future.  Thanks everyone!  I'll go play
// "The Hardest Part" by Coldplay a few times now...
//
// But on a less depressing note, I've picked up some jQuery, and the
// MusicBrainz project has been collaborating with the Internet Archive to
// curate freely available cover art.  The skeletal work to use that is now
// in place, and I also ripped out mootools to try and throw some jQuery
// and better web-fu into my "I didn't know anything about this stuff" first
// attempt.
//
// In any case, just mentioning my ire as I push some hodgepodge code into the
// repository in the hopes of getting it updated and back on the website.
//
// Project Homepage: http://albumist.hostilefork.com
//

// Main namespace, see http://userjs.org/help/tutorials/avoiding-conflicts
// REVIEW: new practice as a jQuery plugin would not be to have this
var Albumist = {};

// Whole-script strict mode syntax
"use strict";


////////////////////////////////////////////////////////////////////////////////

	// REQUIREJS AND MODULE PATTERN FOR WIDGET
	//
	// Basic structure borrowed from:
	//
	// https://github.com/bgrins/ExpandingTextareas

(function(factory) {
	// Add jQuery via AMD registration or browser globals
	if (typeof define === 'function' && define.amd) {
		define([ 'jquery'], factory);
	} else {
		factory(jQuery);
	}
}(function ($) {

	var cssWasInjected = false;

	
///////////////////////////////////////////////////////////////////////////////
// FREEBASE INTERFACE CODE
///////////////////////////////////////////////////////////////////////////////
	
	var Metaweb = {

		// The Metaweb server
		HOST: "https://www.googleapis.com",

		// The service on that server
		QUERY_SERVICE: "/freebase/v1/mqlread",
		
		// Send query q to Metaweb, pass result asynchronously to function f
		read: function(q, f) {

			// Serialize and encode the query object
			var querytext = encodeURIComponent(JSON.stringify(q));
		
			// Build the URL using encoded query text and the callback name
			var url = Metaweb.HOST + Metaweb.QUERY_SERVICE +  
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
			       alert("query failure");
			    }
			});	
		},
		
		// A utility function to return the year portion Metaweb /type/datetime
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

	 	// Helper function for matching arrays the user has specified which are 
	 	// supposed to specify objects for certain Freebase ids or mids
		matchEntryByFreebaseIdOrMid: function(result, entryList) {
			if (!entryList) {
				return null;
			}
			for (var entryIndex = 0; entryIndex < entryList.length; entryIndex++) {
				if (!result.mid && !result.id) {
					alert("Freebase ID or MID required in query for MatchEntryByFreebaseIdOrMid");
				}
				var entry = entryList[entryIndex];
				if ((entry.id && (entry.id == result.id)) || (entry.mid && (entry.mid == result.mid))) {
					return entry;
				}
			} 
			return null;
		},

	};


///////////////////////////////////////////////////////////////////////////////
// LYRICWIKI.ORG INTERFACE
///////////////////////////////////////////////////////////////////////////////

	// Try to guess LyricWiki page name from track name, but support the
	// ability to manually override via the config
	//
	//	http://lyricwiki.org/LyricWiki:Page_names
	function formatStringForLyricWiki(str) {
		var result = "";
		var startOfWord = true;
		var i = 0;
		for(i = 0; i < str.length; i++) {
			var cur = str.substring(i, i+1).toLowerCase();
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
				// Hm, what if the song name was "Joe&Me" with no spaces?
				// This makes Joe&me.
				startOfWord = false; 
				result += cur;
			}
		}
		return result;
	}
	function formatBandNameForLyricWiki(bandName, config) {
		if (config.bandNameOnLyricWiki) {
			return config.bandNameOnLyricWiki;
		} else {
			return formatStringForLyricWiki(bandName);
		}
	}
	function formatTrackNameForLyricWiki(track, config) {
		// I am not sure why on Firefox config.trackNamesOnLyricWiki
		// is generating a "trackNamesOnLyricWiki is undefined".  Works
		// in other browsers, and the notations are supposed to be 
		// equivalent.  I think it is a bug in Firefox.
		var propertyString = "trackNamesOnLyricWiki";
		var trackObject = Metaweb.matchEntryByFreebaseIdOrMid(track, config[propertyString]);
		if (trackObject) {
			return trackObject.name;
		}
		// If no exception made, just use the default
		return formatStringForLyricWiki(track.name);
	}
	
	// URL to view lyrics, e.g. http://lyricwiki.org/Michael_Penn:Walter_Reed
	function getViewUrlForLyricWiki(bandName, track, config) {
		var bandNameOnLyricWiki = formatBandNameForLyricWiki(bandName, config);
		var trackNameOnLyricWiki = formatTrackNameForLyricWiki(track, config); 
		return ('http://lyricwiki.org/' + 
			encodeURIComponent(bandNameOnLyricWiki) + ':' +
			encodeURIComponent(trackNameOnLyricWiki)
		);	
	}
	
	// URL to edit lyrics
	// e.g. http://lyricwiki.org/index.php?title=A-Ha:Analogue_%28All_I_Want%29&action=edit
	function getEditUrlForLyricWiki(bandName, track, config) {

		var bandNameOnLyricWiki = formatBandNameForLyricWiki(bandName, config);

		var trackNameOnLyricWiki = formatTrackNameForLyricWiki(track, config); 

		return ('http://lyricwiki.org/index.php?title=' +
			encodeURIComponent(bandNameOnLyricWiki) + 
			':' +
			encodeURIComponent(trackNameOnLyricWiki) +
			'&action=edit'
		);
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

		var bandNameOnLyricWiki = formatBandNameForLyricWiki(bandName, config);

		var trackNameOnLyricWiki = formatTrackNameForLyricWiki(track, config); 

		var url = ("http://lyricwiki.org/api.php?artist=" + 
			encodeURIComponent(bandNameOnLyricWiki) + "&song=" + 
			encodeURIComponent(trackNameOnLyricWiki) + "&fmt=json"
		);
		
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

	function getImagePath(config) {
		if (config.imagePath) {
			return config.imagePath;
		}
		return config.basePath + "images/";
	}

	function getCssPath(config) {
		if (config.cssPath) {
			return config.cssPath
		}
		return config.basePath + "css/";
	}
	
	// This is the core openAlbum function
	// Each Albumist instance on the page must have its own specialization of this function
	function openAlbumCore(id, config, cache) {

		// We should probably create the modal box here and have a "Loading..."
		// However SimpleModal is unable to dynamically size content, so
		// creating the box while we're waiting for the data to fetch would
		// involve additional work.  Not impossible, just trying to get the
		// basics done first:
		//
		// http://stackoverflow.com/questions/1407059/

		// This is the MQL query we will issue
		// should some of these properties come from the config or cache?
		var query = {
			type: "/music/album",
			id: id,
			mid: null, // machine ID (basically like a GUID)
			name: null,
			release_date: null,
			artist: null,
            releases: [{
            	id: null,
            	release_date: null,
            	track_list: [{
            		id: null,
            		name: null,
            		track_number: null,
            		length: null
            	}]
           	}],
		};
		
		var processTracklistResult = function(result) {
			if (result && result.releases) {
                var release = result.releases[0];
                var track_list = release.track_list;
				
				var $containerDiv = $('<div class="container">');

				var unavailableLink = (
					'http://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/' +
					'No_image_available.svg/' + config.coverEdgeSize + 'px-No_image_available.svg.png'
				);
				
				var $detailsDiv = $('<div class="details"></div>');

				var $coverImg = $("<img></img>", {
					width: config.coverEdgeSize,
					height: config.coverEdgeSize
				});
				if (cache[id].musicbrainzId) {
				 	// http://api.jquery.com/error/
 					$coverImg.error(function() {
 						// just because there's a MusicBrainz ID doesn't mean
 						// there's artwork.  If we queried MusicBrainz directly
 						// instead of going through Freebase we might have
 						// enough info to not need this handler.
 						$(this).attr("src", unavailableLink);
 					}); 
					$coverImg.attr("src",
						'http://coverartarchive.org/release-group/' + cache[id].musicbrainzId + '/front'
					);
				} else {
					$coverImg.attr("src", unavailableLink);
				}

				$detailsDiv.append($coverImg);
				var $linksDiv = $("<div></div>");

				// There was a visit Freebase URL link but it was big
				/* var freebaseUrl = 'http://freebase.com/view' + result.id; */

				var buyObject = Metaweb.matchEntryByFreebaseIdOrMid(result, config.buyAlbums);
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
				var $albumTitleEl = $("<h2></h2>");
				var year = Metaweb.getYear(release.release_date);
				var text = result.name + (year?(" ["+year+"]"):""); // name+year
				$albumTitleEl.text(text);
				$headingEl.append($albumTitleEl);
				$tracksDiv.append($headingEl);

				var $tracksOl = $("<ol></ol>", {
					id: "vertical",
					class: "simple"
				});
				$tracksDiv.append($tracksOl);
				
				var collapsibles = [];
				var headings = [];
				
				// Build an array of track names + lengths
				$.each(track_list, function(i, track) {
					// Are track numbers ever not sequential to not use a 
					// numbered list?

					var $trackLi = $("<li></li>");
					var trackText = track.name;
					if (track.length) {
						trackText += " (" + Metaweb.toMinutesAndSeconds(track.length) + ")";  
					} 
					$trackLi.text(trackText);
					$tracksOl.append($trackLi);
				});

				$containerDiv.append($tracksDiv);

				var $modal_box = $("<div id='basic-modal'></div>");

				var $modal_content = $("<div class='simplemodal-data'></div>");
				$modal_content.append($containerDiv);	

				$modal_box.append($modal_content);

				$modal_box.modal({
					// "Fixed" means the box will scroll with the page instead
					// of float as you scroll it in the same location it was
					// when it popped up.

					fixed: false
				});
			}
			else {
				// If empty result display error message
				alert("failed to open");
			}
		};
		
		// Issue the query, invoke the nested function when the response arrives
		Metaweb.read(query, processTracklistResult);
	}


///////////////////////////////////////////////////////////////////////////////
// ALBUM GRID VIEW FUNCTIONALITY
///////////////////////////////////////////////////////////////////////////////

	// Main Display Routine
	// Calls Freebase to get the album list, and then a callback function builds the
	// table from the results
	// Derived from: http://www.freebase.com/view/mid/9202a8c04000641f800000000544e139#fig-albumlist2
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
			$('head').prepend($(
				'<link type="text/css" rel="stylesheet" href="' + 
				getCssPath() + 'albumist.css" media="screen">'
			));
			cssWasInjected = true;
		}
		
		// We save some things from our initial album query to be used later
		// (such as the image URL for an album)
		var cache = {};
		
		// Find the document elements we need to insert content into 
		var $albumlist = $("#" + element);
		$albumlist.addClass("albumist");

		var $loadingEl = $("<p><b><i>Loading...</i></b></p>");
		$albumlist.prepend($loadingEl);
		
		var query = {					  // This is our MQL query 
			type: "/music/artist",		 // Find a band
			name: bandName,					// With the specified name
			id: bandId,						// want the ID of the band to link to their Freebase page
			
			album: [{					  // We want to know about albums
				"/common/topic/image" : [{
					id: null,
					optional: true
				}],
				key: [{
					namespace: "/authority/musicbrainz",
					value: null
				}],
				
				id: null,
				mid: null,
				name: null, // Return album names
				release_date: null, // And release dates
				sort: "-release_date" // Order by release date, minus reverses the sort (newest first)
			}]
		};
				
		// This function is invoked when we get the result of our MQL query
		function buildAlbumTable(result) {		
			// If no result, the band was unknown.
			if (!result || !result.album) {
				$albumlist.html("<b><i>Unknown band: " + config.bandName ? config.bandName : config.bandId + "</i></b>");
				return;
			}
			
			// Otherwise, the result object matches our query object, 
			// but has album data filled in.  
			var albums = result.album;  // the array of album data
					 
			// Erase the "Loading..." message we displayed earlier
			var $tableEl = $("<table><tbody></tbody></table>");
			$loadingEl.replaceWith($tableEl);
			
			var $tbodyEl = $tableEl.find("tbody");

			var bandFreebaseURL = "http://www.freebase.com/view" + result.id;

			var $rowEl = null;
			// Loop through the albums, but we may omit some from the list; so
			// keep an index of albums we are actually using
			var albumIndex = 0;
			$.each(albums, function(rawAlbumIndex, album) {

				if (Metaweb.matchEntryByFreebaseIdOrMid(album, config.omitAlbums)) {
					return;
				}
				
				cache[album.id] = {};
				
				var musicbrainzId = album.key.length > 0 ? album.key[0].value : null;

				if (albumIndex % config.albumsPerRow === 0) {
					$rowEl = $("<tr></tr>");
					$tbodyEl.append($rowEl);
				}			

				// Can't inherit or put vertical-align on the row, must be on the cell
				// http://www.gtalbot.org/BrowserBugsSection/Opera9Bugs/VerticalAlignTableRow.html
				// Note: round width of column down to make all columns equal width and never exceed table size				
				var $columnEl = $('<td></td>');
				$rowEl.append($columnEl);
				
				var $albumDiv = $('<div class="album"></div>');

				var $pictureDiv = $('<div class="album-picture"></div>');

				var $pictureLink = $("<a></a>", {
					href: "http://www.freebase.com/view" + album.id,
					target: "_blank"
				});

				var $thumbImg = $("<img></img>", {
					width: config.thumbEdgeSize,
					height: config.thumbEdgeSize,
					border: 0
				});

				var unavailableLink = 
					"http://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/" +
					config.thumbEdgeSize + "px-No_image_available.svg.png";

				if (musicbrainzId === null) {
					$thumbImg.attr("src", unavailableLink);
 					cache[album.id].musicbrainzId = null;
				} else {
 					cache[album.id].musicbrainzId = musicbrainzId;

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
					   		/* 'http://ecx.images-amazon.com/images/I/31773C0MTBL.jpg' */
					   		'http://coverartarchive.org/release-group/' + musicbrainzId + '/front-250'
				   		);
				   	} else {
						// Freebase image links for old album covers still work,
						// but they are no longer accepting new covers. 					

				   		if (album["/common/topic/image"].length > 0) {
					  		$thumbImg.attr("src",
						   		'https://www.googleapis.com/freebase/v1/image' + album["/common/topic/image"][0].id + '?maxwidth=' + 2000 + '&maxheight=' + 2000
					   		);
					  	}
				   	}
				}
				
				var albumClickedListener = function(event) {
					openAlbumCore(album.id, config, cache);
				
					return false; // signal do NOT open window to freebase...
				};
				$thumbImg.click(albumClickedListener);
			
				$pictureLink.append($thumbImg);
				$pictureDiv.append($pictureLink);
				
				$albumDiv.append($pictureDiv);

				var $titleDiv = $('<div class="album-title"></div>');

				var $titleLink = $("<div>" + album.name + "</div>", {
					href: "http://www.freebase.com/view" + album.id,
					target: "_blank"
				});
				$titleDiv.append($titleLink);
				$albumDiv.append($titleDiv);
				
				$titleLink.click(albumClickedListener);

				var buyInfo = Metaweb.matchEntryByFreebaseIdOrMid(album, config.buyAlbums);
				if (buyInfo) {
					var $priceDiv = $('<div class="album-price"></div>');
					$priceDiv.html('<a href="' + buyInfo.link + '" target="_blank">BUY: ' + buyInfo.price + '</a>');
					$albumDiv.append($priceDiv);	
				}
				
				$columnEl.append($albumDiv);
				
			 	albumIndex++;
			});	
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
		this.bandNameOnLyricWiki = null;
		this.trackNamesOnLyricWiki = null;
		this.injectCss = true;
		this.basePath = "";
		this.imagePath = null; /* null means default to basePath + 'images/'; */
		this.cssPath = null; /* null means default to basePath + 'css/'; */
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

	// We don't export anything to AMD and probably won't ever, as it'll be
	// a jQuery plugin.
	return null;
		
}));
