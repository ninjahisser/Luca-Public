// POSTER ALS SYSTEEM
// DIT IS EEN EENVOUDIGE STARTER.
// BIJ ELKE DRUK OP DE SPATIEBALK KRIJG JE EEN NIEUWE POSTER.

let posterWidth = 600;
let posterHeight = 750;
let inputText = "sethdesign.be";
let textInput;

// Kleurenpalet systeem
let colorPalette = [];
let bgColor;

// Tekst styling variabelen (veranderen bij elke spatie)
let textRotation = 0;
let textPositionX = 0;
let textPositionY = 75;
let textAlignment = 'CENTER';
let textScatter = false;
let currentFont = 'Helvetica';
let currentFontSize = 60;
let textColor; // Vaste kleur per poster generatie
let infoColor; // Vaste kleur voor info tekst onderaan

// Muis interactie parameters (veranderen bij elke spatie)
let mouseMaxDist = 150;
let mouseRepelStrength = 40;
let mouseScaleEffect = true;
let mouseInteractionType = 'repel'; // repel, attract, rotate, scale, skew

// Animatie effect (verandert bij elke spatie)
let animationEffect = 'none';
let animationSpeed = 1;
let animationIntensity = 1;

// Visual effects (random bij elke poster)
let trailEffect = false;
let trailAlpha = 255;
let colorShiftEffect = false;
let colorShiftSpeed = 0;
let verticalText = false; // 50% kans op verticale tekst (90°)
let gradientBg = false; // 50% kans op gradient achtergrond
let gradientColor1, gradientColor2;
let filmGrain = false; // Film grain overlay
let scanlinesEffect = false;
let noiseEffect = false;
let glitchEffect = false;
let pixelateEffect = false;

// Pre-rendered effect buffers
let scanlineBuffer = null;

// Beschikbare fonts (105 total)
let fonts = [
  // Sans-Serif
  'Arial','Helvetica','Verdana','Tahoma','Trebuchet MS','Impact','Comic Sans MS','Lucida Sans Unicode','Segoe UI',
  'Roboto','Open Sans','Lato','Montserrat','Raleway','PT Sans','Ubuntu','Work Sans','Nunito','Source Sans 3',
  'Inter','Poppins','Quicksand','Karla','Rubik','Manrope','Outfit','DM Sans','Barlow','Exo 2',
  'Sora','Space Grotesk','Nunito Sans','Fira Sans',
  // Serif
  'Georgia','Times New Roman','Palatino Linotype',
  'Playfair Display','Merriweather','Libre Baskerville','Crimson Text','Lora','EB Garamond',
  'Cormorant Garamond','Bitter','DM Serif Display','Cormorant','Cardo','Josefin Slab',
  'Arvo','Vollkorn','Bree Serif','Zilla Slab','Spectral','Bodoni Moda','Fraunces','Newsreader',
  // Monospace
  'Courier New','Lucida Console',
  'Fira Code','Space Mono','IBM Plex Mono','JetBrains Mono','Source Code Pro','Inconsolata',
  'Ubuntu Mono','Fira Mono','Courier Prime','Anonymous Pro','Overpass Mono','Victor Mono',
  // Display
  'Lobster','Righteous','Bungee','Press Start 2P','Permanent Marker','Abril Fatface',
  'Bebas Neue','Black Ops One','Rubik Mono One','Orbitron','Russo One','Bungee Shade',
  'Monoton','Silkscreen','VT323','Pixelify Sans','Fugaz One','Anton','Teko',
  'Barlow Condensed','Big Shoulders Display','Oswald',
  // Handwriting
  'Pacifico','Dancing Script','Caveat','Satisfy','Great Vibes','Alex Brush','Allura',
  'Sacramento','Cookie','Kalam','Indie Flower','Architects Daughter','Patrick Hand',
  'Shadows Into Light','Amatic SC'
];

// Vorm sliders
let circleWeight = 50;
let squareWeight = 50;
let rectWeight = 50;
let triangleWeight = 30;
let starWeight = 20;
let diamondWeight = 20;
let pentagonWeight = 15;
let hexagonWeight = 15;
let crossWeight = 10;
let ringWeight = 10;
let heartWeight = 10;
let arrowWeight = 10;
let octagonWeight = 10;

// Vormcontrole toggle (standaard uit = random mode)
let shapeControlLocked = false;

// Controle select waarden (worden random ingesteld als unlocked)
let selectedFont = 'Helvetica';
let selectedTextEffect = 'normaal';
let selectedShapeEffect = 'none';
let selectedMouseEffect = 'repel';

// Vorm parameters
let maxShapes = 80;
let maxSize = 180;
let maxColors = 10; // Max aantal kleuren in palet (1-20)

// Bewaar vormposities zodat ze niet veranderen
let shapePositions = [];

function setup() {
  let canvas = createCanvas(posterWidth, posterHeight);
  canvas.parent('defaultCanvas');
  
  // Koppel het HTML input veld
  textInput = select('#posterText');
  textInput.input(() => {
    inputText = textInput.value();
  });
  
  // Koppel alle sliders
  setupSlider('circleSlider', 'circleValue', (val) => { circleWeight = val; });
  setupSlider('squareSlider', 'squareValue', (val) => { squareWeight = val; });
  setupSlider('rectSlider', 'rectValue', (val) => { rectWeight = val; });
  setupSlider('triangleSlider', 'triangleValue', (val) => { triangleWeight = val; });
  setupSlider('starSlider', 'starValue', (val) => { starWeight = val; });
  setupSlider('diamondSlider', 'diamondValue', (val) => { diamondWeight = val; });
  setupSlider('pentagonSlider', 'pentagonValue', (val) => { pentagonWeight = val; });
  setupSlider('hexagonSlider', 'hexagonValue', (val) => { hexagonWeight = val; });
  setupSlider('crossSlider', 'crossValue', (val) => { crossWeight = val; });
  setupSlider('ringSlider', 'ringValue', (val) => { ringWeight = val; });
  setupSlider('heartSlider', 'heartValue', (val) => { heartWeight = val; });
  setupSlider('arrowSlider', 'arrowValue', (val) => { arrowWeight = val; });
  setupSlider('octagonSlider', 'octagonValue', (val) => { octagonWeight = val; });
  setupSlider('maxShapesSlider', 'maxShapesValue', (val) => { maxShapes = val; });
  setupSlider('maxSizeSlider', 'maxSizeValue', (val) => { maxSize = val; });
  setupSlider('maxColorsSlider', 'maxColorsValue', (val) => { maxColors = val; });
  
  // Koppel shape control toggle checkbox
  let shapeToggle = select('#shapeControlToggle');
  shapeToggle.changed(toggleShapeControl);
  updateShapeControlUI(); // Set initial state
  
  // Koppel randomize knop
  let randomizeBtn = select('#randomizeBtn');
  randomizeBtn.mousePressed(randomizeSliders);
  
  // Koppel nieuwe poster knop
  let newPosterBtn = select('#newPosterBtn');
  newPosterBtn.mousePressed(makeNewPoster);
  
  // Koppel fullscreen knop
  let fullscreenBtn = select('#fullscreenBtn');
  fullscreenBtn.mousePressed(toggleFullscreen);
  
  // Koppel save knop
  let saveBtn = select('#saveBtn');
  saveBtn.mousePressed(savePoster);
  
  // Koppel download knop
  let downloadBtn = select('#downloadBtn');
  downloadBtn.mousePressed(downloadPoster);
  
  // Koppel controles select dropdowns
  select('#fontSelect').changed(function() { selectedFont = this.value(); });
  select('#textEffectSelect').changed(function() { selectedTextEffect = this.value(); });
  select('#shapeEffectSelect').changed(function() { selectedShapeEffect = this.value(); });
  select('#mouseEffectSelect').changed(function() { selectedMouseEffect = this.value(); });
  
  // Koppel controles toggles
  select('#grainToggle').changed(function() { filmGrain = this.elt.checked; });
  select('#trailToggle').changed(function() { trailEffect = this.elt.checked; });
  select('#gradientToggle').changed(function() { gradientBg = this.elt.checked; });
  select('#colorShiftToggle').changed(function() { colorShiftEffect = this.elt.checked; });
  select('#scanlinesToggle').changed(function() { scanlinesEffect = this.elt.checked; });
  select('#noiseToggle').changed(function() { noiseEffect = this.elt.checked; });
  select('#glitchToggle').changed(function() { glitchEffect = this.elt.checked; });
  select('#pixelateToggle').changed(function() { pixelateEffect = this.elt.checked; });
  
  // Koppel slideshow knop
  let slideshowBtn = select('#slideshowBtn');
  slideshowBtn.mousePressed(toggleSlideshow);
  
  // Koppel share knop
  let shareBtn = select('#shareBtn');
  shareBtn.mousePressed(sharePoster);
  
  // Laad opgeslagen posters van localStorage
  loadPostersFromLocalStorage();
  
  // Update saved posters display bij start
  updateSavedPostersDisplay();
  
  // Eerste poster generatie (maakt ook vormen aan)
  makeNewPoster();
  
  // Laad gedeelde poster als URL parameter aanwezig is
  loadSharedPoster();
}

