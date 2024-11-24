initiate("intro");

const parentElement = document.getElementById("sceneImageParent");
let currentScene = null;
let lastInteraction = null;

const debug = false;

let talkerColors = [];

parentElement.innerHTML = '';

async function fetch_scenes() {
    const response = await fetch("../Data/scenes.json");
    const json = await response.json();

    json.hasScene = function(scenename) {
        return this.scenes.some(scene => scene.id === scenename);
    };

    json.getScene = function(scenename) {
        return this.scenes.find(scene => scene.id === scenename);    
    }

    json.getScenes = function(){
        return this.scenes ? this.scenes : null;
    }

    json.scenes.forEach(scene => {
        scene.getType = function() {
            return this.type ? this.type : null;
        }

        scene.getAutoTransitionTarget = function(){
            return this.auto_transition_target ? this.auto_transition_target : null;
        }

        scene.getID = function(){
            return this.id ? this.id : null;
        }

        scene.getOverlay = function(){
            return this.overlay ? this.overlay : null;
        }

        scene.setText = function(text){
            this.text = text;
        }

        scene.getTargetScene = function() {
            return this.target_scene ? this.target_scene : null;
        }

        scene.getLayers = function() {
            return this.layers ? this.layers : null;
        };

        scene.getWidth = function() {
            return this.width ? this.width : null;
        };

        scene.getHeight = function() {
            return this.height ? this.height : null;
        };

        scene.getTextContent = function() {
            return this.text ? this.text : null;
        }

        scene.hasTalkers = function(){
            return (this.talkers != null);
        }

        scene.getTalkers = function(){
            return this.talkers ? this.talkers : null;
        }

        scene.getTalkerColor = function(index){
            return this.talkers[index] ? this.talkers[index] : null;
        }

        if(scene.layers){
            scene.layers.forEach(layer => {
                layer.getImage = function() {
                    return this.image ? this.image : null  
                }
    
                layer.getParallax = function() {
                    return this.parallaxStrength ? this.parallaxStrength : null
                }
    
                layer.getInteractions = function() {
                    return this.interactions ? this.interactions : null
                }

                layer.getAudioSources = function(){
                    return this.audio_sources ? this.audio_sources : null
                }
                
                const audioSources = layer.getAudioSources();  

                if (audioSources) {
                    audioSources.forEach(audioSource => {
                        audioSource.getPosX = function() {
                            return this.position[0] ? this.position[0] : null
                        }
            
                        audioSource.getPosY = function() {
                            return this.position[1] ? this.position[1] : null
                        }
    
                        audioSource.getWidth = function(){
                            return this.size[0] ? this.size[0] : null
                        }

                        audioSource.getHeight = function(){
                            return this.size[1] ? this.size[1] : null
                        }

                        audioSource.getAudioPath = function(){
                            return this.audio ? this.audio : null
                        }

                        audioSource.doesLoop = function(){
                            return this.loop ? this.loop : null
                        }
                    }
                )}

                const interactions = layer.getInteractions();  

                if (interactions) {
                    interactions.forEach(interaction => {
                        interaction.getPosX = function() {
                            return this.position[0] ? this.position[0] : null
                        }
            
                        interaction.getPosY = function() {
                            return this.position[1] ? this.position[1] : null
                        }
    
                        interaction.getWidth = function() {
                            return this.size[0] ? this.size[0] : null
                        }
            
                        interaction.getHeight = function() {
                            return this.size[1] ? this.size[1] : null  
                        }

                        interaction.getEvents = function(){
                            return this.events ? this.events : null
                        }

                        interaction.hasEvents = function(){
                            return (this.events != null);
                        }

                        interaction.getID = function(){
                            return this.id ? this.id : null
                        }

                        const events = interaction.getEvents(); 

                        if(events){
                            events.forEach(event => {
                                event.getType = function(){
                                    return this.type ? this.type : null
                                }
        
                                event.getContent = function(){
                                    return this.content ? this.content : null
                                }
        
                                event.getChoices = function(){
                                    return this.choices ? this.choices : null
                                }

                                event.hasChoices = function(){
                                    return (this.choices != null)
                                }

                                event.hasTalker = function(){
                                    return (this.talker != null)
                                }

                                event.getTalkerIndex = function(){
                                    return this.talker;
                                }

                                event.getScene = function(){
                                    return this.scene ? this.scene : null
                                }

                                const choices = event.getChoices();

                                if(choices){
                                    choices.forEach(choice => {
                                        choice.getType = function(){
                                            return this.type ? this.type : null
                                        }
                
                                        choice.getText = function(){
                                            return this.text ? this.text : null
                                        }
                
                                        choice.getTargetScene = function(){
                                            return this.scene ? this.scene : null
                                        }

                                        choice.getDialogue = function(){
                                            return this.dialogue ? this.dialogue : null
                                        }

                                        const subdialogues = choice.getDialogue();

                                        if(subdialogues){
                                            subdialogues.forEach(subdialogue => {
                                                subdialogue.getText = function(){
                                                    return this.text ? this.text : null
                                                }

                                                subdialogue.getTalkerIndex = function(){
                                                    return this.talker;
                                                }

                                                subdialogue.endGame = function(){
                                                    return this.end_game ? this.end_game : null
                                                }

                                                subdialogue.getSound = function(){
                                                    return this.sound ? this.sound : null
                                                }

                                                subdialogue.getTargetScene = function(){
                                                    return this.target_scene ? this.target_scene : null
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });  

    return json;
}

let fadeDuration = 1000;
const fadeInScreen = parentElement
  .animate(
    [{ opacity: "1" }, { opacity: "0" }, { opacity: "100" }],
    {
      fill: "forwards",
      duration: fadeDuration,
    },
  );

fadeInScreen.pause();

let inter = {
    id: 0,
    index: 0,
    limit: 0
}

var activeInteractions = [];

function interactionActive(targetID){
    found = false;

    activeInteractions.forEach((i)=>{
        console.log("checking " + i.id + " - " + targetID);
        if(i.id == targetID){
            console.log("match");
            found = true;
        }
    });
        
    console.log("found:" + found);

    return found;
}

function progressInteraction(targetID){
    let resultIndex = 0;

    activeInteractions.forEach((i)=>{
        console.log("checking " + i.id + " - " + targetID);
        if(i.id == targetID){
            if(i.index < i.limit-1){
                i.index += 1;
                resultIndex = i.index;
                console.log("new interaction index:" + i.index);
            } else {
                resultIndex = i.index;
                console.log("limit (" + i.limit + ") reached, index: " + i.index);
            }
        }
    });

    return resultIndex;
}

let playSoundIndex = 0;
  
function playTypeSound(){
    playSoundIndex++;
    if(playSoundIndex == 8){
        playSoundIndex = 0;
    }
    if(playSoundIndex == 0){
        var audio = new Audio("../Res/Audio/Dialogue.wav");
        audio.play();
    }

}

function addSubtitle(text, talkerIndex){
    console.log("adding subtitle with talkerIndex: " , talkerIndex);
    const allSubtitles = document.querySelectorAll(".dialogue-text");
    allSubtitles.forEach(subtitle => {
       subtitle.parentNode.removeChild(subtitle);
    });

    const textElement = document.createElement("p");
    textElement.classList.add("dialogue-text");

    color = talkerColors[talkerIndex];
    let isSilent = false;
    if(color == null){
        isSilent = true;
        color = "#bfbfbf";
    }
    console.log("Setting color of dialogue to: " + color);
    textElement.style.color = color;

    parentElement.appendChild(textElement);

    const textContent = text;
    let index = 0;

    function typeLetter() {
        if(!isSilent){
            playTypeSound();
        }

        if (index < textContent.length) {
            textElement.textContent += textContent.charAt(index);
            index++;

            let delay = 10;
            if(debug){
                delay = 10;
            }

            setTimeout(typeLetter, delay);
        } else {

            delay = 1500;
            if(debug){
                delay = 100;
            }                            
        }
    }

    // Start typing the text
    typeLetter();  
}

function choicesActive(){
    return document.getElementById("choice-text-parent");
}

function clearAllChoices(){
    const allChoices = document.querySelectorAll(".choice-text");
    allChoices.forEach(subtitle => {
       subtitle.parentNode.removeChild(subtitle);
    });

    choiceParent = document.getElementById("choice-text-parent");
    if(choiceParent){
        choiceParent.parentNode.removeChild(choiceParent);
    }
}

function interact(interaction, interactionElement){
    if(!interaction.hasEvents()){
        alert("no events found");
    } else {
        let event;

        if(interactionActive(interaction.getID())){
            let index = progressInteraction(interaction.getID());
            let events = interaction.getEvents();
            event = events[index]
        } else {
            var inter = {
                id: interaction.getID(),
                index: 0,
                limit: interaction.getEvents().length
            }
            activeInteractions.push(inter);
            event = interaction.getEvents()[0];
        }
        
        runEvent(event, interactionElement);
    }
}

let game_over_text = "";

function end_game(reason){
    game_over_text = reason;
    initiate("end_game");
}

function bindNextSubdialogue(parent, subtitles, index){
    console.log("Binding next subdialogue: " + index + subtitles);
    clearAllChoices();

    parent = addNextButton();

    parent.addEventListener("click", function() {
                    
        let nextSubtitle = subtitles[index];
        
        if (nextSubtitle) {
            let talkerIndex = subtitles[index].getTalkerIndex();
            talkerIndex = subtitles[index].getTalkerIndex();

            console.log("Calling add subtitle from bindNextSubdialogue with talkerIndex" + talkerIndex);
            

            if(subtitles[index].endGame()){
                end_game(subtitles[index].getText());
            }

            if(subtitles[index].getSound()){
                var audio = new Audio(subtitles[index].getSound());
                audio.play();
            }

            if(subtitles[index].getTargetScene()){
                initiate(subtitles[index].getTargetScene());
            }

            addSubtitle(subtitles[index].getText(), talkerIndex);
            bindNextSubdialogue(parent, subtitles, index + 1);
        } else {
            // If it's the last subtitle
            interact(lastInteraction, parent);
        }
    });
}

function addNextButton(){
    let choiceParent = document.getElementById("choice-text-parent");
    if (!choiceParent) {
        choiceParent = document.createElement("div");
        choiceParent.id = "choice-text-parent";
        parentElement.appendChild(choiceParent);
    }

    const textElement = document.createElement("p");
    textElement.classList.add("choice-text");
    choiceParent.appendChild(textElement);
    textElement.textContent = ">>";

    return textElement;
}

function addChoice(choice, parent) {
    let choiceParent = document.getElementById("choice-text-parent");
    if (!choiceParent) {
        choiceParent = document.createElement("div");
        choiceParent.id = "choice-text-parent";
        parentElement.appendChild(choiceParent);
    }

    const textElement = document.createElement("p");
    textElement.classList.add("choice-text");
    choiceParent.appendChild(textElement);
    textElement.textContent = choice.getText();

    let currentChoice = choice;
    textElement.addEventListener("click", function() {
        if (currentChoice.getType() === "dialogue_transition") {
            let dialogues = currentChoice.getDialogue();
            let subdialogue = dialogues[0];
            console.log("Calling add subtitle from addChoice with talkerIndex" + subdialogue.getTalkerIndex());

            addSubtitle(subdialogue.getText(), subdialogue.getTalkerIndex());
            bindNextSubdialogue(parent, dialogues, 1);
        };
        if(currentChoice.getType() === "scene_transition"){
            initiate(currentChoice.getTargetScene());
        }
    });
}

function runEvent(event, interactionElement){
    if(event.getType() == "dialogue"){
        clearAllChoices();
        console.log("Calling add subtitle from runEvent with talkerIndex" + event.getTalkerIndex());
        addSubtitle(event.getContent(), event.getTalkerIndex());                              
        if(event.hasChoices()){
            choices = event.getChoices();
            choices.forEach(choice => {
                addChoice(choice, interactionElement);
            });
        }
    }
    else if(event.getType() == "scene_transition"){
        let scene = event.getScene();
        initiate(scene);
    }
}

let audiosPlaying = [];


function fadeIn(audio, duration = 1000) {
    audio.volume = 0; // Start at volume 0
    audio.currentTime = 0; // Reset the audio
    audio.play();
    const step = 0.01; // Volume increment
    const interval = duration / (1 / step); // Interval time
    const fade = setInterval(() => {
        if (audio.volume < 1) {
            audio.volume = Math.min(audio.volume + step, 1);
        } else {
            clearInterval(fade); // Stop fading when volume reaches 1
        }
    }, interval);
}

function fadeOut(audio, duration = 1000) {
    audio.loop = false;
    const step = 0.015; // Volume decrement
    const interval = duration / (1 / step); // Interval time
    const fade = setInterval(() => {
        if (audio.volume > 0) {
            audio.volume = Math.max(audio.volume - step, 0);
        } else {
            clearInterval(fade); // Stop fading when volume reaches 0
            audio.pause();
        }
    }, interval);
}


function addLayer(layer) {
    const imageSrc = layer.getImage();
    if (imageSrc) {
        const imgElement = document.createElement("img");
        const parallaxStrength = layer.getParallax();

        imgElement.src = imageSrc; 
        imgElement.alt = `Layer ${i + 1}`; 
        imgElement.classList.add("scene-layer-image"); 
        imgElement.style.transform = `translateX(calc(-${parallaxStrength}px * var(--cursorX))) translateY(calc(-${parallaxStrength}px * var(--cursorY)))`;
        parentElement.appendChild(imgElement); 
        console.log("Loading layer image: ", imageSrc);

        const interactions = layer.getInteractions();
        if (interactions) { // Add this check to avoid null reference errors
            for (let i = 0; i < interactions.length; i++) {
                (function(index) {
                    const interaction = interactions[index];

                    const posX = interaction.getPosX();
                    const posY = interaction.getPosY();
                    const width = interaction.getWidth();
                    const height = interaction.getHeight();

                    const interactionElement = document.createElement("a");
                    interactionElement.classList.add("scene-layer-interaction"); 
                    interactionElement.style.transform = `translateX(calc(-${parallaxStrength}px * var(--cursorX))) translateY(calc(-${parallaxStrength}px * var(--cursorY)))`;

                    interactionElement.style.left = `${posX}%`;
                    interactionElement.style.top = `${posY}%`;
                    interactionElement.style.width = `${width}%`;
                    interactionElement.style.height = `${height}%`;

                    if (debug) {
                        interactionElement.style.backgroundColor = "rgba(255, 0, 0, .2)";
                    }

                    interactionElement.addEventListener("click", function() {
                        if(!choicesActive()){
                            lastInteraction = interaction;
                            interact(interaction, interactionElement);
                        }

                    });
                    parentElement.appendChild(interactionElement);
                })(i);
            }
        } else {
            console.log("No interactions found for this layer.");
        }

        const audioSources = layer.getAudioSources();
        if(audioSources){
            for (let i = 0; i < audioSources.length; i++) {
                (function(index) {
                    const audioSource = audioSources[index];

                    const posX = audioSource.getPosX();
                    const posY = audioSource.getPosY();
                    const width = audioSource.getWidth();
                    const height = audioSource.getHeight();

                    const interactionElement = document.createElement("a");
                    interactionElement.classList.add("scene-layer-audio-source"); 
                    interactionElement.style.transform = `translateX(calc(-${parallaxStrength}px * var(--cursorX))) translateY(calc(-${parallaxStrength}px * var(--cursorY)))`;

                    interactionElement.style.left = `${posX}%`;
                    interactionElement.style.top = `${posY}%`;
                    interactionElement.style.width = `${width}%`;
                    interactionElement.style.height = `${height}%`;

                    if (debug) {
                        interactionElement.style.backgroundColor = "rgba(0, 255, 0, .2)";
                    }

                    var audio = new Audio(audioSource.getAudioPath());

                    interactionElement.addEventListener("mousemove", function() {
                        if(!audiosPlaying.includes(audioSource.getAudioPath())){
                            audiosPlaying.push(audioSource.getAudioPath());
                            fadeIn(audio, 2);
                            console.log("playing audio: " + audioSource.getAudioPath())
                            audio.loop = audioSource.doesLoop();
                        }
                    });

                    document.addEventListener("mousemove", function(event) {
                        const rect = interactionElement.getBoundingClientRect();
                    
                        // Check if the pointer is outside the element's boundaries
                        const isOutside = 
                            event.clientX < rect.left || 
                            event.clientX > rect.right || 
                            event.clientY < rect.top || 
                            event.clientY > rect.bottom;
                    
                        if (isOutside) {
                            if (audiosPlaying.includes(audioSource.getAudioPath())) {
                                fadeOut(audio, 2);
                                audio.loop = false;
                                let index = audiosPlaying.indexOf(audioSource.getAudioPath());
                                audiosPlaying.splice(index, 1);
                                console.log("stopping audio: " + audioSource.getAudioPath());
                            }
                        }
                    });

                    parentElement.appendChild(interactionElement);
                })(i);
            }
        }
    } 
    else {
        console.log("Failed to load image from layer: ", layers[i]);
    }
}

async function listScenes(){
    const scene_data = await fetch_scenes();
    const scenes = scene_data.getScenes();

    scenes.forEach(scene => {
        console.log(scene.getID());
    });
}

function addOverlay(overlay){
    if(overlay == "snow"){
        overlayPath = "Res/Overlay/Snow.png"
    }
    if(overlay == "sandstorm"){
        overlayPath = "Res/Overlay/Sandstorm.png"
    }

    const imageSrc = overlayPath;
    if (imageSrc) {
        const imgElement = document.createElement("img");
        const parallaxStrength = 10;

        imgElement.src = imageSrc; 
        imgElement.alt = overlay; 
        imgElement.classList.add("scene-overlay"); 
        imgElement.style.transform = `translateX(calc(-${parallaxStrength}px * var(--cursorX))) translateY(calc(-${parallaxStrength}px * var(--cursorY)))`;
        parentElement.appendChild(imgElement); 
    }
}

function resetSizeParent(){
    parentElement.style.width = "100vw";
    parentElement.style.height = "100vh";
    parentElement.style.left = "0";
    parentElement.style.right = "0";
}

function resizeParent(scene) {
    const ratio = scene.getHeight() / scene.getWidth();
    
    const windowWidth = window.innerWidth; 
    const windowHeight = window.innerHeight;
    
    let width = windowWidth;
    let height = width * ratio;
    
    if (height > windowHeight) {
        height = windowHeight;
        width = height / ratio;
    }

    parentElement.style.width = `${width}px`;
    parentElement.style.height = `${height}px`;

    let offsetLeft = (windowWidth - width)/2;
    parentElement.style.left = `${offsetLeft}px`;
}

function onWindowResized(){
    resizeParent(currentScene);
}

window.addEventListener("resize", onWindowResized);
   
function loadGameOverScene(scene){
    resetSizeParent();
    console.log("Loading game-over scene");
    const textElement = document.createElement("p");
    textElement.classList.add("scene-text");
    textElement.classList.add("game-over-text");
    parentElement.appendChild(textElement);

    const textContent = "Your journey comes to an end..." + '\n' + game_over_text;
    let index = 0;

    function typeLetter() {
        if (index < textContent.length) {
            textElement.textContent += textContent.charAt(index);
            index++;

            let delay = 100;
            if(debug){
                delay = 40;
            }

            setTimeout(typeLetter, delay);
        } else {

            delay = 5000;
            if(debug){
                delay = 300;
            }

            setTimeout(() => initiate(scene.getTargetScene()), delay);
        }
    }

    // Start typing the text
    typeLetter();
}

function loadTextScene(scene){
    resetSizeParent();
    console.log("Loading text scene");
    const textElement = document.createElement("p");
    textElement.classList.add("scene-text");
    parentElement.appendChild(textElement);

    const textContent = scene.getTextContent();
    let index = 0;

    function typeLetter() {
        if (index < textContent.length) {
            textElement.textContent += textContent.charAt(index);
            index++;

            let delay = 30;
            if(debug){
                delay = 20;
            }

            setTimeout(typeLetter, delay);
        } else {

            delay = 3000;
            if(debug){
                delay = 100;
            }

            setTimeout(() => initiate(scene.getTargetScene()), delay);
        }
    }

    // Start typing the text
    typeLetter();
}


async function initiate(scenename){
    activeInteractions = [];

    const scenes = await fetch_scenes();
    if(scenes.hasScene(scenename)){
        if(!debug){
            fadeInScreen.play();
        }

        action = function(){
            const scene = scenes.getScene(scenename);
            console.log("Loading scene '" + scenename + "' type '" + scene.getType() + "'");
            parentElement.innerHTML = ""
            currentScene = scene;
    
            let autoTransitionTarget = scene.getAutoTransitionTarget();
            if(autoTransitionTarget){
                setTimeout(function() {
                    initiate(autoTransitionTarget);
                   }, 5000);
            }

            if(scene.getType() == "image"){
                if(scene.hasTalkers()){
                    talkerColors = [];
                    scene.getTalkers().forEach((talker, i) => {
                        let talkerColor = JSON.stringify(scene.getTalkerColor(i).color);
                        talkerColors.push(talkerColor.replace(/\"/g, ""));
                        console.log("adding talker color: " + talkerColor)
                    });
                } else {
                    console.log("scene has no talkers");
                }
                const layers = scene.getLayers();
                console.log("Layer count: " + layers.length);
                for(i in layers){
                    addLayer(layers[i]);
                }
    
                let overlay = scene.getOverlay();
                if(overlay){
                    addOverlay(overlay);
                }
        
                resizeParent(scene);
                return scene;
            }
            else if(scene.getType() == "text"){
                loadTextScene(scene);
            }
            else if(scene.getType() == "game_over"){
                loadGameOverScene(scene);
            }
        }
    }

    if(debug){
        action();
    } else {
        setTimeout(action, fadeDuration/2);
    }
}