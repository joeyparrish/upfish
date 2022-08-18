# UpFish

<img title="UpFish logo" src="upfish.svg" width="25%">

UpFish - Dynamically making fun of your movies.

![Install counter](https://upfish-session-counter.herokuapp.com/num-installs)
![Session counter](https://upfish-session-counter.herokuapp.com/num-sessions)


## What?

UpFish is a Chrome extension that allows you to modify the audio of your
streaming movies.  Out of the box, it offers the following configurations:

  - Perform a generic karaoke filter, which removes commonalities between left
    and right stereo channels, can remove most vocals from music
  - Turn "[Harry Potter and the Sorcerer's Stone][]" into
    "[Wizard People, Dear Reader][]", in which Harry and friends swear and
    drink a lot
  - Turn "[Vertigo][]" into "Fartigo", in which Jimmy Stewart farts a lot

[Harry Potter and the Sorcerer's Stone]: https://en.wikipedia.org/wiki/Harry_Potter_and_the_Philosopher%27s_Stone_(film)
[Wizard People, Dear Reader]: https://en.wikipedia.org/wiki/Wizard_People,_Dear_Reader
[Vertigo]: https://en.wikipedia.org/wiki/Vertigo_(film)


## Customization

The extension can also be customized, allowing you to create and publish your
own configuration files to adapt movies any way you want.  You can
independently control the volume of each audio channel of the input, customize
the mix of karaoke-filtered and original audio in stereo inputs, set different
processing for stereo and surround sound versions of a movie, add extra audio
tracks to be synchronized with the movie, and control the volume and mixing of
those extra inputs with the original audio channels.  For any volume control we
offer, you can adjust it dynamically over time, too.

For details on customization, see documentation on the config file format in
[docs/config.md](docs/config.md).


## License

UpFish is licensed under the GPL v3.

https://www.gnu.org/licenses/gpl-3.0.en.html


## Why is it called "UpFish"?

I wanted to name the project after something from "Wizard People, Dear Readers".
It turned out that the name "Viacom" was already taken, and the name
"Necrobenimbloalaphasagoso" was almost too long to tweet.


## Logo

The UpFish logo is based on:
 - "Fish Outline SVG Vector" https://www.svgrepo.com/svg/31355/fish-outline
 - By: "SVG Repo" https://www.svgrepo.com/
 - License: CC0 https://www.svgrepo.com/page/licensing


## Analytics & privacy

We will log the following data:

 - A count of the number of installations
 - A count of the number of sessions

_**No** personally identifiable information will be stored._

The count of installations and sessions is publicly visible as dynamic badge at
the top of this README.

If you do not with to participate in this, you can build the extension and
install it yourself.  Only the official version in the Chrome WebStore will
have analytics enabled.


## Building and installing from source

For instructions to build the extension from source, see
[docs/building.md](docs/building.md).
