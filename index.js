// Autofocus on textarea when page loads (optional)
  window.onload = function() {
    document.getElementById('pasteArea').focus();
  };

  // Listen for paste event on the textarea
  document.getElementById('pasteArea').addEventListener('paste', function(event) {
    let handled = false;
    // Handle image files from clipboard
    if (event.clipboardData && event.clipboardData.items) {

      console.log('Clipboard contains items, checking for images...');

      for (let item of event.clipboardData.items) {

      if (item.type.indexOf('image') === 0) {

        console.log('Image found in clipboard, processing as image file...');

        const file = item.getAsFile();

        const reader = new FileReader();

        reader.onload = function(e) {

        addImageToContainer(e.target.result);

        };

        reader.readAsDataURL(file);

        handled = true;

      }

      }

    }
    
    // If not handled as image, try as text (URL)
    if (!handled) {
      console.log('No image found in clipboard, checking for text URL...');

      const text = event.clipboardData.getData('text');
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        addImageToContainer(text);
      }
    }
    // Prevent default paste behavior if handled
    if (handled) event.preventDefault();
    this.value = '';
  });

  function addImageToContainer(src) {
    const container = document.getElementById('imageContainer');
    const div = document.createElement('div');
    div.className = 'img-box';
    div.innerHTML = `<img src="${src}" />`;
    container.prepend(div);
  }