// Helper functie om sliders te koppelen
function setupSlider(sliderId, valueId, callback) {
  let slider = select('#' + sliderId);
  let valueDisplay = select('#' + valueId);
  
  slider.input(() => {
    let val = slider.value();
    valueDisplay.html(val);
    callback(parseInt(val));
  });
}

// Genereer vaste posities voor vormen (gebeurt maar 1x)
function generateShapePositions() {
  shapePositions = [];
  let numShapes = floor(random(1, maxShapes + 1)); // Gebruik maxShapes slider
  
  // GEEN vaste seed meer - echt random bij elke aanroep
  
  for (let i = 0; i < numShapes; i++) {
    shapePositions.push({
      x: random(0, width), // Geen margin - hele canvas
      y: random(0, height), // Geen margin - hele canvas
      size: random(40, maxSize), // Gebruik maxSize slider
      aspectRatio: random(0.3, 1.2)
    });
  }
}

// Toggle fullscreen mode
function toggleFullscreen() {
  let canvas = document.querySelector('canvas');
  if (!document.fullscreenElement) {
    canvas.requestFullscreen().catch(err => {
      console.log('Fullscreen error:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

// Toggle vormcontrole aan/uit
function toggleShapeControl() {
  shapeControlLocked = !shapeControlLocked;
  updateShapeControlUI();
}

// Update de UI op basis van de toggle state
function updateShapeControlUI() {
  let toggle = select('#shapeControlToggle');
  let sliderIds = ['circleSlider', 'squareSlider', 'rectSlider', 'triangleSlider', 'starSlider', 'diamondSlider', 'pentagonSlider', 'hexagonSlider', 'crossSlider', 'ringSlider', 'heartSlider', 'arrowSlider', 'octagonSlider', 'maxShapesSlider', 'maxSizeSlider', 'maxColorsSlider'];
  let selectIds = ['fontSelect', 'textEffectSelect', 'shapeEffectSelect', 'mouseEffectSelect'];
  let toggleIds = ['grainToggle', 'trailToggle', 'gradientToggle', 'colorShiftToggle', 'scanlinesToggle', 'noiseToggle', 'glitchToggle', 'pixelateToggle'];
  
  // Update checkbox checked state
  toggle.elt.checked = shapeControlLocked;
  
  // Enable/disable sliders, selects, en toggles
  if (shapeControlLocked) {
    sliderIds.forEach(id => {
      select('#' + id).removeAttribute('disabled');
    });
    selectIds.forEach(id => {
      select('#' + id).removeAttribute('disabled');
    });
    toggleIds.forEach(id => {
      select('#' + id).removeAttribute('disabled');
    });
  } else {
    sliderIds.forEach(id => {
      select('#' + id).attribute('disabled', 'true');
    });
    selectIds.forEach(id => {
      select('#' + id).attribute('disabled', 'true');
    });
    toggleIds.forEach(id => {
      select('#' + id).attribute('disabled', 'true');
    });
  }
}

// Randomize alle sliders en controles
function randomizeSliders() {
  // Genereer random waarden voor alle sliders
  let randomValues = {
    circle: floor(random(0, 101)),
    square: floor(random(0, 101)),
    rect: floor(random(0, 101)),
    triangle: floor(random(0, 101)),
    star: floor(random(0, 101)),
    diamond: floor(random(0, 101)),
    pentagon: floor(random(0, 101)),
    hexagon: floor(random(0, 101)),
    cross: floor(random(0, 101)),
    ring: floor(random(0, 101)),
    heart: floor(random(0, 101)),
    arrow: floor(random(0, 101)),
    octagon: floor(random(0, 101)),
    maxShapes: floor(random(1, 81)),
    maxSize: floor(random(1, 181)),
    maxColors: floor(random(1, 21))
  };
  
  // Update de sliders en hun display waarden
  updateSlider('circleSlider', 'circleValue', randomValues.circle);
  updateSlider('squareSlider', 'squareValue', randomValues.square);
  updateSlider('rectSlider', 'rectValue', randomValues.rect);
  updateSlider('triangleSlider', 'triangleValue', randomValues.triangle);
  updateSlider('starSlider', 'starValue', randomValues.star);
  updateSlider('diamondSlider', 'diamondValue', randomValues.diamond);
  updateSlider('pentagonSlider', 'pentagonValue', randomValues.pentagon);
  updateSlider('hexagonSlider', 'hexagonValue', randomValues.hexagon);
  updateSlider('crossSlider', 'crossValue', randomValues.cross);
  updateSlider('ringSlider', 'ringValue', randomValues.ring);
  updateSlider('heartSlider', 'heartValue', randomValues.heart);
  updateSlider('arrowSlider', 'arrowValue', randomValues.arrow);
  updateSlider('octagonSlider', 'octagonValue', randomValues.octagon);
  updateSlider('maxShapesSlider', 'maxShapesValue', randomValues.maxShapes);
  updateSlider('maxSizeSlider', 'maxSizeValue', randomValues.maxSize);
  updateSlider('maxColorsSlider', 'maxColorsValue', randomValues.maxColors);
  
  // Update de gewichten
  circleWeight = randomValues.circle;
  squareWeight = randomValues.square;
  rectWeight = randomValues.rect;
  triangleWeight = randomValues.triangle;
  starWeight = randomValues.star;
  diamondWeight = randomValues.diamond;
  pentagonWeight = randomValues.pentagon;
  hexagonWeight = randomValues.hexagon;
  crossWeight = randomValues.cross;
  ringWeight = randomValues.ring;
  heartWeight = randomValues.heart;
  arrowWeight = randomValues.arrow;
  octagonWeight = randomValues.octagon;
  maxShapes = randomValues.maxShapes;
  maxSize = randomValues.maxSize;
  maxColors = randomValues.maxColors;
  
  // Randomize selects (gebruik volledige fonts array)
  selectedFont = random(fonts);
  selectedTextEffect = random(['normaal', 'scatter', 'verticaal', 'gekanteld', 'uitgelijnd', 'spiegeling', 'wave', 'cirkel', 'trapsgewijs', 'glow', 'outline', 'blok', 'dubbel', 'golflijn', 'ruimte']);
  selectedShapeEffect = random(['none', 'breathe', 'rotate', 'wave', 'pulse', 'float', 'shake', 'explode', 'spiral', 'drift', 'bounce', 'zoom', 'whirl', 'multiwave', 'morph']);
  selectedMouseEffect = random(['repel', 'attract', 'rotate', 'scale', 'skew', 'vibrate', 'warp', 'colorshift', 'fade', 'magnet']);
  
  updateSelect('fontSelect', selectedFont);
  updateSelect('textEffectSelect', selectedTextEffect);
  updateSelect('shapeEffectSelect', selectedShapeEffect);
  updateSelect('mouseEffectSelect', selectedMouseEffect);
  
  // Randomize toggles (lage kansen voor extreme effecten)
  filmGrain = random() < 0.2;
  trailEffect = random() < 0.2;
  gradientBg = random() < 0.4;
  colorShiftEffect = random() < 0.15;
  scanlinesEffect = random() < 0.08;
  noiseEffect = random() < 0.06;
  glitchEffect = random() < 0.04;
  pixelateEffect = random() < 0.04;
  
  select('#grainToggle').elt.checked = filmGrain;
  select('#trailToggle').elt.checked = trailEffect;
  select('#gradientToggle').elt.checked = gradientBg;
  select('#colorShiftToggle').elt.checked = colorShiftEffect;
  select('#scanlinesToggle').elt.checked = scanlinesEffect;
  select('#noiseToggle').elt.checked = noiseEffect;
  select('#glitchToggle').elt.checked = glitchEffect;
  select('#pixelateToggle').elt.checked = pixelateEffect;
}

// Helper functie om select waarde te updaten
function updateSelect(selectId, value) {
  let sel = select('#' + selectId);
  sel.value(value);
}

// Helper functie om slider waarde te updaten
function updateSlider(sliderId, valueId, value) {
  let slider = select('#' + sliderId);
  let valueDisplay = select('#' + valueId);
  slider.value(value);
  valueDisplay.html(value);
}

function draw() {
  // Achtergrond met gradient of vast kleur
  if (gradientBg) {
    // Gradient achtergrond
    drawGradient();
    if (trailEffect) {
      // Semi-transparante overlay voor trail effect
      fill(0, 0, 0, trailAlpha);
      noStroke();
      rect(0, 0, width, height);
    }
  } else {
    // Normale achtergrond uit het kleurenpalet
    if (trailEffect) {
      // Semi-transparante achtergrond voor trail effect
      fill(red(bgColor), green(bgColor), blue(bgColor), trailAlpha);
      noStroke();
      rect(0, 0, width, height);
    } else {
      // Normale volledige achtergrond
      background(bgColor);
    }
  }
  
  // Teken alle vormen (ze reageren op de muis)
  drawShapes();
  
  // Teken reactieve typografie
  drawTypography();
  
  // Info onderaan
  drawInfo();
  
  // Film grain overlay (fast random dots)
  if (filmGrain) {
    noStroke();
    for (let i = 0; i < 800; i++) {
      let gx = random(width);
      let gy = random(height);
      fill(random(255), random(20, 50));
      rect(gx, gy, 2, 2);
    }
  }
  
  // Scanlines (reuse via pre-rendered buffer)
  if (scanlinesEffect) {
    if (!scanlineBuffer) {
      scanlineBuffer = createGraphics(width, height);
      scanlineBuffer.stroke(0, 40);
      scanlineBuffer.strokeWeight(1);
      for (let y = 0; y < height; y += 3) {
        scanlineBuffer.line(0, y, width, y);
      }
    }
    image(scanlineBuffer, 0, 0);
  }
  
  // Noise overlay (fast random dots, no loadPixels)
  if (noiseEffect) {
    noStroke();
    for (let i = 0; i < 600; i++) {
      let nx = random(width);
      let ny = random(height);
      fill(random(255), random(15, 35));
      rect(nx, ny, random(1, 4), random(1, 4));
    }
  }
  
  // Glitch effect (subtiel)
  if (glitchEffect && random() < 0.15) {
    let sliceCount = floor(random(1, 4));
    for (let s = 0; s < sliceCount; s++) {
      let sy = floor(random(height));
      let sh = floor(random(3, 10));
      let sx = floor(random(-10, 10));
      copy(0, sy, width, sh, sx, sy, width, sh);
    }
  }
  
  // Pixelate effect (fast palette mosaic, no get())
  if (pixelateEffect) {
    let pixSize = 16;
    noStroke();
    for (let px = 0; px < width; px += pixSize) {
      for (let py = 0; py < height; py += pixSize) {
        let c = colorPalette.length > 0 ? colorPalette[floor(random(colorPalette.length))] : bgColor;
        fill(red(c), green(c), blue(c), 180);
        rect(px, py, pixSize, pixSize);
      }
    }
  }
}

// Teken gradient achtergrond
function drawGradient() {
  noStroke();
  for (let y = 0; y < height; y++) {
    let inter = map(y, 0, height, 0, 1);
    let c = lerpColor(gradientColor1, gradientColor2, inter);
    stroke(c);
    line(0, y, width, y);
  }
}

// Genereer een nieuw kleurenpalet
function generateColorPalette() {
  colorPalette = [];
  let numColors = floor(random(1, maxColors + 1)); // 1 tot maxColors kleuren
  
  for (let i = 0; i < numColors; i++) {
    colorPalette.push(color(random(255), random(255), random(255)));
  }
  
  // Kies achtergrondkleur uit het palet of maak een donkere
  if (random() > 0.5 && colorPalette.length > 0) {
    bgColor = colorPalette[0];
  } else {
    bgColor = color(random(20, 60));
  }
}

// Haal een random kleur uit het palet
function getRandomColor() {
  if (colorPalette.length > 0) {
    return colorPalette[floor(random(colorPalette.length))];
  }
  return color(random(255), random(255), random(255));
}

// DEZE FUNCTIE MAAKT EEN NIEUWE POSTER
function makeNewPoster() {
  // Nieuwe random basis voor deze poster
  randomSeed(millis());
  
  // Reset pre-rendered buffers
  scanlineBuffer = null;
  
  // Als shape control unlocked is, randomize de vorm sliders
  if (!shapeControlLocked) {
    randomizeSliders();
  }
  
  // Genereer NIEUWE vormposities bij elke spatie
  generateShapePositions();
  
  // Genereer nieuw kleurenpalet
  generateColorPalette();
  
  // Kies random tekstkleur (niet uit palet)
  textColor = color(random(255), random(255), random(255));
  
  // Kies random kleur voor info tekst onderaan
  infoColor = getRandomColor();
  
  // Randomize constant animatie effect
  animationEffect = selectedShapeEffect;
  animationSpeed = random([0.5, 1, 1.5, 2, 3]);
  animationIntensity = random([0.5, 1, 1.5, 2]);
  
  // Trail en gradient worden bepaald door toggles (niet meer random hier)
  if (trailEffect) {
    trailAlpha = random([5, 10, 15, 20, 30]);
  }
  
  if (gradientBg) {
    gradientColor1 = getRandomColor();
    gradientColor2 = getRandomColor();
  }
  
  // Color shift wordt bepaald door toggle
  if (colorShiftEffect) {
    colorShiftSpeed = random([0.001, 0.002, 0.005, 0.01]);
  }
  
  // Randomize muis interactie parameters (ALTIJD actief)
  mouseMaxDist = random(60, 300); // Random afstand tussen 60-300
  mouseRepelStrength = random(15, 100); // Random kracht tussen 15-100
  mouseScaleEffect = random() > 0.3; // 70% kans op scale effect
  
  // Muis interactie type wordt bepaald door select
  mouseInteractionType = selectedMouseEffect;
  
  // Font wordt bepaald door select
  currentFont = selectedFont;
  currentFontSize = random([24, 32, 48, 60, 72, 90]);
  
  // Teksteffect wordt bepaald door select
  switch (selectedTextEffect) {
    case 'scatter':
      textScatter = true;
      verticalText = false;
      textRotation = random([-PI/12, 0, PI/12]);
      textPositionY = random([120, 150, 180, 220]);
      textAlignment = random(['LEFT', 'CENTER', 'RIGHT']);
      break;
    case 'verticaal':
      textScatter = false;
      verticalText = true;
      textRotation = HALF_PI;
      textPositionY = height / 2;
      textAlignment = 'CENTER';
      break;
    case 'gekanteld':
      textScatter = false;
      verticalText = false;
      textRotation = random([-PI/4, PI/4]);
      textPositionY = random([120, 150, 180, 220]);
      textAlignment = random(['LEFT', 'CENTER', 'RIGHT']);
      break;
    case 'uitgelijnd':
      textScatter = false;
      verticalText = false;
      textRotation = 0;
      textPositionY = random([120, 150, 180, 220]);
      textAlignment = random(['LEFT', 'RIGHT']);
      break;
    case 'spiegeling':
    case 'wave':
    case 'cirkel':
    case 'trapsgewijs':
    case 'glow':
    case 'outline':
    case 'blok':
    case 'dubbel':
    case 'golflijn':
    case 'ruimte':
      textScatter = false;
      verticalText = false;
      textRotation = random([-PI/16, 0, PI/16]);
      textPositionY = random([150, 180, 220]);
      textAlignment = 'CENTER';
      break;
    default: // normaal
      textScatter = false;
      verticalText = false;
      textRotation = random([-PI/12, -PI/24, 0, PI/24, PI/12]);
      textPositionY = random([120, 150, 180, 220]);
      textAlignment = 'CENTER';
      break;
  }
  
  if (textAlignment === 'LEFT') {
    textPositionX = 120;
  } else if (textAlignment === 'RIGHT') {
    textPositionX = width - 120;
  } else {
    textPositionX = width / 2;
  }
  
  // Alles wordt vernieuwd bij elke spatie!
  updatePalettePreview();
}

// Teken de vormen (reageren op muis)
function drawShapes() {
  // Loop door alle vaste vormposities
  for (let i = 0; i < shapePositions.length; i++) {
    let shape = shapePositions[i];
    let x = shape.x;
    let y = shape.y;
    let size = shape.size;
    let aspectRatio = shape.aspectRatio;
    
    // Kies vorm op basis van slider gewichten voor DEZE vorm
    // Elke vorm heeft zijn eigen random seed voor consistentie
    randomSeed(i * 1000); // Unieke seed per vorm
    let shapeType = chooseShapeByWeight();
    
    // Reset random voor andere berekeningen
    randomSeed();
    
    // Afstand tot de muis
    let d = dist(mouseX, mouseY, x, y);
    
    // Mouse interaction based on type
    let offsetX = 0;
    let offsetY = 0;
    let rotationEffect = 0;
    let scaleAmount = 1;
    let skewAmount = 0;
    
    if (d < mouseMaxDist) {
      let force = map(d, 0, mouseMaxDist, mouseRepelStrength, 0);
      let angle = atan2(y - mouseY, x - mouseX);
      
      switch(mouseInteractionType) {
        case 'repel':
          offsetX = cos(angle) * force;
          offsetY = sin(angle) * force;
          break;
        case 'attract':
          offsetX = -cos(angle) * force * 0.5;
          offsetY = -sin(angle) * force * 0.5;
          break;
        case 'rotate':
          rotationEffect = map(d, 0, mouseMaxDist, PI, 0);
          break;
        case 'scale':
          scaleAmount = map(d, 0, mouseMaxDist, 0.5, 1.5);
          break;
        case 'skew':
          skewAmount = map(d, 0, mouseMaxDist, -0.3, 0);
          break;
        case 'vibrate':
          offsetX = random(-force * 0.5, force * 0.5);
          offsetY = random(-force * 0.5, force * 0.5);
          break;
        case 'warp':
          offsetX = cos(angle) * force * sin(frameCount * 0.1) * 0.8;
          offsetY = sin(angle) * force * cos(frameCount * 0.1) * 0.8;
          break;
        case 'colorshift':
          // Handled in color section below
          break;
        case 'fade':
          // Handled in fill section below
          break;
        case 'magnet':
          offsetX = -cos(angle) * force * 1.2;
          offsetY = -sin(angle) * force * 1.2;
          break;
      }
    }
    
    // Kleur uit palet (consistent per vorm)
    randomSeed(i * 500);
    let col = getRandomColor();
    randomSeed();
    
    // Pas color shift effect toe
    let finalColor = col;
    if (colorShiftEffect) {
      let shift = sin(frameCount * colorShiftSpeed + i * 0.5) * 30;
      finalColor = color(
        constrain(red(col) + shift, 0, 255),
        constrain(green(col) + shift * 0.8, 0, 255),
        constrain(blue(col) + shift * 1.2, 0, 255)
      );
    }
    
    // Mouse colorshift effect
    let fillAlpha = 220;
    if (mouseInteractionType === 'colorshift' && d < mouseMaxDist) {
      let hueShift = map(d, 0, mouseMaxDist, 0, 180);
      finalColor = color(
        constrain(red(finalColor) + hueShift, 0, 255),
        constrain(green(finalColor) - hueShift * 0.5, 0, 255),
        constrain(blue(finalColor) + hueShift * 0.3, 0, 255)
      );
    }
    
    // Mouse fade effect
    if (mouseInteractionType === 'fade' && d < mouseMaxDist) {
      fillAlpha = map(d, 0, mouseMaxDist, 40, 220);
    }
    
    fill(red(finalColor), green(finalColor), blue(finalColor), fillAlpha);
    noStroke();
    
    push();
    translate(x + offsetX, y + offsetY);
    
    // Apply rotation effect
    if (rotationEffect !== 0) {
      rotate(rotationEffect);
    }
    
    // Apply skew if active
    if (skewAmount !== 0) {
      applyMatrix(1, 0, skewAmount, 1, 0, 0);
    }
    
    scale(scaleAmount);
    
    // Pas constant animatie effect toe
    if (animationEffect === 'breathe') {
      let breathe = sin(frameCount * 0.02 * animationSpeed + i * 0.3) * 0.15 * animationIntensity + 1;
      scale(breathe);
    } else if (animationEffect === 'rotate') {
      rotate(frameCount * 0.01 * animationSpeed + i * 0.1);
    } else if (animationEffect === 'wave') {
      let waveY = sin(frameCount * 0.03 * animationSpeed + i * 0.5) * 20 * animationIntensity;
      translate(0, waveY);
    } else if (animationEffect === 'pulse') {
      let pulse = abs(sin(frameCount * 0.05 * animationSpeed + i * 0.2)) * 0.5 + 0.5;
      scale(pulse * animationIntensity);
    } else if (animationEffect === 'drift') {
      let driftX = sin(frameCount * 0.01 * animationSpeed + i) * 15 * animationIntensity;
      let driftY = cos(frameCount * 0.015 * animationSpeed + i * 0.7) * 15 * animationIntensity;
      translate(driftX, driftY);
    } else if (animationEffect === 'float') {
      let floatY = sin(frameCount * 0.015 * animationSpeed + i * 0.4) * 30 * animationIntensity;
      translate(0, floatY);
    } else if (animationEffect === 'shake') {
      let shakeX = random(-3, 3) * animationIntensity;
      let shakeY = random(-3, 3) * animationIntensity;
      translate(shakeX, shakeY);
    } else if (animationEffect === 'explode') {
      let explode = (frameCount * 0.02 * animationSpeed) % TWO_PI;
      let explodeScale = abs(sin(explode)) * 0.5 + 0.5;
      scale(explodeScale * animationIntensity);
    } else if (animationEffect === 'spiral') {
      let spiralAngle = frameCount * 0.02 * animationSpeed + i * 0.5;
      let spiralR = sin(frameCount * 0.01 * animationSpeed) * 10 * animationIntensity;
      translate(cos(spiralAngle) * spiralR, sin(spiralAngle) * spiralR);
      rotate(frameCount * 0.005 * animationSpeed);
    } else if (animationEffect === 'bounce') {
      let bounceY = abs(sin(frameCount * 0.04 * animationSpeed + i * 0.3)) * 40 * animationIntensity;
      translate(0, -bounceY);
    } else if (animationEffect === 'zoom') {
      let zoomScale = sin(frameCount * 0.02 * animationSpeed + i * 0.6) * 0.3 + 1;
      scale(zoomScale * animationIntensity);
    } else if (animationEffect === 'whirl') {
      let whirlAngle = frameCount * 0.015 * animationSpeed + i * 0.2;
      let whirlR = sin(frameCount * 0.01 * animationSpeed) * 12 * animationIntensity;
      translate(cos(whirlAngle) * whirlR, sin(whirlAngle) * whirlR);
      rotate(whirlAngle * 0.5);
    } else if (animationEffect === 'multiwave') {
      let wave1 = sin(frameCount * 0.02 * animationSpeed + i * 0.3) * 15;
      let wave2 = cos(frameCount * 0.03 * animationSpeed + i * 0.5) * 10;
      translate(wave2 * animationIntensity, wave1 * animationIntensity);
    } else if (animationEffect === 'morph') {
      let morphScale = (sin(frameCount * 0.02 * animationSpeed + i * 0.4) + 1) * 0.5;
      scale(1 + morphScale * 0.3 * animationIntensity, 1 - morphScale * 0.2 * animationIntensity);
    }
    
    // Teken de gekozen vorm
    if (shapeType === "circle") {
      circle(0, 0, size);
    } else if (shapeType === "square") {
      rectMode(CENTER);
      rect(0, 0, size, size);
    } else if (shapeType === "rect") {
      rectMode(CENTER);
      rect(0, 0, size, size * aspectRatio);
    } else if (shapeType === "triangle") {
      drawTriangle(size);
    } else if (shapeType === "star") {
      drawStar(size / 2, size / 4, 5);
    } else if (shapeType === "diamond") {
      drawDiamond(size);
    } else if (shapeType === "pentagon") {
      drawPolygon(size / 2, 5);
    } else if (shapeType === "hexagon") {
      drawPolygon(size / 2, 6);
    } else if (shapeType === "cross") {
      drawCross(size);
    } else if (shapeType === "ring") {
      drawRing(size);
    } else if (shapeType === "heart") {
      drawHeart(size);
    } else if (shapeType === "arrow") {
      drawArrow(size);
    } else if (shapeType === "octagon") {
      drawPolygon(size / 2, 8);
    }
    
    pop();
  }
}

// Kies een vorm gebaseerd op de slider gewichten (probabilistisch)
function chooseShapeByWeight() {
  let totalWeight = circleWeight + squareWeight + rectWeight + triangleWeight + starWeight
    + diamondWeight + pentagonWeight + hexagonWeight + crossWeight + ringWeight
    + heartWeight + arrowWeight + octagonWeight;
  
  // Als alle gewichten 0 zijn, verdeel gelijkmatig
  if (totalWeight === 0) {
    return random(["circle", "square", "rect", "triangle", "star", "diamond", "pentagon", "hexagon", "cross", "ring", "heart", "arrow", "octagon"]);
  }
  
  let rand = random(totalWeight);
  let cumulative = 0;
  
  let shapes = [
    { name: "circle", weight: circleWeight },
    { name: "square", weight: squareWeight },
    { name: "rect", weight: rectWeight },
    { name: "triangle", weight: triangleWeight },
    { name: "star", weight: starWeight },
    { name: "diamond", weight: diamondWeight },
    { name: "pentagon", weight: pentagonWeight },
    { name: "hexagon", weight: hexagonWeight },
    { name: "cross", weight: crossWeight },
    { name: "ring", weight: ringWeight },
    { name: "heart", weight: heartWeight },
    { name: "arrow", weight: arrowWeight },
    { name: "octagon", weight: octagonWeight }
  ];
  
  for (let s of shapes) {
    cumulative += s.weight;
    if (rand < cumulative) return s.name;
  }
  return "circle";
}

// Teken een driehoek (gecentreerd)
function drawTriangle(size) {
  let h = size * 0.866; // hoogte van gelijkzijdige driehoek
  triangle(
    0, -h / 2,
    -size / 2, h / 2,
    size / 2, h / 2
  );
}

// Teken een ster
function drawStar(outerRadius, innerRadius, points) {
  let angle = TWO_PI / points;
  let halfAngle = angle / 2;
  
  beginShape();
  for (let a = -PI / 2; a < TWO_PI - PI / 2; a += angle) {
    let sx = cos(a) * outerRadius;
    let sy = sin(a) * outerRadius;
    vertex(sx, sy);
    sx = cos(a + halfAngle) * innerRadius;
    sy = sin(a + halfAngle) * innerRadius;
    vertex(sx, sy);
  }
  endShape(CLOSE);
}

// Teken een ruit
function drawDiamond(size) {
  let h = size * 0.7;
  beginShape();
  vertex(0, -h / 2);
  vertex(size / 2, 0);
  vertex(0, h / 2);
  vertex(-size / 2, 0);
  endShape(CLOSE);
}

// Teken een polygoon (pentagon, hexagon, octagon)
function drawPolygon(radius, sides) {
  let angle = TWO_PI / sides;
  beginShape();
  for (let a = -PI / 2; a < TWO_PI - PI / 2; a += angle) {
    let sx = cos(a) * radius;
    let sy = sin(a) * radius;
    vertex(sx, sy);
  }
  endShape(CLOSE);
}

// Teken een kruis
function drawCross(size) {
  let w = size * 0.3;
  let h = size;
  rectMode(CENTER);
  rect(0, 0, w, h);
  rect(0, 0, h, w);
}

// Teken een ring
function drawRing(size) {
  let outer = size / 2;
  let inner = size * 0.35;
  beginShape();
  for (let a = 0; a < TWO_PI; a += 0.1) {
    vertex(cos(a) * outer, sin(a) * outer);
  }
  endShape(CLOSE);
  fill(red(bgColor), green(bgColor), blue(bgColor));
  beginShape();
  for (let a = 0; a < TWO_PI; a += 0.1) {
    vertex(cos(a) * inner, sin(a) * inner);
  }
  endShape(CLOSE);
}

// Teken een hart
function drawHeart(size) {
  let s = size * 0.005;
  beginShape();
  for (let a = 0; a < TWO_PI; a += 0.1) {
    let x = 16 * pow(sin(a), 3);
    let y = -(13 * cos(a) - 5 * cos(2 * a) - 2 * cos(3 * a) - cos(4 * a));
    vertex(x * s, y * s);
  }
  endShape(CLOSE);
}

// Teken een pijl
function drawArrow(size) {
  let w = size * 0.4;
  let h = size;
  beginShape();
  vertex(0, -h / 2);
  vertex(w, -h / 6);
  vertex(w * 0.5, -h / 6);
  vertex(w * 0.5, h / 2);
  vertex(-w * 0.5, h / 2);
  vertex(-w * 0.5, -h / 6);
  vertex(-w, -h / 6);
  endShape(CLOSE);
}

// Teken reactieve typografie
function drawTypography() {
  // Analyseer de tekst
  let textLength = inputText.length;
  let hasUpperCase = inputText !== inputText.toLowerCase();
  let hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(inputText);
  let vowelCount = (inputText.match(/[aeiouAEIOU]/g) || []).length;
  
  // Gebruik gerandomiseerde font size
  let baseSize = currentFontSize;
  
  // Pas aan op basis van tekstlengte als het te lang is
  if (textLength > 15) {
    baseSize = map(textLength, 15, 30, currentFontSize, currentFontSize * 0.5);
    baseSize = constrain(baseSize, 20, currentFontSize);
  }
  
  // Letterspatiëring
  let letterSpacing = hasSpecialChars ? 15 : 5;
  
  push();
  
  // Zorg dat tekst binnen het frame blijft - met grote marges voor rotatie
  let margin = currentFontSize * 1.5;
  let safeX = constrain(textPositionX, margin, width - margin);
  let safeY = constrain(textPositionY, margin, height - margin);
  
  translate(safeX, safeY);
  rotate(textRotation);
  
  // Extra rotatie bij muis beweging (kleiner effect)
  let mouseInfluence = map(mouseX, 0, width, -0.05, 0.05);
  rotate(mouseInfluence);
  
  // Gebruik gerandomiseerde font
  textFont(currentFont);
  
  // Gebruik vaste kleur die gekozen werd bij makeNewPoster
  fill(red(textColor), green(textColor), blue(textColor));
  
  if (textAlignment === 'CENTER') {
    textAlign(CENTER, CENTER);
  } else if (textAlignment === 'LEFT') {
    textAlign(LEFT, CENTER);
  } else {
    textAlign(RIGHT, CENTER);
  }
  
  textSize(baseSize);
  textStyle(hasUpperCase ? BOLD : NORMAL);
  
  // Teksteffect rendering
  if (textScatter) {
    // Scatter mode: elke letter apart
    let maxOffset = min(baseSize * 0.6 + letterSpacing, width / (inputText.length + 2));
    for (let i = 0; i < inputText.length; i++) {
      let letter = inputText[i];
      let xOffset = (i - inputText.length / 2) * maxOffset;
      let yOffset = sin(frameCount * 0.05 + i) * 10;
      let rotation = sin(frameCount * 0.03 + i * 0.5) * 0.1;
      
      push();
      translate(xOffset, yOffset);
      rotate(rotation);
      text(letter, 0, 0);
      pop();
    }
  } else if (selectedTextEffect === 'spiegeling') {
    // Spiegeling: tekst + spiegel eronder
    text(inputText, 0, 0);
    push();
    scale(1, -1);
    fill(red(textColor), green(textColor), blue(textColor), 60);
    text(inputText, 0, -baseSize * 1.8);
    pop();
  } else if (selectedTextEffect === 'wave') {
    // Wave: elke letter golft
    for (let i = 0; i < inputText.length; i++) {
      let letter = inputText[i];
      let xOffset = (i - inputText.length / 2) * (baseSize * 0.7);
      let yOffset = sin(frameCount * 0.04 + i * 0.8) * 20;
      push();
      translate(xOffset, yOffset);
      text(letter, 0, 0);
      pop();
    }
  } else if (selectedTextEffect === 'cirkel') {
    // Cirkel: tekst in een cirkel
    let radius = baseSize * 2;
    let angleStep = TWO_PI / inputText.length;
    for (let i = 0; i < inputText.length; i++) {
      let letter = inputText[i];
      let a = angleStep * i - HALF_PI;
      push();
      translate(cos(a) * radius, sin(a) * radius);
      rotate(a + HALF_PI);
      text(letter, 0, 0);
      pop();
    }
  } else if (selectedTextEffect === 'trapsgewijs') {
    // Trapsgewijs: elke letter stapsgewijs lager
    for (let i = 0; i < inputText.length; i++) {
      let letter = inputText[i];
      let xOffset = (i - inputText.length / 2) * (baseSize * 0.6);
      let yOffset = i * (baseSize * 0.4);
      text(letter, xOffset, yOffset);
    }
  } else if (selectedTextEffect === 'glow') {
    // Glow: gloeiende schaduw
    drawingContext.shadowBlur = 20;
    drawingContext.shadowColor = `rgb(${floor(red(textColor))},${floor(green(textColor))},${floor(blue(textColor))})`;
    text(inputText, 0, 0);
    drawingContext.shadowBlur = 0;
  } else if (selectedTextEffect === 'outline') {
    // Outline: alleen omtrek
    noFill();
    stroke(red(textColor), green(textColor), blue(textColor));
    strokeWeight(2);
    text(inputText, 0, 0);
    noStroke();
  } else if (selectedTextEffect === 'blok') {
    // Blok: tekst met achtergrond blok
    let tw = textWidth(inputText) + 20;
    let th = baseSize * 1.3;
    fill(red(textColor), green(textColor), blue(textColor));
    rectMode(CENTER);
    rect(0, 0, tw, th, 4);
    fill(red(bgColor), green(bgColor), blue(bgColor));
    text(inputText, 0, 0);
  } else if (selectedTextEffect === 'dubbel') {
    // Dubbel: twee lagen tekst
    fill(red(textColor), green(textColor), blue(textColor), 60);
    text(inputText, 4, 4);
    fill(red(textColor), green(textColor), blue(textColor));
    text(inputText, 0, 0);
  } else if (selectedTextEffect === 'golflijn') {
    // Golflijn: tekst op een golflijn met underline
    text(inputText, 0, 0);
    let tw = textWidth(inputText);
    noFill();
    stroke(red(textColor), green(textColor), blue(textColor));
    strokeWeight(2);
    beginShape();
    for (let x = -tw / 2; x < tw / 2; x += 4) {
      let y = sin(x * 0.05 + frameCount * 0.05) * 5 + baseSize * 0.4;
      vertex(x, y);
    }
    endShape();
    noStroke();
  } else if (selectedTextEffect === 'ruimte') {
    // Ruimte: grote spaties tussen letters
    textAlign(LEFT, CENTER);
    for (let i = 0; i < inputText.length; i++) {
      let letter = inputText[i];
      let x = (i - inputText.length / 2) * (baseSize * 1.2);
      let yOff = sin(frameCount * 0.02 + i) * 5;
      text(letter, x, yOff);
    }
  } else {
    // Normale mode
    text(inputText, 0, 0);
  }
  
  pop();
}

// Teken info onderaan
function drawInfo() {
  // Verberg info in fullscreen mode
  if (document.fullscreenElement) {
    return;
  }
  
  let margin = 80;
  // Gebruik vaste info kleur die gekozen werd bij makeNewPoster
  fill(red(infoColor), green(infoColor), blue(infoColor));
  textAlign(LEFT, BOTTOM);
  textSize(12);
  textStyle(NORMAL);
  text("PALET: " + colorPalette.length + " KLEUREN | SPATIE / KLIK = NIEUW", margin, height - margin / 2);
}

// SPATIE = NIEUWE POSTER
function keyPressed() {
  // Check of focus in het tekstveld is
  let inputIsFocused = document.activeElement.id === 'posterText';
  
  if (key === " " && !inputIsFocused) {
    makeNewPoster();
    return false; // Voorkomt scrollen
  }
}

// CLICK OP CANVAS = NIEUWE POSTER
function mousePressed() {
  // Alleen als er op het canvas geklikt wordt (niet op UI elementen)
  let canvas = document.querySelector('canvas');
  if (canvas && mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
    makeNewPoster();
  }
}

// SAVE FUNCTIONALITEIT
let savedPosters = [];
let slideshowInterval = null;
let slideshowIndex = 0;
let isSlideshowPlaying = false;

function savePoster() {
  // Maak een snapshot van het canvas
  let canvas = document.querySelector('canvas');
  let dataURL = canvas.toDataURL('image/png');
  
  // Bewaar ook de huidige state
  let posterState = {
    image: dataURL,
    timestamp: Date.now(),
    id: 'poster_' + Date.now(),
    // Bewaar alle relevante parameters
    colorPalette: colorPalette.map(c => [red(c), green(c), blue(c)]),
    bgColor: [red(bgColor), green(bgColor), blue(bgColor)],
    shapePositions: JSON.parse(JSON.stringify(shapePositions)),
    textColor: [red(textColor), green(textColor), blue(textColor)],
    textRotation: textRotation,
    textPositionX: textPositionX,
    textPositionY: textPositionY,
    textAlignment: textAlignment,
    textScatter: textScatter,
    currentFont: currentFont,
    currentFontSize: currentFontSize,
    inputText: inputText,
    mouseMaxDist: mouseMaxDist,
    mouseRepelStrength: mouseRepelStrength,
    mouseScaleEffect: mouseScaleEffect,
    mouseInteractionType: mouseInteractionType,
    animationEffect: animationEffect,
    animationSpeed: animationSpeed,
    animationIntensity: animationIntensity,
    infoColor: [red(infoColor), green(infoColor), blue(infoColor)],
    verticalText: verticalText,
    gradientBg: gradientBg,
    gradientColor1: gradientBg ? [red(gradientColor1), green(gradientColor1), blue(gradientColor1)] : null,
    gradientColor2: gradientBg ? [red(gradientColor2), green(gradientColor2), blue(gradientColor2)] : null,
    trailEffect: trailEffect,
    trailAlpha: trailAlpha,
    colorShiftEffect: colorShiftEffect,
    colorShiftSpeed: colorShiftSpeed,
    // Controle states
    selectedFont: selectedFont,
    selectedTextEffect: selectedTextEffect,
    selectedShapeEffect: selectedShapeEffect,
    selectedMouseEffect: selectedMouseEffect,
    filmGrain: filmGrain,
    scanlinesEffect: scanlinesEffect,
    noiseEffect: noiseEffect,
    glitchEffect: glitchEffect,
    pixelateEffect: pixelateEffect
  };
  
  // Voeg toe aan savedPosters array
  savedPosters.push(posterState);
  
  // Sla op in localStorage
  savePostersToLocalStorage();
  
  // Update display
  updateSavedPostersDisplay();
  
  // Visuele feedback
  console.log('Poster opgeslagen! 🎨');
}

function updateSavedPostersDisplay() {
  let countSpan = select('#posterCount');
  if (countSpan) {
    countSpan.html(savedPosters.length);
  }
  
  let grid = select('#savedGrid');
  if (!grid) return;
  
  grid.html(''); // Clear existing
  
  if (savedPosters.length === 0) {
    grid.html('<p style="text-align: center; color: #888; padding: 40px;">Nog geen opgeslagen posters.</p>');
    return;
  }
  
  // Toon alle opgeslagen posters (nieuwste eerst)
  for (let i = savedPosters.length - 1; i >= 0; i--) {
    let poster = savedPosters[i];
    
    let item = createDiv('');
    item.class('saved-item');
    
    let img = createImg(poster.image, 'Saved poster');
    img.parent(item);
    
    let btnContainer = createDiv('');
    btnContainer.class('saved-item-buttons');
    btnContainer.parent(item);
    
    let loadBtn = createButton('Laad');
    loadBtn.class('load-btn');
    loadBtn.parent(btnContainer);
    loadBtn.mousePressed(() => loadPoster(i));
    
    let deleteBtn = createButton('Verwijder');
    deleteBtn.class('delete-btn-small');
    deleteBtn.parent(btnContainer);
    deleteBtn.mousePressed(() => deletePoster(i));
    
    item.parent(grid);
  }
}

function loadPoster(index) {
  let poster = savedPosters[index];
  
  // Herstel alle parameters
  colorPalette = poster.colorPalette.map(c => color(c[0], c[1], c[2]));
  bgColor = color(poster.bgColor[0], poster.bgColor[1], poster.bgColor[2]);
  shapePositions = JSON.parse(JSON.stringify(poster.shapePositions));
  textColor = color(poster.textColor[0], poster.textColor[1], poster.textColor[2]);
  textRotation = poster.textRotation;
  textPositionX = poster.textPositionX;
  textPositionY = poster.textPositionY;
  textAlignment = poster.textAlignment;
  textScatter = poster.textScatter;
  currentFont = poster.currentFont;
  currentFontSize = poster.currentFontSize;
  inputText = poster.inputText;
  mouseMaxDist = poster.mouseMaxDist;
  mouseRepelStrength = poster.mouseRepelStrength;
  mouseScaleEffect = poster.mouseScaleEffect;
  mouseInteractionType = poster.mouseInteractionType || 'repel';
  animationEffect = poster.animationEffect;
  animationSpeed = poster.animationSpeed;
  animationIntensity = poster.animationIntensity;
  infoColor = color(poster.infoColor[0], poster.infoColor[1], poster.infoColor[2]);
  verticalText = poster.verticalText || false;
  gradientBg = poster.gradientBg || false;
  if (gradientBg && poster.gradientColor1 && poster.gradientColor2) {
    gradientColor1 = color(poster.gradientColor1[0], poster.gradientColor1[1], poster.gradientColor1[2]);
    gradientColor2 = color(poster.gradientColor2[0], poster.gradientColor2[1], poster.gradientColor2[2]);
  }
  trailEffect = poster.trailEffect || false;
  trailAlpha = poster.trailAlpha || 255;
  colorShiftEffect = poster.colorShiftEffect || false;
  colorShiftSpeed = poster.colorShiftSpeed || 0;
  
  // Update text input veld
  textInput.value(inputText);
  
  // Update controles selects
  selectedFont = poster.currentFont || 'Helvetica';
  selectedTextEffect = poster.selectedTextEffect || 'normaal';
  selectedShapeEffect = poster.animationEffect || 'none';
  selectedMouseEffect = poster.mouseInteractionType || 'repel';
  
  updateSelect('fontSelect', selectedFont);
  updateSelect('textEffectSelect', selectedTextEffect);
  updateSelect('shapeEffectSelect', selectedShapeEffect);
  updateSelect('mouseEffectSelect', selectedMouseEffect);
  
  // Update controles toggles
  filmGrain = poster.filmGrain || false;
  scanlinesEffect = poster.scanlinesEffect || false;
  noiseEffect = poster.noiseEffect || false;
  glitchEffect = poster.glitchEffect || false;
  pixelateEffect = poster.pixelateEffect || false;
  select('#grainToggle').elt.checked = filmGrain;
  select('#trailToggle').elt.checked = trailEffect;
  select('#gradientToggle').elt.checked = gradientBg;
  select('#colorShiftToggle').elt.checked = colorShiftEffect;
  select('#scanlinesToggle').elt.checked = scanlinesEffect;
  select('#noiseToggle').elt.checked = noiseEffect;
  select('#glitchToggle').elt.checked = glitchEffect;
  select('#pixelateToggle').elt.checked = pixelateEffect;
  
  // Update palette preview
  updatePalettePreview();
  
  console.log('Poster geladen! 📂');
}

function deletePoster(index) {
  if (confirm('Weet je zeker dat je deze poster wilt verwijderen?')) {
    savedPosters.splice(index, 1);
    savePostersToLocalStorage();
    updateSavedPostersDisplay();
    
    // Stop slideshow als die bezig is
    if (isSlideshowPlaying) {
      stopSlideshow();
    }
  }
}

// SLIDESHOW FUNCTIONALITEIT
function toggleSlideshow() {
  if (isSlideshowPlaying) {
    stopSlideshow();
  } else {
    startSlideshow();
  }
}

function startSlideshow() {
  if (savedPosters.length === 0) {
    alert('Geen opgeslagen posters om af te spelen!');
    return;
  }
  
  isSlideshowPlaying = true;
  slideshowIndex = 0;
  
  // Update button text
  let btn = select('#slideshowBtn');
  btn.html('⏸ Stop Slideshow');
  
  // Laad eerste poster
  loadPoster(savedPosters.length - 1 - slideshowIndex);
  
  // Start interval
  slideshowInterval = setInterval(() => {
    slideshowIndex++;
    if (slideshowIndex >= savedPosters.length) {
      slideshowIndex = 0; // Loop terug naar begin
    }
    loadPoster(savedPosters.length - 1 - slideshowIndex);
  }, 2000); // Elke 2 seconden
}

function stopSlideshow() {
  isSlideshowPlaying = false;
  
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
  }
  
  // Update button text
  let btn = select('#slideshowBtn');
  btn.html('▶ Start Slideshow');
}

// SHARE FUNCTIONALITEIT
function sharePoster() {
  // Encode huidige poster state naar URL
  let posterData = {
    colorPalette: colorPalette.map(c => [red(c), green(c), blue(c)]),
    bgColor: [red(bgColor), green(bgColor), blue(bgColor)],
    shapePositions: shapePositions,
    textColor: [red(textColor), green(textColor), blue(textColor)],
    textRotation: textRotation,
    textPositionX: textPositionX,
    textPositionY: textPositionY,
    textAlignment: textAlignment,
    currentFont: currentFont,
    currentFontSize: currentFontSize,
    inputText: inputText,
    circleWeight: circleWeight,
    squareWeight: squareWeight,
    rectWeight: rectWeight,
    triangleWeight: triangleWeight,
    starWeight: starWeight
  };
  
  // Encode naar base64
  let jsonStr = JSON.stringify(posterData);
  let encoded = btoa(jsonStr);
  
  // Maak deelbare URL
  let shareUrl = window.location.origin + window.location.pathname + '?poster=' + encoded;
  
  // Kopieer naar clipboard
  navigator.clipboard.writeText(shareUrl).then(() => {
    alert('Link gekopieerd naar clipboard! Deel deze link om je poster te delen.');
  }).catch(err => {
    // Fallback: toon de link in een prompt
    prompt('Kopieer deze link om je poster te delen:', shareUrl);
  });
}

// Laad gedeelde poster bij page load
function loadSharedPoster() {
  let urlParams = new URLSearchParams(window.location.search);
  let posterParam = urlParams.get('poster');
  
  if (posterParam) {
    try {
      let jsonStr = atob(posterParam);
      let posterData = JSON.parse(jsonStr);
      
      // Herstel parameters
      colorPalette = posterData.colorPalette.map(c => color(c[0], c[1], c[2]));
      bgColor = color(posterData.bgColor[0], posterData.bgColor[1], posterData.bgColor[2]);
      shapePositions = posterData.shapePositions;
      textColor = color(posterData.textColor[0], posterData.textColor[1], posterData.textColor[2]);
      textRotation = posterData.textRotation;
      textPositionX = posterData.textPositionX;
      textPositionY = posterData.textPositionY;
      textAlignment = posterData.textAlignment;
      currentFont = posterData.currentFont;
      currentFontSize = posterData.currentFontSize;
      inputText = posterData.inputText;
      circleWeight = posterData.circleWeight;
      squareWeight = posterData.squareWeight;
      rectWeight = posterData.rectWeight;
      triangleWeight = posterData.triangleWeight;
      starWeight = posterData.starWeight;
      
      // Update text input
      textInput.value(inputText);
      
      // Update sliders
      updateSlider('circleSlider', 'circleValue', circleWeight);
      updateSlider('squareSlider', 'squareValue', squareWeight);
      updateSlider('rectSlider', 'rectValue', rectWeight);
      updateSlider('triangleSlider', 'triangleValue', triangleWeight);
      updateSlider('starSlider', 'starValue', starWeight);
      
      console.log('Gedeelde poster geladen! 🔗');
    } catch (e) {
      console.error('Fout bij laden gedeelde poster:', e);
    }
  }
}

// DOWNLOAD FUNCTIONALITEIT
function downloadPoster() {
  let canvas = document.querySelector('canvas');
  let link = document.createElement('a');
  link.download = 'poster_' + Date.now() + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// PALETTE PREVIEW
function updatePalettePreview() {
  let container = select('#palettePreview');
  if (!container) return;
  container.html('');
  
  // Show background + palette colors
  let allColors = [bgColor, ...colorPalette];
  for (let i = 0; i < allColors.length && i < 12; i++) {
    let swatch = createDiv('');
    swatch.class('palette-swatch');
    swatch.style('background', 'rgb(' + floor(red(allColors[i])) + ',' + floor(green(allColors[i])) + ',' + floor(blue(allColors[i])) + ')');
    swatch.parent(container);
  }
}

// LOCALSTORAGE FUNCTIONALITEIT
function savePostersToLocalStorage() {
  try {
    localStorage.setItem('savedPosters', JSON.stringify(savedPosters));
    console.log('Posters opgeslagen in browser! 💾');
  } catch (e) {
    console.error('Fout bij opslaan naar localStorage:', e);
  }
}

function loadPostersFromLocalStorage() {
  try {
    let stored = localStorage.getItem('savedPosters');
    if (stored) {
      savedPosters = JSON.parse(stored);
      console.log('Posters geladen uit browser! 💾 (' + savedPosters.length + ' posters)');
    }
  } catch (e) {
    console.error('Fout bij laden van localStorage:', e);
    savedPosters = [];
  }
}
