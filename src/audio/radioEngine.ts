// The Narrows radio. Procedural, royalty-free music (Web Audio synth) + scripted
// host voices — real ElevenLabs VO when configured, else Web Speech (see vo.ts).
// No audio files, no copyright. Stations switch live; talk stations speak
// continuously, music stations drop DJ IDs between beds. Must be started from a
// user gesture (a station button) — handled by resuming the AudioContext.
import { speak, stopVO } from "./vo";
import { useStats } from "../game";
import { useGame } from "../store";

export interface Host {
  name: string;
  voice?: string;  // VO character key → ELEVENLABS_<KEY>_VOICE (e.g. "mike")
  prefs: string[]; // preferred speech-synthesis voice name fragments (fallback)
  rate: number;
  pitch: number;
  lines: string[];
}

export interface Station {
  id: string;
  dial: string;
  name: string;
  kind: "talk" | "music";
  host: Host;
  tempo: number; // bpm (music)
  root: number; // base freq (Hz)
  minor: boolean;
  prog: number[]; // chord roots (semitones from root)
  scale: number[]; // arp scale (semitones)
  talkGapMs: number; // pause between spoken lines
}

const PENT_MAJ = [0, 2, 4, 7, 9, 12];
const PENT_MIN = [0, 3, 5, 7, 10, 12];

