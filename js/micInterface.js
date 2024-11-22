const micInterface = {
    audioContext: null,
    analyser: null,
    dataArray: null,
    sampleRate: null,

    sensitivity: 5,
    initialized: false,

    async initiateAudio() {
        // Initialize audio context and analyser
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = this.audioContext.createMediaStreamSource(stream);

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.sampleRate = this.audioContext.sampleRate;

        const bufferLength = this.analyser.fftSize;
        this.dataArray = new Float32Array(bufferLength);

        source.connect(this.analyser);
        this.initialized = true;
    },

    calculateLoudness() {
        this.analyser.getFloatTimeDomainData(this.dataArray);
        // Calculate RMS (Root Mean Square) for loudness
        const rms = Math.sqrt(
            this.dataArray.reduce((sum, value) => sum + value ** 2, 0) / this.dataArray.length
        );
        return rms;
    },

    autoCorrelate() {
        this.analyser.getFloatTimeDomainData(this.dataArray);

        const buffer = this.dataArray;
        const size = buffer.length;
        const maxOffset = Math.floor(size / 2);
        let bestOffset = -1;
        let bestCorrelation = 0;

        for (let offset = 1; offset < maxOffset; offset++) {
            let correlation = 0;

            for (let i = 0; i < size - offset; i++) {
                correlation += buffer[i] * buffer[i + offset];
            }

            correlation /= size - offset;

            if (correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestOffset = offset;
            }
        }

        // Refine offset using parabolic interpolation
        if (bestCorrelation > 0.01 && bestOffset > 0 && bestOffset < maxOffset - 1) {
            const y1 = bestCorrelation;
            const y0 = buffer[bestOffset - 1] || 0;
            const y2 = buffer[bestOffset + 1] || 0;
            const refinedOffset = bestOffset + 0.5 * ((y0 - y2) / (y0 - 2 * y1 + y2));
            return this.sampleRate / refinedOffset;
        }

        return -1; // No pitch detected
    },

    getVolumePercent() {
        console.log(this.calculateLoudness());
        return Math.min(Math.max(this.calculateLoudness() * 100, 0), 100) * this.sensitivity;
    },

    getPitch() {
        return this.autoCorrelate() * this.sensitivity;
    },

    setSensitivity(new_sensitivity){
        this.sensitivity = new_sensitivity;
    }
};

micInterface.initiateAudio();