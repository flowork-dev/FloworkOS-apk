// DOWNLOAD MANAGER WITH CHUNKING
const AndroidDownloader = {
    download: function(blob, filename, mimeType) {
        if (typeof Android === 'undefined') {
            console.error("Not in Android App");
            // Fallback ke download biasa browser
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            return;
        }

        sys.toast("Memulai Download...");

        var reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = function() {
            var base64data = reader.result.split(',')[1]; // Ambil murni base64

            // Step 1: Init Download di Android
            Android.startChunkDownload(filename, mimeType);

            // Step 2: Kirim per 500KB (Aman dari TransactionTooLargeException)
            var chunkSize = 500 * 1024;
            var totalChunks = Math.ceil(base64data.length / chunkSize);

            for (var i = 0; i < totalChunks; i++) {
                var chunk = base64data.substr(i * chunkSize, chunkSize);
                Android.appendChunk(chunk);
            }

            // Step 3: Finalize
            Android.finishChunkDownload();
        };
    }
};