export const STATIONS: Station[] = [
  {
    id: "whale", dial: "92.1", name: "WHALE", kind: "music",
    tempo: 112, root: 130.81, minor: false, prog: [0, -3, 5, 0], scale: PENT_MAJ, talkGapMs: 34000,
    host: {
      name: "Sully", voice: "sully", prefs: ["Daniel", "Google UK English Male", "Male"], rate: 1.0, pitch: 0.95,
      lines: [
        "WHALE ninety-two point one, the Whaling City's home for classic rock. Sully with ya.",
        "That one's been spinnin' since before the Braga Bridge needed a new coat of green.",
        "Comin' up, a triple shot — but first, keep her between the lines out on Route Eighteen.",
        "Salty air, loud guitars. This is WHALE.",
        "Sixty-one degrees down on the waterfront, fog burnin' off by noon. Beautiful day to do nothin'.",
        "Fishin' fleet's headed out past Palmer's Island — fair winds, fellas. Bring back the haddock.",
        "Dedication goin' out to the third shift at the mill. Hang in there, you're almost home.",
        "Word to the wise: the bridge tender's got her open for a tall mast, so Pope's Island's a parking lot. Sit back, turn it up.",
        "You're ridin' with Sully, and we do not, I repeat, do NOT take requests for disco. Not on this frequency.",
        "Car runnin' rough? Slide it down to the Anvil Garage on the waterfront — tell Sal that Sully sent ya.",
        "It's a long-hair, leather-jacket, windows-down kinda afternoon on the South Coast.",
        "Quick one for ya — last call at the Quohog Republic is whenever the owner falls asleep. Pace yourselves.",
        "We're commercial-free for the next forty minutes 'cause I forgot to cue the cart. You're welcome.",
        "Sun's goin' down over Clark's Cove, sky's the color of a bruised peach. Here's somethin' to match it.",
        "Big weekend ahead — cruise night down County Street, chrome for miles. Don't race past the church, the cops sit there.",
        "This next one goes to my ex-wife. She knows what she did.",
        "Crank it loud enough and you can't hear the rust forming on your Bronco. Science.",
        "Ninety-two point one — if your speakers ain't buzzin', you ain't doin' it right.",
        "Thunderstorm rollin' up Buzzards Bay later, so get the wash off the line, Ma.",
        "If you came of age in this city, you learned to drive on Route Eighteen and you learned to pray on the on-ramp. Amen.",
        "They don't make 'em like this anymore — the song OR the cars. Roll your window down, let the harbor hear it.",
        "Coffee milk and a honey-dipped down at the donut shop on Kempton. Breakfast of champions and night-shift welders.",
        "Somebody's Camaro is sittin' on the green light on Purchase Street starin' at his phone. It's not gonna get greener, pal.",
        "I played this exact record the night they lit the bridge for the bicentennial. We all looked good back then. Allegedly.",
        "Heat lightnin' out over the bay, no thunder, just the sky takin' pictures. Pretty as anything. Here's another.",
        "Forty years on this frequency and I still can't pronounce half the streets in the North End right. No offense, you know who you are.",
        "Gas is up, rent's up, the fish are down, but the radio's free — so we got that goin' for us. Crank it.",
        "Cruise night reminder: chrome is a lifestyle, not a hobby. And clean up your oil drips, the parish is watchin'.",
        "This one's for everybody stuck on the Fairhaven side waitin' on the swing bridge. Patience is a virtue. The bridge is not.",
        "Tide chart says low water at four-ten, so the clammers are out on the flats. Mind the mud, it don't let go.",
        "Somebody parked a boat trailer across two spots at the Pope's Island ramp. Pal, the whole ocean and you can't share a lot?",
        "This one's older than the cobblestones downtown and twice as hard on your suspension. Crank it.",
        "Got a fella out at the Pope's Island ramp tryin' to back a trailer in with an audience. We've all been that guy. Nobody honk.",
        "Forecast's sun then clouds then sun, which on the South Coast we just call 'Tuesday.' Here's a warm one regardless.",
        "I'll tell ya what ages a man — watchin' the gas sign flip another dime while you're sittin' at the light on Kempton.",
        "Somebody keyed a Trans Am out front of the station. To the artist responsible: I hope your clams are always sandy.",
        "Full moon over the bay tonight, tide's runnin' high. Romantic if you're into it, a parking problem if you're at the ramp.",
        "Played in three bands in this city and got fired from all three. That's how I ended up in here talkin' to you. Their loss.",
        "Reminder the swing bridge to Fairhaven is on the hour, so if you're cuttin' it close — you're not. Sit back, here's a long one.",
        "Forty years and the request line still rings at two a.m. with a guy who just wants to argue about drum solos. I love that guy.",
        "Cold front's pushin' through, gonna drop ten degrees by suppah. Grab a flannel, grab a cruller, let's ride.",
        "There's a seal haulin' out on the rocks by the barrier again. Leave him be — he pays less rent than any of us and he earned it.",
        "If your check-engine light's been on since the Clinton administration, the Anvil Garage will at least tell ya what it means. Probably everything.",
        "This is the kinda song they should pipe through the tunnel under Route Eighteen. Make the whole commute feel like a movie.",
        "Heard they're repavin' Acushnet Ave. I'll believe it when my axle stops singin' soprano. Here's somethin' smoother than that road.",
        "Shout to the night crew at the fish house — gutless work it ain't, and I mean that with respect. Stay warm down there.",
        "Whoever's been leavin' Dunkin cups on the seawall: the gulls thank you, the rest of us do not. Knock it off and turn this up.",
        "I met my second wife at a record swap on Union Street. Lost her at a different one. The vinyl, it giveth and it taketh.",
        "Low pressure comin', my knee says so, and my knee's never been wrong about weather or women. Here's a slow burner.",
        "Cruise night's lookin' clear, no rain, so wax the hood and pretend you don't see the rust around the wheel wells. We all pretend.",
        "Some kid just asked me what a B-side is. Son, sit down, this is gonna take the whole song. Here it goes.",
        "Harbor's flat as glass this evenin', sky goin' orange behind the Co-op. If you got a porch, this one's for the porch.",
        "Stay greasy, stay gold, South Coast. Sully's outta here — back tomorrow if the transmitter holds.",
      ],
    },
  },
  {
    id: "rage", dial: "1480", name: "The Rage", kind: "talk",
    tempo: 0, root: 0, minor: false, prog: [], scale: [], talkGapMs: 1400,
    host: {
      name: "Buddy Mello", voice: "buddy", prefs: ["Fred", "Google US English", "Male"], rate: 1.16, pitch: 1.0,
      lines: [
        "You're on The Rage with Buddy Mello, and let me TELL ya about the bridge this mornin'.",
        "Forty-five minutes. Forty-five! To go three miles. Somebody explain that to me.",
        "And the potholes — I hit one on Pleasant Street, I think my fillings are still rattlin'.",
        "Caller says lower the speed limit. Lower it? Buddy, we're already PARKED out here!",
        "Alright, alright. Clam roll for lunch. That's the only thing keepin' me sane today.",
        "This is the South Coast, folks. We don't pahk the cah — we sit in it. On the bridge.",
        "Line one, you're on the Rage. Sir — SIR — you cannot blame the seagulls for everything.",
        "They wanna put a parking meter on EVERY corner downtown. What is this, Boston? Get outta here.",
        "My brother-in-law says he caught a striper off the hurricane barrier THIS big. He's a liar. We all know it.",
        "Fourteen-eighty AM, the only station that says what you're all THINKIN' in traffic.",
        "Some genius left the Coggeshall Street bridge open for twenty minutes. Twenty! For one sailboat!",
        "You know what grinds my gears? People who don't wave when you let 'em merge. Where's the respect?",
        "Caller from Fairhaven says we never talk about Fairhaven. We're talkin' about it NOW, ya happy?",
        "The town wants to raise my taxes again. For what? The potholes are eatin' my Buick ALIVE.",
        "Hungry? Linguiça Linq is open all night — best chouriço and eggs this side of the Acushnet. Tell 'em Buddy sent ya, get nothin' off, but tell 'em anyway.",
        "I said it last week, I'll say it again: the rotary is not a SUGGESTION, people!",
        "We got Bobby on the line, he's been holdin' since the last commercial. Bobby, you still alive?",
        "Need a ride and your cah's in the shop again? Whaling City Cab. They'll find ya. Eventually.",
        "Nor'easter comin' Thursday, they say a foot. They ALWAYS say a foot. We'll get a dustin' and they'll close the schools anyway.",
        "A guy just told me parkin' downtown builds character. CHARACTER? I got plenty of character, what I need is a SPOT.",
        "They're chargin' eighteen dollars for a lobster roll on the waterfront. Eighteen! I remember when the lobster owed YOU money.",
        "Line three says the seagulls are organized now. Organized! Buddy, they been runnin' this city longer than the mayor.",
        "You ever notice the rotary's got a yield sign that everybody treats like a dare? It's a YIELD, not a coin toss!",
        "My nephew moved to Boston for 'opportunity.' Opportunity to sit in WORSE traffic. Genius. Runs in the family, clearly.",
        "Snow's comin' and you KNOW somebody's puttin' a lawn chair in the spot they shoveled. It's tradition. It's also a crime.",
        "Caller wants to know my favorite bridge. My favorite bridge is a CLOSED bridge, 'cause that means I'm already across it!",
        "They put up a new traffic camera on Coggeshall. Smile, everybody — the city found ANOTHER way into your wallet.",
        "Somebody double-parked the whole length of Acushnet Ave for a funeral. Out of respect I'll only honk a little.",
        "Half this town thinks the speed limit is a typo. The OTHER half is doin' twelve in the passin' lane. There's no winnin'!",
        "They closed off the historic district to cars again for some festival. Where am I supposed to drive, the HARBOR?",
        "Caller says the gulls stole his whole fish sandwich at the State Pier. Sir, that's not a crime, that's RENT.",
        "Now they built that big stone barrier across the harbor so we don't flood — and STILL my basement's wet. Explain THAT.",
        "Caller says I'm too negative. Negative? I'm a RAY of sunshine stuck in a town that paved over the sun. Next caller!",
        "They put in a roundabout to 'improve flow.' The only thing flowin' now is my blood pressure. Round and round we go!",
        "Guy emails me, says learn to relax. Pal, I relax plenty — right up until I hit Route Eighteen at quarter to eight.",
        "New restaurant downtown wants forty bucks for 'deconstructed' chowder. Deconstructed! That's called a MESS where I'm from.",
        "Line two's been on hold so long he forgot what he called about. Take your time, Walter, the bridge ain't movin' either.",
        "They wanna charge for parking at the BEACH now. The beach! God made it free, the city found a meter. Unbelievable.",
        "Somebody's car alarm's been goin' off on Union Street for an hour. Either fix it or let 'em take it, you're not helpin' anybody.",
        "My doctor says cut the salt. Doc, I live on a peninsula, the salt's in the AIR, what do you want from me?",
        "Caller from Acushnet says we forget Acushnet. Buddy, even Acushnet forgets Acushnet, don't take it personal.",
        "Gas station coffee went up a quarter. A QUARTER. For somethin' that tastes like the inside of a tackle box. Highway robbery.",
        "They're sayin' put bike lanes on Pleasant Street. There's no ROOM, the street's a hundred years old and so are half the drivers!",
        "Kid tells me his rent downtown is two grand. Two grand! For that I want a doorman AND a view of somethin' that ain't a parking lot.",
        "The DPW says they'll fix the streetlight 'in the queue.' I been IN the queue since the Bush administration. Which one? Yes.",
        "Somebody let their dog do its business right on the Riverwalk and just walked off. Sir, this is a SOCIETY, allegedly!",
        "They moved my polling place again. Now I gotta vote in a church basement that smells like nineteen-fifty-two. Democracy!",
        "Caller wants to defend the seagulls. DEFEND them? They took a man's whole calzone at the State Pier in broad daylight!",
        "Town hall meetin' ran four hours and they decided to schedule another meetin'. That's gov'ment, folks. Pure motion, zero distance.",
        "Snowbird neighbor's back from Florida braggin' about the weather. Then GO back, Arthur, nobody's holdin' your parka!",
        "They want my opinion on the new mural downtown. It's fine. It's paint. Can we PAINT a pothole shut while we're at it?",
        "Forty years on AM radio and the engineer STILL can't keep my mic level steady. Frank! FRANK! ...he's at lunch. Of course.",
        "That's the show. Be good to each other, and for the love of Pete, use your blinkah. Buddy Mello, signin' off.",
      ],
    },
  },
  {
    id: "anvil", dial: "WBOX", name: "The Anvil", kind: "talk",
    tempo: 0, root: 0, minor: false, prog: [], scale: [], talkGapMs: 1600,
    host: {
      name: "Iron Mike Fontaine", voice: "mike", prefs: ["Lee", "Google UK English Male", "Male"], rate: 0.92, pitch: 0.72,
      lines: [
        "This is The Anvil. Iron Mike Fontaine. City of Champions, baby.",
        "You wanna be great? You get up at five, you run the hill, you hit the bag till it begs.",
        "Champion City Gym — that's where legends get forged. Sweat is just weakness leavin' the body.",
        "They ask me, Mike, what's the secret? Heart. You can't teach heart. You earn it.",
        "Stay hungry, South Coast. Keep your hands up. We go again tomorrow.",
        "Some kid came in my gym yesterday, soft hands, soft eyes. Two weeks later? Different animal. That's the work.",
        "I been hit by guys twice my size and I'm still standin'. You think a Monday's gonna stop me? Please.",
        "Discipline ain't punishment, ya hear me? Discipline is LOVE. Love for who you're gonna become.",
        "Three rounds left in ya. Always. When you got nothin' left, you got three rounds. Dig.",
        "They knocked this city down — the mills closed, the boats slowed — and what'd we do? We got UP. Eight count. We got up.",
        "You skip roadwork, the ring knows. The ring always knows. It can smell a quitter.",
        "Don't tell me about talent. Talent sleeps in. I'll take the hungry kid over the gifted one every single time.",
        "Fear's just a bell, champ. It rings, you answer, you go to work.",
        "Champion City Gym, corner spot, smells like liniment and ambition. Door's always open. Excuses are not.",
        "My old trainer told me: your fists are honest. Everything else'll lie to ya, but your fists tell the truth.",
        "You get dropped? Good. Now we find out what you're made of. Get UP.",
        "I don't believe in cantt. I knew a fella named Cantt once. Glass jaw. Don't be a Cantt.",
        "The body's a tool and pain's the whetstone. You sharpen, or you rust. Your choice.",
        "Somebody asked if I ever lost. Course I lost. Losin' taught me everything winnin' couldn't.",
        "Your legs go first, they tell ya. Lies. Your EXCUSES go first — if you let 'em. Don't let 'em.",
        "I had a kid cryin' in my gym last week. Good. Cry. Then wipe your face and hit the bag. Tears are just rust comin' loose.",
        "You know what a comeback is? It's just a guy who refused to read the script everybody wrote for him. Tear up the script.",
        "Wind off the water'll cut right through ya on the morning run. Good. Let it. Soft weather makes soft men.",
        "They ask why I train fighters in a city this beat-up. 'Cause beat-up cities know how to get UP. We invented it here.",
        "Pain is information, champ. It's tellin' ya where the work is. So shut up and go do the work.",
        "I don't want your best day. Anybody's a champion on their best day. I want your WORST day. Show me that.",
        "You miss one mornin', you can hide it. Miss two, your trainer knows. Miss three, the whole CITY knows. Don't miss.",
        "Confidence ain't a feelin', it's a receipt. It's proof of the work you already put in. Go earn the receipt.",
        "Somebody hits you with everything they got and you're still standin'? Now they're scared. Now it's YOUR fight.",
        "Run the hurricane barrier at dawn, end to end. Mile and a half of stone and wind. That's a gym God built.",
        "This city forged anchors and harpoons for two hundred years. You think it can't forge a champion? Watch.",
        "You wanna quit? Quit tomorrow. Tonight you finish the round. Always finish the round.",
        "Everybody wants the belt. Nobody wants the five a.m. that buys the belt. The morning is where the title gets won.",
        "I tape a kid's hands and I can already tell ya who he is. Slow and careful, he's a worker. Rushin'? He's scared. We fix the scared first.",
        "You ever watch a heavy bag after a real fighter leaves? It's still swingin'. Be the kind of man a room remembers when you're gone.",
        "There's two kinds of tired, champ. The tired that's an excuse, and the tired that's a receipt. Learn which one you're feelin'.",
        "A jab ain't flashy. A jab wins fights. Be a jab. Steady, honest, always there. Let the other guy throw the haymakers and miss.",
        "Kid came in braggin' about his knockout on the internet. I said, son, the bag don't have a comment section. Get to work.",
        "My first gym had a hole in the roof. Rained right on the ring. We called it conditioning and we meant it. No such thing as bad weather, only soft plans.",
        "You wanna know if you're ready? You're never ready. Ready's a story. You go anyway — that's the whole secret nobody wants to hear.",
        "Footwork, footwork, footwork. Hands win rounds, but feet win FIGHTS. You can't hit a ghost, so learn to be the ghost.",
        "I lost a kid to the streets one winter. Best hands I ever taught. I keep his gloves on the wall so I never forget what the work is FOR.",
        "Pressure's a privilege. You only feel it 'cause you got somethin' worth losin'. Soft men don't sweat — they got nothin' on the line.",
        "Comeback's the wrong word. You never went anywhere. You were down there in the dark doin' the reps nobody clapped for. Now they see it.",
        "Don't shadowbox the mirror to look pretty. Shadowbox the man who's gonna try to take your head off Friday. Train the truth, not the picture.",
        "Old-timer told me your chin's a bank account. Every shot you take, you make a withdrawal. So defend, kid — you can't deposit it back.",
        "The bell don't care how you feel. The bell rings, and the only question is whether the work's already in your legs. Put it there now.",
        "I had a champion once cried in the locker room before every fight. Every one. Then he went out and was an animal. Nerves ain't fear. Nerves are FUEL.",
        "You can rent a body for a few rounds. But heart — heart you gotta own outright, and the only currency is mornings. Pay up.",
        "Quit smokin', quit the late nights, quit the company that keeps ya small. Discipline's just a long list of good goodbyes.",
        "When your corner says one more, you give 'em two. That's how a legend's built — not on the plan, on the round AFTER the plan.",
        "This whole city's a southpaw, champ — gets hit, drops its weight, comes back from the angle nobody expects. You're from here. Fight like it.",
        "Lights out, hands up, chin down. The Anvil. We forge or we fold — and we don't fold.",
      ],
    },
  },
  {
    id: "mare", dial: "105.3", name: "Maré Alta", kind: "music",
    tempo: 96, root: 110.0, minor: true, prog: [0, -2, -5, -7], scale: PENT_MIN, talkGapMs: 38000,
    host: {
      name: "Tia Conceição", voice: "tia", prefs: ["Luciana", "Google português", "Female"], rate: 0.98, pitch: 1.05,
      lines: [
        "Maré Alta, cento e cinco. Bom dia, my loves — that's high tide on your dial.",
        "A little saudade for the South Coast Portuguese — from Madeira to the South End.",
        "Put the bacalhau on, open the window. This one's for the avós.",
        "Feast season's coming. Save me a malasada. Maré Alta.",
        "For everyone working the docks this morning — força, my dears. The sea gives, the sea takes.",
        "This one's from Conceição in the North End to her filho out fishing on the Georges Bank. Come home safe, querido.",
        "Cape Verde, Açores, Madeira, the continent — todos juntos here on the South Coast. One family, one tide.",
        "The Feast of the Blessed Sacrament, the biggest Portuguese feast in all of America, right here in the Madeira club. I'll see you under the lights.",
        "Carne de espeto on the grill, the smell coming down Acushnet Avenue — ai, that's home.",
        "A song for the saudade — for the village you left and still carry in here, in the heart.",
        "Need the new fado record or a little morna from the islands? Maré Alta Records, downtown — diga que a Tia mandou.",
        "Rain on the way, they say. Good. The garden needs it, and so does my soul. Vamos dançar anyway.",
        "Don't forget the avó's name day on Sunday. Flowers. Real ones. She'll know if they're from the gas station.",
        "From the South End to Clark's Point, from the bridge to the boats — boa tarde, my beautiful people.",
        "A little morna for the heartbroken, a little coladeira for the hopeful. We have both tonight.",
        "They work so hard, our people. Two jobs, three jobs, and still they dance at the feast. That is strength.",
        "This is for the mothers who crossed an ocean so their children could complain about traffic. Obrigada, mães.",
        "High tide at the hurricane barrier, gulls crying over the fish house. The whole city smells like the sea and I love it.",
        "My mother crossed the ocean with two suitcases and a saint sewn into her coat. Me, I complain about the bridge. We have come far, no?",
        "There is a word, saudade — it means missing something so much it becomes a kind of company. You understand, or you don't. This song knows.",
        "To the man frying malasadas at the feast since five this morning: você é um herói. Save me three. No — five.",
        "The young ones say they don't speak Portuguese. Then the music plays and suddenly the feet remember everything the mouth forgot.",
        "Sunday after Mass, the whole avenue smells like garlic and the sea. That, my loves, is the smell of home.",
        "For the widows in the front pews at Saint Anthony's who still set two places at the table — esta é para vocês.",
        "They paved over so much, but they cannot pave over a song. So we keep singing, and the old city stays alive in here.",
        "A little coladeira to make you dance, a little morna to make you cry. In one night we live a whole life. That is the islands.",
        "Work, family, faith, music. My father said that is all a person needs. He was poor and he was right.",
        "When the boats come home safe past the barrier, somebody's avó lights a candle. That little flame holds up this whole city.",
        "The bacalhau's soaking, the wine's open, and the saudade is right on schedule. Come, sit, listen.",
        "For the fishermen's wives who watch the barrier for the boats coming home — this one is for your patience, mães.",
        "They paved the old street in stone again, the real cobble, like the velha terra. My grandmother would cry. Bonito.",
        "My neighbor brought figs from her tree this morning, still warm from the sun. In this city even the backyards remember the islands.",
        "There is a chair on my mother's porch nobody sits in. It is for the saints, she says. We keep it empty and somehow it keeps us full.",
        "To the young man who left for college and called his avó in Portuguese for the first time in years — she did not stop smiling for a week. Bem feito.",
        "The accordion, the cavaquinho, the voice cracking on the high note — that crack is not a mistake, my loves. That crack is the whole song.",
        "They ask why the old people plant gardens too big to eat. Because in the village, an empty field was hunger. The hands still remember the fear.",
        "A little funaná now, fast like the heart when the boat first comes around the point and you see he is home. Dance, don't think.",
        "My father mended nets sixty years and never once complained. Then I drop one plate and act like the sky has fallen. We are softer, but we are his.",
        "For the woman who runs the bakery on Coggeshall before the sun — your malasadas hold this neighborhood together better than the bridge ever did.",
        "Saudade is not sadness, understand me. It is love that has nowhere to go but the past, so it learns to sing instead. Listen.",
        "The procession comes down the avenue Sunday, the band a little out of tune, the children bored, the avós weeping. Perfeito. Do not change a thing.",
        "To the fisherman's daughter studying to be a doctor — your father cannot say the word for it in English, so he just points and cries. That is pride, querida.",
        "We carried saints across an ocean in our suitcases and planted grapevines in a cold country and made wine anyway. Tell me again we cannot do hard things.",
        "A little morna, for the ones who never made it back to the island. The sea kept them, but the song brings them to the table tonight.",
        "My grandson asked what the old word meant. I could not translate it. Some words you do not learn, you inherit. He will understand when he misses something enough.",
        "The feast lights go up over the avenue this week and for a few nights this tired city is the brightest place in America. Come, be lit up with us.",
        "They tore down the club where my parents danced. But the song they danced to — that, nobody can bulldoze. Here it is. Close your eyes. The room comes back.",
        "To everyone working a double on a holiday so the family can have the good ham — you are the saint in the empty chair. Obrigada.",
        "Rain on the bay tonight, soft, like the islands. My mother would say the sky is doing the crying so we do not have to. Vamos, a little coladeira.",
        "The boats came in heavy today, thanks be to God. Somewhere a wife unclenches her hands for the first time since dawn. This song is that breath she lets out.",
        "Keep the language on your tongue, keep the saint in the suitcase, keep the door open for the neighbor. That is all I know. That is everything.",
        "Keep the faith, keep the family, keep the music. Maré Alta, cento e cinco. Até logo, my loves.",
      ],
    },
  },
];

