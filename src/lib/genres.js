// Genres that people really use as tags. A tag from this list is trusted as soon as it shows up on two of the user's albums; any other tag
// (a label, a club, a typo, a scene) has to be much more common in the library before it is offered as a genre (see selectableTags).
// Written the way people write them; compared in the normalised form of normalizeTag (lower case, no spaces, dots, dashes or underscores).
const GENRES = [
  // rock and its neighbours
  'rock', 'indie', 'indie rock', 'indie pop', 'alternative', 'alt rock', 'alternative rock', 'post-rock', 'math rock', 'shoegaze', 'blackgaze',
  'dream pop', 'noise pop', 'jangle pop', 'jangle', 'power pop', 'lo-fi', 'lofi', 'bedroom pop', 'hypnagogic pop', 'garage rock', 'garage',
  'psychedelic', 'psych', 'psychedelic rock', 'psych rock', 'acid rock', 'neo-psychedelia', 'stoner rock', 'stoner', 'desert rock', 'hard rock',
  'progressive rock', 'prog', 'prog rock', 'art rock', 'krautrock', 'kosmische', 'berlin school', 'space rock', 'surf', 'surf rock', 'emo',
  'midwest emo', 'screamo', 'skramz', 'slowcore', 'sadcore', 'britpop', 'madchester', 'glam rock', 'glam', 'folk rock', 'country rock',
  'southern rock', 'blues rock', 'rockabilly', 'psychobilly', 'cowpunk', 'new wave', 'no wave', 'post-punk', 'post punk', 'art punk', 'coldwave',
  'cold wave', 'minimal wave', 'minimal synth', 'synthpop', 'synth pop', 'darkwave', 'dark wave', 'goth', 'gothic', 'gothic rock', 'deathrock',
  'death rock', 'batcave', 'ethereal', 'ethereal wave', 'neofolk', 'neo-folk', 'dark folk', 'apocalyptic folk', 'martial industrial',
  // punk and hardcore
  'punk', 'punk rock', 'hardcore', 'hardcore punk', 'post-hardcore', 'melodic hardcore', 'metallic hardcore', 'beatdown', 'pop punk', 'folk punk',
  'street punk', 'oi', 'skate punk', 'garage punk', 'crust', 'crust punk', 'd-beat', 'dbeat', 'grindcore', 'powerviolence', 'noisecore',
  'riot grrrl', 'ska', 'ska punk', 'rocksteady', 'two tone',
  // metal
  'metal', 'heavy metal', 'thrash', 'thrash metal', 'speed metal', 'power metal', 'death metal', 'black metal', 'doom', 'doom metal', 'funeral doom',
  'sludge', 'sludge metal', 'drone metal', 'post-metal', 'atmospheric black metal', 'folk metal', 'viking metal', 'symphonic metal', 'gothic metal',
  'progressive metal', 'prog metal', 'metalcore', 'deathcore', 'nu metal', 'industrial metal', 'groove metal', 'nwobhm', 'hair metal',
  'technical death metal', 'brutal death metal', 'melodic death metal', 'war metal', 'raw black metal', 'depressive black metal', 'dsbm',
  // electronic
  'electronic', 'electronica', 'electro', 'electroclash', 'electropop', 'techno', 'minimal techno', 'dub techno', 'detroit techno', 'acid techno',
  'hard techno', 'industrial techno', 'ambient techno', 'house', 'deep house', 'tech house', 'acid house', 'chicago house', 'progressive house',
  'afro house', 'electro house', 'french house', 'garage house', 'trance', 'psytrance', 'goa', 'goa trance', 'progressive trance', 'uplifting trance',
  'drum and bass', 'drum & bass', 'dnb', 'jungle', 'liquid', 'neurofunk', 'breakbeat', 'breaks', 'big beat', 'dubstep', 'brostep', 'riddim',
  'grime', 'uk garage', 'ukg', '2-step', 'bassline', 'bass', 'bass music', 'future bass', 'future garage', 'trap', 'idm', 'glitch',
  'downtempo', 'trip hop', 'trip-hop', 'triphop', 'chillout', 'chill out', 'lounge', 'footwork', 'juke', 'gabber', 'hardcore techno', 'hardstyle',
  'happy hardcore', 'speedcore', 'breakcore', 'rave', 'jungle terror', 'ebm', 'electronic body music', 'aggrotech', 'futurepop', 'industrial',
  'power electronics', 'rhythmic noise', 'death industrial', 'power noise', 'dark electro', 'harsh ebm', 'synthwave', 'retrowave', 'outrun',
  'darksynth', 'vaporwave', 'future funk', 'chillwave', 'witch house', 'dungeon synth', 'chiptune', '8-bit', 'bitpop', 'italo disco', 'italo',
  'hi-nrg', 'euro disco', 'disco', 'nu disco', 'boogie', 'post-disco', 'balearic', 'kuduro', 'amapiano', 'gqom', 'baile funk', 'funk carioca',
  'club', 'jersey club', 'baltimore club', 'ballroom', 'vogue', 'hyperpop', 'pc music', 'deconstructed club', 'leftfield', 'microhouse', 'minimal',
  'minimalism', 'ambient', 'dark ambient', 'drone', 'space ambient', 'ritual ambient', 'black ambient', 'isolationism', 'noise', 'harsh noise',
  'wall noise', 'experimental', 'avant-garde', 'avant garde', 'sound art', 'sound collage', 'field recording', 'field recordings', 'musique concrete',
  'electroacoustic', 'acousmatic', 'tape music', 'plunderphonics', 'free improvisation', 'improvisation', 'improv', 'post-industrial', 'industrial noise',
  // hip hop, r&b, soul, funk
  'hip hop', 'hip-hop', 'hiphop', 'rap', 'boom bap', 'underground hip hop', 'abstract hip hop', 'instrumental hip hop', 'lo-fi hip hop', 'cloud rap',
  'phonk', 'drill', 'uk drill', 'horrorcore', 'jazz rap', 'conscious hip hop', 'gangsta rap', 'trap metal', 'memphis rap', 'crunk', 'grime rap',
  'r&b', 'rnb', 'contemporary r&b', 'alternative r&b', 'soul', 'neo soul', 'northern soul', 'funk', 'p-funk', 'afrofunk', 'gospel', 'motown',
  // pop, folk, country, blues
  'pop', 'dance pop', 'synth-pop', 'art pop', 'chamber pop', 'baroque pop', 'sunshine pop', 'k-pop', 'kpop', 'j-pop', 'jpop', 'city pop', 'yacht rock',
  'singer-songwriter', 'singer songwriter', 'folk', 'indie folk', 'freak folk', 'psych folk', 'anti-folk', 'folktronica', 'americana', 'country',
  'alt-country', 'alt country', 'outlaw country', 'bluegrass', 'old time', 'appalachian', 'honky tonk', 'western', 'blues', 'delta blues', 'chicago blues',
  'electric blues', 'country blues', 'swing', 'big band', 'vocal', 'a cappella', 'acapella', 'choral', 'barbershop',
  // jazz
  'jazz', 'free jazz', 'spiritual jazz', 'jazz fusion', 'fusion', 'bebop', 'hard bop', 'cool jazz', 'modal jazz', 'avant-garde jazz', 'nu jazz',
  'acid jazz', 'smooth jazz', 'latin jazz', 'dark jazz', 'darkjazz', 'jazz funk', 'post-bop', 'gypsy jazz', 'dixieland', 'ragtime',
  // classical and scores
  'classical', 'contemporary classical', 'modern classical', 'neoclassical', 'neo-classical', 'baroque', 'romantic', 'opera', 'chamber music',
  'orchestral', 'piano', 'solo piano', 'string quartet', 'new music', 'soundtrack', 'score', 'film score', 'video game music', 'game music', 'ost',
  'library music', 'exotica', 'easy listening', 'lounge music', 'new age', 'meditation', 'healing', 'nature sounds', 'spoken word', 'poetry',
  // world and regional styles
  'world', 'world music', 'afrobeat', 'afrobeats', 'highlife', 'juju', 'mbalax', 'soukous', 'gnawa', 'rai', 'raï', 'ethio-jazz', 'ethiopiques',
  'reggae', 'dub', 'roots reggae', 'dancehall', 'ragga', 'lovers rock', 'soca', 'calypso', 'zouk', 'cumbia', 'tropical', 'latin', 'salsa', 'bachata',
  'merengue', 'reggaeton', 'dembow', 'bossa nova', 'mpb', 'samba', 'tropicalia', 'tropicália', 'forró', 'forro', 'sertanejo', 'choro', 'axé', 'axe',
  'pagode', 'brega', 'tecnobrega', 'tango', 'nueva cancion', 'flamenco', 'fado', 'rebetiko', 'klezmer', 'gypsy', 'balkan', 'turbo folk', 'polka',
  'celtic', 'irish folk', 'traditional', 'folklore', 'sufi', 'qawwali', 'bollywood', 'indian classical', 'raga', 'gamelan', 'enka', 'shoegaze',
  'comedy', 'children', 'kids', 'christmas', 'holiday', 'lullaby', 'worship', 'christian', 'ccm', 'religious',
];

const squash = (text) => String(text).toLowerCase().replace(/[\s._-]+/g, '');
const SET = new Set(GENRES.map(squash));

/** True when the (normalised) tag is a genre people really use. */
export const isKnownGenre = (key) => SET.has(squash(key));
