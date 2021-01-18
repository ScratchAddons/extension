import downloadBlob from "../../libraries/download-blob.js";

export default async ({ addon, console, msg }) => {
  while (true) {
    const elem = await addon.tab.waitForElement('div[class*="menu-bar_file-group"] > div:last-child:not(.sa-record)', {
      markAsSeen: true,
    });
    const getOptions = () => {
      const recordOption = Object.assign(document.createElement("div"), {
        className: "mediaRecorderPopup",
      });
      const recordOptionInner = document.createElement("div");
      recordOptionInner.appendChild(
        Object.assign(document.createElement("h1"), {
          textContent: msg("option-title"),
          title: msg("added-by"),
        })
      );

      recordOptionInner.appendChild(
        Object.assign(document.createElement("p"), {
          textContent: msg("record-description"),
          className: "recordOptionDescription",
        })
      );

      // Seconds
      const recordOptionSeconds = document.createElement("p");
      const recordOptionSecondsInput = Object.assign(document.createElement("input"), {
        type: "number",
        min: 1,
        max: 120,
        defaultValue: 30,
        id: "recordOptionSecondsInput",
      });
      const recordOptionSecondsLabel = Object.assign(document.createElement("label"), {
        htmlFor: "recordOptionSecondsInput",
        textContent: msg("record-duration"),
      });
      recordOptionSeconds.appendChild(recordOptionSecondsLabel);
      recordOptionSeconds.appendChild(recordOptionSecondsInput);
      recordOptionInner.appendChild(recordOptionSeconds);

      // Audio
      const recordOptionAudio = document.createElement("p");
      const recordOptionAudioInput = Object.assign(document.createElement("input"), {
        type: "checkbox",
        defaultChecked: true,
        id: "recordOptionAudioInput",
      });
      const recordOptionAudioLabel = Object.assign(document.createElement("label"), {
        htmlFor: "recordOptionAudioInput",
        textContent: msg("record-audio"),
        title: msg("record-audio-description"),
      });
      recordOptionAudio.appendChild(recordOptionAudioInput);
      recordOptionAudio.appendChild(recordOptionAudioLabel);
      recordOptionInner.appendChild(recordOptionAudio);

      // Green flag
      const recordOptionFlag = document.createElement("p");
      const recordOptionFlagInput = Object.assign(document.createElement("input"), {
        type: "checkbox",
        defaultChecked: true,
        id: "recordOptionFlagInput",
      });
      const recordOptionFlagLabel = Object.assign(document.createElement("label"), {
        htmlFor: "recordOptionFlagInput",
        textContent: msg("record-after-flag"),
      });
      recordOptionFlag.appendChild(recordOptionFlagInput);
      recordOptionFlag.appendChild(recordOptionFlagLabel);
      recordOptionInner.appendChild(recordOptionFlag);

      let resolvePromise = null;
      const optionPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      let handleOptionClose = null;

      const handleClickOutside = (e) => {
        if (recordOptionInner.contains(e.target)) return;
        handleOptionClose(null);
      };

      document.body.addEventListener("click", handleClickOutside, {
        capture: true,
      });

      handleOptionClose = (value) => {
        resolvePromise(value);
        document.body.removeEventListener("click", handleClickOutside, {
          capture: true,
        });
        recordOption.remove();
      };

      const buttonRow = Object.assign(document.createElement("div"), {
        className: "mediaRecorderPopupButtons",
      });
      const cancelButton = Object.assign(document.createElement("button"), {
        textContent: msg("cancel"),
        className: "mediaRecorderPopupCancelButton",
      });
      cancelButton.addEventListener("click", () => handleOptionClose(null), { once: true });
      buttonRow.appendChild(cancelButton);
      const startButton = Object.assign(document.createElement("button"), {
        textContent: msg("start"),
        className: "mediaRecorderPopupStartButton",
      });
      startButton.addEventListener(
        "click",
        () =>
          handleOptionClose({
            secs: Number(recordOptionSecondsInput.value),
            audioEnabled: recordOptionAudioInput.checked,
            waitUntilFlag: recordOptionFlagInput.checked,
          }),
        { once: true }
      );
      buttonRow.appendChild(startButton);
      recordOptionInner.appendChild(buttonRow);

      recordOption.appendChild(recordOptionInner);
      document.body.appendChild(recordOption);

      return optionPromise;
    };
    const recordElem = Object.assign(document.createElement("div"), {
      className: "sa-record " + elem.className,
      textContent: msg("record"),
      title: msg("added-by"),
    });
    let isRecording = false;
    let isWaitingForFlag = false;
    let waitingForFlagFunc = null;
    let recordBuffer = [];
    let recorder;
    let timeout;
    const disposeRecorder = () => {
      isRecording = false;
      recordElem.textContent = msg("record");
      recorder = null;
      recordBuffer = [];
      clearTimeout(timeout);
      timeout = 0;
    };
    const stopRecording = (force) => {
      if (isWaitingForFlag && waitingForFlagFunc) {
        addon.tab.traps.vm.runtime.off("PROJECT_START", waitingForFlagFunc);
        isWaitingForFlag = false;
        waitingForFlagFunc = null;
        return;
      }
      if (!isRecording || !recorder || recorder.state === "inactive") return;
      if (force) {
        disposeRecorder();
      } else {
        recorder.onstop = () => {
          const blob = new Blob(recordBuffer, { type: "video/webm" });
          downloadBlob("video.webm", blob);
          disposeRecorder();
        };
        recorder.stop();
      }
    };
    const startRecording = async (opts) => {
      // Timer
      const secs = Math.min(120, Math.max(1, opts.secs));

      // Initialize MediaRecorder
      recordBuffer = [];
      isRecording = true;
      recordElem.textContent = msg("stop");
      const vm = addon.tab.traps.vm;
      if (opts.waitUntilFlag) {
        isWaitingForFlag = true;
        await new Promise((resolve) => {
          waitingForFlagFunc = () => resolve();
          vm.runtime.once("PROJECT_START", waitingForFlagFunc);
        });
      }
      isWaitingForFlag = false;
      waitingForFlagFunc = null;
      const stream = vm.runtime.renderer.canvas.captureStream();
      if (opts.audioEnabled) {
        const mediaStreamDestination = vm.runtime.audioEngine.audioContext.createMediaStreamDestination();
        vm.runtime.audioEngine.inputNode.connect(mediaStreamDestination);
        for (const track of mediaStreamDestination.stream.getAudioTracks()) {
          stream.addTrack(track);
        }
      }
      recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      recorder.ondataavailable = (e) => recordBuffer.push(e.data);
      recorder.onerror = (e) => {
        console.warn("Recorder error:", e.error);
        stopRecording(true);
      };
      timeout = setTimeout(() => stopRecording(false), secs * 1000);
      recorder.start(1000);
    };
    recordElem.addEventListener("click", async () => {
      if (isRecording) {
        stopRecording();
      } else {
        const opts = await getOptions();
        if (!opts) {
          console.log("Canceled");
          return;
        }
        startRecording(opts);
      }
    });
    elem.parentElement.appendChild(recordElem);
  }
};
