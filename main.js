// App state
let width = 16;
let height = 2;

let panelWidth = 5;

let activeSegments = [];

let currentMode = 'static', currentFrame = 0;
let lastUsedFrame = 1;
const MAX_FRAMES = 20;
let isPainting = false;

let customFunctionName = "drawFrame";

let playbackInterval = null;
let isPlayingAnim = false;
let milisecondsBetweenFrames = 500;

// Data structure: fixed array
let framesData = Array.from({ length: MAX_FRAMES }, () => ({
    activeSegments: [], 
    pixels: {} 
}));


let clearCurrentFrame = () => {
    const frame = framesData[currentFrame];
    frame.activeSegments = [];
    frame.pixels = {};
    refreshCanvas();
    updateCode();
    renderFramesUI();
}

let updateCanvasSize = (w, h) => {
    width = w;
    height = h;
    panelWidth = w > 16 ? 4 : 5;
    framesData = Array.from({ length: MAX_FRAMES }, () => ({ activeSegments: [], pixels: {} }));
    refreshCanvas();
    updateCode();
};


let changeMode = (mode) => {
    currentMode = mode;

    if (mode === 'static') {
        document.getElementById("staticMode").checked = true;
    } else {
        document.getElementById("animMode").checked = true;
    }

    const frameContainer = document.getElementById("frame-container");
    const playbackPanel = document.getElementById("playBtn");

    if (mode === 'anim') {
        frameContainer.style.display = 'block';
        playbackPanel.classList.remove("hidden-layout");
    } else {
        if (isPlayingAnim) togglePlayback(); 
        
        frameContainer.style.display = 'none';
        playbackPanel.classList.add("hidden-layout");
    }

    renderFramesUI();
    refreshCanvas();
    updateCode();
};

let changeCodeMode = () =>{
    // Change visibility of "I2C" option
    const isFullCodeChecked = document.getElementById("codeStyle").checked;
    const libraryModeDiv = document.getElementById("library-selector");
    if (isFullCodeChecked) {
        libraryModeDiv.style.display = 'flex';
    } else {
        libraryModeDiv.style.display = 'none';
    }

    // Change column-flexible mode
    // And finally, update code
    updateCode();
}

let mirrorPixels = (axis) => {
    const frame = currentMode === 'static' ? framesData[0] : framesData[currentFrame];
    const keys = Object.keys(frame.pixels);
    if (keys.length === 0) return;

    // Find bounding box of current drawing
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    const pixelCoords = keys.map(key => {
        let [seg, pix] = key.split('-').map(Number);
        let x = (seg % width) * 5 + (pix % 5);
        let y = Math.floor(seg / width) * 8 + Math.floor(pix / 5);
        
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        
        return { x, y };
    });

    const newPixels = {};
    const newActiveSegments = new Set();

    // Calculate new position for each pixel
    pixelCoords.forEach(coord => {
        let nx = coord.x;
        let ny = coord.y;

        if (axis === 'horizontal') {
            nx = maxX + minX - coord.x;
        } else if (axis === 'vertical') {
            ny = maxY + minY - coord.y;
        }

        // Convert absolute coordinates to segmet-pixel
        let newSeg = Math.floor(ny / 8) * width + Math.floor(nx / 5);
        let newPix = (ny % 8) * 5 + (nx % 5);
        
        newPixels[`${newSeg}-${newPix}`] = true;
        newActiveSegments.add(newSeg);
    });

    // Apply changes
    frame.pixels = newPixels;
    frame.activeSegments = Array.from(newActiveSegments);

    refreshCanvas();
    updateCode();
};

let movePanel = (direction) => {
    const frame = currentMode === 'static' ? framesData[0] : framesData[currentFrame];
    const newPixels = {};
    const newActiveSegments = new Set();

    // For each active pixel in the current frame
    Object.keys(frame.pixels).forEach(key => {
        let [seg, pix] = key.split('-').map(Number);
        
        // Convert to absolute (X, Y) coordinates
        // Each panel has 5 pixels wide and 8 pixels high
        let segX = (seg % width) * 5;
        let segY = Math.floor(seg / width) * 8;
        let pixX = pix % 5;
        let pixY = Math.floor(pix / 5);
        
        let absX = segX + pixX;
        let absY = segY + pixY;

        // Apply displacement
        if (direction === 'left')  absX--;
        if (direction === 'right') absX++;
        if (direction === 'up')    absY--;
        if (direction === 'down')  absY++;

        // Convert back to segment and pixel indices
        // Validate that we don't go out of bounds
        if (absX >= 0 && absX < width * 5 && absY >= 0 && absY < height * 8) {
            let newSeg = Math.floor(absY / 8) * width + Math.floor(absX / 5);
            let newPix = (absY % 8) * 5 + (absX % 5);
            
            let newKey = `${newSeg}-${newPix}`;
            newPixels[newKey] = true;
            newActiveSegments.add(newSeg);
        }
    });

    // Update frame data
    // Verify we don't exceed 8 active segments
    if (newActiveSegments.size <= 8) {
        frame.pixels = newPixels;
        frame.activeSegments = Array.from(newActiveSegments);
    } else {
        alert("Cannot move: would exceed limit of 8 active custom characters.");
    }

    refreshCanvas();
    updateCode();
};

