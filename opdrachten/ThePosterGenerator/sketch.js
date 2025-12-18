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

// Beschikbare fonts
let fonts = ['Helvetica', 'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Impact', 'Comic Sans MS'];

// Vorm sliders
let circleWeight = 50;
let squareWeight = 50;
let rectWeight = 50;
let triangleWeight = 30;
let starWeight = 20;

// Vormcontrole toggle (standaard uit = random mode)
let shapeControlLocked = false;

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
  let sliderIds = ['circleSlider', 'squareSlider', 'rectSlider', 'triangleSlider', 'starSlider', 'maxShapesSlider', 'maxSizeSlider', 'maxColorsSlider'];
  
  // Update checkbox checked state
  toggle.elt.checked = shapeControlLocked;
  
  // Enable/disable sliders
  if (shapeControlLocked) {
    // Enable sliders
    sliderIds.forEach(id => {
      let slider = select('#' + id);
      slider.removeAttribute('disabled');
    });
  } else {
    // Disable sliders
    sliderIds.forEach(id => {
      let slider = select('#' + id);
      slider.attribute('disabled', 'true');
    });
  }
}

// Randomize alle sliders
function randomizeSliders() {
  // Genereer random waarden voor alle sliders
  let randomValues = {
    circle: floor(random(0, 101)),
    square: floor(random(0, 101)),
    rect: floor(random(0, 101)),
    triangle: floor(random(0, 101)),
    star: floor(random(0, 101)),
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
  updateSlider('maxShapesSlider', 'maxShapesValue', randomValues.maxShapes);
  updateSlider('maxSizeSlider', 'maxSizeValue', randomValues.maxSize);
  updateSlider('maxColorsSlider', 'maxColorsValue', randomValues.maxColors);
  
  // Update de gewichten
  circleWeight = randomValues.circle;
  squareWeight = randomValues.square;
  rectWeight = randomValues.rect;
  triangleWeight = randomValues.triangle;
  starWeight = randomValues.star;
  maxShapes = randomValues.maxShapes;
  maxSize = randomValues.maxSize;
  maxColors = randomValues.maxColors;
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
  
  // Als shape control unlocked is, randomize de vorm sliders
  if (!shapeControlLocked) {
    randomizeSliders();
  }
  
  // Genereer NIEUWE vormposities bij elke spatie
  generateShapePositions();
  
  // Genereer nieuw kleurenpalet
  generateColorPalette();
  
  // Randomize gradient background (50% kans)
  gradientBg = random() < 0.5;
  if (gradientBg) {
    gradientColor1 = getRandomColor();
    gradientColor2 = getRandomColor();
  }
  
  // Kies random tekstkleur (niet uit palet)
  textColor = color(random(255), random(255), random(255));
  
  // Kies random kleur voor info tekst onderaan
  infoColor = getRandomColor();
  
  // Randomize constant animatie effect
  let effects = ['none', 'breathe', 'rotate', 'wave', 'pulse', 'drift'];
  animationEffect = random(effects);
  animationSpeed = random([0.5, 1, 1.5, 2, 3]);
  animationIntensity = random([0.5, 1, 1.5, 2]);
  
  // Randomize trail effect (30% kans)
  trailEffect = random() < 0.3;
  if (trailEffect) {
    trailAlpha = random([5, 10, 15, 20, 30]); // Hoe lager, hoe langer het trail
  }
  
  // Randomize color shift effect (25% kans)
  colorShiftEffect = random() < 0.25;
  if (colorShiftEffect) {
    colorShiftSpeed = random([0.001, 0.002, 0.005, 0.01]);
  }
  
  // Randomize muis interactie parameters (ALTIJD actief)
  mouseMaxDist = random(60, 300); // Random afstand tussen 60-300
  mouseRepelStrength = random(15, 100); // Random kracht tussen 15-100
  mouseScaleEffect = random() > 0.3; // 70% kans op scale effect
  
  // Random mouse interaction type
  let interactionTypes = ['repel', 'attract', 'rotate', 'scale', 'skew'];
  mouseInteractionType = random(interactionTypes);
  
  // Randomize font en size
  currentFont = random(fonts);
  currentFontSize = random([24, 32, 48, 60, 72, 90]);
  
  // Randomize verticale tekst (50% kans)
  verticalText = random() < 0.5;
  
  // Randomize tekst styling
  if (verticalText) {
    textRotation = HALF_PI; // 90° rotatie
    textPositionY = height / 2; // Centreer verticaal
  } else {
    textRotation = random([-PI/8, -PI/12, 0, PI/12, PI/8]); // Kleinere rotatie
    textPositionY = random([120, 150, 180, 220]); // Veilige Y posities bovenaan
  }
  textAlignment = random(['LEFT', 'CENTER', 'RIGHT']); // Random alignment
  textScatter = random() > 0.5; // Soms verspreid, soms niet
  
  if (textAlignment === 'LEFT') {
    textPositionX = 120;
  } else if (textAlignment === 'RIGHT') {
    textPositionX = width - 120;
  } else {
    textPositionX = width / 2;
  }
  
  // Alles wordt vernieuwd bij elke spatie!
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
    
    fill(red(finalColor), green(finalColor), blue(finalColor), 220);
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
      // Vormen ademen (groter/kleiner)
      let breathe = sin(frameCount * 0.02 * animationSpeed + i * 0.3) * 0.15 * animationIntensity + 1;
      scale(breathe);
    } else if (animationEffect === 'rotate') {
      // Alles draait
      rotate(frameCount * 0.01 * animationSpeed + i * 0.1);
    } else if (animationEffect === 'wave') {
      // Golf beweging
      let waveY = sin(frameCount * 0.03 * animationSpeed + i * 0.5) * 20 * animationIntensity;
      translate(0, waveY);
    } else if (animationEffect === 'pulse') {
      // Pulserend (on/off)
      let pulse = abs(sin(frameCount * 0.05 * animationSpeed + i * 0.2)) * 0.5 + 0.5;
      scale(pulse * animationIntensity);
    } else if (animationEffect === 'drift') {
      // Langzaam drijvende beweging
      let driftX = sin(frameCount * 0.01 * animationSpeed + i) * 15 * animationIntensity;
      let driftY = cos(frameCount * 0.015 * animationSpeed + i * 0.7) * 15 * animationIntensity;
      translate(driftX, driftY);
    }
    // 'none' = geen extra effect
    
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
    }
    
    pop();
  }
}