// --- station-agnostic content (§19 radio depth): ads, idents, news/weather,
// and lines that react to the player's wanted level. Read in the host voice.
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

const ADS = [
  "Engine knockin' like a screen door in a nor'easter? The Anvil Garage, on the waterfront — we'll get her runnin' right, no questions asked.",
  "Quohog Republic. Cold beer, hot chowder, and a jukebox that only knows the seventies. Down on the docks.",
  "Linguiça Linq — chouriço and eggs, twenty-four hours. 'Cause some hungers don't keep banker's hours.",
  "Maré Alta Records, downtown — fado, funaná, rock and roll. If we don't have it, you don't need it.",
  "Whaling City Cab. Two trucks, one that starts. We'll get ya there. Probably.",
  "This weekend at the Madeira Field — carne de espeto, malasadas, and the carousel that's older than your grandfather.",
  "Sal's Marine Supply, Pope's Island. Nets, traps, and lies about the one that got away. All half off.",
  "Buy American, buy local, buy a clam roll the size of your fist. That's the South Coast guarantee.",
  "Tia Conceição's Malasadas — fried to order on Acushnet Ave. Get there before the church crowd or get nothin'.",
  "Fort Phoenix Bait & Tackle, Fairhaven side. Bloodworms, beer, and bad advice. Open since the barrier went up.",
  "The Zeiterion's got a show this weekend — put on a clean shirt and pretend you like culture, would ya.",
  "Cuttyhunk Ferry — if the harbor's got you down, an hour on the water fixes most things. Bring your own coffee.",
  "Medeiros Auto Body — we fix what the cobblestones break. And downtown, brother, the cobblestones break everything.",
  "Scallops landed fresh at the State Pier this mornin'. If it's white and sweet and costs too much, it's local.",
  "AHA Night downtown, second Thursday — art, history, architecture, and somewhere to park, eventually.",
];

