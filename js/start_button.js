function link_button(){
    let button = document.getElementById("start_button");
    button.onclick = function(){
        micInterface.initiateAudio();
        fade(document.getElementById("start"));
    };
}

link_button();