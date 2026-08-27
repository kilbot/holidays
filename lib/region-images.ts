/**
 * The photograph for a place.
 *
 * The generated art in `lib/capsule-art.ts` was always a stand-in: honest,
 * derived from the entry's own facets, and — as the reader put it — generic.
 * A picture of Western Australia that could equally be South Australia tells
 * you nothing about either. So the places that carry the trip get a real
 * photograph of the thing you would actually go and look at: Nature's Window
 * for the Coral Coast, MONA for Hobart, the Twelve Apostles for Port Campbell.
 *
 * Three rules hold this file together, and they are the reason it is data
 * rather than a fetch:
 *
 * 1. **Every file is committed.** Nothing is hotlinked. A remote URL is a dead
 *    link waiting to happen and a hotlink ban waiting to be enforced, and
 *    neither is a thing to discover in front of a reader.
 * 2. **Every file carries its licence.** Source page, author, licence and
 *    licence URL, recorded per image from the file page itself rather than
 *    from a search result. An image whose licence could not be verified is not
 *    in this file.
 * 3. **The map is partial on purpose.** 52 regions and the 8 Adventures have a
 *    photograph; the rest of the Catalog's several hundred region strings do
 *    not, and those cards keep the generated scene. A wrong photograph of the
 *    wrong place would be worse than the honest abstraction it replaced.
 *
 * Attribution lives in two places: a caption line in the card's own image
 * strip, for the licences that require it, and the consolidated list on
 * /resources, which covers every use of every file on the site.
 */

/** One committed photograph, with everything its licence asks to be shown. */
export interface Photo {
  /** Public path of the committed file, e.g. "/img/regions/wa-perth.jpg". */
  file: string;
  /** What the photograph shows — the card's caption, and its alt text. */
  caption: string;
  author: string;
  /** "CC BY-SA 4.0", "CC0" — verbatim from the source file page. */
  licence: string;
  /** Empty for CC0 and public-domain files, which carry no deed URL. */
  licenceUrl: string;
  /** The file page the photograph came from. */
  source: string;
}

/**
 * Licences that ask for nothing.
 *
 * CC0 and public-domain files still get a caption and still appear in the
 * consolidated credits — crediting a photographer who did not demand it is
 * manners, not compliance — but they do not need the licence line stamped over
 * the picture, and leaving it off keeps the card quieter.
 */
const NO_ATTRIBUTION_REQUIRED = ["CC0", "Public domain"];

/** Whether this photograph's licence requires a visible credit on the card. */
export function needsAttribution(photo: Photo): boolean {
  return !NO_ATTRIBUTION_REQUIRED.some((free) => photo.licence.startsWith(free));
}

/**
 * One photograph per region, keyed by the Catalog's own region vocabulary.
 *
 * The key is a prefix of the region string rather than the whole of it: the
 * Catalog writes "WA \u2014 Coral Coast / Kalbarri" and "WA \u2014 Coral Coast /
 * Jurien Bay", and both are the Coral Coast. `regionPhoto` matches the longest
 * key that starts the string, so a more specific key always wins over a
 * broader one.
 */