let renderFramesUI = () => {
    const container = document.getElementById("frame-buttons");
    container.innerHTML = "";
    if (currentMode === 'static') return;

    // Get last used frame
    lastUsedFrame = 0;
    for (let i = MAX_FRAMES - 1; i >= 0; i--) {
        if (framesData[i].activeSegments.length > 0) {
            lastUsedFrame = i;
            break;
        }
    }
    // Visible frames can be currentFrame or lastUsedFrame
    let visibleFrames = Math.max(currentFrame, lastUsedFrame);
    // Render all frame buttons until visibleFraem
    for (let i = 0; i <= visibleFrames; i++) {
        const btn = document.createElement("button");
        btn.innerText = i + 1;
        if (i === currentFrame) btn.className = "active-frame";
        btn.onclick = () => { currentFrame = i; renderFramesUI(); refreshCanvas(); updateCode(); };
        container.appendChild(btn);
    }

    // Add "+" button.
    if (visibleFrames < MAX_FRAMES - 1) {
        const addBtn = document.createElement("button");
        addBtn.innerText = "+";
        addBtn.style.fontWeight = "bold";
        addBtn.title = "Add frame";
        addBtn.onclick = () => {
            currentFrame = visibleFrames + 1;
            renderFramesUI();
            refreshCanvas();
            updateCode();
        };
        container.appendChild(addBtn);

        //  TODO: add duplicate frame button
        const duplicateBtn = document.createElement("button");
        duplicateBtn.innerText = "📑";
        duplicateBtn.title = "Duplicate current frame";
        duplicateBtn.onclick = () => {
            const sourceFrame = framesData[currentFrame];
            const targetFrame = framesData[visibleFrames + 1];
            targetFrame.pixels = { ...sourceFrame.pixels }; // Create a copy of the pointer
            targetFrame.activeSegments = [ ...sourceFrame.activeSegments ];
            currentFrame = visibleFrames + 1;
            renderFramesUI();
            refreshCanvas();
            updateCode();
        };
        container.appendChild(duplicateBtn);
    }
    else if(visibleFrames === MAX_FRAMES - 1) {
        alert("Maximum frames reached. Change MAX_FRAMES on main.js file if you want extra frames, but be careful with exceeding your board RAM");
    }



};

let togglePixel = (segIdx, pixIdx, forceState = null) => {
    // Reference to the pixel from framesData
    const frame = currentMode === 'static' ? framesData[0] : framesData[currentFrame];
    const pixelId = `${segIdx}-${pixIdx}`;
    const currentState = frame.pixels[pixelId] || false;
    const newState = forceState !== null ? forceState : !currentState;

    if (newState === currentState) return;

    if (newState) {
        // Limit to 8 custom chars per frame
        if (frame.activeSegments.length >= 8 && !frame.activeSegments.includes(segIdx)) return;
        frame.pixels[pixelId] = true;
        if (!frame.activeSegments.includes(segIdx)) frame.activeSegments.push(segIdx);
    } else {
        delete frame.pixels[pixelId];
        let stillHasPixels = false;
        for (let k = 0; k < 40; k++) if (frame.pixels[`${segIdx}-${k}`]) stillHasPixels = true;
        if (!stillHasPixels) frame.activeSegments = frame.activeSegments.filter(s => s !== segIdx);
    }
    
    // Visual update only for the specific pixel to keep it fast
    const pixelElement = document.getElementById(`p-${pixelId}`);
    if (pixelElement) pixelElement.style.backgroundColor = newState ? "var(--activePixel)" : "var(--inactivePixel)";
    
    updateCode();
};