const IDS = [
  "You're locked in.",
  "All across the South Coast.",
  "From the harbor to the highway.",
  "Turn it up.",
  "Nobody does it like we do it.",
  "Whaling City radio.",
  "From Clark's Point to the Braga Bridge.",
  "The sound of the working waterfront.",
  "Keep her between the buoys.",
];

const NEWS = [
  "Top of the hour: the harbor commission says dredging's behind schedule again. In other words, water's still wet.",
  "City council voted to study the pothole problem. The study fell in a pothole. We'll keep you posted.",
  "Fish prices up at the auction this mornin' — good news for the fleet, bad news for your Friday supper.",
  "The bridge will be openin' on the half hour all weekend, so plan accordingly, or don't, and suffer.",
  "Hurricane barrier gates tested today — everything still works, which around here counts as a miracle.",
  "Feast of the Blessed Sacrament committee says the kitchen's open and the carne de espeto's on. Bring an appetite and a tow truck.",
  "Harbormaster reminds you the channel's for boats, the road's for cars, and never the twain shall meet. Usually.",
  "Whaling Museum's got a new exhibit on the lightkeepers. Admission's free if you look like you already paid.",
];

const WANTED = [
  "Scanner's lightin' up down by the waterfront — sounds like somebody's havin' an exciting evening. Stay clear, folks.",
  "Lotta blue lights downtown tonight. Whatever you did, pal — and somebody did somethin' — knock it off.",
  "Police all over the South End. If that's one of you listenin', maybe ease off the gas, huh?",
  "Cruisers headed over the Fairhaven bridge in a hurry. Somebody's day just got a lot longer.",
  "They got the cobblestones blocked off downtown. Whatever you're runnin' from, it ain't worth a busted axle.",
];
const RAIN = ["Wipers on, comin' down steady off the bay.", "Roads are slick as a politician's promise tonight — easy out there.",
  "Rain comin' sideways off Buzzards Bay — keep both hands on the wheel.", "Storm drains downtown are doin' their usual nothin'. Watch the puddles."];