// Kies een vorm gebaseerd op de slider gewichten (probabilistisch)
function chooseShapeByWeight() {
  let totalWeight = circleWeight + squareWeight + rectWeight + triangleWeight + starWeight;
  
  // Als alle gewichten 0 zijn, verdeel gelijkmatig
  if (totalWeight === 0) {
    return random(["circle", "square", "rect", "triangle", "star"]);
  }
  
  // Kies op basis van kansen (gewichten)
  let rand = random(totalWeight);
  
  if (rand < circleWeight) {
    return "circle";
  } else if (rand < circleWeight + squareWeight) {
    return "square";
  } else if (rand < circleWeight + squareWeight + rectWeight) {
    return "rect";
  } else if (rand < circleWeight + squareWeight + rectWeight + triangleWeight) {
    return "triangle";
  } else {
    return "star";
  }
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
  
  if (textScatter) {
    // Scatter mode: elke letter apart (maar binnen boundaries)
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
  text("PALET: " + colorPalette.length + " KLEUREN | SPATIE = NIEUW", margin, height - margin / 2);
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
    gradientColor2: gradientBg ? [red(gradientColor2), green(gradientColor2), blue(gradientColor2)] : null
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
    grid.html('<p style="text-align: center; color: #888; padding: 40px;">Nog geen opgeslagen posters.<br>Druk op "💾 Sla Op" om je eerste poster op te slaan!</p>');
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
  
  // Update text input veld
  textInput.value(inputText);
  
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