export const REGION_PHOTOS: Record<string, Photo> = {
  "ACT — Canberra": {
    file: "/img/regions/act-canberra.jpg",
    caption: "Parliament House and the Canberra axis from above",
    author: "Malcolm Tredinnick",
    licence: "CC BY 2.0",
    licenceUrl: "https://creativecommons.org/licenses/by/2.0",
    source: "https://commons.wikimedia.org/wiki/File:Parliament_House_Canberra_from_above.jpg",
  },
  "NSW — Blue Mountains": {
    file: "/img/regions/nsw-blue-mountains.jpg",
    caption: "The Three Sisters, Katoomba",
    author: "Stu's Images",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Three_Sisters,_Katoomba,_NSW.jpg",
  },
  "NSW — Coffs Coast": {
    file: "/img/regions/nsw-coffs-coast.jpg",
    caption: "The Glade Walk, Dorrigo National Park",
    author: "Harryp2",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Glade_Walk,_Dorrigo_National_Park,_Gondwana_Rainforests_of_Australia.jpg",
  },
  "NSW — Hunter": {
    file: "/img/regions/nsw-hunter.jpg",
    caption: "Vineyards in the Hunter Valley at first light",
    author: "Christopher Wood",
    licence: "CC BY-SA 3.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    source: "https://commons.wikimedia.org/wiki/File:The_view_of_the_vineyards_from_the_Hermitage_Hideaway_-_Taken_on_the_Saturday,_3rd_February_2007_at_7-49am._-_panoramio.jpg",
  },
  "NSW — Illawarra": {
    file: "/img/regions/nsw-illawarra.jpg",
    caption: "The Sea Cliff Bridge, Illawarra",
    author: "Bernard Spragg. NZ",
    licence: "CC0",
    licenceUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    source: "https://commons.wikimedia.org/wiki/File:The_Sea_Cliff_Bridge._NSW_Aust._(21016079739).jpg",
  },
  "NSW — Northern Rivers": {
    file: "/img/regions/nsw-northern-rivers.jpg",
    caption: "Minyon Falls, Nightcap National Park",
    author: "LivinginNSW",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Minyon_falls_in_NSW.jpg",
  },
  "NSW — Snowy Mountains": {
    file: "/img/regions/nsw-snowy-mountains.jpg",
    caption: "Blue Lake from the Main Range Track, Kosciuszko",
    author: "Dhx1",
    licence: "CC0",
    licenceUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    source: "https://commons.wikimedia.org/wiki/File:Main_Range_Track,_Kosciuszko_National_Park_45.jpg",
  },
  "NSW — South Coast": {
    file: "/img/regions/nsw-south-coast.jpg",
    caption: "Hyams Beach, Jervis Bay",
    author: "Charliekay",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Hyams_Beach._Booderee_National_Park_%26_Jervis_Bay_Marine_Park.jpg",
  },
  "NSW — Sydney": {
    file: "/img/regions/nsw-sydney.jpg",
    caption: "Bondi Beach from above",
    author: "Maksym Kozlenko",
    licence: "CC BY-SA 3.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    source: "https://commons.wikimedia.org/wiki/File:Bondi_Beach_from_above.jpg",
  },
  "NT — Central Australia": {
    file: "/img/regions/nt-central-australia.jpg",
    caption: "Ormiston Gorge, West MacDonnell Ranges",
    author: "DaHuzyBru",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Ormiston_Gorge,_October_2025_26.jpg",
  },
  "NT — Katherine": {
    file: "/img/regions/nt-katherine.jpg",
    caption: "Early morning in Nitmiluk (Katherine) Gorge",
    author: "ChristinaStorey",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Early_morning_at_Nitmiluk_(Katherine)_Gorge.jpg",
  },
  "NT — Red Centre": {
    file: "/img/regions/nt-red-centre.jpg",
    caption: "Uluru, Uluru-Kata Tjuta National Park",
    author: "Dietmar Rabich",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Petermann_Ranges_(AU),_Uluru-Kata_Tjuta_National_Park,_Uluru_--_2019_--_3701.jpg",
  },
  "NT — Top End": {
    file: "/img/regions/nt-top-end.jpg",
    caption: "Jim Jim Creek, Kakadu National Park",
    author: "Dietmar Rabich",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Kakadu_(AU),_Kakadu_National_Park,_Jim_Jim_Creek_--_2019_--_4239.jpg",
  },
  "QLD — Atherton Tablelands": {
    file: "/img/regions/qld-atherton-tablelands.jpg",
    caption: "Millaa Millaa Falls, Atherton Tablelands",
    author: "Hagai Agmon-Snir حچاي اچمون-سنير חגי אגמון-שניר",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:MillaaMillaaFallsOct272024_02.jpg",
  },
  "QLD — Brisbane": {
    file: "/img/regions/qld-brisbane.jpg",
    caption: "The Story Bridge and the Brisbane CBD",
    author: "Kgbo",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Story_Bridge,_Brisbane_City_views,_2021,_02.jpg",
  },
  "QLD — Cairns": {
    file: "/img/regions/qld-cairns.jpg",
    caption: "Barron Falls, Barron Gorge National Park",
    author: "zpunout",
    licence: "CC BY-SA 3.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    source: "https://commons.wikimedia.org/wiki/File:Barron_Falls,_Kuranda,_Queensland,_Australia_-_panoramio.jpg",
  },
  "QLD — Fraser Coast": {
    file: "/img/regions/qld-fraser-coast.jpg",
    caption: "Lake McKenzie, K'gari",
    author: "Iraphne R. Childs",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Lake_McKenzie,_K%27gari_(Fraser_Island)_1990_QUT-475.jpg",
  },
  "QLD — Gold Coast": {
    file: "/img/regions/qld-gold-coast.jpg",
    caption: "Surfers Paradise beach and skyline",
    author: "Bernard Spragg. NZ",
    licence: "CC0",
    licenceUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    source: "https://commons.wikimedia.org/wiki/File:Surfers_Paradise_Beach_with_skyline.jpg",
  },
  "QLD — Gold Coast hinterland": {
    file: "/img/regions/qld-gold-coast-hinterland.jpg",
    caption: "Natural Bridge, Springbrook National Park",
    author: "Aliceinthealice",
    licence: "CC0",
    licenceUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    source: "https://commons.wikimedia.org/wiki/File:Natural_Bridge,_Springbrook_National_Park_14.jpg",
  },
  "QLD — Moreton Bay": {
    file: "/img/regions/qld-moreton-bay.jpg",
    caption: "Point Lookout, Minjerribah / North Stradbroke Island",
    author: "S. Newrick",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:View_of_Main_Beach_from_Point_Lookout_(North_Stradbroke_Island).JPG",
  },
  "QLD — Sunshine Coast": {
    file: "/img/regions/qld-sunshine-coast.jpg",
    caption: "Hell's Gates, Noosa National Park",
    author: "Pezoporus wallicus",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Hell%E2%80%99s_Gates_in_Noosa_National_Park.jpg",
  },
  "QLD — Sunshine Coast hinterland": {
    file: "/img/regions/qld-sunshine-coast-hinterland.jpg",
    caption: "The Glass House Mountains",
    author: "Alandean88",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Glass_House_Mountains,_Queensland,_Australia.jpg",
  },
  "QLD — Townsville": {
    file: "/img/regions/qld-townsville.jpg",
    caption: "Horseshoe Bay, Magnetic Island",
    author: "Joshua Tagicakibau",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Horseshoe_Bay_Beach,_Magnetic_Island.jpg",
  },
  "QLD — Whitsundays": {
    file: "/img/regions/qld-whitsundays.jpg",
    caption: "Hill Inlet at the north end of Whitehaven Beach",
    author: "Isderion",
    licence: "CC BY-SA 3.0 de",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0/de/deed.en",
    source: "https://commons.wikimedia.org/wiki/File:Hill_Inlet_at_the_end_of_Whitehaven_Beach_in_the_Whitsundays.JPG",
  },
  "SA — Adelaide": {
    file: "/img/regions/sa-adelaide.jpg",
    caption: "The Adelaide skyline across the River Torrens",
    author: "Yu Chu Chin",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Adelaide_CBD_skyline_across_the_River_Torrens,_July_2026_(028A8462).jpg",
  },
  "SA — Barossa": {
    file: "/img/regions/sa-barossa.jpg",
    caption: "The Barossa Valley from Mengler Hill",
    author: "DXR",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:View_of_Barossa_Valley_from_Mengler_Hill_20230207.jpg",
  },
  "SA — Eyre Peninsula": {
    file: "/img/regions/sa-eyre-peninsula.jpg",
    caption: "Full moon over Boston Bay, Port Lincoln",
    author: "Jacqui Barker",
    licence: "CC BY 2.0",
    licenceUrl: "https://creativecommons.org/licenses/by/2.0",
    source: "https://commons.wikimedia.org/wiki/File:Full_Moon_-_Boston_Bay,_Port_Lincoln_-_South_Australia.jpg",
  },
  "SA — Flinders Ranges": {
    file: "/img/regions/sa-flinders-ranges.jpg",
    caption: "Rawnsley Bluff on the southern rim of Wilpena Pound",
    author: "DXR",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Rawnsley_Bluff,_Flinders_Ranges,_South_view_20230211_1.jpg",
  },
  "SA — Kangaroo Island": {
    file: "/img/regions/sa-kangaroo-island.jpg",
    caption: "Remarkable Rocks, Flinders Chase, Kangaroo Island",
    author: "Bernard Gagnon",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Remarkable_Rocks_02.jpg",
  },
  "SA — Limestone Coast": {
    file: "/img/regions/sa-limestone-coast.jpg",
    caption: "The Umpherston Sinkhole, Mount Gambier",
    author: "Satellizer",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Umpherston_Sinkhole,_Mount_Gambier,_November_2018.jpg",
  },
  "SA — Yorke Peninsula": {
    file: "/img/regions/sa-yorke-peninsula.jpg",
    caption: "West Cape, Dhilba Guuranda-Innes National Park",
    author: "MeraVagahau",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:View_from_West_Cape,_Innes_National_Park_South_Australia.jpg",
  },
  "TAS — Central Highlands": {
    file: "/img/regions/tas-central-highlands.jpg",
    caption: "Cradle Mountain over Dove Lake",
    author: "BennyG3255",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Cradle_Mountain_over_Dove_Lake,_Tasmania.jpg",
  },
  "TAS — East Coast": {
    file: "/img/regions/tas-east-coast.jpg",
    caption: "Orange lichen granite at the Bay of Fires",
    author: "Wanderlust aus",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Bay_of_fires_RL_003.jpg",
  },
  "TAS — Hobart": {
    file: "/img/regions/tas-hobart.jpg",
    caption: "MONA, the Museum of Old and New Art, on the Derwent",
    author: "Michael Coghlan",
    licence: "CC BY-SA 2.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/2.0",
    source: "https://commons.wikimedia.org/wiki/File:Museum_on_the_Derwent_MONA_2023.jpg",
  },
  "TAS — Launceston": {
    file: "/img/regions/tas-launceston.jpg",
    caption: "Cataract Gorge, Launceston",
    author: "Mattinbgn",
    licence: "CC BY 3.0",
    licenceUrl: "https://creativecommons.org/licenses/by/3.0",
    source: "https://commons.wikimedia.org/wiki/File:Launceston_Cataract_Gorge_005.JPG",
  },
  "TAS — Tasman Peninsula": {
    file: "/img/regions/tas-tasman-peninsula.jpg",
    caption: "The dolerite columns of Cape Raoul",
    author: "JERRYE & ROY KLOTZ MD",
    licence: "CC BY-SA 3.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    source: "https://commons.wikimedia.org/wiki/File:CAPE_RAOUL_-_TASMAN_NATIONAL_PARK.jpg",
  },
  "VIC — Goldfields": {
    file: "/img/regions/vic-goldfields.jpg",
    caption: "Main Street, Sovereign Hill, Ballarat",
    author: "Mike Lehmann, Mike Switzerland",
    licence: "CC BY-SA 3.0",
    licenceUrl: "http://creativecommons.org/licenses/by-sa/3.0/",
    source: "https://commons.wikimedia.org/wiki/File:Sovereign_Hill_-_Main_Street_shops_10-12.jpg",
  },
  "VIC — Great Otway NP": {
    file: "/img/regions/vic-great-otway.jpg",
    caption: "Cape Otway Lighthouse above the Southern Ocean",
    author: "Dietmar Rabich",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Cape_Otway_(AU),_Cape_Otway_Lighthouse_--_2019_--_1186.jpg",
  },
  "VIC — Melbourne": {
    file: "/img/regions/vic-melbourne.jpg",
    caption: "The Melbourne skyline over the Yarra",
    author: "Donaldytong",
    licence: "CC BY-SA 3.0",
    licenceUrl: "http://creativecommons.org/licenses/by-sa/3.0/",
    source: "https://commons.wikimedia.org/wiki/File:Melbourne_Yarra_River.jpg",
  },
  "VIC — Mornington Peninsula": {
    file: "/img/regions/vic-mornington-peninsula.jpg",
    caption: "The view from Cape Schanck Lighthouse",
    author: "JML1148",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:View_from_Cape_Schanck_Lighthouse.jpg",
  },
  "VIC — Moyston": {
    file: "/img/regions/vic-grampians.jpg",
    caption: "Halls Gap and the Grampians from Boroka Lookout",
    author: "Peter Trenchard",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:View_over_Halls_Gap,_Grampians,_from_Boroka_Lookout.jpg",
  },
  "VIC — Port Campbell NP": {
    file: "/img/regions/vic-port-campbell.jpg",
    caption: "The Twelve Apostles, Port Campbell National Park",
    author: "Dietmar Rabich",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Princetown_(AU),_Port_Campbell_National_Park,_Twelve_Apostles_--_2019_--_1017.jpg",
  },
  "VIC — South Gippsland": {
    file: "/img/regions/vic-south-gippsland.jpg",
    caption: "Squeaky Beach, Wilsons Promontory",
    author: "Dietmar Rabich",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Wilsons_Promontory_National_Park_(AU),_Squeaky_Beach_--_2019_--_1644.jpg",
  },
  "VIC — Surf Coast": {
    file: "/img/regions/vic-surf-coast.jpg",
    caption: "Bells Beach on the Surf Coast",
    author: "Michael J Fromholtz",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Bells_Beach_2019.jpg",
  },
  "VIC — Yarra Valley": {
    file: "/img/regions/vic-yarra-valley.jpg",
    caption: "Vine rows in the Yarra Valley",
    author: "MusikAnimal",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Rochford_Wines_vineyard_in_Yarra_Valley_Australia.jpg",
  },
  "WA — Coral Coast": {
    file: "/img/regions/wa-coral-coast.jpg",
    caption: "Nature's Window, Kalbarri National Park",
    author: "Bojan von Känel",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Kalbarri_National_Park_Natures_Window.jpg",
  },
  "WA — Esperance": {
    file: "/img/regions/wa-esperance.jpg",
    caption: "Lucky Bay, Cape Le Grand National Park",
    author: "DaHuzyBru",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Lucky_Bay,_Cape_Le_Grand_National_Park,_January_2025_02.jpg",
  },
  "WA — Gascoyne": {
    file: "/img/regions/wa-gascoyne.jpg",
    caption: "Shell Beach, Shark Bay",
    author: "Calistemon",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Shell_Beach,_Shark_Bay,_July_2020_04.jpg",
  },
  "WA — Great Southern": {
    file: "/img/regions/wa-great-southern.jpg",
    caption: "The Gap, Torndirrup National Park near Albany",
    author: "Calistemon",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:The_Gap,_Torndirrup_National_Park,_April_2022_03.jpg",
  },
  "WA — Kimberley": {
    file: "/img/regions/wa-kimberley.jpg",
    caption: "The Bungle Bungle Range, Purnululu National Park",
    author: "Emily Cox",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:The_Bungle_Bungles,_Purnululu_National_Park.jpg",
  },
  "WA — Perth": {
    file: "/img/regions/wa-perth.jpg",
    caption: "The Perth skyline seen from Kings Park",
    author: "Calistemon",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Skyline_of_Perth_seen_from_Kings_Park,_October_2023_01.jpg",
  },
  "WA — South West": {
    file: "/img/regions/wa-south-west.jpg",
    caption: "Busselton Jetty running out into Geographe Bay",
    author: "W. Bulach",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:00_1701_Busselton_Jetty_-_Western_Australia.jpg",
  },
};