const FOG = ["Pea-soup fog on the harbor — foghorn's earnin' its keep.", "Can't see the end of the pier in this fog. Drive like it."];

class RadioEngine {
  private ctx?: AudioContext;
  private master?: GainNode;
  private timer?: number;
  private talkTimer?: number;
  private step = 0;
  private lineIdx = 0;
  private seg = 0;
  private flash: string | null = null; // one-off reactive line to read at the next talk slot
  private station: Station | null = null;
  private music?: HTMLAudioElement;   // real licensed/generated tracks (§19 music)
  private musicTracks: string[] = [];
  private jingles: string[] = [];     // station IDs/bumpers for talk dials
  private jingleAudio?: HTMLAudioElement;
  vol = 0.5;
  muted = false;
  private duck = 1; // adaptive ducking (lowered under police heat)
  /** Subtitle sink (§33): set by the HUD to caption the currently spoken line. */
  onSubtitle: ((s: { name: string; text: string } | null) => void) | null = null;
  private emitSub(s: { name: string; text: string } | null) { try { this.onSubtitle?.(s); } catch { /* no sink */ } }
  /** Now-playing track sink: set by the Radio panel to show the current song. */
  onTrack: ((name: string) => void) | null = null;
  private currentTrack = "";
  private lastUrl = "";
  private emitTrack(name: string) { this.currentTrack = name; try { this.onTrack?.(name); } catch { /* no sink */ } }
  /** Current real track display name ("" when on the synth bed or a talk dial). */
  trackName() { return this.currentTrack; }
  /** Skip to another real track on the current music station (no-op otherwise). */
  skipTrack() { if (this.station?.kind === "music" && this.musicTracks.length) this.playTrack(); }