let refreshCanvas = () => {


    if (isPlayingAnim) {
        // Maybe we should restrict some functionalities here
    }

    let canvas = document.getElementById("canvas");
    canvas.innerHTML = "";
    canvas.style.padding = `${panelWidth / 10}vw`;
    canvas.style.width = `${width * panelWidth + width * (panelWidth / 5)}vw`;
    
    const frame = currentMode === 'static' ? framesData[0] : framesData[currentFrame];

    for (let i = 0; i < width * height; i++) {
        const segment = document.createElement("div");
        segment.className = "panel";
        segment.style.width = `${panelWidth}vw`;
        segment.style.height = `${8 * panelWidth / 5}vw`;
        segment.style.margin = `${panelWidth / 10}vw`;

        for (let j = 0; j < 40; j++) { // For each of the 8x5 elements of the char
            const pixel = document.createElement("div");
            pixel.className = "pixel";
            pixel.id = `p-${i}-${j}`; // Unique ID for direct access
            pixel.style.width = `${panelWidth / 5}vw`;
            pixel.style.height = `${panelWidth / 5}vw`;
            
            if (frame.pixels[`${i}-${j}`]) pixel.style.backgroundColor = "var(--activePixel)";

            pixel.onmousedown = (e) => { e.preventDefault(); isPainting = true; togglePixel(i, j); };
            pixel.onmouseenter = () => { if (isPainting) togglePixel(i, j, true); };

            segment.appendChild(pixel);
        }
        canvas.appendChild(segment);
    }
};

// Mouse Global Stop
window.onmouseup = () => { isPainting = false; };



let updateFunctionName = (newName) => {
    customFunctionName = newName;
    if (customFunctionName === "")
    {
        customFunctionName = "drawFrame";
    }
    updateCode();
}

let getFrameCode = (frameIdx) => {
    const frame = framesData[frameIdx];
    if (frame.activeSegments.length === 0) return "";
    
    let funcName = currentMode === 'static' ? "image" : `${customFunctionName}_frame${frameIdx + 1}`;
    let code = `void ${funcName}() {\n  lcd.clear();\n\n`;

    frame.activeSegments.forEach((segIdx, charIdx) => {
        let bytes = [];
        for (let row = 0; row < 8; row++) {
            let rowBinary = "B";
            for (let col = 0; col < 5; col++) {
                rowBinary += frame.pixels[`${segIdx}-${row * 5 + col}`] ? "1" : "0";
            }
            bytes.push(rowBinary);
        }
        code += `  byte img${frameIdx}_${segIdx}[8] = {${bytes.join(", ")}};\n`;
        code += `  lcd.createChar(${charIdx}, img${frameIdx}_${segIdx});\n`;
    });

    code += "\n";
    frame.activeSegments.forEach((segIdx, charIdx) => {
        code += `  lcd.setCursor(${segIdx % width}, ${Math.floor(segIdx / width)}); lcd.write(byte(${charIdx}));\n`;
    });
    return code + `}\n\n`;
};

let updateCode = () => {

    // const isColumnFlexModeChecked = document.getElementById("columnMode").checked;

    let output = "";
    if (currentMode === 'anim') {
        // Main switcher function
        output += `void ${customFunctionName}(int frameNumber) {\n`;

        // if (isColumnFlexModeChecked) {
        //     output += "\nint column = 1;\n";
        // }


        let activeFramesExist = false;
        for (let i = 0; i < MAX_FRAMES; i++) {
            // const columnArgument = isColumnFlexModeChecked ? "column" : "";
            if (framesData[i].activeSegments.length > 0) {
                output += `  if(frameNumber == ${i + 1}) ${customFunctionName}_frame${i + 1}();\n`;
                activeFramesExist = true;
            }
        }
        output += `}\n\n`;

        // Function for each frame
        // Only write functions for frames that have content
        for (let i = 0; i < MAX_FRAMES; i++) {
            if (framesData[i].activeSegments.length > 0) {
                output += getFrameCode(i);
            }
        }
    } else {
        // Static mode: just one function
        output = getFrameCode(0);
    }
    
    const codeElement = document.getElementById("generatedCode");
    if (codeElement) {
        console.log("Output final:", output)
        codeElement.innerText = output;
    }
    updateSetupCode(); // Refresh the header/setup part too

    // If code has changed, hide "copied" text alert
    document.getElementById("copyAlert").style.opacity = 0;
};

let updateSetupCode = () => {
    const isFullCodeChecked = document.getElementById("codeStyle").checked;
    const setupElement = document.getElementById("setupCode");
    
    if (!setupElement) return;

    if (!isFullCodeChecked) {
        setupElement.style.display = 'none';
    } else {
        // Show the full Arduino boilerplate
        setupElement.style.display = 'block';
        
        const useI2C = document.getElementById("library-mode").checked;
        if (useI2C) {
            setupElement.innerText = `#include <LiquidCrystal_I2C.h>\n\n` +
                        `LiquidCrystal_I2C lcd(0x27, ${width}, ${height});\n\n` +
                        `void setup() {\n` + 
                        `  lcd.init();\n` +
                        `  lcd.backlight(); // optional\n` +
                        `}\n\n`;
        } else {
        setupElement.innerText = `#include <LiquidCrystal.h>\n\n` +
                    `LiquidCrystal lcd(12, 11, 5, 4, 3, 2);\n\n` +
                    `void setup() {\n` +
                    `  lcd.begin(${width}, ${height});\n` +
                    `}\n\n`;
                    
        }

        setupElement.innerText += 
                    `void loop() {\n` +
                    `${currentMode === 'anim' ? 
                        `  for(int i=1; i<=${lastUsedFrame + 1}; i++) {\n    ${customFunctionName}(i);\n    delay(${milisecondsBetweenFrames});\n  }` : 
                        `  image();`}\n` +
                    `}\n`;
    }
};

