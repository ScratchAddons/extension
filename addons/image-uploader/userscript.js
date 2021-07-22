import { insert } from "../../libraries/thirdparty/cs/text-field-edit.js";
export default async function ({ addon, global, console, msg, safeMsg }) {
  await addon.tab.loadScript(addon.self.lib + "/thirdparty/cs/md5.min.js");

  var toolbar =
    document.querySelector("#markItUpId_body > div > div.markItUpHeader > ul") ||
    document.querySelector("#markItUpId_signature > div > div.markItUpHeader > ul");

  var textBox = document.querySelector("#id_body") || document.querySelector("#id_signature");
  if (!textBox) return;

  //input  hidden)
  var uploadInput = document.createElement("input");
  uploadInput.type = "file";

  uploadInput.accept = "image/*";
  uploadInput.style.display = "none";

  //button (the one the user interacts with)
  var inputButtonContainer = document.createElement("li");
  addon.tab.displayNoneWhileDisabled(inputButtonContainer);
  inputButtonContainer.className = "markItUpButton markItUpButton17";

  var inputButton = document.createElement("a");
  inputButton.id = "uploadButton";

  let progresselement;

  inputButton.title = msg("upload-image");
  inputButton.style.backgroundImage =
    "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABVUlEQVQ4jc3SO0tCYRzH8WcOegNtTb2BXkO1SNBuFyJqC1uihhqCNCIH8xKU8BzzcspQEskWC8IWcRCji8WxEnrSCKqh+dvQRTwcybZ+8J3+8Jn+QvyL2byHfDe9c7r/d8CdJlB5JVB5xeZOt10DcKV+gHazuVINQNi9iIUDizJfWdzsXhOQrDeXqOEz3vllvtbAngIgm822DKABJB6b27n/AeZST8zEqyylr4jmT3DsVi0A/a45rQxAOByme+2BzuUbRpOb3L4MIBbLSClNwHa5ua0SALFYDOeZTn/mnI6goke/pmvbsACCpUb+AsJfACASiTB1tULwfZF15Wb+eRDn27gFsHqE2Mh/5skhPDkANE2j/3iWseIkExcOhorD9F32moBh/4iwezEHIKVEKUWtVsMwDOr1OkopE9Bi34CUklAohK7rxONxotEomqa1Bfh++6QPwtgXjMvZERUAAAAASUVORK5CYII=')";

  inputButtonContainer.appendChild(inputButton);

  //add it
  if (toolbar) {
    addon.tab.appendToSharedSpace({
      space: "forumToolbarLinkDecoration",
      element: inputButtonContainer,
      order: 1,
    });
    document.body.appendChild(uploadInput);
  }

  //events
  const onButtonClick = (e) => {
    //click on the button
    uploadInput.click(); //simulate clicking on the real input
  };

  const onFileUpload = (e) => {
    //when the input has a new file
    var file = uploadInput.files[0];
    var extension = uploadInput.files[0].name.split(".").pop().toLowerCase();
    var reader = new FileReader();

    reader.readAsArrayBuffer(file);

    reader.onloadend = function () {
      uploadAssetImage(reader.result, extension);
    };

    reader.onerror = (err) => {
      alert(msg("load-error"));
      progresselement.remove();
      throw err;
    };
  };

  const onPaste = (e) => {
    retrieveImageFromClipboardAsBlob(e, (imageBlob) => {
      if (imageBlob) {
        var reader = new FileReader();

        reader.readAsArrayBuffer(imageBlob);

        reader.onloadend = function () {
          var extension = imageBlob.name.split(".").pop().toLowerCase();

          uploadAssetImage(reader.result, extension);
        };

        reader.onerror = (err) => {
          alert(msg("load-error"));
          progresselement.remove();
          throw err;
        };
      }
    });
  };

  const onDragEnter = () => {
    textBox.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
  };

  const onDragLeave = () => {
    textBox.style.backgroundColor = "transparent";
  };

  const onDragEnd = () => {
    textBox.style.backgroundColor = "transparent";
  };

  const onDrop = (e) => {
    textBox.style.backgroundColor = "";
    console.log(e.dataTransfer);
    var file = e.dataTransfer.files[0];
    if (file) {
      e.preventDefault();
      e.stopPropagation();

      var reader = new FileReader();
      reader.readAsArrayBuffer(file);

      reader.onloadend = function () {
        var extension = file.name.split(".").pop().toLowerCase();

        uploadAssetImage(reader.result, extension);
      };

      reader.onerror = (err) => {
        alert(msg("load-error"));
        progresselement.remove();
        throw err;
      };
    }
  };

  function addListeners() {
    inputButton.addEventListener("click", onButtonClick);
    uploadInput.addEventListener("change", onFileUpload);
    textBox.addEventListener("paste", onPaste);
    textBox.addEventListener("dragenter", onDragEnter);
    textBox.addEventListener("dragleave", onDragLeave);
    textBox.addEventListener("dragend", onDragEnd);
    textBox.addEventListener("drop", onDrop);
  }
  function removeListeners() {
    inputButton.removeEventListener("click", onButtonClick);
    uploadInput.removeEventListener("change", onFileUpload);
    textBox.removeEventListener("paste", onPaste);
    textBox.removeEventListener("dragenter", onDragEnter);
    textBox.removeEventListener("dragleave", onDragLeave);
    textBox.removeEventListener("dragend", onDragEnd);
    textBox.removeEventListener("drop", onDrop);
  }
  addListeners();
  addon.self.addEventListener("disabled", () => removeListeners());
  addon.self.addEventListener("reenabled", () => addListeners());

  //cool functions below
  function retrieveImageFromClipboardAsBlob(pasteEvent, callback) {
    if (!pasteEvent.clipboardData) {
      callback(undefined);
    }

    var items = pasteEvent.clipboardData.items;

    if (!items) {
      callback(undefined);
    }

    for (var i = 0; i < items.length; i++) {
      // Skip content if not image
      if (!items[i].type.includes("image")) continue;
      // Retrieve image on clipboard as blob
      var blob = items[i].getAsFile();

      callback(blob);
    }
  }
  async function uploadAssetImage(image, fileType) {
    //this is the stuff that matters
    progresselement = toolbar.appendChild(document.createElement("li"));
    progresselement.className = "uploadStatus";
    console.log(image);

    var hash = md5(image);
    var type = fileType;
    console.log("type: " + fileType);

    progresselement.innerText = msg("uploading");

    try {
      var res = await fetch(`https://assets.scratch.mit.edu/${hash}.${type}`, {
        body: image,
        method: "POST",
        mode: "cors",
        credentials: "include",
      });
      var data = await res.json();

      if (data.status === "ok") {
        insert(textBox, `[img]https://assets.scratch.mit.edu/get_image/.%2E/${data["content-name"]}[/img]`);
        progresselement.remove();
      } else {
        alert(msg("upload-error"));
        progresselement.remove();
      }
    } catch (error) {
      alert(msg("upload-error"));
      console.log(error);
      progresselement.remove();
    }
  }
}