/** One photograph per researched Adventure, keyed by its Capsule id. */
export const ADVENTURE_PHOTOS: Record<string, Photo> = {
  "byron-nimbin": {
    file: "/img/adventures/byron-nimbin.jpg",
    caption: "Cape Byron Lighthouse",
    author: "Bernard Spragg. NZ",
    licence: "CC0",
    licenceUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    source: "https://commons.wikimedia.org/wiki/File:Cape_Byron_Lighthouse._(9574800112).jpg",
  },
  "fnq-wildlife": {
    file: "/img/adventures/fnq-wildlife.jpg",
    caption: "Daintree rainforest canopy",
    author: "rheins",
    licence: "CC BY 3.0",
    licenceUrl: "https://creativecommons.org/licenses/by/3.0",
    source: "https://commons.wikimedia.org/wiki/File:Daintree_Rainforest_-_2013.04_-_panoramio.jpg",
  },
  "gbr-port-douglas": {
    file: "/img/adventures/gbr-port-douglas.jpg",
    caption: "A coral outcrop on Flynn Reef, off Cairns",
    author: "Toby Hudson",
    licence: "CC BY-SA 3.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    source: "https://commons.wikimedia.org/wiki/File:Coral_Outcrop_Flynn_Reef.jpg",
  },
  "margaret-river": {
    file: "/img/adventures/margaret-river.jpg",
    caption: "Vines at Watershed, Margaret River",
    author: "Lasthib",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:2016_Margaret_River_Australia._Watershed_vineyard.jpg",
  },
  "melbourne-party": {
    file: "/img/adventures/melbourne-party.jpg",
    caption: "Hosier Lane, Melbourne",
    author: "Bernard Spragg. NZ",
    licence: "CC0",
    licenceUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    source: "https://commons.wikimedia.org/wiki/File:Hosier_Lane_Street_Art_Melbourne.jpg",
  },
  "rottnest-island": {
    file: "/img/adventures/rottnest-island.jpg",
    caption: "Golden hour at The Basin, Rottnest Island",
    author: "Matthew.crompton",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Golden_Hour_at_the_Basin_-_Rottnest_Island.jpg",
  },
  "sydney-nye": {
    file: "/img/adventures/sydney-nye.jpg",
    caption: "Sydney Harbour at dusk, Opera House and Bridge",
    author: "Benh LIEU SONG ( Flickr )",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "https://commons.wikimedia.org/wiki/File:Sydney_Opera_House_and_Harbour_Bridge_Dusk_(2)_2019-06-21.jpg",
  },
  "tasmania-arc": {
    file: "/img/adventures/tasmania-arc.jpg",
    caption: "Wineglass Bay from the Freycinet lookout",
    author: "JJ Harrison",
    licence: "CC BY-SA 3.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    source: "https://commons.wikimedia.org/wiki/File:Wineglass_Bay_from_Lookout.jpg",
  },
};

