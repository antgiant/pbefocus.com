// Rogue Sheep easter egg -- shared across pbefocus.com, quiz.pbefocus.com,
// and karaoke.pbefocus.com. Include with a single tag:
//   <script src="https://pbefocus.com/rogue-sheep.js" defer></script>
// Injects its own styles and a toggle button into `footer.site-footer`,
// and persists on/off via a cookie scoped to the whole pbefocus.com domain
// so the setting follows the visitor across subdomains.
(function () {
  "use strict";
  if (window.__rogueSheepLoaded) return;
  window.__rogueSheepLoaded = true;

  var COOKIE_NAME = "pbe_rogue_sheep";
  var COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

  function readCookie(name) {
    var match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function writeCookie(name, value) {
    // Cross-subdomain sharing only works with an explicit `domain=` attribute
    // that matches the registrable domain; local/dev hosts (localhost, a
    // plain IP, etc.) fall back to a normal host-only cookie so testing off
    // pbefocus.com still works.
    var domainAttr = /(^|\.)pbefocus\.com$/.test(location.hostname) ? "; domain=.pbefocus.com" : "";
    document.cookie = name + "=" + encodeURIComponent(value) + "; path=/; max-age=" + COOKIE_MAX_AGE + domainAttr + "; samesite=lax";
  }

  function isEnabled() {
    return readCookie(COOKIE_NAME) === "1";
  }

  function setEnabled(on) {
    writeCookie(COOKIE_NAME, on ? "1" : "0");
  }

  var STYLE_ID = "rogue-sheep-styles";
  var ROGUE_SHEEP_CSS =
    ".rogue-sheep-toggle{display:inline-flex;align-items:center;gap:.35em;font-size:1rem;line-height:1;background:none;border:none;padding:0;cursor:pointer;color:inherit;opacity:.55;filter:grayscale(1);transition:opacity .15s ease,filter .15s ease;}" +
    ".rogue-sheep-toggle:hover{opacity:.85;}" +
    '.rogue-sheep-toggle[aria-pressed="true"]{opacity:1;filter:none;}' +
    ".rogue-sheep-toggle .rogue-sheep-toggle-status{font-size:.8em;display:none;}" +
    '.rogue-sheep-toggle[aria-pressed="false"] .rogue-sheep-toggle-status-off{display:inline;}' +
    '.rogue-sheep-toggle[aria-pressed="true"] .rogue-sheep-toggle-status-on{display:inline;}' +
    ".rogue-sheep{position:fixed;font-size:32px;z-index:9999;pointer-events:none;transition:transform .1s ease;}" +
    ".rogue-sheep.flipped{transform:scaleX(-1);}" +
    ".rogue-sheep.black-sheep{filter:brightness(.2) saturate(.5);}" +
    ".rogue-sheep.black-sheep.flipped{transform:scaleX(-1);filter:brightness(.2) saturate(.5);}" +
    ".rogue-sheep.rained-on{filter:hue-rotate(180deg) saturate(1.5);}" +
    ".rogue-sheep.black-sheep.rained-on{filter:brightness(.2) saturate(.5) hue-rotate(180deg);}" +
    ".rogue-sheep.jumping{animation:sheep-jump .6s ease-out;}" +
    "@keyframes sheep-jump{0%{transform:translateY(0);}50%{transform:translateY(-30px);}100%{transform:translateY(0);}}" +
    ".rogue-sheep.flipped.jumping{animation:sheep-jump-flipped .6s ease-out;}" +
    "@keyframes sheep-jump-flipped{0%{transform:scaleX(-1) translateY(0);}50%{transform:scaleX(-1) translateY(-30px);}100%{transform:scaleX(-1) translateY(0);}}" +
    ".sheep-particle{position:fixed;font-size:16px;z-index:9998;pointer-events:none;animation:particle-rise 2s ease-out forwards;}" +
    ".sheep-particle.falling{animation:particle-fall 1.5s ease-in forwards;}" +
    ".sheep-particle.eating{animation:particle-eat 1s ease-in-out forwards;font-size:20px;}" +
    ".sheep-jump-obstacle{position:fixed;font-size:24px;z-index:9997;pointer-events:none;animation:obstacle-appear 5s ease-in-out forwards;}" +
    "@keyframes particle-rise{0%{opacity:1;transform:translateY(0) scale(1);}100%{opacity:0;transform:translateY(-40px) scale(.6);}}" +
    "@keyframes particle-fall{0%{opacity:.8;transform:translateY(-30px);}100%{opacity:0;transform:translateY(10px);}}" +
    "@keyframes particle-eat{0%{opacity:1;transform:translateY(0) scale(1);}50%{opacity:1;transform:translateY(-5px) scale(.8);}100%{opacity:0;transform:translateY(5px) scale(.3);}}" +
    "@keyframes obstacle-appear{0%{opacity:0;}10%{opacity:1;}90%{opacity:1;}100%{opacity:0;}}";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = ROGUE_SHEEP_CSS;
    document.head.appendChild(style);
  }

  var sheepActions = [
    { name: "sing", weight: 1 },
    { name: "eat", weight: 1 },
    { name: "jump", weight: 1 },
    { name: "sleep", weight: 1 },
    { name: "love", weight: 1 },
    { name: "rain", weight: 1 },
    { name: "think", weight: 1 },
    { name: "sparkle", weight: 1 },
    { name: "sneeze", weight: 1 },
    { name: "baa", weight: 1 },
    { name: "read", weight: 2 },
    { name: "church", weight: 1 },
    { name: "glasses", weight: 1 },
    { name: "sunny", weight: 1 },
    { name: "snowy", weight: 1 },
    { name: "windy", weight: 1 },
    { name: "rainbow", weight: 1 },
    { name: "dance", weight: 1 },
    { name: "exercise", weight: 1 },
    { name: "paint", weight: 1 },
    { name: "garden", weight: 1 },
    { name: "cook", weight: 1 },
    { name: "fish", weight: 1 },
    { name: "wave", weight: 1 },
    { name: "celebrate", weight: 1 },
    { name: "cry", weight: 1 },
    { name: "laugh", weight: 1 },
    { name: "scared", weight: 1 },
    { name: "angry", weight: 1 },
    { name: "dream", weight: 1 },
    { name: "coffee", weight: 1 },
    { name: "photo", weight: 1 },
    { name: "music", weight: 1 },
    { name: "butterfly", weight: 1 },
    { name: "countingSheep", weight: 1 },
    { name: "crown", weight: 1 },
    { name: "birthday", weight: 1 },
    { name: "soccer", weight: 1 },
    { name: "basketball", weight: 1 },
    { name: "golf", weight: 1 },
    { name: "tennis", weight: 1 },
    { name: "bowling", weight: 1 },
    { name: "videoGames", weight: 1 },
    { name: "pizza", weight: 1 },
    { name: "iceCream", weight: 1 },
    { name: "picnic", weight: 1 },
    { name: "bbq", weight: 1 },
    { name: "christmas", weight: 1 },
    { name: "valentine", weight: 1 },
    { name: "fireworks", weight: 1 },
    { name: "detective", weight: 1 },
    { name: "astronaut", weight: 1 },
    { name: "doctor", weight: 1 },
    { name: "praying", weight: 1 },
    { name: "bee", weight: 1 },
    { name: "birdWatching", weight: 1 },
    { name: "frog", weight: 1 },
    { name: "ladybug", weight: 1 },
    { name: "texting", weight: 1 },
    { name: "streaming", weight: 1 },
    { name: "working", weight: 1 },
    { name: "podcast", weight: 1 },
    { name: "balloon", weight: 1 },
    { name: "dizzy", weight: 1 },
    { name: "hiccup", weight: 1 },
    { name: "yawn", weight: 1 },
    { name: "whistle", weight: 1 },
    { name: "treasure", weight: 1 },
    { name: "timeTravel", weight: 1 },
    { name: "clone", weight: 1 },
    { name: "islandDrink", weight: 1 },
    { name: "islandCoconut", weight: 1 },
    { name: "islandEscape", weight: 1 },
    { name: "surf", weight: 1 },
    { name: "car", weight: 1 },
    { name: "bus", weight: 1 },
    { name: "train", weight: 1 },
    { name: "airplane", weight: 1 },
    { name: "bicycle", weight: 1 },
    { name: "motorcycle", weight: 1 },
    { name: "boat", weight: 1 },
    { name: "helicopter", weight: 1 },
    { name: "hotAirBalloon", weight: 1 },
    { name: "skateboard", weight: 1 },
    { name: "scooter", weight: 1 },
    { name: "tractor", weight: 1 },
    { name: "rocket", weight: 1 },
    { name: "meetDog", weight: 1 },
    { name: "meetCow", weight: 1 },
    { name: "meetHorse", weight: 1 },
    { name: "meetGoat", weight: 1 },
    { name: "meetPig", weight: 1 },
    { name: "meetChicken", weight: 1 },
    { name: "meetDuck", weight: 1 },
    { name: "meetCat", weight: 1 },
    { name: "meetRabbit", weight: 1 },
    { name: "meetDeer", weight: 1 },
    { name: "meetDonkey", weight: 1 },
    { name: "meetOwl", weight: 1 },
    { name: "meetMouse", weight: 1 },
    { name: "meetLlama", weight: 1 },
  ];

  function createSheepParticle(x, y, emoji, type) {
    var particle = document.createElement("div");
    particle.className = "sheep-particle" + (type === "fall" ? " falling" : type === "eat" ? " eating" : "");
    particle.textContent = emoji;
    particle.style.left = x + (Math.random() - 0.5) * 20 + "px";
    particle.style.top = y - 20 + "px";
    particle.setAttribute("aria-hidden", "true");
    document.body.appendChild(particle);
    setTimeout(function () {
      particle.remove();
    }, type === "fall" ? 1500 : type === "eat" ? 1000 : 2000);
  }

  function performSheepAction(sheep, actionName, isBlackSheep, currentX, currentY) {
    var x = currentX;
    var y = currentY;

    switch (actionName) {
      case "sing": {
        var notes = isBlackSheep ? ["🎶", "🎵", "🎶", "🎵"] : ["♩", "♪", "♫", "♬"];
        var noteIndex = 0;
        var singInterval = setInterval(function () {
          if (noteIndex < 6) {
            createSheepParticle(x, y, notes[noteIndex % notes.length]);
            noteIndex++;
          } else {
            clearInterval(singInterval);
          }
        }, 600);
        break;
      }
      case "eat": {
        var foods = ["🌾", "🌿", "🍀", "🌱", "☘️"];
        var eatCount = 0;
        var eatInterval = setInterval(function () {
          if (eatCount < 4) {
            createSheepParticle(x + 15, y + 10, foods[Math.floor(Math.random() * foods.length)], "eat");
            eatCount++;
          } else {
            clearInterval(eatInterval);
          }
        }, 800);
        break;
      }
      case "jump": {
        var obstacles = ["🚧", "🪨", "🪵", "🌵", "📦", "🧱"];
        var obstacle = document.createElement("div");
        obstacle.className = "sheep-jump-obstacle";
        obstacle.textContent = obstacles[Math.floor(Math.random() * obstacles.length)];
        obstacle.style.left = x + (sheep.classList.contains("flipped") ? 40 : -40) + "px";
        obstacle.style.top = y + 10 + "px";
        obstacle.setAttribute("aria-hidden", "true");
        document.body.appendChild(obstacle);
        setTimeout(function () {
          sheep.classList.add("jumping");
          setTimeout(function () {
            sheep.classList.remove("jumping");
          }, 600);
        }, 1500);
        setTimeout(function () {
          obstacle.remove();
        }, 5000);
        break;
      }
      case "sleep": {
        var zzCount = 0;
        var sleepInterval = setInterval(function () {
          if (zzCount < 5) {
            createSheepParticle(x, y, "💤");
            zzCount++;
          } else {
            clearInterval(sleepInterval);
          }
        }, 800);
        break;
      }
      case "love": {
        var hearts = ["💖", "💕", "💗", "❤️", "💓"];
        var heartCount = 0;
        var loveInterval = setInterval(function () {
          if (heartCount < 5) {
            createSheepParticle(x, y, hearts[Math.floor(Math.random() * hearts.length)]);
            heartCount++;
          } else {
            clearInterval(loveInterval);
          }
        }, 700);
        break;
      }
      case "rain": {
        sheep.classList.add("rained-on");
        var dropCount = 0;
        var rainInterval = setInterval(function () {
          if (dropCount < 15) {
            createSheepParticle(x + (Math.random() - 0.5) * 30, y - 30, "💧", "fall");
            dropCount++;
          } else {
            clearInterval(rainInterval);
          }
        }, 250);
        setTimeout(function () {
          sheep.classList.remove("rained-on");
        }, 5500);
        break;
      }
      case "think": {
        var thoughts = ["💭", "❓", "💡", "🤔", "❔"];
        var thoughtCount = 0;
        var thinkInterval = setInterval(function () {
          if (thoughtCount < 3) {
            createSheepParticle(x, y, thoughts[Math.floor(Math.random() * thoughts.length)]);
            thoughtCount++;
          } else {
            clearInterval(thinkInterval);
          }
        }, 1200);
        break;
      }
      case "sparkle": {
        var sparkles = ["✨", "⭐", "🌟", "💫"];
        var sparkleCount = 0;
        var sparkleInterval = setInterval(function () {
          if (sparkleCount < 8) {
            createSheepParticle(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 20, sparkles[Math.floor(Math.random() * sparkles.length)]);
            sparkleCount++;
          } else {
            clearInterval(sparkleInterval);
          }
        }, 400);
        break;
      }
      case "sneeze": {
        setTimeout(function () {
          createSheepParticle(x + (sheep.classList.contains("flipped") ? 20 : -20), y, "💨");
          createSheepParticle(x + (sheep.classList.contains("flipped") ? 30 : -30), y + 5, "💨");
          createSheepParticle(x + (sheep.classList.contains("flipped") ? 25 : -25), y - 5, "✨");
        }, 1500);
        break;
      }
      case "baa": {
        var speechBubbles = ["🗯️", "💬"];
        var baaCount = 0;
        var baaInterval = setInterval(function () {
          if (baaCount < 3) {
            createSheepParticle(x, y, speechBubbles[baaCount % 2]);
            baaCount++;
          } else {
            clearInterval(baaInterval);
          }
        }, 1000);
        break;
      }
      case "read": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 15 : -15), y + 5, "📖", "eat");
        var readEmojis = ["📚", "📕", "📗", "📘", "📙", "✨", "💭"];
        var readCount = 0;
        var readInterval = setInterval(function () {
          if (readCount < 6) {
            createSheepParticle(x, y, readEmojis[Math.floor(Math.random() * readEmojis.length)]);
            readCount++;
          } else {
            clearInterval(readInterval);
          }
        }, 600);
        break;
      }
      case "church": {
        createSheepParticle(x, y - 10, "⛪");
        var holySymbols = ["✝️", "🙏", "👼", "✨", "🕊️", "📿"];
        var churchCount = 0;
        var churchInterval = setInterval(function () {
          if (churchCount < 5) {
            createSheepParticle(x, y, holySymbols[Math.floor(Math.random() * holySymbols.length)]);
            churchCount++;
          } else {
            clearInterval(churchInterval);
          }
        }, 700);
        break;
      }
      case "glasses": {
        setTimeout(function () {
          createSheepParticle(x, y - 5, "👓");
        }, 500);
        setTimeout(function () {
          createSheepParticle(x, y, "✨");
          createSheepParticle(x - 10, y, "✨");
          createSheepParticle(x + 10, y, "✨");
        }, 1500);
        setTimeout(function () {
          createSheepParticle(x, y, "🤓");
        }, 2500);
        break;
      }
      case "sunny": {
        createSheepParticle(x, y - 30, "☀️");
        var sunnyEmojis = ["😎", "✨", "🌞", "💦"];
        var sunnyCount = 0;
        var sunnyInterval = setInterval(function () {
          if (sunnyCount < 5) {
            createSheepParticle(x, y, sunnyEmojis[Math.floor(Math.random() * sunnyEmojis.length)]);
            sunnyCount++;
          } else {
            clearInterval(sunnyInterval);
          }
        }, 600);
        break;
      }
      case "snowy": {
        var snowCount = 0;
        var snowInterval = setInterval(function () {
          if (snowCount < 12) {
            createSheepParticle(x + (Math.random() - 0.5) * 40, y - 20, "❄️", "fall");
            snowCount++;
          } else {
            clearInterval(snowInterval);
          }
        }, 300);
        setTimeout(function () {
          createSheepParticle(x, y, "🥶");
        }, 2000);
        break;
      }
      case "windy": {
        var windEmojis = ["💨", "🍃", "🍂", "🍁"];
        var windCount = 0;
        var windInterval = setInterval(function () {
          if (windCount < 8) {
            createSheepParticle(x + (sheep.classList.contains("flipped") ? -20 : 20), y, windEmojis[Math.floor(Math.random() * windEmojis.length)]);
            windCount++;
          } else {
            clearInterval(windInterval);
          }
        }, 350);
        break;
      }
      case "rainbow": {
        createSheepParticle(x, y - 30, "🌈");
        var rainbowEmojis = ["✨", "🌟", "💖", "🤩"];
        var rainbowCount = 0;
        var rainbowInterval = setInterval(function () {
          if (rainbowCount < 5) {
            createSheepParticle(x + (Math.random() - 0.5) * 30, y, rainbowEmojis[Math.floor(Math.random() * rainbowEmojis.length)]);
            rainbowCount++;
          } else {
            clearInterval(rainbowInterval);
          }
        }, 500);
        break;
      }
      case "dance": {
        var danceEmojis = ["💃", "🕺", "🎵", "🎶", "✨"];
        var danceCount = 0;
        var danceInterval = setInterval(function () {
          if (danceCount < 8) {
            createSheepParticle(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 20, danceEmojis[Math.floor(Math.random() * danceEmojis.length)]);
            danceCount++;
          } else {
            clearInterval(danceInterval);
          }
        }, 400);
        break;
      }
      case "exercise": {
        var exerciseEmojis = ["💪", "🏃‍♂️", "🩽", "😤", "💦"];
        var exerciseCount = 0;
        var exerciseInterval = setInterval(function () {
          if (exerciseCount < 6) {
            createSheepParticle(x, y, exerciseEmojis[Math.floor(Math.random() * exerciseEmojis.length)]);
            exerciseCount++;
          } else {
            clearInterval(exerciseInterval);
          }
        }, 500);
        break;
      }
      case "paint": {
        createSheepParticle(x + 15, y, "🎨");
        var paintEmojis = ["🖌️", "🟥", "🟧", "🟦", "🟩", "🟪", "✨"];
        var paintCount = 0;
        var paintInterval = setInterval(function () {
          if (paintCount < 6) {
            createSheepParticle(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 30, paintEmojis[Math.floor(Math.random() * paintEmojis.length)]);
            paintCount++;
          } else {
            clearInterval(paintInterval);
          }
        }, 450);
        break;
      }
      case "garden": {
        var gardenEmojis = ["🌷", "🌻", "🌹", "🌺", "🌼", "🌱"];
        var gardenCount = 0;
        var gardenInterval = setInterval(function () {
          if (gardenCount < 5) {
            createSheepParticle(x + (Math.random() - 0.5) * 30, y + 10, gardenEmojis[Math.floor(Math.random() * gardenEmojis.length)], "eat");
            gardenCount++;
          } else {
            clearInterval(gardenInterval);
          }
        }, 600);
        break;
      }
      case "cook": {
        createSheepParticle(x, y + 5, "🍳");
        var cookEmojis = ["👨‍🍳", "🔥", "✨", "💨", "🧂"];
        var cookCount = 0;
        var cookInterval = setInterval(function () {
          if (cookCount < 5) {
            createSheepParticle(x, y, cookEmojis[Math.floor(Math.random() * cookEmojis.length)]);
            cookCount++;
          } else {
            clearInterval(cookInterval);
          }
        }, 550);
        break;
      }
      case "fish": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 25 : -25), y + 15, "🎣");
        setTimeout(function () {
          createSheepParticle(x + (sheep.classList.contains("flipped") ? 30 : -30), y + 10, "🐟");
          createSheepParticle(x, y, "🎉");
        }, 2500);
        break;
      }
      case "wave": {
        var waveEmojis = ["👋", "😊", "✨"];
        var waveCount = 0;
        var waveInterval = setInterval(function () {
          if (waveCount < 4) {
            createSheepParticle(x, y, waveEmojis[waveCount % waveEmojis.length]);
            waveCount++;
          } else {
            clearInterval(waveInterval);
          }
        }, 600);
        break;
      }
      case "celebrate": {
        var celebrateEmojis = ["🎉", "🥳", "🎊", "🎈", "✨", "🎆"];
        var celebrateCount = 0;
        var celebrateInterval = setInterval(function () {
          if (celebrateCount < 8) {
            createSheepParticle(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 20, celebrateEmojis[Math.floor(Math.random() * celebrateEmojis.length)]);
            celebrateCount++;
          } else {
            clearInterval(celebrateInterval);
          }
        }, 350);
        break;
      }
      case "cry": {
        var cryEmojis = ["😢", "💧", "😭"];
        var cryCount = 0;
        var cryInterval = setInterval(function () {
          if (cryCount < 6) {
            createSheepParticle(x + (Math.random() - 0.5) * 15, y, cryEmojis[Math.floor(Math.random() * cryEmojis.length)], "fall");
            cryCount++;
          } else {
            clearInterval(cryInterval);
          }
        }, 500);
        break;
      }
      case "laugh": {
        var laughEmojis = ["😂", "🤣", "😄", "😆"];
        var laughCount = 0;
        var laughInterval = setInterval(function () {
          if (laughCount < 5) {
            createSheepParticle(x, y, laughEmojis[Math.floor(Math.random() * laughEmojis.length)]);
            laughCount++;
          } else {
            clearInterval(laughInterval);
          }
        }, 500);
        break;
      }
      case "scared": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? -30 : 30), y, "👻");
        var scaredEmojis = ["😱", "😨", "💦", "❗"];
        var scaredCount = 0;
        var scaredInterval = setInterval(function () {
          if (scaredCount < 4) {
            createSheepParticle(x, y, scaredEmojis[Math.floor(Math.random() * scaredEmojis.length)]);
            scaredCount++;
          } else {
            clearInterval(scaredInterval);
          }
        }, 400);
        break;
      }
      case "angry": {
        var angryEmojis = ["😤", "💢", "😡", "💯"];
        var angryCount = 0;
        var angryInterval = setInterval(function () {
          if (angryCount < 5) {
            createSheepParticle(x + (Math.random() - 0.5) * 20, y - 10, angryEmojis[Math.floor(Math.random() * angryEmojis.length)]);
            angryCount++;
          } else {
            clearInterval(angryInterval);
          }
        }, 450);
        break;
      }
      case "dream": {
        var dreamEmojis = ["💭", "🦄", "🌙", "✨", "🌟", "🌈"];
        var dreamCount = 0;
        var dreamInterval = setInterval(function () {
          if (dreamCount < 6) {
            createSheepParticle(x, y, dreamEmojis[Math.floor(Math.random() * dreamEmojis.length)]);
            dreamCount++;
          } else {
            clearInterval(dreamInterval);
          }
        }, 600);
        break;
      }
      case "coffee": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 15 : -15), y + 5, "☕");
        var coffeeEmojis = ["😊", "💨", "✨", "💪"];
        var coffeeCount = 0;
        var coffeeInterval = setInterval(function () {
          if (coffeeCount < 4) {
            createSheepParticle(x, y, coffeeEmojis[coffeeCount]);
            coffeeCount++;
          } else {
            clearInterval(coffeeInterval);
          }
        }, 700);
        break;
      }
      case "photo": {
        setTimeout(function () {
          createSheepParticle(x, y, "✌️");
        }, 500);
        setTimeout(function () {
          createSheepParticle(x + 30, y, "📸");
          createSheepParticle(x, y, "✨");
          createSheepParticle(x - 10, y - 10, "✨");
          createSheepParticle(x + 10, y - 10, "✨");
        }, 1500);
        break;
      }
      case "music": {
        var instruments = ["🎸", "🎹", "🥁", "🎺", "🎻"];
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 15 : -15), y + 5, instruments[Math.floor(Math.random() * instruments.length)], "eat");
        var musicEmojis = ["🎵", "🎶", "✨"];
        var musicCount = 0;
        var musicInterval = setInterval(function () {
          if (musicCount < 6) {
            createSheepParticle(x + (Math.random() - 0.5) * 30, y, musicEmojis[Math.floor(Math.random() * musicEmojis.length)]);
            musicCount++;
          } else {
            clearInterval(musicInterval);
          }
        }, 450);
        break;
      }
      case "butterfly": {
        createSheepParticle(x, y, "🦋");
        var butterflyEmojis = ["✨", "🌸", "🌼", "😊"];
        var butterflyCount = 0;
        var butterflyInterval = setInterval(function () {
          if (butterflyCount < 4) {
            createSheepParticle(x + (Math.random() - 0.5) * 20, y, butterflyEmojis[Math.floor(Math.random() * butterflyEmojis.length)]);
            butterflyCount++;
          } else {
            clearInterval(butterflyInterval);
          }
        }, 600);
        break;
      }
      case "countingSheep": {
        var countEmojis = ["🐑", "1️⃣", "🐑", "2️⃣", "🐑", "3️⃣", "💤"];
        var countIndex = 0;
        var countInterval = setInterval(function () {
          if (countIndex < countEmojis.length) {
            createSheepParticle(x, y, countEmojis[countIndex]);
            countIndex++;
          } else {
            clearInterval(countInterval);
          }
        }, 500);
        break;
      }
      case "crown": {
        setTimeout(function () {
          createSheepParticle(x, y - 15, "👑");
        }, 500);
        var crownEmojis = ["✨", "🌟", "💎"];
        var crownCount = 0;
        var crownInterval = setInterval(function () {
          if (crownCount < 5) {
            createSheepParticle(x + (Math.random() - 0.5) * 30, y, crownEmojis[Math.floor(Math.random() * crownEmojis.length)]);
            crownCount++;
          } else {
            clearInterval(crownInterval);
          }
        }, 500);
        break;
      }
      case "birthday": {
        createSheepParticle(x, y - 10, "🎂");
        var birthdayEmojis = ["🎁", "🎈", "🎉", "🎊", "✨"];
        var birthdayCount = 0;
        var birthdayInterval = setInterval(function () {
          if (birthdayCount < 6) {
            createSheepParticle(x + (Math.random() - 0.5) * 40, y, birthdayEmojis[Math.floor(Math.random() * birthdayEmojis.length)]);
            birthdayCount++;
          } else {
            clearInterval(birthdayInterval);
          }
        }, 450);
        break;
      }
      case "soccer": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 25 : -25), y + 10, "⚽");
        var soccerEmojis = ["🥅", "✨", "💪", "🏆"];
        var soccerCount = 0;
        var soccerInterval = setInterval(function () {
          if (soccerCount < 4) {
            createSheepParticle(x, y, soccerEmojis[Math.floor(Math.random() * soccerEmojis.length)]);
            soccerCount++;
          } else {
            clearInterval(soccerInterval);
          }
        }, 600);
        break;
      }
      case "basketball": {
        createSheepParticle(x, y - 20, "🏀");
        setTimeout(function () {
          createSheepParticle(x + 20, y - 30, "🏀");
        }, 800);
        setTimeout(function () {
          createSheepParticle(x + 25, y - 35, "🏆");
          createSheepParticle(x, y, "✨");
        }, 1600);
        break;
      }
      case "golf": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 20 : -20), y + 5, "⛳");
        setTimeout(function () {
          createSheepParticle(x, y, "🏌️");
        }, 800);
        setTimeout(function () {
          createSheepParticle(x + (sheep.classList.contains("flipped") ? 40 : -40), y - 20, "✨");
        }, 1500);
        break;
      }
      case "tennis": {
        var tennisEmojis = ["🎾", "🏸", "✨"];
        var tennisCount = 0;
        var tennisInterval = setInterval(function () {
          if (tennisCount < 5) {
            var side = tennisCount % 2 === 0 ? 25 : -25;
            createSheepParticle(x + side, y, tennisEmojis[Math.floor(Math.random() * tennisEmojis.length)]);
            tennisCount++;
          } else {
            clearInterval(tennisInterval);
          }
        }, 500);
        break;
      }
      case "bowling": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 30 : -30), y, "🎳");
        setTimeout(function () {
          createSheepParticle(x + (sheep.classList.contains("flipped") ? 40 : -40), y, "🎳");
          createSheepParticle(x + (sheep.classList.contains("flipped") ? 35 : -35), y - 10, "🎳");
          createSheepParticle(x, y, "✨");
        }, 1500);
        break;
      }
      case "videoGames": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 15 : -15), y, "🎮");
        var gameEmojis = ["👾", "🕹️", "✨", "🏆", "💯"];
        var gameCount = 0;
        var gameInterval = setInterval(function () {
          if (gameCount < 5) {
            createSheepParticle(x, y, gameEmojis[Math.floor(Math.random() * gameEmojis.length)]);
            gameCount++;
          } else {
            clearInterval(gameInterval);
          }
        }, 500);
        break;
      }
      case "pizza": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 15 : -15), y + 5, "🍕");
        var pizzaEmojis = ["😋", "🤤", "✨", "👌"];
        var pizzaCount = 0;
        var pizzaInterval = setInterval(function () {
          if (pizzaCount < 4) {
            createSheepParticle(x, y, pizzaEmojis[pizzaCount]);
            pizzaCount++;
          } else {
            clearInterval(pizzaInterval);
          }
        }, 600);
        break;
      }
      case "iceCream": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 15 : -15), y, "🍦");
        var iceCreamEmojis = ["🍨", "😋", "✨", "💕"];
        var iceCreamCount = 0;
        var iceCreamInterval = setInterval(function () {
          if (iceCreamCount < 4) {
            createSheepParticle(x, y, iceCreamEmojis[iceCreamCount]);
            iceCreamCount++;
          } else {
            clearInterval(iceCreamInterval);
          }
        }, 600);
        break;
      }
      case "picnic": {
        createSheepParticle(x, y + 15, "🧂");
        var picnicEmojis = ["🥪", "🍎", "🧃", "🍓", "✨"];
        var picnicCount = 0;
        var picnicInterval = setInterval(function () {
          if (picnicCount < 5) {
            createSheepParticle(x + (Math.random() - 0.5) * 30, y + 10, picnicEmojis[Math.floor(Math.random() * picnicEmojis.length)], "eat");
            picnicCount++;
          } else {
            clearInterval(picnicInterval);
          }
        }, 550);
        break;
      }
      case "bbq": {
        createSheepParticle(x + 20, y + 5, "🔥");
        var bbqEmojis = ["🍖", "🍗", "💨", "✨", "😋"];
        var bbqCount = 0;
        var bbqInterval = setInterval(function () {
          if (bbqCount < 5) {
            createSheepParticle(x, y, bbqEmojis[Math.floor(Math.random() * bbqEmojis.length)]);
            bbqCount++;
          } else {
            clearInterval(bbqInterval);
          }
        }, 550);
        break;
      }
      case "christmas": {
        createSheepParticle(x, y - 15, "🎄");
        var christmasEmojis = ["🎅", "🎁", "❄️", "✨", "🔔"];
        var christmasCount = 0;
        var christmasInterval = setInterval(function () {
          if (christmasCount < 6) {
            createSheepParticle(x + (Math.random() - 0.5) * 30, y, christmasEmojis[Math.floor(Math.random() * christmasEmojis.length)]);
            christmasCount++;
          } else {
            clearInterval(christmasInterval);
          }
        }, 500);
        break;
      }
      case "valentine": {
        var valentineEmojis = ["💘", "💌", "💝", "💗", "🌹"];
        var valentineCount = 0;
        var valentineInterval = setInterval(function () {
          if (valentineCount < 6) {
            createSheepParticle(x + (Math.random() - 0.5) * 30, y, valentineEmojis[Math.floor(Math.random() * valentineEmojis.length)]);
            valentineCount++;
          } else {
            clearInterval(valentineInterval);
          }
        }, 500);
        break;
      }
      case "fireworks": {
        var fireworkEmojis = ["🎆", "🎇", "✨", "🌟"];
        var fireworkCount = 0;
        var fireworkInterval = setInterval(function () {
          if (fireworkCount < 8) {
            createSheepParticle(x + (Math.random() - 0.5) * 50, y - 20 - Math.random() * 30, fireworkEmojis[Math.floor(Math.random() * fireworkEmojis.length)]);
            fireworkCount++;
          } else {
            clearInterval(fireworkInterval);
          }
        }, 400);
        break;
      }
      case "detective": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 15 : -15), y, "🔍");
        var detectiveEmojis = ["🕵️", "🔎", "🧐", "❓"];
        var detectiveCount = 0;
        var detectiveInterval = setInterval(function () {
          if (detectiveCount < 4) {
            createSheepParticle(x, y, detectiveEmojis[Math.floor(Math.random() * detectiveEmojis.length)]);
            detectiveCount++;
          } else {
            clearInterval(detectiveInterval);
          }
        }, 650);
        break;
      }
      case "astronaut": {
        createSheepParticle(x, y - 25, "🚀");
        var spaceEmojis = ["🌙", "⭐", "🌟", "🪐", "✨"];
        var spaceCount = 0;
        var spaceInterval = setInterval(function () {
          if (spaceCount < 6) {
            createSheepParticle(x + (Math.random() - 0.5) * 40, y - 10, spaceEmojis[Math.floor(Math.random() * spaceEmojis.length)]);
            spaceCount++;
          } else {
            clearInterval(spaceInterval);
          }
        }, 450);
        break;
      }
      case "doctor": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 15 : -15), y, "🩺");
        var doctorEmojis = ["💊", "❤️‍🩹", "✨", "🧪"];
        var doctorCount = 0;
        var doctorInterval = setInterval(function () {
          if (doctorCount < 4) {
            createSheepParticle(x, y, doctorEmojis[doctorCount]);
            doctorCount++;
          } else {
            clearInterval(doctorInterval);
          }
        }, 650);
        break;
      }
      case "praying": {
        var prayerEmojis = ["🙏", "✨", "👼", "❤️", "🕊️", "✝️"];
        var prayerCount = 0;
        var prayerInterval = setInterval(function () {
          if (prayerCount < 5) {
            createSheepParticle(x, y, prayerEmojis[Math.floor(Math.random() * prayerEmojis.length)]);
            prayerCount++;
          } else {
            clearInterval(prayerInterval);
          }
        }, 650);
        break;
      }
      case "bee": {
        var beeEmojis = ["🐝", "🌻", "🌸", "🌼"];
        var beeCount = 0;
        var beeInterval = setInterval(function () {
          if (beeCount < 5) {
            createSheepParticle(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 20, beeEmojis[Math.floor(Math.random() * beeEmojis.length)]);
            beeCount++;
          } else {
            clearInterval(beeInterval);
          }
        }, 450);
        setTimeout(function () {
          createSheepParticle(x, y, "🍯");
        }, 2500);
        break;
      }
      case "birdWatching": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 20 : -20), y, "🔭");
        var birdEmojis = ["🐦", "🦜", "🦆", "🦉", "✨"];
        var birdCount = 0;
        var birdInterval = setInterval(function () {
          if (birdCount < 5) {
            createSheepParticle(x + (Math.random() - 0.5) * 50, y - 20, birdEmojis[Math.floor(Math.random() * birdEmojis.length)]);
            birdCount++;
          } else {
            clearInterval(birdInterval);
          }
        }, 550);
        break;
      }
      case "frog": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 25 : -25), y + 10, "🐸");
        var frogEmojis = ["💚", "✨", "🌿"];
        var frogCount = 0;
        var frogInterval = setInterval(function () {
          if (frogCount < 3) {
            createSheepParticle(x, y, frogEmojis[frogCount]);
            frogCount++;
          } else {
            clearInterval(frogInterval);
          }
        }, 700);
        break;
      }
      case "ladybug": {
        createSheepParticle(x, y, "🐞");
        var ladybugEmojis = ["🍀", "✨", "😊"];
        var ladybugCount = 0;
        var ladybugInterval = setInterval(function () {
          if (ladybugCount < 3) {
            createSheepParticle(x + (Math.random() - 0.5) * 20, y, ladybugEmojis[ladybugCount]);
            ladybugCount++;
          } else {
            clearInterval(ladybugInterval);
          }
        }, 700);
        break;
      }
      case "texting": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 15 : -15), y + 5, "📱");
        var textEmojis = ["💬", "😊", "👍", "❤️", "😂"];
        var textCount = 0;
        var textInterval = setInterval(function () {
          if (textCount < 5) {
            createSheepParticle(x, y, textEmojis[Math.floor(Math.random() * textEmojis.length)]);
            textCount++;
          } else {
            clearInterval(textInterval);
          }
        }, 500);
        break;
      }
      case "streaming": {
        createSheepParticle(x + 25, y, "📺");
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 15 : -15), y + 5, "🍿");
        var streamEmojis = ["😂", "😮", "🤩", "✨"];
        var streamCount = 0;
        var streamInterval = setInterval(function () {
          if (streamCount < 4) {
            createSheepParticle(x, y, streamEmojis[streamCount]);
            streamCount++;
          } else {
            clearInterval(streamInterval);
          }
        }, 650);
        break;
      }
      case "working": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 15 : -15), y + 5, "💻");
        var workEmojis = ["📊", "📈", "⌨️", "💡", "☕"];
        var workCount = 0;
        var workInterval = setInterval(function () {
          if (workCount < 5) {
            createSheepParticle(x, y, workEmojis[Math.floor(Math.random() * workEmojis.length)]);
            workCount++;
          } else {
            clearInterval(workInterval);
          }
        }, 550);
        break;
      }
      case "podcast": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 15 : -15), y - 5, "🎧");
        var podcastEmojis = ["🎙️", "💬", "🤔", "👍", "✨"];
        var podcastCount = 0;
        var podcastInterval = setInterval(function () {
          if (podcastCount < 4) {
            createSheepParticle(x, y, podcastEmojis[podcastCount]);
            podcastCount++;
          } else {
            clearInterval(podcastInterval);
          }
        }, 650);
        break;
      }
      case "balloon": {
        createSheepParticle(x, y - 20, "🎈");
        setTimeout(function () {
          createSheepParticle(x, y - 30, "🎈");
        }, 500);
        setTimeout(function () {
          createSheepParticle(x, y, "😮");
          createSheepParticle(x, y - 40, "🎈");
        }, 1000);
        setTimeout(function () {
          createSheepParticle(x, y, "😄");
        }, 2000);
        break;
      }
      case "dizzy": {
        var dizzyEmojis = ["😵‍💫", "💫", "🌀", "✨"];
        var dizzyCount = 0;
        var dizzyInterval = setInterval(function () {
          if (dizzyCount < 6) {
            createSheepParticle(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 20, dizzyEmojis[Math.floor(Math.random() * dizzyEmojis.length)]);
            dizzyCount++;
          } else {
            clearInterval(dizzyInterval);
          }
        }, 400);
        break;
      }
      case "hiccup": {
        var hiccupEmojis = ["🫨", "😯", "💨"];
        var hiccupCount = 0;
        var hiccupInterval = setInterval(function () {
          if (hiccupCount < 5) {
            createSheepParticle(x, y, hiccupEmojis[hiccupCount % hiccupEmojis.length]);
            hiccupCount++;
          } else {
            clearInterval(hiccupInterval);
          }
        }, 600);
        break;
      }
      case "yawn": {
        var yawnEmojis = ["🥱", "😴", "💤"];
        var yawnCount = 0;
        var yawnInterval = setInterval(function () {
          if (yawnCount < 4) {
            createSheepParticle(x, y, yawnEmojis[Math.floor(Math.random() * yawnEmojis.length)]);
            yawnCount++;
          } else {
            clearInterval(yawnInterval);
          }
        }, 700);
        break;
      }
      case "whistle": {
        var whistleEmojis = ["🎶", "😙", "💨", "🎵"];
        var whistleCount = 0;
        var whistleInterval = setInterval(function () {
          if (whistleCount < 5) {
            createSheepParticle(x + (sheep.classList.contains("flipped") ? 15 : -15), y - 5, whistleEmojis[Math.floor(Math.random() * whistleEmojis.length)]);
            whistleCount++;
          } else {
            clearInterval(whistleInterval);
          }
        }, 450);
        break;
      }
      case "treasure": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 20 : -20), y + 10, "💰");
        var treasureEmojis = ["💎", "🪙", "✨", "🌟", "🤩"];
        var treasureCount = 0;
        var treasureInterval = setInterval(function () {
          if (treasureCount < 6) {
            createSheepParticle(x + (Math.random() - 0.5) * 30, y, treasureEmojis[Math.floor(Math.random() * treasureEmojis.length)]);
            treasureCount++;
          } else {
            clearInterval(treasureInterval);
          }
        }, 450);
        break;
      }
      case "timeTravel": {
        var timeEmojis = ["⏰", "🌀", "✨", "🕰️", "🌟"];
        var timeCount = 0;
        var timeInterval = setInterval(function () {
          if (timeCount < 6) {
            createSheepParticle(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 30, timeEmojis[Math.floor(Math.random() * timeEmojis.length)]);
            timeCount++;
          } else {
            clearInterval(timeInterval);
          }
        }, 400);
        break;
      }
      case "clone": {
        var cloneEmojis = ["🐑", "🐑", "🐑", "✨"];
        var cloneCount = 0;
        var cloneInterval = setInterval(function () {
          if (cloneCount < 4) {
            createSheepParticle(x + (cloneCount - 1.5) * 25, y, cloneEmojis[cloneCount]);
            cloneCount++;
          } else {
            clearInterval(cloneInterval);
          }
        }, 500);
        break;
      }
      case "islandDrink": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 30 : -30), y, "🏖️");
        setTimeout(function () {
          createSheepParticle(x, y, "🏊");
        }, 1000);
        setTimeout(function () {
          createSheepParticle(x + (sheep.classList.contains("flipped") ? 35 : -35), y, "🌴");
          createSheepParticle(x, y, "😌");
        }, 2500);
        setTimeout(function () {
          createSheepParticle(x + (sheep.classList.contains("flipped") ? 20 : -20), y, "🍹");
          createSheepParticle(x, y, "😋");
          createSheepParticle(x, y - 10, "✨");
        }, 4000);
        break;
      }
      case "islandCoconut": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 30 : -30), y, "🏖️");
        setTimeout(function () {
          createSheepParticle(x, y, "🏊");
        }, 1000);
        setTimeout(function () {
          createSheepParticle(x + (sheep.classList.contains("flipped") ? 35 : -35), y, "🌴");
          createSheepParticle(x, y, "😌");
        }, 2500);
        setTimeout(function () {
          createSheepParticle(x, y - 25, "🥥", "fall");
        }, 4000);
        setTimeout(function () {
          createSheepParticle(x, y, "💥");
          createSheepParticle(x, y, "😵");
          createSheepParticle(x, y - 10, "⭐");
        }, 4500);
        break;
      }
      case "islandEscape": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? -30 : 30), y, "🏖️");
        createSheepParticle(x + (sheep.classList.contains("flipped") ? -35 : 35), y, "🌴");
        setTimeout(function () {
          createSheepParticle(x, y, "🏊");
          createSheepParticle(x, y, "💨");
        }, 1500);
        setTimeout(function () {
          createSheepParticle(x, y, "🌊");
          createSheepParticle(x + (sheep.classList.contains("flipped") ? 20 : -20), y, "😄");
        }, 3000);
        setTimeout(function () {
          createSheepParticle(x, y, "✨");
          createSheepParticle(x, y, "🎉");
        }, 4500);
        break;
      }
      case "surf": {
        createSheepParticle(x, y + 10, "🏄");
        var surfEmojis = ["🌊", "✨", "🤙", "😎"];
        var surfCount = 0;
        var surfInterval = setInterval(function () {
          if (surfCount < 6) {
            createSheepParticle(x + (Math.random() - 0.5) * 40, y + 15, surfEmojis[Math.floor(Math.random() * surfEmojis.length)]);
            surfCount++;
          } else {
            clearInterval(surfInterval);
          }
        }, 500);
        break;
      }
      case "car": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 20 : -20), y + 5, "🚗");
        var carEmojis = ["💨", "✨", "🏎️", "🚕"];
        var carCount = 0;
        var carInterval = setInterval(function () {
          if (carCount < 4) {
            createSheepParticle(x + (sheep.classList.contains("flipped") ? -15 : 15), y + 10, carEmojis[Math.floor(Math.random() * carEmojis.length)]);
            carCount++;
          } else {
            clearInterval(carInterval);
          }
        }, 600);
        break;
      }
      case "bus": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 25 : -25), y + 5, "🚌");
        var busEmojis = ["🚏", "💨", "✨", "👋"];
        var busCount = 0;
        var busInterval = setInterval(function () {
          if (busCount < 4) {
            createSheepParticle(x, y, busEmojis[busCount]);
            busCount++;
          } else {
            clearInterval(busInterval);
          }
        }, 700);
        break;
      }
      case "train": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 25 : -25), y + 5, "🚂");
        var trainEmojis = ["🚃", "🚃", "💨", "✨"];
        var trainCount = 0;
        var trainInterval = setInterval(function () {
          if (trainCount < 4) {
            createSheepParticle(x + (sheep.classList.contains("flipped") ? 25 + trainCount * 15 : -25 - trainCount * 15), y + 5, trainEmojis[trainCount]);
            trainCount++;
          } else {
            clearInterval(trainInterval);
          }
        }, 400);
        break;
      }
      case "airplane": {
        createSheepParticle(x, y - 20, "✈️");
        var planeEmojis = ["☁️", "✨", "🌟", "💨"];
        var planeCount = 0;
        var planeInterval = setInterval(function () {
          if (planeCount < 5) {
            createSheepParticle(x + (Math.random() - 0.5) * 50, y - 25, planeEmojis[Math.floor(Math.random() * planeEmojis.length)]);
            planeCount++;
          } else {
            clearInterval(planeInterval);
          }
        }, 500);
        break;
      }
      case "bicycle": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 15 : -15), y + 8, "🚲");
        var bikeEmojis = ["💨", "✨", "💪", "😄"];
        var bikeCount = 0;
        var bikeInterval = setInterval(function () {
          if (bikeCount < 4) {
            createSheepParticle(x, y, bikeEmojis[bikeCount]);
            bikeCount++;
          } else {
            clearInterval(bikeInterval);
          }
        }, 600);
        break;
      }
      case "motorcycle": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 20 : -20), y + 5, "🏍️");
        var motoEmojis = ["💨", "🔥", "✨", "😎"];
        var motoCount = 0;
        var motoInterval = setInterval(function () {
          if (motoCount < 4) {
            createSheepParticle(x + (sheep.classList.contains("flipped") ? -15 : 15), y + 5, motoEmojis[Math.floor(Math.random() * motoEmojis.length)]);
            motoCount++;
          } else {
            clearInterval(motoInterval);
          }
        }, 500);
        break;
      }
      case "boat": {
        createSheepParticle(x, y + 10, "⛵");
        var boatEmojis = ["🌊", "✨", "🐟", "🦐"];
        var boatCount = 0;
        var boatInterval = setInterval(function () {
          if (boatCount < 5) {
            createSheepParticle(x + (Math.random() - 0.5) * 40, y + 15, boatEmojis[Math.floor(Math.random() * boatEmojis.length)]);
            boatCount++;
          } else {
            clearInterval(boatInterval);
          }
        }, 550);
        break;
      }
      case "helicopter": {
        createSheepParticle(x, y - 20, "🚁");
        var heliEmojis = ["💨", "✨", "🌟"];
        var heliCount = 0;
        var heliInterval = setInterval(function () {
          if (heliCount < 5) {
            createSheepParticle(x + (Math.random() - 0.5) * 30, y - 15, heliEmojis[Math.floor(Math.random() * heliEmojis.length)]);
            heliCount++;
          } else {
            clearInterval(heliInterval);
          }
        }, 450);
        break;
      }
      case "hotAirBalloon": {
        createSheepParticle(x, y - 25, "🎈");
        setTimeout(function () {
          createSheepParticle(x, y - 30, "🎈");
        }, 800);
        setTimeout(function () {
          createSheepParticle(x, y - 35, "🌈");
          createSheepParticle(x, y, "😍");
        }, 1600);
        var balloonEmojis = ["✨", "☁️", "🌞"];
        var balloonCount = 0;
        var balloonInterval = setInterval(function () {
          if (balloonCount < 4) {
            createSheepParticle(x + (Math.random() - 0.5) * 40, y - 20, balloonEmojis[Math.floor(Math.random() * balloonEmojis.length)]);
            balloonCount++;
          } else {
            clearInterval(balloonInterval);
          }
        }, 700);
        break;
      }
      case "skateboard": {
        createSheepParticle(x, y + 12, "🛹");
        var skateEmojis = ["🤙", "✨", "💪", "😎"];
        var skateCount = 0;
        var skateInterval = setInterval(function () {
          if (skateCount < 4) {
            createSheepParticle(x, y, skateEmojis[skateCount]);
            skateCount++;
          } else {
            clearInterval(skateInterval);
          }
        }, 600);
        break;
      }
      case "scooter": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 15 : -15), y + 8, "🛴");
        var scooterEmojis = ["💨", "✨", "😄", "🍃"];
        var scooterCount = 0;
        var scooterInterval = setInterval(function () {
          if (scooterCount < 4) {
            createSheepParticle(x + (sheep.classList.contains("flipped") ? -10 : 10), y + 5, scooterEmojis[Math.floor(Math.random() * scooterEmojis.length)]);
            scooterCount++;
          } else {
            clearInterval(scooterInterval);
          }
        }, 550);
        break;
      }
      case "tractor": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 25 : -25), y + 5, "🚜");
        var tractorEmojis = ["🌾", "🌻", "💨", "✨"];
        var tractorCount = 0;
        var tractorInterval = setInterval(function () {
          if (tractorCount < 4) {
            createSheepParticle(x + (Math.random() - 0.5) * 30, y + 10, tractorEmojis[Math.floor(Math.random() * tractorEmojis.length)]);
            tractorCount++;
          } else {
            clearInterval(tractorInterval);
          }
        }, 600);
        break;
      }
      case "rocket": {
        createSheepParticle(x, y - 15, "🚀");
        var rocketEmojis = ["🔥", "✨", "🌟", "💫"];
        var rocketCount = 0;
        var rocketInterval = setInterval(function () {
          if (rocketCount < 6) {
            createSheepParticle(x + (Math.random() - 0.5) * 20, y + 10, rocketEmojis[Math.floor(Math.random() * rocketEmojis.length)]);
            rocketCount++;
          } else {
            clearInterval(rocketInterval);
          }
        }, 400);
        break;
      }
      case "meetDog": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 35 : -35), y, "🐕");
        var dogConvo = ["💬", "🐶", "👋", "😊", "🐾", "❤️"];
        var dogCount = 0;
        var dogInterval = setInterval(function () {
          if (dogCount < dogConvo.length) {
            createSheepParticle(x + (dogCount % 2 === 0 ? 0 : (sheep.classList.contains("flipped") ? 25 : -25)), y - 10, dogConvo[dogCount]);
            dogCount++;
          } else {
            clearInterval(dogInterval);
          }
        }, 700);
        break;
      }
      case "meetCow": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 40 : -40), y, "🐄");
        var cowConvo = ["💬", "🦛", "🌾", "😊", "🥛", "✨"];
        var cowCount = 0;
        var cowInterval = setInterval(function () {
          if (cowCount < cowConvo.length) {
            createSheepParticle(x + (cowCount % 2 === 0 ? 0 : (sheep.classList.contains("flipped") ? 30 : -30)), y - 10, cowConvo[cowCount]);
            cowCount++;
          } else {
            clearInterval(cowInterval);
          }
        }, 700);
        break;
      }
      case "meetHorse": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 40 : -40), y, "🐎");
        var horseConvo = ["💬", "🐴", "🌿", "😄", "🏇", "✨"];
        var horseCount = 0;
        var horseInterval = setInterval(function () {
          if (horseCount < horseConvo.length) {
            createSheepParticle(x + (horseCount % 2 === 0 ? 0 : (sheep.classList.contains("flipped") ? 30 : -30)), y - 10, horseConvo[horseCount]);
            horseCount++;
          } else {
            clearInterval(horseInterval);
          }
        }, 700);
        break;
      }
      case "meetGoat": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 35 : -35), y, "🐐");
        var goatConvo = ["💬", "🐐", "🤝", "😄", "🌿", "💕"];
        var goatCount = 0;
        var goatInterval = setInterval(function () {
          if (goatCount < goatConvo.length) {
            createSheepParticle(x + (goatCount % 2 === 0 ? 0 : (sheep.classList.contains("flipped") ? 25 : -25)), y - 10, goatConvo[goatCount]);
            goatCount++;
          } else {
            clearInterval(goatInterval);
          }
        }, 700);
        break;
      }
      case "meetPig": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 35 : -35), y, "🐖");
        var pigConvo = ["💬", "🐷", "😋", "😄", "🌽", "❤️"];
        var pigCount = 0;
        var pigInterval = setInterval(function () {
          if (pigCount < pigConvo.length) {
            createSheepParticle(x + (pigCount % 2 === 0 ? 0 : (sheep.classList.contains("flipped") ? 25 : -25)), y - 10, pigConvo[pigCount]);
            pigCount++;
          } else {
            clearInterval(pigInterval);
          }
        }, 700);
        break;
      }
      case "meetChicken": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 30 : -30), y + 5, "🐔");
        var chickenConvo = ["💬", "🐣", "🥚", "😄", "🌾", "✨"];
        var chickenCount = 0;
        var chickenInterval = setInterval(function () {
          if (chickenCount < chickenConvo.length) {
            createSheepParticle(x + (chickenCount % 2 === 0 ? 0 : (sheep.classList.contains("flipped") ? 20 : -20)), y - 10, chickenConvo[chickenCount]);
            chickenCount++;
          } else {
            clearInterval(chickenInterval);
          }
        }, 650);
        break;
      }
      case "meetDuck": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 30 : -30), y + 5, "🦆");
        var duckConvo = ["💬", "🦆", "💦", "😄", "🌿", "💛"];
        var duckCount = 0;
        var duckInterval = setInterval(function () {
          if (duckCount < duckConvo.length) {
            createSheepParticle(x + (duckCount % 2 === 0 ? 0 : (sheep.classList.contains("flipped") ? 20 : -20)), y - 10, duckConvo[duckCount]);
            duckCount++;
          } else {
            clearInterval(duckInterval);
          }
        }, 650);
        break;
      }
      case "meetCat": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 30 : -30), y + 5, "🐈");
        var catConvo = ["💬", "🐱", "😺", "😄", "💤", "❤️"];
        var catCount = 0;
        var catInterval = setInterval(function () {
          if (catCount < catConvo.length) {
            createSheepParticle(x + (catCount % 2 === 0 ? 0 : (sheep.classList.contains("flipped") ? 20 : -20)), y - 10, catConvo[catCount]);
            catCount++;
          } else {
            clearInterval(catInterval);
          }
        }, 700);
        break;
      }
      case "meetRabbit": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 28 : -28), y + 8, "🐇");
        var rabbitConvo = ["💬", "🐰", "🥕", "😄", "🌿", "💕"];
        var rabbitCount = 0;
        var rabbitInterval = setInterval(function () {
          if (rabbitCount < rabbitConvo.length) {
            createSheepParticle(x + (rabbitCount % 2 === 0 ? 0 : (sheep.classList.contains("flipped") ? 18 : -18)), y - 10, rabbitConvo[rabbitCount]);
            rabbitCount++;
          } else {
            clearInterval(rabbitInterval);
          }
        }, 650);
        break;
      }
      case "meetDeer": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 40 : -40), y, "🦌");
        var deerConvo = ["💬", "🦌", "🌲", "😊", "🌿", "✨"];
        var deerCount = 0;
        var deerInterval = setInterval(function () {
          if (deerCount < deerConvo.length) {
            createSheepParticle(x + (deerCount % 2 === 0 ? 0 : (sheep.classList.contains("flipped") ? 30 : -30)), y - 10, deerConvo[deerCount]);
            deerCount++;
          } else {
            clearInterval(deerInterval);
          }
        }, 750);
        break;
      }
      case "meetDonkey": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 40 : -40), y, "🫎");
        var donkeyConvo = ["💬", "🫎", "🌾", "😄", "🤝", "❤️"];
        var donkeyCount = 0;
        var donkeyInterval = setInterval(function () {
          if (donkeyCount < donkeyConvo.length) {
            createSheepParticle(x + (donkeyCount % 2 === 0 ? 0 : (sheep.classList.contains("flipped") ? 30 : -30)), y - 10, donkeyConvo[donkeyCount]);
            donkeyCount++;
          } else {
            clearInterval(donkeyInterval);
          }
        }, 700);
        break;
      }
      case "meetOwl": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 25 : -25), y - 15, "🦉");
        var owlConvo = ["💬", "🦉", "🌙", "😊", "💡", "✨"];
        var owlCount = 0;
        var owlInterval = setInterval(function () {
          if (owlCount < owlConvo.length) {
            createSheepParticle(x + (owlCount % 2 === 0 ? 0 : (sheep.classList.contains("flipped") ? 15 : -15)), y - 20, owlConvo[owlCount]);
            owlCount++;
          } else {
            clearInterval(owlInterval);
          }
        }, 750);
        break;
      }
      case "meetMouse": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 20 : -20), y + 12, "🐁");
        var mouseConvo = ["💬", "🐭", "🧀", "😄", "👋", "💕"];
        var mouseCount = 0;
        var mouseInterval = setInterval(function () {
          if (mouseCount < mouseConvo.length) {
            createSheepParticle(x + (mouseCount % 2 === 0 ? 0 : (sheep.classList.contains("flipped") ? 12 : -12)), y - 5, mouseConvo[mouseCount]);
            mouseCount++;
          } else {
            clearInterval(mouseInterval);
          }
        }, 600);
        break;
      }
      case "meetLlama": {
        createSheepParticle(x + (sheep.classList.contains("flipped") ? 40 : -40), y - 5, "🦙");
        var llamaConvo = ["💬", "🦙", "✨", "😄", "🌿", "🤝", "💕"];
        var llamaCount = 0;
        var llamaInterval = setInterval(function () {
          if (llamaCount < llamaConvo.length) {
            createSheepParticle(x + (llamaCount % 2 === 0 ? 0 : (sheep.classList.contains("flipped") ? 30 : -30)), y - 15, llamaConvo[llamaCount]);
            llamaCount++;
          } else {
            clearInterval(llamaInterval);
          }
        }, 650);
        break;
      }
    }
  }

  function pickRandomAction() {
    var totalWeight = sheepActions.reduce(function (sum, a) {
      return sum + a.weight;
    }, 0);
    var random = Math.random() * totalWeight;
    for (var i = 0; i < sheepActions.length; i++) {
      random -= sheepActions[i].weight;
      if (random <= 0) return sheepActions[i].name;
    }
    return sheepActions[0].name;
  }

  var activeSheep = [];

  function createRogueSheep() {
    var sheep = document.createElement("div");
    sheep.className = "rogue-sheep";
    sheep.textContent = Math.random() < 0.5 ? "🐑" : "🐏";

    var sizeScale = 0.75 + Math.random() * 0.5;
    sheep.style.fontSize = 32 * sizeScale + "px";

    var isBlackSheep = Math.random() < 0.01;
    if (isBlackSheep) {
      sheep.classList.add("black-sheep");
    }

    sheep.setAttribute("aria-hidden", "true");
    document.body.appendChild(sheep);

    var viewWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    var viewHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    var safeAreaBottom = 50;

    var entrySide = Math.floor(Math.random() * 4);
    var x, y;

    switch (entrySide) {
      case 0:
        x = Math.random() * viewWidth;
        y = -40;
        break;
      case 1:
        x = viewWidth + 40;
        y = Math.random() * viewHeight;
        break;
      case 2:
        x = Math.random() * viewWidth;
        y = viewHeight + 40;
        break;
      case 3:
      default:
        x = -40;
        y = Math.random() * viewHeight;
        break;
    }

    sheep.style.left = x + "px";
    sheep.style.top = y + "px";

    var screenDiagonal = Math.sqrt(viewWidth * viewWidth + viewHeight * viewHeight);
    var referenceDiagonal = 1500;
    var speedScale = screenDiagonal / referenceDiagonal;
    var baseSpeed = (1.5 + Math.random() * 2) * speedScale;
    var stepInterval = 40;

    var centerX = viewWidth / 2;
    var centerY = (viewHeight - safeAreaBottom) / 2;
    var angle = Math.atan2(centerY - y, centerX - x) + (Math.random() - 0.5) * Math.PI * 0.3;
    var currentX = x;
    var currentY = y;
    var lastX = x;

    var startTime = Date.now();
    var exitPhaseStart = 45000 + Math.random() * 15000;

    var currentBehavior = "purposeful";
    var behaviorEndTime = Date.now() + 3000 + Math.random() * 2000;
    var targetX = centerX + (Math.random() - 0.5) * viewWidth * 0.5;
    var targetY = centerY + (Math.random() - 0.5) * viewHeight * 0.5;
    var loopAngle = 0;
    var loopDirection = Math.random() < 0.5 ? 1 : -1;

    var oscillatorPhase = Math.random() * Math.PI * 2;
    var oscillatorSpeed = 0.001 + Math.random() * 0.002;

    var isPaused = false;
    var isFirstBehaviorChange = true;

    var exitTarget = null;

    function pickNewBehavior() {
      var timeOnScreen = Date.now() - startTime;

      if (timeOnScreen > exitPhaseStart && !exitTarget) {
        var exitSide = Math.floor(Math.random() * 4);
        switch (exitSide) {
          case 0:
            exitTarget = { x: Math.random() * viewWidth, y: -60 };
            break;
          case 1:
            exitTarget = { x: viewWidth + 60, y: Math.random() * viewHeight };
            break;
          case 2:
            exitTarget = { x: Math.random() * viewWidth, y: viewHeight + 60 };
            break;
          case 3:
            exitTarget = { x: -60, y: Math.random() * viewHeight };
            break;
        }
      }

      if (exitTarget) {
        currentBehavior = "exiting";
        return;
      }

      var rand = Math.random() * 11;
      if (rand < 2) {
        currentBehavior = "purposeful";
        targetX = 100 + Math.random() * (viewWidth - 200);
        targetY = 100 + Math.random() * (viewHeight - 200);
      } else if (rand < 4) {
        currentBehavior = "wandering";
      } else if (rand < 6) {
        currentBehavior = "grazing";
      } else if (rand < 8) {
        currentBehavior = "curious";
        loopDirection = Math.random() < 0.5 ? 1 : -1;
        loopAngle = 0;
      } else if (rand < 10) {
        if (isFirstBehaviorChange) {
          currentBehavior = "wandering";
        } else {
          currentBehavior = "trotting";
        }
      } else {
        if (currentX > 50 && currentX < viewWidth - 50 && currentY > 50 && currentY < viewHeight - safeAreaBottom - 50) {
          currentBehavior = "performing";
          isPaused = true;
          var action = pickRandomAction();
          performSheepAction(sheep, action, isBlackSheep, currentX, currentY);

          var pauseDuration = 10000 + Math.random() * 10000;
          behaviorEndTime = Date.now() + pauseDuration;
          setTimeout(function () {
            isPaused = false;
          }, pauseDuration);
          return;
        } else {
          currentBehavior = "purposeful";
          targetX = 100 + Math.random() * (viewWidth - 200);
          targetY = 100 + Math.random() * (viewHeight - safeAreaBottom - 200);
        }
      }

      behaviorEndTime = Date.now() + 5000 + Math.random() * 10000;
      isFirstBehaviorChange = false;
    }

    var moveInterval = setInterval(function () {
      var timeOnScreen = Date.now() - startTime;

      if (isPaused) return;

      if (Date.now() > behaviorEndTime) {
        pickNewBehavior();
      }

      oscillatorPhase += oscillatorSpeed * stepInterval;
      var oscillation = Math.sin(oscillatorPhase);

      var speed = baseSpeed;
      var turnAmount = 0;

      switch (currentBehavior) {
        case "purposeful": {
          var angleToTarget = Math.atan2(targetY - currentY, targetX - currentX);
          var angleDiff = angleToTarget - angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          turnAmount = angleDiff * 0.1;
          speed = baseSpeed * (1 + oscillation * 0.2);

          if (Math.hypot(targetX - currentX, targetY - currentY) < 50) {
            behaviorEndTime = 0;
          }
          break;
        }

        case "wandering": {
          var wanderStrength = 0.3 + oscillation * 0.2;
          turnAmount = (Math.random() - 0.5) * 0.15 * wanderStrength;
          speed = baseSpeed * (0.8 + oscillation * 0.3);

          if (Math.random() < 0.01) {
            turnAmount += (Math.random() - 0.5) * 0.5;
          }
          break;
        }

        case "grazing": {
          turnAmount = (Math.random() - 0.5) * 0.3;
          speed = baseSpeed * 0.2 * (0.5 + Math.random() * 0.5);

          if (Math.random() < 0.3) {
            speed = 0;
          }
          break;
        }

        case "curious": {
          loopAngle += 0.05 * loopDirection;
          turnAmount = 0.08 * loopDirection + (Math.random() - 0.5) * 0.05;
          speed = baseSpeed * 0.7;

          if (Math.abs(loopAngle) > Math.PI * 3) {
            behaviorEndTime = 0;
          }
          break;
        }

        case "trotting": {
          turnAmount = (Math.random() - 0.5) * 0.05;
          speed = baseSpeed * 1.8;
          break;
        }

        case "performing": {
          speed = 0;
          turnAmount = 0;
          break;
        }

        case "exiting": {
          var angleToExit = Math.atan2(exitTarget.y - currentY, exitTarget.x - currentX);
          var exitAngleDiff = angleToExit - angle;
          while (exitAngleDiff > Math.PI) exitAngleDiff -= Math.PI * 2;
          while (exitAngleDiff < -Math.PI) exitAngleDiff += Math.PI * 2;
          turnAmount = exitAngleDiff * 0.15;
          speed = baseSpeed * 1.2;
          break;
        }
      }

      angle += turnAmount;

      if (currentBehavior !== "exiting" && timeOnScreen < 5000) {
        var edgeMargin = 80;
        var edgePush = 0;
        if (currentX < edgeMargin) edgePush = Math.max(edgePush, (edgeMargin - currentX) / edgeMargin);
        if (currentX > viewWidth - edgeMargin) edgePush = Math.max(edgePush, (currentX - (viewWidth - edgeMargin)) / edgeMargin);
        if (currentY < edgeMargin) edgePush = Math.max(edgePush, (edgeMargin - currentY) / edgeMargin);
        if (currentY > viewHeight - safeAreaBottom - edgeMargin) edgePush = Math.max(edgePush, (currentY - (viewHeight - safeAreaBottom - edgeMargin)) / edgeMargin);

        if (edgePush > 0) {
          var angleToCenter = Math.atan2(centerY - currentY, centerX - currentX);
          var centerAngleDiff = angleToCenter - angle;
          while (centerAngleDiff > Math.PI) centerAngleDiff -= Math.PI * 2;
          while (centerAngleDiff < -Math.PI) centerAngleDiff += Math.PI * 2;
          angle += centerAngleDiff * edgePush * 0.08;
        }
      }

      currentX += Math.cos(angle) * speed;
      currentY += Math.sin(angle) * speed;

      var wobbleIntensity = 0.4 + (speed / baseSpeed) * 0.8;
      var wobbleX = (Math.random() - 0.5) * wobbleIntensity;
      var wobbleY = (Math.random() - 0.5) * wobbleIntensity;

      sheep.style.left = currentX + wobbleX + "px";
      sheep.style.top = currentY + wobbleY + "px";

      if (currentX > lastX + 0.3) {
        sheep.classList.add("flipped");
      } else if (currentX < lastX - 0.3) {
        sheep.classList.remove("flipped");
      }
      lastX = currentX;

      if (currentX < -60 || currentX > viewWidth + 60 || currentY < -60 || currentY > viewHeight + 60) {
        clearInterval(moveInterval);
        sheep.remove();
        activeSheep = activeSheep.filter(function (s) {
          return s !== sheep;
        });
      }
    }, stepInterval);

    activeSheep.push(sheep);
  }

  var rogueSheepTimer = null;

  function startRogueSheep() {
    if (rogueSheepTimer) return;

    var scheduleNextSheep = function () {
      var delay = 30000 + Math.random() * 60000;
      rogueSheepTimer = setTimeout(function () {
        if (isEnabled()) {
          createRogueSheep();
          scheduleNextSheep();
        }
      }, delay);
    };

    rogueSheepTimer = setTimeout(function () {
      if (isEnabled()) {
        createRogueSheep();
        scheduleNextSheep();
      }
    }, 5000 + Math.random() * 10000);
  }

  function stopRogueSheep() {
    if (rogueSheepTimer) {
      clearTimeout(rogueSheepTimer);
      rogueSheepTimer = null;
    }
    activeSheep.forEach(function (sheep) {
      sheep.remove();
    });
    activeSheep = [];
  }

  function initToggleButton() {
    var footer = document.querySelector("footer.site-footer nav") || document.querySelector("footer.site-footer") || document.querySelector("footer");
    if (!footer) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rogue-sheep-toggle";
    btn.innerHTML =
      '<span class="rogue-sheep-toggle-status rogue-sheep-toggle-status-off" aria-hidden="true">💤</span>' +
      '<span aria-hidden="true">🐑</span>' +
      '<span class="rogue-sheep-toggle-status rogue-sheep-toggle-status-on" aria-hidden="true">💨</span>';

    function sync() {
      var on = isEnabled();
      btn.setAttribute("aria-pressed", String(on));
      btn.setAttribute("aria-label", "Rogue Sheep easter egg: " + (on ? "on" : "off") + " — click to toggle");
      btn.title = "Toggle Rogue Sheep";
    }
    sync();

    btn.addEventListener("click", function () {
      var on = !isEnabled();
      setEnabled(on);
      sync();
      if (on) {
        startRogueSheep();
      } else {
        stopRogueSheep();
      }
    });

    footer.appendChild(btn);
  }

  function init() {
    injectStyles();
    initToggleButton();
    if (isEnabled()) startRogueSheep();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