let updateColors = (color) => {
    document.documentElement.style.setProperty('--panelBg', 'var(--panelBg' + color + ')');
    document.documentElement.style.setProperty('--activePixel', 'var(--activePixel' + color + ')');
    document.documentElement.style.setProperty('--inactivePixel', 'var(--inactivePixel' + color + ')');
    refreshCanvas();
};


let copyCode = () => {
    let code = document.getElementById("bitmap");
    code.style.whiteSpace = `pre-line`;
    document.getElementById("dummy").value = code.innerText.trim().replace(/\n\n/gm, '\n');
    document.querySelector("#dummy").select();
    document.execCommand("copy");
    code.style.whiteSpace = `nowrap`;
    document.getElementById("copyAlert").style.opacity = 0.8;
}

let changeAnimationSpeed = (newSpeed) => {

    milisecondsBetweenFrames = parseInt(newSpeed) || 500;

    // Stop animation if playing
    if (isPlayingAnim){
        togglePlayback();
    }
    // Cool trick: change twice the mode. Allows to always play, but can be bad UX
    // togglePlayback(); togglePlayback();
    updateCode();
}

let togglePlayback = () => {
    const btn = document.getElementById("playBtn");
    
    if (isPlayingAnim) {
        // STOP
        clearInterval(playbackInterval);
        isPlayingAnim = false;
        btn.innerText = "▶ PLAY Animation";
        btn.style.backgroundColor = "var(--activePixel)";
        // Back to the last edited frame
        refreshCanvas();
    } else {
        // START animation
        // Only animate in animation mode
        if (currentMode !== 'anim') {
            alert("Please switch to Anim mode first");
            return;
        }

        isPlayingAnim = true;
        btn.innerText = "■ STOP Preview";
        btn.style.backgroundColor = "#a52424"; // Stop button color

        let tempFrame = 0;
        playbackInterval = setInterval(() => {
            // Buscamos el siguiente frame que no esté vacío
            let attempts = 0;
            do {
                tempFrame = (tempFrame + 1) % MAX_FRAMES;
                attempts++;
            } while (framesData[tempFrame].activeSegments.length === 0 && attempts < MAX_FRAMES);

            // Actualizamos la vista
            currentFrame = tempFrame;
            renderFramesUI(); // Iluminate current frame button
            refreshCanvas();
            
        }, milisecondsBetweenFrames);
    }
};


window.onload = () => {
    updateCanvasSize(width, height);
    updateSetupCode();
    document.getElementById("bitmap").style.width = `calc(${(width * 5 + width) / 2}vw - 20px)`;
    document.getElementById("bitmap").style.height = `${document.getElementById("canvas").offsetHeight - 130}px`;
    changeMode('static');
};

// =================
// LOAD/EXPORT LOGIC


let exportProject = (data, fileName) => {
    const jsonString = JSON.stringify(data, null, 2); // Indent
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
    document.body.appendChild(link);
    link.click();
    
    // clean
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

let importProject = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                resolve(json);
            } catch (err) {
                reject("file is not a valid json.");
            }
        };
        reader.onerror = () => reject("Error reading file");
        reader.readAsText(file);
    });
};

let handleExport = () => {
    const dataToSave = {
        mode: currentMode,
        width: width,
        height: height,
        functionName: customFunctionName,
        framesData: framesData
    };
    exportProject(dataToSave, customFunctionName);
};

let handleImport = async (event) => {

    const file = event.target.files[0];
     console.log("Importing file ", file.name);
    if (!file) return;

    try {
        const data = await importProject(file);

        // Global var sync
        
        width = data.width || 16;
        height = data.height || 2;
        
        updateCanvasSize(width, height); // This reset canvas data, must do it before data is transfered

        currentMode = data.mode || 'static';
        customFunctionName = data.functionName || 'drawFrame';
        framesData = data.framesData;
        while (framesData.length < MAX_FRAMES) {
             framesData.push({ activeSegments: [], pixels: {} });
        }
        console.log("frames data is ",framesData);

        // Function name update
        document.getElementById("methodNameInput").value = customFunctionName;
        
        // Refresh
        changeMode(currentMode); // Also calls updateCode(); and refreshCanvas();

        
        // Clean input (?)
        event.target.value = '';
        
    } catch (err) {
        alert("Error loading data: " + err);
    }
};