  setDuck(d: number) {
    this.duck = d;
    if (this.master && this.ctx && !this.muted) this.master.gain.setTargetAtTime(this.vol * d, this.ctx.currentTime, 0.4);
    if (this.music) this.music.volume = this.muted ? 0 : this.vol * d;
  }

  private ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 2400;
      this.master.connect(filter);
      filter.connect(this.ctx.destination);
      this.master.gain.value = this.muted ? 0 : this.vol;
    }
    this.ctx.resume();
  }

  current(): Station | null { return this.station; }

  setStation(s: Station | null) {
    this.stop();
    if (!s) return;
    this.ensure();
    this.station = s;
    this.step = 0;
    this.lineIdx = 0;
    this.seg = 0;
    if (s.kind === "music") this.loadMusic(s);
    this.loadJingles(s);
    // talk stations start talking almost immediately; music stations after a bed
    this.scheduleTalk(s.kind === "talk" ? 600 : s.talkGapMs);
  }

  // Station jingles/bumpers (public/music/<id>/jingles/) played between segments.
  private loadJingles(s: Station) {
    this.jingles = [];
    fetch(`music/${s.id}/jingles/manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((mf: { tracks?: string[] } | null) => {
        if (this.station !== s || !mf?.tracks?.length) return;
        this.jingles = mf.tracks.map((f) => /^(https?:)?\/\//.test(f) ? f : `music/${s.id}/jingles/${f}`);
      })
      .catch(() => { /* no jingles */ });
  }

  // Real music when public/music/<id>/manifest.json exists; else procedural synth.
  private startSynth(s: Station) {
    const beatMs = (60 / s.tempo) * 1000;
    this.timer = window.setInterval(() => this.tick(), beatMs);
  }
  private loadMusic(s: Station) {
    this.musicTracks = [];
    // a track may be a bare filename (public/music/<id>/) or an absolute URL
    // (webhook-delivered to Blob/CDN) — accept both.
    const resolve = (tracks: string[]) => tracks.map((f) => /^(https?:)?\/\//.test(f) ? f : `music/${s.id}/${f}`);
    const play = (tracks?: string[]): boolean => {
      if (this.station !== s || !tracks || !tracks.length) return false;
      this.musicTracks = resolve(tracks);
      this.playTrack();
      return true;
    };
    // 1) Blob-backed manifest (webhook delivery) → 2) static public manifest →
    // 3) procedural synth bed.
    fetch(`api/music?station=${s.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((mf: { tracks?: string[] } | null) => {
        if (this.station !== s) return;
        if (play(mf?.tracks)) return;
        fetch(`music/${s.id}/manifest.json`)
          .then((r) => (r.ok ? r.json() : null))
          .then((mf2: { tracks?: string[] } | null) => {
            if (this.station !== s) return;
            if (!play(mf2?.tracks)) this.startSynth(s);
          })
          .catch(() => { if (this.station === s) this.startSynth(s); });
      })
      .catch(() => { if (this.station === s) this.startSynth(s); });
  }
  private playTrack() {
    // avoid replaying the same file back-to-back when there's a choice
    let url = pick(this.musicTracks);
    if (this.musicTracks.length > 1) { let guard = 0; while (url === this.lastUrl && guard++ < 8) url = pick(this.musicTracks); }
    this.lastUrl = url;
    if (!this.music) this.music = new Audio();
    this.music.src = url;
    this.music.loop = false;
    this.music.muted = this.muted;
    this.music.volume = this.vol;
    this.music.onended = () => { if (this.musicTracks.length) this.playTrack(); };
    this.music.play().catch(() => {});
    // publish a clean display name (basename, no extension)
    const base = decodeURIComponent(url.split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "");
    this.emitTrack(base);
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = undefined; }
    if (this.talkTimer) { clearTimeout(this.talkTimer); this.talkTimer = undefined; }
    if (this.music) { this.music.pause(); this.music.onended = null; }
    if (this.jingleAudio) { this.jingleAudio.pause(); this.jingleAudio.onended = null; }
    this.musicTracks = [];
    this.jingles = [];
    this.lastUrl = "";
    this.flash = null;
    stopVO();
    this.emitSub(null);
    this.emitTrack("");
    this.station = null;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.vol, this.ctx.currentTime, 0.05);
    if (this.music) this.music.muted = m;
    if (m) { stopVO(); this.emitSub(null); }
  }

  setVolume(v: number) {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx && !this.muted) this.master.gain.setTargetAtTime(this.vol, this.ctx.currentTime, 0.05);
    if (this.music) this.music.volume = this.vol;
  }

  // --- music ---
  private tick() {
    const s = this.station;
    const ctx = this.ctx;
    if (!s || !ctx || s.kind !== "music") return;
    const t = ctx.currentTime + 0.03;
    const beat = 60 / s.tempo;
    const chord = s.prog[this.step % s.prog.length];
    const base = s.root * Math.pow(2, chord / 12);
    const third = s.minor ? 3 : 4;
    this.note(base, t, beat * 1.9, 0.05, "triangle");
    this.note(base * Math.pow(2, third / 12), t, beat * 1.9, 0.045, "triangle");
    this.note(base * Math.pow(2, 7 / 12), t, beat * 1.9, 0.04, "sine");
    this.note(base / 2, t, beat * 0.9, 0.11, "sawtooth"); // bass
    const arp = s.scale[this.step % s.scale.length];
    this.note(s.root * 2 * Math.pow(2, arp / 12), t + beat * 0.5, beat * 0.4, 0.035, "square");
    this.step++;
  }

  private note(freq: number, when: number, dur: number, gain: number, type: OscillatorType) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(this.master!);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  // --- talk ---
  private scheduleTalk(delay: number) {
    if (this.talkTimer) clearTimeout(this.talkTimer);
    this.talkTimer = window.setTimeout(() => this.speakNext(), delay);
  }

  private speakNext() {
    const s = this.station;
    if (!s || this.muted) {
      if (s) this.scheduleTalk(s.talkGapMs);
      return;
    }
    // every so often, drop a station jingle/bumper instead of a spoken line
    if (this.jingles.length && this.seg > 0 && this.seg % 4 === 0) {
      this.seg++;
      const url = pick(this.jingles);
      if (!this.jingleAudio) this.jingleAudio = new Audio();
      const j = this.jingleAudio;
      j.src = url; j.muted = this.muted; j.volume = this.vol;
      if (this.music) this.music.volume = this.muted ? 0 : this.vol * 0.2; // duck bed under the jingle
      this.emitSub({ name: s.name, text: "♪ station ID" });
      const finish = () => {
        if (this.music) this.music.volume = this.muted ? 0 : this.vol;
        this.emitSub(null);
        if (this.station === s) this.scheduleTalk(s.talkGapMs);
      };
      j.onended = finish;
      j.onerror = finish;
      j.play().catch(finish);
      return;
    }
    const line = this.chooseSegment(s);
    // duck the music bed (synth + real track) while the host talks
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol * 0.28, this.ctx.currentTime, 0.08);
    if (this.music) this.music.volume = this.muted ? 0 : this.vol * 0.2;
    this.emitSub({ name: s.host.name, text: line }); // caption (§33)
    const done = () => {
      if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol, this.ctx.currentTime, 0.2);
      if (this.music) this.music.volume = this.muted ? 0 : this.vol;
      this.emitSub(null);
      if (this.station === s) this.scheduleTalk(s.talkGapMs);
    };
    // real ElevenLabs voice when configured, else Web Speech (vo.ts handles both)
    speak({
      text: line,
      voice: s.host.voice ?? "narrator",
      rate: s.host.rate,
      pitch: s.host.pitch,
      prefs: s.host.prefs,
      onend: done,
    });
  }

  // Interleave host lines with ads, idents, news, and reactive weather/wanted
  // chatter so the dial feels alive (§19 radio depth).
  /** Queue a one-off reactive line (e.g. a player milestone) read in the host
   *  voice at the next talk slot. No-op styling — just a breaking-news insert. */
  flashNews(text: string) { this.flash = text; }

  private chooseSegment(s: Station): string {
    this.seg++;
    // a queued reactive line jumps the rotation (consumed once)
    if (this.flash) { const f = this.flash; this.flash = null; return f; }
    try {
      const police = useStats.getState().police;
      const weather = useGame.getState().weather;
      if (police >= 3 && Math.random() < 0.28) return pick(WANTED);
      if (weather === "rain" && Math.random() < 0.18) return pick(RAIN);
      if (weather === "fog" && Math.random() < 0.18) return pick(FOG);
    } catch { /* stores not ready */ }
    if (this.seg % 4 === 0) return pick(ADS);
    if (this.seg % 9 === 0) return `${s.dial}, ${s.name}. ${pick(IDS)}`;
    if (s.kind === "talk" && this.seg % 6 === 0) return pick(NEWS);
    const line = s.host.lines[this.lineIdx % s.host.lines.length];
    this.lineIdx++;
    return line;
  }
}

export const radio = new RadioEngine();