/**
 * Region strings that name a place another key already covers.
 *
 * Deliberately tiny. An alias asserts that two labels are the same place, and
 * the cost of getting that wrong is a photograph of somewhere else.
 */
const REGION_ALIASES: Record<string, string> = {
  "QLD — Woodfordia / Sunshine Coast hinterland": "QLD — Sunshine Coast hinterland",
  "SA — Northern Flinders": "SA — Flinders Ranges",
};

/**
 * Region keys, longest first.
 *
 * Sorted once at module load so the lookup below can stop at its first hit and
 * still be the *most specific* hit — "QLD — Gold Coast hinterland" has to be
 * tried before "QLD — Gold Coast", or the hinterland gets a beach.
 */
const KEYS_BY_LENGTH = Object.keys(REGION_PHOTOS).sort(
  (a, b) => b.length - a.length,
);

/** The photograph for a Catalog region string, or nothing if none maps. */
export function regionPhoto(region: string): Photo | undefined {
  const aliased = REGION_ALIASES[region];
  if (aliased) return REGION_PHOTOS[aliased];
  for (const key of KEYS_BY_LENGTH) {
    if (region.startsWith(key)) return REGION_PHOTOS[key];
  }
  return undefined;
}

/**
 * The photograph for one card.
 *
 * An Adventure's own shot wins over its region's: the Margaret River Capsule
 * is about the vines, and the surrounding South West is about the jetty at
 * Busselton. Everything else falls back to the region, and a card with no
 * photograph at all keeps the generated scene — that is the fallback, not an
 * error.
 */
export function photoFor(input: { id: string; region: string }): Photo | undefined {
  return ADVENTURE_PHOTOS[input.id] ?? regionPhoto(input.region);
}

/**
 * Every photograph on the site, once each, for the credits list on /resources.
 *
 * Sorted by caption rather than by key so the list reads as a set of places
 * instead of a dump of the two records above.
 */
export function allPhotos(): Photo[] {
  return [...Object.values(REGION_PHOTOS), ...Object.values(ADVENTURE_PHOTOS)].sort(
    (a, b) => a.caption.localeCompare(b.caption),
  );
}
