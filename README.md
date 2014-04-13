![Albumist logo](https://raw.github.com/hostilefork/albumist/master/albumist-logo.png)

Albumist is a jQuery plug-in, which lets you make a discography widget from cover art available through [MusicBrainz and the Internet Archive](http://blog.musicbrainz.org/2012/10/09/announcing-the-cover-art-archive/). It currently combines that with track listing information in [Freebase](http://freebase.com/), which mirrors and synchronizes with MusicBrainz. *(as the MusicBrainz API stabilizes, Albumist may be switch to use that directly instead)*

The idea was to give bands an easy way to offer an interactive discography on their own websites or blogs, without requiring them to maintain and curate a database.  It also allows for customization of the presentation--for instance adding "Buy Now" links.  The plug-in is open source and released under the [Creative Commons Attribution-Sharealike 4.0 License](http://creativecommons.org/licenses/by-sa/4.0/)

More information about the project is available at [http://albumist.hostilefork.com](http://albumist.hostilefork.com)

### USAGE

As with most jQuery plugins, you will need to create DIVs on your page where the widget will reside.  The CSS or style information should encode the width you want the widget to be:

    <div id="discography" style="width: 510px">
        <p><b>Loading discography... please wait...</b></p>
    </div>

Next, you invoke the `.albumist({...options...});` method on a jQuery selector for the divs you'd like to bring to life.  For instance, to initialize the above discography with information about the Legendary Pink Dots, the initialization might look like this:

    $("#discography").albumist({
          // FreeBase's MID, or unique ID for Legendary Pink Dots
          bandMid: "/m/02mmvr",

          // Size of the album thumbnails in the whole page grid
          thumbEdgeSize: 100,

          // Size of covers once an album is selected for detail view
          coverEdgeSize: 300,

          // Number of albums per row in the table
          albumsPerRow: 4,

          // List of album MIDs to omit if you don't want them in
          // Even temporarily (images not processed yet, etc)
          omitAlbums: [],

          // Simple "buy" linking facility
          buyAlbums: {
              // Chemical Playschool 15...
              "/m/0spgkk7": {
                  price: "12 EURO",
                  link: "http://www.rustblade.com/2012/chemical-playschool-15/"
              }
          }
        });

For a full description of the available options, see the comments in the demonstration HTML file [albumist-demo.html](https://github.com/hostilefork/albumist/blob/master/demo/albumist-demo.html).

### LICENSE

Creative Commons Licenses aren't exactly ideal for software projects.  But when Albumist was created in 2008, I felt it important that musicians who might be interested in the project be exposed to the *existence* of [Creative Commons](https://creativecommons.org/about).  It was an opportunity to bring up the talking point.

Six years later, I still feel that to be the case.  Although if you are working on something for which the licensing is a problem then please get in touch.  Most jQuery plugins are MIT-licensed, and if someone had a good reason why they thought Albumist should be released under MIT, I'd probably do it